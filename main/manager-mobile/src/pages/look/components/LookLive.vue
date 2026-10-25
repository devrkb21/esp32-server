<script lang="ts" setup>
// "Live from TinyBot": the robot's real OLED, fetched with the device tool `self.screen.preview`
// (POST /device/tools/call/{deviceId}) one request at a time (src/utils/liveScreen.mjs).
// It asks only while mounted, on screen (IntersectionObserver), the page shown and the app visible.
import { onHide, onShow } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getScreenPreview } from '@/api/device/device'
import { peopleText } from '@/http/request/errorText.mjs'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import {
  createScreenPoller,
  frameAgeParts,
  isLive,
  parseScreenFrame,
  screenToolArgs,
  toolErrorText,
} from '@/utils/liveScreen.mjs'

defineOptions({ name: 'LookLive' })

const props = withDefaults(defineProps<{
  deviceId: string
  /** OLED pixels to CSS pixels, a whole number so every robot pixel stays square */
  scale?: number
  /** JPEG quality 1..100 */
  quality?: number
}>(), { scale: 2, quality: 90 })

interface ScreenFrame { width: number, height: number, jpeg: string, src: string }
interface ScreenState {
  status: string
  result?: string
  frame: ScreenFrame | null
  frameAt: number
  failures: number
  error: any
  paused: boolean
  inFlight: boolean
}

const EMPTY: ScreenState = { status: 'idle', frame: null, frameAt: 0, failures: 0, error: null, paused: false, inFlight: false }
const state = ref<ScreenState>({ ...EMPTY })
const now = ref(Date.now())

let poller: ReturnType<typeof createScreenPoller> | null = null
let clock: ReturnType<typeof setInterval> | undefined
let observer: UniApp.IntersectionObserver | null = null
const instance = getCurrentInstance()

const frame = computed(() => state.value.frame)
const offline = computed(() => state.value.result === 'offline')
const liveNow = computed(() => isLive(state.value, now.value))
const stale = computed(() => !!frame.value && !liveNow.value)
const pixelSize = computed(() => ({ width: `${128 * props.scale}px`, height: `${64 * props.scale}px` }))

const tone = computed(() => {
  const s = state.value
  if (s.paused || s.status === 'idle')
    return 'idle'
  if (s.status === 'offline')
    return 'error'
  if (s.status === 'retrying' || s.status === 'connecting')
    return 'wait'
  return liveNow.value ? 'live' : 'wait'
})

const statusText = computed(() => {
  const s = state.value
  if (s.paused)
    return t('lookPage.live.paused')
  if (s.status === 'idle')
    return s.frame ? t('lookPage.live.hidden') : t('lookPage.live.paused')
  if (s.status === 'offline')
    return t('lookPage.live.offline')
  if (s.status === 'connecting')
    return t('lookPage.live.connecting')
  if (s.status === 'retrying' || !liveNow.value)
    return t('lookPage.live.retrying')
  return t('lookPage.live.live')
})

const ageText = computed(() => {
  const p = frameAgeParts(state.value.frameAt, now.value)
  if (!p)
    return state.value.paused ? '' : t('lookPage.live.waiting')
  const n = digits(p.n, getCurrentLanguage())
  if (p.key === 'now')
    return t('lookPage.live.updatedNow')
  if (p.key === 'seconds')
    return t('lookPage.live.updatedSeconds', { n })
  if (p.key === 'minutes')
    return t('lookPage.live.updatedMinutes', { n })
  return t('lookPage.live.updatedHours', { n })
})

// The robot's or server's own words only when they are meant for people; raw text stays in the console.
const errorDetail = computed(() => {
  const e = state.value.error
  return peopleText(e && (e.serverMsg || e.msg || e.message))
})

async function fetchFrame() {
  const data = await getScreenPreview(props.deviceId, screenToolArgs(props.quality).quality)
  const f = parseScreenFrame(data)
  if (!f)
    throw new Error(toolErrorText(data) || 'no frame')
  return f
}

function pageVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

function onVisibility() {
  poller?.setPageVisible(pageVisible())
}

function restart() {
  const wasPaused = poller ? poller.getState().paused : false
  poller?.destroy()
  poller = null
  state.value = { ...EMPTY, paused: wasPaused }
  if (!props.deviceId)
    return
  const p = createScreenPoller({
    fetchFrame,
    onUpdate: (s: ScreenState) => {
      if (poller === p) {
        state.value = s
        now.value = Date.now()
      }
    },
  })
  poller = p
  p.setPageVisible(pageVisible())
  if (wasPaused)
    p.pause()
  p.start()
}

