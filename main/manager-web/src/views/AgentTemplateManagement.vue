<template>
  <div class="templates-page">
    <HeaderBar />

    <main class="nx-page">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t("agentTemplateManagement.title") }}</h1>
          <p class="nx-page-header__desc">
            {{ tx('agentTemplateManagement.description', 'Starting points for new agents: a name and a personality prompt.') }}
          </p>
        </div>
        <div class="nx-page-header__actions">
          <el-input
            v-model="search"
            class="tm-search"
            prefix-icon="el-icon-search"
            clearable
            :placeholder="$t('agentTemplateManagement.searchPlaceholder')"
            :aria-label="$t('agentTemplateManagement.search')"
            @keyup.enter.native="handleSearch"
            @clear="handleSearch"
          />
          <CustomButton type="add" icon="el-icon-plus" @click="showAddTemplateDialog">
            {{ $t("agentTemplateManagement.createTemplate") }}
          </CustomButton>
        </div>
      </header>

      <section class="nx-card nx-card--flush tm-card">
        <transition name="nx-fade">
          <div v-if="selectedTemplates.length" class="tm-selection" role="status">
            <span class="tm-selection__count nx-num">
              {{ tx('agentTemplateManagement.selectedCount', '{count} selected', { count: selectedTemplates.length }) }}
            </span>
            <el-button type="text" size="small" @click="handleSelectAll">
              {{ isAllSelected ? $t("agentTemplateManagement.deselectAll") : $t("agentTemplateManagement.selectAll") }}
            </el-button>
            <span class="nx-spacer"></span>
            <CustomButton type="delete" size="small" icon="el-icon-delete" @click="batchDeleteTemplate">
              {{ $t("agentTemplateManagement.batchDelete") }}
            </CustomButton>
          </div>
        </transition>

        <el-table
          ref="templateTable"
          v-loading="templateLoading"
          :data="templateList"
          row-key="id"
          class="tm-table"
          :row-class-name="rowClassName"
        >
          <el-table-column width="52" align="center" class-name="tm-col-check">
            <template slot="header">
              <el-checkbox
                :value="isAllSelected"
                :indeterminate="selectedTemplates.length > 0 && !isAllSelected"
                :disabled="!templateList.length"
                :aria-label="$t('agentTemplateManagement.selectAll')"
                @change="handleSelectAll"
              />
            </template>
            <template slot-scope="scope">
              <el-checkbox
                v-model="scope.row.selected"
                :aria-label="scope.row.agentName"
                @change="handleRowSelectionChange(scope.row)"
              />
            </template>
          </el-table-column>

          <el-table-column :label="$t('agentTemplateManagement.templateName')" min-width="260">
            <template slot-scope="scope">
              <div class="tm-name">
                <span class="nx-avatar tm-name__avatar" aria-hidden="true">{{ initialOf(scope.row.agentName) }}</span>
                <div class="tm-name__text">
                  <button
                    type="button"
                    class="tm-name__title nx-truncate"
                    :title="scope.row.agentName"
                    @click="editTemplate(scope.row)"
                  >
                    {{ scope.row.agentName || '—' }}
                  </button>
                  <div v-if="scope.row.systemPrompt" class="tm-name__prompt nx-truncate" :title="scope.row.systemPrompt">
                    {{ scope.row.systemPrompt }}
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column :label="$t('agentTemplateManagement.serialNumber')" width="110" align="right">
            <template slot-scope="scope">
              <span class="nx-num tm-serial">{{ (currentPage - 1) * pageSize + scope.$index + 1 }}</span>
            </template>
          </el-table-column>

          <el-table-column :label="$t('agentTemplateManagement.action')" width="200" align="right">
            <template slot-scope="scope">
              <div class="tm-actions">
                <el-button type="text" size="small" icon="el-icon-edit" @click="editTemplate(scope.row)">
                  {{ $t("agentTemplateManagement.editTemplate") }}
                </el-button>
                <el-tooltip :content="$t('agentTemplateManagement.deleteTemplate')" placement="top">
                  <button
                    type="button"
                    class="nx-icon-btn nx-icon-btn--danger tm-delete"
                    :aria-label="`${$t('agentTemplateManagement.deleteTemplate')}: ${scope.row.agentName || ''}`"
                    @click="deleteTemplate(scope.row)"
                  >
                    <i class="el-icon-delete" aria-hidden="true"></i>
                  </button>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>

          <template slot="empty">
            <div v-if="!templateLoading" class="nx-empty tm-empty">
              <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true">
                <i :class="lastSearch ? 'el-icon-search' : 'el-icon-document-copy'"></i>
              </span>
              <template v-if="lastSearch">
                <p class="nx-empty__title">{{ tx('agentTemplateManagement.noResultsTitle', 'No matching templates') }}</p>
                <p class="nx-empty__text">{{ tx('agentTemplateManagement.noResultsText', 'Try a different name or clear the search.') }}</p>
                <el-button class="nx-empty__action" @click="clearSearch">
                  {{ tx('agentTemplateManagement.clearSearch', 'Clear search') }}
                </el-button>
              </template>
              <template v-else>
                <p class="nx-empty__title">{{ tx('agentTemplateManagement.emptyTitle', 'No templates yet') }}</p>
                <p class="nx-empty__text">{{ tx('agentTemplateManagement.emptyText', 'Create a template to give new agents a ready-made personality.') }}</p>
                <CustomButton class="nx-empty__action" type="add" icon="el-icon-plus" @click="showAddTemplateDialog">
                  {{ $t("agentTemplateManagement.createTemplate") }}
                </CustomButton>
              </template>
            </div>
            <span v-else></span>
          </template>
        </el-table>

        <footer v-if="total > 0" class="tm-footer">
          <CustomPagination
            :total="total"
            :current-page="currentPage"
            :page-size="pageSize"
            :page-size-options="pageSizeOptions"
            @size-change="handlePageSizeChange"
            @page-change="handlePageChange"
          />
        </footer>
      </section>
    </main>

    <!-- Add/Edit Template Dialog -->
    <CustomDialog
      :title="dialogTitle"
      :visible.sync="dialogVisible"
      :confirm-loading="confirmLoading"
      :footer="true"
      width="720px"
      :cancel-text="$t('common.cancel')"
      :confirm-text="$t('button.save')"
      @confirm="handleDialogConfirm"
      @cancel="dialogVisible = false"
    >
      <el-form ref="dialogForm" :model="form" :rules="formRules" label-position="top" class="tm-form">
        <el-form-item :label="$t('templateQuickConfig.agentSettings.agentName')" prop="agentName">
          <el-input
            v-model="form.agentName"
            maxlength="64"
            :placeholder="$t('templateQuickConfig.agentSettings.agentNamePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="$t('templateQuickConfig.agentSettings.systemPrompt')" prop="systemPrompt" class="tm-form__prompt">
          <el-input
            v-model="form.systemPrompt"
            type="textarea"
            :placeholder="$t('templateQuickConfig.agentSettings.systemPromptPlaceholder')"
            maxlength="2000"
            :autosize="{ minRows: 12, maxRows: 24 }"
          />
          <div class="tm-count nx-num" :class="{ 'is-near': (form.systemPrompt || '').length >= 1800 }">
            {{ (form.systemPrompt || '').length }} / 2000
          </div>
        </el-form-item>
      </el-form>
    </CustomDialog>

    <VersionFooter />
  </div>
