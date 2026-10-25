// Character & voice: the pure rules of the page, kept apart from the view so they can be tested.
// Every rule here comes from the legacy roleConfig.vue and behaves the same way.

export const NO_MEMORY = 'Memory_nomem';
export const LOCAL_SHORT_MEMORY = 'Memory_mem_local_short';
export const REPORT_ONLY_MEMORY = 'Memory_mem_report_only';
export const NO_INTENT = 'Intent_nointent';
export const FUNCTION_CALL_INTENT = 'Intent_function_call';
export const PROMPT_MAX = 2000;
export const PROMPT_NEAR = 1800;

// The model pickers, in the order the legacy page fetched them. SLM picks from the LLM list.
export const MODEL_TYPES = [
  { type: 'VAD', key: 'vadModelId' },
  { type: 'ASR', key: 'asrModelId' },
  { type: 'LLM', key: 'llmModelId' },
  { type: 'SLM', key: 'slmModelId' },
  { type: 'VLLM', key: 'vllmModelId' },
  { type: 'Intent', key: 'intentModelId' },
  { type: 'Memory', key: 'memModelId' },
  { type: 'TTS', key: 'ttsModelId' },
];

export function emptyModels() {
  return { ttsModelId: '', vadModelId: '', asrModelId: '', llmModelId: '', slmModelId: '', vllmModelId: '', memModelId: '', intentModelId: '' };
}

export function emptyForm() {
  return {
    agentCode: '', agentName: '', ttsVoiceId: '', ttsLanguage: '', ttsVolume: null, ttsRate: null, ttsPitch: null,
    chatHistoryConf: 0, systemPrompt: '', summaryMemory: '', langCode: '', language: '', sort: '', model: emptyModels(),
  };
}

export const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** A voice's languages: "Bangla, English" (any of 、；;,，) becomes ['Bangla', 'English']. */
export function splitVoiceLanguages(voice) {
  return voice && voice.languages
    ? String(voice.languages).split(/[、；;,，]/).map((l) => l.trim()).filter(Boolean)
    : [];
}

function voiceOption(v) {
  return { value: v.id, label: v.name, voiceDemo: v.voiceDemo, voice_demo: v.voice_demo, isClone: Boolean(v.isClone), train_status: v.trainStatus };
}

/** Voices that speak `language`. A voice that declares no language is left to its provider. */
export function voicesForLanguage(voiceDetails, language) {
  return Object.values(voiceDetails || {}).filter((v) => {
    const langs = splitVoiceLanguages(v);
    return langs.length === 0 || langs.includes(language);
  });
}

export function voiceOptionsOf(voices) {
  return (voices || []).map(voiceOption);
}

/**
 * The voice state after a TTS model's voices arrive (legacy buildTtsDraft). `current` holds the
 * page's ttsVoiceId, ttsLanguage and selectedLanguage. Returns null when the model has no voice.
 */
export function buildTtsDraft(modelId, voices, options = {}, current = {}) {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const voiceDetails = voices.reduce((acc, v) => { if (v && v.id) acc[v.id] = v; return acc; }, {});
  const valid = Object.values(voiceDetails);
  if (!valid.length) return null;

  const all = new Set();
  valid.forEach((v) => splitVoiceLanguages(v).forEach((l) => all.add(l)));
  const languageOptions = Array.from(all).map((l) => ({ value: l, label: l }));
  const exists = (l) => l && languageOptions.some((o) => o.value === l);
  const preferredVoiceId = options.preferredVoiceId || current.ttsVoiceId;
  const preferredVoiceLanguage = splitVoiceLanguages(voiceDetails[preferredVoiceId])[0] || '';
  const candidates = [options.preferredLanguage, preferredVoiceLanguage, current.ttsLanguage, current.selectedLanguage, languageOptions[0]?.value];
  const preferredVoiceHasNoLanguage = Boolean(voiceDetails[preferredVoiceId] && splitVoiceLanguages(voiceDetails[preferredVoiceId]).length === 0);
  let language = options.preferredLanguage === '' && preferredVoiceHasNoLanguage ? '' : candidates.find(exists) || '';
  let filtered = voicesForLanguage(voiceDetails, language);
  if (!filtered.length) {
    const fallback = valid.find((v) => splitVoiceLanguages(v).length > 0);
    if (fallback) {
      language = splitVoiceLanguages(fallback)[0];
      filtered = voicesForLanguage(voiceDetails, language);
    } else filtered = valid;
  }
  if (!filtered.length) return null;
  const preferred = filtered.find((v) => v.id === preferredVoiceId);
  const voice = preferred || (options.autoSelectVoice ? filtered[0] : null);
  return {
    modelId,
    language,
    voiceId: voice?.id || preferredVoiceId || '',
    voiceDetails,
    languageOptions,
    voiceOptions: voiceOptionsOf(filtered),
  };
}

