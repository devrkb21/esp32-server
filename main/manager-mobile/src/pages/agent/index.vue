<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Agent",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import { t } from '@/i18n'
import ChatHistory from '@/pages/chat-history/index.vue'
import DeviceManagement from '@/pages/device/index.vue'
import VoiceprintManagement from '@/pages/voiceprint/index.vue'
import AgentEdit from './edit.vue'

defineOptions({
  name: 'AgentIndex',
})

// Get distance from screen boundary to safe area
let safeAreaInsets: any
let systemInfo: any

// #ifdef MP-WEIXIN
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
systemInfo = uni.getSystemInfoSync()
safeAreaInsets = systemInfo.safeAreaInsets
// #endif

// Agent ID
const currentAgentId = ref('default')

// Current tab
const currentTab = ref('agent-config')

// Refresh and loading status
const refreshing = ref(false)
const refresherEnabled = ref(false)

// Subcomponent ref
const deviceRef = ref()
const chatRef = ref()
const voiceprintRef = ref()

// Update refresher status
function updateRefresherEnabled(value: boolean) {
  refresherEnabled.value = value
}

// Pending copy (src/i18n/_pending/mobile-home-agents.ts): English fallback until merged
function tx(key: string, fallback: string) {
  const value = t(key)
  return value === key ? fallback : value
}

// Tab configuration (segmented control; full names stay available as accessibility labels)
const tabList = [
  { label: tx('agent.tabSetup', 'Setup'), fullLabel: t('agent.roleConfig'), value: 'agent-config' },
  { label: tx('agent.tabDevices', 'Devices'), fullLabel: t('agent.deviceManagement'), value: 'device-management' },
  { label: tx('agent.tabChats', 'Chats'), fullLabel: t('agent.chatHistory'), value: 'chat-history' },
  { label: tx('agent.tabVoiceprints', 'Voiceprints'), fullLabel: t('agent.voiceprintManagement'), value: 'voiceprint-management' },
]

function selectTab(item: typeof tabList[number]) {
  if (currentTab.value === item.value)
    return
  currentTab.value = item.value
  handleTabChange(item)
}

// Back to previous page
function goBack() {
  uni.navigateBack()
}

// Handle tab switch
function handleTabChange(item: any) {
  console.log('Tab changed:', item)
}

// Pull down to refresh
async function onRefresh() {
  // Role edit page does not need refresh
  if (currentTab.value === 'agent-config') {
    return
  }

  refreshing.value = true

  try {
    switch (currentTab.value) {
      case 'device-management':
        if (deviceRef.value?.refresh) {
          await deviceRef.value.refresh()
        }
        break
      case 'chat-history':
        if (chatRef.value?.refresh) {
          await chatRef.value.refresh()
        }
        break
      case 'voiceprint-management':
        if (voiceprintRef.value?.refresh) {
          await voiceprintRef.value.refresh()
        }
        break
    }
  }
  catch (error) {
    console.error('Refresh failed:', error)
  }
  finally {
    refreshing.value = false
  }
}

// Load more on scroll to bottom
async function onLoadMore() {
  // Only chat records need load more
  if (currentTab.value === 'chat-history' && chatRef.value?.loadMore) {
    await chatRef.value.loadMore()
  }
}

watch(() => currentTab.value, (newTab) => {
  updateRefresherEnabled(newTab !== 'agent-config')
})

// Receive page parameters
onLoad((options) => {
  if (options?.agentId) {
    currentAgentId.value = options.agentId
    console.log('Received agent ID:', options.agentId)
  }
})

onMounted(async () => {
  // Page initialization
})
</script>

<template>
  <view class="agent-shell">
    <!-- Navigation bar -->
    <view class="agent-nav" :style="{ paddingTop: `${safeAreaInsets?.top || 0}px` }">
      <view class="agent-nav__bar">
        <view class="agent-nav__back" role="button" :aria-label="tx('agent.navBack', 'Back')" @click="goBack">
          <wd-icon name="arrow-left" size="20px" />
        </view>
        <text class="nx-truncate agent-nav__title">
          {{ t('agent.pageTitle') }}
        </text>
        <view class="agent-nav__spacer" />
      </view>

      <!-- Sections -->
      <view class="nx-segmented agent-nav__tabs" role="tablist">
        <view
          v-for="item in tabList"
          :key="item.value"
          class="nx-segmented__item"
          :class="{ 'is-active': currentTab === item.value }"
          role="tab"
          :aria-selected="currentTab === item.value"
          :aria-label="item.fullLabel"
          @click="selectTab(item)"
        >
          <text class="nx-truncate">
            {{ item.label }}
          </text>
        </view>
      </view>
    </view>

    <!-- Main content scroll area -->
    <scroll-view
      scroll-y
      class="agent-scroll"
      enable-back-to-top
      :refresher-enabled="refresherEnabled"
      :refresher-triggered="refreshing"
      refresher-background="transparent"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <!-- Tab Content -->
      <view class="agent-content">
        <AgentEdit
          v-if="currentTab === 'agent-config'"
          :agent-id="currentAgentId"
        />
        <DeviceManagement
          v-else-if="currentTab === 'device-management'"
          ref="deviceRef"
          :agent-id="currentAgentId"
        />
        <ChatHistory
          v-else-if="currentTab === 'chat-history'"
          ref="chatRef"
          :agent-id="currentAgentId"
        />
        <VoiceprintManagement
          v-else-if="currentTab === 'voiceprint-management'"
          ref="voiceprintRef"
          :agent-id="currentAgentId"
          @update-refresher-enabled="updateRefresherEnabled"
        />
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.agent-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--nx-bg);
}

.agent-nav {
  flex: none;
  padding: 0 var(--nx-gutter) var(--nx-space-3);
  background: var(--nx-bg);
  border-bottom: 1rpx solid var(--nx-border);

  &__bar {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    height: var(--nx-touch);
  }
  &__back,
  &__spacer {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex: none;
    width: var(--nx-touch);
    height: var(--nx-touch);
    color: var(--nx-accent);
  }
  &__back:active {
    opacity: 0.6;
  }
  &__title {
    flex: 1;
    text-align: center;
    font-size: var(--nx-text-headline);
    font-weight: 600;
    color: var(--nx-text);
  }
  &__tabs {
    margin-top: var(--nx-space-1);
  }
}

.agent-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
}

.agent-content {
  min-height: 100%;
}
</style>
