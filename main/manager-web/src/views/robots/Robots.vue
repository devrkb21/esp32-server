<template>
  <div class="robots">
    <TbPageHeader :title="$t('nav.robots')" :description="$t('robots.desc')">
      <template #actions>
        <TbButton icon="agent" @click="openAddCharacter(false)">{{ $t('robots.addCharacter') }}</TbButton>
        <!-- The robot's code (or QR link) opens the link flow, which also picks or makes the character -->
        <TbButton variant="primary" icon="qr" to="/link">{{ $t('robots.addByCode') }}</TbButton>
      </template>
    </TbPageHeader>

    <div v-if="hasAgents || isSearching" class="robots__bar">
      <form class="robots__search" role="search" @submit.prevent="runSearch()">
        <label class="tb-visually-hidden" for="robots-search">{{ $t('robots.searchLabel') }}</label>
        <TbInput id="robots-search" v-model="search" icon="search" clearable
          :placeholder="$t('robots.searchPlaceholder')" :clear-label="$t('robots.showAll')"
          @clear="resetSearch" @focus="historyOpen = true" @blur="closeHistorySoon" />
        <Transition name="tb-pop">
          <div v-if="historyOpen && history.length" class="robots__history">
            <div class="robots__history-head">
              <span>{{ $t('robots.recent') }}</span>
              <button type="button" class="robots__linkbtn" @mousedown.prevent @click="clearHistory">{{ $t('robots.clearRecent') }}</button>
            </div>
            <ul>
              <li v-for="(h, i) in history" :key="h">
                <button type="button" class="robots__history-item" @mousedown.prevent @click="pickHistory(h)">
                  <TbIcon name="history" :size="16" /><span>{{ h }}</span>
                </button>
                <button type="button" class="robots__history-x" :aria-label="$t('robots.removeRecent', { q: h })"
                  @mousedown.prevent @click="removeHistory(i)"><TbIcon name="close" :size="14" /></button>
              </li>
            </ul>
          </div>
        </Transition>
      </form>
      <p v-if="!loading && groups.length" class="robots__summary">
        {{ summary }}<template v-if="onlineCount">, <span class="robots__on">{{ $t('robots.countOnline', { n: num(onlineCount) }) }}</span></template>
      </p>
    </div>

    <section class="robots__list" :aria-label="$t('robots.listLabel')" :aria-busy="loading ? 'true' : 'false'">
      <div v-if="loading" class="robots__state"><TbLoading :label="$t('robots.loading')" show-label /></div>

      <div v-else-if="failed" class="robots__state robots__fail" role="alert">
        <p>{{ $t('common.loadFailed') }}</p>
        <TbButton size="s" icon="refresh" @click="load()">{{ $t('common.retry') }}</TbButton>
      </div>

      <TbEmpty v-else-if="isSearching && !groups.length" face="confused" :title="$t('robots.noMatch.title')"
        :text="$t('robots.noMatch.text', { q: searchedFor })">
        <TbButton @click="clearSearch">{{ $t('robots.showAll') }}</TbButton>
      </TbEmpty>

      <div v-else-if="!groups.length" class="robots__first">
        <TbEmpty face="awake" :title="$t('robots.empty.title')" :text="$t('robots.empty.linkText')">
          <TbButton variant="primary" icon="qr" to="/link">{{ $t('robots.addByCode') }}</TbButton>
          <TbButton icon="agent" @click="openAddCharacter(true)">{{ $t('robots.empty.action') }}</TbButton>
        </TbEmpty>
      </div>

      <template v-else>
        <article v-for="g in groups" :key="g.agent.id" class="rb-group" :aria-labelledby="`rb-g-${g.agent.id}`">
          <header class="rb-group__head">
            <div class="rb-group__id">
              <h2 :id="`rb-g-${g.agent.id}`" class="rb-group__name">{{ g.agent.agentName }}</h2>
              <p class="rb-group__meta">
                <span class="tb-num">{{ $t('robots.countRobots', { n: num(g.count) }, g.count) }}</span>
                <span>{{ $t('robots.talked', { when: whenText(g.agent.lastConnectedAt) }) }}</span>
              </p>
              <p v-if="modelsText(g.agent)" class="rb-group__models">{{ modelsText(g.agent) }}</p>
            </div>
            <div class="rb-group__act">
              <TbButton size="s" icon="plus" @click="openAddRobot(g.agent.id)">{{ $t('robots.addHere') }}</TbButton>
              <TbMenu :items="menuFor(g)" @select="(k) => onMenu(k, g)">
                <template #trigger="{ open }">
                  <TbButton size="s" icon="more" :aria-label="$t('robots.moreFor', { name: g.agent.agentName })"
                    :aria-expanded="open ? 'true' : 'false'" aria-haspopup="menu" />
                </template>
              </TbMenu>
            </div>
          </header>

          <ul class="rb-rows">
            <template v-for="r in g.robots" :key="r.deviceId">
            <li v-if="r.productHead" class="rb-row rb-row--product">
              <span>{{ productName(r, lang) }}</span>
            </li>
            <li class="rb-row" :class="{ 'is-current': r.deviceId === robot.deviceId }">
              <TbFace v-if="r.features.includes('companion')" class="rb-row__face" :mood="rowMood(r)" :width="76"
                :alt="$t('robots.faceAlt', { name: r.name || g.agent.agentName })" />
              <span v-else class="rb-row__face rb-row__device" aria-hidden="true"><TbIcon name="devices" :size="26" /></span>
              <div class="rb-row__id">
                <p class="rb-row__name">
                  <span v-if="r.name">{{ r.name }}</span>
                  <span v-else class="rb-row__unnamed">{{ $t('robots.unnamed') }}</span>
                  <TbTag class="rb-row__product">{{ productName(r, lang) }}</TbTag>
                </p>
                <p class="rb-row__mac">
                  <span v-if="r.mac.valid" class="rb-mac" tabindex="0" :aria-label="$t('robots.macLabel', { mac: r.mac.text })">{{ r.mac.prefix }}<span class="rb-mac__dots" aria-hidden="true">{{ maskDots(r.mac.middle) }}</span><span class="rb-mac__mask" aria-hidden="true">{{ r.mac.middle }}</span>{{ r.mac.suffix }}</span>
                  <span v-else class="rb-mac">{{ r.mac.text }}</span>
                </p>
              </div>
              <!-- the same connection word as every page (src/shell/robotStatus.js): never "online"
                   before the companion server has heard from the robot -->
              <p class="rb-row__state" :class="[`is-${r.status.state}`, { 'is-online': r.online }]">
                <TbRobotStatus v-if="r.status.state !== 'checking'" compact :status="r.status" />
                <small v-if="r.status.state === 'not_syncing' && r.status.lastSync">{{ $t('status.lastSync', { when: whenText(r.status.lastSync) }) }}</small>
                <small v-else-if="r.status.state !== 'online' && r.status.state !== 'waiting_companion'">{{ (r.status.lastSeen || r.lastConnectedAt) ? $t('robots.seen', { when: whenText(r.status.lastSeen || r.lastConnectedAt) }) : $t('robots.never') }}</small>
              </p>
              <div class="rb-row__act rb-row__acts">
                <span v-if="r.deviceId === robot.deviceId" class="rb-now" role="status"><i aria-hidden="true"></i>{{ $t('robots.current') }}</span>
                <TbButton v-else size="s" icon="check" @click="makeMine(r)">{{ $t('robots.makeMine') }}</TbButton>
                <TbButton size="s" variant="quiet" icon="today" @click="goToday(r)">{{ $t('robots.today') }}</TbButton>
                <TbButton size="s" variant="quiet" icon="devices" :to="{ path: '/device-management', query: { agentId: g.agent.id } }">{{ $t('robots.devices') }}</TbButton>
                <TbButton size="s" variant="quiet" icon="agent" :to="{ path: '/role-config', query: { agentId: g.agent.id } }">{{ $t('robots.character') }}</TbButton>
              </div>
            </li>
            </template>

            <li v-if="g.failed" class="rb-row rb-row--note" role="alert">
              <p>{{ $t('robots.devicesFailed') }}</p>
              <TbButton size="s" variant="quiet" icon="refresh" @click="loadDevices(g.agent.id)">{{ $t('common.retry') }}</TbButton>
            </li>
            <li v-else-if="!g.robots.length" class="rb-row rb-row--note">
              <p>{{ $t('robots.noneHere') }}</p>
              <TbButton size="s" variant="quiet" icon="agent" :to="{ path: '/role-config', query: { agentId: g.agent.id } }">{{ $t('robots.character') }}</TbButton>
            </li>
          </ul>
        </article>
      </template>
    </section>

    <!-- New character (AddWisdomBodyDialog) -->
    <TbSheet v-model:open="charSheet" :title="$t('robots.addChar.title')" size="s" :close-label="$t('common.close')" @close="charName = ''; charError = ''">
      <form id="rb-char-form" novalidate @submit.prevent="submitCharacter">
        <TbField :label="$t('robots.addChar.name')" :hint="$t('robots.addChar.hint')" :error="charError" required for-id="rb-char-name">
          <TbInput id="rb-char-name" v-model="charName" :maxlength="64" :invalid="!!charError"
            :placeholder="$t('robots.addChar.placeholder')" @update:model-value="charError = ''">
            <template #suffix><span class="tb-num">{{ num(charName.length) }}/{{ num(64) }}</span></template>
          </TbInput>
        </TbField>
      </form>
      <template #footer>
        <TbButton @click="charSheet = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" :loading="charSaving" @click="submitCharacter">{{ $t('robots.addChar.submit') }}</TbButton>
      </template>
    </TbSheet>

    <!-- Add a robot: by spoken code (AddDeviceDialog) or by MAC (ManualAddDeviceDialog) -->
    <TbSheet v-model:open="addSheet" :title="$t('robots.add.title')" :close-label="$t('common.close')" @close="resetAdd">
      <form id="rb-add-form" class="rb-add" novalidate @submit.prevent>
        <TbField v-if="allAgents.length > 1" :label="$t('robots.add.character')" for-id="rb-add-agent">
          <TbSelect id="rb-add-agent" v-model="addAgentId" :options="agentOptions" />
        </TbField>
        <TbField :label="$t('robots.add.how')">
          <TbChoice v-model="addMode" :aria-label="$t('robots.add.how')" :options="[
            { value: 'code', label: $t('robots.add.byCode') }, { value: 'mac', label: $t('robots.add.byMac') }]" @change="onMode" />
        </TbField>

        <template v-if="addMode === 'code'">
          <p class="rb-add__help">{{ $t('robots.add.codeHelp') }}</p>
          <TbField :label="$t('robots.add.code')" :hint="`${$t('robots.add.codeHint')} ${$t('robots.add.codePaste')}`" :error="codeError" required for-id="rb-add-code">
            <TbInput id="rb-add-code" :model-value="code" class="rb-add__code" inputmode="numeric" :maxlength="6"
              autocomplete="one-time-code" placeholder="000000" :invalid="!!codeError" @update:model-value="onCode" @enter="submitAdd"
              @paste="onCodePaste" />
          </TbField>
        </template>

        <template v-else>
          <p class="rb-add__help">{{ $t('robots.add.macHelp') }}</p>
          <TbField :label="$t('robots.add.mac')" :error="manualErr.macAddress" required for-id="rb-add-mac">
            <TbInput id="rb-add-mac" v-model="manual.macAddress" placeholder="00:1A:2B:3C:4D:5E" :invalid="!!manualErr.macAddress"
              @blur="touch('macAddress')" @enter="submitAdd" />
          </TbField>
          <div class="rb-add__pair">
            <TbField :label="$t('robots.add.board')" :error="manualErr.board" required for-id="rb-add-board">
              <TbSelect id="rb-add-board" v-model="manual.board" :options="boardOptions" :placeholder="$t('robots.add.boardPlaceholder')"
                :invalid="!!manualErr.board" @change="touch('board')" />
            </TbField>
            <TbField :label="$t('robots.add.version')" :error="manualErr.appVersion" required for-id="rb-add-version">
              <TbInput id="rb-add-version" v-model="manual.appVersion" :placeholder="$t('robots.add.versionPlaceholder')"
                :invalid="!!manualErr.appVersion" @blur="touch('appVersion')" @enter="submitAdd" />
            </TbField>
          </div>
        </template>
      </form>
      <template #footer>
        <TbButton @click="addSheet = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" :loading="adding" @click="submitAdd">{{ $t('robots.add.submit') }}</TbButton>
      </template>
    </TbSheet>

    <!-- Delete a character: type its name (home.vue) -->
    <TbSheet v-model:open="delSheet" :title="$t('robots.del.title')" size="s" :close-label="$t('common.close')"
      :close-on-scrim="!deleting" :close-on-esc="!deleting" @close="resetDelete">
      <div class="rb-del">
        <p>{{ $t('robots.del.text') }}</p>
        <p v-if="delTarget.count" class="rb-del__count">{{ $t('robots.del.robots', { n: num(delTarget.count) }, delTarget.count) }}</p>
        <p class="rb-del__name" @copy.prevent @cut.prevent @contextmenu.prevent>{{ delTarget.name }}</p>
        <TbField :label="$t('robots.del.input')" :error="delText && !delMatches ? $t('robots.del.mismatch') : ''" for-id="rb-del-input">
          <div @paste.capture.prevent="noPaste" @drop.capture.prevent="noPaste" @contextmenu.prevent>
            <TbInput id="rb-del-input" v-model="delText" :placeholder="$t('robots.del.placeholder')" :invalid="!!delText && !delMatches"
              @enter="confirmDelete" />
          </div>
        </TbField>
      </div>
      <template #footer>
        <TbButton :disabled="deleting" @click="delSheet = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="danger" icon="trash" :loading="deleting" :disabled="!delMatches" @click="confirmDelete">{{ $t('robots.del.confirm') }}</TbButton>
      </template>
    </TbSheet>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { digits } from '@/kit/calendar';
