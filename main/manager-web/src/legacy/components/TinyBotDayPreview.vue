<template>
  <div class="tdp">
    <div class="tdp-oled">
      <canvas ref="oled" class="tdp-oled__screen" :width="W * SCALE" :height="H * SCALE" role="img"
        :aria-label="$t('companion.routine.previewAlt', { activity: $t('companion.routine.activity.' + value) })"></canvas>
    </div>
    <div class="tdp-picker" role="radiogroup" :aria-label="$t('companion.routine.previewPick')">
      <button v-for="a in activities" :key="a" type="button" role="radio" class="tdp-pick"
        :class="{ 'is-active': value === a, 'is-now': nowActivity === a }" :aria-checked="value === a ? 'true' : 'false'"
        :title="nowActivity === a ? $t('companion.routine.scheduledNowShort') : null" @click="pick(a)">
        <span class="tdp-pick__icon" aria-hidden="true">{{ icons[a] }}</span>
        <span class="tdp-pick__name">{{ $t('companion.routine.activity.' + a) }}</span>
      </button>
    </div>
    <p v-if="isMeal" class="tdp-help">{{ $t('companion.routine.mealHint') }}</p>
    <p class="tdp-help">{{ reducedMotion ? $t('companion.routine.previewStatic') : $t('companion.routine.previewHint') }}</p>
  </div>
</template>

<script>
import {
  ACTIVITIES,
  ACTIVITY_ICON,
  H,
  MEALS,
  W,
  createCanvas,
  createLiveliness,
  paintToContext,
  renderActivityFrame,
  renderActivityStill,
} from '@/utils/faceLook.mjs';

const SCALE = 4;
// OLED hardware colours (white pixels on a near-black panel), not theme tokens
const PIXEL_ON = '#f2f6fa';
const PIXEL_OFF = '#06080b';

export default {
  name: 'TinyBotDayPreview',
  props: {
    // Activity shown (settings.routine activity key)
    value: { type: String, default: 'exercise' },
    // settings.look of the robot, so the preview has its eyes and paws
    look: { type: Object, default: null },
    // What the day has scheduled right now ('' = nothing): marked in the picker
    nowActivity: { type: String, default: '' },
  },
  data() {
    return {
      W,
      H,
      SCALE,
      activities: ACTIVITIES,
      icons: ACTIVITY_ICON,
      reducedMotion: false,
    };
  },
  computed: {
    isMeal() {
      return MEALS.includes(this.value);
    },
  },
  watch: {
    value() {
      this.start = this.now();
      this.draw();
    },
    look: {
      deep: true,
      handler() {
        this.draw();
      },
    },
  },
  created() {
    // Not reactive: drawing state for the animation loop
    this.frame = createCanvas();
    this.live = createLiveliness();
    this.start = 0;
    this.raf = 0;
  },
  mounted() {
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = !!(mq && mq.matches);
    this.start = this.now();
    this.live = createLiveliness(Math.random, this.start);
    this.draw();
    if (!this.reducedMotion) this.raf = window.requestAnimationFrame(this.tick);
  },
  beforeDestroy() {
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = 0;
  },
  methods: {
    now() {
      return typeof performance !== 'undefined' ? performance.now() : Date.now();
    },
    pick(a) {
      this.$emit('input', a);
    },
    draw(nowMs) {
      const canvas = this.$refs.oled;
      if (!canvas || !canvas.getContext) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const now = nowMs === undefined ? this.now() : nowMs;
      if (this.reducedMotion) {
        renderActivityStill(this.value, this.look, this.frame);
      } else {
        // meals show noodles, a sandwich and an apple in turn
        renderActivityFrame(this.value, this.look, now - this.start, this.live, now, this.frame);
      }
      paintToContext(ctx, this.frame, SCALE, PIXEL_ON, PIXEL_OFF);
    },
    tick(ts) {
      if (!document.hidden) this.draw(ts);
      this.raf = window.requestAnimationFrame(this.tick);
    },
  },
};
</script>

<style lang="scss" scoped>
.tdp {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
  min-width: 0;
}

.tdp-oled {
  padding: var(--nx-space-3);
  border-radius: var(--nx-radius-lg);
  background: #15181d; // robot bezel, hardware colour
  box-shadow: var(--nx-shadow-2);
}

.tdp-oled__screen {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 1;
  border-radius: var(--nx-radius-sm);
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  background: #06080b;
}

.tdp-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: var(--nx-space-2);
}

.tdp-pick {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  min-width: 0;
  min-height: 36px;
  padding: 0 var(--nx-space-3);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius);
  background: var(--nx-surface);
  color: var(--nx-text-2);
  font: inherit;
  font-size: var(--nx-text-footnote);
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--nx-dur-1) var(--nx-ease),
    border-color var(--nx-dur-1) var(--nx-ease),
    color var(--nx-dur-1) var(--nx-ease);

  &:hover {
    background: var(--nx-surface-2);
  }

  &:focus-visible {
    outline: 2px solid var(--nx-accent);
    outline-offset: 2px;
  }

  &.is-active {
    border-color: var(--nx-accent);
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-weight: 600;
  }

  // scheduled right now: a small dot
  &.is-now::after {
    content: '';
    position: absolute;
    top: 5px;
    right: 5px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--nx-success);
  }
}

.tdp-pick__icon {
  flex: none;
  font-size: 15px;
  line-height: 1;
}

.tdp-pick__name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tdp-help {
  margin: 0;
  font-size: var(--nx-text-caption);
  line-height: 1.4;
  color: var(--nx-text-3);
}

@media (prefers-reduced-motion: reduce) {
  .tdp-pick {
    transition: none;
  }
}
</style>
