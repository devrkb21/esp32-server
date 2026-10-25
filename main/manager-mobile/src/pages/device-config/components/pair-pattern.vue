<script setup lang="ts">
// Pairing step of the hotspot setup: TinyBot shows a pattern on its face, the person taps the same
// one of the four here, each drawn in a black window like the robot's own screen. Emits `paired`
// with the token /submit needs ('' when this robot has no pairing step).
import type { PairOption, PairState } from '../utils/hotspotClient'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { answerPairing, fetchPairState } from '../utils/hotspotClient'
import { litCells, PATTERN_SIZE } from '../utils/pairingUtils.mjs'

const emit = defineEmits<{
  (e: 'paired', token: string): void
}>()

const loading = ref(true)
const sending = ref(false)
const picked = ref<number | null>(null)
const options = ref<PairOption[]>([])
const lockedSeconds = ref(0)
const message = ref('')

const lang = computed(() => getCurrentLanguage())
const num = (n: number) => digits(n, lang.value)

let lockTimer: ReturnType<typeof setInterval> | null = null

function cellStyle(cell: number[]) {
  const size = 100 / PATTERN_SIZE
  return { left: `${cell[0] * size}%`, top: `${cell[1] * size}%`, width: `${size + 0.4}%`, height: `${size + 0.4}%` }
}

function stopLockTimer() {
  if (lockTimer) {
    clearInterval(lockTimer)
    lockTimer = null
  }
}

function apply(state: PairState) {
  stopLockTimer()
  if (!state.required) {
    emit('paired', '')
    return
  }
  if (state.success) {
    emit('paired', state.token)
    return
  }
  options.value = state.options
  lockedSeconds.value = Math.ceil(state.lockedMs / 1000)
  if (lockedSeconds.value > 0) {
    message.value = ''
    lockTimer = setInterval(() => {
      lockedSeconds.value--
      if (lockedSeconds.value <= 0)
        load()
    }, 1000)
  }
}

async function load() {
  loading.value = true
  message.value = ''
  try {
    apply(await fetchPairState())
  }
  finally {
    loading.value = false
  }
}

async function pick(option: PairOption) {
  if (sending.value)
    return
  sending.value = true
  picked.value = option.id
  try {
    const state = await answerPairing(option.id)
    if (!state.success && state.lockedMs === 0 && state.options.length)
      message.value = t('msetup.pair.wrong', { n: num(state.attemptsLeft) })
    apply(state)
  }
  catch {
    message.value = t('msetup.err.notOnHotspot')
  }
  finally {
    sending.value = false
    picked.value = null
  }
}

onMounted(load)
onBeforeUnmount(stopLockTimer)

defineExpose({ reload: load })
</script>

<template>
  <view class="pair">
    <text class="setup-h">
      {{ t('msetup.pair.title') }}
    </text>
    <text class="setup-lead">
      {{ t('msetup.pair.text') }}
    </text>

    <view v-if="loading && !options.length" class="pair__state">
      <tb-loading :label="t('msetup.pair.loading')" />
    </view>

    <view v-else-if="lockedSeconds > 0" class="pair__lock" role="status">
      <text class="tb-num pair__count">
        {{ num(lockedSeconds) }}
      </text>
      <view class="pair__locktext">
        <text class="pair__unit">
          {{ t('msetup.pair.seconds') }}
        </text>
        <text>{{ t('msetup.pair.locked') }}</text>
      </view>
    </view>

    <view v-else class="pair__grid" role="group" :aria-label="t('msetup.pair.title')">
      <view
        v-for="(option, i) in options" :key="`${option.id}-${i}`" class="pair__opt"
        :class="{ 'is-busy': sending && picked !== option.id, 'is-picked': picked === option.id }"
        role="button" :aria-label="t('msetup.pair.option', { n: num(i + 1) })" hover-class="is-press" @click="pick(option)"
      >
        <view class="pair__bitmap">
          <view v-for="(cell, index) in litCells(option.rows)" :key="index" class="pair__cell" :style="cellStyle(cell)" />
        </view>
      </view>
    </view>

    <view v-if="sending" class="pair__state">
      <tb-loading :label="t('msetup.pair.checking')" />
    </view>
    <view v-if="message" class="pair__msg" role="alert">
      <tb-icon name="warning" :size="18" />
      <text>{{ message }}</text>
      <tb-button v-if="!options.length" size="s" variant="quiet" icon="refresh" @click="load">
        {{ t('common.retry') }}
      </tb-button>
    </view>
  </view>
</template>

<style lang="scss">
@import './setup-shared.scss';

.pair {
  display: flex;
  flex-direction: column;
}
.pair__state {
  padding: 18px 0;
}
.pair__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 18px;
  max-width: 420px;
}
.pair__opt {
  padding: 16%;
  background: var(--tb-face);
  border-radius: var(--tb-radius-s);
  outline: 3px solid transparent;
  outline-offset: 2px;
  transition:
    opacity var(--tb-t-fast) var(--tb-ease),
    transform var(--tb-t-fast) var(--tb-ease),
    outline-color var(--tb-t-fast) var(--tb-ease);
}
.pair__opt.is-press {
  transform: scale(0.97);
}
.pair__opt.is-picked {
  outline-color: var(--tb-orange);
}
.pair__opt.is-busy {
  opacity: 0.4;
}
.pair__bitmap {
  position: relative;
  width: 100%;
  padding-top: 100%;
}
/* a lit OLED pixel: white in both themes, like tb-face */
.pair__cell {
  position: absolute;
  background: var(--tb-face-lit, white);
}
.pair__lock {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 18px;
  padding: 16px 0;
  border-top: 1px solid var(--tb-rule);
  border-bottom: 1px solid var(--tb-rule);
}
.pair__count {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 72px;
  line-height: 1;
  color: var(--tb-alarm);
}
.pair__locktext {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--tb-ink-2);
  font-size: 14px;
}
.pair__unit {
  font-weight: 600;
  color: var(--tb-ink);
}
.pair__msg {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  color: var(--tb-danger);
  font-size: 14px;
}
.pair__msg > text {
  flex: 1;
  min-width: 0;
}
</style>
