// Pure rules of the model and provider forms, ported from the legacy AddModelDialog,
// ModelEditDialog, ProviderManagement and ProviderDialog. No Vue, no API: tested on their own.

// The order follows a conversation: hear, think, see, speak, then supporting services.
export const MODEL_TYPES = [
  { key: 'asr', code: 'ASR' },
  { key: 'llm', code: 'LLM' },
  { key: 'vllm', code: 'VLLM' },
  { key: 'tts', code: 'TTS' },
  { key: 'intent', code: 'Intent' },
  { key: 'memory', code: 'Memory' },
  { key: 'vad', code: 'VAD' },
  { key: 'rag', code: 'RAG' },
];

// Provider categories (the provider API uses the upper-case codes, Plugin included).
export const PROVIDER_TYPES = ['ASR', 'TTS', 'LLM', 'VLLM', 'Intent', 'Memory', 'VAD', 'Plugin', 'RAG'];

// Field types a provider can declare, in the order the legacy editor offered them.
export const FIELD_TYPES = ['string', 'number', 'boolean', 'dict', 'array'];

export const SENSITIVE_KEYS = [
  'api_key', 'personal_access_token', 'access_token', 'token', 'secret', 'access_key_secret', 'secret_key',
];

// TTS providers whose voices carry a reference recording and its text instead of a demo link.
export const REFERENCE_VOICE_PROVIDERS = ['fishspeech', 'gpt_sovits_v2', 'gpt_sovits_v3'];

// Model forms: a key is a secret only when it is exactly one of the known names.
export function isSensitiveField(key) {
  return typeof key === 'string' && SENSITIVE_KEYS.includes(key.toLowerCase());
}

// Provider lists: any key containing a secret name is flagged.
export function looksSensitive(key) {
  if (typeof key !== 'string') return false;
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

const SECRET_NAMES = {
  api_key: 'API Key',
  personal_access_token: 'Personal Access Token',
  access_token: 'Access Token',
  token: 'Token',
  secret: 'Secret',
  access_key_secret: 'Access Key Secret',
  secret_key: 'Secret Key',
};

export function sensitiveName(key) {
  const k = String(key || '').toLowerCase();
  for (const [name, label] of Object.entries(SECRET_NAMES)) if (k.includes(name)) return label;
  return 'Sensitive Information';
}

// The placeholder value the server accepts in place of a secret it keeps (legacy contract).
export function secretPlaceholder(key) {
  return `Your ${sensitiveName(key)}`;
}

// A provider's `fields` (a JSON string from the API) as form fields.
export function parseFields(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export function formFields(raw) {
  return parseFields(raw).map((f) => ({
    label: f.label,
    prop: f.key,
    type: f.type === 'dict' ? 'json-textarea' : f.type === 'password' ? 'password' : 'text',
    placeholder: f.key,
  }));
}

export function providerOptions(list) {
  return (list || []).map((p) => ({ label: p.name, value: String(p.providerCode), fields: formFields(p.fields) }));
}

// Model ID: optional; when given, letters, digits, _ and - only, no spaces, not letters alone.
export function validModelId(id) {
  if (!id || typeof id !== 'string') return false;
  const t = id.trim();
  if (t === '') return false;
  if (/^[a-zA-Z]+$/.test(t)) return false;
  if (/\s/.test(t)) return false;
  return /^[a-zA-Z0-9_-]+$/.test(t);
}

// A dictionary field's text: the object it holds, or why it is not one.
export function parseDict(value) {
  try {
    const parsed = JSON.parse(value);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return { value: parsed };
    return { error: 'notObject' };
  } catch (e) {
    return { error: 'syntax' };
  }
}

// Add form: dictionary fields must parse into objects before submit (or stay empty / already
// objects). Returns the new configJson, or { error, field } and nothing is sent.
export function parseDictFields(fields, configJson) {
  const out = { ...configJson };
  for (const f of fields) {
    if (f.type !== 'json-textarea') continue;
    const raw = out[f.prop];
    if (!raw || typeof raw === 'object') continue;
    const r = parseDict(raw);
    if (r.error) return { error: r.error, field: f.prop };
    out[f.prop] = r.value;
  }
  return { configJson: out };
}

export function emptyAddForm() {
  return {
    id: '', modelName: '', modelCode: '', supplier: '', sort: 1, docLink: '', remark: '',
    isEnabled: true, isDefault: true, configJson: {},
  };
}

export function addPayload(form, configJson) {
  return {
    id: form.id || '',
    modelName: form.modelName || '',
    modelCode: form.modelCode || '',
    supplier: form.supplier,
    sort: form.sort || 1,
    docLink: form.docLink || '',
    remark: form.remark || '',
    isEnabled: form.isEnabled ? 1 : 0,
    isDefault: form.isDefault ? 1 : 0,
    provideCode: form.supplier,
    configJson: { ...configJson, type: form.supplier },
  };
}

export function formatJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return '';
  }
}

// Edit form: a stored model laid onto its provider's fields. Dictionaries saved as JSON strings
// open as objects; other values become strings. Returns { configJson, fieldJsonMap }.
export function openModelConfig(model, fields) {
  const configJson = { ...(model.configJson || {}) };
  const fieldJsonMap = {};
  for (const f of fields) {
    if (!Object.prototype.hasOwnProperty.call(configJson, f.prop)) {
      configJson[f.prop] = '';
    } else if (f.type === 'json-textarea') {
      let v = configJson[f.prop];
      if (typeof v === 'string') {
        try {
          const parsed = JSON.parse(v);
          if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) v = parsed;
        } catch (e) {
          // keep the stored text visible; saving reports it
        }
      }
      fieldJsonMap[f.prop] = formatJson(v);
      configJson[f.prop] = typeof v === 'object' && v !== null ? v : {};
    } else if (typeof configJson[f.prop] !== 'string') {
      configJson[f.prop] = String(configJson[f.prop]);
    }
  }
  return { configJson, fieldJsonMap };
}

// Duplicate: a copy's name and code carry the suffix; stored secrets become placeholders.
export function duplicateOf(model, source, suffix) {
  const copy = { ...model, configJson: { ...(model.configJson || {}) } };
  copy.modelName = `${source.modelName}${suffix}`;
  copy.modelCode = `${source.modelCode}${suffix}`;
  for (const k of Object.keys(copy.configJson)) {
    if (isSensitiveField(k) && copy.configJson[k]) copy.configJson[k] = secretPlaceholder(k);
  }
  return copy;
}

// Provider editor: a field row is complete when it has a key, a label and a type.
export function incompleteField(fields) {
  return (fields || []).some((f) => !f.key || !f.label || !f.type);
}

// What is stored for a provider's fields: the row's own data, without the editor's flags.
export function cleanFields(fields) {
  return (fields || []).map(({ selected, editing, ...rest }) => { void selected; void editing; return rest; });
}

export function providerProblem(form) {
  if (!form.modelType) return 'category';
  if (!String(form.providerCode || '').trim()) return 'code';
  if (!String(form.name || '').trim()) return 'name';
  return '';
}

export function isAudioUrl(url) {
  return Boolean(url) && /\.(mp3|ogg|wav)$/i.test(String(url));
}
