<template>
  <div class="vp">
    <TbPageHeader :title="$t('nav.voiceprint')" :description="$t('vp.desc')">
      <template v-if="agentId" #actions>
        <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('vp.add') }}</TbButton>
      </template>
    </TbPageHeader>

    <div v-if="!agentId && checked" class="vp__none">
      <TbEmpty face="confused" :title="$t('common.noRobot')" :text="$t('common.noRobotText')">
        <TbButton variant="primary" to="/robots" icon="robots">{{ $t('common.goRobots') }}</TbButton>
      </TbEmpty>
    </div>

    <div v-else class="vp__grid">
      <aside class="vp__how" aria-labelledby="vp-how-h">
        <h2 id="vp-how-h" class="vp__how-title">{{ $t('vp.how.title') }}</h2>
        <p>{{ $t('vp.how.pick') }}</p>
        <p>{{ $t('vp.how.source') }}</p>
        <p>{{ $t('vp.how.name') }}</p>
      </aside>

      <section class="vp__people" aria-labelledby="vp-list-h" :aria-busy="loading ? 'true' : 'false'">
        <header class="vp__head">
          <h2 id="vp-list-h" class="vp__title">{{ $t('vp.list.title') }}</h2>
          <span v-if="!loading && !failed && all.length" class="vp__count tb-num">{{ $t('vp.list.count', { n: num(all.length) }) }}</span>
        </header>

        <div v-if="(loading && !all.length) || !checked" class="vp__state"><TbLoading :label="$t('vp.loading')" show-label /></div>

        <div v-else-if="failed" class="vp__state vp__fail" role="alert">
          <p>{{ $t('common.loadFailed') }}</p>
          <TbButton size="s" icon="refresh" @click="load">{{ $t('common.retry') }}</TbButton>
        </div>

        <TbEmpty v-else-if="!all.length" class="vp__empty" face="awake" :title="$t('vp.empty.title')" :text="$t('vp.empty.text')">
          <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('vp.add') }}</TbButton>
        </TbEmpty>

        <template v-else>
          <div class="vp-row vp-row--head" aria-hidden="true">
            <span>{{ $t('vp.col.name') }}</span>
            <span>{{ $t('vp.col.source') }}</span>
            <span>{{ $t('vp.col.added') }}</span>
            <span></span>
          </div>
          <ul class="vp__rows" role="list">
            <li v-for="row in paged.rows" :key="row.id" class="vp-row" :class="{ 'is-playing': player.playingId.value === row.audioId }">
              <div class="vp-row__who">
                <p class="vp-row__name">{{ row.sourceName || $t('vp.unnamed') }}</p>
                <p v-if="row.introduce" class="vp-row__intro">{{ row.introduce }}</p>
              </div>
              <div class="vp-row__src">
                <button v-if="row.audioId" type="button" class="vp-play" :class="{ 'is-on': player.playingId.value === row.audioId }"
                  :aria-label="playLabel(row)" :aria-pressed="player.playingId.value === row.audioId ? 'true' : 'false'"
                  @click="player.toggle(row.audioId)">
                  <span v-if="player.loadingId.value === row.audioId" class="vp-play__spin" aria-hidden="true"></span>
                  <TbIcon v-else :name="player.playingId.value === row.audioId ? 'pause' : 'play'" :size="16" />
                </button>
                <p class="vp-row__words">
                  <span v-if="player.playingId.value === row.audioId" class="vp-row__playing">{{ $t('vp.playing') }}</span>
                  <q v-if="wordsOf(row)">{{ wordsOf(row) }}</q>
                  <span v-else class="vp-row__nowords">{{ $t('vp.noWords') }}</span>
                </p>
              </div>
              <time class="vp-row__date tb-num" :datetime="isoOf(row.createDate)">{{ dateText(row.createDate, lang) }}</time>
              <div class="vp-row__act">
                <TbButton variant="quiet" icon="edit" :aria-label="$t('vp.editOf', { name: nameOf(row) })" @click="openEdit(row)" />
                <TbButton variant="quiet" icon="trash" class="vp-row__del" :aria-label="$t('vp.deleteOf', { name: nameOf(row) })"
                  @click="remove(row)" />
              </div>
            </li>
          </ul>
          <TbPagination v-if="all.length > PAGE_SIZE" class="vp__pager" :page="paged.page" :page-size="PAGE_SIZE" :total="all.length"
            :sizes="[PAGE_SIZE]" :total-text="$t('vp.list.count', { n: num(all.length) })" @update:page="page = $event" />
        </template>
      </section>
    </div>

    <VoicePrintSheet v-model:open="sheetOpen" :agent-id="agentId" :row="editing" :player="player"
      @saved="load" @recordings="learnWords" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { confirm } from '@/kit/confirm';
