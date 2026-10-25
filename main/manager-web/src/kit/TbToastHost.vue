<template>
  <div class="tb-toasts" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="tb-toast">
      <div v-for="t in toastState.items" :key="t.id" class="tb-toast" :class="`is-${t.kind}`" :role="t.kind === 'error' ? 'alert' : 'status'">
        <TbIcon :name="icon(t.kind)" :size="18" />
        <span class="tb-toast__msg">{{ t.message }}</span>
        <button type="button" class="tb-toast__x" :aria-label="closeLabel" @click="dismiss(t.id)"><TbIcon name="close" :size="16" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { dismiss, toastState } from './toast';
import TbIcon from './TbIcon.vue';

defineProps({ closeLabel: { type: String, default: 'Close' } });
const icon = (k) => ({ success: 'check', error: 'warning', warning: 'warning', info: 'info' }[k] || 'info');
</script>

<style>
.tb-toasts { position: fixed; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 1100;
  display: grid; gap: 8px; width: min(440px, calc(100vw - 32px)); pointer-events: none; }
@media (max-width: 899px) { .tb-toasts { bottom: calc(92px + env(safe-area-inset-bottom)); } }
.tb-toast {
  pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 10px 8px 10px 14px;
  background: var(--tb-ink); color: var(--tb-paper); border-radius: var(--tb-radius-m); box-shadow: var(--tb-shadow-sheet);
  border-left: 0; font-size: var(--tb-fs-14);
}
.tb-toast.is-success .tb-icon:first-child { color: var(--tb-toast-ok); }
.tb-toast.is-error .tb-icon:first-child { color: var(--tb-toast-danger); }
.tb-toast.is-warning .tb-icon:first-child { color: var(--tb-toast-warn); }
.tb-toast__msg { flex: 1; }
.tb-toast__x { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 6px; background: transparent; color: inherit; opacity: .7; }
.tb-toast__x:hover { opacity: 1; }
.tb-toast-enter-active { transition: opacity var(--tb-t-sheet) var(--tb-ease), transform var(--tb-t-sheet) var(--tb-ease); }
.tb-toast-leave-active { transition: opacity var(--tb-t-fast) var(--tb-ease-in); }
.tb-toast-enter-from { opacity: 0; transform: translateY(10px); }
.tb-toast-leave-to { opacity: 0; }
</style>
