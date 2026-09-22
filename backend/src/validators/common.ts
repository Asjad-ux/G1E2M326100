import { z } from 'zod';

export const idParam = z.object({ params: z.object({ id: z.string().min(1) }) });
export const tenderIdParam = z.object({ params: z.object({ tenderId: z.string().min(1) }) });
export const strongPassword = z.string().min(8).regex(/[A-Z]/, 'Password must contain an uppercase letter').regex(/[a-z]/, 'Password must contain a lowercase letter').regex(/[0-9]/, 'Password must contain a number');
export const phone = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format');
export const dateRange = z.object({ startDate: z.coerce.date(), closingDate: z.coerce.date() }).refine(v => v.closingDate >= v.startDate, 'Closing date cannot be before start date');
