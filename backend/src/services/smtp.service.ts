import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

type SmtpFailure = {
  code?: unknown;
  responseCode?: unknown;
  command?: unknown;
  message?: unknown;
};

type ResendFailure = {
  message?: unknown;
  name?: unknown;
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

function resendFailure(email: string, status: number, failure: unknown) {
  const detail = (failure && typeof failure === 'object' ? failure : {}) as ResendFailure;
  console.error('Resend email delivery failed', {
    status,
    recipientDomain: recipientDomain(email),
    errorName: typeof detail.name === 'string' ? detail.name : 'unknown',
    errorMessage: typeof detail.message === 'string' ? detail.message : 'unknown'
  });
  return new AppError(502, 'Resend email delivery failed. Check RESEND_API_KEY and RESEND_FROM.');
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

async function sendWithSmtp(email: string, code: string) {
  try {
    const transport = createTransport();
    await transport.sendMail({
      from: env.smtpFrom,
      to: email,
      subject: 'BidEazy email verification code',
      html: `<p>Your BidEazy email verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw safeSmtpFailure(email, error);
  }
}

async function sendWithResend(email: string, code: string) {
  if (!env.resendApiKey || !env.resendFrom) {
    throw new AppError(503, 'Resend email service is not configured. Set RESEND_API_KEY and RESEND_FROM.');
  }

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.resendFrom,
        to: [email],
        subject: 'BidEazy email verification code',
        html: `<p>Your BidEazy email verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`
      })
    });
  } catch {
    throw new AppError(502, 'Resend email delivery request failed. Please try again later.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw resendFailure(email, response.status, body);
  }
}

export async function sendEmailVerificationCode(email: string, code: string) {
  if (env.emailProvider === 'resend') return sendWithResend(email, code);
  return sendWithSmtp(email, code);
}
