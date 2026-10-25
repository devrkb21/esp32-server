<template>
  <TbSection :title="$t('day.tab.prayer')" :description="$t('day.prayer.desc')" ink="prayer">
    <template #actions><TbSync v-bind="day.syncOf('prayer')" /></template>

    <div class="day-prayer">
      <div class="day-prayer__main">
        <div class="day-switches">
          <TbSwitch :model-value="!!prayer.enabled" :disabled="!!day.saving.prayer" :label="$t('day.prayer.enable')" @change="(v) => savePrayer({ enabled: v })" />
          <TbSwitch :model-value="!!prayer.remind" :disabled="!!day.saving.prayer" :label="$t('day.prayer.remind')" @change="(v) => savePrayer({ remind: v })" />
        </div>
        <dl class="day-prayer__cities">
          <div><dt>{{ $t('day.prayer.city') }}</dt><dd>{{ prayer.city || '–' }}</dd></div>
          <div><dt>{{ $t('day.prayer.weatherCity') }}</dt><dd>{{ weather.city || '–' }}</dd></div>
        </dl>

        <template v-if="prayer.enabled && days.length">
          <div ref="table" class="day-prayer__scroll">
            <!-- phones: the same times turned on their side, one prayer per row -->
            <table class="day-prayer__table day-prayer__table--tall">
              <caption class="tb-visually-hidden">{{ $t('day.tab.prayer') }}</caption>
              <thead>
                <tr>
                  <th scope="col"><span class="tb-visually-hidden">{{ $t('day.prayer.dayCol') }}</span></th>
                  <th v-for="(d, i) in days.slice(0, 2)" :key="d.date || i" scope="col">
                    {{ i === 0 ? $t('day.prayer.today') : $t('day.prayer.tomorrow') }}<small>{{ shortDate(d.date) }}</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="k in PRAYER_ROWS" :key="k" :class="{ 'is-next': isNext(k), 'is-sun': k === 'sunrise' }">
                  <th scope="row">{{ $t(`day.prayer.${k}`) }}</th>
                  <td v-for="(d, i) in days.slice(0, 2)" :key="d.date || i" :class="{ 'is-next': i === 0 && isNext(k) }">{{ d[k] ? day.fmt(d[k]) : '–' }}</td>
                </tr>
              </tbody>
            </table>
            <table class="day-prayer__table day-prayer__table--wide">
              <caption class="tb-visually-hidden">{{ $t('day.tab.prayer') }}</caption>
              <thead>
                <tr>
                  <th scope="col"><span class="tb-visually-hidden">{{ $t('day.prayer.dayCol') }}</span></th>
                  <th v-for="k in PRAYER_ROWS" :key="k" scope="col" :class="{ 'is-next': isNext(k), 'is-sun': k === 'sunrise' }">
                    {{ $t(`day.prayer.${k}`) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(d, i) in days.slice(0, 2)" :key="d.date || i">
                  <th scope="row">{{ i === 0 ? $t('day.prayer.today') : $t('day.prayer.tomorrow') }}<small>{{ shortDate(d.date) }}</small></th>
                  <td v-for="k in PRAYER_ROWS" :key="k" :class="{ 'is-next': i === 0 && isNext(k), 'is-sun': k === 'sunrise' }">
                    {{ d[k] ? day.fmt(d[k]) : '–' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="upcoming && !upcoming.tomorrow" class="day-note">{{ $t('day.prayer.nextLine', { name: $t(`day.prayer.${upcoming.key}`), time: day.fmt(upcoming.time) }) }}</p>
          <p class="day-note">{{ $t('day.prayer.methodHint') }}</p>
        </template>
        <p v-else-if="prayer.enabled" class="day-note">{{ $t('day.prayer.noTimes') }}</p>
        <p v-else class="day-note">{{ $t('day.prayer.offNote') }}</p>
      </div>

      <div class="day-prayer__city">
        <h3 class="day-subtitle">{{ $t('day.prayer.changeCity') }}</h3>
        <form class="day-prayer__search" role="search" @submit.prevent="searchCity">
          <TbInput v-model="query" icon="search" clearable :placeholder="$t('day.prayer.cityPlaceholder')" :aria-label="$t('day.prayer.changeCity')" />
          <TbButton native-type="submit" :loading="searching">{{ $t('common.search') }}</TbButton>
        </form>
        <TbCheckbox v-model="sameWeather" :label="$t('day.prayer.sameForWeather')" />
        <p v-if="searched && !results.length && !searching" class="day-note">{{ $t('day.prayer.noResults') }}</p>
        <ul v-if="results.length" class="day-cities">
          <li v-for="(r, i) in results" :key="i">
            <button type="button" class="day-city" :disabled="!!day.saving.prayer" @click="chooseCity(r)">
              <span class="day-city__text"><b>{{ r.name }}</b><small>{{ cityDetail(r) }}</small></span>
              <TbIcon name="chevron-right" :size="18" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  </TbSection>
</template>

<script>
import Api from '@/apis/api';
import { PRAYER_ROWS, nextPrayer } from '@/utils/companion.mjs';

// Prayer times: on/off and remind save at once ({ prayer: {...} }); a city from the search
// sets { prayer: { city, lat, lon } }, and the weather city too when asked (legacy patches).
export default {
  name: 'DayPrayer',
  inject: ['day'],
  data() {
    return { PRAYER_ROWS, query: '', results: [], searching: false, searched: false, sameWeather: true };
  },
  computed: {
    prayer() { return (this.day.view && this.day.view.prayer) || {}; },
    weather() { return (this.day.view && this.day.view.weather) || {}; },
    days() { return Array.isArray(this.prayer.days) ? this.prayer.days : []; },
    upcoming() { return nextPrayer(this.days, new Date(this.day.now)); },
  },
  methods: {
    isNext(k) { return !!(this.upcoming && !this.upcoming.tomorrow && this.upcoming.key === k); },
    shortDate(date) {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
      const [y, m, d] = date.split('-').map(Number);
      const loc = this.day.lang === 'bn' ? 'bn-BD' : String(this.day.lang || 'en').replace('_', '-');
      try { return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d)); } catch (e) { return date.slice(5); }
    },
    savePrayer(patch) {
      this.day.save({ prayer: patch }, 'prayer').catch(() => {});
    },
    searchCity() {
      const query = (this.query || '').trim();
      if (query.length < 2) { this.$message.warning(this.$t('day.prayer.queryTooShort')); return; }
      this.searching = true;
      Api.companion.geocodeCity(query, (res) => {
        this.searching = false; this.searched = true;
        const data = (res.data && res.data.data) || {};
        this.results = Array.isArray(data.results) ? data.results : [];
      }, (err) => {
        this.searching = false; this.searched = true; this.results = [];
        this.$message.error(this.day.errorText(err));
      });
    },
    chooseCity(result) {
      const location = { city: result.name, lat: Number(result.lat), lon: Number(result.lon) };
      const patch = { prayer: location };
      if (this.sameWeather) patch.weather = { ...location };
      this.day.save(patch, 'prayer', this.$t('day.prayer.citySet', { city: result.name }))
        .then(() => { this.results = []; this.searched = false; this.query = ''; })
        .catch(() => {});
    },
    cityDetail(r) {
      const place = [r.admin1, r.country].filter(Boolean).join(', ');
      const coords = Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon))
        ? `${Number(r.lat).toFixed(2)}, ${Number(r.lon).toFixed(2)}` : '';
      return [place, coords].filter(Boolean).join(', ');
    },
    focusKey(key) {
      this.day.reveal(this.$refs.table);
      return !!this.$refs.table && /^p-/.test(key);
    },
  },
};
</script>

