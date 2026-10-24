<script lang="ts" setup>
import type { CompanionReminder, ReminderKind } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { asciiLabel, clampInt, isHHMM, MAX_SAY, newReminder, removeById, stripReminder, upsertById } from '../companionUtils.mjs'
import { daysText, useCompanion } from './context'
import DayChips from './DayChips.vue'

defineOptions({
  name: 'CompanionRemindersPanel',
})

const MAX_REMINDERS = 20
const KIND_ICON: Record<ReminderKind, string> = { water: '💧', medicine: '💊', custom: '📌' }
const KINDS: ReminderKind[] = ['water', 'medicine', 'custom']

const { dev, save } = useCompanion()
const message = useMessage()

const reminders = computed(() => dev.value?.reminders || [])

const editorOpen = ref(false)
const saving = ref(false)
const draft = ref<CompanionReminder>(newReminder('water') as CompanionReminder)
const isNew = computed(() => !draft.value.id)

const modeOptions = computed(() => [
  { value: 'interval', payload: t('companion.reminder.mode.interval') },
  { value: 'time', payload: t('companion.reminder.mode.time') },
])

function kindText(kind: ReminderKind) {
  return `${KIND_ICON[kind] || ''} ${t(`companion.reminder.kind.${kind}`)}`
}

function whenText(r: CompanionReminder) {
  if (r.mode === 'interval')
    return `${t('companion.reminder.everyLine', { n: r.every_min ?? 60, from: r.from || '', to: r.to || '' })} · ${daysText(r.days)}`
  return `${r.time || ''} · ${daysText(r.days)}`
}

function currentList(): CompanionReminder[] {
  return reminders.value.map(r => stripReminder(r) as CompanionReminder)
}

function openEditor(reminder?: CompanionReminder, kind: ReminderKind = 'custom') {
  if (!reminder && currentList().length >= MAX_REMINDERS) {
    toast.warning(t('companion.reminder.max', { n: MAX_REMINDERS }))
    return
  }
  // keep every field so switching mode back and forth does not lose values
  const base = reminder ? { ...newReminder(reminder.kind), ...reminder } : newReminder(kind)
  draft.value = {
    every_min: 60,
    from: '09:00',
    to: '21:00',
    time: '21:00',
    ...base,
  } as CompanionReminder
  delete draft.value.say_audio
  editorOpen.value = true
}

// the OLED shows ASCII only: filter the label while typing
watch(() => draft.value.label, (label) => {
  const clean = asciiLabel(label)
  if (clean !== label)
    draft.value.label = clean
})

async function toggleEnabled(r: CompanionReminder, enabled: boolean) {
  const list = currentList().map(x => (x.id === r.id ? { ...x, enabled } : x))
  await save({ reminders: list }, enabled ? t('companion.turnedOn') : t('companion.turnedOff'))
}

async function submit() {
  const r = draft.value
  if (r.mode === 'interval') {
    if (!isHHMM(r.from) || !isHHMM(r.to)) {
      toast.warning(t('companion.timeRequired'))
      return
    }
  }
  else if (!isHHMM(r.time)) {
    toast.warning(t('companion.timeRequired'))
    return
  }
  const item = stripReminder({
    ...r,
    label: asciiLabel(r.label).trim(),
    every_min: clampInt(r.every_min, 5, 720, 60),
    say: (r.say || '').trim().slice(0, MAX_SAY),
  }) as CompanionReminder
  saving.value = true
  const ok = await save({ reminders: upsertById(currentList(), item) })
  saving.value = false
  if (ok)
    editorOpen.value = false
}

function confirmDelete() {
  const id = draft.value.id
  message.confirm({
    title: t('companion.reminder.deleteConfirm'),
    confirmButtonText: t('common.delete'),
    cancelButtonText: t('common.cancel'),
  }).then(async () => {
    const ok = await save({ reminders: removeById(currentList(), id) }, t('companion.deleted'))
    if (ok)
      editorOpen.value = false
  }).catch(() => {
    // cancelled
  })
}
</script>

