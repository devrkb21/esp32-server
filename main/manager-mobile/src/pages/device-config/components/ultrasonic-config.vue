<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'wot-design-uni/components/wd-toast'
import { t } from '@/i18n'

// Type definitions
interface WiFiNetwork {
  ssid: string
  rssi: number
  authmode: number
  channel: number
}

// Props
interface Props {
  selectedNetwork: WiFiNetwork | null
  password: string
}

const props = defineProps<Props>()

// Toast instance
const toast = useToast()

// Reactive data
const generating = ref(false)
const playing = ref(false)
const audioGenerated = ref(false)
const autoLoop = ref(true)
const audioFilePath = ref('')
const audioContext = ref<any>(null)

// AFSK modulation parameters
const MARK = 1800 // Binary 1 frequency (Hz)
const SPACE = 1500 // Binary 0 frequency (Hz)
const SAMPLE_RATE = 44100 // Sample rate
const BIT_RATE = 100 // Bit rate (bps)
const START_BYTES = [0x01, 0x02] // Start bytes
const END_BYTES = [0x03, 0x04] // End bytes

// Computed properties
const canGenerate = computed(() => {
  if (!props.selectedNetwork || !props.selectedNetwork.ssid || !props.selectedNetwork.ssid.trim())
    return false
  if (props.selectedNetwork.authmode > 0 && !props.password)
    return false
  return true
})

const audioLengthText = computed(() => {
  if (!props.selectedNetwork)
    return '0s'
  const dataStr = `${props.selectedNetwork.ssid}\n${props.password}`
  const textBytes = stringToBytes(dataStr)
  const totalBits = (START_BYTES.length + textBytes.length + 1 + END_BYTES.length) * 8
  const duration = Math.ceil(totalBits / BIT_RATE)
  return `${t('deviceConfig.about')}${duration}${t('deviceConfig.seconds')}`
})

// Instructions shown under the player
const steps = computed(() => [
  t('deviceConfig.ensureWifiNetworkSelectedAndPasswordEntered'),
  t('deviceConfig.clickGenerateAndPlaySoundWave'),
  t('deviceConfig.bringPhoneCloseToXiaozhiDevice'),
  t('deviceConfig.duringAudioPlaybackXiaozhiWillReceive'),
  t('deviceConfig.afterConfigSuccessDeviceWillConnect'),
])

// String to byte array - uniapp compatible
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

// Checksum calculation
function checksum(data: number[]): number {
  return data.reduce((sum, b) => (sum + b) & 0xFF, 0)
}

// Bytes to bits
function toBits(byte: number): number[] {
  const bits: number[] = []
  for (let i = 7; i >= 0; i--) {
    bits.push((byte >> i) & 1)
  }
  return bits
}

// AFSK modulation
function afskModulate(bits: number[]): Float32Array {
  const samplesPerBit = SAMPLE_RATE / BIT_RATE
  const totalSamples = Math.floor(bits.length * samplesPerBit)
  const buffer = new Float32Array(totalSamples)

  for (let i = 0; i < bits.length; i++) {
    const freq = bits[i] ? MARK : SPACE
    for (let j = 0; j < samplesPerBit; j++) {
      const t = (i * samplesPerBit + j) / SAMPLE_RATE
      buffer[i * samplesPerBit + j] = Math.sin(2 * Math.PI * freq * t)
    }
  }

  return buffer
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

// base64 encoding table
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Compatible base64 implementation
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

// Array to base64 encoding
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  // Try native btoa, fallback to custom implementation
  if (typeof btoa !== 'undefined') {
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
  else {
    return base64Encode(bytes)
  }
}

// Build WAV file - returns ArrayBuffer instead of Blob
function buildWav(pcm: Uint8Array): ArrayBuffer {
  const wavHeader = new Uint8Array(44)
  const dataLen = pcm.length
  const fileLen = 36 + dataLen

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      wavHeader[offset + i] = str.charCodeAt(i)
    }
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
  write32(24, SAMPLE_RATE)
  write32(28, SAMPLE_RATE * 2)
  write16(32, 2)
  write16(34, 16)
  writeStr(36, 'data')
  write32(40, dataLen)

  // Merge header and data
  const result = new ArrayBuffer(44 + dataLen)
  const resultView = new Uint8Array(result)
  resultView.set(wavHeader)
  resultView.set(pcm, 44)

  return result
}

