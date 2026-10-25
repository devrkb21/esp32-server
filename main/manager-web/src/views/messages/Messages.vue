<template>
  <div class="tb-page msg">
    <TbPageHeader :title="$t('nav.messages')" :description="$t('messages.desc')">
      <template v-if="deviceId" #actions>
        <TbButton variant="quiet" icon="refresh" :loading="refreshing" @click="refreshAll">{{ $t('messages.refresh') }}</TbButton>
      </template>
    </TbPageHeader>

    <div v-if="!deviceId && robot.loaded" class="msg__none">
      <TbEmpty face="confused" :title="$t('common.noRobot')" :text="$t('common.noRobotText')">
        <TbButton variant="primary" to="/robots" icon="robots">{{ $t('common.goRobots') }}</TbButton>
      </TbEmpty>
    </div>

    <template v-else>
      <!-- The robot's connection, when it is not simply online -->
      <TbRobotStatus v-if="showStatus" class="msg__status" :status="status" :loading="refreshing" @refresh="refreshAll" />

      <!-- What you tell TinyBot -->
      <TbSection :title="$t('messages.compose.title')" :description="$t('messages.compose.desc')" ink="message">
        <form class="msg-compose" novalidate @submit.prevent="send">
          <TbField class="msg-compose__text" :label="$t('messages.compose.text')" for-id="msg-text">
            <TbTextarea id="msg-text" ref="textEl" v-model="draft.text" :rows="3" autosize :maxlength="maxMessage" show-count
              :invalid="!!textError" :placeholder="$t('messages.compose.textPlaceholder')" @keydown="onKeys" />
          </TbField>
          <p v-if="textError" class="msg-compose__error" role="alert">{{ textError }}</p>
          <p v-if="offline" class="msg-compose__note">{{ $t('messages.compose.offline') }}</p>
          <!-- Send sits right under the text, so it is in the first screen on a phone -->
          <div class="msg-compose__bar">
            <span class="msg-compose__keys">{{ $t('messages.compose.keys') }}</span>
            <TbButton variant="primary" size="l" native-type="submit" icon="send" :loading="sending">{{ $t('messages.compose.send') }}</TbButton>
          </div>
          <div class="msg-compose__extra">
            <TbField class="msg-compose__from" :label="$t('messages.compose.from')" :hint="$t('messages.compose.fromHint')" for-id="msg-from">
              <TbInput id="msg-from" v-model="draft.from" :maxlength="maxName" :placeholder="$t('messages.compose.fromPlaceholder')" autocomplete="nickname" />
            </TbField>
            <TbSwitch class="msg-compose__ask" v-model="draft.ask" :label="$t('messages.compose.ask')" />
          </div>
        </form>
      </TbSection>

      <!-- The messages, newest first -->
      <TbSection :title="$t('messages.list.title')" :description="$t('messages.list.desc')" ink="message">
        <template v-if="messages.length" #actions>
          <TbTag ink="message">{{ $t('messages.list.count', { n: num(messages.length) }) }}</TbTag>
        </template>

        <div v-if="msgLoading && !messages.length" class="msg__wait"><TbLoading :label="$t('common.loading')" show-label /></div>
        <p v-else-if="msgFailed && !messages.length && showStatus" class="msg__muted">{{ $t('status.pageWaits') }}</p>
        <p v-else-if="msgFailed && !messages.length" class="msg__fail" role="alert">{{ $t('common.loadFailed') }}
          <TbButton size="s" variant="quiet" icon="refresh" @click="loadMessages()">{{ $t('common.retry') }}</TbButton></p>
        <TbEmpty v-else-if="!messages.length" face="awake" :title="$t('messages.list.none')" :text="$t('messages.list.noneText')" />
        <TransitionGroup v-else tag="ol" name="msg-row" class="msg-list">
          <li v-for="m in messages" :key="m.id || m.ts" class="msg-row">
            <time class="msg-row__when" :datetime="isoOf(m)">
              <b>{{ when(m).time }}</b>
              <small>{{ when(m).date || dayLabel(when(m).word) }}</small>
            </time>
            <div class="msg-row__body">
              <p class="msg-row__text">{{ m.text }}</p>
              <p v-if="m.from || m.ask" class="msg-row__meta">
                <span v-if="m.from">{{ $t('messages.list.from', { name: m.from }) }}</span>
                <TbTag v-if="m.ask" ink="message">{{ $t('messages.list.ask') }}</TbTag>
              </p>
            </div>
            <TbSync class="msg-row__state" :class="`is-${statusOf(m)}`" :state="syncOf(m)" :text="$t(`messages.status.${statusOf(m)}`)" />
          </li>
        </TransitionGroup>
      </TbSection>

      <!-- What you and TinyBot said -->
      <TbSection :title="$t('messages.conv.title')" :description="$t('messages.conv.desc')" ink="message">
        <p v-if="!agentId" class="msg__muted">{{ $t('messages.conv.noAgent') }}</p>
        <div v-else-if="sessFailed && !sessions.length" class="msg__fail" role="alert">{{ $t('common.loadFailed') }}
          <TbButton size="s" variant="quiet" icon="refresh" @click="restartSessions">{{ $t('common.retry') }}</TbButton></div>
        <div v-else-if="sessLoading && !sessions.length" class="msg__wait"><TbLoading :label="$t('common.loading')" show-label /></div>
        <TbEmpty v-else-if="!sessions.length" face="sleepy" :title="$t('messages.conv.none')" :text="$t('messages.conv.noneText')" />

        <div v-else class="conv" :class="{ 'is-open': !!current }">
          <div class="conv__list">
            <ul class="conv__rows" role="list">
              <li v-for="s in sessions" :key="s.sessionId">
                <button type="button" class="conv-row" :class="{ 'is-on': current && current.sessionId === s.sessionId }"
                  :aria-current="current && current.sessionId === s.sessionId ? 'true' : null" @click="openSession(s)">
                  <span class="conv-row__date" aria-hidden="true">
                    <b>{{ parts(s.createdAt).day }}</b><small>{{ parts(s.createdAt).month }}</small>
                  </span>
                  <span class="conv-row__main">
                    <span class="conv-row__title">{{ sessionTitle(s) }}</span>
                    <span class="conv-row__sub">{{ sessionSub(s) }}</span>
                  </span>
                  <TbIcon name="chevron-right" :size="16" class="conv-row__go" />
                </button>
              </li>
            </ul>
            <div class="conv__foot">
              <TbLoading v-if="sessLoading" :label="$t('common.loading')" />
              <TbButton v-else-if="hasMore" size="s" icon="chevron-down" @click="loadSessions">{{ $t('messages.conv.more') }}</TbButton>
              <span v-else class="msg__muted">{{ $t('messages.conv.noMore') }}</span>
            </div>
          </div>

          <div class="conv__read" :aria-busy="lineLoading ? 'true' : null">
            <template v-if="current">
              <header class="conv__head">
                <TbButton class="conv__back" size="s" variant="quiet" icon="chevron-left" @click="closeSession">{{ $t('messages.conv.back') }}</TbButton>
                <h3 ref="readHead" tabindex="-1" class="conv__title">{{ $t('messages.conv.transcript', { when: stamp(current.createdAt) }) }}</h3>
                <p v-if="mac" class="conv__mac">{{ $t('messages.conv.device') }}
                  <span class="conv__macval" tabindex="0" :aria-label="currentMac">{{ mac.head }}<span class="conv__macmask" aria-hidden="true">{{ mac.middle }}</span>{{ mac.tail }}</span>
                </p>
              </header>

              <div v-if="lineLoading && !lines.length" class="msg__wait"><TbLoading :label="$t('common.loading')" show-label /></div>
              <p v-else-if="!lines.length" class="msg__muted conv__empty">{{ $t('messages.conv.empty') }}</p>
              <ol v-else class="tx">
                <template v-for="item in transcript" :key="item.key">
                  <li v-if="item.mark" class="tx-mark"><time :datetime="item.at">{{ stamp(item.at) }}</time></li>
                  <li v-else class="tx-line" :class="`is-${who(item.line)}`">
                    <div class="tx-line__head">
                      <span class="tx-line__who">{{ whoLabel(item.line) }}</span>
                      <button v-if="item.line.audioId" type="button" class="tx-play" :class="{ 'is-playing': playingId === item.line.audioId }"
                        :aria-pressed="playingId === item.line.audioId ? 'true' : 'false'"
                        :aria-label="playingId === item.line.audioId ? $t('messages.conv.stop') : $t('messages.conv.play')"
                        :title="playingId === item.line.audioId ? $t('messages.conv.stop') : $t('messages.conv.play')"
                        @click="play(item.line)">
                        <TbIcon :name="playingId === item.line.audioId ? 'stop' : 'play'" :size="14" />
                      </button>
                    </div>
                    <div class="tx-line__said">
                      <template v-for="(p, i) in content(item.line).parts" :key="i">
                        <p v-if="p.type === 'text'" class="tx-line__text">{{ p.text }}</p>
                        <div v-else class="tx-line__tool">
                          <span class="tx-line__tooltag">{{ $t('messages.conv.tool') }}</span>
                          <p v-if="p.type !== 'tool_result' || p.text.length <= toolFold" class="tx-line__tooltext">{{ p.text }}</p>
                          <template v-else>
                            <p class="tx-line__tooltext">{{ isOpenTool(item.key, i) ? p.text : firstLine(p.text) }}</p>
                            <button type="button" class="tx-line__fold" :aria-expanded="isOpenTool(item.key, i) ? 'true' : 'false'" @click="toggleTool(item.key, i)">
                              {{ isOpenTool(item.key, i) ? $t('messages.conv.toolLess') : $t('messages.conv.toolMore') }}
                              <TbIcon :name="isOpenTool(item.key, i) ? 'chevron-up' : 'chevron-down'" :size="14" />
                            </button>
                          </template>
                        </div>
                      </template>
                    </div>
                  </li>
                </template>
              </ol>

              <footer class="conv__downloads">
                <TbButton size="s" icon="download" @click="download('current')">{{ $t('messages.conv.download') }}</TbButton>
                <TbButton size="s" variant="quiet" icon="download" @click="download('previous')">{{ $t('messages.conv.downloadPrev') }}</TbButton>
              </footer>
            </template>
            <p v-else class="msg__muted conv__pick">{{ $t('messages.conv.pick') }}</p>
          </div>
        </div>
      </TbSection>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { digits } from '@/kit/calendar';
