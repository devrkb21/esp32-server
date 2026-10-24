<script lang="ts" setup>
import { computed, ref } from 'vue'
import { t } from '@/i18n'

defineOptions({
  name: 'CompanionMinutesChips',
})

const props = defineProps<{
  modelValue: number
  /** Preset minutes; 0 is shown with zeroLabel */
  presets: number[]
  max: number
  zeroLabel: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

/** Switched to "Custom" by hand: keeps the number input open even on a preset value */
const customPicked = ref(false)
const isCustom = computed(() => customPicked.value || !props.presets.includes(props.modelValue))

function label(n: number) {
  return n === 0 ? props.zeroLabel : t('companion.minutesShort', { n })
}

function pick(n: number) {
  if (props.disabled)
    return
  customPicked.value = false
  emit('update:modelValue', n)
}

function pickCustom() {
  if (!props.disabled)
    customPicked.value = true
}

function onNumber({ value }: { value: number | string }) {
  const n = Math.round(Number(value))
  if (Number.isFinite(n))
    emit('update:modelValue', Math.min(props.max, Math.max(0, n)))
}

/** Close the number input again (after a revert) */
function reset() {
  customPicked.value = false
}

defineExpose({ reset })
</script>

<template>
  <view class="minutes" :class="{ 'is-disabled': disabled }">
    <view class="minutes__chips" role="radiogroup">
      <view
        v-for="n in presets"
        :key="n"
        class="minutes__chip"
        :class="{ 'is-on': !isCustom && modelValue === n }"
        role="radio"
        :aria-checked="!isCustom && modelValue === n"
        @click="pick(n)"
      >
        {{ label(n) }}
      </view>
      <view
        class="minutes__chip"
        :class="{ 'is-on': isCustom }"
        role="radio"
        :aria-checked="isCustom"
        @click="pickCustom"
      >
        {{ t('companion.minutesCustom') }}
      </view>
    </view>
    <view v-if="isCustom" class="minutes__custom">
      <view class="minutes__custom-label">
        {{ t('companion.minutesRange', { max }) }}
      </view>
      <wd-input-number
        :model-value="modelValue"
        :min="0"
        :max="max"
        :step="5"
        :precision="0"
        input-width="60"
        :disabled="disabled"
        @change="onNumber"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.minutes {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);

  &.is-disabled {
    opacity: 0.5;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nx-space-1);
  }

  &__chip {
    display: flex;
    align-items: center;
    min-height: 56rpx;
    padding: 0 var(--nx-space-3);
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-footnote);
    font-weight: 500;
    transition: transform var(--nx-dur-1) var(--nx-ease);

    &:active {
      transform: scale(0.96);
    }

    &.is-on {
      background: var(--nx-accent-soft);
      color: var(--nx-accent);
    }
  }

  &__custom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-2);
  }

  &__custom-label {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .minutes__chip {
    transition: none;
  }
}
</style>