// Generate and play sound wave
async function generateAndPlay() {
  if (!canGenerate.value || !props.selectedNetwork)
    return

  generating.value = true

  try {
    console.log(`${t('deviceConfig.generatingUltrasonicConfigAudio')}...`)

    // Prepare provisioning data
    const dataStr = `${props.selectedNetwork.ssid}\n${props.password}`
    const textBytes = stringToBytes(dataStr)
    const fullBytes = [...START_BYTES, ...textBytes, checksum(textBytes), ...END_BYTES]

    console.log(`${t('deviceConfig.configData')}:`, { ssid: props.selectedNetwork.ssid, password: props.password })
    console.log(`${t('deviceConfig.dataBytesLength')}:`, textBytes.length)

    // Convert to bitstream
    let bits: number[] = []
    fullBytes.forEach((b) => {
      bits = bits.concat(toBits(b))
    })

    console.log(`${t('deviceConfig.bitStreamLength')}:`, bits.length)

    // AFSK modulation - reduced sample rate for smaller size
    const reducedSampleRate = 22050 // Reduced sample rate
    const samplesPerBit = reducedSampleRate / BIT_RATE
    const totalSamples = Math.floor(bits.length * samplesPerBit)
    const floatBuf = new Float32Array(totalSamples)

    for (let i = 0; i < bits.length; i++) {
      const freq = bits[i] ? MARK : SPACE
      for (let j = 0; j < samplesPerBit; j++) {
        const t = (i * samplesPerBit + j) / reducedSampleRate
        floatBuf[i * samplesPerBit + j] = Math.sin(2 * Math.PI * freq * t) * 0.5 // Reduced volume
      }
    }

    const pcmBuf = floatTo16BitPCM(floatBuf)

    // Generate WAV file - using reduced sample rate
    const wavBuffer = buildWavOptimized(pcmBuf, reducedSampleRate)
    const base64 = arrayBufferToBase64(wavBuffer)
    const dataUri = `data:audio/wav;base64,${base64}`

    console.log(`${t('deviceConfig.base64Length')}:`, base64.length, t('deviceConfig.about'), Math.round(base64.length / 1024), 'KB')

    // Check data size
    if (base64.length > 1024 * 1024) { // Exceeds 1MB
      throw new Error(t('deviceConfig.audioFileTooLarge'))
    }

    audioFilePath.value = dataUri
    audioGenerated.value = true

    console.log(`${t('deviceConfig.audioGenerationSuccess')}, bitstream length:`, bits.length, `${t('deviceConfig.samplePoints')}:`, floatBuf.length)

    toast.success(t('deviceConfig.soundWaveGenerationSuccess'))

    // Delay playback
    setTimeout(async () => {
      await playAudio()
    }, 800) // Increased delay
  }
  catch (error) {
    console.error(`${t('deviceConfig.audioGenerationFailed')}:`, error)
    toast.error(`${t('deviceConfig.soundWaveGenerationFailed')}: ${error.message || error}`)
  }
  finally {
    generating.value = false
  }
}

// Optimized WAV build function
function buildWavOptimized(pcm: Uint8Array, sampleRate: number): ArrayBuffer {
  const wavHeader = new Uint8Array(44)
  const dataLen = pcm.length
  const fileLen = 36 + dataLen

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      wavHeader[offset + i] = str.charCodeAt(i)
    }
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
  write32(24, sampleRate) // Use passed sample rate
  write32(28, sampleRate * 2)
  write16(32, 2)
  write16(34, 16)
  writeStr(36, 'data')
  write32(40, dataLen)

  // Merge header and data
  const result = new ArrayBuffer(44 + dataLen)
  const resultView = new Uint8Array(result)
  resultView.set(wavHeader)
  resultView.set(pcm, 44)

  return result
}

