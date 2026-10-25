<template>
  <TbSection :title="$t('day.tab.reminders')" :description="$t('day.reminder.desc', { n: num(reminders.length), max: num(MAX_REMINDERS) })" ink="alarm">
    <template #actions>
      <TbSync v-bind="day.syncOf('reminders')" />
      <TbMenu :items="addItems" @select="(kind) => openReminder(null, kind)">
        <template #trigger>
          <TbButton variant="primary" icon="plus" icon-after="chevron-down" :disabled="reminders.length >= MAX_REMINDERS">{{ $t('day.reminder.add') }}</TbButton>
        </template>
      </TbMenu>
    </template>

    <TbEmpty v-if="!reminders.length" face="sleepy" :title="$t('day.reminder.none')" :text="$t('day.reminder.emptyText')" />
    <div v-else class="day-groups">
      <div v-for="g in groups" :key="g.kind" class="day-group">
        <h3 class="day-group__title">{{ $t(`day.reminder.kind.${g.kind}`) }} <span class="tb-num">{{ num(g.items.length) }}</span></h3>
        <ul class="day-rows">
          <li v-for="r in g.items" :key="r.id" :ref="(el) => rowEls[`r-${r.id}`] = el" class="day-row day-row--alarm" :class="{ 'is-off': !r.enabled }">
            <button type="button" class="day-row__main day-row__main--wide" @click="openReminder(r)">
              <span class="day-row__body">
                <span class="day-row__title">{{ r.label || $t(`day.reminder.kind.${r.kind}`) }}</span>
                <span class="day-row__meta tb-num">{{ when(r) }}</span>
                <span v-if="r.say" class="day-row__say">{{ r.say }}</span>
              </span>
            </button>
            <div class="day-row__acts">
              <TbSwitch :model-value="!!r.enabled" :disabled="!!day.saving.reminders" :aria-label="$t('day.reminder.switch', { name: r.label || '' })"
                @change="(v) => toggleReminder(r, v)" />
              <TbButton variant="quiet" icon="trash" :aria-label="$t('day.reminder.delete', { name: r.label || '' })" @click="deleteReminder(r)" />
            </div>
          </li>
        </ul>
      </div>
    </div>

    <TbSheet v-model:open="sheet.open" :title="sheet.isNew ? $t('day.reminder.add') : $t('day.reminder.edit')" :close-label="$t('common.close')">
      <form v-if="sheet.form" id="day-reminder-form" class="day-form" @submit.prevent="saveReminder">
        <TbField :label="$t('day.reminder.kindLabel')">
          <TbChoice v-model="sheet.form.kind" wrap :options="kindOptions" :aria-label="$t('day.reminder.kindLabel')" />
        </TbField>
        <TbField :label="$t('day.reminder.mode')">
          <TbChoice v-model="sheet.form.mode" wrap :aria-label="$t('day.reminder.mode')"
            :options="[{ value: 'interval', label: $t('day.reminder.modeInterval') }, { value: 'time', label: $t('day.reminder.modeTime') }]" />
        </TbField>
        <template v-if="sheet.form.mode === 'interval'">
          <TbField :label="$t('day.reminder.every')" :hint="$t('day.reminder.everyHint', { min: num(EVERY_LIMITS[0]), max: num(EVERY_LIMITS[1]) })" for-id="day-rem-every">
            <TbInput id="day-rem-every" v-model="sheet.form.every_min" type="number" number inputmode="numeric" />
          </TbField>
          <div class="day-form__range">
            <TbField :label="$t('day.reminder.from')" for-id="day-rem-from"><TbTime id="day-rem-from" v-model="sheet.form.from" /></TbField>
            <TbIcon class="day-form__arrow" name="chevron-right" />
            <TbField :label="$t('day.reminder.to')" for-id="day-rem-to"><TbTime id="day-rem-to" v-model="sheet.form.to" /></TbField>
          </div>
        </template>
        <TbField v-else :label="$t('day.reminder.time')" for-id="day-rem-time">
          <TbTime id="day-rem-time" v-model="sheet.form.time" class="day-form__bigtime" />
        </TbField>
        <p v-if="sheet.error" class="day-form__error" role="alert">{{ sheet.error }}</p>
        <TbField :label="$t('day.days.label')">
          <DayDays v-model="sheet.form.days" :label="$t('day.days.label')" />
        </TbField>
        <TbField :label="$t('day.labelField')" :hint="$t('day.labelHint')" for-id="day-rem-label">
          <TbInput id="day-rem-label" :model-value="sheet.form.label" :maxlength="MAX_LABEL" @update:model-value="(v) => sheet.form.label = asciiLabel(v)" />
        </TbField>
        <TbField :label="$t('day.sayField')" :hint="$t('day.sayHint', tokens)" for-id="day-rem-say">
          <TbTextarea id="day-rem-say" v-model="sheet.form.say" :rows="2" autosize :maxlength="MAX_SAY" show-count />
        </TbField>
        <TbSwitch v-model="sheet.form.enabled" :label="$t('day.enabled')" />
      </form>
      <template #footer>
        <TbButton @click="sheet.open = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" native-type="submit" form="day-reminder-form" :loading="!!day.saving.reminders">{{ $t('common.save') }}</TbButton>
      </template>
    </TbSheet>
  </TbSection>
