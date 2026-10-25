<template>
  <TbSheet :open="open" :title="title" size="l" :close-on-scrim="false" :close-label="$t('common.close')"
    @update:open="onOpen">
    <div class="vcs">
      <ol class="vcs-steps" :aria-label="$t('voices.clone.stepsLabel')">
        <li :class="{ 'is-on': step === 1, 'is-done': step > 1 }" :aria-current="step === 1 ? 'step' : null">
          <TbIcon v-if="step > 1" name="check" :size="16" />{{ $t('voices.clone.stepPrepare') }}
        </li>
        <li :class="{ 'is-on': step === 2 }" :aria-current="step === 2 ? 'step' : null">{{ $t('voices.clone.stepEdit') }}</li>
      </ol>

      <!-- Step 1: a sample from a file or from the microphone -->
      <div v-if="step === 1" class="vcs-prepare">
        <TbUpload class="vcs-drop" accept="audio/*" :text="$t('voices.clone.dropText')" :hint="$t('voices.clone.dropHint')"
          :disabled="recording" @files="onFiles" />
        <div class="vcs-rec" :class="{ 'is-on': recording }">
          <p class="vcs-rec__title">{{ $t('voices.clone.recordTitle') }}</p>
          <p class="vcs-rec__hint">{{ canRecord ? $t('voices.clone.recordHint', { min: num(MIN_SECONDS), max: num(MAX_SECONDS) }) : $t('voices.clone.recordUnsupported') }}</p>
          <p v-if="recording" class="vcs-rec__clock tb-num" role="timer" aria-live="off">
            <i class="vcs-rec__mark" aria-hidden="true"></i>{{ num(clock(recSeconds)) }} / {{ num(clock(MAX_SECONDS)) }}
          </p>
          <TbButton v-if="!recording" icon="voice" :disabled="!canRecord || decoding" @click="startRecording">{{ $t('voices.clone.record') }}</TbButton>
          <TbButton v-else variant="danger" icon="stop" @click="stopRecording">{{ $t('voices.clone.stopRecord') }}</TbButton>
        </div>
        <p v-if="decoding" class="vcs-note"><TbLoading :label="$t('voices.clone.reading')" show-label /></p>
      </div>

      <!-- Step 2: listen, select the part to keep, trim -->
      <div v-show="step === 2" class="vcs-edit">
        <p class="vcs-tip"><TbIcon name="info" :size="18" /><span><b>{{ $t('voices.clone.editTip1') }}</b> {{ $t('voices.clone.editTip2') }}</span></p>

        <div ref="wave" class="vcs-wave" tabindex="0" role="slider" :aria-label="$t('voices.clone.waveLabel')"
          :aria-valuemin="0" :aria-valuemax="Math.round(duration * 10) / 10" :aria-valuenow="Math.round(selected * 10) / 10"
          :aria-valuetext="$t('voices.clone.selectedSeconds', { s: num(selected.toFixed(1)) })"
          @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @keydown="onWaveKey">
          <canvas ref="canvas" class="vcs-wave__canvas"></canvas>
          <div v-if="selStart !== null && selEnd !== null && selStart !== selEnd" class="vcs-wave__sel" :style="selStyle"></div>
          <div v-if="duration" class="vcs-wave__head" :style="{ left: `${(playhead / duration) * 100}%` }"></div>
        </div>

        <div class="vcs-readout">
          <p class="tb-num" :class="{ 'is-bad': duration && !okLength }">
            {{ $t('voices.clone.selectedSeconds', { s: num(selected.toFixed(1)) }) }}
            <span v-if="duration && !okLength">· {{ $t('voices.clone.durationRule', { min: num(MIN_SECONDS), max: num(MAX_SECONDS) }) }}</span>
          </p>
          <p class="vcs-readout__total tb-num">{{ $t('voices.clone.clipLength', { s: num(duration.toFixed(1)) }) }}</p>
        </div>

        <div class="vcs-controls">
          <TbButton size="s" :icon="playing ? 'pause' : 'play'" :disabled="!fileUrl" @click="togglePlay">
            {{ playing ? $t('voices.clone.pause') : $t('voices.clone.play') }}
          </TbButton>
          <TbButton size="s" icon="check" :disabled="!hasSelection" @click="trim">{{ $t('voices.clone.trim') }}</TbButton>
          <TbButton size="s" variant="quiet" icon="refresh" :disabled="!originalFile" @click="resetAudio">{{ $t('voices.clone.reset') }}</TbButton>
        </div>
        <audio ref="player" class="tb-visually-hidden" preload="metadata" @timeupdate="onTime" @ended="onEnded" @pause="playing = false"></audio>
      </div>
    </div>

    <template #footer>
      <TbButton @click="back">{{ step === 1 ? $t('common.cancel') : $t('voices.clone.back') }}</TbButton>
      <TbButton variant="primary" :loading="uploading" :disabled="recording || decoding" :icon="step === 2 ? 'upload' : ''" @click="next">
        {{ step === 1 ? $t('voices.clone.next') : $t('voices.clone.upload') }}
      </TbButton>
    </template>
  </TbSheet>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { MAX_SECONDS, MIN_SECONDS, clockText, durationOk, encodeWav, peaks, selectionSeconds } from './voiceModel';