import { loadRobots, robot, deviceIdFrom } from '@/shell/robot';
import {
  ensureMqtt, friendlyError, noteCompanionError, noteCompanionView, refreshRobotStatus, statusOf as linkStatusOf,
} from '@/shell/robotStatus';
import { MAX_MESSAGE, MAX_NAME } from '@/utils/companion.mjs';
import {
  SESSIONS_PAGE, TOOL_FOLD, dateParts, firstLine, lineContent, macParts, mergeSessions,
  messageList, messageTs, messageWhen, sortMessages, speakerOf, stampText, statusOf, syncOf, withTimeMarks,
} from './messagesModel';

const FROM_KEY = 'companion_message_from'; // the legacy key: the last "from" name is remembered
const REFRESH_MS = 10000;                   // the legacy poll
const WATCHDOG_MS = 20000;                  // a request with no answer at all counts as failed

const { t, locale } = useI18n({ useScope: 'global' });
const route = useRoute();
const lang = computed(() => locale.value);
const num = (n) => digits(n, lang.value);
const maxMessage = MAX_MESSAGE;
const maxName = MAX_NAME;
const toolFold = TOOL_FOLD;

const deviceId = computed(() => deviceIdFrom(route));
const agentId = computed(() => (route.query && route.query.agentId) || robot.agentId || '');

