<!-- Robot: this robot itself. How it is now, sound and screen, talking first, what it remembers, tap shortcuts, jobs, firmware (owner: m-robot) -->
<route lang="jsonc">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Nobix"
  }
}
</route>

<script lang="ts" setup>
import type { FirmwareUpdateState, RobotContext, SyncState } from './components/context'
import type { CommandType, CompanionConfigPatch, CompanionDevice } from '@/api/companion'
import type { Device, OtaFirmware } from '@/api/device'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, nextTick, onUnmounted, provide, reactive, ref, watch } from 'vue'
import { getCompanion, sendCompanionCommand, updateCompanionConfig } from '@/api/companion'
import { getBindDevices, getOtaFirmwares, updateDeviceAutoUpdate } from '@/api/device'
import { useFeatureGate } from '@/hooks/useFeatureGate'
import { getCurrentLanguage, t } from '@/i18n'
import { useUserStore } from '@/store'
import { digits, timeText, timeWithPart } from '@/utils/calendar.mjs'
import { agoParts } from '@/utils/companionUtils.mjs'
import { createUpdateFlow, initialUpdateState, latestFirmware } from '@/utils/firmwareUpdate.mjs'
import { robot } from '@/utils/tbRobot'
import { refreshCompanion, refreshMqtt, statusOf } from '@/utils/tbRobotStatus'
import { toast } from '@/utils/toast'
import { notifyError, robotKey } from './components/context'
import RobotFirmware from './components/RobotFirmware.vue'
import RobotGestures from './components/RobotGestures.vue'
import RobotJobs from './components/RobotJobs.vue'
import RobotMemory from './components/RobotMemory.vue'
import RobotSound from './components/RobotSound.vue'
import RobotStatus from './components/RobotStatus.vue'
import RobotTalk from './components/RobotTalk.vue'
import { POLL_MS, syncState } from './robotModel.mjs'

defineOptions({ name: 'RobotPage' })

const userStore = useUserStore()
const lang = computed(() => getCurrentLanguage() as string)
const deviceId = computed(() => robot.deviceId)
const agentId = computed(() => robot.agentId)

const view = ref<CompanionDevice | null>(null)
const loading = ref(false)
const loadFailed = ref(false)
const now = ref(Date.now())
const busy = ref('')
const saving = reactive<Record<string, boolean>>({})
const failed = reactive<Record<string, boolean>>({})
// The connection, said the same way on every screen (src/utils/robotConnection.mjs)
const status = computed(() => statusOf(deviceId.value, now.value))
const online = computed(() => status.value.state === 'online')
const botName = computed(() => view.value?.name || robot.name || t('nav.robotFallback'))

const sections = ['status', 'sound', 'talk', 'memory', 'gestures', 'jobs', 'firmware']

function num(n: number | string | null | undefined) {
  return digits(n ?? '–', lang.value)
}
function ago(ts: number | null | undefined) {
  const p = agoParts(ts, now.value)
  return t(`companion.${p.key}`, { n: num(p.n) })
}
function time(hhmm: string) {
  // Bangla times are 12-hour, so they carry the day part: সকাল ৭:৩০, সন্ধ্যা ৭:৩০
  return lang.value === 'bn' ? timeWithPart(hhmm, 'bn') : timeText(hhmm, lang.value)
}
function tOr(key: string, fallback: string) {
  const v = t(key)
  return v && v !== key ? v : fallback
}

// ------------------------------------------------------------------ firmware ("Update now")
const fwState = ref<FirmwareUpdateState>(initialUpdateState() as FirmwareUpdateState)
const fwDevice = ref<Device | null>(null)
const fwLatest = ref<OtaFirmware | null>(null)
const savingAuto = ref(false)
const fwFlow = createUpdateFlow({
  sendCommand: (cmd: { type: CommandType }) => sendCompanionCommand(deviceId.value, { type: cmd.type }),
  fetchView: () => getCompanion(deviceId.value, true),
  appVersion: () => fwDevice.value?.appVersion || '',
  onChange: (state: FirmwareUpdateState) => {
    fwState.value = state
  },
})

