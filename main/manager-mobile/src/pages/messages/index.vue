<!-- Messages: tell TinyBot something, give it a one-tap command, see what reached it, read the conversations (owner: m-messages) -->
<route lang="jsonc">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "TinyBot"
  }
}
</route>

<script lang="ts" setup>
import type { ChatSession } from '@/api/chat-history/types'
import type { CommandType, CompanionCommand, CompanionDevice, CompanionMessage, GameName } from '@/api/companion/types'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { getChatSessions } from '@/api/chat-history/chat-history'
import { getCompanion, sendCompanionCommand, sendCompanionMessage } from '@/api/companion/companion'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { loadRobots, robot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'
import {
  agoParts,
  commandSync,
  dateParts,
  focusMinutes,
  MAX_MESSAGE,
  MAX_NAME,
  MAX_TOPIC,
  messageTs,
  messageWhen,
  sortMessages,
  statusOf,
  syncOf,
} from './messagesModel.mjs'

defineOptions({ name: 'MessagesPage' })

const FROM_KEY = 'companion_from' // the legacy key: the last "from" name is remembered
const REFRESH_MS = 10000 // the legacy poll while the screen is open
const PREVIEW = 5 // conversations shown here; the rest on the chat history screen

const lang = computed(() => getCurrentLanguage())
const num = (n: any) => digits(n ?? '', lang.value)

// ---------------------------------------------------------------- the robot's view
const view = ref<CompanionDevice | null>(null)
const loading = ref(false)
const failed = ref(false)
const refreshing = ref(false)
const offline = computed(() => !!view.value && view.value.online === false)

async function reload(quiet = false) {
  if (!robot.deviceId)
    return
  const want = robot.deviceId
  if (!quiet)
    loading.value = true
  try {
    const data = await getCompanion(want, quiet)
    if (want === robot.deviceId) {
      view.value = data || null
      failed.value = false
    }
  }
  catch {
    if (want === robot.deviceId)
      failed.value = true
  }
  loading.value = false
}

/** Business and HTTP errors are already shown by the request layer; network errors are not (legacy rule). */
function notifyError(error: unknown) {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/^Request error|HTTP request error/.test(raw))
    return
  toast.error(t('mmsg.failed'))
}

// ---------------------------------------------------------------- composer
function readFrom() {
  try {
    return String(uni.getStorageSync(FROM_KEY) || '')
  }
  catch {
    return ''
  }
}
const from = ref(readFrom())
const text = ref('')
const ask = ref(true)
const sending = ref(false)
const textError = ref('')
watch(text, (v) => {
  if (v.trim())
    textError.value = ''
})

function onText(e: any) {
  text.value = String(e.detail.value || '').slice(0, MAX_MESSAGE)
}

async function send() {
  if (sending.value || !robot.deviceId)
    return
  const body = text.value.trim()
  if (!body) {
    textError.value = t('mmsg.compose.required')
    toast.warning(t('mmsg.compose.required'))
    return
  }
  const sender = from.value.trim()
  try {
    uni.setStorageSync(FROM_KEY, sender)
  }
  catch {}
  sending.value = true
  try {
    const sent = await sendCompanionMessage(robot.deviceId, { from: sender, text: body, ask: ask.value })
    text.value = ''
    if (sent && (sent as any).id && view.value && !view.value.messages?.some(m => m.id === (sent as any).id))
      view.value = { ...view.value, messages: [{ ts: Math.floor(Date.now() / 1000), ...(sent as any) }, ...(view.value.messages || [])] }
    toast.success(offline.value ? t('mmsg.compose.sentLater') : t('mmsg.compose.sent'))
    reload(true)
  }
  catch (error) {
    notifyError(error)
  }
  finally {
    sending.value = false
  }
}

