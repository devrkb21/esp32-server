<!-- The robots of one character: bind by code or MAC, name, volume, OTA, restart, unbind (owner: m-robots).
     Also embedded by pages/agent/index.vue as <DeviceManagement :agent-id>; `refresh()` is exposed for it. -->
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
import type { Device, FirmwareType } from '@/api/device'
import { onLoad } from '@dcloudio/uni-app'
import { computed, onMounted, ref } from 'vue'
import { getAgentList } from '@/api/agent/agent'
import { getCompanion } from '@/api/companion'
import * as deviceApi from '@/api/device'
import {
  getBindDevices,
  getDeviceOnlineStatus,
  getFirmwareTypes,
  rebootDevice,
  setDeviceVolume,
  unbindDevice,
  updateDeviceAutoUpdate,
} from '@/api/device'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { tbConfirm } from '@/utils/tbConfirm'
import { robot, selectRobot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'
import AddRobotSheet from '../robots/components/AddRobotSheet.vue'
import { ALIAS_MAX, aliasChange, companionVolume, isOnline, parseStatus, versionText } from '../robots/robotsModel.mjs'
import { whenText } from '../robots/robotsText'
import { parseDeviceLastConnectedAtTimestamp } from './deviceTimeUtils.mjs'

defineOptions({ name: 'DeviceManage' })

const props = withDefaults(defineProps<{ agentId?: string, embedded?: boolean }>(), { agentId: 'default', embedded: false })

const lang = computed(() => getCurrentLanguage())
const num = (n: any) => digits(n, lang.value)

// The page takes ?agentId=; embedded, the agent page passes it as a prop.
const queryAgentId = ref('')
const pageMode = ref(!props.embedded)
const currentAgentId = computed(() => queryAgentId.value || props.agentId)
onLoad((q: any) => {
  if (q?.agentId)
    queryAgentId.value = decodeURIComponent(String(q.agentId))
})

/* ---------- data ---------- */
const deviceList = ref<Device[]>([])
const firmwareTypes = ref<FirmwareType[]>([])
const agentName = ref('')
const loading = ref(false)
const loaded = ref(false)
const loadFailed = ref(false)
const statusKnown = ref(false)
const deviceStatusMap = ref<Record<string, boolean>>({})
const deviceVolumes = ref<Record<string, number>>({})
/** Volume each robot last reported (companion stats); null = unknown */
const robotVolumeNow = ref<Record<string, number | null>>({})
const isRebooting = ref<Record<string, boolean>>({})
const isUpdatingVolume = ref<Record<string, boolean>>({})
const savingOta = ref('')
const volumeTimers: Record<string, any> = {}
const clock = ref(Date.now())

const onlineCount = computed(() => deviceList.value.filter(d => deviceStatusMap.value[d.id]).length)
const title = computed(() => agentName.value || t('robots.dev.title'))
const description = computed(() => {
  if (!deviceList.value.length)
    return t('robots.dev.desc')
  const count = num(deviceList.value.length)
  return statusKnown.value
    ? t('robots.dev.descCount', { count, online: num(onlineCount.value) })
    : t('robots.dev.descCountNoStatus', { count })
})

function typeName(board: string) {
  return firmwareTypes.value.find(f => f.key === board)?.name || board || ''
}
function deviceName(d: Device) {
  return d.alias || typeName(d.board) || d.macAddress || t('robots.unnamed')
}
function stateOf(d: Device) {
  if (deviceStatusMap.value[d.id])
    return 'online'
  return 'offline'
}
function stateText(d: Device) {
  if (deviceStatusMap.value[d.id])
    return t('common.online')
  return statusKnown.value ? t('common.offline') : t('robots.stateUnknown')
}
function seenAt(d: Device) {
  const at = parseDeviceLastConnectedAtTimestamp(d.lastConnectedAtTimestamp) || (d as any).lastConnectedAt
  return at instanceof Date ? at.getTime() : at
}
function seenText(d: Device) {
  const at = seenAt(d)
  return at ? t('robots.seen', { when: whenText(at, lang.value, clock.value) }) : t('robots.never')
}
/** The facts table already says "last connected": just the time. */
function lastSeenFact(d: Device) {
  const at = seenAt(d)
  return at ? whenText(at, lang.value, clock.value) : t('robots.never')
}
function kindLine(d: Device) {
  return [typeName(d.board), d.appVersion ? t('robots.dev.firmware', { v: versionText(d.appVersion) }) : ''].filter(Boolean).join(' · ')
}
function volumeOf(d: Device) {
  return deviceVolumes.value[d.id] !== undefined ? deviceVolumes.value[d.id] : 70
}

/* ---------- loading (GET /device/bind/{agentId}, POST /device/bind/{agentId} for the online map) ---------- */
async function loadDeviceList() {
  if (!currentAgentId.value) {
    deviceList.value = []
    return
  }
  loading.value = true
  try {
    const list = ((await getBindDevices(currentAgentId.value)) || []) as Device[]
    deviceList.value = list
    loadFailed.value = false
    clock.value = Date.now()
    list.forEach((d) => {
      if (deviceVolumes.value[d.id] === undefined)
        deviceVolumes.value[d.id] = 70
    })
    fetchOnlineStatus()
  }
  catch {
    deviceList.value = []
    loadFailed.value = true
  }
  loading.value = false
  loaded.value = true
}

async function fetchOnlineStatus() {
  if (!currentAgentId.value)
    return
  try {
    const map = parseStatus(await getDeviceOnlineStatus(currentAgentId.value))
    statusKnown.value = Boolean(map)
    const next: Record<string, boolean> = {}
    deviceList.value.forEach((d) => {
      next[d.id] = isOnline(map, d)
    })
    deviceStatusMap.value = next
  }
  catch {
    statusKnown.value = false
  }
}

async function loadFirmwareTypes() {
  try {
    firmwareTypes.value = (await getFirmwareTypes()) || []
  }
  catch {
    // the board key is shown instead of its name
  }
}

async function loadAgentName() {
  if (!pageMode.value || !currentAgentId.value)
    return
  try {
    const list = (await getAgentList()) || []
    agentName.value = list.find(a => a.id === currentAgentId.value)?.agentName || ''
  }
  catch {
    agentName.value = ''
  }
}

async function refresh() {
  await loadDeviceList()
}

/* ---------- one robot (detail sheet) ---------- */
const activeId = ref('')
const active = computed(() => deviceList.value.find(d => d.id === activeId.value) || null)
const detailOpen = computed({
  get: () => Boolean(active.value),
  set: (v: boolean) => {
    if (!v)
      activeId.value = ''
  },
})
const aliasDraft = ref('')
const aliasSaving = ref(false)
// Renaming needs PUT /device/update/{id} { alias }, asked of the API module (updateDeviceAlias);
// the field shows as soon as that call exists.
const updateDeviceAlias = (deviceApi as Record<string, any>)[['updateDevice', 'Alias'].join('')] as undefined | ((id: string, alias: string) => Promise<unknown>)

function openDetail(d: Device) {
  activeId.value = d.id
  aliasDraft.value = d.alias || ''
  loadRobotVolume(d)
}

// The robot's real volume: what it last reported, else the volume the app asked for
async function loadRobotVolume(d: Device) {
  try {
    const view = await getCompanion(d.id, true)
    const volume = companionVolume(view)
    if (volume !== null && !volumeTimers[d.id] && !isUpdatingVolume.value[d.id])
      deviceVolumes.value[d.id] = volume
    robotVolumeNow.value[d.id] = companionVolume({ stats: (view as any)?.stats })
  }
  catch {
    // not a TinyBot or the companion server is not reachable: keep the current value
  }
}

// Volume with a short debounce (POST /device/command/{id}/volume)
function onVolumeChange(d: Device, volume: number) {
  deviceVolumes.value[d.id] = volume
  clearTimeout(volumeTimers[d.id])
  volumeTimers[d.id] = setTimeout(async () => {
    volumeTimers[d.id] = null
    isUpdatingVolume.value[d.id] = true
    try {
      const result = await setDeviceVolume(d.id, volume)
      // an offline robot gets the volume later: the server then answers with just the number
      toast.success(typeof result === 'number'
        ? t('robots.dev.volumeSavedOffline', { n: num(volume) })
        : t('robots.dev.volumeSet', { n: num(volume) }))
      setTimeout(() => loadRobotVolume(d), 1500)
    }
    catch (e: any) {
      toast.error(e?.message || t('robots.dev.volumeFailed'))
    }
    isUpdatingVolume.value[d.id] = false
  }, 400)
}

// OTA auto-update (PUT /device/update/{id} { autoUpdate })
async function toggleAutoUpdate(d: Device) {
  if (savingOta.value)
    return
  const next = d.autoUpdate === 1 ? 0 : 1
  savingOta.value = d.id
  try {
    await updateDeviceAutoUpdate(d.id, next)
    d.autoUpdate = next
    toast.success(next === 1 ? t('robots.dev.autoUpdateOn') : t('robots.dev.autoUpdateOff'))
  }
  catch {
    toast.error(t('robots.dev.actionFailed'))
  }
  savingOta.value = ''
}

async function saveAlias(d: Device) {
  if (!updateDeviceAlias || aliasSaving.value)
    return
  const change = aliasChange(d.alias, aliasDraft.value)
  if (!change.ok) {
    if (change.reason === 'tooLong')
      toast.warning(t('robots.dev.nameTooLong'))
    return
  }
  aliasSaving.value = true
  try {
    await updateDeviceAlias(d.id, change.text)
    d.alias = change.text
    if (robot.deviceId === d.id)
      selectRobot({ deviceId: d.id, agentId: d.agentId || currentAgentId.value, name: change.text })
    toast.success(t('robots.dev.nameSaved'))
  }
  catch (e: any) {
    toast.error(e?.message || t('robots.dev.nameFailed'))
  }
  aliasSaving.value = false
}

function openToday(d: Device) {
  selectRobot({ deviceId: d.id, agentId: d.agentId || currentAgentId.value, name: d.alias || '' })
  activeId.value = ''
  uni.switchTab({ url: '/pages/index/index' })
}

async function confirmReboot(d: Device) {
  const ok = await tbConfirm({ title: t('robots.dev.rebootTitle'), message: t('robots.dev.rebootText', { name: deviceName(d) }), confirmText: t('robots.dev.reboot') })
  if (!ok)
    return
  isRebooting.value[d.id] = true
  try {
    await rebootDevice(d.id)
    toast.success(t('robots.dev.rebootSent'))
  }
  catch (e: any) {
    toast.error(e?.message || t('robots.dev.rebootFailed'))
  }
  isRebooting.value[d.id] = false
}

async function confirmUnbind(d: Device) {
  const ok = await tbConfirm({ title: t('robots.dev.unbindTitle'), message: t('robots.dev.unbindText', { name: `${deviceName(d)} (${d.macAddress})` }), confirmText: t('robots.dev.unbind'), danger: true })
  if (!ok)
    return
  try {
    await unbindDevice(d.id)
    activeId.value = ''
    await loadDeviceList()
    toast.success(t('robots.dev.unbound'))
  }
  catch {
    toast.error(t('robots.dev.unbindFailed'))
  }
}

/* ---------- add ---------- */
const addOpen = ref(false)
const addMode = ref<'code' | 'mac'>('code')
const addAgents = computed(() => (currentAgentId.value ? [{ id: currentAgentId.value, agentName: agentName.value || '' }] : []))
function openAdd(mode: 'code' | 'mac' = 'code') {
  addMode.value = mode
  addOpen.value = true
}
function goSetup() {
  uni.navigateTo({ url: '/pages/device-config/index' })
}

onMounted(() => {
  if (!props.embedded) {
    const pages = getCurrentPages()
    const top: any = pages[pages.length - 1]
    if (top?.route && top.route !== 'pages/device/index')
      pageMode.value = false
  }
  loadFirmwareTypes()
  loadDeviceList()
  loadAgentName()
})

defineExpose({ refresh })
</script>

<template>
  <view class="dv" :class="{ 'tb-wrap': pageMode, 'is-embedded': !pageMode }">
    <tb-page-header v-if="pageMode" :title="title" :description="description" back />

    <view v-if="loading && !deviceList.length" class="dv__state">
      <tb-loading :label="t('common.loading')" />
    </view>

    <view v-else-if="loadFailed" class="dv__state">
      <tb-empty face="confused" :title="t('robots.dev.loadFailed')" :text="t('common.loadFailed')">
        <tb-button icon="refresh" @click="refresh">
          {{ t('common.retry') }}
        </tb-button>
      </tb-empty>
    </view>

    <view v-else-if="loaded && !deviceList.length" class="dv__state">
      <tb-empty face="sleepy" :title="t('robots.dev.emptyTitle')" :text="t('robots.dev.emptyText')">
        <tb-button variant="primary" icon="plus" @click="openAdd('code')">
          {{ t('robots.add.submit') }}
        </tb-button>
        <tb-button variant="quiet" @click="openAdd('mac')">
          {{ t('robots.dev.emptyManual') }}
        </tb-button>
      </tb-empty>
    </view>

    <block v-else-if="deviceList.length">
      <view class="dv__list" role="list">
        <view v-for="d in deviceList" :key="d.id" class="dv-row" :class="{ 'is-current': d.id === robot.deviceId }" role="listitem">
          <view class="dv-row__main" role="button" hover-class="is-press" :aria-label="t('robots.dev.openFor', { name: deviceName(d) })" @click="openDetail(d)">
            <tb-face class="dv-row__face" :mood="stateOf(d) === 'online' ? 'awake' : 'offline'" :width="64" :alt="t('robots.faceAlt', { name: deviceName(d) })" />
            <tb-name-plate class="dv-row__plate" :name="deviceName(d)" :doing="kindLine(d)" :detail="seenText(d)" :state="stateOf(d)" :state-text="stateText(d)" />
            <tb-icon class="dv-row__chev" name="chevron-right" :size="18" />
          </view>
        </view>
      </view>
      <text class="dv__hint">
        {{ t('robots.dev.hint') }}
      </text>

      <view class="dv__add">
        <tb-button variant="primary" size="l" icon="plus" block @click="openAdd('code')">
          {{ t('robots.add.submit') }}
        </tb-button>
        <tb-button icon="wifi" block @click="goSetup">
          {{ t('robots.setup') }}
        </tb-button>
      </view>
    </block>

    <!-- One robot -->
    <tb-sheet v-model:open="detailOpen" :title="active ? deviceName(active) : ''">
      <block v-if="active">
        <view class="dv-sheet__head">
          <tb-face :mood="stateOf(active) === 'online' ? 'awake' : 'offline'" :width="96" :alt="t('robots.faceAlt', { name: deviceName(active) })" />
          <tb-name-plate :name="deviceName(active)" :detail="seenText(active)" :state="stateOf(active)" :state-text="stateText(active)" />
        </view>

        <view v-if="updateDeviceAlias" class="dv-field">
          <text class="dv-field__label">
            {{ t('robots.dev.name') }}
          </text>
          <view class="dv-field__row">
            <tb-input
              v-model="aliasDraft" class="dv-field__in" :maxlength="ALIAS_MAX" :placeholder="t('robots.dev.namePlaceholder')"
              :aria-label="t('robots.dev.name')" @confirm="saveAlias(active)"
            />
            <tb-button :loading="aliasSaving" :disabled="aliasDraft.trim() === (active.alias || '')" @click="saveAlias(active)">
              {{ t('robots.dev.nameSave') }}
            </tb-button>
          </view>
        </view>

        <view class="dv-facts" role="list" :aria-label="t('robots.dev.factsLabel')">
          <view class="dv-facts__row" role="listitem">
            <text class="dv-facts__k">
              {{ t('robots.dev.type') }}
            </text><text class="dv-facts__v">
              {{ typeName(active.board) || '–' }}
            </text>
          </view>
          <view class="dv-facts__row" role="listitem">
            <text class="dv-facts__k">
              {{ t('robots.dev.mac') }}
            </text><text class="dv-facts__v tb-num">
              {{ active.macAddress || '–' }}
            </text>
          </view>
          <view class="dv-facts__row" role="listitem">
            <text class="dv-facts__k">
              {{ t('robots.dev.version') }}
            </text><text class="dv-facts__v tb-num">
              {{ versionText(active.appVersion) || '–' }}
            </text>
          </view>
          <view class="dv-facts__row" role="listitem">
            <text class="dv-facts__k">
              {{ t('robots.dev.lastSeen') }}
            </text><text class="dv-facts__v">
              {{ lastSeenFact(active) }}
            </text>
          </view>
        </view>

        <view class="dv-ota">
          <tb-switch
            :model-value="active.autoUpdate === 1" :disabled="savingOta === active.id" :label="t('robots.dev.autoUpdate')"
            @change="toggleAutoUpdate(active)"
          />
          <text class="dv-ota__hint">
            {{ t('robots.dev.autoUpdateHint') }}
          </text>
        </view>

        <view class="dv-vol">
          <view class="dv-vol__head">
            <text class="dv-vol__title">
              {{ t('robots.dev.volume') }}
            </text>
            <tb-loading v-if="isUpdatingVolume[active.id]" />
            <text class="tb-num dv-vol__val">
              {{ num(volumeOf(active)) }}%
            </text>
          </view>
          <slider
            class="dv-vol__slider" :value="volumeOf(active)" :min="0" :max="100" :step="5" active-color="var(--tb-action)"
            background-color="var(--tb-rule-soft)" block-color="var(--tb-ink)" :block-size="22" :aria-label="t('robots.dev.volume')"
            @change="(e: any) => onVolumeChange(active!, Number(e.detail.value))"
          />
          <text class="dv-vol__note">
            {{ robotVolumeNow[active.id] === null || robotVolumeNow[active.id] === undefined
              ? t('robots.dev.volumeNowUnknown')
              : t('robots.dev.volumeNow', { n: num(robotVolumeNow[active.id]) }) }}
          </text>
          <text class="dv-vol__note">
            {{ t('robots.dev.volumeHint') }}
          </text>
        </view>

        <view class="dv-acts">
          <tb-button icon="today" block @click="openToday(active)">
            {{ t('robots.dev.openToday') }}
          </tb-button>
          <tb-button icon="refresh" block :loading="isRebooting[active.id]" @click="confirmReboot(active)">
            {{ t('robots.dev.reboot') }}
          </tb-button>
          <tb-button variant="danger" icon="trash" block @click="confirmUnbind(active)">
            {{ t('robots.dev.unbind') }}
          </tb-button>
        </view>
      </block>
    </tb-sheet>

    <AddRobotSheet v-model:open="addOpen" :agents="addAgents" :agent-id="currentAgentId" :mode="addMode" @added="refresh" />
  </view>
</template>

<style lang="scss">
.dv {
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
}
.dv.is-embedded {
  padding-bottom: 16px;
}
.dv__state {
  padding: 48px 0;
  display: flex;
  justify-content: center;
}
.dv__list {
  display: flex;
  flex-direction: column;
}
.dv-row {
  border-bottom: 1px solid var(--tb-rule-soft);
}
.dv-row:last-child {
  border-bottom-color: var(--tb-rule);
}
.dv-row__main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 0;
  min-width: 0;
}
.dv-row__main.is-press {
  background: var(--tb-paper-2);
}
/* tb-face pads by 6% of its container; a fixed pad keeps the small window drawn */
.dv-row__face {
  flex: none;
  padding: 4px;
}
.dv-row__plate {
  flex: 1;
  overflow-wrap: anywhere;
}
.dv-row__chev {
  align-self: center;
  color: var(--tb-ink-3);
}
.dv-row.is-current .tb-plate__name::before {
  content: '';
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 8px;
  background: var(--tb-orange);
  vertical-align: 2px;
}
.dv__hint {
  display: block;
  padding: 10px 0 0;
  font-size: 13px;
  color: var(--tb-ink-2);
}
.dv__add {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 28px;
  padding-top: 18px;
  border-top: 3px solid var(--tb-rule);
}

.dv-sheet__head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.dv-sheet__head .tb-face {
  flex: none;
  padding: 6px;
}
.dv-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dv-field__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.dv-field__row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.dv-field__in {
  flex: 1;
  min-width: 0;
}
.dv-facts {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule);
}
.dv-facts__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.dv-facts__k {
  font-size: 14px;
  color: var(--tb-ink-2);
  flex: none;
}
.dv-facts__v {
  font-size: 15px;
  font-weight: 600;
  text-align: right;
  min-width: 0;
  overflow-wrap: anywhere;
}
.dv-ota {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dv-ota__hint {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.dv-vol {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--tb-rule-soft);
}
.dv-vol__head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dv-vol__title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
}
.dv-vol__val {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 20px;
}
.dv-vol__slider {
  margin: 6px 4px;
}
.dv-vol__note {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.dv-acts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--tb-rule-soft);
}
</style>
