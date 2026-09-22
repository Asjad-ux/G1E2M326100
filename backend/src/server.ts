import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

const server=app.listen(env.port,()=>{
  console.log(`CPCL backend listening on http://localhost:${env.port}`);
  console.log(`SMTP_HOST configured: ${Boolean(env.smtpHost)}`);
  console.log(`SMTP_USER configured: ${Boolean(env.smtpUser)}`);
  console.log(`SMTP_PASS configured: ${Boolean(env.smtpPass)}`);
  console.log(`SMTP_FROM configured: ${Boolean(env.smtpFrom)}`);
});
const shutdown=async()=>{server.close();await prisma.$disconnect();process.exit(0);};
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
