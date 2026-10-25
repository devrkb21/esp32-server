<script lang="ts" setup>
import type { CompanionAlarm } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { asciiLabel, clampInt, isHHMM, MAX_LABEL, MAX_SAY, newAlarm, removeById, sortByTime, stripAlarm, upsertById } from '@/utils/companionUtils.mjs'
import { tbConfirm } from '@/utils/tbConfirm'
import { toast } from '@/utils/toast'
import { useDay } from '../dayContext'
import { daysText, MAX_ALARMS, SNOOZE_LIMITS } from '../dayModel.mjs'
import DayField from './DayField.vue'
import DayNumber from './DayNumber.vue'
import DayTime from './DayTime.vue'
import DayWeek from './DayWeek.vue'

// Alarms: every change sends the whole list (legacy rule), without server-only fields.
const day = useDay()
const alarms = computed<CompanionAlarm[]>(() => day.view?.alarms || [])
const sorted = computed(() => sortByTime(alarms.value) as CompanionAlarm[])
const open = ref(false)
const draft = ref<CompanionAlarm>(newAlarm() as CompanionAlarm)
const timeError = ref('')
const isNew = computed(() => !draft.value.id)
const focused = ref('')

function currentList(): CompanionAlarm[] {
  return alarms.value.map(a => stripAlarm(a) as CompanionAlarm)
}
function days(mask: number) {
  return daysText(mask, (k: string) => t(k))
}
function meta(a: CompanionAlarm) {
  return a.snooze_min ? `${days(a.days)}, ${t('day.alarm.snoozeShort', { min: day.num(a.snooze_min) })}` : days(a.days)
}

function openAlarm(a?: CompanionAlarm) {
  if (!a && currentList().length >= MAX_ALARMS) {
    toast.warning(t('day.alarm.max', { n: day.num(MAX_ALARMS) }))
    return
  }
  draft.value = (a ? stripAlarm(a) : newAlarm()) as CompanionAlarm
  timeError.value = ''
  open.value = true
}

// the OLED shows ASCII only: filter the label while typing
watch(() => draft.value.label, (label) => {
  const clean = asciiLabel(label)
  if (clean !== label)
    draft.value.label = clean
})

async function toggle(a: CompanionAlarm, enabled: boolean) {
  const list = currentList().map(x => (x.id === a.id ? { ...x, enabled } : x))
  await day.save({ alarms: list }, 'alarms', enabled ? t('day.alarm.onMsg') : t('day.alarm.offMsg'))
}

async function submit() {
  const a = draft.value
  if (!isHHMM(a.time)) {
    timeError.value = t('day.problem.time')
    toast.warning(timeError.value)
    return
  }
  const item = stripAlarm({
    ...a,
    label: asciiLabel(a.label).trim(),
    snooze_min: clampInt(a.snooze_min, SNOOZE_LIMITS[0], SNOOZE_LIMITS[1], 5),
    say: (a.say || '').trim().slice(0, MAX_SAY),
  }) as CompanionAlarm
  if (await day.save({ alarms: upsertById(currentList(), item) as CompanionAlarm[] }, 'alarms'))
    open.value = false
}

async function remove(a: CompanionAlarm) {
  const ok = await tbConfirm({ title: t('day.alarm.deleteTitle'), message: t('day.alarm.confirmDelete', { time: day.fmt(a.time) }), confirmText: t('common.delete'), danger: true })
  if (!ok)
    return
  if (await day.save({ alarms: removeById(currentList(), a.id) as CompanionAlarm[] }, 'alarms', t('day.deleted')))
    open.value = false
}

/** Opens the alarm of a row key (a-<id>) from the day table or Today. */
function focusKey(key: string) {
  const a = alarms.value.find(x => `a-${x.id}` === key)
  if (!a)
    return false
  focused.value = key
  setTimeout(() => { focused.value = '' }, 1600)
  openAlarm(a)
  return true
}
defineExpose({ focusKey, add: () => openAlarm() })
</script>

