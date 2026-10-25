<template>
  <div class="lk-code" :class="{ 'is-focus': focused, 'is-invalid': invalid, 'is-disabled': disabled }">
    <input :id="id" ref="input" class="lk-code__input" type="text" inputmode="numeric" autocomplete="one-time-code"
      enterkeyhint="go" spellcheck="false" :value="modelValue" :disabled="disabled" :aria-label="label"
      :aria-describedby="describedby || undefined" :aria-invalid="invalid ? 'true' : undefined"
      @input="onInput" @paste="onPaste" @focus="focused = true" @blur="focused = false" @keydown.enter.prevent="$emit('enter')" />
    <span v-for="i in 6" :key="i" class="lk-code__cell" :class="{ 'is-active': focused && i - 1 === active, 'is-filled': i <= modelValue.length }"
      aria-hidden="true">{{ cell(i - 1) }}</span>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { digits } from '@/kit/calendar';
import { codeFromText } from '@/utils/linkCode';

// The robot's 6-digit code as six ruled cells. One real input lies over the cells, so the numeric
// keyboard, SMS/one-time-code autofill, paste (a code, digits with spaces, Bangla digits or the
// robot's whole link) and screen readers all work as with any text field.
const props = defineProps({
  modelValue: { type: String, default: '' },
  id: { type: String, default: 'lk-code' },
  label: { type: String, required: true },
  describedby: { type: String, default: '' },
  lang: { type: String, default: 'bn' },
  invalid: Boolean,
  disabled: Boolean,
});
const emit = defineEmits(['update:modelValue', 'enter']);

const input = ref(null);
const focused = ref(false);
const active = computed(() => Math.min(props.modelValue.length, 5));

function cell(i) {
  const d = props.modelValue[i];
  return d === undefined ? '' : digits(d, props.lang);
}
function set(value, el) {
  if (el && el.value !== value) el.value = value;
  if (value !== props.modelValue) emit('update:modelValue', value);
}
function onInput(e) { set(codeFromText(e.target.value), e.target); }
function onPaste(e) {
  const text = e.clipboardData && e.clipboardData.getData('text');
  if (!text) return;
  e.preventDefault();
  const code = codeFromText(text);
  if (code) set(code, e.target);
}

defineExpose({ focus: () => input.value && input.value.focus() });
</script>

<style>
.lk-code {
  position: relative; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr));
  border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-s); background: var(--tb-paper);
  transition: border-color var(--tb-t-hover) var(--tb-ease);
}
.lk-code.is-focus { border-color: var(--tb-focus); }
.lk-code.is-invalid { border-color: var(--tb-danger); }
.lk-code.is-disabled { opacity: .7; }
.lk-code__cell {
  position: relative; display: grid; place-items: center; height: 64px;
  font: 800 var(--tb-fs-32)/1 var(--tb-font-display); font-variant-numeric: tabular-nums; color: var(--tb-ink);
}
.lk-code__cell + .lk-code__cell { border-left: 1px solid var(--tb-rule-soft); }
/* the two halves of the code, as the robot shows them: a heavier rule in the middle */
.lk-code__cell:nth-of-type(4) { border-left: var(--tb-rule-band) solid var(--tb-rule); }
.lk-code__cell::after {
  content: ''; position: absolute; left: 22%; right: 22%; bottom: 10px; height: 3px; border-radius: 2px;
  background: var(--tb-orange); transform: scaleX(0); transition: transform var(--tb-t-fast) var(--tb-ease);
}
.lk-code__cell.is-active::after { transform: scaleX(1); }
.lk-code__input {
  position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; margin: 0; padding: 0 12px; border: 0;
  background: transparent; color: transparent; caret-color: transparent; font-size: 16px; letter-spacing: 2em;
  outline: none; cursor: text; -webkit-text-fill-color: transparent;
}
.lk-code__input::selection { background: transparent; }
.lk-code__input:disabled { cursor: default; }
@media (max-width: 380px) {
  .lk-code__cell { height: 56px; font-size: var(--tb-fs-24); }
}
</style>
