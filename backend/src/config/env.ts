import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const sourceBackendDirectory = resolve(moduleDir, '../..');
const backendDirectory = existsSync(resolve(sourceBackendDirectory, 'package.json'))
  ? sourceBackendDirectory
  : resolve(moduleDir, '../../..');
const workingDirectory = resolve(process.cwd());
const envCandidates = [
  resolve(workingDirectory, 'backend', '.env'),
  resolve(workingDirectory, '.env'),
  resolve(moduleDir, '../..', '.env'),
  resolve(moduleDir, '../../..', '.env'),
];
const envFilePath = envCandidates.find((candidate) => existsSync(candidate));
if (!envFilePath) throw new Error(`Missing backend environment file. Checked: ${envCandidates.join(', ')}`);
const dotenvResult = config({ path: envFilePath });
export const envDiagnostics = {
  workingDirectory,
  envFilePath,
  envFileExists: existsSync(envFilePath),
  dotenvParsedFile: Boolean(dotenvResult.parsed),
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function configuredBackendPath(value: string | undefined, fallback: string) {
  const configured = value?.trim();
  if (!configured) return fallback;
  return isAbsolute(configured) ? configured : resolve(backendDirectory, configured);
}

const projectPaddlePythonPath = resolve(backendDirectory, 'ocr-worker', process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const defaultPaddlePythonPath = existsSync(projectPaddlePythonPath) ? projectPaddlePythonPath : (process.platform === 'win32' ? 'python' : 'python3');
const defaultPaddleWorkerPath = resolve(backendDirectory, 'ocr-worker/paddle_worker.py');

export const env = {
  get databaseUrl() { return required('DATABASE_URL'); },
  get verificationDatabaseUrl() {
    const explicit = process.env.VERIFICATION_DATABASE_URL?.trim();
    if (explicit) return explicit;
    const primary = required('DATABASE_URL');
    try {
      const url = new URL(primary);
      url.pathname = `${url.pathname.replace(/\/$/, '').replace(/\/[^/]*$/, '')}/cpcl_verification`;
      return url.toString();
    } catch {
      throw new Error('Invalid DATABASE_URL; set VERIFICATION_DATABASE_URL for mock verification');
    }
  },
  get jwtSecret() { return required('JWT_SECRET'); },
  get refreshTokenSecret() { return required('REFRESH_TOKEN_SECRET'); },
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  smtpHost: (process.env.SMTP_HOST || '').trim(),
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: (process.env.SMTP_USER || '').trim(),
  smtpPass: (process.env.SMTP_PASS || '').trim(),
  smtpFrom: (process.env.SMTP_FROM || '').trim(),
  cloudinaryCloudName: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  cloudinaryApiKey: (process.env.CLOUDINARY_API_KEY || '').trim(),
  cloudinaryApiSecret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  paddlePythonPath: configuredBackendPath(process.env.PADDLEOCR_PYTHON_PATH, defaultPaddlePythonPath),
  paddleWorkerPath: configuredBackendPath(process.env.PADDLEOCR_WORKER_PATH, defaultPaddleWorkerPath),
  paddleDevice: (process.env.PADDLEOCR_DEVICE || 'cpu').trim() || 'cpu',
  paddleTimeoutMs: Number(process.env.PADDLEOCR_TIMEOUT_MS || 300000),
  port: Number(process.env.PORT || 5000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development'
};
