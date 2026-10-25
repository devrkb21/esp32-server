<template>
  <div class="pm">
    <TbPageHeader :title="$t('nav.products')" :description="$t('products.desc')">
      <template #actions>
        <TbButton icon="refresh" :loading="loading && !!list.length" :disabled="loading" @click="fetchPage">{{ $t('products.refresh') }}</TbButton>
        <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('products.add') }}</TbButton>
      </template>
    </TbPageHeader>

    <div class="pm__filter">
      <form class="pm__search" role="search" @submit.prevent="search">
        <TbInput v-model="query" icon="search" clearable :placeholder="$t('products.searchPlaceholder')"
          :aria-label="$t('products.searchLabel')" :clear-label="$t('products.clearSearch')" :maxlength="60"
          @clear="clearSearch" @enter="search" />
        <TbButton native-type="submit">{{ $t('common.search') }}</TbButton>
      </form>
      <span v-if="total" class="pm__count tb-num">{{ $t('products.total', { n: num(total) }) }}</span>
    </div>

    <p v-if="failed && list.length" class="pm__fail" role="alert">{{ $t('common.loadFailed') }}
      <TbButton size="s" variant="quiet" icon="refresh" @click="fetchPage">{{ $t('common.retry') }}</TbButton></p>

    <TbTable class="pm__table" dense row-key="id" :columns="columns" :rows="list" :loading="loading && !list.length"
      :loading-text="$t('common.loading')" :caption="$t('nav.products')">
      <template #cell-name="{ row }">
        <span class="pm-name">
          <img v-if="row.iconUrl" class="pm-name__icon" :src="row.iconUrl" alt="" width="28" height="28" loading="lazy" />
          <span class="pm-name__text">
            <b>{{ row.nameBn || row.nameEn }}</b>
            <small v-if="row.nameBn && row.nameEn">{{ row.nameEn }}</small>
          </span>
        </span>
      </template>
      <template #cell-productKey="{ row }"><code class="pm-key">{{ row.productKey }}</code></template>
      <template #cell-boardTypes="{ row }"><span class="pm-boards" :title="boardsText(row.boardTypes)">{{ boardsText(row.boardTypes) || '–' }}</span></template>
      <template #cell-features="{ row }">
        <span class="pm-feats-n tb-num" :title="(row.features || []).join(', ')">{{ $t('products.featureCount', { n: num((row.features || []).length) }) }}</span>
      </template>
      <template #cell-status="{ row }">
        <TbTag :ink="row.status === 1 ? 'ok' : 'ink-2'" :mark="row.status === 1">
          {{ row.status === 1 ? $t('products.statusOn') : $t('products.statusOff') }}</TbTag>
      </template>
      <template #cell-sort="{ row }"><span class="tb-num">{{ num(row.sort ?? 0) }}</span></template>
      <template #cell-actions="{ row }">
        <span class="pm-acts">
          <TbButton size="s" variant="quiet" icon="edit" @click="openEdit(row)">{{ $t('common.edit') }}</TbButton>
          <TbButton size="s" variant="quiet" icon="trash" class="pm-del" :disabled="isProtected(row) || deleting"
            :title="isProtected(row) ? $t('products.genericLocked') : null" @click="remove(row)">{{ $t('common.delete') }}</TbButton>
        </span>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" :title="$t('products.loadFailed')" :text="$t('common.loadFailed')">
          <TbButton icon="refresh" @click="fetchPage">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else-if="searched" :title="$t('products.noMatch')" :text="$t('products.noMatchText', { q: searched })">
          <TbButton @click="clearSearch">{{ $t('products.clearSearch') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else :title="$t('products.emptyTitle')" :text="$t('products.emptyText')">
          <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('products.add') }}</TbButton>
        </TbEmpty>
      </template>
    </TbTable>

    <TbPagination v-if="total > PAGE_SIZE" v-model:page="page" v-model:page-size="pageSize" :total="total" :sizes="[10, 20, 50]"
      :total-text="$t('products.total', { n: num(total) })" :size-suffix="$t('products.perPageSuffix')" :aria-label="$t('products.pages')"
      :prev-label="$t('products.prevPage')" :next-label="$t('products.nextPage')" :size-label="$t('products.perPage')"
      @change="onPage" />

    <ProductSheet v-model:open="sheetOpen" :product="editing" :saving="saving" :server-error="serverError" :server-field="serverField"
      @submit="save" />
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { loadProducts } from '@/shell/robot';
import ProductSheet from './ProductSheet.vue';
import { ERROR_FIELDS, PAGE_SIZE, boardsText, isProtected } from './productsModel';

