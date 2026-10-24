<template>
  <div class="nx-ab">
    <HeaderBar />

    <main class="nx-page nx-page--wide">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t('addressBookManagement.mainTitle') }}</h1>
          <p class="nx-page-header__desc">{{ $t('addressBookManagement.subTitle') }}</p>
        </div>
        <div class="nx-page-header__actions">
          <el-input
            v-model="searchKeyword"
            class="ab-search"
            prefix-icon="el-icon-search"
            :placeholder="$t('addressBookManagement.searchPlaceholder')"
            :aria-label="$t('addressBookManagement.searchPlaceholder')"
            clearable
            @input="handleSearch"
          />
        </div>
      </header>

      <!-- Loading -->
      <div v-if="loadingAgents" class="ab-layout" aria-busy="true">
        <div class="nx-card ab-robots ab-robots--skeleton">
          <span v-for="n in 4" :key="'s' + n" class="nx-skeleton ab-sk-row"></span>
        </div>
        <div class="nx-card ab-sk-detail">
          <span class="nx-skeleton ab-sk-title"></span>
          <span class="nx-skeleton ab-sk-row"></span>
          <span class="nx-skeleton ab-sk-row"></span>
        </div>
      </div>

      <!-- No robots at all -->
      <section v-else-if="!totalDevices" class="nx-card">
        <div class="nx-empty">
          <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-phone-outline"></i></span>
          <h2 class="nx-empty__title">{{ tx('addressBookManagement.emptyTitle', 'No robots yet') }}</h2>
          <p class="nx-empty__text">
            {{ tx('addressBookManagement.emptyText', 'Add robots to an agent first. Then choose here which robots may call each other.') }}
          </p>
          <CustomButton class="nx-empty__action" type="confirm" @click="goHome">
            {{ tx('addressBookManagement.goToAgents', 'Go to agents') }}
          </CustomButton>
        </div>
      </section>

      <div v-else class="ab-layout">
        <!-- Robots grouped by agent -->
        <aside class="nx-card nx-card--flush ab-robots" :aria-label="tx('addressBookManagement.robots', 'Robots')">
          <div v-if="!filteredAgents.length" class="nx-empty ab-empty-sm">
            <span class="nx-icon-tile nx-icon-tile--neutral" aria-hidden="true"><i class="el-icon-search"></i></span>
            <p class="nx-empty__text">{{ tx('addressBookManagement.noMatch', 'No robot or agent matches your search.') }}</p>
          </div>
          <div v-for="agent in filteredAgents" :key="agent.id" class="ab-agent">
            <button type="button" class="ab-agent__head" :aria-expanded="expandedAgentId === agent.id ? 'true' : 'false'"
              @click="toggleAgent(agent.id)">
              <i class="el-icon-arrow-right ab-agent__chevron" :class="{ 'is-open': expandedAgentId === agent.id }" aria-hidden="true"></i>
              <span class="ab-agent__name nx-truncate" :title="agent.agentName">{{ agent.agentName }}</span>
              <span class="ab-count nx-num">{{ (agent.devices && agent.devices.length) || agent.deviceCount || 0 }}</span>
            </button>
            <transition name="nx-fade">
              <ul v-if="expandedAgentId === agent.id" class="ab-agent__list">
                <li v-if="!agent.devices || !agent.devices.length" class="ab-agent__none">
                  {{ tx('addressBookManagement.agentNoRobots', 'No robots in this agent') }}
                </li>
                <li v-for="device in agent.devices" :key="device.id">
                  <button type="button" class="ab-robot"
                    :class="{ 'is-active': selectedDevice && selectedDevice.id === device.id }"
                    :aria-current="selectedDevice && selectedDevice.id === device.id ? 'true' : null"
                    @click="handleDeviceClick(device, agent)">
                    <span class="nx-avatar ab-avatar" aria-hidden="true">
                      <template v-if="avatarText(device)">{{ avatarText(device) }}</template>
                      <i v-else class="el-icon-cpu"></i>
                    </span>
                    <span class="ab-robot__text">
                      <span class="ab-robot__name nx-truncate"><MacAddressMask :macAddress="device.name" /></span>
                      <span class="ab-robot__meta">
                        <span class="nx-dot" :class="{ 'nx-dot--online': device.online }" aria-hidden="true"></span>
                        {{ device.online ? $t('addressBookManagement.online') : $t('addressBookManagement.offline') }}
                      </span>
                    </span>
                  </button>
                </li>
              </ul>
            </transition>
          </div>
        </aside>

        <!-- Selected robot -->
        <section class="ab-detail">
          <template v-if="hasSelection">
            <article class="nx-card ab-device">
              <div class="ab-device__head">
                <span class="nx-icon-tile nx-icon-tile--lg ab-device__avatar" aria-hidden="true">
                  <template v-if="avatarText(selectedDevice)">{{ avatarText(selectedDevice) }}</template>
                  <i v-else class="el-icon-cpu"></i>
                </span>
                <div class="ab-device__text">
                  <div class="ab-device__name-row">
                    <input
                      v-if="isEditingAlias"
                      v-model="editAliasValue"
                      class="ab-inline-input ab-inline-input--title"
                      ref="aliasInput"
                      maxlength="64"
                      :aria-label="$t('device.alias')"
                      @blur="handleAliasBlur"
                      @keyup.enter="handleAliasBlur"
                      autofocus
                    />
                    <button v-else type="button" class="ab-device__name nx-truncate" @click="handleStartEdit">
                      <MacAddressMask :macAddress="selectedDevice.name" />
                    </button>
                    <button v-if="!isEditingAlias" type="button" class="nx-icon-btn" :aria-label="$t('common.edit')" @click="handleStartEdit">
                      <i class="el-icon-edit" aria-hidden="true"></i>
                    </button>
                  </div>
                  <div class="ab-device__meta">
                    <span class="nx-badge" :class="{ 'nx-badge--success': selectedDevice.online }">
                      <span class="nx-dot" :class="{ 'nx-dot--online': selectedDevice.online }" aria-hidden="true"></span>
                      {{ selectedDevice.online ? $t('addressBookManagement.online') : $t('addressBookManagement.offline') }}
                    </span>
                    <span class="ab-device__mac">
                      {{ $t('addressBookManagement.macAddress') }}
                      <MacAddressMask :macAddress="selectedDevice.deviceId" />
                    </span>
                  </div>
                </div>
              </div>

              <dl class="ab-facts">
                <div class="ab-fact">
                  <dt>{{ $t('addressBookManagement.deviceGroup') }}</dt>
                  <dd>
                    <input
                      v-if="isEditingAgentName"
                      v-model="editAgentNameValue"
                      class="ab-inline-input"
                      ref="agentNameInput"
                      :aria-label="$t('addressBookManagement.deviceGroup')"
                      @blur="handleAgentNameBlur"
                      @keyup.enter="handleAgentNameBlur"
                      autofocus
                    />
                    <span v-else class="ab-fact__edit">
                      <button type="button" class="ab-fact__value ab-fact__value--button nx-truncate"
                        :title="selectedAgent ? selectedAgent.agentName : ''" @click="handleStartEditAgentName">
                        {{ selectedAgent ? selectedAgent.agentName : '-' }}
                      </button>
                      <i v-if="selectedAgent" class="el-icon-edit ab-fact__icon" aria-hidden="true"></i>
                    </span>
                  </dd>
                </div>
                <div class="ab-fact">
                  <dt>{{ $t('addressBookManagement.addTime') }}</dt>
                  <dd class="ab-fact__value nx-num">{{ formatDeviceCreateDate(selectedDevice) }}</dd>
                </div>
                <div class="ab-fact">
                  <dt>{{ $t('addressBookManagement.lastOnline') }}</dt>
                  <dd class="ab-fact__value nx-num">{{ getTimeAgo(selectedDevice.lastConnectedAt) }}</dd>
                </div>
              </dl>
            </article>

            <article class="nx-card ab-perm">
              <header class="ab-perm__head">
                <div class="ab-perm__title">
                  <h2 class="nx-headline">{{ $t('addressBookManagement.deviceCallPermission') }}</h2>
                  <p class="nx-footnote">{{ $t('addressBookManagement.setPermissionDesc', { count: selectedPermissions.length }) }}</p>
                </div>
                <div class="ab-perm__actions">
                  <CustomButton size="small" :disabled="permissionsLoading || !allDevices.length" @click="handleToggleSelectAll">
                    {{ isAllSelected ? $t('addressBookManagement.deselectAll') : $t('addressBookManagement.selectAll') }}
                  </CustomButton>
                  <CustomButton size="small" :disabled="permissionsLoading" @click="handleCancel">{{ $t('common.cancel') }}</CustomButton>
                  <CustomButton type="confirm" size="small" :disabled="permissionsLoading" @click="handleSavePermissions">
                    {{ $t('addressBookManagement.save') }}
                  </CustomButton>
                </div>
              </header>

              <div v-if="!allDevices.length" class="nx-empty ab-empty-sm">
                <span class="nx-icon-tile nx-icon-tile--neutral" aria-hidden="true"><i class="el-icon-phone-outline"></i></span>
                <p class="nx-empty__text">{{ tx('addressBookManagement.noOtherRobots', 'Add another robot to let them call each other.') }}</p>
              </div>
              <div v-else v-loading="permissionsLoading" class="ab-grid">
                <div
                  v-for="device in allDevices"
                  :key="device.id"
                  class="ab-contact"
                  :class="{ 'is-active': selectedPermissions.includes(device.deviceId) }"
                >
                  <el-checkbox
                    class="ab-contact__check"
                    :disabled="permissionsLoading"
                    :value="selectedPermissions.includes(device.deviceId)"
                    @change="(checked) => handlePermissionToggle(device.deviceId, checked)"
                    :aria-label="device.addressBookAlias || device.name"
                  ></el-checkbox>
                  <span class="nx-avatar ab-avatar" aria-hidden="true">
                    <template v-if="avatarText(device)">{{ avatarText(device) }}</template>
                    <i v-else class="el-icon-cpu"></i>
                  </span>
                  <div class="ab-contact__text">
                    <div class="ab-contact__name-row">
                      <input
                        v-if="editingDeviceId === device.id"
                        v-model="editingDeviceName"
                        class="ab-inline-input permission-edit-input"
                        :aria-label="tx('addressBookManagement.contactName', 'Contact name')"
                        @blur="handleEditPermissionBlur(device)"
                        @keyup.enter="handleEditPermissionBlur(device)"
                        autofocus
                      />
                      <button v-else type="button" class="ab-contact__name nx-truncate" @click.stop="handleStartEditPermission(device)">
                        <MacAddressMask :macAddress="device.addressBookAlias || device.name" />
                      </button>
                      <button v-if="editingDeviceId !== device.id" type="button" class="nx-icon-btn ab-contact__edit"
                        :aria-label="$t('common.edit')" @click.stop="handleStartEditPermission(device)">
                        <i class="el-icon-edit" aria-hidden="true"></i>
                      </button>
                    </div>
                    <div class="ab-contact__mac"><MacAddressMask :macAddress="device.deviceId" /></div>
                    <div class="ab-contact__status" :class="{ 'is-online': device.online }">
                      <span class="nx-dot" :class="{ 'nx-dot--online': device.online }" aria-hidden="true"></span>
                      {{ device.online ? $t('addressBookManagement.online') : $t('addressBookManagement.offline') }}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </template>

          <div v-else class="nx-card">
            <div class="nx-empty">
              <span class="nx-icon-tile nx-icon-tile--lg nx-icon-tile--neutral" aria-hidden="true"><i class="el-icon-cpu"></i></span>
              <p class="nx-empty__text">{{ $t('addressBookManagement.selectDevice') }}</p>
            </div>
          </div>
        </section>
      </div>
    </main>

    <VersionFooter />
  </div>
