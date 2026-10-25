// Demo fixtures for Models and Providers (owner: web-models). Synthetic sample data: provider
// codes are the service's own configuration names; keys are masked placeholders, never real.

const F = (list) => JSON.stringify(list);

const providers = [
  { id: 'p-asr-1', modelType: 'ASR', providerCode: 'fun_local', name: 'FunASR (local)', sort: 1,
    fields: F([{ key: 'model_dir', label: 'Model folder', type: 'string', default: 'models/SenseVoiceSmall' }, { key: 'output_dir', label: 'Output folder', type: 'string', default: 'tmp/' }]) },
  { id: 'p-asr-2', modelType: 'ASR', providerCode: 'openai', name: 'OpenAI-compatible speech', sort: 2,
    fields: F([{ key: 'api_key', label: 'API key', type: 'string', default: '' }, { key: 'base_url', label: 'Endpoint', type: 'string', default: '' }, { key: 'model_name', label: 'Model', type: 'string', default: '' }]) },
  { id: 'p-llm-1', modelType: 'LLM', providerCode: 'openai', name: 'OpenAI-compatible', sort: 1,
    fields: F([{ key: 'base_url', label: 'Endpoint', type: 'string', default: '' }, { key: 'model_name', label: 'Model', type: 'string', default: '' }, { key: 'api_key', label: 'API key', type: 'string', default: '' }, { key: 'temperature', label: 'Temperature', type: 'number', default: '0.7' }, { key: 'extra_body', label: 'Extra request body', type: 'dict', default: '' }]) },
  { id: 'p-llm-2', modelType: 'LLM', providerCode: 'ollama', name: 'Ollama (local)', sort: 2,
    fields: F([{ key: 'base_url', label: 'Endpoint', type: 'string', default: 'http://localhost:11434' }, { key: 'model_name', label: 'Model', type: 'string', default: '' }]) },
  { id: 'p-vllm-1', modelType: 'VLLM', providerCode: 'openai', name: 'OpenAI-compatible vision', sort: 1,
    fields: F([{ key: 'base_url', label: 'Endpoint', type: 'string', default: '' }, { key: 'model_name', label: 'Model', type: 'string', default: '' }, { key: 'api_key', label: 'API key', type: 'string', default: '' }]) },
  { id: 'p-tts-1', modelType: 'TTS', providerCode: 'edge', name: 'Edge TTS', sort: 1,
    fields: F([{ key: 'voice', label: 'Voice', type: 'string', default: 'bn-BD-NabanitaNeural' }, { key: 'output_dir', label: 'Output folder', type: 'string', default: 'tmp/' }]) },
  { id: 'p-tts-2', modelType: 'TTS', providerCode: 'gpt_sovits_v3', name: 'GPT-SoVITS v3', sort: 2,
    fields: F([{ key: 'url', label: 'Service address', type: 'string', default: '' }, { key: 'ref_audio', label: 'Reference audio', type: 'string', default: '' }, { key: 'prosody', label: 'Prosody', type: 'dict', default: '' }]) },
  { id: 'p-vad-1', modelType: 'VAD', providerCode: 'silero', name: 'Silero VAD', sort: 1,
    fields: F([{ key: 'threshold', label: 'Threshold', type: 'number', default: '0.5' }, { key: 'min_silence_duration_ms', label: 'Silence (ms)', type: 'number', default: '700' }]) },
  { id: 'p-intent-1', modelType: 'Intent', providerCode: 'function_call', name: 'Function calling', sort: 1,
    fields: F([{ key: 'functions', label: 'Functions', type: 'array', default: 'get_weather;play_music' }]) },
  { id: 'p-mem-1', modelType: 'Memory', providerCode: 'mem_local_short', name: 'Local short memory', sort: 1, fields: F([]) },
  { id: 'p-mem-2', modelType: 'Memory', providerCode: 'nomem', name: 'No memory', sort: 2, fields: F([]) },
  { id: 'p-plugin-1', modelType: 'Plugin', providerCode: 'get_weather', name: 'Weather', sort: 1,
    fields: F([{ key: 'api_key', label: 'Weather API key', type: 'string', default: '' }, { key: 'default_location', label: 'Default city', type: 'string', default: 'Dhaka' }]) },
  { id: 'p-rag-1', modelType: 'RAG', providerCode: 'ragflow', name: 'RAGFlow', sort: 1,
    fields: F([{ key: 'base_url', label: 'Endpoint', type: 'string', default: '' }, { key: 'api_key', label: 'API key', type: 'string', default: '' }]) },
];

