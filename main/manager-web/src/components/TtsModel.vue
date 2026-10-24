<template>
  <CustomDialog :visible.sync="localVisible" :title="$t('modelConfig.voiceManagement')" width="1080px" size="large"
    :close-on-click-modal="true" :destroy-on-close="false" :footer="false" :append-to-body="true"
    @close="handleClose">
    <template slot="title">
      <div class="dialog-title tv-title">
        <span>{{ tx('modelConfig.voices', 'Voices') }}</span>
        <span v-if="modelConfig && modelConfig.modelName" class="tv-title__model nx-truncate"
          :title="modelConfig.modelName">{{ modelConfig.modelName }}</span>
      </div>
    </template>

    <div class="tv">
      <!-- Toolbar: search left, actions right -->
      <div class="tv-toolbar">
        <el-input v-model="searchQuery" class="tv-search" prefix-icon="el-icon-search" clearable
          :placeholder="tx('modelConfig.searchVoices', 'Search voices')" :aria-label="tx('modelConfig.searchVoices', 'Search voices')" />
        <span class="nx-spacer"></span>
        <template v-if="selectedCount">
          <span class="nx-footnote nx-num">{{ tx('modelConfig.selected', '{count} selected', { count: selectedCount }) }}</span>
          <CustomButton size="small" type="delete" icon="el-icon-delete"
            @click="deleteRow(filteredTtsModels.filter(row => row.selected))">
            {{ $t('ttsModel.delete') }}
          </CustomButton>
        </template>
        <CustomButton size="small" :disabled="!filteredTtsModels.length" @click="toggleSelectAll">
          {{ selectAll ? $t('ttsModel.deselectAll') : $t('ttsModel.selectAll') }}
        </CustomButton>
        <CustomButton icon="el-icon-plus" size="small" type="add" @click="addNew">
          {{ tx('modelConfig.addVoice', 'Add voice') }}
        </CustomButton>
      </div>

      <div ref="tableContainer" class="tv-table" v-loading="loading" :element-loading-text="$t('modelConfig.loading')"
        @scroll="handleScroll">
        <el-table v-show="filteredTtsModels.length || loading" :data="filteredTtsModels" class="tv-el-table"
          :row-class-name="rowClassName">
          <el-table-column width="48" align="center">
            <template slot="header">
              <span class="tv-sr">{{ $t('ttsModel.select') }}</span>
            </template>
            <template slot-scope="scope">
              <el-checkbox v-model="scope.row.selected" :aria-label="$t('ttsModel.select')"></el-checkbox>
            </template>
          </el-table-column>

          <el-table-column :label="$t('ttsModel.voiceName')" min-width="170">
            <template slot-scope="scope">
              <el-input v-if="scope.row.editing" v-model="scope.row.voiceName" size="small"
                :placeholder="$t('ttsModel.voiceName')"></el-input>
              <span v-else class="tv-name nx-truncate" :title="scope.row.voiceName">{{ scope.row.voiceName }}</span>
            </template>
          </el-table-column>

          <el-table-column :label="$t('ttsModel.voiceCode')" min-width="160">
            <template slot-scope="scope">
              <el-input v-if="scope.row.editing" v-model="scope.row.voiceCode" size="small" class="tv-mono"
                :placeholder="$t('ttsModel.voiceCode')"></el-input>
              <span v-else class="nx-mono nx-break tv-code">{{ scope.row.voiceCode }}</span>
            </template>
          </el-table-column>

          <el-table-column :label="$t('ttsModel.languageType')" min-width="120">
            <template slot-scope="scope">
              <el-input v-if="scope.row.editing" v-model="scope.row.languageType" size="small"
                :placeholder="$t('ttsModel.languageType')"></el-input>
              <span v-else-if="scope.row.languageType" class="nx-badge tv-lang nx-truncate"
                :title="scope.row.languageType">{{ scope.row.languageType }}</span>
            </template>
          </el-table-column>

          <el-table-column v-if="!showReferenceColumns" :label="$t('ttsModel.preview')" min-width="250">
            <template slot-scope="scope">
              <el-input v-if="scope.row.editing" v-model="scope.row.voiceDemo" size="small" class="tv-mono"
                :placeholder="$t('ttsModel.enterMp3Url')"></el-input>
              <AudioPlayer v-else-if="isValidAudioUrl(scope.row.voiceDemo)" :audioUrl="scope.row.voiceDemo" />
              <span v-else class="nx-faint">—</span>
            </template>
          </el-table-column>

          <el-table-column v-if="!showReferenceColumns" :label="$t('ttsModel.remark')" min-width="160">
            <template slot-scope="scope">
              <el-input v-if="scope.row.editing" v-model="scope.row.remark" type="textarea" size="small"
                :autosize="{ minRows: 1, maxRows: 4 }" :placeholder="$t('ttsModel.enterRemark')"></el-input>
              <span v-else class="nx-footnote tv-remark" :title="scope.row.remark">{{ scope.row.remark }}</span>
            </template>
          </el-table-column>

          <el-table-column v-if="showReferenceColumns" :label="$t('ttsModel.referenceAudioPath')" min-width="200">
            <template slot-scope="scope">
              <el-input v-if="scope.row.editing" v-model="scope.row.referenceAudio" size="small" class="tv-mono"
                :placeholder="$t('ttsModel.enterReferenceAudio')"></el-input>
              <span v-else class="nx-mono nx-break tv-code">{{ scope.row.referenceAudio }}</span>
            </template>
          </el-table-column>

          <el-table-column v-if="showReferenceColumns" :label="$t('ttsModel.referenceText')" min-width="200">
            <template slot-scope="scope">
              <el-input v-if="scope.row.editing" v-model="scope.row.referenceText" size="small"
                :placeholder="$t('ttsModel.enterReferenceText')"></el-input>
              <span v-else class="nx-footnote tv-remark" :title="scope.row.referenceText">{{ scope.row.referenceText }}</span>
            </template>
          </el-table-column>

          <el-table-column :label="$t('ttsModel.operation')" width="168" align="right">
            <template slot-scope="scope">
              <div class="tv-actions">
                <template v-if="!scope.row.editing">
                  <el-tooltip :content="$t('ttsModel.edit')" placement="top" :open-delay="400">
                    <button type="button" class="nx-icon-btn" :aria-label="$t('ttsModel.edit')"
                      @click="startEdit(scope.row)">
                      <i class="el-icon-edit" aria-hidden="true"></i>
                    </button>
                  </el-tooltip>
                  <el-tooltip :content="$t('ttsModel.delete')" placement="top" :open-delay="400">
                    <button type="button" class="nx-icon-btn nx-icon-btn--danger" :aria-label="$t('ttsModel.delete')"
                      @click="deleteRow(scope.row)">
                      <i class="el-icon-delete" aria-hidden="true"></i>
                    </button>
                  </el-tooltip>
                </template>
                <template v-else>
                  <el-button size="mini" @click="cancelEdit(scope.row)">{{ $t('button.cancel') }}</el-button>
                  <el-button size="mini" type="primary" @click="saveEdit(scope.row)">{{ $t('ttsModel.save') }}</el-button>
                </template>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="!loading && !filteredTtsModels.length" class="nx-empty tv-empty">
          <span class="nx-icon-tile nx-icon-tile--lg"><i class="el-icon-microphone" aria-hidden="true"></i></span>
          <h3 class="nx-empty__title">{{ tx('modelConfig.voicesEmptyTitle', 'No voices yet') }}</h3>
          <p class="nx-empty__text">
            {{ tx('modelConfig.voicesEmptyText', 'Add a voice so robots using this model can speak with it.') }}
          </p>
          <CustomButton class="nx-empty__action" type="add" icon="el-icon-plus" @click="addNew">
            {{ tx('modelConfig.addVoice', 'Add voice') }}
          </CustomButton>
        </div>
      </div>
    </div>
  </CustomDialog>
