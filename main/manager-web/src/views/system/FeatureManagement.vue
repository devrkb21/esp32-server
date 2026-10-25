<template>
  <div class="feat">
    <TbPageHeader :title="$t('system.features.title')" :description="$t('system.features.desc')">
      <template #actions>
        <TbTag v-if="pendingChanges" ink="warn" mark role="status">{{ $t('system.features.unsaved') }}</TbTag>
        <TbButton icon="refresh" :disabled="isSaving" @click="handleReset">{{ $t('system.features.reset') }}</TbButton>
        <TbButton variant="primary" icon="check" :loading="isSaving" @click="handleSave">
          {{ isSaving ? $t('common.saving') : $t('system.features.save') }}</TbButton>
      </template>
    </TbPageHeader>

    <div v-if="!ready" class="sys-state"><TbLoading :label="$t('system.features.loading')" show-label /></div>

    <TbEmpty v-else-if="!allFeatures.length" face="confused" :title="$t('system.features.none')" :text="$t('system.features.noneText')" />

    <template v-else>
      <TbSection v-for="group in groups" :key="group.key" :title="$t(`system.features.group.${group.key}`)"
        :description="$t(`system.features.groupDesc.${group.key}`)">
        <template #actions>
          <span class="feat__count tb-num">{{ $t('system.features.onCount', { on: num(onCount(group)), n: num(group.features.length) }) }}</span>
        </template>
        <ul class="feat__list">
          <li v-for="f in group.features" :key="f.id" class="feat__row" :class="{ 'is-on': f.enabled, 'is-busy': isSaving }"
            @click="toggleFeature(f)">
            <TbIcon class="feat__icon" :name="icons[f.id] || 'feature'" :size="20" />
            <div class="feat__text">
              <span :id="`feat-${f.id}`" class="feat__name">{{ $t(`system.features.f.${f.id}.name`) }}</span>
              <span class="feat__desc">{{ $t(`system.features.f.${f.id}.desc`) }}</span>
            </div>
            <span class="feat__ctl" @click.stop>
              <span class="feat__state" aria-hidden="true">{{ f.enabled ? $t('system.on') : $t('system.off') }}</span>
              <TbSwitch :model-value="f.enabled" :disabled="isSaving" :aria-label="$t(`system.features.f.${f.id}.name`)"
                @update:model-value="toggleFeature(f)" />
            </span>
          </li>
        </ul>
      </TbSection>

      <div class="feat__foot">
        <TbButton size="s" :icon="isAllSelected ? 'minus' : 'check'" :disabled="isSaving" @click="toggleSelectAll">
          {{ isAllSelected ? $t('system.features.allOff') : $t('system.features.allOn') }}</TbButton>
      </div>
    </template>
  </div>
</template>

<script>
import featureManager from '@/utils/featureManager.js';
import { digits } from '@/kit/calendar';
import './system.css';

// Features (back office, super admins; owner: web-system). Behaviour of the legacy
// FeatureManagement.vue: two groups of switches read from featureManager (the server's
// system-web.menu param), changed locally, saved together; reset restores the defaults and
// reloads the app; reloads when another tab saves (featureConfigReloaded).
const GROUPS = {
  featureManagement: ['voiceprintRecognition', 'voiceClone', 'knowledgeBase', 'mcpAccessPoint', 'addressBook'],
  voiceManagement: ['vad', 'asr'],
};

