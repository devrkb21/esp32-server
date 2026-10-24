<template>
  <figure class="tb-face" :class="{ 'is-pulse': pulse, 'is-off': mood === 'offline' }" :style="{ width: width ? width + 'px' : null }">
    <img v-if="src" class="tb-face__img" :src="src" :alt="alt" width="128" height="64" />
    <svg v-else viewBox="0 0 128 64" shape-rendering="crispEdges" role="img" :aria-label="alt">
      <template v-if="mood === 'sleepy' || mood === 'night'">
        <rect x="30" y="30" width="22" height="3" fill="#fff" /><rect x="76" y="30" width="22" height="3" fill="#fff" />
        <rect x="58" y="46" width="12" height="2" fill="#fff" />
        <rect x="104" y="10" width="8" height="2" fill="#fff" /><rect x="110" y="12" width="2" height="2" fill="#fff" />
        <rect x="104" y="14" width="8" height="2" fill="#fff" />
      </template>
      <template v-else-if="mood === 'offline' || mood === 'confused'">
        <rect x="30" y="16" width="22" height="22" rx="6" fill="#fff" /><rect x="76" y="22" width="22" height="16" rx="5" fill="#fff" />
        <rect x="37" y="23" width="7" height="8" fill="#000" /><rect x="83" y="27" width="7" height="6" fill="#000" />
        <rect x="56" y="48" width="4" height="2" fill="#fff" /><rect x="60" y="46" width="4" height="2" fill="#fff" /><rect x="64" y="48" width="4" height="2" fill="#fff" /><rect x="68" y="46" width="4" height="2" fill="#fff" />
      </template>
      <template v-else-if="mood === 'happy'">
        <rect x="30" y="20" width="22" height="6" fill="#fff" /><rect x="34" y="16" width="14" height="4" fill="#fff" />
        <rect x="76" y="20" width="22" height="6" fill="#fff" /><rect x="80" y="16" width="14" height="4" fill="#fff" />
        <rect x="56" y="40" width="16" height="3" fill="#fff" /><rect x="54" y="38" width="3" height="3" fill="#fff" /><rect x="71" y="38" width="3" height="3" fill="#fff" />
        <rect x="22" y="34" width="8" height="3" fill="#fff" opacity=".6" /><rect x="98" y="34" width="8" height="3" fill="#fff" opacity=".6" />
      </template>
      <template v-else>
        <rect x="30" y="14" width="22" height="26" rx="7" fill="#fff" /><rect x="76" y="14" width="22" height="26" rx="7" fill="#fff" />
        <rect x="38" y="24" width="7" height="9" fill="#000" /><rect x="84" y="24" width="7" height="9" fill="#000" />
        <rect x="58" y="46" width="12" height="3" fill="#fff" />
      </template>
    </svg>
    <figcaption v-if="$slots.default" class="tb-face__cap"><slot /></figcaption>
  </figure>
</template>

<script setup>
// TinyBot's OLED in its black window: the live screen image when one is given (`src`, a data or
// image URL), otherwise the face for a mood (awake, sleepy, night, offline, confused, happy).
// `pulse` plays the one "heard you" pulse after a line is sent.
defineProps({
  src: { type: String, default: '' },
  mood: { type: String, default: 'awake' },
  width: { type: Number, default: 0 },
  alt: { type: String, default: 'TinyBot' },
  pulse: Boolean,
});
</script>

<style>
.tb-face { margin: 0; background: var(--tb-face); border-radius: var(--tb-radius-s); padding: 6%; aspect-ratio: 2 / 1;
  display: grid; place-items: center; overflow: hidden; }
.tb-face svg, .tb-face__img { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.tb-face.is-off { opacity: .55; }
.tb-face.is-pulse { animation: tb-face-pulse 200ms var(--tb-ease); }
@keyframes tb-face-pulse { 50% { box-shadow: 0 0 0 4px var(--tb-orange); } }
.tb-face__cap { display: none; }
</style>
