<script lang="ts" setup>
import type { CompanionEvent } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { getCompanionEvents } from '@/api/companion'
import { t } from '@/i18n'
import { nextPrayer } from '../companionUtils.mjs'
import { agoText, MOOD_EMOJI, moodText, notifyError, useCompanion, WEATHER_EMOJI } from './context'

defineOptions({
  name: 'CompanionStatusPanel',
})

const { dev, deviceId } = useCompanion()

const stats = computed(() => dev.value?.stats || {})
const hasStats = computed(() => Object.keys(stats.value).length > 0)
const bond = computed(() => Math.max(0, Math.min(100, stats.value.bond_score ?? 0)))

const highScores = computed(() => {
  const hs = stats.value.high_scores || {}
  return Object.keys(hs).map((key) => {
    const ms = key.endsWith('_ms')
    const game = ms ? key.slice(0, -3) : key
    const name = t(`companion.game.${game}`)
    return {
      key,
      name: name === `companion.game.${game}` ? game : name,
      value: ms ? `${hs[key]} ms` : String(hs[key]),
    }
  })
})

/** last_touch_s is relative to the report time (stats_updated) */
const lastTouch = computed(() => {
  const s = stats.value.last_touch_s
  const at = dev.value?.stats_updated
  if (s === undefined || !at)
    return ''
  return agoText(at - s)
})

const weather = computed(() => dev.value?.weather)
const weatherIcon = computed(() => {
  const w = weather.value
  if (!w?.ok)
    return '🌡️'
  if (w.is_day === false && w.kind === 'clear')
    return '🌙'
  return (w.kind && WEATHER_EMOJI[w.kind]) || '🌡️'
})

const next = computed(() => {
  const p = dev.value?.prayer
  return p?.enabled ? nextPrayer(p.days) : null
})

// Events: the view carries the latest 30; "show more" loads up to 50 from the events endpoint
const moreEvents = ref<CompanionEvent[] | null>(null)
const loadingMore = ref(false)
const events = computed(() => moreEvents.value || (dev.value?.events || []).slice(0, 12))

watch(() => dev.value?.events?.[0]?.rx, () => {
  moreEvents.value = null
})

async function showMore() {
  loadingMore.value = true
  try {
    const res = await getCompanionEvents(deviceId.value, 50)
    moreEvents.value = res?.events || []
  }
  catch (error) {
    notifyError(error)
  }
  finally {
    loadingMore.value = false
  }
}

function alarmTime(id?: string) {
  return (dev.value?.alarms || []).find(a => a.id === id)?.time || ''
}

function eventText(e: CompanionEvent): string {
  const key = `companion.event.${e.type}`
  let text = t(key)
  if (text === key)
    text = e.type
  if (e.type === 'pomodoro_done')
    return `${text} (${t('companion.event.rounds', { n: e.value ?? 0 })})`
  if (e.type === 'game_score') {
    const game = t(`companion.game.${e.id}`)
    return `${text}: ${game === `companion.game.${e.id}` ? (e.id || '') : game} ${e.value ?? ''}`
  }
  if (e.type === 'streak')
    return `${text}: ${t('companion.event.days', { n: e.value ?? 0 })}`
  if (e.type.startsWith('alarm') && e.id)
    return `${text} ${alarmTime(e.id)}`.trim()
  return text
}
</script>

