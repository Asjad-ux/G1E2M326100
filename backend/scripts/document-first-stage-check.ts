import assert from 'node:assert/strict';
import { getDocumentDefinition } from '../src/services/document-definition.service.js';
import { extractDefinedFields, extractionStatusFor } from '../src/services/document-extraction.service.js';
import { buildExtractedUserUpdate, persistExtractedUserFields } from '../src/services/document-user-persistence.service.js';

const pan = getDocumentDefinition('PAN');
const aadhaar = getDocumentDefinition('AADHAAR');
const passport = getDocumentDefinition('PASSPORT');
const gst = getDocumentDefinition('GSTIN');
const cin = getDocumentDefinition('CIN');
const msme = getDocumentDefinition('MSME');
assert.ok(pan && aadhaar && passport && gst && cin && msme);

const panResult = extractDefinedFields('PAN', [
  'PAN: ABCDE1234F',
  'Name: MOHAMMAD ASJAD ZIA',
  "Father's Name: MUHAMMAD ZIA",
  'Date of Birth: 01/01/1990',
].join('\n'), pan);
assert.equal(panResult.status, 'SUCCESS');
assert.equal(panResult.extractedFields.panNumber, 'ABCDE1234F');
assert.equal(panResult.extractedFields.panName, 'MOHAMMAD ASJAD ZIA');
assert.equal(panResult.extractedFields.fatherName, 'MUHAMMAD ZIA');
assert.equal(panResult.extractedFields.dateOfBirth, '1990-01-01');

const panVariation = extractDefinedFields('PAN', [
  'PAN NUMBER', 'ABCDE1234F', 'Name ::: MOHAMMAD   ASJAD-ZIA',
  'Father s Name', 'MUHAMMAD ZIA', 'DOB', '01-01-1990',
].join('\n'), pan);
assert.equal(panVariation.extractedFields.panName, 'MOHAMMAD ASJAD-ZIA');
assert.equal(panVariation.extractedFields.fatherName, 'MUHAMMAD ZIA');

const panMissing = extractDefinedFields('PAN', 'PAN: ABCDE1234F\nName: MOHAMMAD ASJAD ZIA\nDOB: 01/01/1990', pan);
assert.equal(panMissing.status, 'REVIEW');
assert.equal(panMissing.extractedFields.fatherName, null);

const panAmbiguous = extractDefinedFields('PAN', 'Name: ALPHA PERSON\nApplicant Name: BETA PERSON\nDOB: 01/01/1990', pan);
assert.equal(panAmbiguous.status, 'REVIEW');
assert.equal(panAmbiguous.extractedFields.panName, null);

const aadhaarResult = extractDefinedFields('AADHAAR', [
  'Government of India', 'Name: MOHAMMAD ASJAD', 'DOB: 01/01/1990', 'Aadhaar Number: 1234 5678 9012',
].join('\n'), aadhaar);
assert.equal(aadhaarResult.status, 'SUCCESS');
assert.equal(aadhaarResult.extractedFields.aadhaarNumber, '1234 5678 9012');
assert.equal('aadhaarName' in aadhaarResult.extractedFields, false);

const aadhaarAnchored = extractDefinedFields('AADHAAR', [
  'ALPHA PERSON', 'Address: 12 TEST ROAD', 'Year of Birth: 1990', 'Aadhaar Number: 1234 5678 9012',
].join('\n'), aadhaar);
assert.equal(aadhaarAnchored.extractedFields.aadhaarNumber, '1234 5678 9012');
assert.equal('aadhaarName' in aadhaarAnchored.extractedFields, false);

const aadhaarRelationship = extractDefinedFields('AADHAAR', [
  'Name: HOLDER PERSON', 'C/O: RELATED PERSON', 'Address: 12 TEST ROAD', 'Aadhaar Number: 1234 5678 9012',
].join('\n'), aadhaar);
assert.equal(aadhaarRelationship.extractedFields.aadhaarNumber, '1234 5678 9012');
assert.equal('aadhaarName' in aadhaarRelationship.extractedFields, false);

