<script setup lang="ts">
// variant: primary (the one orange action), secondary (ink outline), quiet (text), danger
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  size?: 's' | 'm' | 'l'
  icon?: string
  loading?: boolean
  disabled?: boolean
  block?: boolean
  formType?: '' | 'submit' | 'reset'
  ariaLabel?: string
}>(), { variant: 'secondary', size: 'm', icon: '', loading: false, disabled: false, block: false, formType: '', ariaLabel: '' })
const emit = defineEmits<{ (e: 'click', ev: any): void }>()
function onTap(ev: any) {
  if (props.disabled || props.loading)
    return
  emit('click', ev)
}
</script>

<template>
  <button
    class="tb-btn" :class="[`tb-btn--${variant}`, `tb-btn--${size}`, { 'is-block': block, 'is-off': disabled || loading, 'is-busy': loading }]"
    :form-type="formType || undefined" :disabled="disabled || loading" :aria-label="ariaLabel || undefined"
    hover-class="is-press" @click="onTap"
  >
    <view v-if="loading" class="tb-btn__spin" />
    <tb-icon v-else-if="icon" :name="icon" :size="size === 's' ? 16 : 18" />
    <text v-if="$slots.default" class="tb-btn__label">
      <slot />
    </text>
  </button>
</template>

<style lang="scss">
.tb-btn {
  --h: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  min-height: var(--h);
  line-height: 1;
  padding: 0 16px;
  border: 1.5px solid var(--tb-ink);
  border-radius: 999px;
  background: transparent;
  color: var(--tb-ink);
  font: 600 14px var(--tb-font-text);
  white-space: nowrap;
  transition:
    background-color var(--tb-t-hover) var(--tb-ease),
    transform var(--tb-t-hover) var(--tb-ease);
  &::after {
    display: none;
  }
}
.tb-btn--s {
  --h: 34px;
  padding: 0 12px;
  font-size: 13px;
}
.tb-btn--l {
  --h: 50px;
  padding: 0 22px;
  font-size: 15px;
}
.tb-btn.is-block {
  display: flex;
  width: 100%;
}
.tb-btn--primary {
  background: var(--tb-action);
  border-color: var(--tb-action);
  color: var(--tb-on-action);
}
.tb-btn--quiet {
  border-color: transparent;
}
.tb-btn--danger {
  border-color: var(--tb-danger);
  color: var(--tb-danger);
}
.tb-btn.is-press {
  transform: translateY(1px);
  background: var(--tb-paper-2);
}
.tb-btn--primary.is-press {
  background: var(--tb-action-hover);
}
.tb-btn.is-off {
  opacity: 0.45;
}
/* uni's own button[disabled] colours lose to ours */
.tb-btn[disabled] {
  color: var(--tb-ink) !important;
  background-color: transparent !important;
  border-color: var(--tb-ink) !important;
}
/* A disabled primary is an empty outline, as on the web (orange at 45% turns brown on the dark
   ground); a primary that is sending (loading) keeps its orange. */
.tb-btn--primary[disabled] {
  color: var(--tb-ink-3) !important;
  background-color: transparent !important;
  border-color: var(--tb-rule) !important;
}
.tb-btn--primary.is-off:not(.is-busy) {
  opacity: 1;
}
.tb-btn--primary.is-busy[disabled] {
  color: var(--tb-on-action) !important;
  background-color: var(--tb-action) !important;
  border-color: var(--tb-action) !important;
}
.tb-btn--primary.is-busy {
  opacity: 1;
}
.tb-btn__label {
  white-space: nowrap;
}
.tb-btn__spin {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: tb-spin 0.8s linear infinite;
}
@keyframes tb-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
