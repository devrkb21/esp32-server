<template>
  <div class="nx-admin">
    <HeaderBar />
    <main class="nx-page">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t('header.userManagement') }}</h1>
          <p class="nx-page-header__desc">{{ tt('user.pageDesc', 'Everyone who can sign in to Nobix Console, and the robots they own.') }}</p>
        </div>
        <div class="nx-page-header__actions">
          <el-input v-model="searchPhone" class="admin-search" prefix-icon="el-icon-search" clearable
            :placeholder="$t('user.searchPhone')" :aria-label="$t('user.search')"
            @keyup.enter.native="handleSearch" @clear="handleSearch" />
          <CustomButton @click="handleSearch">{{ $t('user.search') }}</CustomButton>
        </div>
      </header>

      <section class="nx-card nx-card--flush table-card">
        <div class="table-card__toolbar">
          <el-checkbox :value="allRowsSelected" :indeterminate="selectedCount > 0 && !allRowsSelected"
            :disabled="!userList.length" @change="handleSelectAll">
            {{ selectedCount ? tt('user.selectedCount', '{count} selected', { count: selectedCount }) : $t('user.selectAll') }}
          </el-checkbox>
          <span class="nx-spacer"></span>
          <CustomButton size="small" icon="el-icon-circle-check" :disabled="!selectedCount" @click="batchEnable">
            {{ $t('user.enable') }}
          </CustomButton>
          <CustomButton size="small" icon="el-icon-remove-outline" :disabled="!selectedCount" @click="batchDisable">
            {{ $t('user.disable') }}
          </CustomButton>
          <CustomButton size="small" type="delete" icon="el-icon-delete" :disabled="!selectedCount" @click="batchDelete">
            {{ $t('user.delete') }}
          </CustomButton>
        </div>

        <div v-if="!loading && !userList.length" class="nx-empty">
          <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-user"></i></span>
          <template v-if="searchPhone">
            <p class="nx-empty__title">{{ tt('user.emptySearchTitle', 'No users match your search') }}</p>
            <p class="nx-empty__text">{{ tt('user.emptySearchText', 'Check the phone number or clear the search.') }}</p>
            <CustomButton class="nx-empty__action" @click="clearSearch">{{ tt('user.clearSearch', 'Clear search') }}</CustomButton>
          </template>
          <template v-else>
            <p class="nx-empty__title">{{ tt('user.emptyTitle', 'No users yet') }}</p>
            <p class="nx-empty__text">{{ tt('user.emptyText', 'People appear here after they register an account.') }}</p>
          </template>
        </div>

        <div v-else class="table-card__body" :style="{ '--rows': userList.length }">
          <CustomTable ref="userTable" :data="userList" :columns="tableColumns" :loading="loading"
            :loading-text="$t('modelConfig.loading')" :show-selection="true" :show-operations="true"
            :operations-label="$t('modelConfig.action')" :operations-width="220" :total="total"
            :current-page="currentPage" :page-size="pageSize" :page-size-options="pageSizeOptions"
            @size-change="handlePageSizeChange" @page-change="goToPage">
            <template slot="selection" slot-scope="scope">
              <el-checkbox v-model="scope.row.selected" :aria-label="scope.row.mobile"></el-checkbox>
            </template>
            <template slot="mobile" slot-scope="scope">
              <div class="user-cell">
                <span class="nx-avatar" aria-hidden="true">{{ initialOf(scope.row.mobile) }}</span>
                <div class="user-cell__text">
                  <div class="user-cell__name">
                    <span class="nx-truncate" :title="scope.row.mobile">{{ scope.row.mobile || '—' }}</span>
                    <span v-if="isSuperAdmin(scope.row)" class="nx-badge nx-badge--accent">{{ tt('user.superAdmin', 'Super admin') }}</span>
                  </div>
                  <div class="nx-caption nx-mono nx-truncate" :title="scope.row.userid">{{ scope.row.userid }}</div>
                </div>
              </div>
            </template>
            <template slot="deviceCount" slot-scope="scope">
              <span class="nx-num">{{ scope.row.deviceCount || 0 }}</span>
            </template>
            <template slot="createDate" slot-scope="scope">
              <span class="nx-num nx-muted">{{ scope.row.createDate || '—' }}</span>
            </template>
            <template slot="status" slot-scope="scope">
              <div class="status-cell">
                <el-switch :value="scope.row.status === 1"
                  :aria-label="scope.row.status === 1 ? $t('user.disableAccount') : $t('user.enableAccount')"
                  @change="val => handleChangeStatus(scope.row, val ? 1 : 0)" />
                <span class="nx-badge" :class="scope.row.status === 1 ? 'nx-badge--success' : 'nx-badge--danger'">
                  {{ scope.row.status === 1 ? $t('user.normal') : $t('user.disabled') }}
                </span>
              </div>
            </template>
            <template slot="operations" slot-scope="scope">
              <div class="row-actions">
                <el-button size="mini" type="text" @click="resetPassword(scope.row)">{{ $t('user.resetPassword') }}</el-button>
                <el-button size="mini" type="text" class="row-action--danger" @click="deleteUser(scope.row)">
                  {{ $t('user.deleteUser') }}
                </el-button>
              </div>
            </template>
          </CustomTable>
        </div>
      </section>
    </main>

    <view-password-dialog :visible.sync="showViewPassword" :password="currentPassword" />
    <VersionFooter />
  </div>
