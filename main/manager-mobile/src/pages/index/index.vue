<!-- Home page configured via type="home" attribute -->
<route lang="jsonc" type="home">
{
  "layout": "tabbar",
  "style": {
    // 'custom' enables custom navbar, default 'default'
    "navigationStyle": "custom",
    "navigationBarTitleText": "Home"
  }
}
</route>

<script lang="ts" setup>
import type { Agent } from '@/api/agent/types'
import { computed, onMounted, ref } from 'vue'
// Set navbar title after mount
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import useZPaging from 'z-paging/components/z-paging/js/hooks/useZPaging.js'
import { createAgent, deleteAgent, getAgentList } from '@/api/agent/agent'
import { t } from '@/i18n'
import { useUserStore } from '@/store'
import { toast } from '@/utils/toast'

defineOptions({
  name: 'Home',
})

// Get distance from screen boundary to safe area
let safeAreaInsets: any
let systemInfo: any

// #ifdef MP-WEIXIN
// Mini-program uses new API
systemInfo = uni.getWindowInfo()
safeAreaInsets = systemInfo.safeArea
  ? {
      top: systemInfo.safeArea.top,
      right: systemInfo.windowWidth - systemInfo.safeArea.right,
      bottom: systemInfo.windowHeight - systemInfo.safeArea.bottom,
      left: systemInfo.safeArea.left,
    }
  : null
// #endif

// #ifndef MP-WEIXIN
// Other platforms continue using uni API
systemInfo = uni.getSystemInfoSync()
safeAreaInsets = systemInfo.safeAreaInsets
// #endif

// Agent data
const agentList = ref<Agent[]>([])
// Becomes true after the first list request settles (drives the skeleton)
const firstLoaded = ref(false)
const pagingRef = ref()
useZPaging(pagingRef)
// Message component
const message = useMessage()
const deleteDialogVisible = ref(false)
const deleteTargetAgent = ref<Agent | null>(null)
const deleteConfirmText = ref('')
const deleteAgentLoading = ref(false)

const isDeleteAgentNameMatched = computed(() => {
  return !!deleteTargetAgent.value?.agentName && deleteConfirmText.value === deleteTargetAgent.value.agentName
})

// z-paging query list data
async function queryList(pageNo: number, pageSize: number) {
  try {
    console.log('z-paging get agent list')

    const response = await getAgentList()

    // Update local list
    agentList.value = response

    // Return all data directly without pagination
    pagingRef.value.complete(response)
  }
  catch (error) {
    console.error('Failed to get agent list:', error)
    // Notify z-paging of data loading failure
    pagingRef.value.complete(false)
  }
  finally {
    firstLoaded.value = true
  }
}

// Create agent
async function handleCreateAgent(agentName: string) {
  try {
    await createAgent({ agentName: agentName.trim() })
    // Refresh list after successful creation
    pagingRef.value.reload()
    toast.success(`${t('home.agentName')}"${agentName}"${t('message.saveSuccess')}`)
  }
  catch (error: any) {
    console.error('Failed to create agent:', error)
    const errorMessage = error?.message || t('message.saveFail')
    toast.error(errorMessage)
  }
}

function openDeleteAgentDialog(agent: Agent) {
  if (!agent.id || !agent.agentName) {
    toast.error(t('home.deleteAgentMissingInfo'))
    return
  }

  deleteTargetAgent.value = agent
  deleteConfirmText.value = ''
  deleteDialogVisible.value = true
}

function closeDeleteAgentDialog() {
  if (deleteAgentLoading.value)
    return

  deleteDialogVisible.value = false
  deleteTargetAgent.value = null
  deleteConfirmText.value = ''
}

function handleDeleteAgentPaste() {
  toast.warning(t('home.deleteAgentPasteForbidden'))
}

