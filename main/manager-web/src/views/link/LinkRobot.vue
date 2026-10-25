<template>
  <AuthFrame :title="title" :lead="lead" :mood="mood" :pulse="state === 'linking'">
    <div class="lk" :aria-busy="busy ? 'true' : 'false'">
      <!-- The robot being linked: its product (once the code is known) and the code, editable -->
      <section class="lk-robot" :aria-label="$t('link.found')">
        <header v-if="info" class="lk-robot__head">
          <p class="lk-robot__name">{{ productLabel }}</p>
          <p v-if="info.macTail" class="lk-robot__mac tb-num">{{ $t('link.macTail', { tail: info.macTail }) }}</p>
        </header>
        <label class="lk-robot__label" for="lk-code">{{ $t('link.codeLabel') }}</label>
        <CodeBoxes id="lk-code" ref="boxes" v-model="code" :label="$t('link.codeLabel')" describedby="lk-code-hint"
          :lang="lang" :invalid="errorKind === 'format' || errorKind === 'expired'" :disabled="state === 'linking' || state === 'done'"
          @enter="onEnter" />
        <p id="lk-code-hint" class="lk-robot__hint">{{ $t('link.codeHint') }}</p>
      </section>

      <!-- Signed out: sign in (or make an account), then come back here -->
      <div v-if="state === 'guest'" class="lk-step">
        <p class="lk-step__text">{{ $t('link.guest.text') }}</p>
        <TbButton variant="primary" size="l" block icon="user" :to="{ path: '/login', query: { redirect: backHere } }">
          {{ $t('link.guest.signIn') }}
        </TbButton>
        <div class="auth-form__links">
          <RouterLink class="auth-form__link" :to="{ path: '/register', query: { redirect: backHere } }">{{ $t('link.guest.register') }}</RouterLink>
        </div>
      </div>

      <!-- No full code yet -->
      <div v-else-if="state === 'enter'" class="lk-step">
        <TbButton variant="primary" size="l" block icon="search" :disabled="code.length !== 6" @click="lookup">
          {{ $t('link.enter.next') }}
        </TbButton>
      </div>

      <!-- Working: looking the code up, or linking -->
      <div v-else-if="state === 'looking' || state === 'linking' || state === 'done'" class="lk-step lk-step--wait" role="status">
        <TbLoading :label="waitText" show-label />
      </div>

      <!-- Several characters: which one should the robot be? -->
      <form v-else-if="state === 'choose'" class="lk-step" novalidate @submit.prevent="link">
        <fieldset class="lk-agents">
          <legend class="lk-agents__legend">{{ $t('link.choose.legend') }}</legend>
          <label v-for="a in agents" :key="a.id" class="lk-agent" :class="{ 'is-picked': pick === a.id }">
            <input v-model="pick" class="lk-agent__radio" type="radio" name="lk-agent" :value="a.id" />
            <span class="lk-agent__mark" aria-hidden="true"></span>
            <span class="lk-agent__name">{{ a.agentName }}</span>
            <span class="lk-agent__meta tb-num">
              {{ $t('link.choose.robots', { n: num(a.deviceCount || 0) }, Number(a.deviceCount) || 0) }}
            </span>
          </label>
        </fieldset>
        <TbButton variant="primary" size="l" block icon="link" native-type="submit" :disabled="!pick">{{ $t('link.submit') }}</TbButton>
      </form>

      <!-- Something went wrong: say what, in plain words, and what to do -->
      <div v-else-if="state === 'error'" class="lk-step" role="alert">
        <p class="auth-form__alert lk-alert"><TbIcon name="warning" :size="18" /><span>{{ errorText }}</span></p>
        <!-- A wrong or old code: typing the new one is the way on. A failed request: try again. -->
        <div class="lk-step__acts">
          <TbButton v-if="errorKind === 'taken'" variant="primary" icon="robots" to="/robots">{{ $t('link.toRobots') }}</TbButton>
          <TbButton v-else-if="canRetry" variant="primary" icon="refresh" @click="retry">{{ $t('link.retry') }}</TbButton>
          <TbButton :variant="errorKind === 'taken' || canRetry ? 'secondary' : 'primary'" icon="edit" @click="manual">{{ $t('link.manual') }}</TbButton>
        </div>
      </div>

      <div v-if="signedIn && state !== 'done'" class="auth-form__links lk-back">
        <RouterLink class="auth-form__link" to="/robots"><TbIcon name="chevron-left" :size="16" />{{ $t('link.back') }}</RouterLink>
      </div>
    </div>
  </AuthFrame>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { digits } from '@/kit/calendar';
import { loadRobots, robot, selectRobot } from '@/shell/robot';
import { codeFromText, linkErrorKind, linkPath, linkPlan } from '@/utils/linkCode';
import AuthFrame from '../auth/AuthFrame.vue';
import { usePubConfig } from '../auth/useAuth';
import CodeBoxes from './CodeBoxes.vue';

