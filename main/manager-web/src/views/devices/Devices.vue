<template>
  <div class="dv">
    <TbPageHeader :title="title" :description="description">
      <template v-if="agentId" #actions>
        <TbButton variant="quiet" icon="refresh" :loading="refreshing" @click="refreshNow">{{ $t('devices.refresh') }}</TbButton>
        <TbButton variant="primary" icon="plus" @click="openAdd('code')">{{ $t('devices.addRobot') }}</TbButton>
      </template>
    </TbPageHeader>

    <div v-if="!agentId" class="dv__none">
      <TbEmpty face="confused" :title="$t('devices.noAgentTitle')" :text="$t('devices.noAgentText')">
        <TbButton variant="primary" icon="robots" to="/robots">{{ $t('common.goRobots') }}</TbButton>
      </TbEmpty>
    </div>

    <template v-else>
      <div class="dv__bar">
        <TbChoice v-if="productList.length > 1" v-model="productFilter" class="dv__products" wrap :options="productOptions"
          :aria-label="$t('devices.product')" />
        <TbInput v-model="query" class="dv__search" icon="search" clearable :placeholder="$t('devices.search')"
          :aria-label="$t('devices.search')" :clear-label="$t('devices.clearSearch')" />
        <Transition name="dv-fade">
          <div v-if="selected.length" class="dv__bulk" role="region" :aria-label="$t('devices.selected', { count: num(selected.length) })">
            <span class="dv__bulkcount">{{ $t('devices.selected', { count: num(selected.length) }) }}</span>
            <TbButton size="s" variant="quiet" @click="selected = []">{{ $t('devices.clearSelection') }}</TbButton>
            <TbButton size="s" variant="danger" icon="trash" @click="unbindSelected">{{ $t('devices.unbindSelected') }}</TbButton>
          </div>
        </Transition>
      </div>

      <TbTable class="dv__table" :columns="columns" :rows="pageRows" row-key="device_id" :loading="loading && !rows.length"
        selectable v-model:selected="selected" :caption="$t('devices.listLabel')" :loading-text="$t('common.loading')"
        :select-all-label="$t('devices.selectAll')" :select-row-label="$t('devices.selectRow')" :row-class="rowClass">
        <template #cell-robot="{ row }">
          <div class="dv-bot">
            <TbFace v-if="row.features.includes('companion')" class="dv-bot__face" :mood="faceMood(row)" :width="64" :alt="$t('devices.faceAlt', { name: nameOf(row) })" />
            <span v-else class="dv-bot__face dv-bot__device" aria-hidden="true"><TbIcon name="devices" :size="24" /></span>
            <div class="dv-bot__text">
              <TbInput v-if="editing === row.device_id" :ref="setAliasInput" v-model="draft" size="s" :maxlength="64"
                :aria-label="$t('devices.alias')" @enter="commitAlias(row)" @blur="commitAlias(row)" @keydown.esc="cancelAlias" />
              <button v-else type="button" class="dv-bot__name" :class="{ 'is-empty': !row.alias }" :title="$t('devices.renameHint')"
                @click="startAlias(row)">
                <span>{{ row.alias || $t('devices.unnamed') }}</span><TbIcon name="edit" :size="14" />
              </button>
              <span class="dv-bot__meta"><TbTag class="dv-bot__product">{{ productName(row, locale) }}</TbTag>{{ [boardName(row.model), addedText(row)].filter(Boolean).join(' · ') }}</span>
            </div>
          </div>
        </template>

        <!-- the same connection word as every page (src/shell/robotStatus.js): never "online"
             before the companion server has heard from the robot -->
        <template #cell-state="{ row }">
          <div class="dv-state" :class="`is-${statusFor(row).state}`">
            <TbRobotStatus compact :status="statusFor(row)" />
            <time class="dv-seen" :datetime="row.lastConnectedRaw ? new Date(row.lastConnectedRaw).toISOString() : null"
              :title="row.lastConnectedRaw ? fullDate(row.lastConnectedRaw) : null">{{ seenLine(row) }}</time>
          </div>
        </template>

        <template #cell-mac="{ row }">
          <MacMask :mac="row.macAddress" :show-label="$t('devices.macShow')" :hide-label="$t('devices.macHide')"
            :hidden-label="$t('devices.macHidden')" />
        </template>

        <template #cell-firmware="{ row }">
          <div class="dv-fw">
            <span class="dv-fw__ver tb-num">{{ row.firmwareVersion ? num(row.firmwareVersion) : '–' }}</span>
            <TbSwitch :model-value="row.autoUpdate" :label="$t('devices.autoUpdate')" :loading="savingOta === row.device_id"
              @update:model-value="setAutoUpdate(row, $event)" />
          </div>
        </template>

        <template #cell-actions="{ row }">
          <div class="dv-act">
            <TbButton size="s" icon="today" @click="openToday(row)">{{ $t('devices.openToday') }}</TbButton>
            <TbMenu :items="menuItems(row)" @select="(key) => onMenu(key, row)">
              <template #trigger>
                <button type="button" class="dv-more" :aria-label="$t('devices.moreFor', { name: nameOf(row) })" aria-haspopup="menu">
                  <TbIcon name="more" :size="22" :stroke="3.5" />
                </button>
              </template>
            </TbMenu>
          </div>
        </template>

        <template #empty>
          <TbEmpty v-if="failed" face="confused" :title="$t('devices.loadFailed')" :text="$t('common.loadFailed')">
            <TbButton icon="refresh" @click="load">{{ $t('common.retry') }}</TbButton>
          </TbEmpty>
          <TbEmpty v-else-if="!rows.length" face="sleepy" :title="$t('devices.emptyTitle')" :text="$t('devices.emptyText')">
            <TbButton variant="primary" icon="plus" @click="openAdd('code')">{{ $t('devices.addRobot') }}</TbButton>
            <TbButton variant="quiet" @click="openAdd('mac')">{{ $t('devices.emptyManual') }}</TbButton>
          </TbEmpty>
          <TbEmpty v-else :title="$t('devices.noMatchTitle')" :text="$t('devices.noMatchText', { query: query.trim() })">
            <TbButton @click="query = ''">{{ $t('devices.clearSearch') }}</TbButton>
          </TbEmpty>
        </template>
      </TbTable>

      <TbPagination v-if="filtered.length > PAGE_SIZES[0]" v-model:page="page" v-model:page-size="pageSize" :total="filtered.length"
        :sizes="PAGE_SIZES" :total-text="$t('devices.total', { count: num(filtered.length) })" :size-suffix="$t('devices.perPageSuffix')"
        :aria-label="$t('devices.pages')" :prev-label="$t('devices.prevPage')" :next-label="$t('devices.nextPage')"
        :size-label="$t('devices.perPage')" />
    </template>

    <VolumeSheet v-model:open="volumeOpen" :row="volumeRow" @saved="onVolumeSaved" />
    <AddRobotSheet v-if="agentId" v-model:open="addOpen" :agent-id="agentId" :start-mode="addMode" :firmware-types="firmwareTypes"
      @added="load" />
  </div>
