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

      <!-- Robot-to-robot messages and contacts (owner HOME) -->
      <RobotMessages :device-id="deviceId" />

      <!-- What you and TinyBot said (the chat history, also its own page for products without messages) -->
      <ChatHistory v-if="hasHistory" ref="history" :agent-id="agentId" />
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { digits } from '@/kit/calendar';
import { deviceIdFrom, hasFeature, loadRobots, robot } from '@/shell/robot';
import {
  ensureMqtt, friendlyError, noteCompanionError, noteCompanionView, refreshRobotStatus, statusOf as linkStatusOf,
} from '@/shell/robotStatus';
import { MAX_MESSAGE, MAX_NAME } from '@/utils/companion.mjs';
import { messageList, messageTs, messageWhen, sortMessages, statusOf, syncOf } from './messagesModel';
import ChatHistory from './ChatHistory.vue';
import RobotMessages from '../home/RobotMessages.vue';

const FROM_KEY = 'companion_message_from'; // the legacy key: the last "from" name is remembered
const REFRESH_MS = 10000;                   // the legacy poll

const { t, locale } = useI18n({ useScope: 'global' });
const route = useRoute();
const lang = computed(() => locale.value);
const num = (n) => digits(n, lang.value);
const maxMessage = MAX_MESSAGE;
const maxName = MAX_NAME;

const deviceId = computed(() => deviceIdFrom(route));
// the chat history part: every product with 'chat_history' (also its own page, /history)
const history = ref(null);
const hasHistory = computed(() => hasFeature('chat_history', deviceId.value));
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
  if (history.value) history.value.restart();
  setTimeout(() => { refreshing.value = false; }, 400);
}

// ---------------------------------------------------------------- life cycle
let poll = null;
function onVisible() { if (!document.hidden) { loadView(); loadMessages(true); } }
onMounted(async () => {
  await loadRobots();
  loadView();
  loadMessages();
  poll = setInterval(() => { if (!document.hidden) { loadView(); loadMessages(true); } }, REFRESH_MS);
  document.addEventListener('visibilitychange', onVisible);
});
onBeforeUnmount(() => {
  clearInterval(poll);
  document.removeEventListener('visibilitychange', onVisible);
});
watch(deviceId, () => { view.value = null; messages.value = []; msgFailed.value = false; loadView(); loadMessages(); });
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

</style>
