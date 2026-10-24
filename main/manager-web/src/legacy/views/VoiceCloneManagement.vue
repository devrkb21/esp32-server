<template>
  <div class="nx-app">
    <HeaderBar />

    <main class="nx-page">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t('voiceClone.title') }}</h1>
          <p class="nx-page-header__desc">
            {{ tx('voiceClone.pageDesc', 'Upload a short voice sample, then clone it for your robots to speak with.') }}
          </p>
        </div>
        <div class="nx-page-header__actions">
          <el-input
            v-model="searchName"
            class="vc-search"
            prefix-icon="el-icon-search"
            :placeholder="$t('voiceClone.searchPlaceholder')"
            :aria-label="$t('voiceClone.search')"
            clearable
            @keyup.enter.native="handleSearch"
            @clear="handleSearch"
          />
        </div>
      </header>

      <!-- Loading skeleton -->
      <div v-if="loading && !voiceCloneList.length" class="nx-grid" aria-busy="true">
        <div v-for="n in 3" :key="'sk' + n" class="nx-card vc-card">
          <div class="nx-row">
            <span class="nx-skeleton vc-sk-tile"></span>
            <span class="nx-skeleton vc-sk-title"></span>
          </div>
          <span class="nx-skeleton vc-sk-line"></span>
          <span class="nx-skeleton vc-sk-line vc-sk-line--short"></span>
        </div>
      </div>

      <div v-else-if="voiceCloneList.length" class="nx-grid" v-loading="loading">
        <article v-for="item in voiceCloneList" :key="item.id" class="nx-card vc-card"
          :class="{ 'is-playing': playingRowId === item.id }">
          <div class="vc-card__top">
            <button
              type="button"
              class="vc-play"
              :disabled="!item.hasVoice"
              :aria-label="playingRowId === item.id ? $t('voiceClone.stop') : $t('voiceClone.play')"
              @click="handlePlay(item)"
            >
              <i :class="playingRowId === item.id ? 'el-icon-video-pause' : (item.hasVoice ? 'el-icon-caret-right' : 'el-icon-microphone')"
                aria-hidden="true"></i>
            </button>

            <div class="vc-card__title">
              <el-input v-show="item.isEdit" ref="nameInput" v-model="item.name" size="small" maxlength="64"
                show-word-limit :aria-label="$t('voiceClone.name')" @keyup.enter.native="onNameEnter(item)" />
              <h2 v-show="!item.isEdit" class="nx-headline nx-truncate" :title="item.name">{{ item.name || '—' }}</h2>
              <el-tooltip :content="getTooltipContent(item)" placement="top" :disabled="!getTooltipContent(item)">
                <span class="nx-badge vc-status" :class="statusBadgeClass(item)" tabindex="0">
                  <i :class="statusIcon(item)" aria-hidden="true"></i>
                  {{ getTrainStatusText(item) }}
                </span>
              </el-tooltip>
            </div>

            <el-tooltip :content="item.isEdit ? $t('button.save') : tx('voiceClone.rename', 'Rename')" placement="top"
              :open-delay="300">
              <button type="button" class="nx-icon-btn vc-rename"
                :aria-label="item.isEdit ? $t('button.save') : tx('voiceClone.rename', 'Rename')"
                @click="handleEditButtonClick(item)">
                <i :class="item.isEdit ? 'el-icon-check' : 'el-icon-edit'" aria-hidden="true"></i>
              </button>
            </el-tooltip>
          </div>

          <!-- Playback indicator: still bars, they move only while the sample plays -->
          <div v-if="item.hasVoice" class="vc-wave" aria-hidden="true">
            <span v-for="n in 24" :key="n" class="vc-wave__bar" :style="{ '--h': waveHeight(item.id, n) }"></span>
          </div>

          <dl class="vc-meta">
            <div class="vc-meta__row">
              <dt>{{ $t('voiceClone.voiceId') }}</dt>
              <dd class="nx-mono nx-break">{{ item.voiceId || '—' }}</dd>
            </div>
            <div class="vc-meta__row">
              <dt>{{ $t('voiceClone.languages') }}</dt>
              <dd class="nx-truncate" :title="item.languages">{{ item.languages || '—' }}</dd>
            </div>
          </dl>

          <div class="vc-card__actions">
            <CustomButton size="small" icon="el-icon-upload2" @click="handleUpload(item)">
              {{ $t('voiceClone.upload') }}
            </CustomButton>
            <CustomButton v-if="item.hasVoice" type="confirm" size="small" icon="el-icon-copy-document"
              :loading="item._cloning" @click="handleClone(item)">
              {{ $t('voiceClone.clone') }}
            </CustomButton>
          </div>
        </article>
      </div>

      <div v-else class="nx-card">
        <div class="nx-empty">
          <span class="nx-icon-tile nx-icon-tile--lg"><i class="el-icon-microphone" aria-hidden="true"></i></span>
          <h3 class="nx-empty__title">{{ $t('voiceClone.noVoiceCloneAssigned') }}</h3>
          <p class="nx-empty__text">{{ $t('voiceClone.contactAdmin') }}</p>
        </div>
      </div>

      <div v-if="total > 0" class="vc-pagination">
        <CustomPagination
          :total="total"
          :current-page="currentPage"
          :page-size="pageSize"
          :page-size-options="pageSizeOptions"
          @size-change="handlePageSizeChange"
          @page-change="goToPage"
        />
      </div>

      <VersionFooter />
    </main>

    <VoiceCloneDialog :visible.sync="cloneDialogVisible" :voiceCloneData="currentVoiceClone"
      @success="handleCloneSuccess" />
  </div>
