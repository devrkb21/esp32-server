<script lang="ts" setup>
import type { CompanionReminder, ReminderKind } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { asciiLabel, clampInt, MAX_LABEL, MAX_SAY, newReminder, removeById, stripReminder, upsertById } from '@/utils/companionUtils.mjs'
import { tbConfirm } from '@/utils/tbConfirm'
import { toast } from '@/utils/toast'
import { useDay } from '../dayContext'
import { daysText, EVERY_LIMITS, MAX_REMINDERS, reminderProblem } from '../dayModel.mjs'
import { onceDate } from '../dayVoiceModel.mjs'
import DayField from './DayField.vue'
import DayNumber from './DayNumber.vue'
import DayTime from './DayTime.vue'
import DayWeek from './DayWeek.vue'

// Reminders, one group per kind (water, medicine, other): every change sends the whole list.
const KINDS: ReminderKind[] = ['water', 'medicine', 'custom']
const KIND_ICON: Record<ReminderKind, string> = { water: 'reminder', medicine: 'heart', custom: 'edit' }

const day = useDay()
const reminders = computed<CompanionReminder[]>(() => day.view?.reminders || [])
const byKind = computed(() => {
  const groups: Record<ReminderKind, CompanionReminder[]> = { water: [], medicine: [], custom: [] }
  for (const r of reminders.value)
    (groups[r.kind] || groups.custom).push(r)
  return groups
})
const open = ref(false)
const draft = ref<CompanionReminder>(newReminder('water') as CompanionReminder)
const timeError = ref('')
const isNew = computed(() => !draft.value.id)
const focused = ref('')
const modeOptions = computed(() => [
  { value: 'interval', label: t('day.reminder.modeInterval') },
  { value: 'time', label: t('day.reminder.modeTime') },
])

function kindText(kind: string) { return t(`day.reminder.kind.${kind}`) }
function whenText(r: CompanionReminder) {
  const when = r.mode === 'interval'
    ? t('day.reminder.whenInterval', { every: day.num(r.every_min ?? 60), from: day.fmt(r.from), to: day.fmt(r.to) })
    : day.fmt(r.time)
  // a one-time reminder (a voice timer) rings on its date only
  const days = onceDate(r) ? t('dayVoice.once', { date: day.num(onceDate(r)) }) : daysText(r.days, (k: string) => t(k))
  return `${when}, ${days}`
}
function currentList(): CompanionReminder[] {
  return reminders.value.map(r => stripReminder(r) as CompanionReminder)
}

function openReminder(r?: CompanionReminder, kind: ReminderKind = 'custom') {
  if (!r && currentList().length >= MAX_REMINDERS) {
    toast.warning(t('day.reminder.max', { n: day.num(MAX_REMINDERS) }))
    return
  }
  // keep every field so switching the mode back and forth does not lose values
  const base = r ? { ...newReminder(r.kind), ...r } : newReminder(kind)
  const next = { every_min: 60, from: '09:00', to: '21:00', time: '21:00', ...base } as CompanionReminder
  delete next.say_audio
  draft.value = next
  timeError.value = ''
  open.value = true
}

// the OLED shows ASCII only: filter the label while typing
watch(() => draft.value.label, (label) => {
  const clean = asciiLabel(label)
  if (clean !== label)
    draft.value.label = clean
})

async function toggle(r: CompanionReminder, enabled: boolean) {
  const list = currentList().map(x => (x.id === r.id ? { ...x, enabled } : x))
  await day.save({ reminders: list }, 'reminders', enabled ? t('day.turnedOn') : t('day.turnedOff'))
}

async function submit() {
  const r = draft.value
  if (reminderProblem(r)) {
    timeError.value = t('day.problem.time')
    toast.warning(timeError.value)
    return
  }
  const item = stripReminder({
    ...r,
    label: asciiLabel(r.label).trim(),
    every_min: clampInt(r.every_min, EVERY_LIMITS[0], EVERY_LIMITS[1], 60),
    say: (r.say || '').trim().slice(0, MAX_SAY),
  }) as CompanionReminder
  if (await day.save({ reminders: upsertById(currentList(), item) as CompanionReminder[] }, 'reminders'))
    open.value = false
}

async function remove(r: CompanionReminder) {
  const ok = await tbConfirm({ title: t('day.reminder.deleteTitle'), message: t('day.reminder.confirmDelete'), confirmText: t('common.delete'), danger: true })
  if (!ok)
    return
  if (await day.save({ reminders: removeById(currentList(), r.id) as CompanionReminder[] }, 'reminders', t('day.deleted')))
    open.value = false
}

