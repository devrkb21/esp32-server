<script lang="ts" setup>
import type { ChatSession } from '@/api/chat-history/types'
import { computed, onMounted, ref } from 'vue'
import { getChatSessions } from '@/api/chat-history/chat-history'
import { t } from '@/i18n'
import { deepClone } from '@/utils'

defineOptions({
  name: 'ChatHistory',
})

const props = withDefaults(defineProps<Props>(), {
  agentId: 'default',
})

// Receive props
interface Props {
  agentId?: string
}

/** Translate with an English fallback for keys still waiting in src/i18n/_pending */
function tx(key: string, fallback: string) {
  const text = t(key)
  return text === key ? fallback : text
}

// Chat session data
const sessionList = ref<ChatSession[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const currentPage = ref(0)
const pageSize = 10

// Use provided agent ID
const currentAgentId = computed(() => {
  return props.agentId
})

// Load chat session list
async function loadChatSessions(page = 1, isUpdate = false) {
  try {
    // Check whether agent is currently selected
    if (!currentAgentId.value) {
      console.warn(t('chatHistory.noSelectedAgent'))
      sessionList.value = []
      return
    }

    if (page === 1) {
      loading.value = true
    }
    else {
      loadingMore.value = true
    }

    const response = await getChatSessions(currentAgentId.value, {
      page,
      limit: pageSize,
    })

    if (page === 1) {
      const oldSessionList = deepClone(sessionList.value)
      oldSessionList.splice(0, 10)
      oldSessionList.unshift(...(response.list || []))
      sessionList.value = isUpdate ? oldSessionList : response.list || []
    }
    else {
      sessionList.value.push(...(response.list || []))
    }

    // Update pagination info
    hasMore.value = (response.list?.length || 0) === pageSize
    currentPage.value = page
  }
  catch (error) {
    console.error(t('chatHistory.getChatSessionsFailed'), error)
    if (page === 1) {
      sessionList.value = []
    }
  }
  finally {
    loading.value = false
    loadingMore.value = false
  }
}

// Refresh method exposed to parent
async function refresh() {
  currentPage.value = 1
  hasMore.value = true
  await loadChatSessions(1, true)
}

// Load more method exposed to parent
async function loadMore() {
  if (!hasMore.value || loadingMore.value) {
    return
  }
  await loadChatSessions(currentPage.value + 1)
}

// Format time
function formatTime(timeStr: string) {
  if (!timeStr)
    return t('chatHistory.unknownTime')

  // Handle time string format
  const date = new Date(timeStr.replace(' ', 'T')) // Convert to ISO format
  const now = new Date()

  // Check if date is valid
  if (Number.isNaN(date.getTime())) {
    return timeStr // Return original string if parse fails
  }

  const diff = now.getTime() - date.getTime()

  // Less than 1 minute
  if (diff < 60000)
    return t('chatHistory.justNow')

  // Less than 1 hour
  if (diff < 3600000)
    return t('chatHistory.minutesAgo', { minutes: Math.floor(diff / 60000) })

  // Less than 1 day (24 hours)
  if (diff < 86400000)
    return t('chatHistory.hoursAgo', { hours: Math.floor(diff / 3600000) })

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return t('chatHistory.daysAgo', { days })
  }

  // Over 7 days, show exact date
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const currentYear = now.getFullYear()

  // Do not display year if current year
  if (year === currentYear) {
    return `${month}-${day}`
  }

  return `${year}-${month}-${day}`
}

// Enter chat details
function goToChatDetail(session: ChatSession) {
  uni.navigateTo({
    url: `/pages/chat-history/detail?sessionId=${session.sessionId}&agentId=${currentAgentId.value}`,
  })
}

onMounted(async () => {
  // Agent simplified to default
  loadChatSessions(1)
})

onShow(() => {
  if (currentPage.value !== 0) {
    loadChatSessions(1, true)
  }
})

// Expose method to parent
defineExpose({
  refresh,
  loadMore,
})
</script>

