<template>
  <div class="ch" :class="{ 'is-dirty': isDirty }">
    <TbPageHeader :title="$t('nav.character')" :description="$t('character.lead')">
      <template v-if="agentId && agentConfigLoaded" #actions>
        <TbTag v-if="currentVersionNo" ink="ink-2" class="tb-num">{{ $t('character.version', { n: num(currentVersionNo) }) }}</TbTag>
        <TbButton icon="history" @click="showSnapshotDialog = true">{{ $t('character.history.open') }}</TbButton>
      </template>
    </TbPageHeader>

    <p v-if="agentId && readOnly" class="ch__readonly" role="status">{{ $t('family.characterReadOnly') }}</p>

    <div v-if="!agentId && robot.loaded" class="ch__state">
      <TbEmpty face="confused" :title="$t('common.noRobot')" :text="$t('common.noRobotText')">
        <TbButton variant="primary" to="/robots" icon="robots">{{ $t('common.goRobots') }}</TbButton>
      </TbEmpty>
    </div>
    <div v-else-if="loadFailed && !agentConfigLoaded" class="ch__state">
      <TbEmpty face="confused" :title="$t('roleConfig.fetchConfigFailed')" :text="$t('common.loadFailed')">
        <TbButton icon="refresh" @click="reloadAgentPage(agentId)">{{ $t('common.retry') }}</TbButton>
      </TbEmpty>
    </div>
    <div v-else-if="!firstLoaded" class="ch__state"><TbLoading :label="$t('character.loading')" show-label /></div>

    <div v-else class="ch__layout" :aria-busy="agentReloading ? 'true' : null">
      <nav class="ch__index" :aria-label="$t('character.index')">
        <a v-for="s in sections" :key="s.id" :href="`#ch-${s.id}`" class="ch__link" :class="{ 'is-on': activeSection === s.id }"
          :aria-current="activeSection === s.id ? 'true' : null" @click.prevent="scrollToSection(s.id)">
          <TbIcon :name="s.icon" :size="18" /><span>{{ s.label }}</span>
          <small v-if="s.count" class="tb-num">{{ s.count }}</small>
        </a>
      </nav>

      <div class="ch__sections" :class="{ 'is-busy': agentReloading }">
        <!-- The owner's daily LLM limit, when one is set (module usage) -->
        <QuotaNote />

        <!-- Who it is -->
        <TbSection id="ch-who" ink="ink" :title="$t('character.who.title')" :description="$t('character.who.desc')">
          <div class="ch-who">
            <TbField :label="$t('character.who.name')" for-id="ch-name">
              <TbInput id="ch-name" v-model="form.agentName" :maxlength="64" />
            </TbField>
            <div class="ch-tags" role="group" :aria-label="$t('character.who.tags')">
              <p class="ch-tags__label">{{ $t('character.who.tags') }}</p>
              <div class="ch-tags__list">
                <span v-for="tag in dynamicTags" :key="tag.id" class="ch-tag">
                  <span class="ch-tag__name" :title="tag.tagName">{{ tag.tagName }}</span>
                  <button type="button" class="ch-tag__x" :aria-label="$t('character.who.removeTag', { name: tag.tagName })" @click="handleClose(tag.id)">
                    <TbIcon name="close" :size="14" /></button>
                </span>
                <TbInput v-if="inputVisible" ref="tagInput" v-model="inputValue" size="s" class="ch-tags__input" :maxlength="20"
                  :aria-label="$t('character.who.tagInput')" @enter="handleInputConfirm" @blur="handleInputConfirm" />
                <TbButton v-else size="s" icon="plus" @click="showInput">{{ $t('character.who.addTag') }}</TbButton>
              </div>
            </div>
          </div>

          <div class="ch-prompt" :class="{ 'has-templates': templates.length }">
            <TbField :label="$t('character.who.prompt')" :hint="$t('character.who.promptHint')" for-id="ch-prompt">
              <TbTextarea id="ch-prompt" v-model="form.systemPrompt" autosize :rows="12" :maxlength="PROMPT_MAX"
                :placeholder="$t('character.who.promptPlaceholder')" />
              <p class="ch-count tb-num" :class="{ 'is-near': promptLength >= PROMPT_NEAR }" aria-live="polite">
                <span v-if="promptLength >= PROMPT_NEAR">{{ $t('character.who.nearLimit', { n: num(PROMPT_MAX - promptLength) }) }}</span>
                <span v-else>{{ num(promptLength) }} / {{ num(PROMPT_MAX) }}</span>
              </p>
            </TbField>
            <aside v-if="templates.length" class="ch-tpl" :aria-labelledby="'ch-tpl-h'">
              <h3 id="ch-tpl-h" class="ch-tpl__title">{{ $t('character.who.templates') }}</h3>
              <p class="ch-tpl__hint">{{ $t('character.who.templatesHint') }}</p>
              <ul class="ch-tpl__list">
                <li v-for="(tpl, i) in templates" :key="tpl.id || i">
                  <button type="button" class="ch-tpl__row" :disabled="loadingTemplate" @click="selectTemplate(tpl)">
                    <b>{{ tpl.agentName }}</b>
                    <span>{{ firstLine(tpl.systemPrompt) || $t('character.who.templateNoPrompt') }}</span>
                  </button>
                </li>
              </ul>
            </aside>
          </div>
        </TbSection>

        <!-- Voice and language -->
        <TbSection id="ch-voice" ink="ink" :title="$t('character.voice.title')" :description="$t('character.voice.desc')">
          <div class="ch-grid">
            <TbField :label="$t('character.voice.engine')" :hint="$t('character.voice.engineHint')" for-id="ch-tts">
              <TbSelect id="ch-tts" :model-value="form.model.ttsModelId" :options="selectOptions('TTS')" :placeholder="$t('character.select')"
                :disabled="voiceOptionsLoading" @update:model-value="onModel('TTS', 'ttsModelId', $event)" />
            </TbField>
            <TbField :label="$t('character.voice.language')" :hint="$t('character.voice.languageHint')" for-id="ch-lang">
              <TbSelect id="ch-lang" v-model="selectedLanguage" :options="languageOptions" :placeholder="$t('character.select')"
                :disabled="voiceOptionsLoading || !languageOptions.length" @change="handleLanguageChange" />
            </TbField>
          </div>
          <TbField :label="$t('character.voice.voice')" for-id="ch-voice-pick" :hint="voiceHint">
            <div class="ch-voice">
              <TbSelect id="ch-voice-pick" v-model="form.ttsVoiceId" :options="voiceOptions" :placeholder="$t('character.select')"
                :disabled="voiceOptionsLoading || !voiceOptions.length" @change="handleVoiceChange" />
              <TbButton :icon="isVoicePlaying(form.ttsVoiceId) ? 'pause' : 'play'" :disabled="!canPreviewSelectedVoice"
                :class="{ 'is-playing': isVoicePlaying(form.ttsVoiceId) }"
                @click="toggleAudioPlayback(form.ttsVoiceId)">{{ isVoicePlaying(form.ttsVoiceId) ? $t('character.voice.pause') : $t('character.voice.play') }}</TbButton>
            </div>
          </TbField>

          <div class="ch-tune" role="group" :aria-labelledby="'ch-tune-h'">
            <h3 id="ch-tune-h" class="ch-sub">{{ $t('character.voice.tuning') }}</h3>
            <p class="ch-sub__hint">{{ $t('character.voice.scaleHint') }}</p>
            <div v-for="s in sliders" :key="s.key" class="ch-tune__row">
              <span class="ch-tune__label" :id="`ch-tune-${s.key}`">{{ $t(s.label) }}</span>
              <TbSlider :model-value="Number(form[s.key]) || 0" :min="-100" :max="100" :step="1" :aria-label="$t(s.label)"
                :value-text="num(signed(form[s.key]))" @update:model-value="form[s.key] = $event" />
            </div>
          </div>

          <div class="ch-words" role="group" :aria-labelledby="'ch-words-h'">
            <h3 id="ch-words-h" class="ch-sub">{{ $t('character.voice.words') }}</h3>
            <p class="ch-sub__hint">{{ $t('character.voice.wordsHint') }}</p>
            <div v-if="replacementWordList.length" class="ch-words__list">
              <TbCheckbox v-for="w in replacementWordList" :key="w.id" v-model="checkedReplacementWordIds" :value="w.id" :label="w.fileName" />
            </div>
            <p v-else class="ch-muted">{{ $t('character.voice.wordsNone') }}</p>
          </div>
        </TbSection>

        <!-- How it thinks -->
        <TbSection id="ch-think" ink="ink" :title="$t('character.think.title')" :description="$t('character.think.desc')">
          <dl class="ch-models">
            <div v-for="field in modelFields" :key="field.key" class="ch-models__row" :id="`ch-row-${field.type}`">
              <dt><label :for="`ch-m-${field.key}`">{{ $t(`character.think.${field.type.toLowerCase()}`) }}</label>
                <small>{{ $t(`character.think.${field.type.toLowerCase()}Hint`) }}</small></dt>
              <dd><TbSelect :id="`ch-m-${field.key}`" :model-value="form.model[field.key]" :options="selectOptions(field.optionsType)"
                :placeholder="$t('character.select')" @update:model-value="onModel(field.onChange ? field.type : '', field.key, $event)" /></dd>
            </div>
            <div class="ch-models__row">
              <dt><label for="ch-m-mem">{{ $t('character.think.memory') }}</label><small>{{ $t('character.think.memoryHint') }}</small></dt>
              <dd><TbSelect id="ch-m-mem" :model-value="form.model.memModelId" :options="selectOptions('Memory')" :placeholder="$t('character.select')"
                @update:model-value="onModel('Memory', 'memModelId', $event)" /></dd>
            </div>
            <div v-if="form.model.memModelId !== NO_MEMORY" class="ch-models__row">
              <dt><span id="ch-hist-l">{{ $t('character.think.history') }}</span><small>{{ $t('character.think.historyHint') }}</small></dt>
              <dd><TbChoice v-model="form.chatHistoryConf" :options="historyOptions" :aria-label="$t('character.think.history')" wrap @change="updateChatHistoryConf" /></dd>
            </div>
          </dl>
          <TbField :label="$t('character.think.summary')" for-id="ch-summary"
            :hint="form.model.memModelId === LOCAL_SHORT_MEMORY ? $t('character.think.summaryHint') : $t('character.think.summaryLocked')">
            <TbTextarea id="ch-summary" v-model="form.summaryMemory" autosize :rows="4" :maxlength="2000" show-count
              :disabled="form.model.memModelId !== LOCAL_SHORT_MEMORY" />
          </TbField>
        </TbSection>

        <!-- What it can do -->
        <TbSection id="ch-can" ink="ink" :title="$t('character.can.title')" :description="$t('character.can.desc')">
          <div class="ch-block">
            <header class="ch-block__head">
              <h3 class="ch-sub">{{ $t('character.can.tools') }}
                <TbTag v-if="toolsEnabled && currentFunctions.length" ink="ok" class="tb-num">{{ $t('character.can.toolsOn', { n: num(currentFunctions.length) }) }}</TbTag></h3>
              <TbButton v-if="toolsEnabled" size="s" icon="settings" :disabled="agentReloading || !agentFunctionsLoaded" @click="manageAllTools">{{ $t('character.can.manage') }}</TbButton>
            </header>
            <TbEmpty v-if="!toolsEnabled" :title="$t('character.can.offTitle')" :text="$t('character.can.offText')">
              <TbButton size="s" @click="scrollToSection('think', 'ch-row-Intent')">{{ $t('character.can.goIntent') }}</TbButton>
            </TbEmpty>
            <div v-else-if="pluginMetadataLoading && !toolRows.length" class="ch-block__state"><TbLoading :label="$t('character.can.loading')" show-label /></div>
            <TbEmpty v-else-if="!toolRows.length" :title="$t('character.can.noneTitle')" :text="$t('character.can.noneText')" />
            <ul v-else class="ch-rows">
              <li v-for="tool in toolRows" :key="tool.id" class="ch-rows__row" :class="{ 'is-off': !tool.enabled }">
                <span class="ch-rows__text">
                  <b :title="tool.name">{{ tool.name }}</b>
                  <small>{{ tool.settings ? $t('character.can.settingsCount', { n: num(tool.settings) }) : $t('character.can.noSettings') }}</small>
                </span>
                <TbButton v-if="tool.enabled && tool.settings" size="s" variant="quiet" @click="configureTool(tool)">{{ $t('character.can.configure') }}</TbButton>
                <TbSwitch :model-value="tool.enabled" :aria-label="tool.name" :disabled="!pluginMetadataReady || agentReloading || !agentFunctionsLoaded"
                  @update:model-value="(v) => toggleTool(tool, v)" />
              </li>
            </ul>
          </div>

          <div v-if="featureStatus.mcpAccessPoint" class="ch-block">
            <header class="ch-block__head">
              <h3 class="ch-sub">{{ $t('character.mcp.title') }}
                <span class="ch-mcp__state" :class="`is-${mcpStatus}`" role="status">{{ $t(`character.mcp.${mcpStatus}`) }}</span></h3>
              <TbButton size="s" icon="refresh" :loading="mcpStatus === 'checking'" @click="refreshStatus">{{ $t('character.mcp.refresh') }}</TbButton>
            </header>
            <p class="ch-sub__hint">{{ $t('character.mcp.lead') }}</p>
            <div class="ch-mcp__url">
              <TbInput :model-value="mcpUrl" readonly :aria-label="$t('character.mcp.address')" />
              <TbButton icon="copy" :disabled="!mcpUrl" @click="copyUrl">{{ $t('character.mcp.copy') }}</TbButton>
            </div>
            <p class="ch-mcp__label">{{ $t('character.mcp.tools') }}</p>
            <p v-if="mcpTools.length" class="ch-mcp__tools">
              <TbTag v-for="tool in mcpTools" :key="tool" ink="ink-2">{{ tool }}</TbTag>
            </p>
            <p v-else class="ch-muted">{{ $t('character.mcp.noTools') }}</p>
          </div>

          <div class="ch-block">
            <header class="ch-block__head">
              <h3 class="ch-sub">{{ $t('character.context.title') }}</h3>
              <TbButton v-if="currentContextProviders.length" size="s" icon="edit" @click="showContextProviderDialog = true">{{ $t('character.context.edit') }}</TbButton>
            </header>
            <p class="ch-sub__hint">{{ $t('character.context.lead') }}</p>
            <ul v-if="currentContextProviders.length" class="ch-rows">
              <li v-for="(p, i) in currentContextProviders" :key="`ctx-${i}`" class="ch-rows__row">
                <TbIcon name="link" :size="18" class="ch-rows__icon" />
                <span class="ch-rows__text"><b class="ch-url" :title="p.url">{{ p.url }}</b>
                  <small>{{ $t('character.context.headerCount', { n: num(Object.keys(p.headers || {}).length) }) }}</small></span>
              </li>
            </ul>
            <TbEmpty v-else :title="$t('character.context.emptyTitle')">
              <TbButton icon="plus" @click="showContextProviderDialog = true">{{ $t('character.context.addSource') }}</TbButton>
            </TbEmpty>
          </div>
        </TbSection>

        <!-- Kids mode (module kids; saved on its own) -->
        <KidsSection v-if="kidsAllowed" :agent-id="agentId" />

        <!-- History -->
        <TbSection id="ch-history" ink="ink" :title="$t('character.history.title')" :description="$t('character.history.desc')">
          <ul class="ch-rows">
            <li class="ch-rows__row">
              <span class="ch-rows__text">
                <b>{{ $t('character.history.versions') }}</b>
                <small>{{ currentVersionNo ? $t('character.history.current', { n: num(currentVersionNo) }) : $t('character.history.noVersion') }}</small>
              </span>
              <TbButton size="s" icon="history" @click="showSnapshotDialog = true">{{ $t('character.history.open') }}</TbButton>
            </li>
            <li class="ch-rows__row">
              <span class="ch-rows__text"><b>{{ $t('character.history.resetTitle') }}</b><small>{{ $t('character.history.resetText') }}</small></span>
              <TbButton size="s" variant="danger" @click="resetConfig">{{ $t('character.history.resetButton') }}</TbButton>
            </li>
          </ul>
        </TbSection>
      </div>
    </div>

    <Transition name="ch-bar">
      <div v-if="isDirty" class="ch-save" role="region" :aria-label="$t('character.save.unsaved')">
        <p class="ch-save__text"><b role="status">{{ $t('character.save.unsaved') }}</b><span>{{ $t('character.save.restart') }}</span></p>
        <div class="ch-save__acts">
          <TbButton :disabled="saving" @click="undoChanges">{{ $t('common.undo') }}</TbButton>
          <TbButton variant="primary" :loading="saving" :disabled="configInteractionBlocked" @click="saveConfig">{{ $t('common.save') }}</TbButton>
        </div>
      </div>
    </Transition>

    <ToolsSheet v-if="agentId" v-model:open="showFunctionDialog" :functions="currentFunctions" :all-functions="allFunctions"
      :focus-name="functionDialogFocus" :address-book="featureStatus.addressBook"
      @update-functions="handleUpdateFunctions" @closed="handleDialogClosed" />
    <ContextSheet v-model:open="showContextProviderDialog" :providers="currentContextProviders" @confirm="handleUpdateContext" />
    <SnapshotSheet v-if="agentId && historyUsed" v-model:open="showSnapshotDialog" :agent-id="agentId" :current-version-no="currentVersionNo"
      @restored="handleSnapshotRestored" />
  </div>
