<template>
  <div class="rb">
    <TbPageHeader :title="$t('nav.robot')" :description="$t('robot.lede')">
      <template v-if="view" #actions>
        <TbRobotStatus compact :status="status" />
        <TbButton size="s" variant="quiet" icon="refresh" :loading="loading" @click="refresh(false)">{{ $t('robot.refresh') }}</TbButton>
      </template>
    </TbPageHeader>

    <div v-if="!deviceId" class="rb__state">
      <TbEmpty face="confused" :title="$t('common.noRobot')" :text="$t('common.noRobotText')">
        <TbButton variant="primary" to="/robots" icon="robots">{{ $t('common.goRobots') }}</TbButton>
      </TbEmpty>
    </div>

    <div v-else-if="!view" class="rb__state">
      <TbLoading v-if="loading || !loadError" :label="$t('common.loading')" show-label />
      <TbRobotStatus v-else class="rb__status" :status="status" :loading="loading" :hint="$t('status.pageWaits')"
        @refresh="recheck" />
    </div>

    <template v-else>
      <TbRobotStatus v-if="showStatus" class="rb__status" :status="status" :loading="loading" @refresh="recheck" />
      <p v-if="status.state === 'offline'" class="rb__offline" role="status">{{ $t('robot.offlineNote') }}</p>

      <nav class="rb__index" :aria-label="$t('robot.indexLabel')">
        <a v-for="s in index" :key="s" :href="`#rb-${s}`" class="rb__indexlink" :aria-current="current === s ? 'true' : null" @click.prevent="jump(s)">{{ $t(`robot.sec.${s}`) }}</a>
      </nav>

      <RobotStatus id="rb-status" />
      <RobotSound id="rb-sound" />
      <RobotTalk id="rb-talk" />
      <RobotMemory id="rb-memory" />
      <RobotJobs id="rb-jobs" />
      <RobotFirmware id="rb-firmware" />
    </template>
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits, timeText } from '@/kit/calendar';
import { deviceIdFrom, loadRobots, robot } from '@/shell/robot';
import {
  ensureMqtt, friendlyError, noteCompanionError, noteCompanionView, refreshRobotStatus, statusOf,
} from '@/shell/robotStatus';
import { ageOf, isLastPageOn, memoryList, robotPages } from '@/utils/companion.mjs';
import { createUpdateFlow, initialUpdateState } from '@/utils/firmwareUpdate.mjs';
import {
  FORM_SECTIONS, MINUTE_PICKERS, jobArg, pickerChoice, sectionPatch, sectionProblem, serverForm, soundSavedNote,
} from './robotModel';
import RobotStatus from './RobotStatus.vue';
import RobotSound from './RobotSound.vue';
import RobotTalk from './RobotTalk.vue';
import RobotMemory from './RobotMemory.vue';
import RobotJobs from './RobotJobs.vue';
import RobotFirmware from './RobotFirmware.vue';

const REFRESH_MS = 10000;

