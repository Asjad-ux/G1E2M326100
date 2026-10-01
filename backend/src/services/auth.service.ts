import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized, badRequest, conflict, AppError } from '../utils/errors.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { hashToken, issueAccessToken, issueRefreshToken, refreshExpiry, verifyRefreshToken } from '../utils/tokens.js';
import { createEmailOTP, prepareEmailOTP, sendEmailOTP, sendPreparedEmailOTP, verifyEmailOTP } from './email-otp.service.js';
import { invalidIndianPhoneMessage, normalizeIndianPhone } from '../utils/phone.js';

const userSelect = { id: true, name: true, email: true, phone: true, role: true, emailVerified: true, phoneVerified: true, isActive: true, company: true, officerProfile: true, panNumber: true, panName: true, fatherName: true, dateOfBirth: true, aadhaarNumber: true, aadhaarName: true, aadhaarDateOfBirth: true, passportNumber: true, passportName: true, passportDateOfBirth: true, nationality: true, passportIssueDate: true, passportExpiryDate: true, placeOfBirth: true, gstin: true, gstinLegalName: true, cin: true, cinLegalName: true, msmeNumber: true, msmeName: true } as const;

function publicUser(user: any) { const { passwordHash: _passwordHash, ...safe } = user; return safe; }

async function tokensFor(user: { id: string; role: UserRole }) {
  const payload = { sub: user.id, role: user.role };
  const accessToken = issueAccessToken(payload);
  const refreshToken = issueRefreshToken(payload);
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiry() } });
  return { accessToken, refreshToken };
}

function canonicalPhone(value: unknown) {
  const normalized = normalizeIndianPhone(value);
  if (!normalized) badRequest(invalidIndianPhoneMessage);
  return normalized;
}

async function ensurePhoneAvailable(phone: string) {
  const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (existing) conflict('Phone number is already registered');
}

export async function registerOfficer(data: any) {
  const phone = canonicalPhone(data.phone);
  await ensurePhoneAvailable(phone);
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({ data: { name: data.name, email: data.email.toLowerCase(), phone, passwordHash, role: UserRole.OFFICER, officerProfile: { create: { employeeId: data.employeeId, department: data.department, designation: data.designation } } }, select: userSelect });
  return publicUser(user);
}

export async function registerBidder(data: any) {
  const phone = canonicalPhone(data.phone);
  const email = data.email.trim().toLowerCase();
  const passwordHash = await hashPassword(data.password);
  const preparedEmailOTP = await prepareEmailOTP(email);
  const { user, emailOTP } = await prisma.$transaction(async (tx) => {
    const [existingByEmail, existingByPhone] = await Promise.all([
      tx.user.findUnique({ where: { email }, select: { id: true, role: true, emailVerified: true, phoneVerified: true } }),
      tx.user.findUnique({ where: { phone }, select: { id: true, role: true, emailVerified: true, phoneVerified: true } })
    ]);

    if (existingByEmail && existingByPhone && existingByEmail.id !== existingByPhone.id) {
      conflict('Email is already registered');
    }

    const existing = existingByEmail || existingByPhone;
    if (existing) {
      const duplicateMessage = existingByEmail ? 'Email is already registered' : 'Phone number is already registered';
      if (existing.role !== UserRole.BIDDER || existing.emailVerified || existing.phoneVerified) conflict(duplicateMessage);
    }

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            email,
            phone,
            passwordHash,
            isActive: true,
            company: {
              upsert: {
                create: { companyName: data.company.companyName, contactEmail: email, contactPhone: phone },
                update: { companyName: data.company.companyName, contactEmail: email, contactPhone: phone }
              }
            }
          },
          select: userSelect
        })
      : await tx.user.create({
          data: {
            name: data.name,
            email,
            phone,
            passwordHash,
            role: UserRole.BIDDER,
            company: { create: { companyName: data.company.companyName, contactEmail: email, contactPhone: phone } }
          },
          select: userSelect
        });

    const emailOTP = await createEmailOTP(tx, user.id, preparedEmailOTP);
    return { user, emailOTP };
  }, { maxWait: 10000, timeout: 30000 });

  await sendPreparedEmailOTP(emailOTP.email, emailOTP.code);
  return publicUser(user);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { company: true, officerProfile: true } });
  if (!user || !(await comparePassword(password, user.passwordHash))) return unauthorized('Invalid credentials');
  if (!user.isActive) return forbidden('Account is inactive');
  if (!user.emailVerified) return forbidden('Please verify your email before logging in');
  return { ...(await tokensFor(user)), user: publicUser(user) };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) return unauthorized('User account not found');
  return publicUser(user);
}

export async function refresh(rawToken: string) {
  let payload; try { payload = verifyRefreshToken(rawToken); } catch { return unauthorized('Invalid or expired refresh token'); }
  const stored = await prisma.refreshToken.findFirst({ where: { tokenHash: hashToken(rawToken), userId: payload.sub, revoked: false, expiresAt: { gt: new Date() } }, include: { user: true } });
  if (!stored) return unauthorized('Refresh token is revoked or expired');
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  return { ...(await tokensFor(stored.user)), user: publicUser(stored.user) };
}

export async function logout(rawToken: string) { await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(rawToken) }, data: { revoked: true } }); }

export async function sendEmail(email: string) { return sendEmailOTP(email); }
export async function verifyEmail(email: string, code: string) { return verifyEmailOTP(email, code); }

export async function forgotPassword() { return { message: 'If the account exists, password reset instructions have been sent.' }; }
export async function resetPassword() { throw new AppError(503, 'Password reset delivery is not configured for this environment'); }