</template>

<script setup>
import { peopleText } from '@/utils/errorText.mjs';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { confirm } from '@/kit/confirm';
import { digits } from '@/kit/calendar';
import { loadProducts, loadRobots, products, robot, selectRobot } from '@/shell/robot';
import { distinctProducts, productName, productOf } from '@/shell/products';
import { checkCompanions, noteMqttMap, statusOf } from '@/shell/robotStatus';
import { ageOf } from '@/utils/companion.mjs';
import {
  PAGE_SIZES, aliasChange, canGenerateLook, filterRows, pageOf, parseStatusMap, toRows,
} from './devicesModel';
import MacMask from './MacMask.vue';
import VolumeSheet from './VolumeSheet.vue';
import AddRobotSheet from './AddRobotSheet.vue';

const { t, locale } = useI18n({ useScope: 'global' });
const route = useRoute();
const router = useRouter();
const num = (n) => digits(n, locale.value);
const dateLocale = computed(() => (locale.value === 'bn' ? 'bn-BD' : 'en-GB'));

const agentId = computed(() => String(route.query.agentId || ''));
const agentName = ref('');
const rows = ref([]);
const loading = ref(false);
const failed = ref(false);
const refreshing = ref(false);
const statusKnown = ref(false); // the MQTT gateway answered with a status map
const firmwareTypes = ref([]);
const query = ref('');
const page = ref(1);
const pageSize = ref(PAGE_SIZES[0]);
const selected = ref([]);
const editing = ref('');
const draft = ref('');
const savingOta = ref('');
const volumeOpen = ref(false);
const volumeRow = ref(null);
const addOpen = ref(false);
const addMode = ref('code');
const clock = ref(Date.now());
let aliasInput = null;

