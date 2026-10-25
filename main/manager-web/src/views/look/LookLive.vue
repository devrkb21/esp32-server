<template>
  <div class="look-live">
    <div class="look__window" :class="{ 'is-stale': stale }">
      <img v-if="frame" class="look__pixels" :src="frame.src" :width="frame.width" :height="frame.height"
        :style="pixelSize" :alt="$t('lookPage.live.alt')" draggable="false" />
      <div v-if="!deviceId" class="look-live__over">{{ $t('lookPage.noRobot') }}</div>
      <div v-else-if="offline" class="look-live__over is-error" role="alert">
        <strong>{{ $t('lookPage.live.offlineTitle') }}</strong>
        <span>{{ $t('lookPage.live.offlineHint') }}</span>
        <span v-if="errorDetail" class="look-live__detail">{{ errorDetail }}</span>
      </div>
      <div v-else-if="!frame" class="look-live__over">
        <span>{{ state.status === 'paused' ? $t('lookPage.live.paused') : $t('lookPage.live.waiting') }}</span>
      </div>
    </div>

    <div v-if="deviceId" class="look-live__bar">
      <span class="look-live__state" :class="`is-${tone}`" role="status" aria-live="polite">
        <i aria-hidden="true"></i>{{ statusText }}
      </span>
      <span class="look-live__age tb-num">{{ ageText }}</span>
      <TbButton v-if="offline" size="s" variant="quiet" icon="refresh" :disabled="state.inFlight" @click="retry">
        {{ $t('lookPage.live.retry') }}
      </TbButton>
      <TbButton size="s" :icon="state.paused ? 'play' : 'pause'" @click="togglePause">
        {{ state.paused ? $t('lookPage.live.resume') : $t('lookPage.live.pause') }}
      </TbButton>
    </div>
  </div>
</template>

<script>
import { peopleText } from '@/utils/errorText.mjs';
// "Live from TinyBot": the robot's real OLED, fetched with the device tool `self.screen.preview`
// one request at a time (src/utils/liveScreen.mjs). It asks only while this view is mounted,
// on screen (IntersectionObserver) and the browser tab is visible (visibilitychange).
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import {
  SCREEN_TOOL,
  createScreenPoller,
  frameAgeParts,
  isLive,
  parseScreenFrame,
  screenToolArgs,
  toolErrorText,
} from '@/utils/liveScreen.mjs';

