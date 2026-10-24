<template>
  <div class="nx-app">
    <HeaderBar />

    <main class="nx-page">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t("header.modelConfig") }}</h1>
          <p class="nx-page-header__desc">
            {{ tx("modelConfig.pageDesc", "Choose the AI services your robots use to listen, think and speak.") }}
          </p>
        </div>
        <div class="nx-page-header__actions">
          <el-input
            v-model="search"
            class="mc-search"
            prefix-icon="el-icon-search"
            :placeholder="$t('modelConfig.searchPlaceholder')"
            :aria-label="$t('modelConfig.search')"
            clearable
            @keyup.enter.native="handleSearch"
            @clear="handleSearch"
          />
          <CustomButton type="add" icon="el-icon-plus" @click="addModel">
            {{ tx("modelConfig.addModel", "Add model") }}
          </CustomButton>
        </div>
      </header>

      <div class="mc-layout">
        <!-- Model type switcher: left list on wide screens, scrollable pills on narrow ones -->
        <nav class="mc-types" :aria-label="tx('modelConfig.types', 'Model types')">
          <button
            v-for="type in modelTypes"
            :key="type.key"
            type="button"
            class="mc-type"
            :class="{ 'is-active': activeTab === type.key }"
            :aria-current="activeTab === type.key ? 'page' : null"
            :title="$t('modelConfig.' + type.key)"
            @click="handleMenuSelect(type.key)"
          >
            <span class="mc-type__code">{{ type.code }}</span>
            <span class="mc-type__name nx-truncate">{{ $t("modelConfig." + type.key) }}</span>
          </button>
        </nav>

        <section class="nx-card nx-card--flush mc-card" :aria-label="$t('modelConfig.' + activeTab)">
          <div class="mc-card__head">
            <div class="nx-row mc-card__title">
              <h2 class="nx-headline nx-truncate">{{ $t("modelConfig." + activeTab) }}</h2>
              <span class="nx-badge nx-num">{{ tx("modelConfig.count", "{count} models", { count: total }) }}</span>
            </div>
            <transition name="nx-fade">
              <div v-if="selectedModels.length" class="nx-row mc-card__bulk">
                <span class="nx-footnote nx-num">
                  {{ tx("modelConfig.selected", "{count} selected", { count: selectedModels.length }) }}
                </span>
                <CustomButton size="small" @click="selectAll">
                  {{ isAllSelected ? $t("modelConfig.deselectAll") : $t("modelConfig.selectAll") }}
                </CustomButton>
                <CustomButton type="delete" size="small" icon="el-icon-delete" @click="batchDelete">
                  {{ $t("modelConfig.delete") }}
                </CustomButton>
              </div>
            </transition>
          </div>

          <div
            class="mc-card__body"
            v-loading="loading"
            :element-loading-text="$t('modelConfig.loading')"
          >
            <el-table
              v-show="modelList.length || loading"
              ref="modelTable"
              :data="modelList"
              row-key="id"
              class="mc-table"
              @selection-change="handleSelectionChange"
            >
              <el-table-column type="selection" width="52" align="center" />

              <el-table-column :label="$t('modelConfig.modelName')" min-width="260">
                <template slot-scope="scope">
                  <div class="mc-name">
                    <div class="nx-row mc-name__line">
                      <span class="mc-name__text nx-truncate" :title="scope.row.modelName">
                        {{ scope.row.modelName || "—" }}
                      </span>
                      <span v-if="scope.row.isDefault === 1" class="nx-badge nx-badge--accent mc-default">
                        <i class="el-icon-star-on" aria-hidden="true"></i>
                        {{ tx("modelConfig.defaultBadge", "Default") }}
                      </span>
                    </div>
                    <span class="nx-caption nx-mono nx-truncate mc-name__id" :title="scope.row.id">{{ scope.row.id }}</span>
                  </div>
                </template>
              </el-table-column>

              <el-table-column :label="$t('modelConfig.provider')" min-width="150">
                <template slot-scope="scope">
                  <span
                    class="nx-badge mc-provider nx-truncate"
                    :title="(scope.row.configJson && scope.row.configJson.type) || $t('modelConfig.unknown')"
                  >
                    {{ (scope.row.configJson && scope.row.configJson.type) || $t("modelConfig.unknown") }}
                  </span>
                </template>
              </el-table-column>

              <el-table-column :label="$t('modelConfig.isEnabled')" width="110">
                <template slot-scope="scope">
                  <el-tooltip
                    v-if="scope.row.isDefault === 1 && scope.row.isEnabled === 1"
                    :content="$t('modelConfig.defaultModelCannotDisable')"
                    placement="top"
                  >
                    <span class="mc-switch-wrap">
                      <el-switch
                        v-model="scope.row.isEnabled"
                        :active-value="1"
                        :inactive-value="0"
                        :aria-label="$t('modelConfig.isEnabled')"
                        disabled
                      />
                    </span>
                  </el-tooltip>
                  <el-switch
                    v-else
                    v-model="scope.row.isEnabled"
                    :active-value="1"
                    :inactive-value="0"
                    :aria-label="$t('modelConfig.isEnabled')"
                    @change="handleStatusChange(scope.row)"
                  />
                </template>
              </el-table-column>

              <el-table-column v-if="activeTab === 'tts'" :label="tx('modelConfig.voices', 'Voices')" width="130">
                <template slot-scope="scope">
                  <el-button size="small" icon="el-icon-microphone" @click="openTtsDialog(scope.row)">
                    {{ tx("modelConfig.voices", "Voices") }}
                  </el-button>
                </template>
              </el-table-column>

              <el-table-column :label="$t('modelConfig.action')" width="236" align="right" class-name="mc-actions-col">
                <template slot-scope="scope">
                  <div class="mc-actions">
                    <el-button
                      v-if="scope.row.isDefault !== 1"
                      type="text"
                      size="small"
                      class="mc-set-default"
                      @click="handleDefaultChange(scope.row)"
                    >
                      {{ tx("modelConfig.setDefault", "Set as default") }}
                    </el-button>
                    <el-tooltip :content="$t('modelConfig.edit')" placement="top" :open-delay="400">
                      <button type="button" class="nx-icon-btn" :aria-label="$t('modelConfig.edit')" @click="editModel(scope.row)">
                        <i class="el-icon-edit" aria-hidden="true"></i>
                      </button>
                    </el-tooltip>
                    <el-tooltip :content="$t('modelConfig.duplicate')" placement="top" :open-delay="400">
                      <button type="button" class="nx-icon-btn" :aria-label="$t('modelConfig.duplicate')" @click="duplicateModel(scope.row)">
                        <i class="el-icon-document-copy" aria-hidden="true"></i>
                      </button>
                    </el-tooltip>
                    <el-tooltip :content="$t('modelConfig.delete')" placement="top" :open-delay="400">
                      <button type="button" class="nx-icon-btn nx-icon-btn--danger" :aria-label="$t('modelConfig.delete')" @click="deleteModel(scope.row)">
                        <i class="el-icon-delete" aria-hidden="true"></i>
                      </button>
                    </el-tooltip>
                  </div>
                </template>
              </el-table-column>
            </el-table>

            <div v-if="!loading && !modelList.length" class="nx-empty">
              <span class="nx-icon-tile nx-icon-tile--lg"><i class="el-icon-cpu" aria-hidden="true"></i></span>
              <h3 class="nx-empty__title">
                {{ search ? tx("modelConfig.noResultsTitle", "No matching models") : tx("modelConfig.emptyTitle", "No models yet") }}
              </h3>
              <p class="nx-empty__text">
                {{ search
                  ? tx("modelConfig.noResultsText", "Try a different name or clear the search.")
                  : tx("modelConfig.emptyText", "Add a model to make it available to your robots.") }}
              </p>
              <CustomButton class="nx-empty__action" type="add" icon="el-icon-plus" @click="addModel">
                {{ tx("modelConfig.addModel", "Add model") }}
              </CustomButton>
            </div>
          </div>

          <div v-if="total > 0" class="mc-card__foot">
            <CustomPagination
              :total="total"
              :current-page="currentPage"
              :page-size="pageSize"
              :page-size-options="pageSizeOptions"
              @size-change="handlePageSizeChange"
              @page-change="handlePageChange"
            />
          </div>
        </section>
      </div>

      <VersionFooter />
    </main>

    <ModelEditDialog
      :modelType="activeTab"
      :visible.sync="editDialogVisible"
      :modelData="editModelData"
      @save="handleModelSave"
    />
    <TtsModel
      :visible.sync="ttsDialogVisible"
      :ttsModelId="selectedTtsModelId"
      :modelConfig="selectedModelConfig"
    />
    <AddModelDialog
      :modelType="activeTab"
      :visible.sync="addDialogVisible"
      @confirm="handleAddConfirm"
    />
  </div>