</template>

<script>
import HeaderBar from "@/components/HeaderBar";
import agentApi from "@/apis/module/agent";
import VersionFooter from "@/components/VersionFooter.vue";
import CustomButton from "@/components/CustomButton.vue";
import CustomPagination from "@/components/CustomPagination.vue";
import CustomDialog from "@/components/CustomDialog.vue";

const DEFAULT_MODEL_CONFIG = {
  ttsModelId: "TTS_EdgeTTS",
  vadModelId: "VAD_SileroVAD",
  asrModelId: "ASR_FunASR",
  llmModelId: "LLM_ChatGLMLLM",
  vllmModelId: "VLLM_ChatGLMVLLM",
  memModelId: "Memory_nomem",
  intentModelId: "Intent_function_call"
};

export default {
  name: "AgentTemplateManagement",
  components: {
    HeaderBar,
    VersionFooter,
    CustomButton,
    CustomPagination,
    CustomDialog
  },

  data() {
    return {
      templateList: [],
      templateLoading: false,
      selectedTemplates: [],
      isAllSelected: false,
      search: "",
      lastSearch: "",
      pageSizeOptions: [10, 20, 50, 100],
      currentPage: 1,
      pageSize: 10,
      total: 0,
      tableColumns: [],
      dialogVisible: false,
      dialogTitle: "",
      confirmLoading: false,
      form: {
        id: null,
        agentCode: "Xiaozhi",
        agentName: "",
        systemPrompt: "",
        sort: 0,
        model: { ...DEFAULT_MODEL_CONFIG }
      },
      formRules: {
        agentName: [
          { required: true, message: "Please enter assistant nickname", trigger: "blur" }
        ],
        systemPrompt: [
          { required: true, message: "Please enter role introduction", trigger: "blur" }
        ]
      },
      originalForm: null
    };
  },
  created() {
    this.initTableColumns();
    this.loadTemplateList();
  },
  computed: {
    hasSelected() {
      return this.selectedTemplates.length > 0;
    }
  },
  methods: {
    // Translation with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback, params = {}) {
      const value = this.$t(key, params);
      if (value && value !== key) {
        return value;
      }
      return String(fallback).replace(/\{(\w+)\}/g, (match, name) =>
        params[name] !== undefined ? params[name] : match
      );
    },
    initialOf(name) {
      const text = String(name || "").trim();
      return text ? Array.from(text)[0] : "·";
    },
    rowClassName({ row }) {
      return row && row.selected ? "is-selected" : "";
    },
    clearSearch() {
      this.search = "";
      this.handleSearch();
    },
    initTableColumns() {
      this.tableColumns = [
        {
          prop: "agentName",
          label: this.$t("agentTemplateManagement.templateName"),
        },
        {
          prop: "serialNumber",
          label: this.$t("agentTemplateManagement.serialNumber"),
        }
      ];
    },
    loadTemplateList() {
      this.templateLoading = true;
      const params = {
        page: this.currentPage,
        limit: this.pageSize
      };
      if (this.search) {
        params.agentName = this.search;
      }
      this.lastSearch = this.search;

      agentApi.getAgentTemplatesPage(
        params,
        (res) => {
          if (res && res.data && res.data.code === 0) {
            const responseData = res.data.data || {};
            this.templateList = Array.isArray(responseData.list)
              ? responseData.list.map((item) => ({ ...item, selected: false }))
              : [];
            this.total = typeof responseData.total === "number" ? responseData.total : 0;
          } else {
            this.templateList = [];
            this.total = 0;
            this.$message.error(res?.data?.msg || this.$t("agentTemplateManagement.fetchTemplateFailed"));
          }
          this.templateLoading = false;
        },
        (error) => {
          this.templateList = [];
          this.total = 0;
          this.templateLoading = false;
          this.$message.error(this.$t("common.networkError"));
        }
      );
    },
    handleSearch() {
      this.currentPage = 1;
      this.loadTemplateList();
    },
    showAddTemplateDialog() {
      this.dialogTitle = this.$t("templateQuickConfig.addTemplate");
      this.form = {
        id: null,
        agentCode: "Xiaozhi",
        agentName: this.$t("templateQuickConfig.newTemplate"),
        systemPrompt: "",
        sort: 1,
        model: { ...DEFAULT_MODEL_CONFIG }
      };
      this.originalForm = JSON.parse(JSON.stringify(this.form));
      this.dialogVisible = true;
    },
    editTemplate(row) {
      this.dialogTitle = this.$t("templateQuickConfig.editTemplate");
      this.fetchTemplateById(row.id);
    },
    fetchTemplateById(templateId) {
      agentApi.getAgentTemplateById(templateId, (res) => {
        if (res && res.data && res.data.code === 0 && res.data.data) {
          const template = res.data.data;
          this.form = {
            id: template.id,
            agentCode: template.agentCode || "Xiaozhi",
            agentName: template.agentName || "",
            systemPrompt: template.systemPrompt || "",
            sort: template.sort || 0,
            model: {
              ttsModelId: template.ttsModelId || DEFAULT_MODEL_CONFIG.ttsModelId,
              vadModelId: template.vadModelId || DEFAULT_MODEL_CONFIG.vadModelId,
              asrModelId: template.asrModelId || DEFAULT_MODEL_CONFIG.asrModelId,
              llmModelId: template.llmModelId || DEFAULT_MODEL_CONFIG.llmModelId,
              vllmModelId: template.vllmModelId || DEFAULT_MODEL_CONFIG.vllmModelId,
              memModelId: template.memModelId || DEFAULT_MODEL_CONFIG.memModelId,
              intentModelId: template.intentModelId || DEFAULT_MODEL_CONFIG.intentModelId
            }
          };
          this.originalForm = JSON.parse(JSON.stringify(this.form));
          this.dialogVisible = true;
        } else {
          this.$message.error(res?.data?.msg || this.$t("templateQuickConfig.templateNotFound"));
        }
      });
    },
    handleDialogConfirm() {
      this.$refs.dialogForm.validate((valid) => {
        if (!valid) return;

        const configData = {
          id: this.form.id || "",
          agentCode: this.form.agentCode,
          agentName: this.form.agentName,
          systemPrompt: this.form.systemPrompt,
          sort: this.form.sort,
          functions: [],
          ...this.form.model
        };

        this.confirmLoading = true;
        const apiCall = this.form.id
          ? agentApi.updateAgentTemplate
          : agentApi.addAgentTemplate;

      apiCall(configData, (res) => {
        this.confirmLoading = false;
        if (res && res.data && res.data.code === 0) {
          this.$message.success({
            message: this.$t("templateQuickConfig.saveSuccess"),
            showClose: true
          });
          this.dialogVisible = false;
          this.loadTemplateList();
        } else {
          this.$message.error({
            message: res?.data?.msg || this.$t("templateQuickConfig.saveFailed"),
            showClose: true
          });
        }
      }, (error) => {
        this.confirmLoading = false;
        this.$message.error(this.$t("common.networkError"));
      });
      });
    },
    deleteTemplate(row) {
      this.$confirm(
        this.$t("agentTemplateManagement.confirmSingleDelete"),
        this.$t("common.warning"),
        {
          confirmButtonText: this.$t("common.confirm"),
          cancelButtonText: this.$t("common.cancel"),
          type: "warning"
        }
      )
        .then(() => {
          agentApi.deleteAgentTemplate(row.id, (res) => {
            if (res && res.data && res.data.code === 0) {
              this.$message.success(this.$t("agentTemplateManagement.deleteSuccess"));
              this.selectedTemplates = [];
              this.isAllSelected = false;
              this.loadTemplateList();
            } else {
              this.$message.error(res?.data?.msg || this.$t("agentTemplateManagement.deleteFailed"));
            }
          });
        })
        .catch(() => {
          this.$message.info(this.$t("common.deleteCancelled"));
        });
    },
    batchDeleteTemplate() {
      if (this.selectedTemplates.length === 0) {
        this.$message.warning(this.$t("agentTemplateManagement.selectTemplate"));
        return;
      }
      this.$confirm(
        this.$t("agentTemplateManagement.confirmBatchDelete", { count: this.selectedTemplates.length }),
        this.$t("common.warning"),
        {
          confirmButtonText: this.$t("common.confirm"),
          cancelButtonText: this.$t("common.cancel"),
          type: "warning"
        }
      )
        .then(() => {
          const ids = this.selectedTemplates.map((template) => template.id);
          agentApi.batchDeleteAgentTemplate(ids, (res) => {
            if (res && res.data && res.data.code === 0) {
              this.$message.success(this.$t("agentTemplateManagement.batchDeleteSuccess"));
              this.loadTemplateList();
              this.selectedTemplates = [];
              this.isAllSelected = false;
            } else {
              this.$message.error(res?.data?.msg || this.$t("agentTemplateManagement.batchDeleteFailed"));
            }
          });
        })
        .catch(() => {
          this.$message.info(this.$t("common.deleteCancelled"));
        });
    },
    handlePageChange(page) {
      this.currentPage = page;
      this.loadTemplateList();
    },
    handlePageSizeChange(size) {
      this.pageSize = size;
      this.currentPage = 1;
      this.loadTemplateList();
    },
    handleSelectAll() {
      this.isAllSelected = !this.isAllSelected;
      this.templateList.forEach((row) => {
        row.selected = this.isAllSelected;
      });
      this.selectedTemplates = this.isAllSelected ? [...this.templateList] : [];
    },
    handleRowSelectionChange(row) {
      this.selectedTemplates = this.templateList.filter((template) => template.selected);
      this.isAllSelected =
        this.templateList.length > 0 &&
        this.selectedTemplates.length === this.templateList.length;
    }
  }
};
</script>

