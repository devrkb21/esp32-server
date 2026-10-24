<template>
  <div class="role-config">
    <HeaderBar />

    <main class="nx-page rc-page">
      <button type="button" class="nx-back" @click="goToHome">
        <i class="el-icon-arrow-left" aria-hidden="true"></i>
        <span>{{ tx('roleConfig.backToAgents', 'Agents') }}</span>
      </button>

      <header class="nx-page-header rc-header">
        <div class="nx-page-header__text rc-header__text">
          <span class="nx-avatar rc-header__avatar" aria-hidden="true">{{ agentInitial }}</span>
          <div class="rc-header__titles">
            <div class="rc-header__title-row">
              <h1 class="nx-title nx-truncate" :title="form.agentName">{{ form.agentName || $t('roleConfig.title') }}</h1>
              <span v-if="currentVersionNo" class="nx-badge nx-num">
                {{ $t('roleConfig.currentVersion', { version: currentVersionNo }) }}
              </span>
            </div>
            <p class="nx-page-header__desc">
              <i class="el-icon-info" aria-hidden="true"></i>
              {{ $t('roleConfig.restartNotice') }}
            </p>
          </div>
        </div>
        <div ref="headerActions" class="nx-page-header__actions">
          <transition name="nx-fade">
            <span v-if="isDirty" class="nx-badge nx-badge--warning" role="status">
              <span class="nx-dot nx-dot--warning" aria-hidden="true"></span>
              {{ tx('roleConfig.unsavedChanges', 'Unsaved changes') }}
            </span>
          </transition>
          <el-button icon="el-icon-time" @click="showSnapshotDialog = true">
            {{ $t('roleConfig.snapshotHistory') }}
          </el-button>
          <el-button type="primary" :disabled="configInteractionBlocked" @click="saveConfig">
            {{ $t('roleConfig.saveConfig') }}
          </el-button>
        </div>
      </header>

      <div class="rc-layout" v-loading="agentReloading">
        <nav class="rc-nav" :aria-label="tx('roleConfig.sectionNav', 'Settings sections')">
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#rc-section-${section.id}`"
            class="rc-nav__item"
            :class="{ 'is-active': activeSection === section.id }"
            :aria-current="activeSection === section.id ? 'true' : null"
            @click.prevent="scrollToSection(section.id)"
          >
            <i :class="section.icon" aria-hidden="true"></i>
            <span class="nx-truncate">{{ section.label }}</span>
          </a>
        </nav>

        <el-form ref="form" :model="form" class="rc-sections" @submit.native.prevent>
          <!-- Identity & prompt -->
          <section id="rc-section-identity" class="nx-card rc-section" aria-labelledby="rc-title-identity">
            <div class="rc-section__head">
              <span class="nx-icon-tile rc-section__icon" aria-hidden="true"><i class="el-icon-user"></i></span>
              <div class="rc-section__titles">
                <h2 id="rc-title-identity" class="nx-headline">{{ sections[0].label }}</h2>
                <p class="nx-footnote">{{ tx('roleConfig.section.identityDesc', 'Name, tags and the personality this agent speaks with.') }}</p>
              </div>
            </div>

            <div class="rc-grid">
              <div class="rc-field">
                <div class="rc-label">
                  <label for="rc-agent-name">{{ $t('roleConfig.agentName') }}</label>
                  <el-tooltip :content="$t('roleConfig.tooltip.agentName')" placement="top" popper-class="custom-tooltip">
                    <i class="el-icon-question rc-help" tabindex="0" :aria-label="tx('roleConfig.moreInfo', 'More info')"></i>
                  </el-tooltip>
                </div>
                <el-input id="rc-agent-name" v-model="form.agentName" maxlength="64" />
              </div>

              <div class="rc-field">
                <div class="rc-label">
                  <span>{{ tx('roleConfig.tags', 'Tags') }}</span>
                </div>
                <div class="rc-tags">
                  <el-tag
                    v-for="tag in dynamicTags"
                    :key="tag.id"
                    class="rc-tag"
                    closable
                    :disable-transitions="false"
                    :title="tag.tagName"
                    @close="handleClose(tag.id)"
                  >
                    {{ tag.tagName }}
                  </el-tag>
                  <el-input
                    v-if="inputVisible"
                    ref="saveTagInput"
                    v-model="inputValue"
                    class="rc-tag-input"
                    size="small"
                    maxLength="20"
                    @keyup.enter.native="handleInputConfirm"
                    @blur="handleInputConfirm"
                  />
                  <el-button v-else size="small" icon="el-icon-plus" class="rc-tag-add" @click="showInput">
                    {{ $t('roleConfig.addTag') }}
                  </el-button>
                </div>
              </div>
            </div>

            <div class="rc-field rc-field--prompt">
              <div class="rc-label">
                <label for="rc-system-prompt">{{ $t('roleConfig.roleIntroduction') }}</label>
                <el-tooltip :content="$t('roleConfig.tooltip.roleIntroduction')" placement="top" popper-class="custom-tooltip">
                  <i class="el-icon-question rc-help" tabindex="0" :aria-label="tx('roleConfig.moreInfo', 'More info')"></i>
                </el-tooltip>
              </div>

              <div v-if="templates.length" class="rc-templates">
                <span class="rc-templates__label">
                  {{ tx('roleConfig.startFromTemplate', 'Start from a template') }}
                  <el-tooltip :content="$t('roleConfig.tooltip.roleTemplate')" placement="top" popper-class="custom-tooltip">
                    <i class="el-icon-question rc-help" tabindex="0" :aria-label="tx('roleConfig.moreInfo', 'More info')"></i>
                  </el-tooltip>
                </span>
                <div class="rc-chips">
                  <button
                    v-for="(template, index) in templates"
                    :key="`template-${index}`"
                    type="button"
                    class="rc-chip"
                    :disabled="loadingTemplate"
                    :title="template.agentName"
                    @click="selectTemplate(template)"
                  >
                    <span class="nx-truncate">{{ template.agentName }}</span>
                  </button>
                </div>
              </div>

              <el-input
                id="rc-system-prompt"
                v-model="form.systemPrompt"
                type="textarea"
                class="rc-prompt"
                :autosize="{ minRows: 12, maxRows: 28 }"
                :placeholder="$t('roleConfig.pleaseEnterContent')"
                maxlength="2000"
              />
              <div class="rc-count nx-num" :class="{ 'is-near': promptLength >= 1800 }" aria-live="polite">
                {{ promptLength }} / 2000
              </div>
            </div>
          </section>

          <!-- Voice -->
          <section id="rc-section-voice" class="nx-card rc-section" aria-labelledby="rc-title-voice">
            <div class="rc-section__head">
              <span class="nx-icon-tile rc-section__icon" aria-hidden="true"><i class="el-icon-microphone"></i></span>
              <div class="rc-section__titles">
                <h2 id="rc-title-voice" class="nx-headline">{{ sections[1].label }}</h2>
                <p class="nx-footnote">{{ tx('roleConfig.section.voiceDesc', 'How the robot sounds when it talks.') }}</p>
              </div>
            </div>

            <div class="rc-field">
              <div class="rc-label">
                <label>{{ $t('roleConfig.tts') }}</label>
                <el-tooltip :content="$t('roleConfig.tooltip.tts')" placement="top" popper-class="custom-tooltip">
                  <i class="el-icon-question rc-help" tabindex="0" :aria-label="tx('roleConfig.moreInfo', 'More info')"></i>
                </el-tooltip>
              </div>
              <el-select
                v-model="form.model.ttsModelId"
                filterable
                class="rc-select"
                :disabled="voiceOptionsLoading"
                :placeholder="$t('roleConfig.pleaseSelect')"
                @change="handleModelChange('TTS', $event)"
              >
                <el-option
                  v-for="(item, optionIndex) in visibleOptions('TTS')"
                  :key="`option-tts-${optionIndex}`"
                  :label="item.label"
                  :value="item.value"
                >
                  <span class="rc-option">
                    <span class="nx-truncate">{{ item.label }}</span>
                    <span v-if="providerOf('TTS', item)" class="rc-option__meta">{{ providerOf('TTS', item) }}</span>
                  </span>
                </el-option>
              </el-select>
            </div>

            <div class="rc-grid rc-grid--voice">
              <div class="rc-field">
                <div class="rc-label">
                  <label>{{ $t('roleConfig.language') }}</label>
                  <el-tooltip :content="$t('roleConfig.tooltip.language')" placement="top" popper-class="custom-tooltip">
                    <i class="el-icon-question rc-help" tabindex="0" :aria-label="tx('roleConfig.moreInfo', 'More info')"></i>
                  </el-tooltip>
                </div>
                <el-select
                  v-model="selectedLanguage"
                  class="rc-select"
                  :disabled="voiceOptionsLoading"
                  :placeholder="$t('roleConfig.selectLanguage')"
                  @change="handleLanguageChange"
                >
                  <el-option
                    v-for="(lang, index) in languageOptions"
                    :key="`lang-${index}`"
                    :label="lang.label"
                    :value="lang.value"
                  />
                </el-select>
              </div>

              <div class="rc-field">
                <div class="rc-label">
                  <label>{{ $t('roleConfig.voiceType') }}</label>
                  <el-tooltip :content="$t('roleConfig.tooltip.voiceType')" placement="top" popper-class="custom-tooltip">
                    <i class="el-icon-question rc-help" tabindex="0" :aria-label="tx('roleConfig.moreInfo', 'More info')"></i>
                  </el-tooltip>
                </div>
                <div class="rc-voice">
                  <el-select
                    v-model="form.ttsVoiceId"
                    filterable
                    class="rc-select"
                    :disabled="voiceOptionsLoading"
                    :loading="voiceOptionsLoading"
                    :placeholder="$t('roleConfig.pleaseSelect')"
                    @change="handleVoiceChange"
                  >
                    <el-option
                      v-for="(item, index) in voiceOptions"
                      :key="`voice-${index}`"
                      :label="item.label"
                      :value="item.value"
                    >
                      <span class="rc-option">
                        <span class="nx-truncate">{{ item.label }}</span>
                        <el-button
                          v-if="hasAudioPreview(item)"
                          type="text"
                          size="small"
                          class="rc-option__play"
                          :icon="isVoicePlaying(item.value) ? 'el-icon-video-pause' : 'el-icon-video-play'"
                          :aria-label="isVoicePlaying(item.value) ? tx('roleConfig.pauseVoice', 'Pause voice sample') : tx('roleConfig.previewVoice', 'Play voice sample')"
                          @click.stop="toggleAudioPlayback(item.value)"
                        />
                      </span>
                    </el-option>
                  </el-select>
                  <el-tooltip
                    :content="isVoicePlaying(form.ttsVoiceId) ? tx('roleConfig.pauseVoice', 'Pause voice sample') : tx('roleConfig.previewVoice', 'Play voice sample')"
                    placement="top"
                  >
                    <button
                      type="button"
                      class="nx-icon-btn rc-voice__play"
                      :class="{ 'is-playing': isVoicePlaying(form.ttsVoiceId) }"
                      :disabled="!canPreviewSelectedVoice"
                      :aria-label="isVoicePlaying(form.ttsVoiceId) ? tx('roleConfig.pauseVoice', 'Pause voice sample') : tx('roleConfig.previewVoice', 'Play voice sample')"
                      @click="toggleAudioPlayback(form.ttsVoiceId)"
                    >
                      <i :class="isVoicePlaying(form.ttsVoiceId) ? 'el-icon-video-pause' : 'el-icon-video-play'" aria-hidden="true"></i>
                    </button>
                  </el-tooltip>
                </div>
              </div>
            </div>

            <div class="rc-list">
              <div class="rc-row">
                <span class="nx-icon-tile nx-icon-tile--neutral rc-row__icon" aria-hidden="true"><i class="el-icon-s-operation"></i></span>
                <div class="rc-row__text">
                  <div class="rc-row__title">{{ $t('roleConfig.ttsAdvanced') }}</div>
                  <div class="rc-row__meta nx-num">
                    {{ voiceTuningSummary }}<template v-if="checkedReplacementWordIds.length"> · {{ tx('roleConfig.replacementWordCount', '{count} replacement word lists', { count: checkedReplacementWordIds.length }) }}</template>
                  </div>
                </div>
                <el-button size="small" @click="openTtsAdvancedSettings">
                  {{ tx('roleConfig.configure', 'Configure') }}
                </el-button>
              </div>
            </div>
          </section>

          <!-- Models -->
          <section id="rc-section-models" class="nx-card rc-section" aria-labelledby="rc-title-models">
            <div class="rc-section__head">
              <span class="nx-icon-tile rc-section__icon" aria-hidden="true"><i class="el-icon-cpu"></i></span>
              <div class="rc-section__titles">
                <h2 id="rc-title-models" class="nx-headline">{{ sections[2].label }}</h2>
                <p class="nx-footnote">{{ tx('roleConfig.section.modelsDesc', 'The models that listen, think, see and remember.') }}</p>
              </div>
            </div>

            <div class="rc-grid">
              <div v-for="field in modelFields" :key="field.key" class="rc-field">
                <div class="rc-label">
                  <label>{{ $t('roleConfig.' + field.type.toLowerCase()) }}</label>
                  <el-tooltip :content="$t('roleConfig.tooltip.' + field.type.toLowerCase())" placement="top" popper-class="custom-tooltip">
                    <i class="el-icon-question rc-help" tabindex="0" :aria-label="tx('roleConfig.moreInfo', 'More info')"></i>
                  </el-tooltip>
                </div>
                <el-select
                  v-model="form.model[field.key]"
                  filterable
                  class="rc-select"
                  :placeholder="$t('roleConfig.pleaseSelect')"
                  @change="field.onChange ? handleModelChange(field.type, $event) : null"
                >
                  <el-option
                    v-for="(item, optionIndex) in visibleOptions(field.optionsType)"
                    :key="`option-${field.type}-${optionIndex}`"
                    :label="item.label"
                    :value="item.value"
                  >
                    <span class="rc-option">
                      <span class="nx-truncate">{{ item.label }}</span>
                      <span v-if="providerOf(field.optionsType, item)" class="rc-option__meta">{{ providerOf(field.optionsType, item) }}</span>
                    </span>
                  </el-option>
                </el-select>
              </div>
            </div>

            <div class="rc-subsection">
              <div class="rc-grid">
                <div class="rc-field">
                  <div class="rc-label">
                    <label>{{ $t('roleConfig.memory') }}</label>
                    <el-tooltip :content="$t('roleConfig.tooltip.memory')" placement="top" popper-class="custom-tooltip">
                      <i class="el-icon-question rc-help" tabindex="0" :aria-label="tx('roleConfig.moreInfo', 'More info')"></i>
                    </el-tooltip>
                  </div>
                  <el-select
                    v-model="form.model.memModelId"
                    filterable
                    class="rc-select"
                    :placeholder="$t('roleConfig.pleaseSelect')"
                    @change="handleModelChange('Memory', $event)"
                  >
                    <el-option
                      v-for="(item, optionIndex) in visibleOptions('Memory')"
                      :key="`option-memory-${optionIndex}`"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
                <div v-if="form.model.memModelId !== 'Memory_nomem'" class="rc-field">
                  <div class="rc-label"><span>{{ $t('home.chatHistory') }}</span></div>
                  <el-radio-group v-model="form.chatHistoryConf" class="rc-segmented" @change="updateChatHistoryConf">
                    <el-radio-button :label="1">{{ $t('roleConfig.reportText') }}</el-radio-button>
                    <el-radio-button :label="2">{{ $t('roleConfig.reportTextVoice') }}</el-radio-button>
                  </el-radio-group>
                </div>
              </div>

              <div class="rc-field">
                <div class="rc-label">
                  <label for="rc-summary-memory">{{ $t('roleConfig.memoryHis') }}</label>
                  <el-tooltip :content="$t('roleConfig.tooltip.memoryHis')" placement="top" popper-class="custom-tooltip">
                    <i class="el-icon-question rc-help" tabindex="0" :aria-label="tx('roleConfig.moreInfo', 'More info')"></i>
                  </el-tooltip>
                </div>
                <el-input
                  id="rc-summary-memory"
                  v-model="form.summaryMemory"
                  type="textarea"
                  :autosize="{ minRows: 4, maxRows: 12 }"
                  maxlength="2000"
                  show-word-limit
                  :disabled="form.model.memModelId !== 'Memory_mem_local_short'"
                />
              </div>
            </div>
          </section>

          <!-- Tools & plugins -->
          <section id="rc-section-tools" class="nx-card rc-section" aria-labelledby="rc-title-tools">
            <div class="rc-section__head">
              <span class="nx-icon-tile rc-section__icon" aria-hidden="true"><i class="el-icon-s-tools"></i></span>
              <div class="rc-section__titles">
                <h2 id="rc-title-tools" class="nx-headline">
                  {{ sections[3].label }}
                  <span v-if="toolsEnabled && currentFunctions.length" class="nx-badge nx-badge--accent nx-num">
                    {{ tx('roleConfig.toolsEnabledCount', '{count} on', { count: currentFunctions.length }) }}
                  </span>
                </h2>
                <p class="nx-footnote">{{ tx('roleConfig.section.toolsDesc', 'What the agent can do besides talking.') }}</p>
              </div>
              <el-button
                v-if="toolsEnabled"
                size="small"
                class="rc-section__action"
                :class="{ 'is-active': showFunctionDialog }"
                @click="manageAllTools"
              >
                {{ tx('roleConfig.manageTools', 'Manage tools') }}
              </el-button>
            </div>

            <div v-if="!toolsEnabled" class="nx-empty rc-empty">
              <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-s-tools"></i></span>
              <p class="nx-empty__title">{{ tx('roleConfig.toolsOffTitle', 'Tools are off') }}</p>
              <p class="nx-empty__text">{{ tx('roleConfig.toolsOffText', 'Choose an intent recognition model to let this agent use tools.') }}</p>
              <el-button class="nx-empty__action" @click="scrollToSection('models')">
                {{ tx('roleConfig.goToModels', 'Go to models') }}
              </el-button>
            </div>

            <div v-else-if="pluginMetadataLoading && !toolRows.length" class="rc-list" aria-busy="true">
              <div v-for="n in 3" :key="`tool-skeleton-${n}`" class="rc-row">
                <span class="nx-skeleton rc-skeleton-tile"></span>
                <div class="rc-row__text">
                  <span class="nx-skeleton rc-skeleton-line"></span>
                  <span class="nx-skeleton rc-skeleton-line rc-skeleton-line--short"></span>
                </div>
              </div>
            </div>

            <div v-else-if="!toolRows.length" class="nx-empty rc-empty">
              <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-s-tools"></i></span>
              <p class="nx-empty__title">{{ tx('roleConfig.noToolsTitle', 'No tools available') }}</p>
              <p class="nx-empty__text">{{ tx('roleConfig.noToolsText', 'Plugins added on the server appear here.') }}</p>
            </div>

            <ul v-else class="rc-list rc-tools" role="list">
              <li v-for="tool in toolRows" :key="tool.id" class="rc-row" :class="{ 'is-off': !tool.enabled }">
                <span class="nx-icon-tile rc-row__icon rc-tool-initial" :class="{ 'nx-icon-tile--neutral': !tool.enabled }" aria-hidden="true">
                  {{ getFunctionDisplayChar(tool.name) }}
                </span>
                <div class="rc-row__text">
                  <div class="rc-row__title nx-truncate" :title="tool.name">{{ tool.name }}</div>
                  <div class="rc-row__meta">
                    {{ tool.settings ? tx('roleConfig.toolSettingsCount', '{count} settings', { count: tool.settings }) : tx('roleConfig.toolNoSettings', 'No settings needed') }}
                  </div>
                </div>
                <el-button
                  v-if="tool.enabled && tool.settings"
                  size="small"
                  type="text"
                  class="rc-row__action"
                  @click="configureTool(tool)"
                >
                  {{ tx('roleConfig.configure', 'Configure') }}
                </el-button>
                <el-switch
                  :value="tool.enabled"
                  :disabled="!pluginMetadataReady || agentReloading || !agentFunctionsLoaded"
                  :aria-label="tool.name"
                  @change="(val) => toggleTool(tool, val)"
                />
              </li>
            </ul>
          </section>

          <!-- Context -->
          <section id="rc-section-context" class="nx-card rc-section" aria-labelledby="rc-title-context">
            <div class="rc-section__head">
              <span class="nx-icon-tile rc-section__icon" aria-hidden="true"><i class="el-icon-connection"></i></span>
              <div class="rc-section__titles">
                <h2 id="rc-title-context" class="nx-headline">
                  {{ sections[4].label }}
                  <el-tooltip :content="$t('roleConfig.tooltip.contextProvider')" placement="top" popper-class="custom-tooltip">
                    <i class="el-icon-question rc-help" tabindex="0" :aria-label="tx('roleConfig.moreInfo', 'More info')"></i>
                  </el-tooltip>
                </h2>
                <p class="nx-footnote">
                  {{ $t('roleConfig.contextProviderSuccess', { count: currentContextProviders.length }) }}
                  <a href="https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/docs/context-provider-integration.md" target="_blank" rel="noopener" class="rc-link">{{ $t('roleConfig.contextProviderDocLink') }}</a>
                </p>
              </div>
              <el-button size="small" class="rc-section__action" @click="openContextProviderDialog">
                {{ $t('roleConfig.editContextProvider') }}
              </el-button>
            </div>

            <ul v-if="currentContextProviders.length" class="rc-list" role="list">
              <li v-for="(provider, index) in currentContextProviders" :key="`ctx-${index}`" class="rc-row">
                <span class="nx-icon-tile nx-icon-tile--neutral rc-row__icon" aria-hidden="true"><i class="el-icon-link"></i></span>
                <div class="rc-row__text">
                  <div class="rc-row__title nx-mono nx-truncate" :title="provider.url">{{ provider.url }}</div>
                  <div class="rc-row__meta">
                    {{ tx('roleConfig.contextHeaders', '{count} headers', { count: Object.keys(provider.headers || {}).length }) }}
                  </div>
                </div>
              </li>
            </ul>
            <div v-else class="nx-empty rc-empty">
              <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-connection"></i></span>
              <p class="nx-empty__title">{{ tx('roleConfig.contextEmptyTitle', 'No context sources') }}</p>
              <p class="nx-empty__text">{{ tx('roleConfig.contextEmptyText', 'Add an API the agent reads from each time it wakes up.') }}</p>
              <el-button class="nx-empty__action" type="primary" icon="el-icon-plus" @click="openContextProviderDialog">
                {{ $t('contextProviderDialog.add') }}
              </el-button>
            </div>
          </section>

          <!-- Advanced -->
          <section id="rc-section-advanced" class="nx-card rc-section" aria-labelledby="rc-title-advanced">
            <div class="rc-section__head">
              <span class="nx-icon-tile rc-section__icon" aria-hidden="true"><i class="el-icon-setting"></i></span>
              <div class="rc-section__titles">
                <h2 id="rc-title-advanced" class="nx-headline">{{ sections[5].label }}</h2>
                <p class="nx-footnote">{{ tx('roleConfig.section.advancedDesc', 'Version history and reset.') }}</p>
              </div>
            </div>

            <div class="rc-list">
              <div class="rc-row">
                <span class="nx-icon-tile nx-icon-tile--neutral rc-row__icon" aria-hidden="true"><i class="el-icon-time"></i></span>
                <div class="rc-row__text">
                  <div class="rc-row__title">
                    {{ $t('agentSnapshot.title') }}
                    <span v-if="currentVersionNo" class="nx-badge nx-num">{{ $t('roleConfig.currentVersion', { version: currentVersionNo }) }}</span>
                  </div>
                  <div class="rc-row__meta">{{ tx('roleConfig.versionHistoryDesc', 'See earlier saved versions and restore one.') }}</div>
                </div>
                <el-button size="small" @click="showSnapshotDialog = true">{{ $t('roleConfig.snapshotHistory') }}</el-button>
              </div>
              <div class="rc-row">
                <span class="nx-icon-tile nx-icon-tile--neutral rc-row__icon" aria-hidden="true"><i class="el-icon-refresh-left"></i></span>
                <div class="rc-row__text">
                  <div class="rc-row__title">{{ tx('roleConfig.resetTitle', 'Reset all fields') }}</div>
                  <div class="rc-row__meta">{{ tx('roleConfig.resetDesc', 'Clears every field on this page. Nothing changes until you save.') }}</div>
                </div>
                <el-button size="small" type="text" class="rc-danger-text" @click="resetConfig">{{ $t('roleConfig.reset') }}</el-button>
              </div>
            </div>

            <!-- Kept for API compatibility: language code and interaction language are not edited here -->
            <div v-show="false">
              <el-input v-model="form.langCode" :placeholder="$t('roleConfig.pleaseEnterLangCode')" maxlength="10" />
              <el-input v-model="form.language" :placeholder="$t('roleConfig.pleaseEnterLangName')" maxlength="10" />
            </div>
          </section>
        </el-form>
      </div>
    </main>

    <transition name="rc-savebar">
      <div v-if="isDirty && !headerActionsVisible" class="rc-savebar" role="status">
        <span class="nx-dot nx-dot--warning" aria-hidden="true"></span>
        <span class="rc-savebar__text">{{ tx('roleConfig.unsavedChanges', 'Unsaved changes') }}</span>
        <el-button type="primary" size="small" :disabled="configInteractionBlocked" @click="saveConfig">
          {{ $t('roleConfig.saveConfig') }}
        </el-button>
      </div>
    </transition>

    <function-dialog
      v-model="showFunctionDialog"
      :functions="currentFunctions"
      :all-functions="allFunctions"
      :agent-id="$route.query.agentId"
      :focus-name="functionDialogFocus"
      @update-functions="handleUpdateFunctions"
      @dialog-closed="handleDialogClosed"
    />
    <context-provider-dialog
      :visible.sync="showContextProviderDialog"
      :providers="currentContextProviders"
      @confirm="handleUpdateContext"
    />
    <tts-advanced-settings
      :visible.sync="showTtsAdvancedDialog"
      :settings="ttsSettings"
      :checked-replacement-word-ids="checkedReplacementWordIds"
      @save="handleTtsSettingsSave"
    />
    <agent-snapshot-dialog
      v-if="$route.query.agentId"
      :visible.sync="showSnapshotDialog"
      :agent-id="$route.query.agentId"
      :current-version-no="currentVersionNo"
      @restored="handleSnapshotRestored"
    />
    <VersionFooter />
  </div>
