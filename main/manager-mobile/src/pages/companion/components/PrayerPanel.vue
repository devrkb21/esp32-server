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

/** Translate with an English fallback for keys still waiting in src/i18n/_pending */
function tx(key: string, fallback: string) {
  const text = t(key)
  return text === key ? fallback : text
}

function place(r: GeocodeResult) {
  return [r.admin1, r.country].filter(Boolean).join(', ')
}
</script>

<template>
  <view v-if="dev && prayer">
    <view class="nx-group">
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.prayer.enable') }}
          </view>
          <wd-switch :model-value="prayer.enabled" size="24px" @change="({ value }) => setFlag('enabled', !!value)" />
        </view>
        <view class="nx-row">
          <view class="nx-row__main nx-row__title" :class="{ prayer__muted: !prayer.enabled }">
            {{ t('companion.prayer.remind') }}
          </view>
          <wd-switch :model-value="prayer.remind" size="24px" :disabled="!prayer.enabled" @change="({ value }) => setFlag('remind', !!value)" />
        </view>
      </view>
    </view>

    <view v-if="prayer.enabled && days.length" class="nx-group">
      <view class="nx-group__header nx-truncate">
        {{ t('companion.prayer.times', { city: prayer.city || '' }) }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row nx-num prayer__head">
          <view class="nx-row__main" />
          <view class="prayer__col">
            {{ t('companion.prayer.today') }} {{ days[0].date.slice(5) }}
          </view>
          <view v-if="days[1]" class="prayer__col">
            {{ t('companion.prayer.tomorrow') }} {{ days[1].date.slice(5) }}
          </view>
        </view>
        <view
          v-for="k in PRAYER_KEYS"
          :key="k"
          class="nx-row prayer__row"
          :class="{ 'is-next': next && !next.tomorrow && next.key === k }"
        >
          <view class="nx-row__main prayer__name">
            <text>{{ t(`companion.prayer.${k}`) }}</text>
            <view v-if="next && !next.tomorrow && next.key === k" class="nx-badge nx-badge--accent">
              {{ tx('companion.prayer.next', 'Next') }}
            </view>
          </view>
          <view class="prayer__col nx-num prayer__time">
            {{ days[0][k] }}
          </view>
          <view v-if="days[1]" class="prayer__col prayer__time nx-num prayer__time--later" :class="{ 'is-next': next && next.tomorrow && next.key === k }">
            {{ days[1][k] }}
          </view>
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('companion.prayer.method') }}
      </view>
    </view>
    <view v-else-if="!prayer.enabled" class="nx-group">
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-row__main nx-row__subtitle prayer__off">
            {{ t('companion.prayer.off') }}
          </view>
        </view>
      </view>
    </view>

    <!-- City -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.prayer.changeCity') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row prayer__search">
          <wd-input
            v-model="query"
            prefix-icon="search"
            clearable
            no-border
            confirm-type="search"
            :placeholder="t('companion.prayer.searchPlaceholder')"
            custom-class="prayer__input"
            @confirm="search"
          />
          <view
            class="cmp-pill"
            :class="{ prayer__disabled: query.trim().length < 2 }"
            role="button"
            @click="search"
          >
            <wd-loading v-if="searching" size="14px" />
            <text v-else>
              {{ t('companion.prayer.search') }}
            </text>
          </view>
        </view>

        <view v-if="searched && !results.length" class="nx-row">
          <view class="nx-row__main nx-row__subtitle prayer__off">
            {{ t('companion.prayer.noResults') }}
          </view>
        </view>
        <view
          v-for="(r, i) in results"
          :key="`${r.name}-${r.lat}-${r.lon}-${i}`"
          class="nx-row nx-row--tap"
          @click="pick(r)"
        >
          <view class="nx-row__main">
            <view class="nx-row__title nx-truncate">
              {{ r.name }}
            </view>
            <view class="nx-row__subtitle nx-truncate nx-num">
              {{ place(r) }} · {{ Number(r.lat).toFixed(2) }}, {{ Number(r.lon).toFixed(2) }}
            </view>
          </view>
          <wd-icon name="arrow-right" size="16px" custom-class="nx-row__chevron" />
        </view>

        <view class="nx-row">
          <view class="nx-row__main nx-row__title">
            {{ t('companion.prayer.sameForWeather') }}
          </view>
          <wd-switch v-model="sameForWeather" size="22px" />
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('companion.prayer.weatherCity', { city: dev.weather?.city || '–' }) }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.prayer {
  &__muted {
    color: var(--nx-text-3);
  }

  &__head {
    min-height: 0;
    padding-top: var(--nx-space-2);
    padding-bottom: var(--nx-space-2);
    font-size: var(--nx-text-caption);
    font-weight: 500;
    color: var(--nx-text-3);
  }

  &__col {
    flex: none;
    width: 160rpx;
    text-align: right;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: var(--nx-space-1);
    color: var(--nx-text);
  }

  &__time {
    font-size: var(--nx-text-body);
    color: var(--nx-text);

    &--later {
      color: var(--nx-text-3);
    }

    &.is-next {
      color: var(--nx-accent);
      font-weight: 600;
    }
  }

  &__row.is-next {
    background: var(--nx-accent-soft);

    .prayer__name,
    .prayer__time:not(.prayer__time--later) {
      color: var(--nx-accent);
      font-weight: 600;
    }
  }

  &__off {
    text-align: center;
    color: var(--nx-text-3);
  }

  &__search {
    gap: var(--nx-space-2);
  }

  &__disabled {
    opacity: 0.5;
  }
}

:deep(.prayer__input) {
  flex: 1;
  min-width: 0;
  padding: var(--nx-space-1) var(--nx-space-2);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);
}
</style>