async function loadDevice() {
  if (!agentId.value || !deviceId.value)
    return
  try {
    const list = await getBindDevices(agentId.value)
    fwDevice.value = (list || []).find(d => d.id === deviceId.value) || null
  }
  catch {
    // the firmware section then links to the robots list instead of showing the switch
  }
}

// The OTA list is for super admins only: everyone else does not see the newest version
async function loadLatest() {
  if ((userStore.userInfo as any)?.superAdmin !== 1)
    return
  try {
    const page = await getOtaFirmwares()
    fwLatest.value = latestFirmware(page?.list || []) as OtaFirmware | null
  }
  catch {
    fwLatest.value = null
  }
}

async function setAutoUpdate(on: boolean) {
  if (!fwDevice.value)
    return
  const previous = fwDevice.value.autoUpdate
  fwDevice.value.autoUpdate = on ? 1 : 0
  savingAuto.value = true
  saving.auto = true
  failed.auto = false
  try {
    await updateDeviceAutoUpdate(deviceId.value, on ? 1 : 0)
    toast.success(on ? t('mrobot.fw.autoOn') : t('mrobot.fw.autoOff'))
  }
  catch (error) {
    if (fwDevice.value)
      fwDevice.value.autoUpdate = previous
    failed.auto = true
    notifyError(error)
  }
  savingAuto.value = false
  saving.auto = false
}

watch(() => fwState.value.phase, (phase) => {
  // read the version from the device list again once TinyBot is back
  if (phase === 'updated' || phase === 'current')
    loadDevice()
})

// ------------------------------------------------------------------ data
// A poll that started before a save must not overwrite the save's newer response
let mutationSeq = 0
let inflight = false

async function reload(silent = true) {
  if (!deviceId.value || inflight)
    return
  inflight = true
  const seq = mutationSeq
  if (!view.value)
    loading.value = true
  const id = deviceId.value
  // silent always: a failed view is said by the status panel, never as raw server text
  const [res] = await Promise.all([refreshCompanion(id), agentId.value ? refreshMqtt(agentId.value) : Promise.resolve()])
  if (id === deviceId.value) {
    if (res.view) {
      if (seq === mutationSeq) {
        view.value = res.view
        fwFlow.observe(res.view)
      }
      loadFailed.value = false
    }
    else {
      // the companion server has no record of the robot: what it showed before is gone
      if (res.kind === 'not_registered')
        view.value = null
      if (!view.value)
        loadFailed.value = true
    }
    now.value = Date.now()
  }
  inflight = false
  loading.value = false
}

async function save(patch: CompanionConfigPatch, area: string, okMsg?: string): Promise<boolean> {
  mutationSeq++
  saving[area] = true
  failed[area] = false
  try {
    const data = await updateCompanionConfig(deviceId.value, patch)
    mutationSeq++
    if (data) {
      view.value = data
      now.value = Date.now()
    }
    saving[area] = false
    toast.success(okMsg || (online.value ? t('mrobot.saved') : t('mrobot.savedOffline')))
    return true
  }
  catch (error) {
    saving[area] = false
    failed[area] = true
    notifyError(error)
    // undo optimistic edits
    await reload()
    return false
  }
}

function syncOf(area: string) {
  const state = syncState(!!saving[area], !!failed[area], view.value ? online.value : undefined) as SyncState
  const offline = state === 'pending' && !saving[area]
  const text = offline ? t('mrobot.sync.offline') : t(`common.sync.${state}`)
  return { state, text }
}

