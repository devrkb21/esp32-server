<script lang="ts" setup>
import type { AgentSnapshot, AgentSnapshotData } from '@/api/agent/types'
import { computed, ref, watch } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import {
  deleteAgentSnapshot,
  getAgentSnapshot,
  getAgentSnapshots,
  getCorrectWordFiles,
  getModelOptions,
  getPluginFunctions,
  getTTSVoices,
  restoreAgentSnapshot,
} from '@/api/agent/agent'
import { getCurrentLanguage, t } from '@/i18n'
import { toast } from '@/utils/toast'
import {
  isSensitiveKey,
  normalizeSnapshotTtsNumber as normalizeDefaultTtsNumber,
  normalizeSnapshotOrderedList,
  redactSnapshotDisplayValue,
  SNAPSHOT_SECRET_REDACTED,
  stablePrettyStringify,
  toIntlLocale,
  willRestorePermanentlyDeleteChatHistory,
} from './agentSnapshotUtils.mjs'

defineOptions({
  name: 'AgentSnapshotPanel',
})

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  currentVersionNo: null,
  hasUnsavedChanges: false,
  mutationBusy: false,
})

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'restored', context: { agentId: string, actionSequence: number }): void
}>()

interface Props {
  visible?: boolean
  agentId: string
  currentVersionNo?: number | null
  hasUnsavedChanges?: boolean
  mutationBusy?: boolean
}

interface SnapshotRow extends AgentSnapshot {
  isLatestSnapshot?: boolean
  previousSnapshotId?: string | null
  previousVersionNo?: number | null
}

interface VersionDetail {
  mode: 'view' | 'restore'
  single: boolean
  row: SnapshotRow
  beforeData: AgentSnapshotData
  afterData: AgentSnapshotData
  changedFields: string[]
  fieldOrder: string[]
  forceCompare?: boolean
  beforeVersionNo?: number | null
  afterVersionNo?: number | null
  currentStateToken?: string
}

interface DetailItem {
  field: string
  label: string
  beforeText: string
  afterText: string
  single: boolean
  recordedOnly?: boolean
  redactedDifference?: boolean
}

interface RestoreActionContext {
  actionSequence: number
  agentId: string
  snapshotId: string
  currentStateToken: string
  detailRequestSequence: number
  willClearChatHistory: boolean
}

const message = useMessage()
const restoring = ref(false)

const panelVisible = computed({
  get: () => props.visible,
  set: (value) => {
    if (!value && restoring.value) {
      return
    }
    emit('update:visible', value)
  },
})

const loading = ref(false)
const detailLoading = ref(false)
const deletingSnapshotId = ref('')
const snapshots = ref<SnapshotRow[]>([])
const page = ref(1)
const limit = 10
const total = ref(0)
const historyAnchorVersionNo = ref<number | null>(null)
const detailVisible = ref(false)
const detailPopupVisible = computed({
  get: () => detailVisible.value,
  set: (value) => {
    if (!value && restoring.value) {
      return
    }
    detailVisible.value = value
  },
})
const currentDetail = ref<VersionDetail | null>(null)
const pluginNameMap = ref<Record<string, string>>({})
const modelNameMap = ref<Record<string, string>>({})
const voiceNameMap = ref<Record<string, string>>({})
const correctWordNameMap = ref<Record<string, string>>({})
const loadedVoiceModelIds = ref<Record<string, boolean>>({})
const metadataLoaded = ref(false)
const correctWordMetadataLoaded = ref(false)
let detailRequestSequence = 0
let snapshotRequestSequence = 0
let restoreActionSequence = 0
let restorePostActionSequence: number | null = null
let restorePreviewRequestSequence: number | null = null

const MODEL_TYPES = ['ASR', 'VAD', 'LLM', 'VLLM', 'TTS', 'Memory', 'Intent']
const MODEL_FIELD_TYPES: Record<string, string> = {
  asrModelId: 'ASR',
  vadModelId: 'VAD',
  llmModelId: 'LLM',
  slmModelId: 'LLM',
  vllmModelId: 'VLLM',
  ttsModelId: 'TTS',
  memModelId: 'Memory',
  intentModelId: 'Intent',
}

const CHAT_HISTORY_CONF_LABEL_KEYS: Record<string, string> = {
  0: 'agentSnapshot.chatHistoryConf.none',
  1: 'agentSnapshot.chatHistoryConf.text',
  2: 'agentSnapshot.chatHistoryConf.textVoice',
}

const SNAPSHOT_FIELD_ORDER = [
  'agentName',
  'agentCode',
  'asrModelId',
  'vadModelId',
  'llmModelId',
  'slmModelId',
  'vllmModelId',
  'ttsModelId',
  'ttsLanguage',
  'ttsVoiceId',
  'ttsVolume',
  'ttsRate',
  'ttsPitch',
  'memModelId',
  'intentModelId',
  'chatHistoryConf',
  'systemPrompt',
  'summaryMemory',
  'langCode',
  'language',
  'sort',
  'functions',
  'contextProviders',
  'correctWordFileIds',
  'tagNames',
]

const hasMore = computed(() => snapshots.value.length < total.value)
const detailItems = computed(() => {
  if (!currentDetail.value) {
    return []
  }
  return buildDetailItems(currentDetail.value)
})
const detailTitle = computed(() => {
  if (!currentDetail.value) {
    return t('agentSnapshot.detailTitle')
  }
  const label = currentDetail.value.mode === 'restore'
    ? t('agentSnapshot.restorePreviewTitle')
    : t('agentSnapshot.detailTitle')
  return formatVersionRangeTitle(label, currentDetail.value.beforeVersionNo, currentDetail.value.afterVersionNo)
})
const restoreWillClearChatHistory = computed(() => {
  if (!currentDetail.value || currentDetail.value.mode !== 'restore') {
    return false
  }
  return willRestorePermanentlyDeleteChatHistory(
    currentDetail.value.beforeData?.memModelId,
    currentDetail.value.afterData?.memModelId,
  )
})
const displayedCurrentVersionNo = computed(() => historyAnchorVersionNo.value || props.currentVersionNo)
const canConfirmRestore = computed(() => {
  return !restoring.value
    && !props.mutationBusy
    && currentDetail.value?.mode === 'restore'
    && detailItems.value.length > 0
    && Boolean(currentDetail.value.currentStateToken?.trim())
})

