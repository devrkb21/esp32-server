-- Add iFlytek streaming speech recognition service configuration
delete from `ai_model_provider` where id = 'SYSTEM_ASR_XunfeiStream';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_XunfeiStream', 'ASR', 'xunfei_stream', 'iFlytek Streaming Speech Recognition', '[{"key":"app_id","label":"App ID","type":"string"},{"key":"api_key","label":"API_KEY","type":"password"},{"key":"api_secret","label":"API_SECRET","type":"password"},{"key":"domain","label":"Recognition domain","type":"string"},{"key":"language","label":"RecognitionLanguages","type":"string"},{"key":"accent","label":"Dialect","type":"string"},{"key":"dwa","label":"Dynamic correction","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"}]', 18, 1, NOW(), 1, NOW());

delete from `ai_model_config` where id = 'ASR_XunfeiStream';
INSERT INTO `ai_model_config` VALUES ('ASR_XunfeiStream', 'ASR', 'iFlytek Streaming Speech Recognition', 'iFlytek Streaming Speech RecognitionService', 0, 1, '{"type": "xunfei_stream", "app_id": "", "api_key": "", "api_secret": "", "domain": "slm", "language": "zh_cn", "accent": "mandarin", "dwa": "wpgs", "output_dir": "tmp/"}', 'https://www.xfyun.cn/doc/spark/spark_zh_iat.html', 'Supports realtime streaming ASR, suitable for Mandarin and dialects', 21, NULL, NULL, NULL, NULL);

-- Update iFlytek streaming ASR model configuration documentation
UPDATE `ai_model_config` SET
`doc_link` = 'https://www.xfyun.cn/doc/spark/spark_zh_iat.html',
`remark` = 'iFlytek Streaming Speech RecognitionConfiguration Instructions:
1. Log in to iFlytek Open Platform https://www.xfyun.cn/
2. create a speech recognition application and obtainAPPID, APISecret, APIKey
3. Parameter Descriptions:
- app_id: ApplicationID, Obtained after creating an application on the iFlytek Open Platform
- api_key: APISecret Key, Used for API authentication
- api_secret: APISecret Key, Used to generate signature
- domain: Recognition Domain, Defaultslm (Intelligent Speech Transcription) 
- language: RecognitionLanguages, Defaultzh_cn (Chinese) 
- accent: DialectsType, Defaultmandarin (Mandarin) , Supportscantonese (Cantonese) etc
- dwa: Dynamic Correction, Defaultwpgs (Enable dynamic correction) 
- output_dir: Audio file output directory, Defaulttmp/
4. Supports realtime streaming recognition, Suitable for real-time voice interaction scenarios
5. Supports MultipleDialectsandLanguagesRecognition
' WHERE `id` = 'ASR_XunfeiStream';