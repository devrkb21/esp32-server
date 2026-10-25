<template>
  <div class="tb-select" :class="[`tb-select--${size}`, { 'is-invalid': invalid, 'is-disabled': disabled }]">
    <select :aria-describedby="describedBy || null" :id="id || null" :value="current" :disabled="disabled" :aria-invalid="invalid ? 'true' : null"
      :aria-label="ariaLabel || null" @change="onChange">
      <option v-if="placeholder" value="" disabled :selected="current === ''">{{ placeholder }}</option>
      <template v-for="(o, i) in normalized" :key="i">
        <optgroup v-if="o.group" :label="o.group">
          <option v-for="(c, j) in o.options" :key="j" :value="String(c.value)" :disabled="c.disabled">{{ c.label }}</option>
        </optgroup>
        <option v-else :value="String(o.value)" :disabled="o.disabled">{{ o.label }}</option>
      </template>
    </select>
    <TbIcon class="tb-select__chev" name="chevron-down" :size="18" />
  </div>
</template>

<script setup>
import { inject as injectField } from 'vue';
import { computed } from 'vue';
import TbIcon from './TbIcon.vue';

// Native select (keyboard, screen readers and phone pickers for free). options: [{ value, label,
// disabled }] or [{ group, options: [...] }] or plain strings. Values come back with their type.
const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  size: { type: String, default: 'm' },
  disabled: Boolean,
  invalid: Boolean,
  id: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'change']);
// Set by an enclosing TbField: the id of its error or hint.
const describedBy = injectField('tbFieldDescribedBy', null);
const flat = [];
const normalized = computed(() => props.options.map((o) => (
  typeof o === 'object' && o !== null ? (o.group ? { group: o.group, options: o.options.map(n) } : n(o)) : n(o)
)));
function n(o) { return typeof o === 'object' && o !== null ? o : { value: o, label: String(o) }; }
const current = computed(() => (props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue)));
function onChange(e) {
  const raw = e.target.value;
  const all = normalized.value.flatMap((o) => (o.group ? o.options : [o]));
  const hit = all.find((o) => String(o.value) === raw);
  const v = hit ? hit.value : raw;
  emit('update:modelValue', v);
  emit('change', v);
}
void flat;
</script>

<style>
.tb-select { --h: 44px; position: relative; }
.tb-select--s { --h: 36px; }
.tb-select select {
  appearance: none; -webkit-appearance: none; width: 100%; min-height: var(--h); padding: 0 40px 0 12px;
  background: var(--tb-paper); border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-m);
  font-size: max(16px, var(--tb-fs-15)); color: var(--tb-ink); cursor: pointer;
  transition: border-color var(--tb-t-hover) var(--tb-ease), box-shadow var(--tb-t-hover) var(--tb-ease);
}
.tb-select select:focus-visible { outline: none; border-color: var(--tb-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tb-focus) 25%, transparent); }
.tb-select.is-invalid select { border-color: var(--tb-danger); }
.tb-select.is-disabled select { opacity: .5; cursor: not-allowed; background: var(--tb-paper-2); }
.tb-select__chev { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--tb-ink-2); }
</style>
