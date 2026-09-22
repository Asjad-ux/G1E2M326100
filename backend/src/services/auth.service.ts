import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized, badRequest, AppError } from '../utils/errors.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { hashToken, issueAccessToken, issueRefreshToken, refreshExpiry, verifyRefreshToken } from '../utils/tokens.js';
import { DEVELOPMENT_PHONE_OTP, sendDevelopmentPhoneOTP, verifyDevelopmentPhoneOTP } from './development-phone-otp.service.js';
import { sendEmailOTP, verifyEmailOTP } from './email-otp.service.js';

const userSelect = { id: true, name: true, email: true, phone: true, role: true, emailVerified: true, phoneVerified: true, isActive: true, company: true, officerProfile: true } as const;

function publicUser(user: any) { const { passwordHash: _passwordHash, ...safe } = user; return safe; }

async function tokensFor(user: { id: string; role: UserRole }) {
  const payload = { sub: user.id, role: user.role };
  const accessToken = issueAccessToken(payload);
  const refreshToken = issueRefreshToken(payload);
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiry() } });
  return { accessToken, refreshToken };
}

export async function registerOfficer(data: any) {
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({ data: { name: data.name, email: data.email.toLowerCase(), phone: data.phone, passwordHash, role: UserRole.OFFICER, officerProfile: { create: { employeeId: data.employeeId, department: data.department, designation: data.designation } } }, select: userSelect });
  return publicUser(user);
}

export async function registerBidder(data: any) {
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({ data: { name: data.name, email: data.email.toLowerCase(), phone: data.phone, passwordHash, role: UserRole.BIDDER, company: { create: { companyName: data.company.companyName, cin: data.company.cin, pan: data.company.pan, gstin: data.company.gstin, msmeNumber: data.company.msmeNumber, contactEmail: data.email, contactPhone: data.phone } } }, select: userSelect });
  return publicUser(user);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { company: true, officerProfile: true } });
  if (!user || !(await comparePassword(password, user.passwordHash))) return unauthorized('Invalid credentials');
  if (!user.isActive) return forbidden('Account is inactive');
  if (!user.emailVerified) return forbidden('Please verify your email before logging in');
  return { ...(await tokensFor(user)), user: publicUser(user) };
}

export async function refresh(rawToken: string) {
  let payload; try { payload = verifyRefreshToken(rawToken); } catch { return unauthorized('Invalid or expired refresh token'); }
  const stored = await prisma.refreshToken.findFirst({ where: { tokenHash: hashToken(rawToken), userId: payload.sub, revoked: false, expiresAt: { gt: new Date() } }, include: { user: true } });
  if (!stored) return unauthorized('Refresh token is revoked or expired');
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  return { ...(await tokensFor(stored.user)), user: publicUser(stored.user) };
}

export async function logout(rawToken: string) { await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(rawToken) }, data: { revoked: true } }); }

export async function sendPhone(phone: string) { await sendDevelopmentPhoneOTP(phone); return { success: true, message: 'Development OTP sent', developmentOtp: DEVELOPMENT_PHONE_OTP }; }

export async function verifyPhone(phone: string, code: string) {
  const verified = await verifyDevelopmentPhoneOTP(phone, code);
  if (!verified) return badRequest('Invalid or expired verification code');
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return badRequest('No account is registered with this phone number');
  await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
  return { success: true, verified: true };
}

export async function sendEmail(email: string) { return sendEmailOTP(email); }
export async function verifyEmail(email: string, code: string) { return verifyEmailOTP(email, code); }

export async function forgotPassword() { return { message: 'If the account exists, password reset instructions have been sent.' }; }
export async function resetPassword() { throw new AppError(503, 'Password reset delivery is not configured for this environment'); }