// Delete agent
async function handleDeleteAgent() {
  if (!deleteTargetAgent.value || !isDeleteAgentNameMatched.value || deleteAgentLoading.value)
    return

  try {
    deleteAgentLoading.value = true
    await deleteAgent(deleteTargetAgent.value.id)
    // Refresh list after successful deletion
    pagingRef.value.reload()
    toast.success(t('home.deleteAgentSuccess'))
    deleteDialogVisible.value = false
    deleteTargetAgent.value = null
    deleteConfirmText.value = ''
  }
  catch (error: any) {
    console.error('Failed to delete agent:', error)
    const errorMessage = error?.message || t('message.deleteFail')
    toast.error(errorMessage)
  }
  finally {
    deleteAgentLoading.value = false
  }
}

// Enter edit page
function goToEditAgent(agent: Agent) {
  // Pass agent ID to edit page
  uni.navigateTo({
    url: `/pages/agent/index?agentId=${agent.id}`,
  })
}

// Click card to edit
function handleCardClick(agent: Agent) {
  goToEditAgent(agent)
}

// Open creation dialog
function openCreateDialog() {
  message
    .prompt({
      title: t('home.dialogTitle'),
      msg: '',
      inputPlaceholder: t('home.inputPlaceholder'),
      inputValue: '',
      inputPattern: /^.{1,64}$/,
      inputError: t('home.createError'),
      confirmButtonText: t('home.createNow'),
      cancelButtonText: t('common.cancel'),
    })
    .then(async (result: any) => {
      if (result.value && String(result.value).trim()) {
        await handleCreateAgent(String(result.value).trim())
      }
    })
    .catch(() => {
      // User cancelled operation
    })
}

// Format time
function formatTime(timeStr: string) {
  const date = new Date(timeStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000)
    return t('home.justNow')
  if (diff < 3600000)
    return `${Math.floor(diff / 60000)} ${t('home.minutesAgo')}`
  if (diff < 86400000)
    return `${Math.floor(diff / 3600000)} ${t('home.hoursAgo')}`
  return `${Math.floor(diff / 86400000)} ${t('home.daysAgo')}`
}

// Pending copy (src/i18n/_pending/mobile-home-agents.ts): English fallback until merged
function tx(key: string, fallback: string, params?: Record<string, string | number>) {
  const value = t(key, params)
  if (value !== key)
    return value
  if (!params)
    return fallback
  return Object.entries(params).reduce((text, [name, val]) => text.replace(`{${name}}`, String(val)), fallback)
}

// ---- Layout helpers (display only) ----
const userStore = useUserStore()

const ACTIVE_WINDOW_MS = 10 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function msSince(timeStr: string | null) {
  if (!timeStr)
    return Number.POSITIVE_INFINITY
  const time = new Date(timeStr).getTime()
  return Number.isFinite(time) ? Date.now() - time : Number.POSITIVE_INFINITY
}

// Talked to a robot in the last few minutes: shown as "active now" with the online dot
function isActiveNow(agent: Agent) {
  return agent.deviceCount > 0 && msSince(agent.lastConnectedAt) < ACTIVE_WINDOW_MS
}

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12)
    return tx('home.greetingMorning', 'Good morning')
  if (hour < 18)
    return tx('home.greetingAfternoon', 'Good afternoon')
  return tx('home.greetingEvening', 'Good evening')
})

const displayName = computed(() => userStore.userInfo?.realName || userStore.userInfo?.username || '')

const summary = computed(() => {
  const list = agentList.value || []
  return {
    agents: list.length,
    devices: list.reduce((sum, agent) => sum + (Number(agent.deviceCount) || 0), 0),
    activeToday: list.filter(agent => msSince(agent.lastConnectedAt) < DAY_MS).length,
  }
})

function agentInitial(agent: Agent) {
  const name = (agent.agentName || '').trim()
  return name ? Array.from(name)[0].toUpperCase() : '?'
}

function agentModelLine(agent: Agent) {
  const voice = agent.ttsVoiceName || agent.ttsModelName
  return [agent.llmModelName, voice].filter(Boolean).join(' · ')
}

function agentTagText(agent: Agent) {
  return (agent.tags || []).map(tag => tag.tagName).filter(Boolean).join(', ')
}