<template>
  <tb-section :title="t('day.tab.alarms')" :description="t('day.alarm.desc', { n: day.num(alarms.length), max: day.num(MAX_ALARMS) })" ink="alarm">
    <template #actions>
      <tb-sync v-bind="day.syncOf('alarms')" />
    </template>

    <tb-empty v-if="!alarms.length" face="sleepy" :title="t('day.alarm.none')" :text="t('day.alarm.emptyText')" />
    <view v-else class="drows">
      <view v-for="a in sorted" :key="a.id" class="drow" :class="{ 'is-off': !a.enabled, 'is-focus': focused === `a-${a.id}` }">
        <view class="drow__main" role="button" :aria-label="t('day.alarm.edit')" hover-class="is-press" @click="openAlarm(a)">
          <text class="tb-num drow__time">
            <text v-if="day.part(a.time)" class="drow__part">
              {{ day.part(a.time) }}
            </text>{{ day.clock(a.time) }}
          </text>
          <view class="drow__body">
            <text class="drow__title">
              {{ a.label || t('day.alarm.defaultLabel') }}
            </text>
            <text class="drow__meta">
              {{ meta(a) }}
            </text>
            <text v-if="a.say" class="drow__say">
              {{ a.say }}
            </text>
          </view>
        </view>
        <tb-switch
          :model-value="!!a.enabled" :disabled="!!day.saving.alarms" :label="t('day.alarm.switch', { time: day.fmt(a.time) })"
          class="drow__switch" @change="(v: boolean) => toggle(a, v)"
        />
      </view>
    </view>
    <view class="dfoot">
      <tb-button variant="primary" icon="plus" :disabled="alarms.length >= MAX_ALARMS" @click="openAlarm()">
        {{ t('day.alarm.add') }}
      </tb-button>
    </view>

    <tb-sheet v-model:open="open" :title="isNew ? t('day.alarm.add') : t('day.alarm.edit')">
      <DayField :label="t('day.alarm.time')" :error="timeError">
        <DayTime v-model="draft.time" big :aria-label="t('day.alarm.time')" @change="timeError = ''" />
      </DayField>
      <DayField :label="t('day.days.label')">
        <DayWeek v-model="draft.days" />
      </DayField>
      <DayField :label="t('day.labelField')" :hint="t('day.labelHint')">
        <tb-input v-model="draft.label" :maxlength="MAX_LABEL" clearable placeholder="Wake up" :aria-label="t('day.labelField')" />
      </DayField>
      <DayField :label="t('day.sayField')" :hint="t('day.sayHint')">
        <view class="dsay">
          <textarea v-model="draft.say" class="dsay__el" :maxlength="MAX_SAY" auto-height :placeholder="t('day.alarm.sayPlaceholder')" placeholder-class="dsay__ph" />
          <text class="tb-num dsay__count">
            {{ day.num((draft.say || '').length) }}/{{ day.num(MAX_SAY) }}
          </text>
        </view>
      </DayField>
      <view class="dpair">
        <DayField :label="t('day.alarm.snooze')" :hint="t('day.alarm.snoozeHint')">
          <DayNumber v-model="draft.snooze_min" :min="SNOOZE_LIMITS[0]" :max="SNOOZE_LIMITS[1]" :aria-label="t('day.alarm.snooze')" />
        </DayField>
        <tb-switch v-model="draft.enabled" :label="t('day.enabled')" />
      </view>
      <template #footer>
        <tb-button v-if="!isNew" variant="danger" icon="trash" @click="remove(draft)">
          {{ t('common.delete') }}
        </tb-button>
        <tb-button variant="primary" :loading="!!day.saving.alarms" @click="submit">
          {{ t('common.save') }}
        </tb-button>
      </template>
    </tb-sheet>
  </tb-section>
</template>
