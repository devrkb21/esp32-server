<template>
  <div class="nx-admin">
    <HeaderBar />
    <main class="nx-page nx-page--narrow">
      <header class="nx-page-header">
        <div class="nx-page-header__text">
          <h1 class="nx-title">{{ $t('header.featureManagement') }}</h1>
          <p class="nx-page-header__desc">{{ tt('featureManagement.pageDesc', 'Turn console sections on or off, and choose what agents can use.') }}</p>
        </div>
        <div class="nx-page-header__actions">
          <span v-if="pendingChanges" class="nx-badge nx-badge--warning" role="status">
            {{ tt('featureManagement.unsavedChanges', 'Unsaved changes') }}
          </span>
          <CustomButton icon="el-icon-refresh-left" @click="handleReset" :disabled="isSaving">
            {{ $t('featureManagement.reset') }}
          </CustomButton>
          <CustomButton type="confirm" icon="el-icon-check" @click="handleSave" :loading="isSaving" :disabled="isSaving">
            {{ isSaving ? $t('featureManagement.saving') : $t('featureManagement.save') }}
          </CustomButton>
        </div>
      </header>

      <div v-if="groups.length" class="nx-stack feature-groups">
        <section v-for="group in groups" :key="group.key" class="settings-group">
          <div class="settings-group__head">
            <div class="settings-group__text">
              <h2 class="nx-headline">{{ $t(`featureManagement.groupName.${group.key}`) }}</h2>
              <p class="settings-group__desc">{{ $t(`featureManagement.groupDescription.${group.key}`) }}</p>
            </div>
            <span class="nx-caption nx-num">{{ $t('featureManagement.moduleCount', { count: group.features.length }) }}</span>
          </div>
          <ul class="nx-card nx-card--flush setting-list">
            <li v-for="feature in group.features" :key="feature.id" class="setting-row"
              :class="{ 'is-disabled': isSaving }" @click="!isSaving && toggleFeature(feature)">
              <span class="nx-icon-tile" :class="{ 'nx-icon-tile--neutral': !feature.enabled }" aria-hidden="true">
                <i :class="group.icons[feature.id] || 'el-icon-s-grid'"></i>
              </span>
              <div class="setting-row__text">
                <span :id="`feature-${feature.id}`" class="setting-row__title">{{ $t(`feature.${feature.id}.name`) }}</span>
                <span class="setting-row__desc">{{ $t(`feature.${feature.id}.description`) }}</span>
              </div>
              <span class="setting-row__control" @click.stop>
                <el-switch :value="feature.enabled" :disabled="isSaving" :aria-labelledby="`feature-${feature.id}`"
                  @change="toggleFeature(feature)" />
              </span>
            </li>
          </ul>
        </section>

        <div class="feature-footer">
          <CustomButton size="small" :icon="isAllSelected ? 'el-icon-circle-close' : 'el-icon-circle-check'"
            :disabled="isSaving" @click="!isSaving && toggleSelectAll()">
            {{ isAllSelected ? $t('featureManagement.deselectAll') : $t('featureManagement.selectAll') }}
          </CustomButton>
        </div>
      </div>

      <div v-if="filteredFeatures.length === 0" class="nx-card nx-empty">
        <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-s-grid"></i></span>
        <p class="nx-empty__title">{{ $t('featureManagement.noFeatures') }}</p>
        <p class="nx-empty__text">{{ $t('featureManagement.contactAdmin') }}</p>
      </div>
    </main>

    <VersionFooter />
  </div>
</template>

<script>
import HeaderBar from "@/components/HeaderBar.vue";
import VersionFooter from "@/components/VersionFooter.vue";
import featureManager from "@/utils/featureManager.js";
import CustomButton from "@/components/CustomButton.vue";

