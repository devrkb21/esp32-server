// Pure helpers of the character screens (edit, tools, provider, speedPitch). No uni, no i18n:
// the screens pass their own translator or digit formatter where text is involved.

export const PROMPT_MAX = 2000
export const PROMPT_NEAR = 1800
export const NO_MEMORY = 'Memory_nomem'
export const REPORT_ONLY_MEMORY = 'Memory_mem_report_only'
export const LOCAL_SHORT_MEMORY = 'Memory_mem_local_short'
export const TUNING_FIELDS = ['ttsVolume', 'ttsRate', 'ttsPitch']

/** A signed setting as people read it: +12, -5, 0. */
export function signed(value) {
  const n = Number(value) || 0
  return n > 0 ? `+${n}` : `${n}`
}

/** One line of a long text for a row preview. */
export function previewText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/** The first line of a template prompt, for the template list. */
export function firstLine(value, max = 90) {
  const line = String(value || '').split(/\n/).map(s => s.trim()).find(Boolean) || ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/** A voice's `languages` field, as the server writes it ("bn-BD、en-US", "a;b", "a, b"). */
export function splitLanguages(value) {
  if (typeof value !== 'string')
    return []
  return value.split(/[、；;,，]/).map(s => s.trim()).filter(Boolean)
}

/** Every language offered by a list of voices, in first-seen order. */
export function languagesOf(voices) {
  const seen = new Set()
  for (const v of voices || []) {
    for (const lang of splitLanguages(v?.languages))
      seen.add(lang)
  }
  return Array.from(seen)
}

/** Plugin parameters arrive as an object, a JSON string, or nothing. */
export function normalizeFunctionParams(paramInfo, fallback = {}) {
  if (!paramInfo)
    return { ...fallback }
  if (typeof paramInfo === 'string') {
    try {
      const parsed = JSON.parse(paramInfo)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { ...fallback }
    }
    catch {
      return { ...fallback }
    }
  }
  return typeof paramInfo === 'object' && !Array.isArray(paramInfo) ? { ...fallback, ...paramInfo } : { ...fallback }
}

export function normalizeAgentFunctions(functions = []) {
  return (functions || []).map(item => ({ ...item, paramInfo: normalizeFunctionParams(item.paramInfo) }))
}

export function sortObjectKeys(value) {
  if (Array.isArray(value))
    return value.map(sortObjectKeys)
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = sortObjectKeys(value[key])
      return result
    }, {})
  }
  return value
}

/** JSON with object keys in a fixed order, so two equal forms always compare equal. */
export function stableSerialize(value) {
  return JSON.stringify(sortObjectKeys(value))
}

/** The plugin catalogue as the server sends it: `fields` is a JSON list of field descriptions. */
export function pluginCatalog(list) {
  return (list || []).map((item) => {
    let meta = []
    try {
      meta = JSON.parse(item.fields || '[]')
    }
    catch {
      meta = []
    }
    if (!Array.isArray(meta))
      meta = []
    const params = meta.reduce((m, f) => {
      m[f.key] = f.default
      return m
    }, {})
    return { ...item, fieldsMeta: meta, params }
  })
}

export function isHomeAssistant(func) {
  if (!func)
    return false
  const code = String(func.providerCode || '').toLowerCase()
  const id = String(func.id || '').toUpperCase()
  const name = String(func.name || '').toLowerCase()
  return code === 'hass_state' || code === 'home_assistant'
    || id === 'SYSTEM_PLUGIN_HA_STATE'
    || name.includes('homeassistant') || name.includes('home assistant')
}

/** A list parameter is edited as one item per line. */
export function linesToList(text) {
  return String(text || '').split('\n').filter(Boolean)
}

export function listToLines(value) {
  return Array.isArray(value) ? value.join('\n') : (value || '')
}

/** Context sources: the store keeps `headers` as an object, the editor as rows. */
export function toEditableProviders(providers) {
  const rows = (providers || []).map((p) => {
    const headers = p?.headers || {}
    const list = Array.isArray(headers)
      ? headers.map(h => ({ key: h?.key || '', value: h?.value ?? '' }))
      : Object.entries(headers).map(([key, value]) => ({ key, value }))
    return { url: p?.url || '', headers: list }
  })
  return rows.length ? rows : [{ url: '', headers: [{ key: '', value: '' }] }]
}

/** Sources without an address are dropped; headers without a name too. */
export function fromEditableProviders(rows) {
  return (rows || [])
    .filter(p => String(p.url || '').trim() !== '')
    .map((p) => {
      const headers = {}
      for (const h of p.headers || []) {
        if (String(h.key || '').trim())
          headers[String(h.key).trim()] = h.value
      }
      return { url: String(p.url).trim(), headers }
    })
}

/** Speed, pitch and volume in one short line, or '' when all three are at 0. */
export function tuningSummary(values, fmt = s => s) {
  const list = TUNING_FIELDS.map(k => Number(values?.[k]) || 0)
  if (list.every(n => n === 0))
    return ''
  return list.map(n => fmt(signed(n))).join(' / ')
}

/** Memory model change: what happens to the chat history setting and the summary. */
export function applyMemoryChoice(form, value, stash) {
  const next = { ...form, memModelId: value, chatHistoryConf: value === NO_MEMORY ? 0 : 2 }
  let kept = stash
  if (value === NO_MEMORY || value === REPORT_ONLY_MEMORY) {
    kept = form.summaryMemory
    next.summaryMemory = ''
  }
  else if (stash !== '' && stash !== undefined && next.summaryMemory === '') {
    next.summaryMemory = stash
    kept = ''
  }
  return { form: next, stash: kept }
}
