<template>
  <div class="nx-admin">
    <HeaderBar />
    <main class="nx-page">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t('paramManagement.pageTitle') }}</h1>
          <p class="nx-page-header__desc">{{ tt('paramManagement.pageDesc', 'Server settings stored as key–value pairs, grouped by namespace.') }}</p>
        </div>
        <div class="nx-page-header__actions">
          <el-input
            v-model="searchCode"
            class="admin-search"
            prefix-icon="el-icon-search"
            clearable
            :placeholder="$t('paramManagement.searchPlaceholder')"
            :aria-label="$t('paramManagement.search')"
            @keyup.enter.native="handleSearch"
            @clear="handleSearch"
          />
          <el-tooltip :content="$t('paramManagement.refresh')" placement="bottom">
            <button type="button" class="nx-icon-btn" :aria-label="$t('paramManagement.refresh')" :disabled="loading"
              @click="fetchParams">
              <i class="el-icon-refresh" :class="{ 'is-spinning': loading }" aria-hidden="true"></i>
            </button>
          </el-tooltip>
          <CustomButton icon="el-icon-plus" type="add" @click="showAddDialog">
            {{ $t('paramManagement.addParam') }}
          </CustomButton>
        </div>
      </header>

      <!-- Namespace filter chips -->
      <div v-if="allParams.length" class="chip-row" role="group" :aria-label="$t('paramManagement.groupHint')">
        <button
          v-for="tab in categoryTabs"
          :key="tab.key"
          type="button"
          class="chip"
          :class="{ 'is-active': activeCategory === tab.key }"
          :aria-pressed="activeCategory === tab.key ? 'true' : 'false'"
          @click="selectCategory(tab.key)"
        >
          <span>{{ tab.label }}</span>
          <span class="chip__count nx-num">{{ tab.count }}</span>
        </button>
      </div>
      <div v-if="subCategoryTabs.length > 1" class="chip-row chip-row--sub" role="group">
        <button
          v-for="tab in subCategoryTabs"
          :key="tab.key"
          type="button"
          class="chip chip--sub"
          :class="{ 'is-active': activeSubCategory === tab.key }"
          :aria-pressed="activeSubCategory === tab.key ? 'true' : 'false'"
          @click="selectSubCategory(tab.key)"
        >
          <span>{{ tab.label }}</span>
          <span class="chip__count nx-num">{{ tab.count }}</span>
        </button>
      </div>

      <section class="nx-card nx-card--flush params-card">
        <div class="params-card__toolbar">
          <el-checkbox :value="isAllSelected" :indeterminate="selectedCount > 0 && !isAllSelected"
            :disabled="!filteredParams.length" @change="handleSelectAll">
            {{ selectedCount ? $t('paramManagement.selectedCount', { count: selectedCount }) : $t('paramManagement.selectAll') }}
          </el-checkbox>
          <span class="params-card__meta nx-num">
            {{ $t('paramManagement.totalRecords', { total: filteredTotal }) }}
            <span aria-hidden="true">·</span>
            {{ $t('paramManagement.groupHint') }}
          </span>
          <span class="nx-spacer"></span>
          <CustomButton size="small" type="delete" icon="el-icon-delete" :disabled="!selectedCount"
            @click="deleteSelectedParams">
            {{ $t('paramManagement.delete') }}
          </CustomButton>
        </div>

        <!-- First load: skeleton rows -->
        <div v-if="loading && !allParams.length" class="params-skeleton" aria-busy="true">
          <div v-for="n in 6" :key="n" class="params-skeleton__row">
            <span class="nx-skeleton params-skeleton__code"></span>
            <span class="nx-skeleton params-skeleton__value"></span>
          </div>
        </div>

        <div v-else class="params-body" v-loading="loading">
          <el-collapse v-if="displaySections.length" v-model="activeCollapse" class="params-collapse">
            <el-collapse-item v-for="section in displaySections" :key="section.key" :name="section.key">
              <template slot="title">
                <div class="section-title">
                  <span class="section-title__name nx-truncate">{{ section.label }}</span>
                  <span class="nx-badge nx-num">{{ section.items.length }}</span>
                  <span v-if="section.hint" class="section-title__hint">{{ section.hint }}</span>
                </div>
              </template>
              <el-table :data="section.items" class="params-table">
                <el-table-column width="52" align="center">
                  <template slot-scope="scope">
                    <el-checkbox v-model="scope.row.selected" :aria-label="scope.row.paramCode" @change="syncSelectAllState" />
                  </template>
                </el-table-column>
                <el-table-column :label="$t('paramManagement.paramCode')" min-width="230">
                  <template slot-scope="scope">
                    <span class="param-code nx-mono nx-truncate" :title="scope.row.paramCode">{{ scope.row.paramCode }}</span>
                  </template>
                </el-table-column>
                <el-table-column :label="$t('paramManagement.valueType')" width="100">
                  <template slot-scope="scope">
                    <span class="nx-badge" :class="typeBadge(scope.row.valueType)">{{ scope.row.valueType || 'string' }}</span>
                  </template>
                </el-table-column>
                <el-table-column :label="$t('paramManagement.paramValue')" min-width="240">
                  <template slot-scope="scope">
                    <div v-if="isSensitiveParam(scope.row.paramCode)" class="value-cell">
                      <span class="value-text nx-mono nx-truncate" :class="{ 'is-masked': !scope.row.showValue }"
                        :title="scope.row.showValue ? String(scope.row.paramValue || '') : null">
                        {{ scope.row.showValue ? formatValue(scope.row.paramValue) : maskSensitiveValue(scope.row.paramValue) }}
                      </span>
                      <button type="button" class="nx-icon-btn value-btn"
                        :aria-label="scope.row.showValue ? $t('paramManagement.hide') : $t('paramManagement.view')"
                        :title="scope.row.showValue ? $t('paramManagement.hide') : $t('paramManagement.view')"
                        @click="toggleSensitiveValue(scope.row)">
                        <i :class="scope.row.showValue ? 'el-icon-lock' : 'el-icon-view'" aria-hidden="true"></i>
                      </button>
                      <button type="button" class="nx-icon-btn value-btn" :aria-label="tt('paramManagement.copyValue', 'Copy value')"
                        :title="tt('paramManagement.copyValue', 'Copy value')" @click="copyValue(scope.row.paramValue)">
                        <i class="el-icon-document-copy" aria-hidden="true"></i>
                      </button>
                    </div>
                    <span v-else class="value-text nx-mono nx-truncate" :title="String(scope.row.paramValue == null ? '' : scope.row.paramValue)">
                      {{ formatValue(scope.row.paramValue) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="remark" :label="$t('paramManagement.remark')" min-width="200" show-overflow-tooltip>
                  <template slot-scope="scope">
                    <span class="remark-text">{{ scope.row.remark || '—' }}</span>
                  </template>
                </el-table-column>
                <el-table-column :label="$t('paramManagement.operation')" width="140" align="right" fixed="right">
                  <template slot-scope="scope">
                    <div class="row-actions">
                      <el-button size="mini" type="text" @click="editParam(scope.row)">{{ $t('paramManagement.edit') }}</el-button>
                      <el-button size="mini" type="text" class="row-action--danger" @click="deleteParam(scope.row)">
                        {{ $t('paramManagement.delete') }}
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </el-collapse-item>
          </el-collapse>

          <div v-else-if="!loading" class="nx-empty">
            <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-s-operation"></i></span>
            <template v-if="appliedSearch">
              <p class="nx-empty__title">{{ $t('paramManagement.emptyResult') }}</p>
              <p class="nx-empty__text">{{ tt('paramManagement.emptySearchText', 'Try another code or remark, or clear the search.') }}</p>
              <CustomButton class="nx-empty__action" @click="clearSearch">{{ tt('paramManagement.clearSearch', 'Clear search') }}</CustomButton>
            </template>
            <template v-else>
              <p class="nx-empty__title">{{ tt('paramManagement.emptyTitle', 'No parameters yet') }}</p>
              <p class="nx-empty__text">{{ tt('paramManagement.emptyText', 'Add a parameter to configure the server.') }}</p>
              <CustomButton class="nx-empty__action" type="add" icon="el-icon-plus" @click="showAddDialog">
                {{ $t('paramManagement.addParam') }}
              </CustomButton>
            </template>
          </div>
        </div>
      </section>
    </main>

    <param-dialog
      ref="paramDialog"
      :title="dialogTitle"
      :visible.sync="dialogVisible"
      :form="paramForm"
      @submit="handleSubmit"
      @cancel="dialogVisible = false"
    />
    <VersionFooter />
  </div>
</template>

<script>
import Api from "@/apis/api";
import HeaderBar from "@/components/HeaderBar.vue";
import ParamDialog from "@/components/ParamDialog.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import CustomButton from "@/components/CustomButton.vue";

const TOP_GROUP_ORDER = ['server', 'plugins', 'log', 'session_state', 'general'];
const FETCH_LIMIT = 500;

const SERVER_SUB_ORDER = [
  '_root', 'auth', 'connection', 'registry', 'resilience', 'metrics', 'tracing'
];

export default {
  components: { HeaderBar, ParamDialog, VersionFooter, CustomButton },
  data() {
    return {
      searchCode: "",
      appliedSearch: "",
      allParams: [],
      loading: false,
      dialogVisible: false,
      dialogTitle: "",
      isAllSelected: false,
      activeCategory: 'all',
      activeSubCategory: 'all',
      activeCollapse: [],
      sensitive_keys: [
        "api_key", "personal_access_token", "access_token", "token", "secret",
        "access_key_secret", "secret_key", "password", "mqtt_signature_key", "private_key"
      ],
      paramForm: {
        id: null,
        paramCode: "",
        paramValue: "",
        valueType: "string",
        remark: ""
      }
    };
  },
  computed: {
    filteredParams() {
      const keyword = (this.appliedSearch || "").trim().toLowerCase();
      let list = this.allParams;

      if (this.activeCategory !== 'all') {
        list = list.filter(item => this.getTopGroup(item.paramCode) === this.activeCategory);
      }

      if (this.activeSubCategory !== 'all') {
        list = list.filter(item => this.getSubGroup(item.paramCode) === this.activeSubCategory);
      }

      if (keyword) {
        list = list.filter(item => {
          const code = (item.paramCode || "").toLowerCase();
          const remark = (item.remark || "").toLowerCase();
          return code.includes(keyword) || remark.includes(keyword);
        });
      }

      return list;
    },
    filteredTotal() {
      return this.filteredParams.length;
    },
    selectedCount() {
      return this.filteredParams.filter(item => item.selected).length;
    },
    categoryTabs() {
      const keyword = (this.appliedSearch || "").trim().toLowerCase();
      const searchFiltered = keyword
        ? this.allParams.filter(item => {
            const code = (item.paramCode || "").toLowerCase();
            const remark = (item.remark || "").toLowerCase();
            return code.includes(keyword) || remark.includes(keyword);
          })
        : this.allParams;

      const searchCounts = {
        all: searchFiltered.length,
        server: 0,
        plugins: 0,
        log: 0,
        session_state: 0,
        general: 0
      };
      searchFiltered.forEach(item => {
        const key = this.getTopGroup(item.paramCode);
        searchCounts[key] = (searchCounts[key] || 0) + 1;
      });

      return [
        { key: 'all', label: this.$t('paramManagement.group.all'), count: searchCounts.all },
        { key: 'server', label: this.$t('paramManagement.group.server'), count: searchCounts.server },
        { key: 'plugins', label: this.$t('paramManagement.group.plugins'), count: searchCounts.plugins },
        { key: 'log', label: this.$t('paramManagement.group.log'), count: searchCounts.log },
        { key: 'session_state', label: this.$t('paramManagement.group.session'), count: searchCounts.session_state },
        { key: 'general', label: this.$t('paramManagement.group.general'), count: searchCounts.general }
      ].filter(tab => tab.key === 'all' || searchCounts[tab.key] > 0);
    },
    subCategoryTabs() {
      const source = this.activeCategory === 'all'
        ? []
        : this.allParams.filter(item => this.getTopGroup(item.paramCode) === this.activeCategory);

      if (!source.length) return [];

      const keyword = (this.appliedSearch || "").trim().toLowerCase();
      const filtered = keyword
        ? source.filter(item => {
            const code = (item.paramCode || "").toLowerCase();
            const remark = (item.remark || "").toLowerCase();
            return code.includes(keyword) || remark.includes(keyword);
          })
        : source;

      const countMap = {};
      filtered.forEach(item => {
        const sub = this.getSubGroup(item.paramCode);
        countMap[sub] = (countMap[sub] || 0) + 1;
      });

      const keys = Object.keys(countMap);
      if (keys.length <= 1) return [];

      const ordered = this.orderSubKeys(keys, this.activeCategory);
      return [
        { key: 'all', label: this.$t('paramManagement.group.all'), count: filtered.length },
        ...ordered.map(key => ({
          key,
          label: this.getSubGroupLabel(this.activeCategory, key),
          count: countMap[key]
        }))
      ];
    },
    displaySections() {
      const items = this.filteredParams;
      if (!items.length) return [];

      // Single section display when primary and secondary (non-all) selected
      if (this.activeCategory !== 'all' && this.activeSubCategory !== 'all') {
        return [{
          key: `${this.activeCategory}.${this.activeSubCategory}`,
          label: this.getSubGroupLabel(this.activeCategory, this.activeSubCategory),
          hint: this.getTopGroupLabel(this.activeCategory),
          items
        }];
      }

      // Primary category selected: aggregate by secondary
      if (this.activeCategory !== 'all') {
        return this.buildSections(items, true);
      }

      // All: aggregate primary -> secondary into flat sections (primary - secondary)
      return this.buildSections(items, false);
    }
  },
  watch: {
    displaySections: {
      immediate: true,
      handler(sections) {
        const keys = sections.map(s => s.key);
        if (!keys.length) {
          this.activeCollapse = [];
          this.isAllSelected = false;
          return;
        }
        // Expand all when few groups; expand first few groups when many
        const preferOpen = keys.length <= 5 ? keys.slice() : keys.slice(0, 3);
        const stillValid = (this.activeCollapse || []).filter(k => keys.includes(k));
        this.activeCollapse = stillValid.length ? stillValid : preferOpen;
        this.syncSelectAllState();
      }
    },
    categoryTabs(tabs) {
      if (!tabs.some(t => t.key === this.activeCategory)) {
        this.activeCategory = 'all';
        this.activeSubCategory = 'all';
      }
    }
  },
  created() {
    this.fetchParams();
  },
  methods: {
    // $t with an English fallback for keys that are still pending in src/i18n/_pending/web-system.js
    tt(key, fallback) {
      return this.$te(key) || this.$te(key, 'en') ? this.$t(key) : fallback;
    },
    typeBadge(type) {
      const map = { number: 'nx-badge--info', boolean: 'nx-badge--success', json: 'nx-badge--warning', array: 'nx-badge--warning' };
      return map[type] || '';
    },
    clearSearch() {
      this.searchCode = "";
      this.handleSearch();
    },
    copyValue(value) {
      const text = value == null ? '' : String(value);
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        this.$message.error(this.$t('common.copyFailed'));
        return;
      }
      navigator.clipboard.writeText(text).then(() => {
        this.$message.success(this.$t('common.copySuccess'));
      }).catch(() => {
        this.$message.error(this.$t('common.copyFailed'));
      });
    },
    getTopGroup(paramCode = '') {
      if (paramCode.startsWith('server.')) return 'server';
      if (paramCode.startsWith('plugins.')) return 'plugins';
      if (paramCode.startsWith('log.')) return 'log';
      if (paramCode.startsWith('session_state.')) return 'session_state';
      return 'general';
    },
    getSubGroup(paramCode = '') {
      const top = this.getTopGroup(paramCode);
      const parts = paramCode.split('.');
      if (top === 'server') {
        return parts.length >= 3 ? parts[1] : '_root';
      }
      if (top === 'plugins') {
        return parts.length >= 3 ? parts[1] : '_root';
      }
      if (top === 'log' || top === 'session_state') {
        return '_all';
      }
      return '_all';
    },
    getTopGroupLabel(key) {
      const map = {
        server: 'paramManagement.group.server',
        plugins: 'paramManagement.group.plugins',
        log: 'paramManagement.group.log',
        session_state: 'paramManagement.group.session',
        general: 'paramManagement.group.general'
      };
      return this.$t(map[key] || 'paramManagement.group.general');
    },
    getSubGroupLabel(top, sub) {
      if (sub === '_all') return this.getTopGroupLabel(top);
      if (sub === '_root') return this.$t('paramManagement.subgroup.root');

      const known = {
        'server.auth': 'paramManagement.subgroup.auth',
        'server.connection': 'paramManagement.subgroup.connection',
        'server.registry': 'paramManagement.subgroup.registry',
        'server.resilience': 'paramManagement.subgroup.resilience',
        'server.metrics': 'paramManagement.subgroup.metrics',
        'server.tracing': 'paramManagement.subgroup.tracing'
      };
      const i18nKey = known[`${top}.${sub}`];
      if (i18nKey) return this.$t(i18nKey);

      if (top === 'plugins') {
        return this.$t('paramManagement.subgroup.plugin', { name: sub });
      }
      return sub;
    },
    orderSubKeys(keys, top) {
      if (top === 'server') {
        return [
          ...SERVER_SUB_ORDER.filter(k => keys.includes(k)),
          ...keys.filter(k => !SERVER_SUB_ORDER.includes(k)).sort()
        ];
      }
      return keys.slice().sort((a, b) => {
        if (a === '_root' || a === '_all') return -1;
        if (b === '_root' || b === '_all') return 1;
        return a.localeCompare(b);
      });
    },
    buildSections(items, withinTopCategory) {
      const bucket = {};
      items.forEach(item => {
        const top = this.getTopGroup(item.paramCode);
        const sub = this.getSubGroup(item.paramCode);
        const key = withinTopCategory ? `${top}.${sub}` : `${top}.${sub}`;
        if (!bucket[key]) {
          bucket[key] = {
            key,
            top,
            sub,
            items: []
          };
        }
        bucket[key].items.push(item);
      });

      const sections = Object.values(bucket).map(section => {
        const label = withinTopCategory
          ? this.getSubGroupLabel(section.top, section.sub)
          : (section.sub === '_all' || section.sub === '_root'
            ? this.getTopGroupLabel(section.top)
            : `${this.getTopGroupLabel(section.top)} · ${this.getSubGroupLabel(section.top, section.sub)}`);
        return {
          key: section.key,
          label,
          hint: withinTopCategory ? null : null,
          items: section.items.slice().sort((a, b) => a.paramCode.localeCompare(b.paramCode)),
          _top: section.top,
          _sub: section.sub
        };
      });

      sections.sort((a, b) => {
        const topDiff = TOP_GROUP_ORDER.indexOf(a._top) - TOP_GROUP_ORDER.indexOf(b._top);
        if (topDiff !== 0) return topDiff;
        const orderA = this.orderSubKeys([a._sub, b._sub], a._top);
        return orderA.indexOf(a._sub) - orderA.indexOf(b._sub);
      });

      return sections;
    },
    selectCategory(key) {
      if (this.activeCategory === key) return;
      this.activeCategory = key;
      this.activeSubCategory = 'all';
      this.isAllSelected = false;
      this.allParams.forEach(row => { row.selected = false; });
    },
    selectSubCategory(key) {
      if (this.activeSubCategory === key) return;
      this.activeSubCategory = key;
      this.isAllSelected = false;
      this.filteredParams.forEach(row => { row.selected = false; });
      this.syncSelectAllState();
    },
    fetchParamsPage(page) {
      return new Promise((resolve, reject) => {
        Api.admin.getParamsList(
          {
            page,
            limit: FETCH_LIMIT,
            paramCode: ""
          },
          ({ data }) => {
            if (data.code === 0) {
              resolve(data.data || {});
            } else {
              reject(new Error(data.msg || this.$t('paramManagement.getParamsListFailed')));
            }
          }
        );
      });
    },
    async fetchParams() {
      this.loading = true;
      try {
        const collected = [];
        let page = 1;
        let total = Infinity;
        // Paginate through all data using total to prevent missing data in aggregated view
        while (collected.length < total) {
          const pageData = await this.fetchParamsPage(page);
          const list = pageData.list || [];
          total = typeof pageData.total === 'number' ? pageData.total : collected.length + list.length;
          collected.push(...list);
          if (!list.length) break;
          page += 1;
          // Prevent infinite loop on abnormal total or API error
          if (page > 200) break;
        }

        this.allParams = collected.map(item => ({
          ...item,
          valueType: item.valueType || "string",
          selected: false,
          showValue: false
        }));
        this.isAllSelected = false;

        // If current category has no data, fall back to all
        const exists = this.categoryTabs.some(t => t.key === this.activeCategory);
        if (!exists) {
          this.activeCategory = 'all';
          this.activeSubCategory = 'all';
        }
      } catch (err) {
        this.$message.error({
          message: (err && err.message) || this.$t('paramManagement.getParamsListFailed'),
          showClose: true
        });
      } finally {
        this.loading = false;
      }
    },
    handleSearch() {
      this.appliedSearch = this.searchCode;
      this.activeSubCategory = 'all';
      this.$nextTick(() => {
        if (!this.categoryTabs.some(t => t.key === this.activeCategory)) {
          this.activeCategory = 'all';
        }
        this.syncSelectAllState();
      });
    },
    syncSelectAllState() {
      const list = this.filteredParams;
      this.isAllSelected = list.length > 0 && list.every(row => row.selected);
    },
    handleSelectAll() {
      this.isAllSelected = !this.isAllSelected;
      this.filteredParams.forEach(row => {
        row.selected = this.isAllSelected;
      });
    },
    formatValue(value) {
      if (value == null) return '';
      const text = String(value);
      return text.length > 120 ? `${text.slice(0, 120)}…` : text;
    },
    showAddDialog() {
      this.dialogTitle = this.$t('paramManagement.addParam');
      this.paramForm = {
        id: null,
        paramCode: "",
        paramValue: "",
        valueType: "string",
        remark: ""
      };
      this.dialogVisible = true;
    },
    editParam(row) {
      this.dialogTitle = this.$t('paramManagement.editParam');
      this.paramForm = {
        id: row.id,
        paramCode: row.paramCode,
        paramValue: row.paramValue,
        valueType: row.valueType || "string",
        remark: row.remark
      };
      this.dialogVisible = true;
    },
    handleSubmit(form) {
      if (form.id) {
        Api.admin.updateParam(form, ({ data }) => {
          this.dialogVisible = false;
          this.fetchParams();
          this.$message.success({
            message: this.$t('paramManagement.updateSuccess'),
            showClose: true
          });
        }, ({ data }) => {
          this.$message.error({
            message: data.msg || this.$t('paramManagement.updateFailed'),
            showClose: true
          });
          if (this.$refs.paramDialog && typeof this.$refs.paramDialog.resetSaving === 'function') {
            this.$refs.paramDialog.resetSaving();
          }
        });
      } else {
        Api.admin.addParam(form, ({ data }) => {
          if (data.code === 0) {
            this.dialogVisible = false;
            this.fetchParams();
            this.$message.success({
              message: this.$t('paramManagement.addSuccess'),
              showClose: true
            });
          } else {
            this.$message.error({
              message: data.msg || this.$t('paramManagement.addFailed'),
              showClose: true
            });
            if (this.$refs.paramDialog && typeof this.$refs.paramDialog.resetSaving === 'function') {
              this.$refs.paramDialog.resetSaving();
            }
          }
        }, ({ data }) => {
          this.$message.error({
            message: data.msg || this.$t('paramManagement.updateFailed'),
            showClose: true
          });
          if (this.$refs.paramDialog && typeof this.$refs.paramDialog.resetSaving === 'function') {
            this.$refs.paramDialog.resetSaving();
          }
        });
      }
    },
    deleteSelectedParams() {
      const selectedParams = this.filteredParams.filter(row => row.selected);
      if (selectedParams.length === 0) {
        this.$message.warning({
          message: this.$t('paramManagement.selectParamsFirst'),
          showClose: true
        });
        return;
      }
      this.deleteParams(selectedParams);
    },
    deleteParam(row) {
      if (!row.id) {
        this.$message.warning({
          message: this.$t('paramManagement.selectParamsFirst'),
          showClose: true
        });
        return;
      }
      this.deleteParams([row]);
    },
    deleteParams(params) {
      const paramCount = params.length;
      const paramIds = params.map(param => param.id).filter(id => id);
      if (paramIds.length === 0) {
        this.$message.error({
          message: this.$t('paramManagement.invalidParamId'),
          showClose: true
        });
        return;
      }
      const title = paramCount === 1 && params[0].paramCode ? params[0].paramCode : this.$t('message.warning');
      this.$confirm(this.$t('paramManagement.confirmBatchDelete', { paramCount }), title, {
        confirmButtonText: this.$t('paramManagement.delete'),
        cancelButtonText: this.$t('button.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }).then(() => {
        Api.admin.deleteParam(paramIds, ({ data }) => {
          if (data.code === 0) {
            this.fetchParams();
            this.$message.success({
              message: this.$t('paramManagement.batchDeleteSuccess', { paramCount }),
              showClose: true
            });
          } else {
            this.$message.error({
              message: data.msg || this.$t('paramManagement.deleteFailed'),
              showClose: true
            });
          }
        });
      }).catch(() => {
        this.$message({
          type: 'info',
          message: this.$t('paramManagement.operationCancelled'),
          duration: 1000
        });
      });
    },
    isSensitiveParam(paramCode) {
      return this.sensitive_keys.some(key => paramCode.toLowerCase().includes(key));
    },
    maskSensitiveValue(value) {
      if (!value || value.length <= 4) {
        return '****';
      }
      return value.substring(0, 2) + '****' + value.substring(value.length - 2);
    },
    toggleSensitiveValue(row) {
      row.showValue = !row.showValue;
    }
  }
};
</script>

<style lang="scss" scoped>
.nx-admin {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  > .nx-page {
    flex: 1 0 auto;
  }
}
.admin-search {
  width: 280px;
  max-width: 100%;
}
.is-spinning {
  animation: nx-spin 0.9s linear infinite;
}
@keyframes nx-spin {
  to {
    transform: rotate(360deg);
  }
}

// ---------------------------------------------------------------- filter chips
.chip-row {
  display: flex;
  gap: var(--nx-space-2);
  margin-bottom: var(--nx-space-3);
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
  &--sub {
    margin-top: calc(-1 * var(--nx-space-1));
  }
}
.chip {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 6px;
  height: var(--nx-control-h-sm);
  padding: 0 var(--nx-space-3);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface);
  color: var(--nx-text-2);
  font: inherit;
  font-size: var(--nx-text-footnote);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--nx-dur-1) var(--nx-ease), color var(--nx-dur-1) var(--nx-ease),
    border-color var(--nx-dur-1) var(--nx-ease), transform var(--nx-dur-1) var(--nx-ease);
  &:hover {
    background: var(--nx-surface-2);
    color: var(--nx-text);
  }
  &:active {
    transform: scale(0.97);
  }
  &.is-active {
    background: var(--nx-accent-soft);
    border-color: transparent;
    color: var(--nx-accent);
    font-weight: 600;
  }
  &__count {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
  &.is-active &__count {
    color: inherit;
    opacity: 0.8;
  }
  &--sub {
    height: 28px;
    border-color: transparent;
    background: transparent;
    &.is-active {
      background: var(--nx-surface-3);
      color: var(--nx-text);
    }
  }
}

// ---------------------------------------------------------------- card
.params-card {
  &__toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--nx-space-2) var(--nx-space-4);
    min-height: 56px;
    padding: var(--nx-space-3) var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
    ::v-deep .el-checkbox__label {
      font-size: var(--nx-text-footnote);
      color: var(--nx-text-2);
      font-variant-numeric: tabular-nums;
    }
  }
  &__meta {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
}
.params-body {
  min-height: 160px;
}
.params-skeleton {
  padding: var(--nx-space-2) var(--nx-space-5);
  &__row {
    display: flex;
    align-items: center;
    gap: var(--nx-space-6);
    height: 52px;
    border-bottom: 1px solid var(--nx-border);
    &:last-child {
      border-bottom: 0;
    }
  }
  &__code {
    width: 28%;
    height: 14px;
  }
  &__value {
    width: 40%;
    height: 14px;
  }
}

