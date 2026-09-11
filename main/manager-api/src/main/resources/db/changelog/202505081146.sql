-- Add Baidu ASR model configuration
delete from `ai_model_config` where `id` = 'ASR_BaiduASR';
INSERT INTO `ai_model_config` VALUES ('ASR_BaiduASR', 'ASR', 'BaiduASR', 'Baidu Speech Recognition', 0, 1, '{\"type\": \"baidu\", \"app_id\": \"\", \"api_key\": \"\", \"secret_key\": \"\", \"dev_pid\": 1537, \"output_dir\": \"tmp/\"}', NULL, NULL, 7, NULL, NULL, NULL, NULL);


-- Add Baidu ASR provider
delete from `ai_model_provider` where `id` = 'SYSTEM_ASR_BaiduASR';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_BaiduASR', 'ASR', 'baidu', 'Baidu Speech Recognition', '[{"key":"app_id","label":"App ID","type":"string"},{"key":"api_key","label":"API Key","type":"string"},{"key":"secret_key","label":"Secret Key","type":"string"},{"key":"dev_pid","label":"LanguagesParameters","type":"number"},{"key":"output_dir","label":"Output directory","type":"string"}]', 7, 1, NOW(), 1, NOW());


-- Update Baidu ASR configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.bce.baidu.com/ai-engine/old/#/ai/speech/app/list',
`remark` = 'BaiduASRConfiguration Instructions:
1. Visit https://console.bce.baidu.com/ai-engine/old/#/ai/speech/app/list
2. Create new application
3. ObtainAppID, API KeyandSecret Key
4. Fill into the configuration file
View resource quota: https://console.bce.baidu.com/ai-engine/old/#/ai/speech/overview/resource/list
LanguagesParameter Descriptions:https://ai.baidu.com/ai-doc/SPEECH/0lbxfnc9b
' WHERE `id` = 'ASR_BaiduASR';

-- Update Doubao provider fields
update `ai_model_provider` set `fields` = 
'[{"key":"appid","label":"App ID","type":"string"},{"key":"access_token","label":"Access Token","type":"string"},{"key":"cluster","label":"Cluster","type":"string"},{"key":"boosting_table_name","label":"Hotwords file name","type":"string"},{"key":"correct_table_name","label":"Replacement word fileName","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"}]'
where `id` = 'SYSTEM_ASR_DoubaoASR';

-- Update Doubao ASR configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/speech/app',
`remark` = 'DoubaoASRConfiguration Instructions:
1. Need to create an application in Volcengine console and obtain appid and access_token
2. Supports Chinese speech recognition
3. Requires network connection
4. Output files are saved in tmp/ directory
Application Steps:
1. Visit https://console.volcengine.com/speech/app
2. Create new application
3. Obtain appid and access_token
4. Fill into the configuration file
For custom hotwords, refer to: https://www.volcengine.com/docs/6561/155738
' WHERE `id` = 'ASR_DoubaoASR';