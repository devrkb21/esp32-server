<script lang="ts" setup>
import type { PomodoroConfig } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n'
import { clampInt } from '../companionUtils.mjs'
import { useCompanion } from './context'

defineOptions({
  name: 'CompanionFocusPanel',
})

const { dev, save, command } = useCompanion()

const draft = ref<PomodoroConfig>({ work_min: 25, short_break_min: 5, long_break_min: 15, rounds: 4 })
const dirty = ref(false)
const saving = ref(false)
const starting = ref(false)

// follow the server values until the user edits something
watch(() => dev.value?.pomodoro, (p) => {
  if (p && !dirty.value)
    draft.value = { ...p }
}, { immediate: true, deep: true })

const doneToday = computed(() => dev.value?.stats?.pomodoros_today ?? 0)

function clean(): PomodoroConfig {
  const p = draft.value
  return {
    work_min: clampInt(p.work_min, 1, 120, 25),
    short_break_min: clampInt(p.short_break_min, 1, 60, 5),
    long_break_min: clampInt(p.long_break_min, 1, 90, 15),
    rounds: clampInt(p.rounds, 1, 12, 4),
  }
}

async function submit() {
  saving.value = true
  const ok = await save({ pomodoro: clean() })
  saving.value = false
  if (ok)
    dirty.value = false
}

async function startNow() {
  starting.value = true
  await command('pomodoro', String(clean().work_min), t('companion.focus.started'))
  starting.value = false
}
</script>

<template>
  <view v-if="dev" class="flex flex-col gap-[20rpx]">
    <view class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[12rpx] block text-[30rpx] text-[#232338] font-semibold">
        🍅 {{ t('companion.focus.title') }}
      </text>
      <view class="flex items-center justify-between py-[18rpx]">
        <text class="text-[26rpx] text-[#65686f]">
          {{ t('companion.focus.work') }}
        </text>
        <wd-input-number v-model="draft.work_min" :min="1" :max="120" input-width="50" @change="dirty = true" />
      </view>
      <view class="flex items-center justify-between py-[18rpx]">
        <text class="text-[26rpx] text-[#65686f]">
          {{ t('companion.focus.shortBreak') }}
        </text>
        <wd-input-number v-model="draft.short_break_min" :min="1" :max="60" input-width="50" @change="dirty = true" />
      </view>
      <view class="flex items-center justify-between py-[18rpx]">
        <text class="text-[26rpx] text-[#65686f]">
          {{ t('companion.focus.longBreak') }}
        </text>
        <wd-input-number v-model="draft.long_break_min" :min="1" :max="90" input-width="50" @change="dirty = true" />
      </view>
      <view class="flex items-center justify-between py-[18rpx]">
        <text class="text-[26rpx] text-[#65686f]">
          {{ t('companion.focus.rounds') }}
        </text>
        <wd-input-number v-model="draft.rounds" :min="1" :max="12" input-width="50" @change="dirty = true" />
      </view>
      <view class="mt-[20rpx] flex gap-[16rpx]">
        <wd-button type="primary" plain custom-class="flex-1" :loading="saving" @click="submit">
          {{ t('companion.save') }}
        </wd-button>
        <wd-button type="primary" custom-class="flex-1" :loading="starting" @click="startNow">
          ▶ {{ t('companion.focus.startNow') }}
        </wd-button>
      </view>
    </view>
    <view class="rounded-[20rpx] bg-white p-[28rpx] text-[24rpx] text-[#65686f] leading-[1.5]">
      {{ t('companion.focus.hint', { rounds: draft.rounds, done: doneToday }) }}
    </view>
  </view>
</template>
