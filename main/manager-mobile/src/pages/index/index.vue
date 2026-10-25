<!-- Today: the almanac page for this robot (signature surface, owner: foundation) -->
<route lang="jsonc" type="home">
{
  "layout": "tabbar",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Nobix"
  }
}
</route>

<script lang="ts" setup>
import { onHide, onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { getCompanion, sendCompanionCommand, sendCompanionMessage } from '@/api/companion/companion'
import { getCurrentLanguage, t } from '@/i18n'
import { useUserStore } from '@/store'
import { digits, timeText } from '@/utils/calendar.mjs'
import { getDeviceOnlineStatus } from '@/api/device/device'
import { isOnline, lastSeen, parseStatus } from '@/pages/robots/robotsModel.mjs'
import { allows, productName } from '@/utils/tbProducts.mjs'
import { loadRobots, robot, robotFeatures } from '@/utils/tbRobot'
import { dayRows, daysTogether, isoDate, robotState } from '@/utils/todayModel.mjs'
import { toast } from '@/utils/toast'

defineOptions({ name: 'Today' })

const userStore = useUserStore()
const lang = computed(() => getCurrentLanguage())
const num = (n: any) => digits(n ?? '–', lang.value)

const offset = ref(0)
const clock = ref(new Date())
const date = computed(() => {
  const d = new Date(clock.value)
  d.setDate(d.getDate() + offset.value)
  return d
})
const isToday = computed(() => offset.value === 0)
const nowMinutes = computed(() => clock.value.getHours() * 60 + clock.value.getMinutes())

const view = ref<any>(null)
const loading = ref(false)
const failed = ref(false)
const line = ref('')
const sending = ref(false)
const pulse = ref(false)
const busy = ref('')

const botName = computed(() => view.value?.name || robot.name || t('nav.robotFallback'))

// What this robot's product can do: a generic Nobix device has no companion view, so Today shows
// its name, connection and the way to its character instead of the day, face and commands.
const features = computed(() => robotFeatures())
const can = (f: string) => allows(features.value, f)
const companion = computed(() => can('companion'))
const listed = computed(() => robot.list.find(r => r.deviceId === robot.deviceId) || null)
const productLabel = computed(() => productName(listed.value || robot, lang.value))
const deviceOnline = ref<boolean | null>(null)
const deviceState = computed(() => (deviceOnline.value ? 'online' : 'offline'))
const seenText = computed(() => {
  const s: any = lastSeen(listed.value?.lastConnectedAt, clock.value.getTime())
  if (s.kind === 'never')
    return t('today.device.never')
  const when = s.kind === 'just'
    ? t('robots.justNow')
    : s.kind === 'date'
      ? new Intl.DateTimeFormat(lang.value === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(s.at))
      : t(`robots.${s.kind}Ago`, { n: num(s.n) })
  return t('today.device.seen', { when })
})
async function refreshDevice() {
  const r = listed.value
  const agentId = r?.agentId || robot.agentId
  if (!agentId)
    return
  try {
    deviceOnline.value = isOnline(parseStatus(await getDeviceOnlineStatus(agentId)), r || {})
  }
  catch {
    deviceOnline.value = false
  }
}
const state = computed(() => robotState(view.value, clock.value))
const faceMood = computed(() => (({ offline: 'offline', sleeping: 'sleepy' } as Record<string, string>)[state.value] || 'awake'))
const doingNow = computed(() => {
  const a = view.value?.stats?.activity
  return a ? t(`today.activity.${a}`) : (state.value === 'online' ? t('today.free') : '')
})
const together = computed(() => {
  const n = daysTogether(view.value)
  return n ? t('today.daysTogether', { n: num(n) }) : ''
})
const sunrise = computed(() => {
  const d = (view.value?.prayer?.days || []).find((x: any) => x.date === isoDate(date.value))
  return d?.sunrise ? t('today.sunrise', { time: timeText(d.sunrise, lang.value, lang.value === 'bn') }) : ''
})
const weather = computed(() => (view.value?.weather?.ok ? view.value.weather : null))
const rows = computed(() => dayRows(view.value, date.value, (k: string, p?: any) => {
  if (p && p.time)
    p = { ...p, time: timeText(p.time, lang.value, lang.value === 'bn') }
  return t(k, p || {})
}, { lang: lang.value, nowMinutes: isToday.value ? nowMinutes.value : -1 }))

const commands = [
  { type: 'story', icon: 'story', label: 'today.cmd.story' },
  { type: 'lullaby', icon: 'lullaby', label: 'today.cmd.lullaby' },
  { type: 'pomodoro', icon: 'focus', label: 'today.cmd.focus', arg: 25 },
  { type: 'game', icon: 'game', label: 'today.cmd.game', arg: 'catch' },
  { type: 'breathe', icon: 'breathe', label: 'today.cmd.breathe' },
  { type: 'night_light', icon: 'light', label: 'today.cmd.light' },
]

async function refresh(quiet = false) {
  if (!robot.deviceId)
    return
  if (!companion.value) {
    view.value = null
    refreshDevice()
    return
  }
  if (!quiet)
    loading.value = true
  try {
    view.value = await getCompanion(robot.deviceId, true)
    failed.value = false
  }
  catch {
    failed.value = true
  }
  loading.value = false
}

async function say() {
  const text = line.value.trim()
  if (!text || !robot.deviceId)
    return
  sending.value = true
  try {
    const from = (userStore.userInfo as any)?.realName || (userStore.userInfo as any)?.username || ''
    await sendCompanionMessage(robot.deviceId, { from, text, ask: false } as any)
    line.value = ''
    pulse.value = false
    setTimeout(() => { pulse.value = true }, 16)
    toast.success(state.value === 'offline' ? t('today.sentLater') : t('today.sent'))
  }
  catch {
    toast.error(t('today.sendFailed'))
  }
  sending.value = false
}

async function run(c: any) {
  if (!robot.deviceId)
    return
  busy.value = c.type
  try {
    await sendCompanionCommand(robot.deviceId, { type: c.type, arg: c.arg === undefined ? '' : String(c.arg) } as any)
    toast.success(t('today.cmdSent', { name: t(c.label) }))
  }
  catch {
    toast.error(t('today.sendFailed'))
  }
  busy.value = ''
}

function turn(dir: number) { offset.value = Math.max(-1, Math.min(6, offset.value + dir)) }
function openRow(r: any) { uni.navigateTo({ url: `/pages/day/index?focus=${encodeURIComponent(r.key)}` }) }
function go(url: string) { uni.navigateTo({ url }) }
function goRobots() { uni.navigateTo({ url: '/pages/robots/index' }) }

let tick: any = null
let poll: any = null
onShow(async () => {
  clock.value = new Date()
  await loadRobots()
  refresh(Boolean(view.value))
  tick = setInterval(() => { clock.value = new Date() }, 30000)
  poll = setInterval(() => refresh(true), 20000)
})
onHide(() => {
  clearInterval(tick)
  clearInterval(poll)
})
watch(() => robot.deviceId, () => {
  view.value = null
  deviceOnline.value = null
  refresh()
})
watch(companion, (on, was) => {
  if (on !== was)
    refresh()
})
</script>

<template>
  <view class="today tb-wrap">
    <view class="today__top" />
    <tb-month-band :date="date" :lang="lang" sticky />

    <view v-if="!robot.deviceId && robot.loaded" class="today__none">
      <tb-empty face="confused" :title="t('common.noRobot')" :text="t('common.noRobotText')">
        <tb-button variant="primary" icon="robots" @click="goRobots">{{ t('common.goRobots') }}</tb-button>
      </tb-empty>
    </view>

    <block v-else>
      <view class="today__hero">
        <tb-date-block class="today__date" :date="date" :lang="lang" :extra="sunrise" @turn="turn" />
        <view v-if="companion" class="today__bot" @click="goRobots">
          <tb-face :mood="faceMood" :pulse="pulse" :alt="t('today.faceAlt', { name: botName })" />
          <tb-name-plate :name="botName" :doing="doingNow" :detail="together" :state="state" :state-text="t(`today.state.${state}`)" />
        </view>
        <view v-else class="today__bot is-device" @click="goRobots">
          <tb-name-plate :name="botName" :doing="productLabel" :detail="seenText" :state="deviceState" :state-text="t(`today.state.${deviceState}`)" />
        </view>
      </view>

      <view v-if="!companion" class="today__device">
        <text class="tb-h2">{{ t('today.device.title') }}</text>
        <text class="today__devtext">{{ t('today.device.text', { product: productLabel }) }}</text>
        <view class="today__devlinks">
          <tb-button v-if="can('character')" variant="primary" icon="agent" @click="go('/pages/agent/index')">{{ t('today.device.character') }}</tb-button>
          <tb-button v-if="can('voiceprint')" icon="voiceprint" @click="go('/pages/voiceprint/index')">{{ t('today.device.voiceprint') }}</tb-button>
        </view>
      </view>

      <view v-if="companion && (can('messages') || can('commands'))" class="today__act">
        <view v-if="can('messages')" class="today__say">
          <tb-input v-model="line" class="today__sayin" size="l" :maxlength="300" confirm-type="send"
            :placeholder="t('today.sayPlaceholder')" :aria-label="t('today.sayLabel')" @confirm="say" />
          <tb-button variant="primary" size="l" :loading="sending" :disabled="!line.trim()" @click="say">{{ t('today.sayButton') }}</tb-button>
        </view>
        <text v-if="state === 'offline'" class="today__note">{{ t('today.offlineNote') }}</text>
        <scroll-view v-if="can('commands')" scroll-x class="today__deckwrap" :show-scrollbar="false">
          <view class="today__deck" role="group" :aria-label="t('today.deckLabel')">
            <tb-button v-for="c in commands" :key="c.type" :icon="c.icon" :loading="busy === c.type" @click="run(c)">{{ t(c.label) }}</tb-button>
          </view>
        </scroll-view>
      </view>

      <view v-if="companion && can('day')" class="today__day">
        <view class="today__dayhead">
          <text class="tb-h2">{{ isToday ? t('today.dayTitle') : t('today.dayTitleOther') }}</text>
          <text class="today__dayhint">{{ t('today.dayHint') }}</text>
        </view>
        <tb-day-table :rows="rows" :lang="lang" :now-minutes="isToday ? nowMinutes : -1" :now-label="t('common.now')"
          :empty-text="loading ? t('common.loading') : t('today.dayEmpty')" clickable @select="openRow" />
        <view v-if="failed" class="today__fail" role="alert">
          <text>{{ t('common.loadFailed') }}</text>
          <tb-button size="s" variant="quiet" icon="refresh" @click="refresh()">{{ t('common.retry') }}</tb-button>
        </view>
      </view>

      <view v-if="companion && weather" class="today__weather">
        <tb-icon name="weather" :size="22" />
        <text class="today__temp tb-num">{{ num(weather.temp) }}°</text>
        <view class="today__wtext"><text>{{ weather.text || '' }}</text><text v-if="weather.city" class="tb-small tb-muted">{{ weather.city }}</text></view>
      </view>
      <view v-if="companion" class="today__more">
        <view v-if="can('messages')" class="today__link" style="--ink: var(--tb-message)" @click="go('/pages/messages/index')">
          <tb-icon name="message" /><text>{{ t('today.linkMessages') }}</text><tb-icon name="chevron-right" :size="16" />
        </view>
        <view v-if="can('character')" class="today__link" @click="go('/pages/agent/index')">
          <tb-icon name="agent" /><text>{{ t('today.linkCharacter') }}</text><tb-icon name="chevron-right" :size="16" />
        </view>
      </view>
    </block>
  </view>
</template>

<style lang="scss">
.today__top { height: env(safe-area-inset-top); }
.today__none { padding: 40px 0; }
.today__hero { display: flex; border-bottom: 1px solid var(--tb-rule); }
.today__date { flex: 1; min-width: 0; padding: 6px 14px 14px 0; border-right: 1px solid var(--tb-rule); }
.today__bot { width: 44%; max-width: 190px; display: flex; flex-direction: column; gap: 10px; padding: 14px 0 14px 14px; }
.today__bot.is-device { padding-top: 18px; cursor: pointer; }
.today__device { display: flex; flex-direction: column; gap: 10px; padding: 16px 0 20px; border-bottom: 1px solid var(--tb-rule); }
.today__devtext { color: var(--tb-ink-2); font-size: 15px; line-height: 1.55; }
.today__devlinks { display: flex; gap: 10px; flex-wrap: wrap; }
.today__act { display: flex; flex-direction: column; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--tb-rule); }
.today__say { display: flex; gap: 8px; }
.today__sayin { flex: 1; }
.today__note { color: var(--tb-ink-2); font-size: 13px; }
.today__deckwrap { white-space: nowrap; margin: 0 -20px; width: calc(100% + 40px); }
.today__deck { display: inline-flex; gap: 8px; padding: 0 20px; scroll-padding: 0 20px; }
.today__day { padding-top: 12px; }
.today__dayhead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 6px 0 8px; }
.today__dayhint { font-size: 12px; color: var(--tb-ink-2); }
.today__fail { display: flex; align-items: center; gap: 8px; color: var(--tb-danger); font-size: 14px; padding-top: 8px; }
.today__weather { display: flex; align-items: center; gap: 10px; margin-top: 24px; padding: 12px 0; border-top: 3px solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule); }
.today__temp { font-family: var(--tb-font-display); font-weight: 700; font-size: 24px; }
.today__wtext { display: flex; flex-direction: column; }
.today__more { display: flex; flex-direction: column; }
.today__link { --ink: var(--tb-ink); display: flex; align-items: center; gap: 12px; min-height: 52px; border-bottom: 1px solid var(--tb-rule-soft); font-weight: 600; }
.today__link text { flex: 1; }
.today__link .tb-icon:first-child { color: var(--ink); }
</style>
