<script setup lang="ts">
import { computed } from 'vue'
import { ICONS } from '@/utils/tbIcons.mjs'

// The app's one icon family (same paths as manager-web/src/kit/icons.js), drawn as a CSS mask so
// it takes the text colour (currentColor) on every platform without inline SVG.
const props = withDefaults(defineProps<{ name: string, size?: number, stroke?: number, label?: string }>(), {
  size: 20,
  stroke: 1.75,
  label: '',
})
const url = computed(() => {
  const d = (ICONS as Record<string, string>)[props.name] || (ICONS as Record<string, string>).dot
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='${props.stroke}' stroke-linecap='round' stroke-linejoin='round'><path d='${d}'/></svg>`
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
})
</script>

<template>
  <view class="tb-icon" :style="{ width: `${size}px`, height: `${size}px`, maskImage: url, WebkitMaskImage: url }"
    :aria-label="label || undefined" :aria-hidden="label ? undefined : 'true'" :role="label ? 'img' : undefined" />
</template>

<style lang="scss">
.tb-icon {
  display: inline-block; flex: none; vertical-align: middle; background-color: currentColor;
  mask-repeat: no-repeat; mask-size: 100% 100%; -webkit-mask-repeat: no-repeat; -webkit-mask-size: 100% 100%;
}
</style>
