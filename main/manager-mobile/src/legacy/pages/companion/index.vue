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
import type { CompanionContext, FirmwareUpdateState } from './components/context'
import type { CommandType, CompanionConfigPatch, CompanionDevice } from '@/api/companion'
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, onBeforeUnmount, provide, ref } from 'vue'
import { getCompanion, sendCompanionCommand, updateCompanionConfig } from '@/api/companion'
import { t } from '@/i18n'
import { toast } from '@/utils/toast'
import ActionsPanel from './components/ActionsPanel.vue'
import AlarmsPanel from './components/AlarmsPanel.vue'
import { agoText, companionKey, MOOD_EMOJI, moodText, notifyError } from './components/context'
import DayPanel from './components/DayPanel.vue'
import FocusPanel from './components/FocusPanel.vue'
import LookPanel from './components/LookPanel.vue'
import MessagesPanel from './components/MessagesPanel.vue'
import NightCarePanel from './components/NightCarePanel.vue'
import PrayerPanel from './components/PrayerPanel.vue'
import RemindersPanel from './components/RemindersPanel.vue'
import RobotPanel from './components/RobotPanel.vue'
import StatusPanel from './components/StatusPanel.vue'
import { createUpdateFlow, initialUpdateState } from './firmwareUpdate.mjs'

defineOptions({
  name: 'CompanionPage',
})

const POLL_MS = 10000

const deviceId = ref('')
const agentId = ref('')
const fallbackName = ref('')
const dev = ref<CompanionDevice | null>(null)
const loading = ref(false)
const loadError = ref(false)
const activeTab = ref('status')

// wd-navbar is fixed: the sticky section switcher sits right below it (status bar + 44px bar)
const navbarHeight = (uni.getSystemInfoSync().statusBarHeight || 0) + 44

const tabs = [
  { name: 'status', title: 'companion.tab.status' },
  { name: 'actions', title: 'companion.tab.actions' },
  { name: 'alarms', title: 'companion.tab.alarms' },
  { name: 'reminders', title: 'companion.tab.reminders' },
  { name: 'prayer', title: 'companion.tab.prayer' },
  { name: 'focus', title: 'companion.tab.focus' },
  { name: 'messages', title: 'companion.tab.messages' },
  { name: 'day', title: 'companion.tab.day' },
  { name: 'night', title: 'companion.tab.night' },
  { name: 'look', title: 'companion.tab.look' },
  { name: 'robot', title: 'companion.tab.robot' },
]

const title = computed(() => dev.value?.name || fallbackName.value || t('companion.title'))

// Header card: mood, bond and streak from the robot's last status report
const stats = computed(() => dev.value?.stats || {})
const hasStats = computed(() => Object.keys(stats.value).length > 0)
const bond = computed(() => Math.max(0, Math.min(100, stats.value.bond_score ?? 0)))

/** Translate with an English fallback for keys still waiting in src/i18n/_pending */
function tx(key: string, fallback: string) {
  const text = t(key)
  return text === key ? fallback : text
}

function selectTab(name: string) {
  activeTab.value = name
}