import { clearRobot, loadProducts, products, robot, selectRobot } from '@/shell/robot';
import { hasCompanion, links, noteMqttMap, refreshCompanion, statusOf } from '@/shell/robotStatus';
import { productName, productOf } from '@/shell/products';
import featureManager from '@/utils/featureManager';
import {
  cleanCode, isOnline, isValidCode, lastSeen, manualErrors, maskMac, nameMatches, parseStatus, pushHistory,
  searchTypeOf, toRobot,
} from './robotsModel';

const { t, locale } = useI18n({ useScope: 'global' });
const router = useRouter();
const lang = computed(() => locale.value);
const num = (n) => digits(n, lang.value);

/* ---------- data ---------- */
const allAgents = ref([]);       // every agent of the account (the full list)
const shownAgents = ref([]);     // what the list shows (all, or the search result)
const devicesByAgent = reactive({}); // agentId -> raw devices
const failedAgents = reactive({});   // agentId -> true when its devices failed to load
const statusByAgent = reactive({});  // agentId -> status map (null when the service is not there)
const loading = ref(true);
const failed = ref(false);
const clock = ref(Date.now());
const voiceprint = ref(false);

const hasAgents = computed(() => allAgents.value.length > 0);

// More than one product among the account's devices: rows are grouped by product inside each
// character (with a small product heading); with one product the tag on each row is enough.
const productKeys = computed(() => new Set(allAgents.value.flatMap((a) => (devicesByAgent[a.id] || [])
  .map((d) => productOf(d, products.list).productKey))));
