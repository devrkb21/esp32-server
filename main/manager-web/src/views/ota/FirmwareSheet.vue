<template>
  <TbSheet :open="open" :title="f.id ? $t('ota.sheet.edit') : $t('ota.sheet.add')" size="m"
    :close-label="$t('common.close')" @update:open="$emit('update:open', $event)">
    <form :id="formId" class="fw" novalidate @submit.prevent="submit">
      <div class="fw__file">
        <p class="fw__label">{{ $t('ota.f.file') }}<span v-if="!f.id" class="fw__req" aria-hidden="true">*</span></p>
        <TbUpload ref="upload" v-model="picked" accept=".bin,.apk" :disabled="uploading"
          :text="$t('ota.f.fileText')" :hint="$t('ota.f.fileHint')" @files="onFiles" />

        <div v-if="uploading" class="fw__progress" role="status">
          <div class="fw__bar" :class="{ 'is-open': !progress }" role="progressbar" :aria-label="$t('ota.f.progress')"
            aria-valuemin="0" aria-valuemax="100" :aria-valuenow="progress || null">
            <span :style="{ transform: `scaleX(${progress / 100})` }"></span>
          </div>
          <p class="fw__line">
            <TbLoading v-if="!progress" />
            <span>{{ $t('ota.f.uploading', { name: fileName }) }}</span>
            <b v-if="progress" class="tb-num">{{ num(progress) }}%</b>
          </p>
        </div>

        <div v-else-if="uploaded" class="fw__done">
          <TbIcon name="check" :size="18" />
          <span class="fw__done-text">{{ $t('ota.f.uploaded', { name: fileName, size: sizeText(f.size, lang) }) }}</span>
          <TbButton size="s" variant="quiet" icon="close" @click="removeFile">{{ $t('ota.f.removeFile') }}</TbButton>
        </div>

        <p v-else-if="f.id && f.firmwarePath" class="fw__note">{{ $t('ota.f.keepFile') }}</p>

        <p v-if="errors.firmwarePath" class="fw__error" role="alert">{{ $t(errors.firmwarePath) }}</p>
        <p class="fw__hint"><TbIcon name="info" :size="16" />{{ $t('ota.f.appBin') }}</p>
      </div>

      <TbField :label="$t('ota.f.name')" for-id="fw-name" required :error="errText('firmwareName')">
        <TbInput id="fw-name" v-model="f.firmwareName" :placeholder="$t('ota.f.namePh')" :invalid="!!errors.firmwareName"
          @blur="check('firmwareName')" />
      </TbField>

      <div class="fw__pair">
        <TbField :label="$t('ota.f.type')" for-id="fw-type" required :error="errText('type')"
          :hint="f.id ? $t('ota.f.typeLocked') : ''">
          <TbSelect id="fw-type" v-model="f.type" :options="options" :placeholder="$t('ota.f.typePh')"
            :disabled="!!f.id" :invalid="!!errors.type" @change="check('type')" />
        </TbField>
        <TbField :label="$t('ota.f.version')" for-id="fw-version" required :error="errText('version')"
          :hint="errors.version ? '' : $t('ota.f.versionHint')">
          <TbInput id="fw-version" v-model="f.version" inputmode="decimal" :placeholder="$t('ota.f.versionPh')"
            :invalid="!!errors.version" @blur="check('version')" />
        </TbField>
      </div>

      <TbField :label="$t('ota.f.remark')" for-id="fw-remark">
        <TbTextarea id="fw-remark" v-model="f.remark" :rows="3" :placeholder="$t('ota.f.remarkPh')" />
      </TbField>
    </form>

    <template #footer>
      <TbButton variant="quiet" @click="$emit('update:open', false)">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" native-type="submit" :form="formId" :loading="saving" :disabled="uploading">
        {{ $t('common.save') }}
      </TbButton>
    </template>
  </TbSheet>
</template>

<script>
import Api from '@/apis/api';
import { digits } from '@/kit/calendar';
import { emptyForm, fieldError, fileError, formErrors, sizeText, typeOptions } from './otaModel';

