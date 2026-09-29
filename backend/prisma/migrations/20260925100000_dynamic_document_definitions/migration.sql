-- Add only fields represented by the initial, application-controlled JSON definitions.
ALTER TABLE `User`
    ADD COLUMN `panNumber` VARCHAR(191) NULL,
    ADD COLUMN `panName` VARCHAR(191) NULL,
    ADD COLUMN `fatherName` VARCHAR(191) NULL,
    ADD COLUMN `dateOfBirth` DATETIME(3) NULL,
    ADD COLUMN `aadhaarNumber` VARCHAR(191) NULL,
    ADD COLUMN `aadhaarName` VARCHAR(191) NULL,
    ADD COLUMN `aadhaarDateOfBirth` DATETIME(3) NULL,
    ADD COLUMN `passportNumber` VARCHAR(191) NULL,
    ADD COLUMN `passportName` VARCHAR(191) NULL,
    ADD COLUMN `passportDateOfBirth` DATETIME(3) NULL,
    ADD COLUMN `nationality` VARCHAR(191) NULL,
    ADD COLUMN `passportIssueDate` DATETIME(3) NULL,
    ADD COLUMN `passportExpiryDate` DATETIME(3) NULL,
    ADD COLUMN `placeOfBirth` VARCHAR(191) NULL,
    ADD COLUMN `gstin` VARCHAR(191) NULL,
    ADD COLUMN `gstinLegalName` VARCHAR(191) NULL,
    ADD COLUMN `cin` VARCHAR(191) NULL,
    ADD COLUMN `cinLegalName` VARCHAR(191) NULL,
    ADD COLUMN `msmeNumber` VARCHAR(191) NULL,
    ADD COLUMN `msmeName` VARCHAR(191) NULL;

ALTER TABLE `TenderRequirement`
    ADD COLUMN `documentType` VARCHAR(191) NULL;

ALTER TABLE `Document`
    ADD COLUMN `expiresAt` DATETIME(3) NULL;

ALTER TABLE `Document`
    MODIFY COLUMN `status` ENUM('PENDING', 'VERIFIED', 'REVIEW', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING';

ALTER TABLE `Notification`
    MODIFY COLUMN `type` ENUM('APPLICATION_SUBMITTED', 'APPLICATION_ACCEPTED', 'APPLICATION_REJECTED', 'BLACKLISTED', 'NEW_BID', 'DOCUMENT_REVIEW', 'DOCUMENT_EXPIRED') NOT NULL;

CREATE TABLE `DocumentRequest` (
    `id` VARCHAR(191) NOT NULL,
    `requestedByUserId` VARCHAR(191) NOT NULL,
    `requestedByName` VARCHAR(191) NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `adminComment` VARCHAR(191) NULL,
    INDEX `DocumentRequest_requestedByUserId_idx`(`requestedByUserId`),
    INDEX `DocumentRequest_documentName_status_idx`(`documentName`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DocumentRequest`
    ADD CONSTRAINT `DocumentRequest_requestedByUserId_fkey`
    FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
