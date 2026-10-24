<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Companion",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import type { CompanionContext } from './components/context'
import type { CommandType, CompanionConfigPatch, CompanionDevice } from '@/api/companion'
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, provide, ref } from 'vue'
import { getCompanion, sendCompanionCommand, updateCompanionConfig } from '@/api/companion'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import ActionsPanel from './components/ActionsPanel.vue'
import AlarmsPanel from './components/AlarmsPanel.vue'
import { companionKey, notifyError } from './components/context'
import FocusPanel from './components/FocusPanel.vue'
import MessagesPanel from './components/MessagesPanel.vue'
import NightCarePanel from './components/NightCarePanel.vue'
import PrayerPanel from './components/PrayerPanel.vue'
import RemindersPanel from './components/RemindersPanel.vue'
import RobotPanel from './components/RobotPanel.vue'
import StatusPanel from './components/StatusPanel.vue'

defineOptions({
  name: 'CompanionPage',
})

const POLL_MS = 10000

const deviceId = ref('')
const fallbackName = ref('')
const dev = ref<CompanionDevice | null>(null)
const loading = ref(false)
const loadError = ref(false)
const activeTab = ref(0)

// wd-navbar is fixed: the sticky tabs sit right below it (status bar + 44px bar)
let navbarHeight = (uni.getSystemInfoSync().statusBarHeight || 0) + 44
// #ifdef H5
navbarHeight -= 44 // on H5 wd-sticky already adds a 44px navigation bar
// #endif

const tabs = [
  { name: 'status', title: 'companion.tab.status' },
  { name: 'actions', title: 'companion.tab.actions' },
  { name: 'alarms', title: 'companion.tab.alarms' },
  { name: 'reminders', title: 'companion.tab.reminders' },
  { name: 'prayer', title: 'companion.tab.prayer' },
  { name: 'focus', title: 'companion.tab.focus' },
  { name: 'messages', title: 'companion.tab.messages' },
  { name: 'night', title: 'companion.tab.night' },
  { name: 'robot', title: 'companion.tab.robot' },
]

const title = computed(() => dev.value?.name || fallbackName.value || t('companion.title'))

// A poll that started before a save must not overwrite the save's newer response
let mutationSeq = 0

async function reload(silent = true) {
  if (!deviceId.value)
    return
  const seq = mutationSeq
  if (!dev.value)
    loading.value = true
  try {
    const data = await getCompanion(deviceId.value, silent)
    if (seq === mutationSeq && data)
      dev.value = data
    loadError.value = false
  }
  catch (error) {
    if (!dev.value)
      loadError.value = true
    if (!silent)
      notifyError(error)
  }
  finally {
    loading.value = false
  }
}

async function save(patch: CompanionConfigPatch, okMsg?: string): Promise<boolean> {
  mutationSeq++
  try {
    const data = await updateCompanionConfig(deviceId.value, patch)
    mutationSeq++
    if (data)
      dev.value = data
    toast.success(okMsg || t('companion.saved'))
    return true
  }
  catch (error) {
    notifyError(error)
    // undo optimistic edits
    await reload()
    return false
  }
}

async function command(type: CommandType, arg = '', okMsg?: string): Promise<boolean> {
  try {
    await sendCompanionCommand(deviceId.value, { type, arg })
    toast.success(okMsg || t('companion.act.sent'))
    reload()
    return true
  }
  catch (error) {
    notifyError(error)
    return false
  }
}

const ctx: CompanionContext = {
  deviceId,
  dev,
  save,
  command,
  reload: () => reload(),
}
provide(companionKey, ctx)

// Poll every 10 s while the page is visible
let timer: ReturnType<typeof setInterval> | undefined

function pageHidden() {
  return typeof document !== 'undefined' && document.hidden
}

function startPolling() {
  stopPolling()
  timer = setInterval(() => {
    if (!pageHidden())
      reload()
  }, POLL_MS)
}

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
}

