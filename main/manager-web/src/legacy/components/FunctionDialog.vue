<template>
  <el-drawer
    :visible.sync="dialogVisible"
    direction="rtl"
    size="min(1080px, 100%)"
    custom-class="nx-function-drawer"
    :wrapperClosable="false"
    :withHeader="false"
  >
    <div class="fd">
      <!-- Header -->
      <header class="fd-header">
        <div class="fd-header__titles">
          <h3 class="nx-headline">{{ $t('functionDialog.title') }}</h3>
          <span class="nx-badge nx-badge--accent nx-num">{{ selectedList.length }} / {{ selectedList.length + unselected.length }}</span>
        </div>
        <button type="button" class="nx-icon-btn" :aria-label="tx('functionDialog.close', 'Close')" @click="closeDialog">
          <i class="el-icon-close" aria-hidden="true"></i>
        </button>
      </header>

      <div class="fd-body">
        <div class="function-manager">
          <!-- Plugin picker: enabled first, then available -->
          <div class="function-column">
            <div class="column-header">
              <h4 class="column-title">{{ $t('functionDialog.selectedFunctions') }}</h4>
              <el-button type="text" size="small" class="select-all-btn" :disabled="!selectedList.length" @click="deselectAll">
                {{ $t('agentTemplateManagement.deselectAll') }}
              </el-button>
            </div>
            <div class="function-list">
              <template v-if="selectedList.length > 0">
                <div
                  v-for="func in selectedList"
                  :key="func.name"
                  class="function-item"
                  :class="{ 'is-current': currentFunction && currentFunction.name === func.name }"
                >
                  <el-checkbox
                    :label="func.name"
                    v-model="selectedNames"
                    :aria-label="func.name"
                    @change="(val) => handleCheckboxChange(func, val)"
                    @click.native.stop
                  ></el-checkbox>
                  <button type="button" class="func-tag" :title="func.name" @click="handleFunctionClick(func)">
                    <span class="func-initial" aria-hidden="true">{{ initialOf(func.name) }}</span>
                    <span class="nx-truncate">{{ func.name }}</span>
                    <i class="el-icon-arrow-right func-chevron" aria-hidden="true"></i>
                  </button>
                </div>
              </template>
              <div v-else class="fd-empty-line">{{ $t('functionDialog.pleaseSelectPlugin') }}</div>
            </div>

            <div class="column-header column-header--second">
              <h4 class="column-title">{{ tx('functionDialog.available', 'Available') }}</h4>
              <el-button type="text" size="small" class="select-all-btn" :disabled="!unselected.length" @click="selectAll">
                {{ $t('functionDialog.selectAll') }}
              </el-button>
            </div>
            <div class="function-list">
              <template v-if="unselected.length">
                <div v-for="func in unselected" :key="func.name" class="function-item is-unselected">
                  <el-checkbox
                    :label="func.name"
                    v-model="selectedNames"
                    :aria-label="func.name"
                    @change="(val) => handleCheckboxChange(func, val)"
                    @click.native.stop
                  ></el-checkbox>
                  <button type="button" class="func-tag" :title="func.name" @click="handleFunctionClick(func)">
                    <span class="func-initial" aria-hidden="true">{{ initialOf(func.name) }}</span>
                    <span class="nx-truncate">{{ func.name }}</span>
                  </button>
                </div>
              </template>
              <div v-else class="fd-empty-line">{{ $t('functionDialog.noMorePlugins') }}</div>
            </div>
          </div>

          <!-- Parameter configuration -->
          <div class="params-column">
            <template v-if="currentFunction">
              <div class="params-head">
                <span class="nx-icon-tile params-head__icon" aria-hidden="true">{{ initialOf(currentFunction.name) }}</span>
                <div class="params-head__text">
                  <div class="nx-caption">{{ $t('functionDialog.paramConfig') }}</div>
                  <h4 class="nx-headline nx-truncate" :title="currentFunction.name">{{ currentFunction.name }}</h4>
                </div>
              </div>

              <div class="params-container">
                <!-- Smart Home Helper if Home Assistant plugin -->
                <div v-if="isHomeAssistant(currentFunction)" class="ha-assistant-panel">
                  <div class="ha-header">
                    <div class="ha-badge"><i class="el-icon-house" aria-hidden="true"></i> {{ $t('functionDialog.smartHomeGuide') }}</div>
                    <p class="ha-desc">{{ $t('functionDialog.smartHomeGuideDesc') }}</p>
                  </div>
                  <div class="ha-quick-actions">
                    <el-button size="mini" icon="el-icon-sunny" @click="insertDeviceTemplate('Living Room, Ceiling Light, light.living_room')">
                      {{ $t('functionDialog.addLight') }}
                    </el-button>
                    <el-button size="mini" icon="el-icon-refresh" @click="insertDeviceTemplate('Bedroom, Ceiling Fan, fan.bedroom')">
                      {{ $t('functionDialog.addFan') }}
                    </el-button>
                    <el-button size="mini" icon="el-icon-cold-drink" @click="insertDeviceTemplate('Living Room, AC, climate.living_room')">
                      {{ $t('functionDialog.addClimate') }}
                    </el-button>
                    <el-button size="mini" icon="el-icon-switch-button" @click="insertDeviceTemplate('Kitchen, Coffee Maker, switch.coffee_maker')">
                      {{ $t('functionDialog.addSwitch') }}
                    </el-button>
                    <el-button size="mini" icon="el-icon-lock" @click="insertDeviceTemplate('Entrance, Front Door Lock, lock.front_door')">
                      {{ $t('functionDialog.addLock') }}
                    </el-button>
                  </div>
                  <div class="ha-voice-commands">
                    <div class="ha-cmd-title">{{ $t('functionDialog.sampleCommands') }}</div>
                    <ul class="ha-cmd-list">
                      <li lang="bn"><em>"লিভিং রুমের লাইট জ্বালাও / বন্ধ করো"</em> (বাতির আলো ৮০% করো)</li>
                      <li lang="bn"><em>"ফ্যান চালু করো / ৫০% স্পিডে চালাও"</em></li>
                      <li lang="bn"><em>"এসি ২৪ ডিগ্রিতে সেট করো"</em> / <em>"দরজা লক করো"</em></li>
                      <li lang="en"><em>"Turn on/off living room light"</em> / <em>"Set fan speed to 50%"</em></li>
                    </ul>
                  </div>
                </div>

                <el-form :model="currentFunction" label-position="top" class="param-form">
                  <!-- Iterate fieldsMeta instead of params keys -->
                  <div v-if="currentFunction.fieldsMeta.length == 0" class="fd-empty">
                    <span class="nx-icon-tile" aria-hidden="true"><i class="el-icon-check"></i></span>
                    <p class="nx-callout">{{ currentFunction.name + $t('functionDialog.noNeedToConfig') }}</p>
                  </div>
                  <el-form-item
                    v-for="field in currentFunction.fieldsMeta"
                    :key="field.key"
                    :label="field.label"
                    class="param-item"
                    :class="{ 'textarea-field': field.type === 'array' || field.type === 'json' }"
                  >
                    <template #label>
                      <span class="param-label">{{ field.label }}</span>
                      <el-tooltip :content="fieldRemark(field)" placement="top">
                        <i class="el-icon-question info-icon" tabindex="0" :aria-label="fieldRemark(field)"></i>
                      </el-tooltip>
                    </template>
                    <!-- ARRAY -->
                    <el-input v-if="field.type === 'array'" type="textarea" :autosize="{ minRows: 3, maxRows: 10 }" v-model="currentFunction.params[field.key]"
                      @change="val => handleParamChange(currentFunction, field.key, val)" />

                    <!-- JSON -->
                    <el-input v-else-if="field.type === 'json'" type="textarea" :rows="6" class="param-json" placeholder="Please enter valid JSON"
                      v-model="textCache[field.key]" @blur="flushJson(field)" />

                    <!-- number -->
                    <el-input-number v-else-if="field.type === 'number'" :value="currentFunction.params[field.key]"
                      @change="val => handleParamChange(currentFunction, field.key, val)" />

                    <!-- boolean -->
                    <el-switch v-else-if="field.type === 'boolean' || field.type === 'bool'"
                      :value="currentFunction.params[field.key]"
                      @change="val => handleParamChange(currentFunction, field.key, val)" />

                    <!-- string or fallback -->
                    <el-input v-else v-model="currentFunction.params[field.key]"
                      @change="val => handleParamChange(currentFunction, field.key, val)" />
                  </el-form-item>
                </el-form>
              </div>
            </template>
            <div v-else class="fd-empty fd-empty--center">
              <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-s-tools"></i></span>
              <p class="nx-callout">{{ $t('functionDialog.pleaseSelectFunctionForParam') }}</p>
            </div>
          </div>
        </div>

        <!-- MCP Area -->
        <section class="mcp-access-point" v-if="featureStatus.mcpAccessPoint">
          <div class="mcp-container">
            <div class="mcp-left">
              <h3 class="nx-headline mcp-title">{{ $t('functionDialog.mcpAccessPoint') }}</h3>
              <p class="address-desc">
                {{ $t('functionDialog.mcpAddressDesc') }}
                <a href="https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/docs/mcp-endpoint-enable.md"
                  target="_blank" rel="noopener" class="doc-link">{{ $t('functionDialog.howToDeployMcp') }}</a>
                <span class="doc-sep" aria-hidden="true">·</span>
                <a href="https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/docs/mcp-endpoint-integration.md"
                  target="_blank" rel="noopener" class="doc-link">{{ $t('functionDialog.howToIntegrateMcp') }}</a>
              </p>
              <div class="url-row">
                <el-input v-model="mcpUrl" readonly class="url-input" />
                <el-button icon="el-icon-document-copy" class="inner-copy-btn" @click="copyUrl">
                  {{ $t('functionDialog.copy') }}
                </el-button>
              </div>
            </div>

            <div class="mcp-right">
              <h3 class="nx-headline mcp-title">{{ $t('functionDialog.accessPointStatus') }}</h3>
              <div class="status-container">
                <span class="nx-badge" :class="mcpStatus === 'connected' ? 'nx-badge--success' : mcpStatus === 'loading' ? 'nx-badge--warning' : ''" role="status">
                  <span class="status-indicator" :class="mcpStatus" aria-hidden="true"></span>
                  {{
                    mcpStatus === 'connected' ? $t('functionDialog.connected') :
                      mcpStatus === 'loading' ? $t('functionDialog.loading') : $t('functionDialog.disconnected')
                  }}
                </span>
                <el-button size="small" icon="el-icon-refresh" class="refresh-btn" @click="refreshStatus">
                  {{ $t('functionDialog.refresh') }}
                </el-button>
              </div>
              <div class="mcp-tools-list">
                <div v-if="mcpTools.length > 0" class="tools-grid">
                  <span v-for="tool in mcpTools" :key="tool" class="tool-chip nx-mono" :title="tool">{{ tool }}</span>
                </div>
                <div v-else class="no-tools">{{ $t('functionDialog.noAvailableTools') }}</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer class="drawer-footer">
        <el-button @click="closeDialog">{{ $t('functionDialog.cancel') }}</el-button>
        <el-button type="primary" @click="saveSelection">{{ $t('functionDialog.saveConfig') }}</el-button>
      </footer>
    </div>
  </el-drawer>