// ---------------------------------------------------------------- robot state (its connection)
// The same status every page shows (src/shell/robotStatus.js); the raw server text of a failed
// call goes to the console only.
const view = ref(null);
const checkedAt = ref(Date.now());
const status = computed(() => linkStatusOf(deviceId.value, { now: checkedAt.value }));
const showStatus = computed(() => !!deviceId.value && !['online', 'checking'].includes(status.value.state));
const offline = computed(() => !!deviceId.value && status.value.state === 'offline');
function loadView() {
  if (!deviceId.value) return;
  const want = deviceId.value;
  ensureMqtt(want);
  Api.companion.getCompanion(want, (res) => {
    noteCompanionView(want, res.data.data);
    checkedAt.value = Date.now();
    if (want === deviceId.value) view.value = res.data.data || null;
  }, (err) => {
    const kind = noteCompanionError(want, err);
    checkedAt.value = Date.now();
    if (kind === 'not_registered' && want === deviceId.value) view.value = null;
  });
}

// ---------------------------------------------------------------- composer
function readFrom() { try { return localStorage.getItem(FROM_KEY) || ''; } catch (e) { return ''; } }
const draft = reactive({ from: readFrom(), text: '', ask: true });
const sending = ref(false);
const textError = ref('');
const textEl = ref(null);
watch(() => draft.text, (v) => { if (v.trim()) textError.value = ''; });

