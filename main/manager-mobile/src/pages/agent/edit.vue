<!-- Character and voice: who TinyBot is when it talks (owner: m-agent). Opened as a page
     (?agentId=, or this robot's character) and embedded by pages/agent/index.vue (prop agentId). -->
<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Character",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import type { AgentDetail, ModelOption, PluginDefinition, RoleTemplate, TtsVoice } from '@/api/agent/types'
import { onLoad } from '@dcloudio/uni-app'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { getAgentDetail, getAgentTags, getAllLanguage, getModelOptions, getPluginFunctions, getRoleTemplates, getVoiceCloneAudioId, updateAgent } from '@/api/agent/agent'
import { getCurrentLanguage, t } from '@/i18n'
import { usePluginStore, useProvider, useSpeedPitch } from '@/store'
import { getEnvBaseUrl } from '@/utils'
import { digits } from '@/utils/calendar.mjs'
import { notifyRequestError } from '@/utils/requestError'
import { loadRobots, robot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'
import {
  applyMemoryChoice,
  firstLine,
  LOCAL_SHORT_MEMORY,
  localeName,
  NO_MEMORY,
  normalizeAgentFunctions,
  pluginCatalog,
  previewText,
  PROMPT_MAX,
  PROMPT_NEAR,
  signed,
  stableSerialize,
  tuningSummary,
} from './agentModel.mjs'
import AgentRow from './components/AgentRow.vue'
import AgentSnapshotPanel from './components/AgentSnapshotPanel.vue'
import { filterTtsVoicesByLanguage, hasUsableTtsVoiceMetadata } from './components/agentSnapshotUtils.mjs'
import { createVoicePreviewRequestGate, hasVoicePreview, resolveVoicePreviewUrl } from './components/voicePreviewUtils.mjs'

defineOptions({
  name: 'AgentEdit',
})

const props = withDefaults(defineProps<Props>(), {
  agentId: '',
  embedded: false,
})

// Component props
interface Props {
  agentId?: string
  embedded?: boolean
}

// As a page the id comes from ?agentId=, else it is this robot's character.
const queryAgentId = ref('')
onLoad((q: any) => {
  if (q?.agentId)
    queryAgentId.value = decodeURIComponent(String(q.agentId))
})
const agentId = computed(() => props.agentId || queryAgentId.value || robot.agentId || '')

const lang = computed(() => getCurrentLanguage())
const num = (n: any) => digits(n ?? '', lang.value)

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
const displayNames = ref<Record<string, string>>({
  vad: '',
  asr: '',
  llm: '',
  slm: '',
  vllm: '',
  intent: '',
  memory: '',
  tts: '',
  voiceprint: '',
  report: '',
  language: '',
})

// Role template data
const roleTemplates = ref<RoleTemplate[]>([])
const selectedTemplateId = ref('')

// Loading status
const loading = ref(false)
const loadFailed = ref(false)
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
const reportOptions = computed(() => [
  { name: t('mAgent.think.historyText'), value: 1 },
  { name: t('mAgent.think.historyVoice'), value: 2 },
])

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
const dynamicTags = ref<any[]>([])
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
  if (inputValue.value.trim()) {
    dynamicTags.value.push({ id: new Date().getTime(), tagName: inputValue.value.trim() })
    inputValue.value = ''
  }
  inputVisible.value = false
}

// Whether to disable memory history input
const isMemoryDisabled = computed(() => formData.value.memModelId !== LOCAL_SHORT_MEMORY)

// Open context provider edit screen
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
    loadFailed.value = false
    await enhanceAgentDetailMetadata(detail, targetAgentId, requestId)
    return isActiveAgentDetailRequest(targetAgentId, requestId)
  }
  catch (error) {
    if (isActiveAgentDetailRequest(targetAgentId, requestId)) {
      console.error('Failed to load agent details:', error)
      loadFailed.value = true
      notifyRequestError(error, 'mAgent.loadFailed')
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
  updateDisplayNames()
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
    return ''

  // Try matching ID directly from voice options
  const voice = voiceOptions.value.find(v => v.id === ttsVoiceId)
  if (voice) {
    return voice.name
  }

  // Older agents store voice1..voice5: map them to the list order
  if (voiceOptions.value.length > 0) {
    const indexMap: Record<string, number> = {
      voice1: 0,
      voice2: 1,
      voice3: 2,
      voice4: 3,
      voice5: 4,
    }

    const index = indexMap[ttsVoiceId]
    if (index !== undefined && voiceOptions.value[index]) {
      return voiceOptions.value[index].name
    }
  }

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

  displayNames.value.report = reportOptions.value.find(item => item.value === formData.value.chatHistoryConf)?.name || ''

  isVisibleReport.value = formData.value.memModelId !== NO_MEMORY
}

// Load role templates
async function loadRoleTemplates() {
  try {
    const templates = await getRoleTemplates()
    roleTemplates.value = templates || []
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
      modelTypes.map(async (type) => {
        const options = await getModelOptions(type)
        modelOptions.value[type] = options || []
      }),
    )
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

  voiceOptions.value = filteredVoices.map((voice: any) => ({
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
    && filteredVoices.some((voice: any) => voice.id === formData.value.ttsVoiceId)

  if (!currentVoiceSupportsLanguage && options.autoSelectVoice) {
    formData.value.ttsVoiceId = filteredVoices.length > 0 ? filteredVoices[0].id : ''
    displayNames.value.voiceprint = filteredVoices.length > 0 ? filteredVoices[0].name : ''
    ttsVoiceTouched.value = true
  }
  else {
    displayNames.value.voiceprint = filteredVoices.find((item: any) => item.id === formData.value.ttsVoiceId)?.name
      || getVoiceDisplayName(formData.value.ttsVoiceId || '')
  }
}

function getVoiceDefaultLanguage(ttsVoiceId: string) {
  if (!ttsVoiceId || !voiceDetails.value?.[ttsVoiceId]?.languages) {
    return ''
  }
  const languages = String(voiceDetails.value[ttsVoiceId].languages)
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
    const allLanguages = new Set<string>()
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
    else if (getVoiceDefaultLanguage(formData.value.ttsVoiceId || '')) {
      selectedTtsLanguage.value = getVoiceDefaultLanguage(formData.value.ttsVoiceId || '')
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
  const template = roleTemplates.value.find(item => item.id === templateId)
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
      const result = await fetchAllLanguag(template.ttsModelId || formData.value.ttsModelId || '', {
        autoSelectVoice: true,
        preferredLanguage: hasTemplateTtsLanguage ? templateTtsLanguage : '',
        preferredVoiceId: template.ttsVoiceId,
      })
      if (result === 'failed') {
        restoreTtsSelectionState(previousTtsState)
        toast.warning(t('mAgent.voice.loadFailed'))
      }
      else if (result === 'loaded') {
        ttsLanguageTouched.value = true
        ttsVoiceTouched.value = true
      }
    }
    updateDisplayNames()
    toast.info(t('mAgent.who.templateApplied', { name: template.agentName }))
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
      break
    case 'memory': {
      const next = applyMemoryChoice(formData.value, value, tempSummaryMemory.value)
      formData.value = next.form
      tempSummaryMemory.value = next.stash
      displayNames.value.report = reportOptions.value[1].name
      isVisibleReport.value = value !== NO_MEMORY
      break
    }
    case 'tts': {
      const preferredLanguage = selectedTtsLanguage.value
      formData.value.ttsModelId = value
      formData.value.ttsVoiceId = ''
      pickerShow.value[type] = false
      const result = await fetchAllLanguag(value, { autoSelectVoice: true, preferredLanguage })
      if (result === 'failed' && previousTtsState) {
        restoreTtsSelectionState(previousTtsState)
        toast.warning(t('mAgent.voice.loadFailed'))
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
async function playAudio(voice: VoiceOption) {
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
      id: voice.value || voice.id || '',
      isClone: voice.isClone,
      voiceDemo: voice.voiceDemo || voice.voice_demo,
      ttsVoice: voice.ttsVoice || (voiceDetails.value[voice.value] as (TtsVoice & { ttsVoice?: string | null }) | undefined)?.ttsVoice,
    }, getVoiceCloneAudioId as any, getEnvBaseUrl())

    // User may cancel or switch while waiting for temporary URL.
    if (!voicePreviewRequestGate.isCurrent(requestId) || playingVoiceId.value !== voice.value) {
      return
    }
    if (!audioUrl) {
      toast.error(t('mAgent.voice.sampleMissing'))
      playingVoiceId.value = ''
      return
    }

    const audio = uni.createInnerAudioContext()
    audioRef.value = audio
    audio.src = audioUrl

    audio.onEnded(() => {
      if (
        voicePreviewRequestGate.isCurrent(requestId)
        && audioRef.value === audio
        && playingVoiceId.value === voice.value
      ) {
        playingVoiceId.value = ''
      }
    })

    audio.onError(() => {
      if (
        voicePreviewRequestGate.isCurrent(requestId)
        && audioRef.value === audio
        && playingVoiceId.value === voice.value
      ) {
        toast.error(t('mAgent.voice.sampleFailed'))
        playingVoiceId.value = ''
      }
    })

    audio.play()
  }
  catch (error) {
    if (!voicePreviewRequestGate.isCurrent(requestId) || playingVoiceId.value !== voice.value) {
      return
    }
    console.error('Failed to get cloned voice preview URL:', error)
    toast.error(t('mAgent.voice.sampleMissing'))
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
function getModelDisplayName(modelType: string, modelId?: string) {
  if (!modelId)
    return ''

  const options = modelOptions.value[modelType]
  if (!options || options.length === 0) {
    return modelId
  }

  const option = options.find(opt => opt.id === modelId)
  return option ? option.modelName : modelId
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
    toast.warning(t('mAgent.voice.loadFailed'))
    return
  }
  if (!formData.value.agentName?.trim()) {
    toast.warning(t('mAgent.who.nameMissing'))
    return
  }

  if (!formData.value.systemPrompt?.trim()) {
    toast.warning(t('mAgent.who.promptMissing'))
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

    toast.success(t('mAgent.save.done'))
  }
  catch (error) {
    console.error('Failed to save:', error)
    notifyRequestError(error, 'mAgent.save.failed')
  }
  finally {
    saving.value = false
  }
}

function loadPluginFunctions() {
  return getPluginFunctions().then((res) => {
    const processedFunctions = pluginCatalog(res || [])
    allFunctions.value = processedFunctions
    // Also update to store
    pluginStore.setAllFunctions(processedFunctions)
  }).catch((error) => {
    console.warn('Failed to load plugin list:', error)
  })
}

function handleTools() {
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
    loadFailed.value = false
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
      if (!originalAgentDetail.value)
        loadFailed.value = true
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

// The first load failed: try the whole page again
function retryLoad() {
  loadFailed.value = false
  if (snapshotReloadBlocked.value)
    void reloadAgentAfterSnapshotRestore(agentId.value)
  else
    void Promise.all([loadAgentTags(), loadAgentDetail()])
}

// Watch plugin config changes in store
watch(() => pluginStore.currentFunctions, (newFunctions) => {
  formData.value.functions = normalizeAgentFunctions(newFunctions || []) as any
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
  loadFailed.value = false
  snapshotReloadFailed.value = false
  snapshotReloadBlocked.value = Boolean(currentAgentId)
  originalAgentDetail.value = null
  originalTagNames.value = []
  if (currentAgentId) {
    void reloadAgentAfterSnapshotRestore(currentAgentId)
  }
}, { flush: 'sync' })

// The voice sheet closing (any way) stops a sample that is playing
watch(() => pickerShow.value.voiceprint, (open) => {
  if (!open)
    stopAudio()
})

// ---- Display helpers ----

type PickerKey = 'vad' | 'asr' | 'llm' | 'slm' | 'vllm' | 'intent' | 'memory' | 'tts' | 'language' | 'report'

const PICKER_TITLE_KEYS: Record<PickerKey, string> = {
  vad: 'mAgent.think.vad',
  asr: 'mAgent.think.asr',
  llm: 'mAgent.think.llm',
  slm: 'mAgent.think.slm',
  vllm: 'mAgent.think.vllm',
  intent: 'mAgent.think.intent',
  memory: 'mAgent.think.memory',
  tts: 'mAgent.voice.engine',
  language: 'mAgent.voice.language',
  report: 'mAgent.think.history',
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
    case 'report': return reportOptions.value
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
  { key: 'llm', label: t('mAgent.think.llm'), hint: t('mAgent.think.llmHint'), value: displayNames.value.llm, show: true },
  { key: 'slm', label: t('mAgent.think.slm'), hint: t('mAgent.think.slmHint'), value: displayNames.value.slm, show: true },
  { key: 'vllm', label: t('mAgent.think.vllm'), hint: t('mAgent.think.vllmHint'), value: displayNames.value.vllm, show: true },
  { key: 'asr', label: t('mAgent.think.asr'), hint: t('mAgent.think.asrHint'), value: displayNames.value.asr, show: true },
  { key: 'vad', label: t('mAgent.think.vad'), hint: t('mAgent.think.vadHint'), value: displayNames.value.vad, show: true },
  { key: 'intent', label: t('mAgent.think.intent'), hint: t('mAgent.think.intentHint'), value: displayNames.value.intent, show: true },
  { key: 'memory', label: t('mAgent.think.memory'), hint: t('mAgent.think.memoryHint'), value: displayNames.value.memory, show: true },
  { key: 'report', label: t('mAgent.think.history'), hint: t('mAgent.think.historyHint'), value: displayNames.value.report, show: isVisibleReport.value },
])

const selectedTemplateName = computed(() => {
  return roleTemplates.value.find(item => item.id === selectedTemplateId.value)?.agentName || ''
})

const showTemplateSheet = ref(false)

function chooseTemplate(templateId: string) {
  showTemplateSheet.value = false
  void selectRoleTemplate(templateId)
}

const toolCount = computed(() => (formData.value.functions || []).length)

// Only the values moved off 0, each with its name: "গতি +১০"
const TUNING_LABELS = [['ttsRate', 'mAgent.tune.rate'], ['ttsPitch', 'mAgent.tune.pitch'], ['ttsVolume', 'mAgent.tune.volume']] as const
const speedPitchSummary = computed(() => {
  if (!tuningSummary(speedPitchStore.speedPitch))
    return t('mAgent.voice.tuningNormal')
  return TUNING_LABELS
    .filter(([key]) => Number(speedPitchStore.speedPitch[key]) !== 0)
    .map(([key, label]) => `${t(label)} ${num(signed(speedPitchStore.speedPitch[key]))}`)
    .join(', ')
})

const showActionBar = computed(() => hasUnsavedChanges.value || saving.value || snapshotReloadBlocked.value)

const syncState = computed(() => (hasUnsavedChanges.value ? 'pending' : 'applied'))
const syncText = computed(() => {
  if (hasUnsavedChanges.value)
    return t('mAgent.state.unsaved')
  return currentVersionNo.value ? t('mAgent.state.savedVersion', { n: num(currentVersionNo.value) }) : t('mAgent.state.saved')
})

// Text editor sheet for the prompt and the memory summary
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

const editorTitle = computed(() => editorField.value === 'summaryMemory' ? t('mAgent.think.summary') : t('mAgent.who.prompt'))
const editorHint = computed(() => editorField.value === 'summaryMemory' ? t('mAgent.think.summaryHint') : t('mAgent.who.promptHint'))
const editorPlaceholder = computed(() => editorField.value === 'summaryMemory' ? t('mAgent.think.summaryEmpty') : t('mAgent.who.promptPlaceholder'))
const editorMaxLength = computed(() => editorField.value === 'systemPrompt' ? PROMPT_MAX : -1)
const editorCount = computed(() => {
  const n = editorDraft.value.length
  return n >= PROMPT_NEAR
    ? t('mAgent.who.nearLimit', { n: num(PROMPT_MAX - n) })
    : `${num(n)} / ${num(PROMPT_MAX)}`
})

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

function goRobots() { uni.navigateTo({ url: '/pages/robots/index' }) }

onMounted(async () => {
  if (!agentId.value && !robot.loaded)
    await loadRobots()

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
  else {
    updateDisplayNames()
  }
})

onUnmounted(stopAudio)
</script>

<template>
  <view class="ag" :class="{ 'tb-wrap': !embedded, 'is-embedded': embedded, 'has-bar': showActionBar }">
    <tb-page-header v-if="!embedded" :title="t('nav.character')" :description="t('mAgent.lead')" back />

    <!-- No robot yet -->
    <view v-if="!agentId && robot.loaded" class="ag__state">
      <tb-empty face="confused" :title="t('common.noRobot')" :text="t('common.noRobotText')">
        <tb-button variant="primary" icon="robots" @click="goRobots">
          {{ t('common.goRobots') }}
        </tb-button>
      </tb-empty>
    </view>

    <!-- First load failed -->
    <view v-else-if="loadFailed && !originalAgentDetail" class="ag__state">
      <tb-empty face="confused" :title="t('mAgent.loadFailed')" :text="t('common.loadFailed')">
        <tb-button icon="refresh" @click="retryLoad">
          {{ t('common.retry') }}
        </tb-button>
      </tb-empty>
    </view>

    <!-- First load -->
    <view v-else-if="!originalAgentDetail" class="ag__state">
      <tb-loading :label="t('mAgent.loading')" />
    </view>

    <block v-else>
      <view class="ag__status">
        <tb-sync :state="syncState" :text="syncText" />
        <tb-loading v-if="loading" />
      </view>

      <!-- Restore reload notice -->
      <view v-if="snapshotReloadBlocked" class="ag__notice" role="alert">
        <tb-icon name="warning" :size="18" />
        <view class="ag__notice-main">
          <text>{{ t(snapshotReloadFailed ? 'agentSnapshot.reloadAfterRestoreFailed' : 'agentSnapshot.reloadAfterRestorePending') }}</text>
          <tb-button v-if="snapshotReloadFailed" size="s" icon="refresh" @click="retrySnapshotReload">
            {{ t('agentSnapshot.retryReload') }}
          </tb-button>
        </view>
      </view>

      <!-- Who it is -->
      <tb-section :title="t('mAgent.who.title')" :description="t('mAgent.who.desc')">
        <view class="ag-field">
          <text class="ag-field__label">
            {{ t('mAgent.who.name') }}
          </text>
          <tb-input v-model="formData.agentName" :maxlength="64" :placeholder="t('mAgent.who.namePlaceholder')" :aria-label="t('mAgent.who.name')" />
        </view>

        <view class="ag-field">
          <text class="ag-field__label">
            {{ t('mAgent.who.tags') }}
          </text>
          <view class="ag-tags">
            <view v-for="tag in dynamicTags" :key="tag.id" class="ag-tag">
              <text class="ag-tag__name">
                {{ tag.tagName }}
              </text>
              <view class="ag-tag__x" role="button" :aria-label="t('mAgent.who.removeTag', { name: tag.tagName })" @click="handleCloseTag(tag.id)">
                <tb-icon name="close" :size="14" />
              </view>
            </view>
            <tb-button v-if="!inputVisible" size="s" icon="plus" @click="showInput">
              {{ t('mAgent.who.addTag') }}
            </tb-button>
          </view>
          <view v-if="inputVisible" class="ag-tags__new">
            <tb-input
              v-model="inputValue" class="ag-tags__in" :maxlength="20" :placeholder="t('mAgent.who.tagInput')"
              :aria-label="t('mAgent.who.tagInput')" @confirm="handleInputConfirm"
            />
            <tb-button size="m" @click="handleInputConfirm">
              {{ t('common.add') }}
            </tb-button>
          </view>
        </view>

        <view class="ag-rows">
          <AgentRow
            :label="t('mAgent.who.prompt')" preview :placeholder="!previewText(formData.systemPrompt)"
            :value="previewText(formData.systemPrompt) || t('mAgent.who.promptEmpty')" @click="openEditor('systemPrompt')"
          />
          <AgentRow
            :label="t('mAgent.who.template')" :hint="t('mAgent.who.templateRowHint')"
            :value="selectedTemplateName || t('mAgent.who.templateNone')" :placeholder="!selectedTemplateName" @click="showTemplateSheet = true"
          />
        </view>
      </tb-section>

      <!-- Voice and language -->
      <tb-section :title="t('mAgent.voice.title')" :description="t('mAgent.voice.desc')">
        <view class="ag-rows">
          <AgentRow
            :label="t('mAgent.voice.engine')" :value="displayNames.tts || t('mAgent.choose')" :placeholder="!displayNames.tts"
            :disabled="ttsOptionsLoading" @click="openPicker('tts')"
          />
          <AgentRow
            :label="t('mAgent.voice.language')" :hint="t('mAgent.voice.languageHint')" :value="localeName(displayNames.language) || t('mAgent.choose')"
            :placeholder="!displayNames.language" :disabled="ttsOptionsLoading" @click="openPicker('language')"
          />
          <AgentRow
            :label="t('mAgent.voice.voice')" :value="displayNames.voiceprint || t('mAgent.choose')" :placeholder="!displayNames.voiceprint"
            :disabled="ttsOptionsLoading" @click="openPicker('voiceprint')"
          >
            <view v-if="currentVoiceOption && hasVoicePreview(currentVoiceOption)" class="ag-play" @click.stop>
              <tb-button
                size="s" variant="quiet" :icon="playingVoiceId === currentVoiceOption.value ? 'pause' : 'play'"
                :aria-label="playingVoiceId === currentVoiceOption.value ? t('mAgent.voice.pause') : t('mAgent.voice.play')"
                @click="playAudio(currentVoiceOption)"
              />
            </view>
          </AgentRow>
          <AgentRow :label="t('mAgent.voice.tuning')" :value="speedPitchSummary" @click="handleRegulate" />
        </view>
        <tb-loading v-if="ttsOptionsLoading" :label="t('mAgent.voice.loading')" />
      </tb-section>

      <!-- How it thinks -->
      <tb-section :title="t('mAgent.think.title')" :description="t('mAgent.think.desc')">
        <view class="ag-rows">
          <block v-for="row in modelRows" :key="row.key">
            <AgentRow
              v-if="row.show" :label="row.label" :hint="row.hint" :value="row.value || t('mAgent.choose')" :placeholder="!row.value"
              @click="openPicker(row.key)"
            />
          </block>
          <AgentRow
            :label="t('mAgent.think.summary')" preview :disabled="isMemoryDisabled"
            :placeholder="!previewText(formData.summaryMemory)"
            :value="previewText(formData.summaryMemory) || t('mAgent.think.summaryEmpty')"
            :hint="isMemoryDisabled ? t('mAgent.think.summaryLocked') : ''" @click="openEditor('summaryMemory')"
          />
        </view>
      </tb-section>

      <!-- What it can do -->
      <tb-section :title="t('mAgent.can.title')" :description="t('mAgent.can.desc')">
        <view class="ag-rows">
          <AgentRow
            :label="t('mAgent.can.tools')" :hint="t('mAgent.can.toolsHint')"
            :value="toolCount ? t('mAgent.can.toolsOn', { n: num(toolCount) }) : t('mAgent.can.toolsNone')" @click="handleTools"
          />
          <AgentRow
            :label="t('mAgent.can.context')" :hint="t('mAgent.can.contextHint')"
            :value="providerStore.providers.length ? t('mAgent.can.contextCount', { n: num(providerStore.providers.length) }) : t('mAgent.can.contextNone')"
            @click="openContextProviderDialog"
          />
        </view>
        <text class="ag-help">
          {{ t('mAgent.sources.help') }}
        </text>
      </tb-section>

      <!-- History -->
      <tb-section :title="t('mAgent.history.title')" :description="t('mAgent.history.desc')">
        <view class="ag-rows">
          <AgentRow
            :label="t('mAgent.history.versions')"
            :value="currentVersionNo ? t('mAgent.history.current', { n: num(currentVersionNo) }) : t('mAgent.history.none')"
            :disabled="saving || snapshotReloadBlocked"
            @click="openSnapshotPanel"
          />
        </view>
      </tb-section>
    </block>

    <!-- Save: pinned when there is something to save -->
    <view v-if="showActionBar" class="ag-bar" :class="{ 'is-embedded': embedded }" role="region" :aria-label="t('mAgent.state.unsaved')">
      <view class="ag-bar__text">
        <text class="ag-bar__title">
          {{ snapshotReloadBlocked ? t('mAgent.save.waiting') : t('mAgent.state.unsaved') }}
        </text>
        <text class="ag-bar__hint">
          {{ t('mAgent.save.restart') }}
        </text>
      </view>
      <tb-button
        variant="primary"
        size="l"
        :loading="saving"
        :disabled="saving || ttsOptionsLoading || snapshotReloadBlocked"
        @click="saveAgent"
      >
        {{ t('common.save') }}
      </tb-button>
    </view>

    <!-- List picker (models, language, chat history) -->
    <tb-sheet v-model:open="pickerSheetVisible" :title="pickerTitle">
      <tb-empty v-if="!pickerActions.length" :text="t('mAgent.sheet.noOptions')" />
      <view v-else class="ag-opts" role="radiogroup" :aria-label="pickerTitle">
        <view
          v-for="item in pickerActions" :key="String(item.value)" class="ag-opt" :class="{ 'is-on': pickerCurrentValue === item.value }"
          role="radio" :aria-checked="pickerCurrentValue === item.value ? 'true' : 'false'" hover-class="is-press"
          @click="onPickerConfirm(activePicker, item.value, item.name)"
        >
          <text class="ag-opt__name">
            {{ activePicker === 'language' ? localeName(item.name) : item.name }}
          </text>
          <tb-icon v-if="pickerCurrentValue === item.value" name="check" :size="20" />
        </view>
      </view>
    </tb-sheet>

    <!-- Voice picker with samples -->
    <tb-sheet v-model:open="pickerShow.voiceprint" :title="t('mAgent.voice.voice')">
      <text v-if="displayNames.language" class="ag-sheet-note">
        {{ t('mAgent.voice.onlyLanguage', { lang: localeName(displayNames.language) }) }}
      </text>
      <tb-empty v-if="!voiceOptions.length" :text="t('mAgent.sheet.noOptions')" />
      <view v-else class="ag-opts" role="radiogroup" :aria-label="t('mAgent.voice.voice')">
        <view
          v-for="voice in voiceOptions" :key="voice.value" class="ag-opt" :class="{ 'is-on': formData.ttsVoiceId === voice.value }"
          role="radio" :aria-checked="formData.ttsVoiceId === voice.value ? 'true' : 'false'" hover-class="is-press"
          @click="onPickerConfirm('voiceprint', voice.value, voice.name)"
        >
          <view v-if="hasVoicePreview(voice)" class="ag-play" @click.stop>
            <tb-button
              size="s" :icon="playingVoiceId === voice.value ? 'pause' : 'play'"
              :aria-label="playingVoiceId === voice.value ? t('mAgent.voice.pause') : t('mAgent.voice.play')" @click="playAudio(voice)"
            />
          </view>
          <text class="ag-opt__name">
            {{ voice.name }}
          </text>
          <tb-icon v-if="formData.ttsVoiceId === voice.value" name="check" :size="20" />
        </view>
      </view>
    </tb-sheet>

    <!-- Role template picker -->
    <tb-sheet v-model:open="showTemplateSheet" :title="t('mAgent.who.template')">
      <text class="ag-sheet-note">
        {{ t('mAgent.who.templateHint') }}
      </text>
      <tb-empty v-if="!roleTemplates.length" :text="t('mAgent.sheet.noOptions')" />
      <view v-else class="ag-opts">
        <view
          v-for="template in roleTemplates" :key="template.id" class="ag-opt" :class="{ 'is-on': selectedTemplateId === template.id }"
          role="button" hover-class="is-press" @click="chooseTemplate(template.id)"
        >
          <view class="ag-opt__text">
            <text class="ag-opt__name">
              {{ template.agentName }}
            </text>
            <text class="ag-opt__sub">
              {{ firstLine(template.systemPrompt) || t('mAgent.who.templateNoPrompt') }}
            </text>
          </view>
          <tb-icon v-if="selectedTemplateId === template.id" name="check" :size="20" />
        </view>
      </view>
    </tb-sheet>

    <!-- Text editor -->
    <tb-sheet v-model:open="editorVisible" :title="editorTitle">
      <text class="ag-sheet-note">
        {{ editorHint }}
      </text>
      <textarea
        v-if="editorVisible"
        v-model="editorDraft"
        class="ag-editor"
        :maxlength="editorMaxLength"
        :placeholder="editorPlaceholder"
        placeholder-class="ag-editor__ph"
        :auto-height="false"
        :aria-label="editorTitle"
      />
      <text v-if="editorField === 'systemPrompt'" class="ag-editor__count tb-num" :class="{ 'is-near': editorDraft.length >= PROMPT_NEAR }">
        {{ editorCount }}
      </text>
      <template #footer>
        <tb-button @click="editorVisible = false">
          {{ t('common.cancel') }}
        </tb-button>
        <tb-button variant="primary" @click="applyEditor">
          {{ t('mAgent.editor.keep') }}
        </tb-button>
      </template>
    </tb-sheet>

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

<style lang="scss">
.ag {
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}
.ag.has-bar {
  padding-bottom: calc(132px + env(safe-area-inset-bottom));
}
.ag.is-embedded {
  padding-bottom: 24px;
}
.ag.is-embedded.has-bar {
  padding-bottom: 132px;
}
.ag__state {
  display: flex;
  justify-content: center;
  padding: 56px 0;
}
.ag__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  border-bottom: 1px solid var(--tb-rule);
}
.ag__notice {
  display: flex;
  gap: 10px;
  padding: 14px 0;
  color: var(--tb-warn);
  border-bottom: 1px solid var(--tb-rule);
}
.ag__notice-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  color: var(--tb-ink);
}

.ag-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ag-field__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.ag-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ag-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  min-height: 34px;
  padding-left: 12px;
  border: 1px solid var(--tb-ink-2);
  border-radius: 999px;
  font-size: 14px;
}
.ag-tag__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ag-tag__x {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-right: -6px;
  color: var(--tb-ink-2);
}
.ag-tags__new {
  display: flex;
  gap: 8px;
  align-items: center;
}
.ag-tags__in {
  flex: 1;
  min-width: 0;
}

.ag-rows {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule-soft);
}
.ag-play {
  flex: none;
  display: flex;
}
.ag-help {
  display: block;
  padding-top: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--tb-ink-2);
}

