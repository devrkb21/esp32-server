// Version history: turning two saved configurations into readable changes. Ported from the legacy
// AgentSnapshotDialog.vue, unchanged in behaviour. `createSnapshotText({ t, te, meta })` binds the
// translations and the name lookups (plugins, models, voices, replacement words) once.
import { normalizeSnapshotOrderedValue, redactSnapshotDisplayValue, SNAPSHOT_SECRET_REDACTED } from './snapshotDisplay.mjs';

const FALLBACK_PLUGIN_NAME_KEYS = {
  SYSTEM_PLUGIN_WEATHER: 'agentSnapshot.plugin.SYSTEM_PLUGIN_WEATHER',
  SYSTEM_PLUGIN_MUSIC: 'agentSnapshot.plugin.SYSTEM_PLUGIN_MUSIC',
  SYSTEM_PLUGIN_NEWS_CHINANEWS: 'agentSnapshot.plugin.SYSTEM_PLUGIN_NEWS_CHINANEWS',
  SYSTEM_PLUGIN_NEWS_NEWSNOW: 'agentSnapshot.plugin.SYSTEM_PLUGIN_NEWS_NEWSNOW',
  SYSTEM_PLUGIN_HA_STATE: 'agentSnapshot.plugin.SYSTEM_PLUGIN_HA_STATE',
  SYSTEM_PLUGIN_HA_PLAY_MUSIC: 'agentSnapshot.plugin.SYSTEM_PLUGIN_HA_PLAY_MUSIC',
  SYSTEM_PLUGIN_WEB_SEARCH: 'agentSnapshot.plugin.SYSTEM_PLUGIN_WEB_SEARCH',
  SYSTEM_PLUGIN_CALL_DEVICE: 'agentSnapshot.plugin.SYSTEM_PLUGIN_CALL_DEVICE',
};
const FIELD_LABEL_KEYS = [
  'url', 'news_sources', 'default_rss_url', 'society_rss_url', 'world_rss_url', 'finance_rss_url', 'api_key',
  'default_location', 'api_host', 'base_url', 'devices', 'provider', 'description', 'max_results',
];
export const MODEL_FIELD_TYPES = {
  asrModelId: 'ASR', vadModelId: 'VAD', llmModelId: 'LLM', slmModelId: 'SLM', vllmModelId: 'VLLM', ttsModelId: 'TTS', memModelId: 'Memory', intentModelId: 'Intent',
};
export const SNAPSHOT_MODEL_TYPES = ['ASR', 'VAD', 'LLM', 'SLM', 'VLLM', 'TTS', 'Memory', 'Intent'];
const FALLBACK_MODEL_IDS = ['Memory_nomem', 'Memory_mem_local_short', 'Memory_mem0ai', 'Memory_mem_report_only', 'Intent_nointent', 'Intent_intent_llm', 'Intent_function_call'];
const CHAT_HISTORY_KEYS = { 0: 'agentSnapshot.chatHistoryConf.none', 1: 'agentSnapshot.chatHistoryConf.text', 2: 'agentSnapshot.chatHistoryConf.textVoice' };

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function isEquivalentValue(left, right) {
  if (left === SNAPSHOT_SECRET_REDACTED || right === SNAPSHOT_SECRET_REDACTED) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, i) => isEquivalentValue(item, right[i]));
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) return false;
    const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)]));
    return keys.every((k) => isEquivalentValue(left[k], right[k]));
  }
  return left === right;
}

function parseJson(value, want) {
  try { const p = JSON.parse(value); return want(p) ? p : null; } catch (e) { return null; }
}

export function normalizeFunctionList(value) {
  if (!value) return [];
  if (typeof value === 'string') return parseJson(value, Array.isArray) || [];
  return Array.isArray(value) ? value : [];
}

export function normalizeParams(value) {
  if (!value) return {};
  if (typeof value === 'string') return parseJson(value, isPlainObject) || {};
  return isPlainObject(value) ? value : {};
}

/** { pluginId: { pluginId, params } } from any shape the API returns. */
export function normalizeFunctionMap(value) {
  return normalizeFunctionList(value).reduce((acc, item) => {
    const pluginId = item.pluginId || item.id || item.providerCode || item.name;
    if (!pluginId) return acc;
    acc[pluginId] = { pluginId, params: normalizeParams(item.paramInfo ?? item.params) };
    return acc;
  }, {});
}

