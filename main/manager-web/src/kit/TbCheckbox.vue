<template>
  <label class="tb-check" :class="{ 'is-disabled': disabled }">
    <input type="checkbox" class="tb-check__el" :checked="checked" :disabled="disabled" :indeterminate.prop="indeterminate"
      :aria-label="ariaLabel || null" @change="onChange" />
    <span class="tb-check__box" aria-hidden="true"><TbIcon v-if="checked" name="check" :size="14" :stroke="2.5" /><span v-else-if="indeterminate" class="tb-check__dash"></span></span>
    <span v-if="label || $slots.default" class="tb-check__label"><slot>{{ label }}</slot></span>
  </label>
</template>

<script setup>
import { computed } from 'vue';
import TbIcon from './TbIcon.vue';

// v-model as a boolean, or as an array of values together with `value`.
const props = defineProps({
  modelValue: { type: [Boolean, Array], default: false },
  value: { type: [String, Number, Boolean], default: null },
  label: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  disabled: Boolean,
  indeterminate: Boolean,
});
const emit = defineEmits(['update:modelValue', 'change']);
const checked = computed(() => (Array.isArray(props.modelValue) ? props.modelValue.includes(props.value) : props.modelValue));
function onChange(e) {
  let v;
  if (Array.isArray(props.modelValue)) {
    v = e.target.checked ? [...props.modelValue, props.value] : props.modelValue.filter((x) => x !== props.value);
  } else v = e.target.checked;
  emit('update:modelValue', v);
  emit('change', v);
}
</script>

<style>
.tb-check { position: relative; display: inline-flex; align-items: center; gap: 10px; min-height: 32px; cursor: pointer; }
.tb-check__el { position: absolute; opacity: 0; width: 22px; height: 22px; margin: 0; cursor: pointer; }
.tb-check__box {
  width: 20px; height: 20px; flex: none; display: grid; place-items: center;
  border: 1.5px solid var(--tb-ink); border-radius: 5px; background: var(--tb-paper); color: var(--tb-paper);
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
/* checked in ink, like the switch: orange stays the page's one action */
.tb-check__el:checked + .tb-check__box, .tb-check__el:indeterminate + .tb-check__box { background: var(--tb-ink); border-color: var(--tb-ink); }
.tb-check__el:focus-visible + .tb-check__box { outline: 2px solid var(--tb-focus); outline-offset: 2px; }
.tb-check__dash { width: 10px; height: 2px; background: var(--tb-paper); }
.tb-check.is-disabled { opacity: .45; cursor: not-allowed; }
</style>
