-- Add Index-TTS-vLLM streaming TTS provider
delete from `ai_model_provider` where id = 'SYSTEM_TTS_IndexStreamTTS';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_TTS_IndexStreamTTS', 'TTS', 'index_stream', 'Index-TTS-vLLM Streaming Speech Synthesis', '[{"key":"api_url","label":"API service address","type":"string"},{"key":"voice","label":"Default voice","type":"string"},{"key":"audio_format","label":"Audio format","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"}]', 16, 1, NOW(), 1, NOW());

-- Add Index-TTS-vLLM streaming TTS model configuration
delete from `ai_model_config` where id = 'TTS_IndexStreamTTS';
INSERT INTO `ai_model_config` VALUES ('TTS_IndexStreamTTS', 'TTS', 'IndexStreamTTS', 'Index-TTS-vLLM Streaming Speech Synthesis', 0, 1, '{\"type\": \"index_stream\", \"api_url\": \"http://127.0.0.1:11996/tts\", \"voice\": \"jay_klee\", \"audio_format\": \"pcm\", \"output_dir\": \"tmp/\"}', NULL, NULL, 19, NULL, NULL, NULL, NULL);

-- Update Index-TTS-vLLM streaming TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/Ksuriuri/index-tts-vllm',
`remark` = 'Index-TTS-vLLM Streaming TTSConfiguration Instructions:
1. Index-TTS-vLLM is based on the Index-TTS project vLLM Inference Service, Provides streaming speech synthesis functionality
2. Supports multiple voices, Natural Sound Quality, Suitable for various voice interaction scenarios
3. Need to deploy first:Index-TTS-vLLMService, Then configureAPIAddress
4. Supports realtime streaming synthesis, has lower latency
5. Supports custom voices, Can be in projectassetsfolder to register newVoice
Deployment Steps:
1. Clone Project: git clone https://github.com/Ksuriuri/index-tts-vllm.git
2. Install dependencies: pip install -r requirements.txt
3. Start Service: python app.py
4. Service runs by default on http://127.0.0.1:11996
5. For other voices, register in project assets folder
6. Supports multiple audio formats: pcm, wav, mp3etc
For more configurations, please refer to: https://github.com/Ksuriuri/index-tts-vllm/blob/master/README.md
' WHERE `id` = 'TTS_IndexStreamTTS';

-- Add Index-TTS-vLLM streaming TTS voices
delete from `ai_tts_voice` where tts_model_id = 'TTS_IndexStreamTTS';
-- Default voices
INSERT INTO `ai_tts_voice` VALUES ('TTS_IndexStreamTTS_0001', 'TTS_IndexStreamTTS', 'Jay Klee', 'jay_klee', 'English', NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL);
