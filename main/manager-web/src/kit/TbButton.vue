<template>
  <component :is="tag" class="tb-btn" :class="[`tb-btn--${variant}`, `tb-btn--${size}`, { 'is-block': block, 'is-loading': loading, 'is-icon-only': iconOnly }]"
    :type="tag === 'button' ? nativeType : null" :disabled="tag === 'button' ? (disabled || loading) : null"
    :aria-disabled="disabled || loading ? 'true' : null" :aria-busy="loading ? 'true' : null" v-bind="target">
    <span v-if="loading" class="tb-btn__spin" aria-hidden="true"></span>
    <TbIcon v-else-if="icon" :name="icon" :size="size === 's' ? 16 : 18" />
    <span v-if="$slots.default" class="tb-btn__label"><slot /></span>
    <TbIcon v-if="iconAfter && !loading" :name="iconAfter" :size="size === 's' ? 16 : 18" />
  </component>
</template>

<script setup>
import { computed, useSlots } from 'vue';
import { RouterLink } from 'vue-router';
import TbIcon from './TbIcon.vue';

// variant: primary (the one orange action), secondary (ink outline), quiet (text), danger
const props = defineProps({
  variant: { type: String, default: 'secondary' },
  size: { type: String, default: 'm' },
  icon: { type: String, default: '' },
  iconAfter: { type: String, default: '' },
  loading: Boolean,
  disabled: Boolean,
  block: Boolean,
  nativeType: { type: String, default: 'button' },
  to: { type: [String, Object], default: null },
  href: { type: String, default: '' },
});
const slots = useSlots();
const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : 'button'));
const iconOnly = computed(() => !slots.default && (props.icon || props.loading));
// Only the attribute the element needs: an `href: null` would also wipe the href RouterLink renders
// (an <a> without href is not focusable from the keyboard).
const target = computed(() => (props.to ? { to: props.to } : props.href ? { href: props.href } : {}));
</script>

<style>
.tb-btn {
  --h: 40px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: var(--h); padding: 0 16px;
  border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-pill);
  background: transparent; color: var(--tb-ink);
  font: 600 var(--tb-fs-14)/1 var(--tb-font-text); text-decoration: none; white-space: nowrap;
  transition: background-color var(--tb-t-hover) var(--tb-ease), color var(--tb-t-hover) var(--tb-ease),
    border-color var(--tb-t-hover) var(--tb-ease), transform var(--tb-t-hover) var(--tb-ease);
  -webkit-tap-highlight-color: transparent;
}
.tb-btn--s { --h: 32px; padding: 0 12px; font-size: var(--tb-fs-13); }
.tb-btn--l { --h: 48px; padding: 0 22px; font-size: var(--tb-fs-15); }
.tb-btn.is-block { display: flex; width: 100%; }
.tb-btn.is-icon-only { width: var(--h); padding: 0; }
.tb-btn:active:not(:disabled) { transform: translateY(1px); }
.tb-btn:disabled, .tb-btn[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }

.tb-btn--primary { background: var(--tb-action); border-color: var(--tb-action); color: var(--tb-on-action); }
.tb-btn--quiet { border-color: transparent; padding: 0 10px; }
.tb-btn--danger { border-color: var(--tb-danger); color: var(--tb-danger); }
/* A disabled primary is drawn as an empty outline: orange at 45% turns brown on the dark ground.
   A primary that is sending (aria-busy) keeps its orange. */
.tb-btn--primary:disabled:not([aria-busy="true"]),
.tb-btn--primary[aria-disabled="true"]:not([aria-busy="true"]) {
  opacity: 1; background: transparent; border-color: var(--tb-rule); color: var(--tb-ink-3);
}
.tb-btn--primary[aria-busy="true"] { opacity: 1; }

/* Touch: every button reaches the 44px target, small ones 40px. */
@media (pointer: coarse) {
  .tb-btn { --h: var(--tb-target); }
  .tb-btn--s { --h: 40px; }
}

@media (hover: hover) and (pointer: fine) {
  .tb-btn--secondary:hover:not(:disabled) { background: var(--tb-ink); color: var(--tb-paper); }
  .tb-btn--primary:hover:not(:disabled) { background: var(--tb-action-hover); border-color: var(--tb-action-hover); }
  .tb-btn--quiet:hover:not(:disabled) { background: var(--tb-paper-2); }
  .tb-btn--danger:hover:not(:disabled) { background: var(--tb-danger); color: var(--tb-paper); }
}
.tb-btn__spin {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: tb-spin .8s linear infinite;
}
@keyframes tb-spin { to { transform: rotate(360deg); } }
</style>
