<template>
  <div class="tg">
    <HeaderBar />

    <main class="nx-page tg-page">
      <button type="button" class="nx-back" @click="goBack">
        <i class="el-icon-arrow-left" aria-hidden="true"></i>
        {{ $t('companion.back') }}
      </button>

      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ tx('themeGen.title', 'TinyBot look') }}</h1>
          <p class="nx-page-header__desc">
            {{ tx('themeGen.desc', 'Design how TinyBot’s face looks and behaves, and choose the phrase that wakes it up.') }}
          </p>
        </div>
      </header>

      <!-- The face editor with live preview: the main part of this page -->
      <TinyBotLook :device-id="deviceId" />

      <header class="tg-section-head">
        <h2 class="tg-section-title">{{ tx('look.wakeSection', 'Wake word') }}</h2>
        <p class="tg-sub">{{ tx('look.wakeSectionDesc', 'Install a different wake phrase on TinyBot. Installing restarts the robot.') }}</p>
      </header>

      <div class="tg-layout">
        <div class="tg-main">
          <!-- ============================================================ Robot -->
          <section class="nx-card" aria-labelledby="tg-robot-title">
            <header class="nx-card__header">
              <div class="nx-row">
                <span class="nx-icon-tile" aria-hidden="true"><i class="el-icon-cpu"></i></span>
                <div class="tg-min">
                  <h2 id="tg-robot-title" class="tg-card-title nx-truncate" :title="robotName">{{ robotName }}</h2>
                  <div v-if="device && device.macAddress" class="tg-meta nx-mono nx-truncate">{{ device.macAddress }}</div>
                </div>
              </div>
              <div class="nx-row tg-robot-status">
                <span class="nx-badge" :class="statusBadgeClass" role="status">
                  <span class="nx-dot" :class="{ 'nx-dot--online': robotState === 'online' }" aria-hidden="true"></span>
                  {{ statusText }}
                </span>
                <el-tooltip v-if="deviceId" :content="tx('themeGen.robot.refresh', 'Check again')" placement="bottom" :open-delay="400">
                  <button type="button" class="nx-icon-btn" :aria-label="tx('themeGen.robot.refresh', 'Check again')"
                    :disabled="robotState === 'checking' || installing" @click="loadRobot">
                    <i :class="robotState === 'checking' ? 'el-icon-loading' : 'el-icon-refresh'" aria-hidden="true"></i>
                  </button>
                </el-tooltip>
              </div>
            </header>

            <dl v-if="deviceId" class="nx-kv tg-kv">
              <dt>{{ tx('themeGen.robot.chip', 'Chip') }}</dt>
              <dd>
                <span v-if="robotState === 'checking' && !systemInfo" class="nx-skeleton tg-sk"></span>
                <template v-else>{{ chipText }}</template>
              </dd>
              <dt>{{ tx('themeGen.robot.screen', 'Screen') }}</dt>
              <dd>
                <span v-if="robotState === 'checking' && !screen" class="nx-skeleton tg-sk"></span>
                <template v-else>{{ screenText }}</template>
              </dd>
              <dt>{{ tx('themeGen.robot.space', 'Theme space') }}</dt>
              <dd class="nx-num">{{ formatBytes(limit) }}</dd>
              <template v-if="device && device.appVersion">
                <dt>{{ tx('themeGen.robot.firmware', 'Firmware') }}</dt>
                <dd class="nx-mono">{{ device.appVersion }}</dd>
              </template>
            </dl>

            <div v-if="!deviceId" class="tg-note tg-note--info" role="status">
              <i class="el-icon-info" aria-hidden="true"></i>
              <span>{{ tx('themeGen.robot.none', 'No robot selected. You can still build and download the file.') }}</span>
            </div>
            <div v-else-if="robotState === 'offline'" class="tg-note tg-note--warning" role="status">
              <i class="el-icon-warning-outline" aria-hidden="true"></i>
              <span>{{ tx('themeGen.robot.offlineHint', 'TinyBot is not answering. Turn it on and connect it to Wi-Fi to install online. You can still download the file.') }}</span>
            </div>
            <div v-else-if="robotState === 'online' && !tinybot" class="tg-note tg-note--warning" role="status">
              <i class="el-icon-warning-outline" aria-hidden="true"></i>
              <span>{{ tx('themeGen.robot.notTinybot', 'This robot does not look like a TinyBot (128×64 mono screen). This theme is made for TinyBot.') }}</span>
            </div>
          </section>

          <!-- ============================================================ Wake word -->
          <section class="nx-card" aria-labelledby="tg-wake-title">
            <header class="nx-card__header">
              <div class="tg-min">
                <h2 id="tg-wake-title" class="tg-card-title">{{ tx('themeGen.wake.title', 'Wake word') }}</h2>
                <p class="tg-sub">{{ tx('themeGen.wake.desc', 'TinyBot starts listening when it hears this phrase.') }}</p>
              </div>
            </header>
            <label class="tg-label" for="tg-wake-select">{{ tx('themeGen.wake.label', 'Phrase') }}</label>
            <el-select id="tg-wake-select" v-model="wakeWord" class="tg-select" filterable :disabled="installing"
              :placeholder="tx('themeGen.wake.label', 'Phrase')">
              <el-option-group v-for="group in wakeGroups" :key="group.key" :label="group.label">
                <el-option v-for="w in group.items" :key="w.id" :label="wakeLabel(w)" :value="w.id">
                  <span class="tg-option">
                    <span class="nx-truncate">{{ w.phrase }}<span v-if="w.native" class="tg-option__native"> · {{ w.native }}</span></span>
                    <span v-if="w.id === defaultWakeWord" class="nx-badge nx-badge--accent">{{ tx('themeGen.wake.default', 'Default') }}</span>
                  </span>
                </el-option>
              </el-option-group>
            </el-select>
            <p class="tg-help">
              {{ tx('themeGen.wake.help', 'Hi ESP is what TinyBot uses out of the box. Pick a phrase that is easy to say in your home.') }}
            </p>
          </section>

          <!-- ============================================================ Font -->
          <section class="nx-card" aria-labelledby="tg-font-title">
            <header class="nx-card__header">
              <div class="tg-min">
                <h2 id="tg-font-title" class="tg-card-title">{{ tx('themeGen.font.title', 'Chat text font') }}</h2>
                <p class="tg-sub">{{ tx('themeGen.font.desc', 'The one-line subtitle under TinyBot\'s face.') }}</p>
              </div>
            </header>
            <div class="tg-choices" role="radiogroup" aria-labelledby="tg-font-title">
              <label v-for="f in fonts" :key="f.id" class="tg-choice"
                :class="{ 'is-active': font === f.id, 'is-disabled': !f.tinybot || installing }">
                <input v-model="font" class="nx-visually-hidden" type="radio" name="tg-font" :value="f.id"
                  :disabled="!f.tinybot || installing">
                <span class="tg-choice__radio" aria-hidden="true"></span>
                <span class="tg-choice__text">
                  <span class="tg-choice__title">{{ fontName(f) }}</span>
                  <span class="tg-choice__meta">
                    {{ f.file ? formatBytes(f.size) : tx('themeGen.font.noSpace', 'No extra space') }}
                    <template v-if="!f.tinybot"> · {{ tx('themeGen.font.unsupported', 'Not used by the current TinyBot firmware') }}</template>
                  </span>
                </span>
              </label>
            </div>
            <p class="tg-help">
              {{ tx('themeGen.font.help', 'TinyBot keeps its crisp 8 px pixel font: the subtitle strip is only 11 px tall, and the firmware does not load a replacement font yet.') }}
            </p>
          </section>
        </div>

        <!-- ============================================================ Preview + summary -->
        <aside class="tg-side">
          <section class="nx-card" aria-labelledby="tg-preview-title">
            <header class="nx-card__header">
              <h2 id="tg-preview-title" class="tg-card-title">{{ tx('themeGen.preview.title', 'Preview') }}</h2>
              <span class="nx-badge">128×64</span>
            </header>
            <div class="tg-oled">
              <canvas ref="oled" class="tg-oled__screen" width="128" height="64" role="img"
                :aria-label="tx('themeGen.preview.alt', 'TinyBot screen showing: {text}', { text: previewText })"></canvas>
            </div>
            <p class="tg-help">{{ tx('themeGen.preview.note', 'Approximate: the browser draws a similar 8 px font.') }}</p>
          </section>

          <section class="nx-card" aria-labelledby="tg-summary-title">
            <header class="nx-card__header">
              <h2 id="tg-summary-title" class="tg-card-title">{{ tx('themeGen.summary.title', 'Summary') }}</h2>
            </header>

            <ul class="tg-files">
              <li v-for="part in estimate.parts" :key="part.name" class="tg-files__row">
                <span class="tg-files__name">
                  <span class="nx-truncate">{{ partLabel(part.name) }}</span>
                  <span class="tg-files__file nx-mono nx-truncate">{{ part.name }}</span>
                </span>
                <span class="nx-num tg-files__size">{{ formatBytes(part.size) }}</span>
              </li>
            </ul>

            <div class="tg-meter-head">
              <span>{{ tx('themeGen.summary.size', 'Size') }}</span>
              <span class="nx-num" :class="{ 'tg-over': tooLarge }">{{ formatBytes(estimate.total) }} / {{ formatBytes(limit) }}</span>
            </div>
            <span class="tg-meter" role="progressbar" aria-valuemin="0" :aria-valuemax="limit" :aria-valuenow="estimate.total"
              :aria-valuetext="formatBytes(estimate.total) + ' / ' + formatBytes(limit)"
              :aria-label="tx('themeGen.summary.size', 'Size')">
              <span class="tg-meter__fill" :class="{ 'is-over': tooLarge }"
                :style="{ transform: 'scaleX(' + Math.min(1, estimate.total / limit) + ')' }"></span>
            </span>
            <p v-if="tooLarge" class="tg-error" role="alert">
              {{ tx('themeGen.summary.tooLarge', 'Too large for TinyBot. Remove something to fit {limit}.', { limit: formatBytes(limit) }) }}
            </p>

            <div class="tg-actions">
              <el-button type="primary" class="tg-actions__main" :loading="installing"
                :disabled="!canInstall" @click="install">
                <i v-if="!installing" class="el-icon-upload2" aria-hidden="true"></i>
                {{ installing ? tx('themeGen.install.running', 'Installing…') : tx('themeGen.install.button', 'Install on TinyBot') }}
              </el-button>
              <el-button :disabled="tooLarge || building || installing" :loading="building && !installing" @click="download">
                <i v-if="!building" class="el-icon-download" aria-hidden="true"></i>
                {{ tx('themeGen.download', 'Download assets.bin') }}
              </el-button>
            </div>
            <p class="tg-help">
              {{ tx('themeGen.install.help', 'TinyBot restarts, downloads the theme and installs it. It takes about a minute; the screen shows the progress.') }}
            </p>

            <!-- Install progress -->
            <ol v-if="steps.length" class="tg-steps" aria-live="polite">
              <li v-for="step in steps" :key="step.key" class="tg-steps__item" :class="'is-' + step.status">
                <span class="tg-steps__icon" aria-hidden="true">
                  <i v-if="step.status === 'done'" class="el-icon-check"></i>
                  <i v-else-if="step.status === 'active'" class="el-icon-loading"></i>
                  <i v-else-if="step.status === 'error'" class="el-icon-close"></i>
                </span>
                <span class="tg-steps__text">
                  <span>{{ stepLabel(step.key) }}</span>
                  <span v-if="step.status === 'active' && step.key === 'install'" class="tg-steps__hint nx-num">
                    {{ tx('themeGen.steps.waiting', 'Waiting for TinyBot… {seconds}s', { seconds: waitSeconds }) }}
                  </span>
                  <span v-if="step.status === 'error' && step.error" class="tg-steps__error">{{ step.error }}</span>
                </span>
              </li>
            </ol>
            <div v-if="installDone" class="tg-note tg-note--success" role="status">
              <i class="el-icon-circle-check" aria-hidden="true"></i>
              <span>{{ tx('themeGen.install.done', 'Done. TinyBot is back online. Try saying "{wake}".', { wake: selectedWake ? selectedWake.phrase : '' }) }}</span>
            </div>
          </section>
        </aside>
      </div>
    </main>
    <VersionFooter />
  </div>
