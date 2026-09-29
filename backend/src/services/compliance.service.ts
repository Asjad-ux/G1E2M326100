import { ComplianceResultType, DocumentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/errors.js';

export async function calculateCompliance(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { documents: { include: { document: true } }, company: { include: { documents: true } }, tender: { include: { requirements: true } } },
  });
  if (!application) return notFound('Application not found');

  const attachedDocuments = application.documents.filter(link => link.document.status !== DocumentStatus.FAILED && link.document.status !== DocumentStatus.INVALID);
  const legacyDocuments = application.documents.length === 0 ? application.company.documents.filter(document => document.status !== DocumentStatus.FAILED && document.status !== DocumentStatus.INVALID) : [];
  const results = application.tender.requirements.map(requirement => {
    const linked = attachedDocuments.filter(link => link.requirementId === requirement.id).map(link => link.document);
    const matched = linked[0] || (legacyDocuments.find(document => document.documentType.toLowerCase().includes(requirement.name.toLowerCase()) || requirement.name.toLowerCase().includes(document.documentType.toLowerCase())));
    const result = !requirement.required ? ComplianceResultType.PASS : matched ? (matched.status === DocumentStatus.REVIEW ? ComplianceResultType.REVIEW : matched.status === DocumentStatus.INVALID ? ComplianceResultType.FAIL : ComplianceResultType.PASS) : ComplianceResultType.FAIL;
    return { requirementId: requirement.id, result, remarks: matched ? `${matched.fileName} matched` : 'No matching document attached' };
  });
  const required = results.filter(result => application.tender.requirements.find(requirement => requirement.id === result.requirementId)?.required);
  const passed = required.filter(result => result.result === ComplianceResultType.PASS).length;
  const score = required.length ? Math.round((passed / required.length) * 100) : 100;
  await prisma.$transaction([prisma.complianceResult.deleteMany({ where: { applicationId } }), ...results.map(result => prisma.complianceResult.create({ data: { applicationId, ...result } })), prisma.application.update({ where: { id: applicationId }, data: { complianceScore: score } })]);
  return { score, results };
}
