-- Update HuoshanDoubleStreamTTS provider config: change scattered parameters to JSON dictionary
-- Consolidate speech_rate, loudness_rate, pitch, emotion, emotion_scale into audio_params, additions, mix_speaker JSON dictionaries

UPDATE `ai_model_provider`
SET `fields` = '[
{"key": "ws_url", "type": "string", "label": "WebSocket Address"},
{"key": "appid", "type": "string", "label": "App ID"},
{"key": "access_token", "type": "string", "label": "Access Token"},
{"key": "resource_id", "type": "string", "label": "Resource ID"},
{"key": "speaker", "type": "string", "label": "Default voice"},
{"key": "enable_ws_reuse", "type": "boolean", "label": "Enable connection reuse", "default": true},
{"key": "audio_params", "type": "dict", "label": "Audio output configuration"},
{"key": "additions", "type": "dict", "label": "Advanced text processing config"},
{"key": "mix_speaker", "type": "dict", "label": "Mixing control config"}
]'
WHERE `id` = 'SYSTEM_TTS_HSDSTTS';

-- Update existing config: migrate old scattered parameters to new JSON dictionary structure
UPDATE `ai_model_config`
SET `config_json` = JSON_SET(
`config_json`,
'$.audio_params', JSON_OBJECT(
'speech_rate', CAST(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`config_json`, '$.speech_rate')), ''), '0') AS SIGNED),
'loudness_rate', CAST(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`config_json`, '$.loudness_rate')), ''), '0') AS SIGNED)
),
'$.additions', JSON_OBJECT(
'aigc_metadata', JSON_OBJECT(),
'cache_config', JSON_OBJECT(),
'post_process', JSON_OBJECT(
'pitch', CAST(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`config_json`, '$.pitch')), ''), '0') AS SIGNED)
)
),
'$.mix_speaker', JSON_OBJECT()
)
WHERE `id` = 'TTS_HuoshanDoubleStreamTTS';

-- Delete old scattered parameter fields
UPDATE `ai_model_config`
SET `config_json` = JSON_REMOVE(
`config_json`,
'$.speech_rate',
'$.loudness_rate',
'$.pitch',
'$.emotion',
'$.emotion_scale'
)
WHERE `id` = 'TTS_HuoshanDoubleStreamTTS';

-- Update documentation links and remarks
UPDATE `ai_model_config` SET
`doc_link` = 'https://www.volcengine.com/docs/6561/1329505',
`remark` = 'Volcengine Bidirectional Streaming TTSConfiguration Instructions:
1. Visit https://www.volcengine.com/ Register and activate a Volcengine account
2. Visit https://console.volcengine.com/speech/service/10007 Activate Speech Synthesis Large Model, PurchaseVoice
3. At the bottom of the pageObtain appid and access_token
4. ResourceIDFixed to: volc.service_type.10029 (LLM speech synthesis and mixing) 
5. Connection Reuse: EnableWebSocketConnection Reuse, DefaulttrueReduce connection overhead (Note: When reused, idle connections when the device is listening will consume concurrency quota) 

Detailed documentation:https://www.volcengine.com/docs/6561/1329505
[audio_params]Audio output configuration - Users can customize and add any audio parameters supported by Volcengine
- speech_rate: Speech Rate(-50~100), Default0
- loudness_rate: Volume(-50~100), Default0
- emotion: Emotion Type (Only partialVoiceSupports) , Optional Values: neutral, happy, sad, angry, fearful, disgusted, surprised
- emotion_scale: Emotion Intensity(1~5), Default4
Example: {"speech_rate": 10, "loudness_rate": 5, "emotion": "happy", "emotion_scale": 4}

[additions]Advanced text processing configuration - Users can customize and add any advanced parameters supported by Volcengine
- post_process.pitch: Pitch(-12~12), Default0
- aigc_metadata: AIGCMetadata configuration
- cache_config: Cache Configuration
Example: {"post_process": {"pitch": 2}, "aigc_metadata": {}, "cache_config": {}}

[mix_speaker]Audio mixing control configuration - MultiVoiceMixed (Only TTS 1.0) 
Example: 
{"speakers": [
{"source_speaker": "zh_male_bvlazysheep","mix_factor": 0.3}, 
{"source_speaker": "BV120_streaming","mix_factor": 0.3}, 
{"source_speaker": "zh_male_ahu_conversation_wvae_bigtts","mix_factor": 0.4}
]}

Note: 
- Multi-emotionVoiceParameters (emotion, emotion_scale) Only partialVoiceSupports
- RelatedVoiceList: https://www.volcengine.com/docs/6561/1257544
- Users can follow VolcengineAPIdocumentation to add more parameters yourself
- Mixing feature is mainly applicable to Doubao speech synthesis model1.0Voice, When using, you need toreq_params.speakerSet tocustom_mix_bigtts
'
WHERE `id` = 'TTS_HuoshanDoubleStreamTTS';
