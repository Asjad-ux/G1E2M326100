import { ComplianceResultType, DocumentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/errors.js';

export async function calculateCompliance(applicationId: string) {
  const application = await prisma.application.findUnique({ where: { id: applicationId }, include: { company: { include: { documents: true } }, tender: { include: { requirements: true } } } });
  if (!application) return notFound('Application not found');
  const docs = application.company.documents.filter(d => d.status !== DocumentStatus.FAILED);
  const results = application.tender.requirements.map(requirement => {
    const matched = docs.find(d => d.documentType.toLowerCase().includes(requirement.name.toLowerCase()) || requirement.name.toLowerCase().includes(d.documentType.toLowerCase()));
    const result = !requirement.required ? ComplianceResultType.PASS : matched ? (matched.status === DocumentStatus.REVIEW ? ComplianceResultType.REVIEW : ComplianceResultType.PASS) : ComplianceResultType.FAIL;
    return { requirementId: requirement.id, result, remarks: matched ? `${matched.fileName} matched` : 'No matching document found' };
  });
  const required = results.filter(r => application.tender.requirements.find(req => req.id === r.requirementId)?.required);
  const passed = required.filter(r => r.result === ComplianceResultType.PASS).length;
  const score = required.length ? Math.round((passed / required.length) * 100) : 100;
  await prisma.$transaction([prisma.complianceResult.deleteMany({ where: { applicationId } }), ...results.map(r => prisma.complianceResult.create({ data: { applicationId, ...r } })), prisma.application.update({ where: { id: applicationId }, data: { complianceScore: score } })]);
  return { score, results };
}
