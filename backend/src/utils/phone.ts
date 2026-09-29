const formattingCharacters = /[\s().-]/g;

/** Returns the canonical Indian mobile format or null for an invalid value. */
export function normalizeIndianPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(formattingCharacters, '');
  if (!compact || !/^\+?\d+$/.test(compact)) return null;

  let nationalDigits: string | null = null;
  if (/^\+91\d+$/.test(compact)) nationalDigits = compact.slice(3);
  else if (/^091\d+$/.test(compact)) nationalDigits = compact.slice(3);
  else if (/^0\d+$/.test(compact)) nationalDigits = compact.slice(1);
  else if (/^\d+$/.test(compact)) nationalDigits = compact;

  if (!nationalDigits || !/^[6-9]\d{9}$/.test(nationalDigits)) return null;
  return `+91${nationalDigits}`;
}

export const invalidIndianPhoneMessage = 'Phone number must be a valid 10-digit Indian mobile number.';
