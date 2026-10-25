<!-- One conversation as a ruled transcript: the person's lines in message ink at the right,
     TinyBot's in ink at the left, recordings to play, the transcript to download (owner: m-messages) -->
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
import type { ChatMessage } from '@/api/chat-history/types'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, nextTick, reactive, ref } from 'vue'
import { getAudioId, getChatHistory } from '@/api/chat-history/chat-history'
import { http } from '@/http/request/alova'
import { getCurrentLanguage, t } from '@/i18n'
import { debounce, getEnvBaseUrl } from '@/utils'
import { notifyRequestError } from '@/utils/requestError'
import { robot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'
import { firstLine, lineContent, speakerOf, stampText, TOOL_FOLD, withTimeMarks } from '../messages/messagesModel.mjs'

defineOptions({ name: 'ChatDetail' })

const lang = computed(() => getCurrentLanguage())
const sessionId = ref('')
const agentId = ref('')
const badLink = ref(false)

const messageList = ref<ChatMessage[]>([])
const loading = ref(false)
const failed = ref(false)

const audioContext = ref<UniApp.InnerAudioContext | null>(null)
const playingAudioId = ref<string | null>(null)
const openTools = reactive<Record<string, boolean>>({})
const toolFold = TOOL_FOLD

const transcript = computed(() => withTimeMarks(messageList.value))
const words = computed(() => ({ today: t('mmsg.today'), yesterday: t('mmsg.yesterday') }))
const stamp = (v: string) => stampText(v, lang.value, words.value)
const title = computed(() => {
  const first = messageList.value[0]?.createdAt
  const when = first ? stamp(first) : ''
  return when ? t('mmsg.conv.transcript', { when }) : t('mmsg.conv.title')
})
const botName = computed(() => robot.name || t('nav.robotFallback'))

async function loadChatHistory() {
  if (!sessionId.value || !agentId.value)
    return
  loading.value = true
  try {
    const response = await getChatHistory(agentId.value, sessionId.value)
    messageList.value = Array.isArray(response) ? response : []
    failed.value = false
    // the legacy screen opens at the newest line
    nextTick(() => uni.pageScrollTo({ scrollTop: 999999, duration: 0 }))
  }
  catch (e) {
    failed.value = true
    notifyRequestError(e, 'chatHistory.loadFailed')
  }
  finally {
    loading.value = false
  }
}

const who = (line: ChatMessage) => speakerOf(line)
const content = (line: ChatMessage) => lineContent(line.content)
function whoLabel(line: ChatMessage) {
  const w = who(line)
  if (w === 'person')
    return content(line).speaker || t('mmsg.conv.you')
  if (w === 'tool')
    return t('mmsg.conv.tool')
  return botName.value
}
const isOpenTool = (key: string, i: number) => !!openTools[`${key}-${i}`]
function toggleTool(key: string, i: number) {
  const k = `${key}-${i}`
  openTools[k] = !openTools[k]
}

// ---------------------------------------------------------------- recordings (legacy behaviour)
function dropAudio() {
  if (audioContext.value) {
    audioContext.value.destroy()
    audioContext.value = null
  }
}
const playAudio = debounce(async (audioId: string) => {
  if (!audioId) {
    toast.error(t('mmsg.conv.noAudio'))
    return
  }
  try {
    if (audioContext.value)
      audioContext.value.stop()
    // a second press on the line that plays stops it
    if (playingAudioId.value === audioId) {
      playingAudioId.value = null
      return
    }
    const downloadId = await getAudioId(audioId)
    if (!audioContext.value)
      audioContext.value = uni.createInnerAudioContext()
    audioContext.value.src = `${getEnvBaseUrl()}/agent/play/${downloadId}`
    playingAudioId.value = audioId
    audioContext.value.onEnded(() => {
      playingAudioId.value = null
      dropAudio()
    })
    audioContext.value.onError(() => {
      toast.error(t('mmsg.conv.playFailed'))
      playingAudioId.value = null
      dropAudio()
    })
    audioContext.value.play()
  }
  catch {
    toast.error(t('mmsg.conv.playFailed'))
    playingAudioId.value = null
  }
}, 400)

// ---------------------------------------------------------------- download (same calls as manager-web)
const downloading = ref('')
async function download(kind: 'current' | 'previous') {
  if (!sessionId.value || !agentId.value || downloading.value)
    return
  downloading.value = kind
  try {
    // TODO(shared): move to src/api/chat-history as getChatDownloadUrl (see the owner's change request)
    const uuid = await http.Post<string>(`/agent/chat-history/getDownloadUrl/${agentId.value}/${sessionId.value}`, {}, { meta: { ignoreAuth: false, toast: false } as any })
    if (!uuid)
      throw new Error('no link')
    const url = `${getEnvBaseUrl()}/agent/chat-history/download/${uuid}/${kind}`
    // #ifdef H5
    window.open(url, '_blank')
    // #endif
    // #ifdef APP-PLUS
    plus.runtime.openURL(url)
    // #endif
    // #ifndef H5 || APP-PLUS
    uni.setClipboardData({ data: url })
    // #endif
  }
  catch {
    toast.error(t('mmsg.conv.downloadFailed'))
  }
  finally {
    downloading.value = ''
  }
}

onLoad((options: any) => {
  if (options?.sessionId && options?.agentId) {
    sessionId.value = decodeURIComponent(String(options.sessionId))
    agentId.value = decodeURIComponent(String(options.agentId))
  }
  else {
    badLink.value = true
    toast.error(t('chatHistory.parameterError'))
  }
})
onShow(() => {
  loadChatHistory()
})
onUnload(() => {
  if (audioContext.value) {
    audioContext.value.stop()
    dropAudio()
  }
})
</script>

<template>
  <view class="tb-wrap chat">
    <tb-page-header :title="title" back />

    <view v-if="badLink" class="chat__state">
      <tb-empty face="confused" :title="t('mmsg.conv.badLink')" />
    </view>

    <view v-else-if="loading && !messageList.length" class="chat__state">
      <tb-loading :label="t('common.loading')" />
    </view>

    <view v-else-if="failed && !messageList.length" class="chat__state">
      <tb-empty face="confused" :title="t('common.loadFailed')">
        <tb-button icon="refresh" @click="loadChatHistory">
          {{ t('common.retry') }}
        </tb-button>
      </tb-empty>
    </view>

    <view v-else-if="!messageList.length" class="chat__state">
      <tb-empty face="sleepy" :title="t('mmsg.conv.empty')">
        <tb-button icon="refresh" @click="loadChatHistory">
          {{ t('mmsg.refresh') }}
        </tb-button>
      </tb-empty>
    </view>

    <block v-else>
      <view class="tx">
        <block v-for="item in transcript" :key="item.key">
          <view v-if="item.mark" class="tx-mark">
            <text class="tb-num">
              {{ stamp(item.at) }}
            </text>
          </view>
          <view v-else class="tx-line" :class="`is-${who(item.line)}`">
            <view class="tx-line__head">
              <text class="tx-line__who">
                {{ whoLabel(item.line) }}
              </text>
              <view
                v-if="item.line.audioId" class="tx-play" :class="{ 'is-playing': playingAudioId === item.line.audioId }" role="button"
                :aria-pressed="playingAudioId === item.line.audioId ? 'true' : 'false'"
                :aria-label="playingAudioId === item.line.audioId ? t('mmsg.conv.stop') : t('mmsg.conv.play')"
                @click="playAudio(item.line.audioId)"
              >
                <view class="tx-play__dot">
                  <tb-icon :name="playingAudioId === item.line.audioId ? 'stop' : 'play'" :size="14" />
                </view>
              </view>
            </view>
            <view class="tx-line__said">
              <block v-for="(p, i) in content(item.line).parts" :key="i">
                <text v-if="p.type === 'text'" class="tx-line__text">
                  {{ p.text }}
                </text>
                <view v-else class="tx-line__tool">
                  <text class="tx-line__tooltag">
                    {{ t('mmsg.conv.tool') }}
                  </text>
                  <text v-if="p.type !== 'tool_result' || p.text.length <= toolFold" class="tx-line__tooltext">
                    {{ p.text }}
                  </text>
                  <block v-else>
                    <text class="tx-line__tooltext">
                      {{ isOpenTool(item.key, i) ? p.text : firstLine(p.text) }}
                    </text>
                    <view class="tx-line__fold" role="button" :aria-expanded="isOpenTool(item.key, i) ? 'true' : 'false'" @click="toggleTool(item.key, i)">
                      <text>{{ isOpenTool(item.key, i) ? t('mmsg.conv.toolLess') : t('mmsg.conv.toolMore') }}</text>
                      <tb-icon :name="isOpenTool(item.key, i) ? 'chevron-up' : 'chevron-down'" :size="14" />
                    </view>
                  </block>
                </view>
              </block>
            </view>
          </view>
        </block>
      </view>

      <view class="chat__downloads">
        <tb-button block icon="download" :loading="downloading === 'current'" @click="download('current')">
          {{ t('mmsg.conv.download') }}
        </tb-button>
        <tb-button block variant="quiet" icon="download" :loading="downloading === 'previous'" @click="download('previous')">
          {{ t('mmsg.conv.downloadPrev') }}
        </tb-button>
      </view>
    </block>
    <view class="chat__end" />
  </view>
</template>

<style lang="scss">
.chat__state {
  padding: 32px 0;
  display: flex;
  justify-content: center;
}
.chat__end {
  height: calc(24px + env(safe-area-inset-bottom));
}
.chat__downloads {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 16px;
}

.tx {
  display: flex;
  flex-direction: column;
}
.tx-mark {
  padding: 14px 0 4px;
  color: var(--tb-ink-2);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}
.tx-line {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.tx-line__head {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
}
.tx-line__who {
  font-size: 12px;
  font-weight: 700;
  color: var(--tb-ink-2);
}
.tx-line__said {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tx-line__text {
  font-size: 16px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.tx-line.is-bot,
.tx-line.is-tool {
  padding-right: 12%;
}
.tx-line.is-person {
  padding-left: 12%;
  align-items: flex-end;
  text-align: right;
}
.tx-line.is-person .tx-line__head {
  flex-direction: row-reverse;
}
.tx-line.is-person .tx-line__said {
  align-items: flex-end;
}
.tx-line.is-person .tx-line__text,
.tx-line.is-person .tx-line__who {
  color: var(--tb-message);
}
.tx-line__tool {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  padding: 6px 0 2px;
  border-top: 1px dashed var(--tb-rule-soft);
  font-size: 13px;
  color: var(--tb-ink-2);
}
.tx-line__tool:first-child {
  border-top: 0;
  padding-top: 0;
}
.tx-line__tooltag {
  font-size: 12px;
  font-weight: 600;
}
.tx-line__tooltext {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.tx-line__fold {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  color: var(--tb-ink);
  font-weight: 600;
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* a 44px target around a 28px ring */
.tx-play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -8px 0;
  color: var(--tb-ink);
}
.tx-line.is-person .tx-play {
  color: var(--tb-message);
}
.tx-play__dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  transition:
    background-color var(--tb-t-hover) var(--tb-ease),
    color var(--tb-t-hover) var(--tb-ease);
}
.tx-play.is-playing .tx-play__dot {
  background: var(--tb-action);
  border-color: var(--tb-action);
  color: var(--tb-on-action);
}
</style>
