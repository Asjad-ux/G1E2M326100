import type { RequestHandler } from 'express';
import { z } from 'zod';

export function validate(schema: z.ZodType): RequestHandler { return (req, _res, next) => { const result = schema.safeParse({ body: req.body, params: req.params, query: req.query }); if (!result.success) return next(result.error); const value = result.data as { body?: unknown; params?: unknown; query?: unknown }; if (value.body) req.body = value.body; next(); }; }