function focusKey(key: string) {
  const r = reminders.value.find(x => `r-${x.id}` === key)
  if (!r)
    return false
  focused.value = key
  setTimeout(() => { focused.value = '' }, 1600)
  openReminder(r)
  return true
}
defineExpose({ focusKey })
</script>

<template>
  <tb-section :title="t('day.tab.reminders')" :description="t('day.reminder.desc', { n: day.num(reminders.length), max: day.num(MAX_REMINDERS) })" ink="alarm">
    <template #actions>
      <tb-sync v-bind="day.syncOf('reminders')" />
    </template>

    <view v-for="k in KINDS" :key="k" class="dgroup">
      <view class="dgroup__head">
        <tb-icon :name="KIND_ICON[k]" :size="18" class="dgroup__icon" />
        <text class="dsub">
          {{ kindText(k) }}
        </text>
      </view>
      <view class="drows">
        <view v-for="r in byKind[k]" :key="r.id" class="drow" :class="{ 'is-off': !r.enabled, 'is-focus': focused === `r-${r.id}` }">
          <view class="drow__main" role="button" :aria-label="t('day.reminder.edit')" hover-class="is-press" @click="openReminder(r)">
            <view class="drow__body">
              <text class="drow__title">
                {{ r.label || kindText(r.kind) }}
              </text>
              <text class="drow__meta tb-num">
                {{ whenText(r) }}
              </text>
              <text v-if="r.say" class="drow__say">
                {{ r.say }}
              </text>
            </view>
          </view>
          <tb-switch
            :model-value="!!r.enabled" :disabled="!!day.saving.reminders" :label="t('day.reminder.switch', { name: r.label || kindText(r.kind) })"
            class="drow__switch" @change="(v: boolean) => toggle(r, v)"
          />
        </view>
        <view class="drow drow--add" role="button" hover-class="is-press" @click="openReminder(undefined, k)">
          <tb-icon name="plus" :size="18" />
          <text>{{ t('day.reminder.newKind', { kind: kindText(k) }) }}</text>
        </view>
      </view>
    </view>

    <tb-sheet v-model:open="open" :title="t(isNew ? 'day.reminder.newKind' : 'day.reminder.editKind', { kind: kindText(draft.kind) })">
      <DayField :label="t('day.reminder.mode')">
        <tb-choice v-model="draft.mode" :options="modeOptions" :aria-label="t('day.reminder.mode')" />
      </DayField>
      <template v-if="draft.mode === 'interval'">
        <DayField :label="t('day.reminder.every')" :hint="t('day.reminder.everyHint', { min: day.num(EVERY_LIMITS[0]), max: day.num(EVERY_LIMITS[1]) })">
          <DayNumber v-model="draft.every_min" :min="EVERY_LIMITS[0]" :max="EVERY_LIMITS[1]" :step="5" :aria-label="t('day.reminder.every')" />
        </DayField>
        <view class="drange">
          <DayField :label="t('day.reminder.from')" :error="timeError">
            <DayTime v-model="draft.from" :aria-label="t('day.reminder.from')" @change="timeError = ''" />
          </DayField>
          <DayField :label="t('day.reminder.to')">
            <DayTime v-model="draft.to" :aria-label="t('day.reminder.to')" @change="timeError = ''" />
          </DayField>
        </view>
      </template>
      <DayField v-else :label="t('day.reminder.time')" :error="timeError">
        <DayTime v-model="draft.time" big :aria-label="t('day.reminder.time')" @change="timeError = ''" />
      </DayField>
      <DayField :label="t('day.days.label')">
        <DayWeek v-model="draft.days" />
      </DayField>
      <DayField :label="t('day.labelField')" :hint="t('day.labelHint')">
        <tb-input v-model="draft.label" :maxlength="MAX_LABEL" clearable placeholder="Reminder" :aria-label="t('day.labelField')" />
      </DayField>
      <DayField :label="t('day.sayField')" :hint="t('day.sayHint')">
        <view class="dsay">
          <textarea v-model="draft.say" class="dsay__el" :maxlength="MAX_SAY" auto-height placeholder-class="dsay__ph" />
          <text class="dsay__count tb-num">
            {{ day.num((draft.say || '').length) }}/{{ day.num(MAX_SAY) }}
          </text>
        </view>
      </DayField>
      <tb-switch v-model="draft.enabled" :label="t('day.enabled')" />
      <template #footer>
        <tb-button v-if="!isNew" variant="danger" icon="trash" @click="remove(draft)">
          {{ t('common.delete') }}
        </tb-button>
        <tb-button variant="primary" :loading="!!day.saving.reminders" @click="submit">
          {{ t('common.save') }}
        </tb-button>
      </template>
    </tb-sheet>
  </tb-section>
</template>
