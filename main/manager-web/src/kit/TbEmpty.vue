<template>
  <div class="tb-empty">
    <TbFace v-if="face" :mood="face" :width="96" />
    <p v-if="title" class="tb-empty__title">{{ title }}</p>
    <p v-if="text" class="tb-empty__text">{{ text }}</p>
    <div v-if="$slots.default" class="tb-empty__act"><slot /></div>
  </div>
</template>

<script setup>
import TbFace from './TbFace.vue';

// Empty and error states. `face`: a mood of TinyBot's own face (awake, sleepy, confused, happy).
defineProps({
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  face: { type: String, default: '' },
});
</script>

<style>
.tb-empty { display: grid; justify-items: center; gap: 8px; text-align: center; padding: var(--tb-s6) var(--tb-s4); max-width: 46ch; margin: 0 auto; }
.tb-empty__title { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-18); }
.tb-empty__text { color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.tb-empty__act { margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
</style>
