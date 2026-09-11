-- Add FunASR service speech recognition provider and configuration
DELETE FROM `ai_model_provider` WHERE `id` = 'SYSTEM_ASR_FunASRServer';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_ASR_FunASRServer', 'ASR', 'fun_server', 'FunASR Service Speech Recognition', '[{"key":"host","label":"Service address","type":"string"},{"key":"port","label":"Port number","type":"number"}]', 4, 1, NOW(), 1, NOW());

DELETE FROM `ai_model_config` WHERE `id` = 'ASR_FunASRServer';
INSERT INTO `ai_model_config` VALUES ('ASR_FunASRServer', 'ASR', 'FunASRServer', 'FunASR Service Speech Recognition', 0, 1, '{\"type\": \"fun_server\", \"host\": \"127.0.0.1\", \"port\": 10096}', NULL, NULL, 5, NULL, NULL, NULL, NULL);

-- Change remark column type in ai_model_config to TEXT
ALTER TABLE `ai_model_config` MODIFY COLUMN `remark` TEXT COMMENT 'Remark'; 

-- Update documentation for ASR model configuration
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/modelscope/FunASR/blob/main/runtime/docs/SDK_advanced_guide_online_zh.md',
`remark` = 'Standalone FunASR deployment using FunASR API service in five commands:
1. mkdir -p ./funasr-runtime-resources/models
2. sudo docker run -d -p 10096:10095 --privileged=true -v $PWD/funasr-runtime-resources/models:/workspace/models registry.cn-hangzhou.aliyuncs.com/funasr_repo/funasr:funasr-runtime-sdk-online-cpu-0.1.12
3. cd FunASR/runtime
4. nohup bash run_server_2pass.sh --download-model-dir /workspace/models --vad-dir damo/speech_fsmn_vad_zh-cn-16k-common-onnx --model-dir damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-onnx --online-model-dir damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online-onnx --punc-dir damo/punc_ct-transformer_zh-cn-common-vad_realtime-vocab272727-onnx --lm-dir damo/speech_ngram_lm_zh-cn-ai-wesp-fst --itn-dir thuduj12/fst_itn_zh --hotword /workspace/models/hotwords.txt > log.txt 2>&1 &
5. tail -f log.txt
For GPU inference details refer to: https://github.com/modelscope/FunASR/blob/main/runtime/docs/SDK_advanced_guide_online_zh.md' WHERE `id` = 'ASR_FunASRServer';

-- Update FunASR local model configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/modelscope/FunASR',
`remark` = 'FunASR local model configuration instructions:
1. Download model files to xiaozhi-server/models/SenseVoiceSmall directory
2. Supports Chinese, Japanese, Korean, and Cantonese speech recognition
3. Local inference, no internet connection required
4. Audio files to recognize are stored in tmp/ directory' WHERE `id` = 'ASR_FunASR';

-- Update SherpaASR configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/k2-fsa/sherpa-onnx',
`remark` = 'SherpaASR configuration instructions:
1. Automatically downloads model files to models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 on runtime
2. Supports Chinese, English, Japanese, Korean, Cantonese and other languages
3. Local inference, no internet connection required
4. Output files are saved in tmp/ directory' WHERE `id` = 'ASR_SherpaASR';

-- Update Doubao ASR configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/speech/app',
`remark` = 'Doubao ASR configuration instructions:
1. Create an application in Volcengine console to obtain appid and access_token
2. Supports Chinese speech recognition
3. Requires internet connection
4. Output files are saved in tmp/ directory
Application steps:
1. Visit https://console.volcengine.com/speech/app
2. Create new application
3. Obtain appid and access_token
4. Fill into the configuration file' WHERE `id` = 'ASR_DoubaoASR';

-- Update Tencent ASR configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.cloud.tencent.com/cam/capi',
`remark` = 'Tencent ASR configuration instructions:
1. Create an application in Tencent Cloud console to obtain appid, secret_id, and secret_key
2. Supports Chinese speech recognition
3. Requires internet connection
4. Output files are saved in tmp/ directory
Application steps:
1. Visit https://console.cloud.tencent.com/cam/capi to obtain secret keys
2. Visit https://console.cloud.tencent.com/asr/resourcebundle to claim free resources
3. Obtain appid, secret_id, and secret_key
4. Fill into the configuration file' WHERE `id` = 'ASR_TencentASR';

