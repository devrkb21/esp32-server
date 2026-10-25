<template>
  <TbSheet :open="open" size="l" :title="form.id ? $t('words.sheet.editTitle') : $t('words.sheet.addTitle')"
    :close-label="$t('common.close')" @update:open="$emit('update:open', $event)">
    <form id="words-sheet-form" class="ws" novalidate @submit.prevent="submit">
      <div class="ws__edit">
        <TbField :label="$t('words.sheet.fileName')" for-id="ws-name" required :error="errors.fileName">
          <TbInput id="ws-name" v-model="fileName" :invalid="!!errors.fileName" :placeholder="$t('words.sheet.fileNamePlaceholder')"
            @update:model-value="errors.fileName = ''" @blur="checkName" />
        </TbField>

        <TbField :label="$t('words.sheet.content')" for-id="ws-content" required :error="errors.content">
          <TbTextarea id="ws-content" v-model="content" class="ws__text" :rows="10" :invalid="!!errors.content"
            :placeholder="$t('words.sheet.contentPlaceholder')" @update:model-value="errors.content = ''" @blur="checkText" />
        </TbField>
        <p class="ws__meta">
          <span class="ws__tip"><TbIcon name="info" :size="16" />{{ $t('words.sheet.formatTip') }}</span>
          <span class="ws__count tb-num" :class="{ 'is-over': overLimit }" aria-live="polite">
            {{ $t('words.sheet.count', { n: num(count), max: num(max) }) }}
          </span>
        </p>

        <TbUpload ref="upload" v-model="files" accept=".txt,text/plain" :text="$t('words.sheet.upload')"
          :hint="$t('words.sheet.uploadHint')" @files="readFile" />
      </div>

      <section class="ws__preview" :aria-labelledby="'ws-preview-h'">
        <h3 id="ws-preview-h" class="ws__ph">{{ $t('words.sheet.preview') }}</h3>
        <table v-if="preview.length" class="ws__pairs">
          <caption class="tb-visually-hidden">{{ $t('words.sheet.preview') }}</caption>
          <thead>
            <tr>
              <th scope="col" class="ws__n">{{ $t('words.sheet.line') }}</th>
              <th scope="col">{{ $t('words.sheet.original') }}</th>
              <th scope="col" class="ws__arrow" aria-hidden="true"></th>
              <th scope="col">{{ $t('words.sheet.replacement') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in preview" :key="r.n" :class="{ 'is-bad': r.problem }">
              <td class="ws__n tb-num">{{ num(r.n) }}</td>
              <template v-if="r.problem">
                <td colspan="3" class="ws__bad">
                  <span class="ws__raw">{{ r.text }}</span>
                  <small>{{ $t(`words.problem.${r.problem}`) }}</small>
                </td>
              </template>
              <template v-else>
                <td class="ws__word">{{ r.original }}</td>
                <td class="ws__arrow" aria-hidden="true"><TbIcon name="chevron-right" :size="14" /></td>
                <td class="ws__word">{{ r.replacement }}</td>
              </template>
            </tr>
          </tbody>
        </table>
        <p v-else class="ws__none">{{ $t('words.sheet.previewEmpty') }}</p>
        <p v-if="moreLines > 0" class="ws__more tb-num">{{ $t('words.sheet.previewMore', { n: num(moreLines) }) }}</p>
      </section>
    </form>

    <template #footer>
      <TbButton @click="$emit('update:open', false)">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" native-type="submit" form="words-sheet-form" :loading="saving">{{ $t('common.save') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script>
import { digits } from '@/kit/calendar';
import { MAX_PAIRS, checkContent, checkFileName, contentText, numberedLines, pairCount, previewRows, validLines } from './wordsModel';

const PREVIEW_ROWS = 12;

// Add or edit one replacement-word file: a name, the pairs (typed or read from a .txt file),
// and a live preview of how each line will be read, with the legacy dialog's checks.
export default {
  name: 'ReplacementWordSheet',
  props: {
    open: Boolean,
    form: { type: Object, default: () => ({ id: undefined, fileName: '', content: '' }) },
    saving: Boolean,
  },
  emits: ['update:open', 'submit'],
  data() {
    return { fileName: '', content: '', files: [], errors: { fileName: '', content: '' }, max: MAX_PAIRS };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    count() { return pairCount(this.content); },
    overLimit() { return this.count > this.max; },
    preview() { return previewRows(this.content, PREVIEW_ROWS); },
    moreLines() { return Math.max(0, numberedLines(this.content).length - PREVIEW_ROWS); },
  },
  watch: {
    open: {
      immediate: true,
      handler(v) {
        if (!v) return;
        this.fileName = this.form.fileName || '';
        this.content = contentText(this.form.content);
        this.errors = { fileName: '', content: '' };
        this.files = [];
      },
    },
  },
  methods: {
    num(v) { return digits(v, this.lang); },
    problemText(p) {
      if (!p) return '';
      if (p.code === 'fileNameRequired') return this.$t('words.sheet.fileNameRequired');
      if (p.code === 'required') return this.$t('words.problem.required');
      if (p.code === 'tooMany') return this.$t('words.problem.tooMany', { max: this.num(p.max) });
      return this.$t('words.problem.atLine', { line: this.num(p.line), problem: this.$t(`words.problem.${p.code}`) });
    },
    checkName() { this.errors.fileName = this.problemText(checkFileName(this.fileName)); return !this.errors.fileName; },
    checkText() { this.errors.content = this.problemText(checkContent(this.content)); return !this.errors.content; },
    readFile(files) {
      const file = files && files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.content = String(e.target.result || '');
        this.errors.content = '';
        if (validLines(this.content).length > this.max) {
          this.$message.warning(this.$t('words.problem.tooMany', { max: this.num(this.max) }));
        }
        // the same file can be chosen again after an edit
        if (this.$refs.upload) this.$refs.upload.reset();
      };
      reader.onerror = () => { this.$message.error(this.$t('words.sheet.readFailed')); };
      reader.readAsText(file);
    },
    submit() {
      const nameOk = this.checkName();
      const textOk = this.checkText();
      if (!nameOk || !textOk) {
        this.$nextTick(() => document.getElementById('words-sheet-form')?.querySelector('[aria-invalid="true"]')?.focus());
        return;
      }
      if (this.overLimit) {
        this.$message.error(this.$t('words.problem.tooMany', { max: this.num(this.max) }));
        return;
      }
      this.$emit('submit', { id: this.form.id, fileName: this.fileName, content: validLines(this.content) });
    },
  },
};
</script>

<style>
.ws { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: var(--tb-s6); align-items: start; }
.ws__edit { display: grid; gap: var(--tb-s3); min-width: 0; }
.ws__text textarea { min-height: 220px; }
.ws__meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; margin-top: -4px; font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.ws__tip { display: inline-flex; align-items: flex-start; gap: 6px; }
.ws__tip .tb-icon { flex: none; margin-top: 3px; }
.ws__count { font-weight: 600; color: var(--tb-ink); }
.ws__count.is-over { color: var(--tb-danger); }
.ws .tb-upload { padding: var(--tb-s4); }

.ws__preview { min-width: 0; border-top: var(--tb-rule-band) solid var(--tb-rule); padding-top: var(--tb-s2); }
.ws__ph { font-size: var(--tb-fs-15); margin-bottom: var(--tb-s2); }
.ws__pairs { width: 100%; table-layout: fixed; font-size: var(--tb-fs-14); }
.ws__pairs th { text-align: left; font: 600 var(--tb-fs-12)/1.3 var(--tb-font-text); color: var(--tb-ink-2); padding: 6px 6px; border-bottom: 1px solid var(--tb-rule); }
.ws__pairs td { padding: 6px; border-bottom: 1px solid var(--tb-rule-soft); vertical-align: top; }
.ws__n { width: 3.2em; color: var(--tb-ink-3); text-align: right; }
th.ws__n { text-align: right; }
.ws__arrow { width: 22px; padding-inline: 0 !important; color: var(--tb-orange); }
.ws__arrow .tb-icon { margin-top: 4px; }
.ws__word { overflow-wrap: anywhere; }
.ws__pairs tr.is-bad td { color: var(--tb-danger); }
.ws__bad { display: table-cell; }
.ws__raw { display: block; overflow-wrap: anywhere; color: var(--tb-ink); }
.ws__bad small { display: block; font-size: var(--tb-fs-12); font-weight: 600; }
.ws__none, .ws__more { font-size: var(--tb-fs-13); color: var(--tb-ink-2); padding: 8px 0; }

@media (max-width: 760px) {
  .ws { grid-template-columns: minmax(0, 1fr); }
  .ws__text textarea { min-height: 180px; }
}
</style>
