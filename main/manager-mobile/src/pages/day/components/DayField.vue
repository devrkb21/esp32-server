<script lang="ts" setup>
// A labelled field of a Day sheet: label, the control, then a hint or an error.
withDefaults(defineProps<{ label?: string, hint?: string, error?: string }>(), { label: '', hint: '', error: '' })
</script>

<template>
  <view class="dfield">
    <text v-if="label" class="dfield__label">
      {{ label }}
    </text>
    <slot />
    <text v-if="error" class="dfield__error" role="alert">
      {{ error }}
    </text>
    <text v-else-if="hint" class="dfield__hint">
      {{ hint }}
    </text>
  </view>
</template>

<style lang="scss">
.dfield {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.dfield__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.dfield__hint {
  font-size: 12.5px;
  color: var(--tb-ink-2);
}
.dfield__error {
  font-size: 13px;
  color: var(--tb-danger);
}
</style>