</template>

<script>
import Api from '@/apis/api';
import i18n from '@/i18n';
import featureManager from '@/utils/featureManager';

export default {
  i18n,

  props: {
    value: Boolean,
    functions: {
      type: Array,
      default: () => []
    },
    allFunctions: {
      type: Array,
      default: () => []
    },
    agentId: {
      type: String,
      required: true
    },
    // Optional plugin name to show first in the parameter pane
    focusName: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      textCache: {},
      dialogVisible: this.value,
      selectedNames: [],
      currentFunction: null,
      modifiedFunctions: {},
      tempFunctions: {},
      // Flag to track whether saved
      hasSaved: false,
      loading: false,

      mcpUrl: "",
      mcpStatus: "disconnected",
      mcpTools: [],
      
      // Feature status
      featureStatus: {
        mcpAccessPoint: false,
        addressBook: false
      }
    }
  },
  computed: {
    selectedList() {
      const list = this.allFunctions.filter(f => this.selectedNames.includes(f.name));
      // If contact feature is disabled, filter out device-call-device plugin
      if (!this.featureStatus.addressBook) {
        return list.filter(f => f.providerCode !== 'call_device');
      }
      return list;
    },
    unselected() {
      const list = this.allFunctions.filter(f => !this.selectedNames.includes(f.name));
      // If contact feature is disabled, filter out device-call-device plugin
      if (!this.featureStatus.addressBook) {
        return list.filter(f => f.providerCode !== 'call_device');
      }
      return list;
    }
  },
  watch: {
    currentFunction(newFn) {
      if (!newFn) return;
      // Generate initial string in textCache for array or json fields
      newFn.fieldsMeta.forEach(f => {
        const v = newFn.params[f.key];
        if (f.type === 'array') {
          this.$set(this.textCache, f.key, Array.isArray(v) ? v.join('\n') : '');
        }
        else if (f.type === 'json') {
          try {
            this.$set(this.textCache, f.key, JSON.stringify(v ?? {}, null, 2));
          } catch {
            this.$set(this.textCache, f.key, '');
          }
        }
      });
    },
    async value(v) {
      this.dialogVisible = v;
      if (v) {
        // Load feature status before initializing selection
        await this.loadFeatureStatus();

        // Initialize selection state when dialog opens
        this.selectedNames = this.functions.map(f => f.name);

        // If contact feature disabled, remove device-call-device plugin from selected list
        if (!this.featureStatus.addressBook) {
          this.selectedNames = this.selectedNames.filter(name => {
            const func = this.allFunctions.find(f => f.name === name);
            return func && func.providerCode !== 'call_device';
          });
        }

        // Merge this.functions from backend into allFunctions
        this.functions.forEach(saved => {
          const idx = this.allFunctions.findIndex(f => f.name === saved.name);
          if (idx >= 0) {
            // Preserve previous changes in saved.params
            this.allFunctions[idx].params = { ...saved.params };
          }
        });
        // Point to the first item by default on right side
        this.currentFunction = (this.focusName && this.selectedList.find(f => f.name === this.focusName))
          || this.selectedList[0] || null;

        // Load MCP data
        this.loadMcpAddress();
        this.loadMcpTools();
      }
    },
    dialogVisible(newVal) {
      this.$emit('input', newVal);
    }
  },
  methods: {
    // Translation with an English fallback for keys still waiting in i18n/_pending
    tx(key, fallback) {
      const value = this.$t(key);
      return value && value !== key ? value : fallback;
    },
    initialOf(name) {
      const text = String(name || '');
      const match = text.match(/[\p{L}\p{N}]/u);
      return match ? match[0] : text.charAt(0);
    },
    /**
     * Load feature status
     */
    async loadFeatureStatus() {
      // Ensure featureManager is initialized
      await featureManager.waitForInitialization();

      const config = featureManager.getConfig();
      this.featureStatus = {
        mcpAccessPoint: config.mcpAccessPoint || false,
        addressBook: config.addressBook || false
      };
    },
    
    copyUrl() {
      const textarea = document.createElement('textarea');
      textarea.value = this.mcpUrl;
      textarea.style.position = 'fixed';  // Prevent page scroll
      document.body.appendChild(textarea);
      textarea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          this.$message.success(this.$t('functionDialog.copiedToClipboard'));
        } else {
          this.$message.error(this.$t('functionDialog.copyFailed'));
        }
      } catch (err) {
        this.$message.error('Copy failed, please copy manually');
        console.error('Copy failed:', err);
      } finally {
        document.body.removeChild(textarea);
      }
    },

    refreshStatus() {
      this.mcpStatus = "loading";
      this.loadMcpTools();
    },

    // Load MCP endpoint address
    loadMcpAddress() {
      Api.agent.getAgentMcpAccessAddress(this.agentId, (res) => {
        if (res.data.code === 0) {
          this.mcpUrl = res.data.data || "";
        } else {
          this.mcpUrl = res.data.msg;
          console.error('Failed to get MCP address:', res.data.msg);
        }
      });
    },

    // Load MCP tools list
    loadMcpTools() {
      Api.agent.getAgentMcpToolsList(this.agentId, (res) => {
        if (res.data.code === 0) {
          this.mcpTools = res.data.data || [];
          // Update status according to tools list
          this.mcpStatus = this.mcpTools.length > 0 ? "connected" : "disconnected";
        } else {
          this.mcpTools = [];
          this.mcpStatus = "disconnected";
          console.error('Failed to get MCP tools list:', res.data.msg);
        }
      });
    },

    flushArray(key) {
      const text = this.textCache[key] || '';
      const arr = text
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      this.handleParamChange(this.currentFunction, key, arr);
    },

    flushJson(field) {
      const key = field.key;
      if (!key) {
        return;
      }
      const text = this.textCache[key] || '';
      try {
        const obj = JSON.parse(text);
        this.handleParamChange(this.currentFunction, key, obj);
      } catch {
        this.$message.error(`${this.currentFunction.name}${this.$t('functionDialog.jsonFormatError')}`);
      }
    },
    handleFunctionClick(func) {
      if (this.selectedNames.includes(func.name)) {
        const tempFunc = this.tempFunctions[func.name];
        this.currentFunction = tempFunc ? tempFunc : func;
      }
    },
    handleParamChange(func, key, value) {
      if (!this.tempFunctions[func.name]) {
        this.tempFunctions[func.name] = JSON.parse(JSON.stringify(func));
      }
      this.tempFunctions[func.name].params[key] = value;
    },
    handleCheckboxChange(func, checked) {
      if (checked) {
        if (!this.selectedNames.includes(func.name)) {
          this.selectedNames = [...this.selectedNames, func.name];
        }
      } else {
        this.selectedNames = this.selectedNames.filter(name => name !== func.name);
      }

      if (this.selectedList.length > 0) {
        this.currentFunction = this.selectedList[0];
      } else {
        this.currentFunction = null;
      }
    },

    selectAll() {
      this.selectedNames = [...this.allFunctions.map(f => f.name)];
      if (this.selectedList.length > 0) {
        this.currentFunction = JSON.parse(JSON.stringify(this.selectedList[0]));
      }
    },

    deselectAll() {
      this.selectedNames = [];
      this.currentFunction = null;
    },

    closeDialog() {
      this.tempFunctions = {};
      this.selectedNames = this.functions.map(f => f.name);
      this.currentFunction = null;
      this.dialogVisible = false;
      this.$emit('input', false);
      this.$emit('dialog-closed', false);
    },

    saveSelection() {
      Object.keys(this.tempFunctions).forEach(name => {
        this.modifiedFunctions[name] = JSON.parse(JSON.stringify(this.tempFunctions[name]));
      });
      this.tempFunctions = {};
      this.hasSaved = true;

      let selected = this.selectedList.map(f => {
        const modified = this.modifiedFunctions[f.name];
        return {
          id: f.id,
          name: f.name,
          params: modified
            ? { ...modified.params }
            : { ...f.params }
        }
      });

      // If contact feature disabled, auto-cancel device-call-device plugin
      if (!this.featureStatus.addressBook) {
        selected = selected.filter(f => f.providerCode !== 'call_device');
      }

      this.$emit('update-functions', selected);
      this.dialogVisible = false;
      // Notify parent dialog is closed and saved
      this.$emit('dialog-closed', true);
    },
    fieldRemark(field) {
      let description = (field && field.label) ? field.label : '';
      if (field.default) {
        description += `（${this.$t('functionDialog.defaultValue')}：${field.default}）`;
      }
      return description;
    },
    isHomeAssistant(func) {
      if (!func) return false;
      const code = String(func.providerCode || '').toLowerCase();
      const id = String(func.id || '').toUpperCase();
      const name = String(func.name || '').toLowerCase();
      return code === 'hass_state' || code === 'home_assistant' ||
             id === 'SYSTEM_PLUGIN_HA_STATE' ||
             name.includes('homeassistant') || name.includes('home assistant');
    },
    insertDeviceTemplate(templateText) {
      if (!this.currentFunction) return;
      if (!this.currentFunction.params) {
        this.$set(this.currentFunction, 'params', {});
      }
      const current = this.currentFunction.params['devices'] || '';
      const newVal = current ? `${String(current).trim()}\n${templateText}` : templateText;
      this.$set(this.currentFunction.params, 'devices', newVal);
      this.handleParamChange(this.currentFunction, 'devices', newVal);
      this.$message.success(this.$t('message.saveSuccess') || 'Device template added');
    },
  }
}
</script>

