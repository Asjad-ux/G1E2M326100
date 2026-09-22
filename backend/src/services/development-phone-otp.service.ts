export const DEVELOPMENT_PHONE_OTP = '123456';

export async function sendDevelopmentPhoneOTP(_phone: string) {
  // Phone OTP is intentionally a development-only flow until an SMS provider is selected.
}

export async function verifyDevelopmentPhoneOTP(_phone: string, code: string) {
  return code === DEVELOPMENT_PHONE_OTP;
}
