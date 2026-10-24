<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Edit Features",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import { getMcpAddress, getMcpTools } from '@/api/agent/agent'
import { t } from '@/i18n'
import { usePluginStore } from '@/store'

const message = useMessage()
const pluginStore = usePluginStore()

const notSelectedList = ref<any[]>([])
const selectedList = ref<any[]>([])

// Use computed properties to get data from store
const allFunctions = computed(() => pluginStore.allFunctions)
const functions = computed(() => pluginStore.currentFunctions)
const agentId = computed(() => pluginStore.currentAgentId)
const mcpAddress = ref('')
const mcpTools = ref<string[]>([])

// Load MCP address from local storage on init
if (uni.getStorageSync(`cachedMcpAddress_${agentId.value}`)) {
  mcpAddress.value = uni.getStorageSync(`cachedMcpAddress_${agentId.value}`)
}

// Parameter editing related
const showParamDialog = ref(false)
const currentFunction = ref<any>(null)
const tempParams = ref<Record<string, any>>({})
const arrayTextCache = ref<Record<string, string>>({})
const jsonTextCache = ref<Record<string, string>>({})

function normalizeFunctionParams(paramInfo: any, fallback: Record<string, any> = {}) {
  if (!paramInfo)
    return { ...fallback }
  if (typeof paramInfo === 'string') {
    try {
      const parsed = JSON.parse(paramInfo)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { ...fallback }
    }
    catch {
      return { ...fallback }
    }
  }
  return typeof paramInfo === 'object' && !Array.isArray(paramInfo) ? { ...fallback, ...paramInfo } : { ...fallback }
}

async function mergeFunctions() {
  selectedList.value = functions.value.map((mapping) => {
    const meta = allFunctions.value.find(f => f.id === mapping.pluginId)
    if (!meta) {
      return { id: mapping.pluginId, name: mapping.pluginId, params: normalizeFunctionParams(mapping.paramInfo) }
    }

    return {
      id: mapping.pluginId,
      name: meta.name,
      params: normalizeFunctionParams(mapping.paramInfo, meta.params),
      fieldsMeta: meta.fieldsMeta,
    }
  })

  // Unselected plugins
  notSelectedList.value = allFunctions.value.filter(
    item => !selectedList.value.some(f => f.id === item.id),
  )

  if (agentId.value) {
    // Prioritize getting and displaying MCP address
    try {
      const address = await getMcpAddress(agentId.value)
      mcpAddress.value = address
      // Cache to local storage for immediate display on next open
      uni.setStorageSync(`cachedMcpAddress_${agentId.value}`, address)
    }
    catch (error) {
      mcpAddress.value = error
      console.error('Failed to get MCP address:', error)
    }

    // Async fetch MCP tools without blocking UI
    try {
      const tools = await getMcpTools(agentId.value)
      mcpTools.value = tools || []
    }
    catch (error) {
      console.error('Failed to get MCP tools list:', error)
    }
  }
}

// Add plugin to selected
function selectFunction(func: any) {
  // Add to selected list
  selectedList.value = [...selectedList.value, {
    id: func.id,
    name: func.name,
    params: normalizeFunctionParams(func.params),
    fieldsMeta: func.fieldsMeta,
  }]

  // Remove from unselected list
  notSelectedList.value = notSelectedList.value.filter(
    item => item.id !== func.id,
  )
}

// Remove plugin from selected
function removeFunction(func: any) {
  // Remove from selected list
  selectedList.value = selectedList.value.filter(item => item.id !== func.id)

  // Add back to unselected list
  const originalFunc = allFunctions.value.find(f => f.id === func.id)
  if (originalFunc) {
    notSelectedList.value.push(originalFunc)
  }
}

// Edit plugin parameters
function editFunction(func: any) {
  currentFunction.value = func

  // Use parameters of current function directly
  tempParams.value = normalizeFunctionParams(func.params)

  // Initialize text cache
  if (func.fieldsMeta) {
    func.fieldsMeta.forEach((field: any) => {
      if (field.type === 'array') {
        const value = tempParams.value[field.key]
        arrayTextCache.value[field.key] = Array.isArray(value)
          ? value.join('\n')
          : value || ''
      }
      else if (field.type === 'json') {
        const value = tempParams.value[field.key]
        try {
          jsonTextCache.value[field.key] = JSON.stringify(value || {}, null, 2)
        }
        catch {
          jsonTextCache.value[field.key] = '{}'
        }
      }
    })
  }

  showParamDialog.value = true
}