</template>

<script>
import { defineAsyncComponent } from 'vue';
import Api, { getServiceUrl } from '@/apis/api';
import RequestService from '@/apis/httpRequest';
import correctWord from '@/apis/module/correctWord';
import featureManager from '@/utils/featureManager';
import { digits } from '@/kit/calendar';
import { agentRole, hasFeature, loadRobots, robot } from '@/shell/robot';
import ToolsSheet from './ToolsSheet.vue';
import ContextSheet from './ContextSheet.vue';
import KidsSection from './KidsSection.vue';
import QuotaNote from './QuotaNote.vue';
import {
  LOCAL_SHORT_MEMORY, MODEL_TYPES, NO_INTENT, NO_MEMORY, PROMPT_MAX, PROMPT_NEAR,
  applyMemoryChange, buildCurrentFunctions, buildSaveData, buildTtsDraft, clone, configSignature, emptyForm,
  enrichFunctions, hasAudioPreview, intentVisibility, normalizeFunctionParams, pluginCatalog, providerOf, signed,
  visiblePlugins, voiceAudioUrl, voiceOptionsOf, voicesForLanguage,
} from './characterModel';

// Character & voice: who TinyBot is when it talks. Same data, calls and rules as the legacy
// roleConfig.vue, grouped by intent: who it is, voice, how it thinks, what it can do, history.
export default {
  name: 'RoleConfig',
  // The version history carries the code-diff viewer: it loads the first time it is opened.
  components: { ToolsSheet, ContextSheet, KidsSection, QuotaNote, SnapshotSheet: defineAsyncComponent(() => import('./SnapshotSheet.vue')) },
  data() {
    return {
      robot,
      PROMPT_MAX, PROMPT_NEAR, NO_MEMORY, LOCAL_SHORT_MEMORY,
      showContextProviderDialog: false,
      showSnapshotDialog: false,
      historyUsed: false,
      showFunctionDialog: false,
      functionDialogFocus: '',
      tempSummaryMemory: '',
      form: emptyForm(),
      llmTypes: {},
      modelOptions: {},
      templates: [],
      loadingTemplate: false,
      voiceOptions: [],
      voiceDetails: {},
      languageOptions: [],
      selectedLanguage: '',
      ttsLanguageTouched: false,
      ttsVoiceTouched: false,
      voiceFetchSeq: 0,
      voiceOptionsLoading: false,
      lastValidTtsDraft: null,
      currentVersionNo: null,
      currentFunctions: [],
      originalFunctions: [],
      currentContextProviders: [],
      allFunctions: [],
      pluginMetadataReady: false,
      pluginMetadataLoading: null,
      playingVoice: false,
      isPaused: false,
      currentPlayingVoiceId: null,
      agentReloading: false,
      agentReloadSeq: 0,
      agentConfigFetchSeq: 0,
      agentTagsFetchSeq: 0,
      currentVersionFetchSeq: 0,
      agentConfigLoaded: false,
      agentFunctionsLoaded: false,
      agentTagsLoaded: false,
      firstLoaded: false,
      loadFailed: false,
      featureStatus: { vad: false, asr: false, voiceprintRecognition: false, addressBook: false, mcpAccessPoint: false },
      dynamicTags: [],
      originalTagNames: [],
      inputVisible: false,
      inputValue: '',
      checkedReplacementWordIds: [],
      replacementWordList: [],
      mcpUrl: '',
      mcpStatus: 'disconnected',
      mcpTools: [],
      activeSection: 'who',
      savedSignature: null,
      baseline: null,
      baselinePending: true,
      saving: false,
    };
  },
  computed: {
    lang() { return this.$i18n.locale; },
    agentId() { return String(this.$route.query.agentId || robot.agentId || ''); },
    // A family member may look at the character of a shared robot but not change it
    readOnly() { return agentRole(this.agentId) === 'member'; },
    configInteractionBlocked() {
      return this.readOnly || this.agentReloading || this.voiceOptionsLoading || !this.agentConfigLoaded || !this.agentFunctionsLoaded || !this.agentTagsLoaded;
    },
    sections() {
      return [
        { id: 'who', icon: 'agent', label: this.$t('character.who.title') },
        { id: 'voice', icon: 'voice', label: this.$t('character.voice.title') },
        { id: 'think', icon: 'model', label: this.$t('character.think.title') },
        { id: 'can', icon: 'sparkle', label: this.$t('character.can.title'), count: this.toolsEnabled && this.currentFunctions.length ? this.num(this.currentFunctions.length) : '' },
        ...(this.kidsAllowed ? [{ id: 'kids', icon: 'user', label: this.$t('kids.title') }] : []),
        { id: 'history', icon: 'history', label: this.$t('character.history.title') },
      ];
    },
    // Kids mode needs the product feature kids_mode (TinyBot has it)
    kidsAllowed() { return Boolean(this.agentId) && hasFeature('kids_mode'); },
    modelFields() {
      const f = [];
      if (this.featureStatus.vad) f.push({ type: 'VAD', key: 'vadModelId', optionsType: 'VAD', onChange: true });
      if (this.featureStatus.asr) f.push({ type: 'ASR', key: 'asrModelId', optionsType: 'ASR', onChange: true });
      f.push(
        { type: 'LLM', key: 'llmModelId', optionsType: 'LLM', onChange: true },
        { type: 'SLM', key: 'slmModelId', optionsType: 'LLM', onChange: false },
        { type: 'VLLM', key: 'vllmModelId', optionsType: 'VLLM', onChange: true },
        { type: 'Intent', key: 'intentModelId', optionsType: 'Intent', onChange: true },
      );
      return f;
    },
    historyOptions() {
      return [{ value: 1, label: this.$t('character.think.historyText') }, { value: 2, label: this.$t('character.think.historyVoice') }];
    },
    sliders() {
      return [
        { key: 'ttsRate', label: 'character.voice.speed' },
        { key: 'ttsPitch', label: 'character.voice.pitch' },
        { key: 'ttsVolume', label: 'character.voice.volume' },
      ];
    },
    promptLength() { return String(this.form.systemPrompt || '').length; },
    selectedVoiceOption() { return this.voiceOptions.find((o) => o.value === this.form.ttsVoiceId) || null; },
    canPreviewSelectedVoice() { return Boolean(this.selectedVoiceOption && hasAudioPreview(this.selectedVoiceOption)); },
    voiceHint() {
      if (this.voiceOptionsLoading) return this.$t('character.voice.loading');
      if (!this.form.model.ttsModelId) return this.$t('character.voice.none');
      return '';
    },
    toolsEnabled() { return this.form.model.intentModelId !== NO_INTENT; },
    toolRows() {
      const on = new Set(this.currentFunctions.map((x) => x.id));
      const source = visiblePlugins(this.pluginMetadataReady ? this.allFunctions : this.currentFunctions, this.featureStatus.addressBook);
      return source.map((x) => ({
        id: x.id, name: x.name || x.id, settings: Array.isArray(x.fieldsMeta) ? x.fieldsMeta.length : 0, enabled: on.has(x.id), meta: x,
      }));
    },
    configSignature() {
      return configSignature({
        form: this.form, selectedLanguage: this.selectedLanguage, currentFunctions: this.currentFunctions,
        currentContextProviders: this.currentContextProviders, dynamicTags: this.dynamicTags, checkedReplacementWordIds: this.checkedReplacementWordIds,
      });
    },
    isDirty() { return this.savedSignature !== null && this.configSignature !== this.savedSignature; },
  },
  watch: {
    configInteractionBlocked(blocked) {
      if (!blocked && this.baselinePending) {
        this.$nextTick(() => {
          if (!this.configInteractionBlocked) this.markSaved();
        });
      }
    },
    showSnapshotDialog(v) { if (v) this.historyUsed = true; },
    agentId(id, old) { if (this.started && id && id !== old) this.reloadAgentPage(id, { closeEditors: true }); },
  },
  async mounted() {
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('scroll', this.handlePageScroll, { passive: true });
    this.lastValidTtsDraft = this.captureTtsDraft();
    if (!this.$route.query.agentId) await loadRobots();
    this.started = true;
    if (this.agentId) this.reloadAgentPage(this.agentId);
    this.fetchModelOptions();
    this.fetchTemplates();
    this.fetchReplacementWords();
    await this.loadFeatureStatus();
    if (this.featureStatus.mcpAccessPoint && this.agentId) { this.loadMcpAddress(); this.loadMcpTools(); }
  },
  beforeUnmount() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    window.removeEventListener('scroll', this.handlePageScroll);
    if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
    if (this.currentAudio) this.currentAudio.pause();
    this.agentReloadSeq += 1;
    this.agentConfigFetchSeq += 1;
    this.agentTagsFetchSeq += 1;
    this.currentVersionFetchSeq += 1;
    this.voiceFetchSeq += 1;
  },
  beforeRouteLeave() {
    if (!this.isDirty) return true;
    return this.$confirm(this.$t('character.leave.text'), this.$t('character.leave.title'), {
      confirmText: this.$t('character.leave.confirm'), cancelText: this.$t('character.leave.cancel'), danger: true,
    }).then(() => true).catch(() => false);
  },
  methods: {
    num(n) { return digits(n, this.lang); },
    signed,
    firstLine(text) { return String(text || '').split('\n').map((s) => s.trim()).find(Boolean) || ''; },
    selectOptions(type) {
      return (this.modelOptions[type] || []).filter((o) => !o.isHidden).map((o) => {
        const p = providerOf(type, o, this.llmTypes);
        return { value: o.value, label: p ? this.$t('character.withProvider', { label: o.label, provider: p }) : o.label };
      });
    },

    // ---- the unsaved-changes baseline ------------------------------------------------------
    captureState() {
      return clone({
        form: this.form, selectedLanguage: this.selectedLanguage, currentFunctions: this.currentFunctions,
        originalFunctions: this.originalFunctions, currentContextProviders: this.currentContextProviders,
        dynamicTags: this.dynamicTags, checkedReplacementWordIds: this.checkedReplacementWordIds,
        voiceOptions: this.voiceOptions, voiceDetails: this.voiceDetails, languageOptions: this.languageOptions,
        ttsLanguageTouched: this.ttsLanguageTouched, ttsVoiceTouched: this.ttsVoiceTouched, tempSummaryMemory: this.tempSummaryMemory,
      });
    },
    markSaved(signature = this.configSignature) {
      this.savedSignature = signature;
      this.baseline = this.captureState();
      this.baselinePending = false;
    },
    undoChanges() {
      if (!this.baseline) return;
      const b = clone(this.baseline);
      Object.assign(this, b);
      this.voiceFetchSeq += 1;
      this.voiceOptionsLoading = false;
      this.inputVisible = false;
      this.lastValidTtsDraft = this.captureTtsDraft();
      this.updateIntentOptionsVisibility();
      this.$message.info(this.$t('character.save.undone'));
    },
    handleBeforeUnload(e) {
      if (this.isDirty) { e.preventDefault(); e.returnValue = ''; }
    },

    // ---- sections index ------------------------------------------------------------------
    scrollToSection(id, targetId) {
      const el = document.getElementById(targetId || `ch-${id}`);
      if (!el) return;
      this.activeSection = id;
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: targetId ? 'center' : 'start' });
      if (targetId) el.querySelector('select')?.focus({ preventScroll: true });
    },
    handlePageScroll() {
      if (this.scrollFrame) return;
      this.scrollFrame = requestAnimationFrame(() => {
        this.scrollFrame = null;
        let current = this.sections[0].id;
        this.sections.forEach((s) => {
          const el = document.getElementById(`ch-${s.id}`);
          if (el && el.getBoundingClientRect().top <= 160) current = s.id;
        });
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        this.activeSection = atBottom ? this.sections[this.sections.length - 1].id : current;
      });
    },

    // ---- loading ---------------------------------------------------------------------------
    async reloadAgentPage(agentId, options = {}) {
      if (!agentId) return false;
      const seq = ++this.agentReloadSeq;
      this.agentReloading = true;
      this.baselinePending = true;
      this.loadFailed = false;
      if (options.closeEditors) {
        this.showSnapshotDialog = false;
        this.showFunctionDialog = false;
        this.showContextProviderDialog = false;
        this.inputVisible = false;
      }
      const results = await Promise.all([
        this.fetchAgentConfig(agentId, { showError: false }),
        this.getAgentTags(agentId, { showError: false }),
        this.fetchCurrentVersion(agentId, { showError: false }),
      ]);
      if (seq !== this.agentReloadSeq) return false;
      this.agentReloading = false;
      this.firstLoaded = this.firstLoaded || this.agentConfigLoaded;
      if (!this.pluginMetadataReady && this.agentConfigLoaded) this.$message.error(this.$t('roleConfig.fetchPluginsFailed'));
      else if (!results.every(Boolean)) {
        this.loadFailed = true;
        this.$message.error(this.$t('roleConfig.fetchConfigFailed'));
      }
      return results.every(Boolean);
    },
    handleSnapshotRestored() {
      if (this.agentId) this.reloadAgentPage(this.agentId, { closeEditors: true });
    },
    fetchCurrentVersion(agentId, options = {}) {
      const seq = ++this.currentVersionFetchSeq;
      if (!agentId) { this.currentVersionNo = null; return Promise.resolve(true); }
      return new Promise((resolve) => {
        const fail = (err) => {
          if (seq !== this.currentVersionFetchSeq) { resolve(false); return; }
          if (options.showError !== false) this.$message.error(err?.data?.msg || this.$t('roleConfig.fetchConfigFailed'));
          resolve(false);
        };
        Api.agent.getDeviceConfig(agentId, ({ data }) => {
          if (seq !== this.currentVersionFetchSeq) { resolve(false); return; }
          if (data?.code === 0) { this.currentVersionNo = data.data?.currentVersionNo || null; resolve(true); } else fail(data);
        }, fail);
      });
    },
    fetchAgentConfig(agentId, options = {}) {
      const seq = ++this.agentConfigFetchSeq;
      this.agentConfigLoaded = false;
      this.agentFunctionsLoaded = false;
      this.voiceFetchSeq += 1;
      this.voiceOptionsLoading = false;
      return new Promise((resolve) => {
        const fail = (err) => {
          if (seq !== this.agentConfigFetchSeq) { resolve(false); return; }
          this.agentConfigLoaded = false;
          this.agentFunctionsLoaded = false;
          if (options.showError !== false) this.$message.error(err?.data?.msg || this.$t('roleConfig.fetchConfigFailed'));
          resolve(false);
        };
        Api.agent.getDeviceConfig(agentId, ({ data }) => {
          if (seq !== this.agentConfigFetchSeq) { resolve(false); return; }
          if (data?.code !== 0 || !data.data) { fail(data); return; }
          try {
            const a = data.data;
            if (a.functions != null && !Array.isArray(a.functions)) throw new TypeError('Invalid agent function mappings');
            if (a.contextProviders != null && !Array.isArray(a.contextProviders)) throw new TypeError('Invalid context providers');
            if (a.correctWordFileIds != null && !Array.isArray(a.correctWordFileIds)) throw new TypeError('Invalid correct-word mappings');
            this.tempSummaryMemory = '';
            this.ttsLanguageTouched = false;
            this.ttsVoiceTouched = false;
            this.form = {
              ...this.form,
              ...a,
              model: {
                ttsModelId: a.ttsModelId, vadModelId: a.vadModelId, asrModelId: a.asrModelId, llmModelId: a.llmModelId,
                slmModelId: a.slmModelId, vllmModelId: a.vllmModelId, memModelId: a.memModelId, intentModelId: a.intentModelId,
              },
            };
            this.selectedLanguage = a.ttsLanguage || '';
            this.voiceOptions = [];
            this.voiceDetails = {};
            this.languageOptions = [];
            this.lastValidTtsDraft = this.captureTtsDraft();
            this.fetchVoiceOptions(a.ttsModelId, { preferredLanguage: a.ttsLanguage, preferredVoiceId: a.ttsVoiceId });
            this.checkedReplacementWordIds = a.correctWordFileIds || [];
            this.currentContextProviders = a.contextProviders || [];
            this.currentFunctions = buildCurrentFunctions(a.functions || [], this.pluginMetadataReady ? this.allFunctions : null);
            this.originalFunctions = clone(this.currentFunctions);
            this.agentFunctionsLoaded = true;
            const meta = this.pluginMetadataReady ? Promise.resolve(true) : this.fetchAllFunctions({ showError: options.showError });
            meta.then((ready) => {
              if (seq === this.agentConfigFetchSeq && ready) {
                this.enrichCurrentFunctionsWithMetadata();
                this.updateIntentOptionsVisibility();
              }
              if (seq === this.agentConfigFetchSeq) this.agentConfigLoaded = true;
              resolve(true);
            }).catch(fail);
          } catch (e) { fail(e); }
        }, fail);
      });
    },
    fetchModelOptions() {
      MODEL_TYPES.forEach(({ type }) => {
        if (type !== 'LLM') {
          Api.model.getModelNames(type, '', ({ data }) => {
            if (data.code === 0) {
              this.modelOptions = { ...this.modelOptions, [type]: (data.data || []).map((x) => ({ value: x.id, label: x.modelName, isHidden: false })) };
              if (type === 'Intent') this.updateIntentOptionsVisibility();
            } else this.$message.error(data.msg || this.$t('roleConfig.fetchModelsFailed'));
          });
        } else {
          Api.model.getLlmModelCodeList('', ({ data }) => {
            if (data.code === 0) {
              const types = { ...this.llmTypes };
              const list = (data.data || []).map((x) => { types[x.id] = x.type; return { value: x.id, label: x.modelName, isHidden: false }; });
              this.llmTypes = types;
              this.modelOptions = { ...this.modelOptions, LLM: list };
              this.updateIntentOptionsVisibility();
            } else this.$message.error(data.msg || this.$t('roleConfig.fetchModelsFailed'));
          });
        }
      });
    },
    fetchTemplates() {
      Api.agent.getAgentTemplate(({ data }) => {
        if (data.code === 0) this.templates = data.data || [];
        else this.$message.error(data.msg || this.$t('roleConfig.fetchTemplatesFailed'));
      });
    },
    fetchReplacementWords() {
      correctWord.selectAll(({ data }) => { if (data.code === 0) this.replacementWordList = data.data || []; });
    },
    async loadFeatureStatus() {
      try {
        await featureManager.waitForInitialization();
        const c = featureManager.getConfig();
        this.featureStatus = {
          voiceprintRecognition: c.voiceprintRecognition || false, vad: c.vad || false, asr: c.asr || false,
          addressBook: c.addressBook || false, mcpAccessPoint: c.mcpAccessPoint || false,
        };
      } catch (e) { /* features stay off */ }
    },
    getAgentTags(agentId, options = {}) {
      const seq = ++this.agentTagsFetchSeq;
      this.agentTagsLoaded = false;
      if (!agentId) { this.dynamicTags = []; this.originalTagNames = []; this.agentTagsLoaded = true; return Promise.resolve(true); }
      return new Promise((resolve) => {
        const fail = (err) => {
          if (seq !== this.agentTagsFetchSeq) { resolve(false); return; }
          this.agentTagsLoaded = false;
          if (options.showError !== false) this.$message.error(err?.data?.msg || this.$t('roleConfig.fetchConfigFailed'));
          resolve(false);
        };
        Api.agent.getAgentTags(agentId, ({ data }) => {
          if (seq !== this.agentTagsFetchSeq) { resolve(false); return; }
          if (data?.code === 0) {
            this.dynamicTags = Array.isArray(data.data) ? data.data : [];
            this.originalTagNames = this.dynamicTags.map((t) => t.tagName);
            this.agentTagsLoaded = true;
            resolve(true);
          } else fail(data);
        }, fail);
      });
    },

    // ---- saving and resetting --------------------------------------------------------------
    saveConfig() {
      if (this.configInteractionBlocked || this.saving) return;
      const data = buildSaveData(this);
      const tagNames = this.dynamicTags.map((t) => t.tagName);
      const tagsChanged = 'tagNames' in data;
      const submitted = {
        languageTouched: this.ttsLanguageTouched, voiceTouched: this.ttsVoiceTouched, language: data.ttsLanguage,
        voiceId: data.ttsVoiceId, voiceSeq: this.voiceFetchSeq, signature: this.configSignature,
      };
      const submittedState = this.captureState();
      const agentId = this.agentId;
      this.saving = true;
      Api.agent.updateAgentConfig(agentId, data, ({ data: res }) => {
        this.saving = false;
        if (res.code !== 0) { this.$message.error(res.msg || this.$t('roleConfig.saveFailed')); return; }
        if (tagsChanged) this.originalTagNames = [...tagNames];
        if (submitted.voiceSeq === this.voiceFetchSeq && submitted.languageTouched && this.selectedLanguage === submitted.language) {
          this.form.ttsLanguage = submitted.language;
          this.ttsLanguageTouched = false;
        }
        if (submitted.voiceSeq === this.voiceFetchSeq && submitted.voiceTouched && this.form.ttsVoiceId === submitted.voiceId) this.ttsVoiceTouched = false;
        if (submitted.voiceSeq === this.voiceFetchSeq) this.lastValidTtsDraft = this.captureTtsDraft();
        this.savedSignature = submitted.signature;
        this.baseline = submittedState;
        this.baselinePending = false;
        this.$message.success(this.$t('character.save.done'));
        this.fetchCurrentVersion(agentId);
      });
    },
    resetConfig() {
      this.$confirm(this.$t('character.history.resetConfirm'), this.$t('character.history.resetTitle'), {
        confirmText: this.$t('character.history.resetButton'), cancelText: this.$t('common.cancel'), danger: true,
      }).then(() => {
        this.selectedLanguage = '';
        this.ttsLanguageTouched = true;
        this.ttsVoiceTouched = true;
        this.form = emptyForm();
        this.fetchVoiceOptions('');
        this.dynamicTags = [];
        this.currentFunctions = [];
        this.$message.success(this.$t('character.history.resetDone'));
      }).catch(() => {});
    },

    // ---- templates -------------------------------------------------------------------------
    selectTemplate(tpl) {
      if (this.loadingTemplate) return;
      this.loadingTemplate = true;
      try {
        this.applyTemplateData(tpl);
        this.$message.success(this.$t('character.who.templateApplied', { name: tpl.agentName }));
      } catch (e) {
        this.$message.error(this.$t('roleConfig.applyTemplateFailed'));
      } finally { this.loadingTemplate = false; }
    },
    applyTemplateData(t) {
      const rollbackState = clone(this.lastValidTtsDraft) || this.captureTtsDraft();
      const currentLanguage = this.selectedLanguage;
      const m = this.form.model;
      this.form = {
        ...this.form,
        agentName: t.agentName || this.form.agentName,
        ttsVoiceId: t.ttsVoiceId || this.form.ttsVoiceId,
        chatHistoryConf: t.chatHistoryConf || this.form.chatHistoryConf,
        systemPrompt: t.systemPrompt || this.form.systemPrompt,
        summaryMemory: t.summaryMemory || this.form.summaryMemory,
        langCode: t.langCode || this.form.langCode,
        model: {
          ttsModelId: t.ttsModelId || m.ttsModelId, vadModelId: t.vadModelId || m.vadModelId, asrModelId: t.asrModelId || m.asrModelId,
          llmModelId: t.llmModelId || m.llmModelId, slmModelId: t.llmModelId || m.slmModelId, vllmModelId: t.vllmModelId || m.vllmModelId,
          memModelId: t.memModelId || m.memModelId, intentModelId: t.intentModelId || m.intentModelId,
        },
      };
      if (t.ttsLanguage) this.selectedLanguage = t.ttsLanguage;
      if (t.ttsModelId || t.ttsVoiceId || t.ttsLanguage) {
        this.fetchVoiceOptions(this.form.model.ttsModelId, {
          autoSelectVoice: true,
          preferredLanguage: t.ttsLanguage || (t.ttsVoiceId ? '' : currentLanguage),
          preferredVoiceId: t.ttsVoiceId || '',
          rollbackState,
          markTouched: true,
        });
      }
    },

    // ---- models ----------------------------------------------------------------------------
    onModel(type, key, value) {
      this.form.model[key] = value;
      if (type) this.handleModelChange(type, value);
    },
    handleModelChange(type, value) {
      if (type === 'Intent' && value !== NO_INTENT) {
        this.fetchAllFunctions().then((ready) => { if (ready) this.enrichCurrentFunctionsWithMetadata(); });
      }
      if (type === 'Memory') {
        const next = applyMemoryChange(this.form, value, this.tempSummaryMemory);
        this.form.chatHistoryConf = next.chatHistoryConf;
        this.form.summaryMemory = next.summaryMemory;
        this.tempSummaryMemory = next.tempSummary;
      }
      if (type === 'LLM') this.updateIntentOptionsVisibility();
      if (type === 'TTS') {
        const rollbackState = clone(this.lastValidTtsDraft);
        this.fetchVoiceOptions(value, { autoSelectVoice: true, preferredLanguage: rollbackState?.language || this.selectedLanguage, rollbackState, markTouched: true });
      }
    },
    updateIntentOptionsVisibility() {
      const id = this.form.model.llmModelId;
      if (!id || !this.modelOptions.Intent) return;
      const llmType = this.llmTypes[id];
      if (!llmType) return;
      const r = intentVisibility(this.modelOptions.Intent, llmType, this.form.model.intentModelId);
      this.modelOptions = { ...this.modelOptions, Intent: r.options };
      this.form.model.intentModelId = r.intentModelId;
    },
    updateChatHistoryConf() {
      if (this.form.model.memModelId === NO_MEMORY) this.form.chatHistoryConf = 0;
    },

    // ---- voices ----------------------------------------------------------------------------
    fetchVoiceOptions(modelId, options = {}) {
      const seq = ++this.voiceFetchSeq;
      if (!modelId) {
        this.voiceOptionsLoading = false;
        this.voiceOptions = [];
        this.voiceDetails = {};
        this.languageOptions = [];
        this.selectedLanguage = '';
        this.lastValidTtsDraft = this.captureTtsDraft();
        return;
      }
      this.voiceOptionsLoading = true;
      Api.model.getModelVoices(modelId, '', ({ data }) => {
        if (seq !== this.voiceFetchSeq) return;
        const draft = data.code === 0 ? buildTtsDraft(modelId, data.data, options, {
          ttsVoiceId: this.form.ttsVoiceId, ttsLanguage: this.form.ttsLanguage, selectedLanguage: this.selectedLanguage,
        }) : null;
        if (!draft) { this.handleVoiceOptionsFailure(seq, options.rollbackState); return; }
        this.applyTtsDraft(draft, options);
        this.voiceOptionsLoading = false;
        this.lastValidTtsDraft = this.captureTtsDraft();
      }, () => this.handleVoiceOptionsFailure(seq, options.rollbackState));
    },
    captureTtsDraft() {
      return {
        modelId: this.form.model.ttsModelId, language: this.selectedLanguage, storedLanguage: this.form.ttsLanguage,
        voiceId: this.form.ttsVoiceId, languageTouched: this.ttsLanguageTouched, voiceTouched: this.ttsVoiceTouched,
        voiceOptions: clone(this.voiceOptions) || [], voiceDetails: clone(this.voiceDetails) || {}, languageOptions: clone(this.languageOptions) || [],
      };
    },
    restoreTtsDraft(draft) {
      const r = clone(draft);
      if (!r) return false;
      this.form.model.ttsModelId = r.modelId;
      this.selectedLanguage = r.language;
      this.form.ttsLanguage = r.storedLanguage;
      this.form.ttsVoiceId = r.voiceId;
      this.ttsLanguageTouched = r.languageTouched;
      this.ttsVoiceTouched = r.voiceTouched;
      this.voiceOptions = r.voiceOptions;
      this.voiceDetails = r.voiceDetails;
      this.languageOptions = r.languageOptions;
      this.lastValidTtsDraft = r;
      return true;
    },
    applyTtsDraft(d, options = {}) {
      this.form.model.ttsModelId = d.modelId;
      this.voiceDetails = d.voiceDetails;
      this.languageOptions = d.languageOptions;
      this.voiceOptions = d.voiceOptions;
      this.selectedLanguage = d.language;
      this.form.ttsLanguage = d.language;
      this.form.ttsVoiceId = d.voiceId;
      if (options.markTouched) { this.ttsLanguageTouched = true; this.ttsVoiceTouched = true; }
    },
    handleVoiceOptionsFailure(seq, rollbackState) {
      if (seq !== this.voiceFetchSeq) return;
      this.voiceOptionsLoading = false;
      if (!this.restoreTtsDraft(rollbackState)) { this.voiceOptions = []; this.voiceDetails = {}; this.languageOptions = []; }
      this.$message.error(this.$t('ttsModel.fetchVoicesFailed'));
    },
    handleLanguageChange() {
      this.ttsLanguageTouched = true;
      this.form.ttsLanguage = this.selectedLanguage;
      const filtered = voicesForLanguage(this.voiceDetails, this.selectedLanguage);
      this.voiceOptions = voiceOptionsOf(filtered);
      const supports = this.form.ttsVoiceId && filtered.some((v) => v.id === this.form.ttsVoiceId);
      if (!supports) { this.form.ttsVoiceId = filtered.length ? filtered[0].id : ''; this.ttsVoiceTouched = true; }
      if (this.form.ttsVoiceId) this.lastValidTtsDraft = this.captureTtsDraft();
    },
    handleVoiceChange() {
      this.ttsVoiceTouched = true;
      if (this.selectedLanguage) { this.form.ttsLanguage = this.selectedLanguage; this.ttsLanguageTouched = true; }
      if (this.form.ttsVoiceId) this.lastValidTtsDraft = this.captureTtsDraft();
    },
    isVoicePlaying(id) { return Boolean(id) && this.playingVoice && this.currentPlayingVoiceId === id && !this.isPaused; },
    toggleAudioPlayback(id) {
      if (this.playingVoice && this.currentPlayingVoiceId === id && this.currentAudio) {
        if (this.isPaused) {
          this.currentAudio.play().catch(() => this.$message.warning(this.$t('roleConfig.cannotResumeAudio')));
          this.isPaused = false;
        } else { this.currentAudio.pause(); this.isPaused = true; }
        return;
      }
      this.playVoicePreview(id);
    },
    startAudio(failKey) {
      const audio = new Audio();
      this.currentAudio = audio;
      this.playingVoice = true;
      audio.volume = 1.0;
      const timer = setTimeout(() => {
        if (this.currentAudio === audio && this.playingVoice) { this.$message.warning(this.$t('roleConfig.audioLoadTimeout')); this.playingVoice = false; }
      }, 10000);
      audio.onerror = () => { clearTimeout(timer); if (this.currentAudio === audio) { this.$message.warning(this.$t(failKey)); this.playingVoice = false; } };
      audio.onplay = () => clearTimeout(timer);
      audio.onended = () => { if (this.currentAudio === audio) this.playingVoice = false; };
      return { audio, timer };
    },
    playVoicePreview(voiceId = null) {
      const id = voiceId || this.form.ttsVoiceId;
      if (!id) { this.$message.warning(this.$t('roleConfig.selectVoiceFirst')); return; }
      if (this.currentAudio) { this.currentAudio.pause(); this.currentAudio = null; }
      this.isPaused = false;
      this.currentPlayingVoiceId = id;
      try {
        const detail = this.voiceDetails[id];
        if (detail && detail.isClone && detail.id) {
          const { audio, timer } = this.startAudio('roleConfig.cloneAudioPlayFailed');
          RequestService.sendRequest().url(`${getServiceUrl()}/voiceClone/audio/${detail.id}`).method('POST')
            .success((res) => {
              if (res.data.code === 0 && res.data.data) {
                audio.src = `${getServiceUrl()}/voiceClone/play/${res.data.data}`;
                audio.play().catch(() => { clearTimeout(timer); this.$message.warning(this.$t('roleConfig.cannotPlayCloneAudio')); this.playingVoice = false; });
              } else { clearTimeout(timer); this.$message.warning(this.$t('roleConfig.getCloneAudioFailed')); this.playingVoice = false; }
            })
            .networkFail(() => { clearTimeout(timer); this.$message.warning(this.$t('roleConfig.getCloneAudioFailed')); this.playingVoice = false; })
            .send();
          return;
        }
        const url = voiceAudioUrl(detail, id);
        if (!url) { this.$message.warning(this.$t('roleConfig.noPreviewAudio')); return; }
        const { audio, timer } = this.startAudio('roleConfig.audioPlayFailed');
        audio.src = url;
        audio.play().catch(() => { clearTimeout(timer); this.$message.warning(this.$t('roleConfig.cannotPlayAudio')); this.playingVoice = false; });
      } catch (e) {
        this.$message.error(this.$t('roleConfig.audioPlayError'));
        this.playingVoice = false;
      }
    },

    // ---- tools -----------------------------------------------------------------------------
    fetchAllFunctions(options = {}) {
      if (this.pluginMetadataReady) return Promise.resolve(true);
      if (this.pluginMetadataLoading) return this.pluginMetadataLoading;
      this.pluginMetadataLoading = new Promise((resolve) => {
        let settled = false;
        const finish = (ready, err) => {
          if (settled) return;
          settled = true;
          this.pluginMetadataReady = ready;
          if (!ready && options.showError !== false) this.$message.error(err?.data?.msg || err?.msg || this.$t('roleConfig.fetchPluginsFailed'));
          resolve(ready);
        };
        Api.model.getPluginFunctionList(null, ({ data }) => {
          if (data?.code !== 0) { finish(false, data); return; }
          try { this.allFunctions = pluginCatalog(data.data || []); finish(true); } catch (e) { finish(false, e); }
        }, (err) => finish(false, err));
      }).finally(() => { this.pluginMetadataLoading = null; });
      return this.pluginMetadataLoading;
    },
    enrichCurrentFunctionsWithMetadata() {
      if (!this.agentFunctionsLoaded || !this.pluginMetadataReady) return;
      this.currentFunctions = enrichFunctions(this.currentFunctions, this.allFunctions);
      this.originalFunctions = clone(this.currentFunctions);
    },
    manageAllTools() { this.functionDialogFocus = ''; this.openFunctionDialog(); },
    configureTool(tool) { this.functionDialogFocus = tool.name; this.openFunctionDialog(); },
    openFunctionDialog() {
      if (this.agentReloading || !this.agentFunctionsLoaded) return;
      if (this.pluginMetadataReady) { this.enrichCurrentFunctionsWithMetadata(); this.showFunctionDialog = true; return; }
      this.fetchAllFunctions().then((ready) => { if (ready) { this.enrichCurrentFunctionsWithMetadata(); this.showFunctionDialog = true; } });
    },
    toggleTool(tool, enabled) {
      if (!this.pluginMetadataReady || this.agentReloading || !this.agentFunctionsLoaded) return;
      if (enabled) {
        if (this.currentFunctions.some((x) => x.id === tool.id)) return;
        const m = tool.meta || {};
        this.currentFunctions = [...this.currentFunctions, { id: m.id, name: m.name || m.id, params: normalizeFunctionParams(m.params), fieldsMeta: m.fieldsMeta || [] }];
      } else this.currentFunctions = this.currentFunctions.filter((x) => x.id !== tool.id);
      this.originalFunctions = clone(this.currentFunctions);
    },
    handleUpdateFunctions(selected) { this.currentFunctions = selected; },
    handleDialogClosed(saved) {
      if (!saved) this.currentFunctions = clone(this.originalFunctions);
      else this.originalFunctions = clone(this.currentFunctions);
      this.showFunctionDialog = false;
    },
    handleUpdateContext(providers) { this.currentContextProviders = providers; },

    // ---- MCP endpoint ----------------------------------------------------------------------
    loadMcpAddress() {
      Api.agent.getAgentMcpAccessAddress(this.agentId, (res) => {
        this.mcpUrl = res.data.code === 0 ? (res.data.data || '') : (res.data.msg || '');
      });
    },
    loadMcpTools() {
      Api.agent.getAgentMcpToolsList(this.agentId, (res) => {
        if (res.data.code === 0) {
          this.mcpTools = res.data.data || [];
          this.mcpStatus = this.mcpTools.length > 0 ? 'connected' : 'disconnected';
        } else { this.mcpTools = []; this.mcpStatus = 'disconnected'; }
      });
    },
    refreshStatus() { this.mcpStatus = 'checking'; this.loadMcpTools(); },
    async copyUrl() {
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(this.mcpUrl);
        else {
          const ta = document.createElement('textarea');
          ta.value = this.mcpUrl; ta.style.position = 'fixed'; document.body.appendChild(ta); ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          if (!ok) throw new Error('copy');
        }
        this.$message.success(this.$t('functionDialog.copiedToClipboard'));
      } catch (e) { this.$message.error(this.$t('functionDialog.copyFailed')); }
    },

    // ---- tags ------------------------------------------------------------------------------
    handleClose(id) { this.dynamicTags = this.dynamicTags.filter((t) => t.id !== id); },
    showInput() {
      this.inputVisible = true;
      this.$nextTick(() => this.$refs.tagInput?.focus());
    },
    handleInputConfirm() {
      const v = this.inputValue;
      if (v) this.dynamicTags.push({ id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tagName: v });
      this.inputVisible = false;
      this.inputValue = '';
    },
  },
};
</script>

