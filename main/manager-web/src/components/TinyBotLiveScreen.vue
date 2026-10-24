<template>
  <section class="tls" :class="{ 'tls--compact': compact }" :aria-labelledby="titleId">
    <header class="tls-head">
      <div class="tls-min">
        <component :is="compact ? 'h3' : 'h2'" :id="titleId" class="tls-title">
          {{ compact ? $t('companion.live.compactTitle') : $t('companion.live.title') }}
        </component>
        <p v-if="!compact" class="tls-sub">{{ $t('companion.live.desc') }}</p>
      </div>
      <span v-if="deviceId" class="nx-badge tls-badge" :class="badgeClass" role="status" aria-live="polite">
        <span class="nx-dot" :class="dotClass" aria-hidden="true"></span>{{ statusText }}
      </span>
    </header>

    <div class="tls-oled">
      <div class="tls-screen" :class="{ 'is-stale': stale }">
        <img v-if="frame" class="tls-screen__img" :src="frame.src" :width="frame.width" :height="frame.height"
          :alt="$t('companion.live.alt')" draggable="false">
        <div v-if="!deviceId" class="tls-overlay">
          <span>{{ $t('companion.live.noDevice') }}</span>
        </div>
        <div v-else-if="offline" class="tls-overlay tls-overlay--error" role="alert">
          <i class="el-icon-warning-outline tls-overlay__icon" aria-hidden="true"></i>
          <strong class="tls-overlay__title">{{ $t('companion.live.offlineTitle') }}</strong>
          <span v-if="!compact" class="tls-overlay__hint">{{ $t('companion.live.offlineHint') }}</span>
          <span v-if="errorDetail && !compact" class="tls-overlay__detail">{{ errorDetail }}</span>
        </div>
        <div v-else-if="!frame" class="tls-overlay">
          <i v-if="state.status === 'connecting'" class="el-icon-loading" aria-hidden="true"></i>
          <span>{{ state.status === 'paused' ? $t('companion.live.paused') : $t('companion.live.waiting') }}</span>
        </div>
      </div>
    </div>

    <footer v-if="deviceId" class="tls-foot">
      <span class="tls-age nx-num">{{ ageText }}</span>
      <el-button v-if="offline" size="mini" :disabled="state.inFlight" @click="retry">
        {{ $t('companion.live.retry') }}
      </el-button>
      <el-button size="mini" :icon="state.paused ? 'el-icon-video-play' : 'el-icon-video-pause'" @click="togglePause">
        {{ state.paused ? $t('companion.live.resume') : $t('companion.live.pause') }}
      </el-button>
    </footer>
  </section>
</template>

<script>
import Api from '@/apis/api';
import {
  SCREEN_TOOL,
  createScreenPoller,
  frameAgeParts,
  isLive,
  parseScreenFrame,
  screenToolArgs,
  toolErrorText,
} from '@/utils/liveScreen.mjs';

let uid = 0;

