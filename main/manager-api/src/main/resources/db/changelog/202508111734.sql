-- Update HuoshanDoubleStreamTTS provider: add speech rate, pitch configuration
UPDATE `ai_model_provider`
SET fields = '[{"key": "ws_url", "type": "string", "label": "WebSocket Address"}, {"key": "appid", "type": "string", "label": "App ID"}, {"key": "access_token", "type": "string", "label": "Access Token"}, {"key": "resource_id", "type": "string", "label": "Resource ID"}, {"key": "speaker", "type": "string", "label": "Default voice"}, {"key": "speech_rate", "type": "number", "label": "Speech rate (-50~100)"}, {"key": "loudness_rate", "type": "number", "label": "Volume (-50~100)"}, {"key": "pitch", "type": "number", "label": "Pitch (-12~12)"}]'
WHERE id = 'SYSTEM_TTS_HSDSTTS';

UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/speech/service/10007',
`remark` = 'Volcengine Speech Synthesis ServiceConfiguration Instructions:
1. Visit https://www.volcengine.com/ Register and activate a Volcengine account
2. Visit https://console.volcengine.com/speech/service/10007 Activate Speech Synthesis Large Model, PurchaseVoice
3. At the bottom of the pageObtain appid and access_token
5. ResourceIDFixed to: volc.service_type.10029 (LLM speech synthesis and mixing) 
6. Speech Rate: -50~100, Optional, Normal default value0, Optional-50~100
7. Volume: -50~100, Optional, Normal default value0, Optional-50~100
8. Pitch: -12~12, Optional, Normal default value0, Optional-12~12
9. Fill into the configuration file' WHERE `id` = 'TTS_HuoshanDoubleStreamTTS';