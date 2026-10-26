<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { CARE_HOURS, careSettings } from '@/utils/familyModel.mjs'
import { useRobot } from './context'

// Care alerts (settings.care): no activity during the day, a fall, a missed medicine reminder.
// The family is told by notification; this is never medical monitoring. A draft saved with the
// button, like the other sections. `lonely_after_min` (TinyBot talking first) is kept as it is.
defineOptions({ name: 'RobotCare' })

interface CareForm { enabled: boolean, no_activity_hours: number, fall_alert: boolean, missed_medicine_alert: boolean }

const r = useRobot()
const form = ref<CareForm>(careSettings(undefined))
const baseline = ref<CareForm>(careSettings(undefined))
const dirty = computed(() => (Object.keys(baseline.value) as (keyof CareForm)[]).some(k => baseline.value[k] !== form.value[k]))
function sync(force = false) {
  if (!force && (dirty.value || r.saving.care))
    return
  baseline.value = careSettings(r.view.value?.settings?.care)
  form.value = { ...baseline.value }
}
watch(() => r.view.value?.settings?.care, () => sync(), { immediate: true, deep: true })

const hourOptions = computed(() => CARE_HOURS.map(h => ({
  value: h,
  label: h ? t('care.hours.n', { n: r.num(h) }) : t('care.hours.0'),
})))

function set(patch: Partial<CareForm>) {
  form.value = { ...form.value, ...patch }
}
async function save() {
  if (await r.save({ settings: { care: { ...form.value } } }, 'care'))
    sync(true)
}
</script>

<template>
  <tb-section :title="t('care.title')" :description="t('care.lede')">
    <template #actions>
      <tb-sync v-bind="r.syncOf('care')" />
    </template>

    <view class="rbc">
      <view class="rb-row">
        <view class="rb-row__text">
          <text>{{ t('care.enabled') }}</text>
          <text class="rb-row__small">
            {{ t('care.enabledLine') }}
          </text>
        </view>
        <tb-switch :model-value="form.enabled" @change="(on: boolean) => set({ enabled: on })" />
      </view>

      <view class="rbc__block" :class="{ 'is-off': !form.enabled }">
        <view class="rb-row__text">
          <text class="rbc__label">
            {{ t('care.noActivity') }}
          </text>
          <text class="rb-row__small">
            {{ t('care.noActivityLine') }}
          </text>
        </view>
        <tb-choice
          :model-value="form.no_activity_hours" :options="hourOptions" wrap :disabled="!form.enabled"
          :aria-label="t('care.noActivity')" @change="(h: number) => set({ no_activity_hours: h })"
        />
      </view>

      <view class="rb-row" :class="{ 'is-off': !form.enabled }">
        <view class="rb-row__text">
          <text class="rb-row__label">
            {{ t('care.fall') }}
          </text>
          <text class="rb-row__small">
            {{ t('care.fallLine') }}
          </text>
        </view>
        <tb-switch :model-value="form.fall_alert" :disabled="!form.enabled" @change="(on: boolean) => set({ fall_alert: on })" />
      </view>

      <view class="rb-row" :class="{ 'is-off': !form.enabled }">
        <view class="rb-row__text">
          <text class="rb-row__label">
            {{ t('care.medicine') }}
          </text>
          <text class="rb-row__small">
            {{ t('care.medicineLine') }}
          </text>
        </view>
        <tb-switch :model-value="form.missed_medicine_alert" :disabled="!form.enabled" @change="(on: boolean) => set({ missed_medicine_alert: on })" />
      </view>

      <text class="rb-note">
        {{ t('care.who') }}
      </text>

      <view v-if="dirty" class="rb-foot">
        <text class="rb-foot__unsaved">
          {{ t('common.unsaved') }}
        </text>
        <tb-button variant="quiet" @click="sync(true)">
          {{ t('common.undo') }}
        </tb-button>
        <tb-button variant="primary" :loading="!!r.saving.care" @click="save">
          {{ t('common.save') }}
        </tb-button>
      </view>
    </view>
  </tb-section>
</template>

<style lang="scss">
@import './robot.scss';

.rbc {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rbc__block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  transition: opacity var(--tb-t-fast) var(--tb-ease);
}
.rbc__block.is-off .rbc__label {
  color: var(--tb-ink-3);
}
</style>
