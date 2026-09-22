import { z } from 'zod';
import { idParam, tenderIdParam } from './common.js';
export const applicationTenderSchema = z.object({ params: tenderIdParam.shape.params, body: z.object({ documents: z.array(z.object({ documentId: z.string(), requirementId: z.string().optional() })).optional() }) });
export const applicationIdSchema = idParam;
export const rejectSchema = z.object({ params: idParam.shape.params, body: z.object({ reason: z.string().min(3) }) });
export const blacklistSchema = z.object({ params: z.object({ companyId: z.string().min(1) }), body: z.object({ reason: z.string().min(3) }) });
export const applicationDocumentSchema = z.object({ params: z.object({ applicationId: z.string().min(1) }), body: z.object({ documentId: z.string().optional(), requirementId: z.string().optional(), documentType: z.string().optional(), fileName: z.string().optional(), fileUrl: z.string().optional(), saveToDocumentVault: z.boolean().default(false) }).refine(v => !!v.documentId || (!!v.documentType && !!v.fileName), 'Provide an existing documentId or new document metadata') });