<style lang="scss" scoped>
// Tools sheet: slides in from the right edge (same edge it leaves by). Header, scrolling body,
// footer pinned to the bottom above the MCP section.

.mcp-access-point {
  position: relative;
  z-index: 1;
  margin-top: var(--nx-space-5);
  padding: var(--nx-space-5);
  background: var(--nx-surface-2);
  border-radius: var(--nx-radius-lg);
  text-align: left;
}

.drawer-footer {
  position: relative;
  z-index: 2;
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: var(--nx-space-2);
  padding: var(--nx-space-3) var(--nx-space-6) var(--nx-space-5);
  border-top: 1px solid var(--nx-border);
  background: var(--nx-surface);
  .el-button + .el-button {
    margin-left: 0;
  }
}

.fd {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--nx-surface);
  color: var(--nx-text);
}

.fd-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--nx-space-3);
  padding: var(--nx-space-5) var(--nx-space-5) var(--nx-space-4) var(--nx-space-6);
  border-bottom: 1px solid var(--nx-border);
}
.fd-header__titles {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-width: 0;
}

.fd-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--nx-space-5) var(--nx-space-6);
}

.function-manager {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  gap: var(--nx-space-5);
  align-items: start;
}

// ------------------------------------------------------------------ picker

.function-column {
  min-width: 0;
  padding: var(--nx-space-2);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius-lg);
  background: var(--nx-surface);
}
.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--nx-space-2);
  padding: var(--nx-space-2) var(--nx-space-2) var(--nx-space-1) var(--nx-space-3);
  &--second {
    margin-top: var(--nx-space-2);
    padding-top: var(--nx-space-3);
    border-top: 1px solid var(--nx-border);
  }
}
.column-title {
  margin: 0;
  color: var(--nx-text-3);
  font-size: var(--nx-text-caption);
  font-weight: 600;
  letter-spacing: 0.01em;
}
.select-all-btn {
  padding: 0;
  font-size: var(--nx-text-caption);
}
.function-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.function-item {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  min-height: 40px;
  padding: 0 var(--nx-space-2) 0 var(--nx-space-3);
  border-radius: var(--nx-radius-sm);
  transition: background-color var(--nx-dur-1) var(--nx-ease);
  &:hover {
    background: var(--nx-surface-2);
  }
  &.is-current {
    background: var(--nx-accent-soft);
    .func-tag {
      color: var(--nx-accent);
    }
  }
  &.is-unselected .func-tag {
    color: var(--nx-text-2);
    cursor: default;
  }
}
.func-tag {
  display: flex;
  align-items: center;
  gap: var(--nx-space-2);
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--nx-text);
  font: inherit;
  font-size: var(--nx-text-callout);
  text-align: left;
  cursor: pointer;
}
.func-initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: var(--nx-radius-sm);
  background: var(--nx-surface-2);
  color: var(--nx-text-2);
  font-size: var(--nx-text-caption);
  font-weight: 700;
  text-transform: uppercase;
}
.function-item.is-current .func-initial {
  background: var(--nx-surface);
  color: var(--nx-accent);
}
.func-chevron {
  margin-left: auto;
  color: var(--nx-text-3);
  font-size: var(--nx-text-caption);
}
.fd-empty-line {
  padding: var(--nx-space-2) var(--nx-space-3) var(--nx-space-3);
  color: var(--nx-text-3);
  font-size: var(--nx-text-footnote);
}

