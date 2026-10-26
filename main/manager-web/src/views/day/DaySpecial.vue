<template>
  <TbSection :title="$t('day.tab.days')" :description="$t('dayVoice.days.desc')" ink="prayer">
    <template #actions>
      <TbSync v-bind="day.syncOf('days')" />
    </template>

    <div class="day-special">
      <div class="day-special__today" :class="{ 'is-none': !special }">
        <span class="day-special__label">{{ $t('dayVoice.days.today') }}</span>
        <strong class="day-special__name">{{ special ? specialName : $t('dayVoice.days.todayNone') }}</strong>
      </div>
      <TbSwitch :model-value="calendar.special_days" :disabled="!!day.saving.days" :label="$t('dayVoice.days.switch')"
        @change="(v) => day.save({ settings: { calendar: { special_days: v } } }, 'days').catch(() => {})" />
      <p class="day-note">{{ $t('dayVoice.days.national') }}</p>
    </div>

    <header class="day-special__head">
      <div>
        <h3>{{ $t('dayVoice.days.remember') }}</h3>
        <p class="day-note">{{ $t('dayVoice.days.rememberDesc', { n: num(remember.length), max: num(MAX_REMEMBER) }) }}</p>
      </div>
      <TbButton variant="primary" icon="plus" :disabled="remember.length >= MAX_REMEMBER" @click="openAdd">{{ $t('dayVoice.days.add') }}</TbButton>
    </header>
    <TbEmpty v-if="!remember.length" face="happy" :title="$t('dayVoice.days.none')" :text="$t('dayVoice.days.emptyText')" />
    <ul v-else class="day-rows">
      <li v-for="d in remember" :key="d.id" class="day-row day-row--special">
        <div class="day-row__main">
          <span class="day-row__time tb-num">{{ dateText(d.date) }}</span>
          <span class="day-row__body">
            <span class="day-row__title">{{ d.name }}</span>
            <span class="day-row__meta">{{ $t(`dayVoice.days.kind.${d.kind}`) }}, {{ untilText(d.date) }}</span>
          </span>
        </div>
        <div class="day-row__acts">
          <TbButton variant="quiet" icon="trash" :aria-label="$t('dayVoice.days.delete', { name: d.name })" @click="remove(d)" />
        </div>
      </li>
    </ul>

    <TbSheet v-model:open="sheet.open" :title="$t('dayVoice.days.add')" :close-label="$t('common.close')">
      <form v-if="sheet.form" id="day-special-form" class="day-form" @submit.prevent="save">
        <TbField :label="$t('dayVoice.days.name')" for-id="day-special-name" :error="sheet.error">
          <TbInput id="day-special-name" v-model="sheet.form.name" :maxlength="MAX_DAY_NAME" :placeholder="$t('dayVoice.days.namePlaceholder')" />
        </TbField>
        <div class="day-form__pair day-special__date">
          <TbField :label="$t('dayVoice.days.month')" for-id="day-special-month">
            <TbSelect id="day-special-month" v-model="sheet.form.month" :options="monthOptions" />
          </TbField>
          <TbField :label="$t('dayVoice.days.day')" for-id="day-special-day">
            <TbSelect id="day-special-day" v-model="sheet.form.day" :options="dayOptions" />
          </TbField>
        </div>
        <TbField :label="$t('dayVoice.days.kindLabel')">
          <TbChoice v-model="sheet.form.kind" wrap :options="kindOptions" :aria-label="$t('dayVoice.days.kindLabel')" />
        </TbField>
      </form>
      <template #footer>
        <TbButton @click="sheet.open = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" native-type="submit" form="day-special-form" :loading="!!day.saving.days">{{ $t('common.save') }}</TbButton>
      </template>
    </TbSheet>
  </TbSection>
</template>

<script>
import { MAX_DAY_NAME, MAX_REMEMBER, REMEMBER_KINDS, calendarOf, daysUntil, monthDay, rememberProblem, sortRemember } from './dayVoiceModel';

