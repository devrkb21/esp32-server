<template>
  <div class="look">
    <TbPageHeader :title="$t('nav.look')" :description="$t('lookPage.desc')" />

    <p v-if="!deviceId && robotReady" class="look__note">
      <TbIcon name="info" :size="18" /><span>{{ $t('lookPage.noRobot') }}</span>
      <TbButton size="s" icon="robots" to="/robots">{{ $t('common.goRobots') }}</TbButton>
    </p>
    <p v-else-if="loadError" class="look__note is-error" role="alert">
      <TbIcon name="warning" :size="18" /><span>{{ loadError }}</span>
      <TbButton size="s" icon="refresh" @click="load">{{ $t('common.retry') }}</TbButton>
    </p>
    <p v-else-if="online === false" class="look__note" role="status">
      <TbIcon name="warning" :size="18" /><span>{{ $t('lookPage.offline') }}</span>
    </p>

    <div class="look__grid">
      <div class="look__left">
        <section ref="stage" class="look__stage" :aria-label="$t('lookPage.stageLabel')">
          <TbChoice v-model="view" class="look__view" :options="viewOptions" :aria-label="$t('lookPage.view')" />

          <div v-show="view === 'preview'" class="look__sim">
            <div class="look__window">
              <canvas ref="oled" class="look__pixels" :width="W * paintScale" :height="H * paintScale" :style="pixelSize"
                role="img" :aria-label="$t('lookPage.previewAlt', { mood: $t('lookPage.mood.' + mood) })"></canvas>
            </div>
            <TbChoice wrap class="look__moods" :model-value="mood" :options="moodOptions" :aria-label="$t('lookPage.moodLabel')"
              @change="setMood" />
            <p class="look__hint">{{ reducedMotion ? $t('lookPage.previewStatic') : $t('lookPage.previewHint') }}</p>
          </div>

          <LookLive v-if="view === 'live'" :device-id="deviceId" :scale="scale" />
          <p v-if="online === false" class="look__hint">{{ $t('lookPage.liveOfflineNote') }}</p>
          <p v-else-if="deviceId && view === 'preview'" class="look__hint">{{ $t('lookPage.liveAfterSave') }}</p>
        </section>

        <div class="look__savebar">
          <TbSync :state="sync.state" :text="sync.text" />
          <TbButton variant="primary" icon="check" :disabled="!canSave" :loading="saving" @click="save">
            {{ $t('lookPage.save') }}
          </TbButton>
        </div>
      </div>

      <div class="look__controls" :aria-busy="loading ? 'true' : 'false'">
        <TbSection ink="look" :title="$t('lookPage.eyesTitle')" :description="$t('lookPage.eyesDesc')">
          <div class="look__rows">
            <div class="look__field">
              <span id="look-shape" class="look__label">{{ $t('lookPage.shapeLabel') }}</span>
              <TbChoice v-model="form.shape" wrap :disabled="busy" :options="opts('shape')" :aria-label="$t('lookPage.shapeLabel')" />
            </div>
            <div class="look__field">
              <div class="look__fieldhead">
                <span class="look__label">{{ $t('lookPage.size') }}</span>
              </div>
              <TbSlider v-model="form.size" :min="ranges.size[0]" :max="ranges.size[1]" :step="5" :disabled="busy"
                :aria-label="$t('lookPage.size')" :value-text="$t('lookPage.sizeValue', { n: num(form.size) })" />
            </div>
            <div class="look__field">
              <span class="look__label">{{ $t('lookPage.spacing') }}</span>
              <TbSlider v-model="form.spacing" :min="ranges.spacing[0]" :max="ranges.spacing[1]" :disabled="busy"
                :aria-label="$t('lookPage.spacing')" :value-text="signed(form.spacing)" />
              <div class="look__ends" aria-hidden="true">
                <span>{{ $t('lookPage.spacingCloser') }}</span><span>{{ $t('lookPage.spacingWider') }}</span>
              </div>
            </div>
            <div class="look__field">
              <span class="look__label">{{ $t('lookPage.height') }}</span>
              <TbSlider v-model="form.height" :min="ranges.height[0]" :max="ranges.height[1]" :disabled="busy"
                :aria-label="$t('lookPage.height')" :value-text="signed(form.height)" />
              <div class="look__ends" aria-hidden="true">
                <span>{{ $t('lookPage.heightUp') }}</span><span>{{ $t('lookPage.heightDown') }}</span>
              </div>
            </div>
            <div class="look__field">
              <span class="look__label">{{ $t('lookPage.eyesLabel') }}</span>
              <TbChoice v-model="form.eyes" wrap :disabled="busy" :options="opts('eyes')" :aria-label="$t('lookPage.eyesLabel')" />
            </div>
          </div>
        </TbSection>

        <TbSection ink="look" :title="$t('lookPage.faceTitle')" :description="$t('lookPage.faceDesc')">
          <div class="look__rows">
            <div class="look__field">
              <span class="look__label">{{ $t('lookPage.mouthLabel') }}</span>
              <TbChoice v-model="form.mouth" wrap :disabled="busy" :options="opts('mouth')" :aria-label="$t('lookPage.mouthLabel')" />
              <p class="look__hint">{{ $t('lookPage.mouthHint') }}</p>
            </div>
            <div class="look__field is-switch">
              <span class="look__switchtext">
                <span class="look__label">{{ $t('lookPage.blush') }}</span>
                <span class="look__hint">{{ $t('lookPage.blushHint') }}</span>
              </span>
              <TbSwitch v-model="form.blush" :disabled="busy" :aria-label="$t('lookPage.blush')" />
            </div>
          </div>
        </TbSection>

        <TbSection ink="look" :title="$t('lookPage.lifeTitle')" :description="$t('lookPage.lifeDesc')">
          <div class="look__rows">
            <div class="look__field">
              <span class="look__label">{{ $t('lookPage.blinkLabel') }}</span>
              <TbChoice v-model="form.blink" wrap :disabled="busy" :options="opts('blink')" :aria-label="$t('lookPage.blinkLabel')" />
            </div>
            <div class="look__field">
              <span class="look__label">{{ $t('lookPage.energyLabel') }}</span>
              <TbChoice v-model="form.energy" wrap :disabled="busy" :options="opts('energy')" :aria-label="$t('lookPage.energyLabel')" />
              <p class="look__hint">{{ $t('lookPage.energyHint') }}</p>
            </div>
            <div class="look__field is-switch">
              <span class="look__switchtext">
                <span class="look__label">{{ $t('lookPage.hands') }}</span>
                <span class="look__hint">{{ $t('lookPage.handsHint') }}</span>
              </span>
              <TbSwitch v-model="form.hands" :disabled="busy" :aria-label="$t('lookPage.hands')" />
            </div>
          </div>
        </TbSection>

        <TbSection ink="look" :title="$t('lookPage.fontTitle')" :description="$t('lookPage.fontDesc')">
          <div class="look__fonts" role="radiogroup" :aria-label="$t('lookPage.fontTitle')">
            <button v-for="f in chatFonts" :key="f.id" type="button" role="radio" class="look__font" :disabled="busy"
              :aria-checked="form.chat_font === f.id ? 'true' : 'false'" :class="{ 'is-on': form.chat_font === f.id }"
              @click="form.chat_font = f.id">
              <!-- the robot's 128 px wide subtitle strip, drawn at 2x: an approximation of its font -->
              <span class="look__strip" aria-hidden="true">
                <span class="look__stripline" :class="'is-' + f.style"
                  :style="{ height: f.strip + 'px', fontSize: f.px + 'px', lineHeight: f.strip + 'px' }">{{ fontSample }}</span>
              </span>
              <span class="look__fonttext">
                <span class="look__fontname">{{ $t('lookPage.font.' + f.id) }}</span>
                <span class="look__fontmeta">{{ $t('lookPage.fontStyle.' + f.style) }}, {{ $t('lookPage.fontSize', { n: num(f.px) }) }}</span>
              </span>
              <TbIcon v-if="form.chat_font === f.id" class="look__fontcheck" name="check" :size="18" />
            </button>
          </div>
          <p class="look__hint">{{ $t('lookPage.fontApprox') }}</p>
        </TbSection>

        <TbSection :title="$t('lookPage.resetTitle')" :description="$t('lookPage.resetDesc')">
          <div class="look__reset">
            <TbButton icon="refresh" :disabled="busy || isDefault" @click="reset">{{ $t('lookPage.reset') }}</TbButton>
            <span v-if="isDefault" class="look__hint">{{ $t('lookPage.isDefault') }}</span>
          </div>
        </TbSection>
      </div>
    </div>
  </div>