-- Update TTS model configuration instructions
-- Edge TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/rany2/edge-tts',
`remark` = 'EdgeTTS configuration instructions:
1. Uses Microsoft Edge TTS service
2. Supports multiple languages and voices
3. Free to use, no registration required
4. Requires internet connection
5. Output files are saved in tmp/ directory' WHERE `id` = 'TTS_EdgeTTS';

-- Doubao TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/speech/service/8',
`remark` = 'Doubao TTS configuration instructions:
1. Visit https://console.volcengine.com/speech/service/8
2. Create an application in Volcengine console to obtain appid and access_token
3. Volcengine speech services require purchase. Starting at 30 RMB for 100 concurrency (free tier has only 2 concurrency and may trigger TTS errors)
4. After purchasing service and voice packs, wait about 30 minutes before use
5. Fill into the configuration file' WHERE `id` = 'TTS_DoubaoTTS';

-- SiliconFlow TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://cloud.siliconflow.cn/account/ak',
`remark` = 'SiliconFlow TTS configuration instructions:
1. Visit https://cloud.siliconflow.cn/account/ak
2. Register and obtain API Key
3. Fill into the configuration file' WHERE `id` = 'TTS_CosyVoiceSiliconflow';

-- Coze Chinese TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://www.coze.cn/open/oauth/pats',
`remark` = 'Coze Chinese TTS configuration instructions:
1. Visit https://www.coze.cn/open/oauth/pats
2. Obtain personal access token
3. Fill into the configuration file' WHERE `id` = 'TTS_CozeCnTTS';

-- FishSpeech configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/fishaudio/fish-speech',
`remark` = 'FishSpeech configuration instructions:
1. Requires local FishSpeech service deployment
2. Supports custom voices
3. Local inference, no internet connection required
4. Output files are saved in tmp/ directory
5. Example launch command: python -m tools.api_server --listen 0.0.0.0:8080 --llama-checkpoint-path "checkpoints/fish-speech-1.5" --decoder-checkpoint-path "checkpoints/fish-speech-1.5/firefly-gan-vq-fsq-8x1024-21hz-generator.pth" --decoder-config-name firefly_gan_vq --compile' WHERE `id` = 'TTS_FishSpeech';

-- GPT-SoVITS V2 configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/RVC-Boss/GPT-SoVITS',
`remark` = 'GPT-SoVITS V2 configuration instructions:
1. Requires local GPT-SoVITS V2 service deployment
2. Supports custom voice cloning
3. Local inference, no internet connection required
4. Output files are saved in tmp/ directory
5. Example API launch command: python api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml' WHERE `id` = 'TTS_GPT_SOVITS_V2';

-- GPT-SoVITS V3 configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/RVC-Boss/GPT-SoVITS',
`remark` = 'GPT-SoVITS V3 configuration instructions:
1. Requires local GPT-SoVITS V3 service deployment
2. Supports custom voice cloning with improved naturalness
3. Local inference, no internet connection required
4. Output files are saved in tmp/ directory
5. Example API launch command: python api_v3.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml' WHERE `id` = 'TTS_GPT_SOVITS_V3';

-- MiniMax TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://platform.minimaxi.com/',
`remark` = 'MiniMax TTS configuration instructions:
1. Create account and recharge on MiniMax platform
2. Supports multiple voices, current config uses female-shaonv
3. Requires internet connection
4. Output files are saved in tmp/ directory
Application steps:
1. Visit https://platform.minimaxi.com/ to register
2. Visit https://platform.minimaxi.com/user-center/payment/balance to recharge
3. Visit https://platform.minimaxi.com/user-center/basic-information to obtain group_id
4. Visit https://platform.minimaxi.com/user-center/basic-information/interface-key to obtain api_key
5. Fill into the configuration file' WHERE `id` = 'TTS_MinimaxTTS';

-- Aliyun TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://nls-portal.console.aliyun.com/',
`remark` = 'Aliyun TTS configuration instructions:
1. Activate Intelligent Speech Interaction on Aliyun platform
2. Supports multiple voices, current config uses xiaoyun
3. Requires internet connection
4. Output files are saved in tmp/ directory
Application steps:
1. Visit https://nls-portal.console.aliyun.com/ to activate service
2. Visit https://nls-portal.console.aliyun.com/applist to obtain appkey
3. Visit https://nls-portal.console.aliyun.com/overview to obtain token
4. Fill into the configuration file
Note: Tokens expire in 24 hours. For long-term use configure access_key_id and access_key_secret' WHERE `id` = 'TTS_AliyunTTS';

