// Voiceprints: pure helpers of the screen (no Vue, no uni), tested in voiceprintModel.test.mjs.
// Same rules as manager-web src/views/voiceprint/voiceprintModel.js, with the phone's legacy
// validation: a recording and a name are required, the description is optional.
import { digits } from '../../utils/calendar.mjs'

export const NAME_MAX = 32
export const INTRO_MAX = 100
/** The confidence slider of the security policy, in percent. */
export const CONFIDENCE = { min: 50, max: 95, step: 5, fallback: 70 }

/**
 * The words of a recording as the chat history keeps them. A user line may be plain text or,
 * when TinyBot already knew the speaker, JSON like {"speaker":"Ammu","content":"..."}.
 * Returns { text, speaker }; text is '' when nothing usable came back.
 */
export function transcriptOf(content) {
  if (content == null || typeof content !== 'string')
    return { text: '', speaker: '' }
  const raw = content.trim()
  if (raw.startsWith('{')) {
    try {
      const o = JSON.parse(raw)
      if (o && typeof o === 'object')
        return { text: typeof o.content === 'string' ? o.content.trim() : '', speaker: typeof o.speaker === 'string' ? o.speaker.trim() : '' }
    }
    catch {
      // plain text that starts with a brace
    }
  }
  return { text: raw, speaker: '' }
}

/**
 * The recent recordings the owner can pick from: one entry per audioId, in the API's order.
 * Lines without audio, and TinyBot's own lines when the reply carries a chatType, are dropped.
 */
export function recordingsFrom(list) {
  if (!Array.isArray(list))
    return []
  const seen = new Set()
  const out = []
  for (const it of list) {
    if (!it || !it.audioId || seen.has(it.audioId))
      continue
    if (it.chatType != null && Number(it.chatType) !== 1)
      continue
    seen.add(it.audioId)
    out.push({ audioId: it.audioId, ...transcriptOf(it.content) })
  }
  return out
}

/** Keep the recording in use on the list even when it is older than the recent ones. */
export function withCurrent(recordings, audioId) {
  const list = Array.isArray(recordings) ? recordings : []
  if (!audioId || list.some(r => r.audioId === audioId))
    return list
  return [{ audioId, text: '', speaker: '' }, ...list]
}

/** Recordings whose words or heard name contain the query (the picked one always stays). */
export function filterRecordings(recordings, query, pickedId) {
  const q = String(query || '').trim().toLowerCase()
  const list = Array.isArray(recordings) ? recordings : []
  if (!q)
    return list
  return list.filter(r => r.audioId === pickedId || `${r.text} ${r.speaker}`.toLowerCase().includes(q))
}

/**
 * The error key of each invalid field ({} when valid).
 * @returns {Record<string, string>}
 */
export function validate(form) {
  /** @type {Record<string, string>} */
  const errors = {}
  if (!form || !form.audioId)
    errors.audioId = 'mVp.err.audio'
  const name = String(form?.sourceName || '').trim()
  if (!name)
    errors.sourceName = 'mVp.err.name'
  else if (name.length > NAME_MAX)
    errors.sourceName = 'mVp.err.nameLong'
  if (String(form?.introduce || '').trim().length > INTRO_MAX)
    errors.introduce = 'mVp.err.introLong'
  return errors
}

/** The body the API takes: add sends the agent, update sends the saved row with the new values. */
export function payloadOf(form, agentId, original) {
  const values = {
    audioId: form.audioId,
    sourceName: String(form.sourceName || '').trim(),
    introduce: String(form.introduce || '').trim(),
  }
  if (form.id)
    return { id: form.id, createDate: (original && original.createDate) || form.createDate || '', ...values }
  return { agentId, ...values }
}

/** The security policy as the API returns it, with the legacy defaults filled in. */
export function securityOf(data) {
  const raw = data && typeof data === 'object' ? data : {}
  const threshold = Number(raw.confidenceThreshold)
  const ok = Number.isFinite(threshold) && threshold > 0
  return {
    percent: clampPercent(ok ? Math.round(threshold * 100) : CONFIDENCE.fallback),
    requireVoiceMatchSmartHome: !!raw.requireVoiceMatchSmartHome,
    adminSpeakerOnly: raw.adminSpeakerOnly == null ? true : !!raw.adminSpeakerOnly,
  }
}

/** The percent snapped to the slider's steps and range. */
export function clampPercent(p) {
  const n = Number(p)
  if (!Number.isFinite(n))
    return CONFIDENCE.fallback
  const snapped = Math.round(n / CONFIDENCE.step) * CONFIDENCE.step
  return Math.min(CONFIDENCE.max, Math.max(CONFIDENCE.min, snapped))
}

/** The body of updateVoiceprintSecurity. */
export function securityPayload(s) {
  return {
    confidenceThreshold: Number((clampPercent(s.percent) / 100).toFixed(2)),
    requireVoiceMatchSmartHome: !!s.requireVoiceMatchSmartHome,
    adminSpeakerOnly: !!s.adminSpeakerOnly,
  }
}

export function sameSecurity(a, b) {
  return !!a && !!b && clampPercent(a.percent) === clampPercent(b.percent)
    && !!a.requireVoiceMatchSmartHome === !!b.requireVoiceMatchSmartHome && !!a.adminSpeakerOnly === !!b.adminSpeakerOnly
}

/** The legacy check before adding: error 10054 means the voiceprint service is not configured. */
export function isNotConfigured(error) {
  return !!(error && typeof error.message === 'string' && error.message.includes('10054'))
}

const MONTHS = {
  bn: ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

/** "12 Oct 2026" / "১২ অক্টো ২০২৬" from the API's "2026-10-12 08:30:00" (or an ISO string). */
export function dateText(value, lang) {
  if (!value)
    return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!m)
    return digits(String(value), lang)
  const names = lang === 'bn' ? MONTHS.bn : MONTHS.en
  const month = names[Number(m[2]) - 1]
  if (!month)
    return digits(String(value).slice(0, 10), lang)
  return digits(`${Number(m[3])} ${month} ${m[1]}`, lang)
}
