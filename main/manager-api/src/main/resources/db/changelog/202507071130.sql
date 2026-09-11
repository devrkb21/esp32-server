-- Add Aliyun streaming ASR provider
delete from `ai_model_provider` where id = 'SYSTEM_ASR_AliyunStreamASR';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_AliyunStreamASR', 'ASR', 'aliyun_stream', 'Alibaba Cloud Speech Recognition(Streaming)', '[{"key":"appkey","label":"App Key","type":"string"},{"key":"token","label":"Temporary Token","type":"string"},{"key":"access_key_id","label":"AccessKey ID","type":"string"},{"key":"access_key_secret","label":"AccessKey Secret","type":"string"},{"key":"host","label":"Service address","type":"string"},{"key":"max_sentence_silence","label":"Sentence break detection time","type":"number"},{"key":"output_dir","label":"Output directory","type":"string"}]', 6, 1, NOW(), 1, NOW());

-- Add Aliyun streaming ASR model configuration
delete from `ai_model_config` where id = 'ASR_AliyunStreamASR';
INSERT INTO `ai_model_config` VALUES ('ASR_AliyunStreamASR', 'ASR', 'AliyunStreamASR', 'Alibaba Cloud Speech Recognition(Streaming)', 0, 1, '{\"type\": \"aliyun_stream\", \"appkey\": \"\", \"token\": \"\", \"access_key_id\": \"\", \"access_key_secret\": \"\", \"host\": \"nls-gateway-cn-shanghai.aliyuncs.com\", \"max_sentence_silence\": 800, \"output_dir\": \"tmp/\"}', NULL, NULL, 8, NULL, NULL, NULL, NULL);

-- Update Aliyun streaming ASR configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://nls-portal.console.aliyun.com/',
`remark` = 'Aliyun Streaming ASRConfiguration Instructions:
1. Alibaba CloudASRand Alibaba Cloud(Streaming)ASRThe difference is: Alibaba CloudASRis one-off recognition, Alibaba Cloud(Streaming)ASRis real-time streaming recognition
2. StreamingASRHas lower latency and better real-time responsiveness, Suitable for voice interaction scenarios
3. Need to create an application in Aliyun Intelligent Speech Interaction console and obtain credentials
4. SupportsChineseReal-time Speech Recognition, Supports punctuation prediction and inverse text normalization
5. Requires network connection, Output files are saved in tmp/ directory
Application Steps:
1. Visit https://nls-portal.console.aliyun.com/ Activate intelligent speech interaction service
2. Visit https://nls-portal.console.aliyun.com/applist create a project and obtainappkey
3. Visit https://nls-portal.console.aliyun.com/overview Obtain temporary token (or configureaccess_key_idandaccess_key_secretAuto obtain) 
4. For dynamic token management, configuring access_key_id and access_key_secret is recommended
5. max_sentence_silenceparameter controls sentence segmentation detection time (ms) , Default800ms
For more parameter configurations, please refer to: https://help.aliyun.com/zh/isi/developer-reference/real-time-speech-recognition
' WHERE `id` = 'ASR_AliyunStreamASR';