function formatCount(value: number) {
  return Number(value || 0).toLocaleString()
}

// Refresh list on page show
onShow(() => {
  console.log('Home onShow, refresh agent list')
  if (pagingRef.value) {
    pagingRef.value.refresh()
  }
})

onMounted(() => {
  uni.setNavigationBarTitle({
    title: t('home.pageTitle'),
  })
})
</script>

<template>
  <z-paging
    ref="pagingRef" v-model="agentList" :refresher-enabled="true" :auto-show-back-to-top="true"
    :loading-more-enabled="false" :show-loading-more="false" :hide-empty-view="false" :empty-view-text="t('home.emptyState')"
    empty-view-img="" :refresher-threshold="80"
    :paging-style="{ background: 'var(--nx-bg)' }"
    :back-to-top-style="{
      backgroundColor: 'var(--nx-surface)',
      borderRadius: '50%',
      width: '48px',
      height: '48px',
      boxShadow: 'var(--nx-shadow-2)',
    }" @query="queryList"
  >
    <!-- Large title header -->
    <template #top>
      <view class="home-header" :style="{ paddingTop: `${safeAreaInsets?.top || 0}px` }">
        <view class="home-header__row">
          <view class="home-header__text">
            <text class="home-header__eyebrow">
              {{ displayName ? `${greeting}, ${displayName}` : greeting }}
            </text>
            <text class="home-header__title">
              {{ tx('home.title', 'Your robots') }}
            </text>
          </view>
          <view
            class="home-header__add"
            role="button"
            :aria-label="t('home.createAgent')"
            @click="openCreateDialog"
          >
            <wd-icon name="add" size="22px" />
          </view>
        </view>
      </view>
    </template>

    <view class="home-body">
      <!-- First load: skeleton -->
      <template v-if="!firstLoaded">
        <view class="nx-card home-summary">
          <view v-for="n in 3" :key="n" class="home-stat">
            <view class="nx-skeleton home-skel-label" />
            <view class="nx-skeleton home-skel-value" />
          </view>
        </view>
        <view v-for="n in 3" :key="`s${n}`" class="nx-card agent-card agent-card--skeleton">
          <view class="nx-skeleton agent-card__avatar" />
          <view class="agent-card__main">
            <view class="nx-skeleton home-skel-title" />
            <view class="nx-skeleton home-skel-line" />
          </view>
        </view>
      </template>

      <template v-else-if="agentList.length">
        <!-- Summary -->
        <view class="nx-card home-summary">
          <view class="home-stat">
            <text class="home-stat__label">
              {{ tx('home.statAgents', 'Agents') }}
            </text>
            <text class="nx-num home-stat__value">
              {{ formatCount(summary.agents) }}
            </text>
          </view>
          <view class="home-stat">
            <text class="home-stat__label">
              {{ tx('home.statDevices', 'Devices') }}
            </text>
            <text class="home-stat__value nx-num">
              {{ formatCount(summary.devices) }}
            </text>
          </view>
          <view class="home-stat">
            <text class="home-stat__label">
              {{ tx('home.statActiveToday', 'Active today') }}
            </text>
            <text class="home-stat__value nx-num">
              {{ formatCount(summary.activeToday) }}
            </text>
          </view>
        </view>

        <view class="nx-group__header home-section">
          {{ tx('home.agentsSection', 'Agents') }}
        </view>

        <!-- Agent cards -->
        <view class="agent-list">
          <view v-for="agent in agentList" :key="agent.id" class="agent-item">
            <wd-swipe-action>
              <view class="agent-card" @click="handleCardClick(agent)">
                <view class="agent-card__avatar">
                  {{ agentInitial(agent) }}
                </view>
                <view class="agent-card__main">
                  <text class="nx-truncate agent-card__name" :title="agent.agentName">
                    {{ agent.agentName }}
                  </text>
                  <text v-if="agentModelLine(agent)" class="nx-truncate agent-card__models">
                    {{ agentModelLine(agent) }}
                  </text>
                  <view class="agent-card__meta">
                    <view class="agent-card__status">
                      <view class="nx-dot" :class="{ 'nx-dot--online agent-card__pulse': isActiveNow(agent) }" />
                      <text class="nx-num">
                        {{ tx('home.deviceCount', '{count} devices', { count: formatCount(agent.deviceCount) }) }}
                      </text>
                    </view>
                    <text v-if="agent.lastConnectedAt" class="nx-truncate agent-card__time">
                      {{ isActiveNow(agent) ? tx('home.activeNow', 'Active now') : formatTime(agent.lastConnectedAt) }}
                    </text>
                  </view>
                  <text v-if="agentTagText(agent)" class="nx-truncate agent-card__tags">
                    {{ agentTagText(agent) }}
                  </text>
                </view>
                <wd-icon name="arrow-right" size="16px" custom-class="agent-card__chevron" />
              </view>

              <template #right>
                <view class="swipe-actions">
                  <view class="swipe-actions__delete" role="button" @click.stop="openDeleteAgentDialog(agent)">
                    <wd-icon name="delete" size="20px" />
                    <text>{{ t('home.delete') }}</text>
                  </view>
                </view>
              </template>
            </wd-swipe-action>
          </view>
        </view>
        <view class="nx-group__footer home-hint">
          {{ tx('home.swipeHint', 'Swipe left on an agent to delete it.') }}
        </view>
      </template>
    </view>

    <!-- Empty and error states -->
    <template #empty="{ isLoadFailed }">
      <view class="nx-empty">
        <view class="nx-icon-tile nx-icon-tile--lg" :class="{ 'nx-icon-tile--neutral': isLoadFailed }">
          <wd-icon :name="isLoadFailed ? 'warning' : 'chat'" size="28px" />
        </view>
        <text class="nx-empty__title">
          {{ isLoadFailed ? tx('home.loadFailedTitle', 'Couldn’t load your agents') : t('home.emptyState') }}
        </text>
        <text class="nx-empty__text">
          {{ isLoadFailed
            ? tx('home.loadFailedText', 'Check your connection and try again.')
            : tx('home.emptyText', 'Create your first agent to give your robot a personality and a voice.') }}
        </text>
        <view
          class="nx-btn nx-btn--primary home-empty-btn"
          role="button"
          @click="isLoadFailed ? pagingRef?.reload() : openCreateDialog()"
        >
          <wd-icon :name="isLoadFailed ? 'refresh' : 'add'" size="18px" />
          {{ isLoadFailed ? tx('home.retry', 'Try again') : t('home.createAgent') }}
        </view>
      </view>
    </template>

    <!-- MessageBox component -->
    <wd-message-box />
  </z-paging>

  <wd-popup
    v-model="deleteDialogVisible"
    position="center"
    custom-class="nx-dialog"
    :close-on-click-modal="!deleteAgentLoading"
    safe-area-inset-bottom
    @close="closeDeleteAgentDialog"
  >
    <view class="delete-agent-dialog">
      <view class="delete-agent-header">
        <view class="nx-icon-tile delete-agent-icon">
          <wd-icon name="delete" size="22px" />
        </view>
        <text class="delete-agent-title">
          {{ t('home.deleteConfirmTitle') }}
        </text>
      </view>

      <view class="delete-agent-body">
        <text
          class="delete-agent-copy-guard delete-agent-tip"
          @copy.stop.prevent
          @cut.stop.prevent
          @contextmenu.stop.prevent
          @longpress.stop.prevent
        >
          {{ t('home.confirmDeleteAgent', { agentName: deleteTargetAgent?.agentName || '' }) }}
        </text>
        <view
          class="delete-agent-copy-guard delete-agent-target"
          @copy.stop.prevent
          @cut.stop.prevent
          @contextmenu.stop.prevent
          @longpress.stop.prevent
        >
          <text>{{ deleteTargetAgent?.agentName || '' }}</text>
        </view>

        <input
          v-model="deleteConfirmText"
          class="delete-agent-input"
          type="text"
          :maxlength="deleteTargetAgent?.agentName?.length || 64"
          :placeholder="t('home.deleteAgentNamePlaceholder')"
          placeholder-class="delete-agent-placeholder"
          :disabled="deleteAgentLoading"
          @paste.stop.prevent="handleDeleteAgentPaste"
          @drop.stop.prevent="handleDeleteAgentPaste"
          @contextmenu.stop.prevent
        >
        <text v-if="deleteConfirmText && !isDeleteAgentNameMatched" class="delete-agent-helper">
          {{ t('home.deleteAgentNameMismatch') }}
        </text>
      </view>

      <view class="delete-agent-footer">
        <view
          class="nx-btn delete-agent-button"
          :class="{ 'is-disabled': deleteAgentLoading }"
          role="button"
          @click="closeDeleteAgentDialog"
        >
          {{ t('common.cancel') }}
        </view>
        <view
          class="nx-btn delete-agent-button delete-agent-button--danger"
          :class="{ 'is-disabled': !isDeleteAgentNameMatched || deleteAgentLoading }"
          role="button"
          @click="handleDeleteAgent"
        >
          <wd-loading v-if="deleteAgentLoading" size="16px" custom-class="delete-agent-spinner" />
          {{ t('common.delete') }}
        </view>
      </view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