export default {
  name: 'FeatureManagement',
  data() {
    return {
      ready: false,
      pendingChanges: false,
      featureManagementFeatures: [],
      voiceManagementFeatures: [],
      isSaving: false,
      icons: {
        voiceprintRecognition: 'voiceprint',
        voiceClone: 'voice',
        knowledgeBase: 'book',
        mcpAccessPoint: 'link',
        addressBook: 'addressbook',
        vad: 'volume',
        asr: 'chat',
      },
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    groups() {
      return [
        { key: 'featureManagement', features: this.featureManagementFeatures },
        { key: 'voiceManagement', features: this.voiceManagementFeatures },
      ].filter((g) => g.features.length > 0);
    },
    allFeatures() { return [...this.featureManagementFeatures, ...this.voiceManagementFeatures]; },
    isAllSelected() { return this.allFeatures.length > 0 && this.allFeatures.every((f) => f.enabled); },
  },
  async created() {
    try {
      await featureManager.waitForInitialization();
    } catch (e) {
      // fall through: the manager answers with its defaults
    }
    await this.loadFeatures();
    this.ready = true;
    this.configChangeHandler = () => { this.loadFeatures(); };
    window.addEventListener('featureConfigReloaded', this.configChangeHandler);
  },
  beforeUnmount() {
    if (this.configChangeHandler) window.removeEventListener('featureConfigReloaded', this.configChangeHandler);
    clearTimeout(this.reloadTimer);
  },
  methods: {
    num(n) { return digits(n ?? '', this.lang); },
    onCount(group) { return group.features.filter((f) => f.enabled).length; },
    async getFeaturesByIds(ids) {
      try {
        const config = await featureManager.getAllFeatures();
        return ids.map((id) => ({ id, enabled: !!(config && config[id] && config[id].enabled) }));
      } catch (e) {
        return ids.map((id) => ({ id, enabled: false }));
      }
    },
    async loadFeatures() {
      // Unsaved choices survive a reload of the stored config.
      const local = {};
      if (this.pendingChanges) this.allFeatures.forEach((f) => { local[f.id] = f.enabled; });
      const a = await this.getFeaturesByIds(GROUPS.featureManagement);
      const b = await this.getFeaturesByIds(GROUPS.voiceManagement);
      [...a, ...b].forEach((f) => { if (Object.prototype.hasOwnProperty.call(local, f.id)) f.enabled = local[f.id]; });
      this.featureManagementFeatures = a;
      this.voiceManagementFeatures = b;
    },
    toggleFeature(f) {
      if (this.isSaving) return;
      f.enabled = !f.enabled;
      this.pendingChanges = true;
    },
    toggleSelectAll() {
      if (this.isSaving) return;
      const next = !this.isAllSelected;
      this.allFeatures.forEach((f) => { f.enabled = next; });
      this.pendingChanges = true;
    },
    async handleSave() {
      if (!this.pendingChanges) {
        this.$message.info(this.$t('system.features.noChanges'));
        return;
      }
      this.isSaving = true;
      try {
        const updates = {};
        this.allFeatures.forEach((f) => { updates[f.id] = f.enabled; });
        await featureManager.updateFeatures(updates);
        this.pendingChanges = false;
        this.$message.success(this.$t('system.features.saved'));
        this.reloadTimer = setTimeout(() => { this.loadFeatures(); }, 1000);
      } catch (e) {
        this.$message.error(this.$t('system.features.saveFailed'));
      } finally {
        this.isSaving = false;
      }
    },
    async handleReset() {
      try {
        await this.$confirm(this.$t('system.features.resetText'), this.$t('system.features.resetTitle'), {
          confirmText: this.$t('system.features.reset'), cancelText: this.$t('common.cancel'), danger: true,
        });
      } catch (e) {
        return; // cancelled
      }
      featureManager.resetToDefault();
      this.pendingChanges = false;
      await this.loadFeatures();
      this.$message.success(this.$t('system.features.resetDone'));
      // The menu and every page read the flags at start: reload the app, as the legacy page did.
      this.reloadTimer = setTimeout(() => { this.loadFeatures(); this.$router.go(0); }, 1000);
    },
  },
};
</script>

<style>
.feat { padding-bottom: var(--tb-s8); }
.feat__count { color: var(--tb-ink-2); font-size: var(--tb-fs-13); white-space: nowrap; }
.feat__list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule); }
.feat__row {
  display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: var(--tb-s3);
  padding: var(--tb-s3) var(--tb-s2) var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule-soft); cursor: pointer;
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.feat__row.is-busy { cursor: default; }
@media (hover: hover) and (pointer: fine) { .feat__row:not(.is-busy):hover { background: var(--tb-paper-2); } }
.feat__icon { color: var(--tb-ink-3); justify-self: center; transition: color var(--tb-t-hover) var(--tb-ease); }
.feat__row.is-on .feat__icon { color: var(--tb-ink); }
.feat__text { display: grid; gap: 2px; min-width: 0; }
.feat__name { font-weight: 600; }
.feat__desc { color: var(--tb-ink-2); font-size: var(--tb-fs-14); max-width: 68ch; }
.feat__ctl { display: inline-flex; align-items: center; gap: var(--tb-s2); cursor: default; }
.feat__state { min-width: 3.2em; text-align: right; font-size: var(--tb-fs-13); color: var(--tb-ink-3); }
.feat__row.is-on .feat__state { color: var(--tb-ok); font-weight: 600; }
.feat__foot { padding-top: var(--tb-s4); }

@media (max-width: 640px) {
  .feat__row { grid-template-columns: minmax(0, 1fr) auto; padding-right: 0; }
  .feat__icon { display: none; }
  .feat__state { display: none; }
  .feat__ctl .tb-switch { min-height: var(--tb-target); }
  .feat__foot .tb-btn { min-height: var(--tb-target); width: 100%; }
}
</style>
