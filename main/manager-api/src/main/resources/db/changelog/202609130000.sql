-- Auto-seed system parameters for esp.czbd.app and direct public IP for device ports (MQTT, UDP, WS)
-- ==============================================================================================

-- 1. Update existing parameters to production values
UPDATE `sys_params` SET `param_value` = 'https://esp.czbd.app' WHERE `param_code` = 'server.fronted_url';
UPDATE `sys_params` SET `param_value` = 'https://esp.czbd.app' WHERE `param_code` = 'server.ota';
UPDATE `sys_params` SET `param_value` = 'ws://13.201.26.73:18000/xiaozhi/v1/;wss://esp.czbd.app/ws' WHERE `param_code` = 'server.websocket';
UPDATE `sys_params` SET `param_value` = '13.201.26.73:1883' WHERE `param_code` = 'server.mqtt_gateway';
UPDATE `sys_params` SET `param_value` = '13.201.26.73:8884' WHERE `param_code` = 'server.udp_gateway';
UPDATE `sys_params` SET `param_value` = 'SecureEspMqttKey2026' WHERE `param_code` = 'server.mqtt_signature_key';
UPDATE `sys_params` SET `param_value` = 'xiaozhi-esp32-server-mqtt:8007' WHERE `param_code` = 'server.mqtt_manager_api';
UPDATE `sys_params` SET `param_value` = '19252d23-9d4b-4215-93e7-f81f26c0e11d' WHERE `param_code` = 'server.secret';
UPDATE `sys_params` SET `param_value` = 'http://xiaozhi-esp32-server-voiceprint:8005/voiceprint/health?key=7a8b9c0d-1e2f-4a5b-8c9d-0e1f2a3b4c5d' WHERE `param_code` = 'server.voice_print';
UPDATE `sys_params` SET `param_value` = '0.4' WHERE `param_code` = 'server.voiceprint_similarity_threshold';
UPDATE `sys_params` SET `param_value` = 'http://13.201.26.73:18003/mcp/vision/explain' WHERE `param_code` = 'server.vision_explain';
UPDATE `sys_params` SET `param_value` = 'http://13.201.26.73:18003/mcp/' WHERE `param_code` = 'server.mcp_endpoint';
UPDATE `sys_params` SET `param_value` = 'Xiaozhi AI Server' WHERE `param_code` = 'server.name';
UPDATE `sys_params` SET `param_value` = 'true' WHERE `param_code` = 'server.auth.enabled';

-- 2. Insert any missing parameters (ensuring clean fresh database creation)
INSERT IGNORE INTO `sys_params` (`id`, `param_code`, `param_value`, `value_type`, `param_type`, `remark`) VALUES
(104, 'server.fronted_url', 'https://esp.czbd.app', 'string', 1, 'Control panel URL displayed when sending 6-digit verification code'),
(107, 'server.ota', 'https://esp.czbd.app', 'string', 1, 'OTA Server Address'),
(106, 'server.websocket', 'ws://13.201.26.73:18000/xiaozhi/v1/;wss://esp.czbd.app/ws', 'string', 1, 'WebSocket addresses, separated by semicolon'),
(116, 'server.mqtt_gateway', '13.201.26.73:1883', 'string', 1, 'MQTT gateway configuration'),
(118, 'server.udp_gateway', '13.201.26.73:8884', 'string', 1, 'UDP gateway configuration'),
(117, 'server.mqtt_signature_key', 'SecureEspMqttKey2026', 'string', 1, 'MQTT Secret Key Configuration'),
(119, 'server.mqtt_manager_api', 'xiaozhi-esp32-server-mqtt:8007', 'string', 1, 'MQTT gateway management API address'),
(102, 'server.secret', '19252d23-9d4b-4215-93e7-f81f26c0e11d', 'string', 1, 'Server Secret Key'),
(114, 'server.voice_print', 'http://xiaozhi-esp32-server-voiceprint:8005/voiceprint/health?key=7a8b9c0d-1e2f-4a5b-8c9d-0e1f2a3b4c5d', 'string', 1, 'Voiceprint API address'),
(115, 'server.voiceprint_similarity_threshold', '0.4', 'string', 1, 'Voiceprint similarity threshold'),
(180, 'server.vision_explain', 'http://13.201.26.73:18003/mcp/vision/explain', 'string', 1, 'Vision analysis interface URL sent to device'),
(113, 'server.mcp_endpoint', 'http://13.201.26.73:18003/mcp/', 'string', 1, 'MCP Endpoint Address'),
(108, 'server.name', 'Xiaozhi AI Server', 'string', 1, 'System Name');