export function canonicalField(field) {
  return field === 'tags' || field === 'tagIds' ? 'tagNames' : field;
}

export function getFieldValue(data, field) {
  if (!data) return null;
  if (field === 'tagNames') return data.tagNames || (data.tags || []).map((tag) => tag.tagName);
  if (field === 'tagIds') return (data.tags || []).map((tag) => tag.id).filter(Boolean);
  return data[field];
}

function normalizeTtsNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (typeof value === 'number') return Math.trunc(value);
  const text = String(value).trim();
  return /^[+-]?\d+$/.test(text) ? Number.parseInt(text, 10) : text;
}

export function normalizeValueForField(field, value) {
  if (field === 'functions') return normalizeFunctionMap(value);
  if (field === 'contextProviders') return normalizeSnapshotOrderedValue(Array.isArray(value) ? value : []);
  if (['ttsVolume', 'ttsRate', 'ttsPitch'].includes(field)) return normalizeTtsNumber(value);
  if (field === 'summaryMemory') return value === null || value === undefined || String(value).trim() === '' ? '' : String(value);
  if (field === 'correctWordFileIds' || field === 'tagNames') {
    return Array.isArray(value)
      ? value.filter((x) => x !== null && x !== undefined && String(x).trim() !== '').map(String).sort()
      : [];
  }
  return normalizeSnapshotOrderedValue(value);
}

export function isSameFieldValue(field, left, right) {
  return isEquivalentValue(normalizeValueForField(field, left), normalizeValueForField(field, right));
}

export function snapshotFieldOrder(fieldOrder = [], before = {}, after = {}) {
  const backend = Array.isArray(fieldOrder) ? fieldOrder : [];
  if (backend.length) return backend.map(canonicalField);
  const fields = [...Object.keys(before || {}), ...Object.keys(after || {})].map(canonicalField);
  return Array.from(new Set(fields)).filter((f) => f !== 'tags');
}

/** The fields to show: the backend's list for adjacent versions, else every field that differs. */
export function resolveDiffFields(before, after, changedFields = null, fieldOrder = [], forceCompare = false) {
  const hasBackend = Array.isArray(changedFields);
  const direct = (hasBackend ? changedFields : []).filter((f) => f && f !== 'restore').map(canonicalField);
  if (!forceCompare && hasBackend) return Array.from(new Set(direct));
  return Array.from(new Set(snapshotFieldOrder(fieldOrder, before, after)))
    .filter((f) => !isSameFieldValue(f, getFieldValue(before, f), getFieldValue(after, f)));
}

export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/** A small, escaped Markdown renderer for prompts: headings, lists, paragraphs, inline marks. */
export function renderMarkdown(text, emptyText) {
  if (text === null || text === undefined || String(text).trim() === '') return `<span class="ch-md-empty">${escapeHtml(emptyText)}</span>`;
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  const stack = [];
  const closeParagraph = () => { if (paragraph.length) { html.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = []; } };
  const closeOne = () => { const l = stack.pop(); if (!l) return; if (l.liOpen) html.push('</li>'); html.push(`</${l.type}>`); };
  const closeLists = () => { while (stack.length) closeOne(); };
  const align = (type, indent) => {
    while (stack.length && indent < stack[stack.length - 1].indent) closeOne();
    let cur = stack[stack.length - 1];
    if (cur && indent === cur.indent && type !== cur.type) closeOne();
    cur = stack[stack.length - 1];
    if (!cur || indent !== cur.indent) { html.push(`<${type}>`); stack.push({ type, indent, liOpen: false }); }
  };
  const item = (type, indent, t) => {
    closeParagraph(); align(type, indent);
    const cur = stack[stack.length - 1];
    if (cur.liOpen) html.push('</li>');
    html.push(`<li>${inline(t)}`); cur.liOpen = true;
  };
  lines.forEach((raw) => {
    const norm = raw.replace(/\t/g, '  ');
    const line = norm.trim();
    if (!line) { closeParagraph(); closeLists(); return; }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) { closeParagraph(); closeLists(); const lv = Math.min(h[1].length, 4); html.push(`<h${lv}>${inline(h[2])}</h${lv}>`); return; }
    const indent = norm.match(/^ */)[0].length;
    const rest = norm.slice(indent);
    const ul = rest.match(/^[-*+]\s+(.+)$/);
    if (ul) { item('ul', indent, ul[1]); return; }
    const ol = rest.match(/^\d+\.\s+(.+)$/);
    if (ol) { item('ol', indent, ol[1]); return; }
    closeLists(); paragraph.push(line);
  });
  closeParagraph(); closeLists();
  return html.join('');
}

