<template>
  <span class="tb-loading" role="status" :aria-label="label || null">
    <i></i><i></i><i></i>
    <span v-if="label && showLabel" class="tb-loading__label">{{ label }}</span>
  </span>
</template>

<script setup>
// Three short ink rules filling in turn: something is on its way (a real request is open).
defineProps({ label: { type: String, default: '' }, showLabel: Boolean });
</script>

<style>
.tb-loading { display: inline-flex; align-items: center; gap: 4px; color: var(--tb-ink-2); }
.tb-loading i { width: 14px; height: 3px; background: currentColor; opacity: .25; animation: tb-load 900ms var(--tb-ease) infinite; }
.tb-loading i:nth-child(2) { animation-delay: 150ms; }
.tb-loading i:nth-child(3) { animation-delay: 300ms; }
.tb-loading__label { margin-left: 8px; font-size: var(--tb-fs-13); }
@keyframes tb-load { 0%, 100% { opacity: .25; } 40% { opacity: 1; } }
</style>