function onKeys(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
}

function send() {
  if (sending.value || !deviceId.value) return;
  const text = (draft.text || '').trim();
  if (!text) {
    textError.value = t('messages.compose.required');
    textEl.value?.focus();
    return;
  }
  const from = (draft.from || '').trim();
  try { localStorage.setItem(FROM_KEY, from); } catch (e) { /* private mode */ }
  sending.value = true;
  Api.companion.sendCompanionMessage(deviceId.value, { from, text, ask: draft.ask }, (res) => {
    sending.value = false;
    draft.text = '';
    const sent = res && res.data && res.data.data;
    if (sent && sent.id && !messages.value.some((m) => m.id === sent.id)) messages.value = sortMessages([sent, ...messages.value]);
    toast.success(offline.value ? t('messages.compose.sentLater') : t('messages.compose.sent'));
    loadMessages(true);
  }, (err) => {
    sending.value = false;
    toast.error(friendlyError(err, t('messages.failed')));
  });
}

// ---------------------------------------------------------------- sent messages
const messages = ref([]);
const msgLoading = ref(false);
const msgFailed = ref(false);
function loadMessages(quiet = false) {
  if (!deviceId.value) return;
  const want = deviceId.value;
  if (!quiet) msgLoading.value = true;
  Api.companion.getCompanionMessages(want, (res) => {
    if (want !== deviceId.value) return;
    msgLoading.value = false;
    const list = messageList(res.data.data);
    if (list) { messages.value = sortMessages(list); msgFailed.value = false; }
  }, () => {
    if (want !== deviceId.value) return;
    msgLoading.value = false;
    // The full view carries the messages too: use them when the list call failed
    const fallback = messageList(view.value && view.value.messages);
    if (fallback && !messages.value.length) messages.value = sortMessages(fallback);
    else msgFailed.value = true;
  });
}
const when = (m) => messageWhen(messageTs(m), lang.value);
const isoOf = (m) => { const s = messageTs(m); return s ? new Date(s * 1000).toISOString() : null; };
const dayLabel = (w) => (w === 'today' ? t('messages.today') : w === 'yesterday' ? t('messages.yesterday') : '');

const refreshing = ref(false);
function refreshAll() {
  refreshing.value = true;
  refreshRobotStatus(deviceId.value, { force: true, companion: false });
  loadView();
  loadMessages(true);
  restartSessions();
  setTimeout(() => { refreshing.value = false; }, 400);
}

// ---------------------------------------------------------------- conversations
const sessions = ref([]);
const sessLoading = ref(false);
const sessFailed = ref(false);
const hasMore = ref(true);
let page = 1;
let firstLoad = true;
let sessToken = 0;
let sessTimer = null;

