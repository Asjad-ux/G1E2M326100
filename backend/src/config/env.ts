import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));

const workingDirectory = resolve(process.cwd());

const sourceBackendDirectory = resolve(moduleDir, '../..');
const compiledBackendDirectory = resolve(moduleDir, '../../..');
const backendDirectory = existsSync(resolve(workingDirectory, 'src/server.ts'))
  ? workingDirectory
  : existsSync(resolve(workingDirectory, 'dist/src/server.js'))
    ? workingDirectory
    : existsSync(resolve(workingDirectory, 'backend/package.json'))
      ? resolve(workingDirectory, 'backend')
      : existsSync(resolve(sourceBackendDirectory, 'package.json'))
        ? sourceBackendDirectory
        : compiledBackendDirectory;

const envCandidates = [
  resolve(workingDirectory, 'backend', '.env'),
  resolve(workingDirectory, '.env'),
  resolve(moduleDir, '../..', '.env'),
  resolve(moduleDir, '../../..', '.env'),
];

const envFilePath = envCandidates.find((candidate) => existsSync(candidate));

// Load .env if it exists.
// On Render, environment variables are provided through process.env.
const dotenvResult = envFilePath
  ? config({ path: envFilePath })
  : { parsed: undefined };

export const envDiagnostics = {
  workingDirectory,
  envFilePath,
  envFileExists: Boolean(envFilePath),
  dotenvParsedFile: Boolean(dotenvResult.parsed),
};

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function configuredBackendPath(value: string | undefined, fallback: string) {
  const configured = value?.trim();

  if (!configured) return fallback;

  return isAbsolute(configured)
    ? configured
    : resolve(backendDirectory, configured);
}

const projectPaddlePythonPath = resolve(
  backendDirectory,
  'ocr-runtime',
  process.platform === 'win32'
    ? 'Scripts/python.exe'
    : 'bin/python'
);

const defaultPaddlePythonPath = projectPaddlePythonPath;

const defaultPaddleWorkerPath = resolve(
  backendDirectory,
  'ocr-worker/paddle_worker.py'
);

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL');
  },

  get verificationDatabaseUrl() {
    const explicit = process.env.VERIFICATION_DATABASE_URL?.trim();

    if (explicit) return explicit;

    const primary = required('DATABASE_URL');

    try {
      const url = new URL(primary);

      url.pathname = `${url.pathname
        .replace(/\/$/, '')
        .replace(/\/[^/]*$/, '')}/cpcl_verification`;

      return url.toString();
    } catch {
      throw new Error(
        'Invalid DATABASE_URL; set VERIFICATION_DATABASE_URL for mock verification'
      );
    }
  },

  get jwtSecret() {
    return required('JWT_SECRET');
  },

  get refreshTokenSecret() {
    return required('REFRESH_TOKEN_SECRET');
  },

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',

  refreshTokenExpiresIn:
    process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',

  resendApiKey: (process.env.RESEND_API_KEY || '').trim(),

  resendFromEmail: (process.env.RESEND_FROM_EMAIL || '').trim(),

  resendTimeoutMs: Number(process.env.RESEND_TIMEOUT_MS || 15000),

  cloudinaryCloudName:
    (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),

  cloudinaryApiKey:
    (process.env.CLOUDINARY_API_KEY || '').trim(),

  cloudinaryApiSecret:
    (process.env.CLOUDINARY_API_SECRET || '').trim(),

  cloudinaryTimeoutMs: Number(process.env.CLOUDINARY_TIMEOUT_MS || 30000),

  paddlePythonPath: configuredBackendPath(
    process.env.PADDLEOCR_PYTHON_PATH,
    defaultPaddlePythonPath
  ),

  paddleWorkerPath: configuredBackendPath(
    process.env.PADDLEOCR_WORKER_PATH,
    defaultPaddleWorkerPath
  ),

  paddleDevice:
    (process.env.PADDLEOCR_DEVICE || 'cpu').trim() || 'cpu',

  paddleTimeoutMs:
    Number(process.env.PADDLEOCR_TIMEOUT_MS || 300000),

  port: Number(process.env.PORT || 5000),

  frontendUrl:
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://cpcl-2.onrender.com' : 'http://localhost:5173'),

  nodeEnv:
    process.env.NODE_ENV || 'development',

  emailProvider: 'resend'
};