<template>
  <view v-if="dev" class="flex flex-col gap-[20rpx]">
    <view class="rounded-[20rpx] bg-white px-[28rpx] py-[8rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <view v-if="!reminders.length" class="py-[40rpx] text-center text-[26rpx] text-[#9d9ea3]">
        {{ t('companion.reminder.none') }}
      </view>
      <view
        v-for="r in reminders"
        :key="r.id"
        class="flex items-center gap-[20rpx] border-b-[1rpx] border-b-[#f0f0f0] border-b-solid py-[22rpx] last:border-b-0"
      >
        <view class="min-w-0 flex-1" :class="r.enabled ? '' : 'opacity-50'" @click="openEditor(r)">
          <view class="flex items-center gap-[12rpx]">
            <text class="text-[28rpx] text-[#232338] font-medium">
              {{ kindText(r.kind) }}
            </text>
            <text class="truncate text-[22rpx] text-[#8c8c8c]">
              {{ r.label }}
            </text>
          </view>
          <text class="block truncate text-[22rpx] text-[#8c8c8c]">
            {{ whenText(r) }}
          </text>
        </view>
        <wd-switch :model-value="r.enabled" size="20" @change="({ value }) => toggleEnabled(r, !!value)" />
      </view>
    </view>

    <view class="flex gap-[16rpx]">
      <wd-button v-for="k in KINDS" :key="k" type="primary" plain size="small" custom-class="flex-1 !px-[8rpx] !min-w-0" @click="openEditor(undefined, k)">
        + {{ kindText(k) }}
      </wd-button>
    </view>

    <wd-popup v-model="editorOpen" position="bottom" safe-area-inset-bottom custom-style="border-radius: 24rpx 24rpx 0 0;">
      <view class="max-h-[85vh] overflow-y-auto bg-white p-[32rpx]">
        <view class="mb-[24rpx] flex items-center justify-between">
          <text class="text-[34rpx] text-[#232338] font-semibold">
            {{ t(isNew ? 'companion.reminder.new' : 'companion.reminder.edit', { kind: kindText(draft.kind) }) }}
          </text>
          <wd-icon name="close" size="20" @click="editorOpen = false" />
        </view>

        <wd-segmented v-model:value="draft.mode" :options="modeOptions">
          <template #label="{ option }">
            {{ option.payload }}
          </template>
        </wd-segmented>

        <template v-if="draft.mode === 'interval'">
          <view class="mt-[28rpx] flex items-center justify-between">
            <text class="text-[26rpx] text-[#65686f]">
              {{ t('companion.reminder.every') }}
            </text>
            <wd-input-number v-model="draft.every_min" :min="5" :max="720" :step="5" input-width="60" />
          </view>
          <wd-datetime-picker
            v-model="draft.from"
            type="time"
            :label="t('companion.reminder.from')"
            :cancel-button-text="t('common.cancel')"
            :confirm-button-text="t('common.confirm')"
          />
          <wd-datetime-picker
            v-model="draft.to"
            type="time"
            :label="t('companion.reminder.to')"
            :cancel-button-text="t('common.cancel')"
            :confirm-button-text="t('common.confirm')"
          />
        </template>
        <wd-datetime-picker
          v-else
          v-model="draft.time"
          type="time"
          :label="t('companion.time')"
          :cancel-button-text="t('common.cancel')"
          :confirm-button-text="t('common.confirm')"
        />

        <text class="mb-[12rpx] mt-[24rpx] block text-[26rpx] text-[#65686f]">
          {{ t('companion.daysLabel') }}
        </text>
        <DayChips v-model="draft.days" />

        <text class="mb-[8rpx] mt-[28rpx] block text-[26rpx] text-[#65686f]">
          {{ t('companion.label') }}
        </text>
        <wd-input v-model="draft.label" :maxlength="24" clearable placeholder="Reminder" />
        <text class="mt-[6rpx] block text-[22rpx] text-[#9d9ea3]">
          {{ t('companion.labelHint') }}
        </text>

        <text class="mb-[8rpx] mt-[28rpx] block text-[26rpx] text-[#65686f]">
          {{ t('companion.reminder.say') }}
        </text>
        <wd-textarea
          v-model="draft.say"
          :maxlength="300"
          show-word-limit
          custom-class="!bg-[#f5f7fb] !rounded-[12rpx]"
        />
        <text class="mt-[6rpx] block text-[22rpx] text-[#9d9ea3]">
          {{ t('companion.sayHint') }}
        </text>

        <view class="mt-[28rpx] flex items-center justify-between">
          <text class="text-[26rpx] text-[#65686f]">
            {{ t('companion.enabled') }}
          </text>
          <wd-switch v-model="draft.enabled" size="20" />
        </view>

        <view class="mt-[40rpx] flex gap-[16rpx]">
          <wd-button v-if="!isNew" type="error" plain custom-class="flex-1" @click="confirmDelete">
            {{ t('common.delete') }}
          </wd-button>
          <wd-button type="info" plain custom-class="flex-1" @click="editorOpen = false">
            {{ t('common.cancel') }}
          </wd-button>
          <wd-button type="primary" custom-class="flex-1" :loading="saving" @click="submit">
            {{ t('companion.save') }}
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>
