import { DocumentRequestStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { conflict } from '../utils/errors.js';

export async function createRequest(userId: string, documentName: string, reason: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const existing = await prisma.documentRequest.findFirst({ where: { requestedByUserId: userId, documentName, status: DocumentRequestStatus.PENDING } });
  if (existing) return conflict('A request for this document is already pending');
  return prisma.documentRequest.create({ data: { requestedByUserId: userId, requestedByName: user?.name || 'Procurement officer', documentName, reason } });
}

export function listRequests(userId: string) {
  return prisma.documentRequest.findMany({ where: { requestedByUserId: userId }, orderBy: { createdAt: 'desc' } });
}
