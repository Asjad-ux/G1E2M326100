import type { Express } from 'express';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { deleteFile, uploadFile } from './cloudinary.service.js';
import { getActiveDocumentDefinitions, getDocumentDefinition } from './document-definition.service.js';
import { processUploadedDocument } from './document-processing.service.js';

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const CUSTOM_DOCUMENT_TYPE = 'OTHERS';

function normalizeDocumentType(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized === 'OTHER' ? CUSTOM_DOCUMENT_TYPE : normalized;
}

function validateUpload(file?: Express.Multer.File) {
  if (!file) return badRequest('A document file is required');
  if (file.size <= 0) return badRequest('Document file must not be empty.');
  if (!allowedMimeTypes.has(file.mimetype)) return badRequest('Unsupported document type. Upload PDF, JPG, JPEG, PNG, DOC, or DOCX.');
  if (file.size > 10 * 1024 * 1024) return badRequest('Document file size must not exceed 10 MB.');
  return file;
}

function cloudinaryMetadata(file: Express.Multer.File, uploaded: { publicId: string; secureUrl: string; resourceType: string; bytes: number; fileName: string }) {
  return {
    fileName: uploaded.fileName,
    originalFileName: file.originalname,
    mimeType: file.mimetype,
    fileSize: uploaded.bytes || file.size,
    cloudinaryPublicId: uploaded.publicId,
    cloudinaryUrl: uploaded.secureUrl,
    cloudinaryResourceType: uploaded.resourceType,
    fileUrl: uploaded.secureUrl,
  };
}

async function bidderCompany(userId: string) {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) return notFound('Company profile not found');
  return company;
}

export async function createDocument(userId: string, documentType: string, file?: Express.Multer.File, allowLegacy = false, documentName?: string) {
  const company = await bidderCompany(userId);
  const requestedType = normalizeDocumentType(documentType);
  const isCustomDocument = requestedType === CUSTOM_DOCUMENT_TYPE;
  const definition = getActiveDocumentDefinitions().find(item => item.documentType === requestedType);
  if (!definition && !allowLegacy && !isCustomDocument) return badRequest('Document definition not available. Choose a supported document type.');
  const normalizedName = documentName?.trim();
  if (isCustomDocument && !normalizedName) return badRequest('Document name is required for Others.');
  const validFile = validateUpload(file);
  const normalizedType = definition?.documentType || requestedType;
  const uploaded = await uploadFile({ userId, documentType: normalizedType, originalFileName: validFile.originalname, mimeType: validFile.mimetype, fileSize: validFile.size, buffer: validFile.buffer });
  try {
    const document = await prisma.document.create({ data: { companyId: company.id, documentType: normalizedType, documentName: isCustomDocument ? normalizedName : null, status: isCustomDocument ? 'REVIEW' : 'PENDING', extractionStatus: isCustomDocument ? 'REVIEW' : 'REVIEW', ...cloudinaryMetadata(validFile, uploaded) } });
    if (!isCustomDocument) void processUploadedDocument(document.id).catch(() => undefined);
    return document;
  } catch (error) {
    await deleteFile(uploaded.publicId, uploaded.resourceType).catch(() => undefined);
    throw error;
  }
}

export async function listDocuments(userId: string) {
  const company = await bidderCompany(userId);
  return prisma.document.findMany({ where: { companyId: company.id }, orderBy: { uploadedAt: 'desc' } });
}

export async function getDocument(userId: string, id: string) {
  const company = await bidderCompany(userId);
  const doc = await prisma.document.findFirst({ where: { id, companyId: company.id } });
  if (!doc) return notFound('Document not found');
  return doc;
}

export async function getOfficerDocument(officerUserId: string, id: string) {
  const link = await prisma.applicationDocument.findFirst({
    where: { documentId: id, application: { tender: { officer: { userId: officerUserId } } } },
    include: { document: true },
  });
  if (!link) return notFound('Document not found');
  return link.document;
}

