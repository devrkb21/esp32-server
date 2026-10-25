<template>
  <TbSection :title="$t('day.tab.alarms')" :description="$t('day.alarm.desc', { n: num(alarms.length), max: num(MAX_ALARMS) })" ink="alarm">
    <template #actions>
      <TbSync v-bind="day.syncOf('alarms')" />
      <TbButton variant="primary" icon="plus" :disabled="alarms.length >= MAX_ALARMS" @click="openAlarm(null)">{{ $t('day.alarm.add') }}</TbButton>
    </template>

    <TbEmpty v-if="!alarms.length" face="sleepy" :title="$t('day.alarm.none')" :text="$t('day.alarm.emptyText')" />
    <ul v-else class="day-rows">
      <li v-for="a in sorted" :key="a.id" :ref="(el) => rowEls[`a-${a.id}`] = el" class="day-row day-row--alarm" :class="{ 'is-off': !a.enabled }">
        <button type="button" class="day-row__main" @click="openAlarm(a)">
          <span class="day-row__time tb-num">{{ day.fmt(a.time) }}</span>
          <span class="day-row__body">
            <span class="day-row__title">{{ a.label || $t('day.alarm.defaultLabel') }}</span>
            <span class="day-row__meta">{{ daysText(a.days) }}<template v-if="a.snooze_min">, {{ $t('day.alarm.snoozeShort', { min: num(a.snooze_min) }) }}</template></span>
            <span v-if="a.say" class="day-row__say">{{ a.say }}</span>
          </span>
        </button>
        <div class="day-row__acts">
          <TbSwitch :model-value="!!a.enabled" :disabled="!!day.saving.alarms" :aria-label="$t('day.alarm.switch', { time: a.time })"
            @change="(v) => toggleAlarm(a, v)" />
          <TbButton variant="quiet" icon="trash" :aria-label="$t('day.alarm.delete', { time: a.time })" @click="deleteAlarm(a)" />
        </div>
      </li>
    </ul>

    <TbSheet v-model:open="sheet.open" :title="sheet.isNew ? $t('day.alarm.add') : $t('day.alarm.edit')" :close-label="$t('common.close')">
      <form v-if="sheet.form" id="day-alarm-form" class="day-form" @submit.prevent="saveAlarm">
        <TbField :label="$t('day.alarm.time')" for-id="day-alarm-time" :error="sheet.error">
          <TbTime id="day-alarm-time" v-model="sheet.form.time" class="day-form__bigtime" :invalid="!!sheet.error" />
        </TbField>
        <TbField :label="$t('day.days.label')">
          <DayDays v-model="sheet.form.days" :label="$t('day.days.label')" />
        </TbField>
        <TbField :label="$t('day.labelField')" :hint="$t('day.labelHint')" for-id="day-alarm-label">
          <TbInput id="day-alarm-label" :model-value="sheet.form.label" :maxlength="MAX_LABEL" @update:model-value="(v) => sheet.form.label = asciiLabel(v)" />
        </TbField>
        <TbField :label="$t('day.sayField')" :hint="$t('day.sayHint', tokens)" for-id="day-alarm-say">
          <TbTextarea id="day-alarm-say" v-model="sheet.form.say" :rows="2" autosize :maxlength="MAX_SAY" show-count
            :placeholder="$t('day.alarm.sayPlaceholder', tokens)" />
        </TbField>
        <div class="day-form__pair">
          <TbField :label="$t('day.alarm.snooze')" :hint="$t('day.alarm.snoozeHint')" for-id="day-alarm-snooze">
            <TbInput id="day-alarm-snooze" v-model="sheet.form.snooze_min" type="number" number inputmode="numeric" />
          </TbField>
          <TbSwitch v-model="sheet.form.enabled" :label="$t('day.enabled')" />
        </div>
      </form>
      <template #footer>
        <TbButton @click="sheet.open = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" native-type="submit" form="day-alarm-form" :loading="!!day.saving.alarms">{{ $t('common.save') }}</TbButton>
      </template>
    </TbSheet>
  </TbSection>
</template>

<script>
import { MAX_ALARMS, MAX_LABEL, MAX_SAY, alarmPayload, asciiLabel, newAlarm, removeById, setEnabled, upsertById } from '@/utils/companion.mjs';
import { alarmProblem, sortByTime } from './dayModel';
import { daysText } from './dayText';
import DayDays from './DayDays.vue';

