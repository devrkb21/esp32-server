<template>
  <TbSection :title="$t('robot.sec.gestures')" :description="$t('robot.gestures.intro')">
    <template #actions><TbSync v-bind="robot.syncOf('gestures')" /></template>

    <div class="rb-taps">
      <div v-for="key in keys" :key="key" class="rb-taps__row">
        <span class="rb-taps__marks" aria-hidden="true"><i v-for="n in taps(key)" :key="n" /></span>
        <label class="rb-row__text" :for="`rb-tap-${key}`">
          <span class="rb-taps__name">{{ $t(`robot.gestures.${key}`) }}</span>
          <small>{{ $t(`robot.gestures.${key}Line`) }}</small>
        </label>
        <TbSelect :id="`rb-tap-${key}`" v-model="form[key]" class="rb-taps__pick" :options="options" />
      </div>
      <p class="rb-note">{{ $t('robot.gestures.hint') }}</p>
      <p v-if="usesFocus" class="rb-note">{{ $t('robot.gestures.focusNote', { n: robot.num(focusMin) }) }}</p>
      <footer class="rb-foot">
        <span v-if="robot.isDirty('gestures')" class="rb-foot__unsaved">{{ $t('common.unsaved') }}</span>
        <TbButton v-if="robot.isDirty('gestures')" variant="quiet" @click="robot.revertSection('gestures')">{{ $t('common.undo') }}</TbButton>
        <TbButton variant="primary" :disabled="!robot.isDirty('gestures')" :loading="!!robot.saving.gestures" @click="robot.saveSection('gestures')">{{ $t('common.save') }}</TbButton>
      </footer>
    </div>
  </TbSection>
</template>

<script>
import { GESTURE_KEYS, focusMinutes, gestureOptions } from './robotModel';

// Tap shortcuts (settings.gestures): what two and three taps on TinyBot's head do. The robot
// counts exactly, so four or more taps do nothing; "focus" starts the saved focus minutes.
export default {
  name: 'RobotGestures',
  inject: ['robot'],
  data() { return { keys: GESTURE_KEYS }; },
  computed: {
    form() { return this.robot.forms.gestures; },
    options() { return gestureOptions((k) => this.$t(k)); },
    usesFocus() { return GESTURE_KEYS.some((k) => this.form[k] === 'focus'); },
    focusMin() { return focusMinutes(this.robot.view); },
  },
  methods: {
    taps(key) { return key === 'triple_tap' ? 3 : 2; },
  },
};
</script>

<style>
.rb-taps { display: grid; gap: var(--tb-s2); }
.rb-taps__row {
  display: grid; grid-template-columns: 40px minmax(0, 1fr) minmax(200px, 280px); gap: var(--tb-s4); align-items: center;
  min-height: 64px; padding: 8px 0; border-bottom: 1px solid var(--tb-rule-soft);
}
.rb-taps__marks { display: inline-flex; gap: 4px; align-items: center; }
.rb-taps__marks i { width: 8px; height: 8px; border-radius: 50%; background: var(--tb-ink); }
.rb-taps__name { font-weight: 600; }
@media (max-width: 640px) {
  .rb-taps__row { grid-template-columns: 32px minmax(0, 1fr); }
  .rb-taps__pick { grid-column: 1 / -1; }
}
</style>
