<script lang="ts" setup>
import type { AgentDetail, ModelOption, PluginDefinition, RoleTemplate, TtsVoice } from '@/api/agent/types'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { getAgentDetail, getAgentTags, getAllLanguage, getModelOptions, getPluginFunctions, getRoleTemplates, getVoiceCloneAudioId, updateAgent } from '@/api/agent/agent'
import { t } from '@/i18n'
import { usePluginStore, useProvider, useSpeedPitch } from '@/store'
import { getEnvBaseUrl } from '@/utils'
import { toast } from '@/utils/toast'
import AgentSnapshotPanel from './components/AgentSnapshotPanel.vue'
import { filterTtsVoicesByLanguage, hasUsableTtsVoiceMetadata } from './components/agentSnapshotUtils.mjs'
import { createVoicePreviewRequestGate, hasVoicePreview, resolveVoicePreviewUrl } from './components/voicePreviewUtils.mjs'

defineOptions({
  name: 'AgentEdit',
})

const props = withDefaults(defineProps<Props>(), {
  agentId: '',
})

// Component props
interface Props {
  agentId?: string
}

const agentId = computed(() => props.agentId)

// Form data
const formData = ref<Partial<AgentDetail>>({
  agentName: '',
  systemPrompt: '',
  summaryMemory: '',
  vadModelId: '',
  asrModelId: '',
  llmModelId: '',
  slmModelId: '',
  vllmModelId: '',
  intentModelId: '',
  memModelId: '',
  ttsModelId: '',
  ttsVoiceId: '',
  ttsLanguage: '',
  ttsVolume: 0,
  ttsRate: 0,
  ttsPitch: 0,
})

// Display name data
const displayNames = ref({
// Display name data
  vad: t('agent.pleaseSelect'),
  asr: t('agent.pleaseSelect'),
  llm: t('agent.pleaseSelect'),
  slm: t('agent.pleaseSelect'),
  vllm: t('agent.pleaseSelect'),
  intent: t('agent.pleaseSelect'),
  memory: t('agent.pleaseSelect'),
  tts: t('agent.pleaseSelect'),
  voiceprint: t('agent.pleaseSelect'),
  report: t('agent.pleaseSelect'),
  language: t('agent.pleaseSelect'),
})

// Role template data
const roleTemplates = ref<RoleTemplate[]>([])
const selectedTemplateId = ref('')

// Loading status
const loading = ref(false)
const saving = ref(false)
const showSnapshotPanel = ref(false)
const currentVersionNo = ref<number | null>(null)
const snapshotReloadBlocked = ref(false)
const snapshotReloadFailed = ref(false)

// Model options data
const modelOptions = ref<{
  [key: string]: ModelOption[]
}>({
  VAD: [],
  ASR: [],
  LLM: [],
  VLLM: [],
  Intent: [],
  Memory: [],
  TTS: [],
})

interface VoiceOption {
  id?: string
  value: string
  name: string
  voiceDemo?: string | null
  voice_demo?: string | null
  ttsVoice?: string | null
  isClone: boolean
  train_status?: number
}

// Voice options data
const voiceOptions = ref<VoiceOption[]>([])
// Save complete voice info
const voiceDetails = ref<Record<string, TtsVoice>>({})

// Report mode options data
const reportOptions = [
  { name: t('agent.reportText'), value: 1 },
  { name: t('agent.reportTextVoice'), value: 2 },
]

// Selector display status
const pickerShow = ref<{
  [key: string]: boolean
}>({
  vad: false,
  asr: false,
  llm: false,
  slm: false,
  vllm: false,
  intent: false,
  memory: false,
  tts: false,
  voiceprint: false,
  language: false,
  report: false,
})

const allFunctions = ref<PluginDefinition[]>([])
const dynamicTags = ref([])
const inputValue = ref('')
const inputVisible = ref(false)
const languageOptions = ref<any[]>([])
const isVisibleReport = ref(false)
const tempSummaryMemory = ref('')
const selectedTtsLanguage = ref('')
const ttsLanguageTouched = ref(false)
const ttsVoiceTouched = ref(false)
const ttsOptionsLoading = ref(false)
const ttsOptionsModelId = ref('')
const originalTagNames = ref<string[]>([])
const originalAgentDetail = ref<AgentDetail | null>(null)
let ttsOptionsRequestSequence = 0
let agentDetailRequestSequence = 0
let agentTagRequestSequence = 0
let snapshotReloadSequence = 0

interface SnapshotRestoreContext {
  agentId: string
  actionSequence: number
}

// Audio playback related
const audioRef = ref<UniApp.InnerAudioContext | null>(null)
const playingVoiceId = ref<string>('')
const voicePreviewRequestGate = createVoicePreviewRequestGate()

const currentVoiceOption = computed(() => {
  return voiceOptions.value.find(v => v.value === formData.value.ttsVoiceId)
    || (voiceOptions.value.length > 0 ? voiceOptions.value[0] : null)
})

// Use plugin store
const pluginStore = usePluginStore()
const speedPitchStore = useSpeedPitch()
const providerStore = useProvider()

const EDITABLE_AGENT_FIELDS: Array<keyof AgentDetail> = [
  'agentName',
  'systemPrompt',
  'summaryMemory',
  'vadModelId',
  'asrModelId',
  'llmModelId',
  'slmModelId',
  'vllmModelId',
  'intentModelId',
  'memModelId',
  'ttsModelId',
  'chatHistoryConf',
  'langCode',
  'language',
  'sort',
]

const hasUnsavedChanges = computed(() => {
  if (loading.value || !originalAgentDetail.value) {
    return false
  }
  return stableSerialize(buildCurrentEditableState()) !== stableSerialize(buildOriginalEditableState())
})

function buildCurrentEditableState() {
  const original = originalAgentDetail.value as AgentDetail
  const current = formData.value as Record<string, any>
  const changedTtsFields = new Set(speedPitchStore.changedFields)
  return {
    ...pickEditableFields(current),
    ttsLanguage: ttsLanguageTouched.value ? selectedTtsLanguage.value : original.ttsLanguage,
    ttsVoiceId: ttsVoiceTouched.value ? current.ttsVoiceId : original.ttsVoiceId,
    ttsVolume: changedTtsFields.has('ttsVolume') ? speedPitchStore.speedPitch.ttsVolume : original.ttsVolume,
    ttsRate: changedTtsFields.has('ttsRate') ? speedPitchStore.speedPitch.ttsRate : original.ttsRate,
    ttsPitch: changedTtsFields.has('ttsPitch') ? speedPitchStore.speedPitch.ttsPitch : original.ttsPitch,
    functions: normalizeAgentFunctions(current.functions || []),
    contextProviders: providerStore.providers,
    tagNames: dynamicTags.value.map((tag: any) => tag.tagName).filter(Boolean).sort(),
  }
}

function buildOriginalEditableState() {
  const original = originalAgentDetail.value as AgentDetail
  return {
    ...pickEditableFields(original as unknown as Record<string, any>),
    ttsLanguage: original.ttsLanguage,
    ttsVoiceId: original.ttsVoiceId,
    ttsVolume: original.ttsVolume,
    ttsRate: original.ttsRate,
    ttsPitch: original.ttsPitch,
    functions: normalizeAgentFunctions(original.functions || []),
    contextProviders: original.contextProviders || [],
    tagNames: [...originalTagNames.value].sort(),
  }
}

function pickEditableFields(data: Record<string, any>) {
  return EDITABLE_AGENT_FIELDS.reduce<Record<string, any>>((result, field) => {
    result[field] = data[field]
    return result
  }, {})
}

function stableSerialize(value: any) {
  return JSON.stringify(sortObjectKeys(value))
}

function sortObjectKeys(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys)
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce<Record<string, any>>((result, key) => {
      result[key] = sortObjectKeys(value[key])
      return result
    }, {})
  }
  return value
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function handleCloseTag(id: string) {
  dynamicTags.value = dynamicTags.value.filter(tag => tag.id !== id)
}

function showInput() {
  inputVisible.value = true
}

function handleInputConfirm() {
  if (inputValue.value) {
    dynamicTags.value.push({ id: new Date().getTime(), tagName: inputValue.value.trim() })
    inputValue.value = ''
  }
  inputVisible.value = false
}

// Whether to disable memory history input
const isMemoryDisabled = computed(() => formData.value.memModelId !== 'Memory_mem_local_short')

function normalizeFunctionParams(paramInfo: any) {
  if (!paramInfo)
    return {}
  if (typeof paramInfo === 'string') {
    try {
      const parsed = JSON.parse(paramInfo)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    }
    catch {
      return {}
    }
  }
  return typeof paramInfo === 'object' && !Array.isArray(paramInfo) ? { ...paramInfo } : {}
}

