<template>
  <TbSection :title="$t('robot.sec.sound')" :description="$t('robot.sound.desc')">
    <div class="rb-sound">
      <!-- Sound: volume (set here or on the robot) and the little sound effects -->
      <div class="rb-sound__block">
        <header class="rb-sound__head">
          <h3 class="rb-sub">{{ $t('companion.sound.title') }}</h3>
          <TbSync v-bind="robot.syncOf('sound')" />
        </header>
        <div class="rb-volume" :class="{ 'is-auto': !sound.controlVolume }">
          <p class="rb-volume__big tb-num" aria-hidden="true">{{ robot.num(shown) }}<small>%</small></p>
          <p class="rb-volume__now" aria-live="polite">{{ nowText }}</p>
        </div>
        <div class="rb-row">
          <span class="rb-row__text"><span>{{ $t('companion.sound.controlVolume') }}</span>
            <small v-if="!sound.controlVolume">{{ $t('companion.sound.autoHint') }}</small></span>
          <TbSwitch v-model="sound.controlVolume" :aria-label="$t('companion.sound.controlVolume')" />
        </div>
        <div class="rb-volume__slider">
          <TbIcon name="minus" :size="16" />
          <TbSlider v-model="sound.volume" :min="0" :max="100" :step="5" :disabled="!sound.controlVolume" :show-value="false"
            :aria-label="$t('companion.sound.volume')" :value-text="`${robot.num(sound.volume)}%`" />
          <TbIcon name="plus" :size="16" />
        </div>
        <div class="rb-row">
          <span class="rb-row__text">{{ $t('companion.sound.sounds') }}</span>
          <TbSwitch v-model="sound.sounds" :aria-label="$t('companion.sound.sounds')" />
        </div>
        <footer class="rb-foot">
          <span v-if="robot.isDirty('sound')" class="rb-foot__unsaved">{{ $t('common.unsaved') }}</span>
          <TbButton v-if="robot.isDirty('sound')" variant="quiet" @click="robot.revertSection('sound')">{{ $t('common.undo') }}</TbButton>
          <TbButton variant="primary" :disabled="!robot.isDirty('sound')" :loading="!!robot.saving.sound" @click="robot.saveSection('sound')">{{ $t('common.save') }}</TbButton>
        </footer>
      </div>

      <!-- Screen: dim and off timeouts -->
      <div class="rb-sound__block">
        <header class="rb-sound__head">
          <h3 class="rb-sub">{{ $t('companion.display.title') }}</h3>
          <TbSync v-bind="robot.syncOf('display')" />
        </header>
        <div v-for="key in ['dim', 'off']" :key="key" class="rb-minutes">
          <TbField :label="key === 'dim' ? $t('companion.display.dimAfter') : $t('companion.display.offAfter')" :for-id="`rb-${key}`">
            <TbSelect :id="`rb-${key}`" :model-value="robot.pickerChoice(key)" :options="options(key)" @change="(v) => robot.pickMinutes(key, v)" />
          </TbField>
          <TbField v-if="robot.pickerChoice(key) === 'custom'" :label="$t('companion.minutesRange', { max: robot.num(pickers[key].max) })" :for-id="`rb-${key}-n`"
            :error="inRange(key) ? '' : $t('robot.sound.wholeMinutes')">
            <TbInput :id="`rb-${key}-n`" v-model="display[pickers[key].field]" type="number" number inputmode="numeric" :invalid="!inRange(key)" />
          </TbField>
        </div>
        <p class="rb-note">{{ $t('companion.display.hint') }}</p>
        <footer class="rb-foot">
          <span v-if="robot.isDirty('display')" class="rb-foot__unsaved">{{ $t('common.unsaved') }}</span>
          <TbButton v-if="robot.isDirty('display')" variant="quiet" @click="robot.revertSection('display')">{{ $t('common.undo') }}</TbButton>
          <TbButton variant="primary" :disabled="!robot.isDirty('display')" :loading="!!robot.saving.display" @click="robot.saveSection('display')">{{ $t('common.save') }}</TbButton>
        </footer>
      </div>
    </div>

    <!-- The pages TinyBot cycles through when you hold its head -->
    <div class="rb-pages">
      <header class="rb-sound__head">
        <h3 class="rb-sub">{{ $t('companion.pages.title') }}</h3>
        <TbSync v-bind="robot.syncOf('pages')" />
      </header>
      <p class="rb-note">{{ $t('companion.pages.footer') }}</p>
      <ul class="rb-pages__list">
        <li v-for="p in pageKeys" :key="p" class="rb-row">
          <span class="rb-row__text"><span>{{ $t(`companion.pages.${p}`) }}</span>
            <small>{{ robot.isLastPageOn(p) ? $t('companion.pages.lastOn') : $t(`companion.pages.${p}Hint`) }}</small></span>
          <TbSwitch :model-value="robot.pages[p]" :disabled="!!robot.saving.pages || robot.isLastPageOn(p)"
            :aria-label="$t(`companion.pages.${p}`)" @change="(v) => robot.setPage(p, v)" />
        </li>
      </ul>
    </div>
  </TbSection>
