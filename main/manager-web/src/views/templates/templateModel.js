// Character templates: the shape the template API expects, shared by the list's edit sheet and the
// full-page editor. The model ids are not edited here: a template carries them, and a new one gets
// the server defaults below (the same defaults the old pages sent).

export const NAME_MAX = 64;
export const PROMPT_MAX = 2000;
export const PROMPT_NEAR = 1800;

export const DEFAULT_MODEL_CONFIG = Object.freeze({
  ttsModelId: 'TTS_EdgeTTS',
  vadModelId: 'VAD_SileroVAD',
  asrModelId: 'ASR_FunASR',
  llmModelId: 'LLM_ChatGLMLLM',
  vllmModelId: 'VLLM_ChatGLMVLLM',
  memModelId: 'Memory_nomem',
  intentModelId: 'Intent_function_call',
});

// The order the models are listed in, with their i18n label keys.
export const MODEL_FIELDS = [
  ['llmModelId', 'templates.model.llm'],
  ['vllmModelId', 'templates.model.vllm'],
  ['ttsModelId', 'templates.model.tts'],
  ['asrModelId', 'templates.model.asr'],
  ['vadModelId', 'templates.model.vad'],
  ['memModelId', 'templates.model.mem'],
  ['intentModelId', 'templates.model.intent'],
];

export function emptyForm(name = '', sort = 0) {
  return { id: null, agentCode: 'Xiaozhi', agentName: name, systemPrompt: '', sort, model: { ...DEFAULT_MODEL_CONFIG } };
}

// A template from the API (flat model ids) into the form; missing values fall back to `base`.
export function formFromTemplate(t, base = emptyForm()) {
  const model = {};
  for (const k of Object.keys(DEFAULT_MODEL_CONFIG)) model[k] = (t && t[k]) || base.model[k] || DEFAULT_MODEL_CONFIG[k];
  return {
    id: (t && t.id) || base.id || null,
    agentCode: (t && t.agentCode) || base.agentCode || 'Xiaozhi',
    agentName: (t && t.agentName) || base.agentName || '',
    systemPrompt: (t && t.systemPrompt) || base.systemPrompt || '',
    sort: (t && t.sort) || base.sort || 0,
    model,
  };
}

// The body of POST/PUT /agent/template.
export function payloadOf(form) {
  return {
    id: form.id || '',
    agentCode: form.agentCode,
    agentName: form.agentName,
    systemPrompt: form.systemPrompt,
    sort: form.sort,
    functions: [],
    ...form.model,
  };
}

// The sort a new template gets: one after the highest existing one.
export function nextSort(list) {
  if (!Array.isArray(list) || !list.length) return 1;
  return Math.max(...list.map((t) => Number(t && t.sort) || 0)) + 1;
}

// Field errors as i18n keys (empty object = valid).
export function validate(form) {
  const e = {};
  if (!String(form.agentName || '').trim()) e.agentName = 'templates.err.name';
  if (!String(form.systemPrompt || '').trim()) e.systemPrompt = 'templates.err.prompt';
  return e;
}

export const snapshot = (form) => JSON.stringify(form);
export const clone = (form) => JSON.parse(JSON.stringify(form));
