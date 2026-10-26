<template>
  <TbSection :title="$t('day.tab.routines')" :description="$t('dayVoice.routine.desc', { n: num(routines.length), max: num(MAX_ROUTINES) })" ink="routine">
    <template #actions>
      <TbSync v-bind="day.syncOf('routines')" />
      <TbButton variant="primary" icon="plus" :disabled="routines.length >= MAX_ROUTINES" @click="openRoutine(null)">{{ $t('dayVoice.routine.add') }}</TbButton>
    </template>

    <TbEmpty v-if="!routines.length" face="sleepy" :title="$t('dayVoice.routine.none')" :text="$t('dayVoice.routine.emptyText')" />
    <ul v-else class="day-rows">
      <li v-for="r in routines" :key="r.id" class="day-row day-row--routines" :class="{ 'is-off': !r.enabled }">
        <button type="button" class="day-row__main" @click="openRoutine(r)">
          <span class="day-row__time day-routines__count tb-num">{{ num(r.steps.length) }}</span>
          <span class="day-row__body">
            <span class="day-row__title">{{ r.name }}</span>
            <span class="day-row__meta">{{ triggerLine(r) }}</span>
            <span class="day-row__say">{{ stepsLine(r) }}</span>
          </span>
        </button>
        <div class="day-row__acts">
          <TbButton size="s" icon="play" :loading="running === r.id" :disabled="!r.enabled" @click="runNow(r)">{{ $t('dayVoice.routine.run') }}</TbButton>
          <TbSwitch :model-value="!!r.enabled" :disabled="!!day.saving.routines" :aria-label="$t('dayVoice.routine.switch', { name: r.name })"
            @change="(v) => toggle(r, v)" />
          <TbButton variant="quiet" icon="trash" :aria-label="$t('dayVoice.routine.deleteTitle')" @click="remove(r)" />
        </div>
      </li>
    </ul>

    <TbSheet v-model:open="sheet.open" size="l" :title="sheet.isNew ? $t('dayVoice.routine.add') : $t('dayVoice.routine.edit')" :close-label="$t('common.close')">
      <form v-if="sheet.form" id="day-routine-form" class="day-form" @submit.prevent="save">
        <TbField :label="$t('dayVoice.routine.name')" for-id="day-routine-name" :error="sheet.error">
          <TbInput id="day-routine-name" v-model="sheet.form.name" :maxlength="MAX_ROUTINE_NAME" :placeholder="$t('dayVoice.routine.namePlaceholder')" />
        </TbField>
        <TbField :label="$t('dayVoice.routine.trigger')">
          <TbChoice v-model="sheet.form.trigger.type" wrap :options="triggerOptions" :aria-label="$t('dayVoice.routine.trigger')" />
        </TbField>
        <TbField v-if="sheet.form.trigger.type === 'voice'" :label="$t('dayVoice.routine.phrase')" for-id="day-routine-phrase"
          :hint="$t('dayVoice.routine.phraseHint', { phrase: sheet.form.trigger.phrase || sheet.form.name || '...' })">
          <TbInput id="day-routine-phrase" v-model="sheet.form.trigger.phrase" :maxlength="MAX_PHRASE" />
        </TbField>
        <template v-if="sheet.form.trigger.type === 'time'">
          <TbField :label="$t('dayVoice.routine.time')" for-id="day-routine-time">
            <TbTime id="day-routine-time" v-model="sheet.form.trigger.time" class="day-form__bigtime" />
          </TbField>
          <TbField :label="$t('day.days.label')">
            <DayDays v-model="sheet.form.trigger.days" :label="$t('day.days.label')" />
          </TbField>
        </template>
        <p v-if="sheet.form.trigger.type === 'tap'" class="day-note">{{ $t('dayVoice.routine.tapNote') }}</p>

        <fieldset class="day-steps">
          <legend>{{ $t('dayVoice.routine.stepsTitle') }}</legend>
          <ol class="day-steps__list">
            <li v-for="(s, i) in sheet.form.steps" :key="i" class="day-steps__row">
              <span class="day-steps__no tb-num">{{ num(i + 1) }}</span>
              <div class="day-steps__fields">
                <TbSelect :model-value="s.type" :options="stepOptions" :aria-label="$t('dayVoice.routine.stepNo', { n: num(i + 1) })"
                  @update:model-value="(v) => setType(i, v)" />
                <TbTextarea v-if="s.type === 'say'" v-model="s.arg" :rows="2" autosize :maxlength="MAX_SAY"
                  :placeholder="$t('dayVoice.routine.sayPlaceholder', tokens)" :aria-label="$t('dayVoice.routine.say')" />
                <TbSelect v-else-if="s.type === 'play'" v-model="s.arg" :options="itemOptions" :placeholder="$t('dayVoice.routine.pickItem')"
                  :aria-label="$t('dayVoice.routine.pickItem')" />
                <TbSelect v-else-if="s.type === 'command'" v-model="s.arg" :options="commandOptions" :placeholder="$t('dayVoice.routine.pickCommand')"
                  :aria-label="$t('dayVoice.routine.pickCommand')" />
                <TbInput v-else-if="s.type === 'smart_home'" v-model="s.arg" :maxlength="MAX_SMART_HOME"
                  :placeholder="$t('dayVoice.routine.smartHomePlaceholder')" :aria-label="$t('dayVoice.routine.smartHome')" />
              </div>
              <div class="day-steps__acts">
                <TbButton variant="quiet" icon="chevron-up" :disabled="i === 0" :aria-label="$t('dayVoice.routine.stepUp')" @click="move(i, -1)" />
                <TbButton variant="quiet" icon="chevron-down" :disabled="i === sheet.form.steps.length - 1" :aria-label="$t('dayVoice.routine.stepDown')" @click="move(i, 1)" />
                <TbButton variant="quiet" icon="close" :disabled="sheet.form.steps.length < 2" :aria-label="$t('dayVoice.routine.stepRemove')" @click="sheet.form.steps.splice(i, 1)" />
              </div>
            </li>
          </ol>
          <TbButton size="s" icon="plus" :disabled="sheet.form.steps.length >= MAX_STEPS" @click="sheet.form.steps.push({ type: 'weather', arg: '' })">
            {{ $t('dayVoice.routine.addStep') }}
          </TbButton>
        </fieldset>
        <TbSwitch v-model="sheet.form.enabled" :label="$t('day.enabled')" />
      </form>
      <template #footer>
        <TbButton @click="sheet.open = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" native-type="submit" form="day-routine-form" :loading="!!day.saving.routines">{{ $t('common.save') }}</TbButton>
      </template>
    </TbSheet>
  </TbSection>
