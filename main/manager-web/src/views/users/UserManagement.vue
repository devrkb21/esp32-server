<template>
  <div class="users">
    <TbPageHeader :title="$t('users.title')" :description="$t('users.desc')" />

    <form class="users__filter" role="search" @submit.prevent="handleSearch">
      <label class="tb-visually-hidden" for="users-q">{{ $t('users.searchLabel') }}</label>
      <TbInput id="users-q" v-model="searchPhone" class="users__q" icon="search" clearable inputmode="search"
        :placeholder="$t('users.searchPlaceholder')" :clear-label="$t('users.clear')" :maxlength="64" @clear="handleSearch" />
      <TbButton native-type="submit" icon="search" :disabled="loading && !userList.length">{{ $t('common.search') }}</TbButton>
    </form>

    <div class="users__bar" role="toolbar" :aria-label="$t('users.batchLabel')">
      <TbCheckbox class="users__all" :model-value="allSelected" :indeterminate="someSelected" :disabled="!userList.length || !!busy"
        @update:model-value="toggleAll">{{ selectedCount ? selectedText : $t('users.selectAll') }}</TbCheckbox>
      <p class="users__note tb-num" aria-live="polite">{{ selectedCount ? selectedText : $t('users.noneSelected') }}</p>
      <div class="users__batch">
        <TbButton size="s" icon="check" :disabled="!selectedCount || !!busy" :loading="busy === 'enable'" @click="batchEnable">
          {{ $t('users.enable') }}</TbButton>
        <TbButton size="s" icon="minus" :disabled="!selectedCount || !!busy" :loading="busy === 'disable'" @click="batchDisable">
          {{ $t('users.disable') }}</TbButton>
        <TbButton size="s" variant="danger" icon="trash" :disabled="!selectedCount || !!busy" :loading="busy === 'delete'"
          @click="batchDelete">{{ busy === 'delete' ? $t('users.deleting') : $t('users.delete') }}</TbButton>
      </div>
    </div>

    <TbTable v-model:selected="selected" class="users__table" :columns="columns" :rows="userList" row-key="userid" dense selectable
      :loading="loading" :row-class="rowClass" :caption="$t('users.tableCaption')" :loading-text="$t('users.loading')"
      :select-all-label="$t('users.selectAll')" :select-row-label="$t('users.selectRow')">
      <template #cell-mobile="{ row }">
        <div class="users__who">
          <span class="users__name">
            <span class="users__handle" :title="row.mobile">{{ row.mobile || '–' }}</span>
            <TbTag v-if="isSuperAdmin(row)">{{ $t('users.superAdmin') }}</TbTag>
          </span>
          <span class="users__id tb-num">{{ $t('users.id', { id: num(row.userid) }) }}</span>
        </div>
      </template>
      <template #cell-deviceCount="{ row }">
        <span class="users__devices tb-num" :class="{ 'is-zero': !Number(row.deviceCount) }">{{ num(row.deviceCount || 0) }}</span>
      </template>
      <template #cell-status="{ row }">
        <span class="users__status">
          <TbSwitch :model-value="isActive(row)" :disabled="!!busy"
            :aria-label="$t(isActive(row) ? 'users.switchOff' : 'users.switchOn', { name: row.mobile })"
            @update:model-value="(v) => changeStatus([row], v ? 1 : 0)" />
          <TbTag :ink="isActive(row) ? 'ok' : 'danger'">{{ $t(isActive(row) ? 'users.status.active' : 'users.status.disabled') }}</TbTag>
        </span>
      </template>
      <template #cell-createDate="{ row }">
        <time class="users__date" :datetime="row.createDate || null">
          <span>{{ created(row).date || '–' }}</span><small v-if="created(row).time">{{ created(row).time }}</small>
        </time>
      </template>
      <template #cell-actions="{ row }">
        <span class="users__acts">
          <TbButton size="s" variant="quiet" icon="key" :disabled="!!busy" @click="resetPassword(row)">{{ $t('users.resetPassword') }}</TbButton>
          <TbButton size="s" variant="quiet" icon="trash" class="users__del" :disabled="!!busy" @click="deleteUser(row)">
            {{ $t('users.deleteUser') }}</TbButton>
        </span>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" face="confused" :title="$t('common.loadFailed')">
          <TbButton icon="refresh" @click="fetchUsers">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else-if="appliedQuery" :title="$t('users.emptySearchTitle', { q: appliedQuery })" :text="$t('users.emptySearchText')">
          <TbButton icon="close" @click="clearSearch">{{ $t('users.clear') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else face="sleepy" :title="$t('users.emptyTitle')" :text="$t('users.emptyText')" />
      </template>
    </TbTable>

    <p v-if="failed && userList.length" class="users__fail" role="alert">{{ $t('common.loadFailed') }}
      <TbButton size="s" variant="quiet" icon="refresh" @click="fetchUsers">{{ $t('common.retry') }}</TbButton></p>

    <TbPagination v-if="total > 0" class="users__pager" :page="currentPage" :page-size="pageSize" :total="total" :sizes="pageSizeOptions"
      :total-text="$tc('users.total', total, { count: num(total) })" :size-suffix="$t('users.perPageSuffix')" :aria-label="$t('users.pages')"
      :prev-label="$t('users.prev')" :next-label="$t('users.next')" :size-label="$t('users.perPage')" @change="onPage" />

    <TbSheet v-model:open="showPassword" size="s" :title="$t('users.passwordTitle')" :close-label="$t('common.close')"
      :close-on-scrim="false" @close="forgetPassword">
      <p class="users__pwlead">{{ $t('users.passwordLead', { name: passwordFor }) }}</p>
      <div class="users__pwbox">
        <label class="users__pwlabel" for="users-pw">{{ $t('users.passwordLabel') }}</label>
        <div class="users__pwfield">
          <input id="users-pw" ref="pwField" class="users__pw" :value="currentPassword" readonly spellcheck="false"
            autocomplete="off" @focus="$event.target.select()" />
          <TbButton variant="quiet" icon="copy" :aria-label="$t('users.copy')" @click="copyPassword" />
        </div>
        <p class="users__pwhint">{{ $t('users.passwordHint') }}</p>
      </div>
      <template #footer>
        <TbButton @click="closePassword">{{ $t('common.close') }}</TbButton>
        <TbButton variant="primary" icon="copy" @click="copyPassword">{{ $t('users.copy') }}</TbButton>
      </template>
    </TbSheet>
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { batchOutcome, callWithTimeout, createdText, hasInvalidId, isActive, isSuperAdmin, pageAfterDelete } from './usersModel';

// Users (back office, super admins; owner: web-users). Behaviour from the legacy UserManagement.vue
// and ViewPasswordDialog.vue: search, paging, enable/disable (one or many), reset password (shown
// once, copyable), delete (one or many). API: admin.getUserList, admin.deleteUser,
// admin.resetUserPassword, user.changeUserStatus.
const SLOW_MS = 15000;

export default {
  name: 'UserManagement',
  data() {
    return {
      searchPhone: '',
      appliedQuery: '',
      userList: [],
      selected: [],
      pageSizeOptions: [10, 20, 50, 100],
      currentPage: 1,
      pageSize: 10,
      total: 0,
      loading: false,
      failed: false,
      busy: '',
      showPassword: false,
      currentPassword: '',
      passwordFor: '',
      seq: 0,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    columns() {
      return [
        { key: 'mobile', label: this.$t('users.col.username') },
        { key: 'deviceCount', label: this.$t('users.col.devices'), align: 'right', width: '96px' },
        { key: 'status', label: this.$t('users.col.status'), width: '190px' },
        { key: 'createDate', label: this.$t('users.col.created'), width: '170px' },
        { key: 'actions', label: this.$t('users.col.actions'), align: 'right', width: '1%' },
      ];
    },
    selectedRows() { return this.userList.filter((u) => this.selected.includes(u.userid)); },
    selectedCount() { return this.selectedRows.length; },
    allSelected() { return this.userList.length > 0 && this.selectedCount === this.userList.length; },
    someSelected() { return this.selectedCount > 0 && !this.allSelected; },
    selectedText() { return this.$t('users.selected', { count: this.num(this.selectedCount) }); },
  },
  created() {
    this.fetchUsers();
  },
  beforeUnmount() {
    clearTimeout(this.slowTimer);
    this.currentPassword = '';
  },
  methods: {
    isActive,
    isSuperAdmin,
    num(n) { return digits(n ?? '', this.lang); },
    created(row) { return createdText(row.createDate, this.lang); },
    rowClass(row) { return this.selected.includes(row.userid) ? 'is-picked' : null; },

    fetchUsers() {
      const seq = ++this.seq;
      this.loading = true;
      this.failed = false;
      clearTimeout(this.slowTimer);
      // The API layer never calls back on a server error (it shows its own notice): after a while
      // the list reports the failure and offers a retry instead of loading forever.
      this.slowTimer = setTimeout(() => {
        if (seq === this.seq && this.loading) { this.loading = false; this.failed = true; }
      }, SLOW_MS);
      const query = this.searchPhone.trim();
      Api.admin.getUserList({ page: this.currentPage, limit: this.pageSize, mobile: query }, ({ data }) => {
        if (seq !== this.seq) return; // a newer request owns the list
        clearTimeout(this.slowTimer);
        this.loading = false;
        if (data && data.code === 0) {
          const page = data.data || {};
          this.userList = Array.isArray(page.list) ? page.list : [];
          this.total = Number(page.total) || 0;
          this.appliedQuery = query;
          this.selected = [];
          this.failed = false;
        } else {
          this.failed = true;
        }
      });
    },
    handleSearch() {
      this.currentPage = 1;
      this.fetchUsers();
    },
    clearSearch() {
      this.searchPhone = '';
      this.handleSearch();
    },
    onPage({ page, pageSize }) {
      const sizeChanged = pageSize !== this.pageSize;
      this.pageSize = pageSize;
      const next = sizeChanged ? 1 : page;
      if (!sizeChanged && next === this.currentPage) return;
      this.currentPage = next;
      this.fetchUsers();
    },
    toggleAll(v) {
      this.selected = v ? this.userList.map((u) => u.userid) : [];
    },

    batchEnable() {
      if (!this.selectedCount) { this.$message.warning(this.$t('users.selectFirstEnable')); return; }
      this.changeStatus(this.selectedRows, 1);
    },
    batchDisable() {
      if (!this.selectedCount) { this.$message.warning(this.$t('users.selectFirstDisable')); return; }
      this.changeStatus(this.selectedRows, 0);
    },
    async changeStatus(rows, status) {
      const users = rows.slice();
      const count = users.length;
      const one = count === 1;
      const name = users[0]?.mobile || '';
      const enable = status === 1;
      const message = one
        ? this.$t(enable ? 'users.enableOne' : 'users.disableOne', { name })
        : this.$t(enable ? 'users.enableMany' : 'users.disableMany', { count: this.num(count) });
      try {
        await this.$confirm(message, this.$t(enable ? 'users.enableTitle' : 'users.disableTitle'), {
          confirmText: this.$t(enable ? 'users.enable' : 'users.disable'),
          cancelText: this.$t('common.cancel'),
          danger: !enable,
        });
      } catch (e) {
        return; // cancelled: nothing changed
      }
      const userIds = users.map((u) => u.userid);
      if (hasInvalidId(userIds)) { this.$message.error(this.$t('users.invalidId')); return; }
      this.busy = enable ? 'enable' : 'disable';
      const res = await callWithTimeout((cb) => Api.user.changeUserStatus(status, userIds, cb));
      this.busy = '';
      if (res && res.data && res.data.code === 0) {
        this.$message.success(one
          ? this.$t(enable ? 'users.enabledOne' : 'users.disabledOne', { name })
          : this.$t(enable ? 'users.enabledDone' : 'users.disabledDone', { count: this.num(count) }));
        this.fetchUsers();
      } else if (res) {
        this.$message.error(this.$t('users.statusFailed'));
      }
    },

    async resetPassword(row) {
      const name = row.mobile || '';
      try {
        await this.$confirm(this.$t('users.resetText'), this.$t('users.resetTitle', { name }), {
          confirmText: this.$t('users.resetPassword'),
          cancelText: this.$t('common.cancel'),
        });
      } catch (e) {
        return;
      }
      this.busy = 'reset';
      const res = await callWithTimeout((cb) => Api.admin.resetUserPassword(row.userid, cb));
      this.busy = '';
      if (!res) return; // the API layer has already said what went wrong
      const { data } = res;
      if (data && data.code === 0) {
        this.currentPassword = String(data.data ?? '');
        this.passwordFor = name;
        this.showPassword = true;
        this.fetchUsers();
      } else {
        this.$message.error((data && data.msg) || this.$t('users.resetFailed'));
      }
    },
    copyPassword() {
      const done = () => this.$message.success(this.$t('users.copied'));
      const fail = () => {
        // Clipboard unavailable (plain http): select the text so it can be copied by hand
        this.$refs.pwField?.focus();
        this.$refs.pwField?.select();
        this.$message.error(this.$t('users.copyFailed'));
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(this.currentPassword).then(done, fail);
      } else {
        fail();
      }
    },
    closePassword() {
      this.showPassword = false;
      this.forgetPassword();
    },
    forgetPassword() {
      // Shown once: the password leaves memory with the sheet
      setTimeout(() => { if (!this.showPassword) { this.currentPassword = ''; this.passwordFor = ''; } }, 200);
    },

    async deleteUser(row) {
      const name = row.mobile || '';
      try {
        await this.$confirm(this.$t('users.deleteText'), this.$t('users.deleteOneTitle', { name }), {
          confirmText: this.$t('users.deleteUser'),
          cancelText: this.$t('common.cancel'),
          danger: true,
        });
      } catch (e) {
        this.$message.info(this.$t('users.deleteCancelled'));
        return;
      }
      this.busy = 'delete-one';
      const res = await callWithTimeout((cb) => Api.admin.deleteUser(row.userid, cb));
      this.busy = '';
      if (!res) return;
      const { data } = res;
      if (data && data.code === 0) {
        this.currentPage = pageAfterDelete(this.currentPage, this.pageSize, this.total, 1);
        this.$message.success(this.$t('users.deleted'));
        this.fetchUsers();
      } else {
        this.$message.error((data && data.msg) || this.$t('users.deleteFailed'));
      }
    },
    async batchDelete() {
      const rows = this.selectedRows.slice();
      if (!rows.length) { this.$message.warning(this.$t('users.selectFirstDelete')); return; }
      try {
        const title = rows.length === 1
          ? this.$t('users.deleteOneTitle', { name: rows[0].mobile || '' })
          : this.$t('users.deleteManyTitle', { count: this.num(rows.length) });
        await this.$confirm(this.$t('users.deleteText'), title, {
          confirmText: this.$t('users.delete'),
          cancelText: this.$t('common.cancel'),
          danger: true,
        });
      } catch (e) {
        this.$message.info(this.$t('users.deleteCancelled'));
        return;
      }
      this.busy = 'delete';
      try {
        const results = await Promise.all(rows.map((u) => callWithTimeout((cb) => Api.admin.deleteUser(u.userid, cb))
          .then((res) => ({ success: !!(res && res.data && res.data.code === 0), userid: u.userid }))));
        const { ok, fail, kind } = batchOutcome(results);
        if (kind === 'all') this.$message.success(ok === 1 ? this.$t('users.deleted') : this.$t('users.deletedMany', { count: this.num(ok) }));
        else if (kind === 'none') this.$message.error(this.$t('users.deleteFailed'));
        else this.$message.warning(this.$t('users.partialDelete', { ok: this.num(ok), fail: this.num(fail) }));
        this.currentPage = pageAfterDelete(this.currentPage, this.pageSize, this.total, ok);
        this.fetchUsers();
      } catch (e) {
        this.$message.error(this.$t('users.deleteFailed'));
      } finally {
        this.busy = '';
      }
    },
  },
};
</script>

<style>
.users { padding-bottom: var(--tb-s8); }

.users__filter { display: flex; gap: var(--tb-s2); align-items: center; padding: var(--tb-s4) 0 var(--tb-s3); }
.users__q { flex: 1 1 auto; max-width: 420px; min-width: 0; }

.users__bar {
  display: flex; align-items: center; gap: var(--tb-s3); flex-wrap: wrap;
  min-height: 52px; padding: var(--tb-s2) 0; border-top: 1px solid var(--tb-rule-soft);
}
.users__all { display: none; font-size: var(--tb-fs-14); }
.users__note { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.users__batch { display: flex; gap: var(--tb-s2); margin-left: auto; flex-wrap: wrap; }

.users__table tbody tr.is-picked { background: color-mix(in srgb, var(--tb-orange) 8%, var(--tb-paper)); }
.users__who { display: grid; gap: 1px; min-width: 0; }
.users__name { display: flex; align-items: center; gap: var(--tb-s2); min-width: 0; flex-wrap: wrap; }
.users__handle { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; font-variant-numeric: tabular-nums; }
.users__id { color: var(--tb-ink-3); font-size: var(--tb-fs-12); }
.users__devices { font-weight: 600; }
.users__devices.is-zero { color: var(--tb-ink-3); font-weight: 400; }
.users__status { display: inline-flex; align-items: center; gap: var(--tb-s2); }
.users__status .tb-switch { min-height: 32px; }
.users__date { display: grid; line-height: 1.3; }
.users__date small { color: var(--tb-ink-3); font-size: var(--tb-fs-12); }
.users__acts { display: inline-flex; gap: 2px; justify-content: flex-end; flex-wrap: nowrap; white-space: nowrap; }
.users__del { color: var(--tb-danger); }
.users__fail { display: flex; align-items: center; gap: var(--tb-s2); padding-top: var(--tb-s3); color: var(--tb-danger); font-size: var(--tb-fs-14); }
.users__pager { border-top: 1px solid var(--tb-rule); }

.users__pwlead { color: var(--tb-ink-2); }
.users__pwbox { display: grid; gap: var(--tb-s2); }
.users__pwlabel { font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-ink-2); }
.users__pwfield {
  display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px var(--tb-s4);
  border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-m); background: var(--tb-paper-2);
}
.users__pw {
  flex: 1; min-width: 0; height: 48px; border: 0; outline: none; background: transparent; color: var(--tb-ink);
  font: 700 var(--tb-fs-24)/1 var(--tb-font-display); letter-spacing: .04em; font-variant-numeric: tabular-nums;
}
.users__pwhint { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }

@media (max-width: 640px) {
  .users__filter > .tb-btn { flex: none; }
  .users__q { max-width: none; }
  .users__all { display: inline-flex; min-height: var(--tb-target); }
  .users__note { display: none; }
  .users__batch { margin-left: 0; width: 100%; }
  .users__batch .tb-btn { flex: 1; min-height: var(--tb-target); }
  .users__table td { align-items: center; }
  .users__acts { justify-content: flex-start; }
  .users__acts .tb-btn, .users__status .tb-switch { min-height: var(--tb-target); }
  /* the row's checkbox sits beside its username, which heads the block */
  .users__table tbody tr { position: relative; }
  .users__table td.tb-table__sel { position: absolute; top: 6px; right: 0; width: auto; padding: 0; }
  .users__table td.tb-table__sel .tb-check { min-height: var(--tb-target); min-width: var(--tb-target); justify-content: center; }
  .users__table tbody td:nth-child(2) { display: block; padding-right: 52px; }
  .users__table tbody td:nth-child(2)::before { content: none; }
  .users__table .users__handle { font-size: var(--tb-fs-16); }
  .users__table tbody td:last-child { display: block; padding-top: var(--tb-s2); }
  .users__table tbody td:last-child::before { content: none; }
  .users__acts { display: flex; gap: var(--tb-s2); }
  .users__acts .tb-btn { flex: 1; border-color: var(--tb-rule-soft); }
}
</style>
