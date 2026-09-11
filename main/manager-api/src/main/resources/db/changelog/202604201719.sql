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
"speaker": "zh_female_xiaohe_uranus_bigtts",
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
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0001', 'TTS_HSDSTTS_V2', 'Vivi', 'zh_female_vv_uranus_bigtts', 'Mandarin, Japanese, Indonesian, Mexican Spanish', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_vv_uranus_bigtts.wav', NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0002', 'TTS_HSDSTTS_V2', 'Xiaohe', 'zh_female_xiaohe_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_xiaohe_uranus_bigtts.mp3', NULL, NULL, NULL, 2, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0003', 'TTS_HSDSTTS_V2', 'Yuanzhou', 'zh_male_m191_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_m191_uranus_bigtts.mp3', NULL, NULL, NULL, 3, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0004', 'TTS_HSDSTTS_V2', 'Xiaotian', 'zh_male_taocheng_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_taocheng_uranus_bigtts.mp3', NULL, NULL, NULL, 4, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0005', 'TTS_HSDSTTS_V2', 'Liu Fei', 'zh_male_liufei_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_liufei_uranus_bigtts.mp3', NULL, NULL, NULL, 5, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0006', 'TTS_HSDSTTS_V2', 'Charming Sophie', 'zh_female_sophie_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_sophie_uranus_bigtts.mp3', NULL, NULL, NULL, 6, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0007', 'TTS_HSDSTTS_V2', 'FreshFemale voice', 'zh_female_qingxinnvsheng_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_qingxinnvsheng_uranus_bigtts.mp3', NULL, NULL, NULL, 7, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0008', 'TTS_HSDSTTS_V2', 'Intellectual Cancan', 'zh_female_cancan_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_cancan_uranus_bigtts.mp3', NULL, NULL, NULL, 8, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0009', 'TTS_HSDSTTS_V2', 'Spoiled Schoolgirl', 'zh_female_sajiaoxuemei_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_sajiaoxuemei_uranus_bigtts.mp3', NULL, NULL, NULL, 9, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0010', 'TTS_HSDSTTS_V2', 'Sweet Xiaoyuan', 'zh_female_tianmeixiaoyuan_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_tianmeixiaoyuan_uranus_bigtts.mp3', NULL, NULL, NULL, 10, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0011', 'TTS_HSDSTTS_V2', 'Sweet Peach', 'zh_female_tianmeitaozi_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_tianmeitaozi_uranus_bigtts.mp3', NULL, NULL, NULL, 11, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0012', 'TTS_HSDSTTS_V2', 'Brisk Sisi', 'zh_female_shuangkuaisisi_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_shuangkuaisisi_uranus_bigtts.mp3', NULL, NULL, NULL, 12, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0013', 'TTS_HSDSTTS_V2', 'Peppa Pig', 'zh_female_peiqi_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_peiqi_uranus_bigtts.mp3', NULL, NULL, NULL, 13, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0014', 'TTS_HSDSTTS_V2', 'Neighbor Girl', 'zh_female_linjianvhai_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_linjianvhai_uranus_bigtts.mp3', NULL, NULL, NULL, 14, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0015', 'TTS_HSDSTTS_V2', 'Youth Zixin / Brayan', 'zh_male_shaonianzixin_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_shaonianzixin_uranus_bigtts.mp3', NULL, NULL, NULL, 15, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0016', 'TTS_HSDSTTS_V2', 'Houge', 'zh_male_sunwukong_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_sunwukong_uranus_bigtts.mp3', NULL, NULL, NULL, 16, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0017', 'TTS_HSDSTTS_V2', 'CharmingFemaleFriend', 'zh_female_meilinvyou_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_meilinvyou_uranus_bigtts.mp3', NULL, NULL, NULL, 17, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0018', 'TTS_HSDSTTS_V2', 'Tim', 'en_male_tim_uranus_bigtts', 'English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/en_male_tim_uranus_bigtts.mp3', NULL, NULL, NULL, 18, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0019', 'TTS_HSDSTTS_V2', 'Dacey', 'en_female_dacey_uranus_bigtts', 'English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/en_female_dacey_uranus_bigtts.mp3', NULL, NULL, NULL, 19, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0020', 'TTS_HSDSTTS_V2', 'Stokie', 'en_female_stokie_uranus_bigtts', 'English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/en_female_stokie_uranus_bigtts.mp3', NULL, NULL, NULL, 20, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0021', 'TTS_HSDSTTS_V2', 'Warm Ahu / Alvin', 'zh_male_wennuanahu_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_wennuanahu_uranus_bigtts.mp3', NULL, NULL, NULL, 21, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0022', 'TTS_HSDSTTS_V2', 'Cute Toddler', 'zh_male_naiqimengwa_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_naiqimengwa_uranus_bigtts.mp3', NULL, NULL, NULL, 22, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0023', 'TTS_HSDSTTS_V2', 'Grandma', 'zh_female_popo_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_popo_uranus_bigtts.mp3', NULL, NULL, NULL, 23, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0024', 'TTS_HSDSTTS_V2', 'Cheerful Sister', 'zh_female_kailangjiejie_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_kailangjiejie_uranus_bigtts.mp3', NULL, NULL, NULL, 24, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0025', 'TTS_HSDSTTS_V2', 'Light Duoduo', 'saturn_zh_female_qingyingduoduo_cs_tob', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/ICL_zh_female_qingyingduoduo_cs_tob.mp3', NULL, NULL, NULL, 25, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0026', 'TTS_HSDSTTS_V2', 'Gentle Shanshan', 'saturn_zh_female_wenwanshanshan_cs_tob', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/ICL_zh_female_wenwanshanshan_cs_tob.mp3', NULL, NULL, NULL, 26, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0027', 'TTS_HSDSTTS_V2', 'Dominant Uncle', 'zh_male_baqiqingshu_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_baqiqingshu_uranus_bigtts.mp3', NULL, NULL, NULL, 27, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0028', 'TTS_HSDSTTS_V2', 'Suspense Narrator', 'zh_male_xuanyijieshuo_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_xuanyijieshuo_uranus_bigtts.mp3', NULL, NULL, NULL, 28, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0029', 'TTS_HSDSTTS_V2', 'Ancient Style Lady', 'zh_female_gufengshaoyu_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_gufengshaoyu_uranus_bigtts.mp3', NULL, NULL, NULL, 29, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_HSDSTTS_V2_0030', 'TTS_HSDSTTS_V2', 'Tang Seng', 'zh_male_tangseng_uranus_bigtts', 'Mandarin, English', 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_tangseng_uranus_bigtts.mp3', NULL, NULL, NULL, 30, NULL, NULL, NULL, NULL);