-- Tencent TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.cloud.tencent.com/cam/capi',
`remark` = 'Tencent TTS configuration instructions:
1. Activate Intelligent Speech Interaction on Tencent Cloud platform
2. Supports multiple voices, current config uses 101001
3. Requires internet connection
4. Output files are saved in tmp/ directory
Application steps:
1. Visit https://console.cloud.tencent.com/cam/capi to obtain secret keys
2. Visit https://console.cloud.tencent.com/tts/resourcebundle to claim free resources
3. Create new application
4. Obtain appid, secret_id, and secret_key
5. Fill into the configuration file' WHERE `id` = 'TTS_TencentTTS';

-- 302AI TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://dash.302.ai/',
`remark` = '302AI TTS configuration instructions:
1. Visit https://302.ai/ to register account
2. Generate API Key in control panel
3. Supports multiple models and voices
4. Output files are saved in tmp/ directory
5. Fill into the configuration file' WHERE `id` = 'TTS_TTS302AI';

-- Gizwits TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://agentrouter.gizwitsapi.com/panel/token',
`remark` = 'Gizwits TTS configuration instructions:
1. Supports Gizwits platform speech synthesis
2. Requires corresponding account and credentials
3. Output files are saved in tmp/ directory' WHERE `id` = 'TTS_GizwitsTTS';

-- ACGN TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://acgn.ttson.cn/',
`remark` = 'ACGN TTS configuration instructions:
1. Anime-style voice synthesis model
2. Supports multiple anime character voices
3. Output files are saved in tmp/ directory' WHERE `id` = 'TTS_ACGNTTS';

-- OpenAI TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://platform.openai.com/api-keys',
`remark` = 'OpenAI TTS configuration instructions:
1. Uses OpenAI Audio Speech API
2. Supports alloy, echo, fable, onyx, nova, shimmer voices
3. High quality natural audio synthesis
4. Output files are saved in tmp/ directory' WHERE `id` = 'TTS_OpenAITTS';

-- Custom TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = NULL,
`remark` = 'Custom TTS configuration instructions:
1. Custom TTS HTTP endpoint service
2. Can integrate with any third-party or local TTS service (e.g. Kokoro, ChatTTS)
3. Output files are saved in tmp/ directory' WHERE `id` = 'TTS_CustomTTS';

-- Volcengine Edge Gateway TTS configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/vei/aigateway/',
`remark` = 'Volcengine Edge Gateway TTS configuration instructions:
1. Uses Volcengine AI Gateway speech synthesis service
2. High availability and low latency routing
3. Fill in gateway API Key and parameters' WHERE `id` = 'TTS_VolcesAiGatewayTTS';

-- Update LLM model configuration instructions
-- ChatGLM configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys',
`remark` = 'ChatGLM configuration instructions:
1. Visit https://bigmodel.cn/ to register Zhipu AI platform
2. Obtain API Key from console
3. Supports glm-4, glm-4-flash, and other models' WHERE `id` = 'LLM_ChatGLMLLM';

-- Ollama configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://ollama.com/',
`remark` = 'Ollama configuration instructions:
1. Install and run Ollama locally: https://ollama.com/
2. Pull desired models: e.g. ollama run llama3
3. Default base URL: http://localhost:11434/v1
4. Completely local and offline' WHERE `id` = 'LLM_OllamaLLM';

-- Tongyi Qianwen configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
`remark` = 'Tongyi Qianwen configuration instructions:
1. Visit https://bailian.console.aliyun.com/ to obtain DashScope API Key
2. Supports qwen-turbo, qwen-plus, qwen-max, etc.' WHERE `id` = 'LLM_AliLLM';

-- Tongyi Bailian configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
`remark` = 'Tongyi Bailian App configuration instructions:
1. Create an Application in Aliyun Bailian console
2. Obtain App ID and API Key
3. Supports custom prompt and knowledge base integration' WHERE `id` = 'LLM_AliAppLLM';

-- Doubao LLM configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement',
`remark` = 'Doubao LLM configuration instructions:
1. Visit https://console.volcengine.com/ark to register Volcengine Ark platform
2. Create inference endpoint to obtain Endpoint ID
3. Fill into the configuration file' WHERE `id` = 'LLM_DoubaoLLM';

-- DeepSeek configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://platform.deepseek.com/',
`remark` = 'DeepSeek configuration instructions:
1. Visit https://platform.deepseek.com/ to register account
2. Create API Key in console
3. Supports deepseek-chat and deepseek-reasoner' WHERE `id` = 'LLM_DeepSeekLLM';