watch(() => props.visible, (visible) => {
  if (visible) {
    openPanel()
  }
  else {
    invalidateRestoreAction()
    invalidateSnapshotRequest()
    closeDetail(true)
  }
})

watch(detailVisible, (visible) => {
  if (!visible) {
    invalidateDetailRequest()
  }
}, { flush: 'sync' })

watch(() => props.currentVersionNo, () => {
  if (props.visible) {
    openPanel()
  }
})

watch(() => props.agentId, (currentAgentId, previousAgentId) => {
  if (currentAgentId === previousAgentId) {
    return
  }
  invalidateRestoreAction()
  invalidateSnapshotRequest()
  closeDetail(true)
  if (props.visible) {
    openPanel()
  }
}, { flush: 'sync' })

watch(() => props.mutationBusy, (mutationBusy) => {
  if (!mutationBusy) {
    return
  }
  const restorePostInFlight = restoring.value
    && restorePostActionSequence === restoreActionSequence
  if (restorePostInFlight) {
    return
  }
  const pendingRestorePreview = restorePreviewRequestSequence !== null
    || currentDetail.value?.mode === 'restore'
  const pendingRestoreConfirmation = restoring.value
    && restorePostActionSequence !== restoreActionSequence
  if (!pendingRestorePreview && !pendingRestoreConfirmation) {
    return
  }
  if (pendingRestoreConfirmation) {
    invalidateRestoreAction()
  }
  restorePreviewRequestSequence = null
  closeDetail(true)
  toast.warning(t('agentSnapshot.mutationBusy'))
}, { flush: 'sync' })

async function openPanel() {
  const requestId = ++snapshotRequestSequence
  // The first page must be unanchored so that a stale parent page cannot hide
  // versions created by another client. The response establishes a stable
  // anchor for all subsequent pages in this panel session.
  historyAnchorVersionNo.value = null
  page.value = 1
  snapshots.value = []
  await loadSnapshots(true, requestId)
}

async function loadSnapshots(reset = false, requestId = snapshotRequestSequence) {
  if (!props.agentId) {
    snapshots.value = []
    total.value = 0
    return
  }

  try {
    loading.value = true
    const nextPage = reset ? 1 : page.value
    const params: Record<string, number> = {
      page: nextPage,
      limit,
    }
    if (!reset && historyAnchorVersionNo.value) {
      params.maxVersionNo = historyAnchorVersionNo.value
    }
    const result = await getAgentSnapshots(props.agentId, params)
    if (!isActiveSnapshotRequest(requestId)) {
      return
    }
    const responseRows = result?.list || []
    if (reset) {
      historyAnchorVersionNo.value = responseRows[0]?.versionNo || null
    }
    const rows = decorateSnapshotRows(responseRows)
    const mergedRows = reset ? rows : [...snapshots.value, ...rows]
    snapshots.value = attachPreviousRows(mergedRows)
    total.value = result?.total || 0
    page.value = nextPage + 1
  }
  catch (error) {
    if (!isActiveSnapshotRequest(requestId)) {
      return
    }
    console.error('Failed to load snapshots:', error)
    toast.error(t('agentSnapshot.fetchFailed'))
  }
  finally {
    if (isActiveSnapshotRequest(requestId)) {
      loading.value = false
    }
  }
}

function isActiveSnapshotRequest(requestId: number) {
  return props.visible && requestId === snapshotRequestSequence
}

function invalidateSnapshotRequest() {
  snapshotRequestSequence += 1
  loading.value = false
}

function decorateSnapshotRows(rows: AgentSnapshot[]): SnapshotRow[] {
  return rows.map(row => ({
    ...row,
    isLatestSnapshot: Boolean(historyAnchorVersionNo.value && row.versionNo === historyAnchorVersionNo.value),
  }))
}

function attachPreviousRows(rows: SnapshotRow[]) {
  return rows.map((row) => {
    const previousRow = findPreviousSnapshotRow(row, rows)
    return {
      ...row,
      previousSnapshotId: previousRow?.id || null,
      previousVersionNo: previousRow?.versionNo || null,
    }
  })
}

function findPreviousSnapshotRow(row: SnapshotRow, rows: SnapshotRow[]) {
  const versionNo = Number(row.versionNo)
  if (!Number.isFinite(versionNo)) {
    return null
  }
  return rows.find(item => Number(item.versionNo) < versionNo) || null
}

async function viewSnapshot(row: SnapshotRow) {
  detailVisible.value = true
  const requestId = ++detailRequestSequence
  detailLoading.value = true
  currentDetail.value = null
  try {
    const metadataRequest = ensureMetadata()
    const detail = await buildSavedVersionDetail(row)
    if (!isActiveDetailRequest(requestId)) {
      return
    }
    currentDetail.value = detail
    // Names are enhancement metadata. Render the snapshot immediately with
    // stable IDs, then update names reactively as metadata arrives.
    void Promise.allSettled([
      metadataRequest,
      ensureDisplayMetadata(detail.beforeData, detail.afterData),
    ])
  }
  catch (error) {
    if (!isActiveDetailRequest(requestId)) {
      return
    }
    console.error('Failed to load snapshot detail:', error)
    toast.error(t('agentSnapshot.detailFailed'))
    detailVisible.value = false
  }
  finally {
    if (isActiveDetailRequest(requestId)) {
      detailLoading.value = false
    }
  }
}