const current = ref(null);
const lines = ref([]);
const lineLoading = ref(false);
const openTools = reactive({});
const readHead = ref(null);
const currentMac = computed(() => (lines.value.find((l) => l.macAddress) || {}).macAddress || '');
const mac = computed(() => macParts(currentMac.value));
const transcript = computed(() => withTimeMarks(lines.value));

const wideQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 960px)') : null;
const isWide = ref(wideQuery ? wideQuery.matches : true);
function onWide(e) { isWide.value = e.matches; }

function resetSessions() {
  sessToken += 1;
  clearTimeout(sessTimer);
  sessions.value = []; current.value = null; lines.value = [];
  page = 1; firstLoad = true; hasMore.value = true; sessLoading.value = false; sessFailed.value = false;
  for (const k of Object.keys(openTools)) delete openTools[k];
  stopAudio();
}
function restartSessions() { const keep = current.value; resetSessions(); loadSessions(keep); }

function loadSessions(reopen) {
  if (!agentId.value || sessLoading.value || (!firstLoad && !hasMore.value)) return;
  const token = ++sessToken;
  sessLoading.value = true;
  sessFailed.value = false;
  clearTimeout(sessTimer);
  sessTimer = setTimeout(() => { if (token === sessToken && sessLoading.value) { sessLoading.value = false; sessFailed.value = true; } }, WATCHDOG_MS);
  Api.agent.getAgentSessions(agentId.value, { page, limit: SESSIONS_PAGE }, (res) => {
    if (token !== sessToken) return;
    clearTimeout(sessTimer);
    const list = res && res.data && res.data.data && res.data.data.list;
    if (Array.isArray(list)) {
      hasMore.value = list.length === SESSIONS_PAGE;
      sessions.value = mergeSessions(sessions.value, list);
      page += 1;
      const again = reopen && reopen.sessionId && sessions.value.find((s) => s.sessionId === reopen.sessionId);
      if (again) openSession(again, false);
      else if (isWide.value && !current.value && sessions.value.length) openSession(sessions.value[0], false);
    }
    sessLoading.value = false;
    firstLoad = false;
  });
}

let lineToken = 0;
function openSession(s, focus = true) {
  stopAudio();
  current.value = s;
  lines.value = [];
  for (const k of Object.keys(openTools)) delete openTools[k];
  lineLoading.value = true;
  const token = ++lineToken;
  Api.agent.getAgentChatHistory(agentId.value, s.sessionId, (res) => {
    if (token !== lineToken) return;
    lineLoading.value = false;
    const data = res && res.data && res.data.data;
    if (Array.isArray(data)) {
      lines.value = data;
      // the row's count follows what the session really holds
      sessions.value = sessions.value.map((x) => (x.sessionId === s.sessionId ? { ...x, chatCount: data.length } : x));
    }
  });
  if (focus) nextTick(() => { readHead.value?.focus({ preventScroll: isWide.value }); if (!isWide.value) readHead.value?.scrollIntoView({ block: 'start' }); });
}
function closeSession() { stopAudio(); current.value = null; lines.value = []; }

const parts = (v) => dateParts(v, lang.value);
const stampWords = computed(() => ({ today: t('messages.today'), yesterday: t('messages.yesterday') }));
const stamp = (v) => stampText(v, lang.value, stampWords.value);
function sessionTitle(s) {
  if (s.title) return s.title;
  const p = parts(s.createdAt);
  if (p.word !== 'older') return dayLabel(p.word);
  try { return new Intl.DateTimeFormat(lang.value === 'bn' ? 'bn-BD' : String(lang.value).replace('_', '-'), { weekday: 'long' }).format(new Date(s.createdAt)); } catch (e) { return t('messages.conv.untitled'); }
}
function sessionSub(s) {
  const bits = [parts(s.createdAt).time];
  if (s.chatCount) bits.push(t('messages.conv.lines', { n: num(s.chatCount > 99 ? '99+' : s.chatCount) }));
  return bits.filter(Boolean).join(' · ');
}