</template>

<script>
import Api from "@/apis/api";
import AudioPlayer from './AudioPlayer.vue';
import CustomDialog from './CustomDialog.vue';
import CustomButton from './CustomButton.vue';

export default {
  components: { AudioPlayer, CustomDialog, CustomButton },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    ttsModelId: {
      type: String,
      required: true
    },
    modelConfig: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      localVisible: this.visible,
      searchQuery: '',
      editDialogVisible: false,
      editVoiceData: {},
      ttsModels: [],
      currentPage: 1,
      pageSize: 10000,
      total: 0,
      selectAll: false,
      selectedRows: [],
      loading: false,
      showReferenceColumns: false, // Control whether to show reference columns
    };
  },
  watch: {
    visible(newVal) {
      this.localVisible = newVal;
      if (newVal) {
        this.currentPage = 1;
        this.updateShowReferenceColumns(); // Update display state
        this.loadData(); // Load data when dialog opens
      }
    },
    modelConfig: {
      handler(newVal) {
        this.updateShowReferenceColumns();
      },
      immediate: true
    }
  },
  computed: {
    filteredTtsModels() {
      const query = (this.searchQuery || '').toLowerCase();
      return this.ttsModels.filter(model =>
        model.editing ||
        (model.voiceName || '').toLowerCase().includes(query) ||
        (model.voiceCode || '').toLowerCase().includes(query)
      );
    },
    selectedCount() {
      return this.filteredTtsModels.filter(row => row.selected).length;
    }
  },
  methods: {
    // $t with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback, params) {
      const value = this.$t(key, params);
      if (value !== key) return value;
      return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
    },
    rowClassName({ row }) {
      return row.editing ? 'is-editing' : '';
    },

    // Update whether to show reference columns
    updateShowReferenceColumns() {
      if (this.modelConfig && this.modelConfig.configJson) {
        const providerType = this.modelConfig.configJson.type;
        this.showReferenceColumns = ['fishspeech', 'gpt_sovits_v2', 'gpt_sovits_v3'].includes(providerType);
      } else {
        this.showReferenceColumns = false;
      }
    },

    loadData() {
      this.loading = true;
      const params = {
        ttsModelId: this.ttsModelId,
        page: this.currentPage,
        limit: this.pageSize,
        name: this.searchQuery
      };
      Api.timbre.getVoiceList(params, (data) => {
        if (data.code === 0) {
          this.ttsModels = data.data.list
            .map(item => ({
              id: item.id || '',
              voiceCode: item.ttsVoice || '',
              voiceName: item.name || this.$t('ttsModel.unnamedVoice'),
              languageType: item.languages || '',
              remark: item.remark || '',
              referenceAudio: item.referenceAudio || '',
              referenceText: item.referenceText || '',
              voiceDemo: item.voiceDemo || '',
              selected: false,
              editing: false,
              sort: Number(item.sort)
            }))
            .sort((a, b) => a.sort - b.sort);
          this.total = data.total;
        } else {
          this.$message.error({
            message: data.msg || this.$t('ttsModel.getVoiceListFailed'),
            showClose: true
          });
        }
        this.loading = false;
      }, (err) => {
        console.error('Failed to load:', err);
        this.$message.error({
          message: this.$t('ttsModel.loadVoiceDataFailed'),
          showClose: true
        });
        this.loading = false;
      });
    },

    handleClose() {
      // Reset status
      this.ttsModels = [];
      this.currentPage = 1;
      this.total = 0;
      this.selectAll = false;
      this.searchQuery = '';
      this.showReferenceColumns = false;

      this.localVisible = false;
      this.$emit('update:visible', false);
    },

    handleScroll() {
      const container = this.$refs.tableContainer;
      if (!container) return;
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
        if (this.currentPage * this.pageSize < this.total) {
          this.currentPage++;
          this.loadData();
        }
      }
    },

    startEdit(row) {
      row.editing = true;
      this.$set(row, 'originalData', { ...row });
    },

    cancelEdit(row) {
      // Remove newly added items from array when cancelling edit
      if (!row.id) {
        this.ttsModels.shift(row);
      } else {
        Object.assign(row, row.originalData);
        delete row.originalData;
      }
      row.editing = false;
    },

    saveEdit(row) {
      if (!row.voiceCode || !row.voiceName || !row.languageType) {
        this.$message.error({
          message: this.$t('ttsModel.voiceCodeNameLanguageRequired'),
          showClose: true
        });
        return;
      }

      try {
        const params = {
          id: row.id,
          voiceCode: row.voiceCode,
          voiceName: row.voiceName,
          languageType: row.languageType,
          remark: row.remark,
          ttsModelId: this.ttsModelId,
          voiceDemo: row.voiceDemo || '',
          sort: row.sort
        };

        // Only add reference fields when showing reference columns
        if (this.showReferenceColumns) {
          params.referenceAudio = row.referenceAudio;
          params.referenceText = row.referenceText;
        }

        let res;
        if (row.id) {
          // Has ID, perform update operation
          Api.timbre.updateVoice(params, (response) => {
            res = response;
            this.handleResponse(res, row);
          });
        } else {
          // No ID, perform create operation
          Api.timbre.saveVoice(params, (response) => {
            res = response;
            this.handleResponse(res, row);
          });
        }
      } catch (error) {
        console.error('Operation failed:', error);
        // Restore original data on exception
        if (row.originalData) {
          Object.assign(row, row.originalData);
          row.editing = false;
          delete row.originalData;
        }
        this.$message.error({
          message: this.$t('ttsModel.operationFailed'),
          showClose: true
        });
      }
    },

    handleResponse(res, row) {
      if (res.code === 0) {
        this.$message.success({
          message: row.id ? this.$t('ttsModel.updateSuccess') : this.$t('ttsModel.saveSuccess'),
          showClose: true
        });
        row.editing = false;
        delete row.originalData;
        this.loadData(); // Refresh data
      } else {
        // Restore original data when saving fails
        if (row.originalData) {
          Object.assign(row, row.originalData);
          row.editing = false;
          delete row.originalData;
        }
        this.$message.error({
            message: res.msg || (row.id ? this.$t('ttsModel.updateFailed') : this.$t('ttsModel.saveFailed')),
            showClose: true
          });
      }
    },

    toggleSelectAll() {
      this.selectAll = !this.selectAll;
      this.filteredTtsModels.forEach(row => {
        row.selected = this.selectAll;
      });
    },

    addNew() {
      const hasEditing = this.ttsModels.some(row => row.editing);
      if (hasEditing) {
        this.$message.warning(this.$t('ttsModel.finishEditingFirst'));
        return;
      }

      const maxSort = this.ttsModels.length > 0
        ? Math.max(...this.ttsModels.map(item => Number(item.sort) || 0))
        : 0;

      const newRow = {
        voiceCode: '',
        voiceName: '',
        languageType: this.$t('editVoiceDialog.defaultLanguageType'),
        voiceDemo: '',
        remark: '',
        referenceAudio: '',
        referenceText: '',
        selected: false,
        editing: true,
        sort: 0 // Newly added data sorted at the top by default
      };

      this.ttsModels.unshift(newRow);
    },

    deleteRow(row) {
      // Handle single voice or voice array
      const voices = Array.isArray(row) ? row : [row];

      if (Array.isArray(row) && row.length === 0) {
        this.$message.warning(this.$t('ttsModel.selectVoiceToDelete'));
        return;
      }


      const voiceCount = voices.length;
      const confirmTitle = voiceCount === 1 && voices[0].voiceName ? voices[0].voiceName : this.$t('ttsModel.warning');
      this.$confirm(this.$t('ttsModel.confirmDeleteVoice', {count: voiceCount}), confirmTitle, {
        confirmButtonText: this.$t('ttsModel.delete'),
        confirmButtonClass: 'el-button--danger',
        cancelButtonText: this.$t('common.cancel'),
        type: "warning",
        distinguishCancelAndClose: true
      }).then(() => {
        const ids = voices.map(voice => voice.id);
        if (ids.some(id => !id)) {
          this.$message.error(this.$t('ttsModel.invalidVoiceId'));
          return;
        }

        Api.timbre.deleteVoice(ids, ({ data }) => {
          if (data.code === 0) {
            this.$message.success({
              message: this.$t('ttsModel.deleteVoiceSuccess', {count: voiceCount}),
              showClose: true
            });
            this.loadData(); // Refresh parameter list
          } else {
            this.$message.error({
              message: data.msg || this.$t('ttsModel.deleteFailed'),
              showClose: true
            });
          }
        });
      }).catch(action => {
        if (action === 'cancel') {
          this.$message({
            type: 'info',
            message: this.$t('ttsModel.deleteCancelled'),
            duration: 1000
          });
        } else {
          this.$message({
            type: 'info',
            message: this.$t('ttsModel.operationClosed'),
            duration: 1000
          });
        }
      });
    },

    isValidAudioUrl(url) {
      return url && (url.endsWith('.mp3') || url.endsWith('.ogg') || url.endsWith('.wav'));
    }
  }
};
</script>