</template>

<script>
import HeaderBar from "@/components/HeaderBar.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import Api from "@/apis/api.js";
import AddressBookApi from "@/apis/module/addressBook.js";
import MacAddressMask from "@/components/MacAddressMask.vue";
import CustomButton from "@/components/CustomButton.vue";
import { formatCreateDate, parseTimestamp } from '@/utils/deviceTime.mjs';

export default {
  name: "AddressBookManagement",
  components: { HeaderBar, VersionFooter, MacAddressMask, CustomButton },
  data() {
    return {
      searchKeyword: "",
      filteredAgents: [],
      selectedAgent: null,
      selectedDevice: null,
      expandedAgentId: null,
      agentDeviceOptions: [],
      allDevices: [],
      selectedPermissions: [],
      originalPermissions: [],
      isEditingAlias: false,
      editAliasValue: '',
      isEditingAgentName: false,
      editAgentNameValue: '',
      editingDeviceId: null,
      editingDeviceName: '',
      mqttServiceAvailable: false,
      permissionRequestSequence: 0,
      permissionsLoading: false,
      loadingAgents: true
    };
  },
  created() {
    this.fetchAgentList();
  },
  computed: {
    isAllSelected() {
      return this.allDevices.length > 0 && this.selectedPermissions.length === this.allDevices.length;
    },
    totalDevices() {
      return this.agentDeviceOptions.reduce((sum, agent) => sum + ((agent.devices && agent.devices.length) || 0), 0);
    },
    hasSelection() {
      return !!(this.selectedDevice && this.selectedDevice.id);
    }
  },
  methods: {
    // Pending i18n keys fall back to their English text until the lead merges them
    tx(key, fallback, params) {
      if (this.$te(key) || this.$te(key, 'en')) return this.$t(key, params);
      if (!params) return fallback;
      return fallback.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? params[name] : match));
    },
    // First letter of a real alias; robots still named by their id get the robot icon instead
    avatarText(device) {
      const alias = ((device && (device.addressBookAlias || device.alias)) || '').trim();
      return alias ? Array.from(alias)[0].toUpperCase() : '';
    },
    toggleAgent(agentId) {
      this.expandedAgentId = this.expandedAgentId === agentId ? null : agentId;
    },
    goHome() {
      this.$router.push('/home');
    },
    handleSearch() {
      const keyword = this.searchKeyword.toLowerCase().trim();
      if (!keyword) {
        this.filteredAgents = this.agentDeviceOptions;
        return;
      }
      // Filter: match agent name, device name, or MAC address
      this.filteredAgents = this.agentDeviceOptions.filter(agent => {
        // Match agent name
        if (agent.agentName.toLowerCase().includes(keyword)) {
          return true;
        }
        // Match device name or MAC address
        if (agent.devices && agent.devices.some(device => {
          const name = (device.name || '').toLowerCase();
          const mac = (device.deviceId || '').toLowerCase();
          return name.includes(keyword) || mac.includes(keyword);
        })) {
          return true;
        }
        return false;
      });
    },
    fetchAgentList() {
      Api.agent.getAgentList((res) => {
        const agentList = res.data?.data || [];
        if (agentList.length > 0) {
          const agentPromises = agentList.map(agent => {
            return new Promise((resolve) => {
              Api.device.getAgentBindDevices(agent.id, (deviceRes) => {
                const deviceList = deviceRes.data?.data || deviceRes.data || [];
                agent.devices = deviceList.map(device => ({
                  id: device.id,
                  name: (device.alias && device.alias.trim()) ? device.alias : device.id,
                  alias: device.alias || '',
                  addressBookAlias: '',  // Contact alias, initially empty
                  type: device.board,
                  deviceId: device.macAddress,
                  remarks: device.alias || '',
                  online: false,
                  createDate: device.createDate,
                  createDateTimestamp: device.createDateTimestamp,
                  lastConnectedAt: device.lastConnectedAtTimestamp,
                  deviceStatus: 'offline'
                }));
                resolve();
              });
            });
          });
          Promise.all(agentPromises).then(() => {
            this.loadingAgents = false;
            const firstDevice = agentList[0] || {};
            this.agentDeviceOptions = agentList;
            this.filteredAgents = agentList;
            // Default to select first item
            this.handleDeviceClick(firstDevice.devices?.[0] || {}, firstDevice);
            // Get device status
            this.fetchDeviceStatus();
          });
        } else {
          this.loadingAgents = false;
          this.agentDeviceOptions = [];
          this.filteredAgents = [];
        }
      });
    },
    fetchDeviceStatus() {
      // Get device status for each agent
      this.agentDeviceOptions.forEach(agent => {
        if (!agent.id) return;
        Api.device.getDeviceStatus(agent.id, (statusRes) => {
          if (statusRes.data?.code === 0) {
            try {
              const statusData = JSON.parse(statusRes.data.data);
              if (statusData && typeof statusData === 'object') {
                this.mqttServiceAvailable = true;
                this.updateDeviceStatusFromResponse(agent, statusData);
              }
            } catch (e) {
              console.error('Parse device status error:', e);
            }
          }
        });
      });
    },
    updateDeviceStatusFromResponse(agent, statusData) {
      if (!agent.devices) return;
      agent.devices.forEach(device => {
        const macAddress = device.deviceId ? device.deviceId.replace(/:/g, '_') : 'unknown';
        const groupId = device.type ? device.type.replace(/:/g, '_') : 'GID_default';
        const mqttClientId = `${groupId}@@@${macAddress}@@@${macAddress}`;

        if (statusData[mqttClientId]) {
          const statusInfo = statusData[mqttClientId];
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
          device.online = isOnline;
          device.deviceStatus = isOnline ? 'online' : 'offline';
        } else {
          device.online = false;
          device.deviceStatus = 'offline';
        }
      });
    },
    handleDeviceClick(device, agent) {
      this.expandedAgentId = agent.id;
      this.selectedAgent = agent;
      this.selectedDevice = device;
      // Load all devices for permission selection (exclude current device)
      this.allDevices = this.agentDeviceOptions
        .flatMap(agent => agent.devices || [])
        .filter(d => d.id !== device.id);
      // Load contact permissions
      this.loadAddressBookPermissions(device.deviceId);
    },
    loadAddressBookPermissions(macAddress) {
      const requestId = ++this.permissionRequestSequence;
      this.permissionsLoading = true;
      this.selectedPermissions = [];
      this.originalPermissions = [];
      this.editingDeviceId = null;
      this.editingDeviceName = '';
      this.allDevices.forEach(device => {
        device.addressBookAlias = '';
      });
      AddressBookApi.getAddressBookList(macAddress, (res) => {
        if (
          requestId !== this.permissionRequestSequence ||
          this.selectedDevice?.deviceId !== macAddress
        ) {
          return;
        }
        this.permissionsLoading = false;
        if (res.data?.code === 0) {
          const permissions = res.data.data || [];
          const permissionsByTargetMac = new Map(
            permissions.map(permission => [
              (permission.targetMac || '').toLowerCase(),
              permission
            ])
          );
          // Set selected permissions
          const permittedTargetMacs = new Set(
            permissions
              .filter(p => p.hasPermission)
              .map(p => (p.targetMac || '').toLowerCase())
          );
          this.selectedPermissions = this.allDevices
            .filter(device => permittedTargetMacs.has((device.deviceId || '').toLowerCase()))
            .map(device => device.deviceId);
          // Save initial permission status (for diff comparison)
          this.originalPermissions = [...this.selectedPermissions];
          // Update device contact alias
          this.allDevices.forEach(device => {
            const addrBook = permissionsByTargetMac.get((device.deviceId || '').toLowerCase());
            if (addrBook) {
              device.addressBookAlias = addrBook.alias || '';
            } else {
              device.addressBookAlias = '';
            }
          });
        }
      });
    },
    handleStartEditPermission(device) {
      if (this.permissionsLoading) return;
      this.editingDeviceId = device.id;
      this.editingDeviceName = device.addressBookAlias || device.name;
      this.$nextTick(() => {
        const input = document.querySelector('.permission-edit-input');
        if (input) input.focus();
      });
    },
    handleEditPermissionBlur(device) {
      if (!this.editingDeviceId) return;
      const newName = this.editingDeviceName.trim();
      if (newName && newName !== (device.addressBookAlias || device.name)) {
        AddressBookApi.updateAlias({
          macAddress: this.selectedDevice.deviceId,
          targetMac: device.deviceId,
          alias: newName
        }, (res) => {
          if (res.data?.code === 0) {
            this.$message.success(this.$t('addressBookManagement.aliasSaved'));
            this.loadAddressBookPermissions(this.selectedDevice.deviceId);
          } else {
            this.$message.error(res.data?.msg || this.$t('addressBookManagement.saveFailed'));
          }
        });
      }
      this.editingDeviceId = null;
      this.editingDeviceName = '';
    },
    handlePermissionToggle(targetMac, checked) {
      if (this.permissionsLoading) return;
      if (checked) {
        if (!this.selectedPermissions.includes(targetMac)) {
          this.selectedPermissions.push(targetMac);
        }
      } else {
        const index = this.selectedPermissions.indexOf(targetMac);
        if (index > -1) {
          this.selectedPermissions.splice(index, 1);
        }
      }
    },
    handleToggleSelectAll() {
      if (this.isAllSelected) {
        this.selectedPermissions = [];
      } else {
        this.selectedPermissions = this.allDevices.map(d => d.deviceId);
      }
    },
    handleCancel() {
      this.selectedPermissions = [];
    },
    handleSavePermissions() {
      if (this.permissionsLoading) return;
      const promises = this.allDevices
        .filter(device => {
          const isNowSelected = this.selectedPermissions.includes(device.deviceId);
          const wasOriginallySelected = this.originalPermissions.includes(device.deviceId);
          return isNowSelected !== wasOriginallySelected;
        })
        .map(device => {
          const hasPermission = this.selectedPermissions.includes(device.deviceId);
          return new Promise((resolve) => {
            AddressBookApi.updatePermission({
              macAddress: this.selectedDevice.deviceId,
              targetMac: device.deviceId,
              hasPermission: hasPermission
            }, (res) => {
              resolve(res.data?.code === 0);
            });
          });
        });
      Promise.all(promises).then((results) => {
        if (promises.length === 0) {
          this.$message.info(this.$t('addressBookManagement.noChanges'));
        } else if (results.every(r => r)) {
          this.$message.success(this.$t('addressBookManagement.permissionSaved'));
          this.originalPermissions = [...this.selectedPermissions];
          this.loadAddressBookPermissions(this.selectedDevice.deviceId);
        } else {
          this.$message.error(this.$t('addressBookManagement.partialSaveFailed'));
        }
      });
    },
    handleStartEdit() {
      this.isEditingAlias = true;
      this.editAliasValue = this.selectedDevice.name;
      this.$nextTick(() => {
        if (this.$refs.aliasInput) {
          this.$refs.aliasInput.focus();
        }
      });
    },
    handleAliasBlur() {
      if (!this.selectedDevice) return;
      const newAlias = this.editAliasValue.trim();
      if (newAlias) {
        Api.device.updateDeviceInfo(this.selectedDevice.id, { alias: newAlias }, ({ data }) => {
          if (data.code === 0) {
            this.selectedDevice.name = newAlias;
            for (const agent of this.agentDeviceOptions) {
              const device = agent.devices?.find(d => d.id === this.selectedDevice.id);
              if (device) {
                device.name = newAlias;
                device.alias = newAlias;
                break;
              }
            }
            this.$message.success(this.$t('addressBookManagement.aliasSaved'));
          } else {
            this.$message.error(data.msg || this.$t('addressBookManagement.saveFailed'));
          }
        });
      }
      this.isEditingAlias = false;
    },
    handleStartEditAgentName() {
      if (!this.selectedAgent) return;
      this.isEditingAgentName = true;
      this.editAgentNameValue = this.selectedAgent.agentName;
      this.$nextTick(() => {
        if (this.$refs.agentNameInput) {
          this.$refs.agentNameInput.focus();
        }
      });
    },
    handleAgentNameBlur() {
      if (!this.selectedAgent) return;
      if (this.editAgentNameValue.trim() && this.editAgentNameValue.trim() !== this.selectedAgent.agentName) {
        const newName = this.editAgentNameValue.trim();
        Api.agent.updateAgentConfig(this.selectedAgent.id, { agentName: newName }, ({ data }) => {
          if (data.code === 0) {
            this.selectedAgent.agentName = newName;
            // Update agent name in list
            const agentInList = this.agentDeviceOptions.find(a => a.id === this.selectedAgent.id);
            if (agentInList) {
              agentInList.agentName = newName;
            }
            this.$message.success(this.$t('addressBookManagement.agentNameUpdated'));
          } else {
            this.$message.error(data.msg || this.$t('addressBookManagement.updateFailed'));
          }
        });
      }
      this.isEditingAgentName = false;
    },
    getTimeAgo(timestamp) {
      const ts = parseTimestamp(timestamp);
      if (ts === null) return '-';
      const now = new Date();
      const date = new Date(ts);
      const diff = now - date;

      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const months = Math.floor(days / 30);
      const years = Math.floor(days / 365);

      if (seconds < 60) return this.$t('addressBookManagement.justNow');
      if (minutes < 60) return this.$t('addressBookManagement.minutesAgo', { minutes });
      if (hours < 24) return this.$t('addressBookManagement.hoursAgo', { hours });
      if (days < 30) return this.$t('addressBookManagement.daysAgo', { days });
      if (months < 12) return this.$t('addressBookManagement.monthsAgo', { months });
      return this.$t('addressBookManagement.yearsAgo', { years });
    },
    formatDeviceCreateDate(device) {
      if (!device) return '-';
      return formatCreateDate(device.createDateTimestamp, device.createDate);
    }
  },
};
</script>


