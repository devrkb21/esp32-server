<template>
  <TbSheet :open="open" :title="title" size="l" :close-label="$t('common.close')" class="vsheet"
    @update:open="onOpen">
    <div class="vsheet__bar">
      <TbInput v-model="searchQuery" icon="search" clearable size="s" class="vsheet__search"
        :placeholder="$t('models.voices.search')" :aria-label="$t('models.voices.search')" :clear-label="$t('models.clear')" />
      <div class="vsheet__acts">
        <template v-if="selectedCount">
          <span class="vsheet__count tb-num">{{ $t('models.selected', { count: num(selectedCount) }) }}</span>
          <TbButton size="s" variant="danger" icon="trash" @click="deleteRow(filtered.filter((r) => r.selected))">
            {{ $t('common.delete') }}
          </TbButton>
        </template>
        <TbButton size="s" variant="quiet" :disabled="!filtered.length" @click="toggleSelectAll">
          {{ selectAll ? $t('models.deselectAll') : $t('models.selectAll') }}
        </TbButton>
        <TbButton size="s" variant="primary" icon="plus" @click="addNew">{{ $t('models.voices.add') }}</TbButton>
      </div>
    </div>

    <TbTable :columns="columns" :rows="filtered" row-key="_k" dense :loading="loading" :row-class="(r) => (r.editing ? 'is-editing' : null)"
      :caption="title" :loading-text="$t('common.loading')">
      <template #cell-sel="{ row }">
        <TbCheckbox v-model="row.selected" :aria-label="$t('models.voices.selectRow', { name: row.voiceName || '' })" />
      </template>
      <template #cell-voiceName="{ row }">
        <TbInput v-if="row.editing" v-model="row.voiceName" size="s" :aria-label="$t('models.voices.name')" :placeholder="$t('models.voices.name')" />
        <span v-else class="vsheet__name">{{ row.voiceName }}</span>
      </template>
      <template #cell-voiceCode="{ row }">
        <TbInput v-if="row.editing" v-model="row.voiceCode" size="s" :aria-label="$t('models.voices.code')" :placeholder="$t('models.voices.code')" />
        <code v-else class="vsheet__code">{{ row.voiceCode }}</code>
      </template>
      <template #cell-languageType="{ row }">
        <TbInput v-if="row.editing" v-model="row.languageType" size="s" :aria-label="$t('models.voices.language')" :placeholder="$t('models.voices.language')" />
        <TbTag v-else-if="row.languageType">{{ row.languageType }}</TbTag>
      </template>
      <template #cell-voiceDemo="{ row }">
        <TbInput v-if="row.editing" v-model="row.voiceDemo" size="s" type="url" :aria-label="$t('models.voices.demo')" :placeholder="$t('models.voices.demoPh')" />
        <TbButton v-else-if="isAudioUrl(row.voiceDemo)" size="s" variant="secondary" :icon="playing === row._k ? 'stop' : 'play'"
          @click="togglePlay(row)">{{ playing === row._k ? $t('models.voices.pause') : $t('models.voices.play') }}</TbButton>
        <span v-else class="vsheet__none">–</span>
      </template>
      <template #cell-remark="{ row }">
        <TbInput v-if="row.editing" v-model="row.remark" size="s" :aria-label="$t('models.voices.remark')" :placeholder="$t('models.voices.remark')" />
        <span v-else class="vsheet__muted">{{ row.remark }}</span>
      </template>
      <template #cell-referenceAudio="{ row }">
        <TbInput v-if="row.editing" v-model="row.referenceAudio" size="s" :aria-label="$t('models.voices.refAudio')" :placeholder="$t('models.voices.refAudioPh')" />
        <code v-else class="vsheet__code">{{ row.referenceAudio }}</code>
      </template>
      <template #cell-referenceText="{ row }">
        <TbInput v-if="row.editing" v-model="row.referenceText" size="s" :aria-label="$t('models.voices.refText')" :placeholder="$t('models.voices.refTextPh')" />
        <span v-else class="vsheet__muted">{{ row.referenceText }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="vsheet__rowacts">
          <template v-if="!row.editing">
            <TbButton size="s" variant="quiet" icon="edit" :aria-label="$t('common.edit')" @click="startEdit(row)" />
            <TbButton size="s" variant="quiet" icon="trash" class="is-danger" :aria-label="$t('common.delete')" @click="deleteRow(row)" />
          </template>
          <template v-else>
            <TbButton size="s" variant="quiet" @click="cancelEdit(row)">{{ $t('common.cancel') }}</TbButton>
            <TbButton size="s" variant="primary" :loading="row.saving" @click="saveEdit(row)">{{ $t('common.save') }}</TbButton>
          </template>
        </div>
      </template>
      <template #empty>
        <TbEmpty v-if="searchQuery" :title="$t('models.voices.noMatch')" :text="$t('models.voices.noMatchText')">
          <TbButton size="s" @click="searchQuery = ''">{{ $t('models.clearSearch') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else-if="failed" :title="$t('models.voices.loadFailed')" :text="$t('common.loadFailed')">
          <TbButton size="s" icon="refresh" @click="loadData">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else :title="$t('models.voices.emptyTitle')" :text="$t('models.voices.emptyText')">
          <TbButton size="s" variant="primary" icon="plus" @click="addNew">{{ $t('models.voices.add') }}</TbButton>
        </TbEmpty>
      </template>
    </TbTable>
  </TbSheet>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { REFERENCE_VOICE_PROVIDERS, isAudioUrl } from './modelForm';

let seq = 0;

// The voices of one TTS model (legacy TtsModel dialog): search, inline add and edit, delete one
// or many, play the demo clip. Providers that clone from a reference recording show the
// recording's path and text instead of the demo link and remark.
export default {
  name: 'TtsVoicesSheet',
  props: {
    open: Boolean,
    model: { type: Object, default: null },
  },
  emits: ['update:open'],
  data() {
    return { voices: [], searchQuery: '', loading: false, failed: false, selectAll: false, playing: '', audio: null };
  },
  computed: {
    title() {
      const name = this.model?.modelName;
      return name ? this.$t('models.voices.titleOf', { name }) : this.$t('models.voices.title');
    },
    showReference() {
      return REFERENCE_VOICE_PROVIDERS.includes(this.model?.configJson?.type);
    },
    columns() {
      const c = [
        { key: 'sel', label: this.$t('models.select'), width: '44px' },
        { key: 'voiceName', label: this.$t('models.voices.name') },
        { key: 'voiceCode', label: this.$t('models.voices.code') },
        { key: 'languageType', label: this.$t('models.voices.language') },
      ];
      if (this.showReference) {
        c.push({ key: 'referenceAudio', label: this.$t('models.voices.refAudio') }, { key: 'referenceText', label: this.$t('models.voices.refText') });
      } else {
        c.push({ key: 'voiceDemo', label: this.$t('models.voices.demo') }, { key: 'remark', label: this.$t('models.voices.remark') });
      }
      c.push({ key: 'actions', label: this.$t('models.actions'), align: 'right' });
      return c;
    },
    filtered() {
      const q = (this.searchQuery || '').toLowerCase();
      return this.voices.filter((v) => v.editing || (v.voiceName || '').toLowerCase().includes(q)
        || (v.voiceCode || '').toLowerCase().includes(q));
    },
    selectedCount() { return this.filtered.filter((r) => r.selected).length; },
  },
  watch: {
    open: {
      handler(v) { if (v) { this.loadData(); } else this.reset(); },
      immediate: true,
    },
  },
  beforeUnmount() { this.stopAudio(); },
  methods: {
    isAudioUrl,
    num(n) { return digits(n, this.$i18n?.locale); },
    onOpen(v) { this.$emit('update:open', v); },
    reset() {
      this.stopAudio();
      this.voices = [];
      this.selectAll = false;
      this.searchQuery = '';
      this.failed = false;
    },
    loadData() {
      if (!this.model?.id) return;
      this.loading = true;
      this.failed = false;
      Api.timbre.getVoiceList({ ttsModelId: this.model.id, page: 1, limit: 10000, name: this.searchQuery }, (data) => {
        this.loading = false;
        if (data && data.code === 0) {
          this.voices = (data.data?.list || []).map((item) => ({
            _k: `v-${item.id || ++seq}`,
            id: item.id || '',
            voiceCode: item.ttsVoice || '',
            voiceName: item.name || this.$t('models.voices.unnamed'),
            languageType: item.languages || '',
            remark: item.remark || '',
            referenceAudio: item.referenceAudio || '',
            referenceText: item.referenceText || '',
            voiceDemo: item.voiceDemo || '',
            selected: false,
            editing: false,
            saving: false,
            sort: Number(item.sort),
          })).sort((a, b) => a.sort - b.sort);
        } else {
          this.failed = true;
          this.$message.error(data?.msg || this.$t('models.voices.loadFailed'));
        }
      });
    },
    toggleSelectAll() {
      this.selectAll = !this.selectAll;
      this.filtered.forEach((r) => { r.selected = this.selectAll; });
    },
    addNew() {
      if (this.voices.some((r) => r.editing)) {
        this.$message.warning(this.$t('models.voices.finishFirst'));
        return;
      }
      this.voices.unshift({
        _k: `new-${++seq}`, id: '', voiceCode: '', voiceName: '', languageType: this.$t('models.voices.defaultLanguage'),
        voiceDemo: '', remark: '', referenceAudio: '', referenceText: '', selected: false, editing: true, saving: false, sort: 0,
      });
    },
    startEdit(row) {
      if (this.voices.some((r) => r.editing && r !== row)) {
        this.$message.warning(this.$t('models.voices.finishFirst'));
        return;
      }
      row.originalData = { ...row };
      row.editing = true;
    },
    cancelEdit(row) {
      if (!row.id) {
        this.voices = this.voices.filter((r) => r !== row);
        return;
      }
      if (row.originalData) Object.assign(row, row.originalData);
      delete row.originalData;
      row.editing = false;
    },
    saveEdit(row) {
      if (!row.voiceCode || !row.voiceName || !row.languageType) {
        this.$message.error(this.$t('models.voices.required'));
        return;
      }
      const params = {
        id: row.id,
        voiceCode: row.voiceCode,
        voiceName: row.voiceName,
        languageType: row.languageType,
        remark: row.remark,
        ttsModelId: this.model.id,
        voiceDemo: row.voiceDemo || '',
        sort: row.sort,
      };
      if (this.showReference) {
        params.referenceAudio = row.referenceAudio;
        params.referenceText = row.referenceText;
      }
      row.saving = true;
      const done = (res) => this.handleResponse(res, row);
      if (row.id) Api.timbre.updateVoice(params, done);
      else Api.timbre.saveVoice(params, done);
    },
    handleResponse(res, row) {
      row.saving = false;
      if (res && res.code === 0) {
        this.$message.success(row.id ? this.$t('models.voices.updated') : this.$t('models.voices.saved'));
        row.editing = false;
        delete row.originalData;
        this.loadData();
        return;
      }
      if (row.originalData) {
        Object.assign(row, row.originalData);
        row.editing = false;
        delete row.originalData;
      }
      this.$message.error(res?.msg || (row.id ? this.$t('models.voices.updateFailed') : this.$t('models.voices.saveFailed')));
    },
    deleteRow(row) {
      const voices = Array.isArray(row) ? row : [row];
      if (!voices.length) {
        this.$message.warning(this.$t('models.voices.selectFirst'));
        return;
      }
      const n = voices.length;
      const title = n === 1 && voices[0].voiceName ? voices[0].voiceName : this.$t('models.voices.deleteTitle');
      this.$confirm(this.$t('models.voices.confirmDelete', { count: this.num(n) }), title, {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        const ids = voices.map((v) => v.id);
        if (ids.some((id) => !id)) {
          this.$message.error(this.$t('models.voices.unsaved'));
          return;
        }
        Api.timbre.deleteVoice(ids, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t('models.voices.deleted', { count: this.num(n) }));
            this.selectAll = false;
            this.loadData();
          } else {
            this.$message.error(data.msg || this.$t('models.voices.deleteFailed'));
          }
        });
      }).catch(() => {});
    },
    togglePlay(row) {
      if (this.playing === row._k) { this.stopAudio(); return; }
      this.stopAudio();
      try {
        const a = new Audio(row.voiceDemo);
        a.addEventListener('ended', () => { if (this.audio === a) this.playing = ''; });
        a.addEventListener('error', () => {
          if (this.audio === a) { this.playing = ''; this.$message.error(this.$t('models.voices.playFailed')); }
        });
        this.audio = a;
        this.playing = row._k;
        const p = a.play();
        if (p && p.catch) p.catch(() => { if (this.audio === a) this.playing = ''; });
      } catch (e) {
        this.playing = '';
      }
    },
    stopAudio() {
      if (this.audio) { this.audio.pause(); this.audio = null; }
      this.playing = '';
    },
  },
};
</script>

<style>
.vsheet__bar { display: flex; align-items: center; gap: var(--tb-s3); flex-wrap: wrap; }
.vsheet__search { flex: 1 1 220px; max-width: 320px; }
.vsheet__acts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto; }
.vsheet__count { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.vsheet__name { font-weight: 600; overflow-wrap: anywhere; }
.vsheet__code { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: var(--tb-fs-13); overflow-wrap: anywhere; }
.vsheet__muted { color: var(--tb-ink-2); font-size: var(--tb-fs-13); overflow-wrap: anywhere; }
.vsheet__none { color: var(--tb-ink-3); }
.vsheet__rowacts { display: inline-flex; gap: 2px; justify-content: flex-end; flex-wrap: wrap; }
.vsheet__rowacts .is-danger { color: var(--tb-danger); }
.vsheet .tb-table tr.is-editing { background: var(--tb-paper-2); }
.vsheet .tb-table td .tb-input { min-width: 120px; }
@media (max-width: 640px) {
  .tb-sheet .tb-table td > .tb-tag { justify-self: start; }
  .vsheet__search { max-width: none; }
  .vsheet__acts { margin-left: 0; }
  .vsheet__rowacts { justify-content: flex-start; }
}
</style>