</template>

<script>
import Api from "@/apis/api";
import { getServiceUrl } from "@/apis/api";
import RequestService from "@/apis/httpRequest";
import FunctionDialog from "@/components/FunctionDialog.vue";
import ContextProviderDialog from "@/components/ContextProviderDialog.vue";
import TtsAdvancedSettings from "@/components/TtsAdvancedSettings.vue";
import AgentSnapshotDialog from "@/components/AgentSnapshotDialog.vue";
import HeaderBar from "@/components/HeaderBar.vue";
import i18n from "@/i18n";
import featureManager from "@/utils/featureManager"; 
import VersionFooter from "@/components/VersionFooter.vue";

export default {
  name: "RoleConfigPage",
  components: { HeaderBar, FunctionDialog, ContextProviderDialog, TtsAdvancedSettings, AgentSnapshotDialog, VersionFooter },
  data() {
    return {
      showContextProviderDialog: false,
      showTtsAdvancedDialog: false,
      showSnapshotDialog: false,
      ttsSettings: {
        volume: 0,
        speed: 0,
        pitch: 0
      },
      tempSummaryMemory: "",
      form: {
        agentCode: "",
        agentName: "",
        ttsVoiceId: "",
        ttsVolume: null,
        ttsRate: null,
        ttsPitch: null,
        chatHistoryConf: 0,
        systemPrompt: "",
        summaryMemory: "",
        langCode: "",
        language: "",
        sort: "",
        model: {
          ttsModelId: "",
          vadModelId: "",
          asrModelId: "",
          llmModelId: "",
          slmModelId: "",
          vllmModelId: "",
          memModelId: "",
          intentModelId: "",
        },
      },
      models: [
        { label: this.$t("roleConfig.vad"), key: "vadModelId", type: "VAD" },
        { label: this.$t("roleConfig.asr"), key: "asrModelId", type: "ASR" },
        { label: this.$t("roleConfig.llm"), key: "llmModelId", type: "LLM" },
        { label: this.$t("roleConfig.slm"), key: "slmModelId", type: "SLM" },
        { label: this.$t("roleConfig.vllm"), key: "vllmModelId", type: "VLLM" },
        { label: this.$t("roleConfig.intent"), key: "intentModelId", type: "Intent" },
        { label: this.$t("roleConfig.memory"), key: "memModelId", type: "Memory" },
        { label: this.$t("roleConfig.tts"), key: "ttsModelId", type: "TTS" },
      ],
      llmModeTypeMap: new Map(),
      modelOptions: {},
      templates: [],
      loadingTemplate: false,
      voiceOptions: [],
      voiceDetails: {}, // Store complete voice details
      showFunctionDialog: false,
      currentVersionNo: null,
      currentFunctions: [],
      currentContextProviders: [],
      allFunctions: [],
      originalFunctions: [],
      playingVoice: false,
      isPaused: false,
      currentAudio: null,
      currentPlayingVoiceId: null,
      // Language filter related state
      languageOptions: [], // Language options list
      selectedLanguage: '', // Currently selected language
      ttsLanguageTouched: false,
      ttsVoiceTouched: false,
      voiceFetchSeq: 0,
      voiceOptionsLoading: false,
      lastValidTtsDraft: null,
      agentReloading: false,
      agentReloadSeq: 0,
      agentConfigFetchSeq: 0,
      agentTagsFetchSeq: 0,
      currentVersionFetchSeq: 0,
      agentConfigLoaded: false,
      agentFunctionsLoaded: false,
      agentTagsLoaded: false,
      currentVersionLoaded: false,
      pluginMetadataReady: false,
      pluginMetadataLoading: null,
      // Feature status
      featureStatus: {
        vad: false, // Voice activity detection feature status
        asr: false, // Automatic speech recognition feature status
        voiceprintRecognition: false,
        addressBook: false, // Device-call-device plugin is hidden unless contacts are enabled
      },
      dynamicTags: [],
      originalTagNames: [],
      inputVisible: false,
      inputValue: '',
      checkedReplacementWordIds: [],
      // Layout state (settings page)
      activeSection: 'identity',
      headerActionsVisible: true,
      functionDialogFocus: '',
      // Unsaved-changes tracking: signature of the last loaded/saved configuration
      savedSignature: null,
      baselinePending: true,
      scrollFrame: null
    };
  },
  computed: {
    configInteractionBlocked() {
      return this.agentReloading
        || this.voiceOptionsLoading
        || !this.agentConfigLoaded
        || !this.agentFunctionsLoaded
        || !this.agentTagsLoaded;
    },
    sections() {
      return [
        { id: 'identity', icon: 'el-icon-user', label: this.tx('roleConfig.section.identity', 'Identity & prompt') },
        { id: 'voice', icon: 'el-icon-microphone', label: this.tx('roleConfig.section.voice', 'Voice') },
        { id: 'models', icon: 'el-icon-cpu', label: this.tx('roleConfig.section.models', 'Models') },
        { id: 'tools', icon: 'el-icon-s-tools', label: this.tx('roleConfig.section.tools', 'Tools & plugins') },
        { id: 'context', icon: 'el-icon-connection', label: this.tx('roleConfig.section.context', 'Context') },
        { id: 'advanced', icon: 'el-icon-setting', label: this.tx('roleConfig.section.advanced', 'Advanced') },
      ];
    },
    // Model pickers shown in the Models section (memory and TTS have their own places)
    modelFields() {
      const fields = [];
      if (this.featureStatus.vad) {
        fields.push({ type: 'VAD', key: 'vadModelId', optionsType: 'VAD', onChange: true });
      }
      if (this.featureStatus.asr) {
        fields.push({ type: 'ASR', key: 'asrModelId', optionsType: 'ASR', onChange: true });
      }
      fields.push(
        { type: 'LLM', key: 'llmModelId', optionsType: 'LLM', onChange: true },
        { type: 'SLM', key: 'slmModelId', optionsType: 'LLM', onChange: false },
        { type: 'VLLM', key: 'vllmModelId', optionsType: 'VLLM', onChange: true },
        { type: 'Intent', key: 'intentModelId', optionsType: 'Intent', onChange: true }
      );
      return fields;
    },
    agentInitial() {
      const name = String(this.form.agentName || '').trim();
      return name ? Array.from(name)[0] : '·';
    },
    promptLength() {
      return String(this.form.systemPrompt || '').length;
    },
    voiceTuningSummary() {
      const format = (value) => {
        const number = Number(value) || 0;
        return number > 0 ? `+${number}` : String(number);
      };
      return this.tx('roleConfig.voiceTuningSummary', 'Volume {volume} · Speed {speed} · Pitch {pitch}', {
        volume: format(this.ttsSettings.volume),
        speed: format(this.ttsSettings.speed),
        pitch: format(this.ttsSettings.pitch),
      });
    },
    selectedVoiceOption() {
      return this.voiceOptions.find((item) => item.value === this.form.ttsVoiceId) || null;
    },
    canPreviewSelectedVoice() {
      return Boolean(this.selectedVoiceOption && this.hasAudioPreview(this.selectedVoiceOption));
    },
    toolsEnabled() {
      return this.showFunctionIcons('Intent');
    },
    // Plugin rows: every available plugin with its on/off state (falls back to the enabled ones
    // until the plugin catalogue has loaded)
    toolRows() {
      const enabledIds = new Set(this.currentFunctions.map((item) => item.id));
      let source = this.pluginMetadataReady ? this.allFunctions : this.currentFunctions;
      if (!this.featureStatus.addressBook) {
        source = source.filter((item) => item.providerCode !== 'call_device');
      }
      return source.map((item) => ({
        id: item.id,
        name: item.name || item.id,
        settings: Array.isArray(item.fieldsMeta) ? item.fieldsMeta.length : 0,
        enabled: enabledIds.has(item.id),
        meta: item,
      }));
    },
    configSignature() {
      return JSON.stringify({
        form: this.form,
        language: this.selectedLanguage,
        functions: this.currentFunctions.map((item) => ({ id: item.id, params: item.params })),
        contextProviders: this.currentContextProviders,
        tags: this.dynamicTags.map((tag) => tag.tagName),
        replacementWords: this.checkedReplacementWordIds,
      });
    },
    isDirty() {
      return this.savedSignature !== null && this.configSignature !== this.savedSignature;
    }
  },
  watch: {
    configInteractionBlocked(blocked) {
      if (!blocked && this.baselinePending) {
        this.$nextTick(() => {
          if (!this.configInteractionBlocked) {
            this.savedSignature = this.configSignature;
            this.baselinePending = false;
          }
        });
      }
    }
  },
  methods: {
    // Translation with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback, params = {}) {
      const value = this.$t(key, params);
      if (value && value !== key) {
        return value;
      }
      return String(fallback).replace(/\{(\w+)\}/g, (match, name) =>
        params[name] !== undefined ? params[name] : match
      );
    },
    goToHome() {
      this.$router.push("/home");
    },
    visibleOptions(type) {
      return (this.modelOptions[type] || []).filter((item) => !item.isHidden);
    },
    // Provider shown next to a model option: LLM type from the API, otherwise the id suffix
    // of built-in models (e.g. "ASR_FunASR" → "FunASR")
    providerOf(type, item) {
      if (!item) {
        return '';
      }
      if (type === 'LLM') {
        return this.llmModeTypeMap.get(item.value) || '';
      }
      if (['Intent', 'Memory', 'VAD'].includes(type)) {
        return '';
      }
      const prefix = `${type}_`;
      const value = String(item.value || '');
      if (!value.startsWith(prefix)) {
        return '';
      }
      const provider = value.slice(prefix.length);
      return provider && provider !== item.label ? provider : '';
    },
    isVoicePlaying(voiceId) {
      return Boolean(voiceId) && this.playingVoice && this.currentPlayingVoiceId === voiceId && !this.isPaused;
    },
    scrollToSection(id) {
      const element = document.getElementById(`rc-section-${id}`);
      if (!element) {
        return;
      }
      this.activeSection = id;
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    },
    handlePageScroll() {
      if (this.scrollFrame) {
        return;
      }
      this.scrollFrame = window.requestAnimationFrame(() => {
        this.scrollFrame = null;
        const actions = this.$refs.headerActions;
        if (actions) {
          this.headerActionsVisible = actions.getBoundingClientRect().bottom > 64;
        }
        // The active section is the last one whose top has passed the reading line
        const readingLine = 160;
        let current = this.sections[0].id;
        this.sections.forEach((section) => {
          const element = document.getElementById(`rc-section-${section.id}`);
          if (element && element.getBoundingClientRect().top <= readingLine) {
            current = section.id;
          }
        });
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        this.activeSection = atBottom ? this.sections[this.sections.length - 1].id : current;
      });
    },
    handleBeforeUnload(event) {
      if (this.isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    },
    manageAllTools() {
      this.functionDialogFocus = '';
      this.openFunctionDialog();
    },
    configureTool(tool) {
      this.functionDialogFocus = tool.name;
      this.openFunctionDialog();
    },
    // Inline on/off switch for a plugin; the full editor stays in FunctionDialog
    toggleTool(tool, enabled) {
      if (!this.pluginMetadataReady || this.agentReloading || !this.agentFunctionsLoaded) {
        return;
      }
      if (enabled) {
        if (this.currentFunctions.some((item) => item.id === tool.id)) {
          return;
        }
        const meta = tool.meta || {};
        this.currentFunctions = [
          ...this.currentFunctions,
          {
            id: meta.id,
            name: meta.name || meta.id,
            params: this.normalizeFunctionParams(meta.params),
            fieldsMeta: meta.fieldsMeta || []
          }
        ];
      } else {
        this.currentFunctions = this.currentFunctions.filter((item) => item.id !== tool.id);
      }
      // The function dialog restores this list when it is cancelled
      this.originalFunctions = JSON.parse(JSON.stringify(this.currentFunctions));
    },
    normalizeFunctionParams(params, fallback = {}) {
      if (params === null || params === undefined || params === '') {
        return { ...fallback };
      }
      if (typeof params === 'string') {
        try {
          const parsed = JSON.parse(params);
          return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : { ...fallback };
        } catch (error) {
          return { ...fallback };
        }
      }
      if (typeof params === 'object' && !Array.isArray(params)) {
        return { ...params };
      }
      return { ...fallback };
    },
    async saveConfig() {
      if (this.configInteractionBlocked) {
        return;
      }
      const configData = {
        agentCode: this.form.agentCode,
        agentName: this.form.agentName,
        asrModelId: this.form.model.asrModelId,
        vadModelId: this.form.model.vadModelId,
        llmModelId: this.form.model.llmModelId,
        slmModelId: this.form.model.slmModelId,
        vllmModelId: this.form.model.vllmModelId,
        ttsModelId: this.form.model.ttsModelId,
        chatHistoryConf: this.form.chatHistoryConf,
        memModelId: this.form.model.memModelId,
        intentModelId: this.form.model.intentModelId,
        systemPrompt: this.form.systemPrompt,
        summaryMemory: this.form.summaryMemory,
        langCode: this.form.langCode,
        language: this.form.language,
        sort: this.form.sort,
        functions: this.currentFunctions.map((item) => {
          return {
            pluginId: item.id,
            paramInfo: this.normalizeFunctionParams(item.params),
          };
        }),
        contextProviders: this.currentContextProviders,
        correctWordFileIds: this.checkedReplacementWordIds,
      };
      const tagNames = this.dynamicTags.map(tag => tag.tagName);
      const tagsChanged = !this.isSameStringList(tagNames, this.originalTagNames);
      if (tagsChanged) {
        configData.tagNames = tagNames;
      }
      if (this.shouldSubmitTtsLanguage()) {
        configData.ttsLanguage = this.selectedLanguage;
      }
      if (this.ttsVoiceTouched && this.form.ttsVoiceId !== null && this.form.ttsVoiceId !== undefined) {
        configData.ttsVoiceId = this.form.ttsVoiceId;
      }
      const submittedTtsLanguageTouched = this.ttsLanguageTouched;
      const submittedTtsVoiceTouched = this.ttsVoiceTouched;
      const submittedTtsLanguage = configData.ttsLanguage;
      const submittedTtsVoiceId = configData.ttsVoiceId;
      const submittedVoiceFetchSeq = this.voiceFetchSeq;

      // Only pass when user set TTS parameters (not null/undefined)
      if (this.form.ttsVolume !== null && this.form.ttsVolume !== undefined) {
        configData.ttsVolume = this.form.ttsVolume;
      }
      if (this.form.ttsRate !== null && this.form.ttsRate !== undefined) {
        configData.ttsRate = this.form.ttsRate;
      }
      if (this.form.ttsPitch !== null && this.form.ttsPitch !== undefined) {
        configData.ttsPitch = this.form.ttsPitch;
      }
      const agentId = this.$route.query.agentId;
      const submittedSignature = this.configSignature;
      Api.agent.updateAgentConfig(agentId, configData, ({ data }) => {
        if (data.code === 0) {
          const afterSave = () => {
            this.savedSignature = submittedSignature;
            this.baselinePending = false;
            if (tagsChanged) {
              this.originalTagNames = [...tagNames];
            }
            if (submittedVoiceFetchSeq === this.voiceFetchSeq
              && submittedTtsLanguageTouched
              && this.selectedLanguage === submittedTtsLanguage) {
              this.form.ttsLanguage = submittedTtsLanguage;
              this.ttsLanguageTouched = false;
            }
            if (submittedVoiceFetchSeq === this.voiceFetchSeq
              && submittedTtsVoiceTouched
              && this.form.ttsVoiceId === submittedTtsVoiceId) {
              this.ttsVoiceTouched = false;
            }
            if (submittedVoiceFetchSeq === this.voiceFetchSeq) {
              this.lastValidTtsDraft = this.captureTtsDraft();
            }
            this.$message.success({
              message: i18n.t("roleConfig.saveSuccess"),
              showClose: true,
            });
            this.fetchCurrentVersion(agentId);
          };
          afterSave();
        } else {
          this.$message.error({
            message: data.msg || i18n.t("roleConfig.saveFailed"),
            showClose: true,
          });
        }
      });
      
    },
    async reloadAgentPage(agentId, options = {}) {
      if (!agentId) {
        return false;
      }
      const requestSeq = ++this.agentReloadSeq;
      this.agentReloading = true;
      this.baselinePending = true;
      if (options.closeEditors) {
        this.showSnapshotDialog = false;
        this.showFunctionDialog = false;
        this.showContextProviderDialog = false;
        this.showTtsAdvancedDialog = false;
        this.inputVisible = false;
      }

      const results = await Promise.all([
        this.fetchAgentConfig(agentId, { showError: false }),
        this.getAgentTags(agentId, { showError: false }),
        this.fetchCurrentVersion(agentId, { showError: false })
      ]);
      if (requestSeq !== this.agentReloadSeq) {
        return false;
      }

      this.agentReloading = false;
      if (!this.pluginMetadataReady && this.agentConfigLoaded) {
        this.$message.error(i18n.t("roleConfig.fetchPluginsFailed"));
      } else if (!results.every(Boolean)) {
        this.$message.error(i18n.t("roleConfig.fetchConfigFailed"));
      }
      return results.every(Boolean);
    },
    handleSnapshotRestored() {
      const agentId = this.$route.query.agentId;
      if (agentId) {
        this.reloadAgentPage(agentId, { closeEditors: true });
      }
    },
    fetchCurrentVersion(agentId, options = {}) {
      const requestSeq = ++this.currentVersionFetchSeq;
      this.currentVersionLoaded = false;
      if (!agentId) {
        this.currentVersionNo = null;
        this.currentVersionLoaded = true;
        return Promise.resolve(true);
      }

      return new Promise((resolve) => {
        const handleFailure = (error) => {
          if (requestSeq !== this.currentVersionFetchSeq) {
            resolve(false);
            return;
          }
          this.currentVersionLoaded = false;
          if (options.showError !== false) {
            this.$message.error(error?.data?.msg || i18n.t("roleConfig.fetchConfigFailed"));
          }
          resolve(false);
        };
        Api.agent.getDeviceConfig(agentId, ({ data }) => {
          if (requestSeq !== this.currentVersionFetchSeq) {
            resolve(false);
            return;
          }
          if (data?.code === 0) {
            this.currentVersionNo = data.data?.currentVersionNo || null;
            this.currentVersionLoaded = true;
            resolve(true);
          } else {
            handleFailure(data);
          }
        }, handleFailure);
      });
    },
    resetConfig() {
      this.$confirm(i18n.t("roleConfig.confirmReset"), i18n.t("message.info"), {
        confirmButtonText: i18n.t("button.ok"),
        cancelButtonText: i18n.t("button.cancel"),
        type: "warning",
      })
        .then(() => {
          this.selectedLanguage = "";
          this.ttsLanguageTouched = true;
          this.ttsVoiceTouched = true;
          this.form = {
            agentCode: "",
            agentName: "",
            ttsVoiceId: "",
            ttsLanguage: "",
            chatHistoryConf: 0,
            systemPrompt: "",
            summaryMemory: "",
            langCode: "",
            language: "",
            sort: "",
            model: {
              ttsModelId: "",
              vadModelId: "",
              asrModelId: "",
              llmModelId: "",
              slmModelId: "",
              vllmModelId: "",
              memModelId: "",
              intentModelId: "",
            },
          };
          this.fetchVoiceOptions("");
          this.dynamicTags = [];
          this.currentFunctions = [];
          this.$message.success({
            message: i18n.t("roleConfig.resetSuccess"),
            showClose: true,
          });
        })
        .catch(() => {});
    },
    fetchTemplates() {
      Api.agent.getAgentTemplate(({ data }) => {
        if (data.code === 0) {
          this.templates = data.data;
        } else {
          this.$message.error(data.msg || i18n.t("roleConfig.fetchTemplatesFailed"));
        }
      });
    },
    selectTemplate(template) {
      if (this.loadingTemplate) return;
      this.loadingTemplate = true;
      try {
        this.applyTemplateData(template);
        this.$message.success({
          message: `${template.agentName}${i18n.t("roleConfig.templateApplied")}`,
          showClose: true,
        });
      } catch (error) {
        this.$message.error({
          message: i18n.t("roleConfig.applyTemplateFailed"),
          showClose: true,
        });
        console.error("Failed to apply template:", error);
      } finally {
        this.loadingTemplate = false;
      }
    },
    applyTemplateData(templateData) {
      const rollbackState = this.cloneTtsDraft(this.lastValidTtsDraft) || this.captureTtsDraft();
      const currentLanguage = this.selectedLanguage;
      this.form = {
        ...this.form,
        agentName: templateData.agentName || this.form.agentName,
        ttsVoiceId: templateData.ttsVoiceId || this.form.ttsVoiceId,
        chatHistoryConf: templateData.chatHistoryConf || this.form.chatHistoryConf,
        systemPrompt: templateData.systemPrompt || this.form.systemPrompt,
        summaryMemory: templateData.summaryMemory || this.form.summaryMemory,
        langCode: templateData.langCode || this.form.langCode,
        model: {
          ttsModelId: templateData.ttsModelId || this.form.model.ttsModelId,
          vadModelId: templateData.vadModelId || this.form.model.vadModelId,
          asrModelId: templateData.asrModelId || this.form.model.asrModelId,
          llmModelId: templateData.llmModelId || this.form.model.llmModelId,
          slmModelId: templateData.llmModelId || this.form.model.slmModelId,
          vllmModelId: templateData.vllmModelId || this.form.model.vllmModelId,
          memModelId: templateData.memModelId || this.form.model.memModelId,
          intentModelId: templateData.intentModelId || this.form.model.intentModelId,
        },
      };
      if (templateData.ttsLanguage) {
        this.selectedLanguage = templateData.ttsLanguage;
      }
      if (templateData.ttsModelId || templateData.ttsVoiceId || templateData.ttsLanguage) {
        this.fetchVoiceOptions(this.form.model.ttsModelId, {
          autoSelectVoice: true,
          preferredLanguage: templateData.ttsLanguage || (templateData.ttsVoiceId ? "" : currentLanguage),
          preferredVoiceId: templateData.ttsVoiceId || "",
          rollbackState,
          markTouched: true
        });
      }
    },
    buildCurrentFunctions(savedMappings) {
      if (!Array.isArray(savedMappings)) {
        throw new TypeError("Invalid agent function mappings");
      }
      return savedMappings.map((mapping) => {
        const pluginId = mapping.pluginId || mapping.id;
        const meta = this.pluginMetadataReady
          ? this.allFunctions.find((item) => item.id === pluginId)
          : null;
        return {
          id: pluginId,
          name: meta?.name || mapping.name || pluginId,
          params: this.normalizeFunctionParams(mapping.paramInfo ?? mapping.params, meta?.params || {}),
          fieldsMeta: meta?.fieldsMeta || []
        };
      }).filter((item) => item.id);
    },
    enrichCurrentFunctionsWithMetadata() {
      if (!this.agentFunctionsLoaded || !this.pluginMetadataReady) {
        return;
      }
      this.currentFunctions = this.currentFunctions.map((item) => {
        const meta = this.allFunctions.find((candidate) => candidate.id === item.id);
        if (!meta) {
          return {
            ...item,
            params: this.normalizeFunctionParams(item.params),
            fieldsMeta: item.fieldsMeta || []
          };
        }
        return {
          ...item,
          name: meta.name || item.name || item.id,
          params: this.normalizeFunctionParams(item.params, meta.params),
          fieldsMeta: meta.fieldsMeta || []
        };
      });
      this.originalFunctions = JSON.parse(JSON.stringify(this.currentFunctions));
    },
    fetchAgentConfig(agentId, options = {}) {
      const requestSeq = ++this.agentConfigFetchSeq;
      this.agentConfigLoaded = false;
      this.agentFunctionsLoaded = false;
      this.voiceFetchSeq += 1;
      this.voiceOptionsLoading = false;

      return new Promise((resolve) => {
        const handleFailure = (error) => {
          if (requestSeq !== this.agentConfigFetchSeq) {
            resolve(false);
            return;
          }
          this.agentConfigLoaded = false;
          this.agentFunctionsLoaded = false;
          if (options.showError !== false) {
            this.$message.error(error?.data?.msg || i18n.t("roleConfig.fetchConfigFailed"));
          }
          resolve(false);
        };

        Api.agent.getDeviceConfig(agentId, ({ data }) => {
          if (requestSeq !== this.agentConfigFetchSeq) {
            resolve(false);
            return;
          }
          if (data?.code !== 0 || !data.data) {
            handleFailure(data);
            return;
          }

          try {
            const agentData = data.data;
            if (agentData.functions != null && !Array.isArray(agentData.functions)) {
              throw new TypeError("Invalid agent function mappings");
            }
            if (agentData.contextProviders != null && !Array.isArray(agentData.contextProviders)) {
              throw new TypeError("Invalid context providers");
            }
            if (agentData.correctWordFileIds != null && !Array.isArray(agentData.correctWordFileIds)) {
              throw new TypeError("Invalid correct-word mappings");
            }
            this.tempSummaryMemory = "";
            this.ttsLanguageTouched = false;
            this.ttsVoiceTouched = false;
            this.form = {
              ...this.form,
              ...agentData,
              model: {
                ttsModelId: agentData.ttsModelId,
                vadModelId: agentData.vadModelId,
                asrModelId: agentData.asrModelId,
                llmModelId: agentData.llmModelId,
                slmModelId: agentData.slmModelId,
                vllmModelId: agentData.vllmModelId,
                memModelId: agentData.memModelId,
                intentModelId: agentData.intentModelId,
              },
            };
            this.selectedLanguage = agentData.ttsLanguage || "";
            this.voiceOptions = [];
            this.voiceDetails = {};
            this.languageOptions = [];
            this.lastValidTtsDraft = this.captureTtsDraft();
            this.fetchVoiceOptions(agentData.ttsModelId, {
              preferredLanguage: agentData.ttsLanguage,
              preferredVoiceId: agentData.ttsVoiceId
            });

            this.ttsSettings = {
              volume: this.form.ttsVolume || 0,
              speed: this.form.ttsRate || 0,
              pitch: this.form.ttsPitch || 0
            };
            this.checkedReplacementWordIds = agentData.correctWordFileIds || [];
            this.currentContextProviders = agentData.contextProviders || [];
            this.currentFunctions = this.buildCurrentFunctions(agentData.functions || []);
            this.originalFunctions = JSON.parse(JSON.stringify(this.currentFunctions));
            this.agentFunctionsLoaded = true;
            this.agentConfigLoaded = true;

            const metadataPromise = this.pluginMetadataReady
              ? Promise.resolve(true)
              : this.fetchAllFunctions({ showError: options.showError });
            metadataPromise.then((metadataReady) => {
              if (requestSeq === this.agentConfigFetchSeq && metadataReady) {
                this.enrichCurrentFunctionsWithMetadata();
                this.updateIntentOptionsVisibility();
              }
              resolve(true);
            }).catch(handleFailure);
          } catch (error) {
            handleFailure(error);
          }
        }, handleFailure);
      });
    },
    fetchModelOptions() {
      this.models.forEach((model) => {
        if (model.type != "LLM") {
          Api.model.getModelNames(model.type, "", ({ data }) => {
            if (data.code === 0) {
              this.$set(
                this.modelOptions,
                model.type,
                data.data.map((item) => ({
                  value: item.id,
                  label: item.modelName,
                  isHidden: false,
                }))
              );

              // If intent recognition option, update visibility according to current LLM type
              if (model.type === "Intent") {
                this.updateIntentOptionsVisibility();
              }
            } else {
              this.$message.error(data.msg || i18n.t("roleConfig.fetchModelsFailed"));
            }
          });
        } else {
          Api.model.getLlmModelCodeList("", ({ data }) => {
            if (data.code === 0) {
              let LLMdata = [];
              data.data.forEach((item) => {
                LLMdata.push({
                  value: item.id,
                  label: item.modelName,
                  isHidden: false,
                });
                this.llmModeTypeMap.set(item.id, item.type);
              });
              this.$set(this.modelOptions, model.type, LLMdata);
            } else {
              this.$message.error(data.msg || i18n.t("roleConfig.fetchModelsFailed"));
            }
          });
        }
      });
    },
    fetchVoiceOptions(modelId, options = {}) {
      const requestSeq = ++this.voiceFetchSeq;
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
      Api.model.getModelVoices(modelId, "", ({ data }) => {
        if (requestSeq !== this.voiceFetchSeq) {
          return;
        }
        const draft = data.code === 0
          ? this.buildTtsDraft(modelId, data.data, options)
          : null;
        if (!draft) {
          this.handleVoiceOptionsFailure(requestSeq, options.rollbackState);
          return;
        }
        this.applyTtsDraft(draft, options);
        this.voiceOptionsLoading = false;
        this.lastValidTtsDraft = this.captureTtsDraft();
      }, () => {
        this.handleVoiceOptionsFailure(requestSeq, options.rollbackState);
      });
    },
    cloneTtsDraft(draft) {
      return draft ? JSON.parse(JSON.stringify(draft)) : null;
    },
    captureTtsDraft() {
      return {
        modelId: this.form.model.ttsModelId,
        language: this.selectedLanguage,
        storedLanguage: this.form.ttsLanguage,
        voiceId: this.form.ttsVoiceId,
        languageTouched: this.ttsLanguageTouched,
        voiceTouched: this.ttsVoiceTouched,
        voiceOptions: this.cloneTtsDraft(this.voiceOptions) || [],
        voiceDetails: this.cloneTtsDraft(this.voiceDetails) || {},
        languageOptions: this.cloneTtsDraft(this.languageOptions) || []
      };
    },
    restoreTtsDraft(draft) {
      const restored = this.cloneTtsDraft(draft);
      if (!restored) {
        return false;
      }
      this.form.model.ttsModelId = restored.modelId;
      this.selectedLanguage = restored.language;
      this.form.ttsLanguage = restored.storedLanguage;
      this.form.ttsVoiceId = restored.voiceId;
      this.ttsLanguageTouched = restored.languageTouched;
      this.ttsVoiceTouched = restored.voiceTouched;
      this.voiceOptions = restored.voiceOptions;
      this.voiceDetails = restored.voiceDetails;
      this.languageOptions = restored.languageOptions;
      this.lastValidTtsDraft = restored;
      return true;
    },
    splitVoiceLanguages(voice) {
      return voice && voice.languages
        ? voice.languages.split(/[、；;,，]/).map(lang => lang.trim()).filter(Boolean)
        : [];
    },
    buildTtsDraft(modelId, voices, options = {}) {
      if (!Array.isArray(voices) || voices.length === 0) {
        return null;
      }
      const voiceDetails = voices.reduce((result, voice) => {
        if (voice && voice.id) {
          result[voice.id] = voice;
        }
        return result;
      }, {});
      const validVoices = Object.values(voiceDetails);
      if (validVoices.length === 0) {
        return null;
      }

      const allLanguages = new Set();
      validVoices.forEach((voice) => {
        this.splitVoiceLanguages(voice).forEach((language) => allLanguages.add(language));
      });
      const languageOptions = Array.from(allLanguages).map((language) => ({
        value: language,
        label: language
      }));
      const languageExists = (language) => language
        && languageOptions.some((option) => option.value === language);
      const preferredVoiceId = options.preferredVoiceId || this.form.ttsVoiceId;
      const preferredVoiceLanguage = this.splitVoiceLanguages(voiceDetails[preferredVoiceId])[0] || "";
      const languageCandidates = [
        options.preferredLanguage,
        preferredVoiceLanguage,
        this.form.ttsLanguage,
        this.selectedLanguage,
        languageOptions[0]?.value
      ];
      const preferredVoiceHasNoLanguage = Boolean(
        voiceDetails[preferredVoiceId]
        && this.splitVoiceLanguages(voiceDetails[preferredVoiceId]).length === 0
      );
      let language = options.preferredLanguage === "" && preferredVoiceHasNoLanguage
        ? ""
        : languageCandidates.find(languageExists) || "";
      const filterVoices = (targetLanguage) => validVoices.filter((voice) => {
        const languages = this.splitVoiceLanguages(voice);
        return languages.length === 0 || languages.includes(targetLanguage);
      });
      let filteredVoices = filterVoices(language);
      if (filteredVoices.length === 0) {
        const fallbackVoice = validVoices.find((voice) => this.splitVoiceLanguages(voice).length > 0);
        if (fallbackVoice) {
          language = this.splitVoiceLanguages(fallbackVoice)[0];
          filteredVoices = filterVoices(language);
        } else {
          filteredVoices = validVoices;
        }
      }
      if (filteredVoices.length === 0) {
        return null;
      }

      const preferredVoice = filteredVoices.find((voice) => voice.id === preferredVoiceId);
      const voice = preferredVoice || (options.autoSelectVoice ? filteredVoices[0] : null);
      return {
        modelId,
        language,
        voiceId: voice?.id || preferredVoiceId || "",
        voiceDetails,
        languageOptions,
        voiceOptions: filteredVoices.map((item) => ({
          value: item.id,
          label: item.name,
          voiceDemo: item.voiceDemo,
          voice_demo: item.voice_demo,
          isClone: Boolean(item.isClone),
          train_status: item.trainStatus
        }))
      };
    },
    applyTtsDraft(draft, options = {}) {
      this.form.model.ttsModelId = draft.modelId;
      this.voiceDetails = draft.voiceDetails;
      this.languageOptions = draft.languageOptions;
      this.voiceOptions = draft.voiceOptions;
      this.selectedLanguage = draft.language;
      this.form.ttsLanguage = draft.language;
      this.form.ttsVoiceId = draft.voiceId;
      if (options.markTouched) {
        this.ttsLanguageTouched = true;
        this.ttsVoiceTouched = true;
      }
      this.ttsSettings = {
        volume: this.form.ttsVolume !== null && this.form.ttsVolume !== undefined ? this.form.ttsVolume : 0,
        speed: this.form.ttsRate !== null && this.form.ttsRate !== undefined ? this.form.ttsRate : 0,
        pitch: this.form.ttsPitch !== null && this.form.ttsPitch !== undefined ? this.form.ttsPitch : 0
      };
    },
    handleVoiceOptionsFailure(requestSeq, rollbackState) {
      if (requestSeq !== this.voiceFetchSeq) {
        return;
      }
      this.voiceOptionsLoading = false;
      if (!this.restoreTtsDraft(rollbackState)) {
        this.voiceOptions = [];
        this.voiceDetails = {};
        this.languageOptions = [];
      }
      this.$message.error(i18n.t("ttsModel.fetchVoicesFailed"));
    },
    getVoiceDefaultLanguage(voiceId) {
      if (!voiceId || !this.voiceDetails || !this.voiceDetails[voiceId]?.languages) {
        return "";
      }
      const languages = this.voiceDetails[voiceId].languages
        .split(/[、；;,，]/)
        .map(lang => lang.trim())
        .filter(Boolean);
      return languages[0] || "";
    },
    
    // Filter voices by language
    filterVoicesByLanguage(options = {}) {
      if (!this.voiceDetails || Object.keys(this.voiceDetails).length === 0) {
        this.voiceOptions = [];
        return;
      }

      const allVoices = Object.values(this.voiceDetails);

      // Filter voices by selected language
      const filteredVoices = allVoices.filter(voice => {
        const languagesArray = this.splitVoiceLanguages(voice);
        if (languagesArray.length === 0) {
          // Voices without declared language are interpreted by provider, not filtered on frontend.
          return true;
        }
        return languagesArray.includes(this.selectedLanguage);
      });

      this.voiceOptions = filteredVoices.map((voice) => ({
        value: voice.id,
        label: voice.name,
        voiceDemo: voice.voiceDemo,
        voice_demo: voice.voice_demo,
        isClone: Boolean(voice.isClone),
        train_status: voice.trainStatus,
      }));

      // Check if selected voice supports current language, fallback to first if not
      const currentVoiceSupportsLanguage = this.form.ttsVoiceId &&
        filteredVoices.some(voice => voice.id === this.form.ttsVoiceId);

      if (!currentVoiceSupportsLanguage && options.autoSelectVoice) {
        this.form.ttsVoiceId = filteredVoices.length > 0 ? filteredVoices[0].id : '';
        this.ttsVoiceTouched = true;
      }

      // Sync to ttsSettings (if null, use 0 for display without modifying form value)
      this.ttsSettings = {
        volume: this.form.ttsVolume !== null && this.form.ttsVolume !== undefined ? this.form.ttsVolume : 0,
        speed: this.form.ttsRate !== null && this.form.ttsRate !== undefined ? this.form.ttsRate : 0,
        pitch: this.form.ttsPitch !== null && this.form.ttsPitch !== undefined ? this.form.ttsPitch : 0
      };
    },
    handleLanguageChange() {
      this.ttsLanguageTouched = true;
      this.form.ttsLanguage = this.selectedLanguage;
      this.filterVoicesByLanguage({ autoSelectVoice: true });
      if (this.form.ttsVoiceId) {
        this.lastValidTtsDraft = this.captureTtsDraft();
      }
    },
    handleVoiceChange() {
      this.ttsVoiceTouched = true;
      if (this.selectedLanguage) {
        this.form.ttsLanguage = this.selectedLanguage;
        this.ttsLanguageTouched = true;
      }
      if (this.form.ttsVoiceId) {
        this.lastValidTtsDraft = this.captureTtsDraft();
      }
    },
    shouldSubmitTtsLanguage() {
      return this.ttsLanguageTouched;
    },

    getFunctionDisplayChar(name) {
      if (!name || name.length === 0) return "";

      for (let i = 0; i < name.length; i++) {
        const char = name[i];
        if (/[\u4e00-\u9fa5a-zA-Z0-9]/.test(char)) {
          return char;
        }
      }

      // If no valid character found, return first character
      return name.charAt(0);
    },
    showFunctionIcons(type) {
      return type === "Intent" && this.form.model.intentModelId !== "Intent_nointent";
    },
    handleModelChange(type, value) {
      if (type === "Intent" && value !== "Intent_nointent") {
        this.fetchAllFunctions().then((metadataReady) => {
          if (metadataReady) {
            this.enrichCurrentFunctionsWithMetadata();
          }
        });
      }
      if (type === "Memory") {
        if (value === "Memory_nomem") {
          // Models without memory do not record chat history by default
          this.form.chatHistoryConf = 0;
        } else {
          // Models with memory record text and voice by default
          this.form.chatHistoryConf = 2;
        }
        if (value === "Memory_nomem" || value === "Memory_mem_report_only") {
          this.tempSummaryMemory = this.form.summaryMemory;
          this.form.summaryMemory = "";
        } else if (this.tempSummaryMemory !== "" && this.form.summaryMemory === "") {
          this.form.summaryMemory = this.tempSummaryMemory;
          this.tempSummaryMemory = "";
        }
      }
      if (type === "LLM") {
        // Update intent recognition option visibility when LLM type changes
        this.updateIntentOptionsVisibility();
      }
      if (type === "TTS") {
        const rollbackState = this.cloneTtsDraft(this.lastValidTtsDraft);
        this.fetchVoiceOptions(value, {
          autoSelectVoice: true,
          preferredLanguage: rollbackState?.language || this.selectedLanguage,
          rollbackState,
          markTouched: true
        });
      }
    },
    parsePluginFields(fields) {
      if (Array.isArray(fields)) {
        return fields;
      }
      if (typeof fields !== "string" || !fields.trim()) {
        return [];
      }
      try {
        const parsed = JSON.parse(fields);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    },
    fetchAllFunctions(options = {}) {
      if (this.pluginMetadataReady) {
        return Promise.resolve(true);
      }
      if (this.pluginMetadataLoading) {
        return this.pluginMetadataLoading;
      }

      this.pluginMetadataLoading = new Promise((resolve) => {
        let settled = false;
        const finish = (ready, error) => {
          if (settled) {
            return;
          }
          settled = true;
          this.pluginMetadataReady = ready;
          if (!ready && options.showError !== false) {
            this.$message.error(error?.data?.msg || error?.msg || i18n.t("roleConfig.fetchPluginsFailed"));
          }
          resolve(ready);
        };

        Api.model.getPluginFunctionList(null, ({ data }) => {
          if (data?.code !== 0) {
            finish(false, data);
            return;
          }
          try {
            this.allFunctions = (data.data || []).map((item) => {
              const fieldsMeta = this.parsePluginFields(item.fields);
              const params = fieldsMeta.reduce((result, field) => {
                if (field?.key) {
                  result[field.key] = field.default;
                }
                return result;
              }, {});
              return { ...item, fieldsMeta, params };
            });
            finish(true);
          } catch (error) {
            finish(false, error);
          }
        }, (error) => finish(false, error));
      }).finally(() => {
        this.pluginMetadataLoading = null;
      });

      return this.pluginMetadataLoading;
    },
    openFunctionDialog() {
      if (this.agentReloading || !this.agentFunctionsLoaded) {
        return;
      }
      if (this.pluginMetadataReady) {
        this.enrichCurrentFunctionsWithMetadata();
        this.showFunctionDialog = true;
        return;
      }
      this.fetchAllFunctions().then((metadataReady) => {
        if (metadataReady) {
          this.enrichCurrentFunctionsWithMetadata();
          this.showFunctionDialog = true;
        }
      });
    },
    openContextProviderDialog() {
      this.showContextProviderDialog = true;
    },
    openTtsAdvancedSettings() {
      this.showTtsAdvancedDialog = true;
    },
    handleTtsSettingsSave(settings) {
      const { replacementWordIds, changedTtsFields = [], ...ttsSettings } = settings;
      this.checkedReplacementWordIds = replacementWordIds;
      // Save TTS settings
      this.ttsSettings = ttsSettings;
      const changedFields = new Set(changedTtsFields);
      if (changedFields.has("volume")) {
        this.form.ttsVolume = ttsSettings.volume;
      }
      if (changedFields.has("speed")) {
        this.form.ttsRate = ttsSettings.speed;
      }
      if (changedFields.has("pitch")) {
        this.form.ttsPitch = ttsSettings.pitch;
      }
    },
    handleUpdateContext(providers) {
      this.currentContextProviders = providers;
    },
    handleUpdateFunctions(selected) {
      this.currentFunctions = selected;
    },
    handleDialogClosed(saved) {
      if (!saved) {
        this.currentFunctions = JSON.parse(JSON.stringify(this.originalFunctions));
      } else {
        this.originalFunctions = JSON.parse(JSON.stringify(this.currentFunctions));
      }
      this.showFunctionDialog = false;
    },
    updateIntentOptionsVisibility() {
      // Update intent recognition visibility based on selected LLM type
      const currentLlmId = this.form.model.llmModelId;
      if (!currentLlmId || !this.modelOptions["Intent"]) return;

      const llmType = this.llmModeTypeMap.get(currentLlmId);
      if (!llmType) return;

      this.modelOptions["Intent"].forEach((item) => {
        if (item.value === "Intent_function_call") {
          // If llmType is openai or ollama, allow selecting function_call
          // Otherwise hide function_call option
          if (llmType === "openai" || llmType === "ollama") {
            item.isHidden = false;
          } else {
            item.isHidden = true;
          }
        } else {
          // Other intent recognition options are always visible
          item.isHidden = false;
        }
      });

      // If current intent is function_call but unsupported by LLM, set to first available option
      if (
        this.form.model.intentModelId === "Intent_function_call" &&
        llmType !== "openai" &&
        llmType !== "ollama"
      ) {
        // Find first visible option
        const firstVisibleOption = this.modelOptions["Intent"].find(
          (item) => !item.isHidden
        );
        if (firstVisibleOption) {
          this.form.model.intentModelId = firstVisibleOption.value;
        } else {
          // If no visible options, set to Intent_nointent
          this.form.model.intentModelId = "Intent_nointent";
        }
      }
    },
    // Check if audio preview exists
    hasAudioPreview(item) {
      // Check if cloned audio
      // Use isClone field returned from backend
      const isCloneAudio = Boolean(item.isClone);
      
      // Check if valid audio URL exists using backend response fields or voice-demo mapping
      const hasValidAudioUrl = !!((item.voice_demo || item.voiceDemo)?.trim()) || Boolean(item.ttsVoice || (item.value && !String(item.value).startsWith('TTS_')));
      
      // Cloned audio always displays play button, standard audio requires valid URL or known demo
      return isCloneAudio || hasValidAudioUrl;
    },

    // Play/pause audio toggle
    toggleAudioPlayback(voiceId) {
      // If clicking currently playing audio, toggle pause/play state
      if (this.playingVoice && this.currentPlayingVoiceId === voiceId) {
        if (this.isPaused) {
          // Resume playback from paused state
          this.currentAudio.play().catch((error) => {
            console.error("Failed to resume playback:", error);
            this.$message.warning(this.$t('roleConfig.cannotResumeAudio'));
          });
          this.isPaused = false;
        } else {
          // Pause playback
          this.currentAudio.pause();
          this.isPaused = true;
        }
        return;
      }

      // Otherwise start playing new audio
      this.playVoicePreview(voiceId);
    },

    // Play voice preview
    playVoicePreview(voiceId = null) {
      // If voiceId provided use it, otherwise use currently selected
      const targetVoiceId = voiceId || this.form.ttsVoiceId;

      if (!targetVoiceId) {
        this.$message.warning(this.$t('roleConfig.selectVoiceFirst'));
        return;
      }

      // Stop currently playing audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      // Reset playback state
      this.isPaused = false;
      this.currentPlayingVoiceId = targetVoiceId;

      try {
        // Get audio URL from saved voice details
        const voiceDetail = this.voiceDetails[targetVoiceId];

        // Add debug info
        console.log("Currently selected voice ID:", targetVoiceId);
        console.log("Voice details:", voiceDetail);

        // Try multiple possible audio property names
        let audioUrl = null;
        let isCloneAudio = false;

        if (voiceDetail) {
          // Use isClone field returned from backend to determine cloned audio
          isCloneAudio = Boolean(voiceDetail.isClone);
          console.log(
            "Cloned audio check result:",
            isCloneAudio,
            "Training status:",
            voiceDetail.train_status
          );

          // Get audio URL
          if (isCloneAudio && voiceDetail.id) {
            // For cloned audio, use appropriate API from backend
            // Note: requires two steps to retrieve audio URL
            // 1. First get audio download ID
            // 2. Then build playback URL with this ID
            // Request getAudioId due to async operation
            console.log("Detected cloned audio, preparing to get audio URL:", voiceDetail.id);

            // Create Promise to handle async retrieval of audio URL
            const getCloneAudioUrl = () => {
              return new Promise((resolve) => {
                // Call getAudioId API to get temporary UUID
                RequestService.sendRequest()
                  .url(`${getServiceUrl()}/voiceClone/audio/${voiceDetail.id}`)
                  .method("POST")
                  .success((res) => {
                    if (res.data.code === 0 && res.data.data) {
                      // Handle response data format (.data nested under res.data)
                      const audioId = res.data.data;
                      console.log("Retrieved audio ID:", audioId);
                      // Construct playback URL using returned UUID
                      const playUrl = `${getServiceUrl()}/voiceClone/play/${audioId}`;
                      console.log("Construct cloned audio playback URL:", playUrl);
                      resolve(playUrl);
                    } else {
                      console.error("Failed to get audio ID:", res.msg);
                      resolve(null);
                    }
                  })
                  .networkFail((err) => {
                    console.error("Request audio ID API failed:", err);
                    resolve(null);
                  })
                  .send();
              });
            };

            // Set playback state
            this.playingVoice = true;
            // Create Audio instance
            this.currentAudio = new Audio();
            // Set volume
            this.currentAudio.volume = 1.0;

            // Set timeout to prevent indefinite loading
            const timeoutId = setTimeout(() => {
              if (this.currentAudio && this.playingVoice) {
                this.$message.warning(this.$t('roleConfig.audioLoadTimeout'));
                this.playingVoice = false;
              }
            }, 10000); // 10s timeout

            // Listen for playback error
            this.currentAudio.onerror = () => {
              clearTimeout(timeoutId);
              console.error("Cloned audio playback error");
              this.$message.warning(this.$t('roleConfig.cloneAudioPlayFailed'));
              this.playingVoice = false;
            };

            // Listen for playback start, clear timeout
            this.currentAudio.onplay = () => {
              clearTimeout(timeoutId);
            };

            // Listen for playback end
            this.currentAudio.onended = () => {
              this.playingVoice = false;
            };

            // Handle async URL fetch and playback
            getCloneAudioUrl().then((url) => {
              if (url) {
                // Set audio URL and play
                this.currentAudio.src = url;
                this.currentAudio.play().catch((error) => {
                  clearTimeout(timeoutId);
                  console.error("Failed to play cloned audio:", error);
                  this.$message.warning(this.$t('roleConfig.cannotPlayCloneAudio'));
                  this.playingVoice = false;
                });
              } else {
                clearTimeout(timeoutId);
                this.$message.warning(this.$t('roleConfig.getCloneAudioFailed'));
                this.playingVoice = false;
              }
            });

            // Return to prevent executing standard audio playback logic below
            return;
          } else {
            // For standard audio, use fields returned from backend
            audioUrl =
              voiceDetail.voiceDemo ||
              voiceDetail.voice_demo;
          }

          // If not found, check if any field contains a URL format
          if (!audioUrl) {
            for (const key in voiceDetail) {
              const value = voiceDetail[key];
              if (
                typeof value === "string" &&
                (value.startsWith("http://") ||
                  value.startsWith("https://") ||
                  value.endsWith(".mp3") ||
                  value.endsWith(".wav") ||
                  value.endsWith(".ogg"))
              ) {
                audioUrl = value;
                console.log(`Found possible audio URL in field '${key}':`, audioUrl);
                break;
              }
            }
          }

          if (!audioUrl) {
            const voiceKey = voiceDetail.ttsVoice || voiceDetail.value || voiceId;
            if (voiceKey && !String(voiceKey).startsWith('TTS_')) {
              audioUrl = `/voice-demos/${voiceKey}.mp3`;
            }
          }

          if (audioUrl && !audioUrl.startsWith('http://') && !audioUrl.startsWith('https://') && !audioUrl.startsWith('/')) {
            audioUrl = '/' + audioUrl;
          }
        }

        if (!audioUrl) {
          // If no audio URL, show friendly hint
          this.$message.warning(this.$t('roleConfig.noPreviewAudio'));
          return;
        }

        // Standard audio playback logic
        if (!isCloneAudio) {
          // Set playback state
          this.playingVoice = true;

          // Create and play audio
          this.currentAudio = new Audio();
          this.currentAudio.src = audioUrl;

          // Set volume
          this.currentAudio.volume = 1.0;

          // Set timeout to prevent indefinite loading
          const timeoutId = setTimeout(() => {
            if (this.currentAudio && this.playingVoice) {
              this.$message.warning(this.$t('roleConfig.audioLoadTimeout'));
              this.playingVoice = false;
            }
          }, 10000); // 10s timeout

          // Listen for playback error
          this.currentAudio.onerror = () => {
            clearTimeout(timeoutId);
            console.error("Audio playback error");
            this.$message.warning(this.$t('roleConfig.audioPlayFailed'));
            this.playingVoice = false;
          };

          // Listen for playback start, clear timeout
          this.currentAudio.onplay = () => {
            clearTimeout(timeoutId);
          };

          // Listen for playback end
          this.currentAudio.onended = () => {
            this.playingVoice = false;
          };

          // Start playing audio
          this.currentAudio.play().catch((error) => {
            clearTimeout(timeoutId);
            console.error("Playback failed:", error);
            this.$message.warning(this.$t('roleConfig.cannotPlayAudio'));
            this.playingVoice = false;
          });
        }
      } catch (error) {
        console.error("Error during audio playback:", error);
        this.$message.error(this.$t('roleConfig.audioPlayError'));
        this.playingVoice = false;
      }
    },
    updateChatHistoryConf() {
      if (this.form.model.memModelId === "Memory_nomem") {
        this.form.chatHistoryConf = 0;
      }
    },
    // Load feature status
    async loadFeatureStatus() {
      try {
        // Ensure featureManager is initialized
        await featureManager.waitForInitialization();
        const config = featureManager.getConfig();
        this.featureStatus.voiceprintRecognition = config.voiceprintRecognition || false;
        this.featureStatus.vad = config.vad || false;
        this.featureStatus.asr = config.asr || false;
        this.featureStatus.addressBook = config.addressBook || false;
      } catch (error) {
        console.error("Failed to load feature status:", error);
      }
    },
    handleClose(id) {
      this.dynamicTags = this.dynamicTags.filter((item) => item.id !== id);
    },

    showInput() {
      this.inputVisible = true;
      this.$nextTick(_ => {
        this.$refs.saveTagInput.$refs.input.focus();
      });
    },

    handleInputConfirm() {
      let inputValue = this.inputValue;
      if (inputValue) {
        const tag = { id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tagName: inputValue };
        this.dynamicTags.push(tag);
      }
      this.inputVisible = false;
      this.inputValue = '';
    },
    getAgentTags(agentId, options = {}) {
      const requestSeq = ++this.agentTagsFetchSeq;
      this.agentTagsLoaded = false;
      if (!agentId) {
        this.dynamicTags = [];
        this.originalTagNames = [];
        this.agentTagsLoaded = true;
        return Promise.resolve(true);
      }

      return new Promise((resolve) => {
        const handleFailure = (error) => {
          if (requestSeq !== this.agentTagsFetchSeq) {
            resolve(false);
            return;
          }
          this.agentTagsLoaded = false;
          if (options.showError !== false) {
            this.$message.error(error?.data?.msg || i18n.t("roleConfig.fetchConfigFailed"));
          }
          resolve(false);
        };
        Api.agent.getAgentTags(agentId, ({ data }) => {
          if (requestSeq !== this.agentTagsFetchSeq) {
            resolve(false);
            return;
          }
          if (data?.code === 0) {
            try {
              this.dynamicTags = Array.isArray(data.data) ? data.data : [];
              this.originalTagNames = this.dynamicTags.map(tag => tag.tagName);
              this.agentTagsLoaded = true;
              resolve(true);
            } catch (error) {
              handleFailure(error);
            }
          } else {
            handleFailure(data);
          }
        }, handleFailure);
      });
    },
    isSameStringList(left, right) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
      }
      return left.every((value, index) => value === right[index]);
    },
    handleSaveAgentTags(agentId, tagNames = this.dynamicTags.map(tag => tag.tagName)) {
      return new Promise((resolve, reject) => {
        Api.agent.saveAgentTags(agentId, { tagNames }, ({ data }) => {
          if (data.code === 0) {
            this.originalTagNames = [...tagNames];
            resolve();
          } else {
            reject(data.msg);
          }
        });
      });
    }
  },
  beforeRouteLeave(to, from, next) {
    if (!this.isDirty) {
      next();
      return;
    }
    this.$confirm(
      this.tx('roleConfig.leaveText', 'Your changes to this agent will be lost.'),
      this.tx('roleConfig.leaveTitle', 'Leave without saving?'),
      {
        confirmButtonText: this.tx('roleConfig.leaveConfirm', 'Leave'),
        cancelButtonText: this.tx('roleConfig.keepEditing', 'Keep editing'),
        confirmButtonClass: 'el-button--danger',
        type: 'warning',
      }
    )
      .then(() => next())
      .catch(() => next(false));
  },
  beforeDestroy() {
    window.removeEventListener('scroll', this.handlePageScroll);
    window.removeEventListener('resize', this.handlePageScroll);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    if (this.scrollFrame) {
      window.cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    this.agentReloadSeq += 1;
    this.agentConfigFetchSeq += 1;
    this.agentTagsFetchSeq += 1;
    this.currentVersionFetchSeq += 1;
    this.voiceFetchSeq += 1;
  },
  async mounted() {
    window.addEventListener('scroll', this.handlePageScroll, { passive: true });
    window.addEventListener('resize', this.handlePageScroll, { passive: true });
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    this.lastValidTtsDraft = this.captureTtsDraft();
    const agentId = this.$route.query.agentId;
    if (agentId) {
      this.reloadAgentPage(agentId);
    }
    this.fetchModelOptions();
    this.fetchTemplates();
    // Load feature status after featureManager initialized
    await this.loadFeatureStatus();
  },
};
</script>

