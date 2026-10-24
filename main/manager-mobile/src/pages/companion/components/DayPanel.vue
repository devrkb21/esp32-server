<script lang="ts" setup>
import type { RoutineActivity, RoutineItem, RoutineSettings } from '@/api/companion'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import {
  ACTIVITIES,
  ACTIVITY_ICON,
  createCanvas,
  createLiveliness,
  defaultRoutine,
  MAX_ROUTINE,
  MEALS,
  minuteOfDay,
  newRoutineItem,
  normalizeRoutine,
  renderActivityFrame,
  renderActivityStill,
  routineItemMinutes,
  routineItemProblem,
  routineOverlaps,
  routinePayload,
  routineProblem,
  sameRoutine,
  scheduledActivity,
  sortRoutine,
  toSvgDataUri,
} from '../faceLook.mjs'
import { useCompanion } from './context'

defineOptions({
  name: 'CompanionDayPanel',
})

const { dev, save } = useCompanion()

// OLED hardware colours (white pixels on a near-black panel), not theme tokens
const PIXEL_ON = '#f2f6fa'
const PIXEL_OFF = '#06080b'
const FRAME_MS = 50

const activities = ACTIVITIES as RoutineActivity[]
const icons = ACTIVITY_ICON as Record<string, string>

function copy(r: RoutineSettings): RoutineSettings {
  return { enabled: r.enabled, items: r.items.map(i => ({ ...i })) }
}

// The saved day and a local draft that follows it until edited
const serverDay = computed<RoutineSettings>(() => normalizeRoutine(dev.value?.settings?.routine) as RoutineSettings)
const form = ref<RoutineSettings>(copy(serverDay.value))
const dirty = computed(() => !sameRoutine(form.value, serverDay.value))
const isDefaultDay = computed(() => sameRoutine(form.value, { enabled: form.value.enabled, items: defaultRoutine().items }))
const saving = ref(false)

// a newer saved day (poll, other app) replaces the draft only while nothing is edited
watch(serverDay, (day, before) => {
  if (sameRoutine(form.value, before))
    form.value = copy(day)
})

function activityName(a: string | undefined) {
  if (!a)
    return '–'
  const key = `companion.routine.activity.${a}`
  const text = t(key)
  return text === key ? a : text
}

function durationText(item: RoutineItem) {
  const n = routineItemMinutes(item)
  const h = Math.floor(n / 60)
  const m = n % 60
  let text = t('companion.routine.durationMin', { n })
  if (h && m)
    text = t('companion.routine.durationHours', { h, m })
  else if (h)
    text = t('companion.routine.durationHoursOnly', { h })
  return minuteOfDay(item.end) < minuteOfDay(item.start) ? `${text} · ${t('companion.routine.nextDay')}` : text
}

// ---------------------------------------------------------------- now
const nowMinute = ref(0)
function tickMinute() {
  const d = new Date()
  nowMinute.value = d.getHours() * 60 + d.getMinutes()
}
tickMinute()

/** What the edited day has scheduled right now ('' = nothing or switched off) */
const nowActivity = computed(() => scheduledActivity(form.value, nowMinute.value) as RoutineActivity | '')
const nowIndex = computed(() => {
  if (!nowActivity.value)
    return -1
  const m = nowMinute.value
  return form.value.items.findIndex((item) => {
    const s = minuteOfDay(item.start)
    const e = minuteOfDay(item.end)
    return s < e ? m >= s && m < e : s > e && (m >= s || m < e)
  })
})
const doing = computed(() => {
  const a = dev.value?.stats?.activity
  return a ? String(a) : ''
})

const overlaps = computed(() => routineOverlaps(form.value.items) as [number, number][])
const overlapRows = computed(() => {
  const rows = new Set<number>()
  overlaps.value.forEach(([a, b]) => {
    rows.add(a)
    rows.add(b)
  })
  return rows
})

function overlapText([a, b]: [number, number]) {
  const items = form.value.items
  const label = (item: RoutineItem) => `${item.start}–${item.end} ${activityName(item.activity)}`
  return t('companion.routine.overlap', { a: label(items[a]), b: label(items[b]) })
}