// Handle parameter change - save in real time
function handleParamChange(key: string, value: any, field: any) {
  tempParams.value[key] = value

  // Real-time update to selectedList
  if (currentFunction.value) {
    const index = selectedList.value.findIndex(
      f => f.id === currentFunction.value.id,
    )
    if (index >= 0) {
      selectedList.value[index].params = { ...tempParams.value }
    }
  }
}

// Handle array parameter change - save in real time
function handleArrayChange(key: string, value: string, field: any) {
  arrayTextCache.value[key] = value
  // Convert to array storage
  const arrayValue = value.split('\n').filter(Boolean)
  tempParams.value[key] = arrayValue

  // Real-time update to selectedList
  if (currentFunction.value) {
    const index = selectedList.value.findIndex(
      f => f.id === currentFunction.value.id,
    )
    if (index >= 0) {
      selectedList.value[index].params = { ...tempParams.value }
    }
  }
}

// Handle JSON parameter change - save in real-time
function handleJsonChange(key: string, value: string, field: any) {
  jsonTextCache.value[key] = value
  try {
    const jsonValue = JSON.parse(value)
    tempParams.value[key] = jsonValue

    // Real-time update to selectedList
    if (currentFunction.value) {
      const index = selectedList.value.findIndex(
        f => f.id === currentFunction.value.id,
      )
      if (index >= 0) {
        selectedList.value[index].params = { ...tempParams.value }
      }
    }
  }
  catch {
    message.alert(t('agent.tools.jsonFormatError'))
  }
}

// Home Assistant Smart Home Helpers
function isHomeAssistant(func: any) {
  if (!func)
    return false
  const code = String(func.providerCode || '').toLowerCase()
  const id = String(func.id || '').toUpperCase()
  const name = String(func.name || '').toLowerCase()
  return code === 'hass_state' || code === 'home_assistant'
    || id === 'SYSTEM_PLUGIN_HA_STATE'
    || name.includes('homeassistant') || name.includes('home assistant')
}

function insertMobileDeviceTemplate(templateText: string) {
  if (!currentFunction.value)
    return
  const current = arrayTextCache.value.devices || ''
  const updated = current ? `${current.trim()}\n${templateText}` : templateText
  const devicesField = currentFunction.value.fieldsMeta?.find((f: any) => f.key === 'devices')
  handleArrayChange('devices', updated, devicesField)
  uni.showToast({ title: 'Template added', icon: 'none' })
}

// Quick-insert device templates for the smart home helper
const haTemplates = [
  { labelKey: 'agent.tools.addLight', template: 'Living Room, Light, light.living_room' },
  { labelKey: 'agent.tools.addFan', template: 'Bedroom, Ceiling Fan, fan.bedroom' },
  { labelKey: 'agent.tools.addClimate', template: 'Living Room, AC, climate.living_room' },
  { labelKey: 'agent.tools.addSwitch', template: 'Kitchen, Plug, switch.kitchen_plug' },
  { labelKey: 'agent.tools.addLock', template: 'Entrance, Front Door Lock, lock.front_door' },
]

const haSampleCommands = [
  '"লিভিং রুমের লাইট জ্বালাও / নিভাও" (আলো ৮০% করো)',
  '"ফ্যান চালু করো" / "এসি ২৪ ডিগ্রিতে রাখো"',
  '"Turn on/off living room light" / "Lock front door"',
]

// One row per plugin: switch on = selected for this agent
interface PluginRow {
  id: string
  name: string
  providerCode: string
  func: any
  selected: any
}