<style lang="scss" scoped>
.tv-title {
  display: flex;
  align-items: baseline;
  gap: var(--nx-space-2);
  min-width: 0;

  &__model {
    font-size: var(--nx-text-callout);
    font-weight: 400;
    color: var(--nx-text-2);
  }
}

.tv {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
}

.tv-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--nx-space-2);

  .el-button + .el-button {
    margin-left: 0;
  }
}

.tv-search {
  width: 260px;
}

.tv-table {
  max-height: 58vh;
  min-height: 220px;
  overflow: auto;
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius-lg);
  background: var(--nx-surface);
}

.tv-el-table {
  width: 100%;

  &::before {
    display: none;
  }
  ::v-deep td.el-table__cell {
    vertical-align: middle;
  }
  ::v-deep th.el-table__cell:last-child .cell,
  ::v-deep td.el-table__cell:last-child .cell {
    padding-right: var(--nx-space-4);
  }
  ::v-deep tr.is-editing > td.el-table__cell {
    background: var(--nx-accent-soft);
  }
}

.tv-name {
  display: block;
  font-weight: 600;
  color: var(--nx-text);
}

.tv-code {
  color: var(--nx-text-2);
}

.tv-lang {
  display: inline-block;
  max-width: 100%;
  line-height: 22px;
}

.tv-remark {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.tv-mono ::v-deep .el-input__inner {
  font-family: var(--nx-font-mono);
  font-size: var(--nx-text-footnote);
}

.tv-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  width: 100%;

  .el-button + .el-button {
    margin-left: 0;
  }
}

.tv-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.tv-empty {
  padding: var(--nx-space-8) var(--nx-space-5);
}

@media (max-width: 640px) {
  .tv-search {
    width: 100%;
  }
}
</style>
