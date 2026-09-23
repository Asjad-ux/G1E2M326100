import { app } from './app.js';
import { env, envDiagnostics } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { cloudinaryConfigured } from './services/cloudinary.service.js';

const server=app.listen(env.port,()=>{
  console.log(`CPCL backend listening on http://localhost:${env.port}`);
  console.log(`process.cwd(): ${envDiagnostics.workingDirectory}`);
  console.log(`dotenv env path: ${envDiagnostics.envFilePath}`);
  console.log(`dotenv env exists: ${envDiagnostics.envFileExists}`);
  console.log(`dotenv parsed backend/.env: ${envDiagnostics.dotenvParsedFile}`);
  console.log(`SMTP_HOST configured: ${Boolean(env.smtpHost)}`);
  console.log(`SMTP_USER configured: ${Boolean(env.smtpUser)}`);
  console.log(`SMTP_PASS configured: ${Boolean(env.smtpPass)}`);
  console.log(`SMTP_FROM configured: ${Boolean(env.smtpFrom)}`);
  console.log(`CLOUDINARY_CLOUD_NAME configured: ${Boolean(env.cloudinaryCloudName)}`);
  console.log(`CLOUDINARY_API_KEY configured: ${Boolean(env.cloudinaryApiKey)}`);
  console.log(`CLOUDINARY_API_SECRET configured: ${Boolean(env.cloudinaryApiSecret)}`);
  console.log('CLOUDINARY configured: ' + cloudinaryConfigured());
});
const shutdown=async()=>{server.close();await prisma.$disconnect();process.exit(0);};
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
