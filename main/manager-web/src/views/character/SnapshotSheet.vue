<template>
  <TbSheet :open="open" :title="title" size="l" :close-label="$t('common.close')" :close-on-scrim="!restoring"
    :close-on-esc="!restoring" @update:open="onOpen">
    <!-- the list of saved versions -->
    <div v-if="mode === 'list'" class="ch-snap">
      <p class="ch-snap__lead">{{ $t('character.history.lead') }}</p>
      <TbTable :columns="columns" :rows="snapshots" row-key="id" dense :loading="loading" :caption="$t('agentSnapshot.title')"
        :loading-text="$t('common.loading')" :row-class="(r) => (r.isLatestSnapshot ? 'is-current' : null)">
        <template #cell-versionNo="{ row }">
          <span class="ch-snap__ver tb-num">#{{ num(row.versionNo) }}</span>
          <TbTag v-if="row.isLatestSnapshot" ink="ink" class="ch-snap__now">{{ $t('character.history.now') }}</TbTag>
        </template>
        <template #cell-createdAt="{ row }"><time class="tb-num">{{ when(row.createdAt) }}</time></template>
        <template #cell-source="{ row }">{{ text.sourceLabel(row.source) }}</template>
        <template #cell-changedFields="{ row }">
          <span v-if="(row.changedFields || []).length" class="ch-snap__fields">
            {{ row.changedFields.map((f) => text.fieldLabel(f)).join(', ') }}
          </span>
          <span v-else class="ch-snap__none">{{ $t('agentSnapshot.emptyValue') }}</span>
        </template>
        <template #cell-actions="{ row }">
          <span class="ch-snap__acts">
            <TbButton v-if="row.id" size="s" variant="quiet" @click="viewSnapshot(row)">{{ $t('character.history.view') }}</TbButton>
            <TbButton v-if="row.id && !row.isLatestSnapshot" size="s" variant="quiet" icon="history" @click="restoreSnapshot(row)">{{ $t('character.history.restore') }}</TbButton>
            <TbButton v-if="!row.isLatestSnapshot" size="s" variant="quiet" icon="trash" class="ch-snap__del" :loading="deletingSnapshotId === row.id"
              :aria-label="$t('character.history.deleteLabel', { version: num(row.versionNo) })" @click="deleteSnapshot(row)" />
          </span>
        </template>
        <template #empty><TbEmpty face="sleepy" :title="$t('agentSnapshot.empty')" :text="$t('character.history.emptyText')" /></template>
      </TbTable>
      <p v-if="failed" class="ch-snap__fail" role="alert">{{ $t('agentSnapshot.fetchFailed') }}
        <TbButton size="s" variant="quiet" icon="refresh" @click="fetchSnapshots()">{{ $t('common.retry') }}</TbButton></p>
      <TbPagination v-if="total > limit" :page="page" :page-size="limit" :total="total" :sizes="[limit]"
        :total-text="$t('character.history.total', { n: num(total) })" :aria-label="$t('character.history.pages')"
        :prev-label="$t('character.history.prev')" :next-label="$t('character.history.next')" @update:page="handlePageChange" />
    </div>

    <!-- one version, or a restore preview -->
    <div v-else class="ch-snap">
      <TbButton variant="quiet" size="s" icon="chevron-left" class="ch-snap__back" :disabled="restoring" @click="backToList">{{ $t('character.history.back') }}</TbButton>
      <div v-if="busy" class="ch-snap__state"><TbLoading :label="$t('common.loading')" show-label /></div>
      <template v-else-if="shown && items.length">
        <p class="ch-snap__meta">
          <b class="tb-num">#{{ num(shown.versionNo) }}</b>
          <span><time class="tb-num">{{ when(shown.createdAt) }}</time></span>
          <span>{{ text.sourceLabel(shown.source) }}</span>
        </p>
        <section v-for="item in items" :key="item.field" class="ch-diff" :aria-label="item.label">
          <h3 class="ch-diff__field">{{ item.label }}</h3>

          <!-- plugins -->
          <template v-if="item.displayType === 'functions'">
            <ul v-if="item.single ? item.functionStates.length : item.functionChanges.length" class="ch-diff__fns">
              <template v-if="item.single">
                <li v-for="(s, i) in item.functionStates" :key="`${s.pluginId}-${i}`" class="ch-fn">
                  <p class="ch-fn__head"><b>{{ s.name }}</b><TbTag ink="ok">{{ s.status }}</TbTag></p>
                  <dl v-if="s.params.length" class="ch-fn__params">
                    <template v-for="p in s.params" :key="p.key"><dt>{{ p.label }}</dt><dd>{{ p.value }}</dd></template>
                  </dl>
                  <p v-else class="ch-fn__note">{{ s.note }}</p>
                </li>
              </template>
              <template v-else>
                <li v-for="(c, i) in item.functionChanges" :key="`${c.pluginId}-${i}`" class="ch-fn" :class="`is-${c.type}`">
                  <p class="ch-fn__head"><b>{{ c.name }}</b>
                    <TbTag :ink="c.type === 'added' ? 'ok' : c.type === 'removed' ? 'danger' : 'ink-2'">{{ c.badge }}</TbTag></p>
                  <div class="ch-fn__sides">
                    <div v-for="side in ['before', 'after']" :key="side" class="ch-fn__side" :class="{ 'is-off': !c[side].active }">
                      <p class="ch-fn__title"><span>{{ side === 'before' ? item.beforeTitle : item.afterTitle }}</span><span>{{ c[side].status }}</span></p>
                      <dl v-if="c[side].active && c[side].params.length" class="ch-fn__params">
                        <template v-for="p in c[side].params" :key="p.key">
                          <dt :class="{ 'is-changed': p.changed }">{{ p.label }}</dt><dd :class="{ 'is-changed': p.changed }">{{ p.value }}</dd>
                        </template>
                      </dl>
                      <p v-else class="ch-fn__note">{{ c[side].note }}</p>
                    </div>
                  </div>
                </li>
              </template>
            </ul>
            <p v-else class="ch-diff__empty">{{ item.single ? $t('agentSnapshot.emptyValue') : $t('agentSnapshot.noFunctionChange') }}</p>
          </template>

          <!-- prompts, memory and structured values: a code diff -->
          <div v-else-if="codeDiff(item)" class="ch-diff__code">
            <CodeDiff :theme="theme" :old-string="item.beforeText" :new-string="item.afterText" :language="diffLanguage(item)"
              :output-format="narrow ? 'line-by-line' : 'side-by-side'" diff-style="word" :context="8" max-height="320px"
              :filename="item.beforeTitle" :new-filename="item.afterTitle" />
          </div>

          <!-- one value -->
          <div v-else-if="item.single" class="ch-diff__one">
            <div v-if="item.displayType === 'markdown'" class="ch-md" v-html="text.markdown(item.afterValue)"></div>
            <pre v-else class="ch-diff__text">{{ item.afterText }}</pre>
          </div>

          <!-- before and after -->
          <div v-else class="ch-diff__pair">
            <div class="ch-diff__pane">
              <p class="ch-diff__title">{{ item.beforeTitle }}</p>
              <div v-if="item.displayType === 'markdown'" class="ch-md" v-html="text.markdown(item.beforeValue)"></div>
              <pre v-else class="ch-diff__text">{{ item.beforeText }}</pre>
            </div>
            <div class="ch-diff__pane is-after">
              <p class="ch-diff__title">{{ item.afterTitle }}</p>
              <div v-if="item.displayType === 'markdown'" class="ch-md" v-html="text.markdown(item.afterValue)"></div>
              <pre v-else class="ch-diff__text">{{ item.afterText }}</pre>
            </div>
          </div>
        </section>
      </template>
      <TbEmpty v-else :title="$t('agentSnapshot.noChangedContent')" />

      <div v-if="mode === 'restore' && restorePreviewSnapshot" class="ch-snap__notes">
        <p class="ch-note"><TbIcon name="info" :size="18" /><span>{{ $t('agentSnapshot.restoreConfirm', { version: num(restoreTargetVersion) }) }}</span></p>
        <p class="ch-note"><TbIcon name="warning" :size="18" /><span>{{ $t('agentSnapshot.unsavedChangesWarning') }}</span></p>
        <p v-if="clearsHistory" class="ch-note is-danger" role="alert"><TbIcon name="warning" :size="18" /><span>{{ $t('agentSnapshot.restoreMemoryDestructiveWarning') }}</span></p>
      </div>
    </div>

    <template v-if="mode === 'restore'" #footer>
      <TbButton :disabled="restoring" @click="backToList">{{ $t('common.cancel') }}</TbButton>
      <TbButton :variant="clearsHistory ? 'danger' : 'primary'" icon="history" :loading="restoring"
        :disabled="restoring || restorePreviewLoading || !restorePreviewSnapshot || items.length === 0" @click="confirmRestoreSnapshot">
        {{ $t('agentSnapshot.confirmRestore') }}
      </TbButton>
    </template>
  </TbSheet>