</template>

<script>
// Look: TinyBot's face and what is on its screen now. Edits are previewed at once on a
// pixel-exact simulation of the 128x64 OLED (src/utils/faceLook.mjs) and saved with one
// partial settings patch { settings: { look } }; "Live from TinyBot" shows the real screen.
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { deviceIdFrom, loadRobots, robot } from '@/shell/robot';
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
import LookLive from './LookLive.vue';

// OLED pixels are lit white; the panel is the face window's own black (--tb-face)
const PIXEL_ON = 'white';

export default {
  name: 'Look',
  components: { LookLive },
  data() {
    return {
      W,
      H,
      moods: MOODS,
      choices: LOOK_CHOICES,
      ranges: LOOK_RANGES,
      chatFonts: CHAT_FONTS,
      fontSample: CHAT_FONT_SAMPLE,
      robot,
      mood: 'neutral',
      view: 'preview',
      form: defaultLook(),
      serverLook: defaultLook(),
      online: null,
      loading: false,
      loadError: '',
      saving: false,
      reducedMotion: false,
      scale: 2,
      dpr: 1,
    };
  },
  computed: {
    deviceId() { return deviceIdFrom(this.$route); },
    robotReady() { return !!this.robot.loaded; },
    lang() { return this.$i18n ? this.$i18n.locale : 'en'; },
    dirty() { return !sameLook(this.form, this.serverLook); },
    isDefault() { return isDefaultLook(this.form); },
    busy() { return this.loading || this.saving; },
    canSave() { return !!this.deviceId && this.dirty && !this.loading && !this.saving && !this.loadError; },
    // device pixels per OLED pixel, a whole number so the canvas stays crisp
    paintScale() { return Math.max(1, Math.round(this.scale * this.dpr)); },
    pixelSize() { return { width: `${W * this.scale}px`, height: `${H * this.scale}px` }; },
    viewOptions() {
      return [
        { value: 'preview', label: this.$t('lookPage.viewPreview') },
        { value: 'live', label: this.$t('lookPage.viewLive'), disabled: !this.deviceId || this.online === false },
      ];
    },
    moodOptions() { return this.moods.map((m) => ({ value: m, label: this.$t('lookPage.mood.' + m) })); },
    sync() {
      if (!this.deviceId) return { state: 'off', text: this.$t('lookPage.sync.noRobot') };
      if (this.loadError) return { state: 'error', text: this.$t('lookPage.sync.error') };
      if (this.loading) return { state: 'pending', text: this.$t('lookPage.sync.loading') };
      if (this.saving) return { state: 'pending', text: this.$t('lookPage.sync.saving') };
      if (this.dirty) return { state: 'pending', text: this.$t('lookPage.sync.dirty') };
      if (this.online === false) return { state: 'pending', text: this.$t('lookPage.sync.offline') };
      return { state: 'applied', text: this.$t('lookPage.sync.applied') };
    },
  },
  watch: {
    form: { deep: true, handler() { this.draw(); } },
    deviceId() { this.load(); },
    online(v) { if (v === false && this.view === 'live') this.view = 'preview'; },
    view(v) { if (v === 'preview') this.$nextTick(() => this.draw()); },
    paintScale() { this.$nextTick(() => this.draw()); },
  },
  created() {
    // drawing state for the animation loop (not reactive)
    this.frame = createCanvas();
    this.live = createLiveliness();
    this.moodStart = 0;
    this.raf = 0;
  },
  async mounted() {
    const mq = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = !!(mq && mq.matches);
    this.dpr = window.devicePixelRatio || 1;
    this.moodStart = this.now();
    this.live = createLiveliness(Math.random, this.moodStart);
    this.fit();
    if (typeof window.ResizeObserver === 'function' && this.$refs.stage) {
      this.resizer = new window.ResizeObserver(() => this.fit());
      this.resizer.observe(this.$refs.stage);
    }
    this.draw();
    if (!this.reducedMotion && typeof window.requestAnimationFrame === 'function') {
      this.raf = window.requestAnimationFrame(this.tick);
    }
    try { await loadRobots(); } catch (e) { /* the notice covers a missing robot */ }
    this.load();
  },
  beforeUnmount() {
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.resizer) this.resizer.disconnect();
  },
  methods: {
    now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); },
    num(n) { return digits(n, this.lang); },
    signed(n) { return n > 0 ? `+${this.num(n)}` : n < 0 ? `−${this.num(-n)}` : this.num(0); },
    opts(key) { return this.choices[key].map((v) => ({ value: v, label: this.$t(`lookPage.${key}.${v}`) })); },
    errorText(err) { return (err && err.data && err.data.msg) || (err && err.msg) || this.$t('lookPage.saveFailed'); },

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
        this.loadError = this.$t('lookPage.loadFailed');
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
          this.$message.success(this.$t('lookPage.saved'));
          resolve(true);
        }, (err) => {
          // keep the edits on screen (still unsaved) so the owner can try again
          this.saving = false;
          this.$message.error(this.errorText(err));
          resolve(false);
        });
      });
    },
    reset() { this.form = defaultLook(); },

    // ------------------------------------------------------------------ preview
    fit() {
      const el = this.$refs.stage;
      const width = el ? el.clientWidth : 0;
      if (!width) return;
      // the window keeps a 12 px black margin around the 128 px wide face
      this.scale = Math.min(5, Math.max(1, Math.floor((width - 24) / W)));
    },
    setMood(m) {
      this.mood = m;
      this.moodStart = this.now();
      this.draw();
    },
    draw(nowMs) {
      const canvas = this.$refs.oled;
      if (!canvas || !canvas.getContext) return;
      let ctx = null;
      try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
      if (!ctx) return;
      const now = nowMs === undefined ? this.now() : nowMs;
      if (this.reducedMotion) renderMoodStill(this.mood, this.form, this.frame);
      else renderMoodFrame(this.mood, this.form, now - this.moodStart, this.live, now, this.frame);
      const off = getComputedStyle(canvas).getPropertyValue('--tb-face').trim() || 'black';
      paintToContext(ctx, this.frame, this.paintScale, PIXEL_ON, off);
    },
    tick(ts) {
      if (this.view === 'preview') this.draw(ts);
      this.raf = window.requestAnimationFrame(this.tick);
    },
  },
};
</script>

