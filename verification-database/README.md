# CPCL Verification Database

This directory is a completely separate Prisma/MySQL database for synthetic external-verification fixtures.

It is intentionally separate from the existing `cpcl_tender` Prisma schema, migrations, routes, services, OCR flow, authentication, and frontend.

## Database

The database name is `cpcl_verification`.

Create it once in MySQL:

```sql
CREATE DATABASE IF NOT EXISTS cpcl_verification
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Or run `sql/00_create_database.sql` as a MySQL administrator.

## Setup

1. Copy `.env.example` to `.env` and set the MySQL credentials. The URL must point to `cpcl_verification`, not `cpcl_tender`.
2. Install this package's dependencies:

   ```bash
   npm install
   ```

3. Generate the isolated Prisma client:

   ```bash
   npm run prisma:generate
   ```

4. Apply the migration:

   ```bash
   npm run prisma:migrate
   ```

5. Load deterministic synthetic data:

   ```bash
   npm run seed
   ```

6. Run the checks:

   ```bash
   npm run verify
   ```

The seed is safe to rerun for this standalone demo database: it preserves existing verification rows and upserts the deterministic PAN fixtures. It never touches `cpcl_tender`.

## Relational model

`VerificationEntities` is the master table. Each verification table stores its own identifier/data and references the master through `entity_id`:

```text
VerificationEntities
  ├── AadhaarRecords
  ├── GSTRecords
  ├── CINRecords
  ├── MSMERecords
  ├── PhoneRecords
  ├── EmailRecords
  └── PanVerifications
```

Identifier columns are unique. Foreign keys use `ON DELETE RESTRICT` so an entity cannot be removed while verification records still point at it. `entity_id` is indexed in every child table. Multiple historical records per entity are allowed; the seed keeps the current/primary record active and uses inactive/cancelled records for test coverage.

## Synthetic fixture coverage

- 100 entities: 60 companies and 40 people.
- 100 rows in each child table.
- Company GST/CIN/MSME records are linked to company entities; extra inactive records represent historical registrations.
- People have active Aadhaar records; extra inactive Aadhaar records represent historical identifiers.
- Every entity has one synthetic phone and one synthetic email.
- Active, inactive, suspended, cancelled, and struck-off statuses are included.
- Names, addresses, identifiers, phone numbers, email domains, and PAN-like values are fictional and generated for this fixture only. They are not government records.

## Example verification queries

Find a GSTIN, retrieve its entity, compare a submitted name, and check status:

```sql
SET @gstin = '27VYTRA0001K1Z5';
SET @submitted_name = 'Suryodaya Transit Systems Private Limited';

SELECT
  g.gstin,
  g.entity_id,
  e.name AS database_entity_name,
  g.legal_name AS gst_legal_name,
  g.status,
  CASE
    WHEN LOWER(TRIM(g.legal_name)) = LOWER(TRIM(@submitted_name)) THEN 'MATCH'
    ELSE 'MISMATCH'
  END AS submitted_name_match,
  CASE WHEN g.status = 'ACTIVE' THEN 'VALID' ELSE 'NOT_ACTIVE' END AS status_check
FROM GSTRecords AS g
JOIN VerificationEntities AS e ON e.id = g.entity_id
WHERE g.gstin = @gstin;
```

Find every verification record belonging to one entity:

```sql
SET @entity_id = 1;

SELECT 'GST' AS record_type, g.id, g.gstin AS identifier, g.status
FROM GSTRecords AS g WHERE g.entity_id = @entity_id
UNION ALL
SELECT 'CIN', c.id, c.cin, c.company_status
FROM CINRecords AS c WHERE c.entity_id = @entity_id
UNION ALL
SELECT 'MSME', m.id, m.udyam_number, m.status
FROM MSMERecords AS m WHERE m.entity_id = @entity_id
UNION ALL
SELECT 'AADHAAR', a.id, a.aadhaar_number, a.status
FROM AadhaarRecords AS a WHERE a.entity_id = @entity_id
UNION ALL
SELECT 'PHONE', p.id, p.phone_number, p.status
FROM PhoneRecords AS p WHERE p.entity_id = @entity_id
UNION ALL
SELECT 'EMAIL', x.id, x.email, x.status
FROM EmailRecords AS x WHERE x.entity_id = @entity_id;
```

Other useful checks are in `sql/verification-queries.sql`, including not-found lookups, duplicate detection, orphan detection, table counts, and the deliberate cancelled-GST fixture.
