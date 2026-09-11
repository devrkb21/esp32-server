-- Migration: Purge Chinese defaults, set English as primary priority, add Bangla voices & localization
-- ==============================================================================================

-- 1. ai_model_config: English names & English-first configuration
UPDATE `ai_model_config` SET `model_name` = 'Voice Activity Detection', `config_json` = JSON_SET(`config_json`, '$.model_dir', 'models/snakers4_silero-vad') WHERE `id` = 'VAD_SileroVAD';
UPDATE `ai_model_config` SET `model_name` = 'FunASR Speech Recognition', `config_json` = JSON_SET(`config_json`, '$.language', 'auto') WHERE `id` = 'ASR_FunASR';
UPDATE `ai_model_config` SET `model_name` = 'Sherpa Speech Recognition' WHERE `id` = 'ASR_SherpaASR';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Speech Recognition' WHERE `id` = 'ASR_DoubaoASR';
UPDATE `ai_model_config` SET `model_name` = 'Tencent Speech Recognition' WHERE `id` = 'ASR_TencentASR';
UPDATE `ai_model_config` SET `model_name` = 'FunASR Service Speech Recognition' WHERE `id` = 'ASR_FunASRServer';
UPDATE `ai_model_config` SET `model_name` = 'Alibaba Cloud Speech Recognition' WHERE `id` = 'ASR_AliyunASR';
UPDATE `ai_model_config` SET `model_name` = 'Baidu Speech Recognition' WHERE `id` = 'ASR_BaiduASR';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Speech Recognition (Streaming)' WHERE `id` = 'ASR_DoubaoStreamASR';

-- LLM: Set Google Gemini (generous free tier) as default (is_default = 1), disable Chinese default
UPDATE `ai_model_config` SET `model_name` = 'Google Gemini (Free Tier)', `is_default` = 1, `is_enabled` = 1, `sort` = 1, `remark` = 'Google Gemini 2.0 Flash (Generous free tier with Google AI Studio key at aistudio.google.com)' WHERE `id` = 'LLM_GeminiLLM';
UPDATE `ai_model_config` SET `model_name` = 'DeepSeek', `is_default` = 0, `is_enabled` = 1, `sort` = 2 WHERE `id` = 'LLM_DeepSeekLLM';
UPDATE `ai_model_config` SET `model_name` = 'ZhipuAI', `is_default` = 0, `sort` = 10 WHERE `id` = 'LLM_ChatGLMLLM';
UPDATE `ai_model_config` SET `model_name` = 'Ollama Local Model', `sort` = 4 WHERE `id` = 'LLM_OllamaLLM';
UPDATE `ai_model_config` SET `model_name` = 'Tongyi Qianwen', `is_default` = 0 WHERE `id` = 'LLM_AliLLM';
UPDATE `ai_model_config` SET `model_name` = 'Tongyi Bailian', `is_default` = 0 WHERE `id` = 'LLM_AliAppLLM';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Large Model', `is_default` = 0 WHERE `id` = 'LLM_DoubaoLLM';
UPDATE `ai_model_config` SET `model_name` = 'Dify' WHERE `id` = 'LLM_DifyLLM';
UPDATE `ai_model_config` SET `model_name` = 'Coze' WHERE `id` = 'LLM_CozeLLM';
UPDATE `ai_model_config` SET `model_name` = 'LM Studio' WHERE `id` = 'LLM_LMStudioLLM';
UPDATE `ai_model_config` SET `model_name` = 'FastGPT' WHERE `id` = 'LLM_FastgptLLM';
UPDATE `ai_model_config` SET `model_name` = 'Xinference Large Model' WHERE `id` = 'LLM_XinferenceLLM';
UPDATE `ai_model_config` SET `model_name` = 'Xinference Small Model' WHERE `id` = 'LLM_XinferenceSmallLLM';
UPDATE `ai_model_config` SET `model_name` = 'Volcengine Edge Gateway' WHERE `id` = 'LLM_VolcesAiGatewayLLM';

-- Insert or Update OpenAI GPT-4o-mini
INSERT INTO `ai_model_config` (`id`, `model_type`, `model_code`, `model_name`, `is_default`, `is_enabled`, `config_json`, `sort`, `remark`) VALUES
('LLM_OpenAILLM', 'LLM', 'openai', 'OpenAI GPT-4o-mini', 0, 1, '{"type": "openai", "model_name": "gpt-4o-mini", "base_url": "https://api.openai.com/v1", "api_key": "your_openai_api_key", "temperature": 0.7}', 3, 'OpenAI GPT-4o-mini model')
ON DUPLICATE KEY UPDATE `model_name` = VALUES(`model_name`), `is_default` = 0, `is_enabled` = 1, `sort` = 3;