<style>
.look { padding-bottom: var(--tb-s6); }
.look__note {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft); font-size: var(--tb-fs-14); color: var(--tb-ink);
}
.look__note > span { flex: 1 1 24ch; min-width: 0; }
.look__note .tb-icon { color: var(--tb-look); flex: none; }
.look__note.is-error, .look__note.is-error .tb-icon { color: var(--tb-danger); }

.look__grid { display: grid; grid-template-columns: minmax(0, 1fr); }
.look__left { display: contents; }
.look__stage { order: 1; display: grid; gap: var(--tb-s3); align-content: start; min-width: 0; padding: var(--tb-s5) 0 var(--tb-s4); }
.look__controls { order: 2; min-width: 0; }
.look__savebar { order: 3; }

/* the face window: TinyBot's black OLED, the face at a whole-number pixel scale */
.look__window {
  position: relative; display: grid; place-items: center; min-width: 0; padding: 12px 0;
  background: var(--tb-face); border-radius: var(--tb-radius-s); overflow: hidden;
}
.look__pixels { display: block; max-width: none; image-rendering: pixelated; image-rendering: crisp-edges; }
.look__view { justify-self: start; }
.look__moods { max-width: 100%; }
.look__sim { display: grid; gap: var(--tb-s3); min-width: 0; }

