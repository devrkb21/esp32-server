<script setup lang="ts">
// A ruled block of a page. `ink` marks the area (prayer, alarm, routine, message, look).
// `level` is the heading level exposed to screen readers (the page header is level 1).
withDefaults(defineProps<{ title: string, description?: string, ink?: string, level?: number }>(), { description: '', ink: '', level: 2 })
</script>

<template>
  <view class="tb-section" :style="ink ? { '--ink': `var(--tb-${ink})` } : undefined">
    <view class="tb-section__head">
      <view class="tb-section__titles">
        <view class="tb-section__title" role="heading" :aria-level="level"><view v-if="ink" class="tb-section__mark" /><text>{{ title }}</text></view>
        <text v-if="description" class="tb-section__desc">{{ description }}</text>
      </view>
      <view v-if="$slots.actions" class="tb-section__actions"><slot name="actions" /></view>
    </view>
    <view class="tb-section__body"><slot /></view>
  </view>
</template>

<style lang="scss">
.tb-section { --ink: var(--tb-ink); padding: 18px 0 22px; border-bottom: 1px solid var(--tb-rule); }
.tb-section__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.tb-section__titles { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.tb-section__title { display: flex; align-items: center; gap: 8px; font-family: var(--tb-font-display); font-weight: 700; font-size: 19px; }
.tb-section__mark { flex: none; width: 9px; height: 9px; background: var(--ink); }
.tb-section__desc { color: var(--tb-ink-2); font-size: 14px; }
.tb-section__actions { display: flex; gap: 8px; flex: none; }
.tb-section__body { display: flex; flex-direction: column; gap: 14px; }
</style>