/** Activity picked for the preview ('' = follow TinyBot / the schedule) */
const preview = ref<RoutineActivity | ''>('')

// ---------------------------------------------------------------- edit
const editorOpen = ref(false)
const editIndex = ref(-1)
const draft = ref<RoutineItem>({ start: '12:00', end: '12:30', activity: 'tea' })

const draftProblem = computed(() => {
  const code = routineItemProblem(draft.value)
  if (code === 'time')
    return t('companion.timeRequired')
  if (code === 'sameTime')
    return t('companion.routine.sameTime')
  if (code === 'activity')
    return t('companion.routine.badActivity')
  return ''
})
const draftNextDay = computed(() => minuteOfDay(draft.value.end) < minuteOfDay(draft.value.start))
const draftIsMeal = computed(() => (MEALS as string[]).includes(draft.value.activity))

function openEditor(index: number) {
  if (index < 0 && form.value.items.length >= MAX_ROUTINE) {
    toast.warning(t('companion.routine.tooMany', { max: MAX_ROUTINE }))
    return
  }
  editIndex.value = index
  draft.value = index < 0 ? newRoutineItem(form.value.items) as RoutineItem : { ...form.value.items[index] }
  editorOpen.value = true
}

function applyDraft() {
  if (draftProblem.value)
    return
  const item: RoutineItem = { start: draft.value.start, end: draft.value.end, activity: draft.value.activity }
  const items = form.value.items.slice()
  if (editIndex.value < 0)
    items.push(item)
  else
    items.splice(editIndex.value, 1, item)
  form.value = { ...form.value, items: sortRoutine(items) as RoutineItem[] }
  preview.value = item.activity
  editorOpen.value = false
}

function removeEdited() {
  if (editIndex.value < 0)
    return
  const items = form.value.items.slice()
  items.splice(editIndex.value, 1)
  form.value = { ...form.value, items }
  editorOpen.value = false
}

function setEnabled(enabled: boolean) {
  form.value = { ...form.value, enabled }
}

function undo() {
  form.value = copy(serverDay.value)
}

function resetDay() {
  form.value = { ...form.value, items: defaultRoutine().items as RoutineItem[] }
}

async function saveDay() {
  if (!dirty.value || saving.value)
    return
  const problem = routineProblem(form.value)
  if (problem) {
    toast.warning(problem.code === 'tooMany'
      ? t('companion.routine.tooMany', { max: MAX_ROUTINE })
      : problem.code === 'sameTime'
        ? t('companion.routine.sameTime')
        : problem.code === 'activity' ? t('companion.routine.badActivity') : t('companion.timeRequired'))
    return
  }
  saving.value = true
  // the server replaces the whole list
  const ok = await save({ settings: { routine: routinePayload(form.value) as RoutineSettings } }, t('companion.routine.saved'))
  saving.value = false
  if (ok)
    form.value = copy(serverDay.value)
}

// ---------------------------------------------------------------- preview
/** The picked activity, else what TinyBot shows now, else what is scheduled now */
const shown = computed<RoutineActivity>(() => {
  const busy = (activities as string[]).includes(doing.value) ? doing.value as RoutineActivity : ''
  return preview.value || busy || nowActivity.value || 'exercise'
})
const isMeal = computed(() => (MEALS as string[]).includes(shown.value))
const frameUri = ref('')
const frame = createCanvas()
const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
let live = createLiveliness(Math.random, Date.now())
let start = Date.now()
let timer: ReturnType<typeof setTimeout> | undefined
let minuteTimer: ReturnType<typeof setInterval> | undefined

function draw() {
  const now = Date.now()
  const look = dev.value?.settings?.look
  if (reducedMotion)
    renderActivityStill(shown.value, look, frame)
  else
    renderActivityFrame(shown.value, look, now - start, live, now, frame) // meals show the three foods in turn
  const uri = toSvgDataUri(frame, PIXEL_ON, PIXEL_OFF)
  if (uri !== frameUri.value)
    frameUri.value = uri
}

