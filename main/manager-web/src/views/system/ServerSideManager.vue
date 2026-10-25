<template>
  <div class="srv">
    <TbPageHeader :title="$t('system.server.title')" :description="$t('system.server.desc')">
      <template #actions>
        <TbButton icon="refresh" :loading="loading" @click="fetchServers">{{ $t('system.refresh') }}</TbButton>
      </template>
    </TbPageHeader>

    <div class="srv__head">
      <h2 class="srv__h">{{ $t('system.server.listTitle') }}</h2>
      <span v-if="!loading || servers.length" class="srv__count tb-num">{{ $t('system.server.count', { n: num(servers.length) }) }}</span>
    </div>

    <TbTable class="srv__table" dense :columns="columns" :rows="servers" row-key="address" :loading="loading && !servers.length"
      :caption="$t('system.server.listTitle')" :loading-text="$t('system.server.loading')">
      <template #cell-address="{ row }">
        <span class="srv__addr">
          <TbIcon name="server" :size="18" class="srv__icon" />
          <span class="srv__url">{{ row.address }}</span>
          <TbButton size="s" variant="quiet" icon="copy" :aria-label="$t('system.server.copyAddress', { address: row.address })"
            @click="copyAddress(row.address)" />
        </span>
      </template>
      <template #cell-actions="{ row }">
        <span class="sys-acts srv__acts">
          <TbButton size="s" icon="settings" :loading="busy === `${row.address}:update_config`" :disabled="!!busy"
            @click="emitAction(row, 'update_config')">{{ $t('system.server.updateConfig') }}</TbButton>
          <TbButton size="s" variant="danger" icon="refresh" :loading="busy === `${row.address}:restart`" :disabled="!!busy"
            @click="emitAction(row, 'restart')">{{ $t('system.server.restart') }}</TbButton>
        </span>
      </template>
      <template #empty>
        <TbEmpty v-if="failed" face="confused" :title="$t('system.server.loadFailed')" :text="$t('system.loadFailedText')">
          <TbButton icon="refresh" @click="fetchServers">{{ $t('common.retry') }}</TbButton>
        </TbEmpty>
        <TbEmpty v-else face="sleepy" :title="$t('system.server.emptyTitle')" :text="$t('system.server.emptyText')">
          <TbButton icon="refresh" @click="fetchServers">{{ $t('system.refresh') }}</TbButton>
        </TbEmpty>
      </template>
    </TbTable>

    <p v-if="failed && servers.length" class="sys-fail" role="alert">{{ $t('system.server.loadFailed') }}
      <TbButton size="s" variant="quiet" icon="refresh" @click="fetchServers">{{ $t('common.retry') }}</TbButton></p>
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { callWithTimeout } from './systemModel';
import './system.css';

// Server (back office, super admins; owner: web-system). Behaviour of the legacy
// ServerSideManager.vue: the WebSocket servers registered with the console, each with copy,
// update config and restart; both actions are confirmed first.
// API: admin.getWsServerList, admin.sendWsServerAction({ targetWs, action }).
const SLOW_MS = 15000;

export default {
  name: 'ServerSideManager',
  data() {
    return { servers: [], loading: false, failed: false, busy: '', seq: 0 };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    columns() {
      return [
        { key: 'address', label: this.$t('system.server.address') },
        { key: 'actions', label: this.$t('system.actions'), align: 'right', width: '1%' },
      ];
    },
  },
  created() {
    this.fetchServers();
  },
  beforeUnmount() {
    clearTimeout(this.slowTimer);
  },
  methods: {
    num(n) { return digits(n ?? '', this.lang); },
    fetchServers() {
      const seq = ++this.seq;
      this.loading = true;
      this.failed = false;
      clearTimeout(this.slowTimer);
      this.slowTimer = setTimeout(() => {
        if (seq === this.seq && this.loading) { this.loading = false; this.failed = true; }
      }, SLOW_MS);
      Api.admin.getWsServerList({}, ({ data }) => {
        if (seq !== this.seq) return;
        clearTimeout(this.slowTimer);
        this.loading = false;
        if (data && data.code === 0) {
          this.servers = (Array.isArray(data.data) ? data.data : []).map((address) => ({ address }));
        } else {
          this.failed = true;
          this.$message.error((data && data.msg) || this.$t('system.server.loadFailed'));
        }
      });
    },
    async emitAction(row, action) {
      if (!row || row.address === undefined) return;
      const restart = action === 'restart';
      try {
        await this.$confirm(
          this.$t(restart ? 'system.server.restartText' : 'system.server.updateText', { address: row.address }),
          this.$t(restart ? 'system.server.restartTitle' : 'system.server.updateTitle'),
          {
            confirmText: this.$t(restart ? 'system.server.restart' : 'system.server.updateConfig'),
            cancelText: this.$t('common.cancel'),
            danger: true,
          },
        );
      } catch (e) {
        return; // cancelled: nothing sent
      }
      this.busy = `${row.address}:${action}`;
      const res = await callWithTimeout((cb) => Api.admin.sendWsServerAction({ targetWs: row.address, action }, cb));
      this.busy = '';
      if (!res) return; // the API layer has already reported the failure
      const { data } = res;
      if (!data || data.code !== 0) {
        this.$message.error((data && data.msg) || this.$t('system.server.actionFailed'));
        return;
      }
      this.$message.success(this.$t(restart ? 'system.server.restartSent' : 'system.server.updateSent'));
    },
    copyAddress(address) {
      if (!navigator.clipboard || !navigator.clipboard.writeText) { this.$message.error(this.$t('system.copyFailed')); return; }
      navigator.clipboard.writeText(address).then(
        () => this.$message.success(this.$t('system.copied')),
        () => this.$message.error(this.$t('system.copyFailed')),
      );
    },
  },
};
</script>

<style>
.srv { padding-bottom: var(--tb-s8); }
.srv__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--tb-s3); padding: var(--tb-s5) 0 var(--tb-s3); }
.srv__h { font-size: var(--tb-fs-20); }
.srv__count { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.srv__addr { display: flex; align-items: center; gap: var(--tb-s2); min-width: 0; }
.srv__icon { flex: none; color: var(--tb-ink-3); }
.srv__url { min-width: 0; overflow-wrap: anywhere; font-weight: 600; font-variant-numeric: tabular-nums; }
.srv__acts { gap: var(--tb-s2); }

@media (max-width: 640px) {
  .srv__table td { display: block; }
  .srv__table td::before { content: none !important; }
  .srv__addr .tb-btn { min-width: var(--tb-target); min-height: var(--tb-target); }
  .srv__table .srv__acts { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
  .srv__table .srv__acts .tb-btn { min-height: var(--tb-target); width: 100%; }
}
</style>