<style lang="scss" scoped>
.nx-ab {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--nx-bg);

  > .nx-page {
    flex: 1 0 auto;
  }
}

.ab-search {
  width: 280px;
}

.ab-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: var(--nx-space-5);
  align-items: start;
}

.ab-empty-sm {
  padding: var(--nx-space-6) var(--nx-space-4);
}

// ------------------------------------------------------------------ robot list

.ab-robots {
  position: sticky;
  top: calc(var(--nx-topbar-h) + var(--nx-space-5));
  max-height: calc(100vh - var(--nx-topbar-h) - 2 * var(--nx-space-5));
  overflow-y: auto;
  padding: var(--nx-space-2);

  &--skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-3);
    padding: var(--nx-space-4);
  }
}

.ab-agent {
  & + & {
    margin-top: 2px;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    width: 100%;
    min-height: 40px;
    padding: 0 var(--nx-space-3);
    border: 0;
    border-radius: var(--nx-radius);
    background: transparent;
    color: var(--nx-text);
    font: inherit;
    font-size: var(--nx-text-callout);
    font-weight: 600;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--nx-surface-2);
    }
  }
  &__chevron {
    flex: none;
    color: var(--nx-text-3);
    transition: transform var(--nx-dur-2) var(--nx-ease);
    &.is-open {
      transform: rotate(90deg);
    }
  }
  &__name {
    flex: 1;
  }
  &__list {
    margin: 0 0 var(--nx-space-2);
    padding: 0;
    list-style: none;
  }
  &__none {
    padding: var(--nx-space-2) var(--nx-space-3) var(--nx-space-2) 36px;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-3);
  }
}

