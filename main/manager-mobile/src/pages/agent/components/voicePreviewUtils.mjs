/** @param {Record<string, any>} voice */
export function hasVoicePreview(voice) {
  return Boolean(voice?.isClone || voice?.voiceDemo || voice?.voice_demo)
}

export function createVoicePreviewRequestGate() {
  let sequence = 0

  return {
    begin() {
      sequence += 1
      return sequence
    },
    invalidate() {
      sequence += 1
    },
    isCurrent(requestId) {
      return requestId === sequence
    },
  }
}

/**
 * @param {{ id: string, isClone?: boolean, voiceDemo?: string | null, voice_demo?: string | null, ttsVoice?: string | null }} voice
 * @param {(cloneId: string) => Promise<string>} getCloneAudioId
 * @param {string} baseUrl
 */
export async function resolveVoicePreviewUrl(voice, getCloneAudioId, baseUrl) {
  if (!voice?.isClone) {
    const rawDemo = voice?.voiceDemo || voice?.voice_demo
    if (typeof rawDemo === 'string' && rawDemo.trim()) {
      if (rawDemo.startsWith('http://') || rawDemo.startsWith('https://')) {
        return rawDemo
      }
      const cleanPath = rawDemo.replace(/^\/+/, '')
      if (cleanPath.startsWith('voice-demos/')) {
        return `/static/${cleanPath}`
      }
      let origin = ''
      try {
        if (baseUrl && (baseUrl.startsWith('http://') || baseUrl.startsWith('https://'))) {
          const u = new URL(baseUrl)
          origin = u.origin
        }
      }
      catch {
        origin = baseUrl
      }
      if (origin) {
        return `${origin}/${cleanPath}`
      }
      return `/${cleanPath}`
    }

    const voiceKey = voice?.ttsVoice || voice?.id
    if (voiceKey && typeof voiceKey === 'string' && !voiceKey.startsWith('TTS_')) {
      return `/static/voice-demos/${voiceKey}.mp3`
    }
    return ''
  }

  if (!voice.id) {
    return ''
  }

  const uuid = await getCloneAudioId(voice.id)
  if (!uuid) {
    return ''
  }

  const cleanBase = (baseUrl || '').replace(/\/+$/, '')
  return `${cleanBase}/voiceClone/play/${encodeURIComponent(uuid)}`
}
