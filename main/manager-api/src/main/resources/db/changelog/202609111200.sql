-- Migrate existing database records from Chinese to English
-- 1. ai_model_config model names
UPDATE `ai_model_config` SET `model_name` = 'Voice Activity Detection', `config_json` = JSON_SET(`config_json`, '$.model_dir', 'models/snakers4_silero-vad') WHERE `id` = 'VAD_SileroVAD';
UPDATE `ai_model_config` SET `model_name` = 'FunASR Speech Recognition' WHERE `id` = 'ASR_FunASR' OR `model_name` LIKE '%FunASR语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Sherpa Speech Recognition' WHERE `id` = 'ASR_SherpaASR' OR `model_name` LIKE '%Sherpa语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Speech Recognition' WHERE `id` = 'ASR_DoubaoASR' OR `model_name` LIKE '%豆包语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Tencent Speech Recognition' WHERE `id` = 'ASR_TencentASR' OR `model_name` LIKE '%腾讯语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'FunASR Service Speech Recognition' WHERE `id` = 'ASR_FunASRServer' OR `model_name` LIKE '%FunASR服务语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Alibaba Cloud Speech Recognition' WHERE `id` = 'ASR_AliyunASR' OR `model_name` LIKE '%阿里云语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Baidu Speech Recognition' WHERE `id` = 'ASR_BaiduASR' OR `model_name` LIKE '%百度语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Speech Recognition (Streaming)' WHERE `id` = 'ASR_DoubaoStreamASR' OR `model_name` LIKE '%豆包语音识别(流式)%';

UPDATE `ai_model_config` SET `model_name` = 'ZhipuAI' WHERE `id` = 'LLM_ChatGLMLLM' OR `model_name` = '智谱AI';
UPDATE `ai_model_config` SET `model_name` = 'Ollama Local Model' WHERE `id` = 'LLM_OllamaLLM' OR `model_name` LIKE '%Ollama本地模型%';
UPDATE `ai_model_config` SET `model_name` = 'Tongyi Qianwen' WHERE `id` = 'LLM_AliLLM' OR `model_name` = '通义千问';
UPDATE `ai_model_config` SET `model_name` = 'Tongyi Bailian' WHERE `id` = 'LLM_AliAppLLM' OR `model_name` = '通义百炼';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Large Model' WHERE `id` = 'LLM_DoubaoLLM' OR `model_name` = '豆包大模型';
UPDATE `ai_model_config` SET `model_name` = 'DeepSeek' WHERE `id` = 'LLM_DeepSeekLLM';
UPDATE `ai_model_config` SET `model_name` = 'Dify' WHERE `id` = 'LLM_DifyLLM';
UPDATE `ai_model_config` SET `model_name` = 'Google Gemini' WHERE `id` = 'LLM_GeminiLLM';
UPDATE `ai_model_config` SET `model_name` = 'Coze' WHERE `id` = 'LLM_CozeLLM';
UPDATE `ai_model_config` SET `model_name` = 'LM Studio' WHERE `id` = 'LLM_LMStudioLLM';
UPDATE `ai_model_config` SET `model_name` = 'FastGPT' WHERE `id` = 'LLM_FastgptLLM';
UPDATE `ai_model_config` SET `model_name` = 'Xinference Large Model' WHERE `id` = 'LLM_XinferenceLLM' OR `model_name` LIKE '%Xinference大模型%';
UPDATE `ai_model_config` SET `model_name` = 'Xinference Small Model' WHERE `id` = 'LLM_XinferenceSmallLLM' OR `model_name` LIKE '%Xinference小模型%';
UPDATE `ai_model_config` SET `model_name` = 'Volcengine Edge Gateway' WHERE `id` = 'LLM_VolcesAiGatewayLLM';