.ab-count {
  min-width: 22px;
  padding: 1px 7px;
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface-2);
  color: var(--nx-text-2);
  font-size: var(--nx-text-caption);
  font-weight: 600;
  text-align: center;
}

.ab-avatar {
  font-size: var(--nx-text-callout);
}

.ab-robot {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  width: 100%;
  min-height: 52px;
  padding: var(--nx-space-2) var(--nx-space-3) var(--nx-space-2) var(--nx-space-6);
  border: 0;
  border-radius: var(--nx-radius);
  background: transparent;
  color: var(--nx-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--nx-dur-1) var(--nx-ease);

  &:hover {
    background: var(--nx-surface-2);
  }
  &.is-active {
    background: var(--nx-accent-soft);
    .ab-robot__name {
      color: var(--nx-accent);
    }
  }
  &__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  &__name {
    font-size: var(--nx-text-callout);
    font-weight: 600;
  }
  &__meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
}

// ------------------------------------------------------------------ detail

.ab-detail {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-5);
  min-width: 0;
}

.ab-device {
  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-4);
    min-width: 0;
  }
  &__avatar {
    font-weight: 700;
  }
  &__text {
    flex: 1;
    min-width: 0;
  }
  &__name-row {
    display: flex;
    align-items: center;
    gap: var(--nx-space-1);
    min-width: 0;
  }
  &__name {
    max-width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--nx-text);
    font: inherit;
    font-size: var(--nx-text-title);
    font-weight: 700;
    letter-spacing: -0.018em;
    text-align: left;
    cursor: text;
  }
  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--nx-space-2) var(--nx-space-4);
    margin-top: var(--nx-space-2);
  }
  &__mac {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
}

