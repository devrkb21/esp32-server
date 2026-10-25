<script lang="ts" setup>
import type { CompanionConfigPatch, GeocodeResult } from '@/api/companion'
import { computed, ref } from 'vue'
import { geocodeCity } from '@/api/companion'
import { t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { nextPrayer, PRAYER_KEYS } from '@/utils/companionUtils.mjs'
import { useDay } from '../dayContext'

// Prayer times: on/off and remind save at once ({ prayer: {...} }); a city from the search sets
// { prayer: { city, lat, lon } }, and the weather city too when asked (legacy patches).
const day = useDay()
const prayer = computed<any>(() => day.view?.prayer || {})
const days = computed<any[]>(() => (prayer.value.days || []).slice(0, 2))
const upcoming = computed(() => nextPrayer(prayer.value.days || []) as { key: string, time: string, tomorrow: boolean } | null)

const query = ref('')
const searching = ref(false)
const searched = ref(false)
const results = ref<GeocodeResult[]>([])
const sameForWeather = ref(true)

function isNext(k: string, col: number) {
  const n = upcoming.value
  return !!n && n.key === k && (col === 1) === n.tomorrow
}
function shortDate(iso: string) {
  const [, m, d] = String(iso || '').split('-')
  return m && d ? digits(`${Number(d)}/${Number(m)}`, day.lang()) : ''
}

async function setFlag(key: 'enabled' | 'remind', value: boolean) {
  if (day.view?.prayer)
    day.view.prayer[key] = value // optimistic; replaced by the server's answer
  await day.save({ prayer: { [key]: value } }, 'prayer')
}

async function search() {
  const q = query.value.trim()
  if (q.length < 2) {
    searched.value = false
    return
  }
  searching.value = true
  searched.value = false
  try {
    const res = await geocodeCity(q)
    results.value = res?.results || []
    searched.value = true
  }
  catch {
    results.value = []
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
  if (await day.save(patch, 'prayer', t('day.prayer.citySet', { city: r.name }))) {
    results.value = []
    searched.value = false
    query.value = ''
  }
}

function place(r: GeocodeResult) {
  const where = [r.admin1, r.country].filter(Boolean).join(', ')
  return `${where}${where ? ', ' : ''}${Number(r.lat).toFixed(2)}, ${Number(r.lon).toFixed(2)}`
}

function focusKey(key: string) { return key.startsWith('p-') }
defineExpose({ focusKey })
</script>

<template>
  <tb-section :title="t('day.tab.prayer')" :description="t('day.prayer.desc')" ink="prayer">
    <template #actions>
      <tb-sync v-bind="day.syncOf('prayer')" />
    </template>

    <view class="dswitches">
      <tb-switch :model-value="!!prayer.enabled" :disabled="!!day.saving.prayer" :label="t('day.prayer.enable')" @change="(v: boolean) => setFlag('enabled', v)" />
      <tb-switch :model-value="!!prayer.remind" :disabled="!!day.saving.prayer || !prayer.enabled" :label="t('day.prayer.remind')" @change="(v: boolean) => setFlag('remind', v)" />
    </view>

    <template v-if="prayer.enabled && days.length">
      <view class="dprayer" role="table" :aria-label="t('day.tab.prayer')">
        <view class="dprayer__row dprayer__row--head" role="row">
          <text class="dprayer__name" role="columnheader">
            {{ prayer.city || '' }}
          </text>
          <view v-for="(d, i) in days" :key="d.date || i" class="dprayer__col" role="columnheader">
            <text>{{ i === 0 ? t('day.prayer.today') : t('day.prayer.tomorrow') }}</text>
            <text class="dprayer__date">
              {{ shortDate(d.date) }}
            </text>
          </view>
        </view>
        <view v-for="k in PRAYER_KEYS" :key="k" class="dprayer__row" :class="{ 'is-sun': k === 'sunrise', 'is-next': isNext(k, 0) }" role="row">
          <text class="dprayer__name" role="rowheader">
            {{ t(`day.prayer.${k}`) }}
          </text>
          <text v-for="(d, i) in days" :key="d.date || i" class="dprayer__col tb-num dprayer__t" :class="{ 'is-next': isNext(k, i) }" role="cell">
            {{ d[k] ? day.fmt(d[k]) : '–' }}
          </text>
        </view>
      </view>
      <text v-if="upcoming" class="dnote dnote--strong">
        {{ t(upcoming.tomorrow ? 'day.prayer.nextTomorrow' : 'day.prayer.nextLine', { name: t(`day.prayer.${upcoming.key}`), time: day.fmt(upcoming.time) }) }}
      </text>
      <text class="dnote">
        {{ t('day.prayer.methodHint') }}
      </text>
    </template>
    <text v-else-if="prayer.enabled" class="dnote">
      {{ t('day.prayer.noTimes') }}
    </text>
    <text v-else class="dnote">
      {{ t('day.prayer.offNote') }}
    </text>

    <view class="dcity">
      <text class="dsub">
        {{ t('day.prayer.changeCity') }}
      </text>
      <view class="dcity__search">
        <tb-input
          v-model="query" class="dcity__in" icon="search" clearable confirm-type="search" :placeholder="t('day.prayer.cityPlaceholder')"
          :aria-label="t('day.prayer.changeCity')" @confirm="search"
        />
        <tb-button :loading="searching" :disabled="query.trim().length < 2" @click="search">
          {{ t('common.search') }}
        </tb-button>
      </view>
      <text v-if="query.trim().length === 1" class="dnote">
        {{ t('day.prayer.queryTooShort') }}
      </text>
      <text v-if="searched && !results.length && !searching" class="dnote">
        {{ t('day.prayer.noResults') }}
      </text>
      <view v-if="results.length" class="drows">
        <view v-for="(r, i) in results" :key="`${r.name}-${r.lat}-${r.lon}-${i}`" class="drow" role="button" hover-class="is-press" @click="pick(r)">
          <view class="drow__body">
            <text class="drow__title">
              {{ r.name }}
            </text>
            <text class="drow__meta tb-num">
              {{ place(r) }}
            </text>
          </view>
          <tb-icon name="chevron-right" :size="18" />
        </view>
      </view>
      <tb-switch v-model="sameForWeather" :label="t('day.prayer.sameForWeather')" />
      <view class="dcities">
        <text>
          {{ t('day.prayer.city') }}: <text class="dcities__v">
            {{ prayer.city || '–' }}
          </text>
        </text>
        <text>
          {{ t('day.prayer.weatherCity') }}: <text class="dcities__v">
            {{ day.view?.weather?.city || '–' }}
          </text>
        </text>
      </view>
    </view>
  </tb-section>
</template>

<style lang="scss">
.dprayer {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--tb-rule);
}
.dprayer__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  border-top: 1px solid var(--tb-rule-soft);
}
.dprayer__row--head {
  border-top: 1px solid var(--tb-rule);
  min-height: 48px;
  font-size: 13px;
  color: var(--tb-ink-2);
  font-weight: 600;
}
.dprayer__name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: var(--tb-prayer);
  overflow-wrap: anywhere;
}
.dprayer__row--head .dprayer__name {
  color: var(--tb-ink);
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 15px;
}
.dprayer__col {
  width: 86px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
.dprayer__date {
  font-size: 12px;
  font-weight: 400;
}
.dprayer__t {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 17px;
}
.dprayer__t + .dprayer__t {
  color: var(--tb-ink-2);
}
.dprayer__row.is-sun .dprayer__name {
  color: var(--tb-ink-2);
  font-weight: 400;
}
.dprayer__row.is-sun .dprayer__t {
  font-weight: 400;
  color: var(--tb-ink-2);
}
.dprayer__t.is-next {
  color: var(--tb-action);
}
.dprayer__row.is-next {
  border-top: 2px solid var(--tb-orange);
}
.dcity {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 6px;
}
.dcity__search {
  display: flex;
  gap: 8px;
}
.dcity__in {
  flex: 1;
  min-width: 0;
}
.dcities {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  color: var(--tb-ink-2);
}
.dcities__v {
  color: var(--tb-ink);
  font-weight: 600;
}
</style>