UPDATE `ai_model_config` SET `model_name` = 'Edge Speech Synthesis' WHERE `id` = 'TTS_EdgeTTS' OR `model_name` = 'Edge语音合成';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Speech Synthesis' WHERE `id` = 'TTS_DoubaoTTS' OR `model_name` = '豆包语音合成';
UPDATE `ai_model_config` SET `model_name` = 'SiliconFlow Speech Synthesis' WHERE `id` = 'TTS_CosyVoiceSiliconflow' OR `model_name` LIKE '%硅基流动语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'Coze Chinese Speech Synthesis' WHERE `id` = 'TTS_CozeCnTTS' OR `model_name` LIKE '%Coze中文语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'FishSpeech Speech Synthesis' WHERE `id` = 'TTS_FishSpeech' OR `model_name` LIKE '%FishSpeech语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'GPT-SoVITS V2' WHERE `id` = 'TTS_GPT_SOVITS_V2';
UPDATE `ai_model_config` SET `model_name` = 'GPT-SoVITS V3' WHERE `id` = 'TTS_GPT_SOVITS_V3';
UPDATE `ai_model_config` SET `model_name` = 'MiniMax Speech Synthesis' WHERE `id` = 'TTS_MinimaxTTS' OR `model_name` LIKE '%MiniMax语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'Alibaba Cloud Speech Synthesis' WHERE `id` = 'TTS_AliyunTTS' OR `model_name` LIKE '%阿里云语音合成%';
UPDATE `ai_model_config` SET `model_name` = '302AI Speech Synthesis' WHERE `id` = 'TTS_TTS302AI' OR `model_name` LIKE '%302AI语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'Gizwits Speech Synthesis' WHERE `id` = 'TTS_GizwitsTTS' OR `model_name` LIKE '%机智云语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'ACGN Speech Synthesis' WHERE `id` = 'TTS_ACGNTTS' OR `model_name` LIKE '%二次元语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'OpenAI Speech Synthesis' WHERE `id` = 'TTS_OpenAITTS' OR `model_name` LIKE '%OpenAI语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'Custom Speech Synthesis' WHERE `id` = 'TTS_CustomTTS' OR `model_name` LIKE '%自定义语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'Tencent Speech Synthesis' WHERE `id` = 'TTS_TencentTTS' OR `model_name` LIKE '%腾讯语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'Volcengine Edge Gateway' WHERE `id` = 'TTS_VolcesAiGatewayTTS';
UPDATE `ai_model_config` SET `model_name` = 'Volcengine Dual-Streaming Speech Synthesis' WHERE `id` = 'TTS_HuoshanDoubleStreamTTS' OR `model_name` LIKE '%火山双流式语音合成%';
UPDATE `ai_model_config` SET `model_name` = 'Linkerai Speech Synthesis' WHERE `id` = 'TTS_LinkeraiTTS' OR `model_name` LIKE '%灵客AI语音合成%';

UPDATE `ai_model_config` SET `model_name` = 'No Memory' WHERE `id` = 'Memory_nomem' OR `model_name` = '无记忆';
UPDATE `ai_model_config` SET `model_name` = 'Local Short-term Memory' WHERE `id` = 'Memory_mem_local_short' OR `model_name` = '本地短期记忆';
UPDATE `ai_model_config` SET `model_name` = 'Mem0AI Memory' WHERE `id` = 'Memory_mem0ai';

UPDATE `ai_model_config` SET `model_name` = 'No Intent Recognition' WHERE `id` = 'Intent_nointent' OR `model_name` = '无意图识别';
UPDATE `ai_model_config` SET `model_name` = 'LLM Intent Recognition' WHERE `id` = 'Intent_intent_llm' OR `model_name` = '大模型意图识别';
UPDATE `ai_model_config` SET `model_name` = 'Function Call Intent Recognition' WHERE `id` = 'Intent_function_call' OR `model_name` = '函数调用意图识别';

UPDATE `ai_model_config` SET `model_name` = 'Zhipu Vision AI' WHERE `id` = 'VLLM_ChatGLMVLLM' OR `model_name` LIKE '%智谱视觉AI%';
UPDATE `ai_model_config` SET `model_name` = 'Qwen Vision Model' WHERE `id` = 'VLLM_QwenVLVLLM' OR `model_name` LIKE '%千问视觉大模型%';

