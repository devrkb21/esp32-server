<template>
  <div class="dict">
    <TbPageHeader :title="$t('system.dict.title')" :description="$t('system.dict.desc')" />

    <div class="dict__grid">
      <!-- Types: pick one to see its values -->
      <section class="dict__pane dict__types" aria-labelledby="dict-types-h">
        <header class="dict__head">
          <h2 id="dict-types-h" class="dict__h">{{ $t('system.dict.types') }}
            <span class="dict__count tb-num">{{ num(typeList.length) }}</span></h2>
          <span class="dict__tools">
            <TbButton size="s" variant="danger" icon="trash" :disabled="!checkedTypes.length || busy"
              :aria-label="checkedTypes.length ? $t('system.dict.deleteTypesNamed', { n: num(checkedTypes.length) }) : $t('system.deleteSelected')"
              :title="$t('system.deleteSelected')" @click="deleteTypes"><template v-if="checkedTypes.length">{{ num(checkedTypes.length) }}</template></TbButton>
            <TbButton size="s" icon="plus" @click="openAddType">{{ $t('system.dict.addType') }}</TbButton>
          </span>
        </header>
        <TbTable v-model:selected="checkedTypes" class="dict__typetable sys-table" dense selectable row-key="id" :columns="typeColumns"
          :rows="typeList" :loading="typeLoading" :row-class="typeRowClass" :caption="$t('system.dict.types')"
          :loading-text="$t('system.dict.typesLoading')" :select-all-label="$t('system.dict.selectAllTypes')"
          :select-row-label="$t('system.selectRow')" @row-click="pickType">
          <template #cell-dictName="{ row }">
            <button type="button" class="dict__pick" :aria-current="isCurrent(row) ? 'true' : null" @click.stop="pickType(row)">
              <span class="dict__name">{{ row.dictName }}</span>
              <small class="dict__code">{{ row.dictType }}</small>
            </button>
          </template>
          <template #cell-actions="{ row }">
            <TbButton size="s" variant="quiet" icon="edit" :aria-label="$t('system.dict.editTypeNamed', { name: row.dictName })"
              @click.stop="openEditType(row)" />
          </template>
          <template #empty>
            <TbEmpty v-if="typeFailed" face="confused" :title="$t('system.loadFailed')">
              <TbButton icon="refresh" @click="loadTypes">{{ $t('common.retry') }}</TbButton>
            </TbEmpty>
            <TbEmpty v-else face="sleepy" :title="$t('system.dict.noTypes')" :text="$t('system.dict.noTypesText')">
              <TbButton variant="primary" icon="plus" @click="openAddType">{{ $t('system.dict.addType') }}</TbButton>
            </TbEmpty>
          </template>
        </TbTable>
      </section>

      <!-- Values of the chosen type -->
      <section class="dict__pane dict__values" aria-labelledby="dict-values-h">
        <header class="dict__head">
          <div class="dict__htext">
            <h2 id="dict-values-h" class="dict__h">
              <i v-if="current" class="dict__mark" aria-hidden="true"></i>{{ current ? current.dictName : $t('system.dict.values') }}</h2>
            <small v-if="current" class="dict__code">{{ current.dictType }}</small>
          </div>
          <TbButton variant="primary" icon="plus" :disabled="!current" @click="openAddData">{{ $t('system.dict.addValue') }}</TbButton>
        </header>

        <form class="sys-filter__search dict__search" role="search" @submit.prevent="search">
          <TbInput v-model="query" icon="search" clearable :disabled="!current" :placeholder="$t('system.dict.searchPlaceholder')"
            :aria-label="$t('system.dict.searchLabel')" :clear-label="$t('system.clearSearch')" :maxlength="100" @clear="search" />
          <TbButton native-type="submit" :disabled="!current">{{ $t('common.search') }}</TbButton>
        </form>

        <div class="sys-bar" role="toolbar" :aria-label="$t('system.batchLabel')">
          <TbCheckbox :model-value="allData" :indeterminate="checkedData.length > 0 && !allData" :disabled="!dataList.length || busy"
            @update:model-value="toggleAllData">{{ checkedData.length ? $t('system.selected', { n: num(checkedData.length) }) : $t('system.selectAll') }}</TbCheckbox>
          <TbButton class="sys-bar__end" size="s" variant="danger" icon="trash" :disabled="!checkedData.length || busy"
            @click="deleteDataMany">{{ $t('system.deleteSelected') }}</TbButton>
        </div>

        <TbTable v-model:selected="checkedData" class="dict__datatable sys-table" dense selectable row-key="id" :columns="dataColumns"
          :rows="dataList" :loading="dataLoading" :row-class="dataRowClass" :caption="current ? current.dictName : $t('system.dict.values')"
          :loading-text="$t('system.dict.valuesLoading')" :select-all-label="$t('system.selectAll')" :select-row-label="$t('system.selectRow')">
          <template #cell-dictLabel="{ row }"><span class="dict__label">{{ row.dictLabel }}</span></template>
          <template #cell-dictValue="{ row }"><span class="dict__value">{{ row.dictValue }}</span></template>
          <template #cell-sort="{ row }"><span class="tb-num dict__sort">{{ num(row.sort ?? 0) }}</span></template>
          <template #cell-actions="{ row }">
            <span class="sys-acts">
              <TbButton size="s" variant="quiet" icon="edit" @click="openEditData(row)">{{ $t('common.edit') }}</TbButton>
              <TbButton size="s" variant="quiet" icon="trash" class="sys-del" :disabled="busy" @click="deleteDataOne(row)">
                {{ $t('common.delete') }}</TbButton>
            </span>
          </template>
          <template #empty>
            <TbEmpty v-if="!current" :title="$t('system.dict.pickType')" :text="$t('system.dict.pickTypeText')" />
            <TbEmpty v-else-if="dataFailed" face="confused" :title="$t('system.loadFailed')">
              <TbButton icon="refresh" @click="loadData">{{ $t('common.retry') }}</TbButton>
            </TbEmpty>
            <TbEmpty v-else-if="appliedQuery" :title="$t('system.dict.noMatch', { q: appliedQuery })" :text="$t('system.dict.noMatchText')">
              <TbButton icon="close" @click="clearSearch">{{ $t('system.clearSearch') }}</TbButton>
            </TbEmpty>
            <TbEmpty v-else :title="$t('system.dict.noValues')" :text="$t('system.dict.noValuesText')">
              <TbButton variant="primary" icon="plus" @click="openAddData">{{ $t('system.dict.addValue') }}</TbButton>
            </TbEmpty>
          </template>
        </TbTable>

        <TbPagination v-if="current && total > 0" class="dict__pager" :page="page" :page-size="pageSize" :total="total" :sizes="pageSizes"
          :total-text="$t('system.dict.total', { n: num(total) })" :size-suffix="$t('system.perPageSuffix')" :aria-label="$t('system.pages')"
          :prev-label="$t('system.prev')" :next-label="$t('system.next')" :size-label="$t('system.perPage')" @change="onPage" />
      </section>
    </div>

    <DictSheet v-model:open="typeSheet" kind="type" :item="typeForm" :saving="saving" @submit="saveType" />
    <DictSheet v-model:open="dataSheet" kind="data" :item="dataForm" :saving="saving" @submit="saveData" />
  </div>
