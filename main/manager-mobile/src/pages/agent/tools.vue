<!-- Tools: what TinyBot may use when it talks, and the MCP endpoint (owner: m-agent).
     Edits the plugin store live; the character screen saves the choice with the rest. -->
<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Tools",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getMcpAddress, getMcpTools } from '@/api/agent/agent'
import { getCurrentLanguage, t } from '@/i18n'
import { usePluginStore } from '@/store'
import { digits } from '@/utils/calendar.mjs'
import { toast } from '@/utils/toast'
import { isHomeAssistant, linesToList, listToLines, normalizeFunctionParams } from './agentModel.mjs'

defineOptions({
  name: 'AgentTools',
})

const pluginStore = usePluginStore()
const num = (n: any) => digits(n, getCurrentLanguage())

const notSelectedList = ref<any[]>([])
const selectedList = ref<any[]>([])

// Use computed properties to get data from store
const allFunctions = computed(() => pluginStore.allFunctions as any[])
const functions = computed(() => pluginStore.currentFunctions as any[])
const agentId = computed(() => pluginStore.currentAgentId)
const mcpAddress = ref('')
const mcpTools = ref<string[]>([])
const mcpLoading = ref(false)

// Show the last known MCP address at once while the fresh one loads
try {
  const cached = uni.getStorageSync(`cachedMcpAddress_${agentId.value}`)
  if (cached)
    mcpAddress.value = cached
}
catch {}

// Parameter editing related
const showParamDialog = ref(false)
const currentFunction = ref<any>(null)
const tempParams = ref<Record<string, any>>({})
const arrayTextCache = ref<Record<string, string>>({})
const jsonTextCache = ref<Record<string, string>>({})
const jsonInvalid = ref<Record<string, boolean>>({})

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
    mcpLoading.value = true
    try {
      const address = await getMcpAddress(agentId.value)
      mcpAddress.value = address || ''
      uni.setStorageSync(`cachedMcpAddress_${agentId.value}`, mcpAddress.value)
    }
    catch (error) {
      console.error('Failed to get MCP address:', error)
    }

    try {
      const tools = await getMcpTools(agentId.value)
      mcpTools.value = tools || []
    }
    catch (error) {
      console.error('Failed to get MCP tools list:', error)
    }
    mcpLoading.value = false
  }
}

// Add plugin to selected
function selectFunction(func: any) {
  selectedList.value = [...selectedList.value, {
    id: func.id,
    name: func.name,
    params: normalizeFunctionParams(func.params),
    fieldsMeta: func.fieldsMeta,
  }]
  notSelectedList.value = notSelectedList.value.filter(item => item.id !== func.id)
}

// Remove plugin from selected
function removeFunction(func: any) {
  selectedList.value = selectedList.value.filter(item => item.id !== func.id)
  const originalFunc = allFunctions.value.find(f => f.id === func.id)
  if (originalFunc) {
    notSelectedList.value.push(originalFunc)
  }
}

// Edit plugin parameters
function editFunction(func: any) {
  currentFunction.value = func
  tempParams.value = normalizeFunctionParams(func.params)
  arrayTextCache.value = {}
  jsonTextCache.value = {}
  jsonInvalid.value = {}

  if (func.fieldsMeta) {
    func.fieldsMeta.forEach((field: any) => {
      if (field.type === 'array') {
        arrayTextCache.value[field.key] = listToLines(tempParams.value[field.key])
      }
      else if (field.type === 'json') {
        try {
          jsonTextCache.value[field.key] = JSON.stringify(tempParams.value[field.key] || {}, null, 2)
        }
        catch {
          jsonTextCache.value[field.key] = '{}'
        }
      }
    })
  }

  showParamDialog.value = true
}

function writeBack() {
  if (currentFunction.value) {
    const index = selectedList.value.findIndex(f => f.id === currentFunction.value.id)
    if (index >= 0) {
      selectedList.value[index].params = { ...tempParams.value }
      selectedList.value = [...selectedList.value]
    }
  }
}

// Handle parameter change - save in real time
function handleParamChange(key: string, value: any) {
  tempParams.value[key] = value
  writeBack()
}

