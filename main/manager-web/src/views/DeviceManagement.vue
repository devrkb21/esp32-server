<template>
  <div class="nx-devices">
    <HeaderBar />

    <main class="nx-page">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <button type="button" class="nx-back" @click="goBack">
            <i class="el-icon-arrow-left" aria-hidden="true"></i>
            {{ tx('device.backToAgents', 'Agents') }}
          </button>
          <h1 class="nx-title nx-truncate" :title="pageTitle">{{ pageTitle }}</h1>
          <p class="nx-page-header__desc">{{ pageDescription }}</p>
        </div>
        <div class="nx-page-header__actions">
          <el-input v-model="searchKeyword" class="dev-search" prefix-icon="el-icon-search" clearable
            :placeholder="tx('device.searchShort', 'Search board or MAC')" :aria-label="$t('device.search')"
            @input="handleSearch" @keyup.enter.native="handleSearch" />
          <el-tooltip :content="$t('companion.refresh')" placement="bottom" :open-delay="400">
            <button type="button" class="nx-icon-btn dev-refresh" :aria-label="$t('companion.refresh')"
              :disabled="refreshingStatus" @click="refreshStatusNow">
              <i :class="refreshingStatus ? 'el-icon-loading' : 'el-icon-refresh'" aria-hidden="true"></i>
            </button>
          </el-tooltip>
          <CustomButton icon="el-icon-edit-outline" :disabled="!currentAgentId" @click="handleManualAddDevice">
            {{ tx('device.addByMac', 'Add by MAC') }}
          </CustomButton>
          <CustomButton type="add" icon="el-icon-plus" :disabled="!currentAgentId" @click="handleAddDevice">
            {{ tx('device.addRobot', 'Add device') }}
          </CustomButton>
        </div>
      </header>

      <!-- No agent in the URL -->
      <section v-if="!currentAgentId" class="nx-card">
        <div class="nx-empty">
          <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-cpu"></i></span>
          <h2 class="nx-empty__title">{{ tx('device.noAgentTitle', 'Pick an agent first') }}</h2>
          <p class="nx-empty__text">{{ tx('device.noAgentText', 'Robots belong to an agent. Open an agent on the home page to see its robots.') }}</p>
          <CustomButton class="nx-empty__action" type="confirm" @click="goBack">{{ tx('device.backToAgents', 'Agents') }}</CustomButton>
        </div>
      </section>

      <section v-else class="nx-card nx-card--flush dev-card" :aria-busy="loading ? 'true' : 'false'">
        <!-- Selection bar -->
        <transition name="nx-fade">
          <div v-if="selectedCount" class="dev-bulk" role="region" :aria-label="tx('device.selection', 'Selection')">
            <span class="dev-bulk__count nx-num">{{ tx('device.selectedCount', '{count} selected', { count: selectedCount }) }}</span>
            <span class="nx-spacer"></span>
            <CustomButton size="small" @click="handleSelectAll">
              {{ isCurrentPageAllSelected ? $t('common.deselectAll') : $t('common.selectAll') }}
            </CustomButton>
            <CustomButton size="small" type="delete" icon="el-icon-delete" @click="deleteSelected">
              {{ $t('device.unbind') }}
            </CustomButton>
          </div>
        </transition>

        <!-- Column header (wide screens) -->
        <div v-if="deviceList.length || loading" class="dev-row dev-row--head">
          <span class="dev-cell dev-cell--check">
            <el-checkbox :value="isCurrentPageAllSelected" :indeterminate="!!selectedCount && !isCurrentPageAllSelected"
              :disabled="!paginatedDeviceList.length" :aria-label="$t('common.selectAll')" @change="handleSelectAll" />
          </span>
          <span class="dev-cell dev-cell--name">{{ tx('device.robot', 'Robot') }}</span>
          <span class="dev-cell dev-cell--mac">{{ $t('device.macAddress') }}</span>
          <span class="dev-cell dev-cell--board">{{ $t('device.model') }}</span>
          <span class="dev-cell dev-cell--fw">{{ $t('device.firmwareVersion') }}</span>
          <span class="dev-cell dev-cell--seen">{{ tx('device.lastConnected', 'Last connected') }}</span>
          <span class="dev-cell dev-cell--ota">{{ $t('device.autoUpdate') }}</span>
          <span class="dev-cell dev-cell--actions"><span class="nx-visually-hidden">{{ $t('device.operation') }}</span></span>
        </div>

        <!-- Loading skeleton -->
        <div v-if="loading && !deviceList.length" class="dev-list">
          <div v-for="n in 3" :key="'sk' + n" class="dev-row dev-row--skeleton">
            <span class="dev-cell dev-cell--check"><span class="nx-skeleton dev-sk dev-sk--box"></span></span>
            <span class="dev-cell dev-cell--name"><span class="nx-skeleton dev-sk dev-sk--wide"></span></span>
            <span class="dev-cell dev-cell--mac"><span class="nx-skeleton dev-sk"></span></span>
            <span class="dev-cell dev-cell--board"><span class="nx-skeleton dev-sk"></span></span>
          </div>
        </div>

        <!-- Empty: no robots yet -->
        <div v-else-if="!deviceList.length" class="nx-empty dev-empty">
          <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-cpu"></i></span>
          <h2 class="nx-empty__title">{{ tx('device.emptyTitle', 'Add your first robot') }}</h2>
          <p class="nx-empty__text">
            {{ tx('device.emptyText', 'Turn TinyBot on and connect it to Wi-Fi. It says a 6-digit code: choose Add device and type that code.') }}
          </p>
          <div class="nx-empty__action dev-empty__actions">
            <CustomButton type="add" icon="el-icon-plus" @click="handleAddDevice">{{ tx('device.addRobot', 'Add device') }}</CustomButton>
            <el-button type="text" @click="handleManualAddDevice">{{ tx('device.emptyManual', 'No code? Add by MAC address') }}</el-button>
          </div>
        </div>

        <!-- Empty: search has no match -->
        <div v-else-if="!filteredDeviceList.length" class="nx-empty dev-empty">
          <span class="nx-icon-tile nx-icon-tile--lg nx-icon-tile--neutral" aria-hidden="true"><i class="el-icon-search"></i></span>
          <h2 class="nx-empty__title">{{ tx('device.noMatchTitle', 'No robots match') }}</h2>
          <p class="nx-empty__text nx-break">{{ tx('device.noMatchText', 'Nothing matches “{query}”. Try part of the board name or MAC address.', { query: activeSearchKeyword }) }}</p>
          <CustomButton class="nx-empty__action" @click="clearSearch">{{ tx('device.clearSearch', 'Clear search') }}</CustomButton>
        </div>

        <!-- Rows -->
        <ul v-else class="dev-list" role="list">
          <li v-for="row in paginatedDeviceList" :key="row.device_id" class="dev-row"
            :class="{ 'is-selected': row.selected }">
            <span class="dev-cell dev-cell--check">
              <el-checkbox v-model="row.selected" :aria-label="tx('device.selectRobot', 'Select {name}', { name: rowName(row) })" />
            </span>

            <div class="dev-cell dev-cell--name">
              <span v-if="mqttServiceAvailable" class="nx-dot" :class="{ 'nx-dot--online': row.deviceStatus === 'online' }"
                aria-hidden="true"></span>
              <span v-else class="dev-name__icon" aria-hidden="true"><i class="el-icon-cpu"></i></span>
              <div class="dev-name">
                <el-input v-if="row.isEdit" :ref="'alias-' + row.device_id" v-model="row.alias" size="small" maxlength="64"
                  show-word-limit class="dev-name__input" :aria-label="$t('device.alias')"
                  @blur="onAliasBlur(row)" @keyup.enter.native="onAliasEnter(row)" />
                <template v-else>
                  <button type="button" class="dev-name__text nx-truncate" :class="{ 'is-placeholder': !row.alias }"
                    :title="row.alias || ''" @click="startAliasEdit(row)">
                    {{ row.alias || tx('device.unnamed', 'Unnamed robot') }}
                  </button>
                  <span class="dev-name__meta nx-truncate">
                    <template v-if="mqttServiceAvailable">
                      <span :class="row.deviceStatus === 'online' ? 'is-online' : ''">
                        {{ row.deviceStatus === 'online' ? $t('device.online') : $t('device.offline') }}
                      </span>
                      <span aria-hidden="true"> · </span>
                    </template>
                    <span :title="$t('device.bindTime') + ': ' + row.bindTime">{{ tx('device.addedOn', 'Added {date}', { date: row.bindTime }) }}</span>
                  </span>
                </template>
              </div>
            </div>

            <div class="dev-meta">
              <span class="dev-cell dev-cell--mac">
                <span class="dev-cell__label">{{ $t('device.macAddress') }}</span>
                <MacAddressMask :macAddress="row.macAddress" />
              </span>
              <span class="dev-cell dev-cell--board">
                <span class="dev-cell__label">{{ $t('device.model') }}</span>
                <span class="nx-truncate" :title="getFirmwareTypeName(row.model)">{{ getFirmwareTypeName(row.model) || '–' }}</span>
              </span>
              <span class="dev-cell dev-cell--fw">
                <span class="dev-cell__label">{{ $t('device.firmwareVersion') }}</span>
                <span class="nx-mono nx-truncate" :title="row.firmwareVersion">{{ row.firmwareVersion || '–' }}</span>
              </span>
              <span class="dev-cell dev-cell--seen">
                <span class="dev-cell__label">{{ tx('device.lastConnected', 'Last connected') }}</span>
                <span class="nx-truncate" :title="row.lastConversation">{{ relativeTime(row.lastConnectedRaw) }}</span>
              </span>
              <span class="dev-cell dev-cell--ota">
                <span class="dev-cell__label">{{ $t('device.autoUpdate') }}</span>
                <el-switch v-model="row.otaSwitch" :aria-label="$t('device.autoUpdate')" @change="handleOtaSwitchChange(row)" />
              </span>
            </div>

            <div class="dev-cell dev-cell--actions">
              <el-button size="small" class="dev-companion" :aria-label="$t('companion.title')" @click="openCompanion(row)">
                <i class="el-icon-s-home" aria-hidden="true"></i>
                <span class="dev-companion__label">{{ $t('companion.title') }}</span>
              </el-button>
              <el-dropdown trigger="click" placement="bottom-end" @command="(cmd) => handleRowCommand(cmd, row)">
                <button type="button" class="nx-icon-btn" :aria-label="tx('device.moreActions', 'More actions for {name}', { name: rowName(row) })">
                  <i class="el-icon-more" aria-hidden="true"></i>
                </button>
                <el-dropdown-menu slot="dropdown" class="dev-menu">
                  <el-dropdown-item command="rename" icon="el-icon-edit">{{ tx('device.rename', 'Rename') }}</el-dropdown-item>
                  <el-dropdown-item command="volume" icon="el-icon-headset">{{ tx('device.volume', 'Volume') }}</el-dropdown-item>
                  <el-dropdown-item command="reboot" icon="el-icon-refresh-right" :disabled="rebootingDeviceId === row.device_id">
                    {{ tx('device.reboot', 'Restart') }}
                  </el-dropdown-item>
                  <el-dropdown-item v-if="isGenerate(row)" command="theme" icon="el-icon-picture-outline">
                    {{ $t('device.deviceThemeGeneration') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="unbind" icon="el-icon-delete" divided class="dev-menu__danger">
                    {{ $t('device.unbind') }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </el-dropdown>
            </div>
          </li>
        </ul>

        <footer v-if="filteredDeviceList.length > pageSizeOptions[0]" class="dev-footer">
          <CustomPagination :total="filteredDeviceList.length" :current-page="currentPage" :page-size="pageSize"
            :page-size-options="pageSizeOptions" @size-change="handlePageSizeChange" @page-change="goToPage" />
        </footer>
      </section>
    </main>

    <!-- Volume -->
    <CustomDialog :visible.sync="volumeDialogVisible" width="440px" :title="volumeTitle"
      :confirm-loading="volumeSubmitting" :confirmText="$t('button.save')" :cancelText="$t('button.cancel')"
      @confirm="submitVolume">
      <div class="dev-volume">
        <div class="dev-volume__value nx-num" aria-live="polite">{{ currentVolume }}<span>%</span></div>
        <div class="dev-volume__slider">
          <i class="el-icon-minus" aria-hidden="true"></i>
          <el-slider v-model="currentVolume" :min="0" :max="100" :step="5" :show-tooltip="false"
            :aria-label="tx('device.volume', 'Volume')" />
          <i class="el-icon-plus" aria-hidden="true"></i>
        </div>
        <p class="dev-volume__hint">{{ tx('device.volumeHint', 'The robot changes its volume the next time it is online.') }}</p>
      </div>
    </CustomDialog>

    <AddDeviceDialog :visible.sync="addDeviceDialogVisible" :agent-id="currentAgentId"
      @refresh="fetchBindDevices(currentAgentId)" />
    <ManualAddDeviceDialog :visible.sync="manualAddDeviceDialogVisible" :agent-id="currentAgentId"
      @refresh="fetchBindDevices(currentAgentId)" />

    <VersionFooter />
  </div>
</template>

<script>
import Api from '@/apis/api';
import AddDeviceDialog from "@/components/AddDeviceDialog.vue";
import HeaderBar from "@/components/HeaderBar.vue";
import ManualAddDeviceDialog from "@/components/ManualAddDeviceDialog.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import MacAddressMask from "@/components/MacAddressMask.vue";
import CustomButton from "@/components/CustomButton.vue";
import CustomDialog from "@/components/CustomDialog.vue";
import CustomPagination from "@/components/CustomPagination.vue";
import { ageOf } from '@/utils/companion.mjs';
import {
  compareTimestamps,
  formatCreateDate,
  formatTimestamp,
  hasTimestampValue,
  parseLegacyDate,
  parseTimestamp,
} from '@/utils/deviceTime.mjs';

export default {
  components: {
    HeaderBar,
    AddDeviceDialog,
    ManualAddDeviceDialog,
    VersionFooter,
    MacAddressMask,
    CustomButton,
    CustomDialog,
    CustomPagination,
  },
  data() {
    return {
      addDeviceDialogVisible: false,
      manualAddDeviceDialogVisible: false,
      selectedDeviceId: '',
      searchKeyword: "",
      activeSearchKeyword: "",
      currentAgentId: this.$route.query.agentId || '',
      agentName: '',
      currentPage: 1,
      pageSize: 10,
      pageSizeOptions: [10, 20, 50, 100],
      deviceList: [],
      loading: false,
      userApi: null,
      firmwareTypes: [],
      mqttServiceAvailable: false,
      volumeDialogVisible: false,
      selectedDevice: null,
      currentVolume: 70,
      volumeSubmitting: false,
      rebootingDeviceId: '',
      refreshingStatus: false,
      statusPollTimer: null,
      now: Date.now(),
    };
  },
  computed: {
    filteredDeviceList() {
      const keyword = this.activeSearchKeyword.toLowerCase();
      if (!keyword) return this.deviceList;
      return this.deviceList.filter(device =>
        (device.model && device.model.toLowerCase().includes(keyword)) ||
        (device.macAddress && device.macAddress.toLowerCase().includes(keyword))
      );
    },

    paginatedDeviceList() {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.filteredDeviceList.slice(start, end);
    },
    isCurrentPageAllSelected() {
      return this.paginatedDeviceList.length > 0 &&
        this.paginatedDeviceList.every(device => device.selected);
    },
    selectedCount() {
      return this.paginatedDeviceList.filter(device => device.selected).length;
    },
    onlineCount() {
      return this.deviceList.filter(device => device.deviceStatus === 'online').length;
    },
    pageTitle() {
      return this.agentName || this.tx('device.robotsTitle', 'Robots');
    },
    pageDescription() {
      const total = this.deviceList.length;
      if (!this.currentAgentId) return this.tx('device.pageDesc', 'Robots that talk with this agent');
      if (!total) return this.tx('device.pageDesc', 'Robots that talk with this agent');
      const count = this.tx(total === 1 ? 'device.countOne' : 'device.countMany',
        total === 1 ? '1 robot' : '{count} robots', { count: total });
      if (!this.mqttServiceAvailable) return count;
      return count + ' · ' + this.tx('device.onlineCount', '{count} online', { count: this.onlineCount });
    },
    volumeTitle() {
      const name = this.selectedDevice ? (this.selectedDevice.alias || this.selectedDevice.macAddress) : '';
      return this.tx('device.volume', 'Volume') + (name ? ' · ' + name : '');
    },
  },
  mounted() {
    const agentId = this.$route.query.agentId;
    if (agentId) {
      this.fetchAgentName(agentId);
      this.fetchBindDevices(agentId);
      this.startStatusPolling(agentId);
    }
  },
  beforeDestroy() {
    this.stopStatusPolling();
  },
  created() {
    this.getFirmwareTypes()
  },
  methods: {
    // Pending i18n keys fall back to their English text until the lead merges them
    tx(key, fallback, params) {
      if (this.$te(key) || this.$te(key, 'en')) return this.$t(key, params);
      if (!params) return fallback;
      return fallback.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? params[name] : match));
    },
    rowName(row) {
      return row.alias || row.macAddress || '';
    },
    relativeTime(ms) {
      if (ms === null || ms === undefined) return this.tx('device.never', 'Never');
      const age = ageOf(ms / 1000, this.now);
      if (age.unit === 'justNow') return this.$t('companion.justNow');
      if (age.unit === 'never') return this.tx('device.never', 'Never');
      return this.$t('companion.ago.' + age.unit, { n: age.value });
    },
    goBack() {
      this.$router.push('/home');
    },
    fetchAgentName(agentId) {
      Api.agent.getDeviceConfig(agentId, ({ data }) => {
        if (data && data.code === 0 && data.data) {
          this.agentName = data.data.agentName || '';
        }
      }, () => {});
    },
    async getFirmwareTypes() {
      try {
        const res = await Api.dict.getDictDataByType('FIRMWARE_TYPE')
        this.firmwareTypes = res.data
      } catch (error) {
        console.error(this.$t('device.getFirmwareTypeFailed') + ':', error)
        this.$message.error(error.message || this.$t('device.getFirmwareTypeFailed'))
      }
    },
    handlePageSizeChange(val) {
      this.pageSize = val;
      this.currentPage = 1;
    },
    handleSearch() {
      this.activeSearchKeyword = (this.searchKeyword || '').trim();
      this.currentPage = 1;
    },
    clearSearch() {
      this.searchKeyword = '';
      this.handleSearch();
    },

    handleSelectAll() {
      const shouldSelectAll = !this.isCurrentPageAllSelected;
      this.paginatedDeviceList.forEach(row => {
        row.selected = shouldSelectAll;
      });
    },

    deleteSelected() {
      const selectedDevices = this.paginatedDeviceList.filter(device => device.selected);
      if (selectedDevices.length === 0) {
        this.$message.warning({
          message: this.$t('device.selectAtLeastOne'),
          showClose: true
        });
        return;
      }

      this.$confirm(this.$t('device.confirmBatchUnbind').replace('{count}', selectedDevices.length), this.$t('message.warning'), {
        confirmButtonText: this.$t('device.unbind'),
        cancelButtonText: this.$t('button.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }).then(() => {
        const deviceIds = selectedDevices.map(device => device.device_id);
        this.batchUnbindDevices(deviceIds);
      }).catch(() => {});
    },
    batchUnbindDevices(deviceIds) {
      const promises = deviceIds.map(id => {
        return new Promise((resolve, reject) => {
          Api.device.unbindDevice(id, ({ data }) => {
            if (data.code === 0) {
              resolve();
            } else {
              reject(data.msg || this.$t('device.bindFailed'));
            }
          });
        });
      });
      Promise.all(promises)
        .then(() => {
          this.$message.success({
            message: this.$t('device.batchUnbindSuccess').replace('{count}', deviceIds.length),
            showClose: true
          });
          this.fetchBindDevices(this.currentAgentId);
        })
        .catch(error => {
          this.$message.error({
            message: error || this.$t('device.batchUnbindError'),
            showClose: true
          });
        });
    },
    handleAddDevice() {
      this.addDeviceDialogVisible = true;
    },
    handleManualAddDevice() {
      this.manualAddDeviceDialogVisible = true;
    },
    handleRowCommand(command, row) {
      if (command === 'rename') this.startAliasEdit(row);
      else if (command === 'volume') this.handleVolumeDialog(row);
      else if (command === 'reboot') this.handleReboot(row);
      else if (command === 'theme') this.handleGenertor(row);
      else if (command === 'unbind') this.handleUnbind(row.device_id, this.rowName(row));
    },
    startAliasEdit(row) {
      row.isEdit = true;
      this.$nextTick(() => {
        const ref = this.$refs['alias-' + row.device_id];
        const input = Array.isArray(ref) ? ref[0] : ref;
        if (input) input.focus();
      });
    },
    submitAlias(row) {
      if (row._submitting) return;

      const text = (row.alias || '').trim();
      if (text.length > 64) {
        this.$message.warning(this.$t('device.aliasTooLong'));
        return;
      }
      if (text === row._originalAlias) {
        return;
      }

      row._submitting = true;
      this.updateDeviceInfo(row.device_id, { alias: text }, (ok, resp) => {
        if (ok) {
          row._originalAlias = text;
          this.$message.success(this.$t('device.aliasSaved'));
        } else {
          row.alias = row._originalAlias;
          this.$message.error(resp.msg || this.$t('device.aliasSaveFailed'));
        }
        row._submitting = false;
      });
    },
    onAliasBlur(row) {
      row.isEdit = false;
      setTimeout(() => {
        this.submitAlias(row);
      }, 100);
    },
    onAliasEnter(row) {
      row.isEdit = false;
      this.submitAlias(row);
    },
    handleUnbind(device_id, name) {
      const message = name
        ? this.tx('device.confirmUnbindNamed', 'Unbind {name}? It stops talking to this agent until you add it again.', { name })
        : this.$t('device.confirmUnbind');
      this.$confirm(message, this.$t('message.warning'), {
        confirmButtonText: this.$t('device.unbind'),
        cancelButtonText: this.$t('button.cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning'
      }).then(() => {
        Api.device.unbindDevice(device_id, ({ data }) => {
          if (data.code === 0) {
            this.$message.success({
              message: this.$t('device.unbindSuccess'),
              showClose: true
            });
            this.fetchBindDevices(this.$route.query.agentId);
          } else {
            this.$message.error({
              message: data.msg || this.$t('device.unbindFailed'),
              showClose: true
            });
          }
        });
      }).catch(() => {});
    },
    handleVolumeDialog(row) {
      this.selectedDevice = row;
      const cached = localStorage.getItem('device_vol_' + (row.device_id || row.id));
      this.currentVolume = (row.volume !== undefined && row.volume !== null)
        ? row.volume
        : (cached !== null ? parseInt(cached) : 70);
      this.volumeDialogVisible = true;
    },
    submitVolume() {
      if (!this.selectedDevice) return;
      this.volumeSubmitting = true;
      const devId = this.selectedDevice.device_id || this.selectedDevice.id;
      Api.device.setDeviceVolume(devId, this.currentVolume, ({ data }) => {
        this.volumeSubmitting = false;
        if (data.code === 0) {
          this.$message.success(this.tx('device.volumeUpdated', 'Volume updated'));
          this.$set(this.selectedDevice, 'volume', this.currentVolume);
          localStorage.setItem('device_vol_' + devId, this.currentVolume);
          this.volumeDialogVisible = false;
        } else {
          this.$message.error(data.msg || this.tx('device.volumeFailed', 'Couldn’t change the volume. Try again.'));
        }
      });
    },
    handleReboot(row) {
      this.$confirm(
        this.tx('device.confirmReboot', 'Restart {name}? It will be offline for a moment.', { name: this.rowName(row) }),
        this.$t('message.warning'),
        {
          confirmButtonText: this.tx('device.reboot', 'Restart'),
          cancelButtonText: this.$t('button.cancel'),
          type: 'warning'
        }
      ).then(() => {
        this.rebootingDeviceId = row.device_id;
        Api.device.rebootDevice(row.device_id, ({ data }) => {
          this.rebootingDeviceId = '';
          if (data.code === 0) {
            this.$message.success(this.tx('device.rebootSent', 'Restart command sent'));
          } else {
            this.$message.error(data.msg || this.tx('device.rebootFailed', 'Couldn’t restart the robot. Try again.'));
          }
        });
      }).catch(() => {});
    },
    openCompanion(row) {
      this.$router.push({
        name: 'CompanionManagement',
        query: {
          deviceId: row.device_id,
          agentId: this.currentAgentId,
        },
      });
    },
    handleGenertor(row) {
      this.$router.push({
        name: 'ThemeGenerator',
        query: {
          deviceId: row.device_id,
          agentId: this.currentAgentId,
        },
      });
    },
    goToPage(page) {
      this.currentPage = page;
    },

    fetchBindDevices(agentId) {
      this.loading = true;
      Api.device.getAgentBindDevices(agentId, ({ data }) => {
        this.loading = false;
        if (data.code === 0) {
          this.now = Date.now();
          this.deviceList = data.data.map(device => {
            const hasCreateDateTimestamp = hasTimestampValue(device.createDateTimestamp);
            const rawBindTime = hasCreateDateTimestamp
              ? parseTimestamp(device.createDateTimestamp)
              : parseLegacyDate(device.createDate);
            return {
              device_id: device.id,
              model: device.board,
              firmwareVersion: device.appVersion,
              macAddress: device.macAddress,
              bindTime: formatCreateDate(device.createDateTimestamp, device.createDate),
              lastConversation: formatTimestamp(device.lastConnectedAtTimestamp),
              lastConnectedRaw: parseTimestamp(device.lastConnectedAtTimestamp),
              alias: device.alias,
              _originalAlias: device.alias,
              isEdit: false,
              _submitting: false,
              otaSwitch: device.autoUpdate === 1,
              rawBindTime,
              selected: false,
              deviceStatus: 'offline'
            };
          })
            .sort((firstDevice, secondDevice) => compareTimestamps(
              firstDevice.rawBindTime,
              secondDevice.rawBindTime,
            ));
          this.activeSearchKeyword = "";
          this.searchKeyword = "";

          this.fetchDeviceStatus(agentId);
        } else {
          this.$message.error(data.msg || this.$t('device.getListFailed'));
        }
      });
    },

    startStatusPolling(agentId) {
      this.stopStatusPolling();
      this.statusPollTimer = setInterval(() => {
        if (this.$route.query.agentId) {
          this.fetchDeviceStatus(this.$route.query.agentId, true);
        }
      }, 10000);
    },
    stopStatusPolling() {
      if (this.statusPollTimer) {
        clearInterval(this.statusPollTimer);
        this.statusPollTimer = null;
      }
    },
    refreshStatusNow() {
      const agentId = this.$route.query.agentId;
      if (agentId) {
        this.refreshingStatus = true;
        this.fetchDeviceStatus(agentId, false);
        setTimeout(() => {
          this.refreshingStatus = false;
        }, 800);
      }
    },
    fetchDeviceStatus(agentId, isSilent = false) {
      if (!isSilent) {
        this.loading = true;
      }
      Api.device.getDeviceStatus(agentId, ({ data }) => {
        if (!isSilent) {
          this.loading = false;
        }
        this.now = Date.now();
        if (data.code === 0) {
          try {
            const statusData = JSON.parse(data.data);

            if (statusData && typeof statusData === 'object') {
              this.mqttServiceAvailable = true;
              this.updateDeviceStatusFromResponse(statusData);
            } else {
              this.mqttServiceAvailable = false;
            }
          } catch (error) {
            this.mqttServiceAvailable = false;
          }
        } else {
          this.mqttServiceAvailable = false;
        }
      });
    },

    updateDeviceStatusFromResponse(deviceStatusMap) {
      this.deviceList.forEach(device => {
        const macAddress = device.macAddress ? device.macAddress.replace(/:/g, '_') : 'unknown';
        const groupId = device.model ? device.model.replace(/:/g, '_') : 'GID_default';
        const mqttClientId = `${groupId}@@@${macAddress}@@@${macAddress}`;

        if (deviceStatusMap[mqttClientId]) {
          const statusInfo = deviceStatusMap[mqttClientId];

          let isOnline = false;
          if (statusInfo.isAlive === true) {
            isOnline = true;
          } else if (statusInfo.isAlive === false) {
            isOnline = false;
          } else if (statusInfo.isAlive === null && statusInfo.exists === true) {
            isOnline = true;
          } else {
            isOnline = false;
          }

          device.deviceStatus = isOnline ? 'online' : 'offline';
        } else {
          device.deviceStatus = 'offline';
        }
      });
    },
    getFirmwareTypeName(type) {
      const firmwareType = this.firmwareTypes.find(item => item.key === type)
      return firmwareType ? firmwareType.name : type
    },
    updateDeviceInfo(device_id, payload, callback) {
      return Api.device.updateDeviceInfo(device_id, payload, ({ data }) => {
        callback(data.code === 0, data);
      })
    },
    handleOtaSwitchChange(row) {
      this.updateDeviceInfo(row.device_id, { autoUpdate: row.otaSwitch ? 1 : 0 }, (result, { msg }) => {
        if (result) {
          this.$message.success(row.otaSwitch ? this.$t('device.autoUpdateEnabled') : this.$t('device.autoUpdateDisabled'));
          return;
        }
        row.otaSwitch = !row.otaSwitch
        this.$message.error(msg || this.$t('message.error'))
      })
    },
    isGenerate(row) {
      const version = (row.firmwareVersion || '').replace(/\./g, '');
      return Number(version) >= 200;
    },
  }
};
</script>

<style lang="scss" scoped>
.nx-devices {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--nx-bg);

  > .nx-page {
    flex: 1 0 auto;
  }
}

.nx-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.dev-search {
  width: 240px;
}

.dev-refresh:disabled {
  cursor: default;
}

// ------------------------------------------------------------------ table card

.dev-card {
  display: flex;
  flex-direction: column;
}

.dev-bulk {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  padding: var(--nx-space-2) var(--nx-space-5);
  background: var(--nx-accent-soft);
  border-bottom: 1px solid var(--nx-border);

  &__count {
    font-size: var(--nx-text-callout);
    font-weight: 600;
    color: var(--nx-accent);
  }
  .el-button + .el-button {
    margin-left: 0;
  }
}

.dev-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

// One grid for the header and every row so the columns line up
.dev-row {
  display: grid;
  grid-template-columns:
    32px minmax(200px, 2fr) 156px minmax(100px, 1fr) minmax(84px, 0.7fr)
    minmax(112px, 0.9fr) 92px 168px; // fixed actions column: the header has no buttons, so `auto` would shift every column
  grid-template-areas: "check name mac board fw seen ota actions";
  align-items: center;
  column-gap: var(--nx-space-3);
  min-height: 60px;
  padding: var(--nx-space-2) var(--nx-space-5);
  border-bottom: 1px solid var(--nx-border);
  transition: background-color var(--nx-dur-1) var(--nx-ease);

  &:last-child {
    border-bottom: 0;
  }
  &:not(.dev-row--head):hover {
    background: var(--nx-surface-2);
  }
  &.is-selected {
    background: var(--nx-surface-2);
  }

  &--head {
    min-height: 40px;
    padding-top: 0;
    padding-bottom: 0;
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    font-weight: 600;
    letter-spacing: 0.01em;
  }
}

.dev-meta {
  display: contents;
}

.dev-cell {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  min-width: 0;
  font-size: var(--nx-text-callout);
  color: var(--nx-text-2);

  &--check { grid-area: check; }
  &--name { grid-area: name; gap: var(--nx-space-3); color: var(--nx-text); }
  &--mac { grid-area: mac; }
  &--board { grid-area: board; }
  &--fw { grid-area: fw; }
  &--seen { grid-area: seen; font-variant-numeric: tabular-nums; }
  &--ota { grid-area: ota; }
  &--actions {
    grid-area: actions;
    justify-content: flex-end;
    gap: var(--nx-space-1);
  }

  // Inline labels only appear in the stacked (narrow) layout
  &__label {
    display: none;
  }
}

.dev-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: var(--nx-radius-sm);
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
  }
  &__text {
    display: block;
    max-width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--nx-text);
    font: inherit;
    font-size: var(--nx-text-body);
    font-weight: 600;
    text-align: left;
    cursor: text;
    &:hover {
      color: var(--nx-accent);
    }
    &.is-placeholder {
      color: var(--nx-text-3);
      font-weight: 500;
    }
  }
  &__meta {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
    .is-online {
      color: var(--nx-success);
      font-weight: 600;
    }
  }
  &__input {
    max-width: 280px;
  }
}

