import { DocumentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest } from '../utils/errors.js';
import { getDocumentDefinition, type DocumentDefinition, type DocumentFieldDefinition } from './document-definition.service.js';

function validationLog(documentType: string, valid: boolean, count: number) {
  console.info(`[DOCUMENT VALIDATION] documentType=${documentType} valid=${valid} fieldCount=${count}`);
}

function validationFieldLog(documentType: string, field: string, present: boolean, valid: boolean, reason?: string) {
  const suffix = reason ? ` reason="${reason.replace(/[\r\n"]+/g, ' ').slice(0, 240)}"` : '';
  console.info(`[DOCUMENT VALIDATION FIELD] documentType=${documentType} field=${field} present=${present} valid=${valid}${suffix}`);
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  const indian = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  const date = indian ? new Date(Date.UTC(Number(indian[3]), Number(indian[2]) - 1, Number(indian[1]))) : new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeValue(field: DocumentFieldDefinition, value: unknown) {
  if (field.type === 'date') return normalizeDate(value);
  if (field.type === 'string') return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (field.type === 'boolean') return typeof value === 'boolean' ? value : undefined;
  return undefined;
}

export function validateExtractedFields(documentType: string, extracted: Record<string, unknown>) {
  const definition = getDocumentDefinition(documentType);
  if (!definition) return badRequest(`No document definition is available for ${documentType}`);
  const verified: Record<string, unknown> = {};
  const errors: { field: string; message: string }[] = [];

  for (const [key, field] of Object.entries(definition.fields)) {
    const rawValue = extracted[key];
    const extractedValue = rawValue !== null && rawValue !== undefined && !(typeof rawValue === 'string' && !rawValue.trim());
    const normalized = normalizeValue(field, extracted[key]);
    if (normalized === undefined) {
      const reason = field.required ? `${field.label} is required` : 'Optional field was not extracted';
      if (field.required) errors.push({ field: key, message: reason });
      validationFieldLog(documentType, key, extractedValue, !field.required, reason);
      continue;
    }
    const validation = field.validation;
    const fieldErrors: string[] = [];
    if (validation?.type === 'regex' && validation.pattern && (typeof normalized !== 'string' || !new RegExp(validation.pattern, 'i').test(normalized))) fieldErrors.push(`${field.label} has an invalid format`);
    if (validation?.type === 'enum' && validation.values && !validation.values.includes(String(normalized))) fieldErrors.push(`${field.label} has an invalid value`);
    if (validation?.type === 'range' && typeof normalized === 'number' && ((validation.min !== undefined && normalized < validation.min) || (validation.max !== undefined && normalized > validation.max))) fieldErrors.push(`${field.label} is outside the allowed range`);
    fieldErrors.forEach(message => errors.push({ field: key, message }));
    validationFieldLog(documentType, key, extractedValue, fieldErrors.length === 0, fieldErrors.join('; ') || undefined);
    verified[key] = normalized;
  }
  if (errors.length) {
    validationLog(documentType, false, Object.keys(verified).length);
    return badRequest('Document data failed validation', errors);
  }
  validationLog(documentType, true, Object.keys(verified).length);
  return { definition, verified };
}

function companyData(verified: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (verified.gstin) data.gstin = verified.gstin;
  if (verified.cin) data.cin = verified.cin;
  if (verified.msmeNumber) data.msmeNumber = verified.msmeNumber;
  if (verified.panNumber) data.pan = verified.panNumber;
  return data;
}

export async function persistVerifiedDocument(documentId: string, documentType: string, extracted: Record<string, unknown>, externalVerificationStatus: 'VERIFIED' | 'NOT_SUPPORTED') {
  if (externalVerificationStatus !== 'VERIFIED' && externalVerificationStatus !== 'NOT_SUPPORTED') {
    return badRequest('External verification is required before persistence');
  }
  const result = validateExtractedFields(documentType, extracted);
  if (!result) return result;
  const { definition, verified } = result as { definition: DocumentDefinition; verified: Record<string, unknown> };
  const expiryValue = definition.isExpirable && definition.expiryField ? verified[definition.expiryField] : undefined;
  const expiresAt = expiryValue instanceof Date ? expiryValue : undefined;
  const document = await prisma.document.findUnique({ where: { id: documentId }, include: { company: true } });
  if (!document) return badRequest('Document no longer exists');

  console.info(`[DOCUMENT VERIFICATION] persistence stage reached documentType=${documentType} fieldCount=${Object.keys(verified).length}`);

  await prisma.$transaction([
    prisma.document.update({ where: { id: documentId }, data: { status: expiresAt && expiresAt <= new Date() ? DocumentStatus.EXPIRED : DocumentStatus.VERIFIED, expiresAt } }),
    ...(Object.keys(companyData(verified)).length ? [prisma.company.update({ where: { id: document.companyId }, data: companyData(verified) as any })] : []),
  ]);
  return { documentId, documentType: definition.documentType, verifiedFields: Object.keys(verified), expiresAt };
}