function normalizeAgentFunctions(functions: any[] = []) {
  return functions.map(item => ({
    ...item,
    paramInfo: normalizeFunctionParams(item.paramInfo),
  }))
}

// Open context provider edit dialog
function openContextProviderDialog() {
  uni.navigateTo({
    url: '/pages/agent/provider',
  })
}

function handleRegulate() {
  uni.navigateTo({
    url: '/pages/agent/speedPitch',
  })
}

// Load agent details
async function loadAgentDetail(targetAgentId = agentId.value) {
  if (!targetAgentId)
    return false

  const requestId = ++agentDetailRequestSequence
  invalidateTtsMetadataRequest()
  try {
    loading.value = true
    const detail = await getAgentDetail(targetAgentId)
    if (!isActiveAgentDetailRequest(targetAgentId, requestId)) {
      return false
    }
    applyPersistedAgentDetail(detail, targetAgentId)
    await enhanceAgentDetailMetadata(detail, targetAgentId, requestId)
    return isActiveAgentDetailRequest(targetAgentId, requestId)
  }
  catch (error) {
    if (isActiveAgentDetailRequest(targetAgentId, requestId)) {
      console.error('Failed to load agent details:', error)
      toast.error(t('agent.loadFail'))
    }
    return false
  }
  finally {
    if (isActiveAgentDetailRequest(targetAgentId, requestId)) {
      loading.value = false
    }
  }
}

function applyPersistedAgentDetail(detail: AgentDetail, targetAgentId: string) {
  const normalizedFunctions = normalizeAgentFunctions(detail.functions || [])
  tempSummaryMemory.value = ''
  ttsLanguageTouched.value = false
  ttsVoiceTouched.value = false
  ttsOptionsModelId.value = ''
  voiceOptions.value = []
  voiceDetails.value = {}
  languageOptions.value = []
  formData.value = { ...detail, functions: normalizedFunctions }
  originalAgentDetail.value = cloneSerializable({ ...detail, functions: normalizedFunctions })
  currentVersionNo.value = detail.currentVersionNo || null
  selectedTtsLanguage.value = detail.ttsLanguage || ''

  pluginStore.setCurrentAgentId(targetAgentId)
  pluginStore.setCurrentFunctions(normalizedFunctions)
  speedPitchStore.updateSpeedPitch({
    ttsVolume: detail.ttsVolume ?? 0,
    ttsRate: detail.ttsRate ?? 0,
    ttsPitch: detail.ttsPitch ?? 0,
  })
  speedPitchStore.resetChangedFields()
  providerStore.updateProviders(detail.contextProviders || [])
}

async function enhanceAgentDetailMetadata(detail: AgentDetail, targetAgentId: string, requestId: number) {
  try {
    if (detail.ttsModelId) {
      await fetchAllLanguag(detail.ttsModelId, {
        preferredLanguage: detail.ttsLanguage,
        preferredVoiceId: detail.ttsVoiceId,
      })
    }
    else {
      voiceOptions.value = []
      voiceDetails.value = {}
      languageOptions.value = []
      selectedTtsLanguage.value = ''
    }
    await nextTick()
    if (isActiveAgentDetailRequest(targetAgentId, requestId)) {
      updateDisplayNames()
    }
  }
  catch (error) {
    // Persisted agent detail has already loaded successfully. Voice metadata is
    // display enhancement only and must not keep the post-restore save barrier.
    console.warn('Failed to enhance agent detail metadata:', error)
  }
}

function isActiveAgentDetailRequest(targetAgentId: string, requestId: number) {
  return targetAgentId === agentId.value && requestId === agentDetailRequestSequence
}

function invalidateTtsMetadataRequest() {
  ttsOptionsRequestSequence += 1
  ttsOptionsLoading.value = false
  ttsOptionsModelId.value = ''
}

// Get voice display name
function getVoiceDisplayName(ttsVoiceId: string) {
  if (!ttsVoiceId)
    return 'Please select'

  console.log('=== Voice mapping debug ===')
  console.log('Current voice ID:', ttsVoiceId)
  console.log('Current TTS model:', formData.value.ttsModelId)
  console.log('Available voice options:', voiceOptions.value)

  // Try matching ID directly from voice options
  const voice = voiceOptions.value.find(v => v.id === ttsVoiceId)
  if (voice) {
    console.log('Direct match success:', voice)
    return voice.name
  }

  // If not found, try fallback mapping
  if (voiceOptions.value.length > 0) {
    console.log('Direct match failed, trying fallback mapping')

    // Index mapping: voice1 -> 1st voice, voice2 -> 2nd voice
    const indexMap = {
      voice1: 0,
      voice2: 1,
      voice3: 2,
      voice4: 3,
      voice5: 4,
    }

    const index = indexMap[ttsVoiceId]
    if (index !== undefined && voiceOptions.value[index]) {
      const mappedVoice = voiceOptions.value[index]
      console.log(`Index mapping: ${ttsVoiceId} -> index ${index} -> ${mappedVoice.name}`)
      return mappedVoice.name
    }
  }

  console.log('All mappings failed, returning raw ID:', ttsVoiceId)
  return ttsVoiceId
}

// Update display name
function updateDisplayNames() {
  if (!formData.value)
    return

  displayNames.value.vad = getModelDisplayName('VAD', formData.value.vadModelId)
  displayNames.value.asr = getModelDisplayName('ASR', formData.value.asrModelId)
  displayNames.value.llm = getModelDisplayName('LLM', formData.value.llmModelId)
  displayNames.value.slm = getModelDisplayName('LLM', formData.value.slmModelId)
  displayNames.value.vllm = getModelDisplayName('VLLM', formData.value.vllmModelId)
  displayNames.value.intent = getModelDisplayName('Intent', formData.value.intentModelId)
  displayNames.value.memory = getModelDisplayName('Memory', formData.value.memModelId)
  displayNames.value.tts = getModelDisplayName('TTS', formData.value.ttsModelId)

  // Special handling for role voice
  displayNames.value.report = reportOptions.find(item => item.value === formData.value.chatHistoryConf)?.name

  isVisibleReport.value = formData.value.memModelId !== 'Memory_nomem'

  console.log('Final voice display name:', displayNames.value.voiceprint)
}

// Load role templates
async function loadRoleTemplates() {
  try {
    const templates = await getRoleTemplates()
    roleTemplates.value = templates
  }
  catch (error) {
    console.error('Failed to load role templates:', error)
  }
}

// Load model options
async function loadModelOptions() {
  const modelTypes = ['VAD', 'ASR', 'LLM', 'VLLM', 'Intent', 'Memory', 'TTS']

  try {
    await Promise.all(
      modelTypes?.map(async (type) => {
        console.log(`Loading model type: ${type}`)
        const options = await getModelOptions(type)
        modelOptions.value[type] = options
        console.log(`${type} options:`, options)
      }) || [],
    )
    console.log('All model options loaded:', modelOptions.value)
  }
  catch (error) {
    console.error('Failed to load model options:', error)
  }
}

// Filter voices by language
interface VoiceSelectionOptions {
  autoSelectVoice?: boolean
  preferredLanguage?: string | null
  preferredVoiceId?: string | null
}

interface TtsSelectionState {
  modelId: string
  voiceId: string
  language: string
  selectedLanguage: string
  languageTouched: boolean
  voiceTouched: boolean
  optionsModelId: string
  voiceOptions: VoiceOption[]
  voiceDetails: Record<string, TtsVoice>
  languageOptions: any[]
  displayNames: {
    tts: string
    voiceprint: string
    language: string
  }
}

function captureTtsSelectionState(): TtsSelectionState {
  return {
    modelId: formData.value.ttsModelId || '',
    voiceId: formData.value.ttsVoiceId || '',
    language: formData.value.ttsLanguage || '',
    selectedLanguage: selectedTtsLanguage.value,
    languageTouched: ttsLanguageTouched.value,
    voiceTouched: ttsVoiceTouched.value,
    optionsModelId: ttsOptionsModelId.value,
    voiceOptions: voiceOptions.value,
    voiceDetails: voiceDetails.value,
    languageOptions: languageOptions.value,
    displayNames: {
      tts: displayNames.value.tts,
      voiceprint: displayNames.value.voiceprint,
      language: displayNames.value.language,
    },
  }
}

function restoreTtsSelectionState(state: TtsSelectionState) {
  formData.value.ttsModelId = state.modelId
  formData.value.ttsVoiceId = state.voiceId
  formData.value.ttsLanguage = state.language
  selectedTtsLanguage.value = state.selectedLanguage
  ttsLanguageTouched.value = state.languageTouched
  ttsVoiceTouched.value = state.voiceTouched
  ttsOptionsModelId.value = state.optionsModelId
  voiceOptions.value = state.voiceOptions
  voiceDetails.value = state.voiceDetails
  languageOptions.value = state.languageOptions
  displayNames.value.tts = state.displayNames.tts
  displayNames.value.voiceprint = state.displayNames.voiceprint
  displayNames.value.language = state.displayNames.language
}