<style lang="scss" scoped>
// Agent settings: System Settings–style page. Sticky section nav on the left (wide screens),
// one card per section on the right; a single column under 1100px.

.role-config {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--nx-bg);
}

.rc-page {
  flex: 1 0 auto;
}

// ------------------------------------------------------------------ header

.rc-header {
  align-items: center;
}
.rc-header__text {
  display: flex;
  align-items: center;
  gap: var(--nx-space-4);
}
.rc-header__avatar {
  width: 48px;
  height: 48px;
  font-size: var(--nx-text-headline);
}
.rc-header__titles {
  min-width: 0;
  flex: 1;
}
.rc-header__title-row {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-width: 0;
  .nx-title {
    min-width: 0;
  }
  .nx-badge {
    flex: none;
  }
}
.rc-header .nx-page-header__desc {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  i {
    margin-top: 3px;
    color: var(--nx-text-3);
  }
}

// ------------------------------------------------------------------ layout

.rc-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--nx-space-7);
  align-items: start;
}

.rc-nav {
  position: sticky;
  top: calc(var(--nx-topbar-h) + var(--nx-space-6));
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.rc-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 0 var(--nx-space-3);
  border-radius: var(--nx-radius-sm);
  color: var(--nx-text-2);
  font-size: var(--nx-text-callout);
  font-weight: 500;
  white-space: nowrap;
  transition: background-color var(--nx-dur-1) var(--nx-ease), color var(--nx-dur-1) var(--nx-ease);
  i {
    flex: none;
    font-size: var(--nx-text-body);
  }
  &:hover {
    background: var(--nx-surface-2);
    color: var(--nx-text);
  }
  &.is-active {
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
  }
}