// Handle array parameter change - save in real time
function handleArrayChange(key: string, value: string) {
  arrayTextCache.value[key] = value
  tempParams.value[key] = linesToList(value)
  writeBack()
}

// Handle JSON parameter change - kept only when it parses
function handleJsonChange(key: string, value: string) {
  jsonTextCache.value[key] = value
  try {
    tempParams.value[key] = JSON.parse(value)
    jsonInvalid.value[key] = false
    writeBack()
  }
  catch {
    jsonInvalid.value[key] = true
    toast.error(t('mAgent.tools.jsonError'))
  }
}

function insertMobileDeviceTemplate(templateText: string) {
  if (!currentFunction.value)
    return
  const current = arrayTextCache.value.devices || ''
  const updated = current ? `${current.trim()}\n${templateText}` : templateText
  handleArrayChange('devices', updated)
  toast.success(t('mAgent.tools.deviceAdded'))
}

// Quick-insert device templates for the smart home helper
const haTemplates = [
  { labelKey: 'mAgent.tools.addLight', template: 'Living Room, Light, light.living_room' },
  { labelKey: 'mAgent.tools.addFan', template: 'Bedroom, Ceiling Fan, fan.bedroom' },
  { labelKey: 'mAgent.tools.addClimate', template: 'Living Room, AC, climate.living_room' },
  { labelKey: 'mAgent.tools.addSwitch', template: 'Kitchen, Plug, switch.kitchen_plug' },
  { labelKey: 'mAgent.tools.addLock', template: 'Entrance, Front Door Lock, lock.front_door' },
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

function rowHint(row: PluginRow) {
  if (!row.selected)
    return row.providerCode
  const n = row.selected.fieldsMeta?.length || 0
  return n ? t('mAgent.tools.settingsCount', { n: num(n) }) : t('mAgent.tools.nothingToSet')
}

// Close parameter editing sheet
function closeParamEdit() {
  showParamDialog.value = false
  tempParams.value = {}
  arrayTextCache.value = {}
  jsonTextCache.value = {}
}

function goBack() {
  uni.navigateBack()
}

// Copy MCP address
function copyMcpAddress() {
  if (!mcpAddress.value) {
    toast.warning(t('mAgent.tools.noAddress'))
    return
  }

  uni.setClipboardData({
    data: mcpAddress.value,
    showToast: false,
    success: () => {
      toast.success(t('mAgent.tools.copied'))
    },
    fail: () => {
      toast.error(t('mAgent.tools.copyFailed'))
    },
  })
}

// Field description: its label and default
function getFieldRemark(field: any) {
  return field.default !== undefined && field.default !== null && field.default !== ''
    ? t('mAgent.tools.defaultValue', { v: String(field.default) })
    : ''
}

// Watch selected list changes and update plugin config in real-time
watch(() => selectedList.value, (newSelectedList) => {
  const finalFunctions = newSelectedList.map(f => ({
    pluginId: f.id,
    paramInfo: normalizeFunctionParams(f.params),
  }))
  pluginStore.updateFunctions(finalFunctions as any)
}, { deep: true })

onMounted(async () => {
  await mergeFunctions()
})
</script>

<template>
  <view class="tb-wrap tl">
    <tb-page-header :title="t('mAgent.tools.title')" :description="t('mAgent.tools.lead')" back />

    <!-- Built-in tools -->
    <tb-section :title="t('mAgent.tools.builtIn')" :description="t('mAgent.tools.on', { n: num(selectedList.length) })">
      <tb-empty v-if="!pluginRows.length" :text="t('mAgent.tools.none')" />
      <view v-else class="tl-rows">
        <view v-for="row in pluginRows" :key="row.id" class="tl-row" :class="{ 'is-on': !!row.selected }">
          <view
            class="tl-row__main" :role="row.selected ? 'button' : undefined" hover-class="is-press"
            @click="row.selected && editFunction(row.selected)"
          >
            <text class="tl-row__name">
              {{ row.name }}
            </text>
            <text v-if="rowHint(row)" class="tl-row__hint">
              {{ rowHint(row) }}
            </text>
          </view>
          <tb-switch :model-value="!!row.selected" :label="row.name" class="tl-row__sw" @change="(v: boolean) => togglePlugin(row, v)" />
        </view>
      </view>
    </tb-section>

    <!-- MCP endpoint -->
    <tb-section :title="t('mAgent.tools.mcp')" :description="t('mAgent.tools.mcpLead')">
      <view class="tl-mcp">
        <text class="tl-mcp__addr" :class="{ 'is-empty': !mcpAddress }">
          {{ mcpAddress || t('mAgent.tools.noAddress') }}
        </text>
        <tb-button size="s" icon="copy" :disabled="!mcpAddress" @click="copyMcpAddress">
          {{ t('mAgent.tools.copy') }}
        </tb-button>
      </view>
      <view class="tl-mcp__tools">
        <text class="tl-mcp__label">
          {{ t('mAgent.tools.mcpTools') }}
        </text>
        <tb-loading v-if="mcpLoading && !mcpTools.length" />
        <text v-else-if="!mcpTools.length" class="tl-muted">
          {{ t('mAgent.tools.mcpNone') }}
        </text>
        <view v-else class="tl-tags">
          <tb-tag v-for="tool in mcpTools" :key="tool" ink="ink-2">
            {{ tool }}
          </tb-tag>
        </view>
      </view>
    </tb-section>

    <view class="tl-bar">
      <tb-button variant="primary" size="l" block @click="goBack">
        {{ t('mAgent.tools.done') }}
      </tb-button>
    </view>

    <!-- Settings of one tool -->
    <tb-sheet v-model:open="showParamDialog" :title="currentFunction?.name || t('mAgent.tools.settings')" @close="closeParamEdit">
      <tb-empty
        v-if="!currentFunction?.fieldsMeta || currentFunction.fieldsMeta.length === 0"
        :text="t('mAgent.tools.noSettings', { name: currentFunction?.name || '' })"
      />

      <block v-else>
        <!-- Smart home helper -->
        <view v-if="isHomeAssistant(currentFunction)" class="tl-ha">
          <text class="tl-ha__title">
            {{ t('mAgent.tools.smartHome') }}
          </text>
          <text class="tl-muted">
            {{ t('mAgent.tools.smartHomeDesc') }}
          </text>
          <view class="tl-ha__btns">
            <tb-button v-for="item in haTemplates" :key="item.labelKey" size="s" icon="plus" @click="insertMobileDeviceTemplate(item.template)">
              {{ t(item.labelKey) }}
            </tb-button>
          </view>
          <text class="tl-ha__sub">
            {{ t('mAgent.tools.samples') }}
          </text>
          <text v-for="line in haSampleCommands" :key="line" class="tl-ha__line">
            {{ line }}
          </text>
        </view>

        <view v-for="field in currentFunction.fieldsMeta" :key="field.key" class="tl-field">
          <text class="tl-field__label">
            {{ field.label }}
          </text>
          <text v-if="getFieldRemark(field)" class="tl-muted">
            {{ getFieldRemark(field) }}
          </text>

          <!-- List: one item per line -->
          <block v-if="field.type === 'array'">
            <textarea
              class="tl-area" :value="arrayTextCache[field.key]" :maxlength="-1" :aria-label="field.label"
              :placeholder="t('mAgent.tools.eachLine')" placeholder-class="tl-ph"
              @input="(e: any) => handleArrayChange(field.key, e.detail.value)"
            />
            <text class="tl-muted">
              {{ t('mAgent.tools.eachLine') }}
            </text>
          </block>

          <!-- JSON -->
          <block v-else-if="field.type === 'json'">
            <textarea
              class="tl-area tl-area--code" :class="{ 'is-invalid': jsonInvalid[field.key] }" :value="jsonTextCache[field.key]"
              :maxlength="-1" :aria-label="field.label" :placeholder="t('mAgent.tools.validJson')" placeholder-class="tl-ph"
              @input="(e: any) => (jsonTextCache[field.key] = e.detail.value)"
              @blur="(e: any) => handleJsonChange(field.key, e.detail.value)"
            />
            <text class="tl-muted" :class="{ 'is-error': jsonInvalid[field.key] }">
              {{ jsonInvalid[field.key] ? t('mAgent.tools.jsonError') : t('mAgent.tools.validJson') }}
            </text>
          </block>

          <!-- Number -->
          <tb-input
            v-else-if="field.type === 'number'" type="digit" :model-value="tempParams[field.key] ?? ''" :aria-label="field.label"
            :placeholder="t('mAgent.tools.pleaseInput', { label: field.label })"
            @update:model-value="(v: string) => handleParamChange(field.key, Number(v))"
          />

          <!-- On / off -->
          <view v-else-if="field.type === 'boolean' || field.type === 'bool'" class="tl-bool">
            <text class="tl-muted">
              {{ t('mAgent.tools.toggle') }}
            </text>
            <tb-switch
              :model-value="!!tempParams[field.key]" :label="field.label" class="tl-row__sw"
              @change="(v: boolean) => handleParamChange(field.key, v)"
            />
          </view>

          <!-- Text (string and anything else) -->
          <tb-input
            v-else :model-value="tempParams[field.key] ?? ''" :maxlength="1000" :aria-label="field.label"
            :placeholder="t('mAgent.tools.pleaseInput', { label: field.label })"
            @update:model-value="(v: string) => handleParamChange(field.key, v)"
          />
        </view>
      </block>

      <template #footer>
        <tb-button variant="primary" @click="showParamDialog = false">
          {{ t('mAgent.tools.settingsDone') }}
        </tb-button>
      </template>
    </tb-sheet>
  </view>
</template>

<style lang="scss">
.tl { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
.tl-rows { display: flex; flex-direction: column; border-top: 1px solid var(--tb-rule-soft); }
.tl-row { display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--tb-rule-soft); }
.tl-row:last-child { border-bottom: 0; }
.tl-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 10px 0; min-height: 54px; justify-content: center; }
.tl-row__main.is-press { background: var(--tb-paper-2); }
.tl-row__name { font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
.tl-row.is-on .tl-row__hint { color: var(--tb-ink-2); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--tb-rule-soft); }
.tl-row__hint { font-size: 13px; color: var(--tb-ink-3); overflow-wrap: anywhere; }
.tl-row__sw { flex: none; }
.tl-row__sw .tb-switch__label { display: none; }
.tl-muted { font-size: 13px; color: var(--tb-ink-2); }
.tl-muted.is-error { color: var(--tb-danger); }

