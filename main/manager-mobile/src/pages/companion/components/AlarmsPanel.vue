<script lang="ts" setup>
import type { CompanionAlarm } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import { asciiLabel, clampInt, isHHMM, MAX_SAY, newAlarm, removeById, sortByTime, stripAlarm, upsertById } from '../companionUtils.mjs'
import { daysText, useCompanion } from './context'
import DayChips from './DayChips.vue'

defineOptions({
  name: 'CompanionAlarmsPanel',
})

const MAX_ALARMS = 20

const { dev, save } = useCompanion()
const message = useMessage()

const alarms = computed(() => sortByTime(dev.value?.alarms || []))

const editorOpen = ref(false)
const saving = ref(false)
const draft = ref<CompanionAlarm>(newAlarm())
const isNew = computed(() => !draft.value.id)

function currentList(): CompanionAlarm[] {
  return (dev.value?.alarms || []).map(stripAlarm)
}

function openEditor(alarm?: CompanionAlarm) {
  if (!alarm && currentList().length >= MAX_ALARMS) {
    toast.warning(t('companion.alarm.max', { n: MAX_ALARMS }))
    return
  }
  draft.value = alarm ? stripAlarm(alarm) : newAlarm()
  editorOpen.value = true
}

// the OLED shows ASCII only: filter the label while typing
watch(() => draft.value.label, (label) => {
  const clean = asciiLabel(label)
  if (clean !== label)
    draft.value.label = clean
})

async function toggleEnabled(alarm: CompanionAlarm, enabled: boolean) {
  const list = currentList().map(a => (a.id === alarm.id ? { ...a, enabled } : a))
  await save({ alarms: list }, enabled ? t('companion.alarm.on') : t('companion.alarm.off'))
}

async function submit() {
  const a = draft.value
  if (!isHHMM(a.time)) {
    toast.warning(t('companion.timeRequired'))
    return
  }
  const item = stripAlarm({
    ...a,
    label: asciiLabel(a.label).trim(),
    snooze_min: clampInt(a.snooze_min, 0, 60, 5),
    say: (a.say || '').trim().slice(0, MAX_SAY),
  })
  saving.value = true
  const ok = await save({ alarms: upsertById(currentList(), item) })
  saving.value = false
  if (ok)
    editorOpen.value = false
}

function confirmDelete() {
  const id = draft.value.id
  message.confirm({
    title: t('companion.alarm.deleteConfirm'),
    confirmButtonText: t('common.delete'),
    cancelButtonText: t('common.cancel'),
  }).then(async () => {
    const ok = await save({ alarms: removeById(currentList(), id) }, t('companion.deleted'))
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
      <view v-if="!alarms.length" class="py-[40rpx] text-center text-[26rpx] text-[#9d9ea3]">
        {{ t('companion.alarm.none') }}
      </view>
      <view
        v-for="a in alarms"
        :key="a.id"
        class="flex items-center gap-[20rpx] border-b-[1rpx] border-b-[#f0f0f0] border-b-solid py-[22rpx] last:border-b-0"
      >
        <text class="w-[130rpx] text-[44rpx] text-[#232338] font-semibold" :class="a.enabled ? '' : 'opacity-40'">
          {{ a.time }}
        </text>
        <view class="min-w-0 flex-1" @click="openEditor(a)">
          <text class="block truncate text-[28rpx] text-[#232338]">
            {{ a.label || t('companion.alarm.defaultLabel') }}
          </text>
          <text class="block truncate text-[22rpx] text-[#8c8c8c]">
            {{ daysText(a.days) }}{{ a.say ? ` · 🔊 ${a.say}` : '' }}
          </text>
        </view>
        <wd-switch :model-value="a.enabled" size="20" @change="({ value }) => toggleEnabled(a, !!value)" />
      </view>
    </view>

    <wd-button type="primary" block @click="openEditor()">
      + {{ t('companion.alarm.add') }}
    </wd-button>

    <wd-popup v-model="editorOpen" position="bottom" safe-area-inset-bottom custom-style="border-radius: 24rpx 24rpx 0 0;">
      <view class="max-h-[85vh] overflow-y-auto bg-white p-[32rpx]">
        <view class="mb-[24rpx] flex items-center justify-between">
          <text class="text-[34rpx] text-[#232338] font-semibold">
            {{ isNew ? t('companion.alarm.new') : t('companion.alarm.edit') }}
          </text>
          <wd-icon name="close" size="20" @click="editorOpen = false" />
        </view>

        <wd-datetime-picker
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
        <wd-input v-model="draft.label" :maxlength="24" clearable placeholder="Wake up" />
        <text class="mt-[6rpx] block text-[22rpx] text-[#9d9ea3]">
          {{ t('companion.labelHint') }}
        </text>

        <text class="mb-[8rpx] mt-[28rpx] block text-[26rpx] text-[#65686f]">
          {{ t('companion.alarm.say') }}
        </text>
        <wd-textarea
          v-model="draft.say"
          :maxlength="300"
          show-word-limit
          :placeholder="t('companion.alarm.sayPlaceholder')"
          custom-class="!bg-[#f5f7fb] !rounded-[12rpx]"
        />
        <text class="mt-[6rpx] block text-[22rpx] text-[#9d9ea3]">
          {{ t('companion.sayHint') }}
        </text>

        <view class="mt-[28rpx] flex items-center justify-between">
          <text class="text-[26rpx] text-[#65686f]">
            {{ t('companion.alarm.snooze') }}
          </text>
          <wd-input-number v-model="draft.snooze_min" :min="0" :max="60" />
        </view>

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
