-- Modify parameters prior to version 0.3.0
update `sys_params` set param_value = '.mp3;.wav;.p3' where param_code = 'plugins.play_music.music_ext';
update `ai_model_config` set config_json = '{\"type\": \"intent_llm\", \"llm\": \"LLM_ChatGLMLLM\"}' where id = 'Intent_intent_llm';

-- Add edge voices
delete from `ai_tts_voice` where tts_model_id = 'TTS_EdgeTTS';
INSERT INTO `ai_tts_voice` VALUES 
('TTS_EdgeTTS0001', 'TTS_EdgeTTS', 'Xiaoxiao (Female)', 'zh-CN-XiaoxiaoNeural', 'Mandarin', NULL, NULL, 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0002', 'TTS_EdgeTTS', 'Yunyang (Male)', 'zh-CN-YunyangNeural', 'Mandarin', NULL, NULL, 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0003', 'TTS_EdgeTTS', 'Xiaoyi (Female)', 'zh-CN-XiaoyiNeural', 'Mandarin', NULL, NULL, 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0004', 'TTS_EdgeTTS', 'Yunjian (Male)', 'zh-CN-YunjianNeural', 'Mandarin', NULL, NULL, 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0005', 'TTS_EdgeTTS', 'Yunxi (Male)', 'zh-CN-YunxiNeural', 'Mandarin', NULL, NULL, 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0006', 'TTS_EdgeTTS', 'Yunxia (Male)', 'zh-CN-YunxiaNeural', 'Mandarin', NULL, NULL, 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0007', 'TTS_EdgeTTS', 'LN Xiaobei (Female)', 'zh-CN-liaoning-XiaobeiNeural', 'Liaoning', NULL, NULL, 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0008', 'TTS_EdgeTTS', 'SX Xiaoni (Female)', 'zh-CN-shaanxi-XiaoniNeural', 'Shaanxi', NULL, NULL, 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0009', 'TTS_EdgeTTS', 'HK Haijia (Female)', 'zh-HK-HiuGaaiNeural', 'Cantonese', 'General', 'Friendly, Positive', 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0010', 'TTS_EdgeTTS', 'HK Haiman (Female)', 'zh-HK-HiuMaanNeural', 'Cantonese', 'General', 'Friendly, Positive', 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0011', 'TTS_EdgeTTS', 'HK Wanlong (Male)', 'zh-HK-WanLungNeural', 'Cantonese', 'General', 'Friendly, Positive', 1, NULL, NULL, NULL, NULL);

-- Add parameter for whether user registration is allowed
delete from `sys_params` where id in (103,104);
INSERT INTO `sys_params` (id, param_code, param_value, value_type, param_type, remark) VALUES (103, 'server.allow_user_register', 'false', 'boolean', 1, 'Whether to allow registration for non-admin users');
INSERT INTO `sys_params` (id, param_code, param_value, value_type, param_type, remark) VALUES (104, 'server.fronted_url', 'http://xiaozhi.server.com', 'string', 1, 'Control panel URL displayed when sending 6-digit verification code');

-- Fix CosyVoiceSiliconflow voice
delete from `ai_tts_voice` where tts_model_id = 'TTS_CosyVoiceSiliconflow';
INSERT INTO `ai_tts_voice` VALUES ('TTS_CosyVoiceSiliconflow0001', 'TTS_CosyVoiceSiliconflow', 'CosyVoice Male', 'FunAudioLLM/CosyVoice2-0.5B:alex', 'Chinese', 'https://example.com/cosyvoice/alex.mp3', NULL, 6, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_CosyVoiceSiliconflow0002', 'TTS_CosyVoiceSiliconflow', 'CosyVoice Female', 'FunAudioLLM/CosyVoice2-0.5B:bella', 'Chinese', 'https://example.com/cosyvoice/bella.mp3', NULL, 6, NULL, NULL, NULL, NULL);
