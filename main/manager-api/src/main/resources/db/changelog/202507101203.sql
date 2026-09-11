-- OpenAI ASR model provider
delete from `ai_model_provider` where id = 'SYSTEM_ASR_OpenaiASR';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_OpenaiASR', 'ASR', 'openai', 'OpenAISpeech Recognition', '[{"key": "base_url", "type": "string", "label": "Base URL"}, {"key": "model_name", "type": "string", "label": "Model name"}, {"key": "api_key", "type": "string", "label": "API Key"}, {"key": "output_dir", "type": "string", "label": "Output directory"}]', 9, 1, NOW(), 1, NOW());


-- OpenAI ASR model configuration
delete from `ai_model_config` where id = 'ASR_OpenaiASR';
INSERT INTO `ai_model_config` VALUES ('ASR_OpenaiASR', 'ASR', 'OpenaiASR', 'OpenAISpeech Recognition', 0, 1, '{\"type\": \"openai\", \"api_key\": \"\", \"base_url\": \"https://api.openai.com/v1/audio/transcriptions\", \"model_name\": \"gpt-4o-mini-transcribe\", \"output_dir\": \"tmp/\"}', NULL, NULL, 9, NULL, NULL, NULL, NULL);

-- groq ASR model configuration
delete from `ai_model_config` where id = 'ASR_GroqASR';
INSERT INTO `ai_model_config` VALUES ('ASR_GroqASR', 'ASR', 'GroqASR', 'GroqSpeech Recognition', 0, 1, '{\"type\": \"openai\", \"api_key\": \"\", \"base_url\": \"https://api.groq.com/openai/v1/audio/transcriptions\", \"model_name\": \"whisper-large-v3-turbo\", \"output_dir\": \"tmp/\"}', NULL, NULL, 10, NULL, NULL, NULL, NULL);


-- Update OpenAI ASR configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://platform.openai.com/docs/api-reference/audio/createTranscription',
`remark` = 'OpenAI ASRConfiguration Instructions:
1. needs to be inOpenAIcreate an organization and obtain on the open platformapi_key
2. Supports Chinese, EN, JP, Korean and other speech recognition, Refer to documentation for detailshttps://platform.openai.com/docs/guides/speech-to-text
3. Requires network connection
4. Output files are saved in tmp/ directory
Application Steps:
**OpenAi ASRApplication Steps:**
1.Log inOpenAI Platform。https://auth.openai.com/log-in
2.Createapi-key https://platform.openai.com/settings/organization/api-keys
3.Model can selectgpt-4o-transcribeorGPT-4o mini Transcribe
' WHERE `id` = 'ASR_OpenaiASR';

-- Update Groq ASR configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.groq.com/docs/speech-to-text',
`remark` = 'Groq ASRConfiguration Instructions:
1.Log ingroq Console。https://console.groq.com/home
2.Createapi-key https://console.groq.com/keys
3.Model can selectwhisper-large-v3-turboorwhisper-large-v3 (distil-whisper-large-v3-enOnly supportsEnglishTranscription) 
' WHERE `id` = 'ASR_GroqASR';