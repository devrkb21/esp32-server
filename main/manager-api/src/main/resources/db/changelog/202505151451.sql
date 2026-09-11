-- Modify custom TTS API request definition
update `ai_model_provider` set `fields` =
'[{"key":"url","label":"Service address","type":"string"},{"key":"method","label":"Request method","type":"string"},{"key":"params","label":"Request parameters","type":"dict","dict_name":"params"},{"key":"headers","label":"Request headers","type":"dict","dict_name":"headers"},{"key":"format","label":"Audio format","type":"string"},{"key":"output_dir","label":"Output directory","type":"string"}]'
where `id` = 'SYSTEM_TTS_custom';

-- Modify custom TTS configuration instructions
UPDATE `ai_model_config` SET
`doc_link` = NULL,
`remark` = 'CustomTTSConfiguration Instructions:
1. customTTSAPI Service, Request parameters can be customized, Can connect to manyTTSService
2. using locally deployedKokoroTTSas example
3. If there is onlycpuRun: docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
4. If there is onlygpuRun: docker run --gpus all -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-gpu:latest
Configuration Instructions:
1. inparamsconfigure request parameters in,UseJSONFormat
For exampleKokoroTTS: { "input": "{prompt_text}", "speed": 1, "voice": "zm_yunxi", "stream": true, "download_format": "mp3", "response_format": "mp3", "return_download_link": true }
2. inheadersconfigure request headers in
3. Set returned audio format' WHERE `id` = 'TTS_CustomTTS';