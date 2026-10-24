<script setup lang="ts">
import { computed } from 'vue'
import { banglaMonthText, gregorianMonthText, hijriText } from '@/utils/calendar.mjs'

// The almanac's month band: Bangla month and year, then the Gregorian month and the hijri date.
const props = withDefaults(defineProps<{ date: Date, lang?: string, sticky?: boolean }>(), { lang: 'bn', sticky: false })
const main = computed(() => (props.lang === 'bn' ? banglaMonthText(props.date, 'bn') : gregorianMonthText(props.date, props.lang)))
const aside = computed(() => [
  props.lang === 'bn' ? gregorianMonthText(props.date, 'bn') : banglaMonthText(props.date, props.lang),
  hijriText(props.date, props.lang),
].filter(Boolean).join(' · '))
</script>

<template>
  <view class="tb-band" :class="{ 'is-sticky': sticky }">
    <text class="tb-band__main">{{ main }}</text>
    <text class="tb-band__aside">{{ aside }}</text>
  </view>
</template>

<style lang="scss">
.tb-band { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 7px 0 8px;
  border-top: 3px solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule); background: var(--tb-paper); }
.tb-band.is-sticky { position: sticky; top: 0; z-index: 5; }
.tb-band__main { font-family: var(--tb-font-display); font-weight: 700; font-size: 17px; }
.tb-band__aside { color: var(--tb-ink-2); font-size: 12.5px; }
</style>
