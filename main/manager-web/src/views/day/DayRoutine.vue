<template>
  <TbSection :title="$t('day.routine.title')" :description="$t('day.routine.desc')" ink="routine">
    <template #actions><TbSync v-bind="day.syncOf('routine')" /></template>

    <div class="day-routine">
      <div class="day-routine__list">
        <div class="day-routine__bar">
          <TbSwitch v-model="forms.routine.enabled" :label="$t('day.routine.enabled')" />
          <TbButton icon="plus" :disabled="items.length >= MAX_ROUTINE" @click="openDayItem(-1)">{{ $t('day.routine.add') }}</TbButton>
        </div>
        <p v-if="!forms.routine.enabled" class="day-note">{{ $t('day.routine.offNote') }}</p>
        <p class="day-routine__count tb-num">{{ $t('day.countOf', { n: num(items.length), max: num(MAX_ROUTINE) }) }}</p>

        <TbEmpty v-if="!items.length" face="sleepy" :title="$t('day.routine.empty')" :text="$t('day.routine.emptyText')" />
        <ul v-else class="day-rows" :class="{ 'is-dim': !forms.routine.enabled }">
          <li v-for="(item, i) in items" :key="i + '-' + item.start + '-' + item.activity" :ref="(el) => rowEls[i] = el"
            class="day-row day-row--routine" :class="{ 'is-now': i === nowRow && forms.routine.enabled, 'is-shown': item.activity === preview }">
            <button type="button" class="day-row__main" @click="openDayItem(i)">
              <span class="day-row__span tb-num">{{ day.fmt(item.start) }}–{{ day.fmt(item.end) }}</span>
              <span class="day-row__body">
                <span class="day-row__title"><i class="day-row__mark" aria-hidden="true"></i>{{ $t(`day.activity.${item.activity}`) }}</span>
                <span class="day-row__meta">{{ duration(item) }}<template v-if="overlapRows[i]">, <b class="day-row__warn">{{ $t('day.routine.overlapShort') }}</b></template></span>
              </span>
              <TbTag v-if="i === nowRow && forms.routine.enabled" ink="action" class="day-row__now">{{ $t('common.now') }}</TbTag>
            </button>
            <div class="day-row__acts">
              <TbButton variant="quiet" icon="eye" :aria-label="$t('day.routine.showPreview', { activity: $t(`day.activity.${item.activity}`) })" @click="showPreview(item.activity)" />
              <TbButton variant="quiet" icon="trash" :aria-label="$t('day.routine.remove', { activity: $t(`day.activity.${item.activity}`) })" @click="removeDayItem(i)" />
            </div>
          </li>
        </ul>

        <ul v-if="overlaps.length" class="day-routine__warns">
          <li v-for="pair in overlaps" :key="pair[0] + '-' + pair[1]" role="status"><TbIcon name="warning" :size="16" />{{ overlapText(pair) }}</li>
        </ul>
        <p class="day-note">{{ $t('day.routine.note') }}</p>

        <footer class="day-foot">
          <TbButton variant="quiet" icon="refresh" class="day-foot__reset" :disabled="isDefaultDay" @click="resetDay">{{ $t('day.routine.reset') }}</TbButton>
          <span v-if="isDirty('routine')" class="day-foot__unsaved">{{ $t('common.unsaved') }}</span>
          <TbButton v-if="isDirty('routine')" variant="quiet" @click="revertSection('routine')">{{ $t('common.undo') }}</TbButton>
          <TbButton variant="primary" :disabled="!isDirty('routine')" :loading="!!day.saving.routine" @click="saveSection('routine')">{{ $t('common.save') }}</TbButton>
        </footer>
      </div>

      <aside class="day-routine__preview" :aria-label="$t('day.routine.previewTitle')">
        <h3 class="day-subtitle">{{ $t('day.routine.previewTitle') }}</h3>
        <DayScreen ref="screen" :activity="preview" :look="day.look" animate
          :alt="$t('day.screenAlt', { activity: $t(`day.activity.${preview}`) })" @playing="(v) => playing = v" />
        <div class="day-routine__under">
          <p class="day-note">{{ scheduledText }}</p>
          <TbButton size="s" icon="play" :disabled="playing" @click="$refs.screen.replay()">{{ $t('day.routine.replay') }}</TbButton>
        </div>
        <TbChoice wrap :model-value="preview" :options="activityOptions" :aria-label="$t('day.routine.previewPick')" @change="showPreview" />
        <p v-if="isMeal(preview)" class="day-note">{{ $t('day.routine.mealHint') }}</p>
      </aside>
    </div>

    <TbSheet v-model:open="sheet.open" :title="sheet.index < 0 ? $t('day.routine.add') : $t('day.routine.edit')" :close-label="$t('common.close')">
      <form v-if="sheet.form" id="day-routine-form" class="day-form" @submit.prevent="applyDayItem">
        <div class="day-form__range">
          <TbField :label="$t('day.routine.start')" for-id="day-rt-start"><TbTime id="day-rt-start" v-model="sheet.form.start" /></TbField>
          <TbIcon class="day-form__arrow" name="chevron-right" />
          <TbField :label="$t('day.routine.end')" for-id="day-rt-end"><TbTime id="day-rt-end" v-model="sheet.form.end" /></TbField>
        </div>
        <p v-if="sheetProblem" class="day-form__error" role="alert">{{ sheetProblem }}</p>
        <p v-else-if="sheetNextDay" class="day-note">{{ $t('day.routine.nextDayHint') }}</p>
        <TbField :label="$t('day.routine.activityLabel')" for-id="day-rt-act" :hint="isMeal(sheet.form.activity) ? $t('day.routine.mealHint') : ''">
          <TbSelect id="day-rt-act" v-model="sheet.form.activity" :options="activityOptions" />
        </TbField>
      </form>
      <template #footer>
        <TbButton v-if="sheet.index >= 0" variant="danger" icon="trash" @click="removeDayItem(sheet.index); sheet.open = false">{{ $t('common.delete') }}</TbButton>
        <TbButton @click="sheet.open = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" native-type="submit" form="day-routine-form" :disabled="!!sheetProblem">{{ $t('day.routine.apply') }}</TbButton>
      </template>
    </TbSheet>
  </TbSection>
