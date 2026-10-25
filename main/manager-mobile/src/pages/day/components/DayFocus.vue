<script lang="ts" setup>
import type { PomodoroConfig } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { clampInt } from '../../companion/companionUtils.mjs'
import { useDay } from '../dayContext'
import { FOCUS_LIMITS, focusProblem } from '../dayModel.mjs'
import DayField from './DayField.vue'
import DayNumber from './DayNumber.vue'

// Focus timer (pomodoro): saved as { pomodoro: {...} }; "Start now" sends the pomodoro command
// with the work minutes of the form (legacy).
const FIELDS = ['work_min', 'rounds', 'short_break_min', 'long_break_min'] as const
const FALLBACK: PomodoroConfig = { work_min: 25, short_break_min: 5, long_break_min: 15, rounds: 4 }
const day = useDay()
const draft = ref<PomodoroConfig>({ ...FALLBACK })
const dirty = ref(false)
// follow the server values until edited
watch(() => day.view?.pomodoro, (p) => {
  if (p && !dirty.value)
    draft.value = { ...p }
}, { immediate: true, deep: true })
const done = computed(() => day.view?.stats?.pomodoros_today ?? 0)

function clean(): PomodoroConfig {
  const p = draft.value
  return {
    work_min: clampInt(p.work_min, FOCUS_LIMITS.work_min[0], FOCUS_LIMITS.work_min[1], 25),
    short_break_min: clampInt(p.short_break_min, FOCUS_LIMITS.short_break_min[0], FOCUS_LIMITS.short_break_min[1], 5),
    long_break_min: clampInt(p.long_break_min, FOCUS_LIMITS.long_break_min[0], FOCUS_LIMITS.long_break_min[1], 15),
    rounds: clampInt(p.rounds, FOCUS_LIMITS.rounds[0], FOCUS_LIMITS.rounds[1], 4),
  }
}
function edit(field: keyof PomodoroConfig, v: number) {
  draft.value = { ...draft.value, [field]: v }
  dirty.value = true
}
function undo() {
  dirty.value = false
  draft.value = { ...(day.view?.pomodoro || FALLBACK) }
}
async function submit() {
  const p = focusProblem(draft.value)
  if (p) {
    toast.warning(t(`day.problem.focus.${p.field}`, { min: day.num(p.min), max: day.num(p.max) }))
    return
  }
  if (await day.save({ pomodoro: clean() }, 'focus'))
    dirty.value = false
}
function startNow() {
  day.command('pomodoro', String(clean().work_min), t('day.focus.started'))
}
defineExpose({ focusKey: () => false })
</script>

<template>
  <tb-section :title="t('day.focus.title')" :description="t('day.focus.desc')">
    <template #actions>
      <tb-sync v-bind="day.syncOf('focus')" />
    </template>

    <view class="dfocus__plan" aria-hidden="true">
      <text class="tb-num dfocus__big">
        {{ day.num(draft.work_min || 0) }}
      </text>
      <text class="dfocus__unit">
        {{ t('day.focus.minWork') }}
      </text>
      <text class="tb-num dfocus__times">
        × {{ day.num(draft.rounds || 0) }}
      </text>
    </view>
    <text class="dnote">
      {{ t('day.focus.doneToday', { n: day.num(done) }) }}
    </text>

    <view class="dfocus__fields">
      <DayField v-for="f in FIELDS" :key="f" :label="t(`day.focus.${f}`)" :hint="t('day.focus.range', { min: day.num(FOCUS_LIMITS[f][0]), max: day.num(FOCUS_LIMITS[f][1]) })">
        <DayNumber
          :model-value="draft[f]" :min="FOCUS_LIMITS[f][0]" :max="FOCUS_LIMITS[f][1]" :aria-label="t(`day.focus.${f}`)"
          @update:model-value="(v: number) => edit(f, v)"
        />
      </DayField>
    </view>
    <text class="dnote">
      {{ t('day.focus.hint', { rounds: day.num(draft.rounds || 0) }) }}
    </text>

    <view class="dfoot">
      <tb-button icon="play" class="dfoot__left" :loading="day.busy === 'pomodoro'" :disabled="!!day.busy && day.busy !== 'pomodoro'" @click="startNow">
        {{ t('day.focus.startNow') }}
      </tb-button>
      <tb-button v-if="dirty" variant="quiet" @click="undo">
        {{ t('common.undo') }}
      </tb-button>
      <tb-button :variant="dirty ? 'primary' : 'secondary'" :disabled="!dirty" :loading="!!day.saving.focus" @click="submit">
        {{ t('common.save') }}
      </tb-button>
    </view>
    <text v-if="dirty" class="dfoot__unsaved" role="status">
      {{ t('common.unsaved') }}
    </text>
  </tb-section>
</template>

<style lang="scss">
.dfocus__plan {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.dfocus__big {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 56px;
  line-height: 1;
  letter-spacing: -0.02em;
}
.dfocus__unit {
  font-weight: 600;
  color: var(--tb-ink-2);
}
.dfocus__times {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 24px;
}
.dfocus__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 12px;
}
.dfocus__fields .dnum {
  width: 100%;
  justify-content: space-between;
}
.dfocus__fields .dnum__in {
  flex: 1;
  width: auto;
  min-width: 0;
}
</style>