</template>

<script>
import {
  MAX_LABEL, MAX_REMINDERS, MAX_SAY, REMINDER_KINDS, asciiLabel, newReminder, reminderPayload, removeById, setEnabled, upsertById,
} from '@/utils/companion.mjs';
import { EVERY_LIMITS, reminderProblem } from './dayModel';
import { reminderWhen } from './dayText';
import DayDays from './DayDays.vue';

function clone(v) { return JSON.parse(JSON.stringify(v === undefined ? null : v)); }

// Reminders (water, medicine, custom; at a time or every few minutes): whole-list patches.
export default {
  name: 'DayReminders',
  components: { DayDays },
  inject: ['day'],
  data() {
    return {
      MAX_REMINDERS, MAX_LABEL, MAX_SAY, EVERY_LIMITS,
      sheet: { open: false, isNew: true, form: null, error: '' },
      rowEls: {},
      tokens: { weather: '{weather}', date: '{date}', name: '{name}' },
    };
  },
  computed: {
    reminders() { return (this.day.view && this.day.view.reminders) || []; },
    // grouped by kind in the fixed order; unknown kinds go with "Other" (legacy reminderGroups)
    groups() {
      return REMINDER_KINDS
        .map((kind) => ({ kind, items: this.reminders.filter((r) => (REMINDER_KINDS.includes(r.kind) ? r.kind : 'custom') === kind) }))
        .filter((g) => g.items.length);
    },
    kindOptions() { return REMINDER_KINDS.map((k) => ({ value: k, label: this.$t(`day.reminder.kind.${k}`) })); },
    addItems() { return REMINDER_KINDS.map((k) => ({ key: k, label: this.$t(`day.reminder.kind.${k}`), icon: 'reminder' })); },
  },
  methods: {
    asciiLabel,
    num(n) { return this.day.num(n); },
    when(r) { return reminderWhen(r, (k, p) => this.$t(k, p || {}), this.day.fmt, this.num); },
    openReminder(reminder, kind) {
      if (!reminder && this.reminders.length >= MAX_REMINDERS) return;
      // keep defaults for the fields of the other mode so switching modes in the sheet works
      const form = reminder ? { ...newReminder(reminder.kind), ...clone(reminder) } : newReminder(kind);
      delete form.say_audio;
      this.sheet = { open: true, isNew: !reminder, form, error: '' };
    },
    saveReminder() {
      const form = this.sheet.form;
      const problem = reminderProblem(form);
      if (problem) {
        this.sheet.error = this.$t(problem, this.day.nums({ min: EVERY_LIMITS[0], max: EVERY_LIMITS[1] }));
        this.$message.warning(this.sheet.error);
        return;
      }
      this.sheet.error = '';
      const list = upsertById(this.reminders, form, reminderPayload);
      this.day.save({ reminders: list }, 'reminders')
        .then(() => { this.sheet.open = false; })
        .catch(() => {});
    },
    toggleReminder(reminder, enabled) {
      this.day.save({ reminders: setEnabled(this.reminders, reminder.id, enabled, reminderPayload) }, 'reminders').catch(() => {});
    },
    deleteReminder(reminder) {
      return this.$confirm(this.$t('day.reminder.confirmDelete'), this.$t('day.reminder.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => this.day.save({ reminders: removeById(this.reminders, reminder.id, reminderPayload) }, 'reminders', this.$t('day.deleted')))
        .catch(() => {});
    },
    focusKey(key) {
      const r = this.reminders.find((x) => `r-${x.id}` === key);
      if (!r) return false;
      this.day.reveal(this.rowEls[key]);
      this.openReminder(r);
      return true;
    },
  },
};
</script>

<style>
.day-groups { display: grid; gap: var(--tb-s5); }
.day-group__title { display: flex; align-items: baseline; gap: 8px; font-size: var(--tb-fs-15); padding-bottom: 6px; }
.day-group__title span { font-size: var(--tb-fs-12); color: var(--tb-ink-2); font-weight: 600; }
.day-row__main--wide { grid-template-columns: minmax(0, 1fr); }
.day-form__error { color: var(--tb-danger); font-size: var(--tb-fs-13); font-weight: 500; }
</style>
