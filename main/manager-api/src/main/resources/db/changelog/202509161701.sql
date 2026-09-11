-- Add Aliyun Bailian streaming TTS provider
delete from `ai_model_provider` where id = 'SYSTEM_TTS_AliBLStreamTTS';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_TTS_AliBLStreamTTS', 'TTS', 'alibl_stream', 'Aliyun Bailian Streaming Speech Synthesis', '[{"key":"api_key","label":"API Key","type":"string"},{"key":"ws_url","label":"WebSocket URL (with Workspace ID)","type":"string","default":"wss://dashscope.aliyuncs.com/api-ws/v1/inference/"},{"key":"output_dir","label":"Output directory","type":"string"},{"key":"model","label":"Model","type":"string"},{"key":"voice","label":"Voice","type":"string"},{"key":"format","label":"Audio format","type":"string"},{"key":"sample_rate","label":"Sample rate","type":"number"},{"key": "volume", "type": "number", "label": "Volume"},{"key": "rate", "type": "number", "label": "Speech rate"},{"key": "pitch", "type": "number", "label": "Pitch"}]', 19, 1, NOW(), 1, NOW());

-- Add Aliyun Bailian streaming TTS model configuration
delete from `ai_model_config` where id = 'TTS_AliBLStreamTTS';
INSERT INTO `ai_model_config` VALUES ('TTS_AliBLStreamTTS', 'TTS', 'AliBLStreamTTS', 'Aliyun Bailian Streaming Speech Synthesis', 0, 1, '{\"type\": \"alibl_stream\", \"appkey\": \"\", \"ws_url\": \"wss://dashscope.aliyuncs.com/api-ws/v1/inference/\", \"output_dir\": \"tmp/\", \"model\": \"cosyvoice-v2\", \"voice\": \"longcheng_v2\", \"format\": \"pcm\", \"sample_rate\": 24000, \"volume\": 50, \"rate\": 1, \"pitch\": 1}', NULL, NULL, 22, NULL, NULL, NULL, NULL);

-- Update Aliyun Bailian streaming TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
`remark` = 'Aliyun Bailian Streaming TTS Instructions:
1. API Key: Enter the DashScope API Key for the current workspace
2. Public mode: Use wss://dashscope.aliyuncs.com/api-ws/v1/inference/
3. North China 2 (Beijing) workspace: Use wss://<WorkspaceId>.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference
4. Singapore workspace: Use wss://<WorkspaceId>.ap-southeast-1.maas.aliyuncs.com/api-ws/v1/inference
5. Replace <WorkspaceId> with your actual workspace ID; only official Alibaba Cloud WSS inference endpoints are supported
6. Supports CosyVoice streaming synthesis, volume, speech rate, and pitch adjustments
' WHERE `id` = 'TTS_AliBLStreamTTS';

-- Add Aliyun Bailian streaming TTS voices
delete from `ai_tts_voice` where tts_model_id = 'TTS_AliBLStreamTTS';

-- Voice assistant

-- Live commerce

-- Social companionship

-- Dialects

-- Child voice

-- Poetry recitation

-- Global marketing