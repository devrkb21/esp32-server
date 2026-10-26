<template>
  <div class="cal">
    <TbPageHeader :title="$t('nav.calendar')" :description="$t('calendar.desc')">
      <template #actions>
        <TbButton icon="refresh" :loading="loading && !!days.length" :disabled="loading" @click="fetch">{{ $t('calendar.refresh') }}</TbButton>
        <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('calendar.add') }}</TbButton>
      </template>
    </TbPageHeader>

    <p class="cal__note">{{ $t('calendar.fixedNote') }}</p>

    <p v-if="failed && days.length" class="cal__fail" role="alert">{{ $t('common.loadFailed') }}
      <TbButton size="s" variant="quiet" icon="refresh" @click="fetch">{{ $t('common.retry') }}</TbButton></p>

    <TbTable class="cal__table" dense row-key="id" :columns="columns" :rows="rows" :loading="loading && !days.length"
      :loading-text="$t('common.loading')" :caption="$t('nav.calendar')">
      <template #cell-date="{ row }">
        <span class="cal-date" :class="`is-${row.state}`"><b class="tb-num">{{ dateText(row.date) }}</b>
          <small>{{ $t(`calendar.state.${row.state}`) }}</small></span>
      </template>
      <template #cell-key="{ row }">
        <TbTag :ink="row.key === 'custom' ? 'ink-2' : 'prayer'" :mark="row.state === 'today'">{{ $t(`calendar.key.${row.key}`) }}</TbTag>
      </template>
      <template #cell-names="{ row }">
        <span class="cal-names"><b>{{ row.nameBn }}</b><small v-if="row.nameEn && row.nameEn !== row.nameBn">{{ row.nameEn }}</small></span>
      </template>
      <template #cell-actions="{ row }">
        <span class="cal-acts">
          <TbButton size="s" variant="quiet" icon="edit" @click="openEdit(row)">{{ $t('common.edit') }}</TbButton>
          <TbButton size="s" variant="quiet" icon="trash" :disabled="deleting" @click="remove(row)">{{ $t('common.delete') }}</TbButton>
        </span>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" :title="$t('calendar.loadFailed')" :text="$t('common.loadFailed')">
          <TbButton icon="refresh" @click="fetch">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else :title="$t('calendar.emptyTitle')" :text="$t('calendar.emptyText')">
          <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('calendar.add') }}</TbButton>
        </TbEmpty>
      </template>
    </TbTable>

    <TbSheet v-model:open="sheet.open" :title="sheet.form && sheet.form.id ? $t('calendar.edit') : $t('calendar.add')" :close-label="$t('common.close')">
      <form v-if="sheet.form" id="cal-form" class="cal-form" @submit.prevent="save">
        <TbField :label="$t('calendar.col.date')" for-id="cal-date" :error="sheet.error">
          <TbTime id="cal-date" v-model="sheet.form.date" type="date" :invalid="!!sheet.error" />
        </TbField>
        <TbField :label="$t('calendar.col.key')">
          <TbChoice v-model="sheet.form.key" wrap :options="keyOptions" :aria-label="$t('calendar.col.key')" />
        </TbField>
        <TbField :label="$t('calendar.nameBn')" :hint="sheet.form.key === 'custom' ? '' : $t('calendar.nameHint')" for-id="cal-name-bn">
          <TbInput id="cal-name-bn" v-model="sheet.form.nameBn" :maxlength="MAX_NAME" />
        </TbField>
        <TbField :label="$t('calendar.nameEn')" for-id="cal-name-en">
          <TbInput id="cal-name-en" v-model="sheet.form.nameEn" :maxlength="MAX_NAME" />
        </TbField>
        <p class="cal__note">{{ $t('calendar.moonNote') }}</p>
      </form>
      <template #footer>
        <TbButton @click="sheet.open = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" native-type="submit" form="cal-form" :loading="saving">{{ $t('common.save') }}</TbButton>
      </template>
    </TbSheet>
  </div>
</template>

<script>
import Api from '@/apis/api';
import { KEYS, MAX_NAME, dayPayload, dayProblem, newDay, withState } from './calendarModel';