async function command(type: CommandType, arg: string, okMsg?: string, busyKey?: string): Promise<boolean> {
  if (busy.value || !deviceId.value)
    return false
  busy.value = busyKey || `${type}:${arg}`
  try {
    const cmd = await sendCompanionCommand(deviceId.value, { type, arg })
    toast.success(online.value ? (okMsg || t('mrobot.jobs.sent')) : t('mrobot.jobs.sentOffline'))
    if (view.value && cmd && (cmd as any).id)
      view.value = { ...view.value, commands: [cmd, ...(view.value.commands || []).filter(c => c.id !== cmd.id)] }
    busy.value = ''
    reload()
    return true
  }
  catch (error) {
    busy.value = ''
    notifyError(error)
    return false
  }
}

const ctx: RobotContext = {
  deviceId,
  agentId,
  view,
  online,
  status,
  lang,
  now,
  botName,
  num,
  ago,
  time,
  tOr,
  save,
  syncOf,
  saving,
  command,
  busy,
  reload: () => reload(),
  firmware: {
    state: fwState,
    device: fwDevice,
    latest: fwLatest,
    savingAuto,
    start: () => fwFlow.start(view.value),
    reset: () => fwFlow.reset(),
    setAutoUpdate,
  },
}
provide(robotKey, ctx)

// ------------------------------------------------------------------ section index
// The index strip stays pinned at the top and marks the section in view. pageScrollTo ignores
// offsetTop on H5, so a jump measures the section and stops just below the pinned strip.
const INDEX_H = 56
const instance = getCurrentInstance()
const active = ref('')
let observer: UniApp.IntersectionObserver | null = null

function jump(key: string) {
  const id = `rb-${key}`
  active.value = id
  uni.createSelectorQuery()
    .in(instance?.proxy as any)
    .select(`#${id}`)
    .boundingClientRect()
    .selectViewport()
    .scrollOffset(() => {})
    .exec((res: any[]) => {
      const rect = res?.[0]
      const top = res?.[1]?.scrollTop ?? 0
      if (rect)
        uni.pageScrollTo({ scrollTop: Math.max(0, top + rect.top - INDEX_H), duration: 200 })
      else
        uni.pageScrollTo({ selector: `#${id}`, duration: 200 })
    })
}

function unobserve() {
  observer?.disconnect()
  observer = null
}
function observeSections() {
  unobserve()
  try {
    observer = uni.createIntersectionObserver(instance?.proxy as any, { observeAll: true })
    observer.relativeToViewport({ top: -60, bottom: -500 }).observe('.rb-anchor', (res: any) => {
      if ((res.intersectionRatio || 0) > 0 && res.id)
        active.value = res.id
    })
  }
  catch {
    observer = null
  }
}
// the sections exist only once the view has loaded
watch(() => !!view.value, (shown) => {
  if (shown)
    nextTick(observeSections)
  else
    unobserve()
}, { immediate: true })
onUnmounted(unobserve)
function goRobots() {
  uni.navigateTo({ url: '/pages/robots/index' })
}

// This page is about one product feature; a robot whose product lacks it sees <tb-not-here />.
const { missing: notHere, allowed: featureAllowed } = useFeatureGate('companion')

let timer: ReturnType<typeof setInterval> | undefined
function pageHidden() {
  return typeof document !== 'undefined' && document.hidden
}
onShow(async () => {
  if (!(await featureAllowed()))
    return
  reload(Boolean(view.value))
  if (!fwDevice.value)
    loadDevice()
  if (!fwLatest.value)
    loadLatest()
  clearInterval(timer)
  timer = setInterval(() => {
    if (!pageHidden())
      reload()
  }, POLL_MS)
})
onHide(() => clearInterval(timer))
onUnload(() => {
  clearInterval(timer)
  unobserve()
  fwFlow.destroy()
})
watch(deviceId, () => {
  view.value = null
  fwDevice.value = null
  fwFlow.reset()
  if (notHere.value)
    return
  reload(false)
  loadDevice()
})
</script>

