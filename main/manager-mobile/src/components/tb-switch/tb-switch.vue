<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue?: boolean, label?: string, disabled?: boolean }>(), { modelValue: false, label: '', disabled: false })
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void, (e: 'change', v: boolean): void }>()
function toggle() {
  if (props.disabled)
    return
  emit('update:modelValue', !props.modelValue)
  emit('change', !props.modelValue)
}
</script>

<template>
  <view class="tb-switch" :class="{ 'is-on': modelValue, 'is-disabled': disabled }" role="switch"
    :aria-checked="modelValue ? 'true' : 'false'" :aria-label="label || undefined" @click="toggle">
    <view class="tb-switch__track"><view class="tb-switch__thumb" /></view>
    <text v-if="label || $slots.default" class="tb-switch__label"><slot>{{ label }}</slot></text>
  </view>
</template>

<style lang="scss">
.tb-switch { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; }
.tb-switch__track { position: relative; width: 48px; height: 28px; flex: none; border: 1.5px solid var(--tb-ink); border-radius: 999px; background: var(--tb-paper);
  transition: background-color var(--tb-t-fast) var(--tb-ease), border-color var(--tb-t-fast) var(--tb-ease); }
.tb-switch__thumb { position: absolute; top: 3px; left: 3px; width: 19px; height: 19px; border-radius: 50%; background: var(--tb-ink);
  transition: transform var(--tb-t-fast) var(--tb-ease), background-color var(--tb-t-fast) var(--tb-ease); }
.tb-switch.is-on .tb-switch__track { background: var(--tb-action); border-color: var(--tb-action); }
.tb-switch.is-on .tb-switch__thumb { transform: translateX(20px); background: var(--tb-on-action); }
.tb-switch.is-disabled { opacity: .45; }
.tb-switch__label { font-size: 15px; }
</style>