.ab-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--nx-space-3);
  margin: var(--nx-space-5) 0 0;
}
.ab-fact {
  min-width: 0;
  padding: var(--nx-space-3) var(--nx-space-4);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);

  dt {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  dd {
    margin: var(--nx-space-1) 0 0;
    min-width: 0;
  }
  &__value {
    display: block;
    font-size: var(--nx-text-body);
    font-weight: 600;
    color: var(--nx-text);
  }
  &__value--button {
    max-width: 100%;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-weight: 600;
    text-align: left;
    cursor: text;
    &:hover {
      color: var(--nx-accent);
    }
  }
  &__edit {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    min-width: 0;
  }
  &__icon {
    flex: none;
    color: var(--nx-text-3);
  }
}

.ab-inline-input {
  width: 100%;
  max-width: 320px;
  height: var(--nx-control-h);
  padding: 0 var(--nx-space-3);
  border: 1px solid var(--nx-accent);
  border-radius: var(--nx-radius-sm);
  background: var(--nx-surface);
  color: var(--nx-text);
  font: inherit;
  font-size: var(--nx-text-callout);
  box-shadow: var(--nx-focus-ring);
  outline: none;

  &--title {
    height: var(--nx-control-h-lg);
    font-size: var(--nx-text-headline);
    font-weight: 600;
  }
}

