<script setup lang="ts">
// A small label in one ink (prayer | alarm | routine | message | look | ok | warn | danger | ink-2).
withDefaults(defineProps<{ ink?: string, variant?: 'line' | 'solid', mark?: boolean }>(), { ink: '', variant: 'line', mark: false })
</script>

<template>
  <text class="tb-tag" :class="`tb-tag--${variant}`" :style="ink ? { '--ink': `var(--tb-${ink})` } : undefined">
    <text v-if="mark" class="tb-tag__mark" /><slot />
  </text>
</template>

<style lang="scss">
.tb-tag { --ink: var(--tb-ink-2); display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border: 1px solid var(--ink);
  border-radius: 999px; color: var(--ink); font-size: 12px; font-weight: 600; white-space: nowrap; line-height: 1; }
.tb-tag--solid { background: var(--ink); color: var(--tb-paper); }
.tb-tag__mark { display: inline-block; flex: none; width: 7px; height: 7px; margin-right: 6px; background: var(--ink); }
.tb-tag--solid .tb-tag__mark { background: var(--tb-paper); }
</style>
