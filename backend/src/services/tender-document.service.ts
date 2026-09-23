import type { Express } from 'express';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../utils/errors.js';
import { deleteFile, uploadFile } from './cloudinary.service.js';

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function validateUpload(file?: Express.Multer.File) {
  if (!file) return badRequest('A tender document file is required');
  if (!allowedMimeTypes.has(file.mimetype)) return badRequest('Unsupported tender document type. Upload PDF, JPG, JPEG, PNG, DOC, or DOCX.');
  if (file.size > 10 * 1024 * 1024) return badRequest('Tender document file size must not exceed 10 MB.');
  return file;
}

async function officerTender(officerUserId: string, tenderId: string) {
  const tender = await prisma.tender.findFirst({ where: { id: tenderId, officer: { userId: officerUserId } } });
  if (!tender) return notFound('Tender not found');
  return tender;
}

function metadata(file: Express.Multer.File, uploaded: { publicId: string; secureUrl: string; resourceType: string; bytes: number; fileName: string }) {
  return {
    fileName: uploaded.fileName || file.originalname,
    originalFileName: file.originalname,
    mimeType: file.mimetype,
    fileSize: uploaded.bytes || file.size,
    cloudinaryPublicId: uploaded.publicId,
    cloudinaryUrl: uploaded.secureUrl,
    cloudinaryResourceType: uploaded.resourceType,
  };
}

export async function createTenderDocument(officerUserId: string, tenderId: string, file?: Express.Multer.File) {
  await officerTender(officerUserId, tenderId);
  const validFile = validateUpload(file);
  const uploaded = await uploadFile({
    userId: officerUserId,
    documentType: 'Tender Document',
    originalFileName: validFile.originalname,
    mimeType: validFile.mimetype,
    fileSize: validFile.size,
    buffer: validFile.buffer,
    folder: `CPCL-Procure/tenders/${tenderId}`,
  });
  try {
    return await prisma.tenderDocument.create({ data: { tenderId, ...metadata(validFile, uploaded) } });
  } catch (error) {
    await deleteFile(uploaded.publicId, uploaded.resourceType).catch(() => undefined);
    throw error;
  }
}

export async function listOfficerTenderDocuments(officerUserId: string, tenderId: string) {
  await officerTender(officerUserId, tenderId);
  return prisma.tenderDocument.findMany({ where: { tenderId }, orderBy: { createdAt: 'asc' } });
}

export async function listBidderTenderDocuments(tenderId: string) {
  const tender = await prisma.tender.findFirst({ where: { id: tenderId, status: 'ACTIVE' } });
  if (!tender) return notFound('Active tender not found');
  return prisma.tenderDocument.findMany({ where: { tenderId }, orderBy: { createdAt: 'asc' } });
}

export async function getOfficerTenderDocument(officerUserId: string, id: string) {
  const document = await prisma.tenderDocument.findFirst({ where: { id, tender: { officer: { userId: officerUserId } } } });
  if (!document) return notFound('Tender document not found');
  return document;
}

export async function getBidderTenderDocument(id: string) {
  const document = await prisma.tenderDocument.findFirst({ where: { id, tender: { status: 'ACTIVE' } } });
  if (!document) return notFound('Tender document not found');
  return document;
}

export async function removeTenderDocument(officerUserId: string, id: string) {
  const document = await getOfficerTenderDocument(officerUserId, id);
  if (document.cloudinaryPublicId) await deleteFile(document.cloudinaryPublicId, document.cloudinaryResourceType || 'raw');
  await prisma.tenderDocument.delete({ where: { id } });
}
