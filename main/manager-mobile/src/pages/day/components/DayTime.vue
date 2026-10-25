<script lang="ts" setup>
import { computed } from 'vue'
import { getCurrentLanguage } from '@/i18n'
import { dayPart, timeText } from '@/utils/calendar.mjs'

// A 24h "HH:MM" time, chosen with uni's own time picker and shown in the reader's numerals.
const props = withDefaults(defineProps<{ modelValue?: string, disabled?: boolean, big?: boolean, ariaLabel?: string }>(), {
  modelValue: '',
  disabled: false,
  big: false,
  ariaLabel: '',
})
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void, (e: 'change', v: string): void }>()
const lang = computed(() => getCurrentLanguage())
// Bangla: 12-hour figures with the day part set small before them ('রাত ৯:০০'); 24h otherwise
const part = computed(() => (props.modelValue ? dayPart(props.modelValue, lang.value) : ''))
const shown = computed(() => (props.modelValue ? timeText(props.modelValue, lang.value, lang.value === 'bn') : '--:--'))
function onChange(e: any) {
  const v = String(e?.detail?.value || '')
  emit('update:modelValue', v)
  emit('change', v)
}
</script>

<template>
  <picker mode="time" :value="modelValue || '12:00'" :disabled="disabled" @change="onChange">
    <view class="dtime" :class="{ 'is-big': big, 'is-disabled': disabled }" role="button" :aria-label="ariaLabel || undefined">
      <view class="dtime__t">
        <text v-if="part" class="dtime__part">
          {{ part }}
        </text>
        <text class="tb-num dtime__v">
          {{ shown }}
        </text>
      </view>
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
.dtime__t {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.dtime__part {
  font-family: var(--tb-font-text);
  font-weight: 600;
  font-size: 13px;
  color: var(--tb-ink-2);
}
/* disabled: the frame goes soft and the figures take the third ink (no text dimming) */
.dtime.is-disabled {
  border-color: var(--tb-rule-soft);
  color: var(--tb-ink-3);
}
.dtime.is-disabled .dtime__part {
  color: var(--tb-ink-3);
}
</style>