async function previewRestoreSnapshot(row: SnapshotRow) {
  if (!canRestoreSnapshot(row)) {
    return
  }
  if (props.mutationBusy) {
    toast.warning(t('agentSnapshot.mutationBusy'))
    return
  }
  detailVisible.value = true
  const requestId = ++detailRequestSequence
  restorePreviewRequestSequence = requestId
  detailLoading.value = true
  currentDetail.value = null
  try {
    const metadataRequest = ensureMetadata()
    const targetSnapshot = await getAgentSnapshot(props.agentId, row.id)
    if (!isActiveDetailRequest(requestId)) {
      return
    }
    if (!isPlainObject(targetSnapshot.currentSnapshotData)) {
      throw new Error('Snapshot detail is missing the atomic current-state data')
    }
    const detail: VersionDetail = {
      mode: 'restore',
      single: false,
      row: {
        ...row,
        id: targetSnapshot.id || row.id,
      },
      beforeData: targetSnapshot.currentSnapshotData,
      afterData: targetSnapshot.snapshotData || {},
      changedFields: [],
      fieldOrder: targetSnapshot.fieldOrder || [],
      forceCompare: true,
      beforeVersionNo: historyAnchorVersionNo.value || props.currentVersionNo,
      afterVersionNo: targetSnapshot.versionNo,
      currentStateToken: targetSnapshot.currentStateToken,
    }
    currentDetail.value = detail
    void Promise.allSettled([
      metadataRequest,
      ensureDisplayMetadata(detail.beforeData, detail.afterData),
    ])
  }
  catch (error) {
    if (!isActiveDetailRequest(requestId)) {
      return
    }
    console.error('Failed to load restore preview:', error)
    toast.error(t('agentSnapshot.detailFailed'))
    detailVisible.value = false
  }
  finally {
    if (restorePreviewRequestSequence === requestId) {
      restorePreviewRequestSequence = null
    }
    if (isActiveDetailRequest(requestId)) {
      detailLoading.value = false
    }
  }
}

function isActiveDetailRequest(requestId: number) {
  return detailVisible.value && requestId === detailRequestSequence
}

function invalidateDetailRequest() {
  detailRequestSequence += 1
  detailLoading.value = false
  currentDetail.value = null
}

function closeDetail(force = false) {
  if (restoring.value && !force) {
    return
  }
  if (detailVisible.value) {
    detailVisible.value = false
    return
  }
  invalidateDetailRequest()
}

async function buildSavedVersionDetail(row: SnapshotRow): Promise<VersionDetail> {
  const selectedSnapshot = await getAgentSnapshot(props.agentId, row.id)
  const previousSnapshot = await fetchPreviousSnapshot(row)
  if (previousSnapshot?.snapshotData) {
    const adjacentVersion = Number(selectedSnapshot.versionNo) - Number(previousSnapshot.versionNo) === 1
    return {
      mode: 'view',
      single: false,
      row,
      beforeData: previousSnapshot.snapshotData || {},
      afterData: selectedSnapshot.snapshotData || {},
      changedFields: adjacentVersion ? (selectedSnapshot.changedFields || row.changedFields || []) : [],
      fieldOrder: selectedSnapshot.fieldOrder || previousSnapshot.fieldOrder || row.fieldOrder || [],
      forceCompare: !adjacentVersion,
      beforeVersionNo: previousSnapshot.versionNo,
      afterVersionNo: selectedSnapshot.versionNo,
    }
  }

  return {
    mode: 'view',
    single: true,
    row,
    beforeData: {},
    afterData: selectedSnapshot.snapshotData || {},
    changedFields: selectedSnapshot.changedFields || row.changedFields || [],
    fieldOrder: selectedSnapshot.fieldOrder || row.fieldOrder || [],
    afterVersionNo: selectedSnapshot.versionNo,
  }
}

async function fetchPreviousSnapshot(row: SnapshotRow) {
  if (row.previousSnapshotId) {
    return getAgentSnapshot(props.agentId, row.previousSnapshotId)
  }
  if (!row.versionNo || row.versionNo <= 1) {
    return null
  }
  const result = await getAgentSnapshots(props.agentId, {
    page: 1,
    limit: 1,
    maxVersionNo: row.versionNo - 1,
  })
  const previousRow = result?.list?.[0]
  if (!previousRow?.id) {
    return null
  }
  return getAgentSnapshot(props.agentId, previousRow.id)
}

async function confirmRestoreSnapshot() {
  const detail = currentDetail.value
  if (restoring.value || !detail || detail.mode !== 'restore' || !detail.row?.id) {
    return
  }
  if (props.mutationBusy) {
    toast.warning(t('agentSnapshot.mutationBusy'))
    return
  }
  if (!detailItems.value.length) {
    toast.info(t('agentSnapshot.noRestoreNeeded'))
    return
  }
  const currentStateToken = detail.currentStateToken?.trim()
  if (!currentStateToken) {
    console.error('Cannot restore snapshot without a current-state token')
    toast.error(t('agentSnapshot.restoreFailed'))
    return
  }
  const context: RestoreActionContext = {
    actionSequence: ++restoreActionSequence,
    agentId: props.agentId,
    snapshotId: detail.row.id,
    currentStateToken,
    detailRequestSequence,
    willClearChatHistory: restoreWillClearChatHistory.value,
  }
  // Enter the busy state before either confirmation can yield. This prevents
  // rapid taps from opening duplicate dialogs or issuing duplicate restores.
  restoring.value = true
  try {
    if (props.hasUnsavedChanges) {
      const confirmed = await requestRestoreConfirmation({
        title: t('agentSnapshot.unsavedChangesTitle'),
        msg: t('agentSnapshot.unsavedChangesWarning'),
        confirmButtonText: t('agentSnapshot.discardAndRestore'),
        cancelButtonText: t('common.cancel'),
      })
      if (!confirmed || !isActiveRestoreAction(context)) {
        return
      }
    }

    // This confirmation must be the last user interaction before the POST.
    // It is intentionally separate from the unsaved-form confirmation because
    // clearing chat history is irreversible and outside snapshot recovery.
    if (context.willClearChatHistory) {
      const confirmed = await requestRestoreConfirmation({
        title: t('agentSnapshot.confirmRestore'),
        msg: t('agentSnapshot.restoreChatHistoryDestructiveWarning'),
        confirmButtonText: t('agentSnapshot.confirmRestore'),
        cancelButtonText: t('common.cancel'),
      })
      if (!confirmed || !isActiveRestoreAction(context)) {
        return
      }
    }

    if (!isActiveRestoreAction(context)) {
      return
    }
    // Mark the irreversible request boundary only after the final mutation
    // guard. A later parent busy transition must not pretend this POST was
    // canceled; its real response still owns the terminal UI state.
    restorePostActionSequence = context.actionSequence
    await restoreAgentSnapshot(context.agentId, context.snapshotId, context.currentStateToken)
    if (!isActiveRestoreAction(context)) {
      return
    }
    toast.success(t('agentSnapshot.restoreSuccess'))
    closeDetail(true)
    emit('restored', {
      agentId: context.agentId,
      actionSequence: context.actionSequence,
    })
    if (props.visible && props.agentId === context.agentId) {
      await openPanel()
    }
  }
  catch (error) {
    if (isActiveRestoreAction(context)) {
      console.error('Failed to restore snapshot:', error)
      toast.error(t('agentSnapshot.restoreFailed'))
    }
  }
  finally {
    if (restorePostActionSequence === context.actionSequence) {
      restorePostActionSequence = null
    }
    if (context.actionSequence === restoreActionSequence) {
      restoring.value = false
    }
  }
}

