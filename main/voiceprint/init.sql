-- Create Voiceprint database and table if not exists
CREATE DATABASE IF NOT EXISTS `voiceprint_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `voiceprint_db`.`voiceprints` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `speaker_id` VARCHAR(255) NOT NULL UNIQUE,
    `feature_vector` LONGBLOB NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_speaker_id` (`speaker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
