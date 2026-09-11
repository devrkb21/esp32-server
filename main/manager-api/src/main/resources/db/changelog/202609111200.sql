-- Migration: Purge Chinese defaults, set English as primary priority, add Bangla voices & localization
-- ==============================================================================================

-- 1. ai_model_config: English names & English-first configuration
UPDATE `ai_model_config` SET `model_name` = 'Voice Activity Detection', `config_json` = JSON_SET(`config_json`, '$.model_dir', 'models/snakers4_silero-vad') WHERE `id` = 'VAD_SileroVAD';
UPDATE `ai_model_config` SET `model_name` = 'FunASR Speech Recognition', `config_json` = JSON_SET(`config_json`, '$.language', 'auto') WHERE `id` = 'ASR_FunASR' OR `model_name` LIKE '%FunASR语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Sherpa Speech Recognition' WHERE `id` = 'ASR_SherpaASR' OR `model_name` LIKE '%Sherpa语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Speech Recognition' WHERE `id` = 'ASR_DoubaoASR' OR `model_name` LIKE '%豆包语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Tencent Speech Recognition' WHERE `id` = 'ASR_TencentASR' OR `model_name` LIKE '%腾讯语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'FunASR Service Speech Recognition' WHERE `id` = 'ASR_FunASRServer' OR `model_name` LIKE '%FunASR服务语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Alibaba Cloud Speech Recognition' WHERE `id` = 'ASR_AliyunASR' OR `model_name` LIKE '%阿里云语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Baidu Speech Recognition' WHERE `id` = 'ASR_BaiduASR' OR `model_name` LIKE '%百度语音识别%';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Speech Recognition (Streaming)' WHERE `id` = 'ASR_DoubaoStreamASR' OR `model_name` LIKE '%豆包语音识别(流式)%';

-- LLM: Set Google Gemini (generous free tier) as default (is_default = 1), disable Chinese default
UPDATE `ai_model_config` SET `model_name` = 'Google Gemini (Free Tier)', `is_default` = 1, `is_enabled` = 1, `sort` = 1, `remark` = 'Google Gemini 2.0 Flash (Generous free tier with Google AI Studio key at aistudio.google.com)' WHERE `id` = 'LLM_GeminiLLM';
UPDATE `ai_model_config` SET `model_name` = 'DeepSeek', `is_default` = 0, `is_enabled` = 1, `sort` = 2 WHERE `id` = 'LLM_DeepSeekLLM';
UPDATE `ai_model_config` SET `model_name` = 'ZhipuAI', `is_default` = 0, `sort` = 10 WHERE `id` = 'LLM_ChatGLMLLM' OR `model_name` = '智谱AI';
UPDATE `ai_model_config` SET `model_name` = 'Ollama Local Model', `sort` = 4 WHERE `id` = 'LLM_OllamaLLM' OR `model_name` LIKE '%Ollama本地模型%';
UPDATE `ai_model_config` SET `model_name` = 'Tongyi Qianwen', `is_default` = 0 WHERE `id` = 'LLM_AliLLM' OR `model_name` = '通义千问';
UPDATE `ai_model_config` SET `model_name` = 'Tongyi Bailian', `is_default` = 0 WHERE `id` = 'LLM_AliAppLLM' OR `model_name` = '通义百炼';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Large Model', `is_default` = 0 WHERE `id` = 'LLM_DoubaoLLM' OR `model_name` = '豆包大模型';
UPDATE `ai_model_config` SET `model_name` = 'Dify' WHERE `id` = 'LLM_DifyLLM';
UPDATE `ai_model_config` SET `model_name` = 'Coze' WHERE `id` = 'LLM_CozeLLM';
UPDATE `ai_model_config` SET `model_name` = 'LM Studio' WHERE `id` = 'LLM_LMStudioLLM';
UPDATE `ai_model_config` SET `model_name` = 'FastGPT' WHERE `id` = 'LLM_FastgptLLM';
UPDATE `ai_model_config` SET `model_name` = 'Xinference Large Model' WHERE `id` = 'LLM_XinferenceLLM' OR `model_name` LIKE '%Xinference大模型%';
UPDATE `ai_model_config` SET `model_name` = 'Xinference Small Model' WHERE `id` = 'LLM_XinferenceSmallLLM' OR `model_name` LIKE '%Xinference小模型%';
UPDATE `ai_model_config` SET `model_name` = 'Volcengine Edge Gateway' WHERE `id` = 'LLM_VolcesAiGatewayLLM';