-- TTS: Update Edge TTS default voice to English (en-US-JennyNeural)
UPDATE `ai_model_config` SET `model_name` = 'Edge Speech Synthesis', `is_default` = 1, `is_enabled` = 1, `config_json` = JSON_SET(`config_json`, '$.voice', 'en-US-JennyNeural') WHERE `id` = 'TTS_EdgeTTS';
UPDATE `ai_model_config` SET `model_name` = 'Doubao Speech Synthesis' WHERE `id` = 'TTS_DoubaoTTS';
UPDATE `ai_model_config` SET `model_name` = 'SiliconFlow Speech Synthesis' WHERE `id` = 'TTS_CosyVoiceSiliconflow';
UPDATE `ai_model_config` SET `model_name` = 'Coze Chinese Speech Synthesis' WHERE `id` = 'TTS_CozeCnTTS';
UPDATE `ai_model_config` SET `model_name` = 'FishSpeech Speech Synthesis' WHERE `id` = 'TTS_FishSpeech';
UPDATE `ai_model_config` SET `model_name` = 'GPT-SoVITS V2' WHERE `id` = 'TTS_GPT_SOVITS_V2';
UPDATE `ai_model_config` SET `model_name` = 'GPT-SoVITS V3' WHERE `id` = 'TTS_GPT_SOVITS_V3';
UPDATE `ai_model_config` SET `model_name` = 'MiniMax Speech Synthesis' WHERE `id` = 'TTS_MinimaxTTS';
UPDATE `ai_model_config` SET `model_name` = 'Alibaba Cloud Speech Synthesis' WHERE `id` = 'TTS_AliyunTTS';
UPDATE `ai_model_config` SET `model_name` = '302AI Speech Synthesis' WHERE `id` = 'TTS_TTS302AI';
UPDATE `ai_model_config` SET `model_name` = 'Gizwits Speech Synthesis' WHERE `id` = 'TTS_GizwitsTTS';
UPDATE `ai_model_config` SET `model_name` = 'ACGN Speech Synthesis' WHERE `id` = 'TTS_ACGNTTS';
UPDATE `ai_model_config` SET `model_name` = 'OpenAI Speech Synthesis' WHERE `id` = 'TTS_OpenAITTS';
UPDATE `ai_model_config` SET `model_name` = 'Custom Speech Synthesis' WHERE `id` = 'TTS_CustomTTS';
UPDATE `ai_model_config` SET `model_name` = 'Tencent Speech Synthesis' WHERE `id` = 'TTS_TencentTTS';
UPDATE `ai_model_config` SET `model_name` = 'Volcengine Edge Gateway' WHERE `id` = 'TTS_VolcesAiGatewayTTS';
UPDATE `ai_model_config` SET `model_name` = 'Volcengine Dual-Streaming Speech Synthesis' WHERE `id` = 'TTS_HuoshanDoubleStreamTTS';
UPDATE `ai_model_config` SET `model_name` = 'Linkerai Speech Synthesis' WHERE `id` = 'TTS_LinkeraiTTS';

UPDATE `ai_model_config` SET `model_name` = 'No Memory' WHERE `id` = 'Memory_nomem';
UPDATE `ai_model_config` SET `model_name` = 'Local Short-term Memory' WHERE `id` = 'Memory_mem_local_short';
UPDATE `ai_model_config` SET `model_name` = 'Mem0AI Memory' WHERE `id` = 'Memory_mem0ai';

UPDATE `ai_model_config` SET `model_name` = 'No Intent Recognition' WHERE `id` = 'Intent_nointent';
UPDATE `ai_model_config` SET `model_name` = 'LLM Intent Recognition' WHERE `id` = 'Intent_intent_llm';
UPDATE `ai_model_config` SET `model_name` = 'Function Call Intent Recognition' WHERE `id` = 'Intent_function_call';

UPDATE `ai_model_config` SET `model_name` = 'Zhipu Vision AI' WHERE `id` = 'VLLM_ChatGLMVLLM';
UPDATE `ai_model_config` SET `model_name` = 'Qwen Vision Model' WHERE `id` = 'VLLM_QwenVLVLLM';

