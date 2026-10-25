<!-- Conversations: every chat session of a character, newest first, ten at a time (owner: m-messages).
     Opened as a page (?agentId=) and embedded by the agent screen (prop agentId, refresh / loadMore). -->
<route lang="jsonc">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Conversations"
  }
}
</route>

<script lang="ts" setup>
import type { ChatSession } from '@/api/chat-history/types'
import { onLoad, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, onMounted, ref } from 'vue'
import { getChatSessions } from '@/api/chat-history/chat-history'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { dateParts, mergeSessions, refreshFirstPage, SESSIONS_PAGE } from '../messages/messagesModel.mjs'

defineOptions({ name: 'ChatHistory' })

const props = withDefaults(defineProps<{ agentId?: string }>(), { agentId: '' })

const lang = computed(() => getCurrentLanguage())
const num = (n: any) => digits(n ?? '', lang.value)

// As a page the agent comes from the link; embedded, from the prop.
const isPage = ref(false)
const queryAgent = ref('')
const currentAgentId = computed(() => queryAgent.value || props.agentId || '')

const sessionList = ref<ChatSession[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const failed = ref(false)
const hasMore = ref(true)
const currentPage = ref(0)

async function loadChatSessions(page = 1, isUpdate = false) {
  if (!currentAgentId.value) {
    sessionList.value = []
    return
  }
  if (page === 1)
    loading.value = true
  else loadingMore.value = true
  try {
    const response = await getChatSessions(currentAgentId.value, { page, limit: SESSIONS_PAGE })
    const list = response?.list || []
    if (page === 1)
      sessionList.value = isUpdate ? refreshFirstPage(sessionList.value, list) : list
    else sessionList.value = mergeSessions(sessionList.value, list)
    hasMore.value = list.length === SESSIONS_PAGE
    currentPage.value = page
    failed.value = false
  }
  catch {
    failed.value = true
    if (page === 1 && !isUpdate)
      sessionList.value = []
  }
  finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function refresh() {
  currentPage.value = 1
  hasMore.value = true
  await loadChatSessions(1, true)
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value || loading.value)
    return
  await loadChatSessions(currentPage.value + 1)
}

const parts = (v: string) => dateParts(v, lang.value)
function sessionTitle(s: ChatSession) {
  if (s.title)
    return s.title
  const w = parts(s.createdAt).word
  if (w === 'today')
    return t('mmsg.today')
  if (w === 'yesterday')
    return t('mmsg.yesterday')
  return `${t('mmsg.conv.untitled')} ${s.sessionId.substring(0, 8)}`
}
function sessionSub(s: ChatSession) {
  const p = parts(s.createdAt)
  const bits = [p.word === 'older' ? `${p.day} ${p.month}` : '', p.time]
  if (s.chatCount)
    bits.push(t('mmsg.conv.lines', { n: num(s.chatCount > 99 ? '99+' : s.chatCount) }))
  return bits.filter(Boolean).join(' · ')
}

function goToChatDetail(session: ChatSession) {
  uni.navigateTo({
    url: `/pages/chat-history/detail?sessionId=${encodeURIComponent(session.sessionId)}&agentId=${encodeURIComponent(currentAgentId.value)}`,
  })
}

onLoad((q: any) => {
  isPage.value = true
  queryAgent.value = q?.agentId ? decodeURIComponent(String(q.agentId)) : ''
  loadChatSessions(1)
})
onMounted(() => {
  if (!isPage.value)
    loadChatSessions(1)
})
onShow(() => {
  if (currentPage.value !== 0)
    loadChatSessions(1, true)
})
onReachBottom(() => {
  loadMore()
})

defineExpose({ refresh, loadMore })
</script>

<template>
  <view class="chats" :class="{ 'tb-wrap': isPage }">
    <tb-page-header v-if="isPage" :title="t('mmsg.conv.title')" :description="t('mmsg.conv.desc')" back />

    <view v-if="!currentAgentId" class="chats__state">
      <tb-empty face="confused" :title="t('mmsg.conv.none')" :text="t('mmsg.conv.noAgent')" />
    </view>

    <view v-else-if="loading && !sessionList.length" class="chats__state">
      <tb-loading :label="t('common.loading')" />
    </view>

    <view v-else-if="failed && !sessionList.length" class="chats__state">
      <tb-empty face="confused" :title="t('common.loadFailed')">
        <tb-button icon="refresh" @click="refresh">
          {{ t('common.retry') }}
        </tb-button>
      </tb-empty>
    </view>

    <view v-else-if="!sessionList.length" class="chats__state">
      <tb-empty face="sleepy" :title="t('mmsg.conv.none')" :text="t('mmsg.conv.noneText')">
        <tb-button icon="refresh" @click="refresh">
          {{ t('mmsg.refresh') }}
        </tb-button>
      </tb-empty>
    </view>

    <block v-else>
      <view class="chats__rows">
        <view v-for="s in sessionList" :key="s.sessionId" class="chat-row" hover-class="is-press" role="button" @click="goToChatDetail(s)">
          <view class="chat-row__date">
            <text class="tb-num chat-row__day">
              {{ parts(s.createdAt).day }}
            </text>
            <text class="chat-row__month">
              {{ parts(s.createdAt).month }}
            </text>
          </view>
          <view class="chat-row__main">
            <text class="chat-row__title">
              {{ sessionTitle(s) }}
            </text>
            <text class="tb-num chat-row__sub">
              {{ sessionSub(s) }}
            </text>
          </view>
          <tb-icon name="chevron-right" :size="16" class="chat-row__go" />
        </view>
      </view>
      <view class="chats__foot">
        <tb-loading v-if="loadingMore" :label="t('common.loading')" />
        <tb-button v-else-if="hasMore" size="s" icon="chevron-down" @click="loadMore">
          {{ t('mmsg.conv.more') }}
        </tb-button>
        <text v-else class="chats__muted">
          {{ t('mmsg.conv.noMore') }}
        </text>
      </view>
    </block>
    <view v-if="isPage" class="chats__end" />
  </view>
</template>

<style lang="scss">
.chats__state {
  padding: 32px 0;
  display: flex;
  justify-content: center;
}
.chats__rows {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule);
  margin-top: 12px;
}
.chat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.chat-row.is-press {
  background: var(--tb-paper-2);
}
.chat-row__date {
  width: 52px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  padding-right: 12px;
  border-right: 1px solid var(--tb-rule-soft);
}
.chat-row__day {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 26px;
}
.chat-row__month {
  margin-top: 4px;
  font-size: 12px;
  color: var(--tb-ink-2);
}
.chat-row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.chat-row__title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-row__sub {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.chat-row__go {
  color: var(--tb-ink-3);
}
.chats__foot {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}
.chats__muted {
  color: var(--tb-ink-2);
  font-size: 13px;
}
.chats__end {
  height: calc(24px + env(safe-area-inset-bottom));
}
</style>
