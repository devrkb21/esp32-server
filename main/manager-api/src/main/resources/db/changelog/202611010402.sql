-- Product feature keys of this wave (HOME): smart_home (voice control of Home Assistant / MQTT
-- devices) and robot_messages (robot-to-robot voice messages). TinyBot gets both.
UPDATE `ai_product`
SET `features` = JSON_ARRAY_APPEND(`features`, '$', 'smart_home')
WHERE `product_key` = 'tinybot' AND JSON_VALID(`features`)
  AND NOT JSON_CONTAINS(`features`, '"smart_home"');

UPDATE `ai_product`
SET `features` = JSON_ARRAY_APPEND(`features`, '$', 'robot_messages')
WHERE `product_key` = 'tinybot' AND JSON_VALID(`features`)
  AND NOT JSON_CONTAINS(`features`, '"robot_messages"');