// ---------- Header
.home-header {
  padding-left: var(--nx-gutter);
  padding-right: var(--nx-gutter);
  background: var(--nx-bg);

  &__row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--nx-space-3);
    padding: var(--nx-space-5) 0 var(--nx-space-4);
  }
  &__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  &__eyebrow {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--nx-text-callout);
    font-weight: 500;
    color: var(--nx-text-2);
  }
  &__title {
    margin-top: var(--nx-space-1);
    font-size: var(--nx-text-display);
    font-weight: 700;
    letter-spacing: -0.022em;
    line-height: 1.15;
    color: var(--nx-text);
  }
  &__add {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: var(--nx-touch);
    height: var(--nx-touch);
    border-radius: 50%;
    background: var(--nx-accent);
    color: var(--nx-on-accent);
    box-shadow: var(--nx-shadow-2);
    transition: transform var(--nx-dur-1) var(--nx-ease);
    &:active {
      transform: scale(0.94);
      background: var(--nx-accent-hover);
    }
  }
}

.home-body {
  padding: 0 var(--nx-gutter) calc(var(--nx-space-7) + env(safe-area-inset-bottom));
}

// ---------- Summary
.home-summary {
  display: flex;
  margin-bottom: var(--nx-space-5);
  padding: var(--nx-space-4) 0;
}
.home-stat {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-1);
  padding: 0 var(--nx-space-4);
  &:not(:last-child) {
    border-right: 1rpx solid var(--nx-border);
  }
  &__label {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  &__value {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--nx-text-title);
    font-weight: 700;
    letter-spacing: -0.018em;
    color: var(--nx-text);
  }
}