</template>

<script>
import Api from "@/apis/api";
import AddModelDialog from "@/components/AddModelDialog.vue";
import HeaderBar from "@/components/HeaderBar.vue";
import ModelEditDialog from "@/components/ModelEditDialog.vue";
import TtsModel from "@/components/TtsModel.vue";
import CustomPagination from "@/components/CustomPagination.vue";
import CustomButton from "@/components/CustomButton.vue";
import VersionFooter from "@/components/VersionFooter.vue";

// Order follows a conversation: hear, think, see, speak, then supporting services
const MODEL_TYPES = [
  { key: "asr", code: "ASR" },
  { key: "llm", code: "LLM" },
  { key: "vllm", code: "VLLM" },
  { key: "tts", code: "TTS" },
  { key: "intent", code: "Intent" },
  { key: "memory", code: "Memory" },
  { key: "vad", code: "VAD" },
  { key: "rag", code: "RAG" },
];

export default {
  components: { HeaderBar, ModelEditDialog, TtsModel, AddModelDialog, VersionFooter, CustomPagination, CustomButton },
  data() {
    return {
      modelTypes: MODEL_TYPES,
      addDialogVisible: false,
      activeTab: "llm",
      search: "",
      editDialogVisible: false,
      editModelData: {},
      ttsDialogVisible: false,
      selectedTtsModelId: "",
      modelList: [],
      pageSizeOptions: [10, 20, 50, 100],
      currentPage: 1,
      pageSize: 10,
      total: 0,
      selectedModels: [],
      isAllSelected: false,
      loading: false,
      selectedModelConfig: {},
    };
  },

  created() {
    this.loadData();
  },

  computed: {
    modelTypeText() {
      return (
        this.$t("modelConfig." + this.activeTab) || this.$t("modelConfig.modelConfig")
      );
    },
  },

  methods: {
    // $t with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback, params) {
      const value = this.$t(key, params);
      if (value !== key) return value;
      return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
    },
    handlePageSizeChange(val) {
      this.pageSize = val;
      this.currentPage = 1;
      this.loadData();
    },
    openTtsDialog(row) {
      this.selectedTtsModelId = row.id;
      this.selectedModelConfig = row;
      this.ttsDialogVisible = true;
    },
    handleMenuSelect(index) {
      if (index === this.activeTab) return;
      this.activeTab = index;
      this.currentPage = 1; // Reset to first page
      this.pageSize = 10; // Optional: reset page size
      this.selectedModels = [];
      this.isAllSelected = false;
      this.loadData();
    },
    handleSearch() {
      this.currentPage = 1;
      this.loadData();
    },
    // Batch delete
    batchDelete() {
      if (this.selectedModels.length === 0) {
        this.$message.warning(this.$t("modelConfig.selectModelsFirst"));
        return;
      }

      this.$confirm(this.$t("modelConfig.confirmBatchDelete"), this.$t("message.info"), {
        confirmButtonText: this.$t("modelConfig.delete"),
        cancelButtonText: this.$t("common.cancel"),
        confirmButtonClass: "el-button--danger",
        type: "warning",
      })
        .then(() => {
          const deletePromises = this.selectedModels.map(
            (model) =>
              new Promise((resolve) => {
                Api.model.deleteModel(model.id, ({ data }) => resolve(data.code === 0));
              })
          );

          Promise.all(deletePromises).then((results) => {
            if (results.every(Boolean)) {
              this.$message.success({
                message: this.$t("modelConfig.batchDeleteSuccess"),
                showClose: true,
              });
              this.loadData();
            } else {
              this.$message.error({
                message: this.$t("modelConfig.partialDeleteFailed"),
                showClose: true,
              });
            }
          });
        })
        .catch(() => {
          this.$message.info(this.$t("modelConfig.deleteCancelled"));
        });
    },
    addModel() {
      this.addDialogVisible = true;
    },
    editModel(model) {
      this.editModelData = JSON.parse(JSON.stringify(model));
      this.editDialogVisible = true;
    },
    duplicateModel(model) {
      this.editModelData = JSON.parse(JSON.stringify(model));
      this.editModelData.duplicateMode = true;
      this.editDialogVisible = true;
    },
    // Delete single model (the model's name is the confirm title)
    deleteModel(model) {
      this.$confirm(this.$t("modelConfig.confirmDelete"), model.modelName || this.$t("message.info"), {
        confirmButtonText: this.$t("modelConfig.delete"),
        cancelButtonText: this.$t("common.cancel"),
        confirmButtonClass: "el-button--danger",
        type: "warning",
      })
        .then(() => {
          Api.model.deleteModel(model.id, ({ data }) => {
            if (data.code === 0) {
              this.$message.success({
                message: this.$t("modelConfig.deleteSuccess"),
                showClose: true,
              });
              this.loadData();
            } else {
              this.$message.error({
                message: data.msg || this.$t("modelConfig.deleteFailed"),
                showClose: true,
              });
            }
          });
        })
        .catch(() => {
          this.$message.info(this.$t("modelConfig.deleteCancelled"));
        });
    },
    handlePageChange(page) {
      this.currentPage = page;
      this.loadData();
    },
    handleModelSave({ provideCode, formData, done }) {
      const modelType = this.activeTab;
      const id = formData.id;

      if (this.editModelData.duplicateMode) {
        formData.id = "";
        Api.model.addModel({ modelType, provideCode, formData }, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t("modelConfig.duplicateSuccess"));
            this.loadData();
            this.editDialogVisible = false;
          } else {
            this.$message.error(data.msg || this.$t("modelConfig.duplicateFailed"));
          }
          done && done(); // Call done callback to close loading state
        });
      } else {
        Api.model.updateModel({ modelType, provideCode, id, formData }, ({ data }) => {
          if (data.code === 0) {
            this.$message.success(this.$t("modelConfig.saveSuccess"));
            this.loadData();
            this.editDialogVisible = false;
          } else {
            this.$message.error(data.msg || this.$t("modelConfig.saveFailed"));
          }
          done && done(); // Call done callback to close loading state
        });
      }
    },
    selectAll() {
      if (this.isAllSelected) {
        this.$refs.modelTable.clearSelection();
      } else {
        this.$refs.modelTable.toggleAllSelection();
      }
    },
    handleSelectionChange(val) {
      this.selectedModels = val;
      this.isAllSelected = val.length > 0 && val.length === this.modelList.length;
    },

    // Add model configuration
    handleAddConfirm(newModel) {
      const params = {
        modelType: this.activeTab,
        provideCode: newModel.provideCode,
        formData: {
          ...newModel,
          isDefault: newModel.isDefault ? 1 : 0,
          isEnabled: newModel.isEnabled ? 1 : 0,
          configJson: newModel.configJson,
        },
      };

      Api.model.addModel(params, ({ data }) => {
        if (data.code === 0) {
          this.$message.success({
            message: this.$t("modelConfig.addSuccess"),
            showClose: true,
          });
          this.loadData();
        } else {
          this.$message.error({
            message: data.msg || this.$t("modelConfig.addFailed"),
            showClose: true,
          });
        }
      });
    },

    // Get model configuration list
    loadData() {
      this.loading = true; // Start loading
      const params = {
        modelType: this.activeTab,
        modelName: this.search,
        page: this.currentPage,
        limit: this.pageSize,
      };

      Api.model.getModelList(params, ({ data }) => {
        this.loading = false; // End loading
        if (data.code === 0) {
          this.modelList = data.data.list;
          this.total = data.data.total;
        } else {
          this.$message.error(data.msg || this.$t("modelConfig.fetchModelsFailed"));
        }
      });
    },
    // Handle enable/disable status change (optimistic, rolls back on failure)
    handleStatusChange(model) {
      const newStatus = model.isEnabled ? 1 : 0;
      const originalStatus = newStatus ? 0 : 1;

      Api.model.updateModelStatus(model.id, newStatus, ({ data }) => {
        if (data.code === 0) {
          this.$message.success(
            newStatus === 1
              ? this.$t("modelConfig.enableSuccess")
              : this.$t("modelConfig.disableSuccess")
          );
          // Keep new state
          model.isEnabled = newStatus;
          // Refresh table data
          this.loadData();
        } else {
          // Restore original state on operation failure
          model.isEnabled = originalStatus;
          this.$message.error(data.msg || this.$t("modelConfig.operationFailed"));
        }
      });
    },
    handleDefaultChange(model) {
      Api.model.setDefaultModel(model.id, ({ data }) => {
        if (data.code === 0) {
          this.$message.success(this.$t("modelConfig.setDefaultSuccess"));
          this.loadData();
        } else if (data.msg) {
          this.$message.error(data.msg);
        }
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.nx-app {
  min-height: 100vh;
  background: var(--nx-bg);
}

.mc-search {
  width: 260px;
}

.mc-layout {
  display: grid;
  grid-template-columns: 272px minmax(0, 1fr);
  gap: var(--nx-space-5);
  align-items: start;
}

// ---------------------------------------------------------------- type switcher
.mc-types {
  position: sticky;
  top: calc(var(--nx-topbar-h) + var(--nx-space-4));
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--nx-space-2);
  background: var(--nx-surface);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius-lg);
  box-shadow: var(--nx-shadow-1);
}

.mc-type {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-height: var(--nx-control-h-lg);
  padding: 0 var(--nx-space-3);
  border: 0;
  border-radius: var(--nx-radius);
  background: transparent;
  color: var(--nx-text-2);
  font: inherit;
  font-size: var(--nx-text-callout);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--nx-dur-1) var(--nx-ease), color var(--nx-dur-1) var(--nx-ease),
    transform var(--nx-dur-1) var(--nx-ease);

  &:hover {
    background: var(--nx-surface-2);
    color: var(--nx-text);
  }
  &:active {
    transform: scale(0.97);
  }
  &.is-active {
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-weight: 600;

    .mc-type__code {
      background: var(--nx-accent);
      color: var(--nx-on-accent);
    }
  }

  &__code {
    flex: none;
    min-width: 52px;
    padding: 3px 6px;
    border-radius: var(--nx-radius-sm);
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    font-weight: 600;
    text-align: center;
    letter-spacing: 0.01em;
  }
  &__name {
    flex: 1 1 auto;
  }
}