const columns = computed(() => [
  { key: 'robot', label: t('devices.col.robot') },
  // the state column also says when the robot was last connected (one column less, so the table
  // fits a 1280px screen without scrolling sideways)
  { key: 'state', label: t('devices.col.state'), width: '150px' },
  { key: 'mac', label: t('devices.col.mac'), width: '148px' },
  { key: 'firmware', label: t('devices.col.firmware'), width: '156px' },
  { key: 'actions', label: t('devices.col.actions'), width: '1%' },
]);
// Each robot's product (TinyBot, a generic Nobix device, ...). With more than one product the
// list is grouped by product (sorted by product, with a product filter); with one, the tag on
// each row says enough.
const productFilter = ref('all');
const productList = computed(() => distinctProducts(rows.value));
const productOptions = computed(() => [{ value: 'all', label: t('devices.allProducts') },
  ...productList.value.map((p) => ({ value: p.productKey, label: productName(p, locale.value) }))]);
const filtered = computed(() => {
  let list = filterRows(rows.value, query.value);
  if (productList.value.length > 1) {
    if (productFilter.value !== 'all') list = list.filter((r) => r.productKey === productFilter.value);
    const order = productList.value.map((p) => p.productKey);
    list = list.map((r, i) => ({ r, i }))
      .sort((a, b) => (order.indexOf(a.r.productKey) - order.indexOf(b.r.productKey)) || a.i - b.i).map((x) => x.r);
  }
  return list;
});
const pageRows = computed(() => pageOf(filtered.value, page.value, pageSize.value));
const onlineCount = computed(() => rows.value.filter((r) => statusFor(r).state === 'online').length);
const title = computed(() => agentName.value || t('devices.titleFallback'));
const description = computed(() => {
  if (!agentId.value || !rows.value.length) return t('devices.desc');
  const count = num(rows.value.length);
  return statusKnown.value
    ? t('devices.descCount', { count, online: num(onlineCount.value) })
    : t('devices.descCountNoStatus', { count });
});

watch([query, productFilter], () => { page.value = 1; selected.value = []; });
watch([page, pageSize], () => { selected.value = []; });

