-- Replace provider-specific document metadata while preserving all existing document rows.
ALTER TABLE Document
    ADD COLUMN cloudinaryPublicId VARCHAR(191) NULL,
    ADD COLUMN cloudinaryUrl VARCHAR(191) NULL,
    ADD COLUMN cloudinaryResourceType VARCHAR(191) NULL DEFAULT 'raw';

DROP INDEX Document_googleDriveFileId_key ON Document;

ALTER TABLE Document
    DROP COLUMN googleDriveFileId,
    DROP COLUMN googleDriveUrl;

CREATE UNIQUE INDEX Document_cloudinaryPublicId_key ON Document(cloudinaryPublicId);
