<template>
  <TbSection :title="$t('day.focus.title')" :description="$t('day.focus.desc')">
    <template #actions><TbSync v-bind="day.syncOf('focus')" /></template>

    <div class="day-focus">
      <div class="day-focus__now">
        <div class="day-focus__plan" aria-live="polite">
          <span class="day-focus__big tb-num">{{ chosen === null ? '?' : num(chosen) }}</span>
          <span class="day-focus__unit">{{ $t('day.focus.minutes') }}</span>
        </div>
        <p class="day-focus__done">{{ $t('day.focus.doneToday', { n: num(done) }) }}</p>

        <div class="day-focus__pick" role="group" :aria-label="$t('day.focus.howLong')">
          <TbChoice wrap :model-value="pick.choice" :options="presetOptions" :aria-label="$t('day.focus.howLong')" @change="pickPreset" />
          <TbInput id="day-focus-custom" class="day-focus__custom" size="s" :model-value="pick.custom" inputmode="numeric" maxlength="3"
            enterkeyhint="go" :placeholder="$t('day.focus.custom')" :aria-label="$t('day.focus.customLabel')"
            :invalid="pick.choice === 'custom' && pick.custom !== '' && chosen === null"
            @update:model-value="typeCustom" @enter="startNow" />
        </div>
        <p class="day-note" :class="{ 'is-bad': chosen === null }">{{ chosen === null ? $t('day.focus.customRange') : defaultLine }}</p>

        <div class="day-focus__go">
          <TbButton variant="primary" icon="play" :loading="day.busy === 'pomodoro'" :disabled="chosen === null || (!!day.busy && day.busy !== 'pomodoro')"
            @click="startNow">{{ $t('day.focus.startNow') }}</TbButton>
          <TbButton v-if="chosen !== null && chosen !== savedWork" :loading="!!day.saving.focus" @click="saveDefault">
            {{ $t('day.focus.makeDefault', { n: num(chosen) }) }}</TbButton>
        </div>
      </div>

      <h3 class="day-focus__sub">{{ $t('day.focus.roundsTitle') }}</h3>
      <form class="day-focus__fields" @submit.prevent="saveSection('pomodoro')">
        <TbField v-for="f in fields" :key="f" :label="$t(`day.focus.${f}`)" :for-id="`day-focus-${f}`"
          :hint="$t('day.focus.range', { min: num(FOCUS_LIMITS[f][0]), max: num(FOCUS_LIMITS[f][1]) })">
          <TbInput :id="`day-focus-${f}`" v-model="forms.pomodoro[f]" type="number" number inputmode="numeric"
            :invalid="!inRange(f)" />
        </TbField>
      </form>
      <p class="day-note">{{ $t('day.focus.hint', { rounds: num(forms.pomodoro.rounds || 0) }) }}</p>

      <footer class="day-foot">
        <span v-if="isDirty('pomodoro')" class="day-foot__unsaved">{{ $t('common.unsaved') }}</span>
        <TbButton v-if="isDirty('pomodoro')" variant="quiet" @click="revertSection('pomodoro')">{{ $t('common.undo') }}</TbButton>
        <TbButton variant="primary" :disabled="!isDirty('pomodoro')" :loading="!!day.saving.focus" @click="saveSection('pomodoro')">{{ $t('common.save') }}</TbButton>
      </footer>
    </div>
  </TbSection>
</template>

<script>
import { FOCUS_LIMITS, FOCUS_PRESETS, focusPick, pickedMinutes } from './dayModel';
import sectionForms from './sectionForms';

// Focus timer (pomodoro). Top: how long, as preset chips or any 1..120 minutes typed (Bangla
// digits too), "Start now" (the pomodoro command with those minutes) and "make it the default"
// (pomodoro.work_min: what the robot's own focus page, the tap shortcut and Today's chip use).
// Below: rounds and breaks, saved as { pomodoro: {...} }.
export default {
  name: 'DayFocus',
  mixins: [sectionForms(['pomodoro'], 'focus')],
  data() {
    return {
      FOCUS_LIMITS,
      fields: ['rounds', 'short_break_min', 'long_break_min'],
      pick: { choice: 25, custom: '' },
      touched: false, // the owner changed the minutes: a poll must not put the saved ones back
    };
  },
  computed: {
    done() { return (this.day.view && this.day.view.stats && this.day.view.stats.pomodoros_today) || 0; },
    savedWork() {
      const w = Number(this.day.view && this.day.view.pomodoro && this.day.view.pomodoro.work_min);
      return Number.isInteger(w) && w > 0 ? w : 25;
    },
    chosen() { return pickedMinutes(this.pick.choice, this.pick.custom); },
    presetOptions() { return FOCUS_PRESETS.map((n) => ({ value: n, label: this.$t('day.focus.preset', { n: this.num(n) }) })); },
    defaultLine() {
      return this.chosen === this.savedWork
        ? this.$t('day.focus.isDefault')
        : this.$t('day.focus.defaultIs', { n: this.num(this.savedWork) });
    },
  },
  watch: {
    savedWork: { immediate: true, handler() { if (!this.touched) this.resetPick(); } },
  },
  methods: {
    num(n) { return this.day.num(n); },
    inRange(f) {
      const v = this.forms.pomodoro[f];
      const [lo, hi] = FOCUS_LIMITS[f];
      return Number.isInteger(v) && v >= lo && v <= hi;
    },
    focusKey() { return false; },
    resetPick() {
      const p = focusPick(this.savedWork);
      this.pick = { choice: p.choice, custom: p.custom ? this.num(Number(p.custom)) : '' };
    },
    pickPreset(n) { this.touched = true; this.pick = { choice: n, custom: '' }; },
    typeCustom(text) { this.touched = true; this.pick = { choice: 'custom', custom: String(text || '') }; },
    startNow() {
      const n = this.chosen;
      if (n === null || this.day.busy) return;
      this.day.command('pomodoro', String(n), this.$t('day.focus.startedN', { n: this.num(n) }), 'pomodoro');
    },
    /** Saves the chosen minutes as pomodoro.work_min, keeping any unsaved round/break edits. */
    saveDefault() {
      const n = this.chosen;
      if (n === null) return Promise.resolve(false);
      return this.day.save({ pomodoro: { work_min: n } }, 'focus', this.$t('day.focus.defaultSaved', { n: this.num(n) }))
        .then(() => {
          this.forms.pomodoro = { ...this.forms.pomodoro, work_min: n };
          let base = {};
          try { base = JSON.parse(this.baseline.pomodoro || '{}') || {}; } catch (e) { /* keep {} */ }
          this.baseline.pomodoro = JSON.stringify({ ...base, work_min: n });
          this.touched = false;
          return true;
        })
        .catch(() => false);
    },
  },
};
</script>

<style>
.day-focus { display: grid; gap: var(--tb-s4); }
.day-focus__now { display: grid; gap: var(--tb-s3); padding-bottom: var(--tb-s5); border-bottom: 1px solid var(--tb-rule); }
.day-focus__plan { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.day-focus__big { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-48); line-height: 1; letter-spacing: -.02em; }
.day-focus__unit { font-weight: 600; color: var(--tb-ink-2); }
.day-focus__done { font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.day-focus__pick { display: flex; align-items: center; gap: var(--tb-s3); flex-wrap: wrap; }
.day-focus__custom { width: 112px; flex: none; }
.day-focus__go { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.day-note.is-bad { color: var(--tb-danger); }
.day-focus__sub { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-16); }
.day-focus__fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--tb-s4); max-width: 720px; }
@media (max-width: 640px) { .day-focus__fields { grid-template-columns: minmax(0, 1fr); } }
</style>