const pluginRows = computed<PluginRow[]>(() => {
  const rows: PluginRow[] = allFunctions.value.map(func => ({
    id: func.id,
    name: func.name,
    providerCode: func.providerCode || '',
    func,
    selected: selectedList.value.find(item => item.id === func.id) || null,
  }))
  selectedList.value
    .filter(item => !allFunctions.value.some(func => func.id === item.id))
    .forEach(item => rows.push({ id: item.id, name: item.name, providerCode: '', func: null, selected: item }))
  return rows
})

function togglePlugin(row: PluginRow, enabled: boolean) {
  if (enabled && !row.selected && row.func) {
    selectFunction(notSelectedList.value.find(item => item.id === row.id) || row.func)
  }
  else if (!enabled && row.selected) {
    removeFunction(row.selected)
  }
}

// Safe area for the custom navigation bar
const safeTop = (uni.getSystemInfoSync().safeAreaInsets?.top) || 0

// Pending copy (src/i18n/_pending/mobile-home-agents.ts): English fallback until merged
function tx(key: string, fallback: string, params?: Record<string, string | number>) {
  const value = t(key, params)
  if (value !== key)
    return value
  if (!params)
    return fallback
  return Object.entries(params).reduce((text, [name, val]) => text.replace(`{${name}}`, String(val)), fallback)
}

// Close parameter editing dialog
function closeParamEdit() {
  showParamDialog.value = false
  tempParams.value = {}
  arrayTextCache.value = {}
  jsonTextCache.value = {}
}

// Return to previous page and update config
function goBack() {
  uni.navigateBack()
}

// Copy MCP address
function copyMcpAddress() {
  if (!mcpAddress.value) {
    message.alert(t('agent.tools.noMcpAddressToCopy'))
    return
  }

  uni.setClipboardData({
    data: mcpAddress.value,
    showToast: false,
    success: () => {
      message.alert(t('agent.tools.mcpAddressCopied'))
    },
    fail: () => {
      message.alert(t('agent.tools.copyFailed'))
    },
  })
}

// Helper function for rendering parameter fields
function getFieldDisplayValue(field: any, value: any) {
  if (field.type === 'array') {
    return Array.isArray(value) ? value.join('\n') : value || ''
  }
  return value || ''
}

// Field description
function getFieldRemark(field: any) {
  let description = field.label || ''
  if (field.default) {
    description += `（${t('agent.tools.defaultValue')}：${field.default}）`
  }
  return description
}

// Watch selected list changes and update plugin config in real-time
watch(() => selectedList.value, (newSelectedList) => {
  const finalFunctions = newSelectedList.map(f => ({
    pluginId: f.id,
    paramInfo: normalizeFunctionParams(f.params),
  }))
  pluginStore.updateFunctions(finalFunctions)
})

onMounted(async () => {
  // Get data directly from store and merge
  await mergeFunctions()
})
</script>

