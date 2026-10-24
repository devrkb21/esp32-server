<script lang="ts" setup>
import { onHide, onShow } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getScreenPreview } from '@/api/device/device'
import { t } from '@/i18n'
import {
  createScreenPoller,
  frameAgeParts,
  isLive,
  parseScreenFrame,
  screenToolArgs,
  toolErrorText,
} from '../liveScreen.mjs'

defineOptions({
  name: 'CompanionLiveScreen',
})

const props = withDefaults(defineProps<{
  deviceId: string
  /** JPEG quality 1..100 */
  quality?: number
}>(), {
  quality: 90,
})

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

const tone = computed(() => {
  const s = state.value
  if (s.paused || s.status === 'idle')
    return ''
  if (s.status === 'offline')
    return 'danger'
  if (s.status === 'retrying' || s.status === 'connecting' || !liveNow.value)
    return 'warning'
  return 'success'
})

const statusText = computed(() => {
  const s = state.value
  if (s.paused)
    return t('companion.live.paused')
  if (s.status === 'idle')
    return s.frame ? t('companion.live.hidden') : t('companion.live.paused')
  if (s.status === 'offline')
    return t('companion.live.offline')
  if (s.status === 'connecting')
    return t('companion.live.connecting')
  if (s.status === 'retrying' || !liveNow.value)
    return t('companion.live.retrying')
  return t('companion.live.live')
})

const ageText = computed(() => {
  const p = frameAgeParts(state.value.frameAt, now.value)
  if (!p)
    return state.value.paused ? '' : t('companion.live.waiting')
  if (p.key === 'now')
    return t('companion.live.updatedNow')
  if (p.key === 'seconds')
    return t('companion.live.updatedSeconds', { n: p.n })
  if (p.key === 'minutes')
    return t('companion.live.updatedMinutes', { n: p.n })
  return t('companion.live.updatedHours', { n: p.n })
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

// The companion page stays in the page stack under other pages: stop while it is not shown
onShow(() => poller?.setPageVisible(pageVisible()))
onHide(() => poller?.setPageVisible(false))

onMounted(() => {
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', onVisibility)
  clock = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  restart()
  // Scrolled out of view: stop asking
  try {
    observer = uni.createIntersectionObserver(instance?.proxy as any)
    observer.relativeToViewport({}).observe('.live', (res) => {
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
  <view class="nx-card live">
    <view class="live__head">
      <view class="live__title">
        {{ t('companion.live.title') }}
      </view>
      <view class="nx-badge" :class="tone ? `nx-badge--${tone}` : ''" role="status">
        <view class="nx-dot" :class="{ 'nx-dot--online': tone === 'success', 'nx-dot--danger': tone === 'danger', 'live__dot--warning': tone === 'warning' }" />
        {{ statusText }}
      </view>
    </view>

    <view class="live__bezel">
      <view class="live__screen" :class="{ 'is-stale': stale }">
        <image
          v-if="frame"
          class="live__img"
          :src="frame.src"
          mode="scaleToFill"
          role="img"
          :aria-label="t('companion.live.alt')"
        />
        <view v-if="offline" class="live__overlay live__overlay--error" role="alert">
          <view class="live__overlay-title">
            {{ t('companion.live.offlineTitle') }}
          </view>
          <view class="live__overlay-hint">
            {{ t('companion.live.offlineHint') }}
          </view>
        </view>
        <view v-else-if="!frame" class="live__overlay">
          {{ state.paused ? t('companion.live.paused') : t('companion.live.waiting') }}
        </view>
      </view>
    </view>

    <view class="live__foot">
      <view class="nx-caption nx-num live__age">
        {{ ageText }}
      </view>
      <view v-if="offline" class="live__btn" role="button" @click="retry">
        {{ t('companion.live.retry') }}
      </view>
      <view class="live__btn" role="button" @click="togglePause">
        <wd-icon :name="state.paused ? 'play-circle' : 'pause-circle'" size="16px" />
        {{ state.paused ? t('companion.live.resume') : t('companion.live.pause') }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.live {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
  margin-bottom: var(--nx-space-4);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-3);
  }

  &__title {
    min-width: 0;
    font-size: var(--nx-text-headline);
    font-weight: 600;
    color: var(--nx-text);
  }

  &__dot--warning {
    background: var(--nx-warning);
  }

  // The robot's bezel and panel: hardware colours, not theme tokens
  &__bezel {
    padding: var(--nx-space-2);
    border-radius: var(--nx-radius-lg);
    background: #15181d;
  }

  &__screen {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 1;
    overflow: hidden;
    border-radius: var(--nx-radius-sm);
    background: #06080b;

    &.is-stale .live__img {
      opacity: 0.55;
    }
  }

  &__img {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  &__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--nx-space-1);
    padding: var(--nx-space-3);
    text-align: center;
    font-size: var(--nx-text-footnote);
    color: #c9d1db; // on the dark panel

    &--error {
      background: rgba(6, 8, 11, 0.78);
    }
  }

  &__overlay-title {
    font-weight: 600;
    color: #f2f6fa;
  }

  &__overlay-hint {
    font-size: var(--nx-text-caption);
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
  }

  &__age {
    flex: 1;
    min-width: 0;
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    gap: 8rpx;
    min-height: 64rpx;
    padding: 0 var(--nx-space-4);
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-2);
    color: var(--nx-text);
    font-size: var(--nx-text-footnote);
    font-weight: 600;

    &:active {
      opacity: 0.7;
    }
  }
}
</style>
