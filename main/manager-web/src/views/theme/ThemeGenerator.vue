<template>
  <div class="theme">
    <TbPageHeader :title="$t('nav.themeGenerator')" :description="$t('theme.desc')" />

    <p class="theme__rule">
      <TbIcon name="info" :size="16" />
      <span>{{ $t('theme.rule') }}</span>
      <RouterLink class="theme__rulelink" to="/look">{{ $t('theme.openLook') }}</RouterLink>
    </p>

    <div class="theme__grid">
      <div class="theme__main">
        <!-- Robot: where the file goes -->
        <TbSection :title="$t('theme.robot.title')" :description="$t('theme.robot.desc')">
          <div class="theme__robotbar">
            <TbField class="theme__pick" :label="$t('theme.robot.pick')" for-id="theme-robot">
              <TbSelect id="theme-robot" :model-value="deviceId" :options="robotOptions" :disabled="installing"
                @change="pickRobot" />
            </TbField>
            <p class="theme__state" :class="`is-${robotState}`" role="status">
              <i aria-hidden="true"></i>{{ statusText }}
            </p>
            <TbButton v-if="deviceId" class="theme__recheck" size="s" icon="refresh" :loading="robotState === 'checking'"
              :disabled="robotState === 'checking' || installing" @click="loadRobot">{{ $t('themeGen.robot.refresh') }}</TbButton>
          </div>

          <dl v-if="deviceId" class="theme__kv">
            <div>
              <dt>{{ $t('themeGen.robot.chip') }}</dt>
              <dd><TbLoading v-if="robotState === 'checking' && !systemInfo" :label="$t('themeGen.robot.checking')" />
                <template v-else>{{ chipText }}</template></dd>
            </div>
            <div>
              <dt>{{ $t('themeGen.robot.screen') }}</dt>
              <dd><TbLoading v-if="robotState === 'checking' && !screen" :label="$t('themeGen.robot.checking')" />
                <template v-else>{{ screenText }}</template></dd>
            </div>
            <div>
              <dt>{{ $t('themeGen.robot.space') }}</dt>
              <dd class="tb-num">{{ bytes(limit) }}</dd>
            </div>
            <div v-if="device && device.appVersion">
              <dt>{{ $t('themeGen.robot.firmware') }}</dt>
              <dd class="tb-num">{{ num(device.appVersion) }}</dd>
            </div>
            <div v-if="device && device.macAddress">
              <dt>{{ $t('theme.robot.mac') }}</dt>
              <dd class="tb-num theme__mac">{{ device.macAddress }}</dd>
            </div>
          </dl>

          <p v-if="!deviceId" class="theme__note" role="status">
            <TbIcon name="info" :size="18" /><span>{{ $t('themeGen.robot.none') }}</span>
          </p>
          <p v-else-if="robotState === 'offline'" class="theme__note is-warn" role="status">
            <TbIcon name="warning" :size="18" /><span>{{ $t('themeGen.robot.offlineHint') }}</span>
          </p>
          <p v-else-if="robotState === 'online' && !tinybot" class="theme__note is-warn" role="status">
            <TbIcon name="warning" :size="18" /><span>{{ $t('themeGen.robot.notTinybot') }}</span>
          </p>
        </TbSection>

        <!-- Wake word -->
        <TbSection :title="$t('themeGen.wake.title')" :description="$t('themeGen.wake.desc')">
          <div class="theme__chosen" aria-live="polite">
            <p class="theme__phrase">{{ selectedWake ? selectedWake.phrase : '–' }}</p>
            <p class="theme__phrasemeta">
              <span v-if="selectedWake && selectedWake.native" lang="zh">{{ selectedWake.native }}</span>
              <span class="tb-num">{{ selectedWake ? selectedWake.id : '' }}</span>
              <TbTag v-if="wakeWord === defaultWakeWord" ink="ink-2">{{ $t('themeGen.wake.default') }}</TbTag>
            </p>
          </div>

          <div class="theme__filters">
            <TbChoice v-model="wakeLang" :options="langOptions" :aria-label="$t('theme.wake.langLabel')" />
            <TbInput v-model="wakeQuery" class="theme__search" icon="search" clearable
              :placeholder="$t('theme.wake.searchPlaceholder')" :aria-label="$t('theme.wake.searchLabel')"
              :clear-label="$t('theme.wake.clearSearch')" />
          </div>

          <fieldset class="theme__words" :disabled="installing">
            <legend class="tb-visually-hidden">{{ $t('theme.wake.listLabel') }}</legend>
            <label v-for="w in shownWords" :key="w.id" class="theme__word" :class="{ 'is-on': w.id === wakeWord }">
              <input v-model="wakeWord" type="radio" name="theme-wake" :value="w.id" />
              <span class="theme__wordname">
                <b>{{ w.phrase }}</b>
                <small v-if="w.native" lang="zh">{{ w.native }}</small>
              </span>
              <TbTag v-if="w.id === defaultWakeWord" ink="ink-2">{{ $t('themeGen.wake.default') }}</TbTag>
              <span class="theme__wordsize tb-num">{{ bytes(w.size) }}</span>
            </label>
            <div v-if="!shownWords.length" class="theme__nomatch">
              <TbEmpty :title="$t('theme.wake.noMatch', { q: wakeQuery.trim() })">
                <TbButton size="s" @click="wakeQuery = ''">{{ $t('theme.wake.clearSearch') }}</TbButton>
              </TbEmpty>
            </div>
          </fieldset>
          <p class="theme__help">{{ $t('themeGen.wake.help') }}</p>
        </TbSection>
      </div>

      <aside class="theme__side" :aria-label="$t('theme.sideLabel')">
        <!-- Preview of the robot's subtitle line -->
        <section class="theme__block" aria-labelledby="theme-preview-h">
          <header class="theme__blockhead">
            <h2 id="theme-preview-h">{{ $t('themeGen.preview.title') }}</h2>
            <span class="theme__dim tb-num">{{ num('128×64') }}</span>
          </header>
          <div class="theme__oled">
            <canvas ref="oled" width="128" height="64" role="img"
              :aria-label="$t('themeGen.preview.alt', { text: previewText })"></canvas>
          </div>
          <div class="theme__previewfoot">
            <p class="theme__help">{{ $t('themeGen.preview.note') }}</p>
            <TbButton v-if="textOverflow && !reducedMotion" size="s" variant="quiet" icon="play" :disabled="scrolling"
              @click="startScroll">{{ $t('theme.preview.replay') }}</TbButton>
          </div>
        </section>

        <!-- The file -->
        <section class="theme__block" aria-labelledby="theme-file-h">
          <header class="theme__blockhead">
            <h2 id="theme-file-h">{{ $t('themeGen.summary.title') }}</h2>
          </header>
          <ul class="theme__files">
            <li v-for="part in estimate.parts" :key="part.name">
              <span class="theme__filename">
                <span>{{ partLabel(part.name) }}</span>
                <small>{{ part.name }}</small>
              </span>
              <span class="tb-num">{{ bytes(part.size) }}</span>
            </li>
          </ul>

          <p class="theme__total" :class="{ 'is-over': tooLarge }">
            <b class="tb-num">{{ bytes(estimate.total) }}</b>
            <span>{{ $t('theme.file.of', { limit: bytes(limit) }) }}</span>
          </p>
          <span class="theme__meter" role="progressbar" aria-valuemin="0" :aria-valuemax="limit" :aria-valuenow="estimate.total"
            :aria-valuetext="bytes(estimate.total) + ' / ' + bytes(limit)" :aria-label="$t('themeGen.summary.size')">
            <i :class="{ 'is-over': tooLarge }" :style="{ transform: `scaleX(${ratio})` }"></i>
          </span>
          <p v-if="tooLarge" class="theme__error" role="alert">{{ $t('themeGen.summary.tooLarge', { limit: bytes(limit) }) }}</p>

          <div class="theme__actions">
            <TbButton variant="primary" size="l" block icon="upload" :loading="installing" :disabled="!canInstall" @click="install">
              {{ installing ? $t('themeGen.install.running') : $t('themeGen.install.button') }}
            </TbButton>
            <TbButton block icon="download" :loading="building && !installing" :disabled="tooLarge || building || installing"
              @click="download">{{ $t('themeGen.download') }}</TbButton>
          </div>
          <p class="theme__help">{{ $t('themeGen.install.help') }}</p>
        </section>

        <!-- Install progress -->
        <section v-if="steps.length" class="theme__block" aria-labelledby="theme-steps-h">
          <header class="theme__blockhead"><h2 id="theme-steps-h">{{ $t('theme.steps.title') }}</h2></header>
          <ol class="theme__steps" aria-live="polite">
            <li v-for="step in steps" :key="step.key" :class="`is-${step.status}`">
              <span class="theme__stepmark" aria-hidden="true">
                <TbIcon v-if="step.status === 'done'" name="check" :size="16" />
                <TbIcon v-else-if="step.status === 'error'" name="close" :size="16" />
                <TbLoading v-else-if="step.status === 'active'" />
                <i v-else></i>
              </span>
              <span class="theme__steptext">
                <span>{{ stepLabel(step.key) }}<span class="tb-visually-hidden">, {{ $t(`theme.steps.${step.status}`) }}</span></span>
                <small v-if="step.status === 'active' && step.key === 'install'" class="tb-num">
                  {{ $t('themeGen.steps.waiting', { seconds: num(waitSeconds) }) }}
                </small>
                <small v-if="step.status === 'error' && step.error" class="theme__steperr">{{ step.error }}</small>
              </span>
            </li>
          </ol>
          <p v-if="installDone" class="theme__done" role="status">
            <TbIcon name="check" :size="18" />
            <span>{{ $t('themeGen.install.done', { wake: selectedWake ? selectedWake.phrase : '' }) }}</span>
          </p>
        </section>
      </aside>
    </div>
  </div>
