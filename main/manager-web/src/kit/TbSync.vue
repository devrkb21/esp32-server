<template>
  <span class="tb-sync" :class="`is-${state}`" role="status">
    <i class="tb-sync__rule" aria-hidden="true"></i>{{ text }}
  </span>
</template>

<script setup>
// Has this reached TinyBot? The rule's own form says it, always with its word:
// applied = solid, pending = dashed, off = struck, error = red solid.
defineProps({
  state: { type: String, default: 'applied' }, // applied | pending | off | error
  text: { type: String, default: '' },
});
</script>

<style>
.tb-sync { display: inline-flex; align-items: center; gap: 8px; font-size: var(--tb-fs-13); color: var(--tb-ink-2); white-space: nowrap; }
.tb-sync__rule { width: 22px; height: 0; border-top: 2px solid var(--tb-ok); }
.tb-sync.is-pending .tb-sync__rule { border-top-style: dashed; border-color: var(--tb-ink-2); }
.tb-sync.is-off .tb-sync__rule { border-color: var(--tb-ink-3); position: relative; }
.tb-sync.is-off { text-decoration: line-through; text-decoration-color: var(--tb-ink-3); }
.tb-sync.is-error { color: var(--tb-danger); }
.tb-sync.is-error .tb-sync__rule { border-color: var(--tb-danger); }
</style>