<style lang="scss" scoped>
.templates-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--nx-bg);
  > .nx-page {
    flex: 1 0 auto;
  }
}

.tm-search {
  width: 260px;
  max-width: 100%;
}

.tm-card {
  position: relative;
}

// Selection bar sits above the table while rows are selected
.tm-selection {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-height: 52px;
  padding: var(--nx-space-2) var(--nx-space-5);
  border-bottom: 1px solid var(--nx-border);
  background: var(--nx-accent-soft);
}
.tm-selection__count {
  color: var(--nx-accent);
  font-size: var(--nx-text-callout);
  font-weight: 600;
}

.tm-table {
  width: 100%;
  ::v-deep th.el-table__cell:first-child .cell,
  ::v-deep td.el-table__cell:first-child .cell {
    padding-left: var(--nx-space-5);
  }
  ::v-deep th.el-table__cell:last-child .cell,
  ::v-deep td.el-table__cell:last-child .cell {
    padding-right: var(--nx-space-4);
  }
  ::v-deep .is-selected > td.el-table__cell {
    background: var(--nx-accent-soft);
  }
}

.tm-name {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-width: 0;
  padding: 6px 0;
}
.tm-name__avatar {
  width: 32px;
  height: 32px;
  font-size: var(--nx-text-footnote);
}
.tm-name__text {
  flex: 1;
  min-width: 0;
}
.tm-name__title {
  display: block;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--nx-text);
  font: inherit;
  font-size: var(--nx-text-body);
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  &:hover {
    color: var(--nx-accent);
  }
}
.tm-name__prompt {
  max-width: 560px;
  margin-top: 2px;
  color: var(--nx-text-3);
  font-size: var(--nx-text-footnote);
}
.tm-serial {
  color: var(--nx-text-2);
}

.tm-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--nx-space-1);
}
.tm-delete {
  width: 32px;
  height: 32px;
  font-size: var(--nx-text-body);
}

.tm-empty {
  line-height: 1.4;
}

.tm-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--nx-space-3) var(--nx-space-5);
  border-top: 1px solid var(--nx-border);
}

// Edit dialog form (matches the agent settings form)
.tm-form {
  ::v-deep .el-form-item__label {
    padding-bottom: 6px;
    color: var(--nx-text-2);
    font-size: var(--nx-text-footnote);
    font-weight: 500;
    line-height: 1.4;
  }
  ::v-deep .el-textarea__inner {
    padding: var(--nx-space-3) 14px;
    line-height: 1.6;
  }
}
.tm-form__prompt {
  margin-bottom: 0;
}
.tm-count {
  margin-top: 6px;
  text-align: right;
  color: var(--nx-text-3);
  font-size: var(--nx-text-caption);
  line-height: 1.4;
  &.is-near {
    color: var(--nx-warning);
  }
}

@media (max-width: 640px) {
  .tm-search {
    width: 100%;
  }
  .nx-page-header__actions {
    width: 100%;
  }
  .tm-name__prompt {
    display: none;
  }
}
</style>
