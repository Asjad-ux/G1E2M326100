import assert from 'node:assert/strict';
import { phone } from '../src/validators/common.js';
import { bidderRegisterSchema } from '../src/validators/auth.js';
import { normalizeIndianPhone } from '../src/utils/phone.js';

const canonical = '+919876543210';
const validInputs = [
  '9876543210',
  '+919876543210',
  '+91 9876543210',
  '+91-9876543210',
  '0919876543210',
  '09876543210',
  '9 8 7 6 5 4 3 2 1 0',
  '+91 (987) 654-3210',
];

for (const input of validInputs) {
  assert.equal(normalizeIndianPhone(input), canonical);
  const parsed = phone.safeParse(input);
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data, canonical);

  const registration = bidderRegisterSchema.safeParse({ body: {
    name: 'Synthetic Bidder', email: 'synthetic@example.com', phone: input,
    password: 'StrongPass1', confirmPassword: 'StrongPass1', company: { companyName: 'Synthetic Company' },
  } });
  assert.equal(registration.success, true);
  if (registration.success) assert.equal(registration.data.body.phone, canonical);
}

for (const input of ['12345', 'abcdefghij', '+91987654321', '+9198765432100', '5123456789', '987654321A']) {
  assert.equal(normalizeIndianPhone(input), null);
  assert.equal(phone.safeParse(input).success, false);
}

const existingPhones = new Set([normalizeIndianPhone('+919876543210')]);
assert.equal(existingPhones.has(normalizeIndianPhone('+91 9876543210')), true);
console.log('Phone normalization, validation, and canonical duplicate checks passed; phone OTP flow is intentionally disabled');
