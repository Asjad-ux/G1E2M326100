import { prisma } from '../lib/prisma.js';
import { getDocumentDefinition } from './document-definition.service.js';
import { extractDocumentText, ocrError, ocrLog } from './ocr.service.js';
import { extractDefinedFields } from './document-extraction.service.js';
import { persistExtractedUserFields } from './document-user-persistence.service.js';
import { verifyAgainstExternalDatabase, type ExternalVerificationStatus } from './mock-verification.service.js';

export type DocumentExtractionSummary = {
  documentId: string;
  documentType: string;
  extractionStatus: 'SUCCESS' | 'REVIEW' | 'FAILED';
  extractedFieldCount: number;
  extractedFields: string[];
  verificationStatus?: 'VALID' | 'INVALID' | 'NOT_RUN' | 'UNAVAILABLE' | 'ERROR';
};

const verificationIdentifierFields: Record<string, string> = {
  PAN: 'panNumber',
  AADHAAR: 'aadhaarNumber',
  GSTIN: 'gstin',
  CIN: 'cin',
  MSME: 'msmeNumber',
  PASSPORT: 'passportNumber',
};

const verificationNameFields: Record<string, string> = {
  PAN: 'panName',
  GSTIN: 'gstinLegalName',
  CIN: 'cinLegalName',
  MSME: 'msmeName',
  PASSPORT: 'passportName',
};

export function shouldRunDocumentVerification(extractionStatus: 'SUCCESS' | 'REVIEW' | 'FAILED', identifier: unknown, name?: unknown) {
  return extractionStatus === 'SUCCESS'
    && typeof identifier === 'string' && Boolean(identifier.trim())
    && (name === undefined || (typeof name === 'string' && Boolean(name.trim())));
}

export function verificationStatusFor(extractionStatus: 'SUCCESS' | 'REVIEW' | 'FAILED', result?: ExternalVerificationStatus) {
  if (extractionStatus === 'FAILED') return 'NOT_RUN' as const;
  if (extractionStatus === 'REVIEW') return 'NOT_RUN' as const;
  if (result === 'VERIFIED') return 'VALID' as const;
  if (result === 'NOT_FOUND' || result === 'MISMATCH') return 'INVALID' as const;
  if (result === 'INCOMPLETE') return 'NOT_RUN' as const;
  if (result === 'NOT_SUPPORTED') return 'UNAVAILABLE' as const;
  return 'ERROR' as const;
}

function documentStatusForVerification(extractionStatus: 'SUCCESS' | 'REVIEW' | 'FAILED', verificationStatus: ReturnType<typeof verificationStatusFor>) {
  if (extractionStatus === 'FAILED') return 'FAILED' as const;
  if (extractionStatus === 'REVIEW') return 'REVIEW' as const;
  if (verificationStatus === 'VALID') return 'VERIFIED' as const;
  if (verificationStatus === 'INVALID') return 'INVALID' as const;
  return 'REVIEW' as const;
}

async function setDocumentStatuses(documentId: string, extractionStatus: 'SUCCESS' | 'REVIEW' | 'FAILED', status: 'PENDING' | 'VERIFIED' | 'INVALID' | 'REVIEW' | 'FAILED' = extractionStatus === 'SUCCESS' ? 'PENDING' : extractionStatus) {
  await prisma.document.update({ where: { id: documentId }, data: { extractionStatus, status } });
}

