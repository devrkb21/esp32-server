-- English firmware builds (upstream xiaozhi-esp32 >= 2.5.3) use the "Hi ESP" wake word.
UPDATE `sys_params`
SET `param_value` = CONCAT(`param_value`, ';Hi ESP')
WHERE `param_code` = 'wakeup_words'
  AND `param_value` IS NOT NULL AND `param_value` <> ''
  AND FIND_IN_SET('Hi ESP', REPLACE(`param_value`, ';', ',')) = 0;
