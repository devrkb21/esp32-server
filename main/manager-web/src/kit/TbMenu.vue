<template>
  <div class="tb-menu" ref="root">
    <span @click="toggle" @keydown.down.prevent="openAndFocus"><slot name="trigger" :open="open" /></span>
    <Transition name="tb-pop">
      <ul v-if="open" class="tb-menu__list" :class="`is-${align}`" role="menu" @keydown="onKey">
        <li v-for="(it, i) in items" :key="it.key || i" role="none">
          <hr v-if="it.divider" />
          <button v-else type="button" role="menuitem" class="tb-menu__item" :class="{ 'is-danger': it.danger }"
            :disabled="it.disabled" @click="pick(it)">
            <TbIcon v-if="it.icon" :name="it.icon" :size="18" />{{ it.label }}
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import TbIcon from './TbIcon.vue';

// An action menu. items: [{ key, label, icon, danger, disabled } | { divider: true }].
const props = defineProps({ items: { type: Array, default: () => [] }, align: { type: String, default: 'end' } });
const emit = defineEmits(['select']);
const open = ref(false);
const root = ref(null);
function toggle() { open.value = !open.value; }
async function openAndFocus() { open.value = true; await nextTick(); root.value?.querySelector('.tb-menu__item')?.focus(); }
function pick(it) { open.value = false; emit('select', it.key, it); }
function onKey(e) {
  const btns = [...root.value.querySelectorAll('.tb-menu__item:not(:disabled)')];
  const i = btns.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
  if (e.key === 'Escape') { open.value = false; root.value.querySelector('button')?.focus(); }
}
function outside(e) { if (open.value && root.value && !root.value.contains(e.target)) open.value = false; }
onMounted(() => document.addEventListener('pointerdown', outside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
void props;
</script>

<style>
.tb-menu { position: relative; display: inline-block; }
.tb-menu__list {
  position: absolute; top: calc(100% + 6px); z-index: 50; min-width: 200px; margin: 0; padding: 6px; list-style: none;
  background: var(--tb-paper); border: 1px solid var(--tb-rule); border-radius: var(--tb-radius-m); box-shadow: var(--tb-shadow-sheet);
}
.tb-menu__list.is-end { right: 0; } .tb-menu__list.is-start { left: 0; }
.tb-menu__list hr { margin: 6px 0; }
.tb-menu__item {
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 0 10px;
  border: 0; border-radius: 6px; background: none; text-align: left; font-size: var(--tb-fs-14);
}
.tb-menu__item:hover, .tb-menu__item:focus-visible { background: var(--tb-paper-2); outline: none; }
.tb-menu__item.is-danger { color: var(--tb-danger); }
.tb-menu__item:disabled { opacity: .45; }
.tb-pop-enter-active { transition: opacity var(--tb-t-fast) var(--tb-ease), transform var(--tb-t-fast) var(--tb-ease); }
.tb-pop-leave-active { transition: opacity 120ms var(--tb-ease-in); }
.tb-pop-enter-from { opacity: 0; transform: translateY(-4px); }
.tb-pop-leave-to { opacity: 0; }
</style>