</template>

<script>
import { peopleText } from '@/utils/errorText.mjs';
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { deviceIdFrom, loadRobots, robot } from '@/shell/robot';
import {
  ASSETS_PARTITION_SIZE,
  DEFAULT_WAKE_WORD,
  INDEX_FILE,
  SRMODELS_FILE,
  WAKENET_FILES,
  assetsPartitionSize,
  buildTinybotAssets,
  estimateTinybotAssets,
  findWakeWord,
  formatBytes,
  isTinybot,
  parseAssets,
  parseToolData,
} from '@/utils/tinybotAssets.mjs';
import { STEP_KEYS, WAKE_LANGS, chipName, countByLang, fillRatio, filterWakeWords, flashText } from './themeModel';

// Wake word & theme (back office). Builds TinyBot's assets.bin in the browser (the WakeNet model
// files come from the embedded generator's static folder, public/generator/static) and installs
// it on a robot over Wi-Fi: upload, hand the robot the download link, restart, wait for it.
// Legacy behaviour kept: robot from ?deviceId= / ?agentId=, chip, screen and partition read from
// the robot's tools, size checked against the partition, download without a robot, and the same
// six install steps with their errors. The face editor lives on the Look page now.
const STATIC_BASE = `${process.env.BASE_URL || '/'}generator/static/`;
const DISPLAY = { width: 128, height: 64, monochrome: true };
const REBOOT_GRACE_MS = 10000; // the robot answers self.reboot, then restarts about 1.5 s later
const POLL_MS = 5000;
const WAIT_LIMIT_MS = 4 * 60 * 1000;
const SCROLL_MS = 60;

