<template>
  <TbSection :title="$t('day.tab.library')" :description="$t('dayVoice.library.desc')" ink="message">
    <template #actions>
      <TbSync v-bind="day.syncOf('library')" />
      <TbButton variant="primary" icon="plus" @click="openAdd">{{ $t('dayVoice.library.add') }}</TbButton>
    </template>

    <div class="day-library__kinds">
      <TbChoice v-model="kind" wrap :options="kindOptions" :aria-label="$t('dayVoice.library.kind')" />
    </div>
    <TbEmpty v-if="!items.length" face="sleepy" :title="$t('dayVoice.library.none')" :text="$t('dayVoice.library.emptyText')" />
    <ul v-else class="day-rows">
      <li v-for="it in items" :key="it.id" class="day-row day-row--library">
        <div class="day-row__main">
          <span class="day-library__kind"><TbTag ink="message">{{ $t(`dayVoice.library.kind.${it.kind}`) }}</TbTag></span>
          <span class="day-row__body">
            <span class="day-row__title">{{ it.title }}</span>
            <span class="day-row__meta">
              {{ it.text ? $t('dayVoice.library.byText') : $t('dayVoice.library.byLink') }}
              <TbTag v-if="it.source === 'default'" class="day-library__sample">{{ $t('dayVoice.library.sample') }}</TbTag>
            </span>
            <span v-if="it.text" class="day-row__say">{{ it.text }}</span>
            <span v-else class="day-row__say">{{ it.audio_url }}</span>
          </span>
        </div>
        <div class="day-row__acts">
          <TbButton size="s" icon="play" :loading="day.busy === `play:${it.id}`" @click="play(it)">{{ $t('dayVoice.library.play') }}</TbButton>
          <TbButton v-if="it.source !== 'default'" variant="quiet" icon="trash" :aria-label="$t('dayVoice.library.delete', { title: it.title })" @click="remove(it)" />
        </div>
      </li>
    </ul>

    <TbSheet v-model:open="sheet.open" :title="$t('dayVoice.library.add')" :close-label="$t('common.close')">
      <form v-if="sheet.form" id="day-library-form" class="day-form" @submit.prevent="save">
        <TbField :label="$t('dayVoice.library.title')" for-id="day-library-title" :error="sheet.error">
          <TbInput id="day-library-title" v-model="sheet.form.title" :maxlength="MAX_TITLE" />
        </TbField>
        <TbField :label="$t('dayVoice.library.kind')">
          <TbChoice v-model="sheet.form.kind" wrap :options="formKinds" :aria-label="$t('dayVoice.library.kind')" />
        </TbField>
        <TbField :label="$t('dayVoice.library.source')">
          <TbChoice v-model="sheet.form.source" :options="sourceOptions" :aria-label="$t('dayVoice.library.source')" />
        </TbField>
        <TbField v-if="sheet.form.source === 'link'" :label="$t('dayVoice.library.url')" :hint="$t('dayVoice.library.urlHint')" for-id="day-library-url">
          <TbInput id="day-library-url" v-model="sheet.form.url" type="url" :maxlength="MAX_URL" placeholder="https://" />
        </TbField>
        <TbField v-else :label="$t('dayVoice.library.text')" for-id="day-library-text">
          <TbTextarea id="day-library-text" v-model="sheet.form.text" :rows="5" autosize :maxlength="MAX_TEXT" show-count />
        </TbField>
      </form>
      <template #footer>
        <TbButton @click="sheet.open = false">{{ $t('common.cancel') }}</TbButton>
        <TbButton variant="primary" native-type="submit" form="day-library-form" :loading="!!day.saving.library">{{ $t('common.save') }}</TbButton>
      </template>
    </TbSheet>
  </TbSection>
</template>

<script>
import { LIBRARY_KINDS, MAX_TEXT, MAX_TITLE, MAX_URL, libraryOf, libraryPayload, libraryProblem } from './dayVoiceModel';

// The library: the robot's own items and the shared samples. Items are added or deleted one at a
// time ({library: {add} | {delete}} on the config); "play" is the command {type: 'play', arg: id}.
export default {
  name: 'DayLibrary',
  inject: ['day'],
  data() {
    return {
      MAX_TEXT, MAX_TITLE, MAX_URL,
      kind: '',
      sheet: { open: false, form: null, error: '' },
    };
  },
  computed: {
    items() { return libraryOf(this.day.view, this.kind); },
    kindOptions() {
      return [{ value: '', label: this.$t('common.all') }, ...this.formKinds];
    },
    formKinds() { return LIBRARY_KINDS.map((k) => ({ value: k, label: this.$t(`dayVoice.library.kind.${k}`) })); },
    sourceOptions() {
      return [{ value: 'text', label: this.$t('dayVoice.library.byText') }, { value: 'link', label: this.$t('dayVoice.library.byLink') }];
    },
  },
  methods: {
    openAdd() {
      this.sheet = { open: true, error: '', form: { title: '', kind: this.kind || 'story', source: 'text', url: '', text: '' } };
    },
    save() {
      const problem = libraryProblem(this.sheet.form);
      if (problem) {
        this.sheet.error = this.$t(problem);
        this.$message.warning(this.sheet.error);
        return;
      }
      this.sheet.error = '';
      this.day.save({ library: { add: libraryPayload(this.sheet.form) } }, 'library')
        .then(() => { this.sheet.open = false; })
        .catch(() => {});
    },
    play(it) {
      this.day.command('play', it.id, this.$t('dayVoice.library.playing'), `play:${it.id}`);
    },
    remove(it) {
      return this.$confirm(this.$t('dayVoice.library.confirmDelete', { title: it.title }), this.$t('dayVoice.library.deleteTitle'), {
        confirmText: this.$t('common.delete'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => this.day.save({ library: { delete: [it.id] } }, 'library', this.$t('day.deleted')))
        .catch(() => {});
    },
  },
};
</script>

<style>
.day-library__kinds { padding-bottom: var(--tb-s3); }
.day-row--library .day-row__main { cursor: default; }
.day-library__kind { padding-top: 2px; }
.day-library__sample { margin-left: 6px; vertical-align: middle; }
.day-row--library .day-row__acts { gap: 8px; }
@media (max-width: 640px) {
  .day-row--library { flex-wrap: wrap; }
  .day-row--library .day-row__acts { width: 100%; justify-content: flex-end; padding-bottom: 10px; }
}
</style>