const multiProduct = computed(() => productKeys.value.size > 1);
const productRank = computed(() => {
  const order = products.list.map((p) => p.productKey);
  return (k) => { const i = order.indexOf(k); return i < 0 ? order.length : i; };
});
const groups = computed(() => shownAgents.value.map((agent) => {
  const raw = devicesByAgent[agent.id];
  let robots = (raw || []).map((d) => {
    const r = toRobot(agent, d);
    const item = { ...r, ...productOf(d, products.list) };
    const status = statusOf(r.deviceId, { item, now: clock.value });
    return { ...item, mac: maskMac(r.macAddress), status, online: status.state === 'online' };
  });
  if (multiProduct.value) {
    const rank = productRank.value;
    robots = robots.map((r, i) => ({ r, i })).sort((a, b) => (rank(a.r.productKey) - rank(b.r.productKey))
      || a.r.productKey.localeCompare(b.r.productKey) || a.i - b.i)
      .map(({ r }, i, all) => ({ ...r, productHead: i === 0 || all[i - 1].r.productKey !== r.productKey }));
  }
  return { agent, robots, count: raw ? robots.length : (Number(agent.deviceCount) || 0), failed: !!failedAgents[agent.id] };
}));
const robotCount = computed(() => groups.value.reduce((n, g) => n + g.count, 0));
const onlineCount = computed(() => groups.value.reduce((n, g) => n + g.robots.filter((r) => r.online).length, 0));
const summary = computed(() => t('robots.summary', {
  characters: t('robots.countCharacters', { n: num(groups.value.length) }, groups.value.length),
  robots: t('robots.countRobots', { n: num(robotCount.value) }, robotCount.value),
}));

