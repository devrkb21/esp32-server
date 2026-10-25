<script lang="ts" setup>
import { computed } from 'vue'
import { getCurrentLanguage } from '@/i18n'
import { timeText } from '@/utils/calendar.mjs'

// A 24h "HH:MM" time, chosen with uni's own time picker and shown in the reader's numerals.
const props = withDefaults(defineProps<{ modelValue?: string, disabled?: boolean, big?: boolean, ariaLabel?: string }>(), {
  modelValue: '',
  disabled: false,
  big: false,
  ariaLabel: '',
})
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void, (e: 'change', v: string): void }>()
const lang = computed(() => getCurrentLanguage())
const shown = computed(() => (props.modelValue ? timeText(props.modelValue, lang.value, false) : '--:--'))
function onChange(e: any) {
  const v = String(e?.detail?.value || '')
  emit('update:modelValue', v)
  emit('change', v)
}
</script>

<template>
  <picker mode="time" :value="modelValue || '12:00'" :disabled="disabled" @change="onChange">
    <view class="dtime" :class="{ 'is-big': big, 'is-disabled': disabled }" role="button" :aria-label="ariaLabel || undefined">
      <text class="tb-num dtime__v">
        {{ shown }}
      </text>
      <tb-icon name="chevron-down" :size="16" />
    </view>
  </picker>
</template>

<style lang="scss">
.dtime {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 46px;
  padding: 0 12px;
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-m);
  background: var(--tb-paper);
  color: var(--tb-ink);
}
.dtime__v {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 18px;
}
.dtime.is-big {
  min-height: 64px;
}
.dtime.is-big .dtime__v {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.dtime.is-disabled {
  opacity: 0.45;
}
</style>