// "Update now" of the Firmware card (Robot tab): kept here so it survives switching tabs
const firmwareState = ref<FirmwareUpdateState>(initialUpdateState() as FirmwareUpdateState)
const firmwareAppVersion = ref('')
const firmwareFlow = createUpdateFlow({
  sendCommand: (cmd: { type: CommandType }) => sendCompanionCommand(deviceId.value, { type: cmd.type }),
  fetchView: () => getCompanion(deviceId.value, true),
  appVersion: () => firmwareAppVersion.value,
  onChange: (state: FirmwareUpdateState) => {
    firmwareState.value = state
  },
})
onBeforeUnmount(() => firmwareFlow.destroy())

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
    if (seq === mutationSeq && data) {
      dev.value = data
      firmwareFlow.observe(data)
    }
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
  agentId,
  firmware: {
    state: firmwareState,
    start: () => firmwareFlow.start(dev.value),
    reset: () => firmwareFlow.reset(),
    setAppVersion: (version: string) => {
      firmwareAppVersion.value = version
    },
  },
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
  agentId.value = String(options?.agentId || '')
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
  <view class="cmp">
    <wd-navbar
      :title="title"
      safe-area-inset-top
      placeholder
      fixed
      :bordered="false"
      :z-index="20"
      custom-class="cmp__nav"
    >
      <template #left>
        <view class="cmp__back" role="button" :aria-label="tx('companion.back', 'Back')" @click="goBack">
          <wd-icon name="arrow-left" size="20px" />
        </view>
      </template>
    </wd-navbar>

    <view v-if="!deviceId" class="nx-empty">
      <view class="nx-icon-tile nx-icon-tile--lg">
        <wd-icon name="mobile" size="28px" />
      </view>
      <view class="nx-empty__title">
        {{ t('companion.noDevice') }}
      </view>
      <view class="nx-btn nx-btn--primary cmp__empty-btn" @click="goBack">
        {{ tx('companion.back', 'Back') }}
      </view>
    </view>

    <!-- Loading skeleton -->
    <view v-else-if="loading && !dev" class="cmp__body" role="status" :aria-label="t('common.loading')">
      <view class="nx-card cmp-hero">
        <view class="cmp-hero__top">
          <view class="nx-skeleton cmp__skel-avatar" />
          <view class="flex-1">
            <view class="nx-skeleton cmp__skel-line" />
            <view class="nx-skeleton cmp__skel-line cmp__skel-line--short" />
          </view>
        </view>
        <view class="cmp-hero__stats">
          <view v-for="i in 3" :key="i" class="nx-skeleton cmp__skel-tile" />
        </view>
      </view>
    </view>

    <view v-else-if="loadError && !dev" class="nx-empty">
      <view class="nx-icon-tile nx-icon-tile--lg">
        <wd-icon name="wifi-error" size="28px" />
      </view>
      <view class="nx-empty__title">
        {{ t('companion.loadFailed') }}
      </view>
      <view class="nx-empty__text">
        {{ t('companion.loadFailedHint') }}
      </view>
      <view class="nx-btn nx-btn--primary cmp__empty-btn" @click="retry">
        {{ t('companion.retry') }}
      </view>
    </view>

    <view v-else-if="dev" class="cmp__body">
      <!-- Header card -->
      <view class="nx-card cmp-hero">
        <view class="cmp-hero__top">
          <view class="cmp-hero__avatar" aria-hidden="true">
            {{ (stats.mood && MOOD_EMOJI[stats.mood]) || '🤖' }}
          </view>
          <view class="min-w-0 flex-1">
            <view class="nx-truncate cmp-hero__name" :title="dev.name">
              {{ title }}
            </view>
            <view class="cmp-hero__meta">
              <view class="nx-badge" :class="dev.online ? 'nx-badge--success' : ''">
                <view class="nx-dot" :class="{ 'nx-dot--online cmp-hero__pulse': dev.online }" />
                {{ dev.online ? t('companion.online') : t('companion.offline') }}
              </view>
              <text class="nx-truncate nx-caption">
                {{ t('companion.lastSeen', { time: agoText(dev.last_seen) }) }}
              </text>
            </view>
          </view>
        </view>

        <view v-if="hasStats" class="cmp-hero__stats">
          <view class="cmp-hero__stat">
            <view class="cmp-hero__label">
              {{ tx('companion.moodLabel', 'Mood') }}
            </view>
            <view class="nx-truncate cmp-hero__value">
              {{ stats.mood ? moodText(stats.mood) : '–' }}
            </view>
          </view>
          <view class="cmp-hero__stat">
            <view class="cmp-hero__label nx-truncate">
              {{ t('companion.bond', { level: stats.bond_level ?? 0 }) }}
            </view>
            <view class="cmp-hero__value nx-num">
              {{ stats.bond_score ?? 0 }}<text class="cmp-hero__unit">
                /100
              </text>
            </view>
            <view class="cmp-hero__bar" role="progressbar" :aria-valuenow="bond" aria-valuemin="0" aria-valuemax="100">
              <view class="cmp-hero__bar-fill" :style="{ transform: `scaleX(${bond / 100})` }" />
            </view>
          </view>
          <view class="cmp-hero__stat">
            <view class="cmp-hero__label nx-truncate">
              {{ t('companion.streak') }}
            </view>
            <view class="cmp-hero__value nx-num">
              {{ stats.streak ?? 0 }}
            </view>
          </view>
        </view>
        <view v-else class="nx-footnote cmp-hero__nostats">
          {{ t('companion.noStats') }}
        </view>
      </view>

      <!-- Section switcher -->
      <view class="cmp-tabs" :style="{ top: `${navbarHeight}px` }">
        <scroll-view scroll-x class="cmp-tabs__scroll" :show-scrollbar="false" :scroll-into-view="`cmp-tab-${activeTab}`" scroll-with-animation>
          <view class="cmp-tabs__track" role="tablist">
            <view
              v-for="tab in tabs"
              :id="`cmp-tab-${tab.name}`"
              :key="tab.name"
              class="cmp-tabs__item"
              :class="{ 'is-active': activeTab === tab.name }"
              role="tab"
              :aria-selected="activeTab === tab.name"
              @click="selectTab(tab.name)"
            >
              {{ t(tab.title) }}
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="cmp__panel">
        <StatusPanel v-if="activeTab === 'status'" />
        <ActionsPanel v-else-if="activeTab === 'actions'" />
        <AlarmsPanel v-else-if="activeTab === 'alarms'" />
        <RemindersPanel v-else-if="activeTab === 'reminders'" />
        <PrayerPanel v-else-if="activeTab === 'prayer'" />
        <FocusPanel v-else-if="activeTab === 'focus'" />
        <MessagesPanel v-else-if="activeTab === 'messages'" />
        <DayPanel v-else-if="activeTab === 'day'" />
        <NightCarePanel v-else-if="activeTab === 'night'" />
        <LookPanel v-else-if="activeTab === 'look'" />
        <RobotPanel v-else-if="activeTab === 'robot'" />
      </view>
    </view>

    <wd-message-box />
  </view>