function whenText(value) {
  const s = lastSeen(value, clock.value);
  if (s.kind === 'never') return t('robots.never');
  if (s.kind === 'just') return t('robots.justNow');
  if (s.kind === 'minutes') return t('robots.minutesAgo', { m: num(s.minutes) });
  if (s.kind === 'hours') return t('robots.hoursAgo', { h: num(s.hours), m: num(s.minutes) });
  return new Intl.DateTimeFormat(lang.value === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s.at));
}

// The voice by its display name only (the agent list's ttsVoiceName); provider and model IDs stay
// on the Character page.
function modelsText(a) {
  const tts = (a.ttsVoiceName || '').trim();
  return tts ? t('robots.models', { tts }) : '';
}

// The hidden middle bytes of a MAC drawn as dots, keeping the separators: ':85:00:' -> ':••:••:'.
function maskDots(middle) {
  return String(middle || '').replace(/[^:\-]/g, '•');
}

/* ---------- loading (GET /agent/list, GET /device/bind/{id}, POST /device/bind/{id}) ---------- */
function fetchDevices(agentId) {
  return new Promise((resolve) => {
    Api.device.getAgentBindDevices(agentId, ({ data }) => {
      if (data && data.code === 0) { devicesByAgent[agentId] = data.data || []; delete failedAgents[agentId]; }
      else failedAgents[agentId] = true;
      resolve();
    }, () => { failedAgents[agentId] = true; resolve(); });
  });
}

function fetchStatus(agentId) {
  return new Promise((resolve) => {
    const done = (map) => {
      statusByAgent[agentId] = map;
      const devs = devicesByAgent[agentId] || [];
      noteMqttMap(map, devs);
      checkCompanions(devs, map);
      resolve();
    };
    Api.device.getDeviceStatus(agentId, ({ data }) => done(data && data.code === 0 ? parseStatus(data.data) : null), () => done(null));
  });
}

// The gateway alone cannot say "online": a robot can be on MQTT and still unknown to the companion
// server. Ask the companion view of the account's own companion robots the gateway calls online
// (or all of them when there is no gateway map), each at most every 30 s, a few at a time.
const COMPANION_EVERY = 30000;
const COMPANION_MAX = 8;
function checkCompanions(devs, map) {
  const now = Date.now();
  devs.filter((d) => hasCompanion(d.id, productOf(d, products.list)))
    .filter((d) => !map || isOnline(map, d))
    .filter((d) => now - ((links[d.id] && links[d.id].companionAt) || 0) > COMPANION_EVERY)
    .slice(0, COMPANION_MAX)
    .forEach((d) => refreshCompanion(d.id));
}

/** The row's face: awake when online, asleep when offline, puzzled when the server side is not right. */
function rowMood(r) {
  if (r.online) return 'awake';
  return ['offline', 'checking'].includes(r.status.state) ? 'offline' : 'confused';
}

async function loadDevices(agentId) {
  await fetchDevices(agentId);
  if (!failedAgents[agentId]) fetchStatus(agentId);
}

async function fillAgents(list) {
  await Promise.all(list.map((a) => fetchDevices(a.id)));
  list.forEach((a) => { if (!failedAgents[a.id]) fetchStatus(a.id); });
}