// ---------------------------------------------------------------- table card
.mc-card {
  display: flex;
  flex-direction: column;
  min-width: 0;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--nx-space-3);
    min-height: 64px;
    padding: var(--nx-space-3) var(--nx-space-5);
    border-bottom: 1px solid var(--nx-border);
  }
  &__title {
    min-width: 0;
  }
  &__bulk {
    flex-wrap: wrap;
    gap: var(--nx-space-2);
  }
  &__body {
    min-height: 240px;
  }
  &__foot {
    display: flex;
    justify-content: flex-end;
    padding: var(--nx-space-3) var(--nx-space-5);
    border-top: 1px solid var(--nx-border);
  }
}

.mc-table {
  width: 100%;

  ::v-deep th.el-table__cell:first-child .cell,
  ::v-deep td.el-table__cell:first-child .cell {
    padding-left: var(--nx-space-5);
  }
  ::v-deep th.el-table__cell:last-child .cell,
  ::v-deep td.el-table__cell:last-child .cell {
    padding-right: var(--nx-space-4);
  }
  &::before {
    display: none;
  }
}

.mc-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: var(--nx-space-1) 0;

  &__line {
    gap: var(--nx-space-2);
  }
  &__text {
    font-weight: 600;
    color: var(--nx-text);
  }
  &__id {
    display: block;
  }
}

