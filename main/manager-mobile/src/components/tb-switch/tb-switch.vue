<script setup lang="ts">
// An on/off switch. On is drawn in ink (or the area ink passed as `ink`), never in the action
// orange, so the screen's one orange stays its primary action.
const props = withDefaults(defineProps<{ modelValue?: boolean, label?: string, disabled?: boolean, ink?: string }>(), { modelValue: false, label: '', disabled: false, ink: '' })
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
    :style="ink ? { '--sw': `var(--tb-${ink})` } : undefined"
    :tabindex="disabled ? -1 : 0" :aria-disabled="disabled ? 'true' : undefined"
    :aria-checked="modelValue ? 'true' : 'false'" :aria-label="label || undefined"
    @click="toggle" @keydown.enter="toggle" @keydown.space.prevent="toggle">
    <view class="tb-switch__track"><view class="tb-switch__thumb" /></view>
    <text v-if="label || $slots.default" class="tb-switch__label"><slot>{{ label }}</slot></text>
  </view>
</template>

<style lang="scss">
.tb-switch { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; outline: none; }
.tb-switch__track { position: relative; width: 48px; height: 28px; flex: none; border: 1.5px solid var(--tb-ink); border-radius: 999px; background: var(--tb-paper);
  transition: background-color var(--tb-t-fast) var(--tb-ease), border-color var(--tb-t-fast) var(--tb-ease); }
.tb-switch__thumb { position: absolute; top: 3px; left: 3px; width: 19px; height: 19px; border-radius: 50%; background: var(--tb-ink);
  transition: transform var(--tb-t-fast) var(--tb-ease), background-color var(--tb-t-fast) var(--tb-ease); }
.tb-switch.is-on .tb-switch__track { background: var(--sw, var(--tb-ink)); border-color: var(--sw, var(--tb-ink)); }
.tb-switch.is-on .tb-switch__thumb { transform: translateX(20px); background: var(--tb-paper); }
.tb-switch:focus-visible .tb-switch__track { outline: 2px solid var(--tb-focus); outline-offset: 2px; }
.tb-switch.is-disabled { opacity: .45; }
.tb-switch__label { font-size: 15px; }
</style>
