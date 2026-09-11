-- Modify parameters prior to version 0.3.0
update `sys_params` set param_value = '.mp3;.wav;.p3' where param_code = 'plugins.play_music.music_ext';
update `ai_model_config` set config_json = '{\"type\": \"intent_llm\", \"llm\": \"LLM_ChatGLMLLM\"}' where id = 'Intent_intent_llm';

-- Add edge voices
delete from `ai_tts_voice` where tts_model_id = 'TTS_EdgeTTS';
INSERT INTO `ai_tts_voice` VALUES 
('TTS_EdgeTTS0001', 'TTS_EdgeTTS', 'Jenny (US Female)', 'en-US-JennyNeural', 'English', NULL, NULL, 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0002', 'TTS_EdgeTTS', 'Guy (US Male)', 'en-US-GuyNeural', 'English', NULL, NULL, 2, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0003', 'TTS_EdgeTTS', 'Aria (US Female)', 'en-US-AriaNeural', 'English', NULL, NULL, 3, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0004', 'TTS_EdgeTTS', 'Christopher (US)', 'en-US-ChristopherNeural', 'English', NULL, NULL, 4, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0005', 'TTS_EdgeTTS', 'Sonia (UK Female)', 'en-GB-SoniaNeural', 'English', NULL, NULL, 5, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0006', 'TTS_EdgeTTS', 'Ryan (UK Male)', 'en-GB-RyanNeural', 'English', NULL, NULL, 6, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0007', 'TTS_EdgeTTS', 'Ana (US Child)', 'en-US-AnaNeural', 'English', NULL, NULL, 7, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0008', 'TTS_EdgeTTS', 'Eric (US Male)', 'en-US-EricNeural', 'English', NULL, NULL, 8, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0009', 'TTS_EdgeTTS', 'Michelle (US)', 'en-US-MichelleNeural', 'English', NULL, NULL, 9, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0010', 'TTS_EdgeTTS', 'Nabanita (BD Female)', 'bn-BD-NabanitaNeural', 'Bengali', NULL, NULL, 10, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0011', 'TTS_EdgeTTS', 'Pradeep (BD Male)', 'bn-BD-PradeepNeural', 'Bengali', NULL, NULL, 11, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0012', 'TTS_EdgeTTS', 'Tanishaa (IN Female)', 'bn-IN-TanishaaNeural', 'Bengali', NULL, NULL, 12, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0013', 'TTS_EdgeTTS', 'Bashkar (IN Male)', 'bn-IN-BashkarNeural', 'Bengali', NULL, NULL, 13, NULL, NULL, NULL, NULL);

-- Add parameter for whether user registration is allowed
delete from `sys_params` where id in (103,104);
INSERT INTO `sys_params` (id, param_code, param_value, value_type, param_type, remark) VALUES (103, 'server.allow_user_register', 'false', 'boolean', 1, 'Whether to allow registration for non-admin users');
INSERT INTO `sys_params` (id, param_code, param_value, value_type, param_type, remark) VALUES (104, 'server.fronted_url', 'http://xiaozhi.server.com', 'string', 1, 'Control panel URL displayed when sending 6-digit verification code');

-- Fix CosyVoiceSiliconflow voice
delete from `ai_tts_voice` where tts_model_id = 'TTS_CosyVoiceSiliconflow';
INSERT INTO `ai_tts_voice` VALUES ('TTS_CosyVoiceSiliconflow0001', 'TTS_CosyVoiceSiliconflow', 'CosyVoice Male', 'FunAudioLLM/CosyVoice2-0.5B:alex', 'English', 'https://example.com/cosyvoice/alex.mp3', NULL, 6, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_CosyVoiceSiliconflow0002', 'TTS_CosyVoiceSiliconflow', 'CosyVoice Female', 'FunAudioLLM/CosyVoice2-0.5B:bella', 'English', 'https://example.com/cosyvoice/bella.mp3', NULL, 6, NULL, NULL, NULL, NULL);
