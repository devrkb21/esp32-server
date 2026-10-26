<template>
  <TbSection id="ch-kids" ink="ink" :title="$t('kids.title')" :description="$t('kids.desc')">
    <template #actions>
      <TbSync v-if="loaded" v-bind="sync" />
    </template>

    <div v-if="!loaded && !failed" class="ch-kids__state"><TbLoading :label="$t('kids.loading')" show-label /></div>
    <TbEmpty v-else-if="failed && !loaded" :title="$t('kids.loadFailed')" :text="$t('common.loadFailed')">
      <TbButton icon="refresh" @click="load">{{ $t('common.retry') }}</TbButton>
    </TbEmpty>

    <div v-else class="ch-kids" :class="{ 'is-off': !form.enabled }">
      <div class="ch-kids__row">
        <span class="ch-kids__text"><b>{{ $t('kids.enabled') }}</b><small>{{ $t('kids.enabledHint') }}</small></span>
        <TbSwitch v-model="form.enabled" :aria-label="$t('kids.enabled')" />
      </div>

      <div class="ch-kids__age" role="group" :aria-labelledby="'ch-kids-age'">
        <span id="ch-kids-age" class="ch-kids__label">{{ $t('kids.age') }}</span>
        <p class="ch-kids__num tb-num" aria-hidden="true">{{ num(form.age) }}</p>
        <TbSlider v-model="form.age" :min="MIN_AGE" :max="MAX_AGE" :step="1" :disabled="!form.enabled"
          :aria-label="$t('kids.age')" :value-text="$t('kids.ageValue', { n: num(form.age) })" />
        <small class="ch-kids__hint">{{ $t('kids.ageHint') }}</small>
      </div>

      <div class="ch-kids__topics" role="group" :aria-labelledby="'ch-kids-topics'">
        <span id="ch-kids-topics" class="ch-kids__label">{{ $t('kids.topics') }}</span>
        <small class="ch-kids__hint">{{ $t('kids.topicsHint') }}</small>
        <ul v-if="form.blockedTopics.length" class="ch-kids__chips">
          <li v-for="t in form.blockedTopics" :key="t" class="ch-kids__chip">
            <span class="ch-kids__chip-name" :title="t">{{ t }}</span>
            <button type="button" class="ch-kids__x" :disabled="!form.enabled" :aria-label="$t('kids.remove', { name: t })" @click="remove(t)">
              <TbIcon name="close" :size="14" /></button>
          </li>
        </ul>
        <p v-else class="ch-muted">{{ $t('kids.noTopics') }}</p>
        <form class="ch-kids__add" @submit.prevent="add(draft)">
          <TbInput v-model="draft" :maxlength="MAX_TOPIC_LEN" :disabled="!form.enabled || full" :placeholder="$t('kids.topicPlaceholder')"
            :aria-label="$t('kids.topicInput')" />
          <TbButton native-type="submit" icon="plus" :disabled="!form.enabled || full || !draft.trim()">{{ $t('kids.add') }}</TbButton>
        </form>
        <p v-if="full" class="ch-kids__hint tb-num">{{ $t('kids.max', { n: num(MAX_TOPICS) }) }}</p>
        <div v-if="suggestions.length" class="ch-kids__suggest">
          <span class="ch-kids__hint">{{ $t('kids.suggest') }}</span>
          <TbButton v-for="s in suggestions" :key="s" size="s" variant="quiet" icon="plus" :disabled="!form.enabled || full" @click="add(s)">{{ s }}</TbButton>
        </div>
      </div>

      <figure class="ch-kids__sample">
        <figcaption>{{ $t('kids.sample') }}</figcaption>
        <blockquote lang="bn">{{ $t('kids.sampleLine') }}</blockquote>
      </figure>

      <footer v-if="dirty" class="ch-kids__foot">
        <TbButton :disabled="saving" @click="undo">{{ $t('common.undo') }}</TbButton>
        <TbButton variant="primary" :loading="saving" @click="save">{{ $t('common.save') }}</TbButton>
      </footer>
    </div>
  </TbSection>
</template>

<script>
import aiApi from '@/apis/module/ai';
import { digits } from '@/kit/calendar';
import {
  MAX_AGE, MAX_TOPICS, MAX_TOPIC_LEN, MIN_AGE, SUGGESTED, addTopic, hasTopic, kidsSignature, normalizeKids, removeTopic,
} from './kidsModel';