export async function processUploadedDocument(documentId: string): Promise<DocumentExtractionSummary | undefined> {
  const document = await prisma.document.findUnique({ where: { id: documentId }, include: { company: true } });
  if (!document) return undefined;
  const definition = getDocumentDefinition(document.documentType);
  if (!definition) {
    await setDocumentStatuses(document.id, 'FAILED', 'FAILED');
    return { documentId: document.id, documentType: document.documentType, extractionStatus: 'FAILED', extractedFieldCount: 0, extractedFields: [], verificationStatus: 'NOT_RUN' };
  }

  ocrLog('document processing started', { documentType: document.documentType });
  try {
    const ocr = await extractDocumentText({
      documentType: document.documentType,
      sourceUrl: document.cloudinaryUrl || document.fileUrl,
      cloudinaryPublicId: document.cloudinaryPublicId,
      cloudinaryResourceType: document.cloudinaryResourceType,
      mimeType: document.mimeType,
      fileName: document.originalFileName || document.fileName,
    });
    const extraction = extractDefinedFields(document.documentType, ocr.rawText, definition, ocr.lines);
    const extractedFields = Object.entries(extraction.extractedFields).filter(([, value]) => value !== null && value !== undefined && value !== '').map(([key]) => key);
    ocrLog('extraction completed', { documentType: document.documentType, extractedFieldCount: extractedFields.length, requiredFieldCount: Object.values(definition.fields).filter(field => field.required).length, extractionStatus: extraction.status });
    await persistExtractedUserFields({ userId: document.company.userId, documentType: document.documentType, definition, extracted: extraction.extractedFields });
    const identifierField = verificationIdentifierFields[document.documentType.toUpperCase()];
    const identifier = identifierField ? extraction.extractedFields[identifierField] : undefined;
    const nameField = verificationNameFields[document.documentType.toUpperCase()];
    const name = nameField ? extraction.extractedFields[nameField] : undefined;
    if (!shouldRunDocumentVerification(extraction.status, identifier, name)) {
      await setDocumentStatuses(document.id, extraction.status, extraction.status === 'SUCCESS' ? 'REVIEW' : extraction.status);
      ocrLog('verification skipped', { documentType: document.documentType, extractionStatus: extraction.status, reason: extraction.status === 'SUCCESS' ? 'required verification field missing' : 'extraction not successful' });
      return { documentId: document.id, documentType: document.documentType, extractionStatus: extraction.status, extractedFieldCount: extractedFields.length, extractedFields, verificationStatus: 'NOT_RUN' };
    }

    const externalResult = await verifyAgainstExternalDatabase(document.documentType, extraction.extractedFields);
    const verificationStatus = verificationStatusFor(extraction.status, externalResult.status);
    await setDocumentStatuses(document.id, extraction.status, documentStatusForVerification(extraction.status, verificationStatus));
    ocrLog('verification completed', { documentType: document.documentType, verificationStatus, matchedFieldCount: externalResult.matchedFields?.length || 0, mismatchedFieldCount: externalResult.mismatchedFields?.length || 0 });
    return { documentId: document.id, documentType: document.documentType, extractionStatus: extraction.status, extractedFieldCount: extractedFields.length, extractedFields, verificationStatus };
  } catch (error) {
    const provider = error && typeof error === 'object' && 'provider' in error ? String((error as { provider?: unknown }).provider || 'unknown') : 'unknown';
    const status = error && typeof error === 'object'
      ? Number(('providerStatus' in error ? (error as { providerStatus?: unknown }).providerStatus : (error as { statusCode?: unknown }).statusCode) || 0) || undefined
      : undefined;
    const stage = error && typeof error === 'object' && 'stage' in error ? String((error as { stage?: unknown }).stage || 'processing') : 'processing';
    const diagnostics = error && typeof error === 'object' && 'diagnostics' in error && (error as { diagnostics?: unknown }).diagnostics && typeof (error as { diagnostics?: unknown }).diagnostics === 'object'
      ? (error as { diagnostics: Record<string, string | number | null> }).diagnostics
      : {};
    ocrError(stage, provider, status, diagnostics);
    await setDocumentStatuses(document.id, 'FAILED', 'FAILED').catch(() => undefined);
    return { documentId: document.id, documentType: document.documentType, extractionStatus: 'FAILED', extractedFieldCount: 0, extractedFields: [], verificationStatus: 'NOT_RUN' };
  }
}
