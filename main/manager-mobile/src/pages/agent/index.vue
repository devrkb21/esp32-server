<!-- Character: this robot's character in four parts (setup, robots, chats, voiceprints). Owner: m-agent.
     Takes ?agentId=, else the character of "this robot". -->
<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Character",
    "navigationStyle": "custom",
    "enablePullDownRefresh": true
  }
}
</route>

<script lang="ts" setup>
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { computed, onMounted, ref } from 'vue'
import { t } from '@/i18n'
import ChatHistory from '@/pages/chat-history/index.vue'
import DeviceManagement from '@/pages/device/index.vue'
import VoiceprintManagement from '@/pages/voiceprint/index.vue'
import { loadRobots, robot } from '@/utils/tbRobot'
import AgentEdit from './edit.vue'

defineOptions({
  name: 'AgentIndex',
})

type Tab = 'agent-config' | 'device-management' | 'chat-history' | 'voiceprint-management'

const queryAgentId = ref('')
const currentAgentId = computed(() => queryAgentId.value || robot.agentId || '')
const currentTab = ref<Tab>('agent-config')

// Embedded screens expose refresh / loadMore
const deviceRef = ref()
const chatRef = ref()
const voiceprintRef = ref()

const tabList = computed(() => [
  { value: 'agent-config', label: t('mAgent.tab.setup') },
  { value: 'device-management', label: t('mAgent.tab.devices') },
  { value: 'chat-history', label: t('mAgent.tab.chats') },
  { value: 'voiceprint-management', label: t('mAgent.tab.voiceprints') },
])

const agentName = computed(() => robot.list.find(r => r.agentId === currentAgentId.value)?.agentName || '')
const description = computed(() => (agentName.value ? t('mAgent.indexLead', { name: agentName.value }) : t('mAgent.lead')))

// Pull down to refresh the open part (the setup part reloads itself after saving)
onPullDownRefresh(async () => {
  try {
    switch (currentTab.value) {
      case 'device-management':
        await deviceRef.value?.refresh?.()
        break
      case 'chat-history':
        await chatRef.value?.refresh?.()
        break
      case 'voiceprint-management':
        await voiceprintRef.value?.refresh?.()
        break
    }
  }
  catch (error) {
    console.error('Refresh failed:', error)
  }
  finally {
    uni.stopPullDownRefresh()
  }
})

// Only the chat list pages in more as you scroll
onReachBottom(() => {
  if (currentTab.value === 'chat-history')
    chatRef.value?.loadMore?.()
})

onLoad((options: any) => {
  if (options?.agentId)
    queryAgentId.value = decodeURIComponent(String(options.agentId))
})

function goRobots() { uni.navigateTo({ url: '/pages/robots/index' }) }

onMounted(() => {
  loadRobots()
})
</script>

<template>
  <view class="agx tb-wrap">
    <tb-page-header :title="t('nav.character')" :description="description" back />

    <view v-if="!currentAgentId && robot.loaded" class="agx__state">
      <tb-empty face="confused" :title="t('common.noRobot')" :text="t('common.noRobotText')">
        <tb-button variant="primary" icon="robots" @click="goRobots">
          {{ t('common.goRobots') }}
        </tb-button>
      </tb-empty>
    </view>

    <view v-else-if="!currentAgentId" class="agx__state">
      <tb-loading :label="t('mAgent.loading')" />
    </view>

    <block v-else>
      <view class="agx__tabs">
        <tb-choice v-model="currentTab" :options="tabList" :aria-label="t('mAgent.tab.label')" />
      </view>

      <view class="agx__body">
        <AgentEdit v-if="currentTab === 'agent-config'" :agent-id="currentAgentId" embedded />
        <DeviceManagement v-else-if="currentTab === 'device-management'" ref="deviceRef" :agent-id="currentAgentId" embedded />
        <ChatHistory v-else-if="currentTab === 'chat-history'" ref="chatRef" :agent-id="currentAgentId" />
        <VoiceprintManagement v-else-if="currentTab === 'voiceprint-management'" ref="voiceprintRef" :agent-id="currentAgentId" />
      </view>
    </block>
  </view>
</template>

<style lang="scss">
.agx__state { display: flex; justify-content: center; padding: 56px 0; }
.agx__tabs { padding: 12px 0; border-bottom: 1px solid var(--tb-rule); }
.agx__body { min-height: 50vh; }
</style>
