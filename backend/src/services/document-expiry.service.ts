import { DocumentStatus, NotificationType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getDocumentDefinition } from './document-definition.service.js';

export async function runDocumentExpiryCheck(now = new Date()) {
  const documents = await prisma.document.findMany({ where: { expiresAt: { lte: now }, status: { not: DocumentStatus.EXPIRED } }, include: { company: true } });
  for (const document of documents) {
    const definition = getDocumentDefinition(document.documentType);
    const name = definition?.documentName || document.documentType;
    await prisma.$transaction([
      prisma.document.update({ where: { id: document.id }, data: { status: DocumentStatus.EXPIRED } }),
      prisma.notification.create({ data: { userId: document.company.userId, title: `${name} expired`, message: `Your ${name} has expired. Please upload a new document.`, type: NotificationType.DOCUMENT_EXPIRED } }),
    ]);
  }
  return documents.length;
}