.dev-companion {
  i {
    margin-right: 6px;
  }
}

// Skeleton rows
.dev-row--skeleton:hover {
  background: transparent;
}
.dev-sk {
  width: 70%;
  height: 12px;
  &--wide {
    width: 85%;
    height: 16px;
  }
  &--box {
    width: 16px;
    height: 16px;
    border-radius: var(--nx-radius-sm);
  }
}

.dev-empty__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--nx-space-2);
}

.dev-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--nx-space-3) var(--nx-space-5);
  border-top: 1px solid var(--nx-border);
  overflow-x: auto;
}

// ------------------------------------------------------------------ volume dialog

.dev-volume {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--nx-space-3);
  padding: var(--nx-space-2) 0;

  &__value {
    font-size: var(--nx-text-display);
    font-weight: 700;
    letter-spacing: -0.022em;
    color: var(--nx-text);
    line-height: 1.19;
    span {
      margin-left: 2px;
      font-size: var(--nx-text-headline);
      color: var(--nx-text-3);
    }
  }
  &__slider {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    width: 100%;
    color: var(--nx-text-3);
    .el-slider {
      flex: 1;
    }
  }
  &__hint {
    margin: 0;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
    text-align: center;
  }
}

// ------------------------------------------------------------------ responsive

@media (max-width: 1100px) {
  .dev-row {
    grid-template-columns: 32px minmax(0, 1fr) auto;
    grid-template-areas:
      "check name actions"
      ". meta meta";
    row-gap: var(--nx-space-2);
    padding-top: var(--nx-space-3);
    padding-bottom: var(--nx-space-3);
  }
  .dev-row--head {
    display: none;
  }
  .dev-row--skeleton .dev-cell--mac,
  .dev-row--skeleton .dev-cell--board {
    display: none;
  }
  .dev-meta {
    grid-area: meta;
    display: flex;
    flex-wrap: wrap;
    gap: var(--nx-space-2) var(--nx-space-5);
    min-width: 0;
  }
  .dev-cell--mac,
  .dev-cell--board,
  .dev-cell--fw,
  .dev-cell--seen,
  .dev-cell--ota {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    max-width: 100%;
  }
  .dev-cell__label {
    display: block;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
}

@media (max-width: 960px) {
  .dev-search {
    width: 100%;
    flex: 1 1 100%;
  }
}

@media (max-width: 560px) {
  .dev-row,
  .dev-bulk {
    padding-left: var(--nx-space-4);
    padding-right: var(--nx-space-4);
  }
  .dev-companion {
    padding-left: 10px;
    padding-right: 10px;
    i {
      margin-right: 0;
    }
  }
  .dev-companion__label {
    display: none;
  }
}
</style>

<style lang="scss">
// Dropdown menu is appended to <body>, outside the scoped styles
.dev-menu .el-dropdown-menu__item.dev-menu__danger,
.dev-menu .el-dropdown-menu__item.dev-menu__danger:hover {
  color: var(--nx-danger);
}
.dev-menu .el-dropdown-menu__item.dev-menu__danger:hover {
  background: var(--nx-danger-soft);
}
</style>
