<template>
  <div class="rmsg">
    <!-- Message another robot: TinyBot's own voice carries it to the other robot -->
    <TbSection :title="$t('rmsg.compose.title')" :description="$t('rmsg.compose.desc')" ink="message">
      <p v-if="!targets.length && !loading" class="rmsg__muted" data-test="no-targets">{{ $t('rmsg.compose.none') }}</p>
      <form v-else class="rmsg-compose" novalidate @submit.prevent="send">
        <TbField :label="$t('rmsg.compose.to')" :error="err(sendErrors, 'target')" for-id="rmsg-to">
          <TbSelect id="rmsg-to" v-model="draft.target" :options="targetOpts" :placeholder="$t('rmsg.compose.toPick')"
            :invalid="!!sendErrors.target" @change="sendErrors.target = ''" />
        </TbField>
        <TbField :label="$t('rmsg.compose.text')" :error="err(sendErrors, 'text')" for-id="rmsg-text">
          <TbTextarea id="rmsg-text" v-model="draft.text" :rows="2" autosize :maxlength="MAX_TEXT" show-count
            :invalid="!!sendErrors.text" :placeholder="$t('rmsg.compose.textPlaceholder')" @update:model-value="sendErrors.text = ''" />
        </TbField>
        <div class="rmsg-compose__bar">
          <span class="rmsg__muted">{{ $t('rmsg.compose.night') }}</span>
          <TbButton variant="primary" native-type="submit" icon="send" :loading="sending" data-test="send">{{ $t('rmsg.compose.send') }}</TbButton>
        </div>
      </form>
    </TbSection>

    <!-- Contacts: robots of other accounts this robot may talk to -->
    <TbSection :title="$t('rmsg.contacts.title')" :description="$t('rmsg.contacts.desc')" ink="message">
      <template #actions>
        <TbButton size="s" icon="plus" data-test="add-contact" @click="openAsk">{{ $t('rmsg.contacts.add') }}</TbButton>
      </template>

      <div v-if="loading && !loaded" class="rmsg__wait"><TbLoading :label="$t('common.loading')" show-label /></div>
      <p v-else-if="failed" class="rmsg__fail" role="alert">{{ $t('common.loadFailed') }}
        <TbButton size="s" variant="quiet" icon="refresh" @click="load()">{{ $t('common.retry') }}</TbButton></p>
      <template v-else>
        <!-- Asked of me: accept with one of my robots -->
        <ol v-if="groups.incoming.length" class="rmsg-list rmsg-list--in">
          <li v-for="c in groups.incoming" :key="c.id" class="rmsg-row" :data-contact="c.id">
            <TbTag ink="message" mark>{{ $t('rmsg.contacts.asks') }}</TbTag>
            <div class="rmsg-row__body">
              <p class="rmsg-row__name">{{ $t('rmsg.contacts.incoming', { owner: c.otherOwner || c.otherUsername, robot: c.otherDeviceName }) }}</p>
              <p class="rmsg-row__meta">{{ $t('rmsg.contacts.theyCall', { name: c.theirName || c.name }) }}</p>
            </div>
            <div class="rmsg-row__acts">
              <TbButton size="s" variant="primary" data-test="accept" @click="openAccept(c)">{{ $t('rmsg.contacts.accept') }}</TbButton>
              <TbButton size="s" variant="quiet" :loading="busy === c.id" @click="decline(c)">{{ $t('rmsg.contacts.decline') }}</TbButton>
            </div>
          </li>
        </ol>

        <TbEmpty v-if="!groups.accepted.length && !groups.outgoing.length && !groups.incoming.length" face="awake"
          :title="$t('rmsg.contacts.none')" :text="$t('rmsg.contacts.noneText')" />
        <ol v-else-if="groups.accepted.length || groups.outgoing.length" class="rmsg-list">
          <li v-for="c in [...groups.accepted, ...groups.outgoing]" :key="c.id" class="rmsg-row" :data-contact="c.id">
            <div class="rmsg-row__who">
              <b>{{ c.name }}</b>
              <small>{{ c.otherOwner || c.otherUsername }}</small>
            </div>
            <div class="rmsg-row__body">
              <p v-if="c.aliases && c.aliases.length" class="rmsg-row__aliases">
                <span v-for="a in c.aliases" :key="a" class="rmsg-row__alias">{{ a }}</span></p>
              <p class="rmsg-row__meta">{{ $t('rmsg.contacts.withRobot', { robot: c.myDeviceName }) }}</p>
            </div>
            <div class="rmsg-row__acts">
              <TbSync v-if="c.status === 'pending'" state="pending" :text="$t('rmsg.contacts.waiting')" />
              <TbButton v-else size="s" variant="quiet" icon="edit" :aria-label="`${$t('rmsg.contacts.rename')}: ${c.name}`" @click="openRename(c)" />
              <TbButton size="s" variant="quiet" icon="trash" :aria-label="`${$t('rmsg.contacts.remove')}: ${c.name}`" :loading="busy === c.id" @click="remove(c)" />
            </div>
          </li>
        </ol>
      </template>
    </TbSection>

    <!-- Ask / accept / rename -->
    <TbSheet v-model:open="sheet" :title="sheetTitle" size="s" :close-label="$t('common.close')">
      <form id="rmsg-form" class="rmsg-form" novalidate @submit.prevent="submit">
        <p v-if="mode === 'accept' && current" class="rmsg-form__lead">{{ $t('rmsg.contacts.incoming', { owner: current.otherOwner || current.otherUsername, robot: current.otherDeviceName }) }}</p>
        <TbField v-if="mode !== 'rename'" :label="$t('rmsg.form.robot')" :error="err(formErrors, 'deviceId')" for-id="rmsg-f-robot">
          <TbSelect id="rmsg-f-robot" v-model="form.deviceId" :options="robotOpts" :invalid="!!formErrors.deviceId" />
        </TbField>
        <TbField v-if="mode === 'ask'" :label="$t('rmsg.form.username')" :hint="$t('rmsg.form.usernameHint')" :error="err(formErrors, 'username')" for-id="rmsg-f-user">
          <TbInput id="rmsg-f-user" v-model="form.username" :maxlength="64" autocomplete="off" :invalid="!!formErrors.username" />
        </TbField>
        <TbField :label="$t('rmsg.form.name')" :hint="$t('rmsg.form.nameHint')" :error="err(formErrors, 'name')" for-id="rmsg-f-name">
          <TbInput id="rmsg-f-name" v-model="form.name" :maxlength="MAX_NAME" :invalid="!!formErrors.name" :placeholder="$t('rmsg.form.namePlaceholder')" />
        </TbField>
        <TbField :label="$t('rmsg.form.aliases')" :hint="$t('rmsg.form.aliasesHint')" :error="err(formErrors, 'aliasText')" for-id="rmsg-f-aliases">
          <TbInput id="rmsg-f-aliases" v-model="form.aliasText" :maxlength="300" :invalid="!!formErrors.aliasText" />
        </TbField>
      </form>
      <template #footer>
        <TbButton @click="sheet = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" :loading="saving" @click="submit">{{ $t(`rmsg.form.submit.${mode}`) }}</TbButton>
      </template>
    </TbSheet>
  </div>