</template>

<script>
import Api from '@/apis/api';
import HeaderBar from '@/components/HeaderBar.vue';
import VersionFooter from '@/components/VersionFooter.vue';
import TinyBotLook from '@/components/TinyBotLook.vue';
import {
  ASSETS_PARTITION_SIZE,
  BUILTIN_FONT,
  DEFAULT_WAKE_WORD,
  SRMODELS_FILE,
  INDEX_FILE,
  TEXT_FONTS,
  WAKENET_FILES,
  WAKE_WORDS,
  assetsPartitionSize,
  buildTinybotAssets,
  estimateTinybotAssets,
  findFont,
  findWakeWord,
  formatBytes,
  isTinybot,
  parseAssets,
  parseToolData,
} from '@/utils/tinybotAssets.mjs';

const STATIC_BASE = `${process.env.BASE_URL || '/'}generator/static/`;
const DISPLAY = { width: 128, height: 64, monochrome: true };
const REBOOT_GRACE_MS = 10000; // the robot answers self.reboot, then restarts ~1.5 s later
const POLL_MS = 5000;
const WAIT_LIMIT_MS = 4 * 60 * 1000;

export default {
  name: 'ThemeGenerator',
  components: { HeaderBar, VersionFooter, TinyBotLook },
  data() {
    return {
      deviceId: this.$route.query.deviceId || '',
      agentId: this.$route.query.agentId || '',
      device: null,
      robotState: 'idle', // idle | checking | online | offline
      systemInfo: null,
      screen: null,
      wakeWord: DEFAULT_WAKE_WORD,
      defaultWakeWord: DEFAULT_WAKE_WORD,
      font: BUILTIN_FONT,
      fonts: TEXT_FONTS,
      building: false,
      installing: false,
      installDone: false,
      steps: [],
      waitSeconds: 0,
      waitTimer: null,
      scrollTimer: null,
      scrollX: 0,
      destroyed: false,
    };
  },
  computed: {
    wakeGroups() {
      return [
        { key: 'en', label: this.tx('themeGen.wake.groupEnglish', 'English'), items: WAKE_WORDS.filter((w) => w.lang === 'en') },
        { key: 'zh', label: this.tx('themeGen.wake.groupChinese', 'Chinese'), items: WAKE_WORDS.filter((w) => w.lang === 'zh') },
      ];
    },
    selectedWake() {
      return findWakeWord(this.wakeWord);
    },
    selectedFont() {
      return findFont(this.font) || findFont(BUILTIN_FONT);
    },
    limit() {
      return this.systemInfo ? assetsPartitionSize(this.systemInfo) : ASSETS_PARTITION_SIZE;
    },
    estimate() {
      return estimateTinybotAssets({ wakeWord: this.wakeWord, font: this.font, display: DISPLAY });
    },
    tooLarge() {
      return this.estimate.total > this.limit;
    },
    tinybot() {
      return isTinybot({ systemInfo: this.systemInfo, screen: this.screen, board: this.device && this.device.board });
    },
    canInstall() {
      return !!this.deviceId && !this.tooLarge && !this.installing && !this.building && this.robotState !== 'offline'
        && this.robotState !== 'checking';
    },
    robotName() {
      if (!this.deviceId) return this.tx('themeGen.robot.noneTitle', 'No robot selected');
      return (this.device && this.device.alias) || 'TinyBot';
    },
    statusText() {
      if (!this.deviceId) return this.tx('themeGen.robot.unknown', 'Not connected');
      if (this.robotState === 'checking') return this.tx('themeGen.robot.checking', 'Checking…');
      if (this.robotState === 'online') return this.$t('companion.online');
      return this.$t('companion.offline');
    },
    statusBadgeClass() {
      if (this.robotState === 'online') return 'nx-badge--success';
      if (this.robotState === 'offline') return 'nx-badge--warning';
      return '';
    },
    chipText() {
      const info = this.systemInfo;
      if (!info) return '–';
      const chip = String(info.chip_model_name || '').toUpperCase().replace(/^ESP32(?=[A-Z])/, 'ESP32-');
      const flash = info.flash_size
        ? this.tx('themeGen.robot.flash', '{size} flash', { size: `${Math.round(info.flash_size / (1024 * 1024))} MB` })
        : '';
      return [chip, flash].filter(Boolean).join(' · ') || '–';
    },
    screenText() {
      const s = this.screen;
      if (!s || !s.width) return '–';
      return `${s.width}×${s.height} ${s.monochrome ? this.tx('themeGen.robot.mono', 'monochrome') : this.tx('themeGen.robot.color', 'colour')}`;
    },
    previewText() {
      const phrase = this.selectedWake ? this.selectedWake.phrase : 'Hi ESP';
      return this.tx('themeGen.preview.sample', 'Say "{wake}" to wake me up!', { wake: phrase });
    },
  },
  watch: {
    previewText() {
      this.scrollX = 0;
      this.drawOled();
    },
    font() {
      this.drawOled();
    },
  },
  mounted() {
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.drawOled();
    this.scrollTimer = setInterval(this.tickScroll, 60);
    if (this.deviceId) {
      this.loadDevice();
      this.loadRobot();
    }
  },
  beforeDestroy() {
    this.destroyed = true;
    clearInterval(this.scrollTimer);
    clearInterval(this.waitTimer);
    clearTimeout(this.pollTimer);
  },
  methods: {
    formatBytes,
    tx(key, fallback, params) {
      if (this.$te(key) || this.$te(key, 'en')) return this.$t(key, params);
      if (!params) return fallback;
      return fallback.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? params[name] : match));
    },
    goBack() {
      if (this.agentId) {
        this.$router.push({ name: 'DeviceManagement', query: { agentId: this.agentId } });
      } else {
        this.$router.back();
      }
    },
    wakeLabel(w) {
      return w.native ? `${w.phrase} · ${w.native}` : w.phrase;
    },
    fontName(f) {
      if (f.id === BUILTIN_FONT) return this.tx('themeGen.font.builtin', 'Built-in pixel font (8 px)');
      const family = f.id.includes('puhui') ? 'Alibaba PuHuiTi' : 'Noto Sans';
      return `${family} ${f.px} px`;
    },
    partLabel(name) {
      if (name === SRMODELS_FILE) {
        return this.tx('themeGen.summary.wakeModel', 'Wake word "{wake}"', { wake: this.selectedWake ? this.selectedWake.phrase : '' });
      }
      if (name === INDEX_FILE) return this.tx('themeGen.summary.index', 'Theme settings');
      return this.tx('themeGen.summary.font', 'Chat font');
    },
    stepLabel(key) {
      const labels = {
        build: ['themeGen.steps.build', 'Build the theme file'],
        check: ['themeGen.steps.check', 'Check that TinyBot is online'],
        upload: ['themeGen.steps.upload', 'Upload the file'],
        link: ['themeGen.steps.link', 'Send the download link to TinyBot'],
        reboot: ['themeGen.steps.reboot', 'Restart TinyBot'],
        install: ['themeGen.steps.install', 'TinyBot downloads and installs the theme'],
      };
      return this.tx(labels[key][0], labels[key][1]);
    },
    errorText(err, fallbackKey, fallback) {
      const msg = err && (err.msg || err.message);
      return msg || this.tx(fallbackKey, fallback);
    },

    // ------------------------------------------------------------------ robot
    callTool(name, args) {
      return Api.device.callDeviceToolOnce(this.deviceId, name, args).then((body) => {
        if (!body || body.code !== 0) throw body || {};
        return parseToolData(body.data);
      });
    },
    loadDevice() {
      if (!this.agentId) return;
      Api.device.getAgentBindDevices(this.agentId, ({ data }) => {
        if (data && data.code === 0 && Array.isArray(data.data)) {
          this.device = data.data.find((d) => d.id === this.deviceId) || null;
        }
      }, () => {});
    },
    async loadRobot() {
      if (!this.deviceId) return;
      this.robotState = 'checking';
      try {
        await this.callTool('self.get_device_status');
        this.robotState = 'online';
      } catch (e) {
        this.robotState = 'offline';
        return;
      }
      const [info, screen] = await Promise.all([
        this.callTool('self.get_system_info').catch(() => null),
        this.callTool('self.screen.get_info').catch(() => null),
      ]);
      if (info && typeof info === 'object') this.systemInfo = info;
      if (screen && typeof screen === 'object') this.screen = screen;
    },

    // ------------------------------------------------------------------ build
    async fetchBytes(path) {
      const res = await fetch(STATIC_BASE + path);
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async buildFile() {
      const ww = this.selectedWake;
      const files = await Promise.all(WAKENET_FILES.map((name) => this.fetchBytes(`wakenet_model/${ww.id}/${name}`)
        .then((data) => ({ name, data }))));
      let font = null;
      const f = this.selectedFont;
      if (f && f.file && f.tinybot) font = { ...f, data: await this.fetchBytes(`fonts/${f.file}`) };
      const result = buildTinybotAssets({ wakeModel: { name: ww.id, files }, font, display: DISPLAY, limit: this.limit });
      parseAssets(result.bytes, { partitionSize: this.limit }); // same checks the firmware makes
      return new Blob([result.bytes], { type: 'application/octet-stream' });
    },
    async download() {
      if (this.building) return;
      this.building = true;
      try {
        const blob = await this.buildFile();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'assets.bin';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.$message.success(this.tx('themeGen.downloaded', 'assets.bin is ready ({size})', { size: formatBytes(blob.size) }));
      } catch (e) {
        this.$message.error(this.errorText(e, 'themeGen.buildFailed', 'Could not build the theme file. Try again.'));
      } finally {
        this.building = false;
      }
    },

    // ------------------------------------------------------------------ install
    setStep(key, status, error) {
      const step = this.steps.find((s) => s.key === key);
      if (step) {
        step.status = status;
        step.error = error || '';
      }
    },
    async install() {
      if (!this.canInstall) return;
      this.installing = true;
      this.building = true;
      this.installDone = false;
      this.steps = ['build', 'check', 'upload', 'link', 'reboot', 'install'].map((key) => ({ key, status: 'pending', error: '' }));
      let current = 'build';
      try {
        this.setStep('build', 'active');
        const blob = await this.buildFile();
        this.setStep('build', 'done');

        current = 'check';
        this.setStep('check', 'active');
        try {
          await this.callTool('self.get_device_status');
        } catch (e) {
          this.robotState = 'offline';
          throw { msg: this.tx('themeGen.errors.offline', 'TinyBot is offline. Turn it on, check its Wi-Fi and try again.') };
        }
        this.robotState = 'online';
        this.setStep('check', 'done');

        current = 'upload';
        this.setStep('upload', 'active');
        const url = await Api.ota.uploadAssetsBin(blob).catch((e) => {
          throw { msg: this.errorText(e, 'themeGen.errors.upload', 'Upload failed. Check your connection and try again.') };
        });
        this.setStep('upload', 'done');

        current = 'link';
        this.setStep('link', 'active');
        await this.callTool('self.assets.set_download_url', { url }).catch((e) => {
          throw { msg: this.errorText(e, 'themeGen.errors.link', 'TinyBot did not accept the download link.') };
        });
        this.setStep('link', 'done');

        current = 'reboot';
        this.setStep('reboot', 'active');
        // The robot may restart before its answer reaches us: that is fine
        await this.callTool('self.reboot').catch(() => null);
        this.setStep('reboot', 'done');

        current = 'install';
        this.setStep('install', 'active');
        await this.waitForRobot();
        this.setStep('install', 'done');
        this.installDone = true;
        this.robotState = 'online';
      } catch (e) {
        if (this.destroyed) return;
        this.setStep(current, 'error', this.errorText(e, 'themeGen.errors.generic', 'Something went wrong. Try again.'));
      } finally {
        clearInterval(this.waitTimer);
        this.installing = false;
        this.building = false;
      }
    },
    waitForRobot() {
      const started = Date.now();
      this.waitSeconds = 0;
      clearInterval(this.waitTimer);
      this.waitTimer = setInterval(() => {
        this.waitSeconds = Math.round((Date.now() - started) / 1000);
      }, 1000);
      return new Promise((resolve, reject) => {
        const poll = () => {
          if (this.destroyed) return reject(new Error('left page'));
          if (Date.now() - started > WAIT_LIMIT_MS) {
            return reject({
              msg: this.tx('themeGen.errors.timeout', 'TinyBot has not come back yet. Check its screen; if it shows an error, try again.'),
            });
          }
          this.callTool('self.get_device_status')
            .then(resolve)
            .catch(() => {
              this.pollTimer = setTimeout(poll, POLL_MS);
            });
        };
        this.pollTimer = setTimeout(poll, REBOOT_GRACE_MS);
      });
    },

    // ------------------------------------------------------------------ OLED preview
    tickScroll() {
      if (this.reducedMotion || !this.textOverflow) return;
      this.scrollX += 1;
      this.drawOled();
    },
    drawOled() {
      const canvas = this.$refs.oled;
      if (!canvas || !canvas.getContext) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // A 1-bit panel: white pixels on black (hardware colours, not theme tokens)
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#fff';
      this.roundRect(ctx, 33, 12, 22, 28, 7);
      this.roundRect(ctx, 73, 12, 22, 28, 7);
      ctx.fillRect(58, 45, 12, 2);

      // Subtitle strip: y 53..63, 1 px side padding, text centred, scrolls when too wide
      const px = this.selectedFont ? this.selectedFont.px : 8;
      ctx.font = `${px}px "Cascadia Mono", Consolas, "Courier New", monospace`;
      ctx.textBaseline = 'top';
      const text = this.previewText;
      const width = Math.ceil(ctx.measureText(text).width);
      this.textOverflow = width > 126;
      ctx.save();
      ctx.beginPath();
      ctx.rect(1, 53, 126, 11);
      ctx.clip();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 53, 128, 11);
      ctx.fillStyle = '#fff';
      if (this.textOverflow) {
        const loop = width + 24;
        const x = 1 - (this.reducedMotion ? 0 : this.scrollX % loop);
        ctx.fillText(text, x, 55);
        ctx.fillText(text, x + loop, 55);
      } else {
        ctx.fillText(text, Math.round((128 - width) / 2), 55);
      }
      ctx.restore();

      // Threshold the anti-aliased text to on/off pixels
      const image = ctx.getImageData(0, 0, 128, 64);
      const d = image.data;
      for (let i = 0; i < d.length; i += 4) {
        const on = d[i] > 110 ? 255 : 0;
        d[i] = on;
        d[i + 1] = on;
        d[i + 2] = on;
        d[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    },
    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
    },
  },
};
</script>

