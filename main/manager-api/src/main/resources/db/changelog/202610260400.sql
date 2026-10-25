-- The companion API base the robot is told in every OTA reply (`companion.url`). A factory-erased
-- robot only knows the OTA host (manager-api), while the companion API lives on xiaozhi-server's
-- HTTP port (LAN: http://<pc>:8003; Docker all-in-one: the public host + VISION_PORT).
-- 'null' (the default): derive it from server.vision_explain (scheme, host and port).
INSERT INTO `sys_params` (`id`, `param_code`, `param_value`, `value_type`, `param_type`, `remark`)
SELECT 631, 'server.companion_url', 'null', 'string', 1, 'Companion API base URL sent to the robot in the OTA reply, without a trailing slash (e.g. http://192.168.0.123:8003). null: use the scheme, host and port of server.vision_explain'
WHERE NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `param_code` = 'server.companion_url')
  AND NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `id` = 631);