<template>
  <view class="chats">
    <view class="nx-large-title">
      <view class="nx-large-title__title">
        {{ tx('chatHistory.listTitle', 'Conversations') }}
      </view>
      <view class="nx-large-title__subtitle">
        {{ tx('chatHistory.listSubtitle', 'What your robot talked about, newest first.') }}
      </view>
    </view>

    <!-- Loading skeleton -->
    <view v-if="loading && sessionList.length === 0" class="nx-group">
      <view class="nx-group__body">
        <view v-for="i in 5" :key="i" class="nx-row">
          <view class="nx-skeleton chats__skeleton-icon" />
          <view class="nx-row__main">
            <view class="nx-skeleton chats__skeleton-line" />
            <view class="nx-skeleton chats__skeleton-line chats__skeleton-line--short" />
          </view>
        </view>
      </view>
    </view>

    <!-- Session list -->
    <view v-else-if="sessionList.length > 0" class="nx-group">
      <view class="nx-group__body">
        <view
          v-for="session in sessionList"
          :key="session.sessionId"
          class="nx-row nx-row--tap"
          @click="goToChatDetail(session)"
        >
          <view class="nx-icon-tile chats__icon">
            <wd-icon name="chat" size="18px" />
          </view>
          <view class="nx-row__main">
            <view class="chats__line">
              <view
                class="nx-row__title nx-truncate chats__title"
                :title="session.title || session.sessionId"
              >
                {{ session.title || `${t('chatHistory.conversationRecord')} ${session.sessionId.substring(0, 8)}…` }}
              </view>
              <view class="nx-caption nx-num chats__time">
                {{ formatTime(session.createdAt) }}
              </view>
            </view>
            <view class="nx-row__subtitle nx-num">
              {{ t('chatHistory.totalChats', { count: session.chatCount }) }}
            </view>
          </view>
          <wd-icon name="arrow-right" size="16px" custom-class="nx-row__chevron" />
        </view>
      </view>

      <!-- Load more state -->
      <view v-if="loadingMore" class="chats__more" role="status">
        <wd-loading size="16px" />
        <text>{{ t('chatHistory.loading') }}</text>
      </view>

      <!-- No more data -->
      <view v-else-if="!hasMore && sessionList.length > 0" class="chats__more">
        {{ t('chatHistory.noMoreData') }}
      </view>
    </view>

    <!-- Empty state -->
    <view v-else-if="!loading" class="nx-empty">
      <view class="nx-icon-tile nx-icon-tile--lg">
        <wd-icon name="chat" size="28px" />
      </view>
      <view class="nx-empty__title">
        {{ t('chatHistory.noChatRecords') }}
      </view>
      <view class="nx-empty__text">
        {{ t('chatHistory.chatRecordsDescription') }}
      </view>
      <view class="nx-btn nx-btn--primary chats__empty-btn" @click="refresh">
        {{ tx('chatHistory.refresh', 'Refresh') }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.chats {
  position: relative;
  min-height: 100%;
  padding: 0 var(--nx-gutter) calc(var(--nx-space-7) + env(safe-area-inset-bottom));
  background: var(--nx-bg);
  box-sizing: border-box;

  &__icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: var(--nx-radius-sm);
  }

  &__line {
    display: flex;
    align-items: baseline;
    gap: var(--nx-space-2);
  }

  &__title {
    flex: 1;
    font-weight: 600;
  }

  &__time {
    flex: none;
  }

  &__more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--nx-space-1);
    padding: var(--nx-space-4) 0 0;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-3);
  }

  &__empty-btn {
    margin-top: var(--nx-space-3);
  }

  &__skeleton-icon {
    width: 64rpx;
    height: 64rpx;
  }

  &__skeleton-line {
    width: 65%;
    height: 28rpx;

    &--short {
      width: 30%;
      height: 22rpx;
      margin-top: 12rpx;
    }
  }
}
</style>
