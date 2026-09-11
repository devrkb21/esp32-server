-- Add language configuration for local FunASR ASR.
UPDATE `ai_model_provider`
SET `fields` = '[{"key":"model_dir","label":"Model directory","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"},{"key":"language","label":"RecognitionLanguages","type":"string","default":"auto"}]'
WHERE `id` = 'SYSTEM_ASR_FunASR';

UPDATE `ai_model_config`
SET `config_json` = JSON_SET(`config_json`, '$.language', 'auto')
WHERE `id` = 'ASR_FunASR'
AND JSON_EXTRACT(`config_json`, '$.language') IS NULL;

-- Update the FunASR local model configuration description to mention the language option.
UPDATE `ai_model_config`
SET `remark` = 'FunASRLocal ModelConfiguration Instructions:
1. Model files need to be downloaded toxiaozhi-server/models/SenseVoiceSmallDirectory
2. Supports Chinese, Japanese, KoreanCantoneseSpeech Recognition
3. Local inference, No network connection required
4. Audio files to recognize are stored in tmp/ directory
5. "RecognitionLanguages"field controls recognized language: auto = Auto detect; If you need to restrict recognition to onlyChineseCan be set to zh (en=English, ja=Japanese, ko=Korean, yue=Cantonese) .'
WHERE `id` = 'ASR_FunASR';
