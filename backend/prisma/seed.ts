import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Deliberately empty: explicit registration and test fixtures are used instead.
  // This prevents demo procurement data from returning after a database reset.
  console.log('Seed skipped: clean procurement database requested.');
}

main().finally(() => prisma.$disconnect());
