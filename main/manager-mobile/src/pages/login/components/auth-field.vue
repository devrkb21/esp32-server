<script setup lang="ts">
// One ruled line of the account forms: the label, then the field written on the rule, as on a
// printed form. The rule turns blue while the field has focus and red with an error under it.
withDefaults(defineProps<{ label: string, error?: string }>(), { error: '' })
</script>

<template>
  <view class="af" :class="{ 'has-error': !!error }">
    <text class="af__label">
      {{ label }}
    </text>
    <view class="af__line">
      <slot />
      <view v-if="$slots.aside" class="af__aside">
        <slot name="aside" />
      </view>
    </view>
    <text v-if="error" class="af__error" role="alert">
      {{ error }}
    </text>
  </view>
</template>

<style lang="scss">
/* Styles of this component's own elements only: uni-app scopes every component's styles, so the
   rules for what the pages put inside the field live in auth-form.scss, imported by each page. */
.af {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 10px;
  border-bottom: 1px solid var(--tb-rule-soft);
  transition:
    border-color var(--tb-t-hover) var(--tb-ease),
    box-shadow var(--tb-t-hover) var(--tb-ease);
}
.af:focus-within {
  border-bottom-color: var(--tb-focus);
  box-shadow: inset 0 -1px 0 var(--tb-focus);
}
.af.has-error {
  border-bottom-color: var(--tb-danger);
  box-shadow: inset 0 -1px 0 var(--tb-danger);
}
.af__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.af__line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.af__aside {
  flex: none;
  display: flex;
  align-items: center;
  padding-bottom: 4px;
}
.af__error {
  font-size: 13px;
  font-weight: 500;
  color: var(--tb-danger);
  padding-bottom: 8px;
}
</style>
