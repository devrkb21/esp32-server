// Smart home screen and the robot-messages part of Messages (owner: HOME): pure helpers, tested
// with node:test in homeModel.test.mjs. Same rules as manager-web/src/views/home/homeModel.js:
// the integration view never carries a secret (only tokenSaved / passwordSaved), and a secret is
// sent only when the owner typed a new one.

export const DOMAINS = ['light', 'switch', 'fan', 'climate', 'cover']
export const MAX_ALIASES = 10
export const MAX_ALIAS = 40
export const MAX_NAME = 32
export const MAX_TEXT = 300
export const SECRET_MASK = '••••••'

const blank = v => v == null || String(v).trim() === ''

/** The form state from GET /home/integration (secrets always empty on the form). */
export function readIntegration(view) {
  const ha = (view && view.ha) || {}
  const mqtt = (view && view.mqtt) || {}
  return {
    form: {
      haBaseUrl: ha.baseUrl || '',
      haToken: '',
      mqttHost: mqtt.host || '',
      mqttPort: mqtt.port ? String(mqtt.port) : '1883',
      mqttUsername: mqtt.username || '',
      mqttPassword: '',
      mqttTls: !!mqtt.tls,
    },
    saved: { token: !!ha.tokenSaved, password: !!mqtt.passwordSaved },
  }
}

