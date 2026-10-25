<template>
  <div class="tb-plate">
    <p class="tb-plate__name">{{ name }}</p>
    <p v-if="doing" class="tb-plate__doing">{{ doing }}</p>
    <p v-if="detail" class="tb-plate__detail">{{ detail }}</p>
    <p class="tb-plate__state" :class="`is-${state}`"><i aria-hidden="true"></i>{{ stateText }}</p>
  </div>
</template>

<script setup>
// TinyBot's name plate: its name, what it is doing now, days together, and its connection state
// (online, offline, sleeping, updating, and the connection states of src/shell/connection.mjs:
// checking, waiting_companion, not_syncing, server_error), always as a word next to the mark.
defineProps({
  name: { type: String, default: 'TinyBot' },
  doing: { type: String, default: '' },
  detail: { type: String, default: '' },
  state: { type: String, default: 'online' },
  stateText: { type: String, default: '' },
});
</script>

<style>
.tb-plate { display: grid; gap: 1px; min-width: 0; }
.tb-plate__name { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-18); }
.tb-plate__doing { font-size: var(--tb-fs-14); }
.tb-plate__detail { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.tb-plate__state { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; font-size: var(--tb-fs-13); font-weight: 600; }
.tb-plate__state i { width: 8px; height: 8px; border-radius: 50%; background: var(--tb-ok); }
.tb-plate__state.is-offline i { background: transparent; border: 1.5px solid var(--tb-ink-3); }
.tb-plate__state.is-offline { color: var(--tb-ink-2); }
.tb-plate__state.is-sleeping i { background: var(--tb-message); }
.tb-plate__state.is-updating i { background: var(--tb-routine-mark); }
.tb-plate__state.is-waiting_companion i, .tb-plate__state.is-not_syncing i { background: var(--tb-warn); }
.tb-plate__state.is-server_error i { background: var(--tb-danger); }
.tb-plate__state.is-checking i { background: transparent; border: 1.5px solid var(--tb-ink-3); }
.tb-plate__state.is-checking { color: var(--tb-ink-2); }
</style>
