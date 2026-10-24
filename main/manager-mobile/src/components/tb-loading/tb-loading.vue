<script setup lang="ts">
// Three short ink rules filling in turn: a request is open.
withDefaults(defineProps<{ label?: string }>(), { label: '' })
</script>

<template>
  <view class="tb-loading" role="status" :aria-label="label || undefined">
    <view class="tb-loading__b" /><view class="tb-loading__b" /><view class="tb-loading__b" />
    <text v-if="label" class="tb-loading__label">{{ label }}</text>
  </view>
</template>

<style lang="scss">
.tb-loading { display: inline-flex; align-items: center; gap: 4px; color: var(--tb-ink-2); }
.tb-loading__b { width: 14px; height: 3px; background: currentColor; opacity: .25; animation: tb-load 900ms var(--tb-ease) infinite; }
.tb-loading__b:nth-child(2) { animation-delay: 150ms; }
.tb-loading__b:nth-child(3) { animation-delay: 300ms; }
.tb-loading__label { margin-left: 8px; font-size: 13px; }
@keyframes tb-load { 0%, 100% { opacity: .25; } 40% { opacity: 1; } }
</style>
