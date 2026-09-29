import type { Request, Response } from 'express';
import * as service from '../services/document-request.service.js';
import { success } from '../utils/response.js';

export const create = async (req: Request, res: Response) => success(res, await service.createRequest(req.auth!.userId, req.body.documentName, req.body.reason), 201);
export const list = async (req: Request, res: Response) => success(res, await service.listRequests(req.auth!.userId));
