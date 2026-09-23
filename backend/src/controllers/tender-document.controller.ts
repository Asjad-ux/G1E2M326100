import type { Request, Response } from 'express';
import { getDeliveryUrl } from '../services/cloudinary.service.js';
import * as service from '../services/tender-document.service.js';
import { message, success } from '../utils/response.js';

export const create = async (req: Request, res: Response) => success(res, await service.createTenderDocument(req.auth!.userId, String(req.params.tenderId), req.file), 201);
export const officerList = async (req: Request, res: Response) => success(res, await service.listOfficerTenderDocuments(req.auth!.userId, String(req.params.tenderId)));
export const bidderList = async (req: Request, res: Response) => success(res, await service.listBidderTenderDocuments(String(req.params.tenderId)));

async function stream(res: Response, document: { cloudinaryPublicId: string | null; cloudinaryUrl: string | null; cloudinaryResourceType: string | null; originalFileName?: string | null; fileName: string; mimeType?: string | null }, download: boolean) {
  if (!document.cloudinaryPublicId || !document.cloudinaryUrl) return res.status(404).json({ success: false, message: 'Tender document is not connected to Cloudinary', errors: [] });
  const response = await fetch(getDeliveryUrl(document.cloudinaryPublicId, document.cloudinaryResourceType || 'raw', download));
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

export const officerView = async (req: Request, res: Response) => stream(res, await service.getOfficerTenderDocument(req.auth!.userId, String(req.params.id)), false);
export const officerDownload = async (req: Request, res: Response) => stream(res, await service.getOfficerTenderDocument(req.auth!.userId, String(req.params.id)), true);
export const bidderView = async (req: Request, res: Response) => stream(res, await service.getBidderTenderDocument(String(req.params.id)), false);
export const bidderDownload = async (req: Request, res: Response) => stream(res, await service.getBidderTenderDocument(String(req.params.id)), true);
export const remove = async (req: Request, res: Response) => { await service.removeTenderDocument(req.auth!.userId, String(req.params.id)); return message(res, 'Tender document deleted'); };
