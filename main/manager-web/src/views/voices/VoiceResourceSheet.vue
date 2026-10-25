<template>
  <TbSheet :open="open" :title="$t('voices.res.add')" size="m" :close-on-scrim="false" :close-label="$t('common.close')"
    @update:open="$emit('update:open', $event)">
    <form id="vrs-form" class="vrs" novalidate @submit.prevent="submit">
      <TbField :label="$t('voices.col.platform')" :error="errors.modelId" required for-id="vrs-platform">
        <TbSelect id="vrs-platform" v-model="form.modelId" :options="platformOptions" :invalid="!!errors.modelId"
          :placeholder="platformsLoading ? $t('common.loading') : $t('voices.res.platformPlaceholder')"
          @change="onPlatformChange" />
      </TbField>

      <TbField :label="$t('voices.res.voiceIds')" :hint="$t('voices.res.voiceIdsHint')" :error="errors.voiceIds" required for-id="vrs-voice">
        <div class="vrs-chips" :class="{ 'is-invalid': !!errors.voiceIds }">
          <span v-for="(v, i) in form.voiceIds" :key="v" class="vrs-chip">
            <code>{{ v }}</code>
            <button type="button" class="vrs-chip__x" :aria-label="$t('voices.res.removeVoiceId', { id: v })" @click="removeVoiceId(i)">
              <TbIcon name="close" :size="14" />
            </button>
          </span>
          <input id="vrs-voice" v-model="voiceDraft" class="vrs-chips__input" type="text" autocomplete="off"
            :placeholder="form.voiceIds.length ? '' : $t('voices.res.voiceIdsPlaceholder')"
            @keydown.enter.prevent="addVoiceId" @keydown="onChipKey" @blur="addVoiceId" />
        </div>
      </TbField>

      <div class="vrs-two">
        <TbField :label="$t('voices.col.owner')" :error="errors.userId" required for-id="vrs-owner">
          <div v-if="owner" class="vrs-owner">
            <TbIcon name="user" :size="18" />
            <span class="vrs-owner__name tb-num">{{ owner.mobile || owner.username || owner.userid }}</span>
            <TbButton size="s" variant="quiet" @click="clearOwner">{{ $t('voices.res.changeOwner') }}</TbButton>
          </div>
          <template v-else>
            <TbInput id="vrs-owner" v-model="ownerQuery" icon="search" clearable :invalid="!!errors.userId"
              :placeholder="$t('voices.res.ownerPlaceholder')" :clear-label="$t('voices.clear')" inputmode="tel"
              @update:model-value="searchOwners" />
            <p v-if="usersLoading" class="vrs-note"><TbLoading :label="$t('common.loading')" show-label /></p>
            <ul v-else-if="users.length" class="vrs-users" role="listbox" :aria-label="$t('voices.col.owner')">
              <li v-for="u in users" :key="u.userid" role="option" :aria-selected="form.userId === u.userid ? 'true' : 'false'">
                <button type="button" class="vrs-users__opt" @click="pickOwner(u)">
                  <span class="tb-num">{{ u.mobile || u.username || u.userid }}</span>
                  <TbIcon name="chevron-right" :size="16" />
                </button>
              </li>
            </ul>
            <p v-else-if="ownerQuery && searched" class="vrs-note">{{ $t('voices.res.noOwner') }}</p>
          </template>
        </TbField>

        <TbField :label="$t('voices.col.languages')" :error="errors.languages" required for-id="vrs-lang">
          <TbInput id="vrs-lang" v-model="form.languages" :invalid="!!errors.languages"
            :placeholder="$t('voices.res.languagesPlaceholder')" @blur="checkLanguages" />
        </TbField>
      </div>
    </form>

    <template #footer>
      <TbButton @click="$emit('update:open', false)">{{ $t('common.cancel') }}</TbButton>
      <TbButton variant="primary" native-type="submit" form="vrs-form" :loading="saving">{{ $t('voices.res.add') }}</TbButton>
    </template>
  </TbSheet>
</template>

<script>
import Api from '@/apis/api';

const blank = () => ({ modelId: '', voiceIds: [], userId: null, languages: '' });

