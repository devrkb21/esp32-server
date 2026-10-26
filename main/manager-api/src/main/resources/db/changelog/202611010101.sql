-- TinyBot special days (VOICE): the admin's dated list of Eid ul-Fitr, Eid ul-Adha and custom
-- days, read by xiaozhi-server (GET /config/calendar-days). Nothing is seeded: lunar dates are
-- only what an admin enters. The fixed national days live in xiaozhi-server (calendar_days.py).
CREATE TABLE IF NOT EXISTS `ai_calendar_day` (
  `id`          bigint NOT NULL COMMENT 'id',
  `day_date`    date NOT NULL COMMENT 'The day',
  `day_key`     varchar(32) NOT NULL COMMENT 'eid_ul_fitr, eid_ul_adha or custom',
  `name_bn`     varchar(64) DEFAULT NULL COMMENT 'Name (Bangla)',
  `name_en`     varchar(64) DEFAULT NULL COMMENT 'Name (English)',
  `creator`     bigint DEFAULT NULL,
  `create_date` datetime DEFAULT NULL,
  `updater`     bigint DEFAULT NULL,
  `update_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_day_date` (`day_date`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COMMENT='TinyBot special days (admin list)';

-- Product feature keys of this wave (VOICE) on the TinyBot product, each added once
UPDATE `ai_product` SET `features` = JSON_ARRAY_APPEND(`features`, '$', 'voice_timers')
WHERE `product_key` = 'tinybot' AND JSON_VALID(`features`) AND NOT JSON_CONTAINS(`features`, '"voice_timers"');
UPDATE `ai_product` SET `features` = JSON_ARRAY_APPEND(`features`, '$', 'routines')
WHERE `product_key` = 'tinybot' AND JSON_VALID(`features`) AND NOT JSON_CONTAINS(`features`, '"routines"');
UPDATE `ai_product` SET `features` = JSON_ARRAY_APPEND(`features`, '$', 'library')
WHERE `product_key` = 'tinybot' AND JSON_VALID(`features`) AND NOT JSON_CONTAINS(`features`, '"library"');
UPDATE `ai_product` SET `features` = JSON_ARRAY_APPEND(`features`, '$', 'special_days')
WHERE `product_key` = 'tinybot' AND JSON_VALID(`features`) AND NOT JSON_CONTAINS(`features`, '"special_days"');