async function requestRestoreConfirmation(options: Parameters<typeof message.confirm>[0]) {
  try {
    await message.confirm(options)
    return true
  }
  catch {
    return false
  }
}

function isActiveRestoreAction(context: RestoreActionContext) {
  const detail = currentDetail.value
  return restoring.value
    && context.actionSequence === restoreActionSequence
    && (!props.mutationBusy || restorePostActionSequence === context.actionSequence)
    && context.agentId === props.agentId
    && props.visible
    && detailVisible.value
    && context.detailRequestSequence === detailRequestSequence
    && detail?.mode === 'restore'
    && detail.row?.id === context.snapshotId
    && detail.currentStateToken?.trim() === context.currentStateToken
}

function invalidateRestoreAction() {
  restoreActionSequence += 1
  restoring.value = false
}

function deleteSnapshot(row: SnapshotRow) {
  message.confirm({
    title: t('agentSnapshot.delete'),
    msg: t('agentSnapshot.deleteConfirm', { version: row.versionNo }),
  }).then(async () => {
    deletingSnapshotId.value = row.id
    try {
      await deleteAgentSnapshot(props.agentId, row.id)
      toast.success(t('agentSnapshot.deleteSuccess'))
      await openPanel()
    }
    catch (error) {
      console.error('Failed to delete snapshot:', error)
      toast.error(t('agentSnapshot.deleteFailed'))
    }
    finally {
      deletingSnapshotId.value = ''
    }
  }).catch(() => {})
}

function canRestoreSnapshot(row: SnapshotRow) {
  return !!row?.id && !row.isLatestSnapshot
}

function canDeleteSnapshot(row: SnapshotRow) {
  return !!row?.id && !row.isLatestSnapshot
}

function buildDetailItems(detail: VersionDetail): DetailItem[] {
  if (detail.single) {
    return snapshotFieldOrder(detail.fieldOrder, {}, detail.afterData).map((field) => {
      const afterValue = getFieldValue(detail.afterData, field)
      return {
        field,
        label: fieldLabel(field),
        beforeText: '',
        afterText: formatDisplayValue(field, afterValue, detail.afterData),
        single: true,
        recordedOnly: false,
        redactedDifference: false,
      }
    })
  }

  return resolveDiffFields(
    detail.beforeData,
    detail.afterData,
    detail.changedFields,
    detail.fieldOrder,
    detail.forceCompare,
  ).map((field) => {
    const beforeValue = getFieldValue(detail.beforeData, field)
    const afterValue = getFieldValue(detail.afterData, field)
    const beforeText = formatDisplayValue(field, beforeValue, detail.beforeData)
    const afterText = formatDisplayValue(field, afterValue, detail.afterData)
    return {
      field,
      label: fieldLabel(field),
      beforeText,
      afterText,
      single: false,
      recordedOnly: !detail.forceCompare && isSameFieldValue(field, beforeValue, afterValue),
      redactedDifference: !isSameFieldValue(field, beforeValue, afterValue)
        && beforeText === afterText
        && beforeText.includes(t('agentSnapshot.secretRedacted')),
    }
  })
}

function resolveDiffFields(
  beforeData: AgentSnapshotData,
  afterData: AgentSnapshotData,
  changedFields: string[] = [],
  fieldOrder: string[] = [],
  forceCompare = false,
) {
  const orderedFields = snapshotFieldOrder(fieldOrder, beforeData, afterData)
  const storedFields = Array.isArray(changedFields) ? changedFields : []
  const directFields = storedFields
    .filter(field => field && field !== 'initial' && field !== 'restore')
    .map(canonicalField)
  const candidates = forceCompare ? orderedFields : directFields

  const uniqueCandidates = Array.from(new Set(candidates))
  if (!forceCompare) {
    // changedFields is an immutable fact about the saved event. Re-running
    // today's comparison rules would make old events disappear from detail.
    return uniqueCandidates
  }
  return uniqueCandidates.filter((field) => {
    return !isSameFieldValue(
      field,
      getFieldValue(beforeData, field),
      getFieldValue(afterData, field),
    )
  })
}

function snapshotFieldOrder(fieldOrder: string[] = [], beforeData: AgentSnapshotData = {}, afterData: AgentSnapshotData = {}) {
  const fields = [
    ...fieldOrder,
    ...SNAPSHOT_FIELD_ORDER,
  ].map(canonicalField)
  return Array.from(new Set(fields)).filter((field) => {
    const beforeValue = getFieldValue(beforeData, field)
    const afterValue = getFieldValue(afterData, field)
    return beforeValue !== undefined || afterValue !== undefined
  })
}