.look__savebar {
  position: sticky; bottom: 0; z-index: 5;
  display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s3);
  padding: 10px 0; background: var(--tb-paper); border-top: var(--tb-rule-band) solid var(--tb-rule);
}
.look__savebar .tb-sync { flex: 1 1 auto; min-width: 0; white-space: normal; font-weight: 600; color: var(--tb-ink); line-height: 1.35; }
.look__savebar .tb-sync__rule { flex: none; }
.look__savebar .tb-btn { flex: none; }

.look__rows { display: grid; }
.look__field { display: grid; gap: 8px; min-width: 0; padding: 14px 0; border-top: 1px solid var(--tb-rule-soft); }
.look__rows > .look__field:first-child { border-top: 0; padding-top: 0; }
.look__field.is-switch { grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--tb-s4); }
.look__switchtext { display: grid; gap: 2px; min-width: 0; }
.look__label { font-weight: 700; font-size: var(--tb-fs-15); color: var(--tb-ink); }
.look__hint { font-size: var(--tb-fs-13); color: var(--tb-ink-2); max-width: 70ch; }
.look__ends { display: flex; justify-content: space-between; margin-top: -6px; padding-right: calc(3.2ch + 14px);
  font-size: var(--tb-fs-12); color: var(--tb-ink-2); }