-- Dify configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://cloud.dify.ai/',
`remark` = 'Dify configuration instructions:
1. Deploy or register on Dify platform: https://dify.ai/
2. Create an agent application and generate API Secret Key
3. Set base URL to your Dify instance API endpoint' WHERE `id` = 'LLM_DifyLLM';

-- Gemini configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://aistudio.google.com/apikey',
`remark` = 'Gemini configuration instructions:
1. Visit https://aistudio.google.com/ to obtain Gemini API Key
2. Supports gemini-1.5-flash, gemini-1.5-pro, etc.' WHERE `id` = 'LLM_GeminiLLM';

-- Coze configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://www.coze.cn/open/oauth/pats',
`remark` = 'Coze configuration instructions:
1. Visit https://www.coze.com/ or https://www.coze.cn/
2. Create a Bot and publish it as an API
3. Obtain Bot ID and Personal Access Token' WHERE `id` = 'LLM_CozeLLM';

-- LM Studio configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://lmstudio.ai/',
`remark` = 'LM Studio configuration instructions:
1. Download and run LM Studio locally: https://lmstudio.ai/
2. Start the local server on port 1234
3. Default base URL: http://localhost:1234/v1' WHERE `id` = 'LLM_LMStudioLLM';

-- FastGPT configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://cloud.tryfastgpt.ai/account/apikey',
`remark` = 'FastGPT configuration instructions:
1. Deploy or register on FastGPT platform: https://fastgpt.in/
2. Create an application and obtain API Key
3. Set base URL to FastGPT API endpoint' WHERE `id` = 'LLM_FastgptLLM';

-- Xinference configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/xorbitsai/inference',
`remark` = 'Xinference configuration instructions:
1. Deploy Xinference cluster locally: https://inference.readthedocs.io/
2. Launch models via Xinference web UI or CLI
3. Set base URL to http://<host>:<port>/v1' WHERE `id` = 'LLM_XinferenceLLM';

-- Xinference small model configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/xorbitsai/inference',
`remark` = 'Xinference small model configuration instructions:
1. Deploy smaller quantized models on Xinference for fast reasoning
2. Low latency edge inference' WHERE `id` = 'LLM_XinferenceSmallLLM';

-- Volcengine Edge Gateway LLM configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://console.volcengine.com/vei/aigateway/',
`remark` = 'Volcengine Edge Gateway LLM configuration instructions:
1. Connect via Volcengine AI Gateway
2. Fill in gateway endpoint and API Key' WHERE `id` = 'LLM_VolcesAiGatewayLLM';

-- Update Memory model configuration instructions
-- No-memory configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = NULL,
`remark` = 'No-memory configuration instructions:
1. Disables session memory persistence
2. Each dialogue turn is processed independently without context history' WHERE `id` = 'Memory_nomem';

-- Local short-term memory configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = NULL,
`remark` = 'Local short-term memory configuration instructions:
1. Stores conversation history in local memory/cache
2. Summarizes context within recent dialogue turns' WHERE `id` = 'Memory_mem_local_short';

-- Mem0AI memory configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://app.mem0.ai/dashboard/api-keys',
`remark` = 'Mem0AI memory configuration instructions:
1. Visit https://mem0.ai/ to obtain API Key
2. Provides intelligent long-term and short-term memory persistence across sessions' WHERE `id` = 'Memory_mem0ai';

-- Update Intent model configuration instructions
-- No-intent recognition configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = NULL,
`remark` = 'No-intent recognition configuration instructions:
1. Directly forwards all transcribed text to LLM without intent pre-filtering' WHERE `id` = 'Intent_nointent';

-- LLM intent recognition configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = NULL,
`remark` = 'LLM intent recognition configuration instructions:
1. Uses a dedicated lightweight LLM prompt to classify user intent before dispatching' WHERE `id` = 'Intent_intent_llm';

-- Function call intent recognition configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = NULL,
`remark` = 'Function calling intent recognition configuration instructions:
1. Uses LLM native function-calling capabilities to detect tools and actions
2. Recommended for complex agent workflows' WHERE `id` = 'Intent_function_call';

-- Update VAD model configuration instructions
-- SileroVAD configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = 'https://github.com/snakers4/silero-vad',
`remark` = 'SileroVAD configuration instructions:
1. Local lightweight Voice Activity Detection model
2. Detects speech onset and offset accurately with minimal CPU usage' WHERE `id` = 'VAD_SileroVAD';
