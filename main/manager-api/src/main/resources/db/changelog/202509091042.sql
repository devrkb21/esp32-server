-- Delete non-streaming MiniMax TTS config, keep streaming version

-- Delete old non-streaming MiniMax TTS model configuration
DELETE FROM `ai_model_config` WHERE `id` = 'TTS_MinimaxTTS';

-- Delete old non-streaming MiniMax TTS provider configuration
DELETE FROM `ai_model_provider` WHERE `id` = 'SYSTEM_TTS_minimax';

-- Delete old non-streaming MiniMax TTS voice configuration
DELETE FROM `ai_tts_voice` WHERE `tts_model_id` = 'TTS_MinimaxTTS';
