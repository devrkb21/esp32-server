<template>
  <section class="nx-card tl" aria-labelledby="tl-title">
    <header class="nx-card__header tl-head">
      <div class="tl-min">
        <h2 id="tl-title" class="tl-card-title">{{ $t('look.title') }}</h2>
        <p class="tl-sub">{{ $t('look.desc') }}</p>
      </div>
      <span v-if="deviceId && online === false" class="nx-badge nx-badge--warning" role="status">
        <span class="nx-dot" aria-hidden="true"></span>{{ $t('companion.offline') }}
      </span>
    </header>

    <div v-if="!deviceId" class="tl-note tl-note--info" role="status">
      <i class="el-icon-info" aria-hidden="true"></i>
      <span>{{ $t('look.noDevice') }}</span>
    </div>
    <div v-else-if="loadError" class="tl-note tl-note--warning" role="alert">
      <i class="el-icon-warning-outline" aria-hidden="true"></i>
      <span class="tl-note__text">{{ loadError }}</span>
      <el-button size="mini" @click="load">{{ $t('look.retry') }}</el-button>
    </div>
    <div v-else-if="online === false" class="tl-note tl-note--warning" role="status">
      <i class="el-icon-warning-outline" aria-hidden="true"></i>
      <span>{{ $t('look.offline') }}</span>
    </div>

    <div class="tl-layout">
      <!-- ============================================================ Preview -->
      <div class="tl-preview">
        <div class="tl-screens">
          <!-- Simulated: drawn here from the settings being edited -->
          <div class="tl-sim">
            <h3 class="tl-screen-label">{{ $t('look.previewLabel') }}</h3>
            <div class="tl-oled">
              <canvas ref="oled" class="tl-oled__screen" :width="W * SCALE" :height="H * SCALE" role="img"
                :aria-label="$t('look.previewAlt', { mood: $t('look.mood.' + mood) })"></canvas>
            </div>
          </div>
          <!-- Real: what the robot shows right now (saved settings) -->
          <TinyBotLiveScreen v-if="deviceId" compact :device-id="deviceId" />
        </div>
        <div class="nx-segmented tl-moods" role="radiogroup" :aria-label="$t('look.moodLabel')">
          <button v-for="m in moods" :key="m" type="button" role="radio" :aria-checked="mood === m ? 'true' : 'false'"
            :class="{ 'is-active': mood === m }" @click="setMood(m)">{{ $t('look.mood.' + m) }}</button>
        </div>
        <p class="tl-help">{{ reducedMotion ? $t('look.previewStatic') : $t('look.previewHint') }}</p>
      </div>

      <!-- ============================================================ Controls -->
      <div class="tl-controls" :aria-busy="loading ? 'true' : 'false'">
        <div class="tl-field">
          <span id="tl-shape" class="tl-label">{{ $t('look.shapeLabel') }}</span>
          <div class="nx-segmented tl-seg" role="radiogroup" aria-labelledby="tl-shape">
            <button v-for="v in choices.shape" :key="v" type="button" role="radio" :disabled="busy"
              :aria-checked="form.shape === v ? 'true' : 'false'" :class="{ 'is-active': form.shape === v }"
              @click="form.shape = v">{{ $t('look.shape.' + v) }}</button>
          </div>
        </div>

        <div class="tl-field">
          <div class="tl-label-row">
            <span id="tl-size" class="tl-label">{{ $t('look.size') }}</span>
            <span class="tl-value nx-num">{{ $t('look.sizeValue', { n: form.size }) }}</span>
          </div>
          <el-slider v-model="form.size" :min="ranges.size[0]" :max="ranges.size[1]" :step="5" :show-tooltip="false"
            :disabled="busy" aria-labelledby="tl-size" class="tl-slider" />
        </div>

        <div class="tl-field">
          <div class="tl-label-row">
            <span id="tl-spacing" class="tl-label">{{ $t('look.spacing') }}</span>
            <span class="tl-value nx-num">{{ signed(form.spacing) }}</span>
          </div>
          <el-slider v-model="form.spacing" :min="ranges.spacing[0]" :max="ranges.spacing[1]" :step="1"
            :show-tooltip="false" :disabled="busy" aria-labelledby="tl-spacing" class="tl-slider" />
          <div class="tl-ends" aria-hidden="true">
            <span>{{ $t('look.spacingCloser') }}</span><span>{{ $t('look.spacingWider') }}</span>
          </div>
        </div>

        <div class="tl-field">
          <div class="tl-label-row">
            <span id="tl-height" class="tl-label">{{ $t('look.height') }}</span>
            <span class="tl-value nx-num">{{ signed(form.height) }}</span>
          </div>
          <el-slider v-model="form.height" :min="ranges.height[0]" :max="ranges.height[1]" :step="1"
            :show-tooltip="false" :disabled="busy" aria-labelledby="tl-height" class="tl-slider" />
          <div class="tl-ends" aria-hidden="true">
            <span>{{ $t('look.heightUp') }}</span><span>{{ $t('look.heightDown') }}</span>
          </div>
        </div>

        <div class="tl-field">
          <span id="tl-eyes" class="tl-label">{{ $t('look.eyesLabel') }}</span>
          <div class="nx-segmented tl-seg" role="radiogroup" aria-labelledby="tl-eyes">
            <button v-for="v in choices.eyes" :key="v" type="button" role="radio" :disabled="busy"
              :aria-checked="form.eyes === v ? 'true' : 'false'" :class="{ 'is-active': form.eyes === v }"
              @click="form.eyes = v">{{ $t('look.eyes.' + v) }}</button>
          </div>
        </div>

        <div class="tl-field">
          <span id="tl-mouth" class="tl-label">{{ $t('look.mouthLabel') }}</span>
          <div class="nx-segmented tl-seg" role="radiogroup" aria-labelledby="tl-mouth">
            <button v-for="v in choices.mouth" :key="v" type="button" role="radio" :disabled="busy"
              :aria-checked="form.mouth === v ? 'true' : 'false'" :class="{ 'is-active': form.mouth === v }"
              @click="form.mouth = v">{{ $t('look.mouth.' + v) }}</button>
          </div>
          <p class="tl-help">{{ $t('look.mouthHint') }}</p>
        </div>

        <div class="tl-field tl-switch">
          <span class="tl-switch__text">
            <span id="tl-blush" class="tl-label">{{ $t('look.blush') }}</span>
            <span class="tl-help">{{ $t('look.blushHint') }}</span>
          </span>
          <el-switch v-model="form.blush" :disabled="busy" aria-labelledby="tl-blush" />
        </div>

        <div class="tl-field tl-switch">
          <span class="tl-switch__text">
            <span id="tl-hands" class="tl-label">{{ $t('look.hands') }}</span>
            <span class="tl-help">{{ $t('look.handsHint') }}</span>
          </span>
          <el-switch v-model="form.hands" :disabled="busy" aria-labelledby="tl-hands" />
        </div>

        <div class="tl-field">
          <span id="tl-blink" class="tl-label">{{ $t('look.blinkLabel') }}</span>
          <div class="nx-segmented tl-seg" role="radiogroup" aria-labelledby="tl-blink">
            <button v-for="v in choices.blink" :key="v" type="button" role="radio" :disabled="busy"
              :aria-checked="form.blink === v ? 'true' : 'false'" :class="{ 'is-active': form.blink === v }"
              @click="form.blink = v">{{ $t('look.blink.' + v) }}</button>
          </div>
        </div>

        <div class="tl-field">
          <span id="tl-energy" class="tl-label">{{ $t('look.energyLabel') }}</span>
          <div class="nx-segmented tl-seg" role="radiogroup" aria-labelledby="tl-energy">
            <button v-for="v in choices.energy" :key="v" type="button" role="radio" :disabled="busy"
              :aria-checked="form.energy === v ? 'true' : 'false'" :class="{ 'is-active': form.energy === v }"
              @click="form.energy = v">{{ $t('look.energy.' + v) }}</button>
          </div>
          <p class="tl-help">{{ $t('look.energyHint') }}</p>
        </div>

        <div class="tl-field">
          <span id="tl-font" class="tl-label">{{ $t('look.fontLabel') }}</span>
          <p class="tl-help">{{ $t('look.fontHint') }}</p>
          <div class="tl-fonts" role="radiogroup" aria-labelledby="tl-font">
            <button v-for="f in chatFonts" :key="f.id" type="button" role="radio" class="tl-font" :disabled="busy"
              :aria-checked="form.chat_font === f.id ? 'true' : 'false'" :class="{ 'is-active': form.chat_font === f.id }"
              @click="form.chat_font = f.id">
              <!-- 128 px wide black strip, drawn at 2x: an approximation of the robot's subtitle -->
              <span class="tl-font__strip" aria-hidden="true">
                <span class="tl-font__line" :class="'is-' + f.style"
                  :style="{ height: f.strip + 'px', fontSize: f.px + 'px', lineHeight: f.strip + 'px' }">{{ fontSample }}</span>
              </span>
              <span class="tl-font__text">
                <span class="tl-font__name">{{ $t('look.font.' + f.id) }}</span>
                <span class="tl-font__meta">{{ $t('look.fontStyle.' + f.style) }} · {{ $t('look.fontSize', { n: f.px }) }}</span>
              </span>
            </button>
          </div>
          <p class="tl-help">{{ $t('look.fontApprox') }}</p>
        </div>
      </div>
    </div>

    <footer class="nx-card__footer tl-foot">
      <el-button type="text" class="tl-reset" :disabled="busy || isDefault" @click="reset">
        <i class="el-icon-refresh-left" aria-hidden="true"></i> {{ $t('look.reset') }}
      </el-button>
      <span v-if="dirty" class="tl-unsaved" role="status">{{ $t('look.unsaved') }}</span>
      <el-button type="primary" :disabled="!canSave" :loading="saving" @click="save">
        {{ $t('look.save') }}
      </el-button>
    </footer>
  </section>
