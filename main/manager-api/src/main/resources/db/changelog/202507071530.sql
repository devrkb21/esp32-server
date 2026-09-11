-- Add Aliyun streaming TTS provider
delete from `ai_model_provider` where id = 'SYSTEM_TTS_AliyunStreamTTS';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_TTS_AliyunStreamTTS', 'TTS', 'aliyun_stream', 'Aliyun Speech Synthesis (Streaming)', '[{"key":"appkey","label":"App Key","type":"string"},{"key":"token","label":"Temporary Token","type":"string"},{"key":"access_key_id","label":"AccessKey ID","type":"string"},{"key":"access_key_secret","label":"AccessKey Secret","type":"string"},{"key":"host","label":"Service address","type":"string"},{"key":"voice","label":"Default voice","type":"string"},{"key":"format","label":"Audio format","type":"string"},{"key":"sample_rate","label":"Sample rate","type":"number"},{"key":"volume","label":"Volume","type":"number"},{"key":"speech_rate","label":"Speech rate","type":"number"},{"key":"pitch_rate","label":"Pitch","type":"number"},{"key":"output_dir","label":"Output directory","type":"string"}]', 15, 1, NOW(), 1, NOW());

-- Add Aliyun streaming TTS model configuration
delete from `ai_model_config` where id = 'TTS_AliyunStreamTTS';
INSERT INTO `ai_model_config` VALUES ('TTS_AliyunStreamTTS', 'TTS', 'AliyunStreamTTS', 'Aliyun Speech Synthesis (Streaming)', 0, 1, '{\"type\": \"aliyun_stream\", \"appkey\": \"\", \"token\": \"\", \"access_key_id\": \"\", \"access_key_secret\": \"\", \"host\": \"nls-gateway-cn-beijing.aliyuncs.com\", \"voice\": \"longxiaochun\", \"format\": \"pcm\", \"sample_rate\": 16000, \"volume\": 50, \"speech_rate\": 0, \"pitch_rate\": 0, \"output_dir\": \"tmp/\"}', NULL, NULL, 18, NULL, NULL, NULL, NULL);

-- Update Aliyun streaming TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://nls-portal.console.aliyun.com/',
`remark` = 'Aliyun Streaming TTSConfiguration Instructions:
1. Alibaba CloudTTSand Alibaba Cloud(Streaming)TTSThe difference is: Alibaba CloudTTSis one-off synthesis, Alibaba Cloud(Streaming)TTSis real-time streaming synthesis
2. StreamingTTSHas lower latency and better real-time responsiveness, Suitable for voice interaction scenarios
3. Need to create an application in Aliyun Intelligent Speech Interaction console and obtain credentials
4. SupportsCosyVoiceLarge ModelVoice, Sound quality is more natural
5. Supports real-time volume adjustment, Speech Rate, pitch and other parameters
Application Steps:
1. Visit https://nls-portal.console.aliyun.com/ Activate intelligent speech interaction service
2. Visit https://nls-portal.console.aliyun.com/applist create a project and obtainappkey
3. Visit https://nls-portal.console.aliyun.com/overview Obtain temporary token (or configureaccess_key_idandaccess_key_secretAuto obtain) 
4. For dynamic token management, configuring access_key_id and access_key_secret is recommended
5. Can select Beijing, Shanghai or other regional servers to optimize latency
6. voiceParameter supportsCosyVoiceLarge ModelVoice, such aslongxiaochun, longyueyueetc
For more parameter configurations, please refer to: https://help.aliyun.com/zh/isi/developer-reference/real-time-speech-synthesis
' WHERE `id` = 'TTS_AliyunStreamTTS';

-- Add Aliyun streaming TTS voices
delete from `ai_tts_voice` where tts_model_id = 'TTS_AliyunStreamTTS';
-- Gentle female voice series
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0001', 'TTS_AliyunStreamTTS', 'Long Xiaochun', 'longxiaochun', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0002', 'TTS_AliyunStreamTTS', 'Long Xiaoxia', 'longxiaoxia', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 2, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0003', 'TTS_AliyunStreamTTS', 'Long Mei', 'longmei', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 3, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0004', 'TTS_AliyunStreamTTS', 'Long Gui', 'longgui', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 4, NULL, NULL, NULL, NULL);
-- Mature female voice series
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0005', 'TTS_AliyunStreamTTS', 'Long Yu', 'longyu', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 5, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0006', 'TTS_AliyunStreamTTS', 'Long Jiao', 'longjiao', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 6, NULL, NULL, NULL, NULL);
-- Male voice series
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0007', 'TTS_AliyunStreamTTS', 'Long Chen', 'longchen', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 7, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0008', 'TTS_AliyunStreamTTS', 'Long Xiu-Young Male', 'longxiu', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 8, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0009', 'TTS_AliyunStreamTTS', 'Long Cheng', 'longcheng', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 9, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0010', 'TTS_AliyunStreamTTS', 'Long Zhe-Mature Male', 'longzhe', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 10, NULL, NULL, NULL, NULL);
-- Professional broadcast series
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0011', 'TTS_AliyunStreamTTS', 'Bella2.0-News Female', 'loongbella', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 11, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0012', 'TTS_AliyunStreamTTS', 'Stella 2.0', 'loongstella', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 12, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0013', 'TTS_AliyunStreamTTS', 'Long Shu-News Male', 'longshu', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 13, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0014', 'TTS_AliyunStreamTTS', 'Long Jing', 'longjing', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 14, NULL, NULL, NULL, NULL);
-- Special voice series
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0015', 'TTS_AliyunStreamTTS', 'Long Qi-Lively Child', 'longqi', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 15, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0016', 'TTS_AliyunStreamTTS', 'Long Hua', 'longhua', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 16, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0017', 'TTS_AliyunStreamTTS', 'Long Wu', 'longwu', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 17, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0018', 'TTS_AliyunStreamTTS', 'Long Dachui', 'longdachui', 'Chinese and mixed Chinese-English', NULL, NULL, NULL, NULL, 18, NULL, NULL, NULL, NULL);
-- Cantonese series
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0019', 'TTS_AliyunStreamTTS', 'Long Jiayi', 'longjiayi', 'Cantonese and mixed Cantonese-English', NULL, NULL, NULL, NULL, 19, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_AliyunStreamTTS_0020', 'TTS_AliyunStreamTTS', 'Long Tao', 'longtao', 'Cantonese and mixed Cantonese-English', NULL, NULL, NULL, NULL, 20, NULL, NULL, NULL, NULL);