function loop() {
  if (typeof document === 'undefined' || !document.hidden)
    draw()
  timer = setTimeout(loop, FRAME_MS)
}

function pick(a: RoutineActivity) {
  preview.value = a
}

watch(shown, () => {
  start = Date.now()
  draw()
})

onMounted(() => {
  live = createLiveliness(Math.random, Date.now())
  start = Date.now()
  draw()
  if (!reducedMotion)
    timer = setTimeout(loop, FRAME_MS)
  minuteTimer = setInterval(tickMinute, 30000)
})

onBeforeUnmount(() => {
  if (timer)
    clearTimeout(timer)
  if (minuteTimer)
    clearInterval(minuteTimer)
  timer = undefined
  minuteTimer = undefined
})
</script>

<template>
  <view v-if="dev">
    <!-- Preview -->
    <view class="nx-card day__preview">
      <view v-if="doing" class="nx-badge nx-badge--success day__doing" role="status">
        <text aria-hidden="true">
          {{ icons[doing] || '•' }}
        </text>
        {{ t('companion.routine.nowDoing', { activity: activityName(doing) }) }}
      </view>
      <view class="day__bezel">
        <image
          class="day__screen"
          :src="frameUri"
          mode="widthFix"
          role="img"
          :aria-label="t('companion.routine.previewAlt', { activity: activityName(shown) })"
        />
      </view>
      <view class="day__picker" role="radiogroup" :aria-label="t('companion.routine.previewPick')">
        <view
          v-for="a in activities"
          :key="a"
          class="day__pick"
          :class="{ 'is-active': shown === a, 'is-now': nowActivity === a }"
          role="radio"
          :aria-checked="shown === a"
          @click="pick(a)"
        >
          <text class="day__pick-icon" aria-hidden="true">
            {{ icons[a] }}
          </text>
          <text class="nx-truncate">
            {{ activityName(a) }}
          </text>
        </view>
      </view>
      <view v-if="isMeal" class="nx-caption day__hint">
        {{ t('companion.routine.mealHint') }}
      </view>
      <view class="nx-caption day__hint">
        {{ nowActivity ? t('companion.routine.scheduledNow', { activity: activityName(nowActivity) }) : t('companion.routine.nothingNow') }}
      </view>
      <view class="nx-caption day__hint">
        {{ reducedMotion ? t('companion.routine.previewStatic') : t('companion.routine.previewHint') }}
      </view>
    </view>

    <!-- The day -->
    <view class="cmp-section-head">
      <view class="cmp-section-head__title">
        {{ t('companion.routine.title') }} · {{ form.items.length }}/{{ MAX_ROUTINE }}
      </view>
      <view v-if="form.items.length < MAX_ROUTINE" class="cmp-pill" role="button" @click="openEditor(-1)">
        <wd-icon name="add" size="14px" />
        {{ t('companion.routine.add') }}
      </view>
    </view>

    <view class="nx-group">
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('companion.routine.enabled') }}
            </view>
            <view class="nx-row__subtitle">
              {{ form.enabled ? t('companion.routine.desc') : t('companion.routine.offNote') }}
            </view>
          </view>
          <wd-switch :model-value="form.enabled" size="24px" @change="({ value }) => setEnabled(!!value)" />
        </view>
      </view>
    </view>

    <view v-if="!form.items.length" class="nx-empty day__empty">
      <view class="nx-icon-tile nx-icon-tile--lg">
        <wd-icon name="calendar" size="28px" />
      </view>
      <view class="nx-empty__title">
        {{ t('companion.routine.empty') }}
      </view>
      <view class="nx-empty__text">
        {{ t('companion.routine.emptyText') }}
      </view>
    </view>

    <view v-else class="nx-group">
      <view class="nx-group__body">
        <view
          v-for="(item, i) in form.items"
          :key="`${i}-${item.start}-${item.activity}`"
          class="nx-row nx-row--tap day__row"
          :class="{ 'is-off': !form.enabled, 'is-now': i === nowIndex, 'is-shown': item.activity === shown }"
          role="button"
          :aria-label="`${item.start}–${item.end} ${activityName(item.activity)}`"
          @click="openEditor(i)"
        >
          <view class="day__icon" aria-hidden="true">
            {{ icons[item.activity] }}
          </view>
          <view class="nx-row__main">
            <view class="nx-row__title nx-truncate">
              {{ activityName(item.activity) }}
            </view>
            <view class="nx-row__subtitle">
              {{ durationText(item) }}
              <text v-if="overlapRows.has(i)" class="day__warn">
                · {{ t('companion.routine.overlapShort') }}
              </text>
            </view>
          </view>
          <view class="day__time nx-num">
            <view v-if="i === nowIndex" class="nx-badge nx-badge--success">
              {{ t('companion.routine.now') }}
            </view>
            {{ item.start }}–{{ item.end }}
          </view>
        </view>
      </view>
    </view>

    <view v-for="pair in overlaps" :key="`o${pair[0]}-${pair[1]}`" class="day__overlap" role="status">
      {{ overlapText(pair) }}
    </view>

    <view class="nx-caption day__note">
      {{ t('companion.routine.note') }}
    </view>
    <view class="nx-caption day__note">
      {{ t('companion.routine.voiceNote') }}
    </view>

    <view class="day__actions">
      <view v-if="dirty" class="day__unsaved" role="status">
        {{ t('companion.routine.unsaved') }}
      </view>
      <wd-button block :loading="saving" :disabled="!dirty" @click="saveDay">
        {{ t('companion.routine.save') }}
      </wd-button>
      <wd-button v-if="dirty" type="info" plain block :disabled="saving" @click="undo">
        {{ t('companion.routine.undo') }}
      </wd-button>
      <wd-button type="info" plain block :disabled="isDefaultDay || saving" @click="resetDay">
        {{ t('companion.routine.reset') }}
      </wd-button>
    </view>

    <!-- Edit sheet -->
    <wd-popup v-model="editorOpen" position="bottom" safe-area-inset-bottom :z-index="100" custom-class="cmp-sheet">
      <view class="cmp-sheet__inner">
        <view class="cmp-sheet__handle" />
        <view class="cmp-sheet__header">
          <view class="cmp-sheet__title">
            {{ editIndex < 0 ? t('companion.routine.add') : t('companion.routine.edit') }}
          </view>
          <view class="cmp-sheet__close" role="button" :aria-label="t('common.cancel')" @click="editorOpen = false">
            <wd-icon name="close" size="18px" />
          </view>
        </view>

        <view class="nx-group">
          <view class="nx-group__body">
            <wd-datetime-picker
              v-model="draft.start"
              type="time"
              :label="t('companion.routine.start')"
              :cancel-button-text="t('common.cancel')"
              :confirm-button-text="t('common.confirm')"
              custom-class="cmp-picker"
            />
            <wd-datetime-picker
              v-model="draft.end"
              type="time"
              :label="t('companion.routine.end')"
              :cancel-button-text="t('common.cancel')"
              :confirm-button-text="t('common.confirm')"
              custom-class="cmp-picker"
            />
          </view>
        </view>
        <view v-if="draftProblem" class="day__error" role="alert">
          {{ draftProblem }}
        </view>
        <view v-else-if="draftNextDay" class="nx-caption day__sheet-hint">
          {{ t('companion.routine.nextDayHint') }}
        </view>

        <view class="cmp-field">
          <view class="cmp-field__label">
            {{ t('companion.routine.activityLabel') }}
          </view>
          <view class="day__picker" role="radiogroup" :aria-label="t('companion.routine.activityLabel')">
            <view
              v-for="a in activities"
              :key="a"
              class="day__pick"
              :class="{ 'is-active': draft.activity === a }"
              role="radio"
              :aria-checked="draft.activity === a"
              @click="draft.activity = a"
            >
              <text class="day__pick-icon" aria-hidden="true">
                {{ icons[a] }}
              </text>
              <text class="nx-truncate">
                {{ activityName(a) }}
              </text>
            </view>
          </view>
          <view v-if="draftIsMeal" class="cmp-field__help">
            {{ t('companion.routine.mealHint') }}
          </view>
        </view>

        <view class="cmp-sheet__actions">
          <wd-button block size="large" :disabled="!!draftProblem" @click="applyDraft">
            {{ t('companion.routine.apply') }}
          </wd-button>
          <view v-if="editIndex >= 0" class="cmp-sheet__delete" role="button" @click="removeEdited">
            {{ t('companion.routine.remove') }}
          </view>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style lang="scss" scoped>
