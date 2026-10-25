<template>
  <div class="ota">
    <TbPageHeader :title="$t('nav.ota')" :description="$t('ota.desc')">
      <template #actions>
        <TbButton variant="primary" icon="upload" @click="openAdd">{{ $t('ota.upload') }}</TbButton>
      </template>
    </TbPageHeader>

    <p class="ota__rule"><TbIcon name="info" :size="16" />{{ $t('ota.rule') }}</p>

    <div class="ota__bar">
      <form class="ota__search" role="search" @submit.prevent="search">
        <TbInput v-model="searchName" icon="search" clearable :placeholder="$t('ota.searchPlaceholder')"
          :aria-label="$t('ota.searchLabel')" :clear-label="$t('ota.clearSearch')" @clear="search" />
        <TbButton native-type="submit">{{ $t('common.search') }}</TbButton>
      </form>
      <div class="ota__batch">
        <TbCheckbox class="ota__all" :model-value="allSelected" :indeterminate="selected.length > 0 && !allSelected"
          :disabled="!rows.length" :label="$t('ota.selectAll')" @update:model-value="selectAll" />
        <span v-if="selected.length" class="ota__count tb-num">{{ $t('ota.selected', { n: num(selected.length) }) }}</span>
        <TbButton size="s" variant="danger" icon="trash" :disabled="!selected.length" @click="deleteSelected">
          {{ $t('ota.deleteSelected') }}
        </TbButton>
      </div>
    </div>

    <TbTable class="ota__table" dense selectable row-key="id" v-model:selected="selected" :columns="columns" :rows="rows"
      :loading="loading" :caption="$t('nav.ota')" :loading-text="$t('ota.loading')"
      :select-all-label="$t('ota.selectAll')" :select-row-label="$t('ota.selectRow')">
      <template #cell-firmwareName="{ row }">
        <span class="ota__namecell">
          <span class="ota__name" :title="row.firmwareName || null">{{ row.firmwareName || '–' }}</span>
          <small v-if="row.remark" class="ota__remark" :title="row.remark">{{ row.remark }}</small>
        </span>
      </template>
      <template #cell-type="{ row }">
        <span class="ota__type" :title="row.type || null">{{ typeLabel(row.type) || '–' }}</span>
      </template>
      <template #cell-version="{ row }">
        <span class="ota__ver">
          <b class="tb-num">{{ row.version ? num(row.version) : '–' }}</b>
          <TbTag v-if="newest.has(row.id)" ink="action" mark :title="$t('ota.newestHint')">{{ $t('ota.newest') }}</TbTag>
        </span>
      </template>
      <template #cell-size="{ row }"><span class="tb-num ota__size">{{ sizeText(row.size, lang) }}</span></template>
      <template #cell-createDate="{ row }">
        <span class="ota__date">
          <time :datetime="row.createDate || null">{{ dateText(row.createDate, lang) || '–' }}</time>
          <small v-if="wasEdited(row)">{{ $t('ota.edited', { date: dateText(row.updateDate, lang) }) }}</small>
        </span>
      </template>
      <template #cell-actions="{ row }">
        <span class="ota__acts">
          <TbButton size="s" variant="quiet" icon="download" :aria-label="$t('ota.download')" :title="$t('ota.download')"
            @click.stop="download(row)" />
          <TbButton size="s" variant="quiet" icon="edit" :aria-label="$t('ota.edit')" :title="$t('ota.edit')"
            @click.stop="openEdit(row)" />
          <TbButton size="s" variant="quiet" icon="trash" class="ota__del" :aria-label="$t('ota.delete')" :title="$t('ota.delete')"
            @click.stop="remove(row)" />
        </span>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" face="confused" :title="$t('ota.loadFailed')">
          <TbButton icon="refresh" @click="fetchList">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else-if="searchedFor" :title="$t('ota.emptySearchTitle')" :text="$t('ota.emptySearchText')">
          <TbButton @click="clearSearch">{{ $t('ota.clearSearch') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else face="sleepy" :title="$t('ota.emptyTitle')" :text="$t('ota.emptyText')">
          <TbButton variant="primary" icon="upload" @click="openAdd">{{ $t('ota.upload') }}</TbButton>
        </TbEmpty>
      </template>
    </TbTable>

    <TbPagination v-if="total > 0" v-model:page="page" v-model:page-size="pageSize" :total="total" :sizes="pageSizes"
      :total-text="$t('ota.total', { n: num(total) })" :size-suffix="$t('ota.perPage')" :aria-label="$t('ota.pages')"
      :prev-label="$t('ota.prev')" :next-label="$t('ota.next')" :size-label="$t('ota.pageSize')" @change="onPage" />

    <FirmwareSheet v-model:open="sheetOpen" :form="form" :types="firmwareTypes" :saving="saving" @submit="save" />
  </div>
</template>

<script>
import Api from '@/apis/api';
import { DEMO } from '@/apis/demo/index';
import { digits } from '@/kit/calendar';
import FirmwareSheet from './FirmwareSheet.vue';
import { PAGE_SIZES, dateText, emptyForm, newestIds, sizeText, typeName, wasEdited } from './otaModel';

// Firmware (OTA), back office: the builds robots download when they check for updates.
// Legacy behaviour kept: name search, pages of 10/20/50/100 ordered by upload date, select and
// delete in bulk, download through a one-time link, edit (type locked), upload in a sheet.
export default {
  name: 'OtaManagement',
  components: { FirmwareSheet },
  data() {
    return {
      searchName: '',
      searchedFor: '',
      loading: false,
      failed: false,
      rows: [],
      total: 0,
      page: 1,
      pageSize: 10,
      pageSizes: PAGE_SIZES,
      selected: [],
      firmwareTypes: [],
      sheetOpen: false,
      form: emptyForm(),
      saving: false,
      savingTimer: null,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    columns() {
      return [
        { key: 'firmwareName', label: this.$t('ota.col.nameRemark') },
        { key: 'type', label: this.$t('ota.col.type') },
        { key: 'version', label: this.$t('ota.col.version') },
        { key: 'size', label: this.$t('ota.col.size'), align: 'right' },
        { key: 'createDate', label: this.$t('ota.col.uploaded') },
        { key: 'actions', label: this.$t('ota.col.actions'), align: 'right' },
      ];
    },
    allSelected() { return this.rows.length > 0 && this.rows.every((r) => this.selected.includes(r.id)); },
    // The build each type serves can only be named when every build is on this page.
    newest() { return newestIds(this.rows, !this.searchedFor && this.rows.length >= this.total); },
  },
  created() {
    this.fetchList();
    this.fetchTypes();
  },
  beforeUnmount() { clearTimeout(this.savingTimer); },
  methods: {
    sizeText,
    dateText,
    wasEdited,
    num(v) { return digits(v, this.lang); },
    typeLabel(key) { return typeName(this.firmwareTypes, key); },

    fetchList() {
      this.loading = true;
      this.failed = false;
      const params = {
        page: this.page,
        limit: this.pageSize,
        firmwareName: this.searchName || '',
        orderField: 'create_date',
        order: 'desc',
      };
      const query = params.firmwareName;
      Api.ota.getOtaList(params, (res) => {
        this.loading = false;
        const body = res.data || {};
        this.searchedFor = query;
        if (body.code === 0) {
          this.rows = (body.data && body.data.list) || [];
          this.total = (body.data && body.data.total) || 0;
        } else {
          this.rows = [];
          this.total = 0;
          this.failed = true;
          this.$message.error(body.msg || this.$t('ota.fetchFailed'));
        }
        this.selected = [];
      });
    },
    async fetchTypes() {
      try {
        const res = await Api.dict.getDictDataByType('FIRMWARE_TYPE');
        this.firmwareTypes = res.data || [];
      } catch (error) {
        console.error('Failed to get firmware type:', error);
        this.$message.error((error && error.message) || this.$t('ota.typesFailed'));
      }
    },
    search() {
      this.page = 1;
      this.fetchList();
    },
    clearSearch() {
      this.searchName = '';
      this.search();
    },
    onPage({ page, pageSize }) {
      this.page = page;
      this.pageSize = pageSize;
      this.fetchList();
    },
    selectAll(on) { this.selected = on ? this.rows.map((r) => r.id) : []; },

    openAdd() {
      this.form = emptyForm();
      this.sheetOpen = true;
    },
    openEdit(row) {
      this.form = { ...row };
      this.sheetOpen = true;
    },
    save(form) {
      this.saving = true;
      // The legacy fallback: free the button after 3 s if the request never answers.
      clearTimeout(this.savingTimer);
      this.savingTimer = setTimeout(() => { this.saving = false; }, 3000);
      const done = (okKey, failKey) => (res) => {
        const body = res.data || {};
        clearTimeout(this.savingTimer);
        this.saving = false;
        if (body.code === 0) {
          this.$message.success(this.$t(okKey));
          this.sheetOpen = false;
          this.fetchList();
        } else {
          this.$message.error(body.msg || this.$t(failKey));
        }
      };
      if (form.id) Api.ota.updateOta(form.id, form, done('ota.updated', 'ota.updateFailed'));
      else Api.ota.saveOta(form, done('ota.added', 'ota.addFailed'));
    },

    deleteSelected() {
      const list = this.rows.filter((r) => this.selected.includes(r.id));
      if (!list.length) {
        this.$message.warning(this.$t('ota.selectFirst'));
        return;
      }
      this.remove(list);
    },
    remove(target) {
      const list = Array.isArray(target) ? target : [target];
      if (!list.length) {
        this.$message.warning(this.$t('ota.selectFirst'));
        return;
      }
      const n = list.length;
      const one = n === 1;
      const title = one && list[0].firmwareName ? list[0].firmwareName : this.$t('ota.deleteTitle');
      const message = one ? this.$t('ota.confirmOne') : this.$t('ota.confirmMany', { n: this.num(n) });
      this.$confirm(message, title, { confirmText: this.$t('ota.delete'), cancelText: this.$t('common.cancel'), danger: true })
        .then(() => {
          const ids = list.map((r) => r.id);
          if (ids.some((id) => !id)) {
            this.$message.error(this.$t('ota.invalidId'));
            return;
          }
          Api.ota.deleteOta(ids, (res) => {
            const body = res.data || {};
            if (body.code === 0) {
              this.$message.success(this.$t('ota.deleted', { n: this.num(n) }));
              if (this.rows.length === n && this.page > 1) this.page -= 1;
              this.fetchList();
            } else {
              this.$message.error(body.msg || this.$t('ota.deleteFailed'));
            }
          });
        })
        .catch(() => {
          this.$message({ type: 'info', message: this.$t('ota.cancelled'), duration: 1000 });
        });
    },

    download(row) {
      if (!row || !row.id) {
        this.$message.error(this.$t('ota.incomplete'));
        return;
      }
      Api.ota.getDownloadUrl(row.id, (res) => {
        const body = res.data || {};
        if (body.code !== 0) {
          this.$message.error(this.$t('ota.downloadFailed'));
          return;
        }
        if (DEMO) {
          this.$message.info(this.$t('ota.demoDownload'));
          return;
        }
        const baseUrl = process.env.VUE_APP_API_BASE_URL || '';
        window.open(`${window.location.origin}${baseUrl}/otaMag/download/${body.data}`);
      });
    },
  },
};
</script>

<style>
.ota { padding-bottom: var(--tb-s8); }
.ota__rule {
  display: flex; gap: 8px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--tb-rule-soft);
  font-size: var(--tb-fs-13); color: var(--tb-ink-2); max-width: 90ch;
}
.ota__rule .tb-icon { flex: none; margin-top: 2px; }
.ota__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0 12px; }
.ota__search { display: flex; gap: 8px; flex: 1 1 360px; max-width: 480px; min-width: 0; }
.ota__search .tb-input { flex: 1; min-width: 0; }
.ota__batch { display: flex; align-items: center; gap: 12px; }
.ota__all { display: none; }
.ota__count { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }

.ota__table td { vertical-align: top; }
.ota__namecell { display: grid; gap: 2px; min-width: 0; }
.ota__name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 36ch; }
.ota__size { white-space: nowrap; }
.ota__type { display: block; max-width: 24ch; }
.ota__date { display: grid; gap: 2px; min-width: 0; }
.ota__date small { font-size: var(--tb-fs-12); color: var(--tb-ink-3); overflow-wrap: anywhere; }
.ota__ver { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.ota__ver b { font-family: var(--tb-font-display); font-weight: 700; }
.ota__remark {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  max-width: 32ch; color: var(--tb-ink-2); font-size: var(--tb-fs-13);
}
.ota__date time { white-space: nowrap; }
.ota__acts { display: inline-flex; gap: 2px; justify-content: flex-end; flex-wrap: nowrap; }
.ota__del { color: var(--tb-danger); }

@media (max-width: 640px) {
  .ota__search { flex-basis: 100%; max-width: none; }
  .ota__batch { width: 100%; }
  .ota__all { display: inline-flex; min-height: var(--tb-target); margin-right: auto; }
  .ota__remark, .ota__name, .ota__type { max-width: none; }
  .ota__name { white-space: normal; overflow-wrap: anywhere; }
  .ota__acts { flex-wrap: wrap; justify-content: flex-start; margin-left: -10px; }
  .ota__acts .tb-btn, .ota__batch .tb-btn { min-height: var(--tb-target); }
  .ota__acts .tb-btn { min-width: var(--tb-target); }
}
</style>