// Robot: the robot itself, for this robot. Its status and name plate, sound and screen, talking
// first, what it remembers, the jobs it can be given, and its firmware. The page is the controller
// its sections inject as `robot`: the companion view, the editable forms (kept while unsaved when
// a poll brings new data), saves as partial config patches, commands and the sync states.
export default {
  name: 'RobotSettings',
  components: { RobotStatus, RobotSound, RobotTalk, RobotMemory, RobotJobs, RobotFirmware },
  provide() { return { robot: this }; },
  data() {
    return {
      view: null,
      loading: false,
      inflight: false,
      loadError: '',
      now: Date.now(),
      forms: Object.fromEntries(FORM_SECTIONS.map((s) => [s, serverForm(null, s)])),
      baseline: {},
      customPick: { dim: false, off: false },
      saving: {},   // area -> true while a save is open
      failed: {},   // area -> true after a failed save
      busy: '',     // job being sent
      storyTopic: '',
      moreEvents: null,
      loadingEvents: false,
      // firmware: the device list entry (version, auto update), the newest published build, "Update now"
      fwDevice: null,
      fwLatest: null,
      fwUpdate: initialUpdateState(),
      savingAuto: false,
      index: ['status', 'sound', 'talk', 'memory', 'jobs', 'firmware'],
      current: '', // the section the reader is in, marked in the index
      seen: {},    // section key -> crossing the reading band
      spy: null,
      timer: null,
      later: null,
    };
  },
  computed: {
    deviceId() { return deviceIdFrom(this.$route); },
    agentId() { return (this.$route && this.$route.query && this.$route.query.agentId) || robot.agentId || ''; },
    lang() { return this.$i18n.locale; },
    // The robot's connection, the same on every page (src/shell/robotStatus.js): it follows what
    // this page, any other page or the sidebar learns.
    status() { return statusOf(this.deviceId, { now: this.now }); },
    showStatus() { return !['online', 'checking'].includes(this.status.state); },
    online() { return !!this.view && this.status.state === 'online'; },
    stats() { return (this.view && this.view.stats) || {}; },
    pages() { return robotPages(this.view && this.view.settings && this.view.settings.pages); },
    memories() { return memoryList(this.view && this.view.memories); },
    commands() { return (this.view && this.view.commands) || []; },
    events() { return this.moreEvents || (this.view && this.view.events) || []; },
    botName() { return (this.view && this.view.name) || robot.name || this.$t('nav.robotFallback'); },
  },
  watch: {
    // the sections exist once the view has loaded: follow them from then on
    view(now, was) { if (now && !was) this.$nextTick(this.observeIndex); },
    deviceId() {
      this.view = null; this.moreEvents = null; this.fwDevice = null;
      if (this.fwFlow) this.fwFlow.reset();
      this.refresh(false); this.loadDevice();
    },
  },
  mounted() {
    loadRobots();
    if (this.deviceId) {
      this.fwFlow = createUpdateFlow({
        sendCommand: (cmd) => new Promise((resolve, reject) => {
          Api.companion.sendCompanionCommand(this.deviceId, cmd.type, cmd.arg || '',
            (res) => resolve((res && res.data && res.data.data) || {}), reject);
        }),
        fetchView: () => new Promise((resolve, reject) => {
          Api.companion.getCompanion(this.deviceId, (res) => resolve(res.data.data), reject);
        }),
        appVersion: () => (this.fwDevice && this.fwDevice.appVersion) || '',
        onChange: (state) => { this.fwUpdate = state; },
      });
      this.refresh(false);
      ensureMqtt(this.deviceId);
      this.loadDevice();
      this.loadLatest();
    }
    this.timer = setInterval(() => { if (!document.hidden) this.refresh(true); }, REFRESH_MS);
    document.addEventListener('visibilitychange', this.onVisible);
  },
  beforeUnmount() {
    clearInterval(this.timer);
    clearTimeout(this.later);
    document.removeEventListener('visibilitychange', this.onVisible);
    if (this.fwFlow) this.fwFlow.destroy();
    if (this.spy) this.spy.disconnect();
  },
  methods: {
    num(n) { return digits(n, this.lang); },
    /** i18n params with their numbers in the reader's numerals. */
    nums(p) {
      const out = {};
      for (const [k, v] of Object.entries(p || {})) out[k] = typeof v === 'number' ? this.num(v) : v;
      return out;
    },
    /** The translation of a key, or `fallback` when there is none (a type the robot added later). */
    tOr(key, fallback) { const v = this.$t(key); return v && v !== key ? v : fallback; },
    fmt(hhmm) { return timeText(hhmm, this.lang, this.lang === 'bn'); },
    /** How long ago an epoch-seconds time was, in words. */
    ago(ts) {
      const age = ageOf(ts, this.now);
      if (age.unit === 'never') return this.$t('companion.never');
      if (age.unit === 'justNow') return this.$t('companion.justNow');
      return this.$t(`companion.ago.${age.unit}`, { n: this.num(age.value) });
    },
    onVisible() { if (!document.hidden && this.deviceId) this.refresh(true); },
    errorText(err) { return friendlyError(err, this.$t('robot.requestFailed')); },
    /** "Check again" on the status panel: the view and the gateway both. */
    recheck() { refreshRobotStatus(this.deviceId, { force: true, companion: false }); this.refresh(false); },
    jump(key) {
      const el = document.getElementById(`rb-${key}`);
      if (!el || !el.scrollIntoView) return;
      // land below the pinned index, however many lines it wraps to
      const nav = this.$el && this.$el.querySelector ? this.$el.querySelector('.rb__index') : null;
      if (nav) el.style.scrollMarginTop = `${nav.offsetHeight + 16}px`;
      const still = typeof window !== 'undefined' && !!window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
      this.current = key;
    },
    /** Marks in the index the section crossing the reading band near the top of the window. */
    observeIndex() {
      if (this.spy) this.spy.disconnect();
      this.spy = null;
      if (typeof IntersectionObserver === 'undefined') return;
      this.seen = {};
      this.spy = new IntersectionObserver((entries) => {
        for (const e of entries) this.seen[e.target.id.slice(3)] = e.isIntersecting;
        const hit = this.index.find((k) => this.seen[k]);
        if (hit) this.current = hit;
      }, { rootMargin: '-20% 0px -70% 0px' });
      for (const k of this.index) {
        const el = document.getElementById(`rb-${k}`);
        if (el) this.spy.observe(el);
      }
    },

    // ---------------------------------------------------------------- data
    refresh(silent) {
      if (!this.deviceId || this.inflight) return;
      this.inflight = true;
      if (!silent) this.loading = true;
      const id = this.deviceId;
      Api.companion.getCompanion(id, (res) => {
        this.inflight = false; this.loading = false; this.loadError = '';
        this.apply(res.data.data);
      }, (err) => {
        this.inflight = false; this.loading = false; this.now = Date.now();
        const kind = noteCompanionError(id, err);
        // the robot is not known to the companion server (any more): its old data is gone too
        if (kind === 'not_registered') this.view = null;
        // keep showing the last good data on a failed background refresh; the status panel says why
        if (!silent || !this.view) this.loadError = kind;
      });
    },
    apply(view) {
      if (!view || typeof view !== 'object') return;
      noteCompanionView(this.deviceId, view);
      this.view = view;
      this.now = Date.now();
      this.syncForms(false);
      if (this.fwFlow) this.fwFlow.observe(view);
    },
    /** Replace the editable copies with the server's, except sections with unsaved edits (unless force). */
    syncForms(force, only) {
      FORM_SECTIONS.forEach((section) => {
        if (only && section !== only) return;
        if (force || !this.isDirty(section)) {
          const value = serverForm(this.view, section);
          this.forms[section] = value;
          this.baseline = { ...this.baseline, [section]: JSON.stringify(value) };
        }
      });
    },
    isDirty(section) {
      const base = this.baseline[section];
      return base !== undefined && JSON.stringify(this.forms[section]) !== base;
    },

    /** PUT /config with a patch; the answer is the full view. `area` names whose sync state shows it. */
    save(patch, area, okText) {
      return new Promise((resolve, reject) => {
        this.saving = { ...this.saving, [area]: true };
        this.failed = { ...this.failed, [area]: false };
        Api.companion.updateCompanionConfig(this.deviceId, patch, (res) => {
          this.saving = { ...this.saving, [area]: false };
          this.apply(res.data.data);
          this.$message.success(okText || (this.online ? this.$t('robot.saved') : this.$t('robot.savedOffline')));
          resolve(this.view);
        }, (err) => {
          this.saving = { ...this.saving, [area]: false };
          this.failed = { ...this.failed, [area]: true };
          this.$message.error(this.errorText(err));
          reject(err);
        });
      });
    },
    /** Has the last change of an area reached TinyBot? { state, text } for TbSync. */
    syncOf(area) {
      if (this.saving[area]) return { state: 'pending', text: this.$t('common.sync.pending') };
      if (this.failed[area]) return { state: 'error', text: this.$t('common.sync.error') };
      if (this.view && !this.online) return { state: 'pending', text: this.$t('robot.sync.offline') };
      return { state: 'applied', text: this.$t('common.sync.applied') };
    },
    saveSection(section) {
      const problem = sectionProblem(section, this.forms[section]);
      if (problem) {
        this.$message.warning(this.$t(problem.key, this.nums(problem.params)));
        return;
      }
      let before = {};
      try { before = JSON.parse(this.baseline[section] || '{}') || {}; } catch (e) { /* keep {} */ }
      const note = section === 'sound' ? soundSavedNote(this.forms.sound, before, this.online) : null;
      const okText = note ? this.$t(note.key, { n: this.num(note.n) }) : undefined;
      this.save(sectionPatch(section, this.forms[section]), section, okText)
        .then(() => {
          this.syncForms(true, section);
          if (section === 'display') this.customPick = { dim: false, off: false };
          // TinyBot reports its new volume right after changing it: show it before the next poll
          if (note) { clearTimeout(this.later); this.later = setTimeout(() => this.refresh(true), 1500); }
        })
        .catch(() => {});
    },
    revertSection(section) {
      this.syncForms(true, section);
      Object.keys(MINUTE_PICKERS).forEach((key) => {
        if (MINUTE_PICKERS[key].section === section) this.customPick[key] = false;
      });
    },

    // ---------------------------------------------------------------- screen
    pickerChoice(key) {
      const picker = MINUTE_PICKERS[key];
      return pickerChoice(this.forms[picker.section], key, this.customPick[key]);
    },
    pickMinutes(key, choice) {
      const picker = MINUTE_PICKERS[key];
      if (choice === 'custom') { this.customPick[key] = true; return; }
      this.customPick[key] = false;
      this.forms[picker.section][picker.field] = Number(choice);
    },
    isLastPageOn(key) { return isLastPageOn(this.pages, key); },
    /** Show or hide one robot page; optimistic, put back when the save fails. */
    setPage(key, on) {
      if (!this.view || (!on && isLastPageOn(this.pages, key))) return;
      const before = this.view.settings && this.view.settings.pages;
      this.view = { ...this.view, settings: { ...this.view.settings, pages: { ...this.pages, [key]: !!on } } };
      this.save({ settings: { pages: { [key]: !!on } } }, 'pages').catch(() => {
        if (this.view) this.view = { ...this.view, settings: { ...this.view.settings, pages: before } };
      });
    },

    // ---------------------------------------------------------------- memory
    deleteMemory(note) {
      if (!note || !note.id) return;
      this.save({ memories: { delete: [note.id] } }, 'memories', this.$t('robot.memory.deleted')).catch(() => {});
    },
    forgetMemories() {
      const n = this.memories.length;
      if (!n) return Promise.resolve();
      return this.$confirm(
        this.$t('companion.memory.confirmForget', { n: this.num(n) }),
        this.$t('robot.memory.forgetTitle'),
        { confirmText: this.$t('companion.memory.forgetAll'), cancelText: this.$t('common.cancel'), danger: true },
      ).then(() => { this.save({ memories: { clear: true } }, 'memories', this.$t('companion.memory.forgot')).catch(() => {}); })
        .catch(() => {});
    },

    // ---------------------------------------------------------------- jobs
    command(type, arg, okText, busyKey) {
      if (this.busy || !this.deviceId) return;
      this.busy = busyKey || type;
      Api.companion.sendCompanionCommand(this.deviceId, type, arg, (res) => {
        this.busy = '';
        this.$message.success(this.online ? (okText || this.$t('robot.jobs.sent')) : this.$t('robot.jobs.sentOffline'));
        const cmd = res && res.data && res.data.data;
        if (this.view && cmd && cmd.id) {
          this.view = { ...this.view, commands: [cmd, ...this.commands.filter((c) => c.id !== cmd.id)] };
        }
      }, (err) => {
        this.busy = '';
        this.$message.error(this.errorText(err));
      });
    },
    runJob(job) {
      const okText = job.focus ? this.$t('robot.jobs.focusStarted', { n: this.num(Number(jobArg(job, this.view))) }) : null;
      this.command(job.type, jobArg(job, this.view), okText, job.key);
    },
    sendStory() {
      const topic = (this.storyTopic || '').trim().slice(0, 64);
      this.command('story', topic, this.$t('companion.action.storySent'), 'story');
      this.storyTopic = '';
    },
    loadMoreEvents() {
      this.loadingEvents = true;
      Api.companion.getCompanionEvents(this.deviceId, 100, (res) => {
        this.loadingEvents = false;
        const data = (res && res.data && res.data.data) || {};
        this.moreEvents = Array.isArray(data.events) ? data.events : null;
      }, (err) => {
        this.loadingEvents = false;
        this.$message.error(this.errorText(err));
      });
    },

    // ---------------------------------------------------------------- name plate
    saveName() { this.saveSection('robot'); },

    // ---------------------------------------------------------------- firmware
    loadDevice() {
      if (!this.agentId || !this.deviceId) return;
      Api.device.getAgentBindDevices(this.agentId, (res) => {
        const data = res && res.data;
        if (data && data.code === 0 && Array.isArray(data.data)) {
          this.fwDevice = data.data.find((d) => d.id === this.deviceId) || null;
        }
      }, () => {});
    },
    /** The OTA list is for super admins only: everyone else does not see the newest version. */
    loadLatest() {
      const getters = this.$store && this.$store.getters;
      const user = (getters && getters.getUserInfo) || {};
      if (!user.superAdmin || !Api.ota) return;
      Api.ota.getOtaList({ page: 1, limit: 100, orderField: 'update_date', order: 'desc' }, (res) => {
        const body = res && res.data;
        if (body && body.code === 0 && body.data) this.fwLatest = body.data.list || [];
      });
    },
    setAutoUpdate(on) {
      if (!this.fwDevice) return;
      const previous = this.fwDevice.autoUpdate;
      this.fwDevice = { ...this.fwDevice, autoUpdate: on ? 1 : 0 };
      this.savingAuto = true;
      this.saving = { ...this.saving, auto: true };
      this.failed = { ...this.failed, auto: false };
      const undo = (msg) => {
        this.savingAuto = false;
        this.saving = { ...this.saving, auto: false };
        this.fwDevice = { ...this.fwDevice, autoUpdate: previous };
        this.failed = { ...this.failed, auto: true };
        this.$message.error(msg || this.$t('robot.requestFailed'));
      };
      Api.device.updateDeviceInfo(this.deviceId, { autoUpdate: on ? 1 : 0 }, (res) => {
        const data = res && res.data;
        if (data && data.code === 0) {
          this.savingAuto = false;
          this.saving = { ...this.saving, auto: false };
          this.$message.success(on ? this.$t('device.autoUpdateEnabled') : this.$t('device.autoUpdateDisabled'));
          return;
        }
        undo(data && data.msg);
      }, () => undo());
    },
    confirmUpdate() {
      return this.$confirm(this.$t('robot.fw.confirm'), this.$t('companion.firmware.confirmTitle'), {
        confirmText: this.$t('companion.firmware.updateNow'), cancelText: this.$t('common.cancel'),
      }).then(() => { if (this.fwFlow) this.fwFlow.start(this.view); }).catch(() => {});
    },
    dismissUpdate() { if (this.fwFlow) this.fwFlow.reset(); },
  },
};
</script>