</template>

<script>
import dictApi from '@/apis/module/dict';
import { digits } from '@/kit/calendar';
import DictSheet from './DictSheet.vue';
import { callWithTimeout, pageAfterDelete } from './systemModel';
import './system.css';

// Dictionaries (back office, super admins; owner: web-system). Behaviour of the legacy
// DictManagement.vue, DictTypeDialog.vue and DictDataDialog.vue: types (up to 100) beside the values
// of the chosen type, paged; search values by label; add, edit, delete one or many of each.
// API: dict.getDictTypeList, addDictType, updateDictType, deleteDictType, getDictDataList,
// addDictData, updateDictData, deleteDictData.
const SLOW_MS = 15000;

export default {
  name: 'DictManagement',
  components: { DictSheet },
  data() {
    return {
      typeList: [],
      typeLoading: false,
      typeFailed: false,
      current: null,
      checkedTypes: [],
      dataList: [],
      dataLoading: false,
      dataFailed: false,
      checkedData: [],
      query: '',
      appliedQuery: '',
      page: 1,
      pageSize: 10,
      pageSizes: [10, 20, 50, 100],
      total: 0,
      typeSheet: false,
      typeForm: null,
      dataSheet: false,
      dataForm: null,
      saving: false,
      busy: false,
      typeSeq: 0,
      dataSeq: 0,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    typeColumns() {
      return [
        { key: 'dictName', label: this.$t('system.dict.typeName') },
        { key: 'actions', label: this.$t('system.actions'), align: 'right', width: '56px' },
      ];
    },
    dataColumns() {
      return [
        { key: 'dictLabel', label: this.$t('system.dict.label') },
        { key: 'dictValue', label: this.$t('system.dict.value') },
        { key: 'sort', label: this.$t('system.dict.sort'), align: 'right', width: '72px' },
        { key: 'actions', label: this.$t('system.actions'), align: 'right', width: '1%' },
      ];
    },
    allData() { return this.dataList.length > 0 && this.checkedData.length === this.dataList.length; },
  },
  created() {
    this.loadTypes();
  },
  beforeUnmount() {
    clearTimeout(this.typeTimer);
    clearTimeout(this.dataTimer);
  },
  methods: {
    num(n) { return digits(n ?? '', this.lang); },
    isCurrent(row) { return !!this.current && this.current.id === row.id; },
    typeRowClass(row) {
      return [this.isCurrent(row) ? 'is-current' : '', this.checkedTypes.includes(row.id) ? 'is-picked' : ''].join(' ');
    },
    dataRowClass(row) { return this.checkedData.includes(row.id) ? 'is-picked' : null; },

    // Types ---------------------------------------------------------------------------------
    loadTypes() {
      const seq = ++this.typeSeq;
      this.typeLoading = true;
      this.typeFailed = false;
      clearTimeout(this.typeTimer);
      this.typeTimer = setTimeout(() => {
        if (seq === this.typeSeq && this.typeLoading) { this.typeLoading = false; this.typeFailed = true; }
      }, SLOW_MS);
      dictApi.getDictTypeList({ page: 1, limit: 100, dictName: this.appliedQuery }, ({ data }) => {
        if (seq !== this.typeSeq) return;
        clearTimeout(this.typeTimer);
        this.typeLoading = false;
        if (!data || data.code !== 0) { this.typeFailed = true; return; }
        const list = (data.data && data.data.list) || [];
        this.typeList = list;
        const ids = list.map((t) => t.id);
        this.checkedTypes = this.checkedTypes.filter((id) => ids.includes(id));
        // Keep the type being looked at when it still exists, else the first one.
        const keep = this.current && list.find((t) => t.id === this.current.id);
        if (keep || list.length) {
          this.current = keep || list[0];
          this.loadData();
        } else {
          this.current = null;
          this.dataList = [];
          this.checkedData = [];
          this.total = 0;
        }
      });
    },
    pickType(row) {
      if (this.isCurrent(row)) return;
      this.current = row;
      this.page = 1;
      this.checkedData = [];
      this.loadData();
    },
    openAddType() {
      this.typeForm = { id: null, dictName: '', dictType: '' };
      this.typeSheet = true;
    },
    openEditType(row) {
      this.typeForm = { ...row };
      this.typeSheet = true;
    },
    async saveType(form) {
      const call = form.id ? dictApi.updateDictType : dictApi.addDictType;
      this.saving = true;
      const res = await callWithTimeout((cb) => call.call(dictApi, form, cb));
      this.saving = false;
      if (!res) return;
      const { data } = res;
      if (data && data.code === 0) {
        this.$message.success(this.$t('system.saved'));
        this.typeSheet = false;
        this.loadTypes();
      } else {
        this.$message.error((data && data.msg) || this.$t('system.saveFailed'));
      }
    },
    async deleteTypes() {
      const rows = this.typeList.filter((t) => this.checkedTypes.includes(t.id));
      if (!rows.length) { this.$message.warning(this.$t('system.dict.selectTypesFirst')); return; }
      const title = rows.length === 1 ? this.$t('system.dict.deleteTypeTitle', { name: rows[0].dictName })
        : this.$t('system.dict.deleteTypesTitle', { n: this.num(rows.length) });
      try {
        await this.$confirm(this.$t('system.dict.deleteTypesText'), title, {
          confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
        });
      } catch (e) {
        return;
      }
      this.busy = true;
      const res = await callWithTimeout((cb) => dictApi.deleteDictType(rows.map((t) => t.id), cb));
      this.busy = false;
      if (!res) return;
      const { data } = res;
      if (data && data.code === 0) {
        this.$message.success(this.$t('system.deleted'));
        this.checkedTypes = [];
        this.loadTypes();
      } else {
        this.$message.error((data && data.msg) || this.$t('system.deleteFailed'));
      }
    },

    // Values --------------------------------------------------------------------------------
    loadData() {
      const type = this.current;
      if (!type || !type.id) return;
      const seq = ++this.dataSeq;
      this.dataLoading = true;
      this.dataFailed = false;
      clearTimeout(this.dataTimer);
      this.dataTimer = setTimeout(() => {
        if (seq === this.dataSeq && this.dataLoading) { this.dataLoading = false; this.dataFailed = true; }
      }, SLOW_MS);
      dictApi.getDictDataList({
        dictTypeId: type.id, page: this.page, limit: this.pageSize, dictLabel: this.appliedQuery, dictValue: '',
      }, ({ data }) => {
        if (seq !== this.dataSeq) return;
        clearTimeout(this.dataTimer);
        this.dataLoading = false;
        if (data && data.code === 0) {
          this.dataList = (data.data && data.data.list) || [];
          this.total = Number(data.data && data.data.total) || 0;
          this.checkedData = [];
        } else {
          this.dataFailed = true;
          this.$message.error((data && data.msg) || this.$t('system.dict.valuesFailed'));
        }
      });
    },
    search() {
      if (!this.current) { this.$message.warning(this.$t('system.dict.pickTypeFirst')); return; }
      this.appliedQuery = this.query.trim();
      this.page = 1;
      this.loadData();
    },
    clearSearch() {
      this.query = '';
      this.search();
    },
    onPage({ page, pageSize }) {
      const sizeChanged = pageSize !== this.pageSize;
      this.pageSize = pageSize;
      const next = sizeChanged ? 1 : page;
      if (!sizeChanged && next === this.page) return;
      this.page = next;
      this.loadData();
    },
    toggleAllData(v) { this.checkedData = v ? this.dataList.map((d) => d.id) : []; },
    openAddData() {
      if (!this.current) { this.$message.warning(this.$t('system.dict.pickTypeFirst')); return; }
      this.dataForm = { id: null, dictTypeId: this.current.id, dictLabel: '', dictValue: '', sort: 0 };
      this.dataSheet = true;
    },
    openEditData(row) {
      this.dataForm = { ...row, dictTypeId: row.dictTypeId || (this.current && this.current.id) };
      this.dataSheet = true;
    },
    async saveData(form) {
      const call = form.id ? dictApi.updateDictData : dictApi.addDictData;
      this.saving = true;
      const res = await callWithTimeout((cb) => call.call(dictApi, form, cb));
      this.saving = false;
      if (!res) return;
      const { data } = res;
      if (data && data.code === 0) {
        this.$message.success(this.$t('system.saved'));
        this.dataSheet = false;
        this.loadData();
      } else {
        this.$message.error((data && data.msg) || this.$t('system.saveFailed'));
      }
    },
    deleteDataOne(row) {
      this.deleteData([row], this.$t('system.dict.deleteValueTitle', { name: row.dictLabel }), this.$t('system.dict.deleteValueText'));
    },
    deleteDataMany() {
      const rows = this.dataList.filter((d) => this.checkedData.includes(d.id));
      if (!rows.length) { this.$message.warning(this.$t('system.dict.selectValuesFirst')); return; }
      this.deleteData(rows, this.$t('system.dict.deleteValuesTitle', { n: this.num(rows.length) }),
        this.$t('system.dict.deleteValuesText', { n: this.num(rows.length) }));
    },
    async deleteData(rows, title, text) {
      try {
        await this.$confirm(text, title, { confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true });
      } catch (e) {
        return;
      }
      this.busy = true;
      const res = await callWithTimeout((cb) => dictApi.deleteDictData(rows.map((d) => d.id), cb));
      this.busy = false;
      if (!res) return;
      const { data } = res;
      if (data && data.code === 0) {
        this.$message.success(this.$t('system.deleted'));
        this.page = pageAfterDelete(this.page, this.pageSize, this.total, rows.length);
        this.loadData();
      } else {
        this.$message.error((data && data.msg) || this.$t('system.deleteFailed'));
      }
    },
  },
};
</script>

<style>
.dict { padding-bottom: var(--tb-s8); }
.dict__grid { display: grid; grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); gap: var(--tb-s8); padding-top: var(--tb-s4); align-items: start; }
.dict__pane { min-width: 0; }
.dict__head { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s3); min-height: 48px; padding-bottom: var(--tb-s2); }
.dict__htext { display: grid; gap: 2px; min-width: 0; }
.dict__h { display: flex; align-items: center; gap: var(--tb-s2); font-size: var(--tb-fs-20); min-width: 0; overflow-wrap: anywhere; }
.dict__count { color: var(--tb-ink-2); font: 600 var(--tb-fs-14)/1 var(--tb-font-text); }
.dict__mark { flex: none; width: 9px; height: 9px; background: var(--tb-orange); }
.dict__code { color: var(--tb-ink-3); font-size: var(--tb-fs-12); overflow-wrap: anywhere; line-height: 1.35; }
.dict__tools { display: inline-flex; gap: var(--tb-s2); flex: none; }
.dict__types .dict__head { border-bottom: 1px solid var(--tb-rule-soft); margin-bottom: var(--tb-s3); }
.dict__search { padding-bottom: var(--tb-s2); }