.rc-sections {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-5);
  min-width: 0;
}

// ------------------------------------------------------------------ section card

.rc-section {
  padding: var(--nx-space-6);
  scroll-margin-top: calc(var(--nx-topbar-h) + var(--nx-space-6));
}
.rc-section__head {
  display: flex;
  align-items: flex-start;
  gap: var(--nx-space-3);
  margin-bottom: var(--nx-space-5);
}
.rc-section__icon {
  width: 36px;
  height: 36px;
  font-size: var(--nx-text-headline);
}
.rc-section__titles {
  flex: 1;
  min-width: 0;
  .nx-headline {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--nx-space-2);
  }
  .nx-footnote {
    margin: 2px 0 0;
  }
}
.rc-section__action {
  flex: none;
  &.is-active {
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
  }
}
.rc-subsection {
  margin-top: var(--nx-space-5);
  padding-top: var(--nx-space-5);
  border-top: 1px solid var(--nx-border);
}

// ------------------------------------------------------------------ fields

.rc-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--nx-space-4) var(--nx-space-5);
}
.rc-grid + .rc-field,
.rc-field + .rc-grid,
.rc-grid + .rc-list,
.rc-field + .rc-list {
  margin-top: var(--nx-space-5);
}
.rc-field {
  min-width: 0;
}
.rc-field + .rc-field,
.rc-grid + .rc-grid {
  margin-top: var(--nx-space-4);
}
.rc-grid > .rc-field + .rc-field {
  margin-top: 0;
}
.rc-label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  margin-bottom: 6px;
  color: var(--nx-text-2);
  font-size: var(--nx-text-footnote);
  font-weight: 500;
}
.rc-help {
  color: var(--nx-text-3);
  font-size: var(--nx-text-footnote);
  font-weight: 400;
  cursor: help;
  border-radius: 50%;
  &:hover,
  &:focus-visible {
    color: var(--nx-text-2);
  }
}
.rc-select {
  width: 100%;
}

