<template>
  <div class="tb-maker" :class="`tb-maker--${align}`" :style="{ '--tb-maker-w': `${width}px` }">
    <img class="tb-maker__img tb-maker__img--light" :src="`${base}brand/nobix-lockup.png`" alt="Nobix Industries"
      :width="width" :height="height" decoding="async" />
    <img class="tb-maker__img tb-maker__img--dark" :src="`${base}brand/nobix-lockup-dark.png`" alt="Nobix Industries"
      :width="width" :height="height" decoding="async" />
  </div>
</template>

<script setup>
import { computed } from 'vue';

// The "made by" lockup: Nobix Industries' official logo (the maker), never recoloured, stretched
// or cropped. TinyBot's orange mark stays the product's own brand; this is only the maker's credit.
// The light file sits on the light paper, the dark file (white wordmark) under the dark theme.
const props = defineProps({
  width: { type: Number, default: 120 },
  align: { type: String, default: 'center' }, // center | start
});
const RATIO = 146 / 640; // the lockup files are 640 x 146
const height = computed(() => Math.round(props.width * RATIO));
const base = import.meta.env.BASE_URL || '/';
</script>

<style>
.tb-maker { display: flex; margin: 0; }
.tb-maker--center { justify-content: center; }
.tb-maker--start { justify-content: flex-start; }
.tb-maker__img { display: block; width: var(--tb-maker-w); max-width: 100%; height: auto; }
.tb-maker__img--dark { display: none; }
:root[data-theme="dark"] .tb-maker__img--light { display: none; }
:root[data-theme="dark"] .tb-maker__img--dark { display: block; }
</style>
