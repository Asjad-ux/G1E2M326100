USE cpcl_verification;

-- 1. Find a GSTIN and get its common relational entity_id.
SET @gstin = '27VYTRA0001K1Z5';
SELECT id, entity_id, gstin, legal_name, trade_name, status
FROM GSTRecords
WHERE gstin = @gstin;

-- 2. Resolve the entity name through the shared entity_id.
SELECT g.entity_id, e.name AS database_entity_name, e.entity_type, e.status AS entity_status
FROM GSTRecords AS g
JOIN VerificationEntities AS e ON e.id = g.entity_id
WHERE g.gstin = @gstin;

-- 3. Compare a submitted CPCL name with the database name.
SET @submitted_name = 'Suryodaya Transit Systems Private Limited';
SELECT
  g.gstin,
  e.name AS database_entity_name,
  @submitted_name AS submitted_name,
  CASE WHEN LOWER(TRIM(e.name)) = LOWER(TRIM(@submitted_name)) THEN 'MATCH' ELSE 'MISMATCH' END AS name_result
FROM GSTRecords AS g
JOIN VerificationEntities AS e ON e.id = g.entity_id
WHERE g.gstin = @gstin;

-- 4. Check whether the GST record is active.
SELECT gstin, status, CASE WHEN status = 'ACTIVE' THEN TRUE ELSE FALSE END AS is_active
FROM GSTRecords
WHERE gstin = @gstin;

-- 5. Retrieve all verification records for the same entity.
SET @entity_id = 1;
SELECT 'GST' AS record_type, g.gstin AS identifier, g.status AS record_status
FROM GSTRecords AS g WHERE g.entity_id = @entity_id
UNION ALL
SELECT 'CIN', c.cin, c.company_status
FROM CINRecords AS c WHERE c.entity_id = @entity_id
UNION ALL
SELECT 'MSME', m.udyam_number, m.status
FROM MSMERecords AS m WHERE m.entity_id = @entity_id
UNION ALL
SELECT 'AADHAAR', a.aadhaar_number, a.status
FROM AadhaarRecords AS a WHERE a.entity_id = @entity_id
UNION ALL
SELECT 'PHONE', p.phone_number, p.status
FROM PhoneRecords AS p WHERE p.entity_id = @entity_id
UNION ALL
SELECT 'EMAIL', x.email, x.status
FROM EmailRecords AS x WHERE x.entity_id = @entity_id;

-- 6. Deliberate test cases: cancelled status and identifier not found.
SELECT gstin, entity_id, legal_name, status
FROM GSTRecords
WHERE gstin = '28VYTRA0002K1Z6';

SELECT 'NOT_FOUND' AS result
WHERE NOT EXISTS (
  SELECT 1 FROM GSTRecords WHERE gstin = '27NOTREAL0000X1Z9'
);

-- 7. Table counts.
SELECT 'VerificationEntities' AS table_name, COUNT(*) AS row_count FROM VerificationEntities
UNION ALL SELECT 'AadhaarRecords', COUNT(*) FROM AadhaarRecords
UNION ALL SELECT 'GSTRecords', COUNT(*) FROM GSTRecords
UNION ALL SELECT 'CINRecords', COUNT(*) FROM CINRecords
UNION ALL SELECT 'MSMERecords', COUNT(*) FROM MSMERecords
UNION ALL SELECT 'PhoneRecords', COUNT(*) FROM PhoneRecords
UNION ALL SELECT 'EmailRecords', COUNT(*) FROM EmailRecords;

-- 8. Duplicate identifier checks: every result should be empty.
SELECT aadhaar_number, COUNT(*) AS occurrences FROM AadhaarRecords GROUP BY aadhaar_number HAVING COUNT(*) > 1;
SELECT gstin, COUNT(*) AS occurrences FROM GSTRecords GROUP BY gstin HAVING COUNT(*) > 1;
SELECT cin, COUNT(*) AS occurrences FROM CINRecords GROUP BY cin HAVING COUNT(*) > 1;
SELECT udyam_number, COUNT(*) AS occurrences FROM MSMERecords GROUP BY udyam_number HAVING COUNT(*) > 1;
SELECT phone_number, COUNT(*) AS occurrences FROM PhoneRecords GROUP BY phone_number HAVING COUNT(*) > 1;
SELECT email, COUNT(*) AS occurrences FROM EmailRecords GROUP BY email HAVING COUNT(*) > 1;

-- 9. Orphan checks: every result should be empty.
SELECT 'AadhaarRecords' AS table_name, a.id FROM AadhaarRecords a LEFT JOIN VerificationEntities e ON e.id = a.entity_id WHERE e.id IS NULL
UNION ALL SELECT 'GSTRecords', g.id FROM GSTRecords g LEFT JOIN VerificationEntities e ON e.id = g.entity_id WHERE e.id IS NULL
UNION ALL SELECT 'CINRecords', c.id FROM CINRecords c LEFT JOIN VerificationEntities e ON e.id = c.entity_id WHERE e.id IS NULL
UNION ALL SELECT 'MSMERecords', m.id FROM MSMERecords m LEFT JOIN VerificationEntities e ON e.id = m.entity_id WHERE e.id IS NULL
UNION ALL SELECT 'PhoneRecords', p.id FROM PhoneRecords p LEFT JOIN VerificationEntities e ON e.id = p.entity_id WHERE e.id IS NULL
UNION ALL SELECT 'EmailRecords', x.id FROM EmailRecords x LEFT JOIN VerificationEntities e ON e.id = x.entity_id WHERE e.id IS NULL;

