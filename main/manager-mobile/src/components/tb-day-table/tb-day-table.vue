<script setup lang="ts">
import { computed } from 'vue'
import { minutesOf, timeText } from '@/utils/calendar.mjs'

// The day as an almanac table. rows: [{ key, time 'HH:MM', title, note, ink, stateText, sync }];
// the orange now rule sits at `nowMinutes` between the rows before and after it.
const props = withDefaults(defineProps<{ rows?: any[], lang?: string, nowMinutes?: number, nowLabel?: string, emptyText?: string, clickable?: boolean }>(), {
  rows: () => [], lang: 'bn', nowMinutes: -1, nowLabel: 'Now', emptyText: '', clickable: false,
})
const emit = defineEmits<{ (e: 'select', row: any): void }>()
const list = computed(() => {
  const twelve = props.lang === 'bn'
  const sorted: any[] = [...props.rows].sort((a, b) => minutesOf(a.time) - minutesOf(b.time))
    .map(r => ({ ...r, timeText: timeText(r.time, props.lang, twelve), past: props.nowMinutes >= 0 && minutesOf(r.time) < props.nowMinutes }))
  if (props.nowMinutes < 0)
    return sorted
  const at = sorted.findIndex(r => minutesOf(r.time) > props.nowMinutes)
  const now = { now: true, key: '__now', timeText: timeText(`${Math.floor(props.nowMinutes / 60)}:${props.nowMinutes % 60}`, props.lang, twelve) }
  if (at < 0)
    sorted.push(now)
  else sorted.splice(at, 0, now)
  return sorted
})
</script>

<template>
  <view class="tb-day">
    <block v-for="r in list" :key="r.key">
      <view v-if="r.now" class="tb-day__now">
        <text class="tb-day__t">{{ r.timeText }}</text><text class="tb-day__nowlabel">{{ nowLabel }}</text>
      </view>
      <view v-else class="tb-day__row" :class="[`ink-${r.ink || 'ink'}`, { 'is-past': r.past, 'is-pending': r.sync === 'pending', 'is-off': r.sync === 'off' }]"
        :hover-class="clickable ? 'is-press' : 'none'" @click="clickable && emit('select', r)">
        <text class="tb-day__t">{{ r.timeText }}</text>
        <view class="tb-day__k" />
        <view class="tb-day__x"><text>{{ r.title }}</text><text v-if="r.note" class="tb-day__note">{{ r.note }}</text></view>
        <text class="tb-day__s">{{ r.stateText }}</text>
      </view>
    </block>
    <text v-if="!rows.length" class="tb-day__empty">{{ emptyText }}</text>
  </view>
</template>

<style lang="scss">
.tb-day { display: flex; flex-direction: column; }
.tb-day__row { --ink: var(--tb-ink); display: flex; align-items: baseline; gap: 10px; padding: 10px 0; border-top: 1px solid var(--tb-rule); }
.tb-day__row.is-press { background: var(--tb-paper-2); }
.tb-day__t { width: 64px; flex: none; font-family: var(--tb-font-display); font-weight: 700; font-size: 16px; }
.tb-day__k { width: 8px; height: 8px; flex: none; background: var(--ink); transform: translateY(-1px); }
.tb-day__x { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 15px; }
.tb-day__note { font-size: 13px; color: var(--tb-ink-2); }
.tb-day__s { font-size: 12px; color: var(--tb-ink-2); text-align: right; flex: none; max-width: 30%; }
.tb-day__row.ink-prayer { --ink: var(--tb-prayer); color: var(--tb-prayer); }
.tb-day__row.ink-prayer .tb-day__s { color: var(--tb-ink-2); }
.tb-day__row.ink-alarm { --ink: var(--tb-alarm); }
.tb-day__row.ink-alarm .tb-day__t { color: var(--tb-alarm); }
.tb-day__row.ink-routine { --ink: var(--tb-routine-mark); }
.tb-day__row.ink-message { --ink: var(--tb-message); }
.tb-day__row.ink-look { --ink: var(--tb-look); }
.tb-day__row.is-past .tb-day__t, .tb-day__row.is-past .tb-day__x { opacity: .62; }
.tb-day__row.is-pending { border-top-style: dashed; }
.tb-day__row.is-off .tb-day__x { text-decoration: line-through; color: var(--tb-ink-3); }
.tb-day__now { display: flex; align-items: center; gap: 10px; padding: 4px 0; border-top: 2px solid var(--tb-orange); }
.tb-day__now .tb-day__t { color: var(--tb-action); font-size: 13px; }
.tb-day__nowlabel { font-size: 12px; font-weight: 600; color: var(--tb-action); }
.tb-day__empty { color: var(--tb-ink-2); padding: 16px 0; border-top: 1px solid var(--tb-rule); }
</style>
