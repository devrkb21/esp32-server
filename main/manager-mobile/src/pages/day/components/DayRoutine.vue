<script lang="ts" setup>
import type { RoutineItem, RoutineSettings } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import {
  ACTIVITIES,
  defaultRoutine,
  MAX_ROUTINE,
  MEALS,
  minuteOfDay,
  newRoutineItem,
  normalizeRoutine,
  routineItemMinutes,
  routineItemProblem,
  routineOverlaps,
  routinePayload,
  routineProblem,
  sameRoutine,
  scheduledActivity,
  sortRoutine,
} from '../../companion/faceLook.mjs'
import { useDay } from '../dayContext'
import { nowIndex, previewActivity, routineOfKey } from '../dayModel.mjs'
import DayField from './DayField.vue'
import DayScreen from './DayScreen.vue'
import DayTime from './DayTime.vue'

// TinyBot's own day (settings.routine): a local draft that follows the saved day until edited,
// sent as the whole sorted list with Save (legacy). The preview plays the picked activity.
const day = useDay()

function copy(r: RoutineSettings): RoutineSettings {
  return { enabled: r.enabled, items: r.items.map(i => ({ ...i })) }
}
const serverDay = computed<RoutineSettings>(() => normalizeRoutine(day.view?.settings?.routine) as RoutineSettings)
const form = ref<RoutineSettings>(copy(serverDay.value))
const dirty = computed(() => !sameRoutine(form.value, serverDay.value))
const isDefaultDay = computed(() => sameRoutine(form.value, { enabled: form.value.enabled, items: defaultRoutine().items }))
// a newer saved day (poll, another phone) replaces the draft only while nothing is edited
watch(serverDay, (d, before) => {
  if (sameRoutine(form.value, before))
    form.value = copy(d)
})

const items = computed(() => form.value.items)
const scheduled = computed(() => scheduledActivity(form.value, day.minute) as string)
const nowRow = computed(() => nowIndex(form.value, day.minute))
const picked = ref('')
const playing = ref(false)
const screen = ref<any>(null)
const preview = computed(() => previewActivity(picked.value, day.view?.stats, form.value, day.minute) as string)
const overlaps = computed(() => routineOverlaps(items.value) as [number, number][])
const overlapRows = computed(() => new Set(overlaps.value.flat()))
const activityOptions = computed(() => (ACTIVITIES as string[]).map(a => ({ value: a, label: activityName(a) })))
const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function activityName(a: string) { return t(`day.activity.${a}`) }
function isMeal(a: string) { return (MEALS as string[]).includes(a) }
function duration(item: RoutineItem) {
  const n = routineItemMinutes(item)
  const h = Math.floor(n / 60)
  const m = n % 60
  let text = t('day.routine.durationMin', { n: day.num(n) })
  if (h && m)
    text = t('day.routine.durationHours', { h: day.num(h), m: day.num(m) })
  else if (h)
    text = t('day.routine.durationHoursOnly', { h: day.num(h) })
  return minuteOfDay(item.end) < minuteOfDay(item.start) ? `${text}, ${t('day.routine.nextDay')}` : text
}
function overlapText([a, b]: [number, number]) {
  const label = (item: RoutineItem) => `${day.fmt(item.start)} ${t('day.to')} ${day.fmt(item.end)} ${activityName(item.activity)}`
  return t('day.routine.overlap', { a: label(items.value[a]), b: label(items.value[b]) })
}

// ---------------------------------------------------------------- the sheet
const open = ref(false)
const editIndex = ref(-1)
const draft = ref<RoutineItem>({ start: '12:00', end: '12:30', activity: 'tea' })
const draftProblem = computed(() => {
  const code = routineItemProblem(draft.value)
  if (code === 'time')
    return t('day.problem.time')
  if (code === 'sameTime')
    return t('day.problem.sameTime')
  if (code === 'activity')
    return t('day.problem.activity')
  return ''
})
const draftNextDay = computed(() => minuteOfDay(draft.value.end) < minuteOfDay(draft.value.start))

