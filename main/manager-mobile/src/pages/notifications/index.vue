<!-- Notifications (নোটিফিকেশন): the account's notifications, newest first, and what notifies (owner: FAMILY) -->
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
import type { NotificationItem } from '@/api/notify/notify'
import type { PushState } from '@/utils/webPush'
import { onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { getNotifications, getNotifyPrefs, markAllNotificationsRead, markNotificationRead, saveNotifyPrefs, sendTestPush } from '@/api/notify/notify'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { agoOf, GROUPS, inkOf, prefsWithDefaults, targetOf, textOf } from '@/utils/notifyModel.mjs'
import { notifyRequestError } from '@/utils/requestError'
import { badges } from '@/utils/tbBadges'
import { robot, selectRobot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'
import { disablePush, enablePush, pushState } from '@/utils/webPush'

defineOptions({ name: 'NotificationsPage' })

const PAGE = 20
const lang = computed(() => getCurrentLanguage())
const num = (n: number) => digits(n, lang.value)

// ---- list
const list = ref<NotificationItem[]>([])
const total = ref(0)
const page = ref(1)
const filter = ref<'all' | 'unread'>('all')
const loading = ref(false)
const loaded = ref(false)
const failed = ref(false)
const more = computed(() => list.value.length < total.value)
const now = ref(Date.now())
const filterOptions = computed(() => [
  { value: 'all', label: t('notify.all') },
  { value: 'unread', label: badges.unread ? `${t('notify.unread')} · ${num(badges.unread)}` : t('notify.unread') },
])

async function load(reset = true) {
  if (loading.value)
    return
  loading.value = true
  failed.value = false
  const p = reset ? 1 : page.value + 1
  try {
    const res = await getNotifications(p, PAGE, filter.value === 'unread')
    const rows = (res?.list || []) as NotificationItem[]
    list.value = reset ? rows : list.value.concat(rows.filter(r => !list.value.some(x => x.id === r.id)))
    total.value = Number(res?.total) || rows.length
    badges.unread = Math.max(0, Number(res?.unread) || 0)
    page.value = p
    now.value = Date.now()
  }
  catch {
    failed.value = true
  }
  loading.value = false
  loaded.value = true
}
function pickFilter(v: 'all' | 'unread') {
  filter.value = v
  load()
}

function textFor(n: NotificationItem) {
  return textOf(n, lang.value)
}
function when(n: NotificationItem) {
  const a = agoOf(n.createdAt, now.value)
  if (a.key === 'date')
    return new Intl.DateTimeFormat(lang.value === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(n.createdAt))
  return t(`notify.ago.${a.key}`, { n: num(a.n) })
}

async function markRead(n: NotificationItem) {
  if (n.read)
    return
  n.read = true
  badges.unread = Math.max(0, badges.unread - 1)
  try {
    await markNotificationRead(n.id)
  }
  catch {
    // the next load shows the truth
  }
}
async function open(n: NotificationItem) {
  await markRead(n)
  const url = targetOf(n)
  if (!url)
    return
  if (n.deviceId && n.deviceId !== robot.deviceId) {
    const hit = robot.list.find(r => r.deviceId === n.deviceId)
    if (hit)
      selectRobot(hit)
  }
  if (url === '/pages/day/index')
    uni.switchTab({ url })
  else uni.navigateTo({ url })
}
const markingAll = ref(false)
async function readAll() {
  markingAll.value = true
  try {
    await markAllNotificationsRead()
    list.value.forEach((n) => {
      n.read = true
    })
    badges.unread = 0
    toast.success(t('notify.readAllDone'))
    if (filter.value === 'unread')
      load()
  }
  catch (e) {
    notifyRequestError(e, 'notify.failed')
  }
  markingAll.value = false
}

// ---- settings
interface Prefs { types: Record<string, boolean>, offlineMinutes: number, summaryPush: boolean, webPush: any }
const prefs = reactive(prefsWithDefaults(null) as Prefs)
const savingPrefs = ref(false)
const minuteOptions = computed(() => [10, 30, 60, 120, 240].map(m => ({
  value: m,
  label: m < 60 ? t('notify.offlineMin', { n: num(m) }) : t('notify.offlineHour', { n: num(m / 60) }),
})))
async function loadPrefs() {
  try {
    Object.assign(prefs, prefsWithDefaults(await getNotifyPrefs()))
  }
  catch {}
}
async function savePrefs(patch: Record<string, any>) {
  const before = JSON.parse(JSON.stringify({ types: prefs.types, offlineMinutes: prefs.offlineMinutes, summaryPush: prefs.summaryPush }))
  if (patch.types)
    prefs.types = { ...prefs.types, ...patch.types }
  if (patch.offlineMinutes)
    prefs.offlineMinutes = patch.offlineMinutes
  if (patch.summaryPush !== undefined)
    prefs.summaryPush = patch.summaryPush
  savingPrefs.value = true
  try {
    const res = await saveNotifyPrefs({ types: prefs.types, offlineMinutes: prefs.offlineMinutes, summaryPush: prefs.summaryPush })
    if (res)
      Object.assign(prefs, prefsWithDefaults(res))
    toast.success(t('notify.saved'))
  }
  catch (e) {
    Object.assign(prefs, before)
    notifyRequestError(e, 'notify.failed')
  }
  savingPrefs.value = false
}

// ---- push on this phone (web push on H5; the native app has a hook that is not set up yet)
const push = ref<PushState | 'app'>('off')
const pushBusy = ref(false)
async function readPush() {
  // #ifdef APP-PLUS
  push.value = 'app'
  return
  // #endif
  push.value = await pushState()
}
async function togglePush() {
  pushBusy.value = true
  try {
    if (push.value === 'on') {
      push.value = await disablePush()
      toast.success(t('notify.push.disabled'))
    }
    else {
      push.value = await enablePush()
      if (push.value === 'on')
        toast.success(t('notify.push.enabled'))
    }
  }
  catch (e) {
    notifyRequestError(e, 'notify.push.failed')
  }
  pushBusy.value = false
}
async function testPush() {
  try {
    await sendTestPush()
    toast.success(t('notify.push.testSent'))
    setTimeout(() => load(), 800)
  }
  catch (e) {
    notifyRequestError(e, 'notify.push.failed')
  }
}

onShow(() => {
  load()
  loadPrefs()
  readPush()
})
</script>

<template>
  <view class="tb-wrap ntf">
    <tb-page-header :title="t('notify.title')" :description="t('notify.lede')" back />

    <view class="ntf__bar">
      <tb-choice :model-value="filter" :options="filterOptions" :aria-label="t('notify.title')" @change="pickFilter" />
      <tb-button v-if="badges.unread" size="s" variant="quiet" icon="check" :loading="markingAll" @click="readAll">
        {{ t('notify.readAll') }}
      </tb-button>
    </view>

    <view v-if="loading && !loaded" class="ntf__state">
      <tb-loading :label="t('common.loading')" />
    </view>
    <view v-else-if="failed && !list.length" class="ntf__state">
      <tb-empty face="confused" :title="t('notify.failed')">
        <tb-button icon="refresh" @click="load()">
          {{ t('common.retry') }}
        </tb-button>
      </tb-empty>
    </view>
    <view v-else-if="!list.length" class="ntf__state">
      <tb-empty v-if="filter === 'unread'" face="happy" :title="t('notify.emptyUnread')" :text="t('notify.emptyUnreadText')">
        <tb-button @click="pickFilter('all')">
          {{ t('notify.showAll') }}
        </tb-button>
      </tb-empty>
      <tb-empty v-else face="sleepy" :title="t('notify.empty')" :text="t('notify.emptyText')" />
    </view>

    <view v-else class="ntf__list" role="list">
      <view
        v-for="n in list" :key="n.id" class="ntf__row" :class="{ 'is-unread': !n.read }" role="listitem"
        :style="{ '--ink': `var(--tb-${inkOf(n.type)})` }" hover-class="is-press" @click="open(n)"
      >
        <view class="ntf__mark" aria-hidden="true" />
        <view class="ntf__body">
          <view class="ntf__head">
            <text class="ntf__title">
              {{ textFor(n).title }}
            </text>
            <text class="ntf__when tb-num">
              {{ when(n) }}
            </text>
          </view>
          <text v-if="textFor(n).body" class="ntf__text">
            {{ textFor(n).body }}
          </text>
          <view class="ntf__meta">
            <text v-if="n.robotName" class="ntf__robot">
              {{ n.robotName }}
            </text>
            <text v-if="!n.read" class="ntf__new">
              {{ t('notify.unreadMark') }}
            </text>
          </view>
        </view>
      </view>
      <view v-if="more" class="ntf__more">
        <tb-button :loading="loading" @click="load(false)">
          {{ t('notify.more') }}
        </tb-button>
      </view>
    </view>

    <tb-section :title="t('notify.settings')" :description="t('notify.settingsText')">
      <view v-for="g in GROUPS" :key="g" class="ntf__set">
        <view class="ntf__settext">
          <text>{{ t(`notify.group.${g}`) }}</text>
          <text class="ntf__small">
            {{ t(`notify.group.${g}Line`) }}
          </text>
        </view>
        <tb-switch :model-value="prefs.types[g]" :disabled="savingPrefs" @change="(on: boolean) => savePrefs({ types: { [g]: on } })" />
      </view>
      <view class="ntf__block" :class="{ 'is-off': !prefs.types.offline }">
        <text class="ntf__label">
          {{ t('notify.offlineAfter') }}
        </text>
        <tb-choice
          :model-value="prefs.offlineMinutes" :options="minuteOptions" wrap :disabled="!prefs.types.offline || savingPrefs"
          :aria-label="t('notify.offlineAfter')" @change="(m: number) => savePrefs({ offlineMinutes: m })"
        />
      </view>
      <view class="ntf__set" :class="{ 'is-off': !prefs.types.summary }">
        <view class="ntf__settext">
          <text>{{ t('notify.summaryPush') }}</text>
          <text class="ntf__small">
            {{ t('notify.summaryPushLine') }}
          </text>
        </view>
        <tb-switch :model-value="prefs.summaryPush" :disabled="!prefs.types.summary || savingPrefs" @change="(on: boolean) => savePrefs({ summaryPush: on })" />
      </view>
    </tb-section>

    <tb-section :title="t('notify.push')" :description="t('notify.pushText')">
      <view class="ntf__push" role="status">
        <view class="ntf__dot" :class="`is-${push}`" />
        <text class="ntf__pushstate">
          {{ push === 'on' ? t('notify.push.on') : push === 'off' ? t('notify.push.off') : t(`notify.push.${push}`) }}
        </text>
      </view>
      <view v-if="push === 'on' || push === 'off'" class="ntf__pushact">
        <tb-button :variant="push === 'on' ? 'secondary' : 'primary'" :loading="pushBusy" icon="bell" @click="togglePush">
          {{ push === 'on' ? t('notify.push.disable') : t('notify.push.enable') }}
        </tb-button>
        <tb-button v-if="push === 'on'" variant="quiet" @click="testPush">
          {{ t('notify.push.test') }}
        </tb-button>
      </view>
    </tb-section>
  </view>
</template>

<style lang="scss">
.ntf {
  max-width: 720px;
  margin: 0 auto;
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}
.ntf__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule);
}
.ntf__bar .tb-choice-wrap {
  width: auto;
  flex: 1;
  min-width: 0;
}
.ntf__state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
.ntf__list {
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
}
.ntf__row {
  --ink: var(--tb-ink-2);
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.ntf__row.is-press {
  background: var(--tb-paper-2);
}
.ntf__mark {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 8px;
  background: var(--ink);
}
.ntf__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.ntf__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.ntf__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--tb-ink-2);
  overflow-wrap: anywhere;
}
.ntf__row.is-unread .ntf__title {
  font-weight: 700;
  color: var(--tb-ink);
}
.ntf__when {
  flex: none;
  font-size: 12px;
  color: var(--tb-ink-2);
}
.ntf__text {
  font-size: 14px;
  line-height: 1.55;
  color: var(--tb-ink-2);
}
.ntf__meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--tb-ink-2);
}
.ntf__new {
  font-weight: 700;
  color: var(--tb-ink);
}
.ntf__more {
  display: flex;
  justify-content: center;
  padding-top: 14px;
}
.ntf__set {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 56px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.ntf__settext {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  font-size: 15px;
}
.ntf__small {
  font-size: 13px;
  line-height: 1.55;
  color: var(--tb-ink-2);
}
.ntf__set.is-off .ntf__settext > text:first-child,
.ntf__block.is-off .ntf__label {
  color: var(--tb-ink-3);
}
.ntf__block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.ntf__label {
  font-size: 15px;
}
.ntf__push {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0 12px;
}
.ntf__dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--tb-ink-3);
}
.ntf__dot.is-on {
  background: var(--tb-ok);
  border-color: var(--tb-ok);
}
.ntf__dot.is-denied {
  background: var(--tb-danger);
  border-color: var(--tb-danger);
}
.ntf__pushstate {
  font-size: 14px;
  line-height: 1.55;
  color: var(--tb-ink-2);
}
.ntf__pushact {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
