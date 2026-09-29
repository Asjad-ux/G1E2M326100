import { TenderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/errors.js';
import { documentDefinitionExists } from './document-definition.service.js';

const tenderInclude = {
  requirements: true,
  documents: { orderBy: { createdAt: 'asc' as const } },
  _count: { select: { applications: true } },
};

function publicTender<T extends { documents?: unknown }>(tender: T) {
  const { documents = [], ...rest } = tender;
  return { ...rest, documents };
}

export async function createTender(officerId: string, data: any) {
  const tender = await prisma.tender.create({ data: { tenderNumber: data.tenderNumber, title: data.title, description: data.description, category: data.category, startDate: data.startDate, closingDate: data.closingDate, documentUrl: data.documentUrl, officerId, requirements: data.requirements ? { create: data.requirements } : undefined }, include: tenderInclude });
  return publicTender(tender);
}

export async function listTenders(officerId: string, query: any) {
  const tenders = await prisma.tender.findMany({ where: { officerId, ...(query.status ? { status: query.status } : {}), ...(query.category ? { category: query.category } : {}), ...(query.search ? { OR: [{ tenderNumber: { contains: query.search } }, { title: { contains: query.search } }] } : {}) }, include: tenderInclude, orderBy: { createdAt: 'desc' } });
  return tenders.map(publicTender);
}

export async function getTender(officerUserId: string, id: string) {
  const tender = await prisma.tender.findFirst({ where: { id, officer: { userId: officerUserId } }, include: { ...tenderInclude, officer: true } });
  if (!tender) return notFound('Tender not found');
  return publicTender(tender);
}

export async function getActiveTender(id: string) {
  const tender = await prisma.tender.findFirst({ where: { id, status: TenderStatus.ACTIVE }, include: tenderInclude });
  if (!tender) return notFound('Active tender not found');
  return publicTender(tender);
}

export async function updateTender(officerId: string, id: string, data: any) {
  const owner = await prisma.tender.findFirst({ where: { id, officer: { userId: officerId } } });
  if (!owner) return notFound('Tender not found');
  const tender = await prisma.tender.update({ where: { id }, data, include: tenderInclude });
  return publicTender(tender);
}

export async function changeTenderStatus(officerId: string, id: string, status: TenderStatus) {
  const owner = await prisma.tender.findFirst({ where: { id, officer: { userId: officerId } } });
  if (!owner) return notFound('Tender not found');
  const tender = await prisma.tender.update({ where: { id }, data: { status }, include: tenderInclude });
  return publicTender(tender);
}

export async function deleteTender(officerId: string, id: string) {
  const owner = await prisma.tender.findFirst({ where: { id, officer: { userId: officerId } } });
  if (!owner) return notFound('Tender not found');
  await prisma.tender.delete({ where: { id } });
}

export async function listActiveTenders() {
  const tenders = await prisma.tender.findMany({ where: { status: TenderStatus.ACTIVE }, include: tenderInclude, orderBy: { closingDate: 'asc' } });
  return tenders.map(publicTender);
}

export async function addRequirement(officerUserId: string, tenderId: string, data: any) {
  const owner = await prisma.tender.findFirst({ where: { id: tenderId, officer: { userId: officerUserId } } });
  if (!owner) return notFound('Tender not found');
  const documentType = data.documentType?.trim().toUpperCase() || (documentDefinitionExists(data.name) ? data.name.trim().toUpperCase() : null);
  return prisma.tenderRequirement.create({ data: { tenderId, ...data, documentType } });
}

export async function listRequirements(tenderId: string) { return prisma.tenderRequirement.findMany({ where: { tenderId }, orderBy: { createdAt: 'asc' } }); }

export async function updateRequirement(officerUserId: string, id: string, data: any) {
  const requirement = await prisma.tenderRequirement.findFirst({ where: { id, tender: { officer: { userId: officerUserId } } } });
  if (!requirement) return notFound('Requirement not found');
  return prisma.tenderRequirement.update({ where: { id }, data });
}

export async function deleteRequirement(officerUserId: string, id: string) {
  const requirement = await prisma.tenderRequirement.findFirst({ where: { id, tender: { officer: { userId: officerUserId } } } });
  if (!requirement) return notFound('Requirement not found');
  await prisma.tenderRequirement.delete({ where: { id } });
}
