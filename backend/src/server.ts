import { app } from './app.js';
import { env, envDiagnostics } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { cloudinaryConfigured } from './services/cloudinary.service.js';
import { runDocumentExpiryCheck } from './services/document-expiry.service.js';

const server=app.listen(env.port,()=>{
  console.log(`BidEazy backend listening on http://localhost:${env.port}`);
  console.log(`process.cwd(): ${envDiagnostics.workingDirectory}`);
  console.log(`dotenv env path: ${envDiagnostics.envFilePath}`);
  console.log(`dotenv env exists: ${envDiagnostics.envFileExists}`);
  console.log(`dotenv parsed backend/.env: ${envDiagnostics.dotenvParsedFile}`);
  console.log('[EMAIL] Provider: Gmail SMTP');
  console.log(`[EMAIL] SMTP_HOST configured: ${Boolean(env.smtpHost)}`);
  console.log(`[EMAIL] SMTP_PORT configured: ${Boolean(env.smtpPort)}`);
  console.log(`[EMAIL] SMTP_USER configured: ${Boolean(env.smtpUser)}`);
  console.log(`[EMAIL] SMTP_PASS configured: ${Boolean(env.smtpPass)}`);
  console.log(`[EMAIL] SMTP_FROM configured: ${Boolean(env.smtpFrom)}`);
  console.log(`CLOUDINARY_CLOUD_NAME configured: ${Boolean(env.cloudinaryCloudName)}`);
  console.log(`CLOUDINARY_API_KEY configured: ${Boolean(env.cloudinaryApiKey)}`);
  console.log(`CLOUDINARY_API_SECRET configured: ${Boolean(env.cloudinaryApiSecret)}`);
  console.log('CLOUDINARY configured: ' + cloudinaryConfigured());
});
void runDocumentExpiryCheck().catch(error => console.error('Document expiry check failed:', error instanceof Error ? error.message : 'unknown error'));
const expiryTimer = setInterval(() => void runDocumentExpiryCheck().catch(error => console.error('Document expiry check failed:', error instanceof Error ? error.message : 'unknown error')), 60 * 60 * 1000);
expiryTimer.unref();
const shutdown=async()=>{clearInterval(expiryTimer);server.close();await prisma.$disconnect();process.exit(0);};
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