<style>
.ch { --ch-index: 196px; padding-bottom: var(--tb-s8); }
.ch__state { padding: var(--tb-s10) 0; display: grid; place-items: center; }
.ch__readonly { padding: var(--tb-s3) 0; border-bottom: 1px solid var(--tb-rule); color: var(--tb-ink-2); font-size: var(--tb-fs-14); }
.ch__layout { display: grid; grid-template-columns: minmax(0, 1fr); }
.ch__index { display: none; }
.ch__sections { min-width: 0; transition: opacity var(--tb-t-fast) var(--tb-ease); }
.ch__sections.is-busy { opacity: .5; pointer-events: none; }
.ch .tb-section { scroll-margin-top: 16px; }

@media (min-width: 1100px) {
  .ch__layout { grid-template-columns: var(--ch-index) minmax(0, 1fr); gap: var(--tb-s8); }
  .ch__index { display: grid; align-content: start; position: sticky; top: 0; padding-top: var(--tb-s5); max-height: 100vh; }
  .ch__link {
    position: relative; display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 8px 0 12px;
    border-bottom: 1px solid var(--tb-rule-soft); text-decoration: none; color: var(--tb-ink-2); font-weight: 600; font-size: var(--tb-fs-14);
    transition: color var(--tb-t-hover) var(--tb-ease), background-color var(--tb-t-hover) var(--tb-ease);
  }
  .ch__link span { flex: 1; }
  .ch__link small { font-size: var(--tb-fs-12); color: var(--tb-ink-2); }
  .ch__link:hover { color: var(--tb-ink); background: var(--tb-paper-2); }
  .ch__link.is-on { color: var(--tb-ink); }
  .ch__link.is-on::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; background: var(--tb-orange); }
}