::v-deep .el-checkbox__label {
  display: none;
}

// ------------------------------------------------------------------ parameters

.params-column {
  min-width: 0;
  padding: var(--nx-space-5);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius-lg);
  background: var(--nx-surface);
}
.params-head {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  margin-bottom: var(--nx-space-5);
  &__icon {
    font-size: var(--nx-text-body);
    font-weight: 700;
    text-transform: uppercase;
  }
  &__text {
    min-width: 0;
  }
}
.params-container {
  min-width: 0;
}
.fd-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--nx-space-3);
  padding: var(--nx-space-7) var(--nx-space-4);
  text-align: center;
  p {
    margin: 0;
    max-width: 360px;
  }
  &--center {
    min-height: 280px;
    justify-content: center;
  }
}

.param-form {
  ::v-deep .el-form-item {
    margin-bottom: var(--nx-space-4);
  }
  ::v-deep .el-form-item__label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding-bottom: 6px;
    line-height: 1.4;
  }
  ::v-deep .el-input-number {
    width: 200px;
    max-width: 100%;
  }
}
.param-label {
  color: var(--nx-text-2);
  font-size: var(--nx-text-footnote);
  font-weight: 500;
}
.info-icon {
  color: var(--nx-text-3);
  font-size: var(--nx-text-footnote);
  cursor: help;
}
.param-json ::v-deep .el-textarea__inner {
  font-family: var(--nx-font-mono);
  font-size: var(--nx-text-footnote);
}