/* chat font tiles: the sample sits on the robot's 128 px subtitle strip, shown at 2x */
.look__fonts { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(272px, 100%), 1fr)); gap: var(--tb-s2); }
.look__font {
  position: relative; display: grid; gap: var(--tb-s2); justify-items: start; min-width: 0; padding: 10px;
  border: 1.5px solid var(--tb-rule-soft); border-radius: var(--tb-radius-m); background: var(--tb-paper);
  text-align: left; color: var(--tb-ink);
  transition: border-color var(--tb-t-hover) var(--tb-ease), background-color var(--tb-t-hover) var(--tb-ease);
}
@media (hover: hover) and (pointer: fine) { .look__font:hover:not(:disabled) { border-color: var(--tb-ink); } }
.look__font.is-on { border-color: var(--tb-ink); background: var(--tb-paper-2); box-shadow: inset 0 3px 0 var(--tb-look); }
.look__font:disabled { opacity: .5; cursor: not-allowed; }
.look__fontcheck { position: absolute; right: 10px; bottom: 12px; color: var(--tb-look); }
.look__strip { display: block; width: 256px; max-width: 100%; height: 44px; overflow: hidden; border-radius: 4px; background: var(--tb-face); }
.look__stripline {
  display: flex; justify-content: safe center; align-items: center; width: 128px; overflow: hidden; white-space: nowrap;
  color: white; transform: scale(2); transform-origin: 0 0; -webkit-font-smoothing: none;
}
.look__stripline.is-pixel { font-family: ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace; }
.look__stripline.is-clean { font-family: var(--tb-font-text); }
.look__fonttext { display: grid; min-width: 0; padding-right: 24px; }
.look__fontname { font-weight: 700; font-size: var(--tb-fs-15); }
.look__fontmeta { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.look__reset { display: flex; align-items: center; gap: var(--tb-s3); flex-wrap: wrap; }

/* phones: the save bar rides above the bottom tab bar while the controls scroll */
@media (max-width: 899px) {
  .look__savebar { bottom: calc(var(--tb-tabbar-h) + env(safe-area-inset-bottom)); }
  .look__savebar .tb-btn { min-height: var(--tb-target); }
  .look__font { min-height: var(--tb-target); }
}

/* desktop: two columns, the face window and its save bar stay in view beside the controls */
@media (min-width: 1100px) {
  .look__grid { grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 0 var(--tb-s10); align-items: start; }
  .look__left { display: grid; position: sticky; top: 0; align-content: start; }
  .look__savebar { position: static; border-top-width: 1px; }
  .look__controls { padding-top: var(--tb-s1); }
}
</style>
