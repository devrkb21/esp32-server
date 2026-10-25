import { onBeforeUnmount, ref } from 'vue'
import { getAudioDownloadId } from '@/api/voiceprint'
import { getEnvBaseUrl } from '@/utils'

/**
 * One recording plays at a time across the screen and its sheet. The audio is fetched the way the
 * legacy screen did: POST /agent/audio/{audioId} gives a one-time id, /agent/play/{id} streams it.
 */
export function useVoicePlayer(onError?: (kind: 'fetch' | 'play') => void) {
  const playingId = ref('') // the recording that is sounding now
  const loadingId = ref('') // the recording whose audio is on its way
  let audio: UniApp.InnerAudioContext | null = null
  let ticket = 0

  function release() {
    if (!audio)
      return
    try {
      audio.stop()
      audio.destroy()
    }
    catch {
      // already gone
    }
    audio = null
  }

  function stop() {
    ticket += 1
    release()
    playingId.value = ''
    loadingId.value = ''
  }

  function fail(kind: 'fetch' | 'play') {
    stop()
    onError?.(kind)
  }

  async function play(audioId: string) {
    stop()
    if (!audioId)
      return
    const mine = ticket
    loadingId.value = audioId
    let key = ''
    try {
      key = (await getAudioDownloadId(audioId)) as unknown as string
    }
    catch {
      if (mine === ticket)
        fail('fetch')
      return
    }
    if (mine !== ticket)
      return // the owner pressed something else meanwhile
    if (!key || typeof key !== 'string') {
      fail('fetch')
      return
    }
    const ctx = uni.createInnerAudioContext()
    audio = ctx
    ctx.src = `${getEnvBaseUrl()}/agent/play/${key}`
    ctx.autoplay = true
    ctx.onEnded(() => {
      if (mine === ticket)
        stop()
    })
    ctx.onError(() => {
      if (mine === ticket)
        fail('play')
    })
    loadingId.value = ''
    playingId.value = audioId
  }

  /** Play this recording, or stop it when it is the one sounding (or loading). */
  function toggle(audioId: string) {
    if (playingId.value === audioId || loadingId.value === audioId)
      stop()
    else
      play(audioId)
  }

  onBeforeUnmount(stop)

  return { playingId, loadingId, toggle, stop }
}

export type VoicePlayer = ReturnType<typeof useVoicePlayer>
