import { TenderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/errors.js';

export async function createTender(officerId: string, data: any) { return prisma.tender.create({ data: { tenderNumber: data.tenderNumber, title: data.title, description: data.description, category: data.category, startDate: data.startDate, closingDate: data.closingDate, documentUrl: data.documentUrl, officerId, requirements: data.requirements ? { create: data.requirements } : undefined }, include: { requirements: true } }); }
export async function listTenders(officerId: string, query: any) { return prisma.tender.findMany({ where: { officerId, ...(query.status ? { status: query.status } : {}), ...(query.category ? { category: query.category } : {}), ...(query.search ? { OR: [{ tenderNumber: { contains: query.search } }, { title: { contains: query.search } }] } : {}) }, include: { _count: { select: { applications: true } } }, orderBy: { createdAt: 'desc' } }); }
export async function getTender(id: string) { const tender = await prisma.tender.findUnique({ where: { id }, include: { requirements: true, officer: true, _count: { select: { applications: true } } } }); if (!tender) return notFound('Tender not found'); return tender; }
export async function getActiveTender(id: string) { const tender = await prisma.tender.findFirst({ where: { id, status: TenderStatus.ACTIVE }, include: { requirements: true, _count: { select: { applications: true } } } }); if (!tender) return notFound('Active tender not found'); return tender; }
export async function updateTender(officerId: string, id: string, data: any) { const owner = await prisma.tender.findFirst({ where: { id, officerId } }); if (!owner) return notFound('Tender not found'); return prisma.tender.update({ where: { id }, data }); }
export async function changeTenderStatus(officerId: string, id: string, status: TenderStatus) { const owner = await prisma.tender.findFirst({ where: { id, officerId } }); if (!owner) return notFound('Tender not found'); return prisma.tender.update({ where: { id }, data: { status } }); }
export async function deleteTender(officerId: string, id: string) { const owner = await prisma.tender.findFirst({ where: { id, officerId } }); if (!owner) return notFound('Tender not found'); await prisma.tender.delete({ where: { id } }); }
export async function listActiveTenders() { return prisma.tender.findMany({ where: { status: TenderStatus.ACTIVE }, include: { requirements: true, _count: { select: { applications: true } } }, orderBy: { closingDate: 'asc' } }); }
export async function addRequirement(tenderId: string, data: any) { return prisma.tenderRequirement.create({ data: { tenderId, ...data } }); }
export async function listRequirements(tenderId: string) { return prisma.tenderRequirement.findMany({ where: { tenderId }, orderBy: { createdAt: 'asc' } }); }
export async function updateRequirement(id: string, data: any) { return prisma.tenderRequirement.update({ where: { id }, data }); }
export async function deleteRequirement(id: string) { return prisma.tenderRequirement.delete({ where: { id } }); }