// Link a robot to the account. The robot's QR opens /#/link?code=123456; the code can also be typed
// or pasted here (from My robots, "add with a code"). Signed out: sign in, then back here. Signed in:
// look the code up (GET /device/link/{code}); with 0 or 1 characters link right away, with more
// let the owner pick one (POST /device/link). On success the robot becomes "this robot" and Today opens.
const { t, locale } = useI18n({ useScope: 'global' });
const route = useRoute();
const router = useRouter();
const { load: loadPubConfig } = usePubConfig();
const lang = computed(() => locale.value);
const num = (n) => digits(n, lang.value);

function hasToken() {
  try { return Boolean(localStorage.getItem('token')); } catch (e) { return false; }
}

const signedIn = ref(hasToken());
const code = ref(codeFromText(route.query.code));
const state = ref('enter'); // guest | enter | looking | choose | linking | done | error
const info = ref(null);     // the robot behind the code
const agents = ref([]);     // the owner's characters
const pick = ref('');
const errorKind = ref('');
const errorMsg = ref('');
const lastStep = ref('lookup'); // what "try again" repeats
const boxes = ref(null);
let seq = 0; // only the newest request may change the page

const busy = computed(() => state.value === 'looking' || state.value === 'linking');
const canRetry = computed(() => ['failed', 'agents', 'denied', 'auth'].includes(errorKind.value));
const backHere = computed(() => linkPath(code.value.length === 6 ? code.value : ''));
const productLabel = computed(() => {
  const i = info.value || {};
  const name = lang.value === 'bn' ? (i.productNameBn || i.productNameEn) : (i.productNameEn || i.productNameBn);
  return name || t('link.robotFallback');
});
const title = computed(() => {
  if (state.value === 'enter') return t('link.enter.title');
  if (state.value === 'choose') return t('link.choose.title');
  if (state.value === 'error') return t('link.err.title');
  return t('link.title');
});
const lead = computed(() => {
  if (state.value === 'enter') return t('link.enter.lead');
  if (state.value === 'choose') return t('link.choose.lead');
  if (state.value === 'guest') return t('link.signInLead');
  if (state.value === 'error') return '';
  return t('link.lead');
});
const mood = computed(() => ({
  guest: 'sleepy', enter: code.value ? 'awake' : 'sleepy', looking: 'awake', choose: 'awake',
  linking: 'awake', done: 'happy', error: 'confused',
}[state.value] || 'awake'));
const pickedName = computed(() => (agents.value.find((a) => a.id === pick.value) || {}).agentName || '');
const waitText = computed(() => {
  if (state.value === 'looking') return t('link.looking');
  return pickedName.value && agents.value.length > 1 ? t('link.linkingInto', { name: pickedName.value }) : t('link.linking');
});
const errorText = computed(() => {
  const known = { format: 'link.err.format', expired: 'link.err.expired', taken: 'link.err.taken', denied: 'link.err.denied', agents: 'link.err.agents' };
  return known[errorKind.value] ? t(known[errorKind.value]) : t('link.err.failed');
});

/* ---------- requests (callback API wrapped as promises; never throws) ---------- */
function ask(fn, ...args) {
  return new Promise((resolve) => {
    fn(...args, (res) => resolve({ ok: true, data: res && res.data ? res.data.data : null }),
      (err) => resolve({ ok: false, code: err && err.data ? err.data.code : 0, msg: err && err.data ? err.data.msg : '' }));
  });
}
const getInfo = (c) => ask(Api.device.getLinkInfo.bind(Api.device), c);
const getAgents = () => ask(Api.agent.getAgentList.bind(Api.agent));
const postLink = (body) => ask(Api.device.linkDevice.bind(Api.device), body);

function fail(kind, msg = '') {
  errorKind.value = kind;
  errorMsg.value = msg;
  state.value = 'error';
}

async function lookup() {
  if (code.value.length !== 6) { state.value = 'enter'; return; }
  const my = ++seq;
  lastStep.value = 'lookup';
  errorKind.value = '';
  state.value = 'looking';
  const [found, mine] = await Promise.all([getInfo(code.value), getAgents()]);
  if (my !== seq) return;
  if (!found.ok) { info.value = null; fail(linkErrorKind(found.code), found.msg); return; }
  info.value = found.data || {};
  if (!mine.ok) { fail('agents', mine.msg); return; }
  agents.value = Array.isArray(mine.data) ? mine.data : [];
  if (linkPlan(agents.value.length) === 'auto') { pick.value = ''; link(); return; }
  if (!agents.value.some((a) => a.id === pick.value)) {
    pick.value = agents.value.some((a) => a.id === robot.agentId) ? robot.agentId : agents.value[0].id;
  }
  state.value = 'choose';
}