<template>
  <view v-if="dev" class="flex flex-col gap-[20rpx]">
    <!-- Status -->
    <view class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <view class="flex items-center justify-between">
        <view class="flex-1">
          <view class="flex items-center gap-[12rpx]">
            <view class="h-[18rpx] w-[18rpx] rounded-full" :class="dev.online ? 'bg-[#52c41a]' : 'bg-[#bfbfbf]'" />
            <text class="text-[34rpx] text-[#232338] font-semibold">
              {{ dev.online ? t('companion.online') : t('companion.offline') }}
            </text>
          </view>
          <text class="mt-[8rpx] block text-[24rpx] text-[#8c8c8c]">
            {{ t('companion.lastSeen', { time: agoText(dev.last_seen) }) }}{{ stats.state ? ` · ${stats.state}` : '' }}
          </text>
        </view>
        <view v-if="stats.mood" class="flex flex-col items-center">
          <text class="text-[56rpx]">
            {{ MOOD_EMOJI[stats.mood] || '🙂' }}
          </text>
          <text class="text-[22rpx] text-[#65686f]">
            {{ moodText(stats.mood) }}
          </text>
        </view>
      </view>

      <view v-if="!hasStats" class="mt-[20rpx] text-[24rpx] text-[#9d9ea3]">
        {{ t('companion.noStats') }}
      </view>

      <template v-else>
        <view v-if="stats.bond_score !== undefined" class="mt-[24rpx]">
          <view class="mb-[8rpx] flex justify-between text-[24rpx] text-[#65686f]">
            <text>{{ t('companion.bond', { level: stats.bond_level ?? 0 }) }}</text>
            <text>{{ stats.bond_score }}/100</text>
          </view>
          <wd-progress :percentage="bond" hide-text color="#336cff" />
        </view>

        <view class="mt-[24rpx] flex gap-[16rpx]">
          <view class="flex flex-1 flex-col items-center rounded-[16rpx] bg-[#f5f7fb] py-[18rpx]">
            <text class="text-[32rpx] text-[#232338] font-semibold">
              🔥 {{ stats.streak ?? 0 }}
            </text>
            <text class="text-[22rpx] text-[#8c8c8c]">
              {{ t('companion.streak') }}
            </text>
          </view>
          <view class="flex flex-1 flex-col items-center rounded-[16rpx] bg-[#f5f7fb] py-[18rpx]">
            <text class="text-[32rpx] text-[#232338] font-semibold">
              🍅 {{ stats.pomodoros_today ?? 0 }}
            </text>
            <text class="text-[22rpx] text-[#8c8c8c]">
              {{ t('companion.pomodorosToday') }}
            </text>
          </view>
          <view class="flex flex-1 flex-col items-center rounded-[16rpx] bg-[#f5f7fb] py-[18rpx]">
            <text class="text-[32rpx] text-[#232338] font-semibold">
              🔊 {{ stats.volume ?? '–' }}
            </text>
            <text class="text-[22rpx] text-[#8c8c8c]">
              {{ t('companion.volume') }}
            </text>
          </view>
        </view>

        <view v-if="highScores.length" class="mt-[20rpx] text-[24rpx] text-[#65686f]">
          🏆 {{ t('companion.highScores') }}:
          <text v-for="(hs, i) in highScores" :key="hs.key">
            {{ i ? ' · ' : ' ' }}{{ hs.name }} {{ hs.value }}
          </text>
        </view>
        <view v-if="lastTouch" class="mt-[8rpx] text-[24rpx] text-[#65686f]">
          👆 {{ t('companion.lastTouch', { time: lastTouch }) }}
        </view>
        <view v-if="stats.fw || stats.ip || stats.rssi" class="mt-[8rpx] text-[22rpx] text-[#9d9ea3]">
          <text v-if="stats.fw">
            {{ t('companion.firmware') }} {{ stats.fw }}
          </text>
          <text v-if="stats.ip">
            · {{ stats.ip }}
          </text>
          <text v-if="stats.rssi">
            · {{ t('companion.wifi') }} {{ stats.rssi }} dBm
          </text>
        </view>
      </template>
    </view>

    <!-- Weather and next prayer -->
    <view class="flex items-center gap-[24rpx] rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="text-[64rpx]">
        {{ weatherIcon }}
      </text>
      <view class="flex-1">
        <template v-if="weather?.ok">
          <view class="text-[28rpx] text-[#232338]">
            <text class="font-semibold">
              {{ weather.temp }}°
            </text>
            {{ weather.text }} · {{ weather.city }}
          </view>
          <view class="text-[22rpx] text-[#8c8c8c]">
            {{ t('companion.weatherLine', { hi: weather.hi ?? '–', lo: weather.lo ?? '–', rain: weather.rain_prob ?? 0 }) }}
          </view>
        </template>
        <view v-else class="text-[24rpx] text-[#9d9ea3]">
          {{ t('companion.weatherNone') }}
        </view>
        <view v-if="next" class="mt-[6rpx] text-[24rpx] text-[#65686f]">
          🕌 {{ t('companion.nextPrayer', { name: t(`companion.prayer.${next.key}`), time: next.time }) }}{{ next.tomorrow ? ` ${t('companion.tomorrowNote')}` : '' }}
        </view>
      </view>
    </view>

    <!-- Recent events -->
    <view class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[16rpx] block text-[30rpx] text-[#232338] font-semibold">
        {{ t('companion.events') }}
      </text>
      <view v-if="!events.length" class="py-[20rpx] text-center text-[24rpx] text-[#9d9ea3]">
        {{ t('companion.noEvents') }}
      </view>
      <view
        v-for="(e, i) in events"
        :key="`${e.type}-${e.ts}-${i}`"
        class="flex items-center justify-between border-b-[1rpx] border-b-[#f0f0f0] border-b-solid py-[16rpx] last:border-b-0"
      >
        <text class="flex-1 text-[26rpx] text-[#232338]">
          {{ eventText(e) }}
        </text>
        <text class="ml-[16rpx] text-[22rpx] text-[#9d9ea3]">
          {{ agoText(e.rx || e.ts) }}
        </text>
      </view>
      <view v-if="!moreEvents && (dev.events || []).length > 0" class="mt-[16rpx]">
        <wd-button size="small" plain block :loading="loadingMore" @click="showMore">
          {{ t('companion.showMoreEvents') }}
        </wd-button>
      </view>
    </view>
  </view>
</template>
