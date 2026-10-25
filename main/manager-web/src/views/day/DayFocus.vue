<template>
  <TbSection :title="$t('day.focus.title')" :description="$t('day.focus.desc')">
    <template #actions><TbSync v-bind="day.syncOf('focus')" /></template>

    <div class="day-focus">
      <div class="day-focus__plan" aria-hidden="true">
        <span class="day-focus__big tb-num">{{ num(forms.pomodoro.work_min || 0) }}</span>
        <span class="day-focus__unit">{{ $t('day.focus.minWork') }}</span>
        <span class="day-focus__times tb-num">× {{ num(forms.pomodoro.rounds || 0) }}</span>
      </div>
      <p class="day-focus__done">{{ $t('day.focus.doneToday', { n: num(done) }) }}</p>

      <form class="day-focus__fields" @submit.prevent="saveSection('pomodoro')">
        <TbField v-for="f in fields" :key="f" :label="$t(`day.focus.${f}`)" :for-id="`day-focus-${f}`"
          :hint="$t('day.focus.range', { min: num(FOCUS_LIMITS[f][0]), max: num(FOCUS_LIMITS[f][1]) })">
          <TbInput :id="`day-focus-${f}`" v-model="forms.pomodoro[f]" type="number" number inputmode="numeric"
            :invalid="!inRange(f)" />
        </TbField>
      </form>
      <p class="day-note">{{ $t('day.focus.hint', { rounds: num(forms.pomodoro.rounds || 0) }) }}</p>

      <footer class="day-foot">
        <TbButton icon="play" class="day-foot__reset" :loading="day.busy === 'pomodoro'" :disabled="!!day.busy && day.busy !== 'pomodoro'"
          @click="day.command('pomodoro', forms.pomodoro.work_min, $t('day.focus.started'))">{{ $t('day.focus.startNow') }}</TbButton>
        <span v-if="isDirty('pomodoro')" class="day-foot__unsaved">{{ $t('common.unsaved') }}</span>
        <TbButton v-if="isDirty('pomodoro')" variant="quiet" @click="revertSection('pomodoro')">{{ $t('common.undo') }}</TbButton>
        <TbButton variant="primary" :disabled="!isDirty('pomodoro')" :loading="!!day.saving.focus" @click="saveSection('pomodoro')">{{ $t('common.save') }}</TbButton>
      </footer>
    </div>
  </TbSection>
</template>

<script>
import { FOCUS_LIMITS } from './dayModel';
import sectionForms from './sectionForms';

// Focus timer (pomodoro): work, rounds, short and long break; saved as { pomodoro: {...} }.
// "Start now" sends the pomodoro command with the work minutes in the form (legacy).
export default {
  name: 'DayFocus',
  mixins: [sectionForms(['pomodoro'], 'focus')],
  data() { return { FOCUS_LIMITS, fields: ['work_min', 'rounds', 'short_break_min', 'long_break_min'] }; },
  computed: {
    done() { return (this.day.view && this.day.view.stats && this.day.view.stats.pomodoros_today) || 0; },
  },
  methods: {
    num(n) { return this.day.num(n); },
    inRange(f) {
      const v = this.forms.pomodoro[f];
      const [lo, hi] = FOCUS_LIMITS[f];
      return Number.isInteger(v) && v >= lo && v <= hi;
    },
    focusKey() { return false; },
  },
};
</script>

<style>
.day-focus { display: grid; gap: var(--tb-s4); }
.day-focus__plan { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.day-focus__big { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-48); line-height: 1; letter-spacing: -.02em; }
.day-focus__unit { font-weight: 600; color: var(--tb-ink-2); }
.day-focus__times { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-24); }
.day-focus__done { font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.day-focus__fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tb-s4); max-width: 640px; }
@media (min-width: 1000px) { .day-focus__fields { grid-template-columns: repeat(4, minmax(0, 1fr)); max-width: none; } }
</style>