</template>

<script>
import {
  ACTIVITIES, MAX_ROUTINE, defaultRoutine, minuteOfDay, newRoutineItem, routineItemProblem, routineOverlaps, sameRoutine,
  scheduledActivity, sortRoutine,
} from '@/utils/companion.mjs';
import { MEALS } from '@/utils/faceLook.mjs';
import { nowIndex, previewActivity, routineOfKey } from './dayModel';
import { durationText } from './dayText';
import sectionForms from './sectionForms';
import DayScreen from './DayScreen.vue';

// TinyBot's own day (settings.routine): edited locally, saved as the whole sorted list with
// Save (legacy). The preview plays the picked activity with the robot's saved face.
export default {
  name: 'DayRoutine',
  components: { DayScreen },
  mixins: [sectionForms(['routine'])],
  data() {
    return { MAX_ROUTINE, sheet: { open: false, index: -1, form: null }, picked: '', playing: false, rowEls: {} };
  },
  computed: {
    items() { return this.forms.routine.items; },
    scheduled() { return scheduledActivity(this.forms.routine, this.day.minute); },
    nowRow() { return nowIndex(this.forms.routine, this.day.minute); },
    preview() { return previewActivity(this.picked, this.day.view && this.day.view.stats, this.forms.routine, this.day.minute); },
    scheduledText() {
      return this.scheduled
        ? this.$t('day.routine.scheduledNow', { activity: this.$t(`day.activity.${this.scheduled}`) })
        : this.$t('day.routine.nothingNow');
    },
    overlaps() { return routineOverlaps(this.items); },
    overlapRows() { const rows = {}; this.overlaps.forEach(([a, b]) => { rows[a] = true; rows[b] = true; }); return rows; },
    isDefaultDay() { return sameRoutine(this.forms.routine, { enabled: this.forms.routine.enabled, items: defaultRoutine().items }); },
    activityOptions() { return ACTIVITIES.map((a) => ({ value: a, label: this.$t(`day.activity.${a}`) })); },
    sheetProblem() {
      const form = this.sheet.form;
      if (!form) return '';
      const code = routineItemProblem(form);
      if (code === 'time') return this.$t('day.problem.time');
      if (code === 'sameTime') return this.$t('day.problem.sameTime');
      if (code === 'activity') return this.$t('day.problem.activity');
      return '';
    },
    sheetNextDay() { const f = this.sheet.form; return !!f && minuteOfDay(f.end) < minuteOfDay(f.start); },
  },
  methods: {
    num(n) { return this.day.num(n); },
    isMeal(a) { return MEALS.includes(a); },
    duration(item) { return durationText(item, (k, p) => this.$t(k, p || {}), this.num); },
    overlapText([a, b]) {
      const label = (item) => `${this.day.fmt(item.start)}–${this.day.fmt(item.end)} ${this.$t(`day.activity.${item.activity}`)}`;
      return this.$t('day.routine.overlap', { a: label(this.items[a]), b: label(this.items[b]) });
    },
    showPreview(activity) { this.picked = activity; },
    openDayItem(index) {
      if (index < 0 && this.items.length >= MAX_ROUTINE) return;
      const form = index < 0 ? newRoutineItem(this.items) : { ...this.items[index] };
      this.sheet = { open: true, index, form };
    },
    // apply the sheet to the edited day (sent with Save)
    applyDayItem() {
      const { form, index } = this.sheet;
      if (!form || routineItemProblem(form)) return;
      const item = { start: form.start, end: form.end, activity: form.activity };
      const items = this.items.slice();
      if (index < 0) items.push(item); else items.splice(index, 1, item);
      this.forms.routine.items = sortRoutine(items);
      this.picked = item.activity;
      this.sheet.open = false;
    },
    removeDayItem(index) {
      const items = this.items.slice();
      items.splice(index, 1);
      this.forms.routine.items = items;
    },
    resetDay() { this.forms.routine.items = defaultRoutine().items; },
    focusKey(key) {
      const want = routineOfKey(key);
      if (!want) return false;
      const i = this.items.findIndex((it) => it.start === want.start && it.activity === want.activity);
      if (i < 0) return false;
      this.day.reveal(this.rowEls[i]);
      this.picked = want.activity;
      this.openDayItem(i);
      return true;
    },
  },
};
</script>

