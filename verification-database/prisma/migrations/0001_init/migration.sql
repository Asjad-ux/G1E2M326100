CREATE TABLE `VerificationEntities` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entity_type` ENUM('PERSON', 'COMPANY') NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `date_of_birth` DATE NULL,
  `date_of_incorporation` DATE NULL,
  `address` VARCHAR(255) NOT NULL,
  `city` VARCHAR(80) NOT NULL,
  `state` VARCHAR(80) NOT NULL,
  `pincode` CHAR(6) NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `VerificationEntities_entity_type_idx` (`entity_type`),
  INDEX `VerificationEntities_status_idx` (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AadhaarRecords` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entity_id` INTEGER NOT NULL,
  `aadhaar_number` CHAR(12) NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AadhaarRecords_aadhaar_number_key` (`aadhaar_number`),
  INDEX `AadhaarRecords_entity_id_idx` (`entity_id`),
  CONSTRAINT `AadhaarRecords_entity_id_fkey`
    FOREIGN KEY (`entity_id`) REFERENCES `VerificationEntities` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GSTRecords` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entity_id` INTEGER NOT NULL,
  `gstin` CHAR(15) NOT NULL,
  `legal_name` VARCHAR(180) NOT NULL,
  `trade_name` VARCHAR(180) NOT NULL,
  `registration_date` DATE NOT NULL,
  `status` ENUM('ACTIVE', 'CANCELLED', 'SUSPENDED') NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `GSTRecords_gstin_key` (`gstin`),
  INDEX `GSTRecords_entity_id_idx` (`entity_id`),
  INDEX `GSTRecords_status_idx` (`status`),
  CONSTRAINT `GSTRecords_entity_id_fkey`
    FOREIGN KEY (`entity_id`) REFERENCES `VerificationEntities` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CINRecords` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entity_id` INTEGER NOT NULL,
  `cin` CHAR(21) NOT NULL,
  `company_name` VARCHAR(180) NOT NULL,
  `incorporation_date` DATE NOT NULL,
  `company_status` ENUM('ACTIVE', 'INACTIVE', 'STRUCK_OFF') NOT NULL,
  `registered_address` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CINRecords_cin_key` (`cin`),
  INDEX `CINRecords_entity_id_idx` (`entity_id`),
  INDEX `CINRecords_company_status_idx` (`company_status`),
  CONSTRAINT `CINRecords_entity_id_fkey`
    FOREIGN KEY (`entity_id`) REFERENCES `VerificationEntities` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MSMERecords` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entity_id` INTEGER NOT NULL,
  `udyam_number` VARCHAR(20) NOT NULL,
  `enterprise_name` VARCHAR(180) NOT NULL,
  `organisation_type` VARCHAR(80) NOT NULL,
  `major_activity` VARCHAR(120) NOT NULL,
  `registration_date` DATE NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MSMERecords_udyam_number_key` (`udyam_number`),
  INDEX `MSMERecords_entity_id_idx` (`entity_id`),
  INDEX `MSMERecords_status_idx` (`status`),
  CONSTRAINT `MSMERecords_entity_id_fkey`
    FOREIGN KEY (`entity_id`) REFERENCES `VerificationEntities` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PhoneRecords` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entity_id` INTEGER NOT NULL,
  `phone_number` VARCHAR(15) NOT NULL,
  `phone_type` ENUM('MOBILE', 'LANDLINE') NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PhoneRecords_phone_number_key` (`phone_number`),
  INDEX `PhoneRecords_entity_id_idx` (`entity_id`),
  CONSTRAINT `PhoneRecords_entity_id_fkey`
    FOREIGN KEY (`entity_id`) REFERENCES `VerificationEntities` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EmailRecords` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entity_id` INTEGER NOT NULL,
  `email` VARCHAR(320) NOT NULL,
  `email_type` ENUM('PERSONAL', 'BUSINESS') NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `EmailRecords_email_key` (`email`),
  INDEX `EmailRecords_entity_id_idx` (`entity_id`),
  CONSTRAINT `EmailRecords_entity_id_fkey`
    FOREIGN KEY (`entity_id`) REFERENCES `VerificationEntities` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

