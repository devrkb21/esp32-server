<template>
  <div class="tb-input" :class="[`tb-input--${size}`, { 'is-invalid': invalid, 'is-disabled': disabled }]">
    <TbIcon v-if="icon" class="tb-input__icon" :name="icon" :size="18" />
    <input ref="el" class="tb-input__el" :aria-describedby="describedBy || null" :id="id || null" :type="shownType" :value="modelValue" :placeholder="placeholder"
      :disabled="disabled" :readonly="readonly" :maxlength="maxlength || null" :autocomplete="autocomplete"
      :inputmode="inputmode || null" :enterkeyhint="enterkeyhint || null" :aria-invalid="invalid ? 'true' : null" :aria-label="ariaLabel || null"
      @input="onInput" @change="$emit('change', $event.target.value)" @keydown.enter="$emit('enter', $event)"
      @blur="$emit('blur', $event)" @focus="$emit('focus', $event)" />
    <span v-if="$slots.suffix" class="tb-input__suffix"><slot name="suffix" /></span>
    <button v-if="clearable && modelValue && !disabled" type="button" class="tb-input__btn" :aria-label="clearLabel"
      @click="clear"><TbIcon name="close" :size="16" /></button>
    <button v-if="type === 'password'" type="button" class="tb-input__btn" :aria-label="reveal ? hideLabel : showLabel"
      :aria-pressed="reveal ? 'true' : 'false'" @click="reveal = !reveal"><TbIcon :name="reveal ? 'eye-off' : 'eye'" :size="18" /></button>
  </div>
</template>

<script setup>
import { inject as injectField } from 'vue';
import { computed, ref } from 'vue';
import TbIcon from './TbIcon.vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  size: { type: String, default: 'm' },
  icon: { type: String, default: '' },
  disabled: Boolean,
  readonly: Boolean,
  invalid: Boolean,
  clearable: Boolean,
  maxlength: { type: [Number, String], default: null },
  autocomplete: { type: String, default: 'off' },
  inputmode: { type: String, default: '' },
  enterkeyhint: { type: String, default: '' },
  id: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  clearLabel: { type: String, default: 'Clear' },
  showLabel: { type: String, default: 'Show' },
  hideLabel: { type: String, default: 'Hide' },
  number: Boolean,
});
const emit = defineEmits(['update:modelValue', 'change', 'enter', 'blur', 'focus', 'clear']);
// Set by an enclosing TbField: the id of its error or hint.
const describedBy = injectField('tbFieldDescribedBy', null);
const el = ref(null);
const reveal = ref(false);
const shownType = computed(() => (props.type === 'password' && reveal.value ? 'text' : props.type));

function onInput(e) {
  const v = e.target.value;
  emit('update:modelValue', props.number && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
}
function clear() { emit('update:modelValue', ''); emit('clear'); el.value?.focus(); }
defineExpose({ focus: () => el.value?.focus(), select: () => el.value?.select() });
</script>

<style>
.tb-input {
  --h: 44px;
  display: flex; align-items: center; gap: 4px;
  min-height: var(--h); padding: 0 6px 0 12px;
  background: var(--tb-paper); border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-m);
  transition: border-color var(--tb-t-hover) var(--tb-ease), box-shadow var(--tb-t-hover) var(--tb-ease);
}
.tb-input--s { --h: 36px; }
.tb-input--l { --h: 52px; }
.tb-input:focus-within { box-shadow: 0 0 0 3px color-mix(in srgb, var(--tb-focus) 25%, transparent); border-color: var(--tb-focus); }
.tb-input.is-invalid { border-color: var(--tb-danger); }
.tb-input.is-disabled { opacity: .5; background: var(--tb-paper-2); }
.tb-input__el {
  flex: 1; min-width: 0; height: calc(var(--h) - 3px); border: 0; background: transparent; outline: none;
  font-size: max(16px, var(--tb-fs-15)); /* 16px+ keeps phones from zooming */
}
.tb-input__el::placeholder { color: var(--tb-ink-3); }
.tb-input__icon { color: var(--tb-ink-2); }
.tb-input__suffix { color: var(--tb-ink-2); font-size: var(--tb-fs-13); padding-right: 6px; }
.tb-input__btn {
  display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 8px;
  background: transparent; color: var(--tb-ink-2);
}
.tb-input__btn:hover { background: var(--tb-paper-2); color: var(--tb-ink); }
</style>
