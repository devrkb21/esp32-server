<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Chat Details"
  }
}
</route>

<script lang="ts" setup>
import type { ChatMessage, UserMessageContent } from '@/api/chat-history/types'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getAudioId, getChatHistory } from '@/api/chat-history/chat-history'
import { t } from '@/i18n'
import { debounce, getEnvBaseUrl } from '@/utils'
import { toast } from '@/utils/toast'

defineOptions({
  name: 'ChatDetail',
})

// Page parameters
const sessionId = ref('')
const agentId = ref('')

// Agent info (simplified)
const currentAgent = computed(() => {
  return {
    id: agentId.value,
    agentName: t('chatHistory.assistantName'),
  }
})

// Chat data
const messageList = ref<ChatMessage[]>([])
const loading = ref(false)

// Audio playback related
const audioContext = ref<UniApp.InnerAudioContext | null>(null)
const playingAudioId = ref<string | null>(null)
const expandedToolResults = ref({})

// Back to previous page
function goBack() {
  uni.navigateBack()
}

// Load chat records
async function loadChatHistory() {
  if (!sessionId.value || !agentId.value) {
    console.error('Missing required parameters')
    return
  }

  try {
    loading.value = true
    const response = await getChatHistory(agentId.value, sessionId.value)
    messageList.value = response
  }
  catch (error) {
    console.error('Failed to get chat records:', error)
    toast.error(t('chatHistory.loadFailed'))
  }
  finally {
    loading.value = false
  }
}

// Parse user message content
function parseUserMessage(content: string): UserMessageContent | null {
  try {
    return JSON.parse(content)
  }
  catch {
    return null
  }
}

// Get message display content
function getMessageContent(message: ChatMessage): string {
  if (message.chatType === 1) {
    // User message, parse JSON
    const parsed = parseUserMessage(message.content)
    return parsed ? parsed.content : message.content
  }
  else {
    // AI message, display directly
    return message.content
  }
}

