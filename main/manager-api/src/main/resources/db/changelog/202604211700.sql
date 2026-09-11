-- Fix Doubao TTS 2.0 duplicate provider_code issue and add ASR 2.0 support

-- ==================== Doubao TTS Model 2.0 ====================
-- Delete TTS 2.0 provider (separate provider no longer needed)
delete from `ai_model_provider` where id = 'SYSTEM_TTS_HSDSTTS_V2';

-- ==================== Doubao Speech Recognition (Streaming) ====================
-- Fix existing Doubao ASR (streaming) provider: remove cluster field, add resource_id field
UPDATE `ai_model_provider` SET `fields` = '[{"key":"appid","type":"string","label":"App ID"},{"key":"access_token","type":"string","label":"Access Token"},{"key":"boosting_table_name","type":"string","label":"Hotwords file name"},{"key":"correct_table_name","type":"string","label":"Replacement word fileName"},{"key":"output_dir","type":"string","label":"Output directory"},{"key":"end_window_size","type":"number","label":"Silence duration (ms)"},{"key":"enable_multilingual","type":"boolean","label":"Enable multilingual recognition mode"},{"key":"language","type":"string","label":"SpecifyLanguage code"},{"key":"resource_id","type":"string","label":"Resource ID"}]' WHERE `id` = 'SYSTEM_ASR_DoubaoStreamASR';

-- Fix existing Doubao ASR (streaming) config: remove cluster field, add resource_id default
UPDATE `ai_model_config` SET `config_json` = JSON_REMOVE(JSON_SET(`config_json`, '$.resource_id', 'volc.bigasr.sauc.duration'), '$.cluster') WHERE `id` = 'ASR_DoubaoStreamASR';

-- ==================== Doubao Speech Recognition Model 2.0 ====================

-- Insert Doubao ASR model 2.0 configuration
delete from `ai_model_config` where id = 'ASR_DoubaoStreamASRV2';
INSERT INTO `ai_model_config` VALUES ('ASR_DoubaoStreamASRV2', 'ASR', 'DoubaoStreamASRV2', 'Doubao Speech Recognition Model 2.0', 0, 1, '{
"type": "doubao_stream",
"appid": "",
"access_token": "",
"resource_id": "volc.seedasr.sauc.duration",
"end_window_size": 200,
"enable_multilingual": false,
"language": "en-US",
"output_dir": "tmp/"
}', NULL, NULL, 6, NULL, NULL, NULL, NULL);

-- Doubao ASR model 2.0 configuration documentation
UPDATE `ai_model_config` SET
`doc_link` = 'https://www.volcengine.com/docs/6561/109979',
`remark` = 'Doubao Speech Recognition Model 2.0Configuration Instructions (Based on Volcengineseed-asr) : 
1. Visit https://www.volcengine.com/ Register and activate a Volcengine account
2. Visit https://console.volcengine.com/speech/service/10038 Activate Doubao streaming speech recognition model2.0
3. At the bottom of the pageObtain appid and access_token
4. ResourceIDThere are two kinds: Hour Edition (volc.seedasr.sauc.duration) and concurrency edition (volc.seedasr.sauc.concurrent) 
- Hour Edition: Fixed to: volc.seedasr.sauc.duration (Doubao Speech Recognition Model 2.0) 
- Concurrency Edition: Fixed to: volc.seedasr.sauc.concurrent (Doubao Speech Recognition Model 2.0) 

Detailed documentation:https://www.volcengine.com/docs/6561/109979

Note: 
- Doubao Speech Recognition Model 2.0Usevolc.seedasr.sauc.durationResourceID, andDoubao Speech Recognition (Streaming) (volc.bigasr.sauc.duration) Different
- Speech Recognition Model2.0Price is cheaper, It is recommended to use concurrent version resources in high-concurrency scenariosID
' WHERE `id` = 'ASR_DoubaoStreamASRV2';