.tl-mcp { display: flex; align-items: flex-start; gap: 10px; }
.tl-mcp__addr { flex: 1; min-width: 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; word-break: break-all; padding: 8px 10px; background: var(--tb-paper-2); border-radius: var(--tb-radius-s); }
.tl-mcp__addr.is-empty { color: var(--tb-ink-3); word-break: normal; }
.tl-mcp__tools { display: flex; flex-direction: column; gap: 8px; }
.tl-mcp__label { font-size: 13px; font-weight: 600; color: var(--tb-ink-2); }
.tl-tags { display: flex; flex-wrap: wrap; gap: 6px; }

.tl-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 800; padding: 12px var(--tb-gutter) calc(12px + env(safe-area-inset-bottom));
  background: var(--tb-paper); border-top: 3px solid var(--tb-rule);
}

.tl-ha { display: flex; flex-direction: column; gap: 8px; padding-bottom: 14px; border-bottom: 1px solid var(--tb-rule); }
.tl-ha__title { font-weight: 700; font-size: 15px; }
.tl-ha__btns { display: flex; flex-wrap: wrap; gap: 8px; }
.tl-ha__sub { font-size: 13px; font-weight: 600; margin-top: 4px; }
.tl-ha__line { font-size: 13px; color: var(--tb-ink-2); }
.tl-field { display: flex; flex-direction: column; gap: 6px; padding-bottom: 14px; border-bottom: 1px solid var(--tb-rule-soft); }
.tl-field:last-child { border-bottom: 0; }
.tl-field__label { font-size: 15px; font-weight: 600; }
.tl-area {
  width: 100%; height: 140px; padding: 10px 12px; box-sizing: border-box; font-size: 15px; line-height: 1.5; color: var(--tb-ink);
  background: var(--tb-paper); border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-m);
}
.tl-area--code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; }
.tl-area.is-invalid { border-color: var(--tb-danger); }
.tl-ph { color: var(--tb-ink-3); }
.tl-bool { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
</style>