export default {
  name: 'TinyBotLiveScreen',
  props: {
    deviceId: { type: String, default: '' },
    // Small version (next to the simulated preview)
    compact: { type: Boolean, default: false },
    // JPEG quality 1..100
    quality: { type: Number, default: 90 },
  },
  data() {
    uid += 1;
    return {
      titleId: `tls-title-${uid}`,
      state: { status: 'idle', frame: null, frameAt: 0, failures: 0, error: null, paused: false, inFlight: false },
      now: Date.now(),
    };
  },
  computed: {
    frame() {
      return this.state.frame;
    },
    offline() {
      return this.state.result === 'offline';
    },
    liveNow() {
      return isLive(this.state, this.now);
    },
    stale() {
      return !!this.frame && !this.liveNow;
    },
    statusText() {
      const s = this.state;
      if (s.paused) return this.$t('companion.live.paused');
      if (s.status === 'idle') return s.frame ? this.$t('companion.live.hidden') : this.$t('companion.live.paused');
      if (s.status === 'offline') return this.$t('companion.live.offline');
      if (s.status === 'retrying') return this.$t('companion.live.retrying');
      if (s.status === 'connecting') return this.$t('companion.live.connecting');
      return this.liveNow ? this.$t('companion.live.live') : this.$t('companion.live.retrying');
    },
    badgeClass() {
      const s = this.state;
      if (s.paused || s.status === 'idle') return '';
      if (s.status === 'offline') return 'nx-badge--danger';
      if (s.status === 'retrying' || s.status === 'connecting') return 'nx-badge--warning';
      return this.liveNow ? 'nx-badge--success' : 'nx-badge--warning';
    },
    dotClass() {
      const b = this.badgeClass;
      if (b === 'nx-badge--success') return 'nx-dot--online';
      if (b === 'nx-badge--danger') return 'nx-dot--danger';
      if (b === 'nx-badge--warning') return 'nx-dot--warning';
      return '';
    },
    ageText() {
      const p = frameAgeParts(this.state.frameAt, this.now);
      if (!p) return this.state.paused ? '' : this.$t('companion.live.waiting');
      if (p.key === 'now') return this.$t('companion.live.updatedNow');
      if (p.key === 'seconds') return this.$t('companion.live.updatedSeconds', { n: p.n });
      if (p.key === 'minutes') return this.$t('companion.live.updatedMinutes', { n: p.n });
      return this.$t('companion.live.updatedHours', { n: p.n });
    },
    errorDetail() {
      const e = this.state.error;
      return (e && (e.msg || e.message)) || '';
    },
  },
  watch: {
    deviceId() {
      this.restart();
    },
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
    // The frame age ticks while the component lives
    this.clock = window.setInterval(() => {
      this.now = Date.now();
    }, 1000);
    this.restart();
  },
  beforeDestroy() {
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.observer) this.observer.disconnect();
    if (this.clock) window.clearInterval(this.clock);
    if (this.poller) this.poller.destroy();
    this.poller = null;
  },
  methods: {
    fetchFrame() {
      const deviceId = this.deviceId;
      return Api.device.callDeviceToolOnce(deviceId, SCREEN_TOOL, screenToolArgs(this.quality)).then((body) => {
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

<style lang="scss" scoped>
.tls {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
  min-width: 0;
}

.tls-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--nx-space-3);
}

.tls-min {
  min-width: 0;
}

.tls-title {
  margin: 0;
  font-size: var(--nx-text-headline);
  font-weight: 600;
  color: var(--nx-text);
}

.tls--compact {
  .tls-head {
    align-items: center;
    min-height: 22px;
  }

  .tls-title {
    font-size: var(--nx-text-callout);
    line-height: 22px;
  }
}

.tls-sub {
  margin: var(--nx-space-1) 0 0;
  font-size: var(--nx-text-footnote);
  line-height: 1.45;
  color: var(--nx-text-2);
}

.tls-badge {
  flex: none;
}

// The robot's bezel and panel: hardware colours, not theme tokens
.tls-oled {
  padding: var(--nx-space-3);
  border-radius: var(--nx-radius-lg);
  background: #15181d;
  box-shadow: var(--nx-shadow-2);
}

.tls-screen {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 1;
  overflow: hidden;
  border-radius: var(--nx-radius-sm);
  background: #06080b;

  &.is-stale .tls-screen__img {
    opacity: 0.55;
  }
}

.tls-screen__img {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  transition: opacity var(--nx-dur-2) var(--nx-ease);
  user-select: none;
}

.tls-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--nx-space-1);
  padding: var(--nx-space-3);
  text-align: center;
  font-size: var(--nx-text-footnote);
  line-height: 1.4;
  color: #c9d1db; // on the dark panel

  &--error {
    background: rgba(6, 8, 11, 0.78);
  }
}

.tls-overlay__icon {
  font-size: 22px;
  color: #f5b04a;
}

.tls-overlay__title {
  font-size: var(--nx-text-callout);
  color: #f2f6fa;
}

.tls-overlay__hint,
.tls-overlay__detail {
  max-width: 36ch;
  font-size: var(--nx-text-caption);
}

.tls-overlay__detail {
  color: #8f9aa8;
}

.tls-foot {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);

  .el-button + .el-button {
    margin-left: 0;
  }
}

.tls-age {
  margin-right: auto;
  min-width: 0;
  font-size: var(--nx-text-caption);
  color: var(--nx-text-3);
}

@media (prefers-reduced-motion: reduce) {
  .tls-screen__img {
    transition: none;
  }
}
</style>
