<template>
  <div class="tb-page home">
    <TbPageHeader :title="$t('nav.smartHome')" :description="$t('home.desc')">
      <template v-if="ready" #actions>
        <TbButton variant="quiet" icon="refresh" :loading="loading" :disabled="loading" @click="load()">{{ $t('home.refresh') }}</TbButton>
      </template>
    </TbPageHeader>

    <div v-if="!ready && !failed" class="home__state"><TbLoading :label="$t('home.loading')" show-label /></div>
    <TbEmpty v-else-if="!ready" face="confused" :title="$t('home.loadFailed')" :text="$t('home.loadFailedText')">
      <TbButton icon="refresh" @click="load()">{{ $t('common.retry') }}</TbButton>
    </TbEmpty>

    <template v-else>
      <!-- What to say: the three sentences TinyBot understands, as a ruled strip -->
      <figure class="home-say" aria-labelledby="home-say-title">
        <figcaption id="home-say-title" class="home-say__title">{{ $t('home.say.title') }}</figcaption>
        <ol class="home-say__lines">
          <li v-for="k in [1, 2, 3]" :key="k" lang="bn">“{{ $t(`home.say.${k}`) }}”</li>
        </ol>
        <p class="home-say__note">{{ $t('home.say.note') }}</p>
      </figure>

      <!-- Devices first: the part an owner comes back to -->
      <TbSection :title="$t('home.devices.title')" :description="$t('home.devices.desc')">
        <template #actions>
          <TbButton size="s" icon="download" :loading="importing" :disabled="!saved.token || importing" data-test="import" @click="importHa">
            {{ importing ? $t('home.devices.importing') : $t('home.devices.import') }}</TbButton>
          <TbButton size="s" icon="plus" data-test="add-mqtt" @click="openEdit(null)">{{ $t('home.devices.addMqtt') }}</TbButton>
        </template>

        <TbEmpty v-if="!devices.length" face="awake" :title="$t('home.devices.none')" :text="$t('home.devices.noneText')" />
        <ol v-else class="home-list">
          <li v-for="d in shownDevices" :key="d.id" class="home-row" :class="{ 'is-off': !d.enabled }" :data-device="d.id">
            <div class="home-row__kind">
              <b>{{ $t(`home.domain.${d.domain}`) }}</b>
              <small>{{ $t(`home.source.${d.source}`) }}</small>
            </div>
            <div class="home-row__body">
              <p class="home-row__name">{{ d.name }}
                <TbTag v-if="!d.enabled" class="home-row__off">{{ $t('home.devices.voiceOff') }}</TbTag></p>
              <p class="home-row__aliases">
                <template v-if="d.aliases && d.aliases.length">
                  <span v-for="a in d.aliases" :key="a" class="home-row__alias" lang="bn">{{ a }}</span>
                </template>
                <span v-else class="home-row__none">{{ $t('home.devices.noAliases') }}</span>
              </p>
              <p class="home-row__id">{{ d.source === 'mqtt' ? d.topic : d.entityId }}</p>
            </div>
            <div class="home-row__acts">
              <TbButton v-for="a in actionsOf(d)" :key="a.action" size="s" variant="secondary" class="home-pill"
                :loading="busy === `${d.id}:${a.action}`" :disabled="!!busy" :data-act="a.action" @click="act(d, a.action)">
                {{ $t(a.label) }}</TbButton>
              <TbButton size="s" variant="quiet" icon="edit" :aria-label="`${$t('home.devices.edit')}: ${d.name}`" @click="openEdit(d)" />
            </div>
          </li>
        </ol>
      </TbSection>

      <!-- Home Assistant -->
      <TbSection :title="$t('home.ha.title')" :description="$t('home.ha.desc')">
        <form class="home-form" novalidate data-part="ha" @submit.prevent="save('ha')">
          <TbField class="home-form__row" inline :label="$t('home.ha.url')" :hint="$t('home.ha.urlHint')" :error="err('haBaseUrl')" for-id="home-ha-url">
            <TbInput id="home-ha-url" v-model="form.haBaseUrl" inputmode="url" :maxlength="300" :invalid="!!errors.haBaseUrl"
              placeholder="http://192.168.0.50:8123" @update:model-value="touch('haBaseUrl')" />
          </TbField>
          <TbField class="home-form__row" inline :label="$t('home.ha.token')" :hint="tokenHint" :error="err('haToken')" for-id="home-ha-token">
            <TbInput id="home-ha-token" v-model="form.haToken" type="password" autocomplete="new-password" :maxlength="2000"
              :invalid="!!errors.haToken" :placeholder="saved.token ? mask : $t('home.notSet')"
              :show-label="$t('home.show')" :hide-label="$t('home.hide')" @update:model-value="touch('haToken')">
              <template v-if="saved.token && !form.haToken" #suffix><span class="home__saved" data-saved="token">{{ $t('home.saved') }}</span></template>
            </TbInput>
          </TbField>
          <footer class="home-form__foot">
            <p class="home-result" :class="resultClass('ha')" role="status" aria-live="polite" data-test="ha-result">{{ resultText('ha') }}</p>
            <TbButton icon="wifi" :loading="testing === 'ha'" :disabled="!!testing || saving === 'ha'" @click="test('ha')">{{ $t('home.test') }}</TbButton>
            <TbButton variant="primary" icon="check" native-type="submit" :loading="saving === 'ha'">{{ $t('home.save') }}</TbButton>
          </footer>
        </form>
      </TbSection>

      <!-- MQTT broker -->
      <TbSection :title="$t('home.mqtt.title')" :description="$t('home.mqtt.desc')">
        <form class="home-form" novalidate data-part="mqtt" @submit.prevent="save('mqtt')">
          <TbField class="home-form__row" inline :label="$t('home.mqtt.host')" :hint="$t('home.mqtt.hostHint')" :error="err('mqttHost')" for-id="home-mq-host">
            <TbInput id="home-mq-host" v-model="form.mqttHost" :maxlength="200" :invalid="!!errors.mqttHost" @update:model-value="touch('mqttHost')" />
          </TbField>
          <TbField class="home-form__row" inline :label="$t('home.mqtt.port')" :hint="$t('home.mqtt.portHint')" :error="err('mqttPort')" for-id="home-mq-port">
            <TbInput id="home-mq-port" v-model="form.mqttPort" class="home-form__num" inputmode="numeric" :maxlength="5"
              :invalid="!!errors.mqttPort" @update:model-value="touch('mqttPort')" />
          </TbField>
          <TbField class="home-form__row" inline :label="$t('home.mqtt.username')" for-id="home-mq-user">
            <TbInput id="home-mq-user" v-model="form.mqttUsername" :maxlength="200" autocomplete="off" />
          </TbField>
          <TbField class="home-form__row" inline :label="$t('home.mqtt.password')" :hint="passwordHint" :error="err('mqttPassword')" for-id="home-mq-pass">
            <TbInput id="home-mq-pass" v-model="form.mqttPassword" type="password" autocomplete="new-password" :maxlength="500"
              :placeholder="saved.password ? mask : $t('home.notSet')" :show-label="$t('home.show')" :hide-label="$t('home.hide')"
              @update:model-value="touch('mqttPassword')">
              <template v-if="saved.password && !form.mqttPassword" #suffix><span class="home__saved" data-saved="password">{{ $t('home.saved') }}</span></template>
            </TbInput>
          </TbField>
          <div class="home-form__row home-form__switch">
            <TbSwitch v-model="form.mqttTls" :label="$t('home.mqtt.tls')" />
          </div>
          <footer class="home-form__foot">
            <p class="home-result" :class="resultClass('mqtt')" role="status" aria-live="polite" data-test="mqtt-result">{{ resultText('mqtt') }}</p>
            <TbButton icon="wifi" :loading="testing === 'mqtt'" :disabled="!!testing || saving === 'mqtt'" @click="test('mqtt')">{{ $t('home.test') }}</TbButton>
            <TbButton variant="primary" icon="check" native-type="submit" :loading="saving === 'mqtt'">{{ $t('home.save') }}</TbButton>
          </footer>
        </form>
      </TbSection>
    </template>

    <!-- Edit a device / add an MQTT device -->
    <TbSheet v-model:open="sheet" :title="edit.id ? $t('home.edit.title') : $t('home.edit.addTitle')" :close-label="$t('common.close')">
      <form id="home-edit" class="home-edit" novalidate @submit.prevent="saveDevice">
        <TbField :label="$t('home.edit.name')" :hint="$t('home.edit.nameHint')" :error="editErr('name')" required for-id="home-ed-name">
          <TbInput id="home-ed-name" v-model="edit.name" :maxlength="100" :invalid="!!editErrors.name" @update:model-value="editErrors.name = ''" />
        </TbField>
        <TbField :label="$t('home.edit.aliases')" :hint="$t('home.edit.aliasesHint')" :error="editErr('aliasText')" for-id="home-ed-aliases">
          <TbTextarea id="home-ed-aliases" v-model="edit.aliasText" :rows="2" autosize :maxlength="500" :invalid="!!editErrors.aliasText"
            @update:model-value="editErrors.aliasText = ''" />
        </TbField>
        <p v-if="edit.source === 'ha'" class="home-edit__entity">{{ $t('home.edit.entity') }}: <code>{{ edit.entityId }}</code></p>
        <template v-else>
          <TbField :label="$t('home.edit.kind')" :error="editErr('domain')" for-id="home-ed-kind">
            <TbSelect id="home-ed-kind" v-model="edit.domain" :options="domainOptions" />
          </TbField>
          <TbField :label="$t('home.edit.topic')" :hint="$t('home.edit.topicHint')" :error="editErr('topic')" required for-id="home-ed-topic">
            <TbInput id="home-ed-topic" v-model="edit.topic" :maxlength="300" :invalid="!!editErrors.topic" @update:model-value="editErrors.topic = ''" />
          </TbField>
          <div class="home-edit__pair">
            <TbField :label="$t('home.edit.payloadOn')" for-id="home-ed-on"><TbInput id="home-ed-on" v-model="edit.payloadOn" :maxlength="200" /></TbField>
            <TbField :label="$t('home.edit.payloadOff')" for-id="home-ed-off"><TbInput id="home-ed-off" v-model="edit.payloadOff" :maxlength="200" /></TbField>
          </div>
        </template>
        <TbSwitch v-model="edit.enabled" :label="$t('home.edit.enabled')" />
        <TbButton v-if="edit.id" variant="danger" size="s" icon="trash" class="home-edit__del" :loading="deleting" @click="removeDevice">
          {{ $t('home.edit.delete') }}</TbButton>
      </form>
      <template #footer>
        <TbButton @click="sheet = false">{{ $t('home.edit.cancel') }}</TbButton>
        <TbButton variant="primary" :loading="savingDevice" @click="saveDevice">{{ $t('home.edit.save') }}</TbButton>
      </template>
    </TbSheet>
  </div>
