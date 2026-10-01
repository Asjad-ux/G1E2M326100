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

export type PreparedEmailOTP = {
  email: string;
  code: string;
  codeHash: string;
  expiresAt: Date;
};

export async function prepareEmailOTP(email: string): Promise<PreparedEmailOTP> {
  const code = String(randomInt(100000, 1000000));
  return {
    email: normalizedEmail(email),
    code,
    codeHash: await hashPassword(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  };
}

export async function createEmailOTP(client: any, userId: string, prepared: PreparedEmailOTP) {
  await client.emailVerificationCode.updateMany({
    where: { userId, verified: false, usedAt: null },
    data: { usedAt: new Date() }
  });

  const record = await client.emailVerificationCode.create({
    data: {
      userId,
      email: prepared.email,
      codeHash: prepared.codeHash,
      expiresAt: prepared.expiresAt
    }
  });

  return { id: record.id, email: prepared.email, code: prepared.code };
}

export async function sendPreparedEmailOTP(email: string, code: string) {
  await sendEmailVerificationCode(email, code);
}

export async function sendEmailOTPForUser(userId: string, email: string) {
  const prepared = await prepareEmailOTP(email);
  const record = await createEmailOTP(prisma, userId, prepared);
  try {
    await sendPreparedEmailOTP(record.email, record.code);
  } catch (error) {
    await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    throw error;
  }
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

  return sendEmailOTPForUser(user.id, normalized);
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