</template>

<script>
import homeApi from '@/apis/module/home';
import { aliasesToText } from './homeModel';
import {
  MAX_NAME, MAX_TEXT, acceptBody, acceptProblems, groupContacts, requestBody, requestErrorKey, requestProblems, sendProblems,
  sendResultKey, targetOptions,
} from './robotMessagesModel';

const errText = (e) => (e && e.data && e.data.msg) || '';

// The Messages page part for robot-to-robot messages: a composer ("অন্য রোবটে বার্তা") and the
// contacts this robot may message. Owner HOME; mounted by Messages.vue with the robot's id.
export default {
  name: 'RobotMessages',
  props: { deviceId: { type: String, default: '' } },
  data() {
    return {
      MAX_NAME, MAX_TEXT,
      loading: false, loaded: false, failed: false,
      robots: [], contacts: [], targets: [],
      draft: { target: '', text: '' }, sendErrors: {}, sending: false,
      sheet: false, mode: 'ask', current: null, form: {}, formErrors: {}, saving: false, busy: '',
    };
  },
  computed: {
    groups() { return groupContacts(this.contacts); },
    targetOpts() {
      return targetOptions(this.targets).map((o) => ({ value: o.value, label: o.kind === 'own' ? this.$t('rmsg.compose.own', { name: o.label }) : o.label }));
    },
    robotOpts() { return this.robots.map((r) => ({ value: r.deviceId, label: r.name })); },
    sheetTitle() { return this.$t(`rmsg.form.title.${this.mode}`); },
  },
  watch: { deviceId() { this.load(); } },
  created() { this.load(); },
  methods: {
    err(map, key) { return map[key] ? this.$t(map[key]) : ''; },
    async load() {
      this.loading = true;
      try {
        const [overview, targets] = await Promise.all([
          homeApi.getContacts(),
          this.deviceId ? homeApi.contactTargets(this.deviceId) : Promise.resolve([]),
        ]);
        this.robots = (overview && overview.robots) || [];
        this.contacts = (overview && overview.contacts) || [];
        this.targets = Array.isArray(targets) ? targets : [];
        if (this.draft.target && !this.targets.some((t) => t.key === this.draft.target)) this.draft.target = '';
        if (!this.draft.target && this.targets.length === 1) this.draft.target = this.targets[0].key;
        this.failed = false;
        this.loaded = true;
      } catch (e) {
        this.failed = true;
      } finally {
        this.loading = false;
      }
    },

    async send() {
      if (this.sending) return;
      const problems = sendProblems(this.draft);
      if (Object.keys(problems).length) { this.sendErrors = problems; return; }
      this.sending = true;
      try {
        const r = await homeApi.sendToRobot({ fromDeviceId: this.deviceId, target: this.draft.target, text: this.draft.text.trim() });
        const to = (r && r.to) || '';
        if (r && r.ok) {
          this.draft.text = '';
          this.$message.success(this.$t(sendResultKey(r), { name: to }));
        } else {
          this.$message.error(this.$t(sendResultKey(r), { name: to }));
        }
      } catch (e) {
        this.$message.error(errText(e) || this.$t('rmsg.send.err.unreachable'));
      } finally {
        this.sending = false;
      }
    },

    openAsk() {
      this.mode = 'ask';
      this.current = null;
      this.form = { deviceId: this.deviceId || (this.robots[0] && this.robots[0].deviceId) || '', username: '', name: '', aliasText: '' };
      this.formErrors = {};
      this.sheet = true;
    },
    openAccept(c) {
      this.mode = 'accept';
      this.current = c;
      this.form = { deviceId: this.deviceId || (this.robots[0] && this.robots[0].deviceId) || '', name: c.otherOwner ? '' : c.otherDeviceName, aliasText: '' };
      this.formErrors = {};
      this.sheet = true;
    },
    openRename(c) {
      this.mode = 'rename';
      this.current = c;
      this.form = { name: c.name, aliasText: aliasesToText(c.aliases) };
      this.formErrors = {};
      this.sheet = true;
    },
    async submit() {
      if (this.saving) return;
      const problems = this.mode === 'ask' ? requestProblems(this.form) : acceptProblems(this.form, this.mode === 'accept');
      if (Object.keys(problems).length) { this.formErrors = problems; return; }
      this.saving = true;
      try {
        if (this.mode === 'ask') await homeApi.requestContact(requestBody(this.form));
        else if (this.mode === 'accept') await homeApi.acceptContact(this.current.id, acceptBody(this.form));
        else await homeApi.renameContact(this.current.id, acceptBody(this.form));
        this.sheet = false;
        this.$message.success(this.$t(`rmsg.form.done.${this.mode}`));
        this.load();
      } catch (e) {
        const key = requestErrorKey(e);
        if (key === 'rmsg.err.user_not_found' || key === 'rmsg.err.own_account') this.formErrors = { ...this.formErrors, username: key };
        this.$message.error(key ? this.$t(key) : (errText(e) || this.$t('rmsg.send.err.unreachable')));
      } finally {
        this.saving = false;
      }
    },
    async decline(c) {
      this.busy = c.id;
      try {
        await homeApi.declineContact(c.id);
        this.load();
      } catch (e) {
        this.$message.error(errText(e) || this.$t('rmsg.send.err.unreachable'));
      } finally {
        this.busy = '';
      }
    },
    async remove(c) {
      try {
        await this.$confirm(this.$t('rmsg.contacts.removeConfirm', { name: c.name }), this.$t('rmsg.contacts.remove'),
          { confirmText: this.$t('rmsg.contacts.remove'), cancelText: this.$t('common.cancel'), danger: true });
      } catch (e) { return; }
      this.busy = c.id;
      try {
        await homeApi.removeContact(c.id);
        this.load();
      } catch (e) {
        this.$message.error(errText(e) || this.$t('rmsg.send.err.unreachable'));
      } finally {
        this.busy = '';
      }
    },
  },
};
</script>

