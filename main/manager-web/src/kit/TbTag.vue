<template>
  <span class="tb-tag" :class="[`tb-tag--${variant}`]" :style="ink ? { '--ink': `var(--tb-${ink})` } : null">
    <i v-if="mark" class="tb-tag__mark" aria-hidden="true"></i><slot />
  </span>
</template>

<script setup>
// A small label in one ink. ink: prayer | alarm | routine | message | look | ok | warn | danger |
// ink-2. variant: line (outline, default) | solid. `mark` adds the area's square ink mark.
defineProps({
  ink: { type: String, default: '' },
  variant: { type: String, default: 'line' },
  mark: Boolean,
});
</script>

<style>
.tb-tag {
  --ink: var(--tb-ink-2);
  display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px;
  border: 1px solid var(--ink); border-radius: 999px; color: var(--ink);
  font-size: var(--tb-fs-12); font-weight: 600; white-space: nowrap; line-height: 1;
}
.tb-tag--solid { background: var(--ink); color: var(--tb-paper); }
.tb-tag__mark { width: 7px; height: 7px; background: var(--ink); }
.tb-tag--solid .tb-tag__mark { background: var(--tb-paper); }
</style>
