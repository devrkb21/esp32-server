-- Delete provider where provider_code is ttson
DELETE FROM `ai_model_provider` WHERE `provider_code` = 'ttson';

-- Delete configuration where model_code is ACGNTTS
DELETE FROM `ai_model_config` WHERE `model_code` = 'ACGNTTS';