-- 2. ai_tts_voice: Replace Chinese Edge-TTS voices with English and Bangla voices (VARCHAR(20) limit)
UPDATE `ai_tts_voice` SET `name` = 'Jenny (US Female)', `tts_voice` = 'en-US-JennyNeural', `languages` = 'English', `voice_demo` = '/voice-demos/en-US-JennyNeural.mp3', `sort` = 1 WHERE `id` = 'TTS_EdgeTTS0001';
UPDATE `ai_tts_voice` SET `name` = 'Guy (US Male)', `tts_voice` = 'en-US-GuyNeural', `languages` = 'English', `voice_demo` = '/voice-demos/en-US-GuyNeural.mp3', `sort` = 2 WHERE `id` = 'TTS_EdgeTTS0002';
UPDATE `ai_tts_voice` SET `name` = 'Aria (US Female)', `tts_voice` = 'en-US-AriaNeural', `languages` = 'English', `voice_demo` = '/voice-demos/en-US-AriaNeural.mp3', `sort` = 3 WHERE `id` = 'TTS_EdgeTTS0003';
UPDATE `ai_tts_voice` SET `name` = 'Christopher (US)', `tts_voice` = 'en-US-ChristopherNeural', `languages` = 'English', `voice_demo` = '/voice-demos/en-US-ChristopherNeural.mp3', `sort` = 4 WHERE `id` = 'TTS_EdgeTTS0004';
UPDATE `ai_tts_voice` SET `name` = 'Sonia (UK Female)', `tts_voice` = 'en-GB-SoniaNeural', `languages` = 'English', `voice_demo` = '/voice-demos/en-GB-SoniaNeural.mp3', `sort` = 5 WHERE `id` = 'TTS_EdgeTTS0005';
UPDATE `ai_tts_voice` SET `name` = 'Ryan (UK Male)', `tts_voice` = 'en-GB-RyanNeural', `languages` = 'English', `voice_demo` = '/voice-demos/en-GB-RyanNeural.mp3', `sort` = 6 WHERE `id` = 'TTS_EdgeTTS0006';
UPDATE `ai_tts_voice` SET `name` = 'Ana (US Child)', `tts_voice` = 'en-US-AnaNeural', `languages` = 'English', `voice_demo` = '/voice-demos/en-US-AnaNeural.mp3', `sort` = 7 WHERE `id` = 'TTS_EdgeTTS0007';
UPDATE `ai_tts_voice` SET `name` = 'Eric (US Male)', `tts_voice` = 'en-US-EricNeural', `languages` = 'English', `voice_demo` = '/voice-demos/en-US-EricNeural.mp3', `sort` = 8 WHERE `id` = 'TTS_EdgeTTS0008';
UPDATE `ai_tts_voice` SET `name` = 'Michelle (US)', `tts_voice` = 'en-US-MichelleNeural', `languages` = 'English', `voice_demo` = '/voice-demos/en-US-MichelleNeural.mp3', `sort` = 9 WHERE `id` = 'TTS_EdgeTTS0009';

-- Insert Bangla (Bengali) voices for Edge TTS (prioritized right after English)
INSERT INTO `ai_tts_voice` (`id`, `tts_model_id`, `name`, `tts_voice`, `languages`, `sort`) VALUES
('TTS_EdgeTTS_bn_001', 'TTS_EdgeTTS', 'Nabanita (BD Female)', 'bn-BD-NabanitaNeural', 'Bengali', 10),
('TTS_EdgeTTS_bn_002', 'TTS_EdgeTTS', 'Pradeep (BD Male)', 'bn-BD-PradeepNeural', 'Bengali', 11),
('TTS_EdgeTTS_bn_003', 'TTS_EdgeTTS', 'Tanishaa (IN Female)', 'bn-IN-TanishaaNeural', 'Bengali', 12),
('TTS_EdgeTTS_bn_004', 'TTS_EdgeTTS', 'Bashkar (IN Male)', 'bn-IN-BashkarNeural', 'Bengali', 13)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `tts_voice` = VALUES(`tts_voice`), `languages` = VALUES(`languages`), `sort` = VALUES(`sort`);

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
UPDATE `ai_agent_template` SET `lang_code` = 'en', `language` = 'English', `tts_language` = 'English', `tts_voice_id` = 'TTS_EdgeTTS0001', `llm_model_id` = 'LLM_GeminiLLM' WHERE `language` = 'Chinese' OR `lang_code` = 'zh';

-- 4. ai_agent: Migrate existing user agents to English defaults
UPDATE `ai_agent` SET
  `agent_name` = 'Xiaozhi',
  `lang_code` = 'en',
  `language` = 'English',
  `tts_language` = 'English',
  `tts_voice_id` = 'TTS_EdgeTTS0001',
  `llm_model_id` = 'LLM_GeminiLLM'
WHERE `language` = 'Chinese' OR `lang_code` = 'zh' OR `tts_voice_id` = 'TTS_EdgeTTS0001' OR `tts_voice_id` IS NULL;


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
WHERE `system_prompt` LIKE '%gen-Z%';

-- 5. ai_model_provider names
UPDATE `ai_model_provider` SET `provider_code` = 'huoshan_double_stream' WHERE `id` = 'SYSTEM_TTS_HSDSTTS';
UPDATE `ai_model_provider` SET `name` = 'Voice Activity Detection' WHERE `id` = 'VAD_SileroVAD';
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
DELETE FROM `ai_tts_voice` WHERE `tts_voice` LIKE 'zh-%' OR `tts_voice` LIKE 'zh_%' OR `tts_voice` LIKE 'saturn_zh_%' OR `languages` IN ('Chinese', 'Mandarin', 'Cantonese', 'Liaoning', 'Shaanxi');

UPDATE `ai_tts_voice` SET `voice_demo` = CONCAT('/voice-demos/', `tts_voice`, '.mp3') WHERE `tts_model_id` = 'TTS_EdgeTTS';