<template>
  <view class="tb-wrap rbm">
    <tb-page-header :title="t('nav.robot')" :description="t('mrobot.lede')" back>
      <template v-if="view" #actions>
        <tb-button size="s" variant="quiet" icon="refresh" :loading="loading" :aria-label="t('mrobot.refresh')" @click="reload(false)" />
      </template>
    </tb-page-header>

    <tb-not-here v-if="notHere" />

    <view v-else-if="!robot.deviceId && robot.loaded" class="rbm__state">
      <tb-empty face="confused" :title="t('common.noRobot')" :text="t('common.noRobotText')">
        <tb-button variant="primary" icon="robots" @click="goRobots">
          {{ t('common.goRobots') }}
        </tb-button>
      </tb-empty>
    </view>

    <view v-else-if="!view" class="rbm__wait">
      <block v-if="loadFailed && status.state !== 'checking'">
        <tb-robot-status :status="status" :loading="loading" @refresh="reload(false)" />
        <text class="rbm__waits">
          {{ t('status.pageWaits') }}
        </text>
      </block>
      <view v-else class="rbm__state">
        <tb-loading :label="t('common.loading')" />
      </view>
    </view>

    <block v-else>
      <tb-robot-status v-if="!online && status.state !== 'checking'" class="rbm__status" :status="status" :loading="loading" @refresh="reload(false)" />
      <text v-if="status.state === 'offline'" class="rbm__offline">
        {{ t('mrobot.offlineNote') }}
      </text>

      <scroll-view scroll-x class="rbm__indexwrap" :show-scrollbar="false" :scroll-into-view="active ? `rbi-${active.slice(3)}` : ''" scroll-with-animation>
        <view class="rbm__index" role="navigation" :aria-label="t('mrobot.indexLabel')">
          <view
            v-for="s in sections" :id="`rbi-${s}`" :key="s" class="rbm__indexlink" :class="{ 'is-on': active === `rb-${s}` }"
            role="link" :aria-current="active === `rb-${s}` ? 'true' : undefined" hover-class="is-press" @click="jump(s)"
          >
            <text>{{ t(`mrobot.sec.${s}`) }}</text>
          </view>
        </view>
      </scroll-view>

      <RobotStatus id="rb-status" class="rb-anchor" />
      <RobotSound id="rb-sound" class="rb-anchor" />
      <RobotTalk id="rb-talk" class="rb-anchor" />
      <RobotMemory id="rb-memory" class="rb-anchor" />
      <RobotGestures id="rb-gestures" class="rb-anchor" />
      <RobotJobs id="rb-jobs" class="rb-anchor" />
      <RobotFirmware id="rb-firmware" class="rb-anchor" />
    </block>
  </view>
</template>

<style lang="scss">
.rbm {
  max-width: 720px;
  margin: 0 auto;
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}
.rbm__state {
  padding: 48px 0;
  display: flex;
  justify-content: center;
}
.rbm__wait {
  padding-top: 16px;
}
.rbm__waits {
  display: block;
  padding-top: 12px;
  font-size: 13px;
  color: var(--tb-ink-2);
}
.rbm__status {
  margin-top: 12px;
}
.rbm__offline {
  display: block;
  padding: 10px 0 12px;
  color: var(--tb-ink-2);
  font-size: 14px;
}
/* pinned while the long screen scrolls; no ancestor clips overflow, so sticky holds on H5 */
.rbm__indexwrap {
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  height: auto;
  white-space: nowrap;
  background: var(--tb-paper);
  border-bottom: 1px solid var(--tb-rule);
}
.rbm__index {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 18px;
  padding: 4px 0;
  min-width: max-content;
}
.rbm__indexlink {
  display: inline-flex;
  align-items: center;
  flex: none;
  min-height: 44px;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.rbm__indexlink.is-press {
  color: var(--tb-ink);
}
.rbm__indexlink.is-on {
  color: var(--tb-ink);
  box-shadow: inset 0 -3px 0 var(--tb-action);
}
</style>