</template>

<script>
import Api from "@/apis/api";
import HeaderBar from "@/components/HeaderBar.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import VoiceCloneDialog from "@/components/VoiceCloneDialog.vue";
import CustomButton from "@/components/CustomButton.vue";
import CustomPagination from "@/components/CustomPagination.vue";
import { formatDate } from "@/utils/format";

export default {
  components: { HeaderBar, VersionFooter, VoiceCloneDialog, CustomButton, CustomPagination },
  data() {
    return {
      searchName: "",
      loading: false,
      voiceCloneList: [],
      currentPage: 1,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      total: 0,
      cloneDialogVisible: false,
      currentVoiceClone: {},
      voiceCloneForm: {
        modelId: "",
        voiceIds: [],
        userId: null
      },
      currentAudio: null,
      playingRowId: null
    };
  },
  created() {
    this.fetchVoiceCloneList();
  },
  beforeDestroy() {
    this.stopCurrentAudio();
  },
  methods: {
    // $t with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback, params) {
      const value = this.$t(key, params);
      if (value !== key) return value;
      return String(fallback).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
    },
    // Status badge tone: colour always paired with an icon and a word
    statusBadgeClass(row) {
      if (!row.hasVoice) return '';
      switch (row.trainStatus) {
        case 0:
          return 'nx-badge--warning';
        case 1:
          return 'nx-badge--info';
        case 2:
          return 'nx-badge--success';
        case 3:
          return 'nx-badge--danger';
        default:
          return '';
      }
    },
    statusIcon(row) {
      if (!row.hasVoice) return 'el-icon-upload2';
      switch (row.trainStatus) {
        case 0:
          return 'el-icon-time';
        case 1:
          return 'el-icon-refresh';
        case 2:
          return 'el-icon-circle-check';
        case 3:
          return 'el-icon-warning-outline';
        default:
          return 'el-icon-more-outline';
      }
    },
    // Stable pseudo-random bar heights per voice (30-100%)
    waveHeight(id, n) {
      const str = String(id) + ':' + n;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
      }
      return 0.3 + (Math.abs(hash) % 70) / 100;
    },
    getTooltipContent(row) {
      if (!row.hasVoice) {
        return this.$t('voiceClone.waitingUpload');
      }
      switch (row.trainStatus) {
        case 0:
          return this.$t('voiceClone.waitingTraining');
        case 2:
          return this.$t('voiceClone.trainSuccess');
        case 3:
          if (row.trainError) {
            return this.$t('voiceClone.trainFailedWithError', { error: row.trainError });
          }
          return this.$t('voiceClone.trainFailed');
        default:
          return '';
      }
    },
    handleViewDetails(row) {
      console.log('View details:', row);
    },
    handlePageSizeChange(val) {
      this.pageSize = val;
      this.currentPage = 1;
      this.fetchVoiceCloneList();
    },
    goToPage(page) {
      if (page !== this.currentPage) {
        this.currentPage = page;
        this.fetchVoiceCloneList();
      }
    },
    fetchVoiceCloneList() {
      this.loading = true;
      const params = {
        page: this.currentPage,
        limit: this.pageSize,
        name: this.searchName || "",
        orderField: "create_date",
        order: "desc"
      };
      Api.voiceClone.getVoiceCloneList(params, (res) => {
        this.loading = false;
        res = res.data;
        if (res.code === 0) {
          this.voiceCloneList = res.data.list;
          this.total = res.data.total || 0;
        } else {
          this.voiceCloneList = [];
          this.total = 0;
          this.$message.error({
            message: res?.data?.msg || this.$t('voiceClone.deleteFailed'),
            showClose: true
          });
        }
      });
    },
    handleSearch() {
      this.currentPage = 1;
      this.fetchVoiceCloneList();
    },
    formatDate,
    getTrainStatusText(row) {
      if (!row.hasVoice) {
        return this.$t('voiceClone.waitingUpload');
      }
      switch (row.trainStatus) {
        case 0:
          return this.$t('voiceClone.waitingTraining');
        case 1:
          return this.$t('voiceClone.training');
        case 2:
          return this.$t('voiceClone.trainSuccess');
        case 3:
          return this.$t('voiceClone.trainFailed');
        default:
          return '';
      }
    },
    getStatusButtonClass(row) {
      if (!row.hasVoice || row.trainStatus === 0) {
        return 'status-waiting';
      } else if (row.trainStatus === 2) {
        return 'status-success';
      } else if (row.trainStatus === 3) {
        return 'status-failed';
      }
      return '';
    },
    handleClone(row) {
      if (row._cloning) {
        return;
      }
      this.$set(row, '_cloning', true);
      const params = { cloneId: row.id };
      try {
        Api.voiceClone.cloneAudio(params, (res) => {
          try {
            res = res.data;
            if (res.code === 0) {
              this.$message.success(this.$t('message.success'));
              this.fetchVoiceCloneList();
            } else {
              this.$message.error(res.msg || this.$t('message.error'));
              this.fetchVoiceCloneList();
            }
          } catch (error) {
            console.error('Error processing response:', error);
            this.$message.error('Error processing response');
            this.fetchVoiceCloneList();
          } finally {
            this.$set(row, '_cloning', false);
          }
        }, (error) => {
          console.error('API call failed:', error);
          this.$message.error(this.$t('voiceClone.cloneErrorTip'));
          this.fetchVoiceCloneList();
          this.$set(row, '_cloning', false);
        });
      } catch (error) {
        console.error('Error calling API:', error);
        this.$message.error(this.$t('voiceClone.apiError'));
        this.fetchVoiceCloneList();
        this.$set(row, '_cloning', false);
      }
    },
    handleCloneSuccess() {
      this.fetchVoiceCloneList();
    },
    handleEditName(row) {
      this.$set(row, 'isEdit', true);
      this.$nextTick(() => {
        const input = this.$refs.nameInput;
        if (input) {
          if (Array.isArray(input)) {
            const idx = this.voiceCloneList.indexOf(row);
            if (input[idx]) {
              input[idx].focus();
            }
          } else {
            input.focus();
          }
        }
      });
    },
    submitName(row) {
      if (row._submitting) {
        return;
      }
      row._submitting = true;
      const params = { id: row.id, name: row.name };
      Api.voiceClone.updateName(params, (res) => {
        res = res.data;
        if (res.code === 0) {
          this.$message.success(this.$t('voiceClone.updateNameSuccess') || 'Name updated successfully');
        } else {
          this.$message.error(res.msg || this.$t('voiceClone.updateNameFailed') || 'Failed to update name');
          this.fetchVoiceCloneList();
        }
        row._submitting = false;
      });
    },
    handleEditButtonClick(row) {
      if (row.isEdit) {
        row.isEdit = false;
        this.submitName(row);
      } else {
        this.handleEditName(row);
      }
    },
    onNameEnter(row) {
      row.isEdit = false;
      this.submitName(row);
    },
    handlePlay(row) {
      if (!row.hasVoice) return;
      if (this.playingRowId === row.id && this.currentAudio) {
        this.stopCurrentAudio();
        return;
      }
      this.stopCurrentAudio();
      Api.voiceClone.getAudioId(row.id, (res) => {
        res = res.data;
        if (res.code === 0) {
          const uuid = res.data;
          const audioUrl = Api.voiceClone.getPlayVoiceUrl(uuid);
          const audio = new Audio(audioUrl);
          this.currentAudio = audio;
          this.playingRowId = row.id;
          audio.addEventListener('ended', () => {
            this.playingRowId = null;
            this.currentAudio = null;
          });
          audio.addEventListener('error', () => {
            this.playingRowId = null;
            this.currentAudio = null;
          });
          audio.play().catch(err => {
            console.error('Playback failed:', err);
            this.$message.error(this.$t('voiceClone.playFailed') || 'Playback failed');
            this.playingRowId = null;
            this.currentAudio = null;
          });
        } else {
          this.$message.error(res.msg || this.$t('voiceClone.audioNotExist') || 'Audio does not exist');
        }
      });
    },
    stopCurrentAudio() {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
      }
      this.playingRowId = null;
    },
    handleUpload(row) {
      this.currentVoiceClone = row;
      this.cloneDialogVisible = true;
    }
  }
};
</script>

