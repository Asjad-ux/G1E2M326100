import type { Request, Response } from 'express';
import { publicDocumentDefinitions } from '../services/document-definition.service.js';
import { success } from '../utils/response.js';

export const list = (_req: Request, res: Response) => success(res, publicDocumentDefinitions());
