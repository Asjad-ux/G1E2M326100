import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DocumentFieldDefinition = {
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  sensitive?: boolean;
  validation?: { type?: 'regex' | 'range' | 'enum'; pattern?: string; min?: number; max?: number; values?: string[] };
  ocrAliases?: string[];
  normalization?: string;
  ocrExcludeTerms?: string[];
};

export type DocumentDefinition = {
  documentType: string;
  documentName: string;
  description?: string;
  isActive: boolean;
  isExpirable: boolean;
  expiryField: string | null;
  fields: Record<string, DocumentFieldDefinition>;
};

const sourceDefinitionsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../document-definitions');
const definitionsDirectory = existsSync(sourceDefinitionsDirectory)
  ? sourceDefinitionsDirectory
  : resolve(dirname(fileURLToPath(import.meta.url)), '../../../document-definitions');
const fieldKeyPattern = /^[A-Za-z][A-Za-z0-9_]*$/;
const supportedFieldTypes = new Set(['string', 'number', 'date', 'boolean']);
let cachedDefinitions: DocumentDefinition[] | null = null;

function validDefinition(value: unknown): value is DocumentDefinition {
  if (!value || typeof value !== 'object') return false;
  const definition = value as Record<string, unknown>;
  if (typeof definition.documentType !== 'string' || !definition.documentType.trim()) return false;
  if (typeof definition.documentName !== 'string' || !definition.documentName.trim()) return false;
  if (typeof definition.isActive !== 'boolean' || typeof definition.isExpirable !== 'boolean') return false;
  if (!(definition.expiryField === null || typeof definition.expiryField === 'string')) return false;
  if (!definition.fields || typeof definition.fields !== 'object' || Array.isArray(definition.fields)) return false;

  for (const [key, rawField] of Object.entries(definition.fields as Record<string, unknown>)) {
    if (!fieldKeyPattern.test(key) || !rawField || typeof rawField !== 'object') return false;
    const field = rawField as Record<string, unknown>;
    if (typeof field.label !== 'string' || !supportedFieldTypes.has(String(field.type))) return false;
    if (typeof field.required !== 'boolean') return false;
    if (field.sensitive !== undefined && typeof field.sensitive !== 'boolean') return false;
    if (field.validation !== undefined && (!field.validation || typeof field.validation !== 'object')) return false;
    if (field.ocrAliases !== undefined && (!Array.isArray(field.ocrAliases) || field.ocrAliases.some(alias => typeof alias !== 'string'))) return false;
    if (field.normalization !== undefined && typeof field.normalization !== 'string') return false;
    if (field.ocrExcludeTerms !== undefined && (!Array.isArray(field.ocrExcludeTerms) || field.ocrExcludeTerms.some(term => typeof term !== 'string'))) return false;
  }

  if (definition.isExpirable && (!definition.expiryField || !(definition.fields as Record<string, unknown>)[definition.expiryField])) return false;
  return true;
}

export function getAllDocumentDefinitions(): DocumentDefinition[] {
  if (cachedDefinitions) return cachedDefinitions;
  if (!existsSync(definitionsDirectory)) return [];
  const definitions: DocumentDefinition[] = [];
  for (const fileName of readdirSync(definitionsDirectory)) {
    if (!fileName.toLowerCase().endsWith('.json')) continue;
    try {
      const parsed: unknown = JSON.parse(readFileSync(resolve(definitionsDirectory, fileName), 'utf8'));
      if (!validDefinition(parsed)) {
        console.warn(`Ignoring invalid document definition: ${fileName}`);
        continue;
      }
      definitions.push({ ...parsed, documentType: parsed.documentType.trim().toUpperCase() });
    } catch {
      console.warn(`Ignoring malformed document definition: ${fileName}`);
    }
  }
  cachedDefinitions = definitions.sort((a, b) => a.documentName.localeCompare(b.documentName));
  return cachedDefinitions;
}

export function getActiveDocumentDefinitions() {
  return getAllDocumentDefinitions().filter(definition => definition.isActive);
}

export function getDocumentDefinition(documentType: string) {
  const normalized = documentType.trim().toUpperCase();
  return getAllDocumentDefinitions().find(definition => definition.documentType === normalized);
}

export function documentDefinitionExists(documentType: string) {
  return Boolean(getDocumentDefinition(documentType));
}

export function getDocumentFields(documentType: string) {
  const definition = getDocumentDefinition(documentType);
  return definition ? Object.entries(definition.fields).map(([key, field]) => ({ key, ...field })) : [];
}

export function publicDocumentDefinitions() {
  return getActiveDocumentDefinitions().map(({ documentType, documentName, description, isExpirable, expiryField }) => ({ documentType, documentName, description, isExpirable, expiryField }));
}

export function documentDefinitionDirectory() {
  return definitionsDirectory;
}