// ---------------------------------------------------------------- one-tap commands (the legacy actions)
const focusMin = computed(() => focusMinutes(view.value?.pomodoro))
const actions = computed(() => [
  { type: 'lullaby' as CommandType, arg: '', icon: 'lullaby', label: t('mmsg.cmd.lullaby') },
  { type: 'ring' as CommandType, arg: '', icon: 'volume', label: t('mmsg.cmd.ring') },
  { type: 'breathe' as CommandType, arg: '', icon: 'breathe', label: t('mmsg.cmd.breathe') },
  { type: 'night_light' as CommandType, arg: 'on', icon: 'light', label: t('mmsg.cmd.lightOn') },
  { type: 'night_light' as CommandType, arg: 'off', icon: 'moon', label: t('mmsg.cmd.lightOff') },
  { type: 'pomodoro' as CommandType, arg: String(focusMin.value), icon: 'focus', label: t('mmsg.cmd.focus', { n: num(focusMin.value) }), aria: t('mmsg.cmd.focusLabel', { n: num(focusMin.value) }), ok: t('mmsg.cmd.focusStarted') },
  { type: 'stop' as CommandType, arg: '', icon: 'stop', label: t('mmsg.cmd.stop') },
])
const games: GameName[] = ['catch', 'simon', 'dice', 'reaction']
const topic = ref('')
const busy = ref('')

async function run(type: CommandType, arg: string, okMsg?: string): Promise<boolean> {
  if (busy.value || !robot.deviceId)
    return false
  busy.value = `${type}:${arg}`
  try {
    await sendCompanionCommand(robot.deviceId, { type, arg })
    toast.success(okMsg || t('mmsg.cmd.sent'))
    reload(true)
    return true
  }
  catch (error) {
    notifyError(error)
    return false
  }
  finally {
    busy.value = ''
  }
}

async function tellStory() {
  if (await run('story', topic.value.trim(), t('mmsg.story.sent')))
    topic.value = ''
}

const recent = computed(() => (view.value?.commands || []).slice(0, 8))
function commandText(c: CompanionCommand) {
  const key = `mmsg.name.${c.type}`
  const name = t(key)
  return `${name === key ? c.type : name}${c.arg ? ` (${c.type === 'game' ? t(`mmsg.game.${c.arg}`) : num(c.arg)})` : ''}`
}
function ago(ts: number | null | undefined) {
  const p = agoParts(ts)
  return t(`mmsg.${p.key}`, { n: num(p.n) })
}

// ---------------------------------------------------------------- sent messages
const messages = computed(() => sortMessages(view.value?.messages || []) as CompanionMessage[])
function when(m: CompanionMessage) {
  const w = messageWhen(messageTs(m), lang.value)
  return { time: w.time, sub: w.date || (w.word === 'today' ? t('mmsg.today') : w.word === 'yesterday' ? t('mmsg.yesterday') : '') }
}

// ---------------------------------------------------------------- conversations (a preview)
const sessions = ref<ChatSession[]>([])
const sessLoading = ref(false)
const sessFailed = ref(false)
async function loadSessions() {
  const agent = robot.agentId
  if (!agent)
    return
  sessLoading.value = true
  try {
    const res = await getChatSessions(agent, { page: 1, limit: PREVIEW })
    if (agent === robot.agentId) {
      sessions.value = (res?.list || []).slice(0, PREVIEW)
      sessFailed.value = false
    }
  }
  catch {
    sessFailed.value = true
  }
  sessLoading.value = false
}
const parts = (v: string) => dateParts(v, lang.value)
function sessionTitle(s: ChatSession) {
  if (s.title)
    return s.title
  const w = parts(s.createdAt).word
  return w === 'today' ? t('mmsg.today') : w === 'yesterday' ? t('mmsg.yesterday') : t('mmsg.conv.untitled')
}
function sessionSub(s: ChatSession) {
  const bits = [parts(s.createdAt).time]
  if (s.chatCount)
    bits.push(t('mmsg.conv.lines', { n: num(s.chatCount > 99 ? '99+' : s.chatCount) }))
  return bits.filter(Boolean).join(' · ')
}
function openSession(s: ChatSession) {
  uni.navigateTo({ url: `/pages/chat-history/detail?sessionId=${encodeURIComponent(s.sessionId)}&agentId=${encodeURIComponent(robot.agentId)}` })
}
function openAll() {
  uni.navigateTo({ url: `/pages/chat-history/index?agentId=${encodeURIComponent(robot.agentId)}` })
}
function goRobots() {
  uni.navigateTo({ url: '/pages/robots/index' })
}