function filterVoicesByLanguage(options: VoiceSelectionOptions = {}) {
  if (!voiceDetails.value || Object.keys(voiceDetails.value).length === 0) {
    voiceOptions.value = []
    return
  }

  const allVoices = Object.values(voiceDetails.value)

  // Filter voices by selected language
  const filteredVoices = filterTtsVoicesByLanguage(allVoices, selectedTtsLanguage.value)

  voiceOptions.value = filteredVoices.map(voice => ({
    id: voice.id,
    value: voice.id,
    name: voice.name,
    voiceDemo: voice.voiceDemo,
    voice_demo: voice.voice_demo,
    ttsVoice: voice.ttsVoice,
    isClone: Boolean(voice.isClone),
    train_status: voice.trainStatus,
  }))

  // Check if selected voice supports current language, fallback to first
  const currentVoiceSupportsLanguage = formData.value.ttsVoiceId
    && filteredVoices.some(voice => voice.id === formData.value.ttsVoiceId)

  if (!currentVoiceSupportsLanguage && options.autoSelectVoice) {
    formData.value.ttsVoiceId = filteredVoices.length > 0 ? filteredVoices[0].id : ''
    displayNames.value.voiceprint = filteredVoices.length > 0 ? filteredVoices[0].name : ''
    ttsVoiceTouched.value = true
  }
  else {
    displayNames.value.voiceprint = filteredVoices.find(item => item.id === formData.value.ttsVoiceId)?.name
      || getVoiceDisplayName(formData.value.ttsVoiceId)
  }
}

function getVoiceDefaultLanguage(ttsVoiceId: string) {
  if (!ttsVoiceId || !voiceDetails.value?.[ttsVoiceId]?.languages) {
    return ''
  }
  const languages = voiceDetails.value[ttsVoiceId].languages
    .split(/[、；;,，]/)
    .map(lang => lang.trim())
    .filter(Boolean)
  return languages[0] || ''
}

// Load languages based on TTS model
async function fetchAllLanguag(ttsModelId: string, options: VoiceSelectionOptions = {}): Promise<'loaded' | 'failed' | 'stale'> {
  const requestId = ++ttsOptionsRequestSequence
  ttsOptionsLoading.value = true
  try {
    const res = await getAllLanguage(ttsModelId)
    if (requestId !== ttsOptionsRequestSequence) {
      return 'stale'
    }
    if (!Array.isArray(res)) {
      throw new TypeError('Invalid TTS voice metadata')
    }
    // An empty response cannot prove that the newly selected model accepts an
    // empty voice. Until the API exposes an explicit "voice optional"
    // capability, keep the previous tuple instead of persisting a guess.
    if (!hasUsableTtsVoiceMetadata(res)) {
      throw new Error('No TTS voice metadata is available')
    }
    // Save complete voice info
    voiceDetails.value = res.reduce<Record<string, TtsVoice>>((acc, voice) => {
      acc[voice.id] = voice
      return acc
    }, {})
    // Extract all language options and deduplicate
    const allLanguages = new Set()
    res.forEach((voice) => {
      if (voice.languages) {
        const languagesArray = voice.languages.split(/[、；;,，]/).map(lang => lang.trim()).filter(lang => lang)
        languagesArray.forEach(lang => allLanguages.add(lang))
      }
    })
    languageOptions.value = Array.from(allLanguages).map(lang => ({
      value: lang,
      name: lang,
    }))

    const requestedLanguage = options.preferredLanguage
    const preferredVoiceLanguage = options.preferredVoiceId
      ? getVoiceDefaultLanguage(options.preferredVoiceId)
      : ''
    // Do not carry a language from the previous model into a provider which
    // exposes no language dimension.
    selectedTtsLanguage.value = ''
    displayNames.value.language = ''
    // Prioritize specified language, fallback to agent config
    if (requestedLanguage && languageOptions.value.some(option => option.value === requestedLanguage)) {
      selectedTtsLanguage.value = requestedLanguage
      displayNames.value.language = requestedLanguage
    }
    else if (preferredVoiceLanguage && languageOptions.value.some(option => option.value === preferredVoiceLanguage)) {
      selectedTtsLanguage.value = preferredVoiceLanguage
      displayNames.value.language = preferredVoiceLanguage
    }
    else if (formData.value.ttsLanguage && languageOptions.value.some(option => option.value === formData.value.ttsLanguage)) {
      selectedTtsLanguage.value = formData.value.ttsLanguage
      displayNames.value.language = formData.value.ttsLanguage
    }
    else if (getVoiceDefaultLanguage(formData.value.ttsVoiceId)) {
      selectedTtsLanguage.value = getVoiceDefaultLanguage(formData.value.ttsVoiceId)
      displayNames.value.language = selectedTtsLanguage.value
    }
    else if (languageOptions.value.length > 0) {
      selectedTtsLanguage.value = languageOptions.value[0].value
      displayNames.value.language = languageOptions.value[0].value
    }

    // Filter voices by selected language
    filterVoicesByLanguage(options)
    ttsOptionsModelId.value = ttsModelId
    return 'loaded'
  }
  catch (error) {
    if (requestId === ttsOptionsRequestSequence) {
      console.error('Failed to load TTS options:', error)
      ttsOptionsModelId.value = ''
    }
    return requestId === ttsOptionsRequestSequence ? 'failed' : 'stale'
  }
  finally {
    if (requestId === ttsOptionsRequestSequence) {
      ttsOptionsLoading.value = false
    }
  }
}

// Load TTS voice options
// async function loadVoiceOptions(ttsModelId?: string) {
//   if (!ttsModelId)
//     return

//   try {
//     console.log(`Loading voice options: ${ttsModelId}`)
//     const voices = await getTTSVoices(ttsModelId)
//     voiceOptions.value = voices
//     console.log('Voice options:', voices)
//   }
//   catch (error) {
//     console.error('Failed to load voice options:', error)
//     voiceOptions.value = []
//   }
// }

// Select role template
async function selectRoleTemplate(templateId: string) {
  if (ttsOptionsLoading.value) {
    return
  }
  if (selectedTemplateId.value === templateId) {
    selectedTemplateId.value = ''
    return
  }

  selectedTemplateId.value = templateId
  const template = roleTemplates.value.find(t => t.id === templateId)
  if (template) {
    const previousTtsState = captureTtsSelectionState()
    const templateTtsLanguage = template.ttsLanguage?.trim() || ''
    const hasTemplateTtsLanguage = Boolean(templateTtsLanguage)
    formData.value = {
      ...formData.value,
      systemPrompt: template.systemPrompt || formData.value.systemPrompt,
      vadModelId: template.vadModelId || formData.value.vadModelId,
      asrModelId: template.asrModelId || formData.value.asrModelId,
      llmModelId: template.llmModelId || formData.value.llmModelId,
      slmModelId: template.llmModelId || formData.value.slmModelId,
      vllmModelId: template.vllmModelId || formData.value.vllmModelId,
      intentModelId: template.intentModelId || formData.value.intentModelId,
      memModelId: template.memModelId || formData.value.memModelId,
      ttsModelId: template.ttsModelId || formData.value.ttsModelId,
      ttsVoiceId: template.ttsVoiceId || formData.value.ttsVoiceId,
      ttsLanguage: hasTemplateTtsLanguage ? templateTtsLanguage : formData.value.ttsLanguage,
      agentName: template.agentName || formData.value.agentName,
      chatHistoryConf: template.chatHistoryConf || formData.value.chatHistoryConf,
      summaryMemory: template.summaryMemory || formData.value.summaryMemory,
      langCode: template.langCode || formData.value.langCode,
    }
    if (hasTemplateTtsLanguage) {
      selectedTtsLanguage.value = templateTtsLanguage
      displayNames.value.language = templateTtsLanguage
    }
    if (template.ttsModelId || template.ttsVoiceId || hasTemplateTtsLanguage) {
      const result = await fetchAllLanguag(template.ttsModelId || formData.value.ttsModelId, {
        autoSelectVoice: true,
        preferredLanguage: hasTemplateTtsLanguage ? templateTtsLanguage : '',
        preferredVoiceId: template.ttsVoiceId,
      })
      if (result === 'failed') {
        restoreTtsSelectionState(previousTtsState)
        toast.warning(t('agent.ttsOptionsLoadFailed'))
      }
      else if (result === 'loaded') {
        ttsLanguageTouched.value = true
        ttsVoiceTouched.value = true
      }
    }
    updateDisplayNames()
  }
}

// Open selector
function openPicker(type: string) {
  if (ttsOptionsLoading.value && (type === 'tts' || type === 'language' || type === 'voiceprint')) {
    return
  }
  pickerShow.value[type] = true
}

