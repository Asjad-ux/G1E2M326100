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

function safeSmtpFailure(email: string, failure: unknown) {
  const detail = (failure && typeof failure === 'object' ? failure : {}) as SmtpFailure;
  const code = typeof detail.code === 'string' ? detail.code : 'UNKNOWN';
  const responseCode = Number(detail.responseCode || 0);
  const command = typeof detail.command === 'string' ? detail.command : 'unknown';

  console.error('Gmail SMTP email delivery failed', {
    code,
    responseCode: responseCode || 'unknown',
    command,
    recipientDomain: recipientDomain(email),
  });

  if (code === 'EAUTH' || responseCode === 530 || responseCode === 534 || responseCode === 535) {
    return new AppError(502, 'Gmail SMTP authentication failed. Check SMTP_USER and the Google App Password.');
  }

  if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ECONNREFUSED') {
    return new AppError(502, 'Gmail SMTP connection failed. Check SMTP_HOST, SMTP_PORT, and network access.');
  }

  if (responseCode >= 500 && responseCode < 600) {
    return new AppError(502, 'Gmail SMTP rejected the email request. Check the sender and recipient configuration.');
  }

  return new AppError(502, 'Gmail SMTP could not send the email verification code. Please try again later.');
}

function createTransport() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass || !env.smtpFrom) {
    throw new AppError(503, 'SMTP email service is not configured');
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: 587,
    secure: false,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

export async function sendEmailVerificationCode(email: string, code: string) {
  try {
    const transport = createTransport();
    await transport.sendMail({
      from: env.smtpFrom,
      to: email,
      subject: 'CPCL email verification code',
      html: `<p>Your CPCL email verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw safeSmtpFailure(email, error);
  }
}