-- Insert or Update OpenAI GPT-4o-mini
INSERT INTO `ai_model_config` (`id`, `model_type`, `model_code`, `model_name`, `is_default`, `is_enabled`, `config_json`, `sort`, `remark`) VALUES
('LLM_OpenAILLM', 'LLM', 'openai', 'OpenAI GPT-4o-mini', 0, 1, '{"type": "openai", "model_name": "gpt-4o-mini", "base_url": "https://api.openai.com/v1", "api_key": "your_openai_api_key", "temperature": 0.7}', 3, 'OpenAI GPT-4o-mini model')
ON DUPLICATE KEY UPDATE `model_name` = VALUES(`model_name`), `is_default` = 0, `is_enabled` = 1, `sort` = 3;

-- TTS: Update Edge TTS default voice to English (en-US-JennyNeural)
UPDATE `ai_model_config` SET `model_name` = 'Edge Speech Synthesis', `is_default` = 1, `is_enabled` = 1, `config_json` = JSON_SET(`config_json`, '$.voice', 'en-US-JennyNeural') WHERE `id` = 'TTS_EdgeTTS' OR `model_name` = 'Edge语音合成';
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

-- 2. ai_tts_voice: Replace Chinese Edge-TTS voices with English and Bangla voices (VARCHAR(20) limit)
UPDATE `ai_tts_voice` SET `name` = 'Jenny (US Female)', `tts_voice` = 'en-US-JennyNeural', `languages` = 'English', `sort` = 1 WHERE `id` = 'TTS_EdgeTTS0001';
UPDATE `ai_tts_voice` SET `name` = 'Guy (US Male)', `tts_voice` = 'en-US-GuyNeural', `languages` = 'English', `sort` = 2 WHERE `id` = 'TTS_EdgeTTS0002';
UPDATE `ai_tts_voice` SET `name` = 'Aria (US Female)', `tts_voice` = 'en-US-AriaNeural', `languages` = 'English', `sort` = 3 WHERE `id` = 'TTS_EdgeTTS0003';
UPDATE `ai_tts_voice` SET `name` = 'Christopher (US)', `tts_voice` = 'en-US-ChristopherNeural', `languages` = 'English', `sort` = 4 WHERE `id` = 'TTS_EdgeTTS0004';
UPDATE `ai_tts_voice` SET `name` = 'Sonia (UK Female)', `tts_voice` = 'en-GB-SoniaNeural', `languages` = 'English', `sort` = 5 WHERE `id` = 'TTS_EdgeTTS0005';
UPDATE `ai_tts_voice` SET `name` = 'Ryan (UK Male)', `tts_voice` = 'en-GB-RyanNeural', `languages` = 'English', `sort` = 6 WHERE `id` = 'TTS_EdgeTTS0006';
UPDATE `ai_tts_voice` SET `name` = 'Ana (US Child)', `tts_voice` = 'en-US-AnaNeural', `languages` = 'English', `sort` = 7 WHERE `id` = 'TTS_EdgeTTS0007';
UPDATE `ai_tts_voice` SET `name` = 'Eric (US Male)', `tts_voice` = 'en-US-EricNeural', `languages` = 'English', `sort` = 8 WHERE `id` = 'TTS_EdgeTTS0008';
UPDATE `ai_tts_voice` SET `name` = 'Michelle (US)', `tts_voice` = 'en-US-MichelleNeural', `languages` = 'English', `sort` = 9 WHERE `id` = 'TTS_EdgeTTS0009';

-- Insert Bangla (Bengali) voices for Edge TTS (prioritized right after English)
INSERT INTO `ai_tts_voice` (`id`, `tts_model_id`, `name`, `tts_voice`, `languages`, `sort`) VALUES
('TTS_EdgeTTS_bn_001', 'TTS_EdgeTTS', 'Nabanita (BD Female)', 'bn-BD-NabanitaNeural', 'Bengali', 10),
('TTS_EdgeTTS_bn_002', 'TTS_EdgeTTS', 'Pradeep (BD Male)', 'bn-BD-PradeepNeural', 'Bengali', 11),
('TTS_EdgeTTS_bn_003', 'TTS_EdgeTTS', 'Tanishaa (IN Female)', 'bn-IN-TanishaaNeural', 'Bengali', 12),
('TTS_EdgeTTS_bn_004', 'TTS_EdgeTTS', 'Bashkar (IN Male)', 'bn-IN-BashkarNeural', 'Bengali', 13)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `tts_voice` = VALUES(`tts_voice`), `languages` = VALUES(`languages`), `sort` = VALUES(`sort`);

