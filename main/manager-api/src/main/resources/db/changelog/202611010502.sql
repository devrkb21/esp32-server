-- The server's public IP is now 138.252.31.246 (was 13.201.26.73, seeded by 202609130000).
-- That changelog has already run on existing databases, so its values are moved here instead of
-- edited there (an edited changeset fails Liquibase's checksum check).
UPDATE `sys_params`
SET `param_value` = REPLACE(`param_value`, '13.201.26.73', '138.252.31.246')
WHERE `param_value` LIKE '%13.201.26.73%';