-- 2. ai_tts_voice (must all be <= 20 chars to respect VARCHAR(20))
UPDATE `ai_tts_voice` SET `name` = 'Xiaoxiao (Female)' WHERE `id` = 'TTS_EdgeTTS0001' OR `name` LIKE '%晓晓%';
UPDATE `ai_tts_voice` SET `name` = 'Yunxi (Male)' WHERE `id` = 'TTS_EdgeTTS0002' OR `name` LIKE '%云希%';
UPDATE `ai_tts_voice` SET `name` = 'Yunjian (Male)' WHERE `id` = 'TTS_EdgeTTS0003' OR `name` LIKE '%云健%';
UPDATE `ai_tts_voice` SET `name` = 'Xiaoyi (Female)' WHERE `id` = 'TTS_EdgeTTS0004' OR `name` LIKE '%晓伊%';
UPDATE `ai_tts_voice` SET `name` = 'Yunyang (Male)' WHERE `id` = 'TTS_EdgeTTS0005' OR `name` LIKE '%云扬%';
UPDATE `ai_tts_voice` SET `name` = 'LN Xiaobei (Female)' WHERE `id` = 'TTS_EdgeTTS0006' OR `name` LIKE '%辽宁%';
UPDATE `ai_tts_voice` SET `name` = 'SX Xiaoni (Female)' WHERE `id` = 'TTS_EdgeTTS0007' OR `name` LIKE '%陕西%';
UPDATE `ai_tts_voice` SET `name` = 'TW HsiaoChen' WHERE `id` = 'TTS_EdgeTTS0008' OR `name` LIKE '%曉臻%';
UPDATE `ai_tts_voice` SET `name` = 'TW YunJhe (Male)' WHERE `id` = 'TTS_EdgeTTS0009' OR `name` LIKE '%雲哲%';
UPDATE `ai_tts_voice` SET `name` = 'TW HsiaoYu' WHERE `id` = 'TTS_EdgeTTS0010' OR `name` LIKE '%曉雨%';
UPDATE `ai_tts_voice` SET `name` = 'HK HiuMaan (Female)' WHERE `id` = 'TTS_EdgeTTS0011' OR `name` LIKE '%曉曼%';
UPDATE `ai_tts_voice` SET `languages` = 'Chinese' WHERE `languages` = '中文';

-- 3. ai_agent and ai_agent_template
UPDATE `ai_agent` SET `agent_name` = 'Xiaozhi' WHERE `agent_name` = '小智';
UPDATE `ai_agent` SET `language` = 'Chinese' WHERE `language` = '中文';

UPDATE `ai_agent_template` SET `agent_code` = 'Xiaozhi' WHERE `agent_code` = '小智';
UPDATE `ai_agent_template` SET `language` = 'Chinese' WHERE `language` = '中文';
UPDATE `ai_agent_template` SET `agent_name` = 'Taiwanese Xiao He' WHERE `agent_name` = '台湾小鹤' OR `id` = '9406648b5cc5fde1b8aa335b6f8b4f76';
UPDATE `ai_agent_template` SET `agent_name` = 'Interstellar Wanderer' WHERE `agent_name` = '星际漫游者' OR `id` = '0ca32eb728c949e58b1000b2e401f90c';
UPDATE `ai_agent_template` SET `agent_name` = 'English Teacher' WHERE `agent_name` = '英语老师' OR `id` = '6c7d8e9f0a1b2c3d4e5f6a7b8c9d0s24';
UPDATE `ai_agent_template` SET `agent_name` = 'Curious Boy' WHERE `agent_name` = '好奇男孩' OR `id` = 'e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b1';
UPDATE `ai_agent_template` SET `agent_name` = 'Captain Woof' WHERE `agent_name` = '汪汪队长' OR `id` = 'a45b6c7d8e9f0a1b2c3d4e5f6a7b8c92';

