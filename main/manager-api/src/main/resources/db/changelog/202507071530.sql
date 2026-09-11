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
-- Mature female voice series
-- Male voice series
-- Professional broadcast series
-- Special voice series
-- Cantonese series