// Home Assistant helper
.ha-assistant-panel {
  margin-bottom: var(--nx-space-5);
  padding: var(--nx-space-4);
  border-radius: var(--nx-radius);
  background: var(--nx-info-soft);

  .ha-header {
    margin-bottom: var(--nx-space-3);
  }
  .ha-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--nx-info);
    font-size: var(--nx-text-callout);
    font-weight: 600;
  }
  .ha-desc {
    margin: 4px 0 0;
    color: var(--nx-text-2);
    font-size: var(--nx-text-footnote);
  }
  .ha-quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nx-space-2);
    margin-bottom: var(--nx-space-3);
    .el-button + .el-button {
      margin-left: 0;
    }
  }
  .ha-voice-commands {
    padding: var(--nx-space-3);
    border-radius: var(--nx-radius-sm);
    background: var(--nx-surface);
    font-size: var(--nx-text-footnote);
  }
  .ha-cmd-title {
    margin-bottom: 6px;
    color: var(--nx-text);
    font-weight: 600;
  }
  .ha-cmd-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding-left: var(--nx-space-4);
    color: var(--nx-text-2);
  }
}

// ------------------------------------------------------------------ MCP

.mcp-container {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--nx-space-6);
}
.mcp-left,
.mcp-right {
  min-width: 0;
}
.mcp-title {
  margin-bottom: var(--nx-space-2);
}
.address-desc {
  margin: 0 0 var(--nx-space-3);
  color: var(--nx-text-2);
  font-size: var(--nx-text-footnote);
}
.doc-link:hover {
  text-decoration: underline;
}
.doc-sep {
  margin: 0 6px;
  color: var(--nx-text-3);
}
.url-row {
  display: flex;
  gap: var(--nx-space-2);
}
.url-input {
  flex: 1;
  min-width: 0;
  ::v-deep .el-input__inner {
    background: var(--nx-surface);
    font-family: var(--nx-font-mono);
    font-size: var(--nx-text-footnote);
  }
}
.inner-copy-btn {
  flex: none;
}
.status-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--nx-space-3);
}
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--nx-text-3);
  &.connected {
    background: var(--nx-success);
  }
  &.loading {
    background: var(--nx-warning);
    animation: fd-pulse 1.5s var(--nx-ease) infinite;
  }
}
@keyframes fd-pulse {
  50% {
    opacity: 0.4;
  }
}
.mcp-tools-list {
  margin-top: var(--nx-space-3);
}
.tools-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tool-chip {
  max-width: 100%;
  padding: 3px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface);
  border: 1px solid var(--nx-border);
  color: var(--nx-text-2);
  font-size: var(--nx-text-caption);
}
.no-tools {
  color: var(--nx-text-3);
  font-size: var(--nx-text-footnote);
}

@media (max-width: 760px) {
  .function-manager,
  .mcp-container {
    grid-template-columns: minmax(0, 1fr);
  }
  .fd-body {
    padding: var(--nx-space-4);
  }
  .drawer-footer {
    padding: var(--nx-space-3) var(--nx-space-4) var(--nx-space-4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-indicator.loading {
    animation: none;
  }
}
</style>

<style lang="scss">
// Drawer chrome (rendered outside the component root)
.nx-function-drawer {
  border-radius: var(--nx-radius-xl) 0 0 var(--nx-radius-xl);
  overflow: hidden;
  .el-drawer__body {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;
  }
}
</style>