.dict__typetable tbody tr { cursor: pointer; }
.dict__pick {
  display: grid; gap: 1px; width: 100%; padding: 0; border: 0; background: none; text-align: left; font: inherit; color: inherit; min-width: 0;
}
.dict__name { font-weight: 600; overflow-wrap: anywhere; line-height: 1.35; }
.dict__typetable tbody tr.is-current { background: color-mix(in srgb, var(--tb-orange) 12%, var(--tb-paper)); }
.dict__typetable tbody tr.is-current .dict__name { color: var(--tb-action); }

.dict__label { font-weight: 600; overflow-wrap: anywhere; }
.dict__value { color: var(--tb-ink-2); overflow-wrap: anywhere; }
.dict__sort { color: var(--tb-ink-2); }
.dict__pager { border-top: 1px solid var(--tb-rule); }

@media (max-width: 900px) {
  .dict__grid { grid-template-columns: 1fr; gap: var(--tb-s6); }
}
@media (max-width: 640px) {
  .dict__head .tb-btn { min-height: var(--tb-target); }
  .dict__search .tb-btn { min-height: var(--tb-target); }
  .dict .sys-table tbody tr { position: relative; }
  .dict .sys-table td.tb-table__sel { position: absolute; top: 4px; right: 0; width: auto; padding: 0; }
  .dict .sys-table td.tb-table__sel .tb-check { min-height: var(--tb-target); min-width: var(--tb-target); justify-content: center; }
  .dict .sys-table tbody td:nth-child(2) { display: block; padding-right: 52px; }
  .dict .sys-table tbody td:nth-child(2)::before { content: none; }
  .dict .sys-table tbody td:last-child { display: block; }
  .dict .sys-table tbody td:last-child::before { content: none; }
  .dict .dict__typetable tbody td:last-child { position: absolute; top: 4px; right: 44px; width: auto; padding: 0; }
  .dict__typetable td:last-child .tb-btn { min-height: var(--tb-target); min-width: var(--tb-target); }
  .dict .dict__typetable tbody td:nth-child(2) { padding-right: 100px; }
  .dict__tools .tb-btn { min-height: var(--tb-target); min-width: var(--tb-target); }
}
</style>