// The upload-and-describe sheet of the Firmware page (was FirmwareDialog). The file uploads as
// soon as it is picked (POST /otaMag/upload); Save hands the whole form to the page.
export default {
  name: 'FirmwareSheet',
  props: {
    open: Boolean,
    form: { type: Object, default: () => emptyForm() },
    types: { type: Array, default: () => [] },
    saving: Boolean,
  },
  emits: ['update:open', 'submit'],
  data() {
    return {
      f: emptyForm(),
      errors: {},
      picked: [],
      fileName: '',
      progress: 0,
      uploading: false,
      uploaded: false,
      formId: `fw-form-${Math.random().toString(36).slice(2, 8)}`,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    options() { return typeOptions(this.types); },
  },
  watch: {
    open: { immediate: true, handler(v) { if (v) this.reset(); } },
  },
  methods: {
    sizeText,
    num(n) { return digits(n, this.lang); },
    errText(field) { return this.errors[field] ? this.$t(this.errors[field]) : ''; },
    reset() {
      this.f = { ...emptyForm(), ...this.form };
      if (!this.f.id) { this.f.firmwarePath = ''; this.f.size = 0; }
      this.errors = {};
      this.picked = [];
      this.fileName = '';
      this.progress = 0;
      this.uploading = false;
      this.uploaded = false;
    },
    check(field) {
      const e = fieldError(field, this.f);
      const next = { ...this.errors };
      if (e) next[field] = e; else delete next[field];
      this.errors = next;
    },
    onFiles(files) {
      const file = files && files[0];
      if (!file) return;
      const problem = fileError(file);
      if (problem) {
        this.$message.error(this.$t(problem));
        this.$refs.upload?.reset();
        return;
      }
      this.upload(file);
    },
    upload(file) {
      this.fileName = file.name;
      this.progress = 0;
      this.uploading = true;
      this.uploaded = false;
      Api.ota.uploadFirmware(file, (res) => {
        const body = res.data || {};
        this.uploading = false;
        if (body.code === 0) {
          this.f.firmwarePath = body.data;
          this.f.size = file.size;
          this.progress = 100;
          this.uploaded = true;
          const next = { ...this.errors }; delete next.firmwarePath; this.errors = next;
          this.$message.success(this.$t('ota.f.uploadOk'));
        } else {
          this.$message.error(body.msg || this.$t('ota.f.uploadFailed'));
          this.$refs.upload?.reset();
        }
      }, (e) => {
        // Reported only when the request layer passes upload progress on (see the open request).
        if (e && e.total) this.progress = Math.min(99, Math.round((e.loaded * 100) / e.total));
      });
    },
    removeFile() {
      this.f.firmwarePath = '';
      this.f.size = 0;
      this.progress = 0;
      this.uploaded = false;
      this.fileName = '';
      this.$refs.upload?.reset();
    },
    submit() {
      if (this.saving || this.uploading) return;
      this.errors = formErrors(this.f);
      if (this.errors.firmwarePath && Object.keys(this.errors).length === 1) {
        this.$message.error(this.$t('ota.err.fileRequired'));
      }
      if (Object.keys(this.errors).length) return;
      this.$emit('submit', { ...this.f, firmwareName: this.f.firmwareName.trim(), version: this.f.version.trim() });
    },
  },
};
</script>

<style>
.fw { display: grid; gap: var(--tb-s4); }
.fw__file { display: grid; gap: 8px; padding-bottom: var(--tb-s4); border-bottom: 1px solid var(--tb-rule-soft); }
.fw__label { font-weight: 600; font-size: var(--tb-fs-14); }
.fw__req { color: var(--tb-alarm); margin-left: 2px; }
.fw__progress { display: grid; gap: 6px; }
.fw__bar { position: relative; height: 3px; background: var(--tb-rule-soft); overflow: hidden; }
.fw__bar span {
  position: absolute; inset: 0; background: var(--tb-ink); transform-origin: left center;
  transition: transform var(--tb-t-sheet) var(--tb-ease);
}
.fw__bar.is-open span { display: none; }
.fw__line { display: flex; align-items: center; gap: 10px; font-size: var(--tb-fs-13); color: var(--tb-ink-2); min-width: 0; }
.fw__line span { min-width: 0; overflow-wrap: anywhere; }
.fw__line b { margin-left: auto; color: var(--tb-ink); }
.fw__done {
  display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 3px solid var(--tb-ok);
  color: var(--tb-ok); font-size: var(--tb-fs-14);
}
.fw__done-text { flex: 1; min-width: 0; color: var(--tb-ink); overflow-wrap: anywhere; }
.fw__note { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.fw__error { font-size: var(--tb-fs-13); color: var(--tb-danger); font-weight: 500; }
.fw__hint { display: flex; gap: 8px; align-items: flex-start; font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.fw__hint .tb-icon { flex: none; margin-top: 2px; }
.fw__pair { display: grid; gap: var(--tb-s4); grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); }
#fw-version { font-variant-numeric: tabular-nums; }
@media (max-width: 520px) { .fw__pair { grid-template-columns: minmax(0, 1fr); } }
</style>