// Option rows inside selects: name left, provider / play right
.rc-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--nx-space-3);
  min-width: 0;
}
.rc-option__meta {
  flex: none;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--nx-text-3);
  font-size: var(--nx-text-caption);
}
.rc-option__play {
  flex: none;
  padding: 0;
  color: var(--nx-accent);
  font-size: var(--nx-text-headline);
}

// Tags
.rc-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--nx-space-2);
  min-height: var(--nx-control-h);
}
.rc-tag {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.rc-tag-input {
  width: 140px;
}

// Prompt + template chips
.rc-field--prompt {
  margin-top: var(--nx-space-5);
}
.rc-templates {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);
  margin-bottom: var(--nx-space-3);
}
.rc-templates__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--nx-text-3);
  font-size: var(--nx-text-caption);
  font-weight: 500;
}
.rc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--nx-space-2);
}
.rc-chip {
  display: inline-flex;
  align-items: center;
  max-width: 220px;
  height: 30px;
  padding: 0 var(--nx-space-3);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface);
  color: var(--nx-text);
  font: inherit;
  font-size: var(--nx-text-footnote);
  cursor: pointer;
  transition: background-color var(--nx-dur-1) var(--nx-ease), border-color var(--nx-dur-1) var(--nx-ease),
    transform var(--nx-dur-1) var(--nx-ease);
  &:hover {
    background: var(--nx-accent-soft);
    border-color: transparent;
    color: var(--nx-accent);
  }
  &:active {
    transform: scale(0.97);
  }
  &:disabled {
    opacity: 0.5;
    cursor: progress;
  }
}
.rc-prompt ::v-deep .el-textarea__inner {
  padding: var(--nx-space-3) 14px;
  line-height: 1.6;
  resize: vertical;
}
.rc-count {
  margin-top: 6px;
  text-align: right;
  color: var(--nx-text-3);
  font-size: var(--nx-text-caption);
  &.is-near {
    color: var(--nx-warning);
  }
}