.ag-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px var(--tb-gutter) calc(12px + env(safe-area-inset-bottom));
  background: var(--tb-paper);
  border-top: 3px solid var(--tb-rule);
  animation: ag-rise var(--tb-t-sheet) var(--tb-ease);
}
.ag-bar__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ag-bar__title {
  font-weight: 700;
  font-size: 15px;
}
.ag-bar__hint {
  font-size: 12px;
  color: var(--tb-ink-2);
  line-height: 1.4;
}
@keyframes ag-rise {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.ag-sheet-note {
  font-size: 14px;
  color: var(--tb-ink-2);
}
.ag-opts {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule);
}
.ag-opt {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.ag-opt.is-press {
  background: var(--tb-paper-2);
}
.ag-opt__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ag-opt__name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  overflow-wrap: anywhere;
}
.ag-opt__sub {
  font-size: 13px;
  color: var(--tb-ink-2);
  overflow-wrap: anywhere;
}
.ag-opt.is-on .ag-opt__name {
  font-weight: 700;
}
.ag-opt.is-on .tb-icon {
  color: var(--tb-orange);
}

.ag-editor {
  width: 100%;
  height: 44vh;
  padding: 12px;
  box-sizing: border-box;
  font-size: 16px;
  line-height: 1.6;
  color: var(--tb-ink);
  background: var(--tb-paper);
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-m);
}
.ag-editor__ph {
  color: var(--tb-ink-3);
}
.ag-editor__count {
  align-self: flex-end;
  font-size: 13px;
  color: var(--tb-ink-2);
}
.ag-editor__count.is-near {
  color: var(--tb-danger);
  font-weight: 600;
}
</style>