<style>
.day-routine { display: grid; gap: var(--tb-s8); grid-template-columns: minmax(0, 1fr); }
.day-routine__list { display: grid; gap: var(--tb-s3); align-content: start; min-width: 0; }
.day-routine__bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.day-routine__count { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.day-rows.is-dim .day-row__main { opacity: .55; }
.day-row__span { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-16); white-space: nowrap; color: var(--tb-routine); min-width: 8.5ch; }
.day-row--routine .day-row__main { grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; }
.day-row__mark { display: inline-block; width: 8px; height: 8px; margin-right: 8px; background: var(--tb-routine-mark); vertical-align: 1px; }
.day-row__warn { color: var(--tb-warn); font-weight: 600; }
.day-row.is-now { border-top: 2px solid var(--tb-orange); }
.day-routine__warns { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.day-routine__warns li { display: flex; gap: 8px; align-items: flex-start; font-size: var(--tb-fs-13); color: var(--tb-warn); }
.day-routine__warns .tb-icon { flex: none; margin-top: 3px; }
.day-foot__reset { margin-right: auto; }
.day-foot__reset + .day-foot__unsaved { margin-right: 0; }
.day-routine__preview { display: grid; gap: var(--tb-s3); align-content: start; min-width: 0; }
.day-routine__under { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
@media (min-width: 1000px) {
  .day-routine { grid-template-columns: minmax(0, 1fr) 320px; }
  .day-routine__preview { position: sticky; top: 16px; }
}
@media (max-width: 480px) {
  .day-row--routine .day-row__main { grid-template-columns: minmax(0, 1fr) auto; }
  .day-row--routine .day-row__span { grid-column: 1 / -1; }
  .day-row--routine .day-row__now { grid-row: 1; grid-column: 2; }
}
</style>