// Voice select + preview
.rc-voice {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  .rc-select {
    flex: 1;
    min-width: 0;
  }
}
.rc-voice__play {
  flex: none;
  background: var(--nx-surface-2);
  color: var(--nx-accent);
  &.is-playing {
    background: var(--nx-accent-soft);
  }
  &:disabled {
    color: var(--nx-text-3);
    cursor: not-allowed;
    background: var(--nx-surface-2);
    transform: none;
  }
}

// Segmented radio (chat history)
.rc-segmented {
  display: inline-flex;
  max-width: 100%;
}

// ------------------------------------------------------------------ list rows

.rc-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius);
  overflow: hidden;
}
.rc-row {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-height: 56px;
  padding: 10px var(--nx-space-4);
  background: var(--nx-surface);
  transition: background-color var(--nx-dur-1) var(--nx-ease);
  & + & {
    border-top: 1px solid var(--nx-border);
  }
  &:hover {
    background: var(--nx-surface-2);
  }
}
.rc-row__icon {
  width: 32px;
  height: 32px;
  border-radius: var(--nx-radius-sm);
  font-size: var(--nx-text-body);
}
.rc-tool-initial {
  font-size: var(--nx-text-footnote);
  font-weight: 700;
  text-transform: uppercase;
}
.rc-row__text {
  flex: 1;
  min-width: 0;
}
.rc-row__title {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  min-width: 0;
  color: var(--nx-text);
  font-size: var(--nx-text-callout);
  font-weight: 500;
  &.nx-truncate {
    display: block;
  }
}
.rc-row__meta {
  margin-top: 2px;
  color: var(--nx-text-3);
  font-size: var(--nx-text-caption);
}
.rc-row__action {
  flex: none;
}
.rc-row.is-off .rc-row__title {
  color: var(--nx-text-2);
}
.rc-danger-text,
.rc-danger-text:hover,
.rc-danger-text:focus {
  color: var(--nx-danger);
}

