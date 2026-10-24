<script lang="ts" setup>
import type { CompanionConfigPatch, GeocodeResult } from '@/api/companion'
import { computed, ref } from 'vue'
import { geocodeCity } from '@/api/companion'
import { t } from '@/i18n'
import { nextPrayer, PRAYER_KEYS } from '../companionUtils.mjs'
import { notifyError, useCompanion } from './context'

defineOptions({
  name: 'CompanionPrayerPanel',
})

const { dev, save } = useCompanion()

const prayer = computed(() => dev.value?.prayer)
const days = computed(() => prayer.value?.days || [])
const next = computed(() => nextPrayer(days.value))

const query = ref('')
const searching = ref(false)
const searched = ref(false)
const results = ref<GeocodeResult[]>([])
const sameForWeather = ref(true)

async function setFlag(key: 'enabled' | 'remind', value: boolean) {
  if (dev.value)
    dev.value.prayer[key] = value // optimistic; replaced by the server response
  await save({ prayer: { [key]: value } })
}

async function search() {
  const q = query.value.trim()
  if (q.length < 2)
    return
  searching.value = true
  searched.value = false
  try {
    const res = await geocodeCity(q)
    results.value = res?.results || []
    searched.value = true
  }
  catch (error) {
    results.value = []
    notifyError(error)
  }
  finally {
    searching.value = false
  }
}

async function pick(r: GeocodeResult) {
  const loc = { city: r.name, lat: Number(r.lat), lon: Number(r.lon) }
  const patch: CompanionConfigPatch = { prayer: loc }
  if (sameForWeather.value)
    patch.weather = loc
  const ok = await save(patch, t('companion.prayer.citySet', { city: r.name }))
  if (ok) {
    results.value = []
    searched.value = false
    query.value = ''
  }
}

function place(r: GeocodeResult) {
  return [r.admin1, r.country].filter(Boolean).join(', ')
}
</script>

<template>
  <view v-if="dev && prayer" class="flex flex-col gap-[20rpx]">
    <view class="rounded-[20rpx] bg-white px-[28rpx] py-[8rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <view class="flex items-center justify-between py-[20rpx]">
        <text class="text-[28rpx] text-[#232338]">
          {{ t('companion.prayer.enable') }}
        </text>
        <wd-switch :model-value="prayer.enabled" size="20" @change="({ value }) => setFlag('enabled', !!value)" />
      </view>
      <view class="flex items-center justify-between border-t-[1rpx] border-t-[#f0f0f0] border-t-solid py-[20rpx]">
        <text class="text-[28rpx] text-[#232338]">
          {{ t('companion.prayer.remind') }}
        </text>
        <wd-switch :model-value="prayer.remind" size="20" :disabled="!prayer.enabled" @change="({ value }) => setFlag('remind', !!value)" />
      </view>
    </view>

    <view v-if="prayer.enabled && days.length" class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[16rpx] block text-[30rpx] text-[#232338] font-semibold">
        🕌 {{ t('companion.prayer.times', { city: prayer.city || '' }) }}
      </text>
      <view class="flex py-[10rpx] text-[22rpx] text-[#8c8c8c]">
        <text class="flex-1" />
        <text class="w-[180rpx] text-center">
          {{ t('companion.prayer.today') }} {{ days[0].date.slice(5) }}
        </text>
        <text v-if="days[1]" class="w-[180rpx] text-center">
          {{ t('companion.prayer.tomorrow') }} {{ days[1].date.slice(5) }}
        </text>
      </view>
      <view
        v-for="k in PRAYER_KEYS"
        :key="k"
        class="flex rounded-[10rpx] py-[14rpx] text-[28rpx]"
        :class="next && !next.tomorrow && next.key === k ? 'bg-[#eef3ff] text-[#336cff] font-semibold' : 'text-[#232338]'"
      >
        <text class="flex-1 pl-[12rpx]">
          {{ t(`companion.prayer.${k}`) }}
        </text>
        <text class="w-[180rpx] text-center">
          {{ days[0][k] }}
        </text>
        <text v-if="days[1]" class="w-[180rpx] text-center">
          {{ days[1][k] }}
        </text>
      </view>
      <text class="mt-[16rpx] block text-[22rpx] text-[#9d9ea3]">
        {{ t('companion.prayer.method') }}
      </text>
    </view>
    <view v-else-if="!prayer.enabled" class="rounded-[20rpx] bg-white p-[28rpx] text-center text-[24rpx] text-[#9d9ea3]">
      {{ t('companion.prayer.off') }}
    </view>

    <view class="rounded-[20rpx] bg-white p-[28rpx] shadow-[0_2rpx_12rpx_rgba(0,0,0,0.04)]">
      <text class="mb-[12rpx] block text-[30rpx] text-[#232338] font-semibold">
        {{ t('companion.prayer.changeCity') }}
      </text>
      <wd-search
        v-model="query"
        hide-cancel
        :placeholder="t('companion.prayer.searchPlaceholder')"
        custom-class="!p-0"
        @search="search"
      />
      <view class="mt-[16rpx]">
        <wd-button size="small" block :loading="searching" :disabled="query.trim().length < 2" @click="search">
          {{ t('companion.prayer.search') }}
        </wd-button>
      </view>
      <view class="mt-[16rpx] flex items-center justify-between">
        <text class="text-[26rpx] text-[#65686f]">
          {{ t('companion.prayer.sameForWeather') }}
        </text>
        <wd-switch v-model="sameForWeather" size="18" />
      </view>

      <view v-if="searched && !results.length" class="py-[20rpx] text-center text-[24rpx] text-[#9d9ea3]">
        {{ t('companion.prayer.noResults') }}
      </view>
      <view
        v-for="(r, i) in results"
        :key="`${r.name}-${r.lat}-${r.lon}-${i}`"
        class="flex items-center border-b-[1rpx] border-b-[#f0f0f0] border-b-solid py-[18rpx] last:border-b-0"
        @click="pick(r)"
      >
        <view class="flex-1">
          <text class="block text-[28rpx] text-[#232338]">
            {{ r.name }}
          </text>
          <text class="block text-[22rpx] text-[#8c8c8c]">
            {{ place(r) }} · {{ Number(r.lat).toFixed(2) }}, {{ Number(r.lon).toFixed(2) }}
          </text>
        </view>
        <wd-icon name="arrow-right" size="16" color="#bfbfbf" />
      </view>

      <text class="mt-[16rpx] block text-[22rpx] text-[#9d9ea3]">
        {{ t('companion.prayer.weatherCity', { city: dev.weather?.city || '–' }) }}
      </text>
    </view>
  </view>
</template>
