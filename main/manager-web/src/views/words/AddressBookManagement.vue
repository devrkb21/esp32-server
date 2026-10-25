<template>
  <div class="ab">
    <TbPageHeader :title="$t('nav.addressBook')" :description="$t('abook.desc')" />

    <div v-if="loadingAgents" class="ab__state" aria-busy="true"><TbLoading :label="$t('abook.loading')" show-label /></div>

    <TbEmpty v-else-if="agentsFailed" face="confused" :title="$t('abook.loadFailed')">
      <TbButton icon="refresh" @click="fetchAgentList">{{ $t('common.retry') }}</TbButton>
    </TbEmpty>

    <TbEmpty v-else-if="!totalDevices" face="sleepy" :title="$t('abook.emptyTitle')" :text="$t('abook.emptyText')">
      <TbButton variant="primary" icon="robots" to="/robots">{{ $t('abook.goRobots') }}</TbButton>
    </TbEmpty>

    <div v-else class="ab__layout">
      <aside class="ab__side" :aria-label="$t('abook.robots')">
        <div class="ab__search">
          <TbInput v-model="searchKeyword" icon="search" clearable :placeholder="$t('abook.searchPlaceholder')"
            :aria-label="$t('abook.searchLabel')" :clear-label="$t('abook.clearSearch')" />
        </div>
        <p v-if="!filteredAgents.length" class="ab__nomatch">{{ $t('abook.noMatch') }}</p>
        <div v-for="agent in filteredAgents" :key="agent.id" class="ab__agent">
          <button type="button" class="ab__agenthead" :aria-expanded="isOpen(agent) ? 'true' : 'false'" @click="toggleAgent(agent.id)">
            <TbIcon name="chevron-right" :size="16" class="ab__chev" :class="{ 'is-open': isOpen(agent) }" />
            <span class="ab__agentname">{{ agent.agentName }}</span>
            <span class="ab__agentcount tb-num">{{ num((agent.devices && agent.devices.length) || agent.deviceCount || 0) }}</span>
          </button>
          <ul v-if="isOpen(agent)" class="ab__robots">
            <li v-if="!agent.devices || !agent.devices.length" class="ab__none">{{ $t('abook.agentNoRobots') }}</li>
            <li v-for="device in agent.devices" :key="agent.id + '/' + device.id">
              <button type="button" class="ab__robot" :class="{ 'is-active': isSelected(device, agent) }"
                :aria-current="isSelected(device, agent) ? 'true' : null" @click="handleDeviceClick(device, agent)">
                <span class="ab__initial" aria-hidden="true">
                  <template v-if="initial(device)">{{ initial(device) }}</template><TbIcon v-else name="robot" :size="16" />
                </span>
                <span class="ab__robottext">
                  <span class="ab__robotname">{{ device.name }}</span>
                  <span class="ab__state-word" :class="`is-${device.status}`">{{ statusText(device) }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </aside>

      <section class="ab__detail" :aria-label="$t('abook.detailLabel')">
        <TbEmpty v-if="!hasSelection" face="awake" :title="$t('abook.selectDevice')" />

        <template v-else>
          <header class="ab__head">
            <div class="ab__title">
              <InlineName size="l" :value="selectedDevice.name" :maxlength="aliasMax" :label="$t('abook.robotName')"
                :edit-label="$t('abook.renameRobot')" :cancel-label="$t('common.cancel')" @save="saveAlias" />
              <TbTag :ink="selectedDevice.status === 'online' ? 'ok' : 'ink-2'" mark>{{ statusText(selectedDevice) }}</TbTag>
            </div>
            <dl class="ab__facts">
              <div>
                <dt>{{ $t('abook.mac') }}</dt>
                <dd><MacMask :mac="selectedDevice.deviceId || ''" :show-label="$t('abook.showMac')" :hide-label="$t('abook.hideMac')"
                  :hidden-label="$t('abook.macHidden')" /></dd>
              </div>
              <div>
                <dt>{{ $t('abook.character') }}</dt>
                <dd><InlineName v-if="selectedAgent" :value="selectedAgent.agentName" :label="$t('abook.character')"
                  :edit-label="$t('abook.renameCharacter')" :cancel-label="$t('common.cancel')" @save="saveAgentName" /></dd>
              </div>
              <div>
                <dt>{{ $t('abook.added') }}</dt>
                <dd class="tb-num">{{ addedText(selectedDevice) }}</dd>
              </div>
              <div>
                <dt>{{ $t('abook.lastOnline') }}</dt>
                <dd class="tb-num">{{ agoText(selectedDevice.lastConnectedAt) }}</dd>
              </div>
            </dl>
          </header>

          <TbSection :title="$t('abook.mayCall', { name: selectedDevice.name })"
            :description="$t('abook.mayCallDesc', { n: num(selectedPermissions.length), total: num(allDevices.length) })">
            <template #actions>
              <span v-if="dirty" class="ab__unsaved">{{ $t('common.unsaved') }}</span>
              <TbButton size="s" :disabled="permissionsLoading || !allDevices.length" @click="handleToggleSelectAll">
                {{ isAllSelected ? $t('abook.deselectAll') : $t('abook.selectAll') }}
              </TbButton>
              <TbButton size="s" variant="quiet" icon="refresh" :disabled="permissionsLoading || !dirty" @click="handleCancel">
                {{ $t('abook.undo') }}
              </TbButton>
              <TbButton size="s" variant="primary" :disabled="permissionsLoading || permFailed" :loading="savingPerms" @click="handleSavePermissions">
                {{ $t('abook.save') }}
              </TbButton>
            </template>

            <TbEmpty v-if="!allDevices.length" :title="$t('abook.noOtherTitle')" :text="$t('abook.noOtherRobots')" />
            <TbEmpty v-else-if="permFailed && !permissionsLoading" face="confused" :title="$t('abook.permFailed')">
              <TbButton icon="refresh" @click="loadAddressBookPermissions(selectedDevice.deviceId)">{{ $t('common.retry') }}</TbButton>
            </TbEmpty>
            <TbTable v-else class="ab__contacts" dense selectable row-key="deviceId" :selected="selectedPermissions"
              :columns="columns" :rows="allDevices" :loading="permissionsLoading" :caption="$t('abook.mayCall', { name: selectedDevice.name })"
              :loading-text="$t('common.loading')" :select-all-label="$t('abook.selectAll')" :select-row-label="$t('abook.allowCall')"
              @update:selected="setPermissions">
              <template #cell-contact="{ row }">
                <span class="ab__contact">
                  <span class="ab__initial" aria-hidden="true">
                    <template v-if="initial(row, aliases[row.deviceId])">{{ initial(row, aliases[row.deviceId]) }}</template><TbIcon v-else name="robot" :size="16" />
                  </span>
                  <span class="ab__contacttext">
                    <InlineName :value="aliases[row.deviceId] || row.name" :label="$t('abook.contactName')" :disabled="permissionsLoading"
                      :edit-label="$t('abook.renameContact')" :cancel-label="$t('common.cancel')" @save="saveContactAlias(row, $event)" />
                    <small v-if="aliases[row.deviceId] && aliases[row.deviceId] !== row.name">{{ $t('abook.robotCalled', { name: row.name }) }}</small>
                  </span>
                </span>
              </template>
              <template #cell-mac="{ row }">
                <MacMask :mac="row.deviceId || ''" :show-label="$t('abook.showMac')" :hide-label="$t('abook.hideMac')" :hidden-label="$t('abook.macHidden')" />
              </template>
              <template #cell-status="{ row }">
                <span class="ab__state-word" :class="`is-${row.status}`">{{ statusText(row) }}</span>
              </template>
              <template #cell-allowed="{ row }">
                <span class="ab__allowed" :class="{ 'is-on': selectedPermissions.includes(row.deviceId) }">
                  {{ selectedPermissions.includes(row.deviceId) ? $t('abook.canCall') : $t('abook.cannotCall') }}
                </span>
              </template>
            </TbTable>
          </TbSection>
        </template>
      </section>
    </div>
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import MacMask from '@/views/devices/MacMask.vue';
import InlineName from './InlineName.vue';
import {
  ALIAS_MAX, addedDate, agoParts, applyStatus, contactsFor, filterAgents, initialOf, parseStatus, permissionChanges,
  readPermissions, toRobot,
} from './addressBookModel';

// Address book, back office: which robots may call which (robot-to-robot calls). Legacy
// behaviour kept: robots of every character with their online state from the gateway; the
// first robot is chosen on load; rename a robot, its character and each contact in place;
// permissions keyed by the target robot's MAC, saved one changed contact at a time, with a
// late answer for an earlier robot ignored.
export default {
  name: 'AddressBookManagement',
  components: { InlineName, MacMask },
  data() {
    return {
      searchKeyword: '',
      agentDeviceOptions: [],
      selectedAgent: null,
      selectedDevice: null,
      expandedAgentId: null,
      allDevices: [],
      aliases: {},
      selectedPermissions: [],
      originalPermissions: [],
      mqttServiceAvailable: false,
      permissionRequestSequence: 0,
      permissionsLoading: false,
      permFailed: false,
      savingPerms: false,
      loadingAgents: true,
      agentsFailed: false,
      aliasMax: ALIAS_MAX,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    filteredAgents() { return filterAgents(this.agentDeviceOptions, this.searchKeyword); },
    isAllSelected() { return this.allDevices.length > 0 && this.selectedPermissions.length === this.allDevices.length; },
    totalDevices() { return this.agentDeviceOptions.reduce((sum, a) => sum + ((a.devices && a.devices.length) || 0), 0); },
    hasSelection() { return !!(this.selectedDevice && this.selectedDevice.id); },
    dirty() { return permissionChanges(this.allDevices, this.selectedPermissions, this.originalPermissions).length > 0; },
    columns() {
      return [
        { key: 'contact', label: this.$t('abook.col.contact') },
        { key: 'mac', label: this.$t('abook.col.mac') },
        { key: 'status', label: this.$t('abook.col.status') },
        { key: 'allowed', label: this.$t('abook.col.allowed') },
      ];
    },
  },
  created() { this.fetchAgentList(); },
  methods: {
    num(v) { return digits(v, this.lang); },
    initial(device, alias) { return initialOf(device, alias); },
    isOpen(agent) { return this.expandedAgentId === agent.id || !!this.searchKeyword.trim(); },
    isSelected(device, agent) {
      return !!(this.selectedDevice && this.selectedDevice.id === device.id && this.selectedAgent && this.selectedAgent.id === agent.id);
    },
    toggleAgent(id) { this.expandedAgentId = this.expandedAgentId === id ? null : id; },
    statusText(device) { return this.$t(`abook.status.${device.status || 'unknown'}`); },
    addedText(device) {
      const d = addedDate(device);
      if (!d) return '–';
      return new Intl.DateTimeFormat(this.lang === 'bn' ? 'bn-BD' : this.lang.replace('_', '-'), { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    },
    agoText(ts) {
      const p = agoParts(ts);
      if (!p) return '–';
      return this.$t(`abook.ago.${p.key}`, { n: this.num(p.n) });
    },

    fetchAgentList() {
      this.loadingAgents = true;
      this.agentsFailed = false;
      Api.agent.getAgentList((res) => {
        const body = (res && res.data) || {};
        if (body.code !== undefined && body.code !== 0) {
          this.loadingAgents = false;
          this.agentsFailed = true;
          return;
        }
        const agentList = body.data || [];
        if (!agentList.length) {
          this.loadingAgents = false;
          this.agentDeviceOptions = [];
          return;
        }
        const loads = agentList.map((agent) => new Promise((resolve) => {
          const take = (deviceRes) => {
            const list = (deviceRes && deviceRes.data && (deviceRes.data.data || deviceRes.data)) || [];
            agent.devices = (Array.isArray(list) ? list : []).map(toRobot);
            resolve();
          };
          Api.device.getAgentBindDevices(agent.id, take, () => { agent.devices = []; resolve(); });
        }));
        Promise.all(loads).then(() => {
          this.loadingAgents = false;
          this.agentDeviceOptions = agentList;
          // choose the first robot, as the legacy page did
          const first = agentList.find((a) => a.devices && a.devices.length);
          if (first) this.handleDeviceClick(first.devices[0], first);
          this.fetchDeviceStatus();
        });
      });
    },
    fetchDeviceStatus() {
      this.agentDeviceOptions.forEach((agent) => {
        if (!agent.id) return;
        Api.device.getDeviceStatus(agent.id, (statusRes) => {
          const map = parseStatus(statusRes && statusRes.data);
          if (!map) return;
          this.mqttServiceAvailable = true;
          applyStatus(agent.devices, map);
        });
      });
    },

    handleDeviceClick(device, agent) {
      this.expandedAgentId = agent.id;
      this.selectedAgent = agent;
      this.selectedDevice = device;
      // every other robot may be a contact (once per MAC address)
      this.allDevices = contactsFor(this.agentDeviceOptions, device.id);
      this.loadAddressBookPermissions(device.deviceId);
    },
    loadAddressBookPermissions(macAddress) {
      const requestId = ++this.permissionRequestSequence;
      this.permissionsLoading = true;
      this.selectedPermissions = [];
      this.originalPermissions = [];
      this.permFailed = false;
      this.aliases = {};
      Api.addressBook.getAddressBookList(macAddress, (res) => {
        // a late answer for a robot that is no longer chosen is ignored
        if (requestId !== this.permissionRequestSequence || this.selectedDevice?.deviceId !== macAddress) return;
        this.permissionsLoading = false;
        const body = (res && res.data) || {};
        if (body.code === 0) {
          const { selected, aliases } = readPermissions(body.data || [], this.allDevices);
          this.selectedPermissions = selected;
          this.originalPermissions = [...selected];
          this.aliases = aliases;
        } else {
          this.permFailed = true;
        }
      });
    },
    setPermissions(list) {
      if (this.permissionsLoading) return;
      this.selectedPermissions = this.allDevices.map((d) => d.deviceId).filter((mac) => list.includes(mac));
    },
    handlePermissionToggle(targetMac, checked) {
      if (this.permissionsLoading) return;
      if (checked && !this.selectedPermissions.includes(targetMac)) this.selectedPermissions.push(targetMac);
      if (!checked) this.selectedPermissions = this.selectedPermissions.filter((m) => m !== targetMac);
    },
    handleToggleSelectAll() {
      if (this.permissionsLoading) return;
      this.selectedPermissions = this.isAllSelected ? [] : this.allDevices.map((d) => d.deviceId);
    },
    handleCancel() {
      // back to what is saved for this robot
      this.selectedPermissions = [...this.originalPermissions];
    },
    handleSavePermissions() {
      if (this.permissionsLoading) return;
      const changes = permissionChanges(this.allDevices, this.selectedPermissions, this.originalPermissions);
      if (!changes.length) {
        this.$message.info(this.$t('abook.noChanges'));
        return;
      }
      const mac = this.selectedDevice.deviceId;
      this.savingPerms = true;
      const saves = changes.map((c) => new Promise((resolve) => {
        Api.addressBook.updatePermission({ macAddress: mac, targetMac: c.targetMac, hasPermission: c.hasPermission },
          (res) => resolve(!!(res && res.data && res.data.code === 0)));
      }));
      Promise.all(saves).then((results) => {
        this.savingPerms = false;
        if (results.every(Boolean)) {
          this.$message.success(this.$t('abook.permissionSaved'));
          this.originalPermissions = [...this.selectedPermissions];
          if (this.selectedDevice && this.selectedDevice.deviceId === mac) this.loadAddressBookPermissions(mac);
        } else {
          this.$message.error(this.$t('abook.partialSaveFailed'));
        }
      });
    },

    saveContactAlias(device, alias) {
      if (this.permissionsLoading) return;
      Api.addressBook.updateAlias({ macAddress: this.selectedDevice.deviceId, targetMac: device.deviceId, alias }, (res) => {
        const body = (res && res.data) || {};
        if (body.code === 0) {
          this.$message.success(this.$t('abook.aliasSaved'));
          this.loadAddressBookPermissions(this.selectedDevice.deviceId);
        } else {
          this.$message.error(body.msg || this.$t('abook.saveFailed'));
        }
      });
    },
    saveAlias(alias) {
      const device = this.selectedDevice;
      if (!device) return;
      Api.device.updateDeviceInfo(device.id, { alias }, (res) => {
        const body = (res && res.data) || {};
        if (body.code === 0) {
          for (const agent of this.agentDeviceOptions) {
            for (const d of agent.devices || []) {
              if (d.id === device.id) { d.name = alias; d.alias = alias; }
            }
          }
          device.name = alias;
          device.alias = alias;
          this.$message.success(this.$t('abook.aliasSaved'));
        } else {
          this.$message.error(body.msg || this.$t('abook.saveFailed'));
        }
      }, (res) => {
        this.$message.error((res && res.data && res.data.msg) || this.$t('abook.saveFailed'));
      });
    },
    saveAgentName(name) {
      const agent = this.selectedAgent;
      if (!agent || name === agent.agentName) return;
      Api.agent.updateAgentConfig(agent.id, { agentName: name }, (res) => {
        const body = (res && res.data) || {};
        if (body.code === 0) {
          agent.agentName = name;
          this.$message.success(this.$t('abook.agentNameUpdated'));
        } else {
          this.$message.error(body.msg || this.$t('abook.updateFailed'));
        }
      });
    },
  },
};
</script>

<style>
.ab { padding-bottom: var(--tb-s8); }
.ab__state { display: grid; place-items: center; padding: var(--tb-s12) 0; }
.ab__layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 0 var(--tb-s8); align-items: start; padding-top: var(--tb-s4); }

/* the robots, by character */
.ab__side { position: sticky; top: var(--tb-s4); max-height: calc(100vh - 2 * var(--tb-s4)); overflow-y: auto; padding-bottom: var(--tb-s4); }
.ab__search { padding-bottom: var(--tb-s3); }
.ab__nomatch { padding: var(--tb-s4) 0; color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.ab__agent { border-top: 1px solid var(--tb-rule); }
.ab__agent:last-child { border-bottom: 1px solid var(--tb-rule); }
.ab__agenthead {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: var(--tb-target); padding: 0 4px;
  border: 0; background: none; text-align: left; font-weight: 700; font-family: var(--tb-font-display);
}
.ab__chev { flex: none; color: var(--tb-ink-2); transition: transform var(--tb-t-fast) var(--tb-ease); }
.ab__chev.is-open { transform: rotate(90deg); }
.ab__agentname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ab__agentcount { font-size: var(--tb-fs-13); color: var(--tb-ink-2); font-weight: 600; font-family: var(--tb-font-text); }
.ab__robots { margin: 0 0 var(--tb-s2); padding: 0; list-style: none; }
.ab__none { padding: 6px 4px 10px 28px; font-size: var(--tb-fs-13); color: var(--tb-ink-3); }
.ab__robot {
  position: relative; display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 6px 8px 6px 24px;
  border: 0; border-top: 1px solid var(--tb-rule-soft); background: none; text-align: left;
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
@media (hover: hover) and (pointer: fine) { .ab__robot:hover { background: var(--tb-paper-2); } }
.ab__robot.is-active { background: var(--tb-paper-2); }
.ab__robot.is-active::before { content: ''; position: absolute; left: 8px; top: 50%; width: 8px; height: 8px; margin-top: -4px; background: var(--tb-orange); }
.ab__robot.is-active .ab__robotname { color: var(--tb-action); }
.ab__initial {
  flex: none; display: grid; place-items: center; width: 30px; height: 30px; border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-s); font: 700 var(--tb-fs-14)/1 var(--tb-font-display); color: var(--tb-ink);
}
.ab__robottext { display: grid; min-width: 0; }
.ab__robotname { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ab__state-word { display: inline-flex; align-items: center; gap: 6px; font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
.ab__state-word::before { content: ''; width: 7px; height: 7px; border: 1.5px solid currentColor; }
.ab__state-word.is-online { color: var(--tb-ok); }
.ab__state-word.is-online::before { background: currentColor; }
.ab__state-word.is-unknown::before { border-style: dashed; }

/* the chosen robot */
.ab__detail { min-width: 0; }
.ab__head { padding: var(--tb-s2) 0 var(--tb-s4); border-bottom: 1px solid var(--tb-rule); }
.ab__title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-width: 0; }
.ab__title .inl { max-width: 100%; }
.ab__facts { display: grid; grid-template-columns: repeat(4, minmax(0, auto)); justify-content: start; gap: 4px var(--tb-s8); margin: var(--tb-s4) 0 0; }
.ab__facts > div { min-width: 0; }
.ab__facts dt { font-size: var(--tb-fs-12); color: var(--tb-ink-2); font-weight: 600; }
.ab__facts dd { margin: 2px 0 0; min-height: 32px; display: flex; align-items: center; font-size: var(--tb-fs-14); }
.ab__unsaved { align-self: center; font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-warn); }

.ab__contact { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ab__contacttext { display: grid; min-width: 0; }
.ab__contacttext small { font-size: var(--tb-fs-12); color: var(--tb-ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ab__allowed { font-size: var(--tb-fs-13); color: var(--tb-ink-3); }
.ab__allowed.is-on { color: var(--tb-ink); font-weight: 600; }
.ab__contacts tbody tr { transition: background-color var(--tb-t-hover) var(--tb-ease); }

@media (max-width: 960px) {
  .ab__layout { grid-template-columns: minmax(0, 1fr); }
  .ab__side { position: static; max-height: 380px; margin-bottom: var(--tb-s4); }
  .ab__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .ab__contacts td[data-label] { align-items: center; }
  .ab__facts dd { min-height: var(--tb-target); }
}
</style>
