import { z } from 'zod';

export const documentRequestCreateSchema = z.object({
  body: z.object({
    documentName: z.string().trim().min(2).max(191),
    reason: z.string().trim().min(5).max(191),
  }),
});
