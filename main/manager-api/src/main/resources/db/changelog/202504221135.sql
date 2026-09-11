-- Delete obsolete model provider
delete from `ai_model_provider` where id = 'SYSTEM_LLM_doubao';
delete from `ai_model_provider` where id = 'SYSTEM_LLM_chatglm';
delete from `ai_model_provider` where id = 'SYSTEM_TTS_302ai';
delete from `ai_model_provider` where id = 'SYSTEM_TTS_gizwits';

-- Add model provider
delete from `ai_model_provider` where id = 'SYSTEM_ASR_TencentASR';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_TencentASR', 'ASR', 'tencent', 'Tencent Speech Recognition', '[{"key":"appid","label":"App ID","type":"string"},{"key":"secret_id","label":"Secret ID","type":"string"},{"key":"secret_key","label":"Secret Key","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"}]', 4, 1, NOW(), 1, NOW());

-- Add Tencent TTS model provider
delete from `ai_model_provider` where id = 'SYSTEM_TTS_TencentTTS';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_TTS_TencentTTS', 'TTS', 'tencent', 'Tencent Speech Synthesis', '[{"key":"appid","label":"App ID","type":"string"},{"key":"secret_id","label":"Secret ID","type":"string"},{"key":"secret_key","label":"Secret Key","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"},{"key":"region","label":"Region","type":"string"},{"key":"voice","label":"Voice ID","type":"string"}]', 5, 1, NOW(), 1, NOW());