function openItem(index: number) {
  if (index < 0 && items.value.length >= MAX_ROUTINE) {
    toast.warning(t('day.problem.tooMany', { max: day.num(MAX_ROUTINE) }))
    return
  }
  editIndex.value = index
  draft.value = index < 0 ? newRoutineItem(items.value) as RoutineItem : { ...items.value[index] }
  open.value = true
}
function applyItem() {
  if (draftProblem.value)
    return
  const item: RoutineItem = { start: draft.value.start, end: draft.value.end, activity: draft.value.activity }
  const list = items.value.slice()
  if (editIndex.value < 0)
    list.push(item)
  else list.splice(editIndex.value, 1, item)
  form.value = { ...form.value, items: sortRoutine(list) as RoutineItem[] }
  picked.value = item.activity
  open.value = false
}
function removeItem() {
  if (editIndex.value < 0)
    return
  const list = items.value.slice()
  list.splice(editIndex.value, 1)
  form.value = { ...form.value, items: list }
  open.value = false
}

function setEnabled(enabled: boolean) { form.value = { ...form.value, enabled } }
function undo() { form.value = copy(serverDay.value) }
function resetDay() { form.value = { ...form.value, items: defaultRoutine().items as RoutineItem[] } }

async function saveDay() {
  if (!dirty.value || day.saving.routine)
    return
  const problem = routineProblem(form.value)
  if (problem) {
    toast.warning(problem.code === 'tooMany'
      ? t('day.problem.tooMany', { max: day.num(MAX_ROUTINE) })
      : problem.code === 'sameTime'
        ? t('day.problem.sameTime')
        : problem.code === 'activity' ? t('day.problem.activity') : t('day.problem.time'))
    return
  }
  // the server replaces the whole list
  if (await day.save({ settings: { routine: routinePayload(form.value) as RoutineSettings } }, 'routine', t('day.routine.saved')))
    form.value = copy(serverDay.value)
}

function focusKey(key: string) {
  const want = routineOfKey(key)
  if (!want)
    return false
  const i = items.value.findIndex(it => it.start === want.start && it.activity === want.activity)
  if (i < 0)
    return false
  picked.value = want.activity
  openItem(i)
  return true
}
defineExpose({ focusKey })
</script>

