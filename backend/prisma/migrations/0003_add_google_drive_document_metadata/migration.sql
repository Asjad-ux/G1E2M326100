-- Add Google Drive references and upload metadata without storing document binaries in MySQL.
ALTER TABLE `Document` ADD COLUMN `fileSize` INTEGER NULL,
    ADD COLUMN `googleDriveFileId` VARCHAR(191) NULL,
    ADD COLUMN `googleDriveUrl` VARCHAR(191) NULL,
    ADD COLUMN `mimeType` VARCHAR(191) NULL,
    ADD COLUMN `originalFileName` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Document_googleDriveFileId_key` ON `Document`(`googleDriveFileId`);