export default {
  name: 'ThemeGenerator',
  data() {
    const query = (this.$route && this.$route.query) || {};
    const deviceId = deviceIdFrom(this.$route);
    return {
      deviceId,
      agentId: query.agentId || (deviceId && robot.deviceId === deviceId ? robot.agentId : ''),
      device: null,
      robotState: 'idle', // idle | checking | online | offline
      systemInfo: null,
      screen: null,
      wakeWord: DEFAULT_WAKE_WORD,
      defaultWakeWord: DEFAULT_WAKE_WORD,
      wakeLang: (findWakeWord(DEFAULT_WAKE_WORD) || {}).lang || 'en',
      wakeQuery: '',
      building: false,
      installing: false,
      installDone: false,
      steps: [],
      waitSeconds: 0,
      textOverflow: false,
      scrolling: false,
      scrollX: 0,
      reducedMotion: false,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    robotOptions() {
      const list = robot.list.map((r) => ({
        value: r.deviceId,
        label: [r.name || r.agentName || 'TinyBot', r.macAddress].filter(Boolean).join('  '),
      }));
      if (this.deviceId && !list.some((o) => o.value === this.deviceId)) {
        list.unshift({ value: this.deviceId, label: this.robotName });
      }
      return [...list, { value: '', label: this.$t('theme.robot.noneOption') }];
    },
    langOptions() {
      const counts = countByLang();
      const names = { en: this.$t('themeGen.wake.groupEnglish'), zh: this.$t('themeGen.wake.groupChinese') };
      return WAKE_LANGS.map((l) => ({ value: l, label: `${names[l]} ${this.num(counts[l] || 0)}` }));
    },
    shownWords() {
      return filterWakeWords({ lang: this.wakeQuery.trim() ? '' : this.wakeLang, query: this.wakeQuery });
    },
    selectedWake() {
      return findWakeWord(this.wakeWord);
    },
    limit() {
      return this.systemInfo ? assetsPartitionSize(this.systemInfo) : ASSETS_PARTITION_SIZE;
    },
    estimate() {
      return estimateTinybotAssets({ wakeWord: this.wakeWord, display: DISPLAY });
    },
    ratio() { return fillRatio(this.estimate.total, this.limit); },
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
      if (!this.deviceId) return this.$t('themeGen.robot.noneTitle');
      const entry = robot.list.find((r) => r.deviceId === this.deviceId);
      return (this.device && this.device.alias) || (entry && entry.name) || 'TinyBot';
    },
    statusText() {
      if (!this.deviceId) return this.$t('themeGen.robot.unknown');
      if (this.robotState === 'checking') return this.$t('themeGen.robot.checking');
      if (this.robotState === 'online') return this.$t('companion.online');
      if (this.robotState === 'offline') return this.$t('companion.offline');
      return this.$t('themeGen.robot.unknown');
    },
    chipText() {
      const info = this.systemInfo;
      if (!info) return '–';
      const flash = flashText(info);
      const parts = [chipName(info), flash ? this.$t('themeGen.robot.flash', { size: this.num(flash) }) : ''];
      return parts.filter(Boolean).join(', ') || '–';
    },
    screenText() {
      const s = this.screen;
      if (!s || !s.width) return '–';
      return `${this.num(`${s.width}×${s.height}`)} ${s.monochrome ? this.$t('themeGen.robot.mono') : this.$t('themeGen.robot.color')}`;
    },
    previewText() {
      const phrase = this.selectedWake ? this.selectedWake.phrase : 'Hi ESP';
      return this.$t('themeGen.preview.sample', { wake: phrase });
    },
  },
  watch: {
    previewText() { this.startScroll(); },
  },
  mounted() {
    this.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.startScroll();
    if (this.deviceId) {
      this.loadDevice();
      this.loadRobot();
    }
    // The account's robots fill the picker; "this robot" is used when the page was opened bare.
    const opened = this.deviceId;
    loadRobots().then(() => {
      if (this.destroyed) return;
      if (!opened && !this.deviceId && robot.deviceId && !this.picked) this.pickRobot(robot.deviceId, true);
      else if (this.deviceId && !this.agentId) {
        const entry = robot.list.find((r) => r.deviceId === this.deviceId);
        if (entry && entry.agentId) {
          this.agentId = entry.agentId;
          this.loadDevice();
        }
      }
    }).catch(() => {});
  },
  beforeUnmount() {
    this.destroyed = true;
    clearInterval(this.scrollTimer);
    clearInterval(this.waitTimer);
    clearTimeout(this.pollTimer);
  },
  methods: {
    num(v) { return digits(v, this.lang); },
    bytes(n) { return this.num(formatBytes(n)); },
    partLabel(name) {
      if (name === SRMODELS_FILE) {
        return this.$t('themeGen.summary.wakeModel', { wake: this.selectedWake ? this.selectedWake.phrase : '' });
      }
      if (name === INDEX_FILE) return this.$t('themeGen.summary.index');
      return name;
    },
    stepLabel(key) {
      return this.$t(`themeGen.steps.${key}`);
    },
    errorText(err, fallbackKey) {
      if (err && err.own) return err.msg; // a line this page already wrote
      // the server's words only when they are meant for people (src/utils/errorText.mjs)
      const msg = err && ((err.data && err.data.msg) || err.msg || err.message);
      return peopleText(msg) || this.$t(fallbackKey);
    },

    // ------------------------------------------------------------------ robot
    pickRobot(id, automatic = false) {
      if (this.installing) return;
      if (!automatic) this.picked = true;
      const entry = robot.list.find((r) => r.deviceId === id);
      this.deviceId = id || '';
      this.agentId = (entry && entry.agentId) || '';
      this.device = null;
      this.systemInfo = null;
      this.screen = null;
      this.robotState = 'idle';
      this.installDone = false;
      this.steps = [];
      if (this.deviceId) {
        this.loadDevice();
        this.loadRobot();
      }
    },
    callTool(name, args) {
      return Api.device.callDeviceToolOnce(this.deviceId, name, args).then((body) => {
        if (!body || body.code !== 0) throw body || {};
        return parseToolData(body.data);
      });
    },
    loadDevice() {
      if (!this.agentId) return;
      const deviceId = this.deviceId;
      Api.device.getAgentBindDevices(this.agentId, ({ data }) => {
        if (deviceId !== this.deviceId) return;
        if (data && data.code === 0 && Array.isArray(data.data)) {
          this.device = data.data.find((d) => d.id === this.deviceId) || null;
        }
      }, () => {});
    },
    async loadRobot() {
      if (!this.deviceId) return;
      const deviceId = this.deviceId;
      this.robotState = 'checking';
      try {
        await this.callTool('self.get_device_status');
      } catch (e) {
        if (deviceId === this.deviceId) this.robotState = 'offline';
        return;
      }
      if (deviceId !== this.deviceId) return;
      this.robotState = 'online';
      const [info, screen] = await Promise.all([
        this.callTool('self.get_system_info').catch(() => null),
        this.callTool('self.screen.get_info').catch(() => null),
      ]);
      if (deviceId !== this.deviceId) return;
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
      // No text font: TinyBot's chat fonts are built into the firmware (Look > chat font)
      const result = buildTinybotAssets({ wakeModel: { name: ww.id, files }, display: DISPLAY, limit: this.limit });
      parseAssets(result.bytes, { partitionSize: this.limit }); // the same checks the firmware makes
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
        this.$message.success(this.$t('themeGen.downloaded', { size: this.bytes(blob.size) }));
      } catch (e) {
        this.$message.error(this.errorText(e, 'themeGen.buildFailed'));
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
      this.steps = STEP_KEYS.map((key) => ({ key, status: 'pending', error: '' }));
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
          throw { msg: this.$t('themeGen.errors.offline'), own: true };
        }
        this.robotState = 'online';
        this.setStep('check', 'done');

        current = 'upload';
        this.setStep('upload', 'active');
        const url = await Api.ota.uploadAssetsBin(blob).catch((e) => {
          throw { msg: this.errorText(e, 'themeGen.errors.upload'), own: true };
        });
        this.setStep('upload', 'done');

        current = 'link';
        this.setStep('link', 'active');
        await this.callTool('self.assets.set_download_url', { url }).catch((e) => {
          throw { msg: this.errorText(e, 'themeGen.errors.link'), own: true };
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
        this.setStep(current, 'error', this.errorText(e, 'themeGen.errors.generic'));
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
            return reject({ msg: this.$t('themeGen.errors.timeout'), own: true });
          }
          this.callTool('self.get_device_status')
            .then(resolve)
            .catch(() => {
              this.pollTimer = setTimeout(poll, POLL_MS);
            });
          return undefined;
        };
        this.pollTimer = setTimeout(poll, REBOOT_GRACE_MS);
      });
    },

    // ------------------------------------------------------------------ OLED preview
    // The subtitle line scrolls once when the phrase changes (as on the robot), then rests.
    startScroll() {
      clearInterval(this.scrollTimer);
      this.scrollX = 0;
      this.scrolling = false;
      this.drawOled();
      if (this.reducedMotion || !this.textOverflow) return;
      this.scrolling = true;
      this.scrollTimer = setInterval(() => {
        this.scrollX += 1;
        if (this.scrollX >= this.scrollLoop) {
          this.scrollX = 0;
          this.scrolling = false;
          clearInterval(this.scrollTimer);
        }
        this.drawOled();
      }, SCROLL_MS);
    },
    drawOled() {
      const canvas = this.$refs.oled;
      let ctx = null;
      try { ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null; } catch (e) { ctx = null; }
      if (!ctx) return;
      // A 1-bit panel: lit pixels on an unlit glass (hardware colours, not theme tokens)
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = 'white';
      this.roundRect(ctx, 33, 12, 22, 28, 7);
      this.roundRect(ctx, 73, 12, 22, 28, 7);
      ctx.fillRect(58, 45, 12, 2);

      // Subtitle strip in an 8 px font like the default chat font: y 53..63, 1 px side padding,
      // centred, scrolled when too wide
      ctx.font = '8px "Cascadia Mono", Consolas, "Courier New", monospace';
      ctx.textBaseline = 'top';
      const text = this.previewText;
      const width = Math.ceil(ctx.measureText(text).width);
      this.textOverflow = width > 126;
      this.scrollLoop = width + 24;
      ctx.save();
      ctx.beginPath();
      ctx.rect(1, 53, 126, 11);
      ctx.clip();
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 53, 128, 11);
      ctx.fillStyle = 'white';
      if (this.textOverflow) {
        const x = 1 - this.scrollX;
        ctx.fillText(text, x, 55);
        ctx.fillText(text, x + this.scrollLoop, 55);
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

<style>
.theme { padding-bottom: var(--tb-s8); }
.theme__rule {
  display: flex; flex-wrap: wrap; align-items: flex-start; gap: 4px 8px; padding: 10px 0;
  border-bottom: 1px solid var(--tb-rule-soft); font-size: var(--tb-fs-13); color: var(--tb-ink-2);
}
.theme__rule .tb-icon { flex: none; margin-top: 3px; }
.theme__rule > span { flex: 1 1 40ch; max-width: 80ch; }
.theme__rulelink { font-weight: 600; color: var(--tb-ink); white-space: nowrap; }

.theme__grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 var(--tb-s8); align-items: start; }
.theme__main, .theme__side { min-width: 0; }