</template>

<script>
import Api from '@/apis/api';
import TinyBotLiveScreen from '@/components/TinyBotLiveScreen.vue';
import {
  CHAT_FONTS,
  CHAT_FONT_SAMPLE,
  H,
  LOOK_CHOICES,
  LOOK_RANGES,
  MOODS,
  W,
  createCanvas,
  createLiveliness,
  defaultLook,
  isDefaultLook,
  normalizeLook,
  paintToContext,
  renderMoodFrame,
  renderMoodStill,
  sameLook,
} from '@/utils/faceLook.mjs';

const SCALE = 4;
// OLED hardware colours (white pixels on a near-black panel), not theme tokens
const PIXEL_ON = '#f2f6fa';
const PIXEL_OFF = '#06080b';

export default {
  name: 'TinyBotLook',
  components: { TinyBotLiveScreen },
  props: {
    deviceId: { type: String, default: '' },
  },
  data() {
    return {
      W,
      H,
      SCALE,
      moods: MOODS,
      choices: LOOK_CHOICES,
      ranges: LOOK_RANGES,
      chatFonts: CHAT_FONTS,
      fontSample: CHAT_FONT_SAMPLE,
      mood: 'neutral',
      form: defaultLook(),
      serverLook: defaultLook(),
      online: null,
      loading: false,
      loadError: '',
      saving: false,
      reducedMotion: false,
    };
  },
  computed: {
    dirty() {
      return !sameLook(this.form, this.serverLook);
    },
    isDefault() {
      return isDefaultLook(this.form);
    },
    busy() {
      return this.loading || this.saving;
    },
    canSave() {
      return !!this.deviceId && this.dirty && !this.loading && !this.saving && !this.loadError;
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        this.draw();
      },
    },
    deviceId() {
      this.load();
    },
  },
  created() {
    // Not reactive: drawing state for the animation loop
    this.frame = createCanvas();
    this.live = createLiveliness();
    this.moodStart = 0;
    this.raf = 0;
  },
  mounted() {
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = !!(mq && mq.matches);
    this.moodStart = this.now();
    this.live = createLiveliness(Math.random, this.moodStart);
    this.draw();
    if (!this.reducedMotion) this.raf = window.requestAnimationFrame(this.tick);
    this.load();
  },
  beforeDestroy() {
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = 0;
  },
  methods: {
    now() {
      return typeof performance !== 'undefined' ? performance.now() : Date.now();
    },
    signed(n) {
      return n > 0 ? `+${n}` : String(n);
    },
    errorText(err) {
      return (err && err.data && err.data.msg) || this.$t('companion.requestFailed');
    },

    // ------------------------------------------------------------------ data
    applyView(view) {
      const look = normalizeLook(view && view.settings && view.settings.look);
      this.online = view && typeof view.online === 'boolean' ? view.online : null;
      this.serverLook = look;
      this.form = { ...look };
    },
    load() {
      if (!this.deviceId) return;
      this.loading = true;
      this.loadError = '';
      Api.companion.getCompanion(this.deviceId, (res) => {
        this.loading = false;
        this.applyView(res && res.data && res.data.data);
      }, (err) => {
        this.loading = false;
        this.loadError = this.$t('look.loadFailed');
        console.warn('TinyBot look: load failed', err);
      });
    },
    save() {
      if (!this.canSave) return Promise.resolve(false);
      const look = normalizeLook(this.form);
      this.saving = true;
      return new Promise((resolve) => {
        Api.companion.updateCompanionConfig(this.deviceId, { settings: { look } }, (res) => {
          this.saving = false;
          const view = res && res.data && res.data.data;
          if (view && view.settings) this.applyView(view);
          else this.serverLook = look;
          this.$message.success(this.$t('look.saved'));
          resolve(true);
        }, (err) => {
          // Keep the edits on screen (still unsaved) so the user can retry
          this.saving = false;
          this.$message.error(this.errorText(err));
          resolve(false);
        });
      });
    },
    reset() {
      this.form = defaultLook();
    },

    // ------------------------------------------------------------------ preview
    setMood(m) {
      this.mood = m;
      this.moodStart = this.now();
      this.draw();
    },
    draw(nowMs) {
      const canvas = this.$refs.oled;
      if (!canvas || !canvas.getContext) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const now = nowMs === undefined ? this.now() : nowMs;
      if (this.reducedMotion) {
        renderMoodStill(this.mood, this.form, this.frame);
      } else {
        renderMoodFrame(this.mood, this.form, now - this.moodStart, this.live, now, this.frame);
      }
      paintToContext(ctx, this.frame, SCALE, PIXEL_ON, PIXEL_OFF);
    },
    tick(ts) {
      this.draw(ts);
      this.raf = window.requestAnimationFrame(this.tick);
    },
  },
};
</script>