</template>

<script>
import Api from "@/apis/api";
import HeaderBar from "@/components/HeaderBar.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import ViewPasswordDialog from "@/components/ViewPasswordDialog.vue";
import CustomButton from "@/components/CustomButton.vue";
import CustomTable from "@/components/CustomTable.vue";
export default {
  components: { HeaderBar, ViewPasswordDialog, VersionFooter, CustomButton, CustomTable },
  data() {
    return {
      showViewPassword: false,
      currentPassword: "",
      searchPhone: "",
      userList: [],
      pageSizeOptions: [10, 20, 50, 100],
      currentPage: 1,
      pageSize: 10,
      total: 0,
      isAllSelected: false,
      loading: false,
      tableColumns: []
    };
  },
  computed: {
    selectedCount() {
      return this.userList.filter(user => user.selected).length;
    },
    allRowsSelected() {
      return this.userList.length > 0 && this.selectedCount === this.userList.length;
    }
  },
  created() {
    this.initTableColumns();
    this.fetchUsers();
  },
  methods: {
    // $t with an English fallback for keys that are still pending in src/i18n/_pending/web-system.js
    tt(key, fallback, params) {
      if (this.$te(key) || this.$te(key, 'en')) return this.$t(key, params);
      return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
    },
    initialOf(name) {
      const text = String(name || '').trim();
      return text ? Array.from(text)[0] : '?';
    },
    isSuperAdmin(row) {
      return row.superAdmin === 1 || row.superAdmin === true;
    },
    initTableColumns() {
      this.tableColumns = [
        { prop: 'mobile', label: this.$t('user.username'), align: 'left', minWidth: 240, showOverflowTooltip: false },
        { prop: 'deviceCount', label: this.$t('user.deviceCount'), align: 'right', width: 120 },
        { prop: 'createDate', label: this.$t('user.createDate'), align: 'left', minWidth: 170 },
        { prop: 'status', label: this.$t('user.status'), align: 'left', width: 170, showOverflowTooltip: false }
      ];
    },
    handlePageSizeChange(val) {
      this.pageSize = val;
      this.currentPage = 1;
      this.fetchUsers();
    },

    fetchUsers() {
      this.loading = true;
      Api.admin.getUserList(
        {
          page: this.currentPage,
          limit: this.pageSize,
          mobile: this.searchPhone,
        },
        ({ data }) => {
          this.loading = false; // End loading
          if (data.code === 0) {
            this.userList = data.data.list.map(item => ({
              ...item,
              selected: false
            }));
            this.total = data.data.total;
            this.isAllSelected = false;
          }
        }
      );
    },
    handleSearch() {
      this.currentPage = 1;
      this.fetchUsers();
    },
    clearSearch() {
      this.searchPhone = "";
      this.handleSearch();
    },
    handleSelectAll() {
      this.isAllSelected = !this.allRowsSelected;
      this.userList.forEach(row => {
        row.selected = this.isAllSelected;
      });
    },
    batchDelete() {
      const selectedUsers = this.userList.filter(user => user.selected);
      if (selectedUsers.length === 0) {
        this.$message.warning(this.$t('user.selectUsersFirst'));
        return;
      }

      this.$confirm(this.$t('user.confirmDeleteSelected', { count: selectedUsers.length }), this.$t('common.warning'), {
        confirmButtonText: this.$t('common.confirm'),
        cancelButtonText: this.$t('common.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: "warning",
      })
        .then(async () => {
          const loading = this.$loading({
            lock: true,
            text: this.$t('user.deleting'),
            spinner: "el-icon-loading"
          });

          try {
            const results = await Promise.all(
              selectedUsers.map((user) => {
                return new Promise((resolve) => {
                  Api.admin.deleteUser(user.userid, ({ data }) => {
                    if (data.code === 0) {
                      resolve({ success: true, userid: user.userid });
                    } else {
                      resolve({ success: false, userid: user.userid, msg: data.msg });
                    }
                  });
                });
              })
            );

            const successCount = results.filter((r) => r.success).length;
            const failCount = results.length - successCount;

            if (failCount === 0) {
              this.$message.success({
                message: this.$t('user.deleteSuccess', { count: successCount }),
                showClose: true
              });
            } else if (successCount === 0) {
              this.$message.error({
                message: this.$t('user.deleteFailed'),
                showClose: true
              });
            } else {
              this.$message.warning(
                this.$t('user.partialDelete', { successCount: successCount, failCount: failCount })
              );
            }

            this.fetchUsers();
          } catch (error) {
            this.$message.error(this.$t('user.deleteError'));
          } finally {
            loading.close();
          }
        })
        .catch(() => {
          this.$message.info(this.$t('user.deleteCancelled'));
        });
    },
    batchEnable() {
      const selectedUsers = this.userList.filter(user => user.selected);
      if (selectedUsers.length === 0) {
        this.$message.warning(this.$t('user.selectUsersToEnable'));
        return;
      }
      this.handleChangeStatus(selectedUsers, 1);
    },
    batchDisable() {
      const selectedUsers = this.userList.filter(user => user.selected);
      if (selectedUsers.length === 0) {
        this.$message.warning(this.$t('user.selectUsersToDisable'));
        return;
      }
      this.handleChangeStatus(selectedUsers, 0);
    },
    resetPassword(row) {
      this.$confirm(this.$t('user.confirmResetPassword'), this.$t('user.resetPassword'), {
        confirmButtonText: this.$t('user.resetPassword'),
        cancelButtonText: this.$t('common.cancel'),
        type: 'warning'
      }).then(() => {
        Api.admin.resetUserPassword(row.userid, ({ data }) => {
          if (data.code === 0) {
            // Show the generated password in the password dialog (copyable)
            this.currentPassword = String(data.data || '');
            this.showViewPassword = true;
            this.fetchUsers();
          } else {
            this.$message.error(data.msg || this.$t('user.operationFailed'));
          }
        });
      }).catch(() => {
        // Cancelled: nothing changed
      });
    },
    deleteUser(row) {
      this.$confirm(this.$t('user.confirmDeleteUser'), row.mobile || this.$t('user.deleteUser'), {
        confirmButtonText: this.$t('user.deleteUser'),
        cancelButtonText: this.$t('common.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }).then(() => {
        Api.admin.deleteUser(row.userid, ({ data }) => {
          if (data.code === 0) {
            // Check if page number needs adjustment after deletion
            const newTotal = this.total - 1;
            const maxPage = Math.max(1, Math.ceil(newTotal / this.pageSize));
            if (this.currentPage > maxPage) {
              this.currentPage = maxPage;
            }
            this.$message.success(this.$t('user.deleteUserSuccess'));
            this.fetchUsers();
          } else {
            this.$message.error(data.msg || this.$t('user.operationFailed'));
          }
        });
      }).catch(() => {
        this.$message.info(this.$t('common.deleteCancelled'));
      });
    },
    goToPage(page) {
      if (page !== this.currentPage) {
        this.currentPage = page;
        this.fetchUsers();
      }
    },
    handleChangeStatus(row, status) {
      // Process single user or user array
      const users = Array.isArray(row) ? row : [row];
      const actionText = status === 0 ? this.$t('user.disable') : this.$t('user.enable');
      const userCount = users.length;

      this.$confirm(this.$t('user.confirmStatusChange', { action: actionText, count: userCount }), this.$t('common.warning'), {
        confirmButtonText: actionText,
        cancelButtonText: this.$t('common.cancel'),
        type: 'warning'
      }).then(() => {
        const userIds = users.map(user => user.userid);
        if (userIds.some(id => isNaN(id))) {
          this.$message.error(this.$t('user.invalidUserId'));
          return;
        }

        Api.user.changeUserStatus(status, userIds, ({ data }) => {
          if (data.code === 0) {
            this.$message.success({
              message: this.$t('user.statusChangeSuccess', { action: actionText, count: userCount }),
              showClose: true
            });
            this.fetchUsers(); // Refresh user list
          } else {
            this.$message.error({
              message: this.$t('user.operationFailed'),
              showClose: true
            });
          }
        });
      }).catch(() => {
        // User cancelled operation
      });
    },
    // This method is replaced by batchDelete, kept for backward compatibility
    handleBatchDelete() {
      this.batchDelete();
    },
    handleBatchStatusChange(status) {
      const selectedUsers = this.userList.filter(user => user.selected);
      if (selectedUsers.length === 0) {
        this.$message.warning(this.$t('user.selectUsersFirst'));
        return;
      }
      this.handleChangeStatus(selectedUsers, status);
    },
  },
};
</script>

<style lang="scss" scoped>
// Admin page family: page header + one table card (shared look across the "More" pages)
.nx-admin {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  > .nx-page {
    flex: 1 0 auto;
  }
}
.admin-search {
  width: 260px;
  max-width: 100%;
}
.table-card {
  display: flex;
  flex-direction: column;
  &__toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--nx-space-2);
    min-height: 56px;
    padding: var(--nx-space-3) var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
    ::v-deep .el-checkbox__label {
      font-size: var(--nx-text-footnote);
      color: var(--nx-text-2);
      font-variant-numeric: tabular-nums;
    }
    .el-button + .el-button {
      margin-left: 0;
    }
  }
  // Height follows the row count, capped to the viewport; the table body scrolls inside
  &__body {
    height: clamp(280px, calc(var(--rows, 0) * 61px + 100px), max(440px, calc(100vh - 300px)));
    ::v-deep .custom-table-wrapper {
      height: 100%;
    }
    ::v-deep .table-container {
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    ::v-deep .table-footer {
      height: 48px;
      padding: 0 var(--nx-space-5);
      border-top: 1px solid var(--nx-border);
      flex-wrap: nowrap;
      overflow-x: auto;
    }
    ::v-deep th.el-table__cell:last-child .cell,
    ::v-deep td.el-table__cell:last-child .cell {
      text-align: right;
    }
  }
}
.nx-empty {
  padding: var(--nx-space-9) var(--nx-space-5);
}
.row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 2px;
  .el-button + .el-button {
    margin-left: 0;
  }
}
.row-action--danger.el-button--text {
  color: var(--nx-danger);
  &:hover,
  &:focus {
    color: var(--nx-danger);
    background: var(--nx-danger-soft);
  }
}

.user-cell {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-width: 0;
  &__text {
    min-width: 0;
    flex: 1;
  }
  &__name {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    font-weight: 600;
    color: var(--nx-text);
  }
}
.status-cell {
  display: inline-flex;
  align-items: center;
  gap: var(--nx-space-3);
}
</style>