function onVisibility() {
  if (!pageHidden())
    reload()
}

onLoad((options) => {
  deviceId.value = String(options?.deviceId || '')
  try {
    fallbackName.value = options?.name ? decodeURIComponent(String(options.name)) : ''
  }
  catch {
    fallbackName.value = String(options?.name || '')
  }
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', onVisibility)
})

onShow(() => {
  reload(!!dev.value)
  startPolling()
})

onHide(stopPolling)

onUnload(() => {
  stopPolling()
  if (typeof document !== 'undefined')
    document.removeEventListener('visibilitychange', onVisibility)
})

function goBack() {
  uni.navigateBack()
}

function retry() {
  loadError.value = false
  reload(false)
}
</script>

<template>
  <view class="min-h-screen flex flex-col bg-[#f5f7fb]">
    <wd-navbar :title="title" safe-area-inset-top left-arrow placeholder fixed :bordered="false" :z-index="9" @click-left="goBack">
      <template #left>
        <wd-icon name="arrow-left" size="18" />
      </template>
      <template #right>
        <view v-if="dev" class="flex items-center gap-[8rpx]">
          <view class="h-[16rpx] w-[16rpx] rounded-full" :class="dev.online ? 'bg-[#52c41a]' : 'bg-[#bfbfbf]'" />
          <text class="text-[22rpx]" :class="dev.online ? 'text-[#52c41a]' : 'text-[#8c8c8c]'">
            {{ dev.online ? t('companion.online') : t('companion.offline') }}
          </text>
        </view>
      </template>
    </wd-navbar>

    <view v-if="!deviceId" class="flex flex-1 items-center justify-center p-[40rpx] text-[28rpx] text-[#8c8c8c]">
      {{ t('companion.noDevice') }}
    </view>

    <view v-else-if="loading && !dev" class="flex flex-1 flex-col items-center justify-center">
      <wd-loading color="#336cff" />
      <text class="mt-[20rpx] text-[28rpx] text-[#666666]">
        {{ t('common.loading') }}
      </text>
    </view>

    <view v-else-if="loadError && !dev" class="flex flex-1 flex-col items-center justify-center gap-[24rpx] p-[40rpx]">
      <text class="text-[60rpx]">
        🤖
      </text>
      <text class="text-center text-[28rpx] text-[#65686f]">
        {{ t('companion.loadFailed') }}
      </text>
      <text class="text-center text-[24rpx] text-[#9d9ea3]">
        {{ t('companion.loadFailedHint') }}
      </text>
      <wd-button type="primary" size="small" @click="retry">
        {{ t('companion.retry') }}
      </wd-button>
    </view>

    <view v-else-if="dev" class="flex-1">
      <wd-tabs v-model="activeTab" slidable="always" sticky :offset-top="navbarHeight" custom-class="companion-tabs">
        <wd-tab v-for="tab in tabs" :key="tab.name" :title="t(tab.title)" :name="tab.name">
          <view class="box-border p-[20rpx] pb-[60rpx]">
            <StatusPanel v-if="tab.name === 'status'" />
            <ActionsPanel v-else-if="tab.name === 'actions'" />
            <AlarmsPanel v-else-if="tab.name === 'alarms'" />
            <RemindersPanel v-else-if="tab.name === 'reminders'" />
            <PrayerPanel v-else-if="tab.name === 'prayer'" />
            <FocusPanel v-else-if="tab.name === 'focus'" />
            <MessagesPanel v-else-if="tab.name === 'messages'" />
            <NightCarePanel v-else-if="tab.name === 'night'" />
            <RobotPanel v-else-if="tab.name === 'robot'" />
          </view>
        </wd-tab>
      </wd-tabs>
    </view>

    <wd-message-box />
  </view>
</template>

<style lang="scss" scoped>
:deep(.companion-tabs) {
  background: transparent;
}
</style>