const aadhaarUnlabelledNumber = extractDefinedFields('AADHAAR', [
  'Name: HOLDER PERSON', 'DOB: 01/01/1990', '0000 1111 2222',
].join('\n'), aadhaar);
assert.equal(aadhaarUnlabelledNumber.extractedFields.aadhaarNumber, '0000 1111 2222');

const aadhaarAmbiguous = extractDefinedFields('AADHAAR', 'Name: ALPHA PERSON\nName: BETA PERSON\nAadhaar Number: 1234 5678 9012', aadhaar);
assert.equal(aadhaarAmbiguous.status, 'SUCCESS');
assert.equal(aadhaarAmbiguous.extractedFields.aadhaarNumber, '1234 5678 9012');
assert.equal('aadhaarName' in aadhaarAmbiguous.extractedFields, false);

const passportResult = extractDefinedFields('PASSPORT', [
  'Passport Number: A1234567', 'Name: PASSPORT PERSON', 'Nationality: IND',
  'Date of Birth: 01/01/1990', 'Date of Issue: 01/01/2020', 'Date of Expiry: 01/01/2030', 'Place of Birth: DELHI',
].join('\n'), passport);
assert.equal(passportResult.status, 'SUCCESS');
assert.equal(passportResult.extractedFields.passportName, 'PASSPORT PERSON');
assert.equal(passportResult.extractedFields.passportNumber, 'A1234567');
assert.equal(passportResult.extractedFields.nationality, 'IND');
assert.equal(passportResult.extractedFields.placeOfBirth, 'DELHI');

const passportMrz = extractDefinedFields('PASSPORT', [
  'BARCODE', 'Passport Number: BARCODE',
  'P<INDSURNAME<<GIVEN<NAME<<<<<<<<<<<<<<<<<<<<',
  'A1234567<8IND9001011M3001012<<<<<<<<<<<<<<00',
  'Date of Issue: 01/01/2020', 'Place of Birth: DELHI',
].join('\n'), passport);
assert.equal(passportMrz.extractedFields.passportNumber, 'A1234567');
assert.equal(passportMrz.extractedFields.passportName, 'SURNAME GIVEN NAME');
assert.equal(passportMrz.extractedFields.passportDateOfBirth, '1990-01-01');
assert.equal(passportMrz.extractedFields.nationality, 'IND');
assert.equal(passportMrz.extractedFields.passportExpiryDate, '2030-01-01');
assert.equal(passportMrz.extractedFields.passportIssueDate, '2020-01-01');
assert.equal(passportMrz.extractedFields.placeOfBirth, 'DELHI');
assert.notEqual(passportMrz.extractedFields.passportNumber, 'BARCODE');

const passportWithBoundingBoxes = extractDefinedFields('PASSPORT', 'ignored', passport, [
  { text: 'Place of Birth: DELHI', bbox: [[10, 700], [100, 700]], pageIndex: 0 },
  { text: 'Passport Number: A1234567', bbox: [[10, 100], [100, 100]], pageIndex: 0 },
  { text: 'Date of Birth: 01/01/1990', bbox: [[10, 300], [100, 300]], pageIndex: 0 },
  { text: 'Name: PASSPORT PERSON', bbox: [[10, 200], [100, 200]], pageIndex: 0 },
  { text: 'Nationality: IND', bbox: [[10, 400], [100, 400]], pageIndex: 0 },
  { text: 'Date of Issue: 01/01/2020', bbox: [[10, 500], [100, 500]], pageIndex: 0 },
  { text: 'Date of Expiry: 01/01/2030', bbox: [[10, 600], [100, 600]], pageIndex: 0 },
]);
assert.equal(passportWithBoundingBoxes.status, 'SUCCESS');
assert.equal(passportWithBoundingBoxes.extractedFields.passportNumber, 'A1234567');