</template>

<script>
import {
  COMMAND_PRESETS, MAX_PHRASE, MAX_ROUTINES, MAX_ROUTINE_NAME, MAX_SAY, MAX_SMART_HOME, MAX_STEPS, STEP_TYPES, TRIGGERS,
  moveStep, newRoutine, routinePayload, routineProblem, triggerText,
} from './dayVoiceModel';
import { daysText } from './dayText';
import DayDays from './DayDays.vue';

// Routines (scenes): the whole list goes to the server on every change, like alarms. "Run now"
// is the command {type: 'routine', arg: id}; the server runs the steps itself.
export default {
  name: 'DayRoutines',
  components: { DayDays },
  inject: ['day'],
  data() {
    return {
      MAX_ROUTINES, MAX_ROUTINE_NAME, MAX_PHRASE, MAX_SAY, MAX_SMART_HOME, MAX_STEPS,
      sheet: { open: false, isNew: true, form: null, error: '' },
      running: '',
      tokens: { name: '{name}' },
    };
  },
  computed: {
    routines() {
      const s = (this.day.view && this.day.view.settings) || {};
      return Array.isArray(s.routines) ? s.routines : [];
    },
    library() { return (this.day.view && this.day.view.library) || []; },
    triggerOptions() { return TRIGGERS.map((k) => ({ value: k, label: this.$t(`dayVoice.trigger.${k}`) })); },
    stepOptions() { return STEP_TYPES.map((k) => ({ value: k, label: this.$t(`dayVoice.step.${k}`) })); },
    commandOptions() { return COMMAND_PRESETS.map((k) => ({ value: k, label: this.$t(`dayVoice.command.${k}`) })); },
    itemOptions() {
      return this.library.map((i) => ({ value: i.id, label: `${i.title} (${this.$t(`dayVoice.library.kind.${i.kind}`)})` }));
    },
  },
  methods: {
    num(n) { return this.day.num(n); },
    triggerLine(r) {
      const t = triggerText(r);
      const p = { ...t.params };
      if (t.key === 'dayVoice.trigger.atTime') { p.time = this.day.fmt(p.time); p.days = daysText(p.days, (k) => this.$t(k)); }
      return this.$t(t.key, p);
    },
    stepsLine(r) {
      return r.steps.map((s) => this.$t(`dayVoice.step.${s.type}`)).join(', ');
    },
    openRoutine(r) {
      const form = r ? JSON.parse(JSON.stringify(routinePayload(r))) : newRoutine();
      form.trigger = { phrase: '', time: '07:00', days: 127, ...form.trigger };
      this.sheet = { open: true, isNew: !r, form, error: '' };
    },
    setType(i, type) {
      const step = this.sheet.form.steps[i];
      step.type = type;
      step.arg = type === 'command' ? COMMAND_PRESETS[0] : (type === 'play' ? ((this.library[0] || {}).id || '') : '');
    },
    move(i, dir) { this.sheet.form.steps = moveStep(this.sheet.form.steps, i, dir); },
    list(replace) {
      return this.routines.map((r) => routinePayload(replace && replace.id === r.id ? replace : r));
    },
    save() {
      const form = this.sheet.form;
      const problem = routineProblem(form, this.library.map((i) => i.id));
      if (problem) {
        this.sheet.error = this.$t(problem);
        this.$message.warning(this.sheet.error);
        return;
      }
      this.sheet.error = '';
      const routines = form.id ? this.list(form) : [...this.list(), routinePayload(form)];
      this.day.save({ settings: { routines } }, 'routines')
        .then(() => { this.sheet.open = false; })
        .catch(() => {});
    },
    toggle(r, enabled) {
      this.day.save({ settings: { routines: this.list({ ...r, enabled }) } }, 'routines',
        this.$t(enabled ? 'dayVoice.routine.onMsg' : 'dayVoice.routine.offMsg')).catch(() => {});
    },
    remove(r) {
      return this.$confirm(this.$t('dayVoice.routine.confirmDelete', { name: r.name }), this.$t('dayVoice.routine.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => this.day.save({ settings: { routines: this.list().filter((x) => x.id !== r.id) } }, 'routines', this.$t('day.deleted')))
        .catch(() => {});
    },
    runNow(r) {
      this.running = r.id;
      this.day.command('routine', r.id, this.$t('dayVoice.routine.running'), `routine:${r.id}`);
      setTimeout(() => { this.running = ''; }, 800);
    },
  },
};
</script>

<style>
.day-row--routines .day-row__time { color: var(--tb-routine); }
.day-routines__count { min-width: 2ch; }
.day-row--routines .day-row__acts { gap: 8px; }
.day-steps { border: 0; margin: 0; padding: 0; display: grid; gap: var(--tb-s3); min-width: 0; }
.day-steps legend { font-weight: 600; padding: 0; margin-bottom: var(--tb-s2); }
.day-steps__list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule); }
.day-steps__row { display: grid; grid-template-columns: 2.2ch minmax(0, 1fr) auto; gap: 10px; align-items: start; padding: 10px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.day-steps__no { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-20); color: var(--tb-routine); padding-top: 8px; }
.day-steps__fields { display: grid; gap: 8px; min-width: 0; }
.day-steps__acts { display: flex; gap: 0; }
.day-steps__acts .tb-btn--quiet { min-height: 44px; width: 40px; }
@media (max-width: 640px) {
  .day-row--routines { flex-wrap: wrap; }
  .day-row--routines .day-row__acts { width: 100%; justify-content: flex-end; padding-bottom: 10px; }
  .day-steps__row { grid-template-columns: 2.2ch minmax(0, 1fr); }
  .day-steps__acts { grid-column: 2; justify-content: flex-end; }
}
</style>
