<template>
  <TbSheet :open="open" :title="row && row.id ? $t('vp.sheet.edit') : $t('vp.sheet.add')" :close-label="$t('common.close')"
    @update:open="onOpen">
    <form id="vp-form" class="vps" novalidate @submit.prevent="submit">
      <fieldset class="vps__pick" :aria-describedby="errors.audioId ? 'vps-audio-err' : 'vps-audio-hint'">
        <legend class="vps__legend">{{ $t('vp.f.audio') }}<span class="vps__req" aria-hidden="true">*</span></legend>
        <p id="vps-audio-hint" class="vps__hint">{{ $t('vp.f.audioHint') }}</p>

        <div v-if="recentLoading" class="vps__state"><TbLoading :label="$t('vp.f.recentLoading')" show-label /></div>

        <div v-else-if="recentFailed" class="vps__state vps__fail" role="alert">
          <span>{{ $t('vp.f.recentFailed') }}</span>
          <TbButton size="s" variant="quiet" icon="refresh" @click="loadRecent">{{ $t('common.retry') }}</TbButton>
        </div>

        <TbEmpty v-else-if="!recordings.length" class="vps__none" face="confused" :title="$t('vp.f.noRecent.title')"
          :text="$t('vp.f.noRecent.text')" />

        <template v-else>
          <div v-if="recordings.length > 6" class="vps__filter">
            <label class="tb-visually-hidden" for="vps-filter">{{ $t('vp.f.filter') }}</label>
            <TbInput id="vps-filter" v-model="filter" size="s" icon="search" clearable :clear-label="$t('common.close')"
              :placeholder="$t('vp.f.filter')" />
          </div>
          <ul class="vps__list" role="radiogroup" :aria-label="$t('vp.f.audio')" :aria-invalid="errors.audioId ? 'true' : null">
            <li v-for="r in shown" :key="r.audioId" class="vps__rec" :class="{ 'is-on': form.audioId === r.audioId, 'is-playing': player.playingId.value === r.audioId }">
              <button type="button" class="vp-play" :class="{ 'is-on': player.playingId.value === r.audioId }"
                :aria-label="playLabel(r.audioId)" :aria-pressed="player.playingId.value === r.audioId ? 'true' : 'false'"
                @click="player.toggle(r.audioId)">
                <span v-if="player.loadingId.value === r.audioId" class="vp-play__spin" aria-hidden="true"></span>
                <TbIcon v-else :name="player.playingId.value === r.audioId ? 'pause' : 'play'" :size="16" />
              </button>
              <label class="vps__choice">
                <input class="tb-visually-hidden" type="radio" name="vps-audio" :value="r.audioId" :checked="form.audioId === r.audioId"
                  @change="pick(r.audioId)" />
                <span class="vps__dot" aria-hidden="true"></span>
                <span class="vps__words">
                  <span :class="{ 'vps__nowords': !r.text }">{{ r.text || $t('vp.noWords') }}</span>
                  <small v-if="r.speaker || r.audioId === originalAudio" class="vps__meta">
                    <span v-if="r.audioId === originalAudio" class="vps__inuse">{{ $t('vp.f.inUse') }}</span>
                    <span v-if="r.speaker">{{ $t('vp.f.heardAs', { name: r.speaker }) }}</span>
                  </small>
                </span>
              </label>
            </li>
          </ul>
          <p v-if="!shown.length" class="vps__hint">{{ $t('vp.f.filterEmpty') }}</p>
        </template>
        <p v-if="errors.audioId" id="vps-audio-err" class="vps__err" role="alert">{{ $t(errors.audioId) }}</p>
      </fieldset>

      <TbField :label="$t('vp.f.name')" for-id="vps-name" required :error="errors.sourceName ? $t(errors.sourceName) : ''">
        <TbInput id="vps-name" v-model="form.sourceName" :placeholder="$t('vp.f.namePlaceholder')" :invalid="!!errors.sourceName"
          @update:model-value="clearError('sourceName')" />
      </TbField>

      <TbField :label="$t('vp.f.intro')" for-id="vps-intro" required
        :error="errors.introduce ? $t(errors.introduce, { n: num(INTRO_MAX) }) : ''" :hint="$t('vp.f.introHint', { n: num(INTRO_MAX) })">
        <TbTextarea id="vps-intro" v-model="form.introduce" :rows="3" autosize :maxlength="INTRO_MAX" show-count
          :placeholder="$t('vp.f.introPlaceholder')" :invalid="!!errors.introduce" @update:model-value="clearError('introduce')" />
      </TbField>
    </form>

    <template #footer>
      <TbButton @click="close">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" native-type="submit" form="vp-form" :loading="saving">{{ $t('common.save') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Api from '@/apis/api';
import { toast } from '@/kit/toast';
import { digits } from '@/kit/calendar';
import { INTRO_MAX, payloadOf, recordingsFrom, transcriptOf, validate } from './voiceprintModel';

// Add or edit one voice: pick the recording (with play and its words), then name and about.
const props = defineProps({
  open: Boolean,
  agentId: { type: String, default: '' },
  row: { type: Object, default: null },      // the saved voiceprint when editing, null to add
  player: { type: Object, required: true },  // useVoicePlayer() of the page: one sound at a time
});
const emit = defineEmits(['update:open', 'saved', 'recordings']);
const { t, locale } = useI18n({ useScope: 'global' });
const num = (n) => digits(n, locale.value);

const form = reactive({ id: null, audioId: '', sourceName: '', introduce: '' });
const errors = ref({});
const saving = ref(false);
const recordings = ref([]);
const recentLoading = ref(false);
const recentFailed = ref(false);
const filter = ref('');
const originalAudio = ref('');

