<script setup lang="ts">
import { computed } from 'vue'

// A segmented single choice drawn as outline pills. options: [{ value, label, icon, disabled }]
const props = withDefaults(defineProps<{ modelValue?: string | number | boolean, options?: any[], wrap?: boolean, disabled?: boolean, ariaLabel?: string }>(), {
  modelValue: undefined, options: () => [], wrap: false, disabled: false, ariaLabel: '',
})
const emit = defineEmits<{ (e: 'update:modelValue', v: any): void, (e: 'change', v: any): void }>()
const list = computed(() => props.options.map(o => (typeof o === 'object' ? o : { value: o, label: String(o) })))
function pick(o: any) {
  if (props.disabled || o.disabled)
    return
  emit('update:modelValue', o.value)
  emit('change', o.value)
}
</script>

<template>
  <scroll-view :scroll-x="!wrap" class="tb-choice-wrap" :show-scrollbar="false">
    <view class="tb-choice" :class="{ 'is-wrap': wrap }" role="radiogroup" :aria-label="ariaLabel || undefined">
      <view v-for="o in list" :key="String(o.value)" class="tb-choice__opt" role="radio"
        :class="{ 'is-on': o.value === modelValue, 'is-disabled': disabled || o.disabled }"
        :aria-checked="o.value === modelValue ? 'true' : 'false'" @click="pick(o)">
        <tb-icon v-if="o.icon" :name="o.icon" :size="16" /><text>{{ o.label }}</text>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss">
.tb-choice-wrap { width: 100%; white-space: nowrap; }
.tb-choice { display: inline-flex; gap: 6px; padding: 2px; }
.tb-choice.is-wrap { display: flex; flex-wrap: wrap; white-space: normal; }
.tb-choice__opt { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 14px; border: 1.5px solid var(--tb-rule-soft);
  border-radius: 999px; background: var(--tb-paper); font-weight: 600; font-size: 14px; color: var(--tb-ink-2);
  transition: background-color var(--tb-t-hover) var(--tb-ease), color var(--tb-t-hover) var(--tb-ease); }
.tb-choice__opt.is-on { background: var(--tb-ink); border-color: var(--tb-ink); color: var(--tb-paper); }
.tb-choice__opt.is-disabled { opacity: .45; }
</style>