// Selector confirm
async function onPickerConfirm(type: string, value: any, name: string) {
  console.log('Selector confirm:', type, value, name)

  const previousTtsState = type === 'tts' ? captureTtsSelectionState() : null
  // Save display name
  displayNames.value[type] = name

  switch (type) {
    case 'vad':
      formData.value.vadModelId = value
      break
    case 'asr':
      formData.value.asrModelId = value
      break
    case 'llm':
      formData.value.llmModelId = value
      break
    case 'slm':
      formData.value.slmModelId = value
      break
    case 'vllm':
      formData.value.vllmModelId = value
      break
    case 'intent':
      formData.value.intentModelId = value
      displayNames.value.intent = name // Ensure display name updates correctly
      break
    case 'memory':
      formData.value.memModelId = value
      formData.value.chatHistoryConf = value === 'Memory_nomem' ? 0 : 2
      displayNames.value.memory = name // Ensure display name updates correctly
      displayNames.value.report = reportOptions[1].name
      isVisibleReport.value = value !== 'Memory_nomem'
      if (value === 'Memory_nomem' || value === 'Memory_mem_report_only') {
        tempSummaryMemory.value = formData.value.summaryMemory
        formData.value.summaryMemory = ''
      }
      else if (tempSummaryMemory.value !== '' && formData.value.summaryMemory === '') {
        formData.value.summaryMemory = tempSummaryMemory.value
        tempSummaryMemory.value = ''
      }
      break
    case 'tts': {
      const preferredLanguage = selectedTtsLanguage.value
      formData.value.ttsModelId = value
      formData.value.ttsVoiceId = ''
      const result = await fetchAllLanguag(value, { autoSelectVoice: true, preferredLanguage })
      if (result === 'failed' && previousTtsState) {
        restoreTtsSelectionState(previousTtsState)
        toast.warning(t('agent.ttsOptionsLoadFailed'))
      }
      else if (result === 'loaded') {
        ttsLanguageTouched.value = true
        ttsVoiceTouched.value = true
      }
      break
    }
    case 'language':
      selectedTtsLanguage.value = value
      formData.value.ttsLanguage = value
      ttsLanguageTouched.value = true
      filterVoicesByLanguage({ autoSelectVoice: true })
      break
    case 'voiceprint':
      formData.value.ttsVoiceId = value
      ttsVoiceTouched.value = true
      if (selectedTtsLanguage.value) {
        formData.value.ttsLanguage = selectedTtsLanguage.value
        ttsLanguageTouched.value = true
      }
      displayNames.value.voiceprint = name // Ensure display name updates correctly
      break
    case 'report':
      formData.value.chatHistoryConf = value
      break
  }

  pickerShow.value[type] = false
}

// Selector cancel
function onPickerCancel(type: string) {
  pickerShow.value[type] = false
  // Stop playback on close
  if (type === 'voiceprint') {
    stopAudio()
  }
}

// Play audio
async function playAudio(voice: VoiceOption, event: Event) {
  event.stopPropagation() // Stop event propagation

  if (!hasVoicePreview(voice)) {
    return
  }

  // Stop if currently playing same audio
  if (playingVoiceId.value === voice.value) {
    stopAudio()
    return
  }

  // Stop previous audio
  stopAudio()
  const requestId = voicePreviewRequestGate.begin()
  playingVoiceId.value = voice.value

  try {
    const audioUrl = await resolveVoicePreviewUrl({
      id: voice.value || voice.id,
      isClone: voice.isClone,
      voiceDemo: voice.voiceDemo || voice.voice_demo,
      ttsVoice: voice.ttsVoice || (voiceDetails.value[voice.value] as (TtsVoice & { ttsVoice?: string | null }) | undefined)?.ttsVoice,
    }, getVoiceCloneAudioId, getEnvBaseUrl())

    // User may cancel or switch while waiting for temporary URL.
    if (!voicePreviewRequestGate.isCurrent(requestId) || playingVoiceId.value !== voice.value) {
      return
    }
    if (!audioUrl) {
      toast.error(t('voiceprint.getAudioFailed'))
      playingVoiceId.value = ''
      return
    }

    // Create new Audio instance
    const audio = uni.createInnerAudioContext()
    audioRef.value = audio
    audio.src = audioUrl

    // Listen for playback end
    audio.onEnded(() => {
      if (
        voicePreviewRequestGate.isCurrent(requestId)
        && audioRef.value === audio
        && playingVoiceId.value === voice.value
      ) {
        playingVoiceId.value = ''
      }
    })

    // Listen for playback error
    audio.onError(() => {
      if (
        voicePreviewRequestGate.isCurrent(requestId)
        && audioRef.value === audio
        && playingVoiceId.value === voice.value
      ) {
        toast.error(t('voiceprint.audioPlayFailed'))
        playingVoiceId.value = ''
      }
    })

    // Play audio
    audio.play()
  }
  catch (error) {
    if (!voicePreviewRequestGate.isCurrent(requestId) || playingVoiceId.value !== voice.value) {
      return
    }
    console.error('Failed to get cloned voice preview URL:', error)
    toast.error(t('voiceprint.getAudioFailed'))
    playingVoiceId.value = ''
  }
}

// Stop audio
function stopAudio() {
  voicePreviewRequestGate.invalidate()
  if (audioRef.value) {
    audioRef.value.stop()
    audioRef.value.destroy()
    audioRef.value = null
  }
  playingVoiceId.value = ''
}

// Get model display name
function getModelDisplayName(modelType: string, modelId: string) {
  if (!modelId)
    return 'Please select'

  // Find matching ID directly from API config data
  const options = modelOptions.value[modelType]

  if (!options || options.length === 0) {
    return modelId
  }

  const option = options.find(opt => opt.id === modelId)
  if (option) {
    return option.modelName
  }
  return modelId
}

// Save agent
async function saveAgent() {
  if (saving.value) {
    return
  }
  if (snapshotReloadBlocked.value) {
    toast.error(t(snapshotReloadFailed.value
      ? 'agentSnapshot.reloadAfterRestoreFailed'
      : 'agentSnapshot.reloadAfterRestorePending'))
    return
  }
  if (ttsOptionsLoading.value) {
    return
  }
  const ttsSelectionTouched = ttsLanguageTouched.value || ttsVoiceTouched.value
  const hasLanguageOptions = languageOptions.value.length > 0
  const hasVoiceOptions = Object.keys(voiceDetails.value).length > 0
  if (ttsSelectionTouched
    && (ttsOptionsModelId.value !== formData.value.ttsModelId
      || (hasLanguageOptions && !selectedTtsLanguage.value)
      || (hasVoiceOptions && !formData.value.ttsVoiceId))) {
    toast.warning(t('agent.ttsOptionsLoadFailed'))
    return
  }
  if (!formData.value.agentName?.trim()) {
    toast.warning(t('agent.pleaseInputAgentName'))
    return
  }

  if (!formData.value.systemPrompt?.trim()) {
    toast.warning(t('agent.pleaseInputRoleDescription'))
    return
  }

  try {
    saving.value = true
    const tagNames = dynamicTags.value.map(tag => tag.tagName)
    const tagsChanged = !isSameStringList(tagNames, originalTagNames.value)
    // Build save data including context config and voice settings
    const saveData: Record<string, any> = {
      ...formData.value,
      contextProviders: providerStore.providers,
      functions: normalizeAgentFunctions(formData.value.functions || []),
    }
    delete saveData.ttsVolume
    delete saveData.ttsRate
    delete saveData.ttsPitch
    delete saveData.ttsLanguage
    delete saveData.ttsVoiceId
    if (ttsLanguageTouched.value) {
      saveData.ttsLanguage = selectedTtsLanguage.value
    }
    if (ttsVoiceTouched.value) {
      saveData.ttsVoiceId = formData.value.ttsVoiceId
    }
    const changedTtsFields = new Set(speedPitchStore.changedFields)
    if (changedTtsFields.has('ttsVolume')) {
      saveData.ttsVolume = speedPitchStore.speedPitch.ttsVolume
    }
    if (changedTtsFields.has('ttsRate')) {
      saveData.ttsRate = speedPitchStore.speedPitch.ttsRate
    }
    if (changedTtsFields.has('ttsPitch')) {
      saveData.ttsPitch = speedPitchStore.speedPitch.ttsPitch
    }
    if (tagsChanged) {
      saveData.tagNames = tagNames
    }
    await updateAgent(agentId.value, saveData)
    if (tagsChanged) {
      originalTagNames.value = [...tagNames]
    }
    speedPitchStore.resetChangedFields()
    await loadAgentDetail()

    toast.success(t('agent.saveSuccess'))
  }
  catch (error) {
    console.error('Failed to save:', error)
    toast.error(t('agent.saveFail'))
  }
  finally {
    saving.value = false
  }
}

