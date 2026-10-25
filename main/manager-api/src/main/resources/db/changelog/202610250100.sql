-- TinyBot is sold in Bangladesh: make Bangladesh (+880) the first and default mobile area.
-- Remove the China-centric areas seeded by 202505182234.sql (Mainland China, Hong Kong, Macau, Taiwan).
DELETE FROM `sys_dict_data`
WHERE `dict_type_id` = 102
  AND `dict_value` IN ('+86', '+852', '+853', '+886');

-- Ensure Bangladesh exists (it is seeded as 102027, but may have been removed by an admin)
INSERT INTO `sys_dict_data` (`id`, `dict_type_id`, `dict_label`, `dict_value`, `remark`, `sort`, `creator`, `create_date`, `updater`, `update_date`)
SELECT 102027, 102, 'Bangladesh', '+880', 'Bangladesh', 1, 1, NOW(), 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `dict_type_id` = 102 AND `dict_value` = '+880')
  AND NOT EXISTS (SELECT 1 FROM `sys_dict_data` WHERE `id` = 102027);

-- Bangladesh sorts first (the list is read ORDER BY sort ASC; clients show the first entry first)
UPDATE `sys_dict_data`
SET `dict_label` = 'Bangladesh', `remark` = 'Bangladesh', `sort` = 1, `update_date` = NOW()
WHERE `dict_type_id` = 102 AND `dict_value` = '+880';

UPDATE `sys_dict_data`
SET `sort` = `sort` + 1
WHERE `dict_type_id` = 102 AND `dict_value` <> '+880' AND `sort` <= 1;

-- ICP / public-security filing numbers are Chinese legal filings and do not apply in Bangladesh.
-- Keep the params (the code and /user/pub-config still read them) but force them to 'null'.
UPDATE `sys_params` SET `param_value` = 'null'
WHERE `param_code` IN ('server.beian_icp_num', 'server.beian_ga_num');

-- SMS goes through REVE SMS (Bangladesh) instead of Alibaba Cloud. The key, secret and sender ID
-- are filled in by an admin on the params page; nothing secret lives in this file.
DELETE FROM `sys_params` WHERE `param_code` LIKE 'aliyun.sms.%';
DELETE FROM `sys_params` WHERE `id` IN (620, 621, 622, 623, 624);
INSERT INTO `sys_params` (id, param_code, param_value, value_type, param_type, remark) VALUES
(620, 'reve.sms.base_url', 'https://smpp.revesms.com:7790', 'string', 1, 'REVE SMS gateway address'),
(621, 'reve.sms.api_key', '', 'string', 1, 'REVE SMS API key'),
(622, 'reve.sms.secret_key', '', 'string', 1, 'REVE SMS secret key'),
(623, 'reve.sms.caller_id', '', 'string', 1, 'REVE SMS sender ID (callerID)'),
(624, 'reve.sms.code_message', 'আপনার টাইনিবট যাচাই কোড {code}। কোডটি কাউকে জানাবেন না।', 'string', 1, 'Verification SMS text; {code} is the code');
