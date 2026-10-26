<template>
  <TbSection :title="$t('care.title')" :description="$t('care.lede')">
    <template #actions><TbSync v-bind="robot.syncOf('care')" /></template>

    <div class="rb-care">
      <div v-if="!form.enabled" class="rb-care__off" role="status">
        <p>{{ $t('care.offNote') }}</p>
        <TbButton size="s" :loading="!!robot.saving.careOn" @click="turnOn">{{ $t('care.turnOn') }}</TbButton>
      </div>

      <div class="rb-care__row" :class="{ 'is-off': !form.enabled }">
        <span class="rb-row__text">
          <span>{{ $t('care.noActivity') }}</span>
          <small>{{ $t('care.noActivityLine') }}</small>
        </span>
        <TbChoice v-model="form.no_activity_hours" wrap :disabled="!form.enabled" :aria-label="$t('care.noActivity')"
          :options="hourOptions" />
      </div>
      <div class="rb-row" :class="{ 'is-off': !form.enabled }">
        <span class="rb-row__text">
          <span>{{ $t('care.fall') }}</span>
          <small>{{ $t('care.fallLine') }}</small>
        </span>
        <TbSwitch v-model="form.fall_alert" :disabled="!form.enabled" :aria-label="$t('care.fall')" />
      </div>
      <div class="rb-row" :class="{ 'is-off': !form.enabled }">
        <span class="rb-row__text">
          <span>{{ $t('care.medicine') }}</span>
          <small>{{ $t('care.medicineLine') }}</small>
        </span>
        <TbSwitch v-model="form.missed_medicine_alert" :disabled="!form.enabled" :aria-label="$t('care.medicine')" />
      </div>

      <p class="rb-note">{{ $t('care.who') }}</p>
      <p class="rb-note">{{ $t('care.notMedical') }}</p>

      <footer class="rb-foot">
        <TbButton variant="quiet" icon="bell" to="/notifications">{{ $t('care.openNotifications') }}</TbButton>
        <span v-if="robot.isDirty('care')" class="rb-foot__unsaved">{{ $t('common.unsaved') }}</span>
        <TbButton v-if="robot.isDirty('care')" variant="quiet" @click="robot.revertSection('care')">{{ $t('common.undo') }}</TbButton>
        <TbButton variant="primary" :disabled="!robot.isDirty('care')" :loading="!!robot.saving.care" @click="robot.saveSection('care')">{{ $t('common.save') }}</TbButton>
      </footer>
    </div>
  </TbSection>
</template>

<script>
import { digits } from '@/kit/calendar';
import { NO_ACTIVITY_CHOICES } from './robotModel';

// Care alerts (যত্নের সতর্কতা): the owner and the family get a notification when TinyBot has
// noticed no touch or talk for some hours in the day, when it felt a fall, or when a medicine
// reminder was not confirmed. Stored in settings.care next to the lonely face (Day page). These
// are reminders between family members, not medical monitoring, and the copy says so.
export default {
  name: 'RobotCare',
  inject: ['robot'],
  computed: {
    form() { return this.robot.forms.care; },
    hourOptions() {
      const lang = this.$i18n.locale;
      return NO_ACTIVITY_CHOICES.map((h) => ({ value: h, label: h ? this.$t('care.hours', { n: digits(h, lang) }) : this.$t('care.never') }));
    },
  },
  methods: {
    turnOn() {
      this.robot.save({ settings: { care: { enabled: true } } }, 'careOn').then(() => this.robot.syncForms(true, 'care')).catch(() => {});
    },
  },
};
</script>

<style>
.rb-care { display: grid; gap: var(--tb-s2); }
.rb-care__off { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s3); flex-wrap: wrap;
  padding: var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule); color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.rb-care__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--tb-s4); align-items: center; min-height: 64px;
  padding: 8px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.rb-care .is-off .rb-row__text { color: var(--tb-ink-3); }
@media (max-width: 640px) { .rb-care__row { grid-template-columns: minmax(0, 1fr); } }
</style>
