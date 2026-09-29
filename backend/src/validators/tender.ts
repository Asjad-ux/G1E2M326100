import { z } from 'zod';
import { dateRange, idParam, tenderIdParam } from './common.js';

const requirement = z.object({ name: z.string().min(1), documentType: z.string().trim().min(2).optional(), category: z.enum(['STATUTORY','FINANCIAL','EXPERIENCE','TECHNICAL']), required: z.boolean().default(true), description: z.string().optional() });
export const tenderCreateSchema = z.object({ body: z.object({ tenderNumber: z.string().min(3), title: z.string().min(3), description: z.string().min(3), category: z.string().min(2), startDate: z.coerce.date(), closingDate: z.coerce.date(), documentUrl: z.string().optional(), requirements: z.array(requirement).optional() }).refine(v => v.closingDate >= v.startDate, 'Closing date cannot be before start date') });
export const tenderPatchSchema = z.object({ params: idParam.shape.params, body: z.object({ title: z.string().min(3).optional(), description: z.string().min(3).optional(), category: z.string().min(2).optional(), startDate: z.coerce.date().optional(), closingDate: z.coerce.date().optional(), documentUrl: z.string().optional() }).refine(v => !v.startDate || !v.closingDate || v.closingDate >= v.startDate, 'Closing date cannot be before start date') });
export const requirementCreateSchema = z.object({ params: tenderIdParam.shape.params, body: requirement });
export const requirementPatchSchema = z.object({ params: idParam.shape.params, body: requirement.partial() });
export const requirementDeleteSchema = idParam;