/** Mirror the account's robots into the shell's "this robot" (same rule as loadRobots). */
function syncShell() {
  const list = allAgents.value.flatMap((a) => (devicesByAgent[a.id] || []).map((d) => ({ ...toRobot(a, d), ...productOf(d, products.list) })));
  robot.list = list;
  robot.loaded = true;
  const still = list.find((r) => r.deviceId === robot.deviceId);
  if (still) { if (still.name !== robot.name || still.productKey !== robot.productKey) selectRobot(still); } else if (list.length) selectRobot(list[0]);
  if (!list.length) clearRobot();
}

function load() {
  return new Promise((resolve) => {
    loading.value = true;
    failed.value = false;
    clock.value = Date.now();
    loadProducts();
    Api.agent.getAgentList(async ({ data }) => {
      if (!data || data.code !== 0) {
        loading.value = false; failed.value = true; resolve(); return;
      }
      allAgents.value = data.data || [];
      await fillAgents(allAgents.value);
      if (isSearching.value) await runSearch(searchedFor.value, true);
      else shownAgents.value = allAgents.value;
      syncShell();
      loading.value = false;
      resolve();
    });
  });
}

/* ---------- search (home.vue: GET /agent/list?keyword=&searchType=name|mac, history) ---------- */
const HISTORY_KEY = 'agent_search_history';
const search = ref('');
const searchedFor = ref('');
const isSearching = ref(false);
const historyOpen = ref(false);
const history = ref(readHistory());

function readHistory() {
  try { const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; }
}
function writeHistory() {
  try {
    if (history.value.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value));
    else localStorage.removeItem(HISTORY_KEY);
  } catch (e) { /* private mode */ }
}
function closeHistorySoon() { setTimeout(() => { historyOpen.value = false; }, 200); }
function pickHistory(h) { search.value = h; runSearch(); }
function removeHistory(i) { history.value.splice(i, 1); writeHistory(); }
function clearHistory() { history.value = []; writeHistory(); }

function runSearch(value, silent = false) {
  const q = String(value ?? search.value).trim();
  if (!q) { resetSearch(); return Promise.resolve(); }
  if (!silent) {
    history.value = pushHistory(history.value, q);
    writeHistory();
    historyOpen.value = false;
    document.activeElement?.blur?.();
  }
  isSearching.value = true;
  searchedFor.value = q;
  if (!silent) loading.value = true;
  return new Promise((resolve) => {
    Api.agent.searchAgent(q, searchTypeOf(q), async ({ data }) => {
      if (data && data.code === 0) {
        const list = data.data || [];
        await fillAgents(list.filter((a) => !devicesByAgent[a.id]));
        shownAgents.value = list;
      } else {
        toast.error(t('robots.searchFailed'));
      }
      if (!silent) loading.value = false;
      resolve();
    });
  });
}
function resetSearch() {
  isSearching.value = false;
  searchedFor.value = '';
  shownAgents.value = allAgents.value;
}
function clearSearch() { search.value = ''; resetSearch(); }

/* ---------- this robot ---------- */
function makeMine(r) {
  selectRobot(r);
  toast.success(t('robots.selected', { name: r.name || r.agentName || t('nav.robotFallback') }));
}
function goToday(r) {
  selectRobot(r);
  router.push('/today');
}

/* ---------- menu per character ---------- */
function menuFor(g) {
  const items = [
    { key: 'character', label: t('robots.character'), icon: 'agent' },
    { key: 'devices', label: t('robots.devices'), icon: 'devices' },
  ];
  if (voiceprint.value) items.push({ key: 'voiceprint', label: t('nav.voiceprint'), icon: 'voiceprint' });
  items.push({ divider: true }, { key: 'delete', label: t('robots.del.menu'), icon: 'trash', danger: true });
  void g;
  return items;
}
function onMenu(key, g) {
  const q = { agentId: g.agent.id };
  if (key === 'character') router.push({ path: '/role-config', query: q });
  else if (key === 'devices') router.push({ path: '/device-management', query: q });
  else if (key === 'voiceprint') router.push({ path: '/voice-print', query: q });
  else if (key === 'delete') openDelete(g);
}

/* ---------- new character (POST /agent) ---------- */
const charSheet = ref(false);
const charName = ref('');
const charError = ref('');
const charSaving = ref(false);
let thenAddRobot = false;

function openAddCharacter(addRobotAfter) {
  thenAddRobot = !!addRobotAfter;
  charName.value = '';
  charError.value = '';
  charSheet.value = true;
}
function submitCharacter() {
  if (charSaving.value) return;
  const name = charName.value;
  if (!name.trim()) { charError.value = t('robots.addChar.required'); return; }
  charSaving.value = true;
  Api.agent.addAgent(name, async (res) => {
    charSaving.value = false;
    const body = res && res.data;
    if (body && body.code !== undefined && body.code !== 0) {
      toast.error(body.msg || t('robots.addChar.failed'));
      return;
    }
    toast.success(t('robots.addChar.done'));
    charSheet.value = false;
    charName.value = '';
    const before = new Set(allAgents.value.map((a) => a.id));
    await load();
    if (thenAddRobot) {
      const made = (typeof body?.data === 'string' && allAgents.value.find((a) => a.id === body.data))
        || allAgents.value.find((a) => !before.has(a.id) && a.agentName === name)
        || allAgents.value.find((a) => !before.has(a.id));
      if (made) setTimeout(() => openAddRobot(made.id), 200);
    }
    thenAddRobot = false;
  });
}

