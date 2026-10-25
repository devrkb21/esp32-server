-- Product catalog: one server platform runs several Nobix products (TinyBot today, more later).
-- A device reports its board type at OTA time (ai_device.board); the board is matched against
-- each enabled product's board_types patterns to decide which product (and which features) it is.
DROP TABLE IF EXISTS `ai_product`;
CREATE TABLE `ai_product` (
  `id`          bigint NOT NULL COMMENT 'id',
  `product_key` varchar(50) NOT NULL COMMENT 'Product key (lower case, e.g. tinybot)',
  `name_en`     varchar(100) NOT NULL COMMENT 'Name (English)',
  `name_bn`     varchar(100) DEFAULT NULL COMMENT 'Name (Bangla)',
  `description` varchar(500) DEFAULT NULL COMMENT 'Description',
  `icon_url`    varchar(500) DEFAULT NULL COMMENT 'Icon URL',
  `board_types` text COMMENT 'Comma-separated board type patterns; a trailing * is a prefix wildcard, * alone matches everything',
  `features`    text COMMENT 'JSON array of feature keys',
  `sort`        int unsigned DEFAULT 0 COMMENT 'Sort order',
  `status`      tinyint NOT NULL DEFAULT 1 COMMENT 'Status (0: disabled, 1: enabled)',
  `creator`     bigint DEFAULT NULL COMMENT 'Creator',
  `create_date` datetime DEFAULT NULL COMMENT 'Create time',
  `updater`     bigint DEFAULT NULL COMMENT 'Updater',
  `update_date` datetime DEFAULT NULL COMMENT 'Update time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_key` (`product_key`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COMMENT='Product catalog';

INSERT INTO `ai_product` (`id`, `product_key`, `name_en`, `name_bn`, `description`, `icon_url`, `board_types`, `features`, `sort`, `status`, `creator`, `create_date`, `updater`, `update_date`) VALUES
(1, 'tinybot', 'TinyBot', 'টাইনিবট', 'Desk companion robot', NULL, 'tinybot,tinybot-*',
 '["chat","character","voiceprint","chat_history","memory","companion","day","prayer","look","screen","messages","commands","proactive","firmware","pairing_pattern"]',
 1, 1, 1, NOW(), 1, NOW()),
(2, 'generic', 'Nobix device', 'নোবিক্স ডিভাইস', 'Fallback for devices that match no other product', NULL, '*',
 '["chat","character","voiceprint","chat_history","firmware"]',
 999, 1, 1, NOW(), 1, NOW());

-- Devices that have not reported a board yet resolve to this product (keeps existing TinyBots working).
INSERT INTO `sys_params` (`id`, `param_code`, `param_value`, `value_type`, `param_type`, `remark`)
SELECT 630, 'product.default_key', 'tinybot', 'string', 1, 'Product key used for devices that have not reported a board type yet'
WHERE NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `param_code` = 'product.default_key')
  AND NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `id` = 630);