</template>

<style lang="scss" scoped>
.cmp {
  min-height: 100vh;
  background: var(--nx-bg);

  &__back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--nx-touch);
    height: var(--nx-touch);
    margin-left: calc(var(--nx-space-2) * -1);
    color: var(--nx-text);
  }

  &__body {
    padding: var(--nx-space-3) var(--nx-gutter) calc(var(--nx-space-7) + env(safe-area-inset-bottom));
  }

  &__panel {
    padding-top: var(--nx-space-2);
  }

  &__empty-btn {
    margin-top: var(--nx-space-3);
  }

  &__skel-avatar {
    width: 104rpx;
    height: 104rpx;
    border-radius: var(--nx-radius-lg);
  }

  &__skel-line {
    width: 60%;
    height: 36rpx;

    &--short {
      width: 40%;
      height: 24rpx;
      margin-top: 16rpx;
    }
  }

  &__skel-tile {
    flex: 1;
    height: 112rpx;
    border-radius: var(--nx-radius);
  }
}

:deep(.cmp__nav) {
  background: var(--nx-glass);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1rpx solid var(--nx-border);
}

.cmp-hero {
  &__top {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
  }

  &__avatar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 104rpx;
    height: 104rpx;
    border-radius: var(--nx-radius-lg);
    background: var(--nx-accent-soft);
    font-size: var(--nx-text-display);
    line-height: 1;
  }

  &__name {
    font-size: var(--nx-text-title);
    font-weight: 700;
    letter-spacing: -0.018em;
    color: var(--nx-text);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    min-width: 0;
    margin-top: var(--nx-space-1);
  }

  &__stats {
    display: flex;
    gap: var(--nx-space-2);
    margin-top: var(--nx-space-4);
  }

  &__stat {
    flex: 1;
    min-width: 0;
    padding: var(--nx-space-2) var(--nx-space-3);
    border-radius: var(--nx-radius);
    background: var(--nx-surface-2);
  }

  &__label {
    font-size: var(--nx-text-caption);
    font-weight: 500;
    color: var(--nx-text-2);
  }

  &__value {
    margin-top: 4rpx;
    font-size: var(--nx-text-headline);
    font-weight: 600;
    color: var(--nx-text);
  }

  &__unit {
    font-size: var(--nx-text-caption);
    font-weight: 500;
    color: var(--nx-text-3);
  }

  &__bar {
    height: 8rpx;
    margin-top: var(--nx-space-1);
    overflow: hidden;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-3);
  }

  &__bar-fill {
    height: 100%;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-accent);
    transform-origin: left center;
    transition: transform var(--nx-dur-3) var(--nx-ease);
  }

  &__nostats {
    margin-top: var(--nx-space-3);
    color: var(--nx-text-3);
  }

  &__pulse {
    animation: cmp-pulse 2.4s ease-in-out infinite;
  }
}

