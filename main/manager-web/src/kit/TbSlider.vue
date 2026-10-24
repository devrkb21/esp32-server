<template>
  <div class="tb-slider" :class="{ 'is-disabled': disabled }">
    <input type="range" class="tb-slider__el" :min="min" :max="max" :step="step" :value="modelValue" :disabled="disabled"
      :aria-label="ariaLabel || null" :aria-valuetext="valueText || null" :style="{ '--p': pct + '%' }"
      @input="emit('update:modelValue', Number($event.target.value))" @change="emit('change', Number($event.target.value))" />
    <output v-if="showValue" class="tb-slider__val tb-num">{{ valueText || modelValue }}</output>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  disabled: Boolean,
  showValue: { type: Boolean, default: true },
  valueText: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'change']);
const pct = computed(() => ((props.modelValue - props.min) / (props.max - props.min || 1)) * 100);
</script>

<style>
.tb-slider { display: flex; align-items: center; gap: 14px; min-height: var(--tb-target); }
.tb-slider__el { flex: 1; appearance: none; -webkit-appearance: none; height: 28px; background: transparent; cursor: pointer; }
.tb-slider__el::-webkit-slider-runnable-track {
  height: 4px; border-radius: 4px;
  background: linear-gradient(to right, var(--tb-ink) var(--p), var(--tb-rule-soft) var(--p));
}
.tb-slider__el::-moz-range-track { height: 4px; border-radius: 4px; background: var(--tb-rule-soft); }
.tb-slider__el::-moz-range-progress { height: 4px; border-radius: 4px; background: var(--tb-ink); }
.tb-slider__el::-webkit-slider-thumb {
  -webkit-appearance: none; width: 22px; height: 22px; margin-top: -9px; border-radius: 50%;
  background: var(--tb-paper); border: 2px solid var(--tb-ink); transition: transform var(--tb-t-hover) var(--tb-ease);
}
.tb-slider__el::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--tb-paper); border: 2px solid var(--tb-ink); }
.tb-slider__el:active::-webkit-slider-thumb { transform: scale(1.12); }
.tb-slider__el:focus-visible { outline: 2px solid var(--tb-focus); outline-offset: 2px; border-radius: 6px; }
.tb-slider__val { min-width: 3.2ch; text-align: right; font-weight: 700; font-family: var(--tb-font-display); font-size: var(--tb-fs-18); }
.tb-slider.is-disabled { opacity: .45; }
</style>
