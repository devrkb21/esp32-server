<template>
  <TbSection :title="$t('robot.sec.talk')" :description="$t('companion.proactive.intro')">
    <template #actions><TbSync v-bind="robot.syncOf('proactive')" /></template>

    <div class="rb-talk">
      <div class="rb-row">
        <span class="rb-row__text">{{ $t('companion.proactive.enabled') }}</span>
        <TbSwitch v-model="form.enabled" :aria-label="$t('companion.proactive.enabled')" />
      </div>
      <div v-for="key in ['morning', 'evening']" :key="key" class="rb-talk__row" :class="{ 'is-off': !form.enabled || !form[`${key}_on`] }">
        <span class="rb-row__text">
          <span>{{ $t(`companion.proactive.${key}`) }}</span>
          <small>{{ key === 'morning' ? $t('robot.talk.morningLine') : $t('robot.talk.eveningLine') }}</small>
        </span>
        <span class="rb-row__ctl">
          <TbTime v-model="form[key]" :disabled="!form.enabled || !form[`${key}_on`]" :invalid="!validTime(form[key])"
            :aria-label="$t(`companion.proactive.${key}At`)" />
          <TbSwitch v-model="form[`${key}_on`]" :disabled="!form.enabled" :aria-label="$t(`companion.proactive.${key}`)" />
        </span>
      </div>
      <p class="rb-note">{{ $t('companion.proactive.hint') }}</p>
      <footer class="rb-foot">
        <span v-if="robot.isDirty('proactive')" class="rb-foot__unsaved">{{ $t('common.unsaved') }}</span>
        <TbButton v-if="robot.isDirty('proactive')" variant="quiet" @click="robot.revertSection('proactive')">{{ $t('common.undo') }}</TbButton>
        <TbButton variant="primary" :disabled="!robot.isDirty('proactive')" :loading="!!robot.saving.proactive" @click="robot.saveSection('proactive')">{{ $t('common.save') }}</TbButton>
      </footer>
    </div>
  </TbSection>
</template>

<script>
import { isTime } from '@/utils/companion.mjs';

// Talking first (proactive talk): TinyBot greets in the morning and asks about the day in the
// evening, each at its own time and with its own switch, under one main switch.
export default {
  name: 'RobotTalk',
  inject: ['robot'],
  computed: { form() { return this.robot.forms.proactive; } },
  methods: { validTime: isTime },
};
</script>

<style>
.rb-talk { display: grid; gap: var(--tb-s2); }
.rb-talk__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--tb-s4); align-items: center; min-height: 64px;
  padding: 8px 0; border-bottom: 1px solid var(--tb-rule-soft); transition: opacity var(--tb-t-fast) var(--tb-ease); }
.rb-talk__row.is-off .rb-row__text { color: var(--tb-ink-3); }
@media (max-width: 640px) {
  .rb-talk__row { grid-template-columns: minmax(0, 1fr); }
  .rb-talk__row .rb-row__ctl { justify-content: space-between; }
}
</style>
