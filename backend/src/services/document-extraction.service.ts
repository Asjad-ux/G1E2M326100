import type { DocumentDefinition, DocumentFieldDefinition } from './document-definition.service.js';
import { ocrLog, ocrWarning } from './ocr.service.js';

export type ExtractionStatus = 'SUCCESS' | 'REVIEW';

export type DocumentExtractionResult = {
  extractedFields: Record<string, unknown>;
  confidence: Record<string, number>;
  warnings: string[];
  status: ExtractionStatus;
};

export type ExtractionOcrLine = {
  text: string;
  confidence?: number | null;
  bbox?: unknown;
  pageIndex?: number;
};

type Candidate = { value: string; score: number };
type Selection = { value: string | null; candidateCount: number; ambiguous: boolean };
type PreparedLine = { text: string; bbox: unknown; pageIndex: number; sourceIndex: number };

function bboxOrigin(bbox: unknown) {
  if (!Array.isArray(bbox)) return null;
  if (bbox.length >= 4 && bbox.slice(0, 4).every(value => typeof value === 'number')) return { x: Number(bbox[0]), y: Number(bbox[1]) };
  const points = bbox.filter(point => Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number') as number[][];
  if (!points.length) return null;
  return { x: points.reduce((sum, point) => sum + point[0], 0) / points.length, y: points.reduce((sum, point) => sum + point[1], 0) / points.length };
}

function preparedLines(rawOcrText: string, layoutLines: readonly ExtractionOcrLine[] = [], sortSpatially = true): PreparedLine[] {
  const source = layoutLines.filter(line => typeof line?.text === 'string' && line.text.trim()).map((line, index) => ({
    text: cleanText(line.text),
    bbox: line.bbox,
    pageIndex: line.pageIndex || 0,
    sourceIndex: index,
  }));
  const fallback = rawOcrText.split(/\r?\n/).map((text, index) => ({ text: cleanText(text), bbox: null, pageIndex: 0, sourceIndex: index })).filter(line => line.text);
  const lines = source.length ? source : fallback;
  if (!sortSpatially || !source.some(line => bboxOrigin(line.bbox))) return lines;
  return [...lines].sort((left, right) => {
    if (left.pageIndex !== right.pageIndex) return left.pageIndex - right.pageIndex;
    const a = bboxOrigin(left.bbox);
    const b = bboxOrigin(right.bbox);
    if (!a || !b) return left.sourceIndex - right.sourceIndex;
    return Math.abs(a.y - b.y) > 4 ? a.y - b.y : a.x - b.x;
  });
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function humanizeKey(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
}

function normalizedLabel(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function aliasesFor(key: string, field: DocumentFieldDefinition) {
  return [field.label, humanizeKey(key), ...(field.ocrAliases || [])]
    .map(normalizedLabel)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
}

function aliasPattern(alias: string, global = false) {
  const tokens = normalizedLabel(alias).split(/\s+/).filter(Boolean);
  const separator = '[\\s.\'’`_/-]*';
  const tokenSeparator = '[\\s.\'’`_/-]+';
  const body = tokens.map(token => [...token].map(character => `${character}${separator}`).join('')).join(tokenSeparator);
  return new RegExp(`(?:^|[^A-Za-z0-9])${body}(?=$|[^A-Za-z0-9])`, global ? 'gi' : 'i');
}

function select(candidates: Candidate[]): Selection {
  const ordered = candidates.sort((left, right) => right.score - left.score);
  if (!ordered.length) return { value: null, candidateCount: 0, ambiguous: false };
  const top = ordered[0];
  const second = ordered.find(candidate => candidate.value.toUpperCase() !== top.value.toUpperCase());
  const ambiguous = Boolean(second && top.score - second.score < 8);
  return { value: ambiguous ? null : top.value, candidateCount: candidates.length, ambiguous };
}

function nameValue(value: string, field: DocumentFieldDefinition, allowDigits = false) {
  let candidate = cleanText(value).replace(/^[\s:;,#|]+/, '').replace(/[|]+/g, ' ').replace(/[\s:;,#|]+$/, '');
  const nextLabel = candidate.search(/\b(?:father(?:['’]?s|s)?\s+name|date\s+of\s+birth|dob|year\s+of\s+birth|address|gender|sex|aadhaar|aadhar|uidai|surname|given\s+names?|legal\s+name|trade\s+name|business\s+name)\b/i);
  if (nextLabel > 0) candidate = cleanText(candidate.slice(0, nextLabel));
  if (!candidate || candidate.length > 120) return null;
  const excluded = new Set((field.ocrExcludeTerms || []).map(item => item.toLowerCase()));
  const words = candidate.match(/[A-Za-z0-9]+(?:['.-][A-Za-z0-9]+)*/g) || [];
  if (!words.length || words.length > 8 || words.some(word => excluded.has(word.toLowerCase()))) return null;
  if (/^(?:name|surname|given names?|legal name|trade name|business name|government|india|aadhaar|aadhar|uidai|address|gender|male|female|date|dob|birth|photo|signature|document)$/i.test(candidate)) return null;
  if (/\b(?:government|department|address|signature|aadhaar|aadhar|uidai|date\s+of\s+birth|dob)\b/i.test(candidate)) return null;
  if (!allowDigits && /\d/.test(candidate)) return null;
  if (!allowDigits && !/^[A-Za-z][A-Za-z .'-]*$/.test(candidate)) return null;
  return candidate;
}

function textAfterLabel(text: string, match: RegExpMatchArray, field: DocumentFieldDefinition, allowDigits = false, boundaries: RegExp[] = []) {
  const remainder = text.slice((match.index || 0) + match[0].length);
  const positions = boundaries.map(pattern => remainder.search(pattern)).filter(index => index > 0);
  const bounded = remainder.slice(0, positions.length ? Math.min(...positions) : remainder.length);
  const parts = bounded.split('\n');
  return nameValue(parts[0], field, allowDigits) || nameValue(parts[1] || '', field, allowDigits);
}

function fieldCandidateFromLabels(lines: string[], aliases: string[], field: DocumentFieldDefinition, allowDigits = true) {
  const candidates: Candidate[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    for (const alias of aliases) {
      const match = lines[index].match(aliasPattern(alias));
      if (!match || match.index === undefined) continue;
      const remainder = lines[index].slice(match.index + match[0].length).replace(/^[\s:;,#|–—-]+/, '');
      const value = nameValue(remainder, field, allowDigits) || nameValue(lines[index + 1] || '', field, allowDigits);
      if (value) candidates.push({ value, score: 100 + Math.min(40, alias.length) - index });
    }
  }
  return select(candidates);
}

function panNameSelection(text: string, field: DocumentFieldDefinition): Selection {
  const pattern = aliasPattern('Name', true);
  const matches = [...text.matchAll(pattern)].filter(match => {
    const before = normalizedLabel(text.slice(Math.max(0, (match.index || 0) - 48), match.index || 0)).replace(/\s/g, '');
    return !before.includes('father') && !before.includes('fathers');
  });
  const candidates: Candidate[] = [];
  for (const [labelIndex, match] of matches.entries()) {
    const remainder = text.slice((match.index || 0) + match[0].length);
    const boundaries = [remainder.search(aliasPattern('Name')), remainder.search(aliasPattern("Father's Name")), remainder.search(/\b(?:date|dob|birth)\b/i)].filter(index => index > 0);
    const bounded = remainder.slice(0, boundaries.length ? Math.min(...boundaries) : remainder.length);
    const value = nameValue(bounded.split('\n')[0], field, false) || nameValue(bounded.split('\n')[1] || '', field, false);
    if (value) candidates.push({ value, score: 125 + (value.split(/\s+/).length === 2 ? 15 : 8) - labelIndex * 4 });
  }
  return select(candidates);
}

function panFatherSelection(text: string, field: DocumentFieldDefinition): Selection {
  const lines = text.split(/\r?\n/).map(cleanText).filter(Boolean);
  const aliases = aliasesFor('fatherName', field);
  const candidates: Candidate[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    for (const alias of aliases) {
      const match = lines[index].match(aliasPattern(alias));
      if (!match || match.index === undefined) continue;
      const inline = nameValue(lines[index].slice(match.index + match[0].length), field, false);
      if (inline) candidates.push({ value: inline, score: 125 - index });
      else {
        for (let distance = 1; distance <= 3; distance += 1) {
          const next = nameValue(lines[index + distance] || '', field, false);
          if (next) { candidates.push({ value: next, score: 110 - index - distance * 8 }); break; }
        }
      }
    }
  }
  const flexibleFather = /f[\s.'’`_-]*a[\s.'’`_-]*t[\s.'’`_-]*h[\s.'’`_-]*e[\s.'’`_-]*r(?:[\s.'’`_-]*s)?[\s.'’`_-]*n[\s.'’`_-]*a[\s.'’`_-]*m[\s.'’`_-]*e/gi;
  for (const match of text.matchAll(flexibleFather)) {
    const remainder = text.slice((match.index || 0) + match[0].length);
    const boundary = remainder.search(/\b(?:date|dob|birth|name|pan)\b/i);
    const value = nameValue((boundary > 0 ? remainder.slice(0, boundary) : remainder).split('\n')[0], field, false)
      || nameValue((boundary > 0 ? remainder.slice(0, boundary) : remainder).split('\n')[1] || '', field, false);
    if (value) candidates.push({ value, score: 130 });
  }
  return select(candidates);
}

function strictPassportNumber(value: string, allowMrzCorrections = false) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z][0-9]{7}$/.test(compact)) return compact;
  if (!allowMrzCorrections || compact.length !== 8 || !/^[A-Z][A-Z0-9]{7}$/.test(compact)) return null;
  const corrected = `${compact[0]}${compact.slice(1).replace(/O/g, '0').replace(/[IL]/g, '1').replace(/B/g, '8').replace(/S/g, '5')}`;
  return /^[A-Z][0-9]{7}$/.test(corrected) ? corrected : null;
}

function mrzDate(value: string, kind: 'birth' | 'expiry') {
  const match = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;
  const currentYear = new Date().getFullYear() % 100;
  const year = kind === 'expiry' ? 2000 + Number(match[1]) : (Number(match[1]) > currentYear ? 1900 + Number(match[1]) : 2000 + Number(match[1]));
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type PassportMrz = {
  passportNumber: string | null;
  passportName: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  expiryDate: string | null;
};

function passportMrz(lines: Array<{ text: string }>): PassportMrz {
  for (let index = 0; index < lines.length - 1; index += 1) {
    const first = lines[index].text.toUpperCase().replace(/\s+/g, '');
    const second = lines[index + 1].text.toUpperCase().replace(/\s+/g, '');
    if (!/^P</.test(first) || second.length < 30) continue;
    const secondMatch = second.match(/^([A-Z0-9]{8,9})<([0-9A-Z])([A-Z0-9]{3})(\d{6})[0-9A-Z]([MFX<])(\d{6})[0-9A-Z]/);
    if (!secondMatch) continue;
    const namePart = first.slice(5);
    const separator = namePart.indexOf('<<');
    const surname = (separator >= 0 ? namePart.slice(0, separator) : namePart).replace(/</g, ' ').trim();
    const givenNames = (separator >= 0 ? namePart.slice(separator + 2) : '').replace(/</g, ' ').trim();
    const passportNumber = strictPassportNumber(secondMatch[1].replace(/</g, ''), true);
    const nationality = secondMatch[3].replace(/0/g, 'O').replace(/1/g, 'I').replace(/2/g, 'Z').replace(/5/g, 'S').replace(/8/g, 'B');
    return {
      passportNumber,
      passportName: cleanText(`${surname} ${givenNames}`) || null,
      nationality: /^[A-Z]{3}$/.test(nationality) ? nationality : null,
      dateOfBirth: mrzDate(secondMatch[4], 'birth'),
      expiryDate: mrzDate(secondMatch[6], 'expiry'),
    };
  }
  return { passportNumber: null, passportName: null, nationality: null, dateOfBirth: null, expiryDate: null };
}

function labelValueSelection(lines: string[], aliases: string[], field: DocumentFieldDefinition, valueParser: (value: string) => string | null) {
  const candidates: Candidate[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    for (const alias of aliases) {
      const match = lines[index].match(aliasPattern(alias));
      if (!match || match.index === undefined) continue;
      const remainder = lines[index].slice(match.index + match[0].length).replace(/^[\s:;,#|–—-]+/, '');
      const inline = valueParser(remainder);
      const next = valueParser(lines[index + 1] || '');
      const value = inline || next;
      if (value) candidates.push({ value, score: 120 + Math.min(30, alias.length) - index });
    }
  }
  return select(candidates);
}

function passportNameSelection(lines: string[], field: DocumentFieldDefinition, mrz: PassportMrz): Selection {
  const surname = labelValueSelection(lines, ['Surname'], field, value => nameValue(value, field, false));
  const given = labelValueSelection(lines, ['Given Names', 'Given Name'], field, value => nameValue(value, field, false));
  const candidates: Candidate[] = [];
  if (surname.value && given.value) candidates.push({ value: cleanText(`${surname.value} ${given.value}`), score: 150 });
  const labelled = labelValueSelection(lines, ['Name on Passport', 'Name'], field, value => nameValue(value, field, false));
  if (labelled.value) candidates.push({ value: labelled.value, score: 135 });
  if (mrz.passportName) candidates.push({ value: mrz.passportName, score: 130 });
  return select(candidates);
}

function selectionFor(value: string | null, score = 120): Selection {
  return select(value ? [{ value, score }] : []);
}

function passportUnlabelledFallbacks(records: PreparedLine[], dateOfBirth: Selection, issueDate: Selection, placeOfBirth: Selection) {
  const dates = records.map((record, index) => ({ record, index, value: normalizeDate(record.text) })).filter(item => item.value && /\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(item.record.text));
  const issue = issueDate.value || (dates.length >= 2 ? [...dates].sort((left, right) => (bboxOrigin(left.record.bbox)?.x || 0) - (bboxOrigin(right.record.bbox)?.x || 0))[0].value : null);
  let birthPlace = placeOfBirth.value;
  if (!birthPlace && dates.length) {
    const birthDateIndex = dates[0].index;
    const candidate = records.slice(birthDateIndex + 1, dates.find(item => item.index > birthDateIndex)?.index || records.length).find(record => {
      const text = record.text.trim();
      return text.length >= 4 && !/\d/.test(text) && !/^(?:M|F|X|IND|SIGNATURE)$/i.test(text) && /^[A-Za-z][A-Za-z .,&'-]+$/.test(text);
    });
    birthPlace = candidate ? candidate.text : null;
  }
  return { issueDate: selectionFor(issue, 95), placeOfBirth: selectionFor(birthPlace, 90) };
}

function passportSelections(records: PreparedLine[], definition: DocumentDefinition) {
  const lines = records.map(record => record.text);
  const mrz = passportMrz(records);
  const passportNumber = labelValueSelection(lines, ['Passport Number', 'Passport No'], definition.fields.passportNumber, value => strictPassportNumber(value));
  const dateOfBirth = labelValueSelection(lines, ['Date of Birth', 'DOB'], definition.fields.passportDateOfBirth, value => normalizeDate(value));
  const issueDate = labelValueSelection(lines, ['Date of Issue', 'Issue Date'], definition.fields.passportIssueDate, value => normalizeDate(value));
  const expiryDate = labelValueSelection(lines, ['Date of Expiry', 'Expiry Date'], definition.fields.passportExpiryDate, value => normalizeDate(value));
  const nationality = labelValueSelection(lines, ['Nationality', 'Nationality Code'], definition.fields.nationality, value => nameValue(value, definition.fields.nationality, true));
  const placeOfBirth = labelValueSelection(lines, ['Place of Birth', 'Birth Place', 'Birthplace', 'Place Birth'], definition.fields.placeOfBirth, value => nameValue(value, definition.fields.placeOfBirth, true));
  const spatial = passportUnlabelledFallbacks(records, dateOfBirth, issueDate, placeOfBirth);
  return {
    passportNumber: passportNumber.value ? passportNumber : select(mrz.passportNumber ? [{ value: mrz.passportNumber, score: 145 }] : []),
    passportName: passportNameSelection(lines, definition.fields.passportName, mrz),
    passportDateOfBirth: dateOfBirth.value ? dateOfBirth : select(mrz.dateOfBirth ? [{ value: mrz.dateOfBirth, score: 140 }] : []),
    nationality: nationality.value ? nationality : select(mrz.nationality ? [{ value: mrz.nationality, score: 140 }] : []),
    passportIssueDate: issueDate.value ? issueDate : spatial.issueDate,
    passportExpiryDate: expiryDate.value ? expiryDate : select(mrz.expiryDate ? [{ value: mrz.expiryDate, score: 140 }] : []),
    placeOfBirth: placeOfBirth.value ? placeOfBirth : spatial.placeOfBirth,
  } as Record<string, Selection>;
}

const gstLabels = ['GSTIN', 'GST Identification Number', 'Registration Number', 'Registration No', 'Regiatratiea Nuaher', 'Legal Name of Business', 'Legal Name', 'Name of Business', 'Name of the Business', 'Trade Name', 'Business Name', 'Constitution of Business', 'Constitution of the Business', 'Constitution', 'Canstitatian of Business', 'Canstitatian', 'Principal Place of Business', 'Principal Place', 'Principal Address', 'Address of Principal Place of Business', 'Addrer of Principal', 'Place of Butinem', 'Date of Registration', 'Registration Date', 'Effective Date of Registration', 'Date of Liability'];

function gstTextValue(value: string, field: DocumentFieldDefinition) {
  const candidate = cleanText(value).replace(/^[\s:;,#|–—-]+/, '').replace(/[\s:;,#|–—-]+$/, '');
  if (!candidate || candidate.length > 240) return null;
  const normalized = normalizedLabel(candidate);
  if (gstLabels.map(normalizedLabel).includes(normalized) || /^(?:from|to|n\/a|na|barcode|signature)$/i.test(candidate)) return null;
  if (/\b(?:date of registration|registration date|date of liability|constitution of business|canstitatian|principal place of business|add rer of principal|place of butinem|legal name|trade name)\b/i.test(candidate)) return null;
  return candidate;
}

function gstSpatialValue(records: PreparedLine[], index: number, span: number, field: DocumentFieldDefinition) {
  const labelOrigins = records.slice(index, index + span).map(record => bboxOrigin(record.bbox)).filter(Boolean) as Array<{ x: number; y: number }>;
  if (!labelOrigins.length) return null;
  const labelX = Math.min(...labelOrigins.map(origin => origin.x));
  const labelY = Math.max(...labelOrigins.map(origin => origin.y));
  const candidates = records.map((record, candidateIndex) => {
    if (candidateIndex >= index && candidateIndex < index + span) return null;
    const origin = bboxOrigin(record.bbox);
    if (!origin || origin.x <= labelX + 25 || Math.abs(origin.y - labelY) > 16) return null;
    const value = gstTextValue(record.text, field);
    return value ? { value, distance: Math.abs(origin.y - labelY) + Math.abs(origin.x - labelX) / 100, score: 118 - Math.abs(origin.y - labelY) } : null;
  }).filter(Boolean) as Array<{ value: string; distance: number; score: number }>;
  candidates.sort((left, right) => left.distance - right.distance);
  return candidates[0] || null;
}

function gstTextSelection(records: PreparedLine[], aliases: string[], field: DocumentFieldDefinition) {
  const candidates: Candidate[] = [];
  const lines = records.map(record => record.text);
  for (let index = 0; index < lines.length; index += 1) {
    const matching = aliases.flatMap(alias => [1, 2, 3].map(span => ({ alias, span, text: lines.slice(index, index + span).join(' '), match: lines.slice(index, index + span).join(' ').match(aliasPattern(alias)) })))
      .filter(item => item.match && item.match.index !== undefined)
      .sort((left, right) => right.alias.length - left.alias.length || left.span - right.span);
    const best = matching[0];
    if (!best || !best.match || best.match.index === undefined) continue;
    const remainder = best.text.slice(best.match.index + best.match[0].length).replace(/^[\s:;,#|–—-]+/, '');
    const inline = gstTextValue(remainder, field);
    if (inline) candidates.push({ value: inline, score: 125 + Math.min(30, best.alias.length) - index });
    else {
      const spatial = gstSpatialValue(records, index, best.span, field);
      if (spatial) candidates.push({ value: spatial.value, score: spatial.score + Math.min(30, best.alias.length) - index });
      const next = gstTextValue(lines[index + best.span] || '', field);
      if (next) candidates.push({ value: next, score: 115 + Math.min(30, best.alias.length) - index });
    }
  }
  return select(candidates);
}

function normalizeGstin(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(compact) ? compact : null;
}

function compactGstinValue(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return compact.length >= 12 && compact.length <= 20 && /[A-Z]/.test(compact) && /\d/.test(compact) ? compact : null;
}

function gstinFromText(text: string) {
  for (const line of text.split(/\r?\n/)) {
    const compact = line.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const direct = normalizeGstin(compact) || compactGstinValue(compact);
    if (direct) return direct;
    const tokens = line.toUpperCase().match(/[A-Z0-9]{2,}/g) || [];
    for (const token of tokens) {
      const value = normalizeGstin(token) || compactGstinValue(token);
      if (value) return value;
    }
  }
  return null;
}

function gstinSelection(records: PreparedLine[], field: DocumentFieldDefinition) {
  return gstTextSelection(records, ['GSTIN', 'GST Identification Number', 'GSTIN/UIN', 'Registration Number', 'Registration No', 'Regiatratiea Nuaher', 'GSTIN No'], field);
}

function gstSelections(records: PreparedLine[], definition: DocumentDefinition) {
  return {
    gstin: gstinSelection(records, definition.fields.gstin),
    gstinLegalName: gstTextSelection(records, ['Legal Name of Business', 'Legal Name', 'Name of Business', 'Name of the Business'], definition.fields.gstinLegalName),
    gstinTradeName: gstTextSelection(records, ['Trade Name'], definition.fields.gstinTradeName),
    gstinConstitution: gstTextSelection(records, ['Constitution of Business', 'Constitution of the Business', 'Constitution', 'Canstitatian of Business', 'Canstitatian'], definition.fields.gstinConstitution),
    gstinPrincipalPlace: gstTextSelection(records, ['Address of Principal Place of Business', 'Principal Place of Business', 'Principal Place', 'Principal Address', 'Addrer of Principal', 'Place of Butinem'], definition.fields.gstinPrincipalPlace),
    gstinRegistrationDate: gstTextSelection(records, ['Date of Liability', 'Date of Registration', 'Registration Date', 'Effective Date of Registration'], definition.fields.gstinRegistrationDate),
  } as Record<string, Selection>;
}

function normalizePanShape(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(compact) ? compact : null;
}

function panNumberFromText(text: string) {
  for (const token of text.toUpperCase().match(/[A-Z0-9]{10}/g) || []) {
    const value = normalizePanShape(token);
    if (value) return value;
  }
  return null;
}

function normalizeDate(value: string) {
  const text = cleanText(value);
  const date = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (date) return `${date[3]}-${date[2].padStart(2, '0')}-${date[1].padStart(2, '0')}`;
  const year = text.match(/\b(19|20)\d{2}\b/);
  return year ? `${year[0]}-01-01` : (text || null);
}

function normalizeValue(documentType: string, key: string, field: DocumentFieldDefinition, value: string | null, rawText: string) {
  if (!value) return null;
  const normalization = field.normalization?.toUpperCase();
  if (documentType === 'PASSPORT' && key === 'passportNumber') return strictPassportNumber(value);
  if (normalization === 'PAN') return panNumberFromText(value) || panNumberFromText(rawText);
  if (normalization === 'GSTIN') return normalizeGstin(value) || compactGstinValue(value) || gstinFromText(rawText);
  if (field.type === 'date' || normalization === 'GST_DATE') return normalizeDate(value);
  if (normalization === 'IDENTITY_NAME' || normalization === 'PASSPORT') return cleanText(value);
  return field.type === 'string' ? cleanText(value) : value;
}

function patternCandidate(rawText: string, field: DocumentFieldDefinition) {
  const pattern = field.validation?.pattern;
  if (!pattern) return null;
  try {
    const regex = new RegExp(pattern, 'i');
    return rawText.match(regex)?.[0] || rawText.split(/\r?\n/).map(line => line.match(regex)?.[0] || null).find(Boolean) || null;
  } catch { return null; }
}

export function extractionStatusFor(definition: DocumentDefinition, extracted: Record<string, unknown>): ExtractionStatus {
  return Object.entries(definition.fields).some(([key, field]) => field.required && (extracted[key] === null || extracted[key] === undefined || (typeof extracted[key] === 'string' && !extracted[key].trim()))) ? 'REVIEW' : 'SUCCESS';
}

export function extractDefinedFields(documentType: string, rawOcrText: string, definition: DocumentDefinition, layoutLines: readonly ExtractionOcrLine[] = []): DocumentExtractionResult {
  const normalizedType = documentType.toUpperCase();
  const prepared = preparedLines(rawOcrText, normalizedType === 'PAN' ? [] : layoutLines, normalizedType !== 'PAN');
  const lines = prepared.map(line => line.text);
  const text = lines.join('\n');
  const extractedFields: Record<string, unknown> = {};
  const confidence: Record<string, number> = {};
  const warnings: string[] = [];
  const panName = normalizedType === 'PAN' ? panNameSelection(text, definition.fields.panName) : null;
  const panFather = normalizedType === 'PAN' ? panFatherSelection(text, definition.fields.fatherName) : null;
  const passport = normalizedType === 'PASSPORT' ? passportSelections(prepared, definition) : null;
  const gst = normalizedType === 'GSTIN' ? gstSelections(prepared, definition) : null;

  for (const [key, field] of Object.entries(definition.fields)) {
    let selection: Selection | null = null;
    if (normalizedType === 'PAN' && key === 'panName') selection = panName;
    else if (normalizedType === 'PAN' && key === 'fatherName') selection = panFather;
    else if (passport && passport[key]) selection = passport[key];
    else if (gst && gst[key]) selection = gst[key];
    else if (/name/i.test(`${key} ${field.label}`)) selection = fieldCandidateFromLabels(lines, aliasesFor(key, field), field, /legalName|tradeName|companyName|businessName|enterpriseName/i.test(key));
    else selection = fieldCandidateFromLabels(lines, aliasesFor(key, field), field, true);

    const candidate = field.normalization?.toUpperCase() === 'PAN'
      ? rawOcrText
      : field.normalization?.toUpperCase() === 'GSTIN'
        ? selection?.value || rawOcrText
      : selection?.value || patternCandidate(rawOcrText, field);
    const value = normalizeValue(normalizedType, key, field, candidate, rawOcrText);
    extractedFields[key] = value;
    if (value !== null) confidence[key] = selection?.ambiguous ? 0.35 : selection ? 0.9 : 0.6;
    if (selection?.ambiguous) warnings.push(`Ambiguous extraction for ${field.label}`);
    if (value === null && field.required) warnings.push(`Required field was not extracted: ${field.label}`);
    ocrLog('field mapped', { documentType: normalizedType, field: key, extracted: value !== null, candidateCount: selection?.candidateCount || 0, ambiguous: selection?.ambiguous || false });
  }
  const status = extractionStatusFor(definition, extractedFields);
  if (status === 'REVIEW') ocrWarning('incomplete extraction', normalizedType, { requiredFieldCount: Object.entries(definition.fields).filter(([, field]) => field.required).length, extractedFieldCount: Object.values(extractedFields).filter(value => value !== null).length });
  return { extractedFields, confidence, warnings, status };
}