<style lang="scss" scoped>
// TinyBot theme: two calm columns, settings left, preview + install right.

.tg {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--nx-bg);

  > .tg-page {
    flex: 1 0 auto;
  }
}

.tg-section-head {
  margin: var(--nx-space-7) 0 var(--nx-space-4);
  padding-top: var(--nx-space-5);
  border-top: 1px solid var(--nx-border);
}
.tg-section-title {
  margin: 0;
  font-size: var(--nx-text-title);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--nx-text);
}
.tg-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
  gap: var(--nx-space-5);
  align-items: start;
}
.tg-main,
.tg-side {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-5);
  min-width: 0;
}
.tg-side {
  position: sticky;
  top: calc(64px + var(--nx-space-5));
}

.tg-min {
  min-width: 0;
}
.tg-card-title {
  margin: 0;
  font-size: var(--nx-text-headline);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--nx-text);
}
.tg-sub {
  margin: 2px 0 0;
  font-size: var(--nx-text-footnote);
  color: var(--nx-text-2);
}
.tg-meta {
  font-size: var(--nx-text-footnote);
  color: var(--nx-text-2);
}
.tg-label {
  display: block;
  margin-bottom: var(--nx-space-1);
  font-size: var(--nx-text-footnote);
  color: var(--nx-text-2);
}
.tg-help {
  margin: var(--nx-space-2) 0 0;
  font-size: var(--nx-text-caption);
  line-height: 1.45;
  color: var(--nx-text-3);
}
.tg-error {
  margin: var(--nx-space-2) 0 0;
  font-size: var(--nx-text-footnote);
  color: var(--nx-danger);
}