<style lang="scss" scoped>
.tl {
  margin-bottom: var(--nx-space-5);
}

.tl-head {
  align-items: flex-start;
}

.tl-min {
  min-width: 0;
}

.tl-card-title {
  margin: 0;
  font-size: var(--nx-text-headline);
  font-weight: 600;
  color: var(--nx-text);
}

.tl-sub {
  margin: var(--nx-space-1) 0 0;
  font-size: var(--nx-text-footnote);
  line-height: 1.45;
  color: var(--nx-text-2);
}

.tl-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: var(--nx-space-6);
  align-items: start;
}

.tl-preview {
  position: sticky;
  top: calc(var(--nx-topbar-h) + var(--nx-space-4));
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
  min-width: 0;
}

.tl-screens {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--nx-space-4);
  align-items: start;
}

.tl-sim {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
  min-width: 0;
}

// Same size as the live screen's compact title, so the two screens line up
.tl-screen-label {
  margin: 0;
  min-height: 22px;
  font-size: var(--nx-text-callout);
  font-weight: 600;
  line-height: 22px;
  color: var(--nx-text);
}

.tl-oled {
  padding: var(--nx-space-3);
  border-radius: var(--nx-radius-lg);
  background: #15181d; // robot bezel, hardware colour
  box-shadow: var(--nx-shadow-2);
}

