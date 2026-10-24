<template>
  <label class="tb-switch" :class="{ 'is-on': modelValue, 'is-disabled': disabled || loading }">
    <button type="button" role="switch" class="tb-switch__track" :aria-checked="modelValue ? 'true' : 'false'"
      :aria-label="ariaLabel || label || null" :disabled="disabled || loading" @click="toggle">
      <span class="tb-switch__thumb"></span>
    </button>
    <span v-if="label || $slots.default" class="tb-switch__label"><slot>{{ label }}</slot></span>
  </label>
</template>

<script setup>
const props = defineProps({
  modelValue: Boolean,
  label: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  disabled: Boolean,
  loading: Boolean,
});
const emit = defineEmits(['update:modelValue', 'change']);
function toggle() {
  const v = !props.modelValue;
  emit('update:modelValue', v);
  emit('change', v);
}
</script>

<style>
.tb-switch { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; min-height: var(--tb-target); }
.tb-switch__track {
  position: relative; width: 46px; height: 26px; flex: none; padding: 0;
  border: 1.5px solid var(--tb-ink); border-radius: 999px; background: var(--tb-paper);
  transition: background-color var(--tb-t-fast) var(--tb-ease), border-color var(--tb-t-fast) var(--tb-ease);
}
.tb-switch__thumb {
  position: absolute; top: 3px; left: 3px; width: 17px; height: 17px; border-radius: 50%;
  background: var(--tb-ink); transition: transform var(--tb-t-fast) var(--tb-ease), background-color var(--tb-t-fast) var(--tb-ease);
}
.tb-switch.is-on .tb-switch__track { background: var(--tb-action); border-color: var(--tb-action); }
.tb-switch.is-on .tb-switch__thumb { transform: translateX(20px); background: var(--tb-on-action); }
.tb-switch.is-disabled { opacity: .45; cursor: not-allowed; }
.tb-switch__label { font-size: var(--tb-fs-15); }
</style>