// Get speaker name
function getSpeakerName(message: ChatMessage): string {
  if (message.chatType === 1) {
    const parsed = parseUserMessage(message.content)
    return parsed ? parsed.speaker : t('chatHistory.userName')
  }
  else {
    return currentAgent.value?.agentName || t('chatHistory.aiAssistantName')
  }
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

// Play audio
const playAudio = debounce(async (audioId: string) => {
  if (!audioId) {
    toast.error(t('chatHistory.invalidAudioId'))
    return
  }

  try {
    // Stop other audio if currently playing
    if (audioContext.value) {
      audioContext.value.stop()
    }
    // Pause playback if current audio ID matches requested ID
    if (playingAudioId.value === audioId) {
      playingAudioId.value = null
      return
    }

    // Get audio download ID
    const downloadId = await getAudioId(audioId)

    // Construct audio playback URL
    const baseUrl = getEnvBaseUrl()
    const audioUrl = `${baseUrl}/agent/play/${downloadId}`

    // Create audio context
    if (!audioContext.value) {
      audioContext.value = uni.createInnerAudioContext()
    }
    audioContext.value.src = audioUrl

    // Set playback state
    playingAudioId.value = audioId

    // Listen for playback completion
    audioContext.value.onEnded(() => {
      playingAudioId.value = null
      if (audioContext.value) {
        audioContext.value.destroy()
        audioContext.value = null
      }
    })

    // Listen for playback error
    audioContext.value.onError((error) => {
      console.error('Audio playback failed:', error)
      toast.error(t('chatHistory.audioPlayFailed'))
      playingAudioId.value = null
      if (audioContext.value) {
        audioContext.value.destroy()
        audioContext.value = null
      }
    })

    // Start playback
    audioContext.value.play()
  }
  catch (error) {
    console.error('Failed to play audio:', error)
    toast.error(t('chatHistory.playAudioFailed'))
    playingAudioId.value = null
  }
}, 400)

function extractContentFromString(content: string) {
  if (!content || content.trim() === '') {
    return content
  }

  // Try parsing as JSON
  try {
    const jsonObj = JSON.parse(content)

    // If array format (contains text and tool)
    if (Array.isArray(jsonObj)) {
      return jsonObj
    }

    // If object and has content field
    if (jsonObj && typeof jsonObj === 'object' && jsonObj.content) {
      return jsonObj.content
    }
  }
  catch (e) {
    // If not valid JSON, return original content
  }

  // If not JSON format or no content field, return original content
  return content
}

function toggleToolResult(messageIndex, itemIndex) {
  const key = `${messageIndex}-${itemIndex}`
  expandedToolResults.value[key] = !expandedToolResults.value[key]
}

function isToolResultCollapsed(messageIndex, itemIndex) {
  const key = `${messageIndex}-${itemIndex}`
  // Default collapsed (true means collapsed)
  return !expandedToolResults.value[key]
}

/** Show a centred time stamp before the first message and after a pause of 5+ minutes */
function showTimeBefore(index: number): boolean {
  if (index === 0)
    return true
  const cur = Date.parse(String(messageList.value[index]?.createdAt || '').replace(' ', 'T'))
  const prev = Date.parse(String(messageList.value[index - 1]?.createdAt || '').replace(' ', 'T'))
  if (Number.isNaN(cur) || Number.isNaN(prev))
    return false
  return cur - prev >= 5 * 60 * 1000
}

/** Speaker label for user messages recognised by voiceprint (empty for the default user) */
function userSpeaker(message: ChatMessage): string {
  if (message.chatType !== 1)
    return ''
  const name = getSpeakerName(message)
  return name && name !== t('chatHistory.userName') ? name : ''
}

/** Translate with an English fallback for keys still waiting in src/i18n/_pending */
function tx(key: string, fallback: string) {
  const text = t(key)
  return text === key ? fallback : text
}

function getFirstLineText(text: string) {
  if (!text) {
    return ''
  }
  const firstLine = text.split('\n')[0]
  return firstLine.length < text.length ? `${firstLine}...` : text
}

onLoad((options) => {
  if (options?.sessionId && options?.agentId) {
    sessionId.value = options.sessionId
    agentId.value = options.agentId
  }
  else {
    console.error('Missing required parameters')
    toast.error(t('chatHistory.parameterError'))
  }
})

onShow(() => {
  loadChatHistory()
})

// Clean up audio resources on page destroy
onUnload(() => {
  if (audioContext.value) {
    audioContext.value.stop()
    audioContext.value.destroy()
    audioContext.value = null
  }
})
</script>

<template>
  <view class="chat">
    <!-- Navigation bar -->
    <wd-navbar
      :title="t('chatHistory.pageTitle')"

      safe-area-inset-top placeholder fixed
      :bordered="false"
      custom-class="chat__nav"
    >
      <template #left>
        <view class="chat__back" role="button" :aria-label="tx('chatHistory.back', 'Back')" @click="goBack">
          <wd-icon name="arrow-left" size="20px" />
        </view>
      </template>
    </wd-navbar>

    <!-- Chat messages list -->
    <scroll-view
      scroll-y
      class="chat__scroll"
      :scroll-into-view="`message-${messageList.length - 1}`"
    >
      <view class="chat__body">
        <!-- Loading skeleton -->
        <view v-if="loading" class="chat__list" role="status" :aria-label="t('chatHistory.loading')">
          <view v-for="i in 4" :key="i" class="chat__item" :class="i % 2 ? 'is-robot' : 'is-user'">
            <view class="nx-skeleton chat__skeleton" :class="{ 'chat__skeleton--wide': i === 3 }" />
          </view>
        </view>

        <view v-else-if="!messageList.length" class="nx-empty">
          <view class="nx-icon-tile nx-icon-tile--lg">
            <wd-icon name="chat" size="28px" />
          </view>
          <view class="nx-empty__title">
            {{ t('chatHistory.noChatRecords') }}
          </view>
          <view class="nx-btn nx-btn--primary chat__retry" @click="loadChatHistory">
            {{ tx('chatHistory.refresh', 'Refresh') }}
          </view>
        </view>

        <view v-else class="chat__list">
          <view
            v-for="(message, index) in messageList"
            :id="`message-${index}`"
            :key="index"
            class="chat__item"
            :class="{
              'is-user': message.chatType === 1,
              'is-robot': message.chatType === 2,
              'is-tool': message.chatType === 3,
            }"
          >
            <view v-if="showTimeBefore(index)" class="nx-num chat__time">
              {{ formatTime(message.createdAt) }}
            </view>

            <view v-if="userSpeaker(message)" class="nx-truncate chat__speaker">
              {{ userSpeaker(message) }}
            </view>

            <view class="chat__bubble">
              <template v-if="Array.isArray(extractContentFromString(message.content))">
                <view v-for="(item, idx) in extractContentFromString(message.content)" :key="idx" class="chat__part">
                  <view v-if="item.type === 'text'" class="chat__text">
                    {{ item.text }}
                  </view>
                  <view v-else-if="item.type === 'tool'" class="chat__tool nx-mono nx-break">
                    <wd-icon name="tools" size="12px" />
                    {{ item.text }}
                  </view>
                  <view v-else-if="item.type === 'tool_result'" class="chat__tool nx-mono nx-break">
                    <view v-if="item.text && item.text.length > 80" class="chat__tool-result">
                      <view class="chat__tool-body" :class="{ 'is-collapsed': isToolResultCollapsed(index, idx) }">
                        {{ isToolResultCollapsed(index, idx) ? getFirstLineText(item.text) : item.text }}
                      </view>
                      <view
                        class="chat__tool-toggle"
                        role="button"
                        :aria-label="isToolResultCollapsed(index, idx) ? tx('chatHistory.expand', 'Show more') : tx('chatHistory.collapse', 'Show less')"
                        @click="toggleToolResult(index, idx)"
                      >
                        <wd-icon :name="isToolResultCollapsed(index, idx) ? 'arrow-down' : 'arrow-up'" size="12px" />
                      </view>
                    </view>
                    <view v-else>
                      {{ item.text }}
                    </view>
                  </view>
                </view>
              </template>

              <view v-else class="chat__content">
                <!-- Audio playback -->
                <view
                  v-if="message.audioId"
                  class="chat__play"
                  :class="{ 'is-playing': playingAudioId === message.audioId }"
                  role="button"
                  :aria-label="playingAudioId === message.audioId ? tx('chatHistory.stopAudio', 'Stop audio') : tx('chatHistory.playAudio', 'Play audio')"
                  @click="playAudio(message.audioId)"
                >
                  <wd-icon :name="playingAudioId === message.audioId ? 'pause' : 'play'" size="14px" />
                </view>
                <text class="chat__text">
                  {{ getMessageContent(message) }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100vh;
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

  &__scroll {
    flex: 1;
    height: 0;
  }

  &__body {
    padding: var(--nx-space-3) var(--nx-gutter) calc(var(--nx-space-6) + env(safe-area-inset-bottom));
    box-sizing: border-box;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-2);
  }

  &__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    &.is-user {
      align-items: flex-end;
    }
  }

  &__time {
    align-self: center;
    margin: var(--nx-space-3) 0 var(--nx-space-1);
    font-size: var(--nx-text-caption);
    font-weight: 500;
    color: var(--nx-text-3);
  }

  &__speaker {
    max-width: 70%;
    margin: 0 var(--nx-space-2) 4rpx;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }

  &__bubble {
    max-width: 80%;
    padding: var(--nx-space-2) var(--nx-space-3);
    border-radius: var(--nx-radius-lg);
    background: var(--nx-surface);
    box-shadow: var(--nx-shadow-1);
    color: var(--nx-text);
    font-size: var(--nx-text-body);
    line-height: 1.45;
    overflow-wrap: anywhere;
    word-break: break-word;
    box-sizing: border-box;
  }

  &__item.is-robot &__bubble {
    border-bottom-left-radius: var(--nx-radius-sm);
  }

  &__item.is-user &__bubble {
    border-bottom-right-radius: var(--nx-radius-sm);
    background: var(--nx-accent-soft);
    box-shadow: none;
  }

  &__item.is-tool &__bubble {
    background: var(--nx-surface-2);
    box-shadow: none;
  }

  &__content {
    display: flex;
    align-items: flex-start;
    gap: var(--nx-space-2);
  }

  &__text {
    display: block;
    min-width: 0;
    white-space: pre-wrap;
  }

  &__part + &__part {
    margin-top: var(--nx-space-1);
  }

  &__play {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 52rpx;
    height: 52rpx;
    margin-top: -2rpx;
    border-radius: 50%;
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    transition: transform var(--nx-dur-1) var(--nx-ease);

    &:active {
      transform: scale(0.92);
    }

    &.is-playing {
      background: var(--nx-accent);
      color: var(--nx-on-accent);
    }
  }

  &__item.is-user &__play {
    background: var(--nx-surface);
  }

  &__item.is-user &__play.is-playing {
    background: var(--nx-accent);
  }

  &__tool {
    display: block;
    padding: var(--nx-space-1) var(--nx-space-2);
    border-radius: var(--nx-radius-sm);
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    line-height: 1.5;
  }

  &__tool-result {
    position: relative;
    padding-right: 48rpx;
  }

  &__tool-body.is-collapsed {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__tool-toggle {
    position: absolute;
    top: -12rpx;
    right: -12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56rpx;
    height: 56rpx;
    color: var(--nx-accent);
  }

  &__skeleton {
    width: 360rpx;
    height: 72rpx;
    border-radius: var(--nx-radius-lg);

    &--wide {
      width: 480rpx;
      height: 120rpx;
    }
  }

  &__retry {
    margin-top: var(--nx-space-3);
  }
}

:deep(.chat__nav) {
  background: var(--nx-glass);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1rpx solid var(--nx-border);
}

@media (prefers-reduced-transparency: reduce) {
  :deep(.chat__nav) {
    background: var(--nx-surface);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
</style>