// ------------------------------------------------------------------ robot card

.tg-robot-status {
  flex: none;
}
.tg-kv {
  margin-top: var(--nx-space-1);
}
.tg-sk {
  width: 120px;
  height: 14px;
}
.tg-note {
  display: flex;
  align-items: flex-start;
  gap: var(--nx-space-2);
  margin-top: var(--nx-space-4);
  padding: var(--nx-space-3) var(--nx-space-4);
  border-radius: var(--nx-radius);
  font-size: var(--nx-text-callout);
  line-height: 1.45;
  overflow-wrap: anywhere;

  i {
    margin-top: 3px;
  }
  &--info {
    background: var(--nx-info-soft);
    color: var(--nx-info);
  }
  &--warning {
    background: var(--nx-warning-soft);
    color: var(--nx-warning);
  }
  &--success {
    background: var(--nx-success-soft);
    color: var(--nx-success);
  }
}

// ------------------------------------------------------------------ choices

.tg-select {
  width: 100%;
}
.tg-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--nx-space-2);
  min-width: 0;

  &__native {
    color: var(--nx-text-3);
  }
}

.tg-choices {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);
}
.tg-choice {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-height: 44px;
  padding: var(--nx-space-3) var(--nx-space-4);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius);
  background: var(--nx-surface);
  cursor: pointer;
  transition: background-color var(--nx-dur-1) var(--nx-ease), border-color var(--nx-dur-1) var(--nx-ease);

  &:hover {
    background: var(--nx-surface-2);
  }
  &.is-active {
    border-color: var(--nx-accent);
    background: var(--nx-accent-soft);
  }
  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.6;
    &:hover {
      background: var(--nx-surface);
    }
  }
  &:focus-within {
    outline: 2px solid var(--nx-accent);
    outline-offset: 2px;
  }

  &__radio {
    flex: none;
    width: 18px;
    height: 18px;
    border: 2px solid var(--nx-border-strong);
    border-radius: 50%;
    background: var(--nx-surface);
  }
  &.is-active &__radio {
    border-color: var(--nx-accent);
    box-shadow: inset 0 0 0 3px var(--nx-surface);
    background: var(--nx-accent);
  }
  &__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  &__title {
    font-size: var(--nx-text-callout);
    font-weight: 500;
    color: var(--nx-text);
  }
  &__meta {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
}

