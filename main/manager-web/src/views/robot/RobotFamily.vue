<template>
  <TbSection :title="$t('family.title')" :description="$t('family.lede', { name: botName })">
    <template v-if="info && info.canShare" #actions>
      <TbButton icon="plus" @click="openInvite">{{ $t('family.invite') }}</TbButton>
    </template>

    <div v-if="!info && !failed" class="rb-fam__state"><TbLoading :label="$t('common.loading')" show-label /></div>
    <div v-else-if="!info" class="rb-fam__state" role="alert">
      <p>{{ $t('family.loadFailed') }}</p>
      <TbButton size="s" icon="refresh" @click="load">{{ $t('common.retry') }}</TbButton>
    </div>

    <template v-else-if="info">
      <p class="rb-fam__me">
        <span>{{ $t('family.yourRole') }}</span>
        <TbTag :ink="roleInk(info.role)">{{ $t(`family.role.${info.role}`) }}</TbTag>
        <span v-if="info.role !== 'owner' && info.ownerName" class="rb-fam__owner">{{ $t('family.ownerIs', { name: info.ownerName }) }}</span>
      </p>

      <ul v-if="people.length" class="rb-fam__list" :aria-label="$t('family.listLabel')">
        <li v-for="m in people" :key="m.id" class="rb-fam__row" :class="{ 'is-pending': m.status === 'pending' }">
          <span class="rb-fam__who">
            <b>{{ m.name }}</b>
            <small v-if="m.status === 'pending'">{{ $t('family.invitedOn', { when: dateText(m.createdAt) }) }}</small>
            <small v-else-if="m.respondedAt">{{ $t('family.joinedOn', { when: dateText(m.respondedAt) }) }}</small>
          </span>
          <span class="rb-fam__tags">
            <TbTag v-if="m.status === 'pending'" ink="warn">{{ $t('family.pending') }}</TbTag>
            <TbSelect v-if="info.canShare && m.status !== 'pending'" size="s" class="rb-fam__role" :model-value="m.role"
              :options="roleOptions" :aria-label="$t('family.roleFor', { name: m.name })" :disabled="busy === m.id"
              @change="(v) => changeRole(m, v)" />
            <TbTag v-else :ink="roleInk(m.role)">{{ $t(`family.role.${m.role}`) }}</TbTag>
          </span>
          <span class="rb-fam__act">
            <TbButton v-if="info.canShare" size="s" variant="quiet" icon="close" :loading="busy === m.id"
              :aria-label="$t(m.status === 'pending' ? 'family.cancelFor' : 'family.removeFor', { name: m.name })"
              @click="remove(m)">{{ $t(m.status === 'pending' ? 'family.cancel' : 'family.remove') }}</TbButton>
          </span>
        </li>
      </ul>
      <div v-else class="rb-fam__empty">
        <p>{{ info.canShare ? $t('family.emptyOwner') : $t('family.emptyOther') }}</p>
        <TbButton v-if="info.canShare" variant="primary" icon="plus" @click="openInvite">{{ $t('family.invite') }}</TbButton>
      </div>

      <dl class="rb-fam__roles">
        <div><dt>{{ $t('family.role.member') }}</dt><dd>{{ $t('family.roleLine.member') }}</dd></div>
        <div><dt>{{ $t('family.role.co_owner') }}</dt><dd>{{ $t('family.roleLine.co_owner') }}</dd></div>
      </dl>

      <footer v-if="info.role !== 'owner' && myShareId" class="rb-foot">
        <TbButton variant="danger" icon="logout" :loading="busy === 'leave'" @click="leave">{{ $t('family.leave') }}</TbButton>
      </footer>
    </template>

    <TbSheet v-model:open="sheet" :title="$t('family.inviteTitle')" size="s" :close-label="$t('common.close')">
      <form id="rb-fam-form" class="rb-fam__form" novalidate @submit.prevent="send">
        <TbField :label="$t('family.target')" :hint="$t('family.targetHint')" :error="targetError" required for-id="rb-fam-target">
          <TbInput id="rb-fam-target" v-model="target" :maxlength="64" autocomplete="off" :invalid="!!targetError"
            :placeholder="$t('family.targetPlaceholder')" @update:model-value="targetError = ''" @enter="send" />
        </TbField>
        <TbField :label="$t('family.roleLabel')">
          <TbChoice v-model="role" :options="roleOptions" :aria-label="$t('family.roleLabel')" />
        </TbField>
        <p class="rb-note">{{ $t(`family.roleLine.${role}`) }}</p>
      </form>
      <template #footer>
        <TbButton @click="sheet = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" icon="send" :loading="sending" @click="send">{{ $t('family.send') }}</TbButton>
      </template>
    </TbSheet>
  </TbSection>
</template>

<script>
import Api from '@/apis/api';
import { loadRobots, robot } from '@/shell/robot';
import { inviteTarget, sortMembers } from '@/utils/family.mjs';

