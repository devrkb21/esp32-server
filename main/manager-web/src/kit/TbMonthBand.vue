<template>
  <div class="tb-band" :class="{ 'is-sticky': sticky }">
    <b class="tb-band__main">{{ main }}</b>
    <span class="tb-band__aside">{{ aside }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { banglaMonthText, gregorianMonthText, hijriText } from './calendar';

// The almanac's month band: Bangla month and year, then the Gregorian month and the hijri date.
const props = defineProps({
  date: { type: Date, required: true },
  lang: { type: String, default: 'bn' },
  sticky: Boolean,
});
const main = computed(() => (props.lang === 'bn' ? banglaMonthText(props.date, 'bn') : gregorianMonthText(props.date, props.lang)));
const aside = computed(() => [
  props.lang === 'bn' ? gregorianMonthText(props.date, 'bn') : banglaMonthText(props.date, props.lang),
  hijriText(props.date, props.lang),
].filter(Boolean).join(' · '));
</script>

<style>
.tb-band {
  display: flex; align-items: baseline; justify-content: space-between; gap: var(--tb-s3); flex-wrap: wrap;
  padding: 7px 0 8px; border-top: var(--tb-rule-band) solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule);
  background: var(--tb-paper);
}
.tb-band.is-sticky { position: sticky; top: 0; z-index: 5; }
.tb-band__main { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-18); }
.tb-band__aside { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
</style>