async function refreshAll() {
  refreshing.value = true
  await Promise.all([reload(true), loadSessions()])
  refreshing.value = false
}

// ---------------------------------------------------------------- life cycle
let poll: ReturnType<typeof setInterval> | undefined
function stopPoll() {
  if (poll)
    clearInterval(poll)
  poll = undefined
}
onShow(async () => {
  await loadRobots()
  reload(Boolean(view.value))
  loadSessions()
  stopPoll()
  poll = setInterval(() => reload(true), REFRESH_MS)
})
onHide(stopPoll)
onUnload(stopPoll)
watch(() => robot.deviceId, () => {
  view.value = null
  reload()
})
watch(() => robot.agentId, () => {
  sessions.value = []
  loadSessions()
})
</script>

<template>
  <view class="tb-wrap msgs">
    <tb-page-header :title="t('nav.messages')" :description="t('mmsg.desc')" back>
      <template v-if="robot.deviceId" #actions>
        <tb-button variant="quiet" size="s" icon="refresh" :loading="refreshing" :aria-label="t('mmsg.refresh')" @click="refreshAll" />
      </template>
    </tb-page-header>

    <view v-if="!robot.deviceId && robot.loaded" class="msgs__none">
      <tb-empty face="confused" :title="t('common.noRobot')" :text="t('common.noRobotText')">
        <tb-button variant="primary" icon="robots" @click="goRobots">
          {{ t('common.goRobots') }}
        </tb-button>
      </tb-empty>
    </view>

    <block v-else>
      <view v-if="failed && !view" class="msgs__fail" role="alert">
        <text>{{ t('common.loadFailed') }}</text>
        <tb-button size="s" variant="quiet" icon="refresh" @click="reload()">
          {{ t('common.retry') }}
        </tb-button>
      </view>

      <!-- What you tell TinyBot -->
      <tb-section :title="t('mmsg.compose.title')" :description="t('mmsg.compose.desc')" ink="message">
        <view class="compose">
          <view class="field">
            <text class="field__label">
              {{ t('mmsg.compose.text') }}
            </text>
            <view class="compose__box" :class="{ 'is-invalid': textError }">
              <textarea
                class="compose__text" :value="text" :maxlength="MAX_MESSAGE" auto-height :placeholder="t('mmsg.compose.textPlaceholder')"
                placeholder-class="compose__ph" :aria-label="t('mmsg.compose.text')" @input="onText"
              />
              <text class="compose__count tb-num">
                {{ t('mmsg.compose.count', { n: num(text.length), max: num(MAX_MESSAGE) }) }}
              </text>
            </view>
            <text v-if="textError" class="field__error" role="alert">
              {{ textError }}
            </text>
          </view>
          <view class="field">
            <text class="field__label">
              {{ t('mmsg.compose.from') }}
            </text>
            <tb-input v-model="from" :maxlength="MAX_NAME" clearable :placeholder="t('mmsg.compose.fromPlaceholder')" :aria-label="t('mmsg.compose.from')" />
            <text class="field__hint">
              {{ t('mmsg.compose.fromHint') }}
            </text>
          </view>
          <view class="compose__bar">
            <tb-switch v-model="ask" :label="t('mmsg.compose.ask')" />
          </view>
          <tb-button variant="primary" size="l" icon="send" block :loading="sending" @click="send">
            {{ t('mmsg.compose.send') }}
          </tb-button>
          <text v-if="offline" class="msgs__note">
            {{ t('mmsg.compose.offline') }}
          </text>
        </view>
      </tb-section>

      <!-- One-tap commands -->
      <tb-section :title="t('mmsg.cmd.title')" :description="t('mmsg.cmd.desc')" ink="message">
        <view class="deck" role="group" :aria-label="t('mmsg.cmd.title')">
          <tb-button
            v-for="a in actions" :key="`${a.type}-${a.arg}`" :icon="a.icon" :aria-label="a.aria || a.label"
            :loading="busy === `${a.type}:${a.arg}`" @click="run(a.type, a.arg, a.ok)"
          >
            {{ a.label }}
          </tb-button>
        </view>

        <view class="sub">
          <text class="sub__title">
            {{ t('mmsg.story.title') }}
          </text>
          <tb-input
            v-model="topic" :maxlength="MAX_TOPIC" clearable icon="story" confirm-type="go" :placeholder="t('mmsg.story.placeholder')"
            :aria-label="t('mmsg.story.topic')" @confirm="tellStory"
          />
          <tb-button block icon="story" :loading="busy.startsWith('story:')" @click="tellStory">
            {{ t('mmsg.story.start') }}
          </tb-button>
        </view>

        <view class="sub">
          <text class="sub__title">
            {{ t('mmsg.games.title') }}
          </text>
          <view class="deck">
            <tb-button
              v-for="g in games" :key="g" icon="game" :loading="busy === `game:${g}`"
              @click="run('game', g, t('mmsg.game.starting', { game: t(`mmsg.game.${g}`) }))"
            >
              {{ t(`mmsg.game.${g}`) }}
            </tb-button>
          </view>
        </view>

        <view v-if="recent.length" class="sub">
          <text class="sub__title">
            {{ t('mmsg.recent.title') }}
          </text>
          <view class="rows">
            <view v-for="c in recent" :key="c.id" class="cmd-row">
              <view class="cmd-row__main">
                <text class="cmd-row__name">
                  {{ commandText(c) }}
                </text>
                <text class="tb-num cmd-row__when">
                  {{ ago(c.ts) }}
                </text>
              </view>
              <tb-sync :state="commandSync(c)" :text="c.status === 'done' ? t('mmsg.recent.done') : t('mmsg.recent.pending')" />
            </view>
          </view>
        </view>
      </tb-section>

      <!-- Sent messages, newest first -->
      <tb-section :title="t('mmsg.list.title')" :description="t('mmsg.list.desc')" ink="message">
        <template v-if="messages.length" #actions>
          <tb-tag ink="message">
            {{ t('mmsg.list.count', { n: num(messages.length) }) }}
          </tb-tag>
        </template>
        <view v-if="loading && !view" class="msgs__wait">
          <tb-loading :label="t('common.loading')" />
        </view>
        <tb-empty v-else-if="!messages.length" :title="t('mmsg.list.none')" :text="t('mmsg.list.noneText')" />
        <view v-else class="rows">
          <view v-for="m in messages" :key="m.id || m.ts" class="msg-row">
            <view class="msg-row__when">
              <text class="tb-num msg-row__time">
                {{ when(m).time }}
              </text>
              <text class="msg-row__date">
                {{ when(m).sub }}
              </text>
            </view>
            <view class="msg-row__body">
              <text class="msg-row__text">
                {{ m.text }}
              </text>
              <view v-if="m.from || m.ask" class="msg-row__meta">
                <text v-if="m.from">
                  {{ t('mmsg.list.from', { name: m.from }) }}
                </text>
                <tb-tag v-if="m.ask" ink="message">
                  {{ t('mmsg.list.ask') }}
                </tb-tag>
              </view>
              <tb-sync class="msg-row__state" :class="`is-${statusOf(m)}`" :state="syncOf(m)" :text="t(`mmsg.status.${statusOf(m)}`)" />
            </view>
          </view>
        </view>
      </tb-section>

      <!-- Conversations -->
      <tb-section :title="t('mmsg.conv.title')" :description="t('mmsg.conv.desc')" ink="message">
        <text v-if="!robot.agentId" class="msgs__note">
          {{ t('mmsg.conv.noAgent') }}
        </text>
        <view v-else-if="sessFailed && !sessions.length" class="msgs__fail" role="alert">
          <text>{{ t('common.loadFailed') }}</text>
          <tb-button size="s" variant="quiet" icon="refresh" @click="loadSessions">
            {{ t('common.retry') }}
          </tb-button>
        </view>
        <view v-else-if="sessLoading && !sessions.length" class="msgs__wait">
          <tb-loading :label="t('common.loading')" />
        </view>
        <tb-empty v-else-if="!sessions.length" face="sleepy" :title="t('mmsg.conv.none')" :text="t('mmsg.conv.noneText')" />
        <block v-else>
          <view class="rows">
            <view v-for="s in sessions" :key="s.sessionId" class="conv-row" hover-class="is-press" role="button" @click="openSession(s)">
              <view class="conv-row__date">
                <text class="tb-num conv-row__day">
                  {{ parts(s.createdAt).day }}
                </text>
                <text class="conv-row__month">
                  {{ parts(s.createdAt).month }}
                </text>
              </view>
              <view class="conv-row__main">
                <text class="conv-row__title">
                  {{ sessionTitle(s) }}
                </text>
                <text class="tb-num conv-row__sub">
                  {{ sessionSub(s) }}
                </text>
              </view>
              <tb-icon name="chevron-right" :size="16" class="conv-row__go" />
            </view>
          </view>
          <tb-button block icon="history" @click="openAll">
            {{ t('mmsg.conv.all') }}
          </tb-button>
        </block>
      </tb-section>
    </block>
    <view class="msgs__end" />
  </view>
