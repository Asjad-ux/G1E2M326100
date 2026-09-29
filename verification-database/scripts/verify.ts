import 'dotenv/config';
import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const database = await prisma.$queryRawUnsafe<Array<{ database_name: string | null }>>('SELECT DATABASE() AS database_name');
  if (database[0]?.database_name !== 'cpcl_verification') {
    throw new Error(`Connected to ${database[0]?.database_name ?? 'unknown'} instead of cpcl_verification.`);
  }

  const foreignKeys = await prisma.$queryRawUnsafe<Array<{ foreign_key_count: bigint }>>(`
    SELECT COUNT(*) AS foreign_key_count
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME = 'VerificationEntities'
      AND TABLE_NAME IN ('AadhaarRecords', 'GSTRecords', 'CINRecords', 'MSMERecords', 'PhoneRecords', 'EmailRecords')
  `);
  if (Number(foreignKeys[0]?.foreign_key_count ?? 0) !== 6) {
    throw new Error('Expected six child-table foreign keys to VerificationEntities.');
  }

  const tables = {
    VerificationEntities: await prisma.verificationEntity.count(),
    AadhaarRecords: await prisma.aadhaarRecord.count(),
    GSTRecords: await prisma.gSTRecord.count(),
    CINRecords: await prisma.cINRecord.count(),
    MSMERecords: await prisma.mSMERecord.count(),
    PhoneRecords: await prisma.phoneRecord.count(),
    EmailRecords: await prisma.emailRecord.count(),
    PanVerifications: await prisma.panVerification.count(),
  };

  console.table(tables);
  if (Object.values(tables).some((count) => count !== 100)) {
    throw new Error('Expected exactly 100 rows in every verification table.');
  }

  const panRecords = await prisma.panVerification.findMany({ orderBy: { id: 'asc' } });
  if (panRecords.some((record) => !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(record.panNumber) || !record.panName || !record.fatherName || Number.isNaN(record.dateOfBirth.getTime()))) {
    throw new Error('PAN verification fixture contains an invalid record.');
  }

  const duplicateChecks = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ duplicate_count: bigint }>>('SELECT COUNT(*) AS duplicate_count FROM (SELECT aadhaar_number FROM AadhaarRecords GROUP BY aadhaar_number HAVING COUNT(*) > 1) duplicates'),
    prisma.$queryRawUnsafe<Array<{ duplicate_count: bigint }>>('SELECT COUNT(*) AS duplicate_count FROM (SELECT gstin FROM GSTRecords GROUP BY gstin HAVING COUNT(*) > 1) duplicates'),
    prisma.$queryRawUnsafe<Array<{ duplicate_count: bigint }>>('SELECT COUNT(*) AS duplicate_count FROM (SELECT cin FROM CINRecords GROUP BY cin HAVING COUNT(*) > 1) duplicates'),
    prisma.$queryRawUnsafe<Array<{ duplicate_count: bigint }>>('SELECT COUNT(*) AS duplicate_count FROM (SELECT udyam_number FROM MSMERecords GROUP BY udyam_number HAVING COUNT(*) > 1) duplicates'),
    prisma.$queryRawUnsafe<Array<{ duplicate_count: bigint }>>('SELECT COUNT(*) AS duplicate_count FROM (SELECT phone_number FROM PhoneRecords GROUP BY phone_number HAVING COUNT(*) > 1) duplicates'),
    prisma.$queryRawUnsafe<Array<{ duplicate_count: bigint }>>('SELECT COUNT(*) AS duplicate_count FROM (SELECT email FROM EmailRecords GROUP BY email HAVING COUNT(*) > 1) duplicates'),
    prisma.$queryRawUnsafe<Array<{ duplicate_count: bigint }>>('SELECT COUNT(*) AS duplicate_count FROM (SELECT pan_number FROM PanVerifications GROUP BY pan_number HAVING COUNT(*) > 1) duplicates'),
  ]);
  if (duplicateChecks.some(([row]) => Number(row.duplicate_count) !== 0)) {
    throw new Error('Duplicate identifier detected.');
  }

  const orphanChecks = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ orphan_count: bigint }>>('SELECT COUNT(*) AS orphan_count FROM AadhaarRecords a LEFT JOIN VerificationEntities e ON e.id = a.entity_id WHERE e.id IS NULL'),
    prisma.$queryRawUnsafe<Array<{ orphan_count: bigint }>>('SELECT COUNT(*) AS orphan_count FROM GSTRecords g LEFT JOIN VerificationEntities e ON e.id = g.entity_id WHERE e.id IS NULL'),
    prisma.$queryRawUnsafe<Array<{ orphan_count: bigint }>>('SELECT COUNT(*) AS orphan_count FROM CINRecords c LEFT JOIN VerificationEntities e ON e.id = c.entity_id WHERE e.id IS NULL'),
    prisma.$queryRawUnsafe<Array<{ orphan_count: bigint }>>('SELECT COUNT(*) AS orphan_count FROM MSMERecords m LEFT JOIN VerificationEntities e ON e.id = m.entity_id WHERE e.id IS NULL'),
    prisma.$queryRawUnsafe<Array<{ orphan_count: bigint }>>('SELECT COUNT(*) AS orphan_count FROM PhoneRecords p LEFT JOIN VerificationEntities e ON e.id = p.entity_id WHERE e.id IS NULL'),
    prisma.$queryRawUnsafe<Array<{ orphan_count: bigint }>>('SELECT COUNT(*) AS orphan_count FROM EmailRecords x LEFT JOIN VerificationEntities e ON e.id = x.entity_id WHERE e.id IS NULL'),
  ]);
  if (orphanChecks.some(([row]) => Number(row.orphan_count) !== 0)) {
    throw new Error('Orphan verification record detected.');
  }

  const perfectMatch = await prisma.gSTRecord.findUnique({
    where: { gstin: '27VYTRA0001K1Z5' },
    include: { entity: true },
  });
  if (!perfectMatch || perfectMatch.legalName !== perfectMatch.entity.name || perfectMatch.status !== 'ACTIVE') {
    throw new Error('Perfect-match GST fixture failed.');
  }

  const cancelled = await prisma.gSTRecord.findUnique({ where: { gstin: '28VYTRA0002K1Z6' } });
  if (!cancelled || cancelled.status !== 'CANCELLED') {
    throw new Error('Cancelled GST fixture failed.');
  }

  const panFixture = await prisma.panVerification.findUnique({ where: { panNumber: 'QWERT1000A' } });
  if (!panFixture) {
    throw new Error('Synthetic PAN fixture failed.');
  }

  console.log('PASS: database name, tables, counts, unique identifiers, foreign keys, PAN fixture, and sample relational queries.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