</template>

<script>
import homeApi from '@/apis/module/home';
import { digits } from '@/kit/calendar';
import {
  DOMAINS, SECRET_MASK, deviceBody, deviceProblems, editState, integrationBody, integrationProblems, needsSecretAgain,
  readIntegration, resultKey, sortDevices, testActions,
} from './homeModel';

const errText = (e) => (e && e.data && e.data.msg) || '';

// স্মার্ট হোম: Home Assistant and MQTT settings (secrets are written, never read back), and the
// devices TinyBot may switch by voice, with their Bangla aliases and on/off test buttons.
export default {
  name: 'SmartHome',
  data() {
    return {
      ready: false,
      loading: false,
      failed: false,
      form: {},
      saved: { token: false, password: false },
      errors: {},
      results: { ha: null, mqtt: null },
      saving: '',
      testing: '',
      importing: false,
      devices: [],
      busy: '',
      sheet: false,
      edit: editState(null),
      editErrors: {},
      savingDevice: false,
      deleting: false,
      mask: SECRET_MASK,
      seq: 0,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    shownDevices() { return sortDevices(this.devices); },
    domainOptions() { return DOMAINS.map((d) => ({ value: d, label: this.$t(`home.domain.${d}`) })); },
    tokenHint() {
      if (this.form.haToken) return this.$t('home.ha.tokenHintNew');
      return this.$t(this.saved.token ? 'home.ha.tokenHintSaved' : 'home.ha.tokenHintEmpty');
    },
    passwordHint() { return this.$t(this.saved.password ? 'home.mqtt.passwordHintSaved' : 'home.mqtt.passwordHintEmpty'); },
  },
  created() { this.load(); },
  methods: {
    num(n) { return digits(n ?? '', this.lang); },
    err(key) { return this.errors[key] ? this.$t(this.errors[key]) : ''; },
    editErr(key) { return this.editErrors[key] ? this.$t(this.editErrors[key]) : ''; },
    touch(key) { if (this.errors[key]) this.errors = { ...this.errors, [key]: '' }; },
    actionsOf(d) { return testActions(d.domain); },

    async load() {
      const seq = ++this.seq;
      this.loading = true;
      try {
        const [view, devices] = await Promise.all([homeApi.getIntegration(), homeApi.listDevices()]);
        if (seq !== this.seq) return;
        const s = readIntegration(view);
        this.form = s.form;
        this.saved = s.saved;
        this.devices = Array.isArray(devices) ? devices : [];
        this.errors = {};
        this.ready = true;
        this.failed = false;
      } catch (e) {
        if (seq !== this.seq) return;
        this.failed = true;
        if (errText(e)) this.$message.error(errText(e));
      } finally {
        if (seq === this.seq) this.loading = false;
      }
    },

    resultText(part) {
      const r = this.results[part];
      if (!r) return '';
      if (r.ok && r.version) return this.$t('home.result.okVersion', { v: r.version });
      return this.$t(resultKey(r.ok ? 'ok' : r.code));
    },
    resultClass(part) {
      const r = this.results[part];
      return r ? (r.ok ? 'is-ok' : 'is-bad') : '';
    },

    async save(part) {
      if (this.saving) return;
      const problems = integrationProblems(this.form, part, this.saved);
      if (Object.keys(problems).length) {
        this.errors = { ...this.errors, ...problems };
        this.$message.error(this.$t('home.fixFields'));
        return;
      }
      this.saving = part;
      try {
        const view = await homeApi.saveIntegration(integrationBody(this.form, part));
        const s = readIntegration(view);
        this.saved = s.saved;
        if (part === 'ha') this.form.haToken = '';
        else this.form.mqttPassword = '';
        this.results = { ...this.results, [part]: null };
        this.$message.success(this.$t('home.savedToast'));
      } catch (e) {
        const field = needsSecretAgain(e);
        if (field) {
          this.errors = { ...this.errors, [field]: field === 'haToken' ? 'home.err.tokenRequired' : 'home.err.hostRequired' };
          this.$message.error(this.$t('home.secretAgain'));
        } else {
          this.$message.error(errText(e) || this.$t('home.result.error'));
        }
      } finally {
        this.saving = '';
      }
    },

    async test(part) {
      if (this.testing) return;
      this.testing = part;
      try {
        this.results = { ...this.results, [part]: await homeApi.testIntegration(part) };
      } catch (e) {
        this.results = { ...this.results, [part]: { ok: false, code: 'error' } };
      } finally {
        this.testing = '';
      }
    },

    async importHa() {
      if (this.importing) return;
      this.importing = true;
      try {
        const r = await homeApi.importHa();
        if (r && r.ok) {
          this.devices = Array.isArray(r.devices) ? r.devices : this.devices;
          this.$message.success(r.added ? this.$t('home.devices.imported', { n: this.num(r.added) }) : this.$t('home.devices.importedNone'));
        } else {
          this.results = { ...this.results, ha: r || { ok: false, code: 'error' } };
          this.$message.error(this.$t(resultKey(r && r.code)));
        }
      } catch (e) {
        this.$message.error(errText(e) || this.$t('home.result.error'));
      } finally {
        this.importing = false;
      }
    },

    async act(d, action) {
      if (this.busy) return;
      this.busy = `${d.id}:${action}`;
      try {
        const r = await homeApi.act(d.id, action);
        if (r && r.ok) this.$message.success(this.$t('home.devices.done', { name: d.name }));
        else this.$message.error(this.$t('home.devices.failed', { name: d.name, why: this.$t(resultKey(r && r.code)) }));
      } catch (e) {
        this.$message.error(errText(e) || this.$t('home.result.error'));
      } finally {
        this.busy = '';
      }
    },

    openEdit(d) {
      this.edit = editState(d);
      this.editErrors = {};
      this.sheet = true;
    },
    async saveDevice() {
      if (this.savingDevice) return;
      const mqtt = this.edit.source === 'mqtt';
      const problems = deviceProblems(this.edit, mqtt);
      if (Object.keys(problems).length) { this.editErrors = problems; return; }
      this.savingDevice = true;
      try {
        const body = deviceBody(this.edit, mqtt);
        const saved = this.edit.id ? await homeApi.updateDevice(this.edit.id, body) : await homeApi.addDevice(body);
        const i = this.devices.findIndex((x) => x.id === saved.id);
        if (i >= 0) this.devices.splice(i, 1, saved);
        else this.devices.push(saved);
        this.sheet = false;
        this.$message.success(this.$t('home.savedToast'));
      } catch (e) {
        this.$message.error(errText(e) || this.$t('home.result.error'));
      } finally {
        this.savingDevice = false;
      }
    },
    async removeDevice() {
      const d = this.edit;
      try {
        await this.$confirm(this.$t('home.edit.deleteConfirm', { name: d.name }), this.$t('home.edit.delete'),
          { confirmText: this.$t('home.edit.delete'), cancelText: this.$t('home.edit.cancel'), danger: true });
      } catch (e) { return; }
      this.deleting = true;
      try {
        await homeApi.deleteDevice(d.id);
        this.devices = this.devices.filter((x) => x.id !== d.id);
        this.sheet = false;
        this.$message.success(this.$t('home.edit.deleted'));
      } catch (e) {
        this.$message.error(errText(e) || this.$t('home.result.error'));
      } finally {
        this.deleting = false;
      }
    },
  },
};
</script>

<style>
.home { padding-bottom: var(--tb-s8); }
.home__state { padding: var(--tb-s10) 0; display: grid; justify-items: center; }
.home__saved { display: inline-flex; align-items: center; gap: 6px; color: var(--tb-ok); font-weight: 600; white-space: nowrap; }
.home__saved::before { content: ''; width: 14px; border-top: 2px solid currentColor; }

/* What to say: a ruled strip of three spoken lines */
.home-say { margin: var(--tb-s4) 0 0; padding: var(--tb-s4) 0; border-top: 2px solid var(--tb-rule); border-bottom: 1px solid var(--tb-rule-soft); display: grid; gap: var(--tb-s2); }
.home-say__title { font-weight: 600; font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.home-say__lines { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--tb-s2) var(--tb-s6); }
.home-say__lines li { font: 700 var(--tb-fs-20)/1.3 var(--tb-font-display); color: var(--tb-ink); }
.home-say__note { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }

/* Devices: ruled rows */
.home-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule); }
.home-row {
  display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; gap: 4px var(--tb-s4); align-items: center;
  padding: 12px 0; border-bottom: 1px solid var(--tb-rule-soft);
}
.home-row.is-off .home-row__name { color: var(--tb-ink-3); }
.home-row__kind { display: grid; line-height: var(--tb-lh-tight); }
.home-row__kind b { font: 700 var(--tb-fs-16)/1.2 var(--tb-font-display); }
.home-row__kind small { color: var(--tb-ink-3); font-size: var(--tb-fs-12); margin-top: 2px; }
.home-row__body { min-width: 0; display: grid; gap: 4px; }
.home-row__name { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--tb-fs-16); font-weight: 600; overflow-wrap: anywhere; }
.home-row__aliases { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--tb-fs-14); color: var(--tb-ink-2); }
.home-row__alias::before { content: '“'; color: var(--tb-ink-3); }
.home-row__alias::after { content: '”'; color: var(--tb-ink-3); }
.home-row__none { color: var(--tb-ink-3); font-size: var(--tb-fs-13); }
.home-row__id { color: var(--tb-ink-3); font-size: var(--tb-fs-12); overflow-wrap: anywhere; }
.home-row__acts { display: flex; align-items: center; gap: 6px; }
.home-pill.tb-btn { border-radius: var(--tb-radius-pill); min-width: 64px; }