export function createSnapshotText({ t, te, meta }) {
  const tr = (key, fallback = '') => (key && te(key) ? t(key) : fallback);
  const empty = () => t('agentSnapshot.emptyValue');
  const display = (value, parentKey = '') => redactSnapshotDisplayValue(value, t('agentSnapshot.secretRedacted'), parentKey);
  const isPrimitive = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
  const isComplex = (v) => v !== null && typeof v === 'object';

  function resolveFunctionMeta(pluginId) {
    if (!pluginId) return null;
    const plugins = meta.plugins || {};
    if (plugins[pluginId]) return plugins[pluginId];
    return Object.values(plugins).find((x) => x.id === pluginId || x.providerCode === pluginId || x.name === pluginId) || null;
  }
  const functionFields = (id) => { const m = resolveFunctionMeta(id); return Array.isArray(m?.fieldsMeta) ? m.fieldsMeta : []; };
  const functionName = (id) => resolveFunctionMeta(id)?.name || tr(FALLBACK_PLUGIN_NAME_KEYS[id], id) || id || empty();
  const paramLabel = (id, key) => functionFields(id).find((f) => f.key === key)?.label
    || tr(FIELD_LABEL_KEYS.includes(key) ? `agentSnapshot.pluginField.${key}` : '', key) || key;
  function paramValue(value, key = '') {
    if (value === null || value === undefined || value === '') return empty();
    const d = display(value, key);
    return typeof d === 'object' ? JSON.stringify(d) : String(d);
  }
  function paramRows(id, params, changed = []) {
    const p = params || {};
    const keys = Array.from(new Set([...functionFields(id).map((f) => f.key), ...Object.keys(p)])).filter(Boolean);
    return keys.map((key) => ({ key, label: paramLabel(id, key), value: paramValue(p[key], key), changed: changed.includes(key) }));
  }
  function functionState(id, func, changed = []) {
    if (!func) return { active: false, status: t('agentSnapshot.function.disabled'), params: [], note: t('agentSnapshot.function.disabledNote') };
    const params = paramRows(id, func.params, changed);
    return { active: true, status: t('agentSnapshot.function.enabled'), params, note: params.length ? '' : t('agentSnapshot.function.noParams') };
  }
  function functionChanges(before, after) {
    const b = normalizeFunctionMap(before);
    const a = normalizeFunctionMap(after);
    return Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).reduce((out, id) => {
      const make = (type, bf, af, changed = []) => ({
        type, pluginId: id, name: functionName(id), badge: t(`agentSnapshot.function.${type}`),
        before: functionState(id, bf, changed), after: functionState(id, af, changed),
      });
      if (!b[id] && a[id]) out.push(make('added', null, a[id]));
      else if (b[id] && !a[id]) out.push(make('removed', b[id], null));
      else {
        const bp = b[id].params || {};
        const ap = a[id].params || {};
        const changed = Array.from(new Set([...Object.keys(bp), ...Object.keys(ap)]))
          .filter((k) => !isEquivalentValue(normalizeSnapshotOrderedValue(bp[k]), normalizeSnapshotOrderedValue(ap[k])));
        if (changed.length) out.push(make('updated', b[id], a[id], changed));
      }
      return out;
    }, []);
  }
  function singleFunctionStates(value) {
    return Object.values(normalizeFunctionMap(value)).map((f) => {
      const params = paramRows(f.pluginId, f.params);
      return { pluginId: f.pluginId, name: functionName(f.pluginId), status: t('agentSnapshot.function.enabled'), params, note: params.length ? '' : t('agentSnapshot.function.noParams') };
    });
  }
  function formatValue(value, parentKey = '') {
    if (value === null || value === undefined || value === '') return empty();
    if (Array.isArray(value) && value.length === 0) return empty();
    const d = display(value, parentKey);
    if (Array.isArray(d) && d.every(isPrimitive)) return d.join(', ');
    if (isComplex(d)) return JSON.stringify(d, null, 2);
    return String(d);
  }
  function modelName(value) {
    if (value === null || value === undefined || value === '') return empty();
    return (meta.models || {})[value] || tr(FALLBACK_MODEL_IDS.includes(value) ? `agentSnapshot.model.${value}` : '', String(value)) || String(value);
  }
  function voiceName(modelId, value) {
    if (value === null || value === undefined || value === '') return empty();
    const voices = meta.voices || {};
    return voices[`${modelId}:${value}`] || voices[value] || tr(/^TTS_EdgeTTS000[1-6]$/.test(value) ? `agentSnapshot.voice.${value}` : '', String(value)) || String(value);
  }
  function formatDisplayValue(field, value, data = {}) {
    if (MODEL_FIELD_TYPES[field]) return modelName(value);
    if (field === 'ttsVoiceId') return voiceName(data.ttsModelId, value);
    if (field === 'chatHistoryConf') return tr(CHAT_HISTORY_KEYS[value] || CHAT_HISTORY_KEYS[Number(value)]) || formatValue(value);
    if (field === 'correctWordFileIds') {
      if (!Array.isArray(value) || !value.length) return empty();
      return value.map((id) => (meta.words || {})[id] || id).join(', ');
    }
    return formatValue(value, field);
  }
  const fieldLabel = (field) => tr(`agentSnapshot.field.${field}`, field);
  const sourceLabel = (source) => tr(`agentSnapshot.source.${source || 'config'}`, source);
  const displayType = (field) => (field === 'functions' ? 'functions' : field === 'systemPrompt' ? 'markdown' : 'text');

  function singleItems(data = {}, fieldOrder = []) {
    return Array.from(new Set(snapshotFieldOrder(fieldOrder, {}, data))).map((field) => {
      const value = getFieldValue(data, field);
      const type = displayType(field);
      return {
        field, label: fieldLabel(field), single: true, displayType: type, afterValue: value,
        afterText: formatDisplayValue(field, value, data), valueTitle: t('agentSnapshot.configValue'),
        functionStates: type === 'functions' ? singleFunctionStates(value) : [], complex: isComplex(value),
      };
    });
  }
  function diffItems(before, after, changedFields, opts = {}) {
    const pane = (label, n) => (n ? `${label} #${n}` : label);
    return resolveDiffFields(before, after, changedFields, opts.fieldOrder, opts.forceCompare).map((field) => {
      const bv = getFieldValue(before, field);
      const av = getFieldValue(after, field);
      const type = displayType(field);
      return {
        field, label: fieldLabel(field), single: false, displayType: type, beforeValue: bv, afterValue: av,
        beforeText: formatDisplayValue(field, bv, before), afterText: formatDisplayValue(field, av, after),
        beforeTitle: pane(opts.beforeLabel || t('agentSnapshot.before'), opts.beforeVersionNo),
        afterTitle: pane(opts.afterLabel || t('agentSnapshot.after'), opts.afterVersionNo),
        functionChanges: type === 'functions' ? functionChanges(bv, av) : [],
        complex: isComplex(bv) || isComplex(av),
      };
    });
  }
  const markdown = (value) => renderMarkdown(display(value), empty());
  return { singleItems, diffItems, fieldLabel, sourceLabel, markdown, formatValue };
}

/** A side-by-side code diff suits prompts, memory and structured values. */
export function useCodeDiff(item) {
  return Boolean(item && !item.single && (item.displayType === 'markdown' || item.complex || item.field === 'summaryMemory'));
}

export function codeDiffLanguage(item) {
  return item?.displayType === 'markdown' || item?.field === 'summaryMemory' ? 'markdown' : 'json';
}

/** Restoring a version without memory, over one with memory, deletes the chat history. */
export function restoreClearsHistory(preview) {
  const before = preview?.beforeSnapshotData?.memModelId;
  const after = preview?.afterSnapshotData?.memModelId;
  return before !== 'Memory_nomem' && after === 'Memory_nomem';
}

export function versionRangeTitle(label, before, after) {
  if (before && after) return `${label} #${before} → #${after}`;
  if (before) return `${label} #${before}`;
  if (after) return `${label} #${after}`;
  return label;
}