function canonicalField(field: string) {
  return field === 'tags' || field === 'tagIds' ? 'tagNames' : field
}

function getFieldValue(data: AgentSnapshotData, field: string) {
  const canonicalName = canonicalField(field)
  if (canonicalName === 'tagNames') {
    return data?.tagNames ?? data?.tags?.map(tag => tag.tagName).filter(Boolean)
  }
  return data?.[canonicalName]
}

function formatDisplayValue(field: string, value: any, rowData: AgentSnapshotData = {}) {
  if (value === SNAPSHOT_SECRET_REDACTED) {
    return t('agentSnapshot.secretRedacted')
  }
  if (value === null || value === undefined || value === '') {
    return t('agentSnapshot.emptyValue')
  }
  if (MODEL_FIELD_TYPES[field]) {
    return modelNameMap.value[String(value)] || translatedFallback(`agentSnapshot.model.${value}`, String(value))
  }
  if (field === 'ttsVoiceId') {
    return voiceNameMap.value[String(value)] || translatedFallback(`agentSnapshot.voice.${value}`, String(value))
  }
  if (field === 'chatHistoryConf') {
    return t(CHAT_HISTORY_CONF_LABEL_KEYS[String(value)] || 'agentSnapshot.emptyValue')
  }
  if (field === 'functions') {
    return formatFunctions(value)
  }
  if (field === 'contextProviders') {
    return formatContextProviders(value)
  }
  if (field === 'correctWordFileIds') {
    return formatCorrectWordFileIds(value)
  }
  if (field === 'tagNames') {
    return formatStringList(value)
  }
  if (Array.isArray(value)) {
    return formatArrayValue(value)
  }
  if (typeof value === 'object') {
    return stablePrettyStringify(redactDisplayValue(value))
  }
  if (field === 'ttsLanguage' && !value && rowData.ttsVoiceId) {
    return t('agentSnapshot.emptyValue')
  }
  return String(value)
}

function formatFunctions(value: any) {
  if (!Array.isArray(value) || value.length === 0) {
    return t('agentSnapshot.emptyValue')
  }
  return value.map((item) => {
    const pluginId = item?.pluginId || item?.id || ''
    const name = pluginNameMap.value[pluginId] || translatedFallback(`agentSnapshot.plugin.${pluginId}`, pluginId || t('agentSnapshot.emptyValue'))
    const params = parseObjectValue(item?.paramInfo ?? item?.params)
    const safeParams = redactDisplayValue(params)
    return Object.keys(safeParams).length
      ? `${name}\n${stablePrettyStringify(safeParams)}`
      : name
  }).join('\n')
}

function formatContextProviders(value: any) {
  if (!Array.isArray(value) || value.length === 0) {
    return t('agentSnapshot.emptyValue')
  }
  return value.map((item, index) => {
    return `${index + 1}. ${stablePrettyStringify(redactDisplayValue(item))}`
  }).join('\n')
}

function formatCorrectWordFileIds(value: any) {
  if (!Array.isArray(value) || value.length === 0) {
    return t('agentSnapshot.emptyValue')
  }
  return formatLocalizedList(value.map(id => correctWordNameMap.value[id] || id))
}

function formatStringList(value: any) {
  if (!Array.isArray(value) || value.length === 0) {
    return t('agentSnapshot.emptyValue')
  }
  return formatLocalizedList(value)
}

function formatArrayValue(value: any[]) {
  if (!value.length) {
    return t('agentSnapshot.emptyValue')
  }
  if (value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
    return formatLocalizedList(value)
  }
  return stablePrettyStringify(redactDisplayValue(value))
}

async function ensureMetadata() {
  if (metadataLoaded.value) {
    return
  }
  const modelResults = await Promise.allSettled(
    MODEL_TYPES.map(async (modelType) => {
      const options = await getModelOptions(modelType)
      options.forEach((option) => {
        modelNameMap.value[option.id] = option.modelName
      })
    }),
  )
  modelResults.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn('Failed to load model metadata:', result.reason)
    }
  })

  try {
    const plugins = await getPluginFunctions()
    plugins.forEach((plugin) => {
      pluginNameMap.value[plugin.id] = plugin.name
    })
  }
  catch (error) {
    console.warn('Failed to load plugin metadata:', error)
  }
  metadataLoaded.value = true
}

async function ensureVoiceMetadata(...snapshots: AgentSnapshotData[]) {
  const ttsModelIds = snapshots
    .map(snapshot => snapshot?.ttsModelId)
    .filter((modelId): modelId is string => Boolean(modelId && !loadedVoiceModelIds.value[modelId]))
  const uniqueModelIds = Array.from(new Set(ttsModelIds))
  await Promise.allSettled(uniqueModelIds.map(async (modelId) => {
    const voices = await getTTSVoices(modelId)
    voices.forEach((voice) => {
      voiceNameMap.value[voice.id] = voice.name
    })
    loadedVoiceModelIds.value[modelId] = true
  }))
}

async function ensureDisplayMetadata(...snapshots: AgentSnapshotData[]) {
  await Promise.all([
    ensureVoiceMetadata(...snapshots),
    ensureCorrectWordMetadata(...snapshots),
  ])
}

async function ensureCorrectWordMetadata(...snapshots: AgentSnapshotData[]) {
  const hasCorrectWordIds = snapshots.some((snapshot) => {
    return Array.isArray(snapshot?.correctWordFileIds) && snapshot.correctWordFileIds.length > 0
  })
  if (!hasCorrectWordIds || correctWordMetadataLoaded.value) {
    return
  }
  try {
    const files = await getCorrectWordFiles()
    files.forEach((file) => {
      if (file.id) {
        correctWordNameMap.value[file.id] = file.fileName || file.id
      }
    })
    correctWordMetadataLoaded.value = true
  }
  catch (error) {
    console.warn('Failed to load correct word metadata:', error)
  }
}

function sourceLabel(source?: string) {
  return translatedFallback(`agentSnapshot.source.${source || 'config'}`, source || '')
}