/* ---------- add a robot (POST /device/bind/{agentId}/{code}, POST /device/manual-add) ---------- */
const addSheet = ref(false);
const addMode = ref('code');
const addAgentId = ref('');
const code = ref('');
const codeError = ref('');
const adding = ref(false);
const manual = reactive({ macAddress: '', board: '', appVersion: '' });
const touched = reactive({ macAddress: false, board: false, appVersion: false });
const boards = ref([]);
let boardsLoaded = false;

const agentOptions = computed(() => allAgents.value.map((a) => ({ value: a.id, label: a.agentName })));
const boardOptions = computed(() => boards.value.map((b) => ({ value: b.key, label: b.name })));
const manualErr = computed(() => {
  const e = manualErrors(manual);
  const text = {
    macAddress: { required: t('robots.add.macRequired'), invalid: t('robots.add.macInvalid') }[e.macAddress] || '',
    board: e.board ? t('robots.add.boardRequired') : '',
    appVersion: e.appVersion ? t('robots.add.versionRequired') : '',
  };
  return Object.fromEntries(Object.entries(text).map(([k, v]) => [k, touched[k] ? v : '']));
});

function openAddRobot(agentId) {
  if (!hasAgents.value) { openAddCharacter(true); return; }
  resetAdd();
  addAgentId.value = agentId || robot.agentId || allAgents.value[0].id;
  if (!allAgents.value.some((a) => a.id === addAgentId.value)) addAgentId.value = allAgents.value[0].id;
  addSheet.value = true;
}
function resetAdd() {
  addMode.value = 'code';
  code.value = '';
  codeError.value = '';
  adding.value = false;
  Object.assign(manual, { macAddress: '', board: '', appVersion: '' });
  Object.assign(touched, { macAddress: false, board: false, appVersion: false });
}
function onCode(v) { code.value = cleanCode(v); codeError.value = ''; }
// A pasted code, digits with spaces, Bangla digits or the robot's whole link (its QR URL): take the
// code out of it before the 6-character limit cuts the text.
function onCodePaste(e) {
  const text = e.clipboardData && e.clipboardData.getData('text');
  if (!text) return;
  e.preventDefault();
  const next = cleanCode(text);
  if (e.target && 'value' in e.target) e.target.value = next;
  onCode(next);
}
function touch(k) { touched[k] = true; }

async function onMode(mode) {
  if (mode !== 'mac' || boardsLoaded) return;
  try {
    const res = await Api.dict.getDictDataByType('FIRMWARE_TYPE');
    boards.value = (res && res.data) || [];
    boardsLoaded = true;
  } catch (e) {
    toast.error((e && e.message) || t('robots.add.boardsFailed'));
  }
}

function afterAdd(agentId, message) {
  toast.success(message);
  addSheet.value = false;
  resetAdd();
  clock.value = Date.now();
  loadDevices(agentId).then(syncShell);
}

function submitAdd() {
  if (adding.value) return;
  const agentId = addAgentId.value;
  if (addMode.value === 'code') {
    if (!isValidCode(code.value)) { codeError.value = t('robots.add.codeInvalid'); return; }
    adding.value = true;
    Api.device.bindDevice(agentId, code.value, ({ data }) => {
      adding.value = false;
      if (data && data.code === 0) afterAdd(agentId, t('robots.add.bound'));
      else toast.error((data && data.msg) || t('robots.add.bindFailed'));
    }, (err) => {
      adding.value = false;
      toast.error((err && err.data && err.data.msg) || t('robots.add.bindFailed'));
    });
    return;
  }
  Object.assign(touched, { macAddress: true, board: true, appVersion: true });
  if (Object.values(manualErrors(manual)).some(Boolean)) return;
  adding.value = true;
  Api.device.manualAddDevice({ agentId, ...manual, macAddress: manual.macAddress.trim(), appVersion: manual.appVersion.trim() }, ({ data }) => {
    adding.value = false;
    if (data && data.code === 0) afterAdd(agentId, t('robots.add.added'));
    else toast.error((data && data.msg) || t('robots.add.addFailed'));
  }, (err) => {
    adding.value = false;
    toast.error((err && err.data && err.data.msg) || t('robots.add.addFailed'));
  });
}

/* ---------- delete a character (DELETE /agent/{id}) ---------- */
const delSheet = ref(false);
const delTarget = reactive({ id: '', name: '', count: 0 });
const delText = ref('');
const deleting = ref(false);
const delMatches = computed(() => nameMatches(delText.value, delTarget.name));