// Products (back office, super admins). Each Nobix device belongs to one product, matched by its
// board type; the product's features decide which screens the device shows. List, search, add,
// edit and delete; the generic product (the catch-all) cannot be deleted or re-keyed.
// API: product.getProductPage, addProduct, updateProduct, deleteProducts.
export default {
  name: 'ProductManagement',
  components: { ProductSheet },
  data() {
    return {
      PAGE_SIZE,
      list: [],
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
      query: '',
      searched: '',
      loading: false,
      failed: false,
      deleting: false,
      sheetOpen: false,
      editing: null,
      saving: false,
      serverError: '',
      serverField: '',
      seq: 0,
    };
  },
  computed: {
    columns() {
      return [
        { key: 'name', label: this.$t('products.col.name'), full: true },
        { key: 'productKey', label: this.$t('products.col.key'), width: '130px' },
        { key: 'boardTypes', label: this.$t('products.col.boards'), width: '22%' },
        { key: 'features', label: this.$t('products.col.features'), width: '120px' },
        { key: 'status', label: this.$t('products.col.status'), width: '110px' },
        { key: 'sort', label: this.$t('products.col.sort'), width: '64px', align: 'right' },
        { key: 'actions', label: this.$t('products.col.actions'), width: '1%', align: 'right' },
      ];
    },
  },
  created() {
    this.fetchPage();
  },
  methods: {
    num(n) { return digits(n, this.$i18n.locale); },
    boardsText,
    isProtected,
    fetchPage() {
      const seq = ++this.seq;
      this.loading = true;
      this.failed = false;
      Api.product.getProductPage({ page: this.page, limit: this.pageSize, keywords: this.searched }, ({ data }) => {
        if (seq !== this.seq) return;
        this.loading = false;
        if (data && data.code === 0) {
          this.list = (data.data && data.data.list) || [];
          this.total = Number((data.data && data.data.total) || 0);
          if (!this.list.length && this.page > 1) { this.page -= 1; this.fetchPage(); }
        } else {
          this.failed = true;
        }
      }, (res) => {
        if (seq !== this.seq) return;
        this.loading = false;
        this.failed = true;
        const msg = res && res.data && res.data.msg;
        if (msg) this.$message.error(msg);
      });
    },
    onPage(e) {
      this.page = (e && e.page) || 1;
      if (e && e.pageSize) this.pageSize = e.pageSize;
      this.fetchPage();
    },
    search() {
      this.searched = this.query.trim();
      this.page = 1;
      this.fetchPage();
    },
    clearSearch() {
      this.query = '';
      if (!this.searched) return;
      this.searched = '';
      this.page = 1;
      this.fetchPage();
    },
    openAdd() {
      this.editing = null;
      this.serverError = '';
      this.serverField = '';
      this.sheetOpen = true;
    },
    openEdit(row) {
      this.editing = { ...row };
      this.serverError = '';
      this.serverField = '';
      this.sheetOpen = true;
    },
    save(body) {
      const editing = !!body.id;
      this.saving = true;
      this.serverError = '';
      this.serverField = '';
      const failed = (data) => {
        this.saving = false;
        this.serverError = (data && data.msg) || this.$t(editing ? 'products.updateFailed' : 'products.addFailed');
        this.serverField = (data && ERROR_FIELDS[data.code]) || '';
        this.$message.error(this.serverError);
      };
      const done = ({ data }) => {
        if (!data || data.code !== 0) { failed(data); return; }
        this.saving = false;
        this.sheetOpen = false;
        this.$message.success(this.$t(editing ? 'products.updated' : 'products.added'));
        this.fetchPage();
        loadProducts(true);
      };
      const fail = (res) => failed(res && res.data);
      if (editing) Api.product.updateProduct(body, done, fail);
      else Api.product.addProduct(body, done, fail);
    },
    async remove(row) {
      if (isProtected(row)) return;
      const name = row.nameBn && this.$i18n.locale === 'bn' ? row.nameBn : row.nameEn;
      try {
        await this.$confirm(this.$t('products.deleteText'), this.$t('products.deleteTitle', { name }), {
          confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
        });
      } catch (e) {
        return;
      }
      this.deleting = true;
      Api.product.deleteProducts([row.id], ({ data }) => {
        this.deleting = false;
        if (data && data.code === 0) {
          this.$message.success(this.$t('products.deleted', { name }));
          this.fetchPage();
          loadProducts(true);
        } else {
          this.$message.error((data && data.msg) || this.$t('products.deleteFailed'));
        }
      }, (res) => {
        this.deleting = false;
        this.$message.error((res && res.data && res.data.msg) || this.$t('products.deleteFailed'));
      });
    },
  },
};
</script>

<style>
.pm { padding-bottom: var(--tb-s8); }
.pm__filter { display: flex; align-items: center; gap: var(--tb-s3); flex-wrap: wrap; padding: var(--tb-s4) 0 var(--tb-s3); }
.pm__search { display: flex; gap: var(--tb-s2); flex: 1; max-width: 460px; }
.pm__search .tb-input { flex: 1; min-width: 0; }
.pm__count { color: var(--tb-ink-2); font-size: var(--tb-fs-13); margin-left: auto; }
.pm__fail { display: flex; align-items: center; gap: var(--tb-s2); padding: var(--tb-s2) 0; color: var(--tb-danger); font-size: var(--tb-fs-14); flex-wrap: wrap; }
.pm-name { display: flex; align-items: center; gap: var(--tb-s3); min-width: 0; }
.pm-name__icon { flex: none; width: 28px; height: 28px; object-fit: contain; }
.pm-name__text { display: grid; min-width: 0; line-height: 1.35; }
.pm-name__text b { font-weight: 700; overflow-wrap: anywhere; }
.pm-name__text small { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.pm-key { font: 600 var(--tb-fs-13) var(--tb-font-text); color: var(--tb-ink); }
.pm-boards { display: block; color: var(--tb-ink-2); font-size: var(--tb-fs-13); overflow-wrap: anywhere; }
.pm-feats-n { color: var(--tb-ink-2); font-size: var(--tb-fs-13); white-space: nowrap; }
.pm-acts { display: inline-flex; gap: 2px; justify-content: flex-end; white-space: nowrap; }
.pm-del { color: var(--tb-danger); }
.pm-del:disabled { color: var(--tb-ink-3); }
@media (max-width: 640px) {
  .pm__search { max-width: none; flex-basis: 100%; }
  .pm__count { margin-left: 0; }
  .pm-acts { justify-content: flex-start; gap: var(--tb-s2); }
  .pm-acts .tb-btn { min-height: var(--tb-target); }
}
</style>
