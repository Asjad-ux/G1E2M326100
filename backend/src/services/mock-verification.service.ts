import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { env } from '../config/env.js';

const panDigitConfusions: Record<string, string> = { O: '0', I: '1', L: '1', S: '5', B: '8', G: '6', Z: '2' };

function normalizePanShape(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length !== 10) return null;
  let normalized = '';
  for (let index = 0; index < compact.length; index += 1) {
    const character = compact[index];
    if (index < 5 || index === 9) {
      if (!/[A-Z]/.test(character)) return null;
      normalized += character;
    } else if (/[0-9]/.test(character)) normalized += character;
    else if (panDigitConfusions[character]) normalized += panDigitConfusions[character];
    else return null;
  }
  return normalized;
}

function verificationLog(message: string, details: Record<string, unknown> = {}) {
  const suffix = Object.entries(details).map(([key, value]) => `${key}=${String(value)}`).join(' ');
  console.info(`[VERIFY] ${message}${suffix ? ` ${suffix}` : ''}`);
}

function verificationFieldLog(documentType: string, field: string, matched: boolean) {
  console.info(`[VERIFY FIELD] documentType=${documentType} field=${field} matched=${matched}`);
}

export type ExternalVerificationStatus = 'VERIFIED' | 'NOT_FOUND' | 'MISMATCH' | 'INCOMPLETE' | 'NOT_SUPPORTED' | 'ERROR';

export type ExternalVerificationResult = {
  status: ExternalVerificationStatus;
  reason?: string;
  matchedFields?: string[];
  mismatchedFields?: string[];
};

type VerificationClient = {
  gSTRecord: any;
  aadhaarRecord: any;
  cINRecord: any;
  mSMERecord: any;
  phoneRecord: any;
  emailRecord: any;
  panVerification: any;
  $disconnect: () => Promise<void>;
};

let clientPromise: Promise<VerificationClient> | undefined;

function clientModulePath() {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), 'verification-database/generated/client/index.js'),
    resolve(process.cwd(), '../verification-database/generated/client/index.js'),
    resolve(sourceDirectory, '../../../verification-database/generated/client/index.js'),
  ];
  return candidates.find(candidate => existsSync(candidate));
}

async function getClient(): Promise<VerificationClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const generatedClient = clientModulePath();
      if (!generatedClient) throw new Error('Verification database client is not available');
      const module = await import(pathToFileURL(generatedClient).href) as { PrismaClient?: new (options?: unknown) => VerificationClient };
      if (!module.PrismaClient) throw new Error('Verification database client is invalid');
      return new module.PrismaClient({ datasources: { db: { url: env.verificationDatabaseUrl } } });
    })();
  }
  return clientPromise;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function comparableName(value: unknown) {
  return text(value).replace(/\s+/g, ' ').toLocaleUpperCase();
}

function digits(value: unknown) {
  return text(value).replace(/\D/g, '');
}

function safeResult(status: ExternalVerificationStatus, reason?: string, matchedFields?: string[], mismatchedFields?: string[]): ExternalVerificationResult {
  return { status, ...(reason ? { reason } : {}), ...(matchedFields?.length ? { matchedFields } : {}), ...(mismatchedFields?.length ? { mismatchedFields } : {}) };
}

function logResult(documentType: string, result: ExternalVerificationResult) {
  const details: Record<string, unknown> = {
    documentType,
    status: result.status,
    matchedFieldCount: result.matchedFields?.length || 0,
    mismatchedFieldCount: result.mismatchedFields?.length || 0,
  };
  if (result.reason) details.reason = result.reason;
  const suffix = Object.entries(details).map(([key, value]) => `${key}=${String(value)}`).join(' ');
  console.info(`[VERIFY] external verification completed${suffix ? ` ${suffix}` : ''}`);
}

function compare(checks: Array<[string, boolean]>): ExternalVerificationResult {
  const matched = checks.filter(([, matches]) => matches).map(([field]) => field);
  const mismatched = checks.filter(([, matches]) => !matches).map(([field]) => field);
  return mismatched.length
    ? safeResult('MISMATCH', 'Verification record did not match extracted document data', matched, mismatched)
    : safeResult('VERIFIED', undefined, matched);
}

async function verifyGstin(client: VerificationClient, fields: Record<string, unknown>): Promise<ExternalVerificationResult> {
  const identifier = text(fields.gstin).replace(/[\s-]+/g, '').toLocaleUpperCase();
  const name = text(fields.gstinLegalName);
  if (!identifier || !name) return safeResult('INCOMPLETE', 'Required verification fields were not extracted');
  const record = await client.gSTRecord.findUnique({ where: { gstin: identifier }, include: { entity: true } });
  if (!record) return safeResult('NOT_FOUND', 'No GSTIN verification record was found');
  return compare([
    ['gstin', identifier === text(record.gstin).replace(/[\s-]+/g, '').toLocaleUpperCase()],
    ['gstinLegalName', comparableName(name) === comparableName(record.legalName)],
  ]);
}

async function verifyAadhaar(client: VerificationClient, fields: Record<string, unknown>): Promise<ExternalVerificationResult> {
  const identifier = digits(fields.aadhaarNumber);
  if (!identifier) return safeResult('INCOMPLETE', 'Required verification fields were not extracted');
  const record = await client.aadhaarRecord.findUnique({ where: { aadhaarNumber: identifier } });
  if (!record) return safeResult('NOT_FOUND', 'No Aadhaar verification record was found');
  return compare([['aadhaarNumber', identifier === digits(record.aadhaarNumber)]]);
}