// Play audio
async function playAudio() {
  if (!audioFilePath.value) {
    toast.error(t('deviceConfig.pleaseGenerateAudioFirst'))
    return
  }

  try {
    // Force clean up all legacy audio instances
    await cleanupAudio()

    // Wait briefly to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 200))

    playing.value = true
    console.log(t('deviceConfig.startPlayingUltrasonicConfigAudio'))

    // Create new audio context
    const innerAudioContext = uni.createInnerAudioContext()
    audioContext.value = innerAudioContext

    // Simplified audio settings
    innerAudioContext.src = audioFilePath.value
    innerAudioContext.loop = autoLoop.value
    innerAudioContext.volume = 0.8
    innerAudioContext.autoplay = false

    // Simplified event listeners
    innerAudioContext.onPlay(() => {
      console.log(t('deviceConfig.ultrasonicAudioStartedPlaying'))
      toast.success(t('deviceConfig.startPlayingConfigSoundWave'))
    })

    innerAudioContext.onEnded(() => {
      console.log(t('deviceConfig.ultrasonicAudioPlaybackEnded'))
      if (!autoLoop.value) {
        playing.value = false
        cleanupAudio()
      }
    })

    innerAudioContext.onError((error) => {
      console.error(`${t('deviceConfig.audioPlaybackFailed')}:`, error)
      playing.value = false

      let errorMsg = t('deviceConfig.audioPlaybackFailed')
      if (error.errCode === -99) {
        errorMsg = t('deviceConfig.audioResourceBusy')
      }
      else if (error.errCode === 10004) {
        errorMsg = t('deviceConfig.audioFormatNotSupported')
      }
      else if (error.errCode === 10003) {
        errorMsg = t('deviceConfig.audioFileError')
      }

      toast.error(errorMsg)

      cleanupAudio()
    })

    innerAudioContext.onStop(() => {
      console.log('Audio playback stopped')
      playing.value = false
    })

    // Delay playback
    setTimeout(() => {
      if (audioContext.value) {
        console.log('Attempting audio playback, src length:', audioFilePath.value.length)
        audioContext.value.play()
      }
    }, 300)
  }
  catch (error) {
    console.error(`${t('deviceConfig.audioPlaybackError')}:`, error)
    playing.value = false
    await cleanupAudio()
    toast.error(`${t('deviceConfig.playbackFailed')}: ${error.message}`)
  }
}

// Clean up audio resources
async function cleanupAudio() {
  if (audioContext.value) {
    try {
      audioContext.value.pause()
      audioContext.value.destroy()
      console.log(t('deviceConfig.cleaningUpAudioContext'))
    }
    catch (e) {
      console.log(`${t('deviceConfig.cleaningUpAudioContextFailed')}:`, e)
    }
    finally {
      audioContext.value = null
    }
  }
}

// Stop playback
async function stopAudio() {
  playing.value = false
  await cleanupAudio()

  console.log(t('deviceConfig.stoppedPlayingUltrasonicAudio'))
  toast.success(t('deviceConfig.stoppedPlaying'))
}
</script>

