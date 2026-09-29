import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { env } from '../config/env.js';
import { downloadFile } from './cloudinary.service.js';
import { AppError } from '../utils/errors.js';

export type OcrLine = {
  text: string;
  confidence: number | null;
  bbox: unknown;
  pageIndex: number;
};

export type OcrRequest = {
  documentType: string;
  sourceUrl: string;
  cloudinaryPublicId?: string | null;
  cloudinaryResourceType?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
};

export type OcrProviderResult = {
  provider: 'PaddleOCR';
  rawText: string;
  lines: OcrLine[];
  pageCount: number;
};

export function ocrLog(stage: string, details: Record<string, unknown> = {}) {
  const suffix = Object.entries(details).map(([key, value]) => `${key}=${String(value)}`).join(' ');
  console.info(`[OCR] ${stage}${suffix ? ` ${suffix}` : ''}`);
}

export function ocrError(stage: string, provider = 'PaddleOCR', status?: number) {
  console.error(`[OCR ERROR] stage=${stage} provider=${provider} status=${status || 'unknown'}`);
}

export function ocrWarning(stage: string, documentType: string, details: Record<string, unknown> = {}) {
  const suffix = Object.entries(details).map(([key, value]) => `${key}=${String(value)}`).join(' ');
  console.warn(`[OCR WARNING] stage=${stage} documentType=${documentType}${suffix ? ` ${suffix}` : ''}`);
}

export class OcrWorkerError extends AppError {
  constructor(
    message: string,
    public readonly stage = 'worker',
    statusCode = 502,
    public readonly provider = 'PaddleOCR',
  ) {
    super(statusCode, message);
  }
}

const supportedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function fileExtension(mimeType: string, fileName: string) {
  const extension = extname(fileName).toLowerCase();
  if (extension) return extension;
  return ({ 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' } as Record<string, string>)[mimeType] || '';
}

async function loadDocumentBytes(request: OcrRequest) {
  ocrLog('input received', { provider: 'PaddleOCR', documentType: request.documentType });
  try {
    const buffer = request.cloudinaryPublicId
      ? await downloadFile(request.cloudinaryPublicId, request.cloudinaryResourceType || 'raw')
      : await (async () => {
        if (!request.sourceUrl) throw new OcrWorkerError('Document source is missing.', 'input');
        const response = await fetch(request.sourceUrl, { signal: AbortSignal.timeout(Math.max(1000, env.paddleTimeoutMs)) });
        if (!response.ok) throw new OcrWorkerError('Document could not be fetched.', 'cloudinary-fetch', response.status);
        return Buffer.from(await response.arrayBuffer());
      })();
    if (!buffer.length) throw new OcrWorkerError('Document is empty.', 'empty-document', 400);
    ocrLog('Cloudinary fetch completed', { provider: 'PaddleOCR', documentType: request.documentType, byteCount: buffer.length });
    return buffer;
  } catch (error) {
    if (error instanceof OcrWorkerError) throw error;
    throw new OcrWorkerError('Document could not be fetched.', 'cloudinary-fetch');
  }
}

function parseWorkerOutput(stdout: string) {
  const candidate = stdout.trim().split(/\r?\n/).reverse().find(line => line.trim().startsWith('{'));
  if (!candidate) throw new OcrWorkerError('PaddleOCR returned no JSON result.', 'malformed-response');
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new OcrWorkerError('PaddleOCR returned malformed JSON.', 'malformed-response');
  }
}

function runWorker(inputPath: string): Promise<OcrProviderResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(env.paddlePythonPath, [env.paddleWorkerPath, '--input', inputPath, '--device', env.paddleDevice], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, Math.max(1000, env.paddleTimeoutMs));
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', () => undefined);
    child.once('error', () => {
      clearTimeout(timeout);
      reject(new OcrWorkerError('PaddleOCR worker is unavailable.', 'worker-unavailable', 503));
    });
    child.once('close', code => {
      clearTimeout(timeout);
      if (timedOut) return reject(new OcrWorkerError('PaddleOCR worker timed out.', 'timeout', 504));
      let payload: Record<string, unknown>;
      try {
        payload = parseWorkerOutput(stdout);
      } catch (error) {
        return reject(error);
      }
      if (code !== 0 || payload.ok !== true) return reject(new OcrWorkerError('PaddleOCR worker failed.', 'worker-failure'));
      const pageCount = payload.pageCount;
      if (typeof payload.text !== 'string' || !payload.text.trim() || !Array.isArray(payload.lines) || typeof pageCount !== 'number' || !Number.isInteger(pageCount) || pageCount < 1) {
        return reject(new OcrWorkerError('PaddleOCR returned an invalid result.', 'malformed-response'));
      }
      const lines = payload.lines.filter((line): line is Record<string, unknown> => Boolean(line) && typeof line === 'object').map(line => ({
        text: typeof line.text === 'string' ? line.text : '',
        confidence: typeof line.confidence === 'number' ? line.confidence : null,
        bbox: line.bbox ?? null,
        pageIndex: typeof line.pageIndex === 'number' ? line.pageIndex : 0,
      })).filter(line => line.text.trim());
      if (!lines.length) return reject(new OcrWorkerError('PaddleOCR returned no text lines.', 'empty-response'));
      resolve({ provider: 'PaddleOCR', rawText: payload.text, lines, pageCount });
    });
  });
}

export async function extractDocumentText(request: OcrRequest): Promise<OcrProviderResult> {
  const mimeType = request.mimeType || 'application/octet-stream';
  if (!supportedMimeTypes.has(mimeType)) throw new OcrWorkerError('This document format is not supported by PaddleOCR.', 'unsupported-format', 415);
  const buffer = await loadDocumentBytes(request);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'cpcl-paddle-'));
  const safeFileName = basename(request.fileName || `${request.documentType}${fileExtension(mimeType, '')}`).replace(/[^A-Za-z0-9._-]/g, '_');
  const inputPath = join(temporaryDirectory, safeFileName || `document${fileExtension(mimeType, '')}`);
  try {
    await writeFile(inputPath, buffer);
    ocrLog('processing started', { provider: 'PaddleOCR', documentType: request.documentType, device: env.paddleDevice });
    const result = await runWorker(inputPath);
    ocrLog('processing completed', { provider: 'PaddleOCR', documentType: request.documentType, characterCount: result.rawText.length, lineCount: result.lines.length, pageCount: result.pageCount });
    return result;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
