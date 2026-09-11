-- VLLM model provider
delete from `ai_model_provider` where id = 'SYSTEM_ASR_DoubaoStreamASR';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_DoubaoStreamASR', 'ASR', 'doubao_stream', 'Volcengine Speech Recognition(Streaming)', '[{"key":"appid","label":"App ID","type":"string"},{"key":"access_token","label":"Access Token","type":"string"},{"key":"cluster","label":"Cluster","type":"string"},{"key":"boosting_table_name","label":"Hotwords file name","type":"string"},{"key":"correct_table_name","label":"Replacement word fileName","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"}]', 3, 1, NOW(), 1, NOW());


-- VLLM model configuration
delete from `ai_model_config` where id = 'ASR_DoubaoStreamASR';
INSERT INTO `ai_model_config` VALUES ('ASR_DoubaoStreamASR', 'ASR', 'DoubaoStreamASR', 'Doubao Speech Recognition (Streaming)', 0, 1, '{\"type\": \"doubao_stream\", \"appid\": \"\", \"access_token\": \"\", \"cluster\": \"volcengine_input_common\", \"output_dir\": \"tmp/\"}', NULL, NULL, 3, NULL, NULL, NULL, NULL);


-- Update Doubao ASR configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/speech/app',
`remark` = 'DoubaoASRConfiguration Instructions:
1. DoubaoASRand Doubao(Streaming)ASRThe difference is: DoubaoASRis billed per request, Doubao(Streaming)ASRis billed per duration
2. Generally, per-request billing is cheaper, But Doubao(Streaming)ASRuses large language model technology, Better Effect
3. Need to create an application in Volcengine console and obtain appid and access_token
4. Supports Chinese speech recognition
5. Requires network connection
6. Output files are saved in tmp/ directory
Application Steps:
1. Visit https://console.volcengine.com/speech/app
2. Create new application
3. Obtain appid and access_token
4. Fill into the configuration file
For custom hotwords, refer to: https://www.volcengine.com/docs/6561/155738
' WHERE `id` = 'ASR_DoubaoASR';

UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/speech/app',
`remark` = 'DoubaoASRConfiguration Instructions:
1. DoubaoASRand Doubao(Streaming)ASRThe difference is: DoubaoASRis billed per request, Doubao(Streaming)ASRis billed per duration
2. Generally, per-request billing is cheaper, But Doubao(Streaming)ASRuses large language model technology, Better Effect
3. Need to create an application in Volcengine console and obtain appid and access_token
4. Supports Chinese speech recognition
5. Requires network connection
6. Output files are saved in tmp/ directory
Application Steps:
1. Visit https://console.volcengine.com/speech/app
2. Create new application
3. Obtain appid and access_token
4. Fill into the configuration file
For custom hotwords, refer to: https://www.volcengine.com/docs/6561/155738
' WHERE `id` = 'ASR_DoubaoStreamASR';
