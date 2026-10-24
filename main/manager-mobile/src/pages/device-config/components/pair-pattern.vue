<script setup lang="ts">
// Pairing step of the hotspot setup: TinyBot shows a pattern on its face, the person taps the same
// one of the four here. Emits `paired` with the token /submit needs ('' when this robot has no
// pairing step). Kept plain on purpose: the screen around it owns the look.
import type { PairOption, PairState } from '../utils/hotspotClient'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '@/i18n'
import { answerPairing, fetchPairState } from '../utils/hotspotClient'
import { litCells, PATTERN_SIZE } from '../utils/pairingUtils.mjs'

const emit = defineEmits<{
  (e: 'paired', token: string): void
}>()

const loading = ref(true)
const sending = ref(false)
const options = ref<PairOption[]>([])
const lockedSeconds = ref(0)
const message = ref('')

let lockTimer: ReturnType<typeof setInterval> | null = null

/** Translate with an English fallback until the key is in every locale */
function tx(key: string, fallback: string) {
  const text = t(key)
  return text === key ? fallback : text
}

function cellStyle(cell: number[]) {
  const size = 100 / PATTERN_SIZE
  return { left: `${cell[0] * size}%`, top: `${cell[1] * size}%`, width: `${size}%`, height: `${size}%` }
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
  try {
    const state = await answerPairing(option.id)
    if (!state.success && state.lockedMs === 0 && state.options.length)
      message.value = tx('deviceConfig.pairWrong', `Not that one. TinyBot shows a new pattern: pick again (${state.attemptsLeft} left).`)
    apply(state)
  }
  catch {
    message.value = t('deviceConfig.connectXiaozhiHotspot')
  }
  finally {
    sending.value = false
  }
}

onMounted(load)
onBeforeUnmount(stopLockTimer)

defineExpose({ reload: load })
</script>

<template>
  <view class="pair">
    <view class="pair__title">
      {{ tx('deviceConfig.pairTitle', 'Which pattern is on TinyBot’s face?') }}
    </view>

    <view v-if="loading && !options.length" class="pair__text">
      {{ tx('deviceConfig.pairLoading', 'Asking TinyBot for a pattern…') }}
    </view>
    <view v-else-if="lockedSeconds > 0" class="pair__text" role="status">
      {{ tx('deviceConfig.pairLocked', `Too many wrong picks. Try again in ${lockedSeconds} s.`) }}
    </view>
    <view v-else class="pair__grid">
      <view
        v-for="option in options"
        :key="option.id"
        class="pair__option"
        :class="{ 'is-busy': sending }"
        role="button"
        :aria-label="option.name"
        @click="pick(option)"
      >
        <view class="pair__bitmap">
          <view
            v-for="(cell, index) in litCells(option.rows)"
            :key="index"
            class="pair__cell"
            :style="cellStyle(cell)"
          />
        </view>
      </view>
    </view>

    <view v-if="message" class="pair__text pair__text--warn" role="alert">
      {{ message }}
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pair {
  &__title {
    margin-bottom: 16rpx;
    font-weight: 600;
  }

  &__text {
    margin: 12rpx 0;
    font-size: 26rpx;
    line-height: 1.45;

    &--warn {
      color: #b45309;
    }
  }

  &__grid {
    display: flex;
    gap: 16rpx;
  }

  &__option {
    flex: 1;
    padding: 12rpx;
    border: 2rpx solid #94a3b8;
    border-radius: 12rpx;
    background: #000;

    &.is-busy {
      opacity: 0.5;
    }
  }

  &__bitmap {
    position: relative;
    width: 100%;
    padding-top: 100%;
  }

  &__cell {
    position: absolute;
    background: #fff;
  }
}
</style>