const models = [
  { id: 'ASR_FunASR', modelType: 'ASR', modelName: 'FunASR local', modelCode: 'SenseVoiceSmall', isDefault: 1, isEnabled: 1, sort: 1,
    configJson: { type: 'fun_local', model_dir: 'models/SenseVoiceSmall', output_dir: 'tmp/' }, remark: '', docLink: '' },
  { id: 'ASR_OpenAI', modelType: 'ASR', modelName: 'Cloud speech', modelCode: 'whisper-1', isDefault: 0, isEnabled: 0, sort: 2,
    configJson: { type: 'openai', api_key: 'sk-d****mo', base_url: 'https://api.example.com/v1', model_name: 'whisper-1' }, remark: '', docLink: '' },
  { id: 'LLM_Groq', modelType: 'LLM', modelName: 'Groq', modelCode: 'llama-3.3-70b', isDefault: 1, isEnabled: 1, sort: 1,
    configJson: { type: 'openai', base_url: 'https://api.example.com/openai/v1', model_name: 'llama-3.3-70b', api_key: 'gsk_****demo', temperature: '0.7', extra_body: { top_p: 0.9 } },
    remark: 'Fast replies for everyday chat', docLink: '' },
  { id: 'LLM_Local', modelType: 'LLM', modelName: 'Office local model', modelCode: 'qwen2.5:7b', isDefault: 0, isEnabled: 1, sort: 2,
    configJson: { type: 'ollama', base_url: 'http://localhost:11434', model_name: 'qwen2.5:7b' }, remark: '', docLink: '' },
  { id: 'LLM_Backup', modelType: 'LLM', modelName: 'Backup cloud model', modelCode: 'gpt-4o-mini', isDefault: 0, isEnabled: 0, sort: 3,
    configJson: { type: 'openai', base_url: 'https://api.example.com/v1', model_name: 'gpt-4o-mini', api_key: 'sk-b****up', temperature: '0.5', extra_body: {} },
    remark: '', docLink: '' },
  { id: 'VLLM_Vision', modelType: 'VLLM', modelName: 'Vision', modelCode: 'gpt-4o-mini', isDefault: 1, isEnabled: 1, sort: 1,
    configJson: { type: 'openai', base_url: 'https://api.example.com/v1', model_name: 'gpt-4o-mini', api_key: 'sk-v****on' }, remark: '', docLink: '' },
  { id: 'TTS_EdgeTTS', modelType: 'TTS', modelName: 'EdgeTTS', modelCode: 'edge', isDefault: 1, isEnabled: 1, sort: 1,
    configJson: { type: 'edge', voice: 'bn-BD-NabanitaNeural', output_dir: 'tmp/' }, remark: '', docLink: '' },
  { id: 'TTS_SoVITS', modelType: 'TTS', modelName: 'Cloned voice (SoVITS)', modelCode: 'gpt_sovits_v3', isDefault: 0, isEnabled: 1, sort: 2,
    configJson: { type: 'gpt_sovits_v3', url: 'http://127.0.0.1:9880/tts', ref_audio: 'refs/sample.wav', prosody: '{"speed":1,"volume":10}' }, remark: '', docLink: '' },
  { id: 'Intent_FunctionCall', modelType: 'Intent', modelName: 'Function calling', modelCode: 'function_call', isDefault: 1, isEnabled: 1, sort: 1,
    configJson: { type: 'function_call', functions: 'get_weather;play_music' }, remark: '', docLink: '' },
  { id: 'Memory_Local', modelType: 'Memory', modelName: 'Local short memory', modelCode: 'mem_local_short', isDefault: 1, isEnabled: 1, sort: 1,
    configJson: { type: 'mem_local_short' }, remark: '', docLink: '' },
  { id: 'Memory_None', modelType: 'Memory', modelName: 'No memory', modelCode: 'nomem', isDefault: 0, isEnabled: 1, sort: 2,
    configJson: { type: 'nomem' }, remark: '', docLink: '' },
  { id: 'VAD_Silero', modelType: 'VAD', modelName: 'Silero VAD', modelCode: 'silero', isDefault: 1, isEnabled: 1, sort: 1,
    configJson: { type: 'silero', threshold: '0.5', min_silence_duration_ms: '700' }, remark: '', docLink: '' },
];

const voices = [
  { id: 'v1', ttsModelId: 'TTS_EdgeTTS', name: 'Nabanita', ttsVoice: 'bn-BD-NabanitaNeural', languages: 'Bangla', remark: 'Default voice', voiceDemo: '', sort: 1 },
  { id: 'v2', ttsModelId: 'TTS_EdgeTTS', name: 'Pradeep', ttsVoice: 'bn-BD-PradeepNeural', languages: 'Bangla', remark: '', voiceDemo: '', sort: 2 },
  { id: 'v3', ttsModelId: 'TTS_EdgeTTS', name: 'Tanishaa', ttsVoice: 'bn-IN-TanishaaNeural', languages: 'Bangla', remark: '', voiceDemo: '', sort: 3 },
  { id: 'v4', ttsModelId: 'TTS_EdgeTTS', name: 'Jenny', ttsVoice: 'en-US-JennyNeural', languages: 'English', remark: '', voiceDemo: '', sort: 4 },
  { id: 'v5', ttsModelId: 'TTS_SoVITS', name: 'Sample voice', ttsVoice: 'sample', languages: 'Bangla', remark: '', voiceDemo: '',
    referenceAudio: 'refs/sample.wav', referenceText: 'আজ আকাশ পরিষ্কার।', sort: 1 },
];

