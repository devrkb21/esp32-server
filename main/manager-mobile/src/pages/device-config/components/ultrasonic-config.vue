<script setup lang="ts">
// Sound setup: the Wi-Fi name and password become a short AFSK tone (1800 Hz = 1, 1500 Hz = 0,
// 100 bit/s, framed by 0x01 0x02 ... checksum 0x03 0x04) that TinyBot hears with its microphone.
// Nothing comes back from the robot, so the person says when it has joined (`done`).
import { computed, onBeforeUnmount, ref } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { toast } from '@/utils/toast'
import { ssidError, wifiPasswordError } from '../utils/hotspotClient'

interface WiFiNetwork {
  ssid: string
  rssi: number
  authmode: number
  channel: number
  hidden?: boolean
}

interface Props {
  selectedNetwork: WiFiNetwork | null
  password: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'done', result: { ssid: string, unconfirmed: boolean }): void
  (e: 'back'): void
}>()

const generating = ref(false)
const playing = ref(false)
const audioGenerated = ref(false)
const autoLoop = ref(true)
const audioFilePath = ref('')
const audioContext = ref<any>(null)
const lang = computed(() => getCurrentLanguage())

// AFSK modulation parameters
const MARK = 1800 // Binary 1 frequency (Hz)
const SPACE = 1500 // Binary 0 frequency (Hz)
const BIT_RATE = 100 // Bit rate (bps)
const START_BYTES = [0x01, 0x02] // Start bytes
const END_BYTES = [0x03, 0x04] // End bytes

// The robot rejects names over 32 bytes and WPA passwords outside 8-63 characters (or 64 hex)
const inputError = computed(() => {
  const net = props.selectedNetwork
  if (!net || !net.ssid || !net.ssid.trim())
    return ''
  return ssidError(net.ssid) || wifiPasswordError(props.password, net.authmode > 0)
})

const canGenerate = computed(() => {
  if (!props.selectedNetwork || !props.selectedNetwork.ssid || !props.selectedNetwork.ssid.trim())
    return false
  if (props.selectedNetwork.authmode > 0 && !props.password)
    return false
  return !inputError.value
})

const durationSeconds = computed(() => {
  if (!props.selectedNetwork)
    return 0
  const textBytes = stringToBytes(`${props.selectedNetwork.ssid}\n${props.password}`)
  const totalBits = (START_BYTES.length + textBytes.length + 1 + END_BYTES.length) * 8
  return Math.ceil(totalBits / BIT_RATE)
})

const stateText = computed(() => {
  if (generating.value)
    return t('msetup.sound.preparing')
  if (playing.value)
    return t('msetup.sound.playing')
  return audioGenerated.value ? t('msetup.sound.ready') : t('msetup.sound.idle')
})

// String to UTF-8 bytes (uni-app has no TextEncoder on every platform)
function stringToBytes(str: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    }
    else if (code < 0x800) {
      bytes.push(0xC0 | (code >> 6))
      bytes.push(0x80 | (code & 0x3F))
    }
    else if (code < 0xD800 || code >= 0xE000) {
      bytes.push(0xE0 | (code >> 12))
      bytes.push(0x80 | ((code >> 6) & 0x3F))
      bytes.push(0x80 | (code & 0x3F))
    }
    else {
      // Surrogate pair handling
      i++
      const hi = code
      const lo = str.charCodeAt(i)
      const codePoint = 0x10000 + (((hi & 0x3FF) << 10) | (lo & 0x3FF))
      bytes.push(0xF0 | (codePoint >> 18))
      bytes.push(0x80 | ((codePoint >> 12) & 0x3F))
      bytes.push(0x80 | ((codePoint >> 6) & 0x3F))
      bytes.push(0x80 | (codePoint & 0x3F))
    }
  }
  return bytes
}

function checksum(data: number[]): number {
  return data.reduce((sum, b) => (sum + b) & 0xFF, 0)
}

function toBits(byte: number): number[] {
  const bits: number[] = []
  for (let i = 7; i >= 0; i--)
    bits.push((byte >> i) & 1)
  return bits
}

// Float to 16-bit PCM
function floatTo16BitPCM(floatSamples: Float32Array): Uint8Array {
  const buffer = new Uint8Array(floatSamples.length * 2)
  for (let i = 0; i < floatSamples.length; i++) {
    const s = Math.max(-1, Math.min(1, floatSamples[i]))
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF
    buffer[i * 2] = val & 0xFF
    buffer[i * 2 + 1] = (val >> 8) & 0xFF
  }
  return buffer
}