-- Add edge voices
delete from `ai_tts_voice` where id in ('TTS_EdgeTTS0001', 'TTS_EdgeTTS0002', 'TTS_EdgeTTS0003', 'TTS_EdgeTTS0004', 'TTS_EdgeTTS0005', 'TTS_EdgeTTS0006', 'TTS_EdgeTTS0007', 'TTS_EdgeTTS0008', 'TTS_EdgeTTS0009', 'TTS_EdgeTTS0010', 'TTS_EdgeTTS0011', 'TTS_EdgeTTS0012', 'TTS_EdgeTTS0013');
INSERT INTO `ai_tts_voice` VALUES 
('TTS_EdgeTTS0001', 'TTS_EdgeTTS', 'Jenny (US Female)', 'en-US-JennyNeural', 'English', '/voice-demos/en-US-JennyNeural.mp3', NULL, 1, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0002', 'TTS_EdgeTTS', 'Guy (US Male)', 'en-US-GuyNeural', 'English', '/voice-demos/en-US-GuyNeural.mp3', NULL, 2, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0003', 'TTS_EdgeTTS', 'Aria (US Female)', 'en-US-AriaNeural', 'English', '/voice-demos/en-US-AriaNeural.mp3', NULL, 3, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0004', 'TTS_EdgeTTS', 'Christopher (US)', 'en-US-ChristopherNeural', 'English', '/voice-demos/en-US-ChristopherNeural.mp3', NULL, 4, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0005', 'TTS_EdgeTTS', 'Sonia (UK Female)', 'en-GB-SoniaNeural', 'English', '/voice-demos/en-GB-SoniaNeural.mp3', NULL, 5, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0006', 'TTS_EdgeTTS', 'Ryan (UK Male)', 'en-GB-RyanNeural', 'English', '/voice-demos/en-GB-RyanNeural.mp3', NULL, 6, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0007', 'TTS_EdgeTTS', 'Ana (US Child)', 'en-US-AnaNeural', 'English', '/voice-demos/en-US-AnaNeural.mp3', NULL, 7, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0008', 'TTS_EdgeTTS', 'Eric (US Male)', 'en-US-EricNeural', 'English', '/voice-demos/en-US-EricNeural.mp3', NULL, 8, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0009', 'TTS_EdgeTTS', 'Michelle (US)', 'en-US-MichelleNeural', 'English', '/voice-demos/en-US-MichelleNeural.mp3', NULL, 9, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0010', 'TTS_EdgeTTS', 'Nabanita (BD Female)', 'bn-BD-NabanitaNeural', 'Bengali', '/voice-demos/bn-BD-NabanitaNeural.mp3', NULL, 10, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0011', 'TTS_EdgeTTS', 'Pradeep (BD Male)', 'bn-BD-PradeepNeural', 'Bengali', '/voice-demos/bn-BD-PradeepNeural.mp3', NULL, 11, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0012', 'TTS_EdgeTTS', 'Tanishaa (IN Female)', 'bn-IN-TanishaaNeural', 'Bengali', '/voice-demos/bn-IN-TanishaaNeural.mp3', NULL, 12, NULL, NULL, NULL, NULL),
('TTS_EdgeTTS0013', 'TTS_EdgeTTS', 'Bashkar (IN Male)', 'bn-IN-BashkarNeural', 'Bengali', '/voice-demos/bn-IN-BashkarNeural.mp3', NULL, 13, NULL, NULL, NULL, NULL);

-- Doubao TTS voices
delete from `ai_tts_voice` where id in ('TTS_DoubaoTTS0001', 'TTS_DoubaoTTS0002', 'TTS_DoubaoTTS0003', 'TTS_DoubaoTTS0004', 'TTS_DoubaoTTS0005');

-- Fix CosyVoiceSiliconflow voice
delete from `ai_tts_voice` where id in ('TTS_CosyVoiceSiliconflow0001', 'TTS_CosyVoiceSiliconflow0002');
INSERT INTO `ai_tts_voice` VALUES ('TTS_CosyVoiceSiliconflow0001', 'TTS_CosyVoiceSiliconflow', 'CosyVoice Male', 'FunAudioLLM/CosyVoice2-0.5B:alex', 'English', NULL, NULL, 6, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_CosyVoiceSiliconflow0002', 'TTS_CosyVoiceSiliconflow', 'CosyVoice Female', 'FunAudioLLM/CosyVoice2-0.5B:bella', 'English', NULL, NULL, 6, NULL, NULL, NULL, NULL);

-- CozeCn TTS voices
delete from `ai_tts_voice` where id = 'TTS_CozeCnTTS0001';

-- Minimax TTS voices
delete from `ai_tts_voice` where id = 'TTS_MinimaxTTS0001';

-- Aliyun TTS voices
delete from `ai_tts_voice` where id = 'TTS_AliyunTTS0001';

-- TTS 302AI voices
delete from `ai_tts_voice` where id = 'TTS_TTS302AI0001';

-- Gizwits TTS voices
delete from `ai_tts_voice` where id = 'TTS_GizwitsTTS0001';

-- ACGN TTS voices
delete from `ai_tts_voice` where id = 'TTS_ACGNTTS0001';

-- OpenAI TTS voices
delete from `ai_tts_voice` where id = 'TTS_OpenAITTS0001';
INSERT INTO `ai_tts_voice` VALUES ('TTS_OpenAITTS0001', 'TTS_OpenAITTS', 'OpenAI Male', 'onyx', 'English', NULL, NULL, 13, NULL, NULL, NULL, NULL);

-- Add Tencent TTS voices
delete from `ai_tts_voice` where id = 'TTS_TencentTTS0001';

-- Other voices
delete from `ai_tts_voice` where id = 'TTS_FishSpeech0000';
INSERT INTO `ai_tts_voice` VALUES ('TTS_FishSpeech0000', 'TTS_FishSpeech', '', '', 'English', '', NULL, 8, NULL, NULL, NULL, NULL);

delete from `ai_tts_voice` where id = 'TTS_GPT_SOVITS_V20000';
INSERT INTO `ai_tts_voice` VALUES ('TTS_GPT_SOVITS_V20000', 'TTS_GPT_SOVITS_V2', '', '', 'English', '', NULL, 8, NULL, NULL, NULL, NULL);

delete from `ai_tts_voice` where id in ('TTS_GPT_SOVITS_V30000', 'TTS_CustomTTS0000');
INSERT INTO `ai_tts_voice` VALUES ('TTS_GPT_SOVITS_V30000', 'TTS_GPT_SOVITS_V3', '', '', 'English', '', NULL, 8, NULL, NULL, NULL, NULL);
INSERT INTO `ai_tts_voice` VALUES ('TTS_CustomTTS0000', 'TTS_CustomTTS', '', '', 'English', '', NULL, 8, NULL, NULL, NULL, NULL);