/* robot */
.theme__robotbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 20px; }
.theme__pick { flex: 1 1 280px; max-width: 440px; min-width: 0; }
.theme__state { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-size: var(--tb-fs-14); font-weight: 600; color: var(--tb-ink-2); }
.theme__state i { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--tb-ink-3); }
.theme__state.is-online { color: var(--tb-ink); }
.theme__state.is-online i { background: var(--tb-ok); border-color: var(--tb-ok); }
.theme__state.is-checking i { border-style: dashed; }
.theme__recheck { margin-bottom: 6px; }
.theme__kv { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); margin: 0; border-top: 1px solid var(--tb-rule-soft); }
.theme__kv > div { display: grid; gap: 2px; padding: 10px 12px 10px 0; border-bottom: 1px solid var(--tb-rule-soft); min-width: 0; }
.theme__kv dt { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.theme__kv dd { margin: 0; font-weight: 600; min-height: 1.55em; overflow-wrap: anywhere; }
.theme__mac { font-weight: 500; }
.theme__note { display: flex; align-items: flex-start; gap: 8px; font-size: var(--tb-fs-14); color: var(--tb-ink-2); max-width: 75ch; }
.theme__note .tb-icon { flex: none; margin-top: 2px; }
.theme__note.is-warn { color: var(--tb-warn); }

/* wake word */
.theme__chosen { display: grid; gap: 4px; }
.theme__phrase {
  font-family: var(--tb-font-display); font-weight: 800; font-size: clamp(2rem, 6vw, var(--tb-fs-48));
  line-height: 1.05; letter-spacing: -.02em; overflow-wrap: anywhere;
}
.theme__phrasemeta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.theme__filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; }
.theme__search { flex: 1 1 220px; max-width: 360px; min-width: 0; }
.theme__words {
  margin: 0; padding: 0; border: 0; border-top: 1px solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule);
  max-height: 24rem; overflow-y: auto; overscroll-behavior: contain; min-width: 0;
}
.theme__word {
  display: grid; grid-template-columns: 20px minmax(0, 1fr) auto auto; align-items: center; gap: 12px;
  min-height: 44px; padding: 6px 8px 6px 4px; border-bottom: 1px solid var(--tb-rule-soft); cursor: pointer;
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.theme__word:last-child { border-bottom: 0; }
.theme__word input { width: 18px; height: 18px; margin: 0; }
.theme__wordname { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; min-width: 0; }
.theme__wordname b { font-weight: 600; }
.theme__wordname small { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.theme__wordsize { font-size: var(--tb-fs-13); color: var(--tb-ink-3); white-space: nowrap; }
.theme__word.is-on { background: var(--tb-paper-2); }
.theme__word.is-on b { color: var(--tb-action); }
.theme__words:disabled .theme__word { cursor: not-allowed; opacity: .6; }
@media (hover: hover) and (pointer: fine) { .theme__word:hover { background: var(--tb-paper-2); } }
.theme__help { font-size: var(--tb-fs-13); color: var(--tb-ink-2); max-width: 75ch; }

/* side */
.theme__block { padding: var(--tb-s5) 0 var(--tb-s6); border-bottom: 1px solid var(--tb-rule); display: grid; gap: 12px; }
.theme__blockhead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.theme__blockhead h2 { font-size: var(--tb-fs-18); }
.theme__dim { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.theme__oled { background: var(--tb-face); border-radius: var(--tb-radius-s); padding: 5%; }
.theme__oled canvas { display: block; width: 100%; aspect-ratio: 2 / 1; height: auto; image-rendering: pixelated; }
.theme__previewfoot { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.theme__files { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule-soft); }
.theme__files li {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft); font-size: var(--tb-fs-14);
}
.theme__filename { display: grid; min-width: 0; }
.theme__filename span { overflow-wrap: anywhere; }
.theme__filename small { font-size: var(--tb-fs-12); color: var(--tb-ink-3); }
.theme__total { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.theme__total b { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-32); line-height: 1.1; }
.theme__total span { font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.theme__total.is-over b { color: var(--tb-danger); }
.theme__meter { display: block; height: 4px; background: var(--tb-rule-soft); overflow: hidden; }
.theme__meter i { display: block; height: 100%; background: var(--tb-ink); transform-origin: left center;
  transition: transform var(--tb-t-day) var(--tb-ease); }
.theme__meter i.is-over { background: var(--tb-danger); }
.theme__error { font-size: var(--tb-fs-14); color: var(--tb-danger); font-weight: 500; }
.theme__actions { display: grid; gap: 8px; margin-top: 4px; }

.theme__steps { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule-soft); }
.theme__steps li {
  display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: start; gap: 8px; padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft); font-size: var(--tb-fs-14); color: var(--tb-ink-3);
}
.theme__steps li.is-done, .theme__steps li.is-active { color: var(--tb-ink); }
.theme__steps li.is-error { color: var(--tb-danger); }
.theme__stepmark { display: flex; align-items: center; min-height: 1.55em; }
.theme__stepmark > i { width: 16px; height: 0; border-top: 2px dashed var(--tb-ink-3); }
.theme__steps li.is-done .theme__stepmark { color: var(--tb-ok); }
.theme__steps li.is-active .theme__stepmark .tb-loading i { width: 6px; }
.theme__steptext { display: grid; gap: 2px; min-width: 0; }
.theme__steptext small { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.theme__steptext .theme__steperr { color: var(--tb-danger); overflow-wrap: anywhere; }
.theme__done { display: flex; align-items: flex-start; gap: 8px; font-weight: 600; color: var(--tb-ok); }
.theme__done .tb-icon { flex: none; margin-top: 2px; }

@media (min-width: 1100px) {
  .theme__grid { grid-template-columns: minmax(0, 1fr) 340px; }
  .theme__side { position: sticky; top: 0; }
}
@media (max-width: 640px) {
  .theme__pick { max-width: none; flex-basis: 100%; }
  .theme__robotbar { align-items: center; }
  .theme__recheck { min-height: var(--tb-target); margin: 0 0 0 auto; }
  .theme__search { max-width: none; flex-basis: 100%; }
  .theme__filters .tb-choice { width: 100%; }
  .theme__word { grid-template-columns: 20px minmax(0, 1fr) auto; }
  .theme__word .tb-tag { display: none; }
  .theme__words { max-height: 20rem; }
  .theme__previewfoot .tb-btn { min-height: var(--tb-target); }
}
</style>