const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64Encode(bytes: Uint8Array): string {
  let result = ''
  let i = 0
  while (i < bytes.length) {
    const a = bytes[i++]
    const b = i < bytes.length ? bytes[i++] : 0
    const c = i < bytes.length ? bytes[i++] : 0
    const bitmap = (a << 16) | (b << 8) | c
    result += base64Chars.charAt((bitmap >> 18) & 63)
    result += base64Chars.charAt((bitmap >> 12) & 63)
    result += i - 2 < bytes.length ? base64Chars.charAt((bitmap >> 6) & 63) : '='
    result += i - 1 < bytes.length ? base64Chars.charAt(bitmap & 63) : '='
  }
  return result
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (typeof btoa !== 'undefined') {
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++)
      binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }
  return base64Encode(bytes)
}

// WAV file (mono, 16-bit) around the PCM samples
function buildWavOptimized(pcm: Uint8Array, sampleRate: number): ArrayBuffer {
  const wavHeader = new Uint8Array(44)
  const dataLen = pcm.length
  const fileLen = 36 + dataLen
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++)
      wavHeader[offset + i] = str.charCodeAt(i)
  }
  const write32 = (offset: number, value: number) => {
    wavHeader[offset] = value & 0xFF
    wavHeader[offset + 1] = (value >> 8) & 0xFF
    wavHeader[offset + 2] = (value >> 16) & 0xFF
    wavHeader[offset + 3] = (value >> 24) & 0xFF
  }
  const write16 = (offset: number, value: number) => {
    wavHeader[offset] = value & 0xFF
    wavHeader[offset + 1] = (value >> 8) & 0xFF
  }
  writeStr(0, 'RIFF')
  write32(4, fileLen)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  write32(16, 16)
  write16(20, 1)
  write16(22, 1)
  write32(24, sampleRate)
  write32(28, sampleRate * 2)
  write16(32, 2)
  write16(34, 16)
  writeStr(36, 'data')
  write32(40, dataLen)
  const result = new ArrayBuffer(44 + dataLen)
  const resultView = new Uint8Array(result)
  resultView.set(wavHeader)
  resultView.set(pcm, 44)
  return result
}

async function generateAndPlay() {
  if (!canGenerate.value || !props.selectedNetwork)
    return
  generating.value = true
  try {
    const textBytes = stringToBytes(`${props.selectedNetwork.ssid}\n${props.password}`)
    const fullBytes = [...START_BYTES, ...textBytes, checksum(textBytes), ...END_BYTES]
    let bits: number[] = []
    fullBytes.forEach((b) => {
      bits = bits.concat(toBits(b))
    })

    // AFSK modulation at a reduced sample rate, for a smaller file
    const reducedSampleRate = 22050
    const samplesPerBit = reducedSampleRate / BIT_RATE
    const totalSamples = Math.floor(bits.length * samplesPerBit)
    const floatBuf = new Float32Array(totalSamples)
    for (let i = 0; i < bits.length; i++) {
      const freq = bits[i] ? MARK : SPACE
      for (let j = 0; j < samplesPerBit; j++) {
        const time = (i * samplesPerBit + j) / reducedSampleRate
        floatBuf[i * samplesPerBit + j] = Math.sin(2 * Math.PI * freq * time) * 0.5
      }
    }

    const wavBuffer = buildWavOptimized(floatTo16BitPCM(floatBuf), reducedSampleRate)
    const base64 = arrayBufferToBase64(wavBuffer)
    if (base64.length > 1024 * 1024)
      throw new Error(t('msetup.sound.tooLarge'))

    audioFilePath.value = `data:audio/wav;base64,${base64}`
    audioGenerated.value = true
    setTimeout(() => playAudio(), 800)
  }
  catch (error: any) {
    console.error('Tone generation failed:', error)
    toast.error(error?.message === t('msetup.sound.tooLarge') ? error.message : t('msetup.sound.genFailed'))
  }
  finally {
    generating.value = false
  }
}

async function playAudio() {
  if (!audioFilePath.value) {
    generateAndPlay()
    return
  }
  try {
    await cleanupAudio()
    await new Promise(resolve => setTimeout(resolve, 200))
    playing.value = true

    const innerAudioContext = uni.createInnerAudioContext()
    audioContext.value = innerAudioContext
    innerAudioContext.src = audioFilePath.value
    innerAudioContext.loop = autoLoop.value
    innerAudioContext.volume = 0.8
    innerAudioContext.autoplay = false

    innerAudioContext.onPlay(() => {
      toast.success(t('msetup.sound.started'))
    })
    innerAudioContext.onEnded(() => {
      if (!autoLoop.value) {
        playing.value = false
        cleanupAudio()
      }
    })
    innerAudioContext.onError((error: any) => {
      console.error('Tone playback failed:', error)
      playing.value = false
      let errorMsg = t('msetup.sound.playFailed')
      if (error.errCode === -99)
        errorMsg = t('msetup.sound.busy')
      else if (error.errCode === 10004)
        errorMsg = t('msetup.sound.format')
      else if (error.errCode === 10003)
        errorMsg = t('msetup.sound.fileError')
      toast.error(errorMsg)
      cleanupAudio()
    })
    innerAudioContext.onStop(() => {
      playing.value = false
    })

    setTimeout(() => {
      if (audioContext.value)
        audioContext.value.play()
    }, 300)
  }
  catch (error) {
    console.error('Tone playback error:', error)
    playing.value = false
    await cleanupAudio()
    toast.error(t('msetup.sound.playFailed'))
  }
}