function openDelete(g) {
  const id = g.agent.id;
  const name = g.agent.agentName || '';
  if (!id || !name) { toast.error(t('robots.del.missing')); return; }
  Object.assign(delTarget, { id, name, count: g.count });
  delText.value = '';
  delSheet.value = true;
  nextTick(() => document.getElementById('rb-del-input')?.focus());
}
function noPaste() { toast.warning(t('robots.del.noPaste')); }
function resetDelete() {
  if (deleting.value) return;
  Object.assign(delTarget, { id: '', name: '', count: 0 });
  delText.value = '';
}
function confirmDelete() {
  if (!delMatches.value || deleting.value) return;
  deleting.value = true;
  Api.agent.deleteAgent(delTarget.id, (res) => {
    deleting.value = false;
    if (res && res.data && res.data.code === 0) {
      toast.success(t('robots.del.done'));
      delete devicesByAgent[delTarget.id];
      delSheet.value = false;
      resetDelete();
      load();
    } else {
      toast.error((res && res.data && res.data.msg) || t('robots.del.failed'));
    }
  });
}

/* ---------- life ---------- */
let poll = null;
function refreshStatus() {
  if (document.hidden || loading.value) return;
  clock.value = Date.now();
  shownAgents.value.forEach((a) => { if (devicesByAgent[a.id] && devicesByAgent[a.id].length) fetchStatus(a.id); });
}
onMounted(async () => {
  load();
  poll = setInterval(refreshStatus, 30000);
  document.addEventListener('visibilitychange', refreshStatus);
  try {
    await featureManager.waitForInitialization();
    voiceprint.value = !!featureManager.getConfig().voiceprintRecognition;
  } catch (e) { voiceprint.value = false; }
});
onBeforeUnmount(() => { clearInterval(poll); document.removeEventListener('visibilitychange', refreshStatus); });
</script>

<style>
.robots { padding-bottom: var(--tb-s10); }

/* search and summary */
.robots__bar { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s3) var(--tb-s6); flex-wrap: wrap;
  padding: var(--tb-s4) 0; border-bottom: 1px solid var(--tb-rule); }
.robots__search { position: relative; flex: 0 1 420px; min-width: min(100%, 260px); }
.robots__summary { color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.robots__on { color: var(--tb-ok); font-weight: 600; }
.robots__history {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40; padding: 6px;
  background: var(--tb-paper); border: 1px solid var(--tb-rule); border-radius: var(--tb-radius-m); box-shadow: var(--tb-shadow-sheet);
}
.robots__history-head { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px 6px;
  font-size: var(--tb-fs-12); color: var(--tb-ink-2); border-bottom: 1px solid var(--tb-rule-soft); }
.robots__history ul { list-style: none; margin: 4px 0 0; padding: 0; }
.robots__history li { display: flex; align-items: center; }
.robots__history-item { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 8px;
  border: 0; border-radius: 6px; background: none; text-align: left; color: var(--tb-ink); }
.robots__history-item .tb-icon { color: var(--tb-ink-3); flex: none; }
.robots__history-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.robots__history-x { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 6px; background: none; color: var(--tb-ink-2); }
.robots__linkbtn { border: 0; background: none; padding: 4px 0; color: var(--tb-action); font-weight: 600; font-size: var(--tb-fs-12); }
@media (hover: hover) and (pointer: fine) {
  .robots__history-item:hover, .robots__history-x:hover { background: var(--tb-paper-2); }
  .robots__linkbtn:hover { text-decoration: underline; }
}

/* states */
.robots__state { padding: var(--tb-s10) 0; display: flex; justify-content: center; }
.robots__fail { flex-direction: column; align-items: center; gap: var(--tb-s3); color: var(--tb-danger); }
.robots__first { padding: var(--tb-s10) 0; }
.robots__first .tb-empty { max-width: 58ch; }

/* a character: its name over a heavy rule, its robots as ruled rows beneath. On wide screens the
   whole list is one grid (subgrid), so names, states and actions line up across every character. */
.robots__list { --rb-cols: 76px minmax(0, 1.2fr) minmax(130px, .8fr) auto; }
.rb-group { padding-top: var(--tb-s6); }
.rb-group__head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--tb-s3) var(--tb-s4); flex-wrap: wrap;
  padding-bottom: var(--tb-s3); border-bottom: var(--tb-rule-band) solid var(--tb-rule); }
