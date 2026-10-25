<script lang="ts" setup>
import { computed } from 'vue'
import { t } from '@/i18n'
import { hasDay, toggleDay } from '../../companion/companionUtils.mjs'
import { DAY_PRESETS, daysText } from '../dayModel.mjs'

// The days a time repeats on: a weekday bitmask (bit 0 = Sunday), with quick picks.
const props = withDefaults(defineProps<{ modelValue?: number }>(), { modelValue: 127 })
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()
const WEEK = [0, 1, 2, 3, 4, 5, 6]
const presets = computed(() => DAY_PRESETS.map(p => ({ value: p.mask, label: t(`day.preset.${p.key}`) })))
const preset = computed(() => (DAY_PRESETS.find(p => p.mask === props.modelValue) ? props.modelValue : undefined))
const summary = computed(() => daysText(props.modelValue, (k: string) => t(k)))
</script>

<template>
  <view class="dweek">
    <view class="dweek__days" role="group" :aria-label="t('day.days.label')">
      <view
        v-for="d in WEEK" :key="d" class="dweek__day" :class="{ 'is-on': hasDay(modelValue, d), 'is-fri': d === 5 }"
        role="checkbox" :aria-checked="hasDay(modelValue, d) ? 'true' : 'false'" @click="emit('update:modelValue', toggleDay(modelValue, d))"
      >
        <text>{{ t(`day.weekday.${d}`) }}</text>
      </view>
    </view>
    <tb-choice wrap :model-value="preset" :options="presets" :aria-label="t('day.days.presets')" @change="(m: number) => emit('update:modelValue', m)" />
    <text class="dweek__text">
      {{ summary }}
    </text>
  </view>
</template>

<style lang="scss">
.dweek {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dweek__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.dweek__day {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 2px;
  border: 1.5px solid var(--tb-rule-soft);
  border-radius: 999px;
  color: var(--tb-ink-2);
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  transition:
    background-color var(--tb-t-hover) var(--tb-ease),
    color var(--tb-t-hover) var(--tb-ease);
}
.dweek__day.is-fri {
  color: var(--tb-alarm);
}
.dweek__day.is-on {
  background: var(--tb-ink);
  border-color: var(--tb-ink);
  color: var(--tb-paper);
}
.dweek__text {
  font-size: 13px;
  color: var(--tb-ink-2);
}
</style>