export default {
  name: 'VoiceCloneSheet',
  props: {
    open: Boolean,
    voice: { type: Object, default: () => ({}) },
  },
  emits: ['update:open', 'success'],
  data() {
    return {
      MIN_SECONDS,
      MAX_SECONDS,
      step: 1,
      audioFile: null,
      originalFile: null,
      buffer: null,
      fileUrl: '',
      bars: [],
      selStart: null,
      selEnd: null,
      dragging: false,
      playing: false,
      playhead: 0,
      uploading: false,
      decoding: false,
      recording: false,
      recSeconds: 0,
    };
  },
  computed: {
    title() {
      const name = this.voice && this.voice.name;
      return name ? this.$t('voices.clone.sheetTitleNamed', { name }) : this.$t('voices.clone.sheetTitle');
    },
    duration() { return this.buffer ? this.buffer.duration : 0; },
    hasSelection() { return this.selStart !== null && this.selEnd !== null && Math.abs(this.selEnd - this.selStart) > 0.001; },
    selected() { return selectionSeconds(this.hasSelection ? this.selStart : null, this.hasSelection ? this.selEnd : null, this.duration); },
    okLength() { return durationOk(this.selected); },
    selStyle() {
      const a = Math.min(this.selStart, this.selEnd);
      const b = Math.max(this.selStart, this.selEnd);
      return { left: `${a * 100}%`, width: `${(b - a) * 100}%` };
    },
    canRecord() {
      return typeof window !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof window.MediaRecorder !== 'undefined';
    },
  },
  watch: {
    open(v) { if (!v) this.resetAll(); },
  },
  mounted() {
    window.addEventListener('resize', this.draw);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.draw);
    this.resetAll();
    if (this.ctx) { try { this.ctx.close(); } catch (e) { /* already closed */ } this.ctx = null; }
  },
  methods: {
    num(v) { return digits(v, this.$i18n.locale); },
    clock: clockText,
    onOpen(v) { this.$emit('update:open', v); },

    resetAll() {
      this.stopRecording(true);
      this.stopPlayer();
      this.revoke();
      this.step = 1;
      this.audioFile = null;
      this.originalFile = null;
      this.buffer = null;
      this.bars = [];
      this.selStart = null;
      this.selEnd = null;
      this.playhead = 0;
      this.uploading = false;
      this.decoding = false;
    },
    revoke() {
      if (this.fileUrl) { URL.revokeObjectURL(this.fileUrl); this.fileUrl = ''; }
    },
    audioCtx() {
      if (!this.ctx) {
        const C = window.AudioContext || window.webkitAudioContext;
        this.ctx = C ? new C() : null;
      }
      return this.ctx;
    },

    // Step 1
    onFiles(files) {
      const file = files && files[0];
      if (!file) return;
      this.useFile(file, true);
    },
    async useFile(file, original) {
      this.audioFile = file;
      if (original) this.originalFile = file;
      this.step = 2;
      await this.$nextTick();
      await this.load(file);
    },
    async load(file) {
      this.decoding = true;
      try {
        const ctx = this.audioCtx();
        if (!ctx) throw new Error('no audio context');
        const data = await file.arrayBuffer();
        this.buffer = await ctx.decodeAudioData(data.slice(0));
        this.setPlayerSource(file);
        this.selStart = null;
        this.selEnd = null;
        this.playhead = 0;
        await this.$nextTick();
        this.draw();
      } catch (e) {
        this.$message.error(this.$t('voices.clone.loadFailed'));
        this.step = 1;
        this.audioFile = null;
        this.originalFile = null;
        this.buffer = null;
      } finally {
        this.decoding = false;
      }
    },
    setPlayerSource(blob) {
      this.stopPlayer();
      this.revoke();
      this.fileUrl = URL.createObjectURL(blob);
      if (this.$refs.player) { this.$refs.player.src = this.fileUrl; this.$refs.player.load(); }
    },

    async startRecording() {
      if (!this.canRecord || this.recording) return;
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        this.$message.error(this.$t('voices.clone.micDenied'));
        return;
      }
      this.stream = stream;
      this.chunks = [];
      const rec = new window.MediaRecorder(stream);
      this.recorder = rec;
      rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) this.chunks.push(ev.data); };
      rec.onstop = () => this.finishRecording(rec.mimeType);
      rec.start();
      this.recording = true;
      this.recSeconds = 0;
      const t0 = Date.now();
      this.recTimer = setInterval(() => {
        this.recSeconds = (Date.now() - t0) / 1000;
        if (this.recSeconds >= MAX_SECONDS) this.stopRecording();
      }, 250);
    },
    stopRecording(discard = false) {
      clearInterval(this.recTimer);
      this.recTimer = null;
      if (this.recorder) {
        if (discard) this.recorder.onstop = null;
        if (this.recorder.state !== 'inactive') this.recorder.stop();
        if (discard) this.recorder = null;
      }
      if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
      this.recording = false;
    },
    async finishRecording(type) {
      this.recorder = null;
      const blob = new Blob(this.chunks || [], { type: type || 'audio/webm' });
      this.chunks = [];
      if (!blob.size) return;
      // The recording is sent as WAV, the same format a trimmed sample is sent in.
      this.decoding = true;
      try {
        const ctx = this.audioCtx();
        const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
        const wav = new File([encodeWav(buf)], 'recording.wav', { type: 'audio/wav' });
        this.decoding = false;
        await this.useFile(wav, true);
      } catch (e) {
        this.decoding = false;
        this.$message.error(this.$t('voices.clone.loadFailed'));
      }
    },

    // Step 2: waveform
    draw() {
      const canvas = this.$refs.canvas;
      if (!canvas || !this.buffer) return;
      const box = canvas.parentElement.getBoundingClientRect();
      if (!box.width) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      const count = Math.max(24, Math.floor(box.width / 3));
      this.bars = peaks(this.buffer.getChannelData(0), count);
      const g = canvas.getContext('2d');
      if (!g) return;
      g.clearRect(0, 0, canvas.width, canvas.height);
      const max = Math.max(...this.bars, 0.0001);
      const css = getComputedStyle(canvas);
      g.fillStyle = css.getPropertyValue('--tb-ink').trim() || 'currentColor';
      const w = canvas.width / count;
      const h = canvas.height;
      this.bars.forEach((v, i) => {
        const bh = Math.max(dpr, (v / max) * h * 0.82);
        g.fillRect(i * w, (h - bh) / 2, Math.max(dpr, w - dpr), bh);
      });
    },
    frac(e) {
      const r = this.$refs.wave.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    },
    onDown(e) {
      if (!this.buffer) return;
      this.dragging = true;
      this.selStart = this.frac(e);
      this.selEnd = this.selStart;
      if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    },
    onMove(e) {
      if (this.dragging) this.selEnd = this.frac(e);
    },
    onUp() {
      this.dragging = false;
    },
    onWaveKey(e) {
      // Keyboard: Shift+arrows grow or shrink the selection from its end, Escape clears it.
      if (!this.buffer) return;
      if (e.key === 'Escape') { this.selStart = null; this.selEnd = null; return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const stepFrac = 1 / Math.max(1, this.duration);
      if (this.selStart === null) { this.selStart = 0; this.selEnd = 1; }
      const d = e.key === 'ArrowRight' ? stepFrac : -stepFrac;
      if (e.shiftKey) this.selStart = Math.max(0, Math.min(this.selEnd, this.selStart + d));
      else this.selEnd = Math.max(this.selStart, Math.min(1, this.selEnd + d));
    },
    async trim() {
      if (!this.hasSelection || !this.buffer) return;
      const a = Math.min(this.selStart, this.selEnd);
      const b = Math.max(this.selStart, this.selEnd);
      const src = this.buffer;
      const from = Math.floor(a * src.duration * src.sampleRate);
      const to = Math.floor(b * src.duration * src.sampleRate);
      const len = Math.max(1, to - from);
      const out = this.audioCtx().createBuffer(src.numberOfChannels, len, src.sampleRate);
      for (let c = 0; c < src.numberOfChannels; c++) {
        out.getChannelData(c).set(src.getChannelData(c).subarray(from, from + len));
      }
      this.buffer = out;
      this.audioFile = new File([encodeWav(out)], 'audio.wav', { type: 'audio/wav' });
      this.setPlayerSource(this.audioFile);
      this.selStart = null;
      this.selEnd = null;
      this.playhead = 0;
      await this.$nextTick();
      this.draw();
      this.$message.success(this.$t('voices.clone.trimmed'));
    },
    async resetAudio() {
      if (!this.originalFile) return;
      this.audioFile = this.originalFile;
      await this.load(this.originalFile);
      this.$message.success(this.$t('voices.clone.resetDone'));
    },
    togglePlay() {
      const p = this.$refs.player;
      if (!p || !this.fileUrl) return;
      if (this.playing) { p.pause(); this.playing = false; return; }
      const r = p.play();
      this.playing = true;
      if (r && r.catch) r.catch(() => { this.playing = false; this.$message.error(this.$t('voices.playFailed')); });
    },
    stopPlayer() {
      const p = this.$refs.player;
      if (p) { try { p.pause(); p.currentTime = 0; } catch (e) { /* not loaded */ } }
      this.playing = false;
    },
    onTime() {
      const p = this.$refs.player;
      if (p) this.playhead = p.currentTime || 0;
    },
    onEnded() {
      this.playing = false;
      this.playhead = 0;
    },

    // Footer
    back() {
      if (this.step === 2) {
        this.stopPlayer();
        this.step = 1;
      } else {
        this.$emit('update:open', false);
      }
    },
    next() {
      if (this.step === 1) {
        if (!this.audioFile) {
          this.$message.warning(this.$t('voices.clone.pickAudio'));
          return;
        }
        this.step = 2;
        this.$nextTick(this.draw);
      } else {
        this.upload();
      }
    },
    upload() {
      if (!this.audioFile) {
        this.$message.warning(this.$t('voices.clone.pickAudio'));
        return;
      }
      if (this.buffer && !durationOk(this.buffer.duration)) {
        this.$message.warning(this.$t('voices.clone.durationError', { min: this.num(MIN_SECONDS), max: this.num(MAX_SECONDS) }));
        return;
      }
      this.uploading = true;
      try {
        const fd = new FormData();
        fd.append('voiceFile', this.audioFile);
        fd.append('id', this.voice.id);
        Api.voiceClone.uploadVoice(fd, (res) => {
          this.uploading = false;
          const body = res.data;
          if (body.code === 0) {
            this.$message.success(this.$t('voices.clone.uploaded'));
            this.$emit('update:open', false);
            this.$emit('success');
          } else {
            this.$message.error(body.msg || this.$t('voices.clone.uploadFailed'));
          }
        });
      } catch (e) {
        this.uploading = false;
        this.$message.error(this.$t('voices.clone.uploadFailed'));
      }
    },
  },
};
</script>