function loadPluginFunctions() {
  getPluginFunctions().then((res) => {
    const processedFunctions = res?.map((item) => {
      const meta = JSON.parse(item.fields || '[]')
      const params = meta.reduce((m: any, f: any) => {
        m[f.key] = f.default
        return m
      }, {})
      return { ...item, fieldsMeta: meta, params }
    }) || []

    allFunctions.value = processedFunctions
    // Also update to store
    pluginStore.setAllFunctions(processedFunctions)
  })
}

function handleTools() {
  console.log('Current plugin config:', formData.value.functions)

  // Ensure store has latest data
  pluginStore.setCurrentAgentId(agentId.value)
  pluginStore.setCurrentFunctions(normalizeAgentFunctions(formData.value.functions || []))
  pluginStore.setAllFunctions(allFunctions.value)

  uni.navigateTo({
    url: '/pages/agent/tools',
  })
}

// Get agent tags
async function loadAgentTags(targetAgentId = agentId.value) {
  if (!targetAgentId) {
    return false
  }
  const requestId = ++agentTagRequestSequence
  try {
    const res = await getAgentTags(targetAgentId)
    if (!isActiveAgentTagRequest(targetAgentId, requestId)) {
      return false
    }
    dynamicTags.value = res || []
    originalTagNames.value = dynamicTags.value.map(tag => tag.tagName)
    return true
  }
  catch (error) {
    if (isActiveAgentTagRequest(targetAgentId, requestId)) {
      console.error('Failed to load agent tags:', error)
    }
    return false
  }
}

function isActiveAgentTagRequest(targetAgentId: string, requestId: number) {
  return targetAgentId === agentId.value && requestId === agentTagRequestSequence
}

async function handleSnapshotRestored(context: SnapshotRestoreContext) {
  if (!context || context.agentId !== agentId.value) {
    return
  }
  await reloadAgentAfterSnapshotRestore(context.agentId)
}

async function reloadAgentAfterSnapshotRestore(targetAgentId = agentId.value) {
  if (!targetAgentId || targetAgentId !== agentId.value) {
    return false
  }
  const reloadId = ++snapshotReloadSequence
  const detailRequestId = ++agentDetailRequestSequence
  const tagRequestId = ++agentTagRequestSequence
  snapshotReloadBlocked.value = true
  snapshotReloadFailed.value = false
  loading.value = true
  invalidateTtsMetadataRequest()

  try {
    // Apply detail and tags only after both persisted reads succeed. If either
    // fails, the old form may remain visible but cannot be saved until retry.
    const [detail, tags] = await Promise.all([
      getAgentDetail(targetAgentId),
      getAgentTags(targetAgentId),
    ])
    if (!isActiveSnapshotReload(targetAgentId, reloadId, detailRequestId, tagRequestId)) {
      return false
    }

    applyPersistedAgentDetail(detail, targetAgentId)
    dynamicTags.value = tags || []
    originalTagNames.value = dynamicTags.value.map(tag => tag.tagName)

    // Voice metadata is an optional display enhancement. Its own failure must
    // not turn a successful persisted detail+tag reload into a blocked form.
    await enhanceAgentDetailMetadata(detail, targetAgentId, detailRequestId)
    if (!isActiveSnapshotReload(targetAgentId, reloadId, detailRequestId, tagRequestId)) {
      return false
    }
    snapshotReloadBlocked.value = false
    snapshotReloadFailed.value = false
    return true
  }
  catch (error) {
    if (isActiveSnapshotReload(targetAgentId, reloadId, detailRequestId, tagRequestId)) {
      console.error('Failed to reload agent after restore:', error)
      snapshotReloadFailed.value = true
      toast.error(t('agentSnapshot.reloadAfterRestoreFailed'))
    }
    return false
  }
  finally {
    if (isActiveSnapshotReload(targetAgentId, reloadId, detailRequestId, tagRequestId)) {
      loading.value = false
    }
  }
}

function isActiveSnapshotReload(
  targetAgentId: string,
  reloadId: number,
  detailRequestId: number,
  tagRequestId: number,
) {
  return targetAgentId === agentId.value
    && reloadId === snapshotReloadSequence
    && detailRequestId === agentDetailRequestSequence
    && tagRequestId === agentTagRequestSequence
}

function retrySnapshotReload() {
  if (!snapshotReloadFailed.value || !agentId.value) {
    return
  }
  void reloadAgentAfterSnapshotRestore(agentId.value)
}

function openSnapshotPanel() {
  if (saving.value || snapshotReloadBlocked.value) {
    toast.warning(t('agentSnapshot.mutationBusy'))
    return
  }
  showSnapshotPanel.value = true
}

function isSameStringList(left: string[], right: string[]) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false
  }
  return left.every((value, index) => value === right[index])
}

// Watch plugin config changes in store
watch(() => pluginStore.currentFunctions, (newFunctions) => {
  formData.value.functions = normalizeAgentFunctions(newFunctions || [])
}, { deep: true })

watch(agentId, (currentAgentId, previousAgentId) => {
  if (currentAgentId === previousAgentId) {
    return
  }
  agentDetailRequestSequence += 1
  agentTagRequestSequence += 1
  snapshotReloadSequence += 1
  invalidateTtsMetadataRequest()
  loading.value = false
  snapshotReloadFailed.value = false
  snapshotReloadBlocked.value = Boolean(currentAgentId)
  originalAgentDetail.value = null
  originalTagNames.value = []
  if (currentAgentId) {
    void reloadAgentAfterSnapshotRestore(currentAgentId)
  }
}, { flush: 'sync' })

// ---- Layout helpers for the grouped settings list (display only) ----

// Pending copy (src/i18n/_pending/mobile-home-agents.ts): English fallback until merged
function tx(key: string, fallback: string, params?: Record<string, string | number>) {
  const value = t(key, params)
  if (value !== key)
    return value
  if (!params)
    return fallback
  return Object.entries(params).reduce((text, [name, val]) => text.replace(`{${name}}`, String(val)), fallback)
}

type PickerKey = 'vad' | 'asr' | 'llm' | 'slm' | 'vllm' | 'intent' | 'memory' | 'tts' | 'language' | 'report'

const PICKER_TITLE_KEYS: Record<PickerKey, string> = {
  vad: 'agent.vad',
  asr: 'agent.asr',
  llm: 'agent.llm',
  slm: 'agent.slm',
  vllm: 'agent.vllm',
  intent: 'agent.intent',
  memory: 'agent.memory',
  tts: 'agent.tts',
  language: 'agent.language',
  report: 'agent.reportMode',
}

// The one list picker that is open (voice has its own sheet with previews)
const activePicker = computed<PickerKey | ''>(() => {
  return (Object.keys(PICKER_TITLE_KEYS) as PickerKey[]).find(key => pickerShow.value[key]) || ''
})

const pickerSheetVisible = computed({
  get: () => Boolean(activePicker.value),
  set: (value: boolean) => {
    if (!value && activePicker.value)
      onPickerCancel(activePicker.value)
  },
})

function toModelActions(options: ModelOption[] = []) {
  return options.map(item => ({ name: item.modelName, value: item.id }))
}

const pickerActions = computed<Array<{ name: string, value: any }>>(() => {
  switch (activePicker.value) {
    case 'vad': return toModelActions(modelOptions.value.VAD)
    case 'asr': return toModelActions(modelOptions.value.ASR)
    case 'llm':
    case 'slm': return toModelActions(modelOptions.value.LLM)
    case 'vllm': return toModelActions(modelOptions.value.VLLM)
    case 'intent': return toModelActions(modelOptions.value.Intent)
    case 'memory': return toModelActions(modelOptions.value.Memory)
    case 'tts': return toModelActions(modelOptions.value.TTS)
    case 'language': return languageOptions.value
    case 'report': return reportOptions
    default: return []
  }
})

const pickerCurrentValue = computed(() => {
  switch (activePicker.value) {
    case 'vad': return formData.value.vadModelId
    case 'asr': return formData.value.asrModelId
    case 'llm': return formData.value.llmModelId
    case 'slm': return formData.value.slmModelId
    case 'vllm': return formData.value.vllmModelId
    case 'intent': return formData.value.intentModelId
    case 'memory': return formData.value.memModelId
    case 'tts': return formData.value.ttsModelId
    case 'language': return selectedTtsLanguage.value
    case 'report': return formData.value.chatHistoryConf
    default: return undefined
  }
})

const pickerTitle = computed(() => activePicker.value ? t(PICKER_TITLE_KEYS[activePicker.value]) : '')