<template>
  <view class="nx-subpage">
    <view class="nx-subpage__nav" :style="{ paddingTop: `${safeTop}px` }">
      <view class="nx-subpage__back" role="button" :aria-label="tx('agent.navBack', 'Back')" @click="goBack">
        <wd-icon name="arrow-left" size="20px" />
      </view>
      <text class="nx-subpage__nav-title nx-truncate">
        {{ t('agent.plugins') }}
      </text>
      <view class="nx-subpage__back" />
    </view>

    <scroll-view scroll-y class="nx-subpage__scroll">
      <view class="nx-subpage__content">
        <view class="nx-large-title">
          <view class="nx-large-title__title">
            {{ t('agent.plugins') }}
          </view>
          <view class="nx-large-title__subtitle">
            {{ tx('agent.toolsSubtitle', 'Choose what your agent can do. Changes apply after you save the agent.') }}
          </view>
        </view>

        <!-- Built-in tools -->
        <view class="nx-group">
          <view class="nx-group__header">
            {{ t('agent.tools.builtInPlugins') }}
          </view>
          <view v-if="!pluginRows.length" class="nx-group__body">
            <view class="nx-empty tools-empty">
              <text class="nx-empty__text">
                {{ t('agent.tools.noMorePlugins') }}
              </text>
            </view>
          </view>
          <view v-else class="nx-group__body">
            <view
              v-for="row in pluginRows"
              :key="row.id"
              class="nx-row"
              :class="{ 'nx-row--tap': !!row.selected }"
              @click="row.selected && editFunction(row.selected)"
            >
              <view class="nx-icon-tile tools-icon" :class="{ 'nx-icon-tile--neutral': !row.selected }">
                <wd-icon name="app" size="18px" />
              </view>
              <view class="nx-row__main">
                <view class="nx-row__title nx-truncate">
                  {{ row.name }}
                </view>
                <view class="nx-row__subtitle nx-truncate">
                  {{ row.selected ? t('agent.tools.clickToConfigure') : row.providerCode }}
                </view>
              </view>
              <view @click.stop>
                <wd-switch
                  :model-value="!!row.selected"
                  size="22px"
                  @change="({ value }) => togglePlugin(row, value)"
                />
              </view>
            </view>
          </view>
          <view class="nx-group__footer nx-num">
            {{ tx('agent.toolsEnabledCount', '{count} on', { count: selectedList.length }) }}
          </view>
        </view>

        <!-- MCP endpoint -->
        <view class="nx-group">
          <view class="nx-group__header">
            {{ t('agent.tools.mcpEndpoint') }}
          </view>
          <view class="nx-group__body">
            <view class="nx-row">
              <view class="nx-row__main">
                <text class="nx-mono nx-break tools-address">
                  {{ mcpAddress || '—' }}
                </text>
              </view>
              <view class="tools-copy" role="button" :aria-label="t('agent.tools.copy')" @click="copyMcpAddress">
                <wd-icon name="copy" size="16px" />
                <text>{{ t('agent.tools.copy') }}</text>
              </view>
            </view>
            <view class="nx-row tools-mcp-list">
              <view v-if="mcpTools && mcpTools.length === 0" class="nx-row__subtitle">
                {{ t('agent.tools.noTools') }}
              </view>
              <view v-else class="tools-chips">
                <text v-for="tool in mcpTools" :key="tool" class="nx-badge nx-mono tools-chip">
                  {{ tool }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- Parameter sheet -->
    <wd-popup
      v-model="showParamDialog"
      position="bottom"
      custom-class="nx-sheet nx-sheet--full"
      safe-area-inset-bottom
      @close="closeParamEdit"
    >
      <view class="param-sheet">
        <view class="param-sheet__bar">
          <text class="nx-headline nx-truncate param-sheet__title">
            {{ currentFunction?.name || t('agent.tools.parameterConfig') }}
          </text>
          <text class="param-sheet__done" role="button" @click="showParamDialog = false">
            {{ tx('agent.editorDone', 'Done') }}
          </text>
        </view>

        <scroll-view scroll-y class="param-sheet__scroll">
          <view class="param-sheet__content">
            <view class="nx-group__header">
              {{ t('agent.tools.parameterConfig') }}
            </view>

            <!-- No parameters -->
            <view
              v-if="!currentFunction?.fieldsMeta || currentFunction.fieldsMeta.length === 0"
              class="nx-group__body"
            >
              <view class="nx-empty tools-empty">
                <text class="nx-empty__text">
                  {{ currentFunction?.name }} {{ t('agent.tools.noParamsNeeded') }}
                </text>
              </view>
            </view>

            <template v-else>
              <!-- Smart home helper -->
              <view v-if="isHomeAssistant(currentFunction)" class="nx-group">
                <view class="nx-group__body ha-card">
                  <text class="nx-row__title ha-card__title">
                    {{ t('agent.tools.smartHomeGuide') }}
                  </text>
                  <text class="nx-row__subtitle ha-card__desc">
                    {{ t('agent.tools.smartHomeGuideDesc') }}
                  </text>
                  <view class="tools-chips ha-card__chips">
                    <view
                      v-for="item in haTemplates"
                      :key="item.labelKey"
                      class="ha-chip"
                      role="button"
                      @click="insertMobileDeviceTemplate(item.template)"
                    >
                      <wd-icon name="add" size="12px" />
                      <text>{{ t(item.labelKey) }}</text>
                    </view>
                  </view>
                  <view class="ha-card__samples">
                    <text class="ha-card__samples-title">
                      {{ t('agent.tools.sampleCommands') }}
                    </text>
                    <text v-for="line in haSampleCommands" :key="line" class="ha-card__sample">
                      {{ line }}
                    </text>
                  </view>
                </view>
              </view>

              <view v-for="field in currentFunction.fieldsMeta" :key="field.key" class="nx-group">
                <view class="nx-group__body param-field">
                  <text class="nx-row__title">
                    {{ field.label }}
                  </text>
                  <text v-if="getFieldRemark(field)" class="nx-row__subtitle param-field__remark">
                    {{ getFieldRemark(field) }}
                  </text>

                  <!-- String type -->
                  <input
                    v-if="field.type === 'string'"
                    v-model="tempParams[field.key]"
                    class="param-input"
                    type="text"
                    :placeholder="`${t('agent.tools.pleaseInput')}${field.label}`"
                    placeholder-class="param-placeholder"
                    @input="handleParamChange(field.key, $event.detail.value, field)"
                  >

                  <!-- Array type -->
                  <view v-else-if="field.type === 'array'">
                    <text class="param-field__hint">
                      {{ t('agent.tools.eachLineOneItem') }}
                    </text>
                    <textarea
                      v-model="arrayTextCache[field.key]"
                      class="param-input param-input--area"
                      :maxlength="-1"
                      :placeholder="`${t('agent.tools.pleaseInput')}${field.label}，${t('agent.tools.eachLineOneItem')}`"
                      placeholder-class="param-placeholder"
                      @input="handleArrayChange(field.key, $event.detail.value, field)"
                    />
                  </view>

                  <!-- JSON type -->
                  <view v-else-if="field.type === 'json'">
                    <text class="param-field__hint">
                      {{ t('agent.tools.pleaseInputValidJson') }}
                    </text>
                    <textarea
                      v-model="jsonTextCache[field.key]"
                      class="param-input param-input--area nx-mono param-input--code"
                      :maxlength="-1"
                      :placeholder="t('agent.tools.pleaseInputValidJson')"
                      placeholder-class="param-placeholder"
                      @blur="handleJsonChange(field.key, $event.detail.value, field)"
                    />
                  </view>

                  <!-- Number type -->
                  <input
                    v-else-if="field.type === 'number'"
                    v-model="tempParams[field.key]"
                    class="param-input nx-num"
                    type="number"
                    :placeholder="`${t('agent.tools.pleaseInput')}${field.label}`"
                    placeholder-class="param-placeholder"
                    @input="handleParamChange(field.key, Number($event.detail.value), field)"
                  >

                  <!-- Boolean type -->
                  <view v-else-if="field.type === 'boolean' || field.type === 'bool'" class="param-switch">
                    <view class="nx-row__main">
                      <text class="nx-row__title">
                        {{ t('agent.tools.enableFunction') }}
                      </text>
                      <text class="nx-row__subtitle param-switch__sub">
                        {{ t('agent.tools.toggleFunction') }}
                      </text>
                    </view>
                    <wd-switch
                      :model-value="!!tempParams[field.key]"
                      size="22px"
                      @change="({ value }) => handleParamChange(field.key, value, field)"
                    />
                  </view>

                  <!-- Default string type -->
                  <input
                    v-else
                    v-model="tempParams[field.key]"
                    class="param-input"
                    type="text"
                    :placeholder="`${t('agent.tools.pleaseInput')}${field.label}`"
                    placeholder-class="param-placeholder"
                    @input="handleParamChange(field.key, $event.detail.value, field)"
                  >
                </view>
              </view>
            </template>
          </view>
        </scroll-view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.nx-subpage {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--nx-bg);

  &__nav {
    display: flex;
    align-items: center;
    flex: none;
    gap: var(--nx-space-2);
    padding-left: var(--nx-gutter);
    padding-right: var(--nx-gutter);
    min-height: var(--nx-touch);
    background: var(--nx-bg);
  }
  &__back {
    display: flex;
    align-items: center;
    flex: none;
    width: var(--nx-touch);
    height: var(--nx-touch);
    color: var(--nx-accent);
    &:active {
      opacity: 0.6;
    }
  }
  &__nav-title {
    flex: 1;
    text-align: center;
    font-size: var(--nx-text-headline);
    font-weight: 600;
    color: var(--nx-text);
  }
  &__scroll {
    flex: 1;
    height: 0;
  }
  &__content {
    padding: 0 var(--nx-gutter) calc(var(--nx-space-7) + env(safe-area-inset-bottom));
  }
}

