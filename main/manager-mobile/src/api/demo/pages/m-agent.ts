import type { DemoHandler } from '../index'
import { onPage } from '../index'

// Character screens (owner: m-agent): pages/agent/index, edit, tools, provider, speedPitch.
// Synthetic sample data only. Every pattern is scoped to /pages/agent/ so it never answers
// another screen. Model and voice ids follow the server's own id style.
const AT = '/pages/agent/'
const scoped = (pattern: RegExp) => onPage(AT, pattern)

const now = Date.now()
function stamp(msAgo: number) {
  const d = new Date(now - msAgo)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
const DAY = 86400000

const MODELS: Record<string, { id: string, modelName: string }[]> = {
  VAD: [{ id: 'VAD_SileroVAD', modelName: 'Silero VAD' }],
  ASR: [{ id: 'ASR_FunASR', modelName: 'FunASR (local)' }, { id: 'ASR_GroqASR', modelName: 'Groq Whisper' }],
  LLM: [{ id: 'LLM_GroqLLM', modelName: 'Groq Llama 3.3 70B' }, { id: 'LLM_GeminiLLM', modelName: 'Gemini 2.0 Flash' }, { id: 'LLM_OllamaLLM', modelName: 'Ollama (local)' }],
  VLLM: [{ id: 'VLLM_GeminiVLLM', modelName: 'Gemini Vision' }],
  Intent: [{ id: 'Intent_function_call', modelName: 'Function calling' }, { id: 'Intent_intent_llm', modelName: 'Intent by LLM' }, { id: 'Intent_nointent', modelName: 'No intent' }],
  Memory: [{ id: 'Memory_mem_local_short', modelName: 'Local short memory' }, { id: 'Memory_mem_report_only', modelName: 'Chat report only' }, { id: 'Memory_nomem', modelName: 'No memory' }],
  TTS: [{ id: 'TTS_EdgeTTS', modelName: 'Edge TTS' }, { id: 'TTS_GoogleTTS', modelName: 'Google TTS' }],
}

const VOICES: Record<string, any[]> = {
  TTS_EdgeTTS: [
    { id: 'TTS_EdgeTTS_bn_nabanita', name: 'Nabanita', languages: 'bn-BD', voiceDemo: 'voice-demos/bn-BD-NabanitaNeural.mp3', isClone: false },
    { id: 'TTS_EdgeTTS_bn_pradeep', name: 'Pradeep', languages: 'bn-BD', voiceDemo: 'voice-demos/bn-BD-PradeepNeural.mp3', isClone: false },
    { id: 'TTS_EdgeTTS_bn_tanishaa', name: 'Tanishaa', languages: 'bn-IN', voiceDemo: 'voice-demos/bn-IN-TanishaaNeural.mp3', isClone: false },
    { id: 'TTS_EdgeTTS_bn_bashkar', name: 'Bashkar', languages: 'bn-IN', voiceDemo: 'voice-demos/bn-IN-BashkarNeural.mp3', isClone: false },
    { id: 'TTS_EdgeTTS_en_aria', name: 'Aria', languages: 'en-US', voiceDemo: 'voice-demos/en-US-AriaNeural.mp3', isClone: false },
    { id: 'TTS_EdgeTTS_en_sonia', name: 'Sonia', languages: 'en-GB', voiceDemo: 'voice-demos/en-GB-SoniaNeural.mp3', isClone: false },
  ],
  TTS_GoogleTTS: [
    { id: 'TTS_GoogleTTS_bn', name: 'Bangla (standard)', languages: 'bn-BD', voiceDemo: null, isClone: false },
    { id: 'TTS_GoogleTTS_en', name: 'English (standard)', languages: 'en-US', voiceDemo: null, isClone: false },
  ],
}

const PLUGINS = [
  { id: 'SYSTEM_PLUGIN_WEATHER', name: 'আবহাওয়া', providerCode: 'get_weather', modelType: 'Plugin', sort: 1, fields: JSON.stringify([{ key: 'default_location', type: 'string', label: 'শহর', default: 'Dhaka' }, { key: 'units', type: 'string', label: 'একক', default: 'metric' }]) },
  { id: 'SYSTEM_PLUGIN_NEWS', name: 'খবর', providerCode: 'get_news', modelType: 'Plugin', sort: 2, fields: JSON.stringify([{ key: 'sources', type: 'array', label: 'খবরের সোর্স', default: '' }, { key: 'max_items', type: 'number', label: 'কটি শিরোনাম', default: 5 }]) },
  { id: 'SYSTEM_PLUGIN_MUSIC', name: 'গান বাজানো', providerCode: 'play_music', modelType: 'Plugin', sort: 3, fields: '[]' },
  { id: 'SYSTEM_PLUGIN_HA_STATE', name: 'Home Assistant', providerCode: 'hass_state', modelType: 'Plugin', sort: 4, fields: JSON.stringify([{ key: 'base_url', type: 'string', label: 'Home Assistant ঠিকানা', default: '' }, { key: 'devices', type: 'array', label: 'ডিভাইস', default: '' }, { key: 'extra', type: 'json', label: 'বাড়তি সেটিং', default: '' }, { key: 'confirm_first', type: 'boolean', label: 'আগে জিজ্ঞেস করবে', default: false }]) },
]

const PROMPT = 'তুমি টাইনিবট, ডেস্কের ছোট্ট একটা রোবট। তুমি সহজ বাংলায় ছোট ছোট বাক্যে কথা বলো, হাসিখুশি থাকো আর মালিকের দিনের খোঁজ নাও।\nকেউ মন খারাপ করলে আগে শোনো, তারপর আলতো করে সাহস দাও।\nউত্তর দুই-তিন বাক্যের বেশি লম্বা কোরো না।'

let detail: Record<string, any> = {
  id: 'demo-agent-1',
  agentCode: 'AGT_DEMO',
  agentName: 'TinyBot',
  userId: '1',
  asrModelId: 'ASR_FunASR',
  vadModelId: 'VAD_SileroVAD',
  llmModelId: 'LLM_GroqLLM',
  slmModelId: 'LLM_GroqLLM',
  vllmModelId: 'VLLM_GeminiVLLM',
  ttsModelId: 'TTS_EdgeTTS',
  ttsVoiceId: 'TTS_EdgeTTS_bn_nabanita',
  ttsLanguage: 'bn-BD',
  ttsVolume: 0,
  ttsRate: 10,
  ttsPitch: 0,
  memModelId: 'Memory_mem_local_short',
  intentModelId: 'Intent_function_call',
  chatHistoryConf: 2,
  systemPrompt: PROMPT,
  summaryMemory: 'মালিক সকালে চা খান, বিকেলে হাঁটতে বের হন। প্রিয় রং সবুজ। শুক্রবার বাড়িতে থাকেন।',
  langCode: 'bn',
  language: 'বাংলা',
  sort: 0,
  currentVersionNo: 12,
  functions: [
    { pluginId: 'SYSTEM_PLUGIN_WEATHER', paramInfo: { default_location: 'Dhaka', units: 'metric' } },
    { pluginId: 'SYSTEM_PLUGIN_MUSIC', paramInfo: {} },
  ],
  contextProviders: [{ url: 'https://example.com/tinybot/today.json', headers: { Accept: 'application/json' } }],
}

let tags = [{ id: 't1', tagName: 'বন্ধু' }, { id: 't2', tagName: 'বাংলা' }]

const TEMPLATES = [
  { id: 'tpl-friend', agentName: 'বন্ধু টাইনিবট', systemPrompt: 'তুমি টাইনিবট, মালিকের ডেস্কের বন্ধু। তুমি সহজ বাংলায় কথা বলো আর দিনের খোঁজ নাও।', ttsModelId: 'TTS_EdgeTTS', ttsVoiceId: 'TTS_EdgeTTS_bn_nabanita', ttsLanguage: 'bn-BD', llmModelId: 'LLM_GroqLLM', memModelId: 'Memory_mem_local_short', intentModelId: 'Intent_function_call', chatHistoryConf: 2, langCode: 'bn' },
  { id: 'tpl-story', agentName: 'গল্প বলিয়ে', systemPrompt: 'তুমি ছোট ছোট গল্প বলতে ভালোবাসো। প্রতিটি গল্প পাঁচ-ছয় বাক্যে শেষ করো।', ttsModelId: 'TTS_EdgeTTS', ttsVoiceId: 'TTS_EdgeTTS_bn_pradeep', ttsLanguage: 'bn-BD', langCode: 'bn' },
  { id: 'tpl-study', agentName: 'পড়ার সাথী', systemPrompt: 'You help with study in short, clear English sentences and ask one question at a time.', ttsModelId: 'TTS_EdgeTTS', ttsVoiceId: 'TTS_EdgeTTS_en_aria', ttsLanguage: 'en-US', langCode: 'en' },
]

function snapData(over: Record<string, any> = {}) {
  const { currentVersionNo, id, userId, ...rest } = detail
  return { ...rest, tagNames: tags.map(t => t.tagName), ...over }
}

function snapshots() {
  const v = detail.currentVersionNo || 12
  return [
    { id: `snap-${v}`, agentId: 'demo-agent-1', versionNo: v, source: 'config', createdAt: stamp(2 * 3600000), changedFields: ['ttsRate', 'summaryMemory'], snapshotData: snapData() },
    { id: `snap-${v - 1}`, agentId: 'demo-agent-1', versionNo: v - 1, source: 'config', createdAt: stamp(3 * DAY), changedFields: ['systemPrompt', 'functions'], snapshotData: snapData({ ttsRate: 0, summaryMemory: 'মালিক সকালে চা খান।' }) },
    { id: `snap-${v - 2}`, agentId: 'demo-agent-1', versionNo: v - 2, source: 'restore', createdAt: stamp(9 * DAY), changedFields: ['ttsVoiceId', 'ttsLanguage'], snapshotData: snapData({ ttsRate: 0, ttsVoiceId: 'TTS_EdgeTTS_bn_pradeep', systemPrompt: 'তুমি টাইনিবট, ডেস্কের ছোট রোবট।', functions: [{ pluginId: 'SYSTEM_PLUGIN_WEATHER', paramInfo: { default_location: 'Dhaka' } }], summaryMemory: '' }) },
  ]
}

const handlers: DemoHandler[] = [
  // Lists the character screens choose from
  { method: 'GET', url: scoped(/\/agent\/template$/), reply: TEMPLATES },
  { method: 'GET', url: scoped(/\/models\/names$/), reply: (req: any) => MODELS[req.query.modelType] || [] },
  { method: 'GET', url: scoped(/\/models\/[^/]+\/voices$/), reply: (req: any) => VOICES[req.path.split('/').slice(-2)[0]] || [] },
  { method: 'GET', url: scoped(/\/models\/provider\/plugin\/names$/), reply: PLUGINS },
  { method: 'GET', url: scoped(/\/correct-word\/file\/select$/), reply: [{ id: 'cw1', fileName: 'নামের উচ্চারণ', wordCount: 4 }] },
  { method: 'POST', url: scoped(/\/voiceClone\/audio\/[^/]+$/), reply: 'demo-clone-audio' },

  // MCP endpoint
  { method: 'GET', url: scoped(/\/agent\/mcp\/address\/[^/]+$/), reply: 'wss://mcp.example.com/mcp/?token=demo-token' },
  { method: 'GET', url: scoped(/\/agent\/mcp\/tools\/[^/]+$/), reply: ['lamp.turn_on', 'lamp.turn_off', 'calendar.today'] },

  // Version history
  {
    method: 'GET',
    url: scoped(/\/agent\/[^/]+\/snapshots$/),
    reply: (req: any) => {
      const all = snapshots().filter(s => !req.query.maxVersionNo || s.versionNo <= Number(req.query.maxVersionNo))
      const page = Number(req.query.page || 1)
      const limit = Number(req.query.limit || 10)
      return { total: all.length, list: all.slice((page - 1) * limit, page * limit).map(({ snapshotData, ...row }) => row) }
    },
  },
  {
    method: 'GET',
    url: scoped(/\/agent\/[^/]+\/snapshots\/[^/]+$/),
    reply: (req: any) => {
      const sid = req.path.split('/').pop()
      const s = snapshots().find(x => x.id === sid)
      return s ? { ...s, fieldOrder: [], currentSnapshotData: snapData(), currentStateToken: `demo-state-${detail.currentVersionNo}` } : undefined
    },
  },
  { method: 'POST', url: scoped(/\/agent\/[^/]+\/snapshots\/[^/]+\/restore$/), reply: () => {
    detail = { ...detail, currentVersionNo: (detail.currentVersionNo || 12) + 1 }
    return true
  } },
  { method: 'DELETE', url: scoped(/\/agent\/[^/]+\/snapshots\/[^/]+$/), reply: true },

  // The character itself
  { method: 'GET', url: scoped(/\/agent\/[^/]+\/tags$/), reply: () => tags },
  { method: 'GET', url: scoped(/\/agent\/(?!list$|template$)[^/]+$/), reply: (req: any) => ({ ...detail, id: req.path.split('/').pop() }) },
  {
    method: 'PUT',
    url: scoped(/\/agent\/(?!list$|template$)[^/]+$/),
    reply: (req: any) => {
      const data = { ...(req.data || {}) }
      if (Array.isArray(data.tagNames)) {
        tags = data.tagNames.map((name: string, i: number) => ({ id: `t${i + 1}`, tagName: name }))
        delete data.tagNames
      }
      detail = { ...detail, ...data, currentVersionNo: (detail.currentVersionNo || 12) + 1 }
      return true
    },
  },
]

export default handlers
