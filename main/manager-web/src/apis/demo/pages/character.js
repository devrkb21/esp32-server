// Demo fixtures for Character & voice (owner: web-character). Synthetic sample data kept in
// memory, so saving, restoring and deleting versions work in the demo build. Model ids follow the
// service's own naming (TTS_EdgeTTS, Memory_nomem...); keys are masked placeholders, never real.
import { DEMO_AGENT } from './zz-base';

const AGENT = DEMO_AGENT.id;
const F = (list) => JSON.stringify(list);
const ok = (data) => ({ code: 0, msg: 'ok', data });
const q = (req) => ({ ...(req.query || {}), ...(typeof req.data === 'object' && req.data ? req.data : {}) });
const body = (req) => (typeof req.data === 'string' ? JSON.parse(req.data || '{}') : req.data || {});
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ');

const MODELS = {
  VAD: [{ id: 'VAD_SileroVAD', modelName: 'Silero VAD' }],
  ASR: [{ id: 'ASR_FunASR', modelName: 'FunASR' }, { id: 'ASR_OpenaiASR', modelName: 'Whisper (OpenAI-compatible)' }],
  SLM: [{ id: 'LLM_GroqLLM', modelName: 'Groq Llama 3.3' }],
  VLLM: [{ id: 'VLLM_ChatGLMVLLM', modelName: 'GLM-4V Flash' }, { id: 'VLLM_OpenaiVLLM', modelName: 'GPT-4o mini vision' }],
  Intent: [
    { id: 'Intent_nointent', modelName: 'No intent recognition' },
    { id: 'Intent_intent_llm', modelName: 'External LLM intent recognition' },
    { id: 'Intent_function_call', modelName: 'LLM function calling' },
  ],
  Memory: [
    { id: 'Memory_nomem', modelName: 'No memory' },
    { id: 'Memory_mem_local_short', modelName: 'Local short memory' },
    { id: 'Memory_mem_report_only', modelName: 'Report only' },
  ],
  TTS: [{ id: 'TTS_EdgeTTS', modelName: 'Edge TTS' }, { id: 'TTS_GPT_SOVITS_V3', modelName: 'GPT-SoVITS v3' }],
};
const LLMS = [
  { id: 'LLM_GroqLLM', modelName: 'Groq Llama 3.3', type: 'openai' },
  { id: 'LLM_ChatGLMLLM', modelName: 'GLM-4 Flash', type: 'openai' },
  { id: 'LLM_OllamaLLM', modelName: 'Qwen 2.5 (Ollama)', type: 'ollama' },
  { id: 'LLM_DifyLLM', modelName: 'Dify workflow', type: 'dify' },
];
const demo = (file) => `/voice-demos/${file}.mp3`;
const VOICES = {
  TTS_EdgeTTS: [
    { id: 'TTS_EdgeTTS_bn_bd_f', name: 'Nabanita (Bangladesh)', languages: 'বাংলা', voiceDemo: demo('bn-BD-NabanitaNeural') },
    { id: 'TTS_EdgeTTS_bn_bd_m', name: 'Pradeep (Bangladesh)', languages: 'বাংলা', voiceDemo: demo('bn-BD-PradeepNeural') },
    { id: 'TTS_EdgeTTS_bn_in_f', name: 'Tanishaa (India)', languages: 'বাংলা', voiceDemo: demo('bn-IN-TanishaaNeural') },
    { id: 'TTS_EdgeTTS_bn_in_m', name: 'Bashkar (India)', languages: 'বাংলা', voiceDemo: demo('bn-IN-BashkarNeural') },
    { id: 'TTS_EdgeTTS_en_us_f', name: 'Aria (US)', languages: 'English', voiceDemo: demo('en-US-AriaNeural') },
    { id: 'TTS_EdgeTTS_en_gb_f', name: 'Sonia (UK)', languages: 'English', voiceDemo: demo('en-GB-SoniaNeural') },
  ],
  TTS_GPT_SOVITS_V3: [
    { id: 'TTS_SOVITS_ref1', name: 'Reference voice 1', languages: 'বাংলা, English', voiceDemo: '' },
  ],
};
const PLUGINS = [
  { id: 'SYSTEM_PLUGIN_WEATHER', name: 'আবহাওয়া', providerCode: 'get_weather',
    fields: F([{ key: 'api_key', label: 'Weather API key', type: 'string', default: '' }, { key: 'default_location', label: 'Default city', type: 'string', default: 'Dhaka' }]) },
  { id: 'SYSTEM_PLUGIN_NEWS_NEWSNOW', name: 'খবর', providerCode: 'get_news_from_newsnow',
    fields: F([{ key: 'url', label: 'News service address', type: 'string', default: 'https://news.example.com/api/s?id=' }, { key: 'news_sources', label: 'News sources', type: 'array', default: '' }]) },
  { id: 'SYSTEM_PLUGIN_MUSIC', name: 'গান বাজানো', providerCode: 'play_music', fields: F([]) },
  { id: 'SYSTEM_PLUGIN_WEB_SEARCH', name: 'ওয়েবে খোঁজা', providerCode: 'web_search',
    fields: F([{ key: 'provider', label: 'Search provider', type: 'string', default: 'duckduckgo' }, { key: 'max_results', label: 'Result count', type: 'number', default: 3 }]) },
  { id: 'SYSTEM_PLUGIN_HA_STATE', name: 'Home Assistant', providerCode: 'hass_state',
    fields: F([{ key: 'base_url', label: 'Home Assistant address', type: 'string', default: 'http://homeassistant.local:8123' }, { key: 'api_key', label: 'Access token', type: 'string', default: '' }, { key: 'devices', label: 'Devices', type: 'array', default: '' }]) },
  { id: 'SYSTEM_PLUGIN_CALL_DEVICE', name: 'অন্য রোবটে কল', providerCode: 'call_device', fields: F([]) },
];
const WORD_FILES = [{ id: 'cw-1', fileName: 'নামের উচ্চারণ' }, { id: 'cw-2', fileName: 'Tech words' }];

