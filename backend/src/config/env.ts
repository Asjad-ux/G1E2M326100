import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
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

export const env = {
  get databaseUrl() { return required('DATABASE_URL'); },
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
  port: Number(process.env.PORT || 5000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development'
};