/** Plugin params: an object, a JSON string of one, or nothing (then the fallback). */
export function normalizeFunctionParams(params, fallback = {}) {
  if (params === null || params === undefined || params === '') return { ...fallback };
  if (typeof params === 'string') {
    try {
      const parsed = JSON.parse(params);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { ...fallback };
    } catch (e) { return { ...fallback }; }
  }
  if (typeof params === 'object' && !Array.isArray(params)) return { ...params };
  return { ...fallback };
}

export function parsePluginFields(fields) {
  if (Array.isArray(fields)) return fields;
  if (typeof fields !== 'string' || !fields.trim()) return [];
  try { const p = JSON.parse(fields); return Array.isArray(p) ? p : []; } catch (e) { return []; }
}

/** The plugin catalogue with each plugin's field list and default params. */
export function pluginCatalog(items) {
  return (items || []).map((item) => {
    const fieldsMeta = parsePluginFields(item.fields);
    const params = fieldsMeta.reduce((acc, f) => { if (f?.key) acc[f.key] = f.default; return acc; }, {});
    return { ...item, fieldsMeta, params };
  });
}

/** The agent's saved plugin mappings, named and filled from the catalogue when it is known. */
export function buildCurrentFunctions(mappings, catalog) {
  if (!Array.isArray(mappings)) throw new TypeError('Invalid agent function mappings');
  return mappings.map((m) => {
    const pluginId = m.pluginId || m.id;
    const meta = catalog ? catalog.find((x) => x.id === pluginId) : null;
    return {
      id: pluginId,
      name: meta?.name || m.name || pluginId,
      params: normalizeFunctionParams(m.paramInfo ?? m.params, meta?.params || {}),
      fieldsMeta: meta?.fieldsMeta || [],
    };
  }).filter((x) => x.id);
}

export function enrichFunctions(current, catalog) {
  return current.map((item) => {
    const meta = catalog.find((c) => c.id === item.id);
    if (!meta) return { ...item, params: normalizeFunctionParams(item.params), fieldsMeta: item.fieldsMeta || [] };
    return { ...item, name: meta.name || item.name || item.id, params: normalizeFunctionParams(item.params, meta.params), fieldsMeta: meta.fieldsMeta || [] };
  });
}

/** The device-to-device call plugin only shows when the address book feature is on. */
export function visiblePlugins(list, addressBook) {
  return addressBook ? list : list.filter((x) => x.providerCode !== 'call_device');
}

/** Provider shown beside a model: the LLM type, or the suffix of a built-in id (ASR_FunASR: FunASR). */
export function providerOf(type, item, llmTypes) {
  if (!item) return '';
  if (type === 'LLM') return (llmTypes && llmTypes[item.value]) || '';
  if (['Intent', 'Memory', 'VAD'].includes(type)) return '';
  const prefix = `${type}_`;
  const value = String(item.value || '');
  if (!value.startsWith(prefix)) return '';
  const p = value.slice(prefix.length);
  return p && p !== item.label ? p : '';
}

/**
 * Function calling needs an openai or ollama LLM. Returns the intent options with `isHidden` set
 * and the intent id to keep (moved to the first visible option when function calling is hidden).
 */
export function intentVisibility(intentOptions, llmType, intentModelId) {
  if (!intentOptions || !llmType) return { options: intentOptions, intentModelId };
  const supports = llmType === 'openai' || llmType === 'ollama';
  const options = intentOptions.map((o) => ({ ...o, isHidden: o.value === FUNCTION_CALL_INTENT ? !supports : false }));
  let next = intentModelId;
  if (intentModelId === FUNCTION_CALL_INTENT && !supports) {
    const first = options.find((o) => !o.isHidden);
    next = first ? first.value : NO_INTENT;
  }
  return { options, intentModelId: next };
}

/** What changing the memory model does to chat history and the summary (legacy handleModelChange). */
export function applyMemoryChange(form, value, tempSummary) {
  const next = { chatHistoryConf: value === NO_MEMORY ? 0 : 2, summaryMemory: form.summaryMemory, tempSummary };
  if (value === NO_MEMORY || value === REPORT_ONLY_MEMORY) {
    next.tempSummary = form.summaryMemory;
    next.summaryMemory = '';
  } else if (tempSummary !== '' && form.summaryMemory === '') {
    next.summaryMemory = tempSummary;
    next.tempSummary = '';
  }
  return next;
}