async function link() {
  const my = ++seq;
  lastStep.value = 'link';
  errorKind.value = '';
  state.value = 'linking';
  const body = { code: code.value };
  if (agents.value.length > 1 && pick.value) body.agentId = pick.value;
  const res = await postLink(body);
  if (my !== seq) return;
  if (!res.ok) {
    const kind = linkErrorKind(res.code);
    // The account gained characters since we looked: ask which one.
    if (kind === 'choose') { lookup(); return; }
    fail(kind, res.msg);
    return;
  }
  finish(res.data || {});
}

async function finish(result) {
  state.value = 'done';
  const i = info.value || {};
  toast.success(result.agentCreated ? t('link.doneNew') : t('link.done'));
  if (result.deviceId) {
    selectRobot({
      deviceId: result.deviceId, agentId: result.agentId, name: '',
      productKey: i.productKey, productName: i.productNameEn, productNameBn: i.productNameBn,
    });
  }
  try { await loadRobots(true); } catch (e) { /* Today loads the list itself */ }
  router.replace('/today');
}

function retry() {
  if (lastStep.value === 'link' && info.value) link();
  else lookup();
}
function manual() {
  seq++;
  code.value = '';
  info.value = null;
  errorKind.value = '';
  state.value = signedIn.value ? 'enter' : 'guest';
  nextTick(() => boxes.value && boxes.value.focus());
}
function onEnter() {
  if (state.value === 'choose') link();
  else if (signedIn.value && code.value.length === 6 && !busy.value) lookup();
}

// A complete new code looks the robot up at once; an incomplete one waits for the rest.
watch(code, (value, old) => {
  if (!signedIn.value || value === old) return;
  if (state.value === 'linking' || state.value === 'done') return;
  if (value.length === 6) { if (!info.value || info.value.code !== value || state.value === 'error') lookup(); return; }
  seq++;
  info.value = null;
  errorKind.value = '';
  state.value = 'enter';
});
// The same page opened again with another code (a second QR scanned).
watch(() => route.query.code, (q) => {
  const next = codeFromText(q);
  if (next && next !== code.value) code.value = next;
});

onMounted(() => {
  loadPubConfig();
  if (!signedIn.value) { state.value = 'guest'; return; }
  if (code.value.length === 6) lookup();
  else { state.value = 'enter'; nextTick(() => boxes.value && boxes.value.focus()); }
});
</script>

<style>
.lk { display: grid; gap: 18px; border-top: var(--tb-rule-band) solid var(--tb-rule); padding-top: 16px; }

.lk-robot { display: grid; gap: 8px; }
.lk-robot__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 12px;
  padding-bottom: 10px; border-bottom: 1px solid var(--tb-rule-soft); }
.lk-robot__name { font: 800 var(--tb-fs-24)/var(--tb-lh-tight) var(--tb-font-display); color: var(--tb-ink); }
.lk-robot__mac { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.lk-robot__label { font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-ink-2); }
.lk-robot__hint { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }

.lk-step { display: grid; gap: 14px; }
.lk-step__text { color: var(--tb-ink-2); font-size: var(--tb-fs-15); }
.lk-step--wait { min-height: 52px; align-items: center; }
.lk-step .auth-form__alert { margin-top: 0; }
.lk-alert { display: flex; gap: 8px; }
.lk-alert .tb-icon { flex: none; margin-top: 3px; }
.lk-step__acts { display: flex; flex-wrap: wrap; gap: 10px; }
.lk-step .auth-form__links { padding-top: 0; }

.lk-agents { border: 0; margin: 0; padding: 0; min-width: 0; border-top: 1px solid var(--tb-rule-soft); }
.lk-agents__legend { padding: 0 0 6px; font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-ink-2); }
.lk-agent {
  position: relative; display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 12px;
  min-height: 56px; padding: 8px 4px; border-bottom: 1px solid var(--tb-rule-soft); cursor: pointer;
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.lk-agent:hover { background: var(--tb-paper-2); }
.lk-agent__radio { position: absolute; opacity: 0; width: 1px; height: 1px; }
.lk-agent__mark { width: 20px; height: 20px; border: 1.5px solid var(--tb-ink); border-radius: 50%; display: grid; place-items: center; }
.lk-agent__mark::after { content: ''; width: 10px; height: 10px; border-radius: 50%; background: var(--tb-orange);
  transform: scale(0); transition: transform var(--tb-t-fast) var(--tb-ease); }
.lk-agent.is-picked .lk-agent__mark { border-color: var(--tb-orange); }
.lk-agent.is-picked .lk-agent__mark::after { transform: scale(1); }
.lk-agent__radio:focus-visible + .lk-agent__mark { outline: 2px solid var(--tb-focus); outline-offset: 2px; }
.lk-agent__name { font-weight: 600; font-size: var(--tb-fs-16); overflow-wrap: anywhere; }
.lk-agent__meta { font-size: var(--tb-fs-13); color: var(--tb-ink-2); white-space: nowrap; }

.lk-back { padding-top: 0; }
</style>
