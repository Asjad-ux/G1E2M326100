import { z } from 'zod';
import { phone, strongPassword } from './common.js';

export const officerRegisterSchema = z.object({ body: z.object({ name: z.string().min(2), employeeId: z.string().min(2), email: z.string().email(), phone, department: z.string().min(2), designation: z.string().min(2), password: strongPassword }) });
export const bidderRegisterSchema = z.object({ body: z.object({ name: z.string().min(2), email: z.string().email(), phone, password: strongPassword, confirmPassword: z.string().min(1), company: z.object({ companyName: z.string().min(2) }) }).refine(value => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' }) });
export const loginSchema = z.object({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) });
export const refreshSchema = z.object({ body: z.object({ refreshToken: z.string().min(20) }) });
export const emailSendSchema = z.object({ body: z.object({ email: z.string().email() }) });
export const emailVerifySchema = z.object({ body: z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) }) });
export const forgotSchema = z.object({ body: z.object({ email: z.string().email() }) });
export const resetSchema = z.object({ body: z.object({ token: z.string().min(10), password: strongPassword }) });
