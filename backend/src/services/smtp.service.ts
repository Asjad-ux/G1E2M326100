import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

type SmtpFailure = {
  code?: unknown;
  responseCode?: unknown;
  command?: unknown;
  message?: unknown;
};

function recipientDomain(email: string) {
  return email.split('@')[1]?.toLowerCase() || 'unknown';
}

function safeMessage(message: string) {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .slice(0, 240);
}

function smtpFailure(email: string, failure: unknown) {
  const detail = (failure && typeof failure === 'object' ? failure : {}) as SmtpFailure;
  const code = typeof detail.code === 'string' ? detail.code : 'unavailable';
  const responseCode = Number(detail.responseCode || 0);
  const command = typeof detail.command === 'string' ? detail.command : 'unavailable';
  const message = typeof detail.message === 'string' ? safeMessage(detail.message) : 'Unknown SMTP error';

  console.error('[EMAIL] Gmail SMTP failed');
  console.error('[EMAIL] Code:', code);
  console.error('[EMAIL] Response code:', responseCode || 'unavailable');
  console.error('[EMAIL] Command:', command);
  console.error('[EMAIL] Message:', message);
  console.error('[EMAIL] Recipient domain:', recipientDomain(email));

  if (code === 'EAUTH' || responseCode === 530 || responseCode === 534 || responseCode === 535) {
    return new AppError(502, 'Gmail SMTP authentication failed. Check SMTP_USER and the Google App Password.');
  }

  if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ECONNREFUSED') {
    return new AppError(502, 'Gmail SMTP connection failed. Check SMTP_HOST, SMTP_PORT, and network access.');
  }

  return new AppError(502, 'Gmail SMTP could not send the email verification code. Please try again later.');
}

function createTransport() {
  if (!env.smtpHost || !env.smtpPort || !env.smtpUser || !env.smtpPass || !env.smtpFrom) {
    throw new AppError(503, 'Gmail SMTP email service is not configured');
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

export async function sendEmailVerificationCode(email: string, code: string) {
  console.log('[EMAIL] Provider: Gmail SMTP');
  console.log('[EMAIL] Sending verification email');
  console.log('[EMAIL] Recipient domain:', recipientDomain(email));

  try {
    const transport = createTransport();
    await transport.sendMail({
      from: env.smtpFrom,
      to: email,
      subject: 'BidEazy email verification code',
      html: `<p>Your BidEazy email verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
    });
    console.log('[EMAIL] Verification email accepted by Gmail SMTP');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw smtpFailure(email, error);
  }
}
