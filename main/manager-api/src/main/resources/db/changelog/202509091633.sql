-- Add Qwen3-ASR-Flash speech recognition service configuration
delete from `ai_model_provider` where id = 'SYSTEM_ASR_Qwen3Flash';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_Qwen3Flash', 'ASR', 'qwen3_asr_flash', 'Qwen3-ASR-Flash Speech Recognition', '[{"key":"api_key","label":"API Key","type":"password"},{"key":"base_url","label":"Service address","type":"string"},{"key":"model_name","label":"Model name","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"}]', 17, 1, NOW(), 1, NOW());

delete from `ai_model_config` where id = 'ASR_Qwen3Flash';
INSERT INTO `ai_model_config` VALUES ('ASR_Qwen3Flash', 'ASR', 'Qwen3-ASR-Flash', 'Tongyi Qianwen speech recognition service', 0, 1, '{"type": "qwen3_asr_flash", "api_key": "", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "model_name": "qwen3-asr-flash", "output_dir": "tmp/", "enable_lid": true, "enable_itn": true}', 'https://help.aliyun.com/zh/bailian/', 'Supports multipleLanguagesRecognition, Singing Recognition, Noise rejection function', 20, NULL, NULL, NULL, NULL);

-- Update Qwen3-ASR-Flash model configuration documentation
UPDATE `ai_model_config` SET 
`doc_link` = 'https://bailian.console.aliyun.com/?apiKey=1&tab=doc#/doc/?type=model&url=2979031',
`remark` = 'Tongyi QianwenQwen3-ASR-FlashConfiguration Instructions:
1. Log in to Alibaba Cloud Bailian Platformhttps://bailian.console.aliyun.com/
2. CreateAPI-KEY https://bailian.console.aliyun.com/#/api-key
3.Qwen3-ASR-FlashBased on Tongyi Qianwen multimodal foundation, Supports multipleLanguagesRecognition, Singing Recognition, noise rejection and other functions
' WHERE `id` = 'ASR_Qwen3Flash';
