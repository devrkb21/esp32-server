<script setup lang="ts">
// TinyBot's name plate: name, what it is doing now, days together, connection state with its word.
withDefaults(defineProps<{ name?: string, doing?: string, detail?: string, state?: string, stateText?: string }>(), {
  name: 'TinyBot', doing: '', detail: '', state: 'online', stateText: '',
})
</script>

<template>
  <view class="tb-plate">
    <text class="tb-plate__name">{{ name }}</text>
    <text v-if="doing" class="tb-plate__doing">{{ doing }}</text>
    <text v-if="detail" class="tb-plate__detail">{{ detail }}</text>
    <view class="tb-plate__state" :class="`is-${state}`"><view class="tb-plate__dot" /><text>{{ stateText }}</text></view>
  </view>
</template>

<style lang="scss">
.tb-plate { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.tb-plate__name { font-family: var(--tb-font-display); font-weight: 700; font-size: 18px; }
.tb-plate__doing { font-size: 14px; }
.tb-plate__detail { font-size: 13px; color: var(--tb-ink-2); }
.tb-plate__state { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 13px; font-weight: 600; }
.tb-plate__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tb-ok); }
.tb-plate__state.is-offline { color: var(--tb-ink-2); }
.tb-plate__state.is-offline .tb-plate__dot { background: transparent; border: 1.5px solid var(--tb-ink-3); }
.tb-plate__state.is-sleeping .tb-plate__dot { background: var(--tb-message); }
.tb-plate__state.is-updating .tb-plate__dot { background: var(--tb-routine-mark); }
</style>