function fieldLabel(field: string) {
  return translatedFallback(`agentSnapshot.field.${field}`, field)
}

function translatedFallback(key: string, fallback: string) {
  const value = t(key)
  return value === key ? fallback : value
}

function formatVersion(versionNo?: number | null) {
  return versionNo ? `#${versionNo}` : ''
}

function formatVersionRangeTitle(label: string, beforeVersionNo?: number | null, afterVersionNo?: number | null) {
  if (beforeVersionNo && afterVersionNo) {
    return `${label} #${beforeVersionNo} -> #${afterVersionNo}`
  }
  if (beforeVersionNo) {
    return `${label} #${beforeVersionNo}`
  }
  if (afterVersionNo) {
    return `${label} #${afterVersionNo}`
  }
  return label
}

function formatTime(time?: string) {
  if (!time) {
    return '-'
  }
  const date = new Date(String(time).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) {
    return String(time)
  }
  try {
    return new Intl.DateTimeFormat(toIntlLocale(getCurrentLanguage()), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
  }
  catch {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }
}

function formatLocalizedList(values: any[]) {
  const items = values.map(value => String(value))
  try {
    return new Intl.ListFormat(toIntlLocale(getCurrentLanguage()), {
      style: 'short',
      type: 'conjunction',
    }).format(items)
  }
  catch {
    return items.join(getCurrentLanguage().startsWith('zh_') ? '、' : ', ')
  }
}

function isSameFieldValue(
  field: string,
  left: any,
  right: any,
) {
  return isEquivalentValue(
    normalizeValueForField(field, left),
    normalizeValueForField(field, right),
  )
}

function normalizeValueForField(field: string, value: any): any {
  if (field === 'ttsVolume' || field === 'ttsRate' || field === 'ttsPitch') {
    return normalizeDefaultTtsNumber(value)
  }
  if (field === 'summaryMemory') {
    return value === undefined || value === null || String(value).trim() === '' ? '' : String(value)
  }
  if (field === 'correctWordFileIds' || field === 'tagNames') {
    return normalizeStringList(value)
  }
  if (field === 'functions') {
    return normalizeFunctions(value)
  }
  if (field === 'contextProviders') {
    return normalizeSnapshotOrderedList(value)
  }
  return normalizeValue(value)
}

function normalizeStringList(value: any) {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter(item => item !== undefined && item !== null && String(item).trim() !== '')
    .map(item => String(item))
    .sort()
}

function normalizeFunctions(value: any) {
  if (!Array.isArray(value)) {
    return {}
  }
  const functions = value.reduce<Record<string, any>>((result, item) => {
    const pluginId = item?.pluginId
    if (pluginId) {
      result[String(pluginId)] = normalizeValue(parseObjectValue(item?.paramInfo ?? item?.params))
    }
    return result
  }, {})
  return normalizeValue(functions)
}

function parseObjectValue(value: any) {
  if (!value) {
    return {}
  }
  if (typeof value !== 'string') {
    return value
  }
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

function isEquivalentValue(left: any, right: any): boolean {
  if (left === SNAPSHOT_SECRET_REDACTED || right === SNAPSHOT_SECRET_REDACTED) {
    return true
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
    return left.every((item, index) => isEquivalentValue(item, right[index]))
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) {
      return false
    }
    const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)]))
    return keys.every(key => isEquivalentValue(left[key], right[key]))
  }
  return left === right
}

function normalizeValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(normalizeValue)
  }
  if (isPlainObject(value)) {
    return Object.keys(value).sort().reduce<Record<string, any>>((result, key) => {
      result[key] = isSensitiveKey(key) ? SNAPSHOT_SECRET_REDACTED : normalizeValue(value[key])
      return result
    }, {})
  }
  return value === undefined ? null : value
}

function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function redactDisplayValue(value: any, parentKey = ''): any {
  return redactSnapshotDisplayValue(value, t('agentSnapshot.secretRedacted'), parentKey)
}
</script>