.day {
  &__preview {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-3);
    margin-bottom: var(--nx-space-4);
  }

  &__doing {
    align-self: flex-start;
    gap: 8rpx;
  }

  &__bezel {
    padding: var(--nx-space-2);
    border-radius: var(--nx-radius-lg);
    background: #15181d; // robot bezel, hardware colour
  }

  &__screen {
    display: block;
    width: 100%;
    border-radius: var(--nx-radius-sm);
    background: #06080b;
    image-rendering: pixelated;
  }

  &__picker {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--nx-space-2);
  }

  &__pick {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8rpx;
    min-width: 0;
    min-height: var(--nx-touch);
    padding: 0 var(--nx-space-2);
    box-sizing: border-box;
    border-radius: var(--nx-radius);
    background: var(--nx-surface-3);
    color: var(--nx-text-2);
    font-size: var(--nx-text-footnote);
    font-weight: 500;

    &.is-active {
      background: var(--nx-accent-soft);
      color: var(--nx-accent);
      font-weight: 600;
    }

    // scheduled right now: a small dot
    &.is-now::after {
      content: '';
      position: absolute;
      top: 8rpx;
      right: 8rpx;
      width: 12rpx;
      height: 12rpx;
      border-radius: 50%;
      background: var(--nx-success);
    }
  }

  &__pick-icon {
    flex: none;
    font-size: 30rpx;
    line-height: 1;
  }

  &__hint {
    line-height: 1.4;
  }

  &__empty {
    padding-top: var(--nx-space-4);
  }

  &__row {
    &.is-shown {
      background: var(--nx-accent-soft);
    }

    &.is-off .nx-row__title,
    &.is-off .day__time {
      color: var(--nx-text-3);
    }

    &.is-now .day__time {
      color: var(--nx-success);
    }
  }

  &__icon {
    flex: none;
    width: 56rpx;
    font-size: 36rpx;
    line-height: 1;
    text-align: center;
  }

  &__time {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: flex-end;
    gap: 4rpx;
    font-size: var(--nx-text-callout);
    font-weight: 500;
    color: var(--nx-text);
  }

  &__warn {
    color: var(--nx-warning);
    font-weight: 600;
  }

  &__overlap {
    margin-bottom: var(--nx-space-2);
    padding: var(--nx-space-2) var(--nx-space-3);
    border-radius: var(--nx-radius);
    background: var(--nx-warning-soft);
    color: var(--nx-text);
    font-size: var(--nx-text-footnote);
    line-height: 1.4;
  }

  &__note {
    margin-bottom: var(--nx-space-2);
    padding: 0 var(--nx-space-2);
    line-height: 1.4;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-2);
    margin-top: var(--nx-space-3);
  }

  &__unsaved {
    font-size: var(--nx-text-caption);
    font-weight: 600;
    color: var(--nx-warning);
    text-align: center;
  }

  &__error {
    margin: calc(var(--nx-space-2) * -1) 0 var(--nx-space-3);
    padding: 0 var(--nx-space-1);
    font-size: var(--nx-text-footnote);
    color: var(--nx-danger);
  }

  &__sheet-hint {
    margin: calc(var(--nx-space-2) * -1) 0 var(--nx-space-3);
    padding: 0 var(--nx-space-1);
  }
}
</style>