// Special days: what today is (from the server: national days, the admin's Eid list, the family's
// days), the greeting switch and the family's days to remember (sent as a whole list).
export default {
  name: 'DaySpecial',
  inject: ['day'],
  data() {
    return { MAX_DAY_NAME, MAX_REMEMBER, sheet: { open: false, form: null, error: '' } };
  },
  computed: {
    special() { return (this.day.view && this.day.view.today_special) || null; },
    specialName() {
      const s = this.special;
      return this.day.lang === 'bn' ? (s.name_bn || s.name_en) : (s.name_en || s.name_bn);
    },
    calendar() { return calendarOf(this.day.view); },
    remember() { return sortRemember(this.calendar.remember); },
    locale() { return this.day.lang === 'bn' ? 'bn-BD' : 'en-GB'; },
    monthOptions() {
      const f = new Intl.DateTimeFormat(this.locale, { month: 'long' });
      return Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: f.format(new Date(2024, i, 1)) }));
    },
    dayOptions() {
      const last = new Date(2024, Number(this.sheet.form && this.sheet.form.month) || 1, 0).getDate();
      return Array.from({ length: last }, (_, i) => ({ value: i + 1, label: this.num(i + 1) }));
    },
    kindOptions() { return REMEMBER_KINDS.map((k) => ({ value: k, label: this.$t(`dayVoice.days.kind.${k}`) })); },
  },
  methods: {
    num(n) { return this.day.num(n); },
    dateText(mmdd) {
      const [m, d] = mmdd.split('-').map(Number);
      try { return new Intl.DateTimeFormat(this.locale, { day: 'numeric', month: 'short' }).format(new Date(2024, m - 1, d)); } catch (e) { return mmdd; }
    },
    untilText(mmdd) {
      const n = daysUntil(mmdd, new Date(this.day.now));
      return n === 0 ? this.$t('dayVoice.days.isToday') : this.$t('dayVoice.days.inDays', { n: this.num(n) });
    },
    openAdd() {
      const now = new Date(this.day.now);
      this.sheet = { open: true, error: '', form: { name: '', month: now.getMonth() + 1, day: now.getDate(), kind: 'birthday' } };
    },
    payload(list) { return list.map((d) => ({ id: d.id, date: d.date, name: d.name, kind: d.kind })); },
    save() {
      const f = this.sheet.form;
      const item = { name: String(f.name || '').trim(), date: monthDay(f.month, f.day), kind: f.kind };
      const problem = rememberProblem(item);
      if (problem) {
        this.sheet.error = this.$t(problem);
        this.$message.warning(this.sheet.error);
        return;
      }
      this.sheet.error = '';
      const list = [...this.payload(this.remember), item].map((d) => (d.id ? d : { date: d.date, name: d.name, kind: d.kind }));
      this.day.save({ settings: { calendar: { remember: list } } }, 'days')
        .then(() => { this.sheet.open = false; })
        .catch(() => {});
    },
    remove(d) {
      return this.$confirm(this.$t('dayVoice.days.confirmDelete', { name: d.name }), this.$t('dayVoice.days.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => this.day.save({ settings: { calendar: { remember: this.payload(this.remember.filter((x) => x.id !== d.id)) } } }, 'days', this.$t('day.deleted')))
        .catch(() => {});
    },
  },
};
</script>

<style>
.day-special { display: grid; gap: var(--tb-s3); padding-bottom: var(--tb-s6); }
.day-special__today { display: grid; gap: 2px; padding: var(--tb-s3) 0; border-top: var(--tb-rule-band) solid var(--tb-prayer); border-bottom: 1px solid var(--tb-rule-soft); }
.day-special__label { font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-ink-2); }
.day-special__name { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-32); line-height: 1.2; color: var(--tb-prayer); overflow-wrap: anywhere; }
.day-special__today.is-none .day-special__name { font-size: var(--tb-fs-20); color: var(--tb-ink-2); }
.day-special__head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--tb-s3); flex-wrap: wrap; padding-bottom: var(--tb-s3); }
.day-special__head h3 { font-size: var(--tb-fs-18, 18px); margin: 0; }
.day-special__head .day-note { margin: 2px 0 0; }
.day-row--special .day-row__main { cursor: default; }
.day-row--special .day-row__time { color: var(--tb-prayer); font-size: var(--tb-fs-20); min-width: 5.5ch; }
.day-special__date { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
@media (max-width: 480px) { .day-special__date { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
</style>