/* Sticky, horizontally scrolling segmented switcher */
.cmp-tabs {
  position: sticky;
  z-index: 10;
  margin: var(--nx-space-4) calc(var(--nx-gutter) * -1) 0;
  padding: var(--nx-space-2) var(--nx-gutter);
  background: var(--nx-bg);

  &__scroll {
    width: 100%;
    white-space: nowrap;
  }

  &__track {
    display: inline-flex;
    gap: 4rpx;
    padding: 6rpx;
    border-radius: var(--nx-radius);
    background: var(--nx-surface-3);
  }

  &__item {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    min-height: 64rpx;
    padding: 0 var(--nx-space-3);
    border-radius: calc(var(--nx-radius) - 6rpx);
    color: var(--nx-text-2);
    font-size: var(--nx-text-footnote);
    font-weight: 500;
    white-space: nowrap;
    transition:
      background-color var(--nx-dur-2) var(--nx-ease),
      color var(--nx-dur-2) var(--nx-ease);

    &.is-active {
      background: var(--nx-surface);
      color: var(--nx-text);
      font-weight: 600;
      box-shadow: var(--nx-shadow-1);
    }
  }
}

@keyframes cmp-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cmp-hero__pulse {
    animation: none;
  }

  .cmp-hero__bar-fill,
  .cmp-tabs__item {
    transition: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  :deep(.cmp__nav) {
    background: var(--nx-surface);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
</style>

<!-- Shared look of the companion panels (prefixed `cmp-`, so global is safe) -->
<style lang="scss">
.cmp-section {
  margin-bottom: var(--nx-space-5);
}

.cmp-section-head {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  padding: 0 var(--nx-space-2) var(--nx-space-2);

  &__title {
    flex: 1;
    min-width: 0;
    font-size: var(--nx-text-caption);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--nx-text-3);
  }
}

.cmp-pill {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8rpx;
  min-height: 60rpx;
  padding: 0 var(--nx-space-3);
  border-radius: var(--nx-radius-pill);
  background: var(--nx-accent-soft);
  color: var(--nx-accent);
  font-size: var(--nx-text-footnote);
  font-weight: 600;
  transition: transform var(--nx-dur-1) var(--nx-ease);

  &:active {
    transform: scale(0.97);
  }

  &--neutral {
    background: var(--nx-surface-2);
    color: var(--nx-text);
  }
}

.cmp-add-row {
  color: var(--nx-accent);
  font-weight: 500;
}

.cmp-stepper-row {
  .wd-input-number {
    flex: none;
  }
}

.cmp-picker {
  .wd-cell {
    padding-left: var(--nx-space-4);
    background: transparent;
  }

  .wd-cell__wrapper {
    min-height: var(--nx-touch);
    align-items: center;
  }
}

/* Bottom sheets */
.cmp-sheet {
  border-radius: var(--nx-radius-xl) var(--nx-radius-xl) 0 0;
  background: var(--nx-bg);
  overflow: hidden;
}

.cmp-sheet__inner {
  max-height: 88vh;
  padding: 0 var(--nx-gutter) var(--nx-space-4);
  overflow-y: auto;
  box-sizing: border-box;
}

.cmp-sheet__handle {
  width: 72rpx;
  height: 10rpx;
  margin: var(--nx-space-2) auto var(--nx-space-1);
  border-radius: var(--nx-radius-pill);
  background: var(--nx-border-strong);
}

.cmp-sheet__header {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  padding: var(--nx-space-2) 0 var(--nx-space-4);
}

.cmp-sheet__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--nx-text-headline);
  font-weight: 600;
  color: var(--nx-text);
}

.cmp-sheet__close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--nx-surface-3);
  color: var(--nx-text-2);
}

.cmp-sheet__actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--nx-space-1);
  margin-top: var(--nx-space-2);
}

.cmp-sheet__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--nx-touch);
  color: var(--nx-danger);
  font-size: var(--nx-text-body);
  font-weight: 500;
}

/* Form fields inside sheets and cards */
.cmp-field {
  margin-bottom: var(--nx-space-4);

  &__label {
    margin-bottom: var(--nx-space-1);
    padding: 0 var(--nx-space-1);
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }

  &__help {
    margin-top: var(--nx-space-1);
    padding: 0 var(--nx-space-1);
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }

  &__box {
    border-radius: var(--nx-radius);
    background: var(--nx-surface);
    overflow: hidden;
  }

  .wd-input,
  .wd-textarea {
    padding: var(--nx-space-2) var(--nx-space-3);
    background: var(--nx-surface);
  }

  .wd-input::after,
  .wd-textarea::after {
    display: none;
  }
}

.cmp-time-hero {
  font-size: var(--nx-text-display);
  font-weight: 300;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--nx-text);
}
</style>