export async function updateDocument(userId: string, id: string, data: { documentType?: string; documentName?: string }, file?: Express.Multer.File) {
  const doc = await getDocument(userId, id);
  const requestedType = data.documentType ? normalizeDocumentType(data.documentType) : normalizeDocumentType(doc.documentType);
  const isCustomDocument = requestedType === CUSTOM_DOCUMENT_TYPE;
  const normalizedName = data.documentName?.trim() || doc.documentName || undefined;
  if (isCustomDocument && !normalizedName) return badRequest('Document name is required for Others.');
  if (!file) return prisma.document.update({ where: { id: doc.id }, data: { ...(data.documentType ? { documentType: requestedType } : {}), ...(isCustomDocument ? { documentName: normalizedName } : {}) } });
  const definition = getDocumentDefinition(requestedType);
  const legacyReplacement = !definition && requestedType === normalizeDocumentType(doc.documentType);
  if ((!definition || !definition.isActive) && !legacyReplacement && !isCustomDocument) return badRequest('Document definition not available. Choose a supported document type.');
  const validFile = validateUpload(file);
  if (!doc.cloudinaryPublicId) return badRequest('Document is not connected to Cloudinary');
  const previousPublicId = doc.cloudinaryPublicId;
  const previousResourceType = doc.cloudinaryResourceType || 'raw';
  const uploaded = await uploadFile({ userId, documentType: definition?.documentType || requestedType, originalFileName: validFile.originalname, mimeType: validFile.mimetype, fileSize: validFile.size, buffer: validFile.buffer });
  try {
    const updated = await prisma.document.update({ where: { id: doc.id }, data: { documentType: definition?.documentType || requestedType, documentName: isCustomDocument ? normalizedName : null, status: isCustomDocument ? 'REVIEW' : 'PENDING', extractionStatus: isCustomDocument ? 'REVIEW' : 'REVIEW', ...cloudinaryMetadata(validFile, uploaded) } });
    await deleteFile(previousPublicId, previousResourceType).catch(() => undefined);
    if (!isCustomDocument) void processUploadedDocument(updated.id).catch(() => undefined);
    return updated;
  } catch (error) {
    await deleteFile(uploaded.publicId, uploaded.resourceType).catch(() => undefined);
    throw error;
  }
}

export async function deleteDocument(userId: string, id: string) {
  const doc = await getDocument(userId, id);
  const attached = await prisma.applicationDocument.count({ where: { documentId: doc.id } });
  if (attached > 0) return conflict('This document is attached to a submitted application and cannot be deleted');
  if (doc.cloudinaryPublicId) await deleteFile(doc.cloudinaryPublicId, doc.cloudinaryResourceType || 'raw');
  await prisma.document.delete({ where: { id: doc.id } });
}

export async function attachApplicationDocument(userId: string, applicationId: string, data: { documentId?: string; requirementId?: string; documentType?: string }, file?: Express.Multer.File) {
  const company = await bidderCompany(userId);
  const app = await prisma.application.findFirst({ where: { id: applicationId, companyId: company.id }, include: { tender: { include: { requirements: true } } } });
  if (!app) return notFound('Application not found');
  if (data.requirementId && !app.tender.requirements.some(requirement => requirement.id === data.requirementId)) return badRequest('Requirement does not belong to this tender');
  let documentId = data.documentId;
  let newlyUploadedId: string | undefined;
  if (file) {
    const created = await createDocument(userId, data.documentType || 'Other', file, true);
    if (!created) return badRequest('Document could not be created');
    documentId = created.id;
    newlyUploadedId = created.id;
  }
  if (!documentId) return badRequest('Provide an existing documentId or upload a document file');
  const document = await prisma.document.findFirst({ where: { id: documentId, companyId: company.id } });
  if (!document) return notFound('Document not found');
  const duplicate = await prisma.applicationDocument.findFirst({ where: { applicationId, documentId, requirementId: data.requirementId || null } });
  if (duplicate) return conflict('This document is already attached to the application');
  try {
    return await prisma.applicationDocument.create({ data: { applicationId, documentId, requirementId: data.requirementId } });
  } catch (error) {
    if (newlyUploadedId) await deleteDocument(userId, newlyUploadedId).catch(() => undefined);
    throw error;
  }
}
