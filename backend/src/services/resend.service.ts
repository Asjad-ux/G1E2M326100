import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

type ResendFailure = {
  message?: unknown;
  name?: unknown;
};

function recipientDomain(email: string) {
  return email.split('@')[1]?.toLowerCase() || 'unknown';
}

function safeProviderMessage(message: string) {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 240);
}

function resendFailure(email: string, status: number, failure: unknown) {
  const detail = (failure && typeof failure === 'object' ? failure : {}) as ResendFailure;
  const errorName = typeof detail.name === 'string' ? detail.name : 'ResendError';
  const errorMessage = typeof detail.message === 'string' ? detail.message : 'Unknown provider error';

  console.error('[EMAIL] Resend request failed:', {
    status,
    name: errorName,
    recipientDomain: recipientDomain(email),
    message: safeProviderMessage(errorMessage),
  });

  return new AppError(502, 'Resend email delivery failed. Check RESEND_API_KEY and RESEND_FROM_EMAIL.');
}

export async function sendEmailVerificationCode(email: string, code: string) {
  console.log('[EMAIL] Provider: Resend');
  console.log('[EMAIL] Sending verification email', { recipientDomain: recipientDomain(email) });

  if (!env.resendApiKey || !env.resendFromEmail) {
    console.error('[EMAIL] Resend request failed: provider is not configured');
    throw new AppError(503, 'Resend email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.');
  }

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.resendFromEmail,
        to: [email],
        subject: 'BidEazy email verification code',
        html: `<p>Your BidEazy email verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
      }),
    });
  } catch {
    console.error('[EMAIL] Resend request failed: network error');
    throw new AppError(502, 'Resend email delivery request failed. Please try again later.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw resendFailure(email, response.status, body);
  }

  console.log('[EMAIL] Verification email accepted by Resend', {
    recipientDomain: recipientDomain(email),
    status: response.status,
  });
}
