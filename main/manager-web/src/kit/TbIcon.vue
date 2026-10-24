<template>
  <svg class="tb-icon" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    :stroke-width="stroke" stroke-linecap="round" stroke-linejoin="round" :aria-hidden="label ? null : 'true'"
    :role="label ? 'img' : null" :aria-label="label || null" focusable="false">
    <path :d="path" />
  </svg>
</template>

<script setup>
import { computed } from 'vue';
import { ICONS } from './icons';

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
  stroke: { type: [Number, String], default: 1.75 },
  label: { type: String, default: '' },
});
const path = computed(() => ICONS[props.name] || ICONS.dot);
</script>

<style>
.tb-icon { flex: none; display: inline-block; vertical-align: middle; }
</style>