// ------------------------------------------------------------------ permissions

.ab-perm {
  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--nx-space-3);
    margin-bottom: var(--nx-space-4);
  }
  &__title {
    min-width: 0;
    flex: 1 1 260px;
    p {
      margin: var(--nx-space-1) 0 0;
    }
  }
  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nx-space-2);
    .el-button + .el-button {
      margin-left: 0;
    }
  }
}

.ab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--nx-space-3);
  min-height: 80px;
}

.ab-contact {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--nx-space-3);
  min-width: 0;
  padding: var(--nx-space-3) var(--nx-space-3) var(--nx-space-3) var(--nx-space-4);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius);
  background: var(--nx-surface);
  transition: border-color var(--nx-dur-2) var(--nx-ease), background-color var(--nx-dur-2) var(--nx-ease);

  &.is-active {
    border-color: var(--nx-accent);
    background: var(--nx-accent-soft);
  }
  &__check {
    order: 3;
    margin-top: 2px;
  }
  &__text {
    flex: 1;
    min-width: 0;
  }
  &__name-row {
    display: flex;
    align-items: center;
    gap: var(--nx-space-1);
    min-width: 0;
  }
  &__name {
    max-width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--nx-text);
    font: inherit;
    font-size: var(--nx-text-callout);
    font-weight: 600;
    text-align: left;
    cursor: text;
  }
  &__edit {
    flex: none;
    width: 28px;
    height: 28px;
    font-size: var(--nx-text-callout);
  }
  &__mac {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-2);
  }
  &__status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
    &.is-online {
      color: var(--nx-success);
    }
  }
}

// ------------------------------------------------------------------ skeleton

.ab-sk-row {
  height: 16px;
  width: 85%;
}
.ab-sk-title {
  height: 24px;
  width: 40%;
}
.ab-sk-detail {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-4);
}

// ------------------------------------------------------------------ responsive

@media (max-width: 960px) {
  .ab-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .ab-robots {
    position: static;
    max-height: 360px;
  }
  .ab-search {
    width: 100%;
    flex: 1 1 100%;
  }
}

@media (max-width: 560px) {
  .ab-device__head {
    align-items: flex-start;
  }
  .ab-device__name {
    font-size: var(--nx-text-headline);
  }
  .ab-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ab-agent__chevron {
    transition: none;
  }
}
</style>
