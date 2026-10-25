<template>
  <div class="tb-textarea" :class="{ 'is-invalid': invalid, 'is-disabled': disabled }">
    <textarea ref="el" :aria-describedby="describedBy || null" :id="id || null" :value="modelValue" :rows="rows" :placeholder="placeholder" :disabled="disabled"
      :readonly="readonly" :maxlength="maxlength || null" :aria-invalid="invalid ? 'true' : null" :aria-label="ariaLabel || null"
      @input="onInput" @blur="$emit('blur', $event)"></textarea>
    <span v-if="maxlength && showCount" class="tb-textarea__count tb-num">{{ n(String(modelValue || '').length) }}/{{ n(maxlength) }}</span>
  </div>
</template>

<script setup>
import { inject as injectField } from 'vue';
import { nextTick, onMounted, ref, watch } from 'vue';
import { useLocale } from './locale';
import { digits } from './calendar';

const props = defineProps({
  modelValue: { type: String, default: '' },
  rows: { type: Number, default: 4 },
  placeholder: { type: String, default: '' },
  disabled: Boolean,
  readonly: Boolean,
  invalid: Boolean,
  autosize: Boolean,
  maxlength: { type: [Number, String], default: null },
  showCount: Boolean,
  id: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'blur']);
// Set by an enclosing TbField: the id of its error or hint.
const describedBy = injectField('tbFieldDescribedBy', null);
const locale = useLocale();
const n = (v) => digits(v, locale.value);
const el = ref(null);
function fit() {
  if (!props.autosize || !el.value) return;
  el.value.style.height = 'auto';
  el.value.style.height = `${el.value.scrollHeight + 2}px`;
}
function onInput(e) { emit('update:modelValue', e.target.value); fit(); }
watch(() => props.modelValue, () => nextTick(fit));
onMounted(fit);
defineExpose({ focus: () => el.value?.focus() });
</script>

<style>
.tb-textarea { position: relative; }
.tb-textarea textarea {
  display: block; width: 100%; resize: vertical; padding: 10px 12px; min-height: 88px;
  background: var(--tb-paper); border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-m);
  font-size: max(16px, var(--tb-fs-15)); line-height: var(--tb-lh-text);
  transition: border-color var(--tb-t-hover) var(--tb-ease), box-shadow var(--tb-t-hover) var(--tb-ease);
}
.tb-textarea textarea::placeholder { color: var(--tb-ink-3); }
.tb-textarea textarea:focus { outline: none; border-color: var(--tb-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tb-focus) 25%, transparent); }
.tb-textarea.is-invalid textarea { border-color: var(--tb-danger); }
.tb-textarea.is-disabled textarea { opacity: .5; background: var(--tb-paper-2); }
.tb-textarea__count { position: absolute; right: 10px; bottom: 6px; font-size: var(--tb-fs-12); color: var(--tb-ink-3); }
</style>
