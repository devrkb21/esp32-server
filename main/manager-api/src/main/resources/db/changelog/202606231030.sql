-- Update EdgeTTS provider: add speech rate, pitch, and volume configuration
UPDATE `ai_model_provider`
SET fields = '[{"key":"voice","label":"Voice","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"},{"key":"rate","label":"Speech rate (-100~100)","type":"number"},{"key":"volume","label":"Volume (0~100)","type":"number"},{"key":"pitch","label":"Pitch (-100~100)","type":"number"}]'
WHERE id = 'SYSTEM_TTS_edge';

UPDATE `ai_model_config` SET
`remark` = 'EdgeTTSConfiguration Instructions:
1. Use MicrosoftEdge TTSService
2. Supports MultipleLanguagesandVoice
3. Free to use, no registration required
4. Requires network connection
5. Output files are saved in tmp/ directory
6. Speech Rate: -100~100, 0for normal speed
7. Volume: 0~100, 50for normal volume
8. Tone: -100~100, 0for normal pitch' WHERE `id` = 'TTS_EdgeTTS';