const ok = (data = null) => ({ code: 0, msg: 'ok', data });
const page = (list, q) => {
  const p = Math.max(1, Number(q.page) || 1);
  const l = Math.max(1, Number(q.limit) || 10);
  return { list: list.slice((p - 1) * l, p * l), total: list.length };
};
const typeOf = (key) => ({ asr: 'ASR', llm: 'LLM', vllm: 'VLLM', tts: 'TTS', intent: 'Intent', memory: 'Memory', vad: 'VAD', rag: 'RAG' }[String(key).toLowerCase()] || key);
const parse = (d) => (typeof d === 'string' ? (() => { try { return JSON.parse(d); } catch (e) { return {}; } })() : (d || {}));
const last = (path) => decodeURIComponent(path.split('/').pop());

export default [
  // models
  { method: 'GET', url: /\/models\/list$/, reply: (req) => {
    const t = typeOf(req.query.modelType);
    const name = String(req.query.modelName || '').toLowerCase();
    const list = models.filter((m) => m.modelType === t && (!name || m.modelName.toLowerCase().includes(name))).sort((a, b) => a.sort - b.sort);
    return page(list, req.query);
  } },
  { method: 'GET', url: /\/models\/[^/]+\/provideTypes$/, reply: (req) => {
    const t = typeOf(req.path.split('/').slice(-2)[0]);
    return providers.filter((p) => p.modelType === t);
  } },
  { method: 'GET', url: /\/models\/provider$/, reply: (req) => {
    const name = String(req.query.name || '').toLowerCase();
    const t = req.query.modelType || '';
    const list = providers.filter((p) => (!t || p.modelType === t) && (!name || p.name.toLowerCase().includes(name)));
    return page(list, req.query);
  } },
  { method: 'POST', url: /\/models\/provider\/delete$/, body: (req) => {
    const ids = parse(req.data);
    for (const id of [].concat(ids)) { const i = providers.findIndex((p) => p.id === id); if (i >= 0) providers.splice(i, 1); }
    return ok();
  } },
  { method: 'POST', url: /\/models\/provider$/, body: (req) => { providers.push({ ...parse(req.data), id: `p-new-${providers.length + 1}` }); return ok(); } },
  { method: 'PUT', url: /\/models\/provider$/, body: (req) => {
    const d = parse(req.data);
    const p = providers.find((x) => x.id === d.id);
    if (p) Object.assign(p, d);
    return ok();
  } },
  { method: 'PUT', url: /\/models\/enable\/[^/]+\/[01]$/, body: (req) => {
    const parts = req.path.split('/');
    const m = models.find((x) => x.id === decodeURIComponent(parts[parts.length - 2]));
    if (m) m.isEnabled = Number(parts[parts.length - 1]);
    return ok();
  } },
  { method: 'PUT', url: /\/models\/default\/[^/]+$/, body: (req) => {
    const m = models.find((x) => x.id === last(req.path));
    if (m) { models.filter((x) => x.modelType === m.modelType).forEach((x) => { x.isDefault = 0; }); m.isDefault = 1; m.isEnabled = 1; }
    return ok();
  } },
  { method: 'GET', url: /\/models\/(?!list$|names$|provider$)[^/]+$/, body: (req) => {
    const m = models.find((x) => x.id === last(req.path));
    return m ? ok(JSON.parse(JSON.stringify(m))) : { code: 404, msg: 'Model not found', data: null };
  } },
  { method: 'DELETE', url: /\/models\/[^/]+$/, body: (req) => {
    const i = models.findIndex((x) => x.id === last(req.path));
    if (i >= 0) models.splice(i, 1);
    return ok();
  } },
  { method: 'POST', url: /\/models\/[^/]+\/[^/]+$/, body: (req) => {
    const parts = req.path.split('/');
    const d = parse(req.data);
    const t = typeOf(parts[parts.length - 2]);
    models.push({ ...d, id: d.id || `${t}_${Date.now().toString(36)}`, modelType: t, isDefault: 0 });
    return ok();
  } },
  { method: 'PUT', url: /\/models\/[^/]+\/[^/]+\/[^/]+$/, body: (req) => {
    const m = models.find((x) => x.id === last(req.path));
    if (m) Object.assign(m, parse(req.data));
    return ok();
  } },

  // TTS voices
  { method: 'GET', url: /\/ttsVoice$/, reply: (req) => {
    const list = voices.filter((v) => v.ttsModelId === req.query.ttsModelId);
    return { list, total: list.length };
  } },
  { method: 'POST', url: /\/ttsVoice\/delete$/, body: (req) => {
    for (const id of [].concat(parse(req.data))) { const i = voices.findIndex((v) => v.id === id); if (i >= 0) voices.splice(i, 1); }
    return ok();
  } },
  { method: 'POST', url: /\/ttsVoice$/, body: (req) => { voices.push({ ...parse(req.data), id: `v-new-${voices.length + 1}` }); return ok(); } },
  { method: 'PUT', url: /\/ttsVoice\/[^/]+$/, body: (req) => {
    const v = voices.find((x) => x.id === last(req.path));
    if (v) Object.assign(v, parse(req.data));
    return ok();
  } },
];
