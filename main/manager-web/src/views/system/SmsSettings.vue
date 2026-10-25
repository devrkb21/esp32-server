<template>
  <div class="sms">
    <TbPageHeader :title="$t('sms.title')" :description="$t('sms.desc')">
      <template v-if="ready" #actions>
        <TbButton icon="refresh" :loading="loading" :disabled="loading || saving" @click="load()">{{ $t('sms.refresh') }}</TbButton>
      </template>
    </TbPageHeader>

    <div v-if="!ready && !failed" class="sms__state"><TbLoading :label="$t('sms.loading')" show-label /></div>
    <TbEmpty v-else-if="!ready" face="confused" :title="$t('sms.loadFailed')" :text="$t('sms.loadFailedText')">
      <TbButton icon="refresh" @click="load()">{{ $t('common.retry') }}</TbButton>
    </TbEmpty>

    <form v-else class="sms__form" novalidate @submit.prevent="save">
      <p v-if="failed" class="sms__fail" role="alert">{{ $t('sms.loadFailed') }}
        <TbButton size="s" variant="quiet" icon="refresh" @click="load()">{{ $t('common.retry') }}</TbButton></p>

      <TbSection :title="$t('sms.sec.gateway')" :description="$t('sms.sec.gatewayDesc')">
        <div class="sms__rows">
          <div class="sms__row sms__provider">
            <span class="sms__label">{{ $t('sms.provider') }}</span>
            <span class="sms__provname">REVE SMS <small>{{ $t('sms.providerNote') }}</small></span>
          </div>
          <TbField class="sms__row" inline :label="$t('sms.baseUrl')" :hint="$t('sms.baseUrlHint')" :error="errors.baseUrl" for-id="sms-base-url">
            <TbInput id="sms-base-url" v-model="form.baseUrl" :invalid="!!errors.baseUrl" inputmode="url" :maxlength="300"
              @update:model-value="touch('baseUrl')" />
          </TbField>
          <TbField class="sms__row" inline :label="$t('sms.callerId')" :hint="$t('sms.callerIdHint')" :error="errors.callerId" for-id="sms-caller-id">
            <TbInput id="sms-caller-id" v-model="form.callerId" :invalid="!!errors.callerId" :maxlength="40"
              @update:model-value="touch('callerId')" />
          </TbField>
        </div>
      </TbSection>

      <TbSection :title="$t('sms.sec.keys')" :description="$t('sms.sec.keysDesc')">
        <div class="sms__rows">
          <TbField v-for="key in ['apiKey', 'secretKey']" :key="key" class="sms__row" inline :label="$t(`sms.${key}`)"
            :hint="secretHint(key)" :error="errors[key]" :for-id="`sms-${key}`">
            <TbInput :id="`sms-${key}`" v-model="form[key]" type="password" autocomplete="new-password" :invalid="!!errors[key]"
              :placeholder="params[key].saved ? mask : $t('sms.notSet')" :maxlength="300"
              :show-label="$t('sms.show')" :hide-label="$t('sms.hide')" @update:model-value="touch(key)">
              <template v-if="params[key].saved && !form[key]" #suffix>
                <span class="sms__saved" :data-saved="key">{{ $t('sms.saved') }}</span>
              </template>
            </TbInput>
          </TbField>
        </div>
      </TbSection>

      <TbSection :title="$t('sms.sec.message')" :description="$t('sms.sec.messageDesc', { token: '{code}' })">
        <div class="sms__msg">
          <TbField :label="$t('sms.codeMessage')" :hint="$t('sms.codeMessageHint', { token: '{code}' })" :error="errors.codeMessage"
            for-id="sms-code-message">
            <TbTextarea id="sms-code-message" v-model="form.codeMessage" :rows="5" autosize :invalid="!!errors.codeMessage"
              :maxlength="1000" @update:model-value="touch('codeMessage')" />
          </TbField>
          <figure class="sms__preview" aria-live="polite">
            <figcaption class="sms__label">{{ $t('sms.preview') }}
              <span class="sms__sample">{{ $t('sms.previewSample', { code: SAMPLE_CODE }) }}</span></figcaption>
            <p class="sms__bubble" :class="{ 'is-empty': !preview }">{{ preview || $t('sms.previewEmpty') }}</p>
            <dl class="sms__count">
              <div><dt class="tb-num">{{ num(parts.length) }}</dt><dd>{{ $t('sms.unit.chars') }}</dd></div>
              <div><dt class="tb-num" :class="{ 'is-many': parts.parts > 1 }">{{ num(parts.parts) }}</dt><dd>{{ $t('sms.unit.parts') }}</dd></div>
            </dl>
            <p class="sms__enc" data-test="sms-enc">{{ $t(`sms.enc.${parts.encoding}`) }}
              <span v-if="parts.length">{{ $t('sms.left', { n: num(parts.left) }) }}</span></p>
          </figure>
        </div>
      </TbSection>

      <TbSection :title="$t('sms.sec.signup')" :description="$t('sms.sec.signupDesc')">
        <div class="sms__rows">
          <TbField class="sms__row" inline :label="$t('sms.maxCount')" :hint="$t('sms.maxCountHint')" :error="errors.maxCount" for-id="sms-max-count">
            <TbInput id="sms-max-count" v-model="form.maxCount" class="sms__num" inputmode="numeric" :invalid="!!errors.maxCount" :maxlength="6"
              @update:model-value="touch('maxCount')">
              <template #suffix>{{ $t('sms.perNumber') }}</template>
            </TbInput>
          </TbField>
          <div class="sms__row sms__switch">
            <span class="sms__swtext">
              <span class="sms__label" id="sms-register-label">{{ $t('sms.register') }}</span>
              <small>{{ $t('sms.registerHint') }}</small>
              <small v-if="form.register && !gatewayOk" class="sms__needs">{{ $t('sms.registerNeeds') }}</small>
              <span v-if="errors.register" class="sms__err" role="alert" data-test="register-error">{{ errors.register }}</span>
            </span>
            <TbSwitch v-model="form.register" :disabled="saving" :aria-label="$t('sms.register')" @update:model-value="touch('register')" />
          </div>
        </div>
      </TbSection>

      <footer class="sms__foot">
        <TbSync :state="syncState" :text="$t(`sms.state.${syncWord}`)" />
        <TbButton variant="primary" icon="check" native-type="submit" :loading="saving" :disabled="saving || loading">
          {{ saving ? $t('sms.state.saving') : $t('sms.save') }}</TbButton>
      </footer>
    </form>
  </div>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { callWithTimeout, collectAll, FETCH_LIMIT } from './systemModel';
