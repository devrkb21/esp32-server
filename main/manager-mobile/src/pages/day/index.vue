<!-- Day: everything with a time in TinyBot's day, for this robot (owner: m-day) -->
<route lang="jsonc">
{
  "layout": "tabbar",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Nobix"
  }
}
</route>

<script lang="ts" setup>
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, provide, ref, watch } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { loadRobots, robot } from '@/utils/tbRobot'
import DayAlarms from './components/DayAlarms.vue'
import DayFocus from './components/DayFocus.vue'
import DayNight from './components/DayNight.vue'
import DayPrayer from './components/DayPrayer.vue'
import DayReminders from './components/DayReminders.vue'
import DayRoutine from './components/DayRoutine.vue'
import DayScreen from './components/DayScreen.vue'
import DayTalk from './components/DayTalk.vue'
import { createDay, dayKey } from './dayContext'
import { dayTimeline, nextRow, nowActivity, TAB_ICON, tabOfKey, TABS } from './dayModel.mjs'
import './day.scss'

defineOptions({ name: 'DayPage' })

// Today opens a row here with ?focus=<row key>, or (Day being a tab) by leaving the key in storage.
const FOCUS_KEY = 'tb.day.focus'
const POLL_MS = 20000

const day = createDay()
provide(dayKey, day)

const lang = computed(() => getCurrentLanguage())
const clock = ref(new Date())
const tab = ref('alarms')
const pendingFocus = ref('')
const panels: Record<string, any> = {}
function setPanel(key: string, el: any) {
  if (el)
    panels[key] = el
}

const view = computed(() => day.view)
const rows = computed(() => dayTimeline(day.view, clock.value, (k: string, p?: any) => t(k, nums(p)), day.fmt, day.saving))
const next = computed(() => nextRow(rows.value, day.minute) as any)
const doing = computed(() => nowActivity(day.view, day.minute) as string)
const dateText = computed(() => {
  const loc = lang.value === 'bn' ? 'bn-BD' : String(lang.value || 'en').replace('_', '-')
  try {
    return new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(clock.value)
  }
  catch {
    return ''
  }
})
const counts = computed(() => {
  const v: any = day.view || {}
  return { alarms: (v.alarms || []).length, reminders: (v.reminders || []).length } as Record<string, number>
})
const tabOptions = computed(() => (TABS as string[]).map(key => ({
  value: key,
  icon: TAB_ICON[key as keyof typeof TAB_ICON],
  label: counts.value[key] ? `${t(`day.tab.${key}`)} ${day.num(counts.value[key])}` : t(`day.tab.${key}`),
})))

/** i18n params with their numbers in the reader's numerals. */
function nums(p?: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(p || {})) out[k] = typeof v === 'number' ? day.num(v) : v
  return out
}

function tick() {
  clock.value = new Date()
  day.minute = clock.value.getHours() * 60 + clock.value.getMinutes()
}

/** Opens a row of the day (a tap on the table, or Today's link): its area, then the item. */
function openKey(key: string) {
  const area = tabOfKey(key)
  if (!area)
    return
  tab.value = area
  nextTick(() => {
    const p = panels[area]
    if (p && p.focusKey)
      p.focusKey(key)
    uni.pageScrollTo({ selector: '#day-areas', duration: 200 })
  })
}
function takeFocus() {
  let key = pendingFocus.value
  try {
    key = key || uni.getStorageSync(FOCUS_KEY) || ''
    uni.removeStorageSync(FOCUS_KEY)
  }
  catch {}
  pendingFocus.value = ''
  if (key && day.view)
    openKey(String(key))
  else if (key)
    pendingFocus.value = String(key)
}
function goRobots() { uni.navigateTo({ url: '/pages/robots/index' }) }

let ticker: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setInterval> | undefined
onLoad((q: any) => {
  if (q?.focus)
    pendingFocus.value = decodeURIComponent(String(q.focus))
})
onShow(async () => {
  tick()
  await loadRobots()
  await day.refresh(Boolean(day.view))
  takeFocus()
  clearInterval(ticker)
  clearInterval(poll)
  ticker = setInterval(tick, 30000)
  poll = setInterval(() => day.refresh(true), POLL_MS)
})
onHide(() => {
  clearInterval(ticker)
  clearInterval(poll)
})
watch(() => robot.deviceId, () => {
  day.view = null
  day.refresh()
})
</script>