.mc-default {
  flex: none;
  gap: 3px;
}

.mc-provider {
  max-width: 100%;
  display: inline-block;
  line-height: 22px;
  font-family: var(--nx-font-mono);
  font-weight: 500;
}

.mc-switch-wrap {
  display: inline-flex;
}

.mc-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  width: 100%;
}

.mc-set-default {
  margin-right: var(--nx-space-1);
  white-space: nowrap;
}

// ---------------------------------------------------------------- narrow screens
@media (max-width: 1100px) {
  .mc-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .mc-types {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    padding: 4px;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
  .mc-type {
    flex: none;
    min-height: var(--nx-control-h);
    gap: var(--nx-space-2);
    padding: 0 var(--nx-space-3);
    &__name {
      display: none;
    }
    &__code {
      min-width: 0;
      padding: 0;
      background: transparent;
      color: inherit;
      font-size: var(--nx-text-callout);
    }
    &.is-active .mc-type__code {
      background: transparent;
      color: inherit;
    }
  }
}

@media (max-width: 640px) {
  .mc-search {
    width: 100%;
  }
  .nx-page-header__actions {
    width: 100%;
    > .mc-search {
      flex: 1 1 200px;
    }
  }
  .mc-card__head {
    padding: var(--nx-space-3) var(--nx-space-4);
  }
}
</style>
