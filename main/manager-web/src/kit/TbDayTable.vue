<template>
  <div class="tb-day">
    <table>
      <caption class="tb-visually-hidden">{{ caption }}</caption>
      <tbody>
        <template v-for="(r, i) in withNow" :key="r.key || i">
          <tr v-if="r.now" class="tb-day__now" :style="{ '--y': 0 }">
            <td class="tb-day__t">{{ r.timeText }}</td>
            <td colspan="3"><span class="tb-day__nowlabel">{{ nowLabel }}</span></td>
          </tr>
          <tr v-else class="tb-day__row" :class="[`ink-${r.ink || 'ink'}`, { 'is-past': r.past, 'is-pending': r.sync === 'pending', 'is-off': r.sync === 'off' }]"
            :tabindex="clickable ? 0 : null" @click="clickable && $emit('select', r)" @keydown.enter="clickable && $emit('select', r)">
            <td class="tb-day__t">{{ r.timeText }}</td>
            <td class="tb-day__k"><i aria-hidden="true"></i></td>
            <td class="tb-day__x">{{ r.title }}<small v-if="r.note">{{ r.note }}</small></td>
            <td class="tb-day__s">{{ r.stateText }}</td>
          </tr>
        </template>
      </tbody>
    </table>
    <p v-if="!rows.length" class="tb-day__empty">{{ emptyText }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { minutesOf, timeText } from './calendar';

// The day as an almanac table. rows: [{ key, time 'HH:MM', title, note, ink (prayer|alarm|
// routine|message|look), stateText, sync (applied|pending|off) }]. The orange now rule sits at
// the current minute (`nowMinutes`), between the rows before and after it.
const props = defineProps({
  rows: { type: Array, default: () => [] },
  lang: { type: String, default: 'bn' },
  nowMinutes: { type: Number, default: -1 },
  nowLabel: { type: String, default: 'Now' },
  caption: { type: String, default: '' },
  emptyText: { type: String, default: '' },
  clickable: Boolean,
});
defineEmits(['select']);
const withNow = computed(() => {
  const sorted = [...props.rows].sort((a, b) => minutesOf(a.time) - minutesOf(b.time))
    .map((r) => ({ ...r, timeText: timeText(r.time, props.lang, props.lang === 'bn'), past: props.nowMinutes >= 0 && minutesOf(r.time) < props.nowMinutes }));
  if (props.nowMinutes < 0) return sorted;
  const at = sorted.findIndex((r) => minutesOf(r.time) > props.nowMinutes);
  const h = Math.floor(props.nowMinutes / 60); const m = props.nowMinutes % 60;
  const now = { now: true, key: '__now', timeText: timeText(`${h}:${m}`, props.lang, props.lang === 'bn') };
  if (at < 0) sorted.push(now); else sorted.splice(at, 0, now);
  return sorted;
});
</script>

<style>
.tb-day table { width: 100%; }
.tb-day td { padding: 9px 0; border-top: 1px solid var(--tb-rule); vertical-align: baseline; }
.tb-day__t { width: 74px; font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-16); white-space: nowrap; }
.tb-day__k { width: 18px; } .tb-day__k i { display: inline-block; width: 8px; height: 8px; background: var(--ink, var(--tb-ink)); }
.tb-day__x { font-size: var(--tb-fs-15); } .tb-day__x small { display: block; font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.tb-day__s { text-align: right; font-size: var(--tb-fs-12); color: var(--tb-ink-2); padding-left: 8px; white-space: nowrap; }
.tb-day__row { transition: background-color var(--tb-t-hover) var(--tb-ease); }
.tb-day__row[tabindex] { cursor: pointer; }
@media (hover: hover) and (pointer: fine) { .tb-day__row[tabindex]:hover { background: var(--tb-paper-2); } }
.tb-day__row.ink-prayer { --ink: var(--tb-prayer); } .tb-day__row.ink-prayer .tb-day__t, .tb-day__row.ink-prayer .tb-day__x { color: var(--tb-prayer); }
.tb-day__row.ink-alarm { --ink: var(--tb-alarm); } .tb-day__row.ink-alarm .tb-day__t { color: var(--tb-alarm); }
.tb-day__row.ink-routine { --ink: var(--tb-routine-mark); }
.tb-day__row.ink-message { --ink: var(--tb-message); }
.tb-day__row.ink-look { --ink: var(--tb-look); }
.tb-day__row.is-past .tb-day__x, .tb-day__row.is-past .tb-day__t { opacity: .62; }
.tb-day__row.is-pending td { border-top-style: dashed; }
.tb-day__row.is-off .tb-day__x { text-decoration: line-through; color: var(--tb-ink-3); }
.tb-day__now td { border-top: 2px solid var(--tb-orange); padding: 4px 0; }
.tb-day__now .tb-day__t { color: var(--tb-action); font-size: var(--tb-fs-13); }
.tb-day__nowlabel { font-size: var(--tb-fs-12); font-weight: 600; color: var(--tb-action); }
.tb-day__empty { color: var(--tb-ink-2); padding: var(--tb-s4) 0; border-top: 1px solid var(--tb-rule); }
</style>
