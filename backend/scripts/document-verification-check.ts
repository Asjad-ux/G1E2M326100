import assert from 'node:assert/strict';
import { PrismaClient as VerificationPrismaClient } from '../../verification-database/generated/client/index.js';
import { env } from '../src/config/env.js';
import { verifyAgainstExternalDatabase } from '../src/services/mock-verification.service.js';
import { shouldRunDocumentVerification, verificationStatusFor } from '../src/services/document-processing.service.js';

const verificationClient = new VerificationPrismaClient({ datasources: { db: { url: env.verificationDatabaseUrl } } });

async function tableCounts() {
  return {
    entities: await verificationClient.verificationEntity.count(),
    aadhaar: await verificationClient.aadhaarRecord.count(),
    gst: await verificationClient.gSTRecord.count(),
    cin: await verificationClient.cINRecord.count(),
    msme: await verificationClient.mSMERecord.count(),
    pan: await verificationClient.panVerification.count(),
  };
}

const validCases = [
  ['PAN', { panNumber: 'QWERT1000A', panName: 'AARAV BHARDWAJ' }],
  ['AADHAAR', { aadhaarNumber: '9012 3400 0001' }],
  ['GSTIN', { gstin: '27VYTRA0001K1Z5', gstinLegalName: 'SURYODAYA TRANSIT SYSTEMS PRIVATE LIMITED' }],
  ['CIN', { cin: 'U72900MH2018PTC100001', cinLegalName: 'SURYODAYA TRANSIT SYSTEMS PRIVATE LIMITED' }],
  ['MSME', { msmeNumber: 'UDYAM-MH-01-0000001', msmeName: 'SURYODAYA TRANSIT SYSTEMS PRIVATE LIMITED' }],
] as const;

const wrongNumbers: Record<string, string> = {
  PAN: 'ZXCVB9999Z',
  AADHAAR: '999999999999',
  GSTIN: '99ZZZZZ9999Z9Z9',
  CIN: 'U99999ZZ2099PTC999999',
  MSME: 'UDYAM-ZZ-99-9999999',
};

const before = await tableCounts();

for (const [documentType, fields] of validCases) {
  const result = await verifyAgainstExternalDatabase(documentType, fields);
  assert.equal(result.status, 'VERIFIED', `${documentType} name + number should be valid`);
}

for (const [documentType, fields] of validCases) {
  if (documentType === 'AADHAAR') continue;
  const nameField = Object.keys(fields).find(field => field.toLowerCase().includes('name'))!;
  const result = await verifyAgainstExternalDatabase(documentType, { ...fields, [nameField]: 'DIFFERENT ENTITY NAME' });
  assert.equal(result.status, 'MISMATCH', `${documentType} name mismatch should be invalid`);
}

for (const [documentType, fields] of validCases) {
  const numberField = Object.keys(fields).find(field => !field.toLowerCase().includes('name'))!;
  const result = await verifyAgainstExternalDatabase(documentType, { ...fields, [numberField]: wrongNumbers[documentType] });
  assert.equal(result.status, 'NOT_FOUND', `${documentType} document number mismatch should be invalid`);
}

for (const [documentType, fields] of validCases) {
  if (documentType === 'AADHAAR') continue;
  const nameField = Object.keys(fields).find(field => field.toLowerCase().includes('name'))!;
  const numberField = Object.keys(fields).find(field => !field.toLowerCase().includes('name'))!;
  const result = await verifyAgainstExternalDatabase(documentType, { [nameField]: 'DIFFERENT ENTITY NAME', [numberField]: wrongNumbers[documentType] });
  assert.equal(result.status, 'NOT_FOUND', `${documentType} name + number mismatch should be invalid`);
}

const whitespaceResult = await verifyAgainstExternalDatabase('PAN', {
  panNumber: ' QWERT1000A ', panName: '  aarav   bhardwaj ',
});
assert.equal(whitespaceResult.status, 'VERIFIED');

for (const [documentType, fields] of validCases) {
  const nameField = Object.keys(fields).find(field => field.toLowerCase().includes('name'))!;
  const numberField = Object.keys(fields).find(field => !field.toLowerCase().includes('name'))!;
  const numberOnly = await verifyAgainstExternalDatabase(documentType, { [numberField]: fields[numberField as keyof typeof fields] });
  assert.equal(numberOnly.status, documentType === 'AADHAAR' ? 'VERIFIED' : 'INCOMPLETE');
  if (documentType !== 'AADHAAR') {
    assert.equal((await verifyAgainstExternalDatabase(documentType, { [nameField]: fields[nameField as keyof typeof fields] })).status, 'INCOMPLETE');
  }
}

const aadhaarNameIgnored = await verifyAgainstExternalDatabase('AADHAAR', {
  aadhaarNumber: '9012 3400 0001',
  aadhaarName: 'DIFFERENT ENTITY NAME',
});
assert.equal(aadhaarNameIgnored.status, 'VERIFIED');

const passportResult = await verifyAgainstExternalDatabase('PASSPORT', {
  passportNumber: 'A1234567', passportName: 'AARAV BHARDWAJ',
});
assert.equal(passportResult.status, 'NOT_SUPPORTED');

assert.equal(shouldRunDocumentVerification('SUCCESS', 'identifier', 'name'), true);
assert.equal(shouldRunDocumentVerification('SUCCESS', 'identifier'), true);
assert.equal(shouldRunDocumentVerification('SUCCESS', 'identifier', ''), false);
assert.equal(shouldRunDocumentVerification('SUCCESS', null, 'name'), false);
assert.equal(shouldRunDocumentVerification('REVIEW', 'identifier', 'name'), false);
assert.equal(shouldRunDocumentVerification('FAILED', 'identifier', 'name'), false);
assert.equal(verificationStatusFor('REVIEW', 'VERIFIED'), 'NOT_RUN');
assert.equal(verificationStatusFor('FAILED', 'VERIFIED'), 'NOT_RUN');
assert.equal(verificationStatusFor('SUCCESS', 'VERIFIED'), 'VALID');
assert.equal(verificationStatusFor('SUCCESS', 'NOT_FOUND'), 'INVALID');
assert.equal(verificationStatusFor('SUCCESS', 'MISMATCH'), 'INVALID');
assert.equal(verificationStatusFor('SUCCESS', 'INCOMPLETE'), 'NOT_RUN');

const after = await tableCounts();
assert.deepEqual(after, before);

console.log('Document verification name+number match, mismatch, REVIEW gating, Passport handling, and read-only checks passed');
await verificationClient.$disconnect();
