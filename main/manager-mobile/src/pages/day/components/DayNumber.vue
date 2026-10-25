<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'

// A whole number within [min, max]: minus, the number (typed or stepped), plus.
const props = withDefaults(defineProps<{ modelValue?: number, min?: number, max?: number, step?: number, disabled?: boolean, ariaLabel?: string }>(), {
  modelValue: 0,
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  ariaLabel: '',
})
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void, (e: 'change', v: number): void }>()
const text = ref(String(props.modelValue ?? ''))
const editing = ref(false)
watch(() => props.modelValue, (v) => {
  if (!editing.value)
    text.value = String(v ?? '')
})
const shown = computed(() => (editing.value ? text.value : digits(props.modelValue, getCurrentLanguage())))

function put(n: number) {
  const v = Math.min(props.max, Math.max(props.min, Math.round(n)))
  text.value = String(v)
  emit('update:modelValue', v)
  emit('change', v)
}
function stepBy(dir: number) {
  if (props.disabled)
    return
  const base = Number.isFinite(Number(props.modelValue)) ? Number(props.modelValue) : props.min
  put(base + dir * props.step)
}
// Bangla digits typed by the reader become ASCII before parsing
function ascii(s: string) {
  return s.replace(/[০-৯]/g, d => String(d.charCodeAt(0) - 0x09E6)).replace(/[^\d-]/g, '')
}
function onInput(e: any) {
  text.value = ascii(String(e?.detail?.value ?? ''))
  const n = Number(text.value)
  if (text.value !== '' && Number.isFinite(n))
    emit('update:modelValue', Math.round(n))
}
function onBlur() {
  editing.value = false
  const n = Number(text.value)
  put(Number.isFinite(n) && text.value !== '' ? n : props.modelValue)
}
</script>

<template>
  <view class="dnum" :class="{ 'is-disabled': disabled, 'is-bad': modelValue < min || modelValue > max }">
    <view class="dnum__btn" role="button" :aria-label="t('day.less')" :class="{ 'is-off': modelValue <= min }" @click="stepBy(-1)">
      <tb-icon name="minus" :size="18" />
    </view>
    <input
      class="tb-num dnum__in" type="text" inputmode="numeric" :value="shown" :disabled="disabled" :aria-label="ariaLabel || undefined"
      @focus="editing = true; text = String(modelValue ?? '')" @input="onInput" @blur="onBlur"
    >
    <view class="dnum__btn" role="button" :aria-label="t('day.more')" :class="{ 'is-off': modelValue >= max }" @click="stepBy(1)">
      <tb-icon name="plus" :size="18" />
    </view>
  </view>
</template>

<style lang="scss">
.dnum {
  display: inline-flex;
  align-items: center;
  height: 46px;
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-m);
  background: var(--tb-paper);
}
.dnum__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--tb-ink);
}
.dnum__btn.is-off {
  color: var(--tb-ink-3);
}
.dnum__in {
  width: 64px;
  height: 42px;
  text-align: center;
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 18px;
  color: var(--tb-ink);
  border-left: 1px solid var(--tb-rule-soft);
  border-right: 1px solid var(--tb-rule-soft);
}
.dnum.is-bad {
  border-color: var(--tb-danger);
}
/* disabled: the frame goes soft and the figures take the third ink (no text dimming) */
.dnum.is-disabled {
  border-color: var(--tb-rule-soft);
}
.dnum.is-disabled .dnum__in,
.dnum.is-disabled .dnum__btn {
  color: var(--tb-ink-3);
}
</style>
