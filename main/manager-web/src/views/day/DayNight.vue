<template>
  <TbSection :title="$t('day.night.sectionTitle')" :description="$t('day.night.desc')" ink="message">
    <div class="day-night">
      <form ref="night" class="day-night__block" @submit.prevent="saveSection('night')">
        <header class="day-night__head">
          <h3 class="day-subtitle">{{ $t('day.night.title') }}</h3>
          <TbSync v-bind="day.syncOf('night')" />
        </header>
        <div class="day-form__range">
          <TbField :label="$t('day.night.start')" for-id="day-night-start"><TbTime id="day-night-start" v-model="forms.night.start" /></TbField>
          <TbIcon class="day-form__arrow" name="chevron-right" />
          <TbField :label="$t('day.night.end')" for-id="day-night-end"><TbTime id="day-night-end" v-model="forms.night.end" /></TbField>
        </div>
        <div class="day-night__switches">
          <TbSwitch v-model="forms.night.enabled" :label="$t('day.night.enabled')" />
          <TbSwitch v-model="forms.night.dim" :label="$t('day.night.dim')" />
          <TbSwitch v-model="forms.night.lullaby" :label="$t('day.night.lullaby')" />
          <TbSwitch v-model="forms.night.light" :label="$t('day.night.light')" />
        </div>
        <div class="day-night__light">
          <TbField :label="$t('day.night.lightFor')" for-id="day-night-lightfor">
            <TbSelect id="day-night-lightfor" :model-value="lightChoice" :options="lightOptions" @change="pickLight" />
          </TbField>
          <TbField v-if="lightChoice === 'custom'" :label="$t('day.night.lightMinutes', { max: num(NIGHT_LIGHT_MAX) })" for-id="day-night-lightmin">
            <TbInput id="day-night-lightmin" v-model="forms.night.light_minutes" type="number" number inputmode="numeric" />
          </TbField>
        </div>
        <p class="day-note">{{ $t('day.night.lightForHint') }}</p>
        <div class="day-night__now">
          <TbButton icon="moon" :disabled="!!day.busy && day.busy !== 'night:on'" :loading="day.busy === 'night:on'"
            @click="day.command('night', 'on', $t('day.night.startedNow'), 'night:on')">{{ $t('day.night.startNow') }}</TbButton>
          <TbButton icon="sun" :disabled="!!day.busy && day.busy !== 'night:off'" :loading="day.busy === 'night:off'"
            @click="day.command('night', 'off', $t('day.night.endedNow'), 'night:off')">{{ $t('day.night.endNow') }}</TbButton>
        </div>
        <p class="day-note">{{ $t('day.night.nowHint') }}</p>
        <footer class="day-foot">
          <span v-if="isDirty('night')" class="day-foot__unsaved">{{ $t('common.unsaved') }}</span>
          <TbButton v-if="isDirty('night')" variant="quiet" @click="undo('night')">{{ $t('common.undo') }}</TbButton>
          <TbButton variant="primary" native-type="submit" :disabled="!isDirty('night')" :loading="!!day.saving.night">{{ $t('common.save') }}</TbButton>
        </footer>
      </form>

      <form class="day-night__block" @submit.prevent="saveSection('care')">
        <header class="day-night__head">
          <h3 class="day-subtitle">{{ $t('day.care.title') }}</h3>
          <TbSync v-bind="day.syncOf('care')" />
        </header>
        <TbSwitch v-model="forms.care.enabled" :label="$t('day.care.enabled')" />
        <TbField :label="$t('day.care.lonelyAfter')" for-id="day-care-lonely"
          :hint="$t('day.care.range', { min: num(LONELY_LIMITS[0]), max: num(LONELY_LIMITS[1]) })">
          <TbInput id="day-care-lonely" v-model="forms.care.lonely_after_min" type="number" number inputmode="numeric" />
        </TbField>
        <p class="day-note">{{ $t('day.care.hint') }}</p>
        <footer class="day-foot">
          <span v-if="isDirty('care')" class="day-foot__unsaved">{{ $t('common.unsaved') }}</span>
          <TbButton v-if="isDirty('care')" variant="quiet" @click="undo('care')">{{ $t('common.undo') }}</TbButton>
          <TbButton variant="primary" native-type="submit" :disabled="!isDirty('care')" :loading="!!day.saving.care">{{ $t('common.save') }}</TbButton>
        </footer>
      </form>
    </div>
  </TbSection>
</template>

<script>
import { NIGHT_LIGHT_MAX, NIGHT_LIGHT_PRESETS, presetChoice } from '@/utils/companion.mjs';
import { LONELY_LIMITS } from './dayModel';
import sectionForms from './sectionForms';

// Night mode (window, dim, lullaby, night light and its minutes) and care (lonely face):
// each saved as its own settings patch; "Start night now" / "End night now" are commands.
export default {
  name: 'DayNight',
  mixins: [sectionForms(['night', 'care'])],
  data() { return { NIGHT_LIGHT_MAX, LONELY_LIMITS, customLight: false }; },
  computed: {
    // a minute picker switched to "Custom" keeps showing its number input
    lightChoice() { return this.customLight ? 'custom' : presetChoice(this.forms.night.light_minutes, NIGHT_LIGHT_PRESETS); },
    lightOptions() {
      return [
        ...NIGHT_LIGHT_PRESETS.map((n) => ({ value: n, label: n === 0 ? this.$t('day.night.untilMorning') : this.$t('day.minutes', { n: this.num(n) }) })),
        { value: 'custom', label: this.$t('day.night.custom') },
      ];
    },
  },
  methods: {
    num(n) { return this.day.num(n); },
    pickLight(choice) {
      if (choice === 'custom') { this.customLight = true; return; }
      this.customLight = false;
      this.forms.night.light_minutes = choice;
    },
    undo(s) { this.revertSection(s); if (s === 'night') this.customLight = false; },
    focusKey(key) {
      if (key !== 'night') return false;
      this.day.reveal(this.$refs.night);
      return true;
    },
  },
};
</script>

<style>
.day-night { display: grid; gap: var(--tb-s8); grid-template-columns: minmax(0, 1fr); }
.day-night__block { display: grid; gap: var(--tb-s4); align-content: start; min-width: 0; }
.day-night__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding-bottom: 8px; border-bottom: 1px solid var(--tb-rule); }
.day-night__switches { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--tb-s4); }
.day-night__light { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tb-s4); }
.day-night__now { display: flex; gap: 8px; flex-wrap: wrap; }
@media (min-width: 1000px) {
  .day-night { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); }
}
@media (max-width: 480px) {
  .day-night__switches, .day-night__light { grid-template-columns: minmax(0, 1fr); }
}
</style>
