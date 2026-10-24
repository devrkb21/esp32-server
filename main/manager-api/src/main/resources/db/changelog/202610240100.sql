-- TinyBot firmware can be published in OTA management (type "tinybot", the BOARD_TYPE the robot
-- reports), so robots update wirelessly (xiaozhi-esp32 updater/README.md)
INSERT INTO `sys_dict_data` (`id`, `dict_type_id`, `dict_label`, `dict_value`, `remark`, `sort`, `creator`, `create_date`, `updater`, `update_date`)
SELECT 101100, 101, 'TinyBot (ESP32-S3 SuperMini)', 'tinybot', 'TinyBot companion robot', 0, 1, NOW(), 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type_id` = 101 AND `dict_value` = 'tinybot');
