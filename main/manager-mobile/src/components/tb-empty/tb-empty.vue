<script setup lang="ts">
// Empty and error states, optionally with TinyBot's face in a mood (awake, sleepy, confused, happy).
withDefaults(defineProps<{ title?: string, text?: string, face?: string }>(), { title: '', text: '', face: '' })
</script>

<template>
  <view class="tb-empty">
    <tb-face v-if="face" :mood="face" :width="96" />
    <text v-if="title" class="tb-empty__title">{{ title }}</text>
    <text v-if="text" class="tb-empty__text">{{ text }}</text>
    <view v-if="$slots.default" class="tb-empty__act"><slot /></view>
  </view>
</template>

<style lang="scss">
.tb-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 24px 16px; }
.tb-empty__title { font-family: var(--tb-font-display); font-weight: 700; font-size: 18px; }
.tb-empty__text { color: var(--tb-ink-2); font-size: 14px; max-width: 34ch; }
.tb-empty__act { margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
</style>
