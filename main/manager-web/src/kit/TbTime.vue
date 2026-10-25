<template>
  <div class="tb-time" :class="{ 'is-invalid': invalid, 'is-disabled': disabled }">
    <TbIcon :name="type === 'date' ? 'today' : 'alarm'" :size="18" class="tb-time__icon" />
    <input :type="type" :aria-describedby="describedBy || null" :id="id || null" :value="modelValue" :disabled="disabled" :min="min || null" :max="max || null"
      :step="type === 'time' ? 60 : null" :aria-label="ariaLabel || null" :aria-invalid="invalid ? 'true' : null"
      @input="emit('update:modelValue', $event.target.value)" @change="emit('change', $event.target.value)" />
  </div>
</template>

<script setup>
import { inject as injectField } from 'vue';
import TbIcon from './TbIcon.vue';

// Native time (24h "HH:MM") or date ("YYYY-MM-DD") picker, styled.
defineProps({
  modelValue: { type: String, default: '' },
  type: { type: String, default: 'time' },
  min: { type: String, default: '' },
  max: { type: String, default: '' },
  disabled: Boolean,
  invalid: Boolean,
  id: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'change']);
// Set by an enclosing TbField: the id of its error or hint.
const describedBy = injectField('tbFieldDescribedBy', null);
</script>

<style>
.tb-time {
  display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px;
  border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-m); background: var(--tb-paper);
}
.tb-time:focus-within { border-color: var(--tb-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tb-focus) 25%, transparent); }
.tb-time input {
  border: 0; background: transparent; outline: none; font-family: var(--tb-font-display); font-weight: 700;
  font-size: max(16px, var(--tb-fs-18)); font-variant-numeric: tabular-nums; color: var(--tb-ink); min-width: 6.5ch;
}
.tb-time input::-webkit-calendar-picker-indicator { opacity: .5; cursor: pointer; }
.tb-time__icon { color: var(--tb-ink-2); }
.tb-time.is-invalid { border-color: var(--tb-danger); }
.tb-time.is-disabled { opacity: .45; }
</style>