<template>
  <tb-section :title="t('day.routine.title')" :description="t('day.routine.desc')" ink="routine">
    <template #actions>
      <tb-sync v-bind="day.syncOf('routine')" />
    </template>

    <view class="droutine__preview">
      <DayScreen
        ref="screen" class="droutine__screen" :activity="preview" :look="day.view?.settings?.look" animate
        :alt="t('day.screenAlt', { activity: activityName(preview) })" @playing="(v: boolean) => playing = v"
      />
      <view class="droutine__under">
        <text class="dnote">
          {{ scheduled ? t('day.routine.scheduledNow', { activity: activityName(scheduled) }) : t('day.routine.nothingNow') }}
        </text>
        <tb-button size="s" icon="play" :disabled="playing || reduced" @click="screen?.replay()">
          {{ t('day.routine.replay') }}
        </tb-button>
      </view>
      <DayField :label="t('day.routine.previewPick')">
        <tb-choice :model-value="preview" :options="activityOptions" :aria-label="t('day.routine.previewPick')" @change="(a: string) => picked = a" />
      </DayField>
      <text v-if="isMeal(preview)" class="dnote">
        {{ t('day.routine.mealHint') }}
      </text>
      <text v-if="reduced" class="dnote">
        {{ t('day.routine.previewStatic') }}
      </text>
    </view>

    <view class="dbar">
      <tb-switch :model-value="form.enabled" :label="t('day.routine.enabled')" @change="setEnabled" />
      <text class="tb-num dcount">
        {{ t('day.countOf', { n: day.num(items.length), max: day.num(MAX_ROUTINE) }) }}
      </text>
    </view>
    <text v-if="!form.enabled" class="dnote">
      {{ t('day.routine.offNote') }}
    </text>

    <tb-empty v-if="!items.length" face="sleepy" :title="t('day.routine.empty')" :text="t('day.routine.emptyText')" />
    <view v-else class="drows" :class="{ 'is-dim': !form.enabled }">
      <view
        v-for="(item, i) in items" :key="`${i}-${item.start}-${item.activity}`" class="drow drow--routine"
        :class="{ 'is-now': i === nowRow && form.enabled, 'is-shown': item.activity === preview }"
        role="button" hover-class="is-press" @click="openItem(i)"
      >
        <text class="tb-num drow__span">
          {{ day.fmt(item.start) }}–{{ day.fmt(item.end) }}
        </text>
        <view class="drow__body">
          <text class="drow__title">
            <text class="drow__mark" />{{ activityName(item.activity) }}
          </text>
          <text class="drow__meta">
            {{ duration(item) }}<text v-if="overlapRows.has(i)" class="drow__warn">{{ ', ' }}{{ t('day.routine.overlapShort') }}
            </text>
          </text>
        </view>
        <tb-tag v-if="i === nowRow && form.enabled" ink="action">
          {{ t('common.now') }}
        </tb-tag>
      </view>
    </view>

    <view v-for="pair in overlaps" :key="`o${pair[0]}-${pair[1]}`" class="dwarn" role="status">
      <tb-icon name="warning" :size="16" /><text>{{ overlapText(pair) }}</text>
    </view>
    <text class="dnote">
      {{ t('day.routine.note') }}
    </text>
    <text class="dnote">
      {{ t('day.routine.voiceNote') }}
    </text>

    <view class="dfoot">
      <tb-button size="s" variant="quiet" icon="refresh" class="dfoot__left" :disabled="isDefaultDay || !!day.saving.routine" @click="resetDay">
        {{ t('day.routine.reset') }}
      </tb-button>
      <tb-button size="s" icon="plus" :disabled="items.length >= MAX_ROUTINE" @click="openItem(-1)">
        {{ t('day.routine.add') }}
      </tb-button>
    </view>
    <view class="dfoot">
      <text v-if="dirty" class="dfoot__unsaved" role="status">
        {{ t('common.unsaved') }}
      </text>
      <tb-button v-if="dirty" variant="quiet" :disabled="!!day.saving.routine" @click="undo">
        {{ t('common.undo') }}
      </tb-button>
      <tb-button :variant="dirty ? 'primary' : 'secondary'" :disabled="!dirty" :loading="!!day.saving.routine" @click="saveDay">
        {{ t('common.save') }}
      </tb-button>
    </view>

    <tb-sheet v-model:open="open" :title="editIndex < 0 ? t('day.routine.add') : t('day.routine.edit')">
      <view class="drange">
        <DayField :label="t('day.routine.start')">
          <DayTime v-model="draft.start" :aria-label="t('day.routine.start')" />
        </DayField>
        <DayField :label="t('day.routine.end')">
          <DayTime v-model="draft.end" :aria-label="t('day.routine.end')" />
        </DayField>
      </view>
      <text v-if="draftProblem" class="dfield__error" role="alert">
        {{ draftProblem }}
      </text>
      <text v-else-if="draftNextDay" class="dnote">
        {{ t('day.routine.nextDayHint') }}
      </text>
      <DayField :label="t('day.routine.activityLabel')" :hint="isMeal(draft.activity) ? t('day.routine.mealHint') : ''">
        <tb-choice v-model="draft.activity" wrap :options="activityOptions" :aria-label="t('day.routine.activityLabel')" />
      </DayField>
      <template #footer>
        <tb-button v-if="editIndex >= 0" variant="danger" icon="trash" @click="removeItem">
          {{ t('day.routine.removeShort') }}
        </tb-button>
        <tb-button variant="primary" :disabled="!!draftProblem" @click="applyItem">
          {{ t('day.routine.apply') }}
        </tb-button>
      </template>
    </tb-sheet>
  </tb-section>
</template>

<style lang="scss">
.droutine__preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.droutine__screen {
  width: 100%;
  max-width: 320px;
}
.droutine__under {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.drow--routine {
  align-items: center;
}
.drow__span {
  flex: none;
  min-width: 7.6em;
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--tb-routine);
  white-space: nowrap;
}
.drow__mark {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 8px;
  background: var(--tb-routine-mark);
  vertical-align: 1px;
}
.drow__warn {
  color: var(--tb-warn);
  font-weight: 600;
}
.drow--routine.is-now {
  border-top: 2px solid var(--tb-orange);
}
.drow--routine.is-shown .drow__title {
  text-decoration: underline;
  text-decoration-color: var(--tb-routine-mark);
  text-underline-offset: 4px;
}
/* the routine switched off: rows read in the third ink, not faded (contrast floor) */
.drows.is-dim .drow--routine .drow__span,
.drows.is-dim .drow--routine .drow__title,
.drows.is-dim .drow--routine .drow__meta {
  color: var(--tb-ink-3);
}
.dwarn {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 13px;
  color: var(--tb-warn);
}
.dwarn .tb-icon {
  margin-top: 3px;
}
</style>
