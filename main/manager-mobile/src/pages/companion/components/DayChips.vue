<script lang="ts" setup>
import { t } from '@/i18n'
import { DAY_KEYS, EVERY_DAY, FRI_SAT, hasDay, SUN_TO_THU, toggleDay } from '../companionUtils.mjs'

defineOptions({
  name: 'CompanionDayChips',
})

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const presets = [
  { key: 'everyDay', mask: EVERY_DAY },
  { key: 'sunToThu', mask: SUN_TO_THU },
  { key: 'friSat', mask: FRI_SAT },
]

function flip(bit: number) {
  emit('update:modelValue', toggleDay(props.modelValue, bit))
}
</script>

<template>
  <view class="days">
    <view class="days__week" role="group">
      <view
        v-for="(key, bit) in DAY_KEYS"
        :key="key"
        class="days__day"
        :class="{ 'is-on': hasDay(modelValue, bit) }"
        role="checkbox"
        :aria-checked="hasDay(modelValue, bit)"
        :aria-label="t(`companion.day.${key}`)"
        @click="flip(bit)"
      >
        {{ t(`companion.day.${key}`) }}
      </view>
    </view>
    <view class="days__presets">
      <view
        v-for="p in presets"
        :key="p.key"
        class="days__preset"
        :class="{ 'is-on': modelValue === p.mask }"
        role="button"
        @click="emit('update:modelValue', p.mask)"
      >
        {{ t(`companion.days.${p.key}`) }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.days {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);

  &__week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: var(--nx-space-1);
  }

  &__day {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    min-height: 72rpx;
    border-radius: 50%;
    background: var(--nx-surface);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    font-weight: 600;
    overflow: hidden;
    white-space: nowrap;
    transition:
      background-color var(--nx-dur-1) var(--nx-ease),
      color var(--nx-dur-1) var(--nx-ease),
      transform var(--nx-dur-1) var(--nx-ease);

    &:active {
      transform: scale(0.94);
    }

    &.is-on {
      background: var(--nx-accent);
      color: var(--nx-on-accent);
    }
  }

  &__presets {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nx-space-1);
  }

  &__preset {
    display: flex;
    align-items: center;
    min-height: 56rpx;
    padding: 0 var(--nx-space-3);
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface);
    color: var(--nx-text-2);
    font-size: var(--nx-text-footnote);
    font-weight: 500;

    &.is-on {
      background: var(--nx-accent-soft);
      color: var(--nx-accent);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .days__day {
    transition: none;
  }
}
</style>