<style lang="scss" scoped>
.nx-app {
  min-height: 100vh;
  background: var(--nx-bg);
}

.vc-search {
  width: 300px;
}

.vc-card {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-4);
  min-width: 0;

  &__top {
    display: flex;
    align-items: flex-start;
    gap: var(--nx-space-3);
    min-width: 0;
  }
  &__title {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--nx-space-2);
    flex: 1 1 auto;
    min-width: 0;

    .nx-headline {
      max-width: 100%;
      line-height: 1.4;
    }
    .el-input {
      width: 100%;
    }
  }
  &__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--nx-space-2);
    margin-top: auto;
    padding-top: var(--nx-space-4);
    border-top: 1px solid var(--nx-border);

    .el-button + .el-button {
      margin-left: 0;
    }
  }

  &.is-playing {
    border-color: var(--nx-accent);
  }
}

.vc-play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--nx-control-h-lg);
  height: var(--nx-control-h-lg);
  border: 0;
  border-radius: 50%;
  background: var(--nx-accent-soft);
  color: var(--nx-accent);
  font-size: var(--nx-text-title);
  cursor: pointer;
  transition: background-color var(--nx-dur-1) var(--nx-ease), color var(--nx-dur-1) var(--nx-ease),
    transform var(--nx-dur-1) var(--nx-ease);

  &:hover:not(:disabled) {
    background: var(--nx-accent);
    color: var(--nx-on-accent);
  }
  &:active:not(:disabled) {
    transform: scale(0.94);
  }
  &:disabled {
    background: var(--nx-surface-2);
    color: var(--nx-text-3);
    cursor: default;
  }
}