<template>
  <view class="prov">
    <!-- Selected network -->
    <view v-if="props.selectedNetwork" class="nx-group prov__group">
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-icon-tile prov__icon">
            <wd-icon name="wifi" size="18px" />
          </view>
          <view class="nx-row__main">
            <view class="nx-caption">
              {{ t('deviceConfig.selectedNetwork') }}
            </view>
            <view class="nx-row__title nx-truncate prov__ssid" :title="props.selectedNetwork.ssid">
              {{ props.selectedNetwork.ssid }}
            </view>
            <view class="nx-row__subtitle nx-num">
              {{ t('deviceConfig.signal') }} {{ props.selectedNetwork.rssi }} dBm · {{ props.selectedNetwork.authmode === 0 ? t('deviceConfig.openNetwork') : t('deviceConfig.encryptedNetwork') }}
            </view>
          </view>
          <view v-if="props.password" class="nx-badge" :aria-label="t('deviceConfig.password')">
            <wd-icon name="lock-on" size="12px" />
            {{ '•'.repeat(Math.min(props.password.length, 8)) }}
          </view>
        </view>
      </view>
    </view>

    <!-- Sound player -->
    <view class="nx-group prov__group">
      <view class="nx-group__body">
        <view class="prov__player" :class="{ 'is-playing': playing }">
          <view class="prov__wave" aria-hidden="true">
            <view v-for="i in 5" :key="i" class="prov__wave-bar" />
          </view>
          <view class="prov__player-text">
            <view class="nx-row__title">
              {{ playing ? t('deviceConfig.playing') : t('deviceConfig.configAudioFile') }}
            </view>
            <view class="nx-row__subtitle nx-num">
              {{ t('deviceConfig.duration') }}: {{ audioLengthText }}
            </view>
          </view>
        </view>

        <view v-if="audioGenerated" class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('deviceConfig.autoLoopPlaySoundWave') }}
          </view>
          <wd-switch v-model="autoLoop" size="22px" />
        </view>
      </view>
    </view>

    <view class="prov__actions">
      <wd-button
        v-if="!playing"
        type="primary"
        size="large"
        block
        :loading="generating"
        :disabled="!canGenerate"
        @click="generateAndPlay"
      >
        {{ generating ? t('deviceConfig.generating') : t('deviceConfig.generateAndPlaySoundWave') }}
      </wd-button>

      <wd-button
        v-if="audioGenerated && !playing"
        type="info"
        size="large"
        block
        @click="playAudio"
      >
        {{ t('deviceConfig.playSoundWave') }}
      </wd-button>

      <wd-button
        v-if="playing"
        type="error"
        size="large"
        block
        @click="stopAudio"
      >
        {{ t('deviceConfig.stopPlaying') }}
      </wd-button>
    </view>

    <!-- Instructions -->
    <view class="nx-group prov__group">
      <view class="nx-group__header">
        {{ t('deviceConfig.ultrasonicConfigInstructions') }}
      </view>
      <view class="nx-group__body">
        <view v-for="(item, index) in steps" :key="index" class="nx-row prov__step">
          <view class="nx-num prov__step-num">
            {{ index + 1 }}
          </view>
          <view class="nx-row__main prov__step-text">
            {{ item }}
          </view>
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('deviceConfig.usesAfskModulation') }} {{ t('deviceConfig.ensureModeratePhoneVolume') }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.prov {
  &__group {
    margin-bottom: var(--nx-space-4);

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__icon {
    width: 60rpx;
    height: 60rpx;
    border-radius: var(--nx-radius-sm);
  }

  &__ssid {
    font-weight: 600;
  }

  &__player {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    padding: var(--nx-space-4);

    &::after {
      content: '';
      position: absolute;
      left: var(--nx-space-4);
      right: 0;
      bottom: 0;
      height: 1rpx;
      background: var(--nx-border);
    }

    &:last-child::after {
      display: none;
    }
  }

  &__player-text {
    flex: 1;
    min-width: 0;
  }

  &__wave {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 6rpx;
    width: 88rpx;
    height: 88rpx;
    border-radius: var(--nx-radius);
    background: var(--nx-accent-soft);
  }

  &__wave-bar {
    width: 6rpx;
    height: 36rpx;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-accent);
    transform: scaleY(0.4);
    transform-origin: center;

    &:nth-child(2),
    &:nth-child(4) {
      transform: scaleY(0.7);
    }

    &:nth-child(3) {
      transform: scaleY(1);
    }
  }

  &__player.is-playing &__wave {
    background: var(--nx-accent);
  }

  &__player.is-playing &__wave-bar {
    background: var(--nx-on-accent);
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-2);
    margin-bottom: var(--nx-space-5);
  }

  &__step {
    align-items: flex-start;
    min-height: 0;
    padding-top: var(--nx-space-2);
    padding-bottom: var(--nx-space-2);
  }

  &__step-num {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 40rpx;
    height: 40rpx;
    margin-top: 2rpx;
    border-radius: 50%;
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    font-weight: 600;
  }

  &__step-text {
    font-size: var(--nx-text-callout);
    line-height: 1.45;
    color: var(--nx-text-2);
  }
}
</style>
