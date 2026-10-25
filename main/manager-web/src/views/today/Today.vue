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
        <div class="today__date">
          <TbDateBlock :date="date" :lang="lang" :extra="sunrise" :heading-level="1"
            :prev-label="$t('today.prevDay')" :next-label="$t('today.nextDay')" @turn="turn" />
          <TbButton v-if="!isToday" class="today__back" variant="quiet" size="s" icon="today" @click="offset = 0">{{ $t('today.backToday') }}</TbButton>
        </div>
        <div class="today__bot">
          <TbFace :mood="faceMood" :pulse="pulse" :alt="$t('today.faceAlt', { name: botName })" />
          <TbNamePlate :name="botName" :doing="doingNow" :detail="together" :state="state" :state-text="$t(`today.state.${state}`)" />
        </div>
      </section>

      <section class="today__act" :aria-label="$t('today.actLabel')">
        <form class="today__say" @submit.prevent="say">
          <label class="tb-visually-hidden" for="today-say">{{ $t('today.sayLabel') }}</label>
          <TbInput id="today-say" v-model="line" :placeholder="$t('today.sayPlaceholder')" :maxlength="200" size="l"
            enterkeyhint="send" autocomplete="off" />
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
        <section v-if="nextUp.length" class="today__next" aria-labelledby="today-next-h">
          <h2 id="today-next-h" class="today__nexth">{{ $t('today.nextTitle') }}</h2>
          <ul>
            <li v-for="r in nextUp" :key="r.key">
              <button type="button" class="today__nextrow" :class="'ink-' + (r.ink || 'ink')" @click="openRow(r)">
                <span class="today__nextt tb-num">{{ timeText(r.time, lang, lang === 'bn') }}</span>
                <i aria-hidden="true"></i>
                <span class="today__nextx">{{ r.title }}</span>
              </button>
            </li>
          </ul>
        </section>
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
import { digits, minutesOf, timeText } from '@/kit/calendar';
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

// The side column reads the day: the next three rows after the current minute (all of a later
// day's first three; none for a day already gone).
const nextUp = computed(() => {
  if (offset.value < 0) return [];
  const sorted = [...rows.value].sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
  return (isToday.value ? sorted.filter((r) => minutesOf(r.time) > nowMinutes.value) : sorted).slice(0, 3);
});

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
.today__date { display: grid; align-content: start; justify-items: start; gap: 6px; padding: 6px 16px 14px 0; border-right: 1px solid var(--tb-rule); }
.today__date > .tb-dateblock { justify-self: stretch; }
.today__bot { display: grid; align-content: start; gap: 10px; padding: 14px 0 14px 14px; }
.today__act { grid-area: act; display: grid; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--tb-rule); }
.today__say { display: flex; gap: 8px; }
.today__say .tb-input { flex: 1; }
.today__note { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.today__deck { display: flex; gap: 10px; flex-wrap: wrap; }
.today__day { grid-area: day; padding-top: 12px; }
.today__dayhead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 6px 0 8px; }
.today__dayhead h2 { font-size: var(--tb-fs-20); }
.today__dayhint { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.today__fail { display: flex; align-items: center; gap: 8px; color: var(--tb-danger); font-size: var(--tb-fs-14); padding-top: 8px; }
.today__side { grid-area: side; display: grid; gap: 0; align-content: start; padding-top: var(--tb-s6); }
.today__weather { display: flex; gap: 10px; align-items: center; padding: 12px 0; border-top: var(--tb-rule-band) solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule); }
.today__weather b { font-family: var(--tb-font-display); font-size: var(--tb-fs-24); }
.today__weather small { display: block; color: var(--tb-ink-2); font-size: var(--tb-fs-12); }
.today__next { padding-top: 12px; }
.today__nexth { font-size: var(--tb-fs-16); padding-bottom: 6px; border-bottom: 1px solid var(--tb-rule); }
.today__next ul { margin: 0; padding: 0; list-style: none; }
.today__nextrow {
  --ink: var(--tb-ink);
  display: flex; align-items: baseline; gap: 10px; width: 100%; min-height: 44px; padding: 10px 0;
  border: 0; border-bottom: 1px solid var(--tb-rule-soft); background: none; color: var(--tb-ink); text-align: left;
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.today__nextrow i { flex: none; width: 8px; height: 8px; background: var(--ink); }
.today__nextrow.ink-prayer { --ink: var(--tb-prayer); }
.today__nextrow.ink-alarm { --ink: var(--tb-alarm); }
.today__nextrow.ink-routine { --ink: var(--tb-routine-mark); }
.today__nextrow.ink-message { --ink: var(--tb-message); }
.today__nextrow.ink-look { --ink: var(--tb-look); }
.today__nextt { flex: none; min-width: 64px; font-family: var(--tb-font-display); font-weight: 700; }
.today__nextx { flex: 1; min-width: 0; }
@media (hover: hover) and (pointer: fine) { .today__nextrow:hover { background: var(--tb-paper-2); } }

@media (min-width: 1100px) {
  .today__grid {
    grid-template-columns: minmax(0, 1fr) 300px;
    grid-template-areas: "hero side" "act side" "day side";
  }
  .today__hero { grid-template-columns: minmax(0, 1fr) 240px; }
  .today__side { padding-top: 0; position: sticky; top: 48px; align-self: start; }
  .today__weather { border-top: 0; }
}
@media (max-width: 420px) {
  .today__hero { grid-template-columns: minmax(0, 1fr) 150px; }
  .today__say { flex-direction: row; }
}
</style>