import { digits } from '@/kit/calendar';
import { loadRobots, robot } from '@/shell/robot';
import VoicePrintSheet from './VoicePrintSheet.vue';
import { useVoicePlayer } from './useVoicePlayer';
import { PAGE_SIZE, dateText, pageOf, recordingsFrom, transcriptOf } from './voiceprintModel';

// Voiceprints: the people TinyBot recognises by voice, for the character (agent) of this robot.
const { t, locale } = useI18n({ useScope: 'global' });
const route = useRoute();
const lang = computed(() => locale.value);
const num = (n) => digits(n, lang.value);

const agentId = computed(() => String(route.query.agentId || robot.agentId || ''));
const checked = ref(false); // the robots were looked up, so "no robot" is the truth
const all = ref([]);
const loading = ref(false);
const failed = ref(false);
const page = ref(1);
const paged = computed(() => pageOf(all.value, page.value));
const words = reactive({}); // audioId -> { text, speaker }, the words of each source recording
const sheetOpen = ref(false);
const editing = ref(null);

const player = useVoicePlayer({ onError: () => toast.error(t('vp.playFailed')) });

const nameOf = (row) => row.sourceName || t('vp.unnamed');
const wordsOf = (row) => (words[row.audioId] && words[row.audioId].text) || '';
const isoOf = (v) => (v ? String(v).replace(' ', 'T') : null);
function playLabel(row) {
  if (player.loadingId.value === row.audioId) return t('vp.fetchingAudio');
  return player.playingId.value === row.audioId ? t('vp.stop') : t('vp.listen', { name: nameOf(row) });
}

function learnWords(list) {
  for (const r of list || []) if (r.text && !(words[r.audioId] && words[r.audioId].text)) words[r.audioId] = { text: r.text, speaker: r.speaker };
}

// Each row shows the sentence its voice was learned from: the recent recordings answer most of
// them in one call, the rest are asked one by one.
let wordsAsked = false;
function fillWords() {
  const missing = () => all.value.filter((r) => r.audioId && !(r.audioId in words));
  const askEach = () => {
    for (const r of missing()) {
      words[r.audioId] = { text: '', speaker: '' };
      Api.agent.getContentByAudioId(r.audioId, (res) => {
        const w = transcriptOf(res?.data?.data);
        if (w.text) words[r.audioId] = w;
      });
    }
  };
  if (!missing().length) return;
  if (wordsAsked) { askEach(); return; }
  wordsAsked = true;
  Api.agent.getRecentlyFiftyByAgentId(agentId.value, (res) => {
    if (res?.data?.code === 0) learnWords(recordingsFrom(res.data.data));
    askEach();
  });
}

function load() {
  if (!agentId.value) return;
  loading.value = true;
  failed.value = false;
  Api.agent.getAgentVoicePrintList(agentId.value, (res) => {
    loading.value = false;
    const body = res?.data;
    if (!body || body.code !== 0) {
      failed.value = true;
      if (body && body.msg) toast.error(body.msg);
      return;
    }
    all.value = Array.isArray(body.data) ? body.data : [];
    page.value = Math.min(page.value, pageOf(all.value, page.value).pages);
    fillWords();
  });
}

function openAdd() { editing.value = null; sheetOpen.value = true; }
function openEdit(row) { player.stop(); editing.value = { ...row }; sheetOpen.value = true; }

async function remove(row) {
  try {
    await confirm(t('vp.confirm.text', { name: nameOf(row) }), t('vp.confirm.title'),
      { confirmText: t('vp.confirm.ok'), cancelText: t('common.cancel'), danger: true });
  } catch (e) { return; }
  if (player.playingId.value === row.audioId) player.stop();
  Api.agent.deleteAgentVoicePrint(row.id, (res) => {
    if (res?.data?.code === 0) {
      toast.success(t('vp.deleted'));
      load();
    } else {
      toast.error(res?.data?.msg || t('vp.deleteFailed'));
    }
  });
}

watch(agentId, (id, old) => {
  if (id === old) return;
  all.value = []; page.value = 1; wordsAsked = false;
  player.stop();
  load();
});

onMounted(async () => {
  if (agentId.value) { checked.value = true; load(); return; }
  await loadRobots();
  checked.value = true; // the watch above loads once the robot's agent is known
});
</script>

<style>
.vp { padding-bottom: var(--tb-s10); }
.vp__none { padding: var(--tb-s10) 0; }

/* the explanation beside (desktop) or above (phone) the people */
.vp__grid { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: "people" "how"; }
.vp__how { grid-area: how; display: grid; gap: var(--tb-s2); align-content: start; margin-top: var(--tb-s8); padding: var(--tb-s4) 0 var(--tb-s5);
  border-top: 1px solid var(--tb-rule); color: var(--tb-ink-2); font-size: var(--tb-fs-14); line-height: var(--tb-lh-text); }