.rc-empty {
  padding: var(--nx-space-7) var(--nx-space-4);
  border: 1px dashed var(--nx-border-strong);
  border-radius: var(--nx-radius);
}

.rc-skeleton-tile {
  width: 32px;
  height: 32px;
  flex: none;
}
.rc-skeleton-line {
  width: 40%;
  height: 12px;
  & + & {
    margin-top: 6px;
  }
  &--short {
    width: 24%;
  }
}

.rc-link {
  margin-left: 4px;
  white-space: nowrap;
  &:hover {
    text-decoration: underline;
  }
}

// ------------------------------------------------------------------ floating save bar

.rc-savebar {
  position: fixed;
  left: 50%;
  bottom: var(--nx-space-6);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  max-width: calc(100vw - 32px);
  padding: 6px 6px 6px var(--nx-space-4);
  background: var(--nx-surface);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius-pill);
  box-shadow: var(--nx-shadow-3);
  transform: translateX(-50%);
}
.rc-savebar__text {
  color: var(--nx-text);
  font-size: var(--nx-text-callout);
  font-weight: 500;
  white-space: nowrap;
}
.rc-savebar ::v-deep .el-button {
  border-radius: var(--nx-radius-pill);
}
.rc-savebar-enter-active {
  transition: opacity var(--nx-dur-2) var(--nx-ease), transform var(--nx-dur-3) var(--nx-ease);
}
.rc-savebar-leave-active {
  transition: opacity var(--nx-dur-1) var(--nx-ease-in), transform var(--nx-dur-1) var(--nx-ease-in);
}
.rc-savebar-enter,
.rc-savebar-leave-to {
  opacity: 0;
  transform: translate(-50%, 16px);
}