// Special days (back office, super admins): the dated list TinyBots greet for. Eid dates depend
// on the moon sighting, so they are entered here once announced; nothing is guessed. The fixed
// national days (21 Feb, 26 Mar, 14 Apr, 16 Dec) are known to the server and not listed here.
// API: calendar.getCalendarDays, saveCalendarDay, deleteCalendarDays.
export default {
  name: 'CalendarDays',
  data() {
    return {
      MAX_NAME,
      days: [],
      loading: false,
      failed: false,
      saving: false,
      deleting: false,
      sheet: { open: false, form: null, error: '' },
    };
  },
  computed: {
    todayIso() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    rows() { return withState(this.days, this.todayIso); },
    columns() {
      return [
        { key: 'date', label: this.$t('calendar.col.date'), width: '170px' },
        { key: 'key', label: this.$t('calendar.col.key'), width: '150px' },
        { key: 'names', label: this.$t('calendar.col.names'), full: true },
        { key: 'actions', label: this.$t('calendar.col.actions'), width: '1%', align: 'right' },
      ];
    },
    keyOptions() { return KEYS.map((k) => ({ value: k, label: this.$t(`calendar.key.${k}`) })); },
  },
  created() { this.fetch(); },
  methods: {
    dateText(iso) {
      const [y, m, d] = String(iso).split('-').map(Number);
      const loc = this.$i18n.locale === 'bn' ? 'bn-BD' : 'en-GB';
      try { return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d)); } catch (e) { return iso; }
    },
    fetch() {
      this.loading = true;
      this.failed = false;
      Api.calendar.getCalendarDays(({ data }) => {
        this.loading = false;
        if (data && data.code === 0) this.days = Array.isArray(data.data) ? data.data : [];
        else this.failed = true;
      }, () => { this.loading = false; this.failed = true; });
    },
    openAdd() { this.sheet = { open: true, error: '', form: newDay() }; },
    openEdit(row) {
      this.sheet = { open: true, error: '', form: { id: row.id, date: row.date, key: row.key, nameBn: row.nameBn || '', nameEn: row.nameEn || '' } };
    },
    save() {
      const problem = dayProblem(this.sheet.form);
      if (problem) {
        this.sheet.error = this.$t(problem);
        this.$message.warning(this.sheet.error);
        return;
      }
      this.sheet.error = '';
      this.saving = true;
      Api.calendar.saveCalendarDay(dayPayload(this.sheet.form), ({ data }) => {
        this.saving = false;
        if (data && data.code === 0) {
          this.sheet.open = false;
          this.$message.success(this.$t('calendar.saved'));
          this.fetch();
        } else {
          this.$message.error((data && data.msg) || this.$t('calendar.saveFailed'));
        }
      }, () => { this.saving = false; this.$message.error(this.$t('calendar.saveFailed')); });
    },
    remove(row) {
      return this.$confirm(this.$t('calendar.confirmDelete', { name: row.nameBn || row.nameEn, date: this.dateText(row.date) }), this.$t('calendar.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        this.deleting = true;
        Api.calendar.deleteCalendarDays([row.id], ({ data }) => {
          this.deleting = false;
          if (data && data.code === 0) { this.$message.success(this.$t('calendar.deleted')); this.fetch(); }
          else this.$message.error((data && data.msg) || this.$t('calendar.saveFailed'));
        }, () => { this.deleting = false; this.$message.error(this.$t('calendar.saveFailed')); });
      }).catch(() => {});
    },
  },
};
</script>

<style>
.cal { padding-bottom: var(--tb-s10); }
.cal__note { max-width: 72ch; font-size: var(--tb-fs-13); color: var(--tb-ink-2); margin: var(--tb-s3) 0; }
.cal__fail { display: flex; align-items: center; gap: 8px; color: var(--tb-danger); font-size: var(--tb-fs-14); }
.cal__table { margin-top: var(--tb-s3); }
.cal-date { display: grid; gap: 2px; }
.cal-date small { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.cal-date.is-today b { color: var(--tb-action); }
.cal-date.is-past b { color: var(--tb-ink-3); }
.cal-names { display: grid; gap: 2px; min-width: 0; }
.cal-names b { font-weight: 600; overflow-wrap: anywhere; }
.cal-names small { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.cal-acts { display: inline-flex; gap: 4px; white-space: nowrap; }
.cal-form { display: grid; gap: var(--tb-s5); }
.cal-form .tb-field { grid-template-columns: minmax(0, 1fr); min-width: 0; }
</style>