-- 4. ai_model_provider
UPDATE `ai_model_provider` SET `provider_code` = 'huoshan_double_stream' WHERE `id` = 'SYSTEM_TTS_HSDSTTS';
UPDATE `ai_model_provider` SET `name` = 'Voice Activity Detection' WHERE `id` = 'VAD_SileroVAD' OR `name` LIKE '%语音活动检测%';
UPDATE `ai_model_provider` SET `name` = 'FunASR' WHERE `id` = 'ASR_FunASR';
UPDATE `ai_model_provider` SET `name` = 'Sherpa' WHERE `id` = 'ASR_SherpaASR';
UPDATE `ai_model_provider` SET `name` = 'Doubao' WHERE `id` = 'ASR_DoubaoASR';
UPDATE `ai_model_provider` SET `name` = 'Tencent' WHERE `id` = 'ASR_TencentASR';
UPDATE `ai_model_provider` SET `name` = 'ZhipuAI' WHERE `id` = 'LLM_ChatGLMLLM';
UPDATE `ai_model_provider` SET `name` = 'Ollama' WHERE `id` = 'LLM_OllamaLLM';
UPDATE `ai_model_provider` SET `name` = 'Tongyi Qianwen' WHERE `id` = 'LLM_AliLLM';
UPDATE `ai_model_provider` SET `name` = 'Tongyi Bailian' WHERE `id` = 'LLM_AliAppLLM';
UPDATE `ai_model_provider` SET `name` = 'Doubao' WHERE `id` = 'LLM_DoubaoLLM';
UPDATE `ai_model_provider` SET `name` = 'DeepSeek' WHERE `id` = 'LLM_DeepSeekLLM';
UPDATE `ai_model_provider` SET `name` = 'Edge Speech Synthesis' WHERE `id` = 'TTS_EdgeTTS';
UPDATE `ai_model_provider` SET `name` = 'Doubao Speech Synthesis' WHERE `id` = 'TTS_DoubaoTTS';
UPDATE `ai_model_provider` SET `name` = 'SiliconFlow' WHERE `id` = 'TTS_CosyVoiceSiliconflow';

-- 5. sys_params
UPDATE `sys_params` SET `param_value` = 'Hello Xiaozhi;Xiaoai Student;Hello Xiaoxin;Xiaomei Student;Xiaolong Xiaolong;Meow Student;Xiaobin Xiaobin;Xiaobing Xiaobing;Hey hello there' WHERE `param_code` = 'wakeup_words' AND `param_value` LIKE '%你好小智%';
UPDATE `sys_params` SET `param_value` = 'Master, Xiaozhi is a bit busy right now. Please try again later.' WHERE `param_code` = 'system_error_response' AND `param_value` LIKE '%主人%';

-- 6. Add Bengali voices for Edge TTS
INSERT INTO `ai_tts_voice` (`id`, `tts_model_id`, `name`, `tts_voice`, `languages`, `sort`) VALUES
('TTS_EdgeTTS_bn_001', 'TTS_EdgeTTS', 'Nabanita (BD Female)', 'bn-BD-NabanitaNeural', 'Bengali', 100),
('TTS_EdgeTTS_bn_002', 'TTS_EdgeTTS', 'Pradeep (BD Male)', 'bn-BD-PradeepNeural', 'Bengali', 101),
('TTS_EdgeTTS_bn_003', 'TTS_EdgeTTS', 'Tanishaa (IN Female)', 'bn-IN-TanishaaNeural', 'Bengali', 102),
('TTS_EdgeTTS_bn_004', 'TTS_EdgeTTS', 'Bashkar (IN Male)', 'bn-IN-BashkarNeural', 'Bengali', 103)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `tts_voice` = VALUES(`tts_voice`), `languages` = VALUES(`languages`), `sort` = VALUES(`sort`);