// ------------------------------------------------------------------ responsive

@media (max-width: 1099px) {
  .rc-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--nx-space-4);
  }
  .rc-nav {
    top: var(--nx-topbar-h);
    z-index: 20;
    flex-direction: row;
    gap: var(--nx-space-1);
    margin: 0 calc(-1 * var(--nx-gutter));
    padding: var(--nx-space-2) var(--nx-gutter);
    overflow-x: auto;
    background: var(--nx-bg);
    border-bottom: 1px solid var(--nx-border);
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
  .rc-nav__item {
    flex: none;
    min-height: 32px;
    border-radius: var(--nx-radius-pill);
  }
  .rc-section {
    scroll-margin-top: calc(var(--nx-topbar-h) + 64px);
  }
}

@media (max-width: 640px) {
  .rc-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .rc-section {
    padding: var(--nx-space-5) var(--nx-space-4);
  }
  .rc-section__head {
    flex-wrap: wrap;
  }
  .rc-section__action {
    margin-left: 48px;
  }
  .rc-header__avatar {
    display: none;
  }
  .rc-row {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rc-savebar-enter,
  .rc-savebar-leave-to {
    transform: translateX(-50%);
  }
}
</style>

<style>
.custom-tooltip {
  max-width: 400px;
  word-break: break-word;
}
</style>