.home-section {
  padding-left: var(--nx-space-2);
}
.home-hint {
  margin-top: var(--nx-space-2);
  text-align: center;
}

.home-skel-label {
  width: 70%;
  height: 24rpx;
}
.home-skel-value {
  width: 40%;
  height: 44rpx;
}
.home-skel-title {
  width: 55%;
  height: 32rpx;
}
.home-skel-line {
  width: 80%;
  height: 24rpx;
  margin-top: var(--nx-space-2);
}

// ---------- Agent cards
.agent-list {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
}

.agent-item {
  overflow: hidden;
  border-radius: var(--nx-radius-lg);
  background: var(--nx-surface);
  box-shadow: var(--nx-shadow-1);
}

.agent-card {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  padding: var(--nx-space-4);
  background: var(--nx-surface);
  transition: background var(--nx-dur-1) var(--nx-ease);
  &:active {
    background: var(--nx-surface-2);
  }
  &--skeleton {
    margin-bottom: var(--nx-space-3);
  }

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 88rpx;
    height: 88rpx;
    border-radius: var(--nx-radius);
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-headline);
    font-weight: 700;
  }
  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  &__name {
    display: block;
    font-size: var(--nx-text-headline);
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--nx-text);
  }
  &__models {
    display: block;
    margin-top: 4rpx;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  &__meta {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    min-width: 0;
    margin-top: var(--nx-space-2);
    font-size: var(--nx-text-caption);
    color: var(--nx-text-2);
  }
  &__status {
    display: flex;
    align-items: center;
    gap: var(--nx-space-1);
    flex: none;
    font-weight: 500;
  }
  &__time {
    flex: 1;
    color: var(--nx-text-3);
  }
  &__tags {
    display: block;
    margin-top: var(--nx-space-1);
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
}

:deep(.agent-card__chevron) {
  flex: none;
  color: var(--nx-text-3);
}

.agent-card__pulse {
  animation: nx-pulse 2.4s ease-in-out infinite;
}
@keyframes nx-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
@media (prefers-reduced-motion: reduce) {
  .agent-card__pulse {
    animation: none;
  }
}

.swipe-actions {
  display: flex;
  height: 100%;
  &__delete {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--nx-space-1);
    width: 144rpx;
    background: var(--nx-danger);
    color: var(--nx-on-accent);
    font-size: var(--nx-text-caption);
    font-weight: 600;
    &:active {
      opacity: 0.85;
    }
  }
}