<template>
  <view class="dpage tb-wrap">
    <tb-page-header :title="t('nav.day')" :description="t('day.lede')">
      <template v-if="view" #actions>
        <tb-tag :ink="view.online ? 'ok' : 'ink-2'" mark>
          {{ view.online ? t('common.online') : t('common.offline') }}
        </tb-tag>
      </template>
    </tb-page-header>

    <view v-if="!robot.deviceId && robot.loaded" class="dpage__state">
      <tb-empty face="confused" :title="t('common.noRobot')" :text="t('common.noRobotText')">
        <tb-button variant="primary" icon="robots" @click="goRobots">
          {{ t('common.goRobots') }}
        </tb-button>
      </tb-empty>
    </view>

    <view v-else-if="!view" class="dpage__state">
      <tb-empty v-if="day.failed && !day.loading" face="confused" :title="t('common.loadFailed')">
        <tb-button icon="refresh" @click="day.refresh()">
          {{ t('common.retry') }}
        </tb-button>
      </tb-empty>
      <tb-loading v-else :label="t('common.loading')" />
    </view>

    <block v-else>
      <text v-if="!view.online" class="dpage__offline" role="status">
        {{ t('day.offlineNote') }}
      </text>

      <view class="dnow" :aria-label="t('day.nowLabel')">
        <DayScreen
          v-if="doing" class="dnow__screen" :activity="doing" :look="view.settings?.look"
          :alt="t('day.screenAlt', { activity: t(`day.activity.${doing}`) })"
        />
        <tb-face v-else class="dnow__screen" :mood="view.online ? 'awake' : 'offline'" :alt="t('day.screenIdle')" />
        <view class="dnow__list">
          <view class="dnow__line">
            <text class="dnow__k is-now">
              {{ t('common.now') }}
            </text>
            <text class="dnow__v">
              {{ doing ? t(`day.activity.${doing}`) : t('day.nothingNow') }}
            </text>
          </view>
          <view v-if="next" class="dnow__line">
            <text class="dnow__k">
              {{ t('day.next') }}
            </text>
            <text class="dnow__v">
              <text class="tb-num">
                {{ day.fmt(next.time) }}
              </text> {{ next.title }}
            </text>
          </view>
        </view>
      </view>

      <view class="dtoday">
        <view class="dtoday__head">
          <text class="tb-h2">
            {{ t('day.todayTitle') }}
          </text>
          <text class="dtoday__date">
            {{ dateText }}
          </text>
        </view>
        <tb-day-table
          :rows="rows" :lang="lang" :now-minutes="day.minute" :now-label="t('common.now')"
          :empty-text="t('day.todayEmpty')" clickable @select="(r: any) => openKey(r.key)"
        />
        <text class="dtoday__hint">
          {{ t('day.tableHint') }}
        </text>
        <view v-if="day.failed" class="dpage__fail" role="alert">
          <text>{{ t('common.loadFailed') }}</text>
          <tb-button size="s" variant="quiet" icon="refresh" @click="day.refresh()">
            {{ t('common.retry') }}
          </tb-button>
        </view>
      </view>

      <view id="day-areas" class="dareas">
        <tb-choice v-model="tab" wrap :options="tabOptions" :aria-label="t('day.tabsLabel')" />
      </view>
      <view class="dpanel" role="tabpanel" :aria-label="t(`day.tab.${tab}`)">
        <!-- every panel stays mounted: unsaved edits survive switching areas -->
        <DayAlarms v-show="tab === 'alarms'" :ref="(el: any) => setPanel('alarms', el)" />
        <DayReminders v-show="tab === 'reminders'" :ref="(el: any) => setPanel('reminders', el)" />
        <DayPrayer v-show="tab === 'prayer'" :ref="(el: any) => setPanel('prayer', el)" />
        <DayRoutine v-show="tab === 'routine'" :ref="(el: any) => setPanel('routine', el)" />
        <DayFocus v-show="tab === 'focus'" :ref="(el: any) => setPanel('focus', el)" />
        <DayNight v-show="tab === 'night'" :ref="(el: any) => setPanel('night', el)" />
        <DayTalk v-show="tab === 'talk'" :ref="(el: any) => setPanel('talk', el)" />
      </view>
    </block>
  </view>
</template>

<style lang="scss">
.dpage {
  padding-bottom: 24px;
}
.dpage__state {
  padding: 40px 0;
  display: flex;
  justify-content: center;
}
.dpage__offline {
  display: block;
  padding: 10px 0;
  border-bottom: 1px dashed var(--tb-rule-soft);
  color: var(--tb-ink-2);
  font-size: 14px;
}
.dpage__fail {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tb-danger);
  font-size: 14px;
  padding-top: 8px;
}

.dnow {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid var(--tb-rule);
}
.dnow__screen {
  width: 120px;
  flex: none;
}
.dnow__list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dnow__line {
  display: flex;
  gap: 10px;
  align-items: baseline;
  min-width: 0;
}
.dnow__k {
  flex: none;
  width: 3.4em;
  font-size: 12px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.dnow__k.is-now {
  color: var(--tb-action);
}
.dnow__v {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.dtoday {
  padding-top: 12px;
}
.dtoday__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 6px 0 8px;
}
.dtoday__date {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.dtoday__hint {
  display: block;
  padding-top: 8px;
  border-top: 1px solid var(--tb-rule);
  font-size: 12px;
  color: var(--tb-ink-2);
}

.dareas {
  margin-top: 24px;
  padding-top: 10px;
  border-top: 3px solid var(--tb-rule);
  scroll-margin-top: 12px;
}
.dpanel {
  min-height: 240px;
}
</style>