/** Problems (i18n keys) of one part of the form: 'ha' or 'mqtt'. */
export function integrationProblems(form, part, saved = {}) {
  const out = {}
  if (part === 'ha') {
    const url = String(form.haBaseUrl || '').trim()
    if (!url)
      out.haBaseUrl = 'mhome.err.urlRequired'
    else if (!/^https?:\/\/[^\s/?#]+/i.test(url))
      out.haBaseUrl = 'mhome.err.url'
    if (blank(form.haToken) && !saved.token)
      out.haToken = 'mhome.err.tokenRequired'
    else if (!blank(form.haToken) && /\s/.test(String(form.haToken).trim()))
      out.haToken = 'mhome.err.token'
  }
  else {
    const host = String(form.mqttHost || '').trim()
    if (!host)
      out.mqttHost = 'mhome.err.hostRequired'
    else if (!/^[\w.:[\]-]+$/.test(host))
      out.mqttHost = 'mhome.err.host'
    const port = Number(form.mqttPort)
    if (!/^\d+$/.test(String(form.mqttPort || '').trim()) || port < 1 || port > 65535)
      out.mqttPort = 'mhome.err.port'
  }
  return out
}

/** The body of PUT /home/integration for one part; a secret only when one was typed. */
export function integrationBody(form, part) {
  if (part === 'ha') {
    const body = { haBaseUrl: String(form.haBaseUrl || '').trim() }
    if (!blank(form.haToken))
      body.haToken = String(form.haToken).trim()
    return body
  }
  const body = {
    mqttHost: String(form.mqttHost || '').trim(),
    mqttPort: Number(form.mqttPort),
    mqttUsername: String(form.mqttUsername || '').trim(),
    mqttTls: !!form.mqttTls,
  }
  if (!blank(form.mqttPassword))
    body.mqttPassword = form.mqttPassword
  return body
}

/** The server's message of a failed request (alova keeps it as serverMsg). */
export function serverMsg(err) {
  return String((err && (err.serverMsg || (err.data && err.data.msg))) || '')
}

/** The server refuses to send a saved secret to a new address: which field must be typed again? */
export function needsSecretAgain(err) {
  const msg = serverMsg(err)
  if (msg.startsWith('token_required'))
    return 'haToken'
  if (msg.startsWith('password_required'))
    return 'mqttPassword'
  return ''
}

/** "বাতি, বসার ঘরের লাইট" -> ['বাতি', 'বসার ঘরের লাইট'] (unique, trimmed). */
export function aliasesFromText(text) {
  const seen = new Set()
  const out = []
  for (const part of String(text || '').split(/[,\n،;।]+/)) {
    const s = part.trim().replace(/\s+/g, ' ')
    if (!s)
      continue
    const k = s.toLowerCase()
    if (seen.has(k))
      continue
    seen.add(k)
    out.push(s)
  }
  return out
}

export function aliasesToText(list) {
  return (list || []).join(', ')
}

/** Problems of a device edit (i18n keys). `mqtt`: the MQTT fields are checked too. */
export function deviceProblems(d, mqtt) {
  const out = {}
  const name = String(d.name || '').trim()
  if (!name)
    out.name = 'mhome.err.nameRequired'
  else if (name.length > 100)
    out.name = 'mhome.err.nameLong'
  const aliases = aliasesFromText(d.aliasText)
  if (aliases.length > MAX_ALIASES)
    out.aliasText = 'mhome.err.aliasCount'
  else if (aliases.some(a => a.length > MAX_ALIAS))
    out.aliasText = 'mhome.err.aliasLong'
  if (mqtt) {
    const topic = String(d.topic || '').trim()
    if (!topic)
      out.topic = 'mhome.err.topicRequired'
    else if (/[#+]/.test(topic))
      out.topic = 'mhome.err.topicWildcard'
    if (!DOMAINS.includes(d.domain))
      out.domain = 'mhome.err.domain'
  }
  return out
}

/** The body of POST /home/devices or PUT /home/devices/{id}. */
export function deviceBody(d, mqtt) {
  const body = { name: String(d.name || '').trim(), aliases: aliasesFromText(d.aliasText), enabled: d.enabled !== false }
  if (mqtt) {
    body.domain = d.domain
    body.topic = String(d.topic || '').trim()
    body.payloadOn = String(d.payloadOn || '').trim() || 'ON'
    body.payloadOff = String(d.payloadOff || '').trim() || 'OFF'
  }
  return body
}

export function editState(device) {
  const d = device || {}
  return {
    id: d.id || null,
    source: d.source || 'mqtt',
    domain: d.domain || 'switch',
    name: d.name || '',
    aliasText: aliasesToText(d.aliases),
    enabled: d.enabled !== false,
    topic: d.topic || '',
    payloadOn: d.payloadOn || 'ON',
    payloadOff: d.payloadOff || 'OFF',
    entityId: d.entityId || '',
  }
}

/** The two test buttons of a device: covers open and close, everything else turns on and off. */
export function testActions(domain) {
  if (domain === 'cover')
    return [{ action: 'open', label: 'mhome.act.open' }, { action: 'close', label: 'mhome.act.close' }]
  return [{ action: 'on', label: 'mhome.act.on' }, { action: 'off', label: 'mhome.act.off' }]
}

export function resultKey(code) {
  const known = ['ok', 'not_configured', 'unreachable', 'unauthorized', 'bad_url', 'not_found', 'unsupported', 'bad_value', 'error']
  return `mhome.result.${known.includes(code) ? code : 'error'}`
}

/** Devices for the list: the ones TinyBot may switch first, then the ones off for voice. */
export function sortDevices(list) {
  const arr = Array.isArray(list) ? list.slice() : []
  return arr.filter(d => d.enabled !== false).concat(arr.filter(d => d.enabled === false))
}

// ------------------------------------------------------------------ robot-to-robot messages
export function groupContacts(list) {
  const out = { accepted: [], incoming: [], outgoing: [] }
  for (const c of Array.isArray(list) ? list : []) {
    if (c.status === 'accepted')
      out.accepted.push(c)
    else if (c.status === 'pending' && c.direction === 'in')
      out.incoming.push(c)
    else if (c.status === 'pending')
      out.outgoing.push(c)
  }
  return out
}

function nameProblem(name) {
  const s = String(name || '').trim()
  if (!s)
    return 'mrmsg.err.nameRequired'
  if (s.length > MAX_NAME)
    return 'mrmsg.err.nameLong'
  return ''
}

/** Ask / accept / rename problems. mode: ask | accept | rename */
export function contactProblems(f, mode) {
  const out = {}
  if (mode !== 'rename' && !f.deviceId)
    out.deviceId = 'mrmsg.err.robot'
  if (mode === 'ask' && !String(f.username || '').trim())
    out.username = 'mrmsg.err.username'
  const n = nameProblem(f.name)
  if (n)
    out.name = n
  const aliases = aliasesFromText(f.aliasText)
  if (aliases.length > 10)
    out.aliasText = 'mrmsg.err.aliasCount'
  else if (aliases.some(a => a.length > MAX_NAME))
    out.aliasText = 'mrmsg.err.aliasLong'
  return out
}

export function contactBody(f, mode) {
  const body = { name: String(f.name || '').trim(), aliases: aliasesFromText(f.aliasText) }
  if (mode !== 'rename')
    body.deviceId = f.deviceId
  if (mode === 'ask')
    body.username = String(f.username || '').trim()
  return body
}

export function sendProblems(f) {
  const out = {}
  if (!f.target)
    out.target = 'mrmsg.err.target'
  const t = String(f.text || '').trim()
  if (!t)
    out.text = 'mrmsg.err.text'
  else if (t.length > MAX_TEXT)
    out.text = 'mrmsg.err.textLong'
  return out
}

export function sendResultKey(r) {
  if (r && r.ok)
    return r.later ? 'mrmsg.send.later' : 'mrmsg.send.sent'
  const code = r && r.code
  const known = ['not_found', 'not_supported', 'too_long', 'empty', 'unreachable', 'not_registered']
  return `mrmsg.send.err.${known.includes(code) ? code : 'unreachable'}`
}

export function requestErrorKey(err) {
  const code = (serverMsg(err).match(/^([a-z_]+):/) || [])[1]
  if (['user_not_found', 'own_account', 'exists'].includes(code))
    return `mrmsg.err.${code}`
  return ''
}

/** Targets in pick order: own robots first, then contacts, by name. */
export function sortTargets(targets) {
  const list = Array.isArray(targets) ? targets.slice() : []
  list.sort((a, b) => (a.kind === b.kind ? String(a.name).localeCompare(String(b.name)) : a.kind === 'own' ? -1 : 1))
  return list
}