</template>

<script>
import { CodeDiff, hljs } from 'v-code-diff/vue3';
import markdown from 'highlight.js/lib/languages/markdown';
import Api from '@/apis/api';
import correctWord from '@/apis/module/correctWord';
import { digits } from '@/kit/calendar';
import { hasValidCurrentStateToken } from './snapshotDisplay.mjs';
import {
  codeDiffLanguage, createSnapshotText, isPlainObject, restoreClearsHistory, SNAPSHOT_MODEL_TYPES, useCodeDiff, versionRangeTitle,
} from './snapshotModel';
import { parsePluginFields } from './characterModel';

try { hljs.registerLanguage('markdown', markdown); } catch (e) { /* already registered */ }

// Version history of one character: list, view a version against the one before it, restore one
// (with a preview of what changes and the chat-history warning), delete one. Behaviour of the
// legacy AgentSnapshotDialog, in one sheet that switches between its views.
export default {
  name: 'SnapshotSheet',
  components: { CodeDiff },
  props: {
    open: Boolean,
    agentId: { type: String, required: true },
    currentVersionNo: { type: Number, default: null },
  },
  emits: ['update:open', 'restored'],
  data() {
    return {
      mode: 'list',
      loading: false,
      failed: false,
      detailLoading: false,
      restorePreviewLoading: false,
      restoring: false,
      snapshots: [],
      currentSnapshot: null,
      restorePreviewSnapshot: null,
      restorePreviewRow: null,
      deletingSnapshotId: null,
      meta: { plugins: {}, models: {}, voices: {}, words: {} },
      pluginMetadataLoaded: false,
      pluginMetadataLoading: null,
      modelMetadataLoaded: false,
      modelMetadataLoading: null,
      voiceMetadataLoading: {},
      loadedVoiceModelIds: {},
      correctWordMetadataLoaded: false,
      correctWordMetadataLoading: null,
      snapshotFetchSeq: 0,
      detailFetchSeq: 0,
      restorePreviewFetchSeq: 0,
      restoreActionSeq: 0,
      deleteActionSeq: 0,
      historyAnchorVersionNo: null,
      historyTotal: 0,
      page: 1,
      limit: 10,
      total: 0,
      theme: 'light',
      narrow: false,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    text() {
      void this.lang;
      return createSnapshotText({ t: (k, p) => this.$t(k, p), te: (k) => this.$te(k) || this.$te(k, 'en'), meta: this.meta });
    },
    columns() {
      return [
        { key: 'versionNo', label: this.$t('agentSnapshot.version'), width: '120px' },
        { key: 'createdAt', label: this.$t('agentSnapshot.createdAt'), width: '170px' },
        { key: 'source', label: this.$t('agentSnapshot.source'), width: '130px' },
        { key: 'changedFields', label: this.$t('agentSnapshot.changedFields') },
        { key: 'actions', label: this.$t('agentSnapshot.actions'), align: 'right' },
      ];
    },
    title() {
      if (this.mode === 'detail') {
        const s = this.currentSnapshot;
        return s ? versionRangeTitle(this.$t('agentSnapshot.detailTitle'), this.num(s.beforeVersionNo), this.num(s.afterVersionNo || s.versionNo))
          : this.$t('agentSnapshot.detailTitle');
      }
      if (this.mode === 'restore') {
        const s = this.restorePreviewSnapshot;
        if (!s) return this.$t('agentSnapshot.restorePreviewTitle');
        return versionRangeTitle(this.$t('agentSnapshot.restorePreviewTitle'), this.num(s.beforeVersionNo || this.resolveCurrentVersionNo()),
          this.num(s.afterVersionNo || s.versionNo));
      }
      return this.$t('agentSnapshot.title');
    },
    busy() { return this.mode === 'detail' ? this.detailLoading : this.restorePreviewLoading; },
    shown() { return this.mode === 'detail' ? this.currentSnapshot : this.restorePreviewSnapshot; },
    items() {
      if (this.mode === 'detail') {
        const s = this.currentSnapshot;
        if (!s) return [];
        if (s.isSingleSnapshot) return this.text.singleItems(s.snapshotData || {}, s.fieldOrder || []);
        if (!(s.afterSnapshotData && Object.keys(s.afterSnapshotData).length)) return [];
        return this.text.diffItems(s.snapshotData || {}, s.afterSnapshotData || {}, s.changedFields, {
          beforeLabel: this.$t('agentSnapshot.beforeChange'), afterLabel: this.$t('agentSnapshot.afterChange'),
          beforeVersionNo: s.beforeVersionNo, afterVersionNo: s.afterVersionNo || s.versionNo,
          fieldOrder: s.fieldOrder, forceCompare: Boolean(s.forceCompare),
        });
      }
      if (this.mode === 'restore') {
        const s = this.restorePreviewSnapshot;
        if (!s) return [];
        return this.text.diffItems(s.beforeSnapshotData || {}, s.afterSnapshotData || {}, [], {
          beforeLabel: this.$t('agentSnapshot.beforeRestore'), afterLabel: this.$t('agentSnapshot.afterRestore'),
          beforeVersionNo: s.beforeVersionNo || this.resolveCurrentVersionNo(), afterVersionNo: s.afterVersionNo || s.versionNo,
          fieldOrder: s.fieldOrder, forceCompare: true,
        });
      }
      return [];
    },
    clearsHistory() { return restoreClearsHistory(this.restorePreviewSnapshot); },
    restoreTargetVersion() { return this.restorePreviewSnapshot?.versionNo || this.restorePreviewRow?.versionNo || ''; },
  },
  watch: {
    open(v) { if (v) this.start(); else this.cancelPendingSnapshotRequests(); },
    currentVersionNo(n, o) {
      if (this.open && n !== o) { this.historyAnchorVersionNo = null; this.fetchSnapshots({ clearTable: false }); }
    },
  },
  created() {
    this.readTheme();
    this.onTheme = () => this.readTheme();
    window.addEventListener('app-theme-changed', this.onTheme);
    this.mq = window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
    this.onMq = () => { this.narrow = Boolean(this.mq?.matches); };
    this.onMq();
    this.mq?.addEventListener?.('change', this.onMq);
    if (this.open) this.start();
  },
  beforeUnmount() {
    window.removeEventListener('app-theme-changed', this.onTheme);
    this.mq?.removeEventListener?.('change', this.onMq);
    this.cancelPendingSnapshotRequests();
  },
  methods: {
    num(n) { return n === null || n === undefined || n === '' ? '' : digits(n, this.lang); },
    when(value) {
      if (!value) return this.$t('agentSnapshot.emptyValue');
      const d = new Date(typeof value === 'string' ? value.replace(' ', 'T') : value);
      if (Number.isNaN(d.getTime())) return String(value);
      return new Intl.DateTimeFormat(this.lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
    },
    readTheme() {
      const root = document.documentElement;
      this.theme = root.dataset.theme === 'dark' || root.classList.contains('dark') ? 'dark' : 'light';
    },
    codeDiff(item) { return useCodeDiff(item); },
    diffLanguage(item) { return codeDiffLanguage(item); },
    start() {
      this.mode = 'list';
      this.historyAnchorVersionNo = null;
      this.page = 1;
      this.fetchSnapshots();
    },
    onOpen(v) {
      if (v) return;
      if (this.restoring) return;
      this.$emit('update:open', false);
    },
    backToList() {
      if (this.restoring) return;
      this.detailFetchSeq += 1;
      this.restorePreviewFetchSeq += 1;
      this.restorePreviewSnapshot = null;
      this.restorePreviewRow = null;
      this.mode = 'list';
    },
    cancelPendingSnapshotRequests() {
      this.snapshotFetchSeq += 1;
      this.detailFetchSeq += 1;
      this.restorePreviewFetchSeq += 1;
      this.restoreActionSeq += 1;
      this.deleteActionSeq += 1;
      this.loading = false;
      this.detailLoading = false;
      this.restorePreviewLoading = false;
      this.restoring = false;
      this.deletingSnapshotId = null;
    },
    snapshotQueryParams(params = {}) {
      return this.historyAnchorVersionNo ? { ...params, maxVersionNo: String(this.historyAnchorVersionNo) } : params;
    },
    fetchSnapshots(options = {}) {
      if (!this.agentId) { this.snapshots = []; this.total = 0; this.historyTotal = 0; return; }
      const { clearTable = true } = options;
      const seq = ++this.snapshotFetchSeq;
      const start = (this.page - 1) * this.limit;
      const end = start + this.limit;
      const fetchLimit = Math.max(end + 1, this.limit, 1);
      this.ensurePluginMetadata();
      this.ensureModelMetadata();
      this.loading = true;
      this.failed = false;
      if (clearTable) this.snapshots = [];
      Api.agent.getAgentSnapshots(this.agentId, this.snapshotQueryParams({ page: '1', limit: String(fetchLimit) }), ({ data }) => {
        if (seq !== this.snapshotFetchSeq) return;
        this.loading = false;
        if (data.code === 0) {
          const rows = (data.data?.list || []).map((row, i) => ({ ...row, isLatestSnapshot: i === 0 }));
          if (!this.historyAnchorVersionNo && rows[0]?.versionNo) this.historyAnchorVersionNo = Number(rows[0].versionNo);
          this.historyTotal = data.data?.total || 0;
          this.total = this.historyTotal;
          this.snapshots = this.applyPreviousChangedFields(rows.slice(start, end), rows);
        } else {
          this.failed = true;
          this.$message.error(data.msg || this.$t('agentSnapshot.fetchFailed'));
        }
      }, () => {
        if (seq !== this.snapshotFetchSeq) return;
        this.loading = false;
        this.failed = true;
        this.$message.error(this.$t('agentSnapshot.fetchFailed'));
      });
    },
    handlePageChange(p) { this.page = p; this.fetchSnapshots(); },
    applyPreviousChangedFields(rows, source) {
      return rows.map((row) => {
        if (!Number.isFinite(Number(row.versionNo))) return { ...row, changedFields: row.changedFields || [] };
        const prev = this.findPreviousSnapshotRow(row, source);
        return { ...row, previousSnapshotId: prev?.id || null, previousVersionNo: prev?.versionNo || null, changedFields: row.changedFields || [] };
      });
    },
    findPreviousSnapshotRow(row, source) {
      const v = Number(row?.versionNo);
      if (!Number.isFinite(v)) return null;
      return (source || []).find((x) => Number(x.versionNo) < v) || null;
    },
    viewSnapshot(row) {
      if (!row?.id) return;
      this.mode = 'detail';
      this.detailLoading = true;
      this.currentSnapshot = null;
      const seq = ++this.detailFetchSeq;
      this.ensurePluginMetadata();
      this.ensureModelMetadata();
      this.buildSavedVersionDiffSnapshot(row)
        .then((s) => this.ensureDisplayMetadata(s).then(() => s))
        .then((s) => { if (seq === this.detailFetchSeq) this.currentSnapshot = s; })
        .catch(() => { if (seq === this.detailFetchSeq) this.$message.error(this.$t('agentSnapshot.detailFailed')); })
        .finally(() => { if (seq === this.detailFetchSeq) this.detailLoading = false; });
    },
    restoreSnapshot(row) {
      if (!row?.id || row.isLatestSnapshot) return;
      this.mode = 'restore';
      this.restorePreviewLoading = true;
      this.restorePreviewRow = row;
      this.restorePreviewSnapshot = null;
      const seq = ++this.restorePreviewFetchSeq;
      this.ensurePluginMetadata();
      this.ensureModelMetadata();
      this.fetchSnapshotDetail(row.id).then((target) => {
        if (seq !== this.restorePreviewFetchSeq) return undefined;
        if (!isPlainObject(target.currentSnapshotData) || !hasValidCurrentStateToken(target.currentStateToken)) {
          throw new Error('Snapshot detail is missing its atomic current-state preview');
        }
        const preview = {
          ...target,
          currentStateToken: target.currentStateToken,
          beforeSnapshotData: target.currentSnapshotData,
          afterSnapshotData: target.snapshotData || {},
          beforeVersionNo: this.resolveCurrentVersionNo(),
          afterVersionNo: target.versionNo,
          fieldOrder: target.fieldOrder || [],
        };
        return this.ensureDisplayMetadata(preview).then(() => { if (seq === this.restorePreviewFetchSeq) this.restorePreviewSnapshot = preview; });
      }).catch(() => {
        if (seq !== this.restorePreviewFetchSeq) return;
        this.mode = 'list';
        this.$message.error(this.$t('agentSnapshot.detailFailed'));
      }).finally(() => { if (seq === this.restorePreviewFetchSeq) this.restorePreviewLoading = false; });
    },
    confirmRestoreSnapshot() {
      if (this.restoring || !this.restorePreviewRow) return;
      const snapshotId = this.restorePreviewRow.id;
      const token = this.restorePreviewSnapshot?.currentStateToken;
      if (!hasValidCurrentStateToken(token)) {
        this.invalidateRestorePreview();
        this.$message.error(this.$t('agentSnapshot.restoreFailed'));
        return;
      }
      if (!this.clearsHistory) { this.submitRestoreSnapshot(snapshotId, token); return; }
      this.restoring = true;
      const seq = ++this.restoreActionSeq;
      this.$confirm(this.$t('agentSnapshot.restoreMemoryDestructiveWarning'), this.$t('character.history.eraseTitle'), {
        confirmText: this.$t('character.history.eraseConfirm'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        if (seq !== this.restoreActionSeq) return;
        this.submitRestoreSnapshot(snapshotId, token, seq);
      }).catch(() => { if (seq === this.restoreActionSeq) this.restoring = false; });
    },
    submitRestoreSnapshot(snapshotId, token, confirmedSeq = null) {
      if (!hasValidCurrentStateToken(token)) {
        this.restoring = false;
        this.invalidateRestorePreview();
        this.$message.error(this.$t('agentSnapshot.restoreFailed'));
        return;
      }
      const seq = confirmedSeq ?? ++this.restoreActionSeq;
      if (seq !== this.restoreActionSeq) return;
      this.restoring = true;
      Api.agent.restoreAgentSnapshot(this.agentId, snapshotId, token, ({ data }) => {
        if (seq !== this.restoreActionSeq) return;
        this.restoring = false;
        if (data.code === 0) {
          this.$message.success(this.$t('agentSnapshot.restoreSuccess'));
          this.restorePreviewSnapshot = null;
          this.restorePreviewRow = null;
          this.mode = 'list';
          this.$emit('restored');
          this.historyAnchorVersionNo = null;
          this.fetchSnapshots();
        } else {
          this.invalidateRestorePreview();
          this.$message.error(data?.msg ? `${this.$t('agentSnapshot.restoreFailedRollback')}: ${data.msg}` : this.$t('agentSnapshot.restoreFailedRollback'));
        }
      }, () => {
        if (seq !== this.restoreActionSeq) return;
        this.restoring = false;
        this.invalidateRestorePreview();
        this.$message.error(this.$t('agentSnapshot.restoreFailed'));
      });
    },
    invalidateRestorePreview() {
      this.restorePreviewFetchSeq += 1;
      this.restorePreviewLoading = false;
      this.restorePreviewSnapshot = null;
      this.restorePreviewRow = null;
      this.mode = 'list';
    },
    deleteSnapshot(row) {
      if (!row || row.isLatestSnapshot) return;
      this.$confirm(this.$t('agentSnapshot.deleteConfirm', { version: this.num(row.versionNo) }), this.$t('character.history.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        const seq = ++this.deleteActionSeq;
        this.deletingSnapshotId = row.id;
        Api.agent.deleteAgentSnapshot(this.agentId, row.id, ({ data }) => {
          if (seq !== this.deleteActionSeq) return;
          this.deletingSnapshotId = null;
          if (data.code === 0) {
            this.$message.success(this.$t('agentSnapshot.deleteSuccess'));
            if (this.snapshots.length <= 1 && this.page > 1) this.page -= 1;
            this.fetchSnapshots();
          } else this.$message.error(data.msg || this.$t('agentSnapshot.deleteFailed'));
        }, () => {
          if (seq !== this.deleteActionSeq) return;
          this.deletingSnapshotId = null;
          this.$message.error(this.$t('agentSnapshot.deleteFailed'));
        });
      }).catch(() => {});
    },
    resolveCurrentVersionNo() {
      const v = Number(this.currentVersionNo);
      if (Number.isFinite(v) && v > 0) return v;
      const latest = this.snapshots.find((x) => x.isLatestSnapshot) || this.snapshots[0];
      return latest?.versionNo || null;
    },
    fetchSnapshotDetail(id) {
      return new Promise((resolve, reject) => {
        Api.agent.getAgentSnapshot(this.agentId, id, ({ data }) => (data.code === 0 ? resolve(data.data) : reject(data)), reject);
      });
    },
    fetchSnapshotRows(params) {
      return new Promise((resolve, reject) => {
        Api.agent.getAgentSnapshots(this.agentId, this.snapshotQueryParams(params),
          ({ data }) => (data.code === 0 ? resolve(data.data || { list: [], total: 0 }) : reject(data)), reject);
      });
    },
    buildSavedVersionDiffSnapshot(row) {
      const v = Number(row.versionNo);
      const shownNo = Number.isFinite(v) ? v : row.versionNo;
      return this.fetchSnapshotDetail(row.id).then((selected) => {
        if (!this.hasPreviousSnapshot(row)) return this.buildSingleSnapshotDetail(selected, row, shownNo);
        return this.fetchPreviousSnapshotDetail(row).then((prev) => {
          if (!prev?.id) return this.buildSingleSnapshotDetail(selected, row, shownNo);
          const adjacent = Number.isFinite(Number(prev.versionNo)) && Number.isFinite(Number(shownNo)) && Number(shownNo) - Number(prev.versionNo) === 1;
          return {
            ...selected,
            versionNo: shownNo,
            changedFields: adjacent ? (selected.changedFields || row.changedFields || []) : [],
            forceCompare: !adjacent,
            snapshotData: prev.snapshotData || {},
            afterSnapshotData: selected.snapshotData || {},
            beforeVersionNo: prev.versionNo,
            afterVersionNo: shownNo,
            fieldOrder: selected.fieldOrder || prev.fieldOrder || row.fieldOrder || [],
          };
        });
      });
    },
    buildSingleSnapshotDetail(selected, row, shownNo) {
      return {
        ...selected,
        versionNo: shownNo,
        isSingleSnapshot: true,
        changedFields: selected.changedFields || row.changedFields || [],
        snapshotData: selected.snapshotData || {},
        afterSnapshotData: selected.snapshotData || {},
        afterVersionNo: shownNo,
        fieldOrder: selected.fieldOrder || row.fieldOrder || [],
      };
    },
    hasPreviousSnapshot(row) {
      const v = Number(row?.versionNo);
      return !!(row?.previousSnapshotId || row?.previousVersionNo || (Number.isFinite(v) && v > 1));
    },
    fetchPreviousSnapshotDetail(row) {
      if (row?.previousSnapshotId) return this.fetchSnapshotDetail(row.previousSnapshotId).catch(() => this.fetchPreviousWithoutId(row));
      return this.fetchPreviousWithoutId(row);
    },
    fetchPreviousWithoutId(row) {
      if (row?.previousVersionNo) return this.fetchSnapshotDetailByVersion(row.previousVersionNo).catch(() => this.fetchNearestPrevious(row));
      return this.fetchNearestPrevious(row);
    },
    fetchNearestPrevious(row) {
      return this.fetchSnapshotRowBeforeVersion(row?.versionNo).then((prev) => (prev?.id ? this.fetchSnapshotDetail(prev.id).catch(() => null) : null));
    },
    fetchSnapshotDetailByVersion(versionNo) {
      return this.fetchSnapshotRowByVersion(versionNo).then((row) => (row?.id ? this.fetchSnapshotDetail(row.id) : Promise.reject(new Error('snapshot not found'))));
    },
    fetchSnapshotRowByVersion(versionNo) {
      const v = Number(versionNo);
      if (!Number.isFinite(v) || v < 1) return Promise.resolve(null);
      const cached = this.snapshots.find((x) => Number(x.versionNo) === v);
      if (cached) return Promise.resolve(cached);
      const pageNo = this.historyTotal > 0 ? Math.max(Math.floor((this.historyTotal - v) / this.limit) + 1, 1) : 1;
      return this.fetchSnapshotRows({ page: String(pageNo), limit: String(this.limit) }).then((data) => {
        const row = (data.list || []).find((x) => Number(x.versionNo) === v);
        if (row || !this.historyTotal || this.historyTotal <= this.limit) return row || null;
        return this.fetchSnapshotRows({ page: '1', limit: String(this.historyTotal) })
          .then((all) => (all.list || []).find((x) => Number(x.versionNo) === v) || null);
      });
    },
    fetchSnapshotRowBeforeVersion(versionNo) {
      const cached = this.findPreviousSnapshotRow({ versionNo }, this.snapshots);
      if (cached) return Promise.resolve(cached);
      return this.fetchSnapshotRows({ page: '1', limit: String(Math.max(this.historyTotal, this.limit, 1)) })
        .then((data) => this.findPreviousSnapshotRow({ versionNo }, data.list || []));
    },
    ensurePluginMetadata() {
      if (this.pluginMetadataLoaded) return Promise.resolve();
      if (this.pluginMetadataLoading) return this.pluginMetadataLoading;
      this.pluginMetadataLoading = new Promise((resolve) => {
        Api.model.getPluginFunctionList(null, ({ data }) => {
          if (data.code === 0) {
            const plugins = {};
            (data.data || []).forEach((item) => { plugins[item.id] = { ...item, fieldsMeta: parsePluginFields(item.fields) }; });
            this.meta = { ...this.meta, plugins };
            this.pluginMetadataLoaded = true;
          }
          resolve();
        }, () => { this.pluginMetadataLoaded = true; resolve(); });
      }).finally(() => { this.pluginMetadataLoading = null; });
      return this.pluginMetadataLoading;
    },
    ensureModelMetadata() {
      if (this.modelMetadataLoaded) return Promise.resolve();
      if (this.modelMetadataLoading) return this.modelMetadataLoading;
      const fetchers = SNAPSHOT_MODEL_TYPES.map((type) => new Promise((resolve) => {
        const cb = ({ data }) => resolve(data.code === 0 ? (data.data || []).map((x) => ({ id: x.id, name: x.modelName })) : []);
        if (type === 'LLM') Api.model.getLlmModelCodeList('', cb, () => resolve([]));
        else Api.model.getModelNames(type, '', cb, () => resolve([]));
      }));
      this.modelMetadataLoading = Promise.all(fetchers).then((groups) => {
        const models = {};
        groups.flat().forEach((x) => { if (x.id) models[x.id] = x.name || x.id; });
        this.meta = { ...this.meta, models };
        this.modelMetadataLoaded = true;
      }).finally(() => { this.modelMetadataLoading = null; });
      return this.modelMetadataLoading;
    },
    ensureDisplayMetadata(s) {
      const before = s.beforeSnapshotData || s.snapshotData || {};
      const after = s.afterSnapshotData || {};
      return Promise.all([this.ensureModelMetadata(), this.ensureVoiceMetadataForData(before, after), this.ensureCorrectWordMetadataForData(before, after)]);
    },
    ensureCorrectWordMetadataForData(...list) {
      return list.some((d) => Array.isArray(d?.correctWordFileIds) && d.correctWordFileIds.length > 0) ? this.ensureCorrectWordMetadata() : Promise.resolve();
    },
    ensureCorrectWordMetadata() {
      if (this.correctWordMetadataLoaded) return Promise.resolve();
      if (this.correctWordMetadataLoading) return this.correctWordMetadataLoading;
      this.correctWordMetadataLoading = new Promise((resolve) => {
        correctWord.selectAll(({ data }) => {
          if (data.code === 0) {
            const words = {};
            (data.data || []).forEach((x) => { if (x.id) words[x.id] = x.fileName || x.id; });
            this.meta = { ...this.meta, words };
            this.correctWordMetadataLoaded = true;
          }
          resolve();
        }, () => {
          // Without permission the ids stay as they are; no wider access is asked for.
          this.correctWordMetadataLoaded = true;
          resolve();
        });
      }).finally(() => { this.correctWordMetadataLoading = null; });
      return this.correctWordMetadataLoading;
    },
    ensureVoiceMetadataForData(...list) {
      const ids = Array.from(new Set(list.map((d) => d && d.ttsModelId).filter(Boolean)));
      return Promise.all(ids.map((id) => this.ensureVoiceMetadata(id)));
    },
    ensureVoiceMetadata(modelId) {
      if (!modelId || this.loadedVoiceModelIds[modelId]) return Promise.resolve();
      if (this.voiceMetadataLoading[modelId]) return this.voiceMetadataLoading[modelId];
      const p = new Promise((resolve) => {
        Api.model.getModelVoices(modelId, '', ({ data }) => {
          if (data.code === 0) {
            const voices = { ...this.meta.voices };
            (data.data || []).forEach((v) => {
              if (v.id) { voices[v.id] = v.name || v.id; voices[`${modelId}:${v.id}`] = v.name || v.id; }
            });
            this.meta = { ...this.meta, voices };
            this.loadedVoiceModelIds = { ...this.loadedVoiceModelIds, [modelId]: true };
          }
          resolve();
        }, () => { this.loadedVoiceModelIds = { ...this.loadedVoiceModelIds, [modelId]: true }; resolve(); });
      }).finally(() => {
        const { [modelId]: dropped, ...rest } = this.voiceMetadataLoading;
        void dropped;
        this.voiceMetadataLoading = rest;
      });
      this.voiceMetadataLoading = { ...this.voiceMetadataLoading, [modelId]: p };
      return p;
    },
  },
};
</script>

<style>
.ch-snap { display: grid; gap: var(--tb-s4); min-width: 0; }
.ch-snap__lead { color: var(--tb-ink-2); font-size: var(--tb-fs-14); max-width: 70ch; }
.ch-snap__ver { font-family: var(--tb-font-display); font-weight: 700; }
.ch-snap__now { margin-left: 8px; }
.ch-snap .tb-table tr.is-current td:first-child { box-shadow: inset 3px 0 0 var(--tb-orange); }
.ch-snap__fields { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.ch-snap__none { color: var(--tb-ink-3); }
.ch-snap__acts { display: inline-flex; gap: 2px; flex-wrap: wrap; justify-content: flex-end; }
.ch-snap__del { color: var(--tb-danger); }
.ch-snap__fail { display: flex; align-items: center; gap: 8px; color: var(--tb-danger); font-size: var(--tb-fs-14); }
.ch-snap__back { justify-self: start; margin-left: -10px; }
.ch-snap__state { display: grid; place-items: center; padding: var(--tb-s8) 0; }
.ch-snap__meta { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; padding-bottom: 10px; border-bottom: var(--tb-rule-band) solid var(--tb-rule); color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.ch-snap__meta b { font-family: var(--tb-font-display); font-size: var(--tb-fs-24); color: var(--tb-ink); }
.ch-snap__notes { display: grid; gap: 0; border-top: 1px solid var(--tb-rule); }
.ch-note { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--tb-rule-soft); font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.ch-note .tb-icon { flex: none; margin-top: 2px; }
.ch-note.is-danger { color: var(--tb-danger); font-weight: 600; }

.ch-diff { display: grid; gap: 8px; padding-bottom: var(--tb-s4); border-bottom: 1px solid var(--tb-rule-soft); min-width: 0; }
.ch-diff__field { font-size: var(--tb-fs-16); }
.ch-diff__pair { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--tb-rule-soft); border-radius: var(--tb-radius-s); }
.ch-diff__pane { padding: 10px 12px; min-width: 0; }
.ch-diff__pane.is-after { border-left: 1px solid var(--tb-rule-soft); }
.ch-diff__title { font-size: var(--tb-fs-12); font-weight: 700; color: var(--tb-ink-2); margin-bottom: 4px; }
.ch-diff__text { margin: 0; white-space: pre-wrap; word-break: break-word; font: inherit; font-size: var(--tb-fs-14); }
.ch-diff__one { padding: 10px 12px; border: 1px solid var(--tb-rule-soft); border-radius: var(--tb-radius-s); }
.ch-diff__empty { color: var(--tb-ink-3); font-size: var(--tb-fs-14); }
.ch-md { font-size: var(--tb-fs-14); display: grid; gap: 6px; }
.ch-md h1, .ch-md h2, .ch-md h3, .ch-md h4 { font-size: var(--tb-fs-15); }
.ch-md ul, .ch-md ol { margin: 0; padding-left: 20px; }
.ch-md code { font-size: .92em; background: var(--tb-paper-2); padding: 0 4px; border-radius: 4px; }
.ch-md-empty { color: var(--tb-ink-3); }
.ch-diff__fns { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.ch-fn { display: grid; gap: 8px; padding: 10px 0; border-top: 1px solid var(--tb-rule-soft); }
.ch-fn:first-child { border-top: 0; padding-top: 0; }
.ch-fn__head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ch-fn__sides { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ch-fn__side { min-width: 0; padding: 8px 10px; border: 1px solid var(--tb-rule-soft); border-radius: var(--tb-radius-s); }
.ch-fn__side.is-off { color: var(--tb-ink-3); }
.ch-fn__title { display: flex; justify-content: space-between; gap: 8px; font-size: var(--tb-fs-12); font-weight: 700; color: var(--tb-ink-2); }
.ch-fn__params { display: grid; grid-template-columns: minmax(90px, 40%) 1fr; gap: 2px 10px; margin: 6px 0 0; font-size: var(--tb-fs-13); }
.ch-fn__params dt { color: var(--tb-ink-2); }
.ch-fn__params dd { margin: 0; word-break: break-word; }
.ch-fn__params .is-changed { font-weight: 700; color: var(--tb-ink); }
.ch-fn__note { font-size: var(--tb-fs-13); color: var(--tb-ink-3); }

/* the code diff, drawn in the world's inks */
.ch-diff__code { min-width: 0; }
.ch-diff__code .code-diff-view[theme] {
  margin: 0; border: 1px solid var(--tb-rule-soft); border-radius: var(--tb-radius-s);
  --fgColor-default: var(--tb-ink); --bgColor-default: var(--tb-paper);
  --color-fg-default: var(--tb-ink); --color-fg-subtle: var(--tb-ink-3); --color-canvas-default: var(--tb-paper); --color-canvas-subtle: var(--tb-paper-2);
  --color-border-default: var(--tb-rule-soft); --color-border-muted: var(--tb-rule-soft); --color-neutral-subtle: var(--tb-paper-2);
  --color-accent-subtle: var(--tb-paper-2); --color-diff-blob-hunk-num-bg: var(--tb-paper-2);
  --color-diff-blob-addition-num-text: var(--tb-ink); --color-diff-blob-addition-fg: var(--tb-ink);
  --color-diff-blob-addition-num-bg: color-mix(in srgb, var(--tb-prayer) 18%, var(--tb-paper));
  --color-diff-blob-addition-line-bg: color-mix(in srgb, var(--tb-prayer) 9%, var(--tb-paper));
  --color-diff-blob-addition-word-bg: color-mix(in srgb, var(--tb-prayer) 26%, var(--tb-paper));
  --color-diff-blob-deletion-num-text: var(--tb-ink); --color-diff-blob-deletion-fg: var(--tb-ink);
  --color-diff-blob-deletion-num-bg: color-mix(in srgb, var(--tb-alarm) 16%, var(--tb-paper));
  --color-diff-blob-deletion-line-bg: color-mix(in srgb, var(--tb-alarm) 8%, var(--tb-paper));
  --color-diff-blob-deletion-word-bg: color-mix(in srgb, var(--tb-alarm) 24%, var(--tb-paper));
  --color-diffstat-addition-bg: var(--tb-ok); --color-danger-emphasis: var(--tb-danger); --color-success-emphasis: var(--tb-ok);
}
.ch-diff__code .code-diff-view[theme] .hljs { color: var(--tb-ink); background: transparent; }
.ch-diff__code .code-diff-view .file-header { font-family: var(--tb-font-text); }

@media (max-width: 760px) {
  .ch-diff__pair, .ch-fn__sides { grid-template-columns: 1fr; }
  .ch-diff__pane.is-after { border-left: 0; border-top: 1px solid var(--tb-rule-soft); }
}
</style>