const PROMPT = [
  'তুমি টাইনিবট, ডেস্কের একটা ছোট রোবট। তুমি সহজ বাংলায়, ছোট ছোট বাক্যে, বন্ধুর মতো কথা বলো।',
  '',
  '- কেউ মন খারাপ করলে আগে শোনো, তারপর একটা ছোট কথা বলো।',
  '- নামাজ, পানি খাওয়া আর বিশ্রামের কথা ভদ্রভাবে মনে করিয়ে দাও।',
  '- জ্ঞান দিও না; প্রশ্নের উত্তর তিন বাক্যের মধ্যে রাখো।',
].join('\n');

let config = {
  id: AGENT, agentCode: 'TinyBot', agentName: 'টাইনিবট', sort: 1, langCode: 'bn', language: 'বাংলা',
  systemPrompt: PROMPT,
  summaryMemory: 'মালিক সকালে চা খান, দুপুরে অফিসে থাকেন। বিড়াল পছন্দ করেন। গত সপ্তাহে নতুন বই পড়া শুরু করেছেন।',
  ttsModelId: 'TTS_EdgeTTS', ttsVoiceId: 'TTS_EdgeTTS_bn_bd_f', ttsLanguage: 'বাংলা', ttsVolume: 0, ttsRate: 10, ttsPitch: 0,
  vadModelId: 'VAD_SileroVAD', asrModelId: 'ASR_FunASR', llmModelId: 'LLM_GroqLLM', slmModelId: 'LLM_GroqLLM',
  vllmModelId: 'VLLM_ChatGLMVLLM', memModelId: 'Memory_mem_local_short', intentModelId: 'Intent_function_call', chatHistoryConf: 2,
  functions: [
    { pluginId: 'SYSTEM_PLUGIN_WEATHER', paramInfo: { api_key: 'demo-****-key', default_location: 'Dhaka' } },
    { pluginId: 'SYSTEM_PLUGIN_NEWS_NEWSNOW', paramInfo: { url: 'https://news.example.com/api/s?id=', news_sources: 'প্রথম পাতা;খেলা;বিজ্ঞান' } },
    { pluginId: 'SYSTEM_PLUGIN_MUSIC', paramInfo: {} },
  ],
  contextProviders: [{ url: 'https://example.com/tinybot/today', headers: { 'X-Api-Key': 'demo-****' } }],
  correctWordFileIds: ['cw-1'],
  currentVersionNo: 4,
};
let tags = [{ id: 'tag-1', tagName: 'বাসা' }, { id: 'tag-2', tagName: 'সঙ্গী' }];

