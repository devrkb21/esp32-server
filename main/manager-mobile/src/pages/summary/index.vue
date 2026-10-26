<!-- Day summary (দিনের সারাংশ): the robot's last 30 days, today's text, bond line and focus bars (owner: FAMILY) -->
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
import type { DaySummary } from '@/api/summary/summary'
import { onShow } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { buildTodaySummary, getSummaries } from '@/api/summary/summary'
import { useFeatureGate } from '@/hooks/useFeatureGate'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { notifyRequestError } from '@/utils/requestError'
import { robot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'
import { bestGame, bondLine, focusBars, isoDay, moodKey, summaryText, timeline, totals } from './summaryModel.mjs'

defineOptions({ name: 'SummaryPage' })

const DAYS = 30
const PLOT_H = 120
const lang = computed(() => getCurrentLanguage())
const num = (n: number | string) => digits(n, lang.value)

const rows = ref<DaySummary[]>([])
const loading = ref(false)
const loaded = ref(false)
const failed = ref(false)
const building = ref(false)
const todayKey = ref(isoDay(new Date()))

const today = computed(() => rows.value.find(r => r.day === todayKey.value) || null)
const days = computed(() => timeline(rows.value, DAYS, new Date()))
const sum = computed(() => totals(rows.value))

// ---- charts: measured once the plot is laid out, so the line's slopes are true in pixels
const instance = getCurrentInstance()
const plotW = ref(0)
const bond = computed(() => bondLine(days.value, plotW.value || 300, PLOT_H))
const focus = computed(() => focusBars(days.value))
const hasBond = computed(() => bond.value.points.length >= 2)
const hasFocus = computed(() => focus.value.max > 0)
function measure() {
  nextTick(() => {
    uni.createSelectorQuery().in(instance?.proxy as any).select('.sum__plot').boundingClientRect((rect: any) => {
      if (rect && rect.width)
        plotW.value = rect.width
    }).exec()
  })
}

function dayName(day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat(lang.value === 'bn' ? 'bn-BD' : 'en-GB', opts).format(new Date(y, m - 1, d))
}
function moodText(r: DaySummary) {
  const k = moodKey(r.mood)
  return k ? t('summary.mood', { mood: t(`summary.mood.${k}`) }) : ''
}
function gameText(r: DaySummary) {
  const best = bestGame(r)
  if (!best)
    return ''
  const [game, score] = best
  const name = t(`summary.game.${game}`)
  return t('summary.best', { game: name.startsWith('summary.') ? game : name, n: num(score) })
}
function facts(r: DaySummary) {
  return [
    { key: 'talks', label: t('summary.talks'), value: t('summary.talkN', { n: num(r.talkCount || 0) }) },
    { key: 'focus', label: t('summary.focus'), value: t('summary.minN', { n: num(r.focusMinutes || 0) }) },
    { key: 'reminders', label: t('summary.reminders'), value: t('summary.remN', { done: num(r.remindersDone || 0), missed: num(r.remindersMissed || 0) }) },
    { key: 'memories', label: t('summary.memories'), value: t('summary.memN', { n: num(r.newMemories || 0) }) },
    { key: 'games', label: t('summary.games'), value: [t('summary.gameN', { n: num(r.gamesPlayed || 0) }), gameText(r)].filter(Boolean).join(' · ') },
  ]
}
function lineOf(r: DaySummary) {
  return [
    t('summary.talkN', { n: num(r.talkCount || 0) }),
    t('summary.minN', { n: num(r.focusMinutes || 0) }),
    r.bondScore != null ? t('summary.bondN', { n: num(r.bondScore) }) : '',
    moodText(r),
  ].filter(Boolean).join(' · ')
}

async function load() {
  if (!robot.deviceId)
    return
  loading.value = true
  failed.value = false
  todayKey.value = isoDay(new Date())
  try {
    const list = ((await getSummaries(robot.deviceId, DAYS)) || []) as DaySummary[]
    rows.value = list.slice().sort((a, b) => (a.day < b.day ? 1 : -1))
  }
  catch {
    failed.value = true
  }
  loading.value = false
  loaded.value = true
  measure()
}
async function buildNow() {
  building.value = true
  try {
    const row = await buildTodaySummary(robot.deviceId)
    if (row && row.day) {
      rows.value = [row, ...rows.value.filter(r => r.day !== row.day)].sort((a, b) => (a.day < b.day ? 1 : -1))
      measure()
    }
    toast.success(t('summary.built'))
  }
  catch (e) {
    notifyRequestError(e, 'summary.buildFailed')
  }
  building.value = false
}

function goRobots() {
  uni.navigateTo({ url: '/pages/robots/index' })
}

const { missing: notHere, allowed } = useFeatureGate('summary')
onShow(async () => {
  if (!(await allowed()))
    return
  load()
})
watch(() => robot.deviceId, () => {
  rows.value = []
  if (!notHere.value)
    load()
})
</script>

<template>
  <view class="tb-wrap sum">
    <tb-page-header :title="t('summary.title')" :description="t('summary.lede')" back />

    <tb-not-here v-if="notHere" />

    <view v-else-if="!robot.deviceId && robot.loaded" class="sum__state">
      <tb-empty face="confused" :title="t('common.noRobot')" :text="t('common.noRobotText')">
        <tb-button variant="primary" icon="robots" @click="goRobots">
          {{ t('common.goRobots') }}
        </tb-button>
      </tb-empty>
    </view>

    <view v-else-if="loading && !loaded" class="sum__state">
      <tb-loading :label="t('common.loading')" />
    </view>

    <view v-else-if="failed && !rows.length" class="sum__state">
      <tb-empty face="confused" :title="t('summary.failed')">
        <tb-button icon="refresh" @click="load">
          {{ t('common.retry') }}
        </tb-button>
      </tb-empty>
    </view>

    <block v-else>
      <!-- Today -->
      <view class="sum__today">
        <view class="sum__todayhead">
          <text class="sum__todaytitle">
            {{ t('summary.today') }}
          </text>
          <text class="sum__todaydate">
            {{ dayName(todayKey) }}
          </text>
        </view>
        <block v-if="today">
          <text class="sum__text">
            {{ summaryText(today, lang) }}
          </text>
          <view class="sum__facts">
            <view v-for="f in facts(today)" :key="f.key" class="sum__fact">
              <text class="sum__factlabel">
                {{ f.label }}
              </text>
              <text class="sum__factvalue tb-num">
                {{ f.value }}
              </text>
            </view>
          </view>
          <text v-if="moodText(today)" class="sum__small">
            {{ moodText(today) }}
          </text>
          <text v-if="!today.final" class="sum__small">
            {{ t('summary.draft') }}
          </text>
        </block>
        <view v-else class="sum__none">
          <text class="sum__small">
            {{ t('summary.todayNone') }}
          </text>
          <tb-button variant="primary" icon="refresh" :loading="building" @click="buildNow">
            {{ t('summary.buildNow') }}
          </tb-button>
        </view>
      </view>

      <view v-if="!rows.length" class="sum__state">
        <tb-empty face="sleepy" :title="t('summary.empty')" :text="t('summary.emptyText')" />
      </view>

      <block v-else>
        <text class="sum__total">
          {{ t('summary.total', { days: num(sum.days), talks: num(sum.talkCount), focus: num(sum.focusMinutes) }) }}
        </text>

        <!-- Bond score: a line over 30 days; a day without a summary breaks it -->
        <tb-section :title="t('summary.bondTitle')" :description="t('summary.bondText')">
          <view class="sum__chart" role="img" :aria-label="t('summary.bondTitle')">
            <view class="sum__axis">
              <text class="tb-num">
                {{ num(bond.range.max) }}
              </text>
              <text class="tb-num">
                {{ num(bond.range.min) }}
              </text>
            </view>
            <view class="sum__plot" :style="{ height: `${PLOT_H}px` }">
              <view class="sum__grid is-top" />
              <view class="sum__grid is-mid" />
              <view class="sum__grid is-base" />
              <block v-if="plotW && hasBond">
                <view
                  v-for="(s, k) in bond.segments" :key="`s${k}`" class="sum__seg"
                  :style="{ width: `${s.length}px`, transform: `translate(${s.x}px, ${s.y - 1}px) rotate(${s.angle}deg)` }"
                />
                <view
                  v-for="p in bond.points" :key="p.day" class="sum__pt" :class="{ 'is-last': p.day === todayKey }"
                  :style="{ transform: `translate(${p.x - 3}px, ${p.y - 3}px)` }"
                />
              </block>
              <text v-if="!hasBond" class="sum__chartnone">
                {{ t('summary.chartNone') }}
              </text>
            </view>
          </view>
          <view class="sum__xlabels">
            <text class="tb-num">
              {{ dayName(days[0].day, { day: 'numeric', month: 'short' }) }}
            </text>
            <text class="tb-num">
              {{ dayName(days[days.length - 1].day, { day: 'numeric', month: 'short' }) }}
            </text>
          </view>
        </tb-section>

        <!-- Focus minutes: one bar per day -->
        <tb-section :title="t('summary.focusTitle')" :description="t('summary.focusText')">
          <view class="sum__chart" role="img" :aria-label="t('summary.focusTitle')">
            <view class="sum__axis">
              <text class="tb-num">
                {{ num(focus.max) }}
              </text>
              <text class="tb-num">
                {{ num(0) }}
              </text>
            </view>
            <view class="sum__bars" :style="{ height: `${PLOT_H}px` }">
              <view class="sum__grid is-top" />
              <view class="sum__grid is-base" />
              <view v-for="b in focus.bars" :key="b.day" class="sum__barcol">
                <view class="sum__bar" :style="{ height: `${Math.round(b.share * PLOT_H)}px` }" />
              </view>
              <text v-if="!hasFocus" class="sum__chartnone">
                {{ t('summary.chartNone') }}
              </text>
            </view>
          </view>
          <view class="sum__xlabels">
            <text class="tb-num">
              {{ dayName(days[0].day, { day: 'numeric', month: 'short' }) }}
            </text>
            <text v-if="hasFocus" class="tb-num">
              {{ t('summary.peak', { n: t('summary.minN', { n: num(focus.max) }) }) }}
            </text>
            <text class="tb-num">
              {{ dayName(days[days.length - 1].day, { day: 'numeric', month: 'short' }) }}
            </text>
          </view>
        </tb-section>

        <!-- The days, as ruled rows: also the text form of both charts -->
        <tb-section :title="t('summary.days')" :description="t('summary.daysText')">
          <view class="sum__days" role="list">
            <view v-for="r in rows" :key="r.day" class="sum__day" role="listitem">
              <view class="sum__dayhead">
                <text class="sum__daydate">
                  {{ dayName(r.day, { weekday: 'short', day: 'numeric', month: 'short' }) }}
                </text>
                <text class="sum__dayline tb-num">
                  {{ lineOf(r) }}
                </text>
              </view>
              <text class="sum__daytext">
                {{ summaryText(r, lang) }}
              </text>
            </view>
          </view>
        </tb-section>
      </block>
    </block>
  </view>
</template>

<style lang="scss">
.sum {
  max-width: 720px;
  margin: 0 auto;
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}
.sum__state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
.sum__today {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 0 20px;
  border-bottom: 1px solid var(--tb-rule);
}
.sum__todayhead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.sum__todaytitle {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 20px;
}
.sum__todaydate {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.sum__text {
  font-size: 16px;
  line-height: 1.55;
}
.sum__facts {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule-soft);
}
.sum__fact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  padding: 6px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.sum__factlabel {
  font-size: 14px;
  color: var(--tb-ink-2);
}
.sum__factvalue {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 15px;
  text-align: right;
}
.sum__small {
  font-size: 13px;
  line-height: 1.55;
  color: var(--tb-ink-2);
}
.sum__none {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.sum__total {
  display: block;
  padding: 14px 0 0;
  font-size: 14px;
  color: var(--tb-ink-2);
}
.sum__chart {
  display: flex;
  gap: 8px;
}
.sum__axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 32px;
  flex: none;
  font-size: 12px;
  color: var(--tb-ink-2);
  text-align: right;
}
.sum__plot,
.sum__bars {
  position: relative;
  flex: 1;
  min-width: 0;
}
.sum__grid {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px solid var(--tb-rule-soft);
}
.sum__grid.is-top {
  top: 0;
}
.sum__grid.is-mid {
  top: 50%;
}
.sum__grid.is-base {
  bottom: 0;
  border-top-color: var(--tb-rule);
}
.sum__seg {
  position: absolute;
  left: 0;
  top: 0;
  height: 2px;
  background: var(--tb-ink);
  transform-origin: 0 50%;
}
.sum__pt {
  position: absolute;
  left: 0;
  top: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tb-paper);
  border: 1.5px solid var(--tb-ink);
  box-sizing: border-box;
}
.sum__pt.is-last {
  background: var(--tb-ink);
}
.sum__bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
}
.sum__barcol {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-end;
  height: 100%;
}
.sum__bar {
  width: 100%;
  background: var(--tb-focus);
  border-radius: 2px 2px 0 0;
}
.sum__chartnone {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--tb-ink-2);
}
.sum__xlabels {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0 0 40px;
  font-size: 12px;
  color: var(--tb-ink-2);
}
.sum__days {
  display: flex;
  flex-direction: column;
}
.sum__day {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.sum__dayhead {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sum__daydate {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 15px;
}
.sum__dayline {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.sum__daytext {
  font-size: 14px;
  line-height: 1.55;
}
</style>