const modelRows = computed(() => [
  { key: 'llm', label: t('agent.llm'), value: displayNames.value.llm, show: true },
  { key: 'slm', label: t('agent.slm'), value: displayNames.value.slm, show: true },
  { key: 'vllm', label: t('agent.vllm'), value: displayNames.value.vllm, show: true },
  { key: 'asr', label: t('agent.asr'), value: displayNames.value.asr, show: true },
  { key: 'vad', label: t('agent.vad'), value: displayNames.value.vad, show: true },
  { key: 'intent', label: t('agent.intent'), value: displayNames.value.intent, show: true },
  { key: 'memory', label: t('agent.memory'), value: displayNames.value.memory, show: true },
  { key: 'report', label: t('agent.reportMode'), value: displayNames.value.report, show: isVisibleReport.value },
])

const selectedTemplateName = computed(() => {
  return roleTemplates.value.find(item => item.id === selectedTemplateId.value)?.agentName || ''
})

const showTemplateSheet = ref(false)

function chooseTemplate(templateId: string) {
  showTemplateSheet.value = false
  void selectRoleTemplate(templateId)
}

const agentInitial = computed(() => {
  const name = (formData.value.agentName || '').trim()
  return name ? Array.from(name)[0].toUpperCase() : '?'
})

const toolCount = computed(() => (formData.value.functions || []).length)

const speedPitchSummary = computed(() => {
  const { ttsVolume, ttsRate, ttsPitch } = speedPitchStore.speedPitch
  if (!ttsVolume && !ttsRate && !ttsPitch)
    return tx('agent.voiceTuningDefault', 'Standard')
  return [ttsVolume, ttsRate, ttsPitch].map(value => (value > 0 ? `+${value}` : `${value}`)).join(' / ')
})

const showActionBar = computed(() => hasUnsavedChanges.value || saving.value || snapshotReloadBlocked.value)

// Full-screen text editor sheet for the prompt and memory
type EditorField = 'systemPrompt' | 'summaryMemory'
const editorField = ref<EditorField | ''>('')
const editorDraft = ref('')

const editorVisible = computed({
  get: () => Boolean(editorField.value),
  set: (value: boolean) => {
    if (!value)
      editorField.value = ''
  },
})

const editorTitle = computed(() => editorField.value === 'summaryMemory' ? t('agent.historyMemory') : t('agent.roleDescription'))
const editorPlaceholder = computed(() => editorField.value === 'summaryMemory' ? t('agent.memoryContent') : t('agent.inputRoleDescription'))
const editorMaxLength = computed(() => editorField.value === 'systemPrompt' ? 2000 : -1)

function openEditor(field: EditorField) {
  if (field === 'summaryMemory' && isMemoryDisabled.value)
    return
  editorDraft.value = String(formData.value[field] || '')
  editorField.value = field
}

function applyEditor() {
  if (editorField.value)
    formData.value[editorField.value] = editorDraft.value
  editorField.value = ''
}

function previewText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

onMounted(async () => {
  loadAgentTags()

  // Load model options and role templates first
  await Promise.all([
    loadRoleTemplates(),
    loadModelOptions(),
    loadPluginFunctions(),
  ])

  // Then load agent details to map display names properly
  if (agentId.value && !snapshotReloadBlocked.value) {
    await loadAgentDetail()
  }
})
</script>