/* Settings forms */
.home-form { display: grid; border-top: 1px solid var(--tb-rule-soft); }
.home-form__row { padding: var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule-soft); }
.home-form__row.tb-field.is-inline { grid-template-columns: minmax(150px, 220px) minmax(0, 520px); }
.home-form__num { max-width: 160px; }
.home-form__switch { display: flex; align-items: center; min-height: 52px; }
.home-form__foot { display: flex; align-items: center; justify-content: flex-end; gap: var(--tb-s3); flex-wrap: wrap; padding-top: var(--tb-s4); }
.home-result { margin-right: auto; font-size: var(--tb-fs-14); min-height: 1.5em; }
.home-result.is-ok { color: var(--tb-ok); font-weight: 600; }
.home-result.is-bad { color: var(--tb-danger); }

/* Edit sheet */
.home-edit { display: grid; gap: var(--tb-s4); }
.home-edit__pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--tb-s3); }
.home-edit__entity { font-size: var(--tb-fs-13); color: var(--tb-ink-2); overflow-wrap: anywhere; }
.home-edit__del { justify-self: start; }

@media (max-width: 640px) {
  .home-row { grid-template-columns: 64px minmax(0, 1fr); }
  .home-row__acts { grid-column: 2; }
  .home-form__row.tb-field.is-inline { grid-template-columns: 1fr; }
  .home-form__num { max-width: none; }
  .home-form__foot .tb-btn { flex: 1 1 auto; }
  .home-result { flex-basis: 100%; }
  .home-edit__pair { grid-template-columns: 1fr; }
}
</style>