const shown = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return recordings.value;
  return recordings.value.filter((r) => r.audioId === form.audioId || `${r.text} ${r.speaker}`.toLowerCase().includes(q));
});

function playLabel(id) {
  if (props.player.loadingId.value === id) return t('vp.fetchingAudio');
  return props.player.playingId.value === id ? t('vp.stop') : t('vp.f.listenOne');
}

function reset() {
  const r = props.row || {};
  Object.assign(form, { id: r.id || null, audioId: r.audioId || '', sourceName: r.sourceName || '', introduce: r.introduce || '' });
  originalAudio.value = r.audioId || '';
  errors.value = {};
  filter.value = '';
  saving.value = false;
}

// The recording in use may be older than the recent fifty: fetch its words and keep it on top.
function ensureCurrent() {
  const id = form.audioId;
  if (!id || recordings.value.some((r) => r.audioId === id)) return;
  recordings.value = [{ audioId: id, text: '', speaker: '' }, ...recordings.value];
  Api.agent.getContentByAudioId(id, (res) => {
    const words = transcriptOf(res?.data?.data);
    recordings.value = recordings.value.map((r) => (r.audioId === id ? { ...r, ...words } : r));
  });
}

function loadRecent() {
  if (!props.agentId) return;
  recentLoading.value = true;
  recentFailed.value = false;
  Api.agent.getRecentlyFiftyByAgentId(props.agentId, (res) => {
    recentLoading.value = false;
    const body = res?.data;
    if (!body || body.code !== 0) { recentFailed.value = true; return; }
    recordings.value = recordingsFrom(body.data);
    emit('recordings', recordings.value);
    ensureCurrent();
  });
}

watch(() => props.open, (v) => {
  if (v) { reset(); loadRecent(); } else { props.player.stop(); }
}, { immediate: true });

function pick(id) { form.audioId = id; clearError('audioId'); }
function clearError(key) { if (errors.value[key]) errors.value = { ...errors.value, [key]: undefined }; }
function close() { emit('update:open', false); }
function onOpen(v) { if (!v) close(); }

function submit() {
  const found = validate(form);
  errors.value = found;
  if (Object.keys(found).length) return;
  saving.value = true;
  const body = payloadOf(form, props.agentId, props.row);
  const call = form.id ? Api.agent.updateAgentVoicePrint : Api.agent.addAgentVoicePrint;
  call.call(Api.agent, body, (res) => {
    saving.value = false;
    const data = res?.data;
    if (data && data.code === 0) {
      toast.success(form.id ? t('vp.updated') : t('vp.added', { name: body.sourceName }));
      emit('saved', body);
      close();
    } else {
      toast.error((data && data.msg) || t('vp.saveFailed'));
    }
  });
}
</script>

<style>
.vps { display: grid; gap: var(--tb-s5); }
.vps__pick { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: var(--tb-s2); }
.vps__legend { padding: 0; font-weight: 600; font-size: var(--tb-fs-14); color: var(--tb-ink); }
.vps__req { color: var(--tb-alarm); margin-left: 2px; }
.vps__hint { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.vps__err { font-size: var(--tb-fs-13); color: var(--tb-danger); font-weight: 500; }
.vps__state { display: flex; align-items: center; gap: var(--tb-s3); flex-wrap: wrap; padding: var(--tb-s5) 0; border-top: 1px solid var(--tb-rule); }
.vps__fail { color: var(--tb-danger); }
.vps__none { padding: var(--tb-s4) 0; border-top: 1px solid var(--tb-rule); max-width: none; }
.vps__filter { margin-top: 2px; }

/* the recordings: a short ruled list that scrolls inside the sheet */
.vps__list { list-style: none; margin: 0; padding: 0; max-height: min(320px, 42vh); overflow-y: auto; overscroll-behavior: contain;
  border-top: 1px solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule); }
.vps__rec { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: var(--tb-s3);
  padding: 6px 4px 6px 0; border-bottom: 1px solid var(--tb-rule-soft); transition: background-color var(--tb-t-hover) var(--tb-ease); }
.vps__rec:last-child { border-bottom: 0; }
.vps__rec.is-on { background: var(--tb-paper-2); }
.vps__choice { display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: start; gap: var(--tb-s3); min-height: var(--tb-target);
  padding: 8px 6px 8px 0; cursor: pointer; }
.vps__dot { width: 18px; height: 18px; margin-top: 3px; border: 1.5px solid var(--tb-ink); border-radius: 50%; display: grid; place-items: center;
  transition: border-color var(--tb-t-hover) var(--tb-ease); }
.vps__dot::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--tb-orange); transform: scale(0);
  transition: transform var(--tb-t-fast) var(--tb-ease); }
.vps__rec.is-on .vps__dot { border-color: var(--tb-orange); }
.vps__rec.is-on .vps__dot::after { transform: scale(1); }
.vps__choice input:focus-visible + .vps__dot { outline: 2px solid var(--tb-focus); outline-offset: 2px; }
.vps__words { display: grid; gap: 2px; font-size: var(--tb-fs-15); line-height: var(--tb-lh-text); color: var(--tb-ink); overflow-wrap: anywhere; }
.vps__rec.is-on .vps__words > span:first-child { font-weight: 600; }
.vps__nowords { color: var(--tb-ink-3); }
.vps__meta { display: flex; flex-wrap: wrap; gap: 2px var(--tb-s3); font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.vps__inuse { color: var(--tb-action); font-weight: 600; }
@media (hover: hover) and (pointer: fine) { .vps__rec:not(.is-on):hover { background: var(--tb-paper-2); } }
</style>