<template>
  <wd-popup
    v-model="panelVisible"
    position="bottom"
    custom-class="agent-snapshot-popup"
    :close-on-click-modal="!restoring"
    safe-area-inset-bottom
  >
    <view class="agent-snapshot-shell">
      <view class="agent-snapshot-handle" />
      <view class="agent-snapshot-header">
        <view class="agent-snapshot-title-block">
          <text class="agent-snapshot-title">
            {{ t('agentSnapshot.title') }}
          </text>
          <text v-if="displayedCurrentVersionNo" class="nx-num agent-snapshot-subtitle">
            {{ t('agentSnapshot.currentVersion') }} {{ formatVersion(displayedCurrentVersionNo) }}
          </text>
        </view>
        <view class="agent-snapshot-close" role="button" :aria-label="t('common.cancel')" @click="panelVisible = false">
          <wd-icon name="close" size="18px" />
        </view>
      </view>

      <scroll-view scroll-y class="agent-snapshot-body">
        <view v-if="loading && !snapshots.length" class="agent-snapshot-list">
          <view v-for="n in 3" :key="n" class="agent-snapshot-card">
            <view class="nx-skeleton agent-snapshot-skel-title" />
            <view class="nx-skeleton agent-snapshot-skel-line" />
          </view>
        </view>

        <view v-else-if="!snapshots.length" class="nx-empty">
          <view class="nx-icon-tile nx-icon-tile--lg">
            <wd-icon name="time" size="28px" />
          </view>
          <text class="nx-empty__title">
            {{ t('agentSnapshot.empty') }}
          </text>
          <text class="nx-empty__text">
            {{ t('agentSnapshot.emptyTip') }}
          </text>
        </view>

        <view v-else class="agent-snapshot-list">
          <view
            v-for="snapshot in snapshots"
            :key="snapshot.id"
            class="agent-snapshot-card"
          >
            <view class="agent-snapshot-card__head">
              <text class="nx-num agent-snapshot-card__version">
                {{ formatVersion(snapshot.versionNo) }}
              </text>
              <text v-if="snapshot.isLatestSnapshot" class="nx-badge nx-badge--accent">
                {{ t('agentSnapshot.currentVersion') }}
              </text>
            </view>
            <text class="agent-snapshot-card__meta">
              {{ formatTime(snapshot.createdAt) }} · {{ sourceLabel(snapshot.source) }}
            </text>

            <view class="agent-snapshot-card__fields">
              <text
                v-for="field in snapshot.changedFields || []"
                :key="field"
                class="nx-badge"
              >
                {{ fieldLabel(field) }}
              </text>
              <text v-if="!(snapshot.changedFields || []).length" class="agent-snapshot-muted">
                {{ t('agentSnapshot.noChangedContent') }}
              </text>
            </view>

            <view class="agent-snapshot-actions">
              <view class="agent-snapshot-action" role="button" @click="viewSnapshot(snapshot)">
                {{ t('agentSnapshot.view') }}
              </view>
              <view
                v-if="canRestoreSnapshot(snapshot)"
                class="agent-snapshot-action agent-snapshot-action--primary"
                :class="{ 'is-disabled': mutationBusy }"
                role="button"
                @click="!mutationBusy && previewRestoreSnapshot(snapshot)"
              >
                {{ t('agentSnapshot.restore') }}
              </view>
              <view
                v-if="canDeleteSnapshot(snapshot)"
                class="agent-snapshot-action agent-snapshot-action--danger"
                :class="{ 'is-disabled': deletingSnapshotId === snapshot.id }"
                role="button"
                @click="deletingSnapshotId !== snapshot.id && deleteSnapshot(snapshot)"
              >
                <wd-loading v-if="deletingSnapshotId === snapshot.id" size="14px" />
                <text v-else>
                  {{ t('agentSnapshot.delete') }}
                </text>
              </view>
            </view>
          </view>

          <view
            v-if="hasMore"
            class="nx-btn nx-btn--block agent-snapshot-more"
            :class="{ 'is-disabled': loading }"
            role="button"
            @click="!loading && loadSnapshots(false)"
          >
            <wd-loading v-if="loading" size="16px" />
            {{ t('agentSnapshot.loadMore') }}
          </view>
        </view>
      </scroll-view>
    </view>
  </wd-popup>

  <wd-popup
    v-model="detailPopupVisible"
    position="bottom"
    custom-class="agent-snapshot-popup agent-snapshot-popup--detail"
    :close-on-click-modal="!restoring"
    safe-area-inset-bottom
  >
    <view class="agent-snapshot-shell">
      <view class="agent-snapshot-handle" />
      <view class="agent-snapshot-header">
        <text class="agent-snapshot-detail-title">
          {{ detailTitle }}
        </text>
        <view class="agent-snapshot-close" role="button" :aria-label="t('common.cancel')" @click="closeDetail()">
          <wd-icon name="close" size="18px" />
        </view>
      </view>

      <scroll-view scroll-y class="agent-snapshot-body">
        <view v-if="detailLoading" class="agent-snapshot-list">
          <view v-for="n in 3" :key="n" class="agent-snapshot-card">
            <view class="nx-skeleton agent-snapshot-skel-title" />
            <view class="nx-skeleton agent-snapshot-skel-block" />
          </view>
        </view>

        <view v-else-if="!detailItems.length" class="nx-empty">
          <text class="nx-empty__text">
            {{ t('agentSnapshot.noChangedContent') }}
          </text>
        </view>

        <view v-else class="agent-snapshot-list">
          <view
            v-for="item in detailItems"
            :key="item.field"
            class="agent-snapshot-card agent-snapshot-card--flush"
          >
            <view class="agent-snapshot-diff-head">
              <text class="agent-snapshot-diff-label">
                {{ item.label }}
              </text>
              <text v-if="item.recordedOnly" class="nx-badge">
                {{ t('agentSnapshot.recordedChange') }}
              </text>
              <text v-if="item.redactedDifference" class="nx-badge nx-badge--warning">
                {{ t('agentSnapshot.redactedValueChanged') }}
              </text>
            </view>

            <view v-if="item.single" class="agent-snapshot-diff-body">
              <text class="agent-snapshot-diff-caption">
                {{ t('agentSnapshot.configValue') }}
              </text>
              <text class="agent-snapshot-value agent-snapshot-value--after">
                {{ item.afterText }}
              </text>
            </view>

            <view v-else class="agent-snapshot-diff-body">
              <view>
                <text class="agent-snapshot-diff-caption">
                  {{ currentDetail?.mode === 'restore' ? t('agentSnapshot.beforeRestore') : t('agentSnapshot.beforeChange') }}
                </text>
                <text class="agent-snapshot-value agent-snapshot-value--before">
                  {{ item.beforeText }}
                </text>
              </view>
              <view>
                <text class="agent-snapshot-diff-caption">
                  {{ currentDetail?.mode === 'restore' ? t('agentSnapshot.afterRestore') : t('agentSnapshot.afterChange') }}
                </text>
                <text class="agent-snapshot-value agent-snapshot-value--after">
                  {{ item.afterText }}
                </text>
              </view>
            </view>
          </view>

          <view
            v-if="currentDetail?.mode === 'restore'"
            class="agent-snapshot-note"
          >
            {{ t('agentSnapshot.restoreConfirm', { version: currentDetail.afterVersionNo || '' }) }}
          </view>
          <view
            v-if="currentDetail?.mode === 'restore' && hasUnsavedChanges"
            class="agent-snapshot-note agent-snapshot-note--danger"
          >
            {{ t('agentSnapshot.unsavedChangesWarning') }}
          </view>
          <view
            v-if="restoreWillClearChatHistory"
            class="agent-snapshot-note agent-snapshot-note--danger"
          >
            {{ t('agentSnapshot.restoreChatHistoryDestructiveWarning') }}
          </view>
        </view>
      </scroll-view>

      <view
        v-if="currentDetail?.mode === 'restore'"
        class="agent-snapshot-footer"
      >
        <wd-button type="info" :disabled="restoring" custom-class="agent-snapshot-footer-button flex-1" @click="closeDetail()">
          {{ t('common.cancel') }}
        </wd-button>
        <wd-button
          type="primary"
          :loading="restoring"
          :disabled="restoring || !canConfirmRestore"
          custom-class="agent-snapshot-footer-button flex-1"
          @click="confirmRestoreSnapshot"
        >
          {{ t('agentSnapshot.confirmRestore') }}
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
:deep(.wd-popup.agent-snapshot-popup) {
  left: 0;
  right: 0;
  width: 100vw;
  height: 86vh;
  max-height: 1800rpx;
  margin: 0;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: var(--nx-radius-xl) var(--nx-radius-xl) 0 0;
  background: var(--nx-bg);
}

