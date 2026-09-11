-- Update Tencent TTS provider config: add speed, volume, and format parameters
UPDATE `ai_model_provider`
SET fields = '[{"key":"appid","label":"App ID","type":"string"},{"key":"secret_id","label":"Secret ID","type":"string"},{"key":"secret_key","label":"Secret Key","type":"string"},{"key":"format","label":"Audio format","type":"string"},{"key":"speed","label":"Speech rate","type":"number"},{"key":"volume","label":"Volume","type":"number"},{"key":"output_dir","label":"Output directory","type":"string"},{"key":"voice","label":"Voice ID","type":"string"},{"key":"region","label":"Region","type":"string"}]'
WHERE id = 'SYSTEM_TTS_TencentTTS';

-- Update Tencent TTS model config: add speed and volume parameters and documentation
UPDATE `ai_model_config` SET 
`config_json` = JSON_SET(`config_json`, '$.speed', 0, '$.volume', 0),
`remark` = 'TencentTTSConfiguration Instructions:
1. Need to activate Intelligent Speech Interaction on Tencent Cloud platform
2. Supports multiple voices, Current configuration uses101001
3. Requires network connection
4. Output files are saved in tmp/ directory
Application Steps:
1. Visit https://console.cloud.tencent.com/cam/capi Obtain secret key
2. Visit https://console.cloud.tencent.com/tts/resourcebundle Claim free resources
3. Create new application
4. Obtain appid, secret_id, and secret_key
5. Fill into the configuration file
Audio Parameters: 
- format: Audio Format, Supportspcm, wav, mp3
- speed: Speech Rate, Range-2~6, Default0
- volume: Volume, Range-10~10, Default0'
WHERE `id` = 'TTS_TencentTTS';

-- Update CozeCnTTS provider config: add speed and loudness_rate parameters
UPDATE `ai_model_provider`
SET fields = '[{"key":"voice","label":"Voice","type":"string"},{"key":"access_token","label":"Access Token","type":"string"},{"key":"speed","label":"Speech rate","type":"number"},{"key":"loudness_rate","label":"Volume gain","type":"number"},{"key":"output_dir","label":"Output directory","type":"string"},{"key":"response_format","label":"Response format","type":"string"}]'
WHERE id = 'SYSTEM_TTS_cozecn';

-- Update CozeCnTTS model config: add speed and loudness_rate parameters and documentation
UPDATE `ai_model_config` SET 
`config_json` = JSON_SET(`config_json`, '$.speed', 1, '$.loudness_rate', 0),
`remark` = 'CozeChineseSpeech SynthesisConfiguration Instructions:
1. Visit https://www.coze.cn/ Register and log in
2. create an application and obtainaccess_token
3. select suitableVoiceID
Audio Parameters: 
- response_format: Audio Format, Supportspcm, wav, mp3
- speed: Speech Rate, Range0.5~2, Default1
- loudness_rate: Volume Gain, Range-50~100, Default0'
WHERE `id` = 'TTS_CozeCnTTS';