import {
  SAMPLE_CODE, SECRET_MASK, SMS_PARAMS, callParam, changedFields, fieldProblems, gatewayReady, paramBody, previewText,
  readState, registerChanged, smsParts,
} from './smsModel';

// SMS gateway (back office, super admins). The server sends verification SMS through REVE SMS;
// its settings are system params. The list is read once: secret values are never kept or shown,
// only whether one is saved, and a key is sent only when a new one is typed. Missing params are
// added. Mobile sign-up is saved last, after every other field, and the server's refusal is shown.
export default {
  name: 'SmsSettings',
  data() {
    return {
      ready: false,
      loading: false,
      failed: false,
      saving: false,
      saveFailed: false,
      params: null,
      form: {},
      baseline: {},
      errors: {},
      seq: 0,
      mask: SECRET_MASK,
      SAMPLE_CODE,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    preview() { return previewText(this.form.codeMessage); },
    parts() { return smsParts(this.preview); },
    gatewayOk() { return this.params ? gatewayReady(this.form, this.params) : false; },
    dirty() {
      if (!this.params) return false;
      return changedFields(this.form, this.baseline).length > 0 || registerChanged(this.form, this.baseline);
    },
    syncState() {
      if (this.saving) return 'pending';
      if (this.saveFailed) return 'error';
      return this.dirty ? 'pending' : 'applied';
    },
    syncWord() {
      if (this.saving) return 'saving';
      if (this.saveFailed) return 'error';
      return this.dirty ? 'dirty' : 'saved';
    },
  },
  created() { this.load(); },
  methods: {
    num(n) { return digits(n ?? '', this.lang); },
    secretHint(key) {
      if (this.form[key]) return this.$t('sms.secretHintNew');
      return this.$t(this.params[key].saved ? 'sms.secretHintSaved' : 'sms.secretHintEmpty');
    },
    touch(key) {
      if (this.errors[key]) this.errors = { ...this.errors, [key]: '' };
      this.saveFailed = false;
    },

    fetchRows() {
      return collectAll((page) => callWithTimeout((cb) => Api.admin.getParamsList({ page, limit: FETCH_LIMIT, paramCode: '' }, cb))
        .then((res) => {
          const data = res && res.data;
          if (data && data.code === 0) return data.data || {};
          throw new Error((data && data.msg) || '');
        }));
    },
    async load() {
      const seq = ++this.seq;
      this.loading = true;
      this.failed = false;
      try {
        const rows = await this.fetchRows();
        if (seq !== this.seq) return;
        const s = readState(rows);
        this.params = s.params;
        this.form = s.form;
        this.baseline = s.baseline;
        this.errors = {};
        this.saveFailed = false;
        this.ready = true;
      } catch (e) {
        if (seq !== this.seq) return;
        this.failed = true;
        if (e && e.message) this.$message.error(e.message);
      } finally {
        if (seq === this.seq) this.loading = false;
      }
    },
    // After an add: learn the new ids, keep what is on the form.
    async refreshIds() {
      const rows = await this.fetchRows();
      const s = readState(rows);
      for (const key of Object.keys(s.params)) {
        const saved = this.params[key] && this.params[key].saved;
        this.params[key] = { ...s.params[key], ...(SMS_PARAMS[key] && SMS_PARAMS[key].secret ? { saved: saved || s.params[key].saved } : {}) };
      }
    },
    send(key, value) {
      const body = paramBody(key, value, this.params);
      const fn = this.params[key].exists ? Api.admin.updateParam : Api.admin.addParam;
      return callParam(fn.bind(Api.admin), body);
    },
    fail(key, msg, fallback) {
      const text = msg || this.$t(fallback);
      this.errors = { ...this.errors, [key]: text };
      this.$message.error(text);
      this.saveFailed = true;
    },

    async save() {
      if (this.saving) return;
      const keys = changedFields(this.form, this.baseline);
      const reg = registerChanged(this.form, this.baseline);
      if (!keys.length && !reg) { this.$message.info(this.$t('sms.nothing')); return; }
      const problems = fieldProblems(this.form, keys);
      if (Object.keys(problems).length) {
        const errors = { ...this.errors };
        for (const [k, msg] of Object.entries(problems)) errors[k] = this.$t(msg, { token: '{code}' });
        this.errors = errors;
        this.saveFailed = true;
        this.$message.error(this.$t('sms.fixFields'));
        return;
      }
      this.saving = true;
      this.saveFailed = false;
      try {
        let added = false;
        for (const key of keys) {
          const r = await this.send(key, this.form[key]);
          if (!r.ok) { this.fail(key, r.msg, 'sms.err.save'); return; }
          if (!this.params[key].exists) added = true;
          if (SMS_PARAMS[key].secret) {
            this.params[key] = { ...this.params[key], saved: true };
            this.form[key] = '';
          } else {
            this.baseline = { ...this.baseline, [key]: this.form[key] };
          }
        }
        if (added) await this.refreshIds();

        if (reg) {
          const want = !!this.form.register;
          if (!this.params.register.exists) {
            // Added off first, then turned on through an update, so the server checks the gateway.
            const r0 = await this.send('register', 'false');
            if (!r0.ok) { this.fail('register', r0.msg, 'sms.err.register'); return; }
            await this.refreshIds();
            this.baseline = { ...this.baseline, register: false };
          }
          if (want || this.baseline.register) {
            const r = await this.send('register', want ? 'true' : 'false');
            if (!r.ok) {
              this.form.register = this.baseline.register; // the stored value did not change
              this.fail('register', r.msg, 'sms.err.register');
              return;
            }
          }
          this.baseline = { ...this.baseline, register: want };
        }
        this.$message.success(this.$t('sms.savedToast'));
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style>
.sms { padding-bottom: var(--tb-s8); }
.sms__state { padding: var(--tb-s10) 0; display: grid; justify-items: center; }
.sms__fail { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--tb-danger); font-size: var(--tb-fs-14); padding-top: var(--tb-s3); }

.sms__rows { display: grid; border-top: 1px solid var(--tb-rule-soft); }
.sms__row { padding: var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule-soft); }
.sms__row:last-child { border-bottom: 0; padding-bottom: 0; }
.sms__row.tb-field.is-inline { grid-template-columns: minmax(150px, 220px) minmax(0, 520px); }
.sms__label { font-weight: 600; font-size: var(--tb-fs-14); color: var(--tb-ink); }
.sms__provider { display: grid; grid-template-columns: minmax(150px, 220px) 1fr; column-gap: var(--tb-s4); align-items: baseline; min-height: 52px; align-content: center; }
.sms__provname { font: 800 var(--tb-fs-20)/1.2 var(--tb-font-display); letter-spacing: .01em; }
.sms__provname small { margin-left: 8px; font: 500 var(--tb-fs-13)/1 var(--tb-font-text); color: var(--tb-ink-2); letter-spacing: 0; }
.sms__saved { display: inline-flex; align-items: center; gap: 6px; color: var(--tb-ok); font-weight: 600; white-space: nowrap; }
.sms__saved::before { content: ''; width: 14px; border-top: 2px solid currentColor; }
.sms__num { max-width: 240px; }

.sms__msg { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--tb-s6); align-items: start; }
.sms__preview { margin: 0; display: grid; gap: var(--tb-s3); }
.sms__preview figcaption { display: flex; justify-content: space-between; gap: var(--tb-s3); flex-wrap: wrap; }
.sms__sample { font-weight: 500; font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.sms__bubble {
  margin: 0; padding: var(--tb-s3) var(--tb-s4); border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-m) var(--tb-radius-m) var(--tb-radius-m) 2px;
  background: var(--tb-paper); white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; min-height: 64px;
}
.sms__bubble.is-empty { color: var(--tb-ink-3); border-style: dashed; }
.sms__count { display: flex; gap: var(--tb-s6); margin: 0; padding-top: var(--tb-s2); border-top: 1px solid var(--tb-rule); }
.sms__count div { display: flex; align-items: baseline; gap: 8px; }
.sms__count dt { font: 800 var(--tb-fs-32)/1 var(--tb-font-display); color: var(--tb-ink); }
.sms__count dt.is-many { color: var(--tb-action); }
.sms__count dd { margin: 0; color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.sms__enc { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.sms__enc span { display: block; }

.sms__switch { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s4); min-height: 64px; }
.sms__swtext { display: grid; gap: 2px; min-width: 0; max-width: 62ch; }
.sms__swtext small { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.sms__swtext .sms__needs { color: var(--tb-alarm); }
.sms__err { color: var(--tb-danger); font-size: var(--tb-fs-13); font-weight: 500; }

.sms__foot { display: flex; align-items: center; justify-content: flex-end; gap: var(--tb-s4); flex-wrap: wrap; padding: var(--tb-s5) 0; }

@media (max-width: 860px) {
  .sms__msg { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .sms__row.tb-field.is-inline, .sms__provider { grid-template-columns: 1fr; }
  .sms__num { max-width: none; }
  .sms__foot { justify-content: space-between; }
  .sms__foot .tb-btn { flex: 1 1 auto; }
}
</style>