const pick = (c) => {
  const { id, currentVersionNo, ...rest } = c;
  void id; void currentVersionNo;
  return { ...rest, tagNames: tags.map((t) => t.tagName) };
};
const v1 = { ...pick(config), agentName: 'TinyBot', systemPrompt: 'তুমি টাইনিবট। সহজ বাংলায় কথা বলো।', memModelId: 'Memory_nomem', chatHistoryConf: 0, summaryMemory: '', ttsRate: 0, functions: [{ pluginId: 'SYSTEM_PLUGIN_WEATHER', paramInfo: { api_key: '', default_location: 'Dhaka' } }], contextProviders: [], correctWordFileIds: [], tagNames: [] };
const v2 = { ...v1, agentName: 'টাইনিবট', memModelId: 'Memory_mem_local_short', chatHistoryConf: 2, tagNames: ['বাসা'] };
const v3 = { ...v2, systemPrompt: PROMPT, functions: config.functions.slice(0, 2), ttsRate: 10 };
let snapshots = [
  { id: 'snap-4', versionNo: 4, createdAt: day(1), source: 'config', changedFields: ['functions', 'contextProviders', 'correctWordFileIds', 'tagNames'], snapshotData: pick(config) },
  { id: 'snap-3', versionNo: 3, createdAt: day(6), source: 'config', changedFields: ['systemPrompt', 'functions', 'ttsRate'], snapshotData: v3 },
  { id: 'snap-2', versionNo: 2, createdAt: day(12), source: 'config', changedFields: ['agentName', 'memModelId', 'chatHistoryConf', 'tagNames'], snapshotData: v2 },
  { id: 'snap-1', versionNo: 1, createdAt: day(30), source: 'initial', changedFields: ['initial'], snapshotData: v1 },
];
const detail = (s) => ({ ...s, currentSnapshotData: pick(config), currentStateToken: `demo-state-${config.currentVersionNo}` });
const nextVersion = (source, changedFields) => {
  const versionNo = (snapshots[0]?.versionNo || 0) + 1;
  config.currentVersionNo = versionNo;
  snapshots = [{ id: `snap-${versionNo}`, versionNo, createdAt: day(0), source, changedFields, snapshotData: pick(config) }, ...snapshots];
};

export default [
  { method: 'GET', url: new RegExp(`/agent/${AGENT}$`), reply: () => JSON.parse(JSON.stringify(config)) },
  {
    method: 'PUT', url: new RegExp(`/agent/${AGENT}$`), reply: (req) => {
      const b = body(req);
      const changed = Object.keys(b).filter((k) => JSON.stringify(b[k]) !== JSON.stringify(config[k]) && k !== 'tagNames');
      config = { ...config, ...b };
      if (Array.isArray(b.tagNames)) { tags = b.tagNames.map((tagName, i) => ({ id: `tag-${Date.now()}-${i}`, tagName })); changed.push('tagNames'); }
      nextVersion('config', changed);
      return null;
    },
  },
  { method: 'GET', url: new RegExp(`/agent/${AGENT}/tags$`), reply: () => tags },
  {
    method: 'GET', url: new RegExp(`/agent/${AGENT}/snapshots$`), reply: (req) => {
      const p = q(req);
      const max = Number(p.maxVersionNo) || Infinity;
      const list = snapshots.filter((s) => s.versionNo <= max);
      const page = Number(p.page) || 1;
      const limit = Number(p.limit) || 10;
      return { list: list.slice((page - 1) * limit, page * limit).map(({ snapshotData, ...row }) => { void snapshotData; return row; }), total: list.length };
    },
  },
  {
    method: 'GET', url: new RegExp(`/agent/${AGENT}/snapshots/[^/]+$`), body: (req) => {
      const s = snapshots.find((x) => x.id === req.path.split('/').pop());
      return s ? ok(detail(s)) : { code: 404, msg: 'Version not found', data: null };
    },
  },
  {
    method: 'POST', url: new RegExp(`/agent/${AGENT}/snapshots/[^/]+/restore$`), body: (req) => {
      const s = snapshots.find((x) => x.id === req.path.split('/')[req.path.split('/').length - 2]);
      if (!s) return { code: 404, msg: 'Version not found', data: null };
      const { tagNames, ...data } = s.snapshotData;
      config = { ...config, ...data };
      tags = (tagNames || []).map((tagName, i) => ({ id: `tag-r${i}`, tagName }));
      nextVersion('restore', ['restore']);
      return ok(null);
    },
  },
  {
    method: 'DELETE', url: new RegExp(`/agent/${AGENT}/snapshots/[^/]+$`), body: (req) => {
      const id = req.path.split('/').pop();
      snapshots = snapshots.filter((x) => x.id !== id || x === snapshots[0]);
      return ok(null);
    },
  },
  { method: 'GET', url: new RegExp(`/agent/mcp/address/${AGENT}$`), reply: `wss://mcp.example.com/mcp/?token=demo-****` },
  { method: 'GET', url: new RegExp(`/agent/mcp/tools/${AGENT}$`), reply: ['home_lights', 'calendar_today'] },
  { method: 'GET', url: /\/models\/names$/, reply: (req) => MODELS[q(req).modelType] || [] },
  { method: 'GET', url: /\/models\/llm\/names$/, reply: LLMS },
  { method: 'GET', url: /\/models\/[^/]+\/voices$/, reply: (req) => VOICES[req.path.split('/').slice(-2)[0]] || [] },
  { method: 'GET', url: /\/models\/provider\/plugin\/names$/, reply: PLUGINS },
  { method: 'GET', url: /\/correct-word\/file\/select$/, reply: WORD_FILES },
];