async function verifyCin(client: VerificationClient, fields: Record<string, unknown>): Promise<ExternalVerificationResult> {
  const identifier = text(fields.cin).replace(/\s+/g, '').toLocaleUpperCase();
  const name = text(fields.cinLegalName);
  if (!identifier || !name) return safeResult('INCOMPLETE', 'Required verification fields were not extracted');
  const record = await client.cINRecord.findUnique({ where: { cin: identifier }, include: { entity: true } });
  if (!record) return safeResult('NOT_FOUND', 'No CIN verification record was found');
  return compare([
    ['cin', identifier === text(record.cin).replace(/\s+/g, '').toLocaleUpperCase()],
    ['cinLegalName', comparableName(name) === comparableName(record.companyName)],
  ]);
}

async function verifyMsme(client: VerificationClient, fields: Record<string, unknown>): Promise<ExternalVerificationResult> {
  const identifier = text(fields.msmeNumber).replace(/\s+/g, '').toLocaleUpperCase();
  const name = text(fields.msmeName);
  if (!identifier || !name) return safeResult('INCOMPLETE', 'Required verification fields were not extracted');
  const record = await client.mSMERecord.findUnique({ where: { udyamNumber: identifier }, include: { entity: true } });
  if (!record) return safeResult('NOT_FOUND', 'No MSME verification record was found');
  return compare([
    ['msmeNumber', identifier === text(record.udyamNumber).replace(/\s+/g, '').toLocaleUpperCase()],
    ['msmeName', comparableName(name) === comparableName(record.enterpriseName)],
  ]);
}

async function verifyPhone(client: VerificationClient, fields: Record<string, unknown>): Promise<ExternalVerificationResult> {
  const identifier = digits(fields.phoneNumber || fields.phone);
  const record = await client.phoneRecord.findUnique({ where: { phoneNumber: identifier }, include: { entity: true } });
  if (!record) return safeResult('NOT_FOUND', 'No phone verification record was found');
  return compare([['phoneNumber', digits(fields.phoneNumber || fields.phone) === digits(record.phoneNumber)]]);
}

async function verifyEmail(client: VerificationClient, fields: Record<string, unknown>): Promise<ExternalVerificationResult> {
  const identifier = text(fields.email || fields.emailAddress).toLocaleLowerCase();
  const record = await client.emailRecord.findUnique({ where: { email: identifier }, include: { entity: true } });
  if (!record) return safeResult('NOT_FOUND', 'No email verification record was found');
  return compare([['email', identifier === text(record.email).toLocaleLowerCase()]]);
}

async function verifyPan(client: VerificationClient, fields: Record<string, unknown>): Promise<ExternalVerificationResult> {
  const identifier = normalizePanShape(text(fields.panNumber)) || text(fields.panNumber).toLocaleUpperCase();
  const name = text(fields.panName);
  if (!identifier || !name) return safeResult('INCOMPLETE', 'Required verification fields were not extracted');
  const record = await client.panVerification.findUnique({ where: { panNumber: identifier } });
  if (!record) {
    verificationLog('documentType=PAN status=NOT_FOUND');
    return safeResult('NOT_FOUND', 'No PAN verification record was found');
  }

  verificationLog('documentType=PAN status=FOUND');
  const checks: Array<[string, boolean]> = [
    ['panNumber', identifier === (normalizePanShape(text(record.panNumber)) || text(record.panNumber).toLocaleUpperCase())],
    ['panName', comparableName(name) === comparableName(record.panName)],
  ];
  checks.forEach(([field, matched]) => verificationFieldLog('PAN', field, matched));

  const mismatched = checks.filter(([, matched]) => !matched).map(([field]) => field);
  const matched = checks.filter(([, isMatched]) => isMatched).map(([field]) => field);
  const result = mismatched.length
    ? safeResult('MISMATCH', 'Verification record did not match extracted document data', matched, mismatched)
    : safeResult('VERIFIED', undefined, matched);
  verificationLog(`documentType=PAN status=${result.status}`);
  return result;
}

export async function verifyAgainstExternalDatabase(documentType: string, fields: Record<string, unknown>): Promise<ExternalVerificationResult> {
  const requestedType = documentType.trim().toUpperCase();
  const normalizedType = requestedType === 'GST' ? 'GSTIN' : requestedType;
  if (!['PAN', 'GSTIN', 'AADHAAR', 'CIN', 'MSME', 'PHONE', 'EMAIL'].includes(normalizedType)) {
    const result = safeResult('NOT_SUPPORTED', 'No external verification table is defined for this document type');
    logResult(normalizedType, result);
    return result;
  }

  verificationLog(`documentType=${normalizedType} status=STARTED`);
  try {
    const client = await getClient();
    let result: ExternalVerificationResult;
    if (normalizedType === 'PAN') result = await verifyPan(client, fields);
    else if (normalizedType === 'GSTIN') result = await verifyGstin(client, fields);
    else if (normalizedType === 'AADHAAR') result = await verifyAadhaar(client, fields);
    else if (normalizedType === 'CIN') result = await verifyCin(client, fields);
    else if (normalizedType === 'MSME') result = await verifyMsme(client, fields);
    else if (normalizedType === 'PHONE') result = await verifyPhone(client, fields);
    else result = await verifyEmail(client, fields);
    logResult(normalizedType, result);
    return result;
  } catch {
    const result = safeResult('ERROR', 'External verification service is unavailable');
    logResult(normalizedType, result);
    return result;
  }
}

export async function disconnectExternalVerificationDatabase() {
  if (!clientPromise) return;
  try {
    const client = await clientPromise;
    await client.$disconnect();
  } finally {
    clientPromise = undefined;
  }
}
