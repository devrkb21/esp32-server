-- Add LinkeraiTTS provider and model configuration
delete from `ai_model_provider` where id = 'SYSTEM_TTS_LinkeraiTTS';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_TTS_LinkeraiTTS', 'TTS', 'linkerai', 'Linkerai Speech Synthesis', '[{"key":"api_url","label":"API Address","type":"string"},{"key":"audio_format","label":"Audio format","type":"string"},{"key":"access_token","label":"Access Token","type":"string"},{"key":"voice","label":"Default voice","type":"string"}]', 14, 1, NOW(), 1, NOW());

delete from `ai_model_config` where id = 'TTS_LinkeraiTTS';
INSERT INTO `ai_model_config` VALUES ('TTS_LinkeraiTTS', 'TTS', 'LinkeraiTTS', 'Linkerai Speech Synthesis', 0, 1, '{\"type\": \"linkerai\", \"api_url\": \"https://tts.linkerai.cn/tts\", \"audio_format\": \"pcm\", \"access_token\": \"U4YdYXVfpwWnk2t5Gp822zWPCuORyeJL\", \"voice\": \"OUeAo1mhq6IBExi\"}', NULL, NULL, 17, NULL, NULL, NULL, NULL);

-- Linkerai TTS model configuration documentation
UPDATE `ai_model_config` SET 
`doc_link` = 'https://tts.linkerai.cn/docs',
`remark` = 'Linkerai Speech SynthesisServiceConfiguration Instructions:
1. Visit https://linkerai.cn Register and obtain access token
2. Defaultaccess_tokenFor testing purposes, Do not use for commercial purposes
3. SupportsVoiceClone Function, Can upload audio yourself, Fill invoiceParameters
4. IfvoiceParameter is empty, will use defaultVoice' WHERE `id` = 'TTS_LinkeraiTTS';


delete from `ai_tts_voice` where tts_model_id = 'TTS_LinkeraiTTS';
INSERT INTO `ai_tts_voice` VALUES ('TTS_LinkeraiTTS_0001', 'TTS_LinkeraiTTS', 'Zhiruo', 'OUeAo1mhq6IBExi', 'English', NULL, NULL, 1, NULL, NULL, NULL, NULL);
