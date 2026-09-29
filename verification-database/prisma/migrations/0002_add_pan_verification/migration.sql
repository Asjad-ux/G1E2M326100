CREATE TABLE `PanVerifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pan_number` CHAR(10) NOT NULL,
    `pan_name` VARCHAR(180) NOT NULL,
    `father_name` VARCHAR(180) NOT NULL,
    `date_of_birth` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `PanVerifications_pan_number_key` (`pan_number`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
