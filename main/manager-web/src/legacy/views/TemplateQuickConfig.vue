<template>
  <div class="template-config">
    <HeaderBar />

    <main class="nx-page nx-page--narrow">
      <button type="button" class="nx-back" @click="goToHome">
        <i class="el-icon-arrow-left" aria-hidden="true"></i>
        <span>{{ tx('templateQuickConfig.backToTemplates', 'Templates') }}</span>
      </button>

      <header class="nx-page-header tq-header">
        <div class="nx-page-header__text tq-header__text">
          <span class="nx-avatar tq-header__avatar" aria-hidden="true">{{ agentInitial }}</span>
          <div class="tq-header__titles">
            <h1 class="nx-title nx-truncate" :title="form.agentName">{{ form.agentName || $t('templateQuickConfig.title') }}</h1>
            <p class="nx-page-header__desc">
              {{ tx('templateQuickConfig.description', 'The name and personality prompt new agents start with.') }}
            </p>
          </div>
        </div>
        <div class="nx-page-header__actions">
          <el-button @click="resetConfig">{{ $t('templateQuickConfig.resetConfig') }}</el-button>
          <el-button type="primary" @click="saveConfig">{{ $t('templateQuickConfig.saveConfig') }}</el-button>
        </div>
      </header>

      <section class="nx-card tq-card">
        <el-form ref="form" :model="form" label-position="top" class="tq-form" @submit.native.prevent>
          <!-- Assistant Nickname -->
          <el-form-item :label="$t('templateQuickConfig.agentSettings.agentName')" prop="agentName">
            <el-input
              v-model="form.agentName"
              maxlength="64"
              :placeholder="$t('templateQuickConfig.agentSettings.agentNamePlaceholder')"
              :validate-event="false"
            />
          </el-form-item>

          <!-- Role Introduction -->
          <el-form-item :label="$t('templateQuickConfig.agentSettings.systemPrompt')" prop="systemPrompt" class="tq-form__prompt">
            <el-input
              v-model="form.systemPrompt"
              type="textarea"
              :autosize="{ minRows: 14, maxRows: 30 }"
              :placeholder="$t('templateQuickConfig.agentSettings.systemPromptPlaceholder')"
              :validate-event="false"
              maxlength="2000"
            />
            <div class="tq-count nx-num" :class="{ 'is-near': promptLength >= 1800 }" aria-live="polite">
              {{ promptLength }} / 2000
            </div>
          </el-form-item>
        </el-form>
      </section>
    </main>

    <VersionFooter />
  </div>
</template>

<script>
import HeaderBar from "@/components/HeaderBar.vue";
import agentApi from '@/apis/module/agent';
import VersionFooter from "@/components/VersionFooter.vue";

// Default model config constants
const DEFAULT_MODEL_CONFIG = {
  ttsModelId: "TTS_EdgeTTS",
  vadModelId: "VAD_SileroVAD",
  asrModelId: "ASR_FunASR",
  llmModelId: "LLM_ChatGLMLLM",
  vllmModelId: "VLLM_ChatGLMVLLM",
  memModelId: "Memory_nomem",
  intentModelId: "Intent_function_call"
};

