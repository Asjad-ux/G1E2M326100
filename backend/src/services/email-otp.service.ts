import { randomInt } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { badRequest, AppError } from '../utils/errors.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { sendEmailVerificationCode } from './smtp.service.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

async function createAndSendEmailOTP(client: any, userId: string, email: string) {
  const normalized = normalizedEmail(email);
  await client.emailVerificationCode.updateMany({
    where: { userId, verified: false, usedAt: null },
    data: { usedAt: new Date() }
  });

  const code = String(randomInt(100000, 1000000));
  const record = await client.emailVerificationCode.create({
    data: {
      userId,
      email: normalized,
      codeHash: await hashPassword(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    }
  });

  try {
    await sendEmailVerificationCode(normalized, code);
  } catch (error) {
    await client.emailVerificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    throw error;
  }
}

export async function sendEmailOTPForUser(client: any, userId: string, email: string) {
  await createAndSendEmailOTP(client, userId, email);
  return { success: true, message: 'Verification code sent to your email' };
}

export async function sendEmailOTP(email: string) {
  const normalized = normalizedEmail(email);
  const recent = await prisma.emailVerificationCode.findFirst({
    where: { email: normalized, createdAt: { gt: new Date(Date.now() - OTP_COOLDOWN_MS) } },
    orderBy: { createdAt: 'desc' }
  });
  if (recent) throw new AppError(429, 'Please wait before requesting another email code');

  const user = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true, emailVerified: true } });
  if (!user) return { success: true, message: 'If the account exists, a verification code has been sent to your email' };
  if (user.emailVerified) return { success: true, message: 'Email is already verified' };

  return sendEmailOTPForUser(prisma, user.id, normalized);
}

export async function verifyEmailOTP(email: string, code: string) {
  const normalized = normalizedEmail(email);
  const record = await prisma.emailVerificationCode.findFirst({
    where: { email: normalized, verified: false, usedAt: null },
    orderBy: { createdAt: 'desc' }
  });

  if (!record) return badRequest('Invalid verification code');
  if (record.expiresAt <= new Date()) {
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return badRequest('Verification code has expired');
  }
  if (record.attempts >= MAX_ATTEMPTS) return badRequest('Too many invalid attempts; request a new code');

  const matches = await comparePassword(code, record.codeHash);
  if (!matches) {
    const attempts = record.attempts + 1;
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { attempts, ...(attempts >= MAX_ATTEMPTS ? { usedAt: new Date() } : {}) }
    });
    return badRequest(attempts >= MAX_ATTEMPTS ? 'Too many invalid attempts; request a new code' : 'Invalid verification code');
  }

  await prisma.$transaction([
    prisma.emailVerificationCode.update({ where: { id: record.id }, data: { verified: true, usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } })
  ]);
  return { success: true, verified: true };
}
