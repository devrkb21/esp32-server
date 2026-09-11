-- Migration 202609112000: Purge Chinese voices from database, enforce English and Bangla TTS voices, Gemini free-tier LLM default, and Khulna localization
-- ====================================================================================================================================================

-- 1. Completely purge any Chinese / Cantonese voices from ai_tts_voice
DELETE FROM `ai_tts_voice` WHERE `tts_voice` LIKE 'zh-%' OR `tts_voice` LIKE 'zh_%' OR `languages` IN ('Mandarin', 'Cantonese', 'Liaoning', 'Shaanxi', 'Chinese', '中文');

-- 2. Cleanly reset and populate ai_tts_voice for Edge TTS with English & Bangla voices
DELETE FROM `ai_tts_voice` WHERE `tts_model_id` = 'TTS_EdgeTTS';
INSERT INTO `ai_tts_voice` (`id`, `tts_model_id`, `name`, `tts_voice`, `languages`, `sort`) VALUES
('TTS_EdgeTTS0001', 'TTS_EdgeTTS', 'Jenny (US Female)', 'en-US-JennyNeural', 'English', 1),
('TTS_EdgeTTS0002', 'TTS_EdgeTTS', 'Guy (US Male)', 'en-US-GuyNeural', 'English', 2),
('TTS_EdgeTTS0003', 'TTS_EdgeTTS', 'Aria (US Female)', 'en-US-AriaNeural', 'English', 3),
('TTS_EdgeTTS0004', 'TTS_EdgeTTS', 'Christopher (US)', 'en-US-ChristopherNeural', 'English', 4),
('TTS_EdgeTTS0005', 'TTS_EdgeTTS', 'Sonia (UK Female)', 'en-GB-SoniaNeural', 'English', 5),
('TTS_EdgeTTS0006', 'TTS_EdgeTTS', 'Ryan (UK Male)', 'en-GB-RyanNeural', 'English', 6),
('TTS_EdgeTTS0007', 'TTS_EdgeTTS', 'Ana (US Child)', 'en-US-AnaNeural', 'English', 7),
('TTS_EdgeTTS0008', 'TTS_EdgeTTS', 'Eric (US Male)', 'en-US-EricNeural', 'English', 8),
('TTS_EdgeTTS0009', 'TTS_EdgeTTS', 'Michelle (US)', 'en-US-MichelleNeural', 'English', 9),
('TTS_EdgeTTS0010', 'TTS_EdgeTTS', 'Nabanita (BD Female)', 'bn-BD-NabanitaNeural', 'Bengali', 10),
('TTS_EdgeTTS0011', 'TTS_EdgeTTS', 'Pradeep (BD Male)', 'bn-BD-PradeepNeural', 'Bengali', 11),
('TTS_EdgeTTS_bn_001', 'TTS_EdgeTTS', 'Nabanita (BD Female)', 'bn-BD-NabanitaNeural', 'Bengali', 10),
('TTS_EdgeTTS_bn_002', 'TTS_EdgeTTS', 'Pradeep (BD Male)', 'bn-BD-PradeepNeural', 'Bengali', 11),
('TTS_EdgeTTS_bn_003', 'TTS_EdgeTTS', 'Tanishaa (IN Female)', 'bn-IN-TanishaaNeural', 'Bengali', 12),
('TTS_EdgeTTS_bn_004', 'TTS_EdgeTTS', 'Bashkar (IN Male)', 'bn-IN-BashkarNeural', 'Bengali', 13);

-- 3. Update Edge TTS model config to point to en-US-JennyNeural as default
UPDATE `ai_model_config` SET `config_json` = JSON_SET(`config_json`, '$.voice', 'en-US-JennyNeural'), `model_name` = 'Edge Speech Synthesis' WHERE `id` = 'TTS_EdgeTTS';

-- 4. Update LLM models: Gemini 2.0 Flash is default free-tier model
UPDATE `ai_model_config` SET `is_default` = 0 WHERE `id` = 'LLM_ChatGLMLLM';
UPDATE `ai_model_config` SET `is_default` = 1, `is_enabled` = 1, `sort` = 1, `model_name` = 'Google Gemini (Free Tier)' WHERE `id` = 'LLM_GeminiLLM';
UPDATE `ai_model_config` SET `is_enabled` = 1, `sort` = 2, `model_name` = 'DeepSeek' WHERE `id` = 'LLM_DeepSeekLLM';

-- Insert OpenAI GPT-4o-mini
INSERT INTO `ai_model_config` (`id`, `model_type`, `model_code`, `model_name`, `is_default`, `is_enabled`, `config_json`, `sort`, `remark`) VALUES
('LLM_OpenAILLM', 'LLM', 'openai', 'OpenAI GPT-4o-mini', 0, 1, '{"type": "openai", "model_name": "gpt-4o-mini", "base_url": "https://api.openai.com/v1", "api_key": "your_openai_api_key", "temperature": 0.7}', 3, 'OpenAI GPT-4o-mini model')
ON DUPLICATE KEY UPDATE `model_name` = VALUES(`model_name`), `is_default` = 0, `is_enabled` = 1, `sort` = 3;

-- 5. FunASR speech recognition auto language
UPDATE `ai_model_config` SET `config_json` = JSON_SET(`config_json`, '$.language', 'auto') WHERE `id` = 'ASR_FunASR';

-- 6. Enforce English and Jenny Neural voice across all existing agents & templates
UPDATE `ai_agent` SET
  `agent_name` = 'Xiaozhi',
  `lang_code` = 'en',
  `language` = 'English',
  `tts_language` = 'English',
  `tts_voice_id` = 'TTS_EdgeTTS0001',
  `llm_model_id` = 'LLM_GeminiLLM';

UPDATE `ai_agent_template` SET
  `lang_code` = 'en',
  `language` = 'English',
  `tts_language` = 'English',
  `tts_voice_id` = 'TTS_EdgeTTS0001',
  `llm_model_id` = 'LLM_GeminiLLM';

-- 7. System parameters: English wake words, Khulna weather location, Bangladeshi news RSS
UPDATE `sys_params` SET `param_value` = 'Hello Xiaozhi;Hey Xiaozhi;Hi Xiaozhi;Hello Assistant;Hey Computer;Xiaozhi' WHERE `param_code` = 'wakeup_words';
UPDATE `sys_params` SET `param_value` = 'Stop;Cancel;Bye;Goodbye;Quiet;Shut down;Exit;Close' WHERE `param_code` = 'exit_commands';
UPDATE `sys_params` SET `param_value` = 'I am experiencing a momentary connection issue. Please try again in a moment.' WHERE `param_code` = 'system_error_response';
UPDATE `sys_params` SET `param_value` = 'Khulna' WHERE `param_code` = 'plugins.get_weather.default_location';
UPDATE `sys_params` SET `param_value` = 'https://www.thedailystar.net/news/bangladesh/rss.xml' WHERE `param_code` = 'plugins.get_news.default_rss_url';
UPDATE `sys_params` SET `param_value` = '{"bangladesh":"https://www.thedailystar.net/news/bangladesh/rss.xml","world":"https://www.thedailystar.net/news/world/rss.xml","business":"https://www.thedailystar.net/business/rss.xml","technology":"https://feeds.bbci.co.uk/news/technology/rss.xml"}' WHERE `param_code` = 'plugins.get_news.category_urls';
