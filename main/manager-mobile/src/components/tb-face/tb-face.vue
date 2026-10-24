<script setup lang="ts">
import { computed } from 'vue'

// TinyBot's OLED in its black window: the live screen image when `src` is given, otherwise the
// face for a mood (awake, sleepy, night, offline, confused, happy). Same faces as the web kit.
const props = withDefaults(defineProps<{ src?: string, mood?: string, width?: number, alt?: string, pulse?: boolean }>(), {
  src: '', mood: 'awake', width: 0, alt: 'TinyBot', pulse: false,
})
const FACES: Record<string, string> = {
  awake: '<rect x="30" y="14" width="22" height="26" rx="7" fill="#fff"/><rect x="76" y="14" width="22" height="26" rx="7" fill="#fff"/><rect x="38" y="24" width="7" height="9" fill="#000"/><rect x="84" y="24" width="7" height="9" fill="#000"/><rect x="58" y="46" width="12" height="3" fill="#fff"/>',
  sleepy: '<rect x="30" y="30" width="22" height="3" fill="#fff"/><rect x="76" y="30" width="22" height="3" fill="#fff"/><rect x="58" y="46" width="12" height="2" fill="#fff"/><rect x="104" y="10" width="8" height="2" fill="#fff"/><rect x="110" y="12" width="2" height="2" fill="#fff"/><rect x="104" y="14" width="8" height="2" fill="#fff"/>',
  confused: '<rect x="30" y="16" width="22" height="22" rx="6" fill="#fff"/><rect x="76" y="22" width="22" height="16" rx="5" fill="#fff"/><rect x="37" y="23" width="7" height="8" fill="#000"/><rect x="83" y="27" width="7" height="6" fill="#000"/><rect x="56" y="48" width="4" height="2" fill="#fff"/><rect x="60" y="46" width="4" height="2" fill="#fff"/><rect x="64" y="48" width="4" height="2" fill="#fff"/><rect x="68" y="46" width="4" height="2" fill="#fff"/>',
  happy: '<rect x="30" y="20" width="22" height="6" fill="#fff"/><rect x="34" y="16" width="14" height="4" fill="#fff"/><rect x="76" y="20" width="22" height="6" fill="#fff"/><rect x="80" y="16" width="14" height="4" fill="#fff"/><rect x="56" y="40" width="16" height="3" fill="#fff"/><rect x="54" y="38" width="3" height="3" fill="#fff"/><rect x="71" y="38" width="3" height="3" fill="#fff"/>',
}
const face = computed(() => {
  const body = FACES[{ night: 'sleepy', offline: 'confused' }[props.mood] || props.mood] || FACES.awake
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 64' shape-rendering='crispEdges'>${body}</svg>`)}`
})
</script>

<template>
  <view class="tb-face" :class="{ 'is-off': mood === 'offline', 'is-pulse': pulse }" :style="width ? { width: `${width}px` } : undefined">
    <image class="tb-face__img" :src="src || face" mode="aspectFit" :aria-label="alt" />
  </view>
</template>

<style lang="scss">
.tb-face { background: var(--tb-face); border-radius: var(--tb-radius-s); padding: 6%; aspect-ratio: 2 / 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.tb-face__img { width: 100%; height: 100%; image-rendering: pixelated; }
.tb-face.is-off { opacity: .55; }
.tb-face.is-pulse { animation: tb-face-pulse 200ms var(--tb-ease); }
@keyframes tb-face-pulse { 50% { box-shadow: 0 0 0 4px var(--tb-orange); } }
</style>
