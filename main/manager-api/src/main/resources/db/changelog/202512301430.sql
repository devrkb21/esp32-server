-- Add Aliyun Bailian Paraformer realtime ASR service configuration
delete from `ai_model_provider` where id = 'SYSTEM_ASR_AliyunBLStream';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_AliyunBLStream', 'ASR', 'aliyunbl_stream', 'Aliyun Bailian Paraformer Realtime ASR', '[{"key":"api_key","label":"API Key","type":"password"},{"key":"model","label":"Model name","type":"string"},{"key":"format","label":"Audio format","type":"string"},{"key":"sample_rate","label":"Sample rate","type":"number"},{"key":"output_dir","label":"Output directory","type":"string"}]', 18, 1, NOW(), 1, NOW());

delete from `ai_model_config` where id = 'ASR_AliyunBLStream';
INSERT INTO `ai_model_config` VALUES ('ASR_AliyunBLStream', 'ASR', 'AliyunBLStream', 'Aliyun Bailian Paraformer Realtime ASR', 0, 1, '{"type": "aliyunbl_stream", "api_key": "", "model": "paraformer-realtime-v2", "format": "pcm", "sample_rate": 16000, "disfluency_removal_enabled": false, "semantic_punctuation_enabled": false, "max_sentence_silence": 200, "multi_threshold_mode_enabled": false, "punctuation_prediction_enabled": true, "inverse_text_normalization_enabled": true, "output_dir": "tmp/"}', 'https://help.aliyun.com/zh/model-studio/websocket-for-paraformer-real-time-service', 'Supports multipleLanguages, Hotword Customization, advanced features such as semantic sentence segmentation', 21, NULL, NULL, NULL, NULL);

-- Update Aliyun Bailian Paraformer model configuration documentation
UPDATE `ai_model_config` SET
`doc_link` = 'https://help.aliyun.com/zh/model-studio/websocket-for-paraformer-real-time-service',
`remark` = 'Aliyun Bailian Paraformer Realtime ASRConfiguration Instructions:
1. Log in to Alibaba Cloud Bailian Platform https://bailian.console.aliyun.com/
2. CreateAPI-KEY https://bailian.console.aliyun.com/#/api-key
3. Supported Models: paraformer-realtime-v2(Recommended), paraformer-realtime-8k-v2, paraformer-realtime-v1, paraformer-realtime-8k-v1
4. Features:
- MultiLanguagesSupports(ChinesecontainingDialects, English, Japanese, Korean, German, French, Russian)
- Hotword Customization(vocabulary_idParameters), For detailed instructions please refer to: https://help.aliyun.com/zh/model-studio/custom-hot-words?
- Semantic Sentence Segmentation/VADPause Segmentation(semantic_punctuation_enabledParameters)
- Automatic punctuation, ITN, filters modal particles etc.
5. Parameter Descriptions:
- model: Model name, Recommendedparaformer-realtime-v2
- sample_rate: Sample Rate(Hz), v2Supports arbitrary sample rate, v1Only supports16000, 8kversion only supports8000
- semantic_punctuation_enabled: falseasVADPause Segmentation(Low Latency), truefor semantic segmentation(High Accuracy)
- max_sentence_silence: VADSentence pause silence duration threshold(200-6000ms)
' WHERE `id` = 'ASR_AliyunBLStream';


-- Update Doubao streaming ASR provider: add configuration
delete from `ai_model_provider` where id = 'SYSTEM_ASR_DoubaoStreamASR';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_DoubaoStreamASR', 'ASR', 'doubao_stream', 'Volcengine Speech Recognition(Streaming)', '[{"key":"appid","label":"App ID","type":"string"},{"key":"access_token","label":"Access Token","type":"string"},{"key":"cluster","label":"Cluster","type":"string"},{"key":"boosting_table_name","label":"Hotwords file name","type":"string"},{"key":"correct_table_name","label":"Replacement word fileName","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"},{"key":"end_window_size","label":"Silence duration (ms)","type":"number"},{"key":"enable_multilingual","label":"Enable multilingual recognition mode","type":"boolean"},{"key":"language","label":"SpecifyLanguage code","type":"string"}]', 3, 1, NOW(), 1, NOW());
UPDATE `ai_model_config` SET 
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
If enabledMultilingualRecognition Mode, Please setlanguageWhen this key is empty, This model supports ChineseEnglish, Shanghainese, Hokkien, Sichuan, Shaanxi, CantoneseRecognition。For other languages please refer to: https://www.volcengine.com/docs/6561/1354869
' WHERE `id` = 'ASR_DoubaoStreamASR';