/* who */
.ch-who { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--tb-s4) var(--tb-s6); align-items: start; }
.ch-tags { display: grid; gap: 6px; min-width: 0; }
.ch-tags__label { font-weight: 600; font-size: var(--tb-fs-14); }
.ch-tags__list { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 44px; }
.ch-tag { display: inline-flex; align-items: center; gap: 2px; max-width: 100%; height: 32px; padding: 0 2px 0 12px; border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-pill); font-size: var(--tb-fs-14); font-weight: 600; }
.ch-tag__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 22ch; }
.ch-tag__x { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 50%; background: none; color: var(--tb-ink-2); }
.ch-tag__x:hover { background: var(--tb-paper-2); color: var(--tb-ink); }
.ch-tags__input { width: 160px; }

.ch-prompt { display: grid; gap: var(--tb-s6); grid-template-columns: minmax(0, 1fr); align-items: start; }
.ch-prompt > .tb-field { align-content: start; }
.ch-prompt .tb-textarea textarea { min-height: 260px; }
.ch-count { justify-self: end; font-size: var(--tb-fs-12); color: var(--tb-ink-3); }
.ch-count.is-near { color: var(--tb-danger); font-weight: 600; }
.ch-tpl { display: grid; gap: 6px; align-content: start; min-width: 0; }
.ch-tpl__title { font-size: var(--tb-fs-15); }
.ch-tpl__hint { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.ch-tpl__list { list-style: none; margin: 4px 0 0; padding: 0; border-top: 1px solid var(--tb-rule); max-height: 420px; overflow-y: auto; }
.ch-tpl__row {
  display: grid; gap: 2px; width: 100%; min-height: 52px; padding: 8px 6px; border: 0; border-bottom: 1px solid var(--tb-rule-soft);
  background: none; text-align: left; transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.ch-tpl__row b { font-weight: 600; font-size: var(--tb-fs-14); }
.ch-tpl__row span { font-size: var(--tb-fs-13); color: var(--tb-ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-tpl__row:hover:not(:disabled) { background: var(--tb-paper-2); }
@media (min-width: 900px) { .ch-prompt.has-templates { grid-template-columns: minmax(0, 1fr) minmax(220px, 280px); } }

/* voice */
.ch-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--tb-s4) var(--tb-s6); }
.ch-voice { display: flex; gap: 8px; align-items: center; }
.ch-voice .tb-select { flex: 1; min-width: 0; }
.ch-voice .tb-btn { min-height: 44px; }
.ch-voice .tb-btn.is-playing { border-color: var(--tb-action); color: var(--tb-action); }
.ch-sub { font-size: var(--tb-fs-16); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ch-sub__hint { font-size: var(--tb-fs-13); color: var(--tb-ink-2); max-width: 70ch; }
.ch-tune, .ch-words { display: grid; gap: 4px; padding-top: var(--tb-s3); border-top: 1px solid var(--tb-rule-soft); }
.ch-tune__row { display: grid; grid-template-columns: minmax(96px, 160px) minmax(0, 1fr); align-items: center; gap: var(--tb-s4); border-bottom: 1px solid var(--tb-rule-soft); }
.ch-tune__row:last-child { border-bottom: 0; }
.ch-tune__label { font-weight: 600; font-size: var(--tb-fs-14); }
.ch-tune .tb-slider__val { min-width: 4.2ch; }
.ch-words__list { display: flex; flex-wrap: wrap; gap: 4px var(--tb-s5); padding-top: 4px; }
.ch-words__list .tb-check { min-height: 44px; }
.ch-muted { color: var(--tb-ink-3); font-size: var(--tb-fs-14); }

/* thinks: label | picker, ruled */
.ch-models { margin: 0; border-top: 1px solid var(--tb-rule); }
.ch-models__row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 6px var(--tb-s6); align-items: center; padding: 10px 0; border-bottom: 1px solid var(--tb-rule-soft); scroll-margin: 120px; }
.ch-models dt { display: grid; gap: 2px; }
.ch-models dt label, .ch-models dt span { font-weight: 600; font-size: var(--tb-fs-15); }
.ch-models dt small { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.ch-models dd { margin: 0; min-width: 0; }

/* can do */
.ch-block { display: grid; gap: 8px; }
.ch-block + .ch-block { padding-top: var(--tb-s4); border-top: 1px solid var(--tb-rule-soft); }
.ch-block__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.ch-block__state { padding: var(--tb-s5) 0; }
.ch-rows { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--tb-rule); }
.ch-rows__row { display: flex; align-items: center; gap: 10px; min-height: 56px; padding: 6px 0; border-bottom: 1px solid var(--tb-rule-soft); }
.ch-rows__row.is-off .ch-rows__text b { color: var(--tb-ink-2); font-weight: 500; }
.ch-rows__icon { color: var(--tb-ink-2); flex: none; }
.ch-rows__text { flex: 1; min-width: 0; display: grid; }
.ch-rows__text b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-rows__text small { color: var(--tb-ink-2); font-size: var(--tb-fs-13); }
.ch-url { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: var(--tb-fs-14); }
.ch-mcp__state { font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-ink-2); }
.ch-mcp__state.is-connected { color: var(--tb-ok); }
.ch-mcp__url { display: flex; gap: 8px; }
.ch-mcp__url .tb-input { flex: 1; min-width: 0; }
.ch-mcp__url input { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: var(--tb-fs-14) !important; }
.ch-mcp__label { font-weight: 600; font-size: var(--tb-fs-14); margin-top: 4px; }
.ch-mcp__tools { display: flex; flex-wrap: wrap; gap: 6px; }

/* the save bar: pinned under the content while something is unsaved */
.ch-save {
  position: sticky; bottom: 12px; z-index: 30; margin-top: var(--tb-s6);
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 12px 12px 12px 18px; background: var(--tb-paper); border: 1px solid var(--tb-rule); border-top: var(--tb-rule-band) solid var(--tb-rule);
  border-radius: var(--tb-radius-m); box-shadow: var(--tb-shadow-sheet);
}
.ch-save__text { display: grid; min-width: 0; }
.ch-save__text b { font-weight: 700; }
.ch-save__text span { font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.ch-save__acts { display: flex; gap: 8px; }
.ch-bar-enter-active { transition: transform var(--tb-t-sheet) var(--tb-ease), opacity var(--tb-t-sheet) var(--tb-ease); }
.ch-bar-leave-active { transition: transform var(--tb-t-fast) var(--tb-ease-in), opacity var(--tb-t-fast) var(--tb-ease-in); }
.ch-bar-enter-from, .ch-bar-leave-to { transform: translateY(12px); opacity: 0; }

@media (max-width: 899px) {
  .ch-save { bottom: calc(76px + env(safe-area-inset-bottom)); }
}
@media (max-width: 640px) {
  .ch-who, .ch-grid { grid-template-columns: 1fr; }
  .ch-models__row { grid-template-columns: 1fr; }
  .ch-tune__row { grid-template-columns: 1fr; gap: 0; padding-top: 8px; }
  .ch-save { padding: 10px 12px; }
  .ch-save__acts { width: 100%; }
  .ch-save__acts .tb-btn { flex: 1; min-height: 44px; }
  .ch-voice .tb-btn__label { display: none; }
  .ch-voice .tb-btn { width: 44px; padding: 0; }
}
</style>
