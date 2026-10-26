<template>
  <div class="inv">
    <TbPageHeader :title="$t('nav.invitations')" :description="$t('invites.lede')" />

    <div v-if="!list && !failed" class="inv__state"><TbLoading :label="$t('common.loading')" show-label /></div>
    <div v-else-if="!list" class="inv__state" role="alert">
      <p>{{ $t('invites.loadFailed') }}</p>
      <TbButton size="s" icon="refresh" @click="load">{{ $t('common.retry') }}</TbButton>
    </div>
    <TbEmpty v-else-if="!list.length" face="awake" :title="$t('invites.emptyTitle')" :text="$t('invites.emptyText')">
      <TbButton to="/robots" icon="robots">{{ $t('common.goRobots') }}</TbButton>
    </TbEmpty>

    <TbSection v-else :title="$t('invites.pendingTitle', { n: num(list.length) })" :description="$t('invites.pendingLine')">
      <ul class="inv__list">
        <li v-for="i in list" :key="i.id" class="inv__row">
          <span class="inv__what">
            <b>{{ $t('invites.from', { name: i.ownerName, robot: i.robotName || productText(i) }) }}</b>
            <small>{{ $t(`family.roleLine.${roleKey(i.role)}`) }}</small>
            <small class="tb-num">{{ dateText(i.createdAt) }}</small>
          </span>
          <TbTag :ink="i.role === 'co_owner' ? 'message' : 'ink-2'">{{ $t(`family.role.${roleKey(i.role)}`) }}</TbTag>
          <span class="inv__act">
            <TbButton size="s" variant="quiet" :disabled="!!busy" :loading="busy === `d${i.id}`" @click="decline(i)">{{ $t('invites.decline') }}</TbButton>
            <TbButton size="s" :variant="i.id === list[0].id ? 'primary' : 'secondary'" icon="check" :disabled="!!busy"
              :loading="busy === `a${i.id}`" @click="accept(i)">{{ $t('invites.accept') }}</TbButton>
          </span>
        </li>
      </ul>
    </TbSection>
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { inbox } from '@/shell/inbox';
import { loadRobots, selectRobot, robot } from '@/shell/robot';

// Invitations (আমন্ত্রণ): robots other accounts asked this account to share. Accepting adds the
// robot to the robot list (with a "shared by" tag); declining tells nobody and removes the row.
export default {
  name: 'Invitations',
  data() { return { list: null, loading: false, failed: false, busy: '' }; },
  mounted() { this.load(); },
  methods: {
    num(n) { return digits(n, this.$i18n.locale); },
    roleKey(r) { return r === 'co_owner' ? 'co_owner' : 'member'; },
    productText(i) { return this.$i18n.locale === 'bn' ? (i.productNameBn || i.productName || '') : (i.productName || ''); },
    dateText(ms) {
      if (!ms) return '';
      return new Intl.DateTimeFormat(this.$i18n.locale === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(Number(ms)));
    },
    load() {
      this.loading = true; this.failed = false;
      Api.family.getInvites((res) => {
        this.loading = false;
        const data = res && res.data && res.data.data;
        this.list = Array.isArray(data) ? data : [];
        inbox.invites = this.list.length;
      }, () => { this.loading = false; this.failed = true; });
    },
    drop(i) { this.list = this.list.filter((x) => x.id !== i.id); inbox.invites = this.list.length; },
    accept(i) {
      this.busy = `a${i.id}`;
      Api.family.acceptInvite(i.id, async () => {
        this.busy = '';
        this.drop(i);
        this.$message.success(this.$t('invites.accepted', { robot: i.robotName || this.productText(i) }));
        await loadRobots(true);
        const hit = robot.list.find((r) => r.deviceId === i.deviceId);
        if (hit && !robot.deviceId) selectRobot(hit);
      }, (err) => { this.busy = ''; this.$message.error((err && err.data && err.data.msg) || this.$t('invites.failed')); });
    },
    decline(i) {
      this.busy = `d${i.id}`;
      Api.family.declineInvite(i.id, () => {
        this.busy = '';
        this.drop(i);
        this.$message.info(this.$t('invites.declined'));
      }, (err) => { this.busy = ''; this.$message.error((err && err.data && err.data.msg) || this.$t('invites.failed')); });
    },
  },
};
</script>

<style>
.inv { padding-bottom: var(--tb-s10); }
.inv__state { padding: var(--tb-s10) 0; display: grid; justify-items: center; gap: var(--tb-s3); color: var(--tb-ink-2); }
.inv__list { list-style: none; margin: 0; padding: 0; }
.inv__row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: var(--tb-s4); align-items: center; padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft); }
.inv__what { display: grid; gap: 2px; min-width: 0; }
.inv__what b { font-weight: 700; overflow-wrap: anywhere; }
.inv__what small { color: var(--tb-ink-2); font-size: var(--tb-fs-13); max-width: 70ch; }
.inv__act { display: flex; gap: 8px; }
@media (max-width: 640px) {
  .inv__row { grid-template-columns: minmax(0, 1fr) auto; }
  .inv__act { grid-column: 1 / -1; }
}
</style>
