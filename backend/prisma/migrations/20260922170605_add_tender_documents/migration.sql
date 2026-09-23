-- CreateTable
CREATE TABLE `TenderDocument` (
    `id` VARCHAR(191) NOT NULL,
    `tenderId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalFileName` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `cloudinaryPublicId` VARCHAR(191) NULL,
    `cloudinaryUrl` VARCHAR(191) NULL,
    `cloudinaryResourceType` VARCHAR(191) NULL DEFAULT 'raw',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TenderDocument_cloudinaryPublicId_key`(`cloudinaryPublicId`),
    INDEX `TenderDocument_tenderId_idx`(`tenderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TenderDocument` ADD CONSTRAINT `TenderDocument_tenderId_fkey` FOREIGN KEY (`tenderId`) REFERENCES `Tender`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