const who = (line) => speakerOf(line);
const content = (line) => lineContent(line.content);
const botName = computed(() => robot.name || t('nav.robotFallback'));
function whoLabel(line) {
  const w = who(line);
  if (w === 'person') return content(line).speaker || t('messages.conv.you');
  if (w === 'tool') return t('messages.conv.tool');
  return botName.value;
}
const isOpenTool = (key, i) => !!openTools[`${key}-${i}`];
function toggleTool(key, i) { const k = `${key}-${i}`; openTools[k] = !openTools[k]; }

// ---------------------------------------------------------------- audio of a line
const playingId = ref(null);
let audio = null;
let lastPlay = 0;
function stopAudio() {
  if (audio) { audio.pause(); audio.onended = null; audio = null; }
  playingId.value = null;
}
function play(line) {
  const now = Date.now();
  if (now - lastPlay < 300) return; // the legacy debounce: one press, one action
  lastPlay = now;
  if (playingId.value === line.audioId) { stopAudio(); return; }
  stopAudio();
  const want = line.audioId;
  playingId.value = want;
  const failed = () => { if (playingId.value === want) { stopAudio(); toast.error(t('messages.conv.playFailed')); } };
  Api.agent.getAudioId(want, (res) => {
    if (playingId.value !== want) return;
    const id = res && res.data && res.data.data;
    if (!id) { failed(); return; }
    audio = new Audio(`${Api.getServiceUrl()}/agent/play/${id}`);
    audio.onended = () => { if (playingId.value === want) { playingId.value = null; audio = null; } };
    audio.onerror = failed;
    const p = audio.play();
    if (p && p.catch) p.catch(failed);
  });
}

function download(kind) {
  if (!current.value) return;
  Api.agent.getDownloadUrl(agentId.value, current.value.sessionId, (res) => {
    if (res && res.data && res.data.code === 0 && res.data.data) {
      window.open(`${Api.getServiceUrl()}/agent/chat-history/download/${res.data.data}/${kind}`, '_blank');
    } else {
      toast.error(t('messages.conv.downloadFailed'));
    }
  });
}

// ---------------------------------------------------------------- life cycle
let poll = null;
function onVisible() { if (!document.hidden) { loadView(); loadMessages(true); } }
onMounted(async () => {
  wideQuery?.addEventListener?.('change', onWide);
  await loadRobots();
  loadView();
  loadMessages();
  loadSessions();
  poll = setInterval(() => { if (!document.hidden) { loadView(); loadMessages(true); } }, REFRESH_MS);
  document.addEventListener('visibilitychange', onVisible);
});
onBeforeUnmount(() => {
  clearInterval(poll);
  clearTimeout(sessTimer);
  document.removeEventListener('visibilitychange', onVisible);
  wideQuery?.removeEventListener?.('change', onWide);
  stopAudio();
});
watch(deviceId, () => { view.value = null; messages.value = []; msgFailed.value = false; loadView(); loadMessages(); });
watch(agentId, () => { resetSessions(); loadSessions(); });
</script>

<style>
.msg__none { padding: var(--tb-s10) 0; }
.msg__wait { padding: var(--tb-s4) 0; }
.msg__status { margin-top: var(--tb-s3); }
.msg__muted { color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.msg__fail { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--tb-danger); font-size: var(--tb-fs-14); }