.home-empty-btn {
  margin-top: var(--nx-space-3);
}

// ---------- Delete dialog
:deep(.wd-popup.nx-dialog) {
  width: 86%;
  max-width: 840rpx;
  overflow: hidden;
  border-radius: var(--nx-radius-xl);
  background: var(--nx-surface);
  box-shadow: var(--nx-shadow-3);
}

.delete-agent-dialog {
  background: var(--nx-surface);
}

.delete-agent-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--nx-space-3);
  padding: var(--nx-space-5) var(--nx-space-5) 0;
}

.delete-agent-icon {
  background: var(--nx-danger-soft);
  color: var(--nx-danger);
}

.delete-agent-title {
  font-size: var(--nx-text-headline);
  font-weight: 600;
  color: var(--nx-text);
}

.delete-agent-body {
  padding: var(--nx-space-3) var(--nx-space-5) var(--nx-space-4);
}

.delete-agent-tip {
  display: block;
  color: var(--nx-text-2);
  font-size: var(--nx-text-callout);
  line-height: 1.5;
}

.delete-agent-target {
  box-sizing: border-box;
  width: 100%;
  margin-top: var(--nx-space-3);
  padding: var(--nx-space-2) var(--nx-space-3);
  border-radius: var(--nx-radius-sm);
  background: var(--nx-surface-2);
  color: var(--nx-text);
  font-size: var(--nx-text-body);
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.delete-agent-copy-guard {
  user-select: none;
  -webkit-user-select: none;
}

.delete-agent-input {
  box-sizing: border-box;
  width: 100%;
  height: var(--nx-touch);
  margin-top: var(--nx-space-3);
  padding: 0 var(--nx-space-3);
  border: 1rpx solid var(--nx-border-strong);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);
  color: var(--nx-text);
  font-size: var(--nx-text-body);
}

:deep(.delete-agent-placeholder) {
  color: var(--nx-text-3);
}

.delete-agent-helper {
  display: block;
  margin-top: var(--nx-space-1);
  color: var(--nx-danger);
  font-size: var(--nx-text-caption);
  line-height: 1.4;
}

.delete-agent-footer {
  display: flex;
  gap: var(--nx-space-2);
  padding: 0 var(--nx-space-5) var(--nx-space-5);
}

.delete-agent-button {
  flex: 1;
  min-width: 0;
  padding: 0 var(--nx-space-3);
  &--danger {
    background: var(--nx-danger);
    color: var(--nx-on-accent);
  }
  &.is-disabled {
    opacity: 0.45;
    pointer-events: none;
  }
}

:deep(.delete-agent-spinner) {
  margin-right: var(--nx-space-1);
}
</style>