<template>
  <view class="agent-edit" :class="{ 'agent-edit--with-bar': showActionBar }">
    <!-- First load -->
    <view v-if="loading && !originalAgentDetail" class="agent-edit__loading">
      <view class="nx-card agent-hero">
        <view class="nx-skeleton agent-hero__avatar" />
        <view class="agent-hero__text">
          <view class="nx-skeleton agent-edit__skel-title" />
          <view class="nx-skeleton agent-edit__skel-line" />
        </view>
      </view>
      <view v-for="n in 3" :key="n" class="nx-group">
        <view class="nx-group__body">
          <view v-for="m in 3" :key="m" class="nx-row">
            <view class="nx-skeleton agent-edit__skel-row" />
          </view>
        </view>
      </view>
    </view>

    <template v-else>
      <!-- Identity -->
      <view class="nx-card agent-hero">
        <view class="agent-hero__avatar">
          {{ agentInitial }}
        </view>
        <view class="agent-hero__text">
          <text class="nx-truncate agent-hero__name" :title="formData.agentName">
            {{ formData.agentName || t('agent.editTitle') }}
          </text>
          <text class="nx-num agent-hero__meta">
            {{ currentVersionNo ? `${t('agentSnapshot.currentVersion')} #${currentVersionNo}` : t('agent.editTitle') }}
          </text>
        </view>
        <view v-if="hasUnsavedChanges" class="nx-badge nx-badge--warning">
          {{ tx('agent.unsavedBadge', 'Unsaved') }}
        </view>
      </view>

      <!-- Restore reload notice -->
      <view v-if="snapshotReloadBlocked" class="agent-notice">
        <wd-icon name="warning" size="18px" custom-class="agent-notice__icon" />
        <view class="agent-notice__main">
          <text class="agent-notice__text">
            {{ t(snapshotReloadFailed ? 'agentSnapshot.reloadAfterRestoreFailed' : 'agentSnapshot.reloadAfterRestorePending') }}
          </text>
          <view
            v-if="snapshotReloadFailed"
            class="agent-notice__action"
            role="button"
            @click="retrySnapshotReload"
          >
            {{ t('agentSnapshot.retryReload') }}
          </view>
        </view>
      </view>

      <!-- Identity group -->
      <view class="nx-group">
        <view class="nx-group__header">
          {{ t('agent.basicInfo') }}
        </view>
        <view class="nx-group__body">
          <view class="nx-row">
            <text class="nx-row__title agent-label">
              {{ t('agent.agentName') }}
            </text>
            <input
              v-model="formData.agentName"
              class="agent-inline-input"
              type="text"
              :maxlength="64"
              :placeholder="t('agent.inputAgentName')"
              placeholder-class="agent-placeholder"
            >
          </view>

          <view class="nx-row nx-row--tap" @click="showTemplateSheet = true">
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agent.roleMode') }}
              </view>
            </view>
            <text class="nx-row__value nx-truncate">
              {{ selectedTemplateName || tx('agent.templateNone', 'None') }}
            </text>
            <wd-icon name="arrow-right" size="14px" custom-class="nx-row__chevron" />
          </view>

          <view class="nx-row agent-tags-row">
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agent.agentTag') }}
              </view>
              <view class="agent-tags">
                <view v-for="tag in dynamicTags" :key="tag.id" class="agent-tag">
                  <text class="nx-truncate">
                    {{ tag.tagName }}
                  </text>
                  <view class="agent-tag__close" role="button" :aria-label="t('common.delete')" @click="handleCloseTag(tag.id)">
                    <wd-icon name="close" size="12px" />
                  </view>
                </view>
                <input
                  v-if="inputVisible"
                  v-model="inputValue"
                  class="agent-tag-input"
                  type="text"
                  :maxlength="20"
                  :focus="inputVisible"
                  :placeholder="t('agent.inputAgentTag')"
                  placeholder-class="agent-placeholder"
                  @confirm="handleInputConfirm"
                  @blur="handleInputConfirm"
                >
                <view v-else class="agent-tag agent-tag--add" role="button" @click="showInput">
                  <wd-icon name="add" size="12px" />
                  <text>{{ t('agent.addAgentTag') }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- Personality -->
      <view class="nx-group">
        <view class="nx-group__header">
          {{ tx('agent.groupPersonality', 'Personality') }}
        </view>
        <view class="nx-group__body">
          <view class="nx-row nx-row--tap" @click="openEditor('systemPrompt')">
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agent.roleDescription') }}
              </view>
              <text class="agent-preview" :class="{ 'agent-preview--empty': !previewText(formData.systemPrompt) }">
                {{ previewText(formData.systemPrompt) || t('agent.inputRoleDescription') }}
              </text>
            </view>
            <wd-icon name="arrow-right" size="14px" custom-class="nx-row__chevron" />
          </view>
          <view
            class="nx-row"
            :class="{ 'nx-row--tap': !isMemoryDisabled, 'agent-row--disabled': isMemoryDisabled }"
            @click="openEditor('summaryMemory')"
          >
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agent.historyMemory') }}
              </view>
              <text class="agent-preview" :class="{ 'agent-preview--empty': !previewText(formData.summaryMemory) }">
                {{ previewText(formData.summaryMemory) || t('agent.memoryContent') }}
              </text>
            </view>
            <wd-icon v-if="!isMemoryDisabled" name="arrow-right" size="14px" custom-class="nx-row__chevron" />
          </view>
        </view>
        <view v-if="isMemoryDisabled" class="nx-group__footer">
          {{ tx('agent.memoryReadOnlyHint', 'Memory can be edited when the memory model is set to local short-term memory.') }}
        </view>
      </view>

      <!-- Voice -->
      <view class="nx-group">
        <view class="nx-group__header">
          {{ t('agent.voiceSettings') }}
        </view>
        <view class="nx-group__body">
          <view class="nx-row nx-row--tap" @click="openPicker('tts')">
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agent.tts') }}
              </view>
            </view>
            <text class="nx-row__value nx-truncate">
              {{ displayNames.tts }}
            </text>
            <wd-icon name="arrow-right" size="14px" custom-class="nx-row__chevron" />
          </view>
          <view class="nx-row nx-row--tap" @click="openPicker('language')">
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agent.language') }}
              </view>
            </view>
            <text class="nx-row__value nx-truncate">
              {{ displayNames.language || '—' }}
            </text>
            <wd-icon name="arrow-right" size="14px" custom-class="nx-row__chevron" />
          </view>
          <view class="nx-row nx-row--tap" @click="openPicker('voiceprint')">
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agent.voiceprint') }}
              </view>
            </view>
            <text class="nx-row__value nx-truncate">
              {{ displayNames.voiceprint }}
            </text>
            <view
              v-if="currentVoiceOption && hasVoicePreview(currentVoiceOption)"
              class="agent-play"
              :class="{ 'is-playing': playingVoiceId === currentVoiceOption.value }"
              role="button"
              :aria-label="t('agent.playDemo')"
              @click.stop="playAudio(currentVoiceOption, $event)"
            >
              <wd-icon :name="playingVoiceId === currentVoiceOption.value ? 'pause-circle' : 'play-circle'" size="22px" />
            </view>
            <wd-icon name="arrow-right" size="14px" custom-class="nx-row__chevron" />
          </view>
          <view class="nx-row nx-row--tap" @click="handleRegulate">
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agent.languageConfig') }}
              </view>
            </view>
            <text class="nx-row__value nx-num">
              {{ speedPitchSummary }}
            </text>
            <wd-icon name="arrow-right" size="14px" custom-class="nx-row__chevron" />
          </view>
        </view>
        <view v-if="ttsOptionsLoading" class="nx-group__footer">
          {{ t('common.loading') }}
        </view>
      </view>

      <!-- Models -->
      <view class="nx-group">
        <view class="nx-group__header">
          {{ t('agent.modelConfig') }}
        </view>
        <view class="nx-group__body">
          <template v-for="row in modelRows" :key="row.key">
            <view v-show="row.show" class="nx-row nx-row--tap" @click="openPicker(row.key)">
              <view class="nx-row__main">
                <view class="nx-row__title nx-truncate">
                  {{ row.label }}
                </view>
              </view>
              <text class="nx-row__value nx-truncate">
                {{ row.value }}
              </text>
              <wd-icon name="arrow-right" size="14px" custom-class="nx-row__chevron" />
            </view>
          </template>
        </view>
      </view>

      <!-- Capabilities -->
      <view class="nx-group">
        <view class="nx-group__header">
          {{ tx('agent.groupCapabilities', 'Capabilities') }}
        </view>
        <view class="nx-group__body">
          <view class="nx-row nx-row--tap" @click="handleTools">
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agent.plugins') }}
              </view>
            </view>
            <text class="nx-row__value nx-num">
              {{ tx('agent.toolsEnabledCount', '{count} on', { count: toolCount }) }}
            </text>
            <wd-icon name="arrow-right" size="14px" custom-class="nx-row__chevron" />
          </view>
          <view class="nx-row nx-row--tap" @click="openContextProviderDialog">
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agent.contextProvider') }}
              </view>
              <view class="nx-row__subtitle">
                {{ t('agent.contextProviderSuccess', { count: providerStore.providers.length }) }}
              </view>
            </view>
            <wd-icon name="arrow-right" size="14px" custom-class="nx-row__chevron" />
          </view>
        </view>
        <view class="nx-group__footer">
          <a class="agent-link" href="https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/docs/context-provider-integration.md" target="_blank">
            {{ t('agent.contextProviderDocLink') }}
          </a>
        </view>
      </view>

      <!-- Versions -->
      <view class="nx-group">
        <view class="nx-group__header">
          {{ tx('agent.groupVersions', 'Versions') }}
        </view>
        <view class="nx-group__body">
          <view
            class="nx-row nx-row--tap"
            :class="{ 'agent-row--disabled': saving || snapshotReloadBlocked }"
            :disabled="saving || snapshotReloadBlocked"
            role="button"
            :aria-disabled="saving || snapshotReloadBlocked"
            @click="openSnapshotPanel"
          >
            <view class="nx-icon-tile nx-icon-tile--neutral agent-row-icon">
              <wd-icon name="time" size="18px" />
            </view>
            <view class="nx-row__main">
              <view class="nx-row__title">
                {{ t('agentSnapshot.title') }}
              </view>
            </view>
            <text v-if="currentVersionNo" class="nx-row__value nx-num">
              #{{ currentVersionNo }}
            </text>
            <wd-icon name="arrow-right" size="14px" custom-class="nx-row__chevron" />
          </view>
        </view>
      </view>
    </template>

    <!-- Save: pinned when there is something to save -->
    <view v-if="showActionBar" class="nx-action-bar">
      <wd-button
        type="primary"
        block
        size="large"
        :loading="saving"
        :disabled="saving || ttsOptionsLoading || snapshotReloadBlocked"
        custom-class="agent-save-btn"
        @click="saveAgent"
      >
        {{ saving ? t('agent.saving') : t('agent.save') }}
      </wd-button>
    </view>

    <!-- List picker (models, language, report mode) -->
    <wd-popup
      v-model="pickerSheetVisible"
      position="bottom"
      custom-class="nx-sheet"
      safe-area-inset-bottom
    >
      <view class="nx-sheet__inner">
        <view class="nx-sheet__handle" />
        <view class="nx-sheet__header">
          <text class="nx-headline nx-truncate">
            {{ pickerTitle }}
          </text>
        </view>
        <scroll-view scroll-y class="nx-sheet__scroll">
          <view v-if="!pickerActions.length" class="nx-empty agent-sheet-empty">
            <text class="nx-empty__text">
              {{ tx('agent.noOptions', 'Nothing to choose from yet.') }}
            </text>
          </view>
          <view v-else class="nx-group__body">
            <view
              v-for="item in pickerActions"
              :key="String(item.value)"
              class="nx-row nx-row--tap"
              @click="onPickerConfirm(activePicker, item.value, item.name)"
            >
              <view class="nx-row__main">
                <view class="nx-row__title nx-break">
                  {{ item.name }}
                </view>
              </view>
              <wd-icon v-if="pickerCurrentValue === item.value" name="check" size="18px" custom-class="nx-check" />
            </view>
          </view>
        </scroll-view>
      </view>
    </wd-popup>

    <!-- Voice picker with previews -->
    <wd-popup
      v-model="pickerShow.voiceprint"
      position="bottom"
      custom-class="nx-sheet"
      safe-area-inset-bottom
      @close="onPickerCancel('voiceprint')"
    >
      <view class="nx-sheet__inner">
        <view class="nx-sheet__handle" />
        <view class="nx-sheet__header">
          <text class="nx-headline">
            {{ t('agent.voiceprint') }}
          </text>
        </view>
        <scroll-view scroll-y class="nx-sheet__scroll">
          <view v-if="!voiceOptions.length" class="nx-empty agent-sheet-empty">
            <text class="nx-empty__text">
              {{ tx('agent.noOptions', 'Nothing to choose from yet.') }}
            </text>
          </view>
          <view v-else class="nx-group__body">
            <view
              v-for="voice in voiceOptions"
              :key="voice.value"
              class="nx-row nx-row--tap"
              @click="onPickerConfirm('voiceprint', voice.value, voice.name)"
            >
              <view
                v-if="hasVoicePreview(voice)"
                class="agent-play"
                :class="{ 'is-playing': playingVoiceId === voice.value }"
                role="button"
                :aria-label="t('agent.playDemo')"
                @click.stop="playAudio(voice, $event)"
              >
                <wd-icon :name="playingVoiceId === voice.value ? 'pause-circle' : 'play-circle'" size="24px" />
              </view>
              <view class="nx-row__main">
                <view class="nx-row__title nx-truncate">
                  {{ voice.name }}
                </view>
              </view>
              <wd-icon v-if="formData.ttsVoiceId === voice.value" name="check" size="18px" custom-class="nx-check" />
            </view>
          </view>
        </scroll-view>
      </view>
    </wd-popup>

    <!-- Role template picker -->
    <wd-popup
      v-model="showTemplateSheet"
      position="bottom"
      custom-class="nx-sheet"
      safe-area-inset-bottom
    >
      <view class="nx-sheet__inner">
        <view class="nx-sheet__handle" />
        <view class="nx-sheet__header">
          <text class="nx-headline">
            {{ t('agent.roleMode') }}
          </text>
        </view>
        <scroll-view scroll-y class="nx-sheet__scroll">
          <view v-if="!roleTemplates.length" class="nx-empty agent-sheet-empty">
            <text class="nx-empty__text">
              {{ tx('agent.noOptions', 'Nothing to choose from yet.') }}
            </text>
          </view>
          <view v-else class="nx-group__body">
            <view
              v-for="template in roleTemplates"
              :key="template.id"
              class="nx-row nx-row--tap"
              @click="chooseTemplate(template.id)"
            >
              <view class="nx-row__main">
                <view class="nx-row__title nx-truncate">
                  {{ template.agentName }}
                </view>
              </view>
              <wd-icon v-if="selectedTemplateId === template.id" name="check" size="18px" custom-class="nx-check" />
            </view>
          </view>
        </scroll-view>
        <view class="nx-group__footer">
          {{ tx('agent.templateHint', 'A template fills in the prompt, voice and models. Review them before you save.') }}
        </view>
      </view>
    </wd-popup>

    <!-- Full-screen text editor -->
    <wd-popup
      v-model="editorVisible"
      position="bottom"
      custom-class="nx-sheet nx-sheet--full"
      safe-area-inset-bottom
    >
      <view class="agent-editor">
        <view class="agent-editor__bar">
          <text class="agent-editor__btn" role="button" @click="editorVisible = false">
            {{ t('common.cancel') }}
          </text>
          <text class="nx-headline nx-truncate agent-editor__title">
            {{ editorTitle }}
          </text>
          <text class="agent-editor__btn agent-editor__btn--primary" role="button" @click="applyEditor">
            {{ tx('agent.editorDone', 'Done') }}
          </text>
        </view>
        <view class="agent-editor__body">
          <textarea
            v-if="editorVisible"
            v-model="editorDraft"
            class="agent-editor__textarea"
            :maxlength="editorMaxLength"
            :placeholder="editorPlaceholder"
            placeholder-class="agent-placeholder"
            :auto-focus="true"
          />
        </view>
        <view v-if="editorField === 'systemPrompt'" class="nx-num agent-editor__count">
          {{ editorDraft.length }}/2000
        </view>
      </view>
    </wd-popup>

    <AgentSnapshotPanel
      v-model:visible="showSnapshotPanel"
      :agent-id="agentId"
      :current-version-no="currentVersionNo"
      :has-unsaved-changes="hasUnsavedChanges"
      :mutation-busy="saving || snapshotReloadBlocked"
      @restored="handleSnapshotRestored"
    />
  </view>
</template>

<style lang="scss" scoped>
.agent-edit {
  padding: var(--nx-space-4) var(--nx-gutter) calc(var(--nx-space-6) + env(safe-area-inset-bottom));
  &--with-bar {
    padding-bottom: calc(200rpx + env(safe-area-inset-bottom));
  }

  &__skel-title {
    width: 50%;
    height: 34rpx;
  }
  &__skel-line {
    width: 30%;
    height: 24rpx;
    margin-top: var(--nx-space-2);
  }
  &__skel-row {
    width: 100%;
    height: 28rpx;
  }
}

// Identity header card
.agent-hero {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  margin-bottom: var(--nx-space-5);

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 104rpx;
    height: 104rpx;
    border-radius: var(--nx-radius-lg);
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-title);
    font-weight: 700;
  }
  &__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  &__name {
    display: block;
    font-size: var(--nx-text-title);
    font-weight: 700;
    letter-spacing: -0.018em;
    color: var(--nx-text);
  }
  &__meta {
    margin-top: 4rpx;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
}