// Alarms: the whole list goes to the server on every change (legacy rule), without
// server-only fields such as say_audio.
export default {
  name: 'DayAlarms',
  components: { DayDays },
  inject: ['day'],
  data() {
    return {
      MAX_ALARMS, MAX_LABEL, MAX_SAY,
      sheet: { open: false, isNew: true, form: null, error: '' },
      rowEls: {},
      // literal placeholders the server fills in; passed as params so vue-i18n keeps the braces
      tokens: { weather: '{weather}', date: '{date}', name: '{name}' },
    };
  },
  computed: {
    alarms() { return (this.day.view && this.day.view.alarms) || []; },
    sorted() { return sortByTime(this.alarms); },
  },
  methods: {
    asciiLabel,
    num(n) { return this.day.num(n); },
    daysText(mask) { return daysText(mask, (k) => this.$t(k)); },
    openAlarm(alarm) {
      this.sheet = {
        open: true,
        isNew: !alarm,
        form: alarm ? { ...alarmPayload(alarm), label: alarm.label || '' } : newAlarm(),
        error: '',
      };
    },
    saveAlarm() {
      const form = this.sheet.form;
      const problem = alarmProblem(form);
      if (problem) {
        this.sheet.error = this.$t(problem, this.day.nums({ min: 0, max: 60 }));
        this.$message.warning(this.sheet.error);
        return;
      }
      this.sheet.error = '';
      const list = upsertById(this.alarms, form, alarmPayload);
      this.day.save({ alarms: list }, 'alarms')
        .then(() => { this.sheet.open = false; })
        .catch(() => {});
    },
    toggleAlarm(alarm, enabled) {
      this.day.save({ alarms: setEnabled(this.alarms, alarm.id, enabled, alarmPayload) }, 'alarms',
        this.$t(enabled ? 'day.alarm.onMsg' : 'day.alarm.offMsg')).catch(() => {});
    },
    deleteAlarm(alarm) {
      return this.$confirm(this.$t('day.alarm.confirmDelete', { time: this.day.fmt(alarm.time) }), this.$t('day.alarm.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => this.day.save({ alarms: removeById(this.alarms, alarm.id, alarmPayload) }, 'alarms', this.$t('day.deleted')))
        .catch(() => {});
    },
    /** ?focus=a-<id>: scroll to the alarm and open it. */
    focusKey(key) {
      const alarm = this.alarms.find((a) => `a-${a.id}` === key);
      if (!alarm) return false;
      this.day.reveal(this.rowEls[key]);
      this.openAlarm(alarm);
      return true;
    },
  },
};
</script>

<style>
/* Ruled rows shared by the Day panels */
.day-rows { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule); }
.day-row { display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--tb-rule-soft); transition: background-color var(--tb-t-hover) var(--tb-ease); }
@media (hover: hover) and (pointer: fine) { .day-row:hover { background: var(--tb-paper-2); } }
.day-row__main {
  flex: 1; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 16px; align-items: baseline;
  padding: 12px 0; border: 0; background: none; text-align: left; color: inherit;
}
.day-row__time { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-24); line-height: 1.1; min-width: 4.2ch; }
.day-row--alarm .day-row__time { color: var(--tb-alarm); }
.day-row__body { display: grid; gap: 2px; min-width: 0; }
.day-row__title { font-weight: 600; overflow-wrap: anywhere; }
.day-row__meta { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.day-row__say { font-size: var(--tb-fs-13); color: var(--tb-ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.day-row__acts { display: flex; align-items: center; gap: 2px; flex: none; }
.day-row__acts .tb-btn--quiet { min-height: 44px; width: 44px; }
.day-row.is-off .day-row__time, .day-row.is-off .day-row__title { color: var(--tb-ink-3); }
.day-row.is-off .day-row__title { text-decoration: line-through; text-decoration-color: var(--tb-ink-3); }

.day-form { display: grid; gap: var(--tb-s5); }
.day-form__bigtime input { font-size: var(--tb-fs-32); }
.day-form__pair { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--tb-s4); align-items: center; }
.day-form__range { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 10px; align-items: end; }
.day-form__range .tb-time { width: 100%; }
.day-form__arrow { padding-bottom: 12px; color: var(--tb-ink-2); }
.day-foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; padding-top: var(--tb-s2); }
.day-foot__unsaved { font-size: var(--tb-fs-13); color: var(--tb-warn); font-weight: 600; margin-right: auto; }
.day-note { font-size: var(--tb-fs-13); color: var(--tb-ink-2); max-width: 70ch; }

.day-form__range .tb-time input { min-width: 0; width: 100%; }
/* fields in Day grids may shrink below their input's intrinsic width */
.day-form .tb-field, .day-focus__fields .tb-field, .day-night .tb-field { grid-template-columns: minmax(0, 1fr); min-width: 0; }
@media (max-width: 480px) {
  .day-form__range { grid-template-columns: minmax(0, 1fr); gap: var(--tb-s3); }
  .day-form__arrow { display: none; }
  .day-row__main { grid-template-columns: minmax(0, 1fr); }
  .day-form__pair { grid-template-columns: minmax(0, 1fr); }
}
</style>
