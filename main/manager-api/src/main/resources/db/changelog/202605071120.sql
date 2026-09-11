-- Delete configuration where model_code is GizwitsTTS
DELETE FROM `ai_model_config` WHERE `model_code` = 'GizwitsTTS';

-- Delete associated TTS voice records
DELETE FROM `ai_tts_voice` WHERE `tts_model_id` = 'TTS_GizwitsTTS';
DELETE FROM `ai_tts_voice` WHERE `tts_model_id` = 'TTS_ACGNTTS';
