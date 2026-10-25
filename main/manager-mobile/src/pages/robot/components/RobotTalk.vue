<script lang="ts" setup>
import type { ProactiveSettings } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { isHHMM, proactiveProblem, proactiveSettings } from '../../companion/companionUtils.mjs'
import { useRobot } from './context'

// Talking first (proactive talk): a morning greeting and an evening "how was your day?", each
// with its own switch and time, under one main switch. A draft saved with the button.
defineOptions({ name: 'RobotTalk' })

const r = useRobot()
const rows = [
  { on: 'morning_on', time: 'morning', label: 'companion.proactive.morning', line: 'mrobot.talk.morningLine', timeLabel: 'companion.proactive.morningAt' },
  { on: 'evening_on', time: 'evening', label: 'companion.proactive.evening', line: 'mrobot.talk.eveningLine', timeLabel: 'companion.proactive.eveningAt' },
] as const

// the draft follows the server until edited (baseline = the server's value it was taken from)
const form = ref<ProactiveSettings>(proactiveSettings(undefined))
const baseline = ref<ProactiveSettings>(proactiveSettings(undefined))
const dirty = computed(() => (Object.keys(baseline.value) as (keyof ProactiveSettings)[]).some(k => baseline.value[k] !== form.value[k]))
function sync(force = false) {
  if (!force && (dirty.value || r.saving.proactive))
    return
  baseline.value = proactiveSettings(r.view.value?.settings?.proactive)
  form.value = { ...baseline.value }
}
watch(() => r.view.value?.settings?.proactive, () => sync(), { immediate: true, deep: true })

function set(patch: Partial<ProactiveSettings>) {
  form.value = { ...form.value, ...patch }
}
function onTime(key: 'morning' | 'evening', e: any) {
  const value = e?.detail?.value
  if (isHHMM(value))
    set({ [key]: value })
}
function revert() {
  sync(true)
}
async function save() {
  const problem = proactiveProblem(form.value)
  if (problem) {
    toast.warning(t(`companion.proactive.${problem}`))
    return
  }
  if (await r.save({ settings: { proactive: { ...form.value } } }, 'proactive'))
    sync(true)
}
</script>

<template>
  <tb-section :title="t('mrobot.sec.talk')" :description="t('companion.proactive.intro')">
    <template #actions>
      <tb-sync v-bind="r.syncOf('proactive')" />
    </template>

    <view class="rbt">
      <view class="rb-row">
        <view class="rb-row__text">
          <text>{{ t('companion.proactive.enabled') }}</text>
        </view>
        <tb-switch :model-value="form.enabled" @change="(on: boolean) => set({ enabled: on })" />
      </view>
      <view v-for="row in rows" :key="row.on" class="rbt__row" :class="{ 'is-off': !form.enabled || !form[row.on] }">
        <view class="rb-row__text">
          <text class="rbt__label">
            {{ t(row.label) }}
          </text>
          <text class="rb-row__small">
            {{ t(row.line) }}
          </text>
        </view>
        <view class="rb-row__ctl">
          <picker mode="time" :value="form[row.time]" :disabled="!form.enabled || !form[row.on]" @change="(e: any) => onTime(row.time, e)">
            <view class="rbt__time" :class="{ 'is-disabled': !form.enabled || !form[row.on] }" role="button" :aria-label="t(row.timeLabel)">
              <text class="tb-num">
                {{ r.time(form[row.time]) }}
              </text>
              <tb-icon name="chevron-down" :size="16" />
            </view>
          </picker>
          <tb-switch :model-value="form[row.on]" :disabled="!form.enabled" @change="(on: boolean) => set({ [row.on]: on })" />
        </view>
      </view>
      <text class="rb-note">
        {{ t('companion.proactive.hint') }}
      </text>
      <view v-if="dirty" class="rb-foot">
        <text class="rb-foot__unsaved">
          {{ t('common.unsaved') }}
        </text>
        <tb-button variant="quiet" @click="revert">
          {{ t('common.undo') }}
        </tb-button>
        <tb-button variant="primary" :loading="!!r.saving.proactive" @click="save">
          {{ t('common.save') }}
        </tb-button>
      </view>
    </view>
  </tb-section>
</template>

<style lang="scss">
@import './robot.scss';

.rbt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rbt__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 64px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  transition: opacity var(--tb-t-fast) var(--tb-ease);
}
.rbt__row .rb-row__text {
  min-width: 150px;
}
.rbt__row.is-off .rbt__label {
  color: var(--tb-ink-3);
}
.rbt__time {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 12px;
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-m);
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 17px;
}
.rbt__time.is-disabled {
  opacity: 0.45;
}
</style>