export default {
  name: 'LookLive',
  props: {
    deviceId: { type: String, default: '' },
    // OLED pixels -> CSS pixels, a whole number so every robot pixel stays square
    scale: { type: Number, default: 2 },
    quality: { type: Number, default: 90 },
  },
  data() {
    return {
      state: { status: 'idle', frame: null, frameAt: 0, failures: 0, error: null, paused: false, inFlight: false },
      now: Date.now(),
    };
  },
  computed: {
    frame() { return this.state.frame; },
    offline() { return this.state.result === 'offline'; },
    liveNow() { return isLive(this.state, this.now); },
    stale() { return !!this.frame && !this.liveNow; },
    pixelSize() { return { width: `${128 * this.scale}px`, height: `${64 * this.scale}px` }; },
    tone() {
      const s = this.state;
      if (s.paused || s.status === 'idle') return 'idle';
      if (s.status === 'offline') return 'error';
      if (s.status === 'retrying' || s.status === 'connecting') return 'wait';
      return this.liveNow ? 'live' : 'wait';
    },
    statusText() {
      const s = this.state;
      if (s.paused) return this.$t('lookPage.live.paused');
      if (s.status === 'idle') return s.frame ? this.$t('lookPage.live.hidden') : this.$t('lookPage.live.paused');
      if (s.status === 'offline') return this.$t('lookPage.live.offline');
      if (s.status === 'retrying') return this.$t('lookPage.live.retrying');
      if (s.status === 'connecting') return this.$t('lookPage.live.connecting');
      return this.liveNow ? this.$t('lookPage.live.live') : this.$t('lookPage.live.retrying');
    },
    ageText() {
      const p = frameAgeParts(this.state.frameAt, this.now);
      if (!p) return this.state.paused ? '' : this.$t('lookPage.live.waiting');
      const n = digits(p.n, this.$i18n ? this.$i18n.locale : 'en');
      if (p.key === 'now') return this.$t('lookPage.live.updatedNow');
      if (p.key === 'seconds') return this.$t('lookPage.live.updatedSeconds', { n });
      if (p.key === 'minutes') return this.$t('lookPage.live.updatedMinutes', { n });
      return this.$t('lookPage.live.updatedHours', { n });
    },
    errorDetail() {
      const e = this.state.error;
      return peopleText(e && (e.msg || e.message)); // never raw robot or server text
    },
  },
  watch: {
    deviceId() { this.restart(); },
  },
  mounted() {
    this.onVisibility = () => {
      if (this.poller) this.poller.setPageVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof window.IntersectionObserver === 'function') {
      this.observer = new window.IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        if (this.poller && e) this.poller.setVisible(e.isIntersecting);
      });
      this.observer.observe(this.$el);
    }
    // the frame age ticks while the view lives
    this.clock = window.setInterval(() => { this.now = Date.now(); }, 1000);
    this.restart();
  },
  beforeUnmount() {
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.observer) this.observer.disconnect();
    if (this.clock) window.clearInterval(this.clock);
    if (this.poller) this.poller.destroy();
    this.poller = null;
  },
  methods: {
    fetchFrame() {
      return Api.device.callDeviceToolOnce(this.deviceId, SCREEN_TOOL, screenToolArgs(this.quality)).then((body) => {
        if (!body || body.code !== 0) throw body || {};
        const frame = parseScreenFrame(body.data);
        if (!frame) throw { msg: toolErrorText(body.data) };
        return frame;
      });
    },
    restart() {
      const wasPaused = this.poller ? this.poller.getState().paused : false;
      if (this.poller) this.poller.destroy();
      this.poller = null;
      this.state = { status: 'idle', frame: null, frameAt: 0, failures: 0, error: null, paused: wasPaused, inFlight: false };
      if (!this.deviceId) return;
      const poller = createScreenPoller({
        fetchFrame: this.fetchFrame,
        onUpdate: (s) => {
          if (this.poller === poller) {
            this.state = s;
            this.now = Date.now();
          }
        },
      });
      this.poller = poller;
      poller.setPageVisible(document.visibilityState !== 'hidden');
      if (wasPaused) poller.pause();
      poller.start();
    },
    togglePause() {
      if (!this.poller) return;
      if (this.poller.getState().paused) this.poller.resume();
      else this.poller.pause();
    },
    retry() {
      if (this.poller) this.poller.retry();
    },
  },
};
</script>

<style>
.look-live { display: grid; gap: var(--tb-s3); min-width: 0; }
.look-live .look__window.is-stale .look__pixels { opacity: .55; }
.look-live .look__pixels { transition: opacity var(--tb-t-fast) var(--tb-ease); user-select: none; }
/* words on the black OLED window: paper-on-black reads in both themes */
.look-live__over {
  position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 4px;
  padding: var(--tb-s4); text-align: center; color: var(--tb-paper); font-size: var(--tb-fs-14);
}
:root[data-theme="dark"] .look-live__over { color: var(--tb-ink); }
.look-live__over.is-error { background: color-mix(in srgb, var(--tb-face) 80%, transparent); }
.look-live__over strong { font-family: var(--tb-font-display); font-size: var(--tb-fs-16); }
.look-live__over span { max-width: 40ch; font-size: var(--tb-fs-13); }
.look-live__detail { opacity: .75; }
.look-live__bar { display: flex; align-items: center; gap: var(--tb-s2) var(--tb-s3); flex-wrap: wrap; min-height: var(--tb-target); }
.look-live__state { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: var(--tb-fs-14); }
.look-live__state i { width: 9px; height: 9px; background: var(--tb-ink-3); }
.look-live__state.is-live i { background: var(--tb-ok); }
.look-live__state.is-wait i { background: var(--tb-routine-mark); }
.look-live__state.is-error { color: var(--tb-danger); }
.look-live__state.is-error i { background: var(--tb-danger); }
.look-live__age { margin-right: auto; color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
</style>