async function cleanupAudio() {
  if (audioContext.value) {
    try {
      audioContext.value.pause()
      audioContext.value.destroy()
    }
    catch (e) {
      console.warn('Could not clean up the audio context:', e)
    }
    finally {
      audioContext.value = null
    }
  }
}

async function stopAudio() {
  playing.value = false
  await cleanupAudio()
  toast.info(t('msetup.sound.stopped'))
}

async function joined() {
  playing.value = false
  await cleanupAudio()
  emit('done', { ssid: props.selectedNetwork?.ssid || '', unconfirmed: false })
}

onBeforeUnmount(() => {
  cleanupAudio()
})
</script>

<template>
  <view class="setup-step">
    <view class="setup-step__body">
      <text class="setup-h">
        {{ t('msetup.sound.title') }}
      </text>
      <text class="setup-lead">
        {{ t('msetup.sound.text') }}
      </text>

      <view v-if="selectedNetwork" class="setup-table">
        <view class="setup-row">
          <text class="setup-key">
            {{ t('msetup.send.network') }}
          </text>
          <view class="setup-val">
            <text class="setup-ssid">
              {{ selectedNetwork.ssid }}
            </text>
          </view>
          <tb-button size="s" variant="quiet" icon="edit" @click="emit('back')">
            {{ t('msetup.send.change') }}
          </tb-button>
        </view>
      </view>

      <view v-if="inputError" class="setup-alert" role="alert">
        <tb-icon name="warning" :size="18" /><text>{{ inputError }}</text>
      </view>

      <view class="snd" :class="{ 'is-playing': playing }" role="status">
        <view class="snd__wave" aria-hidden="true">
          <view v-for="i in 7" :key="i" class="snd__bar" />
        </view>
        <view class="snd__text">
          <text class="snd__state">
            {{ stateText }}
          </text>
          <text class="tb-num snd__len">
            {{ t('msetup.sound.length', { n: digits(durationSeconds, lang) }) }}
          </text>
        </view>
      </view>

      <view class="setup-toggle snd__loop">
        <tb-switch v-model="autoLoop" :label="t('msetup.sound.loop')" />
      </view>

      <view class="setup-lines">
        <text class="setup-line">
          {{ t('msetup.sound.after') }}
        </text>
        <text class="setup-line">
          {{ t('msetup.sound.how') }}
        </text>
      </view>
    </view>

    <view class="setup-foot">
      <tb-button v-if="audioGenerated" block icon="check" @click="joined">
        {{ t('msetup.sound.joined') }}
      </tb-button>
      <tb-button v-if="playing" variant="danger" size="l" block icon="stop" @click="stopAudio">
        {{ t('msetup.sound.stop') }}
      </tb-button>
      <tb-button
        v-else variant="primary" size="l" block icon="play" :loading="generating" :disabled="!canGenerate"
        @click="audioGenerated ? playAudio() : generateAndPlay()"
      >
        {{ audioGenerated ? t('msetup.sound.playAgain') : t('msetup.sound.play') }}
      </tb-button>
    </view>
  </view>
</template>

<style lang="scss">
@import './setup-shared.scss';

.snd {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 22px;
  padding: 16px 0;
  border-top: 1px solid var(--tb-rule);
  border-bottom: 1px solid var(--tb-rule);
}
.snd__wave {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  flex: none;
}
.snd__bar {
  width: 5px;
  height: 100%;
  background: var(--tb-ink-3);
  transform: scaleY(0.3);
  transform-origin: center;
}
.snd__bar:nth-child(2),
.snd__bar:nth-child(6) {
  transform: scaleY(0.5);
}
.snd__bar:nth-child(3),
.snd__bar:nth-child(5) {
  transform: scaleY(0.7);
}
.snd__bar:nth-child(4) {
  transform: scaleY(0.9);
}
.snd.is-playing .snd__bar {
  background: var(--tb-orange);
  animation: snd-wave 900ms var(--tb-ease) infinite alternate;
}
.snd.is-playing .snd__bar:nth-child(2n) {
  animation-delay: 150ms;
}
.snd.is-playing .snd__bar:nth-child(3n) {
  animation-delay: 300ms;
}
@keyframes snd-wave {
  from {
    transform: scaleY(0.25);
  }
  to {
    transform: scaleY(1);
  }
}
.snd__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.snd__state {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 19px;
}
.snd__len {
  color: var(--tb-ink-2);
  font-size: 14px;
}
.snd__loop {
  margin-top: 14px;
}
</style>
