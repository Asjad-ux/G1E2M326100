-- AlterTable
ALTER TABLE `document` MODIFY `fileUrl` TEXT NOT NULL,
    MODIFY `cloudinaryUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `tenderdocument` MODIFY `cloudinaryUrl` TEXT NULL;