<style>
.vcs { display: grid; gap: var(--tb-s5); }
.vcs-steps { display: flex; gap: 0; margin: 0; padding: 0; list-style: none; border-bottom: 1px solid var(--tb-rule-soft); }
.vcs-steps li {
  display: inline-flex; align-items: center; gap: 6px; padding: 0 var(--tb-s4) 10px 0; margin-right: var(--tb-s4);
  color: var(--tb-ink-3); font-weight: 600; font-size: var(--tb-fs-14); border-bottom: 3px solid transparent; margin-bottom: -1px;
  transition: color var(--tb-t-fast) var(--tb-ease), border-color var(--tb-t-fast) var(--tb-ease);
}
.vcs-steps li.is-on { color: var(--tb-ink); border-bottom-color: var(--tb-orange); }
.vcs-steps li.is-done { color: var(--tb-ink-2); }
.vcs-steps li.is-done .tb-icon { color: var(--tb-ok); }

.vcs-prepare { display: grid; gap: var(--tb-s4); grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); align-items: stretch; }
.vcs-drop { align-content: center; min-height: 180px; }
.vcs-rec {
  display: grid; align-content: center; justify-items: start; gap: 8px; padding: var(--tb-s4);
  border-top: var(--tb-rule-band) solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule);
}
.vcs-rec.is-on { border-top-color: var(--tb-alarm); }
.vcs-rec__title { font: 700 var(--tb-fs-16)/1.3 var(--tb-font-display); }
.vcs-rec__hint { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.vcs-rec__clock { display: inline-flex; align-items: center; gap: 8px; font: 800 var(--tb-fs-24)/1 var(--tb-font-display); color: var(--tb-alarm); }
.vcs-rec__mark { width: 10px; height: 10px; background: var(--tb-alarm); }
.vcs-note { grid-column: 1 / -1; font-size: var(--tb-fs-13); color: var(--tb-ink-2); }

.vcs-edit { display: grid; gap: var(--tb-s3); }
.vcs-tip { display: flex; gap: 10px; align-items: flex-start; font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.vcs-tip .tb-icon { color: var(--tb-message); margin-top: 2px; }
.vcs-tip b { color: var(--tb-ink); font-weight: 600; }
.vcs-wave {
  position: relative; height: 160px; border-top: 1px solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule);
  background: var(--tb-paper-2); cursor: crosshair; user-select: none; touch-action: none; overflow: hidden;
}
.vcs-wave:focus-visible { outline: 2px solid var(--tb-focus); outline-offset: 2px; border-radius: 0; }
.vcs-wave__canvas { display: block; width: 100%; height: 100%; }
.vcs-wave__sel {
  position: absolute; top: 0; bottom: 0; pointer-events: none;
  border-left: 2px solid var(--tb-orange); border-right: 2px solid var(--tb-orange);
  background: color-mix(in srgb, var(--tb-orange) 16%, transparent);
}
.vcs-wave__head { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--tb-action); pointer-events: none; }
.vcs-readout { display: flex; justify-content: space-between; gap: var(--tb-s3); flex-wrap: wrap; font-size: var(--tb-fs-14); font-weight: 600; }
.vcs-readout .is-bad { color: var(--tb-danger); }
.vcs-readout__total { color: var(--tb-ink-2); font-weight: 400; }
.vcs-controls { display: flex; gap: 8px; flex-wrap: wrap; }

@media (max-width: 640px) {
  .vcs-prepare { grid-template-columns: minmax(0, 1fr); }
  .vcs-wave { height: 128px; }
  .vcs-controls .tb-btn { --h: 44px; }
}
</style>