const nameOf = (r) => r.alias || r.macAddress || t('devices.unnamed');
// Each row's connection status, from the shared status (src/shell/robotStatus.js), as on Robots.
const deviceOf = (r) => ({ id: r.device_id, macAddress: r.macAddress, board: r.model, features: r.features });
function statusFor(r) {
  return statusOf(r.device_id, { item: { features: r.features, lastConnectedAt: r.lastConnectedRaw }, now: clock.value });
}
const rowClass = (r) => (statusFor(r).state === 'offline' ? 'dv-row is-offline' : 'dv-row');
// The face: awake when online, asleep when offline, puzzled when the server side is not right.
function faceMood(r) {
  const { state } = statusFor(r);
  if (state === 'online') return 'awake';
  return state === 'offline' || state === 'checking' ? 'offline' : 'confused';
}
function boardName(key) {
  const hit = firmwareTypes.value.find((f) => f.key === key);
  return hit ? hit.name : key;
}
function fullDate(ms) {
  return new Intl.DateTimeFormat(dateLocale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
}
function addedText(r) {
  if (Number.isFinite(r.rawBindTime)) {
    const d = new Intl.DateTimeFormat(dateLocale.value, { day: 'numeric', month: 'short', year: 'numeric' }).format(r.rawBindTime);
    return t('devices.addedOn', { date: d });
  }
  return r.bindTime && r.bindTime !== '-' ? t('devices.addedOn', { date: r.bindTime }) : '';
}
/** The state cell's second line: when the robot was last connected (its last sync when not syncing). */
function seenLine(r) {
  const st = statusFor(r);
  if (st.state === 'not_syncing' && st.lastSync) return t('status.lastSync', { when: ago(st.lastSync) });
  const at = st.lastSeen || r.lastConnectedRaw;
  return at ? t('status.lastSeen', { when: ago(at) }) : t('devices.never');
}
function ago(ms) {
  if (ms === null || ms === undefined) return t('devices.never');
  const a = ageOf(ms / 1000, clock.value);
  if (a.unit === 'never') return t('devices.never');
  if (a.unit === 'justNow') return t('devices.justNow');
  return t(`devices.ago.${a.unit}`, { n: num(a.value) });
}

// ---------------------------------------------------------------- loading

// The gateway's online map, then the companion views of the companion robots it calls online
// (each at most every 30 s, a few at a time: checkCompanions).
function fetchStatus() {
  const id = agentId.value;
  if (!id) return;
  const done = (map) => {
    if (id !== agentId.value) return;
    clock.value = Date.now();
    statusKnown.value = !!map;
    const devs = rows.value.map(deviceOf);
    noteMqttMap(map, devs);
    checkCompanions(devs);
  };
  Api.device.getDeviceStatus(id, ({ data }) => done(parseStatusMap(data)), () => done(null));
}

async function load() {
  const id = agentId.value;
  if (!id) return;
  loading.value = true;
  failed.value = false;
  await loadProducts();
  Api.device.getAgentBindDevices(id, ({ data }) => {
    if (id !== agentId.value) return;
    loading.value = false;
    if (data.code === 0) {
      clock.value = Date.now();
      const raw = Array.isArray(data.data) ? data.data : [];
      rows.value = toRows(raw).map((r) => ({ ...r, ...productOf(raw.find((d) => d.id === r.device_id), products.list) }));
      productFilter.value = 'all';
      selected.value = [];
      query.value = '';
      fetchStatus();
    } else {
      failed.value = true;
      toast.error(data.msg || t('devices.loadFailed'));
    }
  }, () => { loading.value = false; failed.value = true; });
}

function fetchAgentName() {
  const id = agentId.value;
  if (!id) return;
  agentName.value = '';
  Api.agent.getDeviceConfig(id, ({ data }) => {
    if (id === agentId.value && data && data.code === 0 && data.data && data.data.agentName) agentName.value = data.data.agentName;
  }, () => {});
  // The account's robot list also knows the character's name (and keeps "this robot" in step).
  loadRobots().then((list) => {
    const hit = (list || []).find((r) => r.agentId === id);
    if (hit && !agentName.value && id === agentId.value) agentName.value = hit.agentName || '';
  });
}

async function fetchFirmwareTypes() {
  try {
    const res = await Api.dict.getDictDataByType('FIRMWARE_TYPE');
    firmwareTypes.value = Array.isArray(res && res.data) ? res.data : [];
  } catch (e) {
    toast.error(peopleText(e && e.message) || t('devices.firmwareTypesFailed'));
  }
}

function refreshNow() {
  refreshing.value = true;
  fetchStatus();
  setTimeout(() => { refreshing.value = false; }, 800);
}

// ---------------------------------------------------------------- name

function setAliasInput(el) { aliasInput = el; }
function startAlias(r) {
  editing.value = r.device_id;
  draft.value = r.alias;
  nextTick(() => aliasInput?.focus());
}
function cancelAlias() { editing.value = ''; }
function commitAlias(r) {
  if (editing.value !== r.device_id || r.submitting) return;
  editing.value = '';
  const change = aliasChange(r, draft.value);
  if (!change.ok) {
    if (change.reason === 'tooLong') toast.warning(t('devices.aliasTooLong'));
    return;
  }
  r.submitting = true;
  r.alias = change.text;
  Api.device.updateDeviceInfo(r.device_id, { alias: change.text }, ({ data }) => {
    r.submitting = false;
    if (data.code === 0) {
      r.originalAlias = change.text;
      if (robot.deviceId === r.device_id) selectRobot({ deviceId: r.device_id, agentId: agentId.value, name: change.text });
      toast.success(t('devices.aliasSaved'));
    } else {
      r.alias = r.originalAlias;
      toast.error(data.msg || t('devices.aliasFailed'));
    }
  }, () => { r.submitting = false; r.alias = r.originalAlias; toast.error(t('devices.aliasFailed')); });
}

// ---------------------------------------------------------------- firmware

function setAutoUpdate(r, on) {
  const previous = r.autoUpdate;
  r.autoUpdate = on;
  savingOta.value = r.device_id;
  Api.device.updateDeviceInfo(r.device_id, { autoUpdate: on ? 1 : 0 }, ({ data }) => {
    savingOta.value = '';
    if (data.code === 0) {
      toast.success(on ? t('devices.autoUpdateOn') : t('devices.autoUpdateOff'));
      return;
    }
    r.autoUpdate = previous;
    toast.error(data.msg || t('devices.actionFailed'));
  }, () => { savingOta.value = ''; r.autoUpdate = previous; toast.error(t('devices.actionFailed')); });
}

// ---------------------------------------------------------------- actions

function menuItems(r) {
  const items = [
    { key: 'today', label: t('devices.menu.today'), icon: 'today' },
    { key: 'rename', label: t('devices.menu.rename'), icon: 'edit' },
    { key: 'volume', label: t('devices.menu.volume'), icon: 'volume' },
    { key: 'reboot', label: t('devices.menu.reboot'), icon: 'refresh', disabled: r.rebooting },
  ];
  if (canGenerateLook(r.firmwareVersion)) items.push({ key: 'look', label: t('devices.menu.look'), icon: 'palette' });
  items.push({ divider: true, key: 'div' }, { key: 'unbind', label: t('devices.menu.unbind'), icon: 'trash', danger: true });
  return items;
}

function onMenu(key, r) {
  if (key === 'today') openToday(r);
  else if (key === 'rename') startAlias(r);
  else if (key === 'volume') { volumeRow.value = r; volumeOpen.value = true; }
  else if (key === 'reboot') reboot(r);
  else if (key === 'look') router.push({ name: 'ThemeGenerator', query: { deviceId: r.device_id, agentId: agentId.value } });
  else if (key === 'unbind') unbind(r);
}

function openToday(r) {
  selectRobot({ deviceId: r.device_id, agentId: agentId.value, name: r.alias || '' });
  router.push('/today');
}

function onVolumeSaved({ row, volume }) { row.volume = volume; }

function openAdd(mode) { addMode.value = mode; addOpen.value = true; }

function reboot(r) {
  confirm(t('devices.confirmReboot', { name: nameOf(r) }), t('devices.confirmTitle'), {
    confirmText: t('devices.reboot'), cancelText: t('common.cancel'),
  }).then(() => {
    r.rebooting = true;
    Api.device.rebootDevice(r.device_id, ({ data }) => {
      r.rebooting = false;
      if (data.code === 0) toast.success(t('devices.rebootSent'));
      else toast.error(data.msg || t('devices.rebootFailed'));
    });
  }).catch(() => {});
}

function unbind(r) {
  const name = r.alias || r.macAddress;
  const text = name ? t('devices.confirmUnbind', { name }) : t('devices.confirmUnbindPlain');
  confirm(text, t('devices.confirmTitle'), { confirmText: t('devices.unbind'), cancelText: t('common.cancel'), danger: true })
    .then(() => {
      Api.device.unbindDevice(r.device_id, ({ data }) => {
        if (data.code === 0) {
          toast.success(t('devices.unbound'));
          load();
        } else {
          toast.error(data.msg || t('devices.unbindFailed'));
        }
      }, (e) => toast.error((e && e.data && e.data.msg) || t('devices.unbindFailed')));
    }).catch(() => {});
}

function unbindSelected() {
  const ids = pageRows.value.filter((r) => selected.value.includes(r.device_id)).map((r) => r.device_id);
  if (!ids.length) { toast.warning(t('devices.selectOne')); return; }
  confirm(t('devices.confirmBatch', { count: num(ids.length) }), t('devices.confirmTitle'), {
    confirmText: t('devices.unbind'), cancelText: t('common.cancel'), danger: true,
  }).then(() => {
    Promise.all(ids.map((id) => new Promise((resolve, reject) => {
      Api.device.unbindDevice(id, ({ data }) => (data.code === 0 ? resolve() : reject(data.msg || t('devices.unbindFailed'))),
        (e) => reject((e && e.data && e.data.msg) || t('devices.unbindFailed')));
    }))).then(() => {
      toast.success(t('devices.batchUnbound', { count: num(ids.length) }));
      load();
    }).catch((msg) => {
      toast.error(msg || t('devices.batchFailed'));
      load();
    });
  }).catch(() => {});
}

// ---------------------------------------------------------------- life

let poll = null;
function start() {
  if (!agentId.value) return;
  fetchAgentName();
  load();
  clearInterval(poll);
  poll = setInterval(() => { if (!document.hidden) fetchStatus(); }, 10000);
}
onMounted(() => { fetchFirmwareTypes(); start(); });
onBeforeUnmount(() => clearInterval(poll));
watch(agentId, () => { rows.value = []; start(); });
</script>

<style>
.dv { padding-bottom: var(--tb-s8); }
.dv__none { padding: var(--tb-s10) 0; }
.dv__bar { display: flex; align-items: center; gap: var(--tb-s3) var(--tb-s4); flex-wrap: wrap; padding: var(--tb-s4) 0; }
.dv__search { flex: 0 1 340px; min-width: 0; }
.dv__bulk { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto; }
.dv__bulkcount { font-weight: 600; font-size: var(--tb-fs-14); color: var(--tb-action); }
.dv-fade-enter-active, .dv-fade-leave-active { transition: opacity var(--tb-t-fast) var(--tb-ease), transform var(--tb-t-fast) var(--tb-ease); }
.dv-fade-enter-from, .dv-fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* the robot cell: its face window, its name (tap to rename), board and day it joined */
.dv-bot { display: flex; align-items: center; gap: var(--tb-s3); min-width: 0; }
.dv-bot__face { flex: none; }
.dv-bot__device { display: grid; place-items: center; width: 64px; aspect-ratio: 4 / 3; border: 1px solid var(--tb-rule); border-radius: 8px; color: var(--tb-ink-2); }
.dv-bot__product { margin-right: 8px; height: 20px; padding: 0 7px; }
.dv-bot__text { display: grid; gap: 2px; min-width: 0; }
.dv-bot__name {
  display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 32px; padding: 0;
  border: 0; background: none; text-align: left; cursor: text;
  font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-16); color: var(--tb-ink);
}
.dv-bot__name span { overflow-wrap: anywhere; } /* a long name wraps instead of widening the table */
.dv-bot__name .tb-icon { color: var(--tb-ink-3); opacity: 0; transition: opacity var(--tb-t-hover) var(--tb-ease); }
.dv-bot__name:hover .tb-icon, .dv-bot__name:focus-visible .tb-icon { opacity: 1; }
.dv-bot__name.is-empty { color: var(--tb-ink-2); font-weight: 600; }
/* the meta line wraps, so the robot column never pushes the firmware switch and actions out of a 1280px screen */
.dv-bot__meta { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.dv__table td:has(.dv-state) { min-width: 150px; }
.dv-bot .tb-input { width: min(260px, 100%); }

/* the state word: the shared compact status (TbRobotStatus); long words wrap inside the column */
.dv-state { display: grid; gap: 2px; justify-items: start; }
.dv-state .tb-rstat.is-compact { white-space: normal; align-items: baseline; line-height: 1.35; }
.dv-state .tb-rstat.is-compact .tb-rstat__dot { align-self: center; }

.dv-row.is-offline .dv-bot__name { color: var(--tb-ink-2); }

.dv-fw { display: grid; gap: 0; justify-items: start; }
.dv-fw__ver { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-15); }
.dv-fw .tb-switch { min-height: 36px; }
.dv-fw .tb-switch__label { font-size: var(--tb-fs-13); color: var(--tb-ink-2); white-space: nowrap; }
.dv-seen { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.dv-more {
  display: grid; place-items: center; width: 40px; height: 40px; flex: none;
  border: 0; border-radius: var(--tb-radius-pill); background: transparent; color: var(--tb-ink);
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
@media (hover: hover) and (pointer: fine) { .dv-more:hover { background: var(--tb-paper-2); } }
.dv-act { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }

@media (max-width: 640px) {
  .dv__search { flex: 1 1 100%; }
  .dv__bulk { margin-left: 0; }
  .dv__table td[data-label] { align-items: center; }
  .dv__table td:first-of-type + td { grid-template-columns: 1fr; }
  .dv__table td:first-of-type + td::before { content: none; }
  .dv-act { justify-content: flex-start; }
  .dv-act .tb-btn { --h: 44px; }
  .dv-more { width: 44px; height: 44px; }
  .dv-bot__meta { white-space: normal; }
  .dv-fw { grid-auto-flow: column; align-items: center; gap: var(--tb-s3); justify-content: start; }
  .dv-fw .tb-switch { min-height: 44px; }
}
</style>