export default {
  name: "FeatureManagement",
  components: {
    HeaderBar,
    VersionFooter,
    CustomButton
  },
  data() {
    return {
      pendingChanges: false,
      featureManagementFeatures: [],
      voiceManagementFeatures: [],
      isSaving: false, // Save status lock
      // Feature module icon mapping (Element icon classes)
      featureIcons: {
        'voiceprintRecognition': 'el-icon-user',
        'voiceClone': 'el-icon-microphone',
        'knowledgeBase': 'el-icon-notebook-2',
        'mcpAccessPoint': 'el-icon-connection',
        'addressBook': 'el-icon-notebook-1',
      },
      voiceManagementIcons: {
        'vad': 'el-icon-headset',
        'asr': 'el-icon-chat-dot-round',
      },
    }
  },
  computed: {
    groups() {
      return [
        {
          key: 'featureManagement',
          features: this.featureManagementFeatures,
          icons: this.featureIcons
        },
        {
          key: 'voiceManagement',
          features: this.voiceManagementFeatures,
          icons: this.voiceManagementIcons
        }
      ].filter(group => group.features.length > 0)
    },
    // All features list
    filteredFeatures() {
      return [...this.featureManagementFeatures, ...this.voiceManagementFeatures]
    },
    
    // Check if all features are selected
    isAllSelected() {
      const allFeatures = [...this.featureManagementFeatures, ...this.voiceManagementFeatures]
      return allFeatures.length > 0 && allFeatures.every(feature => feature.enabled)
    }
  },
  async created() {
    // Wait for feature config manager initialization
    try {
      await featureManager.waitForInitialization()
      await this.loadFeatures()
      this.setupConfigChangeListener()
    } catch (error) {
      console.error('Feature config manager initialization wait failed:', error)
      await this.loadFeatures()
      this.setupConfigChangeListener()
    }
  },
  
  beforeDestroy() {
    this.removeConfigChangeListener()
  },
  
  methods: {
    tt(key, fallback) {
      return this.$te(key) || this.$te(key, 'en') ? this.$t(key) : fallback
    },
    // Get features by ID list
    async getFeaturesByIds(featureIds) {
      try {
        const featureConfig = await featureManager.getAllFeatures()
        const result = featureIds.map(id => {
          const feature = featureConfig[id]
          return {
            id: id,
            name: this.$t(`feature.${id}.name`),
            description: this.$t(`feature.${id}.description`),
            enabled: feature?.enabled || false
          }
        })
        
        return result
      } catch (error) {
        console.error('Failed to get feature configuration:', error)
        // If fetch fails, return default configuration
        return featureIds.map(id => ({
          id: id,
          name: this.$t(`feature.${id}.name`),
          description: this.$t(`feature.${id}.description`),
          enabled: false
        }))
      }
    },
    
    // Load feature configuration
    async loadFeatures() {
      // Save current user selection state
      const currentFeatureStates = {}
      const allCurrentFeatures = [...this.featureManagementFeatures, ...this.voiceManagementFeatures]
      allCurrentFeatures.forEach(feature => {
        currentFeatureStates[feature.id] = feature.enabled
      })
      
      // Reload configuration
      this.featureManagementFeatures = await this.getFeaturesByIds(['voiceprintRecognition', 'voiceClone', 'knowledgeBase', 'mcpAccessPoint', 'addressBook'])
      this.voiceManagementFeatures = await this.getFeaturesByIds(['vad', 'asr'])
      
      // Restore user selection state (if exists)
      const allFeatures = [...this.featureManagementFeatures, ...this.voiceManagementFeatures]
      allFeatures.forEach(feature => {
        if (currentFeatureStates.hasOwnProperty(feature.id)) {
          feature.enabled = currentFeatureStates[feature.id]
        }
      })
    },
    // Toggle feature status
    async toggleFeature(feature) {
      // Prevent action while saving
      if (this.isSaving) {
        return
      }
      
      feature.enabled = !feature.enabled
      this.pendingChanges = true
      
      // Update unified in config manager only when saving
    },
    // Save configuration
    async handleSave() {
      if (!this.pendingChanges) {
        this.$message.info({
          message: this.$t('featureManagement.noChanges'),
          showClose: true
        })
        return
      }
      
      // Set saving state, lock interface
      this.isSaving = true
      
      try {
        // Get all feature states and save
        const featureUpdates = {}
        const allFeatures = [...this.featureManagementFeatures, ...this.voiceManagementFeatures]
        allFeatures.forEach(feature => {
          featureUpdates[feature.id] = feature.enabled
        })
        await featureManager.updateFeatures(featureUpdates)
        
        this.pendingChanges = false
        this.$message.success({
          message: this.$t('featureManagement.saveSuccess'),
          showClose: true
        })

        setTimeout(() => {
          this.loadFeatures()
        }, 1000)
      } catch (error) {
        console.error('Failed to save configuration:', error)
        this.$message.error({
          message: this.$t('featureManagement.saveError'),
          showClose: true
        })
      } finally {
        // Release saving lock regardless of success or failure
        this.isSaving = false
      }
    },
    // Set config change listener
    setupConfigChangeListener() {
      this.configChangeHandler = () => {
        this.loadFeatures()
      }
      window.addEventListener('featureConfigReloaded', this.configChangeHandler)
    },
    
    // Remove config change listener
    removeConfigChangeListener() {
      if (this.configChangeHandler) {
        window.removeEventListener('featureConfigReloaded', this.configChangeHandler)
      }
    },
    
    // Reset configuration
    async handleReset() {
      try {
        await this.$confirm(
          this.$t('featureManagement.resetConfirm'),
          this.$t('featureManagement.reset'),
          {
            confirmButtonText: this.$t('featureManagement.confirm'),
            cancelButtonText: this.$t('featureManagement.cancel'),
            type: 'warning'
          }
        )
        
        featureManager.resetToDefault()
        this.loadFeatures()
        this.pendingChanges = false
        
        this.$message.success({
          message: this.$t('featureManagement.resetSuccess'),
          showClose: true
        })
        
        setTimeout(() => {
          this.loadFeatures()
          this.$router.go(0)
        }, 1000)
      } catch (error) {
        // User cancelled operation
      }
    },
    // Search feature (reserved interface)
    handleSearch() {
      // Search feature to be implemented
    },
    // Select all / Deselect all
    toggleSelectAll() {
      // Prevent action while saving
      if (this.isSaving) {
        return
      }
      
      const allFeatures = [...this.featureManagementFeatures, ...this.voiceManagementFeatures]
      const newStatus = !this.isAllSelected
      
      allFeatures.forEach(feature => {
        feature.enabled = newStatus
      })
      
      this.pendingChanges = true
    }
  }
}
</script>

