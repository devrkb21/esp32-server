-- Local short-term memory configuration can specify an independent LLM
update `ai_model_provider` set fields = '[{"key":"llm","label":"LLM Model","type":"string"}]' where id = 'SYSTEM_Memory_mem_local_short';
update `ai_model_config` set config_json = '{\"type\": \"mem_local_short\", \"llm\": \"LLM_ChatGLMLLM\"}' where id = 'Memory_mem_local_short';

-- Add Volcengine dual-streaming TTS provider and model configuration
delete from `ai_model_provider` where id = 'SYSTEM_TTS_HSDSTTS';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_TTS_HSDSTTS', 'TTS', 'Huoshan Stream', 'Volcengine Dual-Streaming Speech Synthesis', '[{"key":"ws_url","label":"WebSocket Address","type":"string"},{"key":"appid","label":"App ID","type":"string"},{"key":"access_token","label":"Access Token","type":"string"},{"key":"resource_id","label":"Resource ID","type":"string"},{"key":"speaker","label":"Default voice","type":"string"}]', 13, 1, NOW(), 1, NOW());

delete from `ai_model_config` where id = 'TTS_HuoshanDoubleStreamTTS';
INSERT INTO `ai_model_config` VALUES ('TTS_HuoshanDoubleStreamTTS', 'TTS', 'HuoshanDoubleStreamTTS', 'Volcengine Dual-Streaming Speech Synthesis', 0, 1, '{\"type\": \"huoshan_double_stream\", \"ws_url\": \"wss://openspeech.bytedance.com/api/v3/tts/bidirection\", \"appid\": \"your_volcengine_tts_appid\", \"access_token\": \"your_volcengine_tts_access_token\", \"resource_id\": \"volc.service_type.10029\", \"speaker\": \"zh_female_wanwanxiaohe_moon_bigtts\"}', NULL, NULL, 16, NULL, NULL, NULL, NULL);

-- Volcengine dual-streaming TTS model configuration documentation
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/speech/service/10007',
`remark` = 'Volcengine Speech Synthesis ServiceConfiguration Instructions:
1. Visit https://www.volcengine.com/ Register and activate a Volcengine account
2. Visit https://console.volcengine.com/speech/service/10007 Activate Speech Synthesis Large Model, PurchaseVoice
3. At the bottom of the pageObtain appid and access_token
5. ResourceIDFixed to: volc.service_type.10029 (LLM speech synthesis and mixing) 
6. Fill into the configuration file' WHERE `id` = 'TTS_HuoshanDoubleStreamTTS';


-- Add Volcengine dual-streaming TTS voices
delete from `ai_tts_voice` where tts_model_id = 'TTS_HuoshanDoubleStreamTTS';
