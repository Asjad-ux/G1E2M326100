import { z } from 'zod';
import { idParam } from './common.js';
const documentBody = z.object({ documentType: z.string().min(2), fileName: z.string().min(1), fileUrl: z.string().min(1).default('/mock/uploads/document.pdf'), status: z.enum(['PENDING','VERIFIED','REVIEW','FAILED']).optional() });
export const documentCreateSchema = z.object({ body: documentBody });
export const documentPatchSchema = z.object({ params: idParam.shape.params, body: documentBody.partial() });
export const documentIdSchema = idParam;
