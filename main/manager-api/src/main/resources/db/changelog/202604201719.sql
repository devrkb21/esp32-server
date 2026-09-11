-- Add Doubao TTS model 2.0 provider (using seed-tts-2.0 resource ID)
-- Same configuration as Volcengine dual-streaming TTS, with fixed resource_id seed-tts-2.0

-- Insert Doubao TTS model 2.0 provider
delete from `ai_model_provider` where id = 'SYSTEM_TTS_HSDSTTS_V2';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_TTS_HSDSTTS_V2', 'TTS', 'Huoshan Stream', 'Doubao Speech Synthesis Model 2.0', '[
{"key": "ws_url", "type": "string", "label": "WebSocket Address"},
{"key": "appid", "type": "string", "label": "App ID"},
{"key": "access_token", "type": "string", "label": "Access Token"},
{"key": "resource_id", "type": "string", "label": "Resource ID"},
{"key": "speaker", "type": "string", "label": "Default voice"},
{"key": "enable_ws_reuse", "type": "boolean", "label": "Enable connection reuse", "default": true},
{"key": "audio_params", "type": "dict", "label": "Audio output configuration"},
{"key": "additions", "type": "dict", "label": "Advanced text processing config"},
{"key": "mix_speaker", "type": "dict", "label": "Mixing control config"}
]', 14, 1, NOW(), 1, NOW());

-- Insert Doubao TTS model 2.0 configuration
delete from `ai_model_config` where id = 'TTS_HSDSTTS_V2';
INSERT INTO `ai_model_config` VALUES ('TTS_HSDSTTS_V2', 'TTS', 'HuoshanDoubleStreamTTSV2', 'Doubao Speech Synthesis Model 2.0', 0, 1, '{
"type": "huoshan_double_stream",
"ws_url": "wss://openspeech.bytedance.com/api/v3/tts/bidirection",
"appid": "",
"access_token": "",
"resource_id": "seed-tts-2.0",
"speaker": "en_male_tim_uranus_bigtts",
"enable_ws_reuse": true,
"audio_params": {
"speech_rate": 0,
"loudness_rate": 0
},
"additions": {
"aigc_metadata": {},
"cache_config": {},
"post_process": {
"pitch": 0
}
},
"mix_speaker": {}
}', NULL, NULL, 17, NULL, NULL, NULL, NULL);

-- Doubao TTS model 2.0 configuration documentation
UPDATE `ai_model_config` SET
`doc_link` = 'https://www.volcengine.com/docs/6561/1329505',
`remark` = 'Doubao Speech Synthesis Model 2.0Configuration Instructions (Based on Volcengineseed-tts-2.0) : 
1. Visit https://www.volcengine.com/ Register and activate a Volcengine account
2. Visit https://console.volcengine.com/speech/service/10035 Activate Speech Synthesis Large Model, PurchaseVoice
3. At the bottom of the pageObtain appid and access_token
4. ResourceIDFixed to: seed-tts-2.0 (Doubao Speech Synthesis Model 2.0) 
5. Connection Reuse: EnableWebSocketConnection Reuse, DefaulttrueReduce connection overhead (Note: When reused, idle connections when the device is listening will consume concurrency quota) 

Detailed documentation:https://www.volcengine.com/docs/6561/1329505
【audio_params】Audio output configuration - Users can customize and add any audio parameters supported by Volcengine
- speech_rate: Speech Rate(-50~100), Default0
- loudness_rate: Volume(-50~100), Default0
Example: {"speech_rate": 10, "loudness_rate": 5}

【additions】Advanced text processing configuration - Users can customize and add any advanced parameters supported by Volcengine
- post_process.pitch: Pitch(-12~12), Default0
- aigc_metadata: AIGCMetadata configuration
- cache_config: Cache Configuration
Example: {"post_process": {"pitch": 2}, "aigc_metadata": {}, "cache_config": {}}

Note: 
- Doubao Speech Synthesis Model 2.0Useseed-tts-2.0ResourceID, andVolcengine Dual-Streaming TTS (volc.service_type.10029) Different
- RelatedVoiceList: https://www.volcengine.com/docs/6561/1257544
- Users can follow VolcengineAPIdocumentation to add more parameters yourself
' WHERE `id` = 'TTS_HSDSTTS_V2';

-- Add Doubao TTS model 2.0 voices (same as Volcengine dual-streaming TTS)
delete from `ai_tts_voice` where tts_model_id = 'TTS_HSDSTTS_V2';
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0018', 'TTS_HSDSTTS_V2', 'Tim', 'en_male_tim_uranus_bigtts', 'English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/en_male_tim_uranus_bigtts.mp3', NULL, NULL, NULL, 18, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0019', 'TTS_HSDSTTS_V2', 'Dacey', 'en_female_dacey_uranus_bigtts', 'English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/en_female_dacey_uranus_bigtts.mp3', NULL, NULL, NULL, 19, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0020', 'TTS_HSDSTTS_V2', 'Stokie', 'en_female_stokie_uranus_bigtts', 'English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/en_female_stokie_uranus_bigtts.mp3', NULL, NULL, NULL, 20, NULL, NULL, NULL, NULL);