const gstResult = extractDefinedFields('GSTIN', [
  'GSTIN: 27ABCDE1234F1Z5', 'Legal Name of Business: ALPHA TRADERS', 'Trade Name: ALPHA SHOP',
  'Constitution of Business: Proprietorship', 'Principal Place of Business: DELHI', 'Date of Registration: 01/01/2020',
].join('\n'), gst);
assert.equal(gstResult.status, 'SUCCESS');
assert.equal(gstResult.extractedFields.gstin, '27ABCDE1234F1Z5');
assert.equal(gstResult.extractedFields.gstinLegalName, 'ALPHA TRADERS');
assert.equal(gstResult.extractedFields.gstinTradeName, 'ALPHA SHOP');

const gstTableLayout = extractDefinedFields('GSTIN', [
  'Registration Number: 27ABCDE1234F1Z5',
  'Legal Name', 'SYNTHETIC LEGAL ENTITY',
  'Trade Name: SYNTHETIC TRADE ENTITY',
  'Constitution of Business', 'Partnership',
  'Address of Principal Place of Business', '12 TEST ROAD, SYNTHETIC CITY',
  'Date of Liability', '01/01/2020',
].join('\n'), gst);
assert.equal(gstTableLayout.extractedFields.gstin, '27ABCDE1234F1Z5');
assert.equal(gstTableLayout.extractedFields.gstinLegalName, 'SYNTHETIC LEGAL ENTITY');
assert.equal(gstTableLayout.extractedFields.gstinTradeName, 'SYNTHETIC TRADE ENTITY');
assert.equal(gstTableLayout.extractedFields.gstinConstitution, 'Partnership');
assert.equal(gstTableLayout.extractedFields.gstinPrincipalPlace, '12 TEST ROAD, SYNTHETIC CITY');
assert.equal(gstTableLayout.extractedFields.gstinRegistrationDate, '2020-01-01');

assert.equal(extractDefinedFields('CIN', 'CIN: U12345DL2020PTC123456\nCompany Name: ALPHA INDUSTRIES', cin).status, 'SUCCESS');
assert.equal(extractDefinedFields('MSME', 'Udyam Registration Number: UDYAM-DL-01-1234567\nEnterprise Name: ALPHA INDUSTRIES', msme).status, 'SUCCESS');

assert.equal(extractionStatusFor(pan, panMissing.extractedFields), 'REVIEW');

const updates: Array<{ userId: string; data: Record<string, unknown> }> = [];
const fakeClient = { user: { update: async (input: { where: { id: string }; data: Record<string, unknown> }) => { updates.push({ userId: input.where.id, data: input.data }); return input; } } } as any;
await persistExtractedUserFields({ userId: 'user-a', documentType: 'PAN', definition: pan, extracted: panMissing.extractedFields, client: fakeClient });
await persistExtractedUserFields({ userId: 'user-b', documentType: 'AADHAAR', definition: aadhaar, extracted: aadhaarResult.extractedFields, client: fakeClient });
assert.deepEqual(Object.keys(updates[0].data).sort(), ['dateOfBirth', 'panName', 'panNumber'].sort());
assert.equal('fatherName' in updates[0].data, false);
assert.equal(updates[0].userId, 'user-a');
assert.equal(updates[1].userId, 'user-b');
assert.equal('panName' in updates[1].data, false);
assert.equal('aadhaarName' in updates[1].data, false);
assert.deepEqual(Object.keys(updates[1].data).sort(), ['aadhaarDateOfBirth', 'aadhaarNumber'].sort());

const existingData = buildExtractedUserUpdate('PAN', pan, { panName: null, fatherName: undefined, dateOfBirth: null, panNumber: 'ABCDE1234F' }).data;
assert.deepEqual(Object.keys(existingData), ['panNumber']);

console.log('First-stage OCR, extraction, status, and persistence checks passed');
