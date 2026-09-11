-- Add MinimaxHTTPStream streaming TTS provider
delete from `ai_model_provider` where id = 'SYSTEM_TTS_MinimaxStreamTTS';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_TTS_MinimaxStreamTTS', 'TTS', 'minimax_httpstream', 'Minimax Streaming Speech Synthesis', '[{"key":"group_id","label":"Group ID","type":"string"},{"key":"api_key","label":"API Key","type":"string"},{"key":"model","label":"Model","type":"string"},{"key":"voice_id","label":"Voice ID","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"},{"key":"voice_setting","label":"Voice setting","type":"dict","dict_name":"voice_setting"},{"key":"pronunciation_dict","label":"Pronunciation dictionary","type":"dict","dict_name":"pronunciation_dict"},{"key":"audio_setting","label":"Audio setting","type":"dict","dict_name":"audio_setting"},{"key":"timber_weights","label":"Voice weights","type":"string"}]', 18, 1, NOW(), 1, NOW());

-- Add Minimax streaming TTS model configuration
delete from `ai_model_config` where id = 'TTS_MinimaxStreamTTS';
INSERT INTO `ai_model_config` VALUES ('TTS_MinimaxStreamTTS', 'TTS', 'MinimaxStreamTTS', 'Minimax Streaming Speech Synthesis', 0, 1, '{"type": "minimax_httpstream", "group_id": "", "api_key": "", "model": "speech-01-turbo", "voice_id": "female-shaonv", "output_dir": "tmp/", "voice_setting": {"speed": 1, "vol": 1, "pitch": 0, "emotion": "happy"}, "pronunciation_dict": {"tone": ["Processing/(chu3)(li3)", "Danger/dangerous"]}, "audio_setting": {"sample_rate": 24000, "bitrate": 128000, "format": "pcm", "channel": 1}}', NULL, NULL, 21, NULL, NULL, NULL, NULL);

-- Update Minimax streaming TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://platform.minimaxi.com/',
`remark` = 'Minimax Streaming TTSConfiguration Instructions:
1. Need to apply firstMinimax API Key
2. Needs to be filledGroup ID
3. Supports multiple voicessettings and audio parameter adjustments
4. Supports realtime streaming synthesis, has lower latency
5. Supports custom pronunciation dictionary andVoiceWeight
6. Hidden parameter configuration: VoiceSettings(voice_setting), Pronunciation Dictionary(pronunciation_dict), VoiceWeight(timber_weights)
- Speech Rate(speed): Range[0.5,2], Default1.0, Higher value means faster speech rate
- Volume(vol): Range(0,10], Default1.0, Higher value means higher volume
- Tone(pitch): Range[-12,12], Default0, Value must be an integer
- Emotion(emotion): Controls emotion of synthesized speech, Supports7types of values: ["happy", "sad", "angry", "fearful", "disgusted", "surprised", "calm"], This parameter is only for speech-2.5-hd-preview, speech-2.5-turbo-preview, speech-02-hd, speech-02-turbo, speech-01-turbo, speech-01-hd Take effect
- timbre_weightsandvoice_idRequired (choose one)
- voice_id(requestedVoiceid, must matchweightFill parameters synchronously)
- weight(Weight, Supports up to4typesVoiceMixed。Range[1,100])
' WHERE `id` = 'TTS_MinimaxStreamTTS';

-- Add Minimax streaming TTS voices
delete from `ai_tts_voice` where tts_model_id = 'TTS_MinimaxStreamTTS';

-- Default voices
