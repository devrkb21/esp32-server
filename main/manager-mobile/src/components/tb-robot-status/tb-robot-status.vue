<script setup lang="ts">
// The robot's connection, said the same way on every screen (rules: src/utils/robotConnection.mjs).
// compact: the mark and the word (rows, headers). Otherwise a calm ruled panel with the word, what
// it means, when the robot was last seen, the next step and "check again". While the robot is
// joining the server it checks again by itself every 15 s (only while the page is visible).
import { computed, onBeforeUnmount, watch } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { shouldPoll, statusInk, statusKeys } from '@/utils/robotConnection.mjs'

const props = withDefaults(defineProps<{
  status?: { state: string, lastSeen?: number | null, lastSync?: number | null, reason?: string } | null
  compact?: boolean
  loading?: boolean
  hideOnline?: boolean
}>(), { status: null, compact: false, loading: false, hideOnline: false })
const emit = defineEmits<{ (e: 'refresh'): void }>()

const AUTO_S = 15
const state = computed(() => (props.status && props.status.state) || 'checking')
const keys = computed(() => statusKeys(state.value, props.status && props.status.reason))
const ink = computed(() => statusInk(state.value))
const lang = computed(() => getCurrentLanguage())
const num = (n: number) => digits(n, lang.value)

const when = computed(() => {
  // offline: the last time either server saw it; not syncing: its last sync with the companion server
  const st = props.status || { state: 'checking' }
  const at = state.value === 'not_syncing' ? st.lastSync || st.lastSeen : st.lastSeen
  if (!at)
    return ''
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (s < 60)
    return t('companion.justNow')
  if (s < 3600)
    return t('companion.minutesAgo', { n: num(Math.floor(s / 60)) })
  if (s < 86400)
    return t('companion.hoursAgo', { n: num(Math.floor(s / 3600)) })
  return t('companion.daysAgo', { n: num(Math.floor(s / 86400)) })
})
const seenLine = computed(() => {
  if (!when.value)
    return ''
  if (state.value === 'offline')
    return t('status.lastSeen', { when: when.value })
  if (state.value === 'not_syncing')
    return t('status.lastSync', { when: when.value })
  return ''
})
const polling = computed(() => shouldPoll(state.value))

let timer: any = null
function visible() {
  return typeof document === 'undefined' || !document.hidden
}
function stop() {
  if (timer)
    clearInterval(timer)
  timer = null
}
watch(polling, (on) => {
  stop()
  if (on) {
    timer = setInterval(() => {
      if (visible() && !props.loading)
        emit('refresh')
    }, AUTO_S * 1000)
  }
}, { immediate: true })
onBeforeUnmount(stop)
</script>

<template>
  <view v-if="compact" class="tb-rstat is-compact" :class="[`is-${state}`, `ink-${ink}`]" role="status">
    <view class="tb-rstat__dot" /><text>{{ t(keys.label) }}</text>
  </view>
  <view v-else-if="!(hideOnline && state === 'online')" class="tb-rstat" :class="[`is-${state}`, `ink-${ink}`]" role="status" aria-live="polite">
    <view class="tb-rstat__head">
      <view class="tb-rstat__dot" />
      <text class="tb-rstat__label">
        {{ t(keys.label) }}
      </text>
      <text v-if="seenLine" class="tb-rstat__seen">
        {{ seenLine }}
      </text>
    </view>
    <text class="tb-rstat__why">
      {{ t(keys.why) }}
    </text>
    <text v-if="state !== 'online'" class="tb-rstat__next">
      {{ t(keys.next) }}
    </text>
    <view v-if="state !== 'online'" class="tb-rstat__foot">
      <tb-button size="s" icon="refresh" :loading="loading" @click="emit('refresh')">
        {{ t('status.refresh') }}
      </tb-button>
      <text v-if="polling" class="tb-rstat__auto">
        {{ t('status.auto', { n: num(AUTO_S) }) }}
      </text>
    </view>
  </view>
</template>

<style lang="scss">
.tb-rstat {
  --mark: var(--tb-ink-2);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0 16px;
  border-bottom: 1px solid var(--tb-rule);
}
.tb-rstat.ink-ok {
  --mark: var(--tb-ok);
}
.tb-rstat.ink-warn {
  --mark: var(--tb-warn);
}
.tb-rstat.ink-danger {
  --mark: var(--tb-danger);
}
.tb-rstat__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.tb-rstat__dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--mark);
}
.tb-rstat.is-offline .tb-rstat__dot,
.tb-rstat.is-checking .tb-rstat__dot {
  background: transparent;
  border: 1.5px solid var(--tb-ink-3);
}
.tb-rstat__label {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 18px;
  line-height: 1.3;
}
.tb-rstat__seen {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.tb-rstat__why {
  font-size: 15px;
  line-height: 1.55;
}
.tb-rstat__next {
  font-size: 14px;
  line-height: 1.55;
  color: var(--tb-ink-2);
}
.tb-rstat__foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding-top: 6px;
}
.tb-rstat__auto {
  font-size: 12px;
  color: var(--tb-ink-2);
}

.tb-rstat.is-compact {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink);
}
.tb-rstat.is-compact .tb-rstat__dot {
  width: 8px;
  height: 8px;
}
.tb-rstat.is-compact.ink-ok {
  color: var(--tb-ok);
}
.tb-rstat.is-compact.ink-ink-2 {
  color: var(--tb-ink-2);
}
.tb-rstat.is-compact.ink-danger {
  color: var(--tb-danger);
}
</style>
