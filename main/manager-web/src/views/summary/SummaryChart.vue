<template>
  <figure ref="fig" class="sc" :style="{ '--ink': `var(--tb-${ink})` }">
    <p class="sc__read" aria-live="polite">
      <template v-if="hit">
        <b>{{ dayText(hit.date, true) }}</b> · {{ hit.value === null ? noData : valueText(hit.value) }}
      </template>
      <template v-else>{{ hint }}</template>
    </p>
    <svg class="sc__svg" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label"
      @mouseleave="hover = -1">
      <!-- recessive grid and the value axis -->
      <g class="sc__grid">
        <template v-for="tk in scale.ticks" :key="tk">
          <line :x1="box.x" :x2="box.x + box.w" :y1="yOf(tk)" :y2="yOf(tk)" />
          <text :x="box.x - 8" :y="yOf(tk) + 4" text-anchor="end">{{ digits(tk, lang) }}</text>
        </template>
      </g>
      <g class="sc__xaxis">
        <line :x1="box.x" :x2="box.x + box.w" :y1="box.y + box.h" :y2="box.y + box.h" />
        <template v-for="(p, i) in points" :key="p.day">
          <text v-if="i % labelEvery === (points.length - 1) % labelEvery" :x="xOf(i)" :y="H - 6" :text-anchor="i === points.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'">{{ dayText(p.date) }}</text>
        </template>
      </g>

      <g v-if="kind === 'bar'" class="sc__bars">
        <path v-for="(p, i) in points" :key="p.day" :d="bar(i, p.value)" :class="{ 'is-hit': i === hover }" />
      </g>
      <g v-else class="sc__line">
        <line v-if="hit" class="sc__cross" :x1="xOf(hover)" :x2="xOf(hover)" :y1="box.y" :y2="box.y + box.h" />
        <path :d="path" />
        <template v-for="(p, i) in points" :key="p.day">
          <circle v-if="p.value !== null && (i === hover || lonely(i))" :cx="xOf(i)" :cy="yOf(p.value)" r="4" />
        </template>
      </g>

      <!-- hit targets wider than the marks, one per day -->
      <rect v-for="(p, i) in points" :key="`h${p.day}`" class="sc__hit" :x="xOf(i) - slot / 2" :y="box.y" :width="slot" :height="box.h"
        tabindex="0" :aria-label="`${dayText(p.date, true)}: ${p.value === null ? noData : valueText(p.value)}`"
        @mouseenter="hover = i" @focus="hover = i" @blur="hover = -1" />
    </svg>
    <figcaption class="sc__cap">{{ caption }}</figcaption>
  </figure>
</template>

<script>
import { digits } from '@/kit/calendar';
import { barPath, linePath, niceRange, niceScale } from './summaryModel';