export default {
  name: 'TemplateQuickConfig',
  components: { HeaderBar, VersionFooter },
  data() {
    return {
      form: {
        agentCode: "Xiaozhi",
        agentName: "",
        systemPrompt: "",
        sort: 0,
        model: { ...DEFAULT_MODEL_CONFIG }
      },
      templateId: '',
      originalForm: null
    };
  },
  computed: {
    promptLength() {
      return String(this.form.systemPrompt || '').length;
    },
    agentInitial() {
      const name = String(this.form.agentName || '').trim();
      return name ? Array.from(name)[0] : '·';
    }
  },
  methods: {
    // Translation with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback) {
      const value = this.$t(key);
      return value && value !== key ? value : fallback;
    },
    // Return to template management page
    goToHome() {
      this.$router.push('/agent-template-management');
    },
    
    // Save configuration
    saveConfig() {
      const configData = this.prepareConfigData();
      
      if (this.templateId) {
        this.updateExistingTemplate(configData);
      } else {
        this.createNewTemplate(configData);
      }
    },
    
    // Prepare configuration data
    prepareConfigData() {
      return {
        id: this.templateId || '',
        agentCode: this.form.agentCode,
        agentName: this.form.agentName,
        systemPrompt: this.form.systemPrompt,
        sort: this.form.sort,
        functions: [],
        // Include necessary model fields to ensure API call succeeds
        ...this.form.model
      };
    },
    
    // Update existing template
    updateExistingTemplate(configData) {
      agentApi.updateAgentTemplate(configData, (res) => {
        if (res && res.data && res.data.code === 0) {
          this.$message.success({ 
            message: this.$t('templateQuickConfig.saveSuccess'), 
            showClose: true 
          });
          this.originalForm = JSON.parse(JSON.stringify(this.form));
        } else {
          this.$message.error({ 
            message: res?.data?.msg || this.$t('templateQuickConfig.saveFailed'), 
            showClose: true 
          });
        }
      });
    },
    
    // Create new template
    createNewTemplate(configData) {
      agentApi.addAgentTemplate(configData, (res) => {
        if (res && res.data && res.data.code === 0) {
          this.$message.success({ 
            message: this.$t('templateQuickConfig.saveSuccess'), 
            showClose: true 
          });
          this.goToHome();
        } else {
          this.$message.error({ 
            message: res?.data?.msg || this.$t('templateQuickConfig.saveFailed'), 
            showClose: true 
          });
        }
      });
    },
    
    // Reset configuration
    resetConfig() {
      this.$confirm(
        this.$t('templateQuickConfig.confirmReset'), 
        this.$t('common.tip'), 
        {
          confirmButtonText: this.$t('common.confirm'),
          cancelButtonText: this.$t('common.cancel'),
          type: 'warning'
        }
      ).then(() => {
        if (this.originalForm) {
          this.form = JSON.parse(JSON.stringify(this.originalForm));
        }
        this.$message.success({ 
          message: this.$t('templateQuickConfig.resetSuccess'), 
          showClose: true 
        });
      }).catch(() => {});
    },
    
    // Get template by ID
    fetchTemplateById(templateId) {
      agentApi.getAgentTemplateById(templateId, (res) => {
        if (res && res.data && res.data.code === 0 && res.data.data) {
          const template = res.data.data;
          this.applyTemplateData(template);
          this.templateId = templateId;
          this.originalForm = JSON.parse(JSON.stringify(this.form));
        } else {
          this.$message.error(res?.data?.msg || this.$t('templateQuickConfig.templateNotFound'));
        }
      });
    },
    
    // Apply template data
    applyTemplateData(templateData) {
      this.form = {
        ...this.form,
        agentName: templateData.agentName || this.form.agentName,
        agentCode: templateData.agentCode || this.form.agentCode,
        systemPrompt: templateData.systemPrompt || this.form.systemPrompt,
        sort: templateData.sort || this.form.sort,
        model: {
          ttsModelId: templateData.ttsModelId || this.form.model.ttsModelId,
          vadModelId: templateData.vadModelId || this.form.model.vadModelId,
          asrModelId: templateData.asrModelId || this.form.model.asrModelId,
          llmModelId: templateData.llmModelId || this.form.model.llmModelId,
          vllmModelId: templateData.vllmModelId || this.form.model.vllmModelId,
          memModelId: templateData.memModelId || this.form.model.memModelId,
          intentModelId: templateData.intentModelId || this.form.model.intentModelId
        }
      };
    },
    
    // Set default template values
    setDefaultTemplateValues() {
      this.form = {
        ...this.form,
        agentName: this.$t('templateQuickConfig.newTemplate'),
        agentCode: 'Xiaozhi',
        systemPrompt: '',
        sort: 1
      };
      
      this.originalForm = JSON.parse(JSON.stringify(this.form));
    },
    
    // Get template list and set sort order
    fetchTemplateListForSort() {
      agentApi.getAgentTemplate((res) => {
        if (res && res.data && res.data.code === 0) {
          const templateList = res.data.data || [];
          if (templateList.length > 0) {
            const maxSort = Math.max(...templateList.map(t => t.sort || 0));
            this.form.sort = maxSort + 1;
          } else {
            this.form.sort = 1;
          }
        } else {
          this.form.sort = 1;
        }
        
        this.originalForm = JSON.parse(JSON.stringify(this.form));
      });
    }
  },
  
  // Initialize when component mounted
  mounted() {
    const templateId = this.$route.query.templateId;
    
    if (templateId) {
      // Edit mode: load existing template
      this.fetchTemplateById(templateId);
    } else {
      // Create mode: set defaults and get sort order
      this.form.agentName = this.$t('templateQuickConfig.newTemplate');
      this.fetchTemplateListForSort();
    }
  }
};
</script>

<style lang="scss" scoped>
.template-config {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--nx-bg);
  > .nx-page {
    flex: 1 0 auto;
  }
}

.tq-header {
  align-items: center;
}
.tq-header__text {
  display: flex;
  align-items: center;
  gap: var(--nx-space-4);
}
.tq-header__avatar {
  width: 48px;
  height: 48px;
  font-size: var(--nx-text-headline);
}
.tq-header__titles {
  flex: 1;
  min-width: 0;
}

.tq-card {
  padding: var(--nx-space-6);
}
.tq-form {
  ::v-deep .el-form-item__label {
    padding-bottom: 6px;
    color: var(--nx-text-2);
    font-size: var(--nx-text-footnote);
    font-weight: 500;
    line-height: 1.4;
  }
  ::v-deep .el-textarea__inner {
    padding: var(--nx-space-3) 14px;
    line-height: 1.6;
    resize: vertical;
  }
}
.tq-form__prompt {
  margin-bottom: 0;
}
.tq-count {
  margin-top: 6px;
  text-align: right;
  color: var(--nx-text-3);
  font-size: var(--nx-text-caption);
  line-height: 1.4;
  &.is-near {
    color: var(--nx-warning);
  }
}

@media (max-width: 640px) {
  .tq-header__avatar {
    display: none;
  }
  .tq-card {
    padding: var(--nx-space-5) var(--nx-space-4);
  }
}
</style>