.tools-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: var(--nx-radius-sm);
}

.tools-empty {
  padding: var(--nx-space-6) var(--nx-space-4);
}

.tools-address {
  font-size: var(--nx-text-footnote);
  color: var(--nx-text);
  line-height: 1.5;
}

.tools-copy {
  display: flex;
  align-items: center;
  gap: var(--nx-space-1);
  flex: none;
  height: 64rpx;
  padding: 0 var(--nx-space-3);
  border-radius: var(--nx-radius-pill);
  background: var(--nx-accent-soft);
  color: var(--nx-accent);
  font-size: var(--nx-text-footnote);
  font-weight: 600;
  &:active {
    opacity: 0.7;
  }
}

.tools-mcp-list {
  align-items: flex-start;
}

.tools-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--nx-space-2);
}

.tools-chip {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

// Parameter sheet
:deep(.wd-popup.nx-sheet) {
  overflow: hidden;
  border-radius: var(--nx-radius-xl) var(--nx-radius-xl) 0 0;
  background: var(--nx-bg);
}

:deep(.wd-popup.nx-sheet--full) {
  height: 88vh;
}

.param-sheet {
  display: flex;
  flex-direction: column;
  height: 100%;

  &__bar {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    flex: none;
    min-height: var(--nx-touch);
    padding: var(--nx-space-2) var(--nx-gutter);
    border-bottom: 1rpx solid var(--nx-border);
  }
  &__title {
    flex: 1;
    min-width: 0;
  }
  &__done {
    flex: none;
    padding: var(--nx-space-2) 0 var(--nx-space-2) var(--nx-space-3);
    color: var(--nx-accent);
    font-size: var(--nx-text-body);
    font-weight: 600;
  }
  &__scroll {
    flex: 1;
    height: 0;
  }
  &__content {
    padding: var(--nx-space-4) var(--nx-gutter) var(--nx-space-6);
  }
}

.param-field {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);
  padding: var(--nx-space-4);

  &__remark {
    margin-top: 0;
  }
  &__hint {
    display: block;
    margin-bottom: var(--nx-space-2);
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
}

.param-input {
  box-sizing: border-box;
  width: 100%;
  height: var(--nx-touch);
  padding: 0 var(--nx-space-3);
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);
  color: var(--nx-text);
  font-size: var(--nx-text-body);

  &--area {
    height: 280rpx;
    padding: var(--nx-space-3);
    line-height: 1.55;
  }
  &--code {
    height: 360rpx;
    font-size: var(--nx-text-footnote);
  }
}

:deep(.param-placeholder) {
  color: var(--nx-text-3);
}

.param-switch {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  &__sub {
    display: block;
  }
}

.ha-card {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-2);
  padding: var(--nx-space-4);

  &__title {
    font-weight: 600;
  }
  &__desc {
    margin-top: 0;
    line-height: 1.5;
  }
  &__chips {
    margin-top: var(--nx-space-1);
  }
  &__samples {
    display: flex;
    flex-direction: column;
    gap: 4rpx;
    margin-top: var(--nx-space-2);
    padding: var(--nx-space-3);
    border-radius: var(--nx-radius);
    background: var(--nx-surface-2);
  }
  &__samples-title {
    font-size: var(--nx-text-footnote);
    font-weight: 600;
    color: var(--nx-text);
  }
  &__sample {
    font-size: var(--nx-text-footnote);
    line-height: 1.6;
    color: var(--nx-text-2);
  }
}

.ha-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--nx-space-1);
  height: 60rpx;
  padding: 0 var(--nx-space-3);
  border-radius: var(--nx-radius-pill);
  background: var(--nx-accent-soft);
  color: var(--nx-accent);
  font-size: var(--nx-text-footnote);
  font-weight: 500;
  &:active {
    opacity: 0.7;
  }
}
</style>