:deep(.wd-popup.agent-snapshot-popup--detail) {
  height: 88vh;
  max-height: 1880rpx;
}

@media (min-width: 901px) {
  :deep(.wd-popup.agent-snapshot-popup) {
    width: calc(100vw - 32px);
    max-width: 760px;
    margin: 0 auto;
  }
}

.agent-snapshot-shell {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--nx-bg);
}

.agent-snapshot-handle {
  flex: none;
  width: 72rpx;
  height: 10rpx;
  margin: var(--nx-space-2) auto 0;
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface-3);
}

.agent-snapshot-header {
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--nx-space-3);
  padding: var(--nx-space-3) var(--nx-gutter) var(--nx-space-3);
  border-bottom: 1rpx solid var(--nx-border);
}

.agent-snapshot-title-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.agent-snapshot-title {
  font-size: var(--nx-text-title);
  font-weight: 700;
  letter-spacing: -0.018em;
  color: var(--nx-text);
}

.agent-snapshot-subtitle {
  margin-top: 4rpx;
  font-size: var(--nx-text-footnote);
  color: var(--nx-text-2);
}

.agent-snapshot-detail-title {
  min-width: 0;
  flex: 1;
  color: var(--nx-text);
  font-size: var(--nx-text-headline);
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.agent-snapshot-close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--nx-surface-2);
  color: var(--nx-text-2);
  &:active {
    background: var(--nx-surface-3);
  }
}

.agent-snapshot-body {
  box-sizing: border-box;
  min-height: 0;
  flex: 1;
}

.agent-snapshot-list {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
  padding: var(--nx-space-4) var(--nx-gutter) var(--nx-space-5);
}

.agent-snapshot-card {
  padding: var(--nx-space-4);
  border-radius: var(--nx-radius-lg);
  background: var(--nx-surface);
  box-shadow: var(--nx-shadow-1);

  &--flush {
    padding: 0;
    overflow: hidden;
  }
  &__head {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
  }
  &__version {
    font-size: var(--nx-text-headline);
    font-weight: 600;
    color: var(--nx-text);
  }
  &__meta {
    display: block;
    margin-top: 4rpx;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  &__fields {
    display: flex;
    flex-wrap: wrap;
    gap: var(--nx-space-1);
    margin-top: var(--nx-space-3);
  }
}

.agent-snapshot-muted {
  font-size: var(--nx-text-footnote);
  color: var(--nx-text-3);
}

.agent-snapshot-actions {
  display: flex;
  gap: var(--nx-space-2);
  margin-top: var(--nx-space-4);
}

.agent-snapshot-action {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  overflow: hidden;
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);
  color: var(--nx-text);
  font-size: var(--nx-text-callout);
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: transform var(--nx-dur-1) var(--nx-ease);
  &:active {
    transform: scale(0.97);
  }
  &--primary {
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
  }
  &--danger {
    background: var(--nx-danger-soft);
    color: var(--nx-danger);
  }
  &.is-disabled {
    opacity: 0.5;
  }
}

.agent-snapshot-more {
  margin-top: var(--nx-space-1);
  &.is-disabled {
    opacity: 0.6;
  }
}

.agent-snapshot-skel-title {
  width: 40%;
  height: 32rpx;
}
.agent-snapshot-skel-line {
  width: 70%;
  height: 24rpx;
  margin-top: var(--nx-space-2);
}
.agent-snapshot-skel-block {
  width: 100%;
  height: 96rpx;
  margin-top: var(--nx-space-3);
}

.agent-snapshot-diff-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--nx-space-2);
  padding: var(--nx-space-3) var(--nx-space-4);
  border-bottom: 1rpx solid var(--nx-border);
}

.agent-snapshot-diff-label {
  font-size: var(--nx-text-body);
  font-weight: 600;
  color: var(--nx-text);
}

.agent-snapshot-diff-body {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
  padding: var(--nx-space-3) var(--nx-space-4) var(--nx-space-4);
}

.agent-snapshot-diff-caption {
  display: block;
  margin-bottom: var(--nx-space-1);
  font-size: var(--nx-text-caption);
  font-weight: 500;
  color: var(--nx-text-3);
}

.agent-snapshot-value {
  display: block;
  padding: var(--nx-space-2) var(--nx-space-3);
  border-radius: var(--nx-radius-sm);
  font-family: var(--nx-font-mono);
  font-size: var(--nx-text-footnote);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  color: var(--nx-text);

  &--before {
    background: var(--nx-danger-soft);
  }
  &--after {
    background: var(--nx-success-soft);
  }
}

.agent-snapshot-note {
  padding: var(--nx-space-3) var(--nx-space-4);
  border-radius: var(--nx-radius-lg);
  background: var(--nx-info-soft);
  color: var(--nx-text);
  font-size: var(--nx-text-footnote);
  line-height: 1.5;

  &--danger {
    background: var(--nx-danger-soft);
  }
}

.agent-snapshot-footer {
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  gap: var(--nx-space-2);
  padding: var(--nx-space-3) var(--nx-gutter);
  background: var(--nx-glass);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
  border-top: 1rpx solid var(--nx-border);
}

:deep(.agent-snapshot-footer-button) {
  min-width: 0;
  border-radius: var(--nx-radius);
}

:deep(.agent-snapshot-footer-button .wd-button__text) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
