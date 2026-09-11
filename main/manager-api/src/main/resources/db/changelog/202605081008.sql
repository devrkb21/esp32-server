-- Delete provider configuration where provider_code is linkerai
DELETE FROM `ai_model_provider` WHERE `provider_code` = 'linkerai';

-- Delete model configuration where model_code is LinkeraiTTS
DELETE FROM `ai_model_config` WHERE `model_code` = 'LinkeraiTTS';

-- Delete TTS voice records associated with LinkeraiTTS
DELETE FROM `ai_tts_voice` WHERE `tts_model_id` = 'TTS_LinkeraiTTS';