// Sections: one collapsible group per namespace
.params-collapse {
  border: 0;
  ::v-deep .el-collapse-item__header {
    height: 52px;
    line-height: 1.4;
    padding: 0 var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
    transition: background-color var(--nx-dur-1) var(--nx-ease);
    &:hover {
      background: var(--nx-surface-2);
    }
    &.focusing:focus:not(:hover) {
      color: var(--nx-text);
    }
  }
  ::v-deep .el-collapse-item:last-child .el-collapse-item__header:not(.is-active),
  ::v-deep .el-collapse-item:last-child .el-collapse-item__wrap {
    border-bottom: 0;
  }
  ::v-deep .el-collapse-item__arrow {
    margin: 0 0 0 auto;
    color: var(--nx-text-3);
  }
  ::v-deep .el-collapse-item__content {
    padding: 0;
  }
}
.section-title {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  min-width: 0;
  padding-right: var(--nx-space-3);
  &__name {
    font-size: var(--nx-text-callout);
    font-weight: 600;
    color: var(--nx-text);
  }
  &__hint {
    font-size: var(--nx-text-caption);
    font-weight: 400;
    color: var(--nx-text-3);
  }
}

.params-table {
  width: 100%;
  ::v-deep th.el-table__cell:nth-child(2) .cell,
  ::v-deep td.el-table__cell:nth-child(2) .cell {
    padding-left: 4px;
  }
  ::v-deep th.el-table__cell:last-child .cell,
  ::v-deep td.el-table__cell:last-child .cell {
    padding-right: var(--nx-space-5);
  }
}
.param-code {
  display: block;
  color: var(--nx-text);
}
.value-cell {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.value-text {
  display: block;
  min-width: 0;
  color: var(--nx-text-2);
  &.is-masked {
    letter-spacing: 0.08em;
  }
}
.value-cell .value-text {
  flex: 0 1 auto;
  margin-right: var(--nx-space-1);
}
.value-btn {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: var(--nx-radius-sm);
  font-size: var(--nx-text-callout);
}
.remark-text {
  color: var(--nx-text-2);
}
.row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
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

@media (prefers-reduced-motion: reduce) {
  .is-spinning {
    animation: none;
  }
}
</style>