// ------------------------------------------------------------------ preview

.tg-oled {
  display: flex;
  justify-content: center;
  padding: var(--nx-space-4);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-3);

  &__screen {
    display: block;
    width: 100%;
    max-width: 384px;
    aspect-ratio: 2 / 1;
    height: auto;
    border-radius: var(--nx-radius-sm);
    box-shadow: var(--nx-shadow-1);
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
}

// ------------------------------------------------------------------ summary

.tg-files {
  list-style: none;
  margin: 0 0 var(--nx-space-4);
  padding: 0;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-3);
    padding: var(--nx-space-2) 0;
    border-bottom: 1px solid var(--nx-border);
    font-size: var(--nx-text-callout);
  }
  &__name {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  &__file {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
  &__size {
    flex: none;
    color: var(--nx-text-2);
  }
}

.tg-meter-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--nx-space-1);
  font-size: var(--nx-text-footnote);
  color: var(--nx-text-2);
}
.tg-over {
  color: var(--nx-danger);
  font-weight: 600;
}
.tg-meter {
  display: block;
  height: 8px;
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface-3);
  overflow: hidden;

  &__fill {
    display: block;
    height: 100%;
    background: var(--nx-accent);
    transform-origin: left center;
    transition: transform var(--nx-dur-2) var(--nx-ease);
    &.is-over {
      background: var(--nx-danger);
    }
  }
}

