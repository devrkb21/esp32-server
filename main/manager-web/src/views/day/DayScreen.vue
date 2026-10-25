<template>
  <figure class="day-screen">
    <canvas ref="oled" :width="W * SCALE" :height="H * SCALE" role="img" :aria-label="alt"></canvas>
  </figure>
</template>

<script>
import {
  H, LIFE_DURATION, MEAL_CYCLE_MS, MEALS, W, activityAnim, createCanvas, createLiveliness, paintToContext,
  renderActivityFrame, renderActivityStill,
} from '@/utils/faceLook.mjs';

const SCALE = 4;

// TinyBot's OLED doing one daily-life activity, drawn by the same renderer as the robot's
// face. It plays the activity once when it changes (or when `replay` is called) and then rests
// on its still frame: no endless loop. Reduced motion: the still frame only.
export default {
  name: 'DayScreen',
  props: {
    activity: { type: String, default: 'exercise' },
    look: { type: Object, default: null },
    animate: { type: Boolean, default: false },
    alt: { type: String, default: 'TinyBot' },
  },
  emits: ['playing'],
  data() { return { W, H, SCALE }; },
  watch: {
    activity() { this.animate ? this.replay() : this.still(); },
    look: { deep: true, handler() { if (!this.raf) this.still(); } },
  },
  created() {
    this.frame = createCanvas();
    this.raf = 0;
  },
  mounted() {
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = !!(mq && mq.matches);
    if (this.animate) this.replay(); else this.still();
  },
  beforeUnmount() { this.stop(); },
  methods: {
    ctx() {
      const c = this.$refs.oled;
      try { return c && c.getContext ? c.getContext('2d') : null; } catch (e) { return null; }
    },
    still() {
      const ctx = this.ctx();
      if (!ctx) return;
      renderActivityStill(this.activity, this.look, this.frame);
      // OLED pixels: white on the black panel, whatever the theme
      paintToContext(ctx, this.frame, SCALE, 'white', 'black');
    },
    stop() {
      if (this.raf) window.cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.$emit('playing', false);
    },
    /** Plays the activity once, then rests on its still frame. */
    replay() {
      this.stop();
      if (this.reduced || typeof window.requestAnimationFrame !== 'function') { this.still(); return; }
      const anim = activityAnim(this.activity, 0);
      if (!anim) { this.still(); return; }
      const length = MEALS.includes(this.activity) ? MEAL_CYCLE_MS
        : Math.min(12000, Math.max(4000, LIFE_DURATION[anim] * 2000));
      const live = createLiveliness(Math.random, 0);
      let start = 0;
      const tick = (ts) => {
        if (!start) start = ts;
        const t = ts - start;
        const ctx = this.ctx();
        if (!ctx || t >= length || document.hidden) { this.raf = 0; this.still(); this.$emit('playing', false); return; }
        renderActivityFrame(this.activity, this.look, t, live, t, this.frame);
        paintToContext(ctx, this.frame, SCALE, 'white', 'black');
        this.raf = window.requestAnimationFrame(tick);
      };
      this.$emit('playing', true);
      this.raf = window.requestAnimationFrame(tick);
    },
  },
};
</script>

<style>
.day-screen { margin: 0; background: var(--tb-face); border-radius: var(--tb-radius-s); padding: 5%; }
.day-screen canvas { display: block; width: 100%; height: auto; aspect-ratio: 2 / 1; image-rendering: pixelated; }
</style>
