<template>
  <div class="today">
    <TbMonthBand :date="date" :lang="lang" sticky />

    <div v-if="!robot.deviceId && robot.loaded" class="today__none">
      <TbEmpty face="confused" :title="$t('common.noRobot')" :text="$t('common.noRobotText')">
        <TbButton variant="primary" to="/robots" icon="robots">{{ $t('common.goRobots') }}</TbButton>
      </TbEmpty>
    </div>

    <div v-else class="today__grid">
      <section class="today__hero" :aria-label="$t('today.heroLabel')">
        <TbDateBlock class="today__date" :date="date" :lang="lang" :extra="sunrise" @turn="turn" />
        <div class="today__bot">
          <TbFace :mood="faceMood" :pulse="pulse" :alt="$t('today.faceAlt', { name: botName })" />
          <TbNamePlate :name="botName" :doing="doingNow" :detail="together" :state="state" :state-text="$t(`today.state.${state}`)" />
        </div>
      </section>

      <section class="today__act" :aria-label="$t('today.actLabel')">
        <form class="today__say" @submit.prevent="say">
          <label class="tb-visually-hidden" for="today-say">{{ $t('today.sayLabel') }}</label>
          <TbInput id="today-say" v-model="line" :placeholder="$t('today.sayPlaceholder')" :maxlength="200" size="l" />
          <TbButton variant="primary" size="l" native-type="submit" :loading="sending" :disabled="!line.trim()">{{ $t('today.sayButton') }}</TbButton>
        </form>
        <p v-if="state === 'offline'" class="today__note">{{ $t('today.offlineNote') }}</p>
        <div class="today__deck" role="group" :aria-label="$t('today.deckLabel')">
          <TbButton v-for="c in commands" :key="c.type" :icon="c.icon" :loading="busy === c.type" @click="run(c)">{{ $t(c.label) }}</TbButton>
        </div>
      </section>

      <section class="today__day" :aria-labelledby="'today-day-h'">
        <header class="today__dayhead">
          <h2 id="today-day-h">{{ isToday ? $t('today.dayTitle') : $t('today.dayTitleOther') }}</h2>
          <span class="today__dayhint">{{ $t('today.dayHint') }}</span>
        </header>
        <TbDayTable :rows="rows" :lang="lang" :now-minutes="isToday ? nowMinutes : -1" :now-label="$t('common.now')"
          :caption="$t('today.dayTitle')" :empty-text="loading ? $t('common.loading') : $t('today.dayEmpty')" clickable @select="openRow" />
        <p v-if="failed" class="today__fail" role="alert">{{ $t('common.loadFailed') }}
          <TbButton size="s" variant="quiet" icon="refresh" @click="refresh()">{{ $t('common.retry') }}</TbButton></p>
      </section>

      <aside class="today__side">
        <section v-if="weather" class="today__weather" :aria-label="$t('today.weatherLabel')">
          <TbIcon name="weather" :size="22" />
          <p><b class="tb-num">{{ num(weather.temp) }}°</b> {{ weather.text || '' }}<small v-if="weather.city">{{ weather.city }}</small></p>
        </section>
        <nav class="today__more" :aria-label="$t('today.moreLabel')">
          <RouterLink to="/day" class="today__link" style="--ink: var(--tb-alarm)"><TbIcon name="alarm" /><span>{{ $t('today.linkDay') }}</span><TbIcon name="chevron-right" :size="16" /></RouterLink>
          <RouterLink to="/messages" class="today__link" style="--ink: var(--tb-message)"><TbIcon name="message" /><span>{{ $t('today.linkMessages') }}</span><TbIcon name="chevron-right" :size="16" /></RouterLink>
          <RouterLink to="/look" class="today__link" style="--ink: var(--tb-look)"><TbIcon name="look" /><span>{{ $t('today.linkLook') }}</span><TbIcon name="chevron-right" :size="16" /></RouterLink>
          <RouterLink to="/role-config" class="today__link"><TbIcon name="agent" /><span>{{ $t('today.linkCharacter') }}</span><TbIcon name="chevron-right" :size="16" /></RouterLink>
        </nav>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { digits, timeText } from '@/kit/calendar';
import { deviceIdFrom, loadRobots, robot } from '@/shell/robot';
import { dayRows, daysTogether, isoDate, robotState } from './todayModel';

const { t, locale } = useI18n({ useScope: 'global' });
const route = useRoute();
const router = useRouter();
const store = useStore();
const lang = computed(() => locale.value);
const num = (n) => digits(n ?? '–', lang.value);

const offset = ref(0);
const clock = ref(new Date());
const date = computed(() => { const d = new Date(clock.value); d.setDate(d.getDate() + offset.value); return d; });
const isToday = computed(() => offset.value === 0);
const nowMinutes = computed(() => clock.value.getHours() * 60 + clock.value.getMinutes());

const view = ref(null);
const loading = ref(false);
const failed = ref(false);
const line = ref('');
const sending = ref(false);
const pulse = ref(false);
const busy = ref('');

const deviceId = computed(() => deviceIdFrom(route));
const botName = computed(() => view.value?.name || robot.name || t('nav.robotFallback'));
const state = computed(() => robotState(view.value, clock.value));
const faceMood = computed(() => ({ offline: 'offline', sleeping: 'sleepy' }[state.value] || 'awake'));
const doingNow = computed(() => {
  const a = view.value?.stats?.activity;
  return a ? t(`today.activity.${a}`) : (state.value === 'online' ? t('today.free') : '');
});
const together = computed(() => { const n = daysTogether(view.value); return n ? t('today.daysTogether', { n: num(n) }) : ''; });
const sunrise = computed(() => {
  const d = (view.value?.prayer?.days || []).find((x) => x.date === isoDate(date.value));
  return d?.sunrise ? t('today.sunrise', { time: timeText(d.sunrise, lang.value, lang.value === 'bn') }) : '';
});
const weather = computed(() => (view.value?.weather?.ok ? view.value.weather : null));
const rows = computed(() => dayRows(view.value, date.value, (k, p) => {
  if (p && p.time) p = { ...p, time: timeText(p.time, lang.value, lang.value === 'bn') };
  return t(k, p || {});
}));