<style>
.rb { padding-bottom: var(--tb-s10); }
.rb__state { padding: var(--tb-s10) 0; display: grid; justify-items: center; }
.rb__fail { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--tb-danger); font-size: var(--tb-fs-14); padding-top: var(--tb-s3); }
.rb__state .rb__status { justify-self: stretch; }
.rb__status { margin-top: var(--tb-s3); }
.rb__offline { padding: var(--tb-s3) 0; color: var(--tb-ink-2); font-size: var(--tb-fs-14); border-bottom: 1px solid var(--tb-rule-soft); }
.rb__index {
  position: sticky; top: 0; z-index: 4; background: var(--tb-paper);
  display: flex; gap: 8px var(--tb-s4); flex-wrap: wrap; padding: var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule);
}
.rb__indexlink {
  display: inline-flex; align-items: center; min-height: var(--tb-target); font-weight: 600; font-size: var(--tb-fs-14);
  color: var(--tb-ink-2);
  text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 6px; text-decoration-color: currentColor;
  transition: color var(--tb-t-hover) var(--tb-ease), text-decoration-color var(--tb-t-hover) var(--tb-ease);
}
.rb__indexlink[aria-current="true"] { color: var(--tb-ink); text-decoration-thickness: 2px; text-decoration-color: var(--tb-orange); }
@media (hover: hover) and (pointer: fine) { .rb__indexlink:hover { color: var(--tb-ink); } }
.rb .tb-section { scroll-margin-top: var(--tb-s4); }

/* shared bits of the sections */
.rb-note { font-size: var(--tb-fs-13); color: var(--tb-ink-2); max-width: 70ch; }
.rb-foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; padding-top: var(--tb-s2); }
.rb-foot__unsaved { font-size: var(--tb-fs-13); color: var(--tb-ink-2); margin-right: auto; }
.rb-sub { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-16); padding-bottom: 8px; border-bottom: 1px solid var(--tb-rule); }
.rb-row { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s4); min-height: 52px; padding: 6px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.rb-row__text { display: grid; gap: 2px; min-width: 0; }
.rb-row__text small { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.rb-row__ctl { display: flex; align-items: center; gap: 10px; flex: none; }
</style>
