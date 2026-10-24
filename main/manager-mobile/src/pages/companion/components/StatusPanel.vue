<script lang="ts" setup>
import type { CompanionEvent } from '@/api/companion'
import { computed, ref, watch } from 'vue'
import { getCompanionEvents } from '@/api/companion'
import { t } from '@/i18n'
import { nextPrayer } from '../companionUtils.mjs'
import { agoText, notifyError, useCompanion, WEATHER_EMOJI } from './context'
import LiveScreen from './LiveScreen.vue'

defineOptions({
  name: 'CompanionStatusPanel',
})

const { dev, deviceId } = useCompanion()

const stats = computed(() => dev.value?.stats || {})
const hasStats = computed(() => Object.keys(stats.value).length > 0)
const hasDeviceInfo = computed(() => !!(stats.value.fw || stats.value.ip || stats.value.rssi))

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
  <view v-if="dev">
    <!-- The robot's real screen (self.screen.preview), polled while shown -->
    <LiveScreen :device-id="deviceId" />

    <!-- Today: weather and next prayer -->
    <view class="nx-group">
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-icon-tile nx-icon-tile--neutral status__weather-icon" aria-hidden="true">
            {{ weatherIcon }}
          </view>
          <view class="nx-row__main">
            <template v-if="weather?.ok">
              <view class="nx-row__title nx-truncate">
                <text class="nx-num status__temp">
                  {{ weather.temp }}°
                </text>
                {{ weather.text }} · {{ weather.city }}
              </view>
              <view class="nx-row__subtitle nx-num">
                {{ t('companion.weatherLine', { hi: weather.hi ?? '–', lo: weather.lo ?? '–', rain: weather.rain_prob ?? 0 }) }}
              </view>
            </template>
            <view v-else class="nx-row__subtitle">
              {{ t('companion.weatherNone') }}
            </view>
          </view>
        </view>
        <view v-if="next" class="nx-row">
          <view class="nx-icon-tile status__row-icon">
            <wd-icon name="time" size="18px" />
          </view>
          <view class="nx-row__main nx-row__title">
            {{ t('companion.nextPrayer', { name: t(`companion.prayer.${next.key}`), time: next.time }) }}
            <text v-if="next.tomorrow" class="nx-caption">
              {{ t('companion.tomorrowNote') }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- Activity -->
    <view v-if="hasStats" class="nx-group">
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.pomodorosToday') }}
          </view>
          <view class="nx-num nx-row__value">
            {{ stats.pomodoros_today ?? 0 }}
          </view>
        </view>
        <view class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.volume') }}
          </view>
          <view class="nx-row__value nx-num">
            {{ stats.volume ?? '–' }}
          </view>
        </view>
        <view v-if="lastTouch" class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.lastTouch', { time: lastTouch }) }}
          </view>
        </view>
        <view v-if="highScores.length" class="nx-row status__scores">
          <view class="nx-row__title">
            {{ t('companion.highScores') }}
          </view>
          <view class="status__chips">
            <view v-for="hs in highScores" :key="hs.key" class="nx-badge">
              {{ hs.name }} <text class="nx-num">
                {{ hs.value }}
              </text>
            </view>
          </view>
        </view>
      </view>
      <view v-if="stats.state" class="nx-group__footer">
        {{ stats.state }}
      </view>
    </view>

    <!-- Device info -->
    <view v-if="hasDeviceInfo" class="nx-group">
      <view class="nx-group__body">
        <view v-if="stats.fw" class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.firmware') }}
          </view>
          <view class="nx-row__value nx-truncate nx-mono">
            {{ stats.fw }}
          </view>
        </view>
        <view v-if="stats.ip" class="nx-row">
          <view class="nx-row__main nx-row__title">
            IP
          </view>
          <view class="nx-row__value nx-mono nx-truncate">
            {{ stats.ip }}
          </view>
        </view>
        <view v-if="stats.rssi" class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.wifi') }}
          </view>
          <view class="nx-row__value nx-num">
            {{ stats.rssi }} dBm
          </view>
        </view>
      </view>
    </view>

    <!-- Recent events -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.events') }}
      </view>
      <view class="nx-group__body">
        <view v-if="!events.length" class="nx-row">
          <view class="nx-row__main nx-row__subtitle status__none">
            {{ t('companion.noEvents') }}
          </view>
        </view>
        <view v-for="(e, i) in events" :key="`${e.type}-${e.ts}-${i}`" class="nx-row">
          <view class="nx-row__main nx-row__title status__event">
            {{ eventText(e) }}
          </view>
          <view class="nx-caption nx-num status__when">
            {{ agoText(e.rx || e.ts) }}
          </view>
        </view>
        <view
          v-if="!moreEvents && (dev.events || []).length > 0"
          class="nx-row nx-row--tap cmp-add-row status__more"
          role="button"
          @click="showMore"
        >
          <wd-loading v-if="loadingMore" size="16px" />
          <text>{{ t('companion.showMoreEvents') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.status {
  &__weather-icon {
    font-size: var(--nx-text-title);
  }

  &__row-icon {
    width: 72rpx;
    height: 72rpx;
  }

  &__temp {
    margin-right: 8rpx;
    font-weight: 600;
  }

  &__scores {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nx-space-2);
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nx-space-1);
  }

  &__event {
    font-size: var(--nx-text-callout);
    overflow-wrap: anywhere;
  }

  &__when {
    flex: none;
  }

  &__none {
    text-align: center;
    color: var(--nx-text-3);
  }

  &__more {
    justify-content: center;
    gap: var(--nx-space-1);
  }
}
</style>