<style>
.day-prayer { display: grid; gap: var(--tb-s8); grid-template-columns: minmax(0, 1fr); }
.day-prayer__main { display: grid; gap: var(--tb-s4); align-content: start; min-width: 0; }
.day-switches { display: flex; flex-wrap: wrap; gap: 4px var(--tb-s6); }
.day-prayer__cities { margin: 0; display: flex; flex-wrap: wrap; gap: 4px var(--tb-s6); font-size: var(--tb-fs-14); }
.day-prayer__cities div { display: flex; gap: 8px; }
.day-prayer__cities dt { color: var(--tb-ink-2); }
.day-prayer__cities dd { margin: 0; font-weight: 600; }
.day-prayer__scroll { overflow-x: auto; border-top: var(--tb-rule-band) solid var(--tb-prayer); }
.day-prayer__table { width: 100%; min-width: 330px; }
.day-prayer__table th, .day-prayer__table td { padding: 10px 6px; text-align: center; border-bottom: 1px solid var(--tb-rule); white-space: nowrap; }
.day-prayer__table thead th { font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-prayer); border-bottom-color: var(--tb-rule-soft); }
.day-prayer__table tbody th { text-align: left; font-size: var(--tb-fs-14); font-weight: 600; padding-left: 0; }
.day-prayer__table tbody th small { display: block; font-size: var(--tb-fs-12); font-weight: 400; color: var(--tb-ink-2); }
.day-prayer__table td { font-family: var(--tb-font-display); font-weight: 700; font-size: var(--tb-fs-18); }
.day-prayer__table .is-sun { color: var(--tb-ink-2); }
.day-prayer__table thead th.is-sun { color: var(--tb-ink-2); }
.day-prayer__table thead th.is-next { border-top: 2px solid var(--tb-orange); }
.day-prayer__table td.is-next { color: var(--tb-action); }
.day-prayer__city { display: grid; gap: var(--tb-s3); align-content: start; min-width: 0; }
.day-subtitle { font-size: var(--tb-fs-16); }
.day-prayer__search { display: flex; gap: 8px; }
.day-prayer__search .tb-input { flex: 1; min-width: 0; }
.day-cities { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule); }
.day-city {
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 6px 0;
  border: 0; border-bottom: 1px solid var(--tb-rule-soft); background: none; text-align: left; color: inherit;
}
.day-city:hover:not(:disabled) { background: var(--tb-paper-2); }
.day-city__text { flex: 1; min-width: 0; display: grid; }
.day-city__text small { color: var(--tb-ink-2); font-size: var(--tb-fs-12); }
@media (min-width: 1000px) {
  .day-prayer { grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr); }
}
.day-prayer__table--tall { display: none; }
.day-prayer__table--tall thead th { color: var(--tb-ink); font-size: var(--tb-fs-14); }
.day-prayer__table--tall thead th small { display: block; font-weight: 400; font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.day-prayer__table--tall tbody th { color: var(--tb-prayer); }
.day-prayer__table--tall tr.is-sun th { color: var(--tb-ink-2); }
.day-prayer__table--tall tr.is-next th { color: var(--tb-action); }
.day-prayer__table--tall tr.is-next > * { border-top: 2px solid var(--tb-orange); }
@media (max-width: 560px) {
  .day-prayer__table--wide { display: none; }
  .day-prayer__table--tall { display: table; min-width: 0; }
}
</style>
