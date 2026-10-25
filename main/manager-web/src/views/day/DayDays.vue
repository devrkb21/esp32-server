<template>
  <div class="day-days">
    <div class="day-days__week" role="group" :aria-label="label">
      <button v-for="d in WEEK" :key="d" type="button" class="day-days__day" :class="{ 'is-on': hasDay(modelValue, d), 'is-fri': d === 5 }"
        :aria-pressed="hasDay(modelValue, d) ? 'true' : 'false'" @click="$emit('update:modelValue', toggleDay(modelValue, d))">
        {{ $t(`day.weekday.${d}`) }}
      </button>
    </div>
    <div class="day-days__presets">
      <TbChoice wrap :model-value="presetValue" :options="presetOptions" :aria-label="$t('day.days.presets')"
        @change="(m) => $emit('update:modelValue', m)" />
    </div>
    <p class="day-days__text">{{ daysText(modelValue) }}</p>
  </div>
</template>

<script>
import { DAY_PRESETS, hasDay, toggleDay } from '@/utils/companion.mjs';
import { daysText } from './dayText';

// Weekday pills for a days bitmask (bit 0 = Sunday ... bit 6 = Saturday) and the presets.
export default {
  name: 'DayDays',
  props: { modelValue: { type: Number, default: 127 }, label: { type: String, default: '' } },
  emits: ['update:modelValue'],
  data() { return { WEEK: [0, 1, 2, 3, 4, 5, 6] }; },
  computed: {
    presetOptions() { return DAY_PRESETS.map((p) => ({ value: p.mask, label: this.$t(`day.preset.${p.key}`) })); },
    presetValue() { const p = DAY_PRESETS.find((x) => x.mask === this.modelValue); return p ? p.mask : undefined; },
  },
  methods: {
    hasDay,
    toggleDay,
    daysText(mask) { return daysText(mask, (k) => this.$t(k)); },
  },
};
</script>

<style>
.day-days { display: grid; gap: 10px; }
.day-days__week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.day-days__day {
  min-height: 44px; padding: 0 2px; border: 1.5px solid var(--tb-rule-soft); border-radius: var(--tb-radius-pill);
  background: var(--tb-paper); color: var(--tb-ink-2); font-weight: 600; font-size: var(--tb-fs-13); white-space: nowrap;
  transition: background-color var(--tb-t-hover) var(--tb-ease), color var(--tb-t-hover) var(--tb-ease), border-color var(--tb-t-hover) var(--tb-ease);
}
.day-days__day:hover { border-color: var(--tb-ink); color: var(--tb-ink); }
.day-days__day.is-on { background: var(--tb-ink); border-color: var(--tb-ink); color: var(--tb-paper); }
.day-days__day.is-fri:not(.is-on) { color: var(--tb-alarm); }
.day-days__text { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
</style>
