<template>
  <div class="tb-choice" :class="{ 'is-wrap': wrap, 'is-disabled': disabled }" role="radiogroup" :aria-label="ariaLabel || null">
    <button v-for="o in normalized" :key="String(o.value)" type="button" role="radio" class="tb-choice__opt"
      :class="{ 'is-on': o.value === modelValue }" :aria-checked="o.value === modelValue ? 'true' : 'false'"
      :tabindex="o.value === modelValue || (modelValue === undefined && o === normalized[0]) ? 0 : -1"
      :disabled="disabled || o.disabled" @click="pick(o.value)" @keydown="onKey($event, o)">
      <TbIcon v-if="o.icon" :name="o.icon" :size="16" />{{ o.label }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import TbIcon from './TbIcon.vue';

// A segmented single choice (radio group) drawn as outline pills.
const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: undefined },
  options: { type: Array, default: () => [] },
  ariaLabel: { type: String, default: '' },
  disabled: Boolean,
  wrap: Boolean,
});
const emit = defineEmits(['update:modelValue', 'change']);
const normalized = computed(() => props.options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) })));
function pick(v) { emit('update:modelValue', v); emit('change', v); }
function onKey(e, o) {
  const list = normalized.value.filter((x) => !x.disabled);
  const i = list.indexOf(o);
  let j = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % list.length;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + list.length) % list.length;
  if (j >= 0) {
    e.preventDefault();
    pick(list[j].value);
    e.currentTarget.parentElement.querySelectorAll('.tb-choice__opt')[normalized.value.indexOf(list[j])]?.focus();
  }
}
</script>

<style>
.tb-choice { display: inline-flex; gap: 6px; flex-wrap: nowrap; overflow-x: auto; max-width: 100%; padding: 2px; }
.tb-choice.is-wrap { flex-wrap: wrap; }
.tb-choice__opt {
  display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px; white-space: nowrap;
  border: 1.5px solid var(--tb-rule-soft); border-radius: var(--tb-radius-pill); background: var(--tb-paper);
  font-weight: 600; font-size: var(--tb-fs-14); color: var(--tb-ink-2);
  transition: background-color var(--tb-t-hover) var(--tb-ease), color var(--tb-t-hover) var(--tb-ease), border-color var(--tb-t-hover) var(--tb-ease);
}
.tb-choice__opt:hover:not(:disabled) { border-color: var(--tb-ink); color: var(--tb-ink); }
.tb-choice__opt.is-on { background: var(--tb-ink); border-color: var(--tb-ink); color: var(--tb-paper); }
.tb-choice__opt:disabled { opacity: .45; cursor: not-allowed; }
</style>