<style lang="scss" scoped>
.nx-admin {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  > .nx-page {
    flex: 1 0 auto;
  }
}
.feature-groups {
  gap: var(--nx-space-7);
}

// Settings group: caption above an inset card of rows (title + description left, switch right)
.settings-group {
  &__head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--nx-space-3);
    margin: 0 var(--nx-space-1) var(--nx-space-3);
  }
  &__text {
    min-width: 0;
  }
  &__desc {
    margin: 2px 0 0;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
}
.setting-list {
  margin: 0;
  list-style: none;
}
.setting-row {
  display: flex;
  align-items: center;
  gap: var(--nx-space-4);
  min-height: 72px;
  padding: var(--nx-space-4) var(--nx-space-5);
  cursor: pointer;
  transition: background-color var(--nx-dur-1) var(--nx-ease);
  & + & {
    border-top: 1px solid var(--nx-border);
  }
  &:hover {
    background: var(--nx-surface-2);
  }
  &.is-disabled {
    cursor: progress;
    opacity: 0.7;
  }
  .nx-icon-tile {
    transition: background-color var(--nx-dur-2) var(--nx-ease), color var(--nx-dur-2) var(--nx-ease);
  }
  &__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  &__title {
    font-size: var(--nx-text-body);
    font-weight: 600;
    color: var(--nx-text);
    overflow-wrap: anywhere;
  }
  &__desc {
    font-size: var(--nx-text-footnote);
    line-height: 1.45;
    color: var(--nx-text-2);
  }
  &__control {
    display: inline-flex;
    flex: none;
    padding: var(--nx-space-2) 0 var(--nx-space-2) var(--nx-space-2);
    cursor: default;
  }
}
.feature-footer {
  display: flex;
  justify-content: flex-start;
}
</style>