export default {
  name: 'VoiceResourceSheet',
  props: {
    open: Boolean,
    saving: Boolean,
  },
  emits: ['update:open', 'submit'],
  data() {
    return {
      form: blank(),
      errors: {},
      platforms: [],
      platformsLoading: false,
      voiceDraft: '',
      ownerQuery: '',
      owner: null,
      users: [],
      usersLoading: false,
      searched: false,
      timer: null,
      seq: 0,
    };
  },
  computed: {
    platformOptions() {
      return this.platforms.map((p) => ({ value: p.id, label: p.modelName || p.id }));
    },
  },
  watch: {
    open: {
      immediate: true,
      handler(v) {
        if (v) this.reset();
      },
    },
  },
  beforeUnmount() {
    clearTimeout(this.timer);
  },
  methods: {
    reset() {
      this.form = blank();
      this.errors = {};
      this.voiceDraft = '';
      this.ownerQuery = '';
      this.owner = null;
      this.users = [];
      this.searched = false;
      this.fetchPlatforms();
    },
    fetchPlatforms() {
      this.platformsLoading = true;
      Api.voiceResource.getTtsPlatformList((res) => {
        this.platformsLoading = false;
        if (res.data.code === 0) this.platforms = res.data.data || [];
      });
    },
    onPlatformChange() {
      // A different platform has its own voice IDs: start the list again.
      this.form.voiceIds = [];
      this.errors = { ...this.errors, modelId: '' };
    },
    addVoiceId() {
      const parts = this.voiceDraft.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      for (const id of parts) if (!this.form.voiceIds.includes(id)) this.form.voiceIds.push(id);
      this.voiceDraft = '';
      if (this.form.voiceIds.length) this.errors = { ...this.errors, voiceIds: '' };
    },
    onChipKey(e) {
      if (e.key === ',') { e.preventDefault(); this.addVoiceId(); }
      if (e.key === 'Backspace' && !this.voiceDraft && this.form.voiceIds.length) this.form.voiceIds.pop();
    },
    removeVoiceId(i) {
      this.form.voiceIds.splice(i, 1);
    },
    searchOwners(query) {
      clearTimeout(this.timer);
      const q = String(query || '').trim();
      if (!q) {
        this.users = [];
        this.searched = false;
        this.usersLoading = false;
        return;
      }
      this.timer = setTimeout(() => {
        const mine = ++this.seq;
        this.usersLoading = true;
        Api.admin.getUserList({ page: 1, limit: 20, mobile: q }, (res) => {
          if (mine !== this.seq) return;
          this.usersLoading = false;
          this.searched = true;
          if (res.data.code === 0) this.users = (res.data.data && res.data.data.list) || [];
        });
      }, 300);
    },
    pickOwner(u) {
      this.owner = u;
      this.form.userId = u.userid;
      this.errors = { ...this.errors, userId: '' };
    },
    clearOwner() {
      this.owner = null;
      this.form.userId = null;
    },
    checkLanguages() {
      this.errors = { ...this.errors, languages: this.form.languages.trim() ? '' : this.$t('voices.res.languagesRequired') };
    },
    validate() {
      this.addVoiceId();
      const e = {};
      if (!this.form.modelId) e.modelId = this.$t('voices.res.platformRequired');
      if (!this.form.voiceIds.length) e.voiceIds = this.$t('voices.res.voiceIdsRequired');
      if (this.form.userId === null || this.form.userId === undefined || this.form.userId === '') e.userId = this.$t('voices.res.ownerRequired');
      if (!this.form.languages.trim()) e.languages = this.$t('voices.res.languagesRequired');
      this.errors = e;
      return !Object.keys(e).length;
    },
    submit() {
      if (this.saving || !this.validate()) return;
      this.$emit('submit', { ...this.form, voiceIds: [...this.form.voiceIds], languages: this.form.languages.trim() });
    },
  },
};
</script>

<style>
.vrs { display: grid; gap: var(--tb-s4); }
.vrs-two { display: grid; gap: var(--tb-s4); grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
.vrs-chips {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 44px; padding: 5px 8px;
  border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-m); background: var(--tb-paper);
  transition: border-color var(--tb-t-hover) var(--tb-ease), box-shadow var(--tb-t-hover) var(--tb-ease);
}
.vrs-chips:focus-within { border-color: var(--tb-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tb-focus) 25%, transparent); }
.vrs-chips.is-invalid { border-color: var(--tb-danger); }
.vrs-chips__input { flex: 1 1 140px; min-width: 0; height: 32px; border: 0; outline: none; background: transparent; font-size: max(16px, var(--tb-fs-15)); }
.vrs-chips__input::placeholder { color: var(--tb-ink-3); }
.vrs-chip {
  display: inline-flex; align-items: center; gap: 2px; max-width: 100%; height: 30px; padding: 0 2px 0 10px;
  border: 1px solid var(--tb-rule-soft); border-radius: var(--tb-radius-pill); background: var(--tb-paper-2);
}
.vrs-chip code { font: 600 var(--tb-fs-13)/1 var(--tb-font-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vrs-chip__x { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 50%; background: none; color: var(--tb-ink-2); }
.vrs-chip__x:hover { background: var(--tb-paper); color: var(--tb-ink); }
.vrs-owner {
  display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 4px 0 12px;
  border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-m);
}
.vrs-owner__name { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vrs-users { list-style: none; margin: 4px 0 0; padding: 0; max-height: 200px; overflow-y: auto; border-top: 1px solid var(--tb-rule); }
.vrs-users__opt {
  display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 44px; padding: 0 8px;
  border: 0; border-bottom: 1px solid var(--tb-rule-soft); background: none; text-align: left; font-size: var(--tb-fs-14);
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.vrs-users__opt:hover { background: var(--tb-paper-2); }
.vrs-note { padding-top: 6px; font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
@media (max-width: 560px) {
  .vrs-two { grid-template-columns: minmax(0, 1fr); }
}
</style>
