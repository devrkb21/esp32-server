-- VOSK ASR model provider
delete from `ai_model_provider` where id = 'SYSTEM_ASR_VoskASR';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_VoskASR', 'ASR', 'vosk', 'VOSKOffline Speech Recognition', '[{"key": "model_path", "type": "string", "label": "Model path"}, {"key": "output_dir", "type": "string", "label": "Output directory"}]', 11, 1, NOW(), 1, NOW());

-- VOSK ASR model configuration
delete from `ai_model_config` where id = 'ASR_VoskASR';
INSERT INTO `ai_model_config` VALUES ('ASR_VoskASR', 'ASR', 'VoskASR', 'VOSKOffline Speech Recognition', 0, 1, '{\"type\": \"vosk\", \"model_path\": \"\", \"output_dir\": \"tmp/\"}', NULL, NULL, 11, NULL, NULL, NULL, NULL);

-- Update VOSK ASR configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://alphacephei.com/vosk/',
`remark` = 'VOSK ASRConfiguration Instructions:
1. VOSKis an offline speech recognition library, Supports MultipleLanguages
2. Model files need to be downloaded first: https://alphacephei.com/vosk/models
3. ChineseModel recommended to usevosk-model-small-cn-0.22orvosk-model-cn-0.22
4. Runs completely offline, No network connection required
5. Output files are saved in tmp/ directory
Usage Steps: 
1. Visit https://alphacephei.com/vosk/models DownloadChineseModel
2. Extract model files to project directory under models/vosk/Folder
3. Specify correct model path in configuration
4. Note: VOSKChineseModel output does not include punctuation, there will be spaces between words
' WHERE `id` = 'ASR_VoskASR';