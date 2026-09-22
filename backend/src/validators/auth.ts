import { z } from 'zod';
import { phone, strongPassword } from './common.js';

const optionalRegistrationNumber = (pattern: RegExp, message: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().regex(pattern, message).optional(),
  );

const pan = optionalRegistrationNumber(/^[A-Z]{5}\d{4}[A-Z]$/i, 'PAN must be 10 characters in the format ABCDE1234F');
const gstin = optionalRegistrationNumber(
  /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/i,
  'GSTIN must be 15 characters in the standard GSTIN format',
);
const cin = optionalRegistrationNumber(
  /^[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/i,
  'CIN must be 21 characters in the format U12345DL2020PTC123456',
);
const msmeNumber = optionalRegistrationNumber(
  /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/i,
  'MSME number must be in the format UDYAM-DL-00-1234567',
);

export const officerRegisterSchema = z.object({ body: z.object({ name: z.string().min(2), employeeId: z.string().min(2), email: z.string().email(), phone, department: z.string().min(2), designation: z.string().min(2), password: strongPassword }) });
export const bidderRegisterSchema = z.object({ body: z.object({ name: z.string().min(2), email: z.string().email(), phone, password: strongPassword, company: z.object({ companyName: z.string().min(2), cin, pan, gstin, msmeNumber }) }) });
export const loginSchema = z.object({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) });
export const refreshSchema = z.object({ body: z.object({ refreshToken: z.string().min(20) }) });
export const phoneSendSchema = z.object({ body: z.object({ phone }) });
export const phoneVerifySchema = z.object({ body: z.object({ phone, code: z.string().regex(/^\d{4,8}$/) }) });
export const emailSendSchema = z.object({ body: z.object({ email: z.string().email() }) });
export const emailVerifySchema = z.object({ body: z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) }) });
export const forgotSchema = z.object({ body: z.object({ email: z.string().email() }) });
export const resetSchema = z.object({ body: z.object({ token: z.string().min(10), password: strongPassword }) });