function togglePause() {
  if (!poller)
    return
  if (poller.getState().paused)
    poller.resume()
  else
    poller.pause()
}

function retry() {
  poller?.retry()
}

watch(() => props.deviceId, restart)

// Look is a tab page and stays alive under the other tabs: stop asking while it is not shown
onShow(() => poller?.setPageVisible(pageVisible()))
onHide(() => poller?.setPageVisible(false))

onMounted(() => {
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', onVisibility)
  clock = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  restart()
  // scrolled out of view: stop asking
  try {
    observer = uni.createIntersectionObserver(instance?.proxy as any)
    observer.relativeToViewport({}).observe('.look-live', (res) => {
      poller?.setVisible((res.intersectionRatio || 0) > 0)
    })
  }
  catch {
    observer = null
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined')
    document.removeEventListener('visibilitychange', onVisibility)
  if (clock)
    clearInterval(clock)
  observer?.disconnect()
  observer = null
  poller?.destroy()
  poller = null
})
</script>

<template>
  <view class="look-live">
    <view class="look-live__window" :class="{ 'is-stale': stale }">
      <image
        v-if="frame" class="look-live__pixels" :src="frame.src" :style="pixelSize" mode="scaleToFill"
        role="img" :aria-label="t('lookPage.live.alt')"
      />
      <view v-else class="look-live__blank" :style="pixelSize" />
      <view v-if="!deviceId" class="look-live__over">
        <text>{{ t('lookPage.noRobot') }}</text>
      </view>
      <view v-else-if="offline" class="look-live__over is-error" role="alert">
        <text class="look-live__overtitle">
          {{ t('lookPage.live.offlineTitle') }}
        </text>
        <text>{{ t('lookPage.live.offlineHint') }}</text>
        <text v-if="errorDetail" class="look-live__detail">
          {{ errorDetail }}
        </text>
      </view>
      <view v-else-if="!frame" class="look-live__over">
        <text>{{ state.paused ? t('lookPage.live.paused') : t('lookPage.live.waiting') }}</text>
      </view>
    </view>

    <view v-if="deviceId" class="look-live__bar">
      <view class="look-live__state" :class="`is-${tone}`" role="status" aria-live="polite">
        <view class="look-live__mark" /><text>{{ statusText }}</text>
      </view>
      <text class="tb-num look-live__age">
        {{ ageText }}
      </text>
      <view class="look-live__btns">
        <tb-button v-if="offline" size="s" variant="quiet" icon="refresh" :disabled="state.inFlight" @click="retry">
          {{ t('lookPage.live.retry') }}
        </tb-button>
        <tb-button size="s" :icon="state.paused ? 'play' : 'pause'" @click="togglePause">
          {{ state.paused ? t('lookPage.live.resume') : t('lookPage.live.pause') }}
        </tb-button>
      </view>
    </view>
  </view>
</template>

<style lang="scss">
.look-live {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
/* the face window: the robot's black OLED, the frame at a whole-number pixel scale */
.look-live__window {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  background: var(--tb-face);
  border-radius: var(--tb-radius-s);
  overflow: hidden;
}
.look-live__pixels {
  display: block;
  flex: none;
  image-rendering: pixelated;
  transition: opacity var(--tb-t-fast) var(--tb-ease);
}
.look-live__window.is-stale .look-live__pixels {
  opacity: 0.55;
}
.look-live__blank {
  flex: none;
  max-width: 100%;
}
/* words on the black window: the lit-pixel white of the OLED reads in both themes */
.look-live__over {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px;
  text-align: center;
  color: white;
  font-size: 14px;
  line-height: 1.45;
}
.look-live__over.is-error {
  background: color-mix(in srgb, var(--tb-face) 80%, transparent);
}
.look-live__overtitle {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 16px;
}
.look-live__detail {
  opacity: 0.75;
  font-size: 13px;
}
.look-live__bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-height: 44px;
}
.look-live__state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}
.look-live__mark {
  width: 9px;
  height: 9px;
  flex: none;
  background: var(--tb-ink-3);
}
.look-live__state.is-live .look-live__mark {
  background: var(--tb-ok);
}
.look-live__state.is-wait .look-live__mark {
  background: var(--tb-routine-mark);
}
.look-live__state.is-error {
  color: var(--tb-danger);
}
.look-live__state.is-error .look-live__mark {
  background: var(--tb-danger);
}
.look-live__age {
  flex: 1;
  min-width: 0;
  color: var(--tb-ink-2);
  font-size: 13px;
}
.look-live__btns {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
