-- Smart home (module `home`): one integration row per user (Home Assistant base URL + long-lived
-- access token, and an optional MQTT broker), and the devices the robot may switch by voice.
-- Secrets (ha_token, mqtt_password) are stored encrypted (AES-GCM, see HomeSecretBox) and are
-- never sent back to the apps: they only learn whether one is saved.
CREATE TABLE IF NOT EXISTS `ai_home_integration` (
  `id`            bigint NOT NULL COMMENT 'id',
  `user_id`       bigint NOT NULL COMMENT 'Owner (sys_user.id)',
  `ha_base_url`   varchar(300) DEFAULT NULL COMMENT 'Home Assistant base URL, e.g. http://192.168.0.50:8123',
  `ha_token`      text COMMENT 'Home Assistant long-lived access token (encrypted)',
  `mqtt_host`     varchar(200) DEFAULT NULL COMMENT 'MQTT broker host',
  `mqtt_port`     int DEFAULT NULL COMMENT 'MQTT broker port (1883, 8883 with TLS)',
  `mqtt_username` varchar(200) DEFAULT NULL COMMENT 'MQTT user name',
  `mqtt_password` text COMMENT 'MQTT password (encrypted)',
  `mqtt_tls`      tinyint NOT NULL DEFAULT 0 COMMENT 'Connect to the broker with TLS',
  `creator`       bigint DEFAULT NULL COMMENT 'Creator',
  `create_date`   datetime DEFAULT NULL COMMENT 'Create time',
  `updater`       bigint DEFAULT NULL COMMENT 'Updater',
  `update_date`   datetime DEFAULT NULL COMMENT 'Update time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_home_integration_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COMMENT='Smart home integration per user';

CREATE TABLE IF NOT EXISTS `ai_home_device` (
  `id`          bigint NOT NULL COMMENT 'id',
  `user_id`     bigint NOT NULL COMMENT 'Owner (sys_user.id)',
  `source`      varchar(10) NOT NULL COMMENT 'ha (Home Assistant entity) or mqtt (generic MQTT device)',
  `entity_id`   varchar(200) DEFAULT NULL COMMENT 'Home Assistant entity id, e.g. light.living_room',
  `domain`      varchar(20) NOT NULL COMMENT 'light, switch, fan, climate or cover',
  `name`        varchar(100) NOT NULL COMMENT 'Friendly name',
  `aliases`     text COMMENT 'JSON array of extra names the robot understands (Bangla or English)',
  `topic`       varchar(300) DEFAULT NULL COMMENT 'MQTT command topic',
  `payload_on`  varchar(200) DEFAULT NULL COMMENT 'MQTT payload for on',
  `payload_off` varchar(200) DEFAULT NULL COMMENT 'MQTT payload for off',
  `enabled`     tinyint NOT NULL DEFAULT 1 COMMENT 'Usable by voice',
  `sort`        int unsigned DEFAULT 0 COMMENT 'Sort order',
  `creator`     bigint DEFAULT NULL COMMENT 'Creator',
  `create_date` datetime DEFAULT NULL COMMENT 'Create time',
  `updater`     bigint DEFAULT NULL COMMENT 'Updater',
  `update_date` datetime DEFAULT NULL COMMENT 'Update time',
  PRIMARY KEY (`id`),
  KEY `idx_home_device_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COMMENT='Smart home devices per user';