-- Update Doubao streaming ASR model config: add enable_multilingual default
UPDATE `ai_model_config` SET
`config_json` = JSON_SET(
`config_json`, 
'$.enable_multilingual', false,
'$.language', 'zh-CN'
)
WHERE `id` = 'ASR_DoubaoStreamASR' 
AND JSON_EXTRACT(`config_json`, '$.enable_multilingual') IS NULL 
AND JSON_EXTRACT(`config_json`, '$.language') IS NULL;


-- Update HuoshanDoubleStreamTTS provider config: add multi-emotion voice parameters
UPDATE `ai_model_provider`
SET `fields` = '[{"key": "ws_url", "type": "string", "label": "WebSocket Address"}, {"key": "appid", "type": "string", "label": "App ID"}, {"key": "access_token", "type": "string", "label": "Access Token"}, {"key": "resource_id", "type": "string", "label": "Resource ID"}, {"key": "speaker", "type": "string", "label": "Default voice"}, {"key": "enable_ws_reuse", "type": "boolean", "label": "Enable connection reuse", "default": true}, {"key": "speech_rate", "type": "number", "label": "Speech rate (-50~100)"}, {"key": "loudness_rate", "type": "number", "label": "Volume (-50~100)"}, {"key": "pitch", "type": "number", "label": "Pitch (-12~12)"}, {"key": "emotion_scale", "type": "number", "label": "Emotion scale (1-5)"}, {"key": "emotion", "type": "string", "label": "Emotion type"}]'
WHERE `id` = 'SYSTEM_TTS_HSDSTTS';

-- Update default values
UPDATE `ai_model_config` SET
`config_json` = JSON_SET(
`config_json`,
'$.emotion', 'neutral',
'$.emotion_scale', 4
)
WHERE `id` = 'TTS_HuoshanDoubleStreamTTS'
AND JSON_EXTRACT(`config_json`, '$.emotion') IS NULL 
AND JSON_EXTRACT(`config_json`, '$.emotion_scale') IS NULL;

-- Add documentation link and remarks
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/speech/service/10007',
`remark` = 'Volcengine Speech Synthesis ServiceConfiguration Instructions:
1. Visit https://www.volcengine.com/ Register and activate a Volcengine account
2. Visit https://console.volcengine.com/speech/service/10007 Activate Speech Synthesis Large Model, PurchaseVoice
3. At the bottom of the pageObtain appid and access_token
5. ResourceIDFixed to: volc.service_type.10029 (LLM speech synthesis and mixing) 
6. Connection Reuse: EnableWebSocketConnection Reuse, DefaulttrueReduce connection overhead (Note: When reused, idle connections when the device is listening will consume concurrency quota) 
7. Speech Rate: -50~100, Optional, Normal default value0, Optional-50~100
8. Volume: -50~100, Optional, Normal default value0, Optional-50~100
9. Pitch: -12~12, Optional, Normal default value0, Optional-12~12
10. Multi-emotion parameters (Currently only someVoiceSupports setting emotion) : 
RelatedVoiceList: https://www.volcengine.com/docs/6561/1257544
- emotion_scale: Emotion Intensity, Optional values are: 1~5, Default value is4
- emotion: Emotion Type, Optional values are: neutral, happy, sad, angry, fearful, disgusted, surprised
' WHERE `id` = 'TTS_HuoshanDoubleStreamTTS';