<style>
.rmsg__muted { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.rmsg__wait { padding: var(--tb-s4) 0; }
.rmsg__fail { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--tb-danger); font-size: var(--tb-fs-14); }
.rmsg-compose { display: grid; gap: var(--tb-s4); grid-template-columns: minmax(0, 1fr); }
.rmsg-compose textarea { color: var(--tb-message); font-size: max(16px, var(--tb-fs-16)); }
.rmsg-compose__bar { display: flex; align-items: center; gap: var(--tb-s3); flex-wrap: wrap; }
.rmsg-compose__bar .tb-btn--primary { margin-left: auto; min-width: 132px; }
@media (min-width: 900px) { .rmsg-compose { grid-template-columns: minmax(0, 320px) minmax(0, 1fr); } .rmsg-compose__bar { grid-column: 1 / -1; } }

.rmsg-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule); }
.rmsg-list--in { margin-bottom: var(--tb-s4); }
.rmsg-row { display: grid; grid-template-columns: minmax(96px, 160px) minmax(0, 1fr) auto; gap: 4px var(--tb-s4); align-items: center; padding: 12px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.rmsg-list--in .rmsg-row { grid-template-columns: auto minmax(0, 1fr) auto; }
.rmsg-row__who { display: grid; line-height: var(--tb-lh-tight); min-width: 0; }
.rmsg-row__who b { font: 700 var(--tb-fs-16)/1.25 var(--tb-font-display); color: var(--tb-message); overflow-wrap: anywhere; }
.rmsg-row__who small { color: var(--tb-ink-3); font-size: var(--tb-fs-12); margin-top: 2px; overflow-wrap: anywhere; }
.rmsg-row__body { min-width: 0; display: grid; gap: 4px; }
.rmsg-row__name { font-weight: 600; overflow-wrap: anywhere; }
.rmsg-row__meta { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.rmsg-row__aliases { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.rmsg-row__alias::before { content: '“'; color: var(--tb-ink-3); }
.rmsg-row__alias::after { content: '”'; color: var(--tb-ink-3); }
.rmsg-row__acts { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.rmsg-form { display: grid; gap: var(--tb-s4); }
.rmsg-form__lead { font-weight: 600; }
@media (max-width: 640px) {
  .rmsg-row, .rmsg-list--in .rmsg-row { grid-template-columns: minmax(0, 1fr); }
  .rmsg-row__acts { justify-content: flex-start; }
  .rmsg-compose__bar .tb-btn--primary { flex: 1 1 100%; }
}
</style>
