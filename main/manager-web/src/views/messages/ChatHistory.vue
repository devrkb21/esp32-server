<template>
  <!-- What you and the robot said: the chat history (feature chat_history) -->
  <TbSection class="ch" :title="$t('messages.conv.title')" :description="description || $t('messages.conv.desc')" ink="message">
    <p v-if="!agentId" class="ch__muted">{{ $t('messages.conv.noAgent') }}</p>
    <div v-else-if="sessFailed && !sessions.length" class="ch__fail" role="alert">{{ $t('common.loadFailed') }}
      <TbButton size="s" variant="quiet" icon="refresh" @click="restartSessions">{{ $t('common.retry') }}</TbButton></div>
    <div v-else-if="sessLoading && !sessions.length" class="ch__wait"><TbLoading :label="$t('common.loading')" show-label /></div>
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
          <span v-else class="ch__muted">{{ $t('messages.conv.noMore') }}</span>
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

          <div v-if="lineLoading && !lines.length" class="ch__wait"><TbLoading :label="$t('common.loading')" show-label /></div>
          <p v-else-if="!lines.length" class="ch__muted conv__empty">{{ $t('messages.conv.empty') }}</p>
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
        <p v-else class="ch__muted conv__pick">{{ $t('messages.conv.pick') }}</p>
      </div>
    </div>
  </TbSection>
</template>

<script setup>
// The chat history of a character: its sessions as a ruled list, one transcript at a time, with
// audio and downloads. Shown inside Messages (TinyBot) and on its own page, History (/history),
// for products that have chat history but no messages (feature 'chat_history').
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { digits } from '@/kit/calendar';
import { robot } from '@/shell/robot';
import {
  SESSIONS_PAGE, TOOL_FOLD, dateParts, firstLine, lineContent, macParts, mergeSessions, speakerOf, stampText, withTimeMarks,
} from './messagesModel';

const props = defineProps({ agentId: { type: String, default: '' }, description: { type: String, default: '' } });

const WATCHDOG_MS = 20000; // a request with no answer at all counts as failed
const { t, locale } = useI18n({ useScope: 'global' });
const lang = computed(() => locale.value);
const num = (n) => digits(n, lang.value);
const toolFold = TOOL_FOLD;
const agentId = computed(() => props.agentId);
const dayLabel = (w) => (w === 'today' ? t('messages.today') : w === 'yesterday' ? t('messages.yesterday') : '');

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
onMounted(() => {
  wideQuery?.addEventListener?.('change', onWide);
  loadSessions();
});
onBeforeUnmount(() => {
  clearTimeout(sessTimer);
  wideQuery?.removeEventListener?.('change', onWide);
  stopAudio();
});
watch(agentId, () => { resetSessions(); loadSessions(); });

defineExpose({ restart: restartSessions });
</script>

<style>
.ch__wait { padding: var(--tb-s4) 0; }
.ch__muted { color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.ch__fail { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--tb-danger); font-size: var(--tb-fs-14); }

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