</template>

<script>
import { ROBOT_PAGES, isMinutes } from '@/utils/companion.mjs';
import { MINUTE_PICKERS, reportedVolume } from './robotModel';

// Sound and screen: the volume (the app sets it, or the robot keeps its own), sound effects,
// when the OLED dims and turns off, and which info pages the robot shows.
export default {
  name: 'RobotSound',
  inject: ['robot'],
  data() { return { pickers: MINUTE_PICKERS, pageKeys: ROBOT_PAGES }; },
  computed: {
    sound() { return this.robot.forms.sound; },
    display() { return this.robot.forms.display; },
    reported() { return reportedVolume(this.robot.view); },
    /** The big number: what the app will set, else what the robot reports. */
    shown() { return this.sound.controlVolume || this.reported === null ? this.sound.volume : this.reported; },
    nowText() {
      return this.reported === null
        ? this.$t('companion.sound.robotNowUnknown')
        : this.$t('companion.sound.robotNow', { n: this.robot.num(this.reported) });
    },
  },
  methods: {
    options(key) {
      const p = MINUTE_PICKERS[key];
      return [
        ...p.presets.map((n) => ({ value: n, label: n === 0 ? this.$t('companion.display.never') : this.$t('companion.minutesShort', { n: this.robot.num(n) }) })),
        { value: 'custom', label: this.$t('companion.minutesCustom') },
      ];
    },
    inRange(key) { return isMinutes(this.display[MINUTE_PICKERS[key].field], MINUTE_PICKERS[key].max); },
  },
};
</script>

<style>
.rb-sound { display: grid; gap: var(--tb-s8); grid-template-columns: minmax(0, 1fr); }
.rb-sound__block { display: grid; gap: var(--tb-s3); align-content: start; min-width: 0; }
.rb-sound__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; flex-wrap: wrap; border-bottom: 1px solid var(--tb-rule); }
.rb-sound__head .rb-sub { border-bottom: 0; }
.rb-sound__head .tb-sync { padding-bottom: 8px; }
.rb-volume { display: flex; align-items: baseline; gap: var(--tb-s4); flex-wrap: wrap; }
.rb-volume__big { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-48); line-height: 1; letter-spacing: -.02em; }
.rb-volume__big small { font-size: var(--tb-fs-24); margin-left: 2px; }
.rb-volume.is-auto .rb-volume__big { color: var(--tb-ink-2); }
.rb-volume__now { font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.rb-volume__slider { display: flex; align-items: center; gap: 10px; color: var(--tb-ink-2); }
.rb-volume__slider .tb-slider { flex: 1; }
.rb-minutes { display: grid; gap: var(--tb-s3); grid-template-columns: minmax(0, 1fr); }
.rb-pages { display: grid; gap: var(--tb-s3); margin-top: var(--tb-s6); }
.rb-pages__list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); column-gap: var(--tb-s8); }
@media (min-width: 900px) {
  .rb-sound { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rb-pages__list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