.tg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--nx-space-2);
  margin-top: var(--nx-space-5);

  .el-button {
    flex: 1 1 160px;
    margin-left: 0;
  }
}

.tg-steps {
  list-style: none;
  margin: var(--nx-space-4) 0 0;
  padding: var(--nx-space-4) 0 0;
  border-top: 1px solid var(--nx-border);
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);

  &__item {
    display: flex;
    align-items: flex-start;
    gap: var(--nx-space-3);
    font-size: var(--nx-text-callout);
    color: var(--nx-text-3);

    &.is-active,
    &.is-done {
      color: var(--nx-text);
    }
    &.is-error {
      color: var(--nx-danger);
    }
  }
  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--nx-surface-2);
    font-size: 12px;
  }
  .is-done &__icon {
    background: var(--nx-success-soft);
    color: var(--nx-success);
  }
  .is-active &__icon {
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
  }
  .is-error &__icon {
    background: var(--nx-danger-soft);
    color: var(--nx-danger);
  }
  &__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding-top: 1px;
  }
  &__hint {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
  &__error {
    font-size: var(--nx-text-footnote);
    overflow-wrap: anywhere;
  }
}

@media (max-width: 1100px) {
  .tg-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .tg-side {
    position: static;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tg-meter__fill,
  .tg-choice {
    transition: none;
  }
}
</style>