.agent-notice {
  display: flex;
  gap: var(--nx-space-2);
  margin-bottom: var(--nx-space-5);
  padding: var(--nx-space-3) var(--nx-space-4);
  border-radius: var(--nx-radius-lg);
  background: var(--nx-warning-soft);
  color: var(--nx-text);

  &__main {
    flex: 1;
    min-width: 0;
  }
  &__text {
    display: block;
    font-size: var(--nx-text-footnote);
    line-height: 1.5;
  }
  &__action {
    display: inline-flex;
    margin-top: var(--nx-space-2);
    padding: var(--nx-space-1) 0;
    color: var(--nx-accent);
    font-size: var(--nx-text-callout);
    font-weight: 600;
  }
}

:deep(.agent-notice__icon) {
  flex: none;
  margin-top: 2rpx;
  color: var(--nx-warning);
}

.agent-label {
  flex: none;
}

.agent-inline-input {
  flex: 1;
  min-width: 0;
  height: var(--nx-touch);
  text-align: right;
  font-size: var(--nx-text-body);
  color: var(--nx-text);
}

:deep(.agent-placeholder) {
  color: var(--nx-text-3);
}

.agent-tags-row {
  align-items: flex-start;
}

.agent-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--nx-space-2);
  margin-top: var(--nx-space-2);
}

.agent-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--nx-space-1);
  max-width: 100%;
  height: 56rpx;
  padding: 0 var(--nx-space-1) 0 var(--nx-space-3);
  box-sizing: border-box;
  border-radius: var(--nx-radius-pill);
  background: var(--nx-accent-soft);
  color: var(--nx-accent);
  font-size: var(--nx-text-footnote);
  font-weight: 500;

  &__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44rpx;
    height: 44rpx;
    border-radius: 50%;
    &:active {
      background: var(--nx-surface-2);
    }
  }
  &--add {
    padding: 0 var(--nx-space-3);
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    &:active {
      background: var(--nx-surface-3);
    }
  }
}

.agent-tag-input {
  flex: 1;
  min-width: 240rpx;
  height: 56rpx;
  padding: 0 var(--nx-space-3);
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface-2);
  font-size: var(--nx-text-footnote);
  color: var(--nx-text);
}

.agent-preview {
  display: -webkit-box;
  margin-top: 4rpx;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: var(--nx-text-footnote);
  line-height: 1.45;
  color: var(--nx-text-2);
  overflow-wrap: anywhere;
  &--empty {
    color: var(--nx-text-3);
  }
}

.agent-row--disabled {
  opacity: 0.55;
}

.agent-row-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--nx-radius-sm);
}

.agent-play {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 64rpx;
  height: 64rpx;
  color: var(--nx-text-3);
  &.is-playing {
    color: var(--nx-accent);
  }
  &:active {
    opacity: 0.6;
  }
}

.agent-link {
  color: var(--nx-accent);
  text-decoration: none;
}

:deep(.nx-row__chevron) {
  color: var(--nx-text-3);
}

:deep(.agent-save-btn) {
  border-radius: var(--nx-radius);
}

// Sheets
:deep(.wd-popup.nx-sheet) {
  overflow: hidden;
  border-radius: var(--nx-radius-xl) var(--nx-radius-xl) 0 0;
  background: var(--nx-bg);
}

:deep(.wd-popup.nx-sheet--full) {
  height: 92vh;
}

.nx-sheet {
  &__inner {
    padding: 0 var(--nx-gutter) var(--nx-space-4);
  }
  &__handle {
    width: 72rpx;
    height: 10rpx;
    margin: var(--nx-space-2) auto 0;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-3);
  }
  &__header {
    display: flex;
    align-items: center;
    min-height: var(--nx-touch);
    padding: var(--nx-space-2) 0;
  }
  &__scroll {
    max-height: 60vh;
    border-radius: var(--nx-radius-lg);
  }
}

.agent-sheet-empty {
  padding: var(--nx-space-6) var(--nx-space-4);
}

:deep(.nx-check) {
  flex: none;
  color: var(--nx-accent);
}

// Full-screen editor
.agent-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;

  &__bar {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    min-height: var(--nx-touch);
    padding: var(--nx-space-2) var(--nx-gutter);
    border-bottom: 1rpx solid var(--nx-border);
  }
  &__title {
    flex: 1;
    min-width: 0;
    text-align: center;
  }
  &__btn {
    flex: none;
    min-width: 120rpx;
    padding: var(--nx-space-2) 0;
    color: var(--nx-accent);
    font-size: var(--nx-text-body);
    &--primary {
      text-align: right;
      font-weight: 600;
    }
    &:active {
      opacity: 0.6;
    }
  }
  &__body {
    flex: 1;
    min-height: 0;
    margin: var(--nx-space-4) var(--nx-gutter) 0;
    padding: var(--nx-space-4);
    border-radius: var(--nx-radius-lg);
    background: var(--nx-surface);
    box-shadow: var(--nx-shadow-1);
  }
  &__textarea {
    width: 100%;
    height: 100%;
    font-size: var(--nx-text-body);
    line-height: 1.6;
    color: var(--nx-text);
  }
  &__count {
    padding: var(--nx-space-2) var(--nx-gutter) var(--nx-space-4);
    text-align: right;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
}
</style>
