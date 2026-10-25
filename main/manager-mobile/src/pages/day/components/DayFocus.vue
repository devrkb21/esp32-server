<script lang="ts" setup>
import type { PomodoroConfig } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { clampInt } from '@/utils/companionUtils.mjs'
import { toast } from '@/utils/toast'
import { useDay } from '../dayContext'
import { FOCUS_LIMITS, FOCUS_PRESETS, focusPick, focusProblem, pickedMinutes } from '../dayModel.mjs'
import DayField from './DayField.vue'
import DayNumber from './DayNumber.vue'

// Focus timer (pomodoro). Top: how long, as preset chips or any 1..120 minutes typed (Bangla
// digits too), "Start now" (the pomodoro command with those minutes) and "make it the default"
// (pomodoro.work_min: what the robot's own focus page, the tap shortcut and Today's chip use).
// Below: rounds and breaks, saved as { pomodoro: {...} }.
const FIELDS = ['rounds', 'short_break_min', 'long_break_min'] as const
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

// ------------------------------------------------------------------ how long, start now
const savedWork = computed(() => {
  const w = Number(day.view?.pomodoro?.work_min)
  return Number.isInteger(w) && w > 0 ? w : 25
})
const pick = ref<{ choice: number | 'custom', custom: string }>({ choice: 25, custom: '' })
// the owner changed the minutes: a poll must not put the saved ones back
const touched = ref(false)
function resetPick() {
  const p = focusPick(savedWork.value)
  pick.value = { choice: p.choice, custom: p.custom ? day.num(Number(p.custom)) : '' }
}
watch(savedWork, () => {
  if (!touched.value)
    resetPick()
}, { immediate: true })
const chosen = computed(() => pickedMinutes(pick.value.choice, pick.value.custom))
const presets = computed(() => FOCUS_PRESETS.map((n: number) => ({ value: n, label: t('day.focus.preset', { n: day.num(n) }) })))
const badCustom = computed(() => pick.value.choice === 'custom' && pick.value.custom !== '' && chosen.value === null)
const line = computed(() => {
  if (chosen.value === null)
    return t('day.focus.customRange')
  return chosen.value === savedWork.value ? t('day.focus.isDefault') : t('day.focus.defaultIs', { n: day.num(savedWork.value) })
})

function pickPreset(n: number) {
  touched.value = true
  pick.value = { choice: n, custom: '' }
}
function typeCustom(e: any) {
  touched.value = true
  pick.value = { choice: 'custom', custom: String(e?.detail?.value ?? '') }
}
function startNow() {
  const n = chosen.value
  if (n === null || day.busy)
    return
  day.command('pomodoro', String(n), t('day.focus.startedN', { n: day.num(n) }), 'pomodoro')
}
/** Saves the chosen minutes as pomodoro.work_min, keeping any unsaved round/break edits. */
async function saveDefault() {
  const n = chosen.value
  if (n === null)
    return
  if (await day.save({ pomodoro: { work_min: n } }, 'focus', t('day.focus.defaultSaved', { n: day.num(n) }))) {
    draft.value = { ...draft.value, work_min: n }
    touched.value = false
  }
}

// ------------------------------------------------------------------ rounds and breaks
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
defineExpose({ focusKey: () => false })
</script>

<template>
  <tb-section :title="t('day.focus.title')" :description="t('day.focus.desc')">
    <template #actions>
      <tb-sync v-bind="day.syncOf('focus')" />
    </template>

    <view class="dfocus__now">
      <view class="dfocus__plan" aria-live="polite">
        <text class="tb-num dfocus__big">
          {{ chosen === null ? '?' : day.num(chosen) }}
        </text>
        <text class="dfocus__unit">
          {{ t('day.focus.minutes') }}
        </text>
      </view>
      <text class="dnote">
        {{ t('day.focus.doneToday', { n: day.num(done) }) }}
      </text>

      <view class="dfocus__pick" role="group" :aria-label="t('day.focus.howLong')">
        <tb-choice wrap :model-value="pick.choice" :options="presets" :aria-label="t('day.focus.howLong')" @change="pickPreset" />
        <view class="dfocus__other">
          <input
            class="dfocus__custom" :class="{ 'is-on': pick.choice === 'custom' && pick.custom !== '', 'is-bad': badCustom }"
            type="text" inputmode="numeric" :maxlength="3" confirm-type="go"
            :value="pick.custom" :placeholder="t('day.focus.custom')" :aria-label="t('day.focus.customLabel')"
            @input="typeCustom" @confirm="startNow"
          >
          <text class="dfocus__otherunit">
            {{ t('day.focus.minutes') }}
          </text>
        </view>
      </view>
      <text class="dnote" :class="{ 'is-bad': chosen === null }">
        {{ line }}
      </text>

      <view class="dfocus__go">
        <tb-button
          variant="primary" icon="play" block :loading="day.busy === 'pomodoro'"
          :disabled="chosen === null || (!!day.busy && day.busy !== 'pomodoro')" @click="startNow"
        >
          {{ t('day.focus.startNow') }}
        </tb-button>
        <tb-button v-if="chosen !== null && chosen !== savedWork" block :loading="!!day.saving.focus" @click="saveDefault">
          {{ t('day.focus.makeDefault', { n: day.num(chosen) }) }}
        </tb-button>
      </view>
    </view>

    <text class="dfocus__sub">
      {{ t('day.focus.roundsTitle') }}
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
.dfocus__now {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 20px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--tb-rule);
}
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
.dfocus__pick {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dfocus__other {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dfocus__otherunit {
  font-weight: 600;
  color: var(--tb-ink-2);
}
.dfocus__custom {
  width: 96px;
  height: 44px;
  padding: 0 12px;
  box-sizing: border-box;
  border: 1.5px solid var(--tb-ink-3);
  border-radius: 999px;
  background: var(--tb-paper);
  color: var(--tb-ink);
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}
.dfocus__custom.is-on {
  border-color: var(--tb-ink);
}
.dfocus__custom.is-bad {
  border-color: var(--tb-danger);
}
.dnote.is-bad {
  color: var(--tb-danger);
}
.dfocus__go {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dfocus__sub {
  display: block;
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 16px;
  padding-bottom: 8px;
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
