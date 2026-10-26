-- Robot-to-robot voice messages (module `contacts`). Robots of the same user may always message
-- each other; robots of different accounts need a contact: one owner asks (from one of their
-- robots, to another account by user name), the other owner accepts with one of theirs.
-- Each side keeps its own name (and aliases) for the other robot, e.g. "বাবার রোবট".
CREATE TABLE IF NOT EXISTS `ai_robot_contact` (
  `id`             bigint NOT NULL COMMENT 'id',
  `from_user_id`   bigint NOT NULL COMMENT 'Owner who asked',
  `from_device_id` varchar(64) NOT NULL COMMENT 'The asking owner''s robot (ai_device.id)',
  `to_user_id`     bigint NOT NULL COMMENT 'Owner who was asked',
  `to_device_id`   varchar(64) DEFAULT NULL COMMENT 'The asked owner''s robot, chosen when accepting',
  `from_name`      varchar(64) NOT NULL COMMENT 'What the asking side calls the other robot',
  `from_aliases`   text COMMENT 'JSON array of extra names on the asking side',
  `to_name`        varchar(64) DEFAULT NULL COMMENT 'What the accepting side calls the asking robot',
  `to_aliases`     text COMMENT 'JSON array of extra names on the accepting side',
  `status`         varchar(10) NOT NULL DEFAULT 'pending' COMMENT 'pending, accepted or declined',
  `creator`        bigint DEFAULT NULL COMMENT 'Creator',
  `create_date`    datetime DEFAULT NULL COMMENT 'Create time',
  `updater`        bigint DEFAULT NULL COMMENT 'Updater',
  `update_date`    datetime DEFAULT NULL COMMENT 'Update time',
  PRIMARY KEY (`id`),
  KEY `idx_robot_contact_from` (`from_user_id`),
  KEY `idx_robot_contact_to` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COMMENT='Robot contacts for robot-to-robot messages';
