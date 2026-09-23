import type { Request, Response } from 'express';
import * as service from '../services/document.service.js';
import { getDeliveryUrl } from '../services/cloudinary.service.js';
import { notFound } from '../utils/errors.js';
import { success, message } from '../utils/response.js';

export const create = async (req: Request, res: Response) => success(res, await service.createDocument(req.auth!.userId, String(req.body.documentType), req.file), 201);
export const list = async (req: Request, res: Response) => success(res, await service.listDocuments(req.auth!.userId));
export const get = async (req: Request, res: Response) => success(res, await service.getDocument(req.auth!.userId, String(req.params.id)));
export const patch = async (req: Request, res: Response) => success(res, await service.updateDocument(req.auth!.userId, String(req.params.id), req.body, req.file), 200);
export const remove = async (req: Request, res: Response) => {
  await service.deleteDocument(req.auth!.userId, String(req.params.id));
  return message(res, 'Document deleted');
};
export const attach = async (req: Request, res: Response) => success(res, await service.attachApplicationDocument(req.auth!.userId, String(req.params.applicationId), req.body, req.file), 201);

async function streamFromCloudinary(res: Response, document: Awaited<ReturnType<typeof service.getDocument>>, download: boolean) {
  if (!document.cloudinaryPublicId || !document.cloudinaryUrl) return notFound('Document is not connected to Cloudinary');
  const url = getDeliveryUrl(document.cloudinaryPublicId, document.cloudinaryResourceType || 'raw', download);
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
    const message = body.error?.message || body.message || `Cloudinary document delivery failed with HTTP ${response.status}`;
    return res.status(response.status).json({ success: false, message, errors: [] });
  }
  const fileName = (document.originalFileName || document.fileName).replace(/[\"\r\n]/g, '_');
  res.status(200);
  res.setHeader('Content-Type', response.headers.get('content-type') || document.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${fileName}"`);
  const contentLength = response.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);
  return res.send(Buffer.from(await response.arrayBuffer()));
}

export const view = async (req: Request, res: Response) => streamFromCloudinary(res, await service.getDocument(req.auth!.userId, String(req.params.id)), false);
export const download = async (req: Request, res: Response) => streamFromCloudinary(res, await service.getDocument(req.auth!.userId, String(req.params.id)), true);
export const officerView = async (req: Request, res: Response) => streamFromCloudinary(res, await service.getOfficerDocument(req.auth!.userId, String(req.params.id)), false);
export const officerDownload = async (req: Request, res: Response) => streamFromCloudinary(res, await service.getOfficerDocument(req.auth!.userId, String(req.params.id)), true);