// Kids mode of the character: on/off, the child's age (3-12) and topics TinyBot never talks
// about. Saved on its own (PUT /agent/{id}/kids), apart from the page's save bar; the robot
// follows it from its next chat. API: ai.getKids, ai.saveKids.
export default {
  name: 'KidsSection',
  props: { agentId: { type: String, required: true } },
  data() {
    return {
      MIN_AGE, MAX_AGE, MAX_TOPICS, MAX_TOPIC_LEN,
      form: normalizeKids(null),
      saved: normalizeKids(null),
      draft: '',
      loaded: false,
      failed: false,
      saving: false,
      seq: 0,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    dirty() { return this.loaded && kidsSignature(this.form) !== kidsSignature(this.saved); },
    full() { return this.form.blockedTopics.length >= MAX_TOPICS; },
    suggestions() {
      return SUGGESTED.map((k) => this.$t(`kids.t.${k}`)).filter((s) => !hasTopic(this.form.blockedTopics, s));
    },
    sync() {
      if (this.dirty) return { state: 'pending', text: this.$t('kids.syncPending') };
      return this.saved.enabled ? { state: 'applied', text: this.$t('kids.syncOn') } : { state: 'off', text: this.$t('kids.syncOff') };
    },
  },
  watch: {
    agentId() { this.load(); },
  },
  created() { this.load(); },
  methods: {
    num(n) { return digits(n, this.lang); },
    load() {
      if (!this.agentId) return;
      const seq = ++this.seq;
      this.failed = false;
      try {
        aiApi.getKids(this.agentId, ({ data }) => {
          if (seq !== this.seq) return;
          if (data && data.code === 0) {
            this.saved = normalizeKids(data.data);
            this.form = normalizeKids(data.data);
            this.loaded = true;
          } else {
            this.failed = true;
          }
        }, () => {
          if (seq === this.seq) this.failed = true;
        });
      } catch (e) {
        this.failed = true;
      }
    },
    add(topic) {
      this.form.blockedTopics = addTopic(this.form.blockedTopics, topic);
      if (topic === this.draft) this.draft = '';
    },
    remove(topic) { this.form.blockedTopics = removeTopic(this.form.blockedTopics, topic); },
    undo() { this.form = normalizeKids(this.saved); this.draft = ''; },
    save() {
      const body = normalizeKids(this.form);
      this.saving = true;
      const failed = (msg) => {
        this.saving = false;
        this.$message.error(msg || this.$t('kids.saveFailed'));
      };
      aiApi.saveKids(this.agentId, body, ({ data }) => {
        if (!data || data.code !== 0) { failed(data && data.msg); return; }
        this.saving = false;
        this.saved = normalizeKids(data.data || body);
        this.form = normalizeKids(this.saved);
        this.$message.success(this.$t('kids.saved'));
      }, (res) => failed(res && res.data && res.data.msg));
    },
  },
};
</script>

<style>
.ch-kids { display: grid; gap: var(--tb-s5); }
.ch-kids__state { padding: var(--tb-s6) 0; display: grid; justify-items: center; }
.ch-kids__row { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-s4); padding-bottom: var(--tb-s4); border-bottom: 1px solid var(--tb-rule-soft); }
.ch-kids__text { display: grid; gap: 2px; min-width: 0; }
.ch-kids__text small, .ch-kids__hint { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.ch-kids__label { font-weight: 600; }
.ch-kids__age { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px var(--tb-s5); }
.ch-kids__age .ch-kids__label, .ch-kids__age .ch-kids__hint { grid-column: 1 / -1; }
.ch-kids__num { font-family: var(--tb-font-display); font-weight: 800; font-size: var(--tb-fs-48); line-height: var(--tb-lh-tight); min-width: 2ch; }
.ch-kids__topics { display: grid; gap: var(--tb-s2); }
.ch-kids__chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.ch-kids__chip { display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 4px 0 12px; border: 1px solid var(--tb-alarm);
  border-radius: var(--tb-radius-pill); color: var(--tb-alarm); max-width: 100%; }
.ch-kids__chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-kids__x { display: inline-grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 50%; background: none; color: inherit; cursor: pointer;
  transition: background-color var(--tb-t-hover) var(--tb-ease); }
.ch-kids__x:hover:not(:disabled) { background: var(--tb-paper-2); }
.ch-kids__x:disabled { cursor: default; opacity: .5; }
.ch-kids__add { display: flex; gap: 8px; align-items: center; max-width: 520px; }
.ch-kids__add .tb-input { flex: 1; min-width: 0; }
.ch-kids__suggest { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.ch-kids__sample { margin: 0; padding: var(--tb-s3) 0 0; border-top: 1px solid var(--tb-rule-soft); display: grid; gap: 4px; }
.ch-kids__sample figcaption { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.ch-kids__sample blockquote { margin: 0; font-size: var(--tb-fs-16); line-height: var(--tb-lh-text); }
.ch-kids__foot { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.ch-kids.is-off .ch-kids__age, .ch-kids.is-off .ch-kids__topics { opacity: .6; transition: opacity var(--tb-t-fast) var(--tb-ease); }
</style>