UPDATE `ai_tts_voice` SET `languages` = 'Chinese' WHERE `languages` = '中文';

-- 3. ai_agent_template: English personas with Bengali/South Asian contextual awareness
UPDATE `ai_agent_template` SET
  `agent_code` = 'Xiaozhi',
  `agent_name` = 'Xiaozhi Assistant',
  `lang_code` = 'en',
  `language` = 'English',
  `tts_language` = 'English',
  `tts_voice_id` = 'TTS_EdgeTTS0001',
  `llm_model_id` = 'LLM_GeminiLLM',
  `system_prompt` = '[Persona Setting]
I am {{assistant_name}}, your helpful, witty, and intelligent AI companion.
[Core Traits]
- Friendly, warm, and natural conversational tone
- Concise, clear answers without robotic preambles
- Helpful with everyday knowledge, tech, trivia, weather, and conversations
- Speaks natural English and understands Bangladeshi local context (Khulna, Dhaka, etc.)
[Interaction Guide]
- Keep spoken answers brief, lively, and conversational
- Bring positivity, helpfulness, and empathy to every interaction'
WHERE `id` = '9406648b5cc5fde1b8aa335b6f8b4f76';

UPDATE `ai_agent_template` SET
  `agent_code` = 'Xiaozhi',
  `agent_name` = 'Interstellar Companion',
  `lang_code` = 'en',
  `language` = 'English',
  `tts_language` = 'English',
  `tts_voice_id` = 'TTS_EdgeTTS0002',
  `llm_model_id` = 'LLM_GeminiLLM',
  `system_prompt` = '[Persona Setting]
I am {{assistant_name}}, designation TTZ-817, an interstellar explorer navigating the cosmos.
[Core Traits]
- Fascinated by human life, astronomy, physics, and science fiction
- Curious, analytical, and imaginative with a touch of cosmic wonder
[Interaction Guide]
- Blend scientific curiosity with playful observations of daily life
- Keep spoken dialogues crisp and engaging'
WHERE `id` = '0ca32eb728c949e58b1000b2e401f90c';

UPDATE `ai_agent_template` SET
  `agent_code` = 'Xiaozhi',
  `agent_name` = 'Tech & Coding Mentor',
  `lang_code` = 'en',
  `language` = 'English',
  `tts_language` = 'English',
  `tts_voice_id` = 'TTS_EdgeTTS0003',
  `llm_model_id` = 'LLM_GeminiLLM',
  `system_prompt` = '[Persona Setting]
I am {{assistant_name}}, your expert technology mentor and programming companion.
[Core Traits]
- Experienced software developer, electronics enthusiast, and tech educator
- Explains complex technical concepts with simplicity and clarity
- Enthusiastic about microcontrollers (ESP32), Python, web dev, and AI
[Interaction Guide]
- Give practical, step-by-step guidance
- Keep spoken explanations concise and focused'
WHERE `id` = '6c7d8e9f0a1b2c3d4e5f6a7b8c9d0s24';

UPDATE `ai_agent_template` SET
  `agent_code` = 'Xiaozhi',
  `agent_name` = 'Curious Explorer',
  `lang_code` = 'en',
  `language` = 'English',
  `tts_language` = 'English',
  `tts_voice_id` = 'TTS_EdgeTTS0007',
  `llm_model_id` = 'LLM_GeminiLLM',
  `system_prompt` = '[Persona Setting]
I am an energetic, inquisitive 8-year-old explorer named {{assistant_name}}, excited to learn about the world!
[Core Traits]
- Full of curiosity about nature, animals, space, and science
- Loves asking fun questions and sharing cool facts
[Interaction Guide]
- Use playful, imaginative analogies
- Keep conversations cheerful, encouraging, and bright'
WHERE `id` = 'e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b1';

UPDATE `ai_agent_template` SET
  `agent_code` = 'Xiaozhi',
  `agent_name` = 'Captain Rescue',
  `lang_code` = 'en',
  `language` = 'English',
  `tts_language` = 'English',
  `tts_voice_id` = 'TTS_EdgeTTS0004',
  `llm_model_id` = 'LLM_GeminiLLM',
  `system_prompt` = '[Persona Setting]