.tl-oled__screen {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 1;
  border-radius: var(--nx-radius-sm);
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  background: #06080b;
}

.tl-moods {
  flex-wrap: wrap;
  align-self: flex-start;
  max-width: 100%;
}

.tl-controls {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-5);
  min-width: 0;
}

.tl-field {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);
  min-width: 0;
}

.tl-label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--nx-space-2);
}

.tl-label {
  font-size: var(--nx-text-callout);
  font-weight: 600;
  color: var(--nx-text);
}

.tl-value {
  font-size: var(--nx-text-footnote);
  color: var(--nx-text-2);
}

.tl-seg {
  flex-wrap: wrap;
  align-self: flex-start;
  max-width: 100%;

  > button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.tl-slider {
  padding: 0 var(--nx-space-2);
}

.tl-ends {
  display: flex;
  justify-content: space-between;
  margin-top: calc(var(--nx-space-2) * -1);
  font-size: var(--nx-text-caption);
  color: var(--nx-text-3);
}

.tl-switch {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--nx-space-4);
}

.tl-switch__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tl-help {
  margin: 0;
  font-size: var(--nx-text-caption);
  line-height: 1.4;
  color: var(--nx-text-3);
}

// Chat font tiles: the sample sits on a 128 px black strip (the OLED is 128 px wide), shown at 2x
.tl-fonts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(268px, 100%), 1fr));
  gap: var(--nx-space-2);
}