/* ------------------------------------------------------------- composer */
.msg-compose { display: grid; gap: var(--tb-s4); grid-template-columns: minmax(0, 1fr); }
.msg-compose__text { align-content: start; }
.msg-compose__text textarea { font-size: max(16px, var(--tb-fs-18)); color: var(--tb-message); padding-bottom: 26px; }
.msg-compose__error { margin-top: calc(-1 * var(--tb-s2)); color: var(--tb-danger); font-size: var(--tb-fs-13); font-weight: 500; }
.msg-compose__note { margin-top: calc(-1 * var(--tb-s2)); color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.msg-compose__bar { display: flex; align-items: center; gap: var(--tb-s3) var(--tb-s4); flex-wrap: wrap; }
.msg-compose__bar .tb-btn--primary { margin-left: auto; min-width: 132px; }
.msg-compose__keys { color: var(--tb-ink-3); font-size: var(--tb-fs-12); }
.msg-compose__extra {
  display: grid; gap: var(--tb-s4) var(--tb-s6); grid-template-columns: minmax(0, 1fr);
  padding-top: var(--tb-s4); border-top: 1px solid var(--tb-rule-soft);
}
.msg-compose__from { align-content: start; }
.msg-compose__ask { justify-self: start; }
@media (max-width: 640px) {
  .msg-compose__keys { display: none; }
  .msg-compose__bar .tb-btn--primary { flex: 1 1 100%; }
}
@media (min-width: 900px) {
  .msg-compose__extra { grid-template-columns: minmax(0, 420px); }
}

/* ------------------------------------------------------------- sent messages: a ruled list in blue ink */
.msg-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule); }
.msg-row {
  display: grid; align-items: baseline; gap: 4px var(--tb-s4);
  grid-template-columns: 76px minmax(0, 1fr) auto;
  padding: 12px 0; border-bottom: 1px solid var(--tb-rule-soft);
}
.msg-row__when { display: grid; line-height: var(--tb-lh-tight); }
.msg-row__when b { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-16); }
.msg-row__when small { color: var(--tb-ink-2); font-size: var(--tb-fs-12); margin-top: 2px; }
.msg-row__body { min-width: 0; display: grid; gap: 4px; }
.msg-row__text { color: var(--tb-message); font-size: var(--tb-fs-16); overflow-wrap: anywhere; max-width: 70ch; }
.msg-row__meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.msg-row__state { justify-self: end; }
.msg-row__state.is-yes, .msg-row__state.is-no { color: var(--tb-ink); font-weight: 700; }
.msg-row-enter-active { transition: opacity var(--tb-t-row) var(--tb-ease), transform var(--tb-t-row) var(--tb-ease); }
.msg-row-enter-from { opacity: 0; transform: translateY(-6px); }
.msg-row-move { transition: transform var(--tb-t-row) var(--tb-ease); }
@media (max-width: 640px) {
  .msg-row { grid-template-columns: 56px minmax(0, 1fr); }
  .msg-row__state { grid-column: 2; justify-self: start; }
}

