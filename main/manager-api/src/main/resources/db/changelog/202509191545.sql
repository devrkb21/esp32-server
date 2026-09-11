-- Add iFlytek streaming TTS provider
delete from `ai_model_provider` where id = 'SYSTEM_TTS_XunFeiStreamTTS';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_TTS_XunFeiStreamTTS', 'TTS', 'xunfei_stream', 'iFlytek Streaming Speech Synthesis', '[{"key":"app_id","label":"APP_ID","type":"string"},{"key":"api_secret","label":"API_Secret","type":"string"},{"key":"api_key","label":"API Key","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"},{"key":"voice","label":"Voice","type":"string"},{"key":"format","label":"Audio format","type":"string"},{"key":"sample_rate","label":"Sample rate","type":"number"},{"key": "volume", "type": "number", "label": "Volume"},{"key": "speed", "type": "number", "label": "Speech rate"},{"key": "pitch", "type": "number", "label": "Pitch"},{"key": "oral_level", "type": "number", "label": "Colloquial level"},{"key": "spark_assist", "type": "number", "label": "Enable colloquial style"},{"key": "stop_split", "type": "number", "label": "Server-side sentence splitting"},{"key": "remain", "type": "number", "label": "Keep written language"}]', 20, 1, NOW(), 1, NOW());

-- Add iFlytek streaming TTS model configuration
delete from `ai_model_config` where id = 'TTS_XunFeiStreamTTS';
INSERT INTO `ai_model_config` VALUES ('TTS_XunFeiStreamTTS', 'TTS', 'XunFeiStreamTTS', 'iFlytek Streaming Speech Synthesis', 0, 1, '{\"type\": \"xunfei_stream\", \"app_id\": \"\", \"api_secret\": \"\", \"api_key\": \"\", \"output_dir\": \"tmp/\", \"voice\": \"x5_lingxiaoxuan_flow\", \"format\": \"raw\", \"sample_rate\": 24000, \"volume\": 50, \"speed\": 50, \"pitch\": 50, \"oral_level\": \"mid\", \"spark_assist\": 1, \"stop_split\": 0, \"remain\": 0}', NULL, NULL, 23, NULL, NULL, NULL, NULL);

-- Update iFlytek streaming TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.xfyun.cn/app/myapp',
`remark` = 'iFlytek Streaming TTSInstructions:
1. Log in to the iFlytek Speech Technology Platform https://console.xfyun.cn/app/myapp Create related application
2. Select the required service to obtainapiRelated Configuration https://console.xfyun.cn/services/uts
3. to the application to be used(APPID)Purchase related services For example: Ultra-realistic Synthesis https://console.xfyun.cn/services/uts
5. Supports real-time duplex streaming communication, has lower latency
6. Supports colloquial settings and audio parameter adjustments Note: V5VoiceDoes not support related colloquial configuration
7. Supports real-time volume adjustment, Speech Rate, pitch and other parameters
' WHERE `id` = 'TTS_XunFeiStreamTTS';

-- Add iFlytek streaming TTS voices
delete from `ai_tts_voice` where tts_model_id = 'TTS_XunFeiStreamTTS';

-- Basic personas

-- Need to add corresponding character voice