// One measure over the last 30 days as hand-drawn SVG: a 2px line (bond) or bars with 4px rounded
// tops (focus minutes). Days without a summary stay empty (a gap, never a zero). A readout above
// the plot answers hover and keyboard focus; the day rows under the charts are the table view.
export default {
  name: 'SummaryChart',
  props: {
    points: { type: Array, default: () => [] },   // [{ day, date, value | null }], oldest first
    kind: { type: String, default: 'line' },      // line | bar
    ink: { type: String, default: 'ink' },
    label: { type: String, default: '' },
    caption: { type: String, default: '' },
    hint: { type: String, default: '' },
    noData: { type: String, default: '' },
    format: { type: Function, default: null },
    lang: { type: String, default: 'bn' },
  },
  data() { return { W: 640, H: 210, hover: -1, ro: null }; },
  // the drawing is as wide as its place, so text keeps its size on a phone and on a desktop
  mounted() {
    const fit = () => { const w = this.$refs.fig && this.$refs.fig.clientWidth; if (w) this.W = Math.max(280, Math.round(w)); };
    fit();
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(fit); this.ro.observe(this.$refs.fig); }
  },
  beforeUnmount() { if (this.ro) this.ro.disconnect(); },
  computed: {
    box() { return { x: 44, y: 12, w: this.W - 56, h: this.H - 44 }; },
    max() { return Math.max(0, ...this.points.map((p) => (p.value === null ? 0 : p.value))); },
    vals() { return this.points.map((p) => p.value).filter((v) => v !== null); },
    // bars start at zero; a line spans the values it has
    scale() {
      if (this.kind === 'bar' || !this.vals.length) return { lo: 0, ...niceScale(this.max) };
      return niceRange(Math.min(...this.vals), Math.max(...this.vals));
    },
    // bars sit in equal slots inside the plot; a line runs edge to edge
    slot() {
      const n = this.points.length;
      if (this.kind === 'bar') return n ? this.box.w / n : this.box.w;
      return n > 1 ? this.box.w / (n - 1) : this.box.w;
    },
    path() { return linePath(this.points.map((p) => p.value), this.box, this.scale.top, this.scale.lo); },
    hit() { return this.hover >= 0 ? this.points[this.hover] : null; },
    labelEvery() { return this.W < 480 ? 10 : 7; },
  },
  methods: {
    digits,
    xOf(i) {
      if (this.kind === 'bar') return this.box.x + (i + 0.5) * this.slot;
      return this.box.x + (this.points.length > 1 ? (i * this.box.w) / (this.points.length - 1) : this.box.w / 2);
    },
    yOf(v) {
      const { lo, top } = this.scale;
      return this.box.y + this.box.h - ((Math.min(Math.max(v, lo), top) - lo) / (top - lo)) * this.box.h;
    },
    bar(i, v) {
      if (v === null || !v) return '';
      const w = Math.max(3, this.slot - 2 - 2); // 2px gap between bars
      const h = (Math.min(v, this.scale.top) / this.scale.top) * this.box.h;
      return barPath(this.xOf(i) - w / 2, this.box.y + this.box.h, w, h);
    },
    // a value with no neighbour has no line to show it: draw its point
    lonely(i) {
      const v = (k) => (this.points[k] ? this.points[k].value : null);
      return v(i) !== null && v(i - 1) === null && v(i + 1) === null;
    },
    valueText(v) { return this.format ? this.format(v) : digits(v, this.lang); },
    dayText(date, long) {
      return new Intl.DateTimeFormat(this.lang === 'bn' ? 'bn-BD' : 'en-GB', long ? { weekday: 'short', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' }).format(date);
    },
  },
};
</script>

<style>
.sc { margin: 0; display: grid; gap: 6px; }
.sc__read { min-height: 1.6em; font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.sc__read b { color: var(--tb-ink); font-weight: 700; }
.sc__svg { display: block; width: 100%; height: 210px; overflow: visible; }
.sc__grid line { stroke: var(--tb-rule-soft); stroke-width: 1; vector-effect: non-scaling-stroke; }
.sc__grid text, .sc__xaxis text { fill: var(--tb-ink-2); font: 500 12px var(--tb-font-text); font-variant-numeric: tabular-nums; }
.sc__xaxis line { stroke: var(--tb-rule); stroke-width: 1; vector-effect: non-scaling-stroke; }
.sc__line path { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.sc__line circle { fill: var(--ink); stroke: var(--tb-paper); stroke-width: 2; }
.sc__cross { stroke: var(--tb-ink-3); stroke-width: 1; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
.sc__bars path { fill: var(--ink); opacity: .85; transition: opacity var(--tb-t-hover) var(--tb-ease); }
.sc__bars path.is-hit { opacity: 1; }
.sc__hit { fill: transparent; outline: none; }
.sc__hit:focus-visible { fill: var(--tb-paper-2); fill-opacity: .6; }
.sc__cap { font-size: var(--tb-fs-13); color: var(--tb-ink-2); max-width: 70ch; }
</style>