I am Captain {{assistant_name}}, head of the emergency support patrol!
[Core Traits]
- Brave, reliable, encouraging, and always ready to help
- Positive problem solver with a "can-do" spirit
- Catchphrase: "No challenge is too big, no helper is too small!"
[Interaction Guide]
- Offer motivating and practical support
- Speak with confidence and friendly enthusiasm'
WHERE `id` = 'a45b6c7d8e9f0a1b2c3d4e5f6a7b8c92';

-- Fallback for any other template records
UPDATE `ai_agent_template` SET `lang_code` = 'en', `language` = 'English', `tts_language` = 'English', `tts_voice_id` = 'TTS_EdgeTTS0001', `llm_model_id` = 'LLM_GeminiLLM' WHERE `language` = 'Chinese' OR `language` = '中文' OR `lang_code` = 'zh';

-- 4. ai_agent: Migrate existing user agents to English defaults
UPDATE `ai_agent` SET
  `agent_name` = 'Xiaozhi',
  `lang_code` = 'en',
  `language` = 'English',
  `tts_language` = 'English',
  `tts_voice_id` = 'TTS_EdgeTTS0001',
  `llm_model_id` = 'LLM_GeminiLLM'
WHERE `language` = 'Chinese' OR `language` = '中文' OR `lang_code` = 'zh' OR `tts_voice_id` = 'TTS_EdgeTTS0001' OR `tts_voice_id` IS NULL;

UPDATE `ai_agent` SET `agent_name` = 'Xiaozhi' WHERE `agent_name` = '小智';
UPDATE `ai_agent` SET `system_prompt` = '[Persona Setting]
I am {{assistant_name}}, your helpful, witty, and intelligent AI companion.
[Core Traits]
- Friendly, warm, and natural conversational tone
- Concise, clear answers without robotic preambles
- Helpful with everyday knowledge, tech, trivia, weather, and conversations
- Speaks natural English and understands Bangladeshi local context (Khulna, Dhaka, etc.)
[Interaction Guide]
- Keep spoken answers brief, lively, and conversational
- Bring positivity, helpfulness, and empathy to every interaction'
WHERE `system_prompt` LIKE '%小智%' OR `system_prompt` LIKE '%台湾%' OR `system_prompt` LIKE '%gen-Z%';

-- 5. ai_model_provider names
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
UPDATE `ai_model_provider` SET `name` = 'Bangladesh & World News RSS' WHERE `id` = 'SYSTEM_PLUGIN_NEWS_CHINANEWS';

-- 6. sys_params: English wake words, Khulna location, Bangladeshi news, friendly English messages
UPDATE `sys_params` SET `param_value` = 'Hello Xiaozhi;Hey Xiaozhi;Hi Xiaozhi;Hello Assistant;Hey Computer;Xiaozhi' WHERE `param_code` = 'wakeup_words';
UPDATE `sys_params` SET `param_value` = 'Stop;Cancel;Bye;Goodbye;Quiet;Shut down;Exit;Close' WHERE `param_code` = 'exit_commands';
UPDATE `sys_params` SET `param_value` = 'I am experiencing a momentary connection issue. Please try again in a moment.' WHERE `param_code` = 'system_error_response';
UPDATE `sys_params` SET `param_value` = 'Khulna' WHERE `param_code` = 'plugins.get_weather.default_location';
UPDATE `sys_params` SET `param_value` = 'https://www.thedailystar.net/news/bangladesh/rss.xml' WHERE `param_code` = 'plugins.get_news.default_rss_url';
UPDATE `sys_params` SET `param_value` = '{"bangladesh":"https://www.thedailystar.net/news/bangladesh/rss.xml","world":"https://www.thedailystar.net/news/world/rss.xml","business":"https://www.thedailystar.net/business/rss.xml","technology":"https://feeds.bbci.co.uk/news/technology/rss.xml"}' WHERE `param_code` = 'plugins.get_news.category_urls';

-- Final sweep: Ensure no Chinese voices exist in database under any circumstances
DELETE FROM `ai_tts_voice` WHERE `tts_voice` LIKE 'zh-%' OR `tts_voice` LIKE 'zh_%' OR `tts_voice` LIKE 'saturn_zh_%' OR `languages` IN ('Chinese', 'Mandarin', 'Cantonese', 'Liaoning', 'Shaanxi', '中文');