.vc-card.is-playing .vc-play {
  background: var(--nx-accent);
  color: var(--nx-on-accent);
}

.vc-rename {
  margin: -4px -6px 0 0;
}

.vc-status {
  max-width: 100%;
}

// Waveform strip: bars are static until the sample plays
.vc-wave {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 36px;
  padding: 0 var(--nx-space-3);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);
  overflow: hidden;

  &__bar {
    flex: 1 1 0;
    max-width: 6px;
    height: 70%;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-border-strong);
    transform: scaleY(var(--h, 0.5));
    transform-origin: center;
    transition: background-color var(--nx-dur-2) var(--nx-ease);
  }
}

.vc-card.is-playing .vc-wave__bar {
  background: var(--nx-accent);
  animation: vc-wave 1.1s var(--nx-ease) infinite alternate;

  @for $i from 1 through 24 {
    &:nth-child(#{$i}) {
      animation-delay: #{($i % 6) * -0.18}s;
    }
  }
}

@keyframes vc-wave {
  from {
    transform: scaleY(0.25);
  }
  to {
    transform: scaleY(var(--h, 0.8));
  }
}

.vc-meta {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);
  margin: 0;

  &__row {
    display: grid;
    grid-template-columns: minmax(84px, auto) minmax(0, 1fr);
    gap: var(--nx-space-3);
    align-items: baseline;
  }
  dt {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  dd {
    margin: 0;
    min-width: 0;
    font-size: var(--nx-text-callout);
    color: var(--nx-text);
  }
}

.vc-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--nx-space-5);
}

.vc-sk-tile {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}
.vc-sk-title {
  flex: 1;
  height: 20px;
}
.vc-sk-line {
  height: 14px;
  &--short {
    width: 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vc-card.is-playing .vc-wave__bar {
    animation: none;
  }
}

@media (max-width: 640px) {
  .vc-search {
    width: 100%;
  }
  .nx-page-header__actions {
    width: 100%;
  }
}
</style>
