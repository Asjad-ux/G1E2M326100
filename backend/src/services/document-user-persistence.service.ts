import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { DocumentDefinition, DocumentFieldDefinition } from './document-definition.service.js';

const userColumnMapping: Record<string, keyof Prisma.UserUpdateInput> = {
  panNumber: 'panNumber', panName: 'panName', fatherName: 'fatherName', dateOfBirth: 'dateOfBirth',
  aadhaarNumber: 'aadhaarNumber', aadhaarDateOfBirth: 'aadhaarDateOfBirth',
  passportNumber: 'passportNumber', passportName: 'passportName', passportDateOfBirth: 'passportDateOfBirth',
  nationality: 'nationality', passportIssueDate: 'passportIssueDate', passportExpiryDate: 'passportExpiryDate', placeOfBirth: 'placeOfBirth',
  gstin: 'gstin', gstinLegalName: 'gstinLegalName', cin: 'cin', cinLegalName: 'cinLegalName', msmeNumber: 'msmeNumber', msmeName: 'msmeName',
};

function valueForUser(field: DocumentFieldDefinition, value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (field.type === 'date') {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (field.type === 'boolean') return typeof value === 'boolean' ? value : undefined;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function buildExtractedUserUpdate(documentType: string, definition: DocumentDefinition, extracted: Record<string, unknown>) {
  const data: Prisma.UserUpdateInput = {};
  const unmappedFields: string[] = [];
  for (const [fieldKey, field] of Object.entries(definition.fields)) {
    const userColumn = userColumnMapping[fieldKey];
    if (!userColumn) { unmappedFields.push(fieldKey); continue; }
    const value = valueForUser(field, extracted[fieldKey]);
    if (value !== undefined) data[userColumn] = value as never;
  }
  return { data, unmappedFields, documentType: documentType.trim().toUpperCase() };
}

export async function persistExtractedUserFields({
  userId,
  documentType,
  definition,
  extracted,
  client = prisma,
}: {
  userId: string;
  documentType: string;
  definition: DocumentDefinition;
  extracted: Record<string, unknown>;
  client?: Pick<typeof prisma, 'user'>;
}) {
  const { data, unmappedFields } = buildExtractedUserUpdate(documentType, definition, extracted);
  const fields = Object.keys(data);
  console.info(`[DOCUMENT EXTRACTION PERSIST] documentType=${documentType.toUpperCase()} fieldCount=${fields.length}`);
  if (fields.length) await client.user.update({ where: { id: userId }, data });
  return { persistedFields: fields, unmappedFields };
}

export function userPersistenceMapping() {
  return { ...userColumnMapping };
}