const commands = [
  { type: 'story', icon: 'story', label: 'today.cmd.story' },
  { type: 'lullaby', icon: 'lullaby', label: 'today.cmd.lullaby' },
  { type: 'pomodoro', icon: 'focus', label: 'today.cmd.focus', arg: 25 },
  { type: 'game', icon: 'game', label: 'today.cmd.game', arg: 'catch' },
  { type: 'breathe', icon: 'breathe', label: 'today.cmd.breathe' },
  { type: 'night_light', icon: 'light', label: 'today.cmd.light' },
];

function refresh(quiet = false) {
  if (!deviceId.value) return;
  if (!quiet) loading.value = true;
  Api.companion.getCompanion(deviceId.value, (res) => {
    view.value = res.data.data; loading.value = false; failed.value = false;
  }, () => { loading.value = false; failed.value = true; });
}

function say() {
  const text = line.value.trim();
  if (!text || !deviceId.value) return;
  sending.value = true;
  const from = store.getters.getUserInfo?.realName || store.getters.getUserInfo?.username || '';
  Api.companion.sendCompanionMessage(deviceId.value, { from, text, ask: false }, () => {
    sending.value = false; line.value = '';
    pulse.value = false; requestAnimationFrame(() => { pulse.value = true; });
    toast.success(state.value === 'offline' ? t('today.sentLater') : t('today.sent'));
  }, () => { sending.value = false; toast.error(t('today.sendFailed')); });
}

function run(c) {
  if (!deviceId.value) return;
  busy.value = c.type;
  Api.companion.sendCompanionCommand(deviceId.value, c.type, c.arg, () => {
    busy.value = ''; toast.success(t('today.cmdSent', { name: t(c.label) }));
  }, () => { busy.value = ''; toast.error(t('today.sendFailed')); });
}

function turn(dir) { offset.value = Math.max(-1, Math.min(6, offset.value + dir)); }
function openRow(r) { router.push({ path: '/day', query: { focus: r.key } }); }

let tick = null; let poll = null;
function onVisible() { if (!document.hidden) { clock.value = new Date(); refresh(true); } }
onMounted(async () => {
  await loadRobots();
  refresh();
  tick = setInterval(() => { clock.value = new Date(); }, 30000);
  poll = setInterval(() => { if (!document.hidden) refresh(true); }, 20000);
  document.addEventListener('visibilitychange', onVisible);
});
onBeforeUnmount(() => { clearInterval(tick); clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); });
watch(deviceId, () => { view.value = null; refresh(); });
</script>

<style>
.today { padding-bottom: var(--tb-s8); }
.today__none { padding: var(--tb-s10) 0; }
.today__grid {
  display: grid; gap: 0 var(--tb-s8);
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "hero" "act" "day" "side";
}
.today__hero { grid-area: hero; display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, 190px); border-bottom: 1px solid var(--tb-rule); }
.today__date { padding: 6px 16px 14px 0; border-right: 1px solid var(--tb-rule); }
.today__bot { display: grid; align-content: start; gap: 10px; padding: 14px 0 14px 14px; }
.today__act { grid-area: act; display: grid; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--tb-rule); }
.today__say { display: flex; gap: 8px; }
.today__say .tb-input { flex: 1; }
.today__note { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.today__deck { display: flex; gap: 8px; flex-wrap: wrap; }
.today__day { grid-area: day; padding-top: 12px; }
.today__dayhead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 6px 0 8px; }
.today__dayhead h2 { font-size: var(--tb-fs-20); }
.today__dayhint { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.today__fail { display: flex; align-items: center; gap: 8px; color: var(--tb-danger); font-size: var(--tb-fs-14); padding-top: 8px; }
.today__side { grid-area: side; display: grid; gap: 0; align-content: start; padding-top: var(--tb-s6); }
.today__weather { display: flex; gap: 10px; align-items: center; padding: 12px 0; border-top: var(--tb-rule-band) solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule); }
.today__weather b { font-family: var(--tb-font-display); font-size: var(--tb-fs-24); }
.today__weather small { display: block; color: var(--tb-ink-2); font-size: var(--tb-fs-12); }
.today__more { display: grid; }
.today__link {
  --ink: var(--tb-ink);
  display: flex; align-items: center; gap: 12px; min-height: 52px; border-bottom: 1px solid var(--tb-rule-soft);
  text-decoration: none; font-weight: 600; transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.today__link .tb-icon:first-child { color: var(--ink); }
.today__link span { flex: 1; }
@media (hover: hover) and (pointer: fine) { .today__link:hover { background: var(--tb-paper-2); } }

@media (min-width: 1100px) {
  .today__grid {
    grid-template-columns: minmax(0, 1fr) 300px;
    grid-template-areas: "hero side" "act side" "day side";
  }
  .today__hero { grid-template-columns: minmax(0, 1fr) 240px; }
  .today__side { padding-top: 0; }
  .today__weather { border-top: 0; }
}
@media (max-width: 420px) {
  .today__hero { grid-template-columns: minmax(0, 1fr) 150px; }
  .today__say { flex-direction: row; }
}
</style>