/* ------------------------------------------------------------- conversations */
.conv { display: grid; grid-template-columns: minmax(0, 1fr); border-top: 1px solid var(--tb-rule); }
.conv__rows { list-style: none; margin: 0; padding: 0; }
.conv-row {
  display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: var(--tb-s3);
  width: 100%; min-height: 60px; padding: 8px 6px 8px 0; text-align: left;
  border: 0; border-bottom: 1px solid var(--tb-rule-soft); background: transparent; color: var(--tb-ink);
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.conv-row__date { display: grid; justify-items: center; line-height: 1; padding-right: var(--tb-s3); border-right: 1px solid var(--tb-rule-soft); }
.conv-row__date b { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-24); font-variant-numeric: tabular-nums; }
.conv-row__date small { margin-top: 4px; font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.conv-row__main { display: grid; min-width: 0; }
.conv-row__title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-row__sub { font-size: var(--tb-fs-13); color: var(--tb-ink-2); font-variant-numeric: tabular-nums; }
.conv-row__go { color: var(--tb-ink-3); }
.conv-row.is-on { background: var(--tb-paper-2); }
.conv-row.is-on .conv-row__date b { color: var(--tb-action); }
.conv-row.is-on .conv-row__go { color: var(--tb-ink); }
@media (hover: hover) and (pointer: fine) { .conv-row:hover { background: var(--tb-paper-2); } }
.conv__foot { display: flex; justify-content: center; padding: var(--tb-s3) 0; }

.conv__read { min-width: 0; }
.conv__head { display: grid; gap: 4px; padding: var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule); }
.conv__back { justify-self: start; margin-left: -10px; }
.conv__title { font-size: var(--tb-fs-18); outline: none; }
.conv__mac { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.conv__macval { font-variant-numeric: tabular-nums; outline-offset: 2px; }
.conv__macmask { filter: blur(4px); transition: filter var(--tb-t-hover) var(--tb-ease); }
.conv__macval:hover .conv__macmask, .conv__macval:focus .conv__macmask { filter: none; }
.conv__empty, .conv__pick { padding: var(--tb-s6) 0; }
.conv__downloads { display: flex; gap: 8px; flex-wrap: wrap; padding-top: var(--tb-s4); }

/* the ruled transcript: the person's lines in blue at the right, TinyBot's in ink at the left */
.tx { list-style: none; margin: 0; padding: 0; }
.tx-mark { padding: 14px 0 4px; color: var(--tb-ink-2); font-size: var(--tb-fs-12); font-weight: 600; font-variant-numeric: tabular-nums; }
.tx-line { display: grid; gap: 2px; padding: 10px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.tx-line__head { display: flex; align-items: center; gap: 6px; min-height: 24px; }
.tx-line__who { font-size: var(--tb-fs-12); font-weight: 700; color: var(--tb-ink-2); }
.tx-line__said { display: grid; gap: 6px; }
.tx-line__text { font-size: var(--tb-fs-16); overflow-wrap: anywhere; max-width: 62ch; }
.tx-line.is-bot { padding-right: 12%; }
.tx-line.is-person { padding-left: 12%; justify-items: end; text-align: right; }
.tx-line.is-person .tx-line__head { flex-direction: row-reverse; }
.tx-line.is-person .tx-line__text { color: var(--tb-message); }
.tx-line.is-person .tx-line__who { color: var(--tb-message); }
.tx-line.is-tool { padding-right: 12%; }
.tx-line__tool { display: grid; gap: 4px; justify-items: start; text-align: left; padding: 6px 0 2px; border-top: 1px dashed var(--tb-rule-soft); font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.tx-line__tool:first-child { border-top: 0; padding-top: 0; }
.tx-line__tooltag { font-size: var(--tb-fs-12); font-weight: 600; }
.tx-line__tooltext { white-space: pre-wrap; overflow-wrap: anywhere; }
.tx-line__fold {
  display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0; border: 0; background: none;
  color: var(--tb-ink); font-weight: 600; font-size: var(--tb-fs-13); text-decoration: underline; text-underline-offset: 3px;
}
.tx-play {
  display: inline-grid; place-items: center; width: 28px; height: 28px; padding: 0; flex: none;
  border: 1.5px solid currentColor; border-radius: 50%; background: transparent; color: var(--tb-ink);
  transition: background-color var(--tb-t-hover) var(--tb-ease), color var(--tb-t-hover) var(--tb-ease);
}
.tx-line.is-person .tx-play { color: var(--tb-message); }
.tx-play.is-playing { background: var(--tb-action); border-color: var(--tb-action); color: var(--tb-on-action); }
@media (hover: hover) and (pointer: fine) { .tx-play:not(.is-playing):hover { background: var(--tb-paper-2); } }
@media (pointer: coarse) {
  .tx-play { width: 44px; height: 44px; margin: -8px 0; }
}

/* phone: the list, or one conversation with a way back */
@media (max-width: 959px) {
  .conv.is-open .conv__list { display: none; }
  .conv:not(.is-open) .conv__read { display: none; }
}
@media (min-width: 960px) {
  .conv { grid-template-columns: 300px minmax(0, 1fr); }
  .conv__list { border-right: 1px solid var(--tb-rule); padding-right: var(--tb-s4); max-height: 680px; overflow-y: auto; }
  .conv__read { padding-left: var(--tb-s6); }
  .conv__back { display: none; }
  .conv__head { padding-top: var(--tb-s2); }
}
</style>
