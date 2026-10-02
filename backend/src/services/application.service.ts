import { ApplicationStatus, CompanyStatus, NotificationType, TenderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { calculateCompliance } from './compliance.service.js';

async function bidderCompany(userId: string) {
  const company = await prisma.company.findUnique({ where: { userId } });
  if (!company) return notFound('Bidder company profile not found');
  return company;
}

export async function submitApplication(userId: string, tenderId: string, documents: { documentId: string; requirementId?: string }[] = []) {
  const [company, tender] = await Promise.all([
    bidderCompany(userId),
    prisma.tender.findUnique({ where: { id: tenderId }, include: { requirements: true } }),
  ]);
  if (company.status === CompanyStatus.BLACKLISTED) return forbidden('Your bidder company is blacklisted and cannot submit applications');
  if (!tender) return notFound('Tender not found');
  if (tender.status !== TenderStatus.ACTIVE) return badRequest('Only active tenders accept applications');
  if (tender.closingDate < new Date()) return badRequest('Tender closing date has passed');
  const distinctDocumentIds = new Set(documents.map(document => document.documentId));
  if (distinctDocumentIds.size !== documents.length) return badRequest('A document cannot be attached more than once');
  const [existing, vaultDocuments] = await Promise.all([
    prisma.application.findUnique({ where: { tenderId_companyId: { tenderId, companyId: company.id } } }),
    prisma.document.findMany({ where: { id: { in: [...distinctDocumentIds] }, companyId: company.id } }),
  ]);
  if (existing) return conflict('Your company has already applied to this tender');
  if (vaultDocuments.length !== distinctDocumentIds.size) return notFound('One or more selected documents were not found in your Document Vault');
  const requirementsById = new Map(tender.requirements.map(requirement => [requirement.id, requirement]));
  for (const document of documents) if (document.requirementId && !requirementsById.has(document.requirementId)) return badRequest('A selected document is linked to a requirement from another tender');
  const linkedRequirementIds = new Set(documents.flatMap(document => document.requirementId ? [document.requirementId] : []));
  const missingRequired = tender.requirements.filter(requirement => requirement.required && !linkedRequirementIds.has(requirement.id));
  if (missingRequired.length) return badRequest(`Missing mandatory requirements: ${missingRequired.map(requirement => requirement.name).join(', ')}`);

  const application = await prisma.application.create({ data: { tenderId, companyId: company.id, documents: { create: documents.map(document => ({ documentId: document.documentId, requirementId: document.requirementId })) } }, include: { tender: true, company: true } });
  await calculateCompliance(application.id);
  const notificationPromise = prisma.user.findMany({ where: { role: 'OFFICER' } }).then(officers => officers.length
    ? prisma.notification.createMany({ data: officers.map(officer => ({ userId: officer.id, title: 'New bid received', message: `${company.companyName} submitted a bid for ${tender.tenderNumber}`, type: NotificationType.NEW_BID })) })
    : undefined);
  const [result] = await Promise.all([
    prisma.application.findUnique({ where: { id: application.id }, include: { documents: { include: { document: true, requirement: true } }, complianceResults: true, tender: true, company: true } }),
    notificationPromise,
  ]);
  return result;
}

export async function listBidderApplications(userId: string) { const company = await bidderCompany(userId); return prisma.application.findMany({ where: { companyId: company.id }, include: { company: true, tender: { include: { requirements: true, documents: true } }, complianceResults: true, documents: { include: { document: true, requirement: true } } }, orderBy: { createdAt: 'desc' } }); }
export async function getBidderApplication(userId: string, id: string) { const company = await bidderCompany(userId); const app = await prisma.application.findFirst({ where: { id, companyId: company.id }, include: { tender: { include: { requirements: true, documents: true } }, company: true, documents: { include: { document: true, requirement: true } }, complianceResults: { include: { requirement: true } } } }); if (!app) return notFound('Application not found'); return app; }
export async function listTenderApplications(tenderId: string, officerUserId: string) { const tender = await prisma.tender.findFirst({ where: { id: tenderId, officer: { userId: officerUserId } } }); if (!tender) return notFound('Tender not found'); return prisma.application.findMany({ where: { tenderId }, include: { company: { include: { user: { select: { name: true, email: true, phone: true } } } }, documents: { include: { document: true, requirement: true } }, complianceResults: true }, orderBy: { submittedAt: 'asc' } }); }
export async function getOfficerApplication(id: string, officerUserId: string) { const app = await prisma.application.findFirst({ where: { id, tender: { officer: { userId: officerUserId } } }, include: { tender: { include: { requirements: true, documents: true } }, company: { include: { user: { select: { name: true, email: true, phone: true } }, documents: true } }, documents: { include: { document: true, requirement: true } }, complianceResults: { include: { requirement: true } } } }); if (!app) return notFound('Application not found'); return app; }
export async function updateApplicationStatus(id: string, officerUserId: string, status: ApplicationStatus, reason?: string) {
  const app = await prisma.application.findFirst({
    where: { id, tender: { officer: { userId: officerUserId } } },
    include: { company: { include: { user: true } }, tender: true },
  });
  if (!app) return notFound('Application not found');
  if (app.status !== ApplicationStatus.UNDER_REVIEW) return conflict(`Application is already ${app.status}`);

  const accepted = status === ApplicationStatus.ACCEPTED;
  const [updated] = await Promise.all([
    prisma.application.update({ where: { id }, data: { status, rejectionReason: status === ApplicationStatus.REJECTED ? reason : null } }),
    prisma.notification.create({
      data: {
        userId: app.company.userId,
        title: accepted ? 'Application accepted' : 'Application rejected',
        message: accepted ? `Your bid for ${app.tender.title} has been accepted.` : `Your bid for ${app.tender.title} has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
        type: accepted ? NotificationType.APPLICATION_ACCEPTED : NotificationType.APPLICATION_REJECTED,
      },
    }),
  ]);
  return updated;
}

export async function blacklistApplication(applicationId: string, officerUserId: string, reason: string) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, tender: { officer: { userId: officerUserId } } },
    include: { company: { include: { user: true } }, tender: true },
  });
  if (!app) return notFound('Application not found');
  if (app.company.status === CompanyStatus.BLACKLISTED) return conflict('Bidder company is already blacklisted');

  const [company] = await prisma.$transaction([
    prisma.company.update({ where: { id: app.companyId }, data: { status: CompanyStatus.BLACKLISTED, blacklistReason: reason } }),
    prisma.application.update({ where: { id: applicationId }, data: { status: ApplicationStatus.REJECTED, rejectionReason: `Bidder blacklisted: ${reason}` } }),
    prisma.notification.create({
      data: {
        userId: app.company.userId,
        title: 'Bidder account blacklisted',
        message: 'Your account/company has been blacklisted and cannot apply for future tenders.',
        type: NotificationType.BLACKLISTED,
      },
    }),
  ]);
  return company;
}