.tl-font {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--nx-space-2);
  min-width: 0;
  padding: var(--nx-space-2);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius);
  background: var(--nx-surface);
  color: var(--nx-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--nx-dur-1) var(--nx-ease), border-color var(--nx-dur-1) var(--nx-ease);

  &:hover {
    background: var(--nx-surface-2);
  }

  &.is-active {
    border-color: var(--nx-accent);
    background: var(--nx-accent-soft);
  }

  &:focus-visible {
    outline: 2px solid var(--nx-accent);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.tl-font__strip {
  display: block;
  width: 256px;
  max-width: 100%;
  height: 44px; // tallest strip (22 px) at 2x
  overflow: hidden;
  border-radius: var(--nx-radius-sm);
  background: #06080b; // OLED panel, hardware colour
}

.tl-font__line {
  display: flex;
  justify-content: safe center;
  align-items: center;
  width: 128px;
  overflow: hidden;
  white-space: nowrap;
  color: #f2f6fa; // lit OLED pixels, hardware colour
  background: #000;
  transform: scale(2);
  transform-origin: 0 0;
  image-rendering: pixelated;
  -webkit-font-smoothing: none;
  font-smooth: never;

  &.is-pixel {
    font-family: 'Cascadia Mono', Consolas, 'Lucida Console', 'Courier New', monospace;
  }

  &.is-clean {
    font-family: Montserrat, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
}

.tl-font__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tl-font__name {
  font-size: var(--nx-text-callout);
  font-weight: 600;
}

.tl-font__meta {
  font-size: var(--nx-text-caption);
  color: var(--nx-text-3);
}

.tl-foot {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  margin-top: var(--nx-space-5);
}

.tl-reset {
  margin-right: auto;
}

.tl-unsaved {
  font-size: var(--nx-text-caption);
  font-weight: 600;
  color: var(--nx-warning);
}

.tl-note {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  margin-bottom: var(--nx-space-4);
  padding: var(--nx-space-3) var(--nx-space-4);
  border-radius: var(--nx-radius);
  font-size: var(--nx-text-footnote);
  line-height: 1.45;

  > i {
    flex: none;
  }

  &--info {
    background: var(--nx-info-soft);
    color: var(--nx-text);
  }

  &--warning {
    background: var(--nx-warning-soft);
    color: var(--nx-text);
  }
}

.tl-note__text {
  flex: 1;
  min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .tl-font {
    transition: none;
  }
}

@media (max-width: 900px) {
  .tl-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--nx-space-5);
  }

  .tl-preview {
    position: static;
  }
}

@media (max-width: 520px) {
  .tl-foot {
    flex-wrap: wrap;

    .tl-reset {
      width: 100%;
      margin-right: 0;
      justify-content: flex-start;
    }
  }
}
</style>