.rb-group__id { min-width: 0; display: grid; gap: 2px; }
.rb-group__name { font-size: var(--tb-fs-24); font-weight: 800; overflow-wrap: anywhere; }
.rb-group__meta { display: flex; flex-wrap: wrap; gap: 2px var(--tb-s4); font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.rb-group__meta .tb-num { color: var(--tb-ink); font-weight: 600; }
.rb-group__models { font-size: var(--tb-fs-13); color: var(--tb-ink-3); overflow-wrap: anywhere; }
.rb-group__act { display: flex; gap: 6px; align-items: center; }

.rb-rows { list-style: none; margin: 0; padding: 0; }
.rb-row {
  display: grid; align-items: center; gap: var(--tb-s2) var(--tb-s4);
  grid-template-columns: var(--rb-cols);
  grid-template-areas: "face id state act";
  padding: var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule-soft);
  transition: border-color var(--tb-t-hover) var(--tb-ease);
}
@supports (grid-template-columns: subgrid) {
  @media (min-width: 901px) {
    .robots__list:has(.rb-group) { display: grid; grid-template-columns: var(--rb-cols); column-gap: var(--tb-s4); }
    .rb-group, .rb-rows { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; }
    .rb-group__head, .rb-row--note, .rb-row--product { grid-column: 1 / -1; }
    .rb-row:not(.rb-row--note):not(.rb-row--product) { grid-column: 1 / -1; grid-template-columns: subgrid; }
  }
}
.rb-row__face { grid-area: face; }
.rb-row--product { display: block; padding: var(--tb-s4) 0 var(--tb-s1); font-size: var(--tb-fs-13); font-weight: 700; color: var(--tb-ink-2); }
.rb-row__product { margin-left: 8px; vertical-align: 2px; font-weight: 600; }
.rb-row__device { display: grid; place-items: center; width: 76px; aspect-ratio: 4 / 3; border: 1px solid var(--tb-rule); border-radius: 8px; color: var(--tb-ink-2); }
.rb-row__id { grid-area: id; min-width: 0; display: grid; gap: 2px; }
.rb-row__name { font-weight: 700; font-size: var(--tb-fs-16); overflow-wrap: anywhere; }
.rb-row__unnamed { color: var(--tb-ink-2); font-weight: 500; }
.rb-row__mac { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.rb-row__state { grid-area: state; display: grid; gap: 0; font-size: var(--tb-fs-14); font-weight: 600; }
.rb-row__state .tb-rstat.is-compact { font-size: var(--tb-fs-14); white-space: normal; }
.rb-row__state small { font-size: var(--tb-fs-13); font-weight: 400; color: var(--tb-ink-2); max-width: 28ch; }
.rb-row__act { grid-area: act; display: flex; align-items: center; justify-content: flex-end; gap: 4px; flex-wrap: wrap; }
.rb-row--note { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s3); color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.rb-row--note[role="alert"] { color: var(--tb-danger); }
@media (hover: hover) and (pointer: fine) { .rb-row:hover { border-bottom-color: var(--tb-rule); } }

/* the current robot: the orange now-mark drawn as a rule, with its word */
.rb-now { display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 12px 0 4px;
  color: var(--tb-action); font-weight: 700; font-size: var(--tb-fs-13); white-space: nowrap; }
.rb-now i { width: 22px; height: 0; border-top: 3px solid var(--tb-orange); }
.rb-row.is-current .rb-row__name::before { content: ""; display: inline-block; width: 9px; height: 9px; margin-right: 8px;
  background: var(--tb-orange); vertical-align: 2px; }

/* MAC with its middle bytes hidden (hover or focus shows it) */
.rb-mac { font-variant-numeric: tabular-nums; white-space: nowrap; border-radius: 4px; }
.rb-mac__dots { color: var(--tb-ink-3); }
.rb-mac__mask { display: none; }
.rb-row__mac:hover .rb-mac__dots, .rb-row__mac:focus-within .rb-mac__dots { display: none; }
.rb-row__mac:hover .rb-mac__mask, .rb-row__mac:focus-within .rb-mac__mask { display: inline; }

/* sheets */
.rb-add { display: grid; gap: var(--tb-s4); }
.rb-add__help { color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.rb-add__code .tb-input__el { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-24); letter-spacing: .3em; font-variant-numeric: tabular-nums; }
.rb-add__pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--tb-s4); }
.rb-del { display: grid; gap: var(--tb-s3); }
.rb-del__count { color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.rb-del__name { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-20); padding: var(--tb-s2) 0;
  border-top: 1px solid var(--tb-rule-soft); border-bottom: 1px solid var(--tb-rule-soft); user-select: none; -webkit-user-select: none; overflow-wrap: anywhere; }

@media (max-width: 900px) {
  .robots__list { --rb-cols: 76px minmax(0, 1fr) auto; }
  .rb-row { grid-template-areas: "face id state" "act act act"; }
  .rb-row__act { justify-content: flex-start; }
}
@media (max-width: 640px) {
  .robots__search { flex-basis: 100%; }
  .robots__list { --rb-cols: 64px minmax(0, 1fr); }
  .rb-row { grid-template-areas: "face id" "face state" "act act"; row-gap: 4px; }
  .rb-row__face { width: 64px !important; align-self: start; }
  .rb-row__act { margin-top: 6px; }
  .rb-row__act .tb-btn, .rb-group__act .tb-btn { --h: 44px; }
  .rb-now { min-height: 44px; }
  .rb-add__pair { grid-template-columns: 1fr; }
}
/* phone: the row's actions become one ruled strip of equal cells, each a full touch target */
@media (max-width: 719px) {
  .rb-row__acts { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 0;
    border-top: 1px solid var(--tb-rule-soft); }
  .rb-row__acts > * { min-width: 0; }
  .rb-row__acts .tb-btn { min-height: var(--tb-target); border-top: 0; border-right: 0; border-bottom: 0; border-left-width: 0;
    border-radius: 0; padding: 0 6px; white-space: normal; text-align: center; line-height: 1.2; }
  .rb-row__acts > .tb-btn + .tb-btn, .rb-row__acts > .rb-now + .tb-btn { border-left: 1px solid var(--tb-rule-soft); }
  .rb-row__acts .rb-now { min-height: var(--tb-target); justify-content: center; padding: 0 6px; white-space: normal; }
}
</style>
