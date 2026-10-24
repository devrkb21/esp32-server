<template>
  <Teleport to="body">
    <Transition name="tb-sheet">
      <div v-if="open" class="tb-sheet" :class="[`tb-sheet--${size}`]" @keydown.esc.stop="onEsc">
        <div class="tb-sheet__scrim" @click="closeOnScrim && close()"></div>
        <section ref="panel" class="tb-sheet__panel" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
          <header class="tb-sheet__head">
            <h2 :id="titleId" class="tb-sheet__title">{{ title }}</h2>
            <TbButton variant="quiet" icon="close" :aria-label="closeLabel" @click="close" />
          </header>
          <div class="tb-sheet__body"><slot /></div>
          <footer v-if="$slots.footer" class="tb-sheet__foot"><slot name="footer" /></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import TbButton from './TbButton.vue';

// A dialog: a bottom sheet on phones, a centred panel on wider screens. v-model:open.
const props = defineProps({
  open: Boolean,
  title: { type: String, default: '' },
  size: { type: String, default: 'm' }, // s | m | l
  closeOnScrim: { type: Boolean, default: true },
  closeOnEsc: { type: Boolean, default: true },
  closeLabel: { type: String, default: 'Close' },
});
const emit = defineEmits(['update:open', 'close']);
const panel = ref(null);
const titleId = `tb-sheet-${Math.random().toString(36).slice(2, 8)}`;
let lastFocus = null;

function close() { emit('update:open', false); emit('close'); }
function onEsc() { if (props.closeOnEsc) close(); }
function trap(e) {
  if (e.key !== 'Tab' || !panel.value) return;
  const f = panel.value.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!f.length) return;
  const first = f[0]; const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
watch(() => props.open, async (v) => {
  if (v) {
    lastFocus = document.activeElement;
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', trap);
    await nextTick();
    const auto = panel.value?.querySelector('[autofocus], input, select, textarea');
    (auto || panel.value)?.focus();
  } else {
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', trap);
    lastFocus?.focus?.();
  }
}, { immediate: true });
onBeforeUnmount(() => { document.documentElement.style.overflow = ''; document.removeEventListener('keydown', trap); });
</script>

<style>
.tb-sheet { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: var(--tb-s6); }
.tb-sheet__scrim { position: absolute; inset: 0; background: rgba(27, 23, 20, .42); }
.tb-sheet__panel {
  position: relative; width: min(560px, 100%); max-height: min(86vh, 900px); display: flex; flex-direction: column;
  background: var(--tb-paper); border-top: var(--tb-rule-band) solid var(--tb-rule); border-radius: var(--tb-radius-m);
  box-shadow: var(--tb-shadow-sheet); outline: none;
}
.tb-sheet--s .tb-sheet__panel { width: min(420px, 100%); }
.tb-sheet--l .tb-sheet__panel { width: min(860px, 100%); }
.tb-sheet__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 12px 10px 20px; border-bottom: 1px solid var(--tb-rule-soft); }
.tb-sheet__title { font-size: var(--tb-fs-20); }
.tb-sheet__body { padding: 18px 20px; overflow-y: auto; display: grid; gap: var(--tb-s4); }
.tb-sheet__foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 20px 16px; border-top: 1px solid var(--tb-rule-soft); flex-wrap: wrap; }

@media (max-width: 640px) {
  .tb-sheet { place-items: end stretch; padding: 0; }
  .tb-sheet__panel { width: 100% !important; max-height: 92vh; border-radius: 14px 14px 0 0; padding-bottom: env(safe-area-inset-bottom); }
  .tb-sheet__foot > * { flex: 1; }
}

.tb-sheet-enter-active .tb-sheet__panel { transition: transform var(--tb-t-sheet) var(--tb-ease), opacity var(--tb-t-sheet) var(--tb-ease); }
.tb-sheet-leave-active .tb-sheet__panel { transition: transform var(--tb-t-fast) var(--tb-ease-in), opacity var(--tb-t-fast) var(--tb-ease-in); }
.tb-sheet-enter-active .tb-sheet__scrim, .tb-sheet-leave-active .tb-sheet__scrim { transition: opacity var(--tb-t-sheet) var(--tb-ease); }
.tb-sheet-enter-active, .tb-sheet-leave-active { transition: opacity var(--tb-t-sheet); }
.tb-sheet-enter-from .tb-sheet__panel, .tb-sheet-leave-to .tb-sheet__panel { transform: translateY(16px); opacity: 0; }
.tb-sheet-enter-from .tb-sheet__scrim, .tb-sheet-leave-to .tb-sheet__scrim { opacity: 0; }
</style>