/** Whether a voice can be played: clones always, others with a sample URL or a known demo file. */
export function hasAudioPreview(item) {
  if (!item) return false;
  const isClone = Boolean(item.isClone);
  const hasUrl = !!((item.voice_demo || item.voiceDemo)?.trim()) || Boolean(item.ttsVoice || (item.value && !String(item.value).startsWith('TTS_')));
  return isClone || hasUrl;
}

/** The sample URL of a standard (not cloned) voice, or '' when it has none. */
export function voiceAudioUrl(detail, voiceId) {
  if (!detail) return '';
  let url = detail.voiceDemo || detail.voice_demo || '';
  if (!url) {
    for (const key of Object.keys(detail)) {
      const v = detail[key];
      if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://') || v.endsWith('.mp3') || v.endsWith('.wav') || v.endsWith('.ogg'))) { url = v; break; }
    }
  }
  if (!url) {
    const k = detail.ttsVoice || detail.value || voiceId;
    if (k && !String(k).startsWith('TTS_')) url = `/voice-demos/${k}.mp3`;
  }
  if (url && !/^https?:\/\//.test(url) && !url.startsWith('/')) url = `/${url}`;
  return url;
}

export function isSameStringList(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

/** The first letter or digit of a plugin name. */
export function initialOf(name) {
  const m = String(name || '').match(/[\p{L}\p{N}]/u);
  return m ? m[0] : String(name || '').charAt(0);
}

/** What the page compares to know whether something is unsaved. */
export function configSignature(s) {
  return JSON.stringify({
    form: s.form,
    language: s.selectedLanguage,
    functions: (s.currentFunctions || []).map((f) => ({ id: f.id, params: f.params })),
    contextProviders: s.currentContextProviders,
    tags: (s.dynamicTags || []).map((t) => t.tagName),
    replacementWords: s.checkedReplacementWordIds,
  });
}

/** The body of PUT /agent/{id}, exactly as the legacy page sent it. */
export function buildSaveData(s) {
  const f = s.form;
  const data = {
    agentCode: f.agentCode,
    agentName: f.agentName,
    asrModelId: f.model.asrModelId,
    vadModelId: f.model.vadModelId,
    llmModelId: f.model.llmModelId,
    slmModelId: f.model.slmModelId,
    vllmModelId: f.model.vllmModelId,
    ttsModelId: f.model.ttsModelId,
    chatHistoryConf: f.chatHistoryConf,
    memModelId: f.model.memModelId,
    intentModelId: f.model.intentModelId,
    systemPrompt: f.systemPrompt,
    summaryMemory: f.summaryMemory,
    langCode: f.langCode,
    language: f.language,
    sort: f.sort,
    functions: (s.currentFunctions || []).map((x) => ({ pluginId: x.id, paramInfo: normalizeFunctionParams(x.params) })),
    contextProviders: s.currentContextProviders,
    correctWordFileIds: s.checkedReplacementWordIds,
  };
  const tagNames = (s.dynamicTags || []).map((t) => t.tagName);
  if (!isSameStringList(tagNames, s.originalTagNames || [])) data.tagNames = tagNames;
  if (s.ttsLanguageTouched) data.ttsLanguage = s.selectedLanguage;
  if (s.ttsVoiceTouched && f.ttsVoiceId !== null && f.ttsVoiceId !== undefined) data.ttsVoiceId = f.ttsVoiceId;
  if (f.ttsVolume !== null && f.ttsVolume !== undefined) data.ttsVolume = f.ttsVolume;
  if (f.ttsRate !== null && f.ttsRate !== undefined) data.ttsRate = f.ttsRate;
  if (f.ttsPitch !== null && f.ttsPitch !== undefined) data.ttsPitch = f.ttsPitch;
  return data;
}

/** Context providers from the editor rows: blank URLs dropped, header keys trimmed. */
export function providersFromRows(rows) {
  return rows.filter((p) => p.url.trim() !== '').map((p) => {
    const headers = {};
    p.headers.forEach((h) => { if (h.key.trim()) headers[h.key.trim()] = h.value; });
    return { url: p.url.trim(), headers };
  });
}

export function rowsFromProviders(providers) {
  const rows = (providers || []).map((p) => ({
    url: p.url || '',
    headers: Object.entries(p.headers || {}).map(([key, value]) => ({ key, value })),
  }));
  if (!rows.length) rows.push({ url: '', headers: [{ key: '', value: '' }] });
  return rows;
}

/** A signed slider value: +12, 0, -30. */
export function signed(n) {
  const v = Number(n) || 0;
  return v > 0 ? `+${v}` : String(v);
}