</template>

<style lang="scss">
.msgs__none {
  padding: 40px 0;
}
.msgs__wait {
  padding: 12px 0;
}
.msgs__note {
  color: var(--tb-ink-2);
  font-size: 13px;
}
.msgs__fail {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 12px;
  color: var(--tb-danger);
  font-size: 14px;
}
.msgs__end {
  height: calc(32px + env(safe-area-inset-bottom));
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field__label {
  font-weight: 600;
  font-size: 14px;
}
.field__hint {
  color: var(--tb-ink-2);
  font-size: 13px;
}
.field__error {
  color: var(--tb-danger);
  font-size: 13px;
  font-weight: 500;
}

.compose {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.compose__box {
  position: relative;
  padding: 10px 12px 26px;
  background: var(--tb-paper);
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-m);
}
.compose__box.is-invalid {
  border-color: var(--tb-danger);
}
.compose__text {
  width: 100%;
  min-height: 72px;
  font-size: 17px;
  line-height: 1.5;
  color: var(--tb-message);
  background: transparent;
}
.compose__ph {
  color: var(--tb-ink-3);
}
.compose__count {
  position: absolute;
  right: 12px;
  bottom: 6px;
  font-size: 12px;
  color: var(--tb-ink-3);
}
.compose__bar {
  padding-top: 4px;
  border-top: 1px solid var(--tb-rule-soft);
}

.deck {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sub {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--tb-rule-soft);
}
.sub__title {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 16px;
}

.rows {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule);
}
.cmd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.cmd-row__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cmd-row__name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.cmd-row__when {
  font-size: 13px;
  color: var(--tb-ink-2);
}

.msg-row {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.msg-row__when {
  width: 56px;
  flex: none;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.msg-row__time {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 16px;
}
.msg-row__date {
  margin-top: 2px;
  font-size: 12px;
  color: var(--tb-ink-2);
}
.msg-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.msg-row__text {
  color: var(--tb-message);
  font-size: 16px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.msg-row__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--tb-ink-2);
  font-size: 13px;
}
.msg-row__state.is-yes,
.msg-row__state.is-no {
  color: var(--tb-ink);
  font-weight: 700;
}

.conv-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.conv-row.is-press {
  background: var(--tb-paper-2);
}
.conv-row__date {
  width: 48px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  padding-right: 12px;
  border-right: 1px solid var(--tb-rule-soft);
}
.conv-row__day {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 24px;
}
.conv-row__month {
  margin-top: 4px;
  font-size: 12px;
  color: var(--tb-ink-2);
}
.conv-row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.conv-row__title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-row__sub {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.conv-row__go {
  color: var(--tb-ink-3);
}
</style>