.vp__how-title { font-size: var(--tb-fs-16); color: var(--tb-ink); }
.vp__how p { max-width: 62ch; }
.vp__people { grid-area: people; min-width: 0; }
@media (min-width: 1024px) {
  .vp__grid { grid-template-columns: minmax(0, 1fr) 280px; grid-template-areas: "people how"; column-gap: var(--tb-s10); }
  .vp__how { position: sticky; top: var(--tb-s4); margin-top: var(--tb-s6); padding-top: var(--tb-s3); }
}

.vp__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--tb-s3); padding: var(--tb-s6) 0 var(--tb-s3); }
.vp__title { font-size: var(--tb-fs-20); }
.vp__count { color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.vp__state { display: flex; flex-direction: column; align-items: center; gap: var(--tb-s3); padding: var(--tb-s10) 0;
  border-top: var(--tb-rule-band) solid var(--tb-rule); }
.vp__fail { color: var(--tb-danger); }
.vp__empty { border-top: var(--tb-rule-band) solid var(--tb-rule); max-width: none; padding-top: var(--tb-s8); }
.vp__empty .tb-empty__text { max-width: 46ch; }
.vp__pager { margin-top: var(--tb-s4); }

/* the people: ruled rows, name over its introduction, the recording it was learned from */
.vp__rows { list-style: none; margin: 0; padding: 0; }
.vp-row {
  display: grid; align-items: center; gap: var(--tb-s2) var(--tb-s5);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) 112px auto;
  grid-template-areas: "who src date act";
  padding: var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule-soft);
  transition: border-color var(--tb-t-hover) var(--tb-ease);
}
.vp-row--head { border-top: var(--tb-rule-band) solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule); padding: 8px 0;
  font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-ink-2); }
.vp-row--head > span:nth-child(1) { grid-area: who; }
.vp-row--head > span:nth-child(2) { grid-area: src; }
.vp-row--head > span:nth-child(3) { grid-area: date; }
.vp-row--head > span:nth-child(4) { grid-area: act; }
@media (hover: hover) and (pointer: fine) { .vp-row:not(.vp-row--head):hover { border-bottom-color: var(--tb-rule); } }

.vp-row__who { grid-area: who; min-width: 0; display: grid; gap: 2px; }
.vp-row__name { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-18); line-height: var(--tb-lh-tight); overflow-wrap: anywhere; }
.vp-row__intro { color: var(--tb-ink-2); font-size: var(--tb-fs-14); line-height: var(--tb-lh-text); overflow-wrap: anywhere; }
.vp-row__src { grid-area: src; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: var(--tb-s3); }
.vp-row__words { min-width: 0; font-size: var(--tb-fs-14); line-height: var(--tb-lh-text); color: var(--tb-ink);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.vp-row__words q { quotes: '“' '”'; }
.vp-row__nowords { color: var(--tb-ink-3); }
.vp-row__playing { color: var(--tb-action); font-weight: 700; margin-right: 6px; }
.vp-row__date { grid-area: date; font-size: var(--tb-fs-13); color: var(--tb-ink-2); white-space: nowrap; }
.vp-row__act { grid-area: act; display: flex; justify-content: flex-end; gap: 2px; }
.vp-row__act .tb-btn { --h: var(--tb-target); }
.vp-row__del { color: var(--tb-danger); }

/* play: an outline ring in ink; while it sounds, the orange "now" fill */
.vp-play { flex: none; display: grid; place-items: center; width: 40px; height: 40px; padding: 0;
  border: 1.5px solid var(--tb-ink); border-radius: 50%; background: transparent; color: var(--tb-ink);
  transition: background-color var(--tb-t-hover) var(--tb-ease), color var(--tb-t-hover) var(--tb-ease), border-color var(--tb-t-hover) var(--tb-ease);
  -webkit-tap-highlight-color: transparent; }
.vp-play:active { transform: translateY(1px); }
.vp-play.is-on { background: var(--tb-action); border-color: var(--tb-action); color: var(--tb-on-action); }
@media (hover: hover) and (pointer: fine) { .vp-play:not(.is-on):hover { background: var(--tb-ink); color: var(--tb-paper); } }
.vp-play__spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent;
  animation: tb-spin .8s linear infinite; }

/* phones: name and actions on the first line, then about, the recording, the date */
@media (max-width: 760px) {
  .vp-row { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "who act" "src src" "date date"; padding: var(--tb-s4) 0; }
  .vp-row--head { display: none; }
  .vp__rows { border-top: var(--tb-rule-band) solid var(--tb-rule); }
  .vp-play { width: var(--tb-target); height: var(--tb-target); }
  .vp-row__date { font-size: var(--tb-fs-12); }
}
</style>
