-- TinyBot firmware sends the esp-sr wake word "你好小智" (WN9_NIHAOXIAOZHI_TTS) in the listen
-- "detect" message. Add it (and its pinyin) to the wake word list so it is treated as a wake word
-- (greeting / cached reply) instead of being sent to the LLM as a question.
UPDATE `sys_params`
SET `param_value` = CONCAT(`param_value`, ';你好小智')
WHERE `param_code` = 'wakeup_words'
  AND `param_value` IS NOT NULL AND `param_value` <> ''
  AND FIND_IN_SET('你好小智', REPLACE(`param_value`, ';', ',')) = 0;

UPDATE `sys_params`
SET `param_value` = CONCAT(`param_value`, ';nihaoxiaozhi')
WHERE `param_code` = 'wakeup_words'
  AND `param_value` IS NOT NULL AND `param_value` <> ''
  AND FIND_IN_SET('nihaoxiaozhi', REPLACE(`param_value`, ';', ',')) = 0;