// Family (পরিবার): who else may use this robot. The owner invites another account by username or
// Bangladeshi mobile number as a member (Today, Day, Messages, Look) or co-owner (also the
// character and settings), changes roles and removes people; everyone else sees the list and may
// leave. Data: GET /family/device/{id}, POST .../invite, PUT/DELETE /family/share/{id}.
export default {
  name: 'RobotFamily',
  props: {
    deviceId: { type: String, default: '' },
    botName: { type: String, default: '' },
  },
  data() {
    return { info: null, loading: false, failed: false, busy: '', sheet: false, target: '', role: 'member', targetError: '', sending: false };
  },
  computed: {
    people() { return sortMembers(this.info && this.info.members); },
    roleOptions() { return ['member', 'co_owner'].map((r) => ({ value: r, label: this.$t(`family.role.${r}`) })); },
    myShareId() {
      const me = this.$store && this.$store.getters && this.$store.getters.getUserInfo;
      // The server marks the reader's own row (`self`); ids are strings (snowflake ids)
      const mine = this.people.find((m) => m.self) || (me && this.people.find((m) => String(m.userId) === String(me.id)));
      if (mine) return mine.id;
      const hit = robot.list.find((r) => r.deviceId === this.deviceId);
      return (hit && hit.shareId) || null;
    },
  },
  watch: { deviceId() { this.info = null; this.load(); } },
  mounted() { this.load(); },
  methods: {
    roleInk(role) { return role === 'owner' ? 'ink' : role === 'co_owner' ? 'message' : 'ink-2'; },
    dateText(ms) {
      if (!ms) return '';
      return new Intl.DateTimeFormat(this.$i18n.locale === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(Number(ms)));
    },
    fail(err, fallback) {
      const msg = err && err.data && err.data.msg;
      this.$message.error(msg || this.$t(fallback));
    },
    load() {
      if (!this.deviceId || !Api.family) return;
      this.loading = true; this.failed = false;
      Api.family.getDeviceFamily(this.deviceId, (res) => {
        this.loading = false;
        this.info = (res && res.data && res.data.data) || { role: 'owner', canShare: false, members: [] };
      }, () => { this.loading = false; this.failed = true; });
    },
    openInvite() { this.target = ''; this.role = 'member'; this.targetError = ''; this.sheet = true; },
    send() {
      if (this.sending) return;
      const t = inviteTarget(this.target);
      if (t.problem) { this.targetError = this.$t(`family.err.${t.problem}`); return; }
      this.sending = true;
      Api.family.invite(this.deviceId, t.value, this.role, () => {
        this.sending = false; this.sheet = false;
        this.$message.success(this.$t('family.sent', { name: this.target.trim() }));
        this.load();
      }, (err) => {
        this.sending = false;
        const msg = err && err.data && err.data.msg;
        this.targetError = msg || this.$t('family.err.failed');
      });
    },
    changeRole(m, role) {
      if (role === m.role) return;
      this.busy = m.id;
      Api.family.changeRole(m.id, role, () => {
        this.busy = '';
        this.$message.success(this.$t('family.roleChanged', { name: m.name, role: this.$t(`family.role.${role}`) }));
        this.load();
      }, (err) => { this.busy = ''; this.fail(err, 'family.err.failed'); this.load(); });
    },
    remove(m) {
      const pending = m.status === 'pending';
      this.$confirm(
        this.$t(pending ? 'family.cancelText' : 'family.removeText', { name: m.name, robot: this.botName }),
        this.$t(pending ? 'family.cancelTitle' : 'family.removeTitle'),
        { confirmText: this.$t(pending ? 'family.cancel' : 'family.remove'), cancelText: this.$t('common.cancel'), danger: true },
      ).then(() => {
        this.busy = m.id;
        Api.family.removeShare(m.id, () => {
          this.busy = '';
          this.$message.success(this.$t(pending ? 'family.cancelled' : 'family.removed', { name: m.name }));
          this.load();
        }, (err) => { this.busy = ''; this.fail(err, 'family.err.failed'); });
      }).catch(() => {});
    },
    leave() {
      this.$confirm(this.$t('family.leaveText', { robot: this.botName }), this.$t('family.leaveTitle'),
        { confirmText: this.$t('family.leave'), cancelText: this.$t('common.cancel'), danger: true },
      ).then(() => {
        this.busy = 'leave';
        Api.family.removeShare(this.myShareId, async () => {
          this.busy = '';
          this.$message.success(this.$t('family.left', { robot: this.botName }));
          await loadRobots(true);
          this.$router.push('/robots');
        }, (err) => { this.busy = ''; this.fail(err, 'family.err.failed'); });
      }).catch(() => {});
    },
  },
};
</script>

<style>
.rb-fam__state { padding: var(--tb-s8) 0; display: grid; justify-items: center; gap: var(--tb-s3); color: var(--tb-ink-2); }
.rb-fam__me { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: var(--tb-s2) 0 var(--tb-s3); color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.rb-fam__owner { color: var(--tb-ink); }
.rb-fam__list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule); }
.rb-fam__row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: var(--tb-s3); align-items: center; min-height: 60px;
  padding: 8px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.rb-fam__row.is-pending { border-bottom-style: dashed; }
.rb-fam__who { display: grid; gap: 2px; min-width: 0; }
.rb-fam__who b { font-weight: 700; overflow-wrap: anywhere; }
.rb-fam__who small { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.rb-fam__tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.rb-fam__role { width: 150px; }
.rb-fam__empty { display: grid; gap: var(--tb-s3); justify-items: start; padding: var(--tb-s4) 0; border-top: 1px solid var(--tb-rule);
  color: var(--tb-ink-2); max-width: 70ch; }
.rb-fam__roles { display: grid; gap: var(--tb-s2); margin: var(--tb-s5) 0 0; font-size: var(--tb-fs-14); }
.rb-fam__roles div { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: var(--tb-s3); }
.rb-fam__roles dt { font-weight: 700; }
.rb-fam__roles dd { margin: 0; color: var(--tb-ink-2); max-width: 70ch; }
.rb-fam__form { display: grid; gap: var(--tb-s4); }
@media (max-width: 640px) {
  .rb-fam__row { grid-template-columns: minmax(0, 1fr) auto; }
  .rb-fam__act { grid-column: 1 / -1; justify-self: start; }
  .rb-fam__roles div { grid-template-columns: minmax(0, 1fr); gap: 2px; }
}
</style>
