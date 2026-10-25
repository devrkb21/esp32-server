<script lang="ts" setup>
import type { AgentSnapshot, AgentSnapshotData } from '@/api/agent/types'
import type { ConfirmOptions } from '@/utils/tbConfirm'
import { computed, ref, watch } from 'vue'
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
import { digits } from '@/utils/calendar.mjs'
import { notifyRequestError } from '@/utils/requestError'
import { tbConfirm } from '@/utils/tbConfirm'
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
    notifyRequestError(error, 'agentSnapshot.fetchFailed')
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
    notifyRequestError(error, 'agentSnapshot.detailFailed')
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
    notifyRequestError(error, 'agentSnapshot.detailFailed')
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
        message: t('agentSnapshot.unsavedChangesWarning'),
        confirmText: t('agentSnapshot.discardAndRestore'),
        cancelText: t('common.cancel'),
        danger: true,
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
        message: t('agentSnapshot.restoreChatHistoryDestructiveWarning'),
        confirmText: t('agentSnapshot.confirmRestore'),
        cancelText: t('common.cancel'),
        danger: true,
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
      notifyRequestError(error, 'agentSnapshot.restoreFailed')
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

async function requestRestoreConfirmation(options: ConfirmOptions) {
  return tbConfirm(options)
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

async function deleteSnapshot(row: SnapshotRow) {
  const confirmed = await tbConfirm({
    title: t('mAgent.snap.deleteTitle'),
    message: t('agentSnapshot.deleteConfirm', { version: num(row.versionNo) }),
    confirmText: t('agentSnapshot.delete'),
    danger: true,
  })
  if (!confirmed)
    return
  deletingSnapshotId.value = row.id
  try {
    await deleteAgentSnapshot(props.agentId, row.id)
    toast.success(t('agentSnapshot.deleteSuccess'))
    await openPanel()
  }
  catch (error) {
    console.error('Failed to delete snapshot:', error)
    notifyRequestError(error, 'agentSnapshot.deleteFailed')
  }
  finally {
    deletingSnapshotId.value = ''
  }
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

function num(value: any) {
  return digits(value ?? '', getCurrentLanguage())
}

function formatVersion(versionNo?: number | null) {
  return versionNo ? `#${num(versionNo)}` : ''
}

function formatVersionRangeTitle(label: string, beforeVersionNo?: number | null, afterVersionNo?: number | null) {
  if (beforeVersionNo && afterVersionNo) {
    return `${label} ${formatVersion(beforeVersionNo)} → ${formatVersion(afterVersionNo)}`
  }
  if (beforeVersionNo) {
    return `${label} ${formatVersion(beforeVersionNo)}`
  }
  if (afterVersionNo) {
    return `${label} ${formatVersion(afterVersionNo)}`
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
  <!-- Saved versions of this character: newest first, each can be viewed, restored or deleted -->
  <tb-sheet v-model:open="panelVisible" :title="t('agentSnapshot.title')" :close-on-scrim="!restoring">
    <text v-if="displayedCurrentVersionNo" class="snap-lead">
      {{ t('mAgent.snap.lead', { v: formatVersion(displayedCurrentVersionNo) }) }}
    </text>

    <view v-if="loading && !snapshots.length" class="snap-state">
      <tb-loading :label="t('mAgent.snap.loading')" />
    </view>

    <tb-empty v-else-if="!snapshots.length" :title="t('agentSnapshot.empty')" :text="t('mAgent.snap.emptyText')" />

    <view v-else class="snap-list">
      <view v-for="snapshot in snapshots" :key="snapshot.id" class="snap-row" :class="{ 'is-now': snapshot.isLatestSnapshot }">
        <view class="snap-row__head">
          <text class="tb-num snap-row__no">
            {{ formatVersion(snapshot.versionNo) }}
          </text>
          <view class="snap-row__meta">
            <text class="snap-row__time">
              {{ formatTime(snapshot.createdAt) }}
            </text>
            <text class="snap-row__src">
              {{ sourceLabel(snapshot.source) }}
            </text>
          </view>
          <tb-tag v-if="snapshot.isLatestSnapshot" ink="ok" mark>
            {{ t('mAgent.snap.now') }}
          </tb-tag>
        </view>

        <view class="snap-row__fields">
          <tb-tag v-for="field in snapshot.changedFields || []" :key="field" ink="ink-2">
            {{ fieldLabel(field) }}
          </tb-tag>
          <text v-if="!(snapshot.changedFields || []).length" class="snap-muted">
            {{ t('agentSnapshot.noChangedContent') }}
          </text>
        </view>

        <view class="snap-row__acts">
          <tb-button size="s" icon="eye" @click="viewSnapshot(snapshot)">
            {{ t('agentSnapshot.view') }}
          </tb-button>
          <tb-button
            v-if="canRestoreSnapshot(snapshot)"
            size="s"
            icon="history"
            :disabled="mutationBusy"
            @click="previewRestoreSnapshot(snapshot)"
          >
            {{ t('mAgent.snap.restore') }}
          </tb-button>
          <tb-button
            v-if="canDeleteSnapshot(snapshot)"
            size="s"
            variant="quiet"
            icon="trash"
            :loading="deletingSnapshotId === snapshot.id"
            :aria-label="t('mAgent.snap.deleteLabel', { v: formatVersion(snapshot.versionNo) })"
            @click="deleteSnapshot(snapshot)"
          />
        </view>
      </view>

      <view v-if="hasMore" class="snap-more">
        <tb-button block :loading="loading" @click="loadSnapshots(false)">
          {{ t('mAgent.snap.older') }}
        </tb-button>
      </view>
    </view>
  </tb-sheet>

  <!-- One version: what changed, or what a restore would change -->
  <tb-sheet v-model:open="detailPopupVisible" :title="detailTitle" :close-on-scrim="!restoring">
    <view v-if="detailLoading" class="snap-state">
      <tb-loading :label="t('mAgent.snap.loading')" />
    </view>

    <tb-empty v-else-if="!detailItems.length" :text="t('agentSnapshot.noChangedContent')" />

    <view v-else class="snap-diff">
      <view v-for="item in detailItems" :key="item.field" class="snap-diff__item">
        <view class="snap-diff__head">
          <text class="snap-diff__label">
            {{ item.label }}
          </text>
          <tb-tag v-if="item.recordedOnly" ink="ink-2">
            {{ t('agentSnapshot.recordedChange') }}
          </tb-tag>
          <tb-tag v-if="item.redactedDifference" ink="warn">
            {{ t('agentSnapshot.redactedValueChanged') }}
          </tb-tag>
        </view>

        <view v-if="item.single" class="snap-diff__pair">
          <text class="snap-diff__cap">
            {{ t('agentSnapshot.configValue') }}
          </text>
          <text class="snap-diff__val is-after">
            {{ item.afterText }}
          </text>
        </view>

        <view v-else class="snap-diff__pair">
          <text class="snap-diff__cap">
            {{ currentDetail?.mode === 'restore' ? t('agentSnapshot.beforeRestore') : t('agentSnapshot.beforeChange') }}
          </text>
          <text class="snap-diff__val is-before">
            {{ item.beforeText }}
          </text>
          <text class="snap-diff__cap">
            {{ currentDetail?.mode === 'restore' ? t('agentSnapshot.afterRestore') : t('agentSnapshot.afterChange') }}
          </text>
          <text class="snap-diff__val is-after">
            {{ item.afterText }}
          </text>
        </view>
      </view>

      <text v-if="currentDetail?.mode === 'restore'" class="snap-note">
        {{ t('agentSnapshot.restoreConfirm', { version: num(currentDetail.afterVersionNo || '') }) }}
      </text>
      <text v-if="currentDetail?.mode === 'restore' && hasUnsavedChanges" class="snap-note is-danger">
        {{ t('agentSnapshot.unsavedChangesWarning') }}
      </text>
      <text v-if="restoreWillClearChatHistory" class="snap-note is-danger">
        {{ t('agentSnapshot.restoreChatHistoryDestructiveWarning') }}
      </text>
    </view>

    <template v-if="currentDetail?.mode === 'restore'" #footer>
      <tb-button :disabled="restoring" @click="closeDetail()">
        {{ t('common.cancel') }}
      </tb-button>
      <tb-button
        variant="primary"
        :loading="restoring"
        :disabled="restoring || !canConfirmRestore"
        @click="confirmRestoreSnapshot"
      >
        {{ t('mAgent.snap.restoreConfirm') }}
      </tb-button>
    </template>
  </tb-sheet>
</template>

<style lang="scss">
.snap-lead {
  font-size: 14px;
  color: var(--tb-ink-2);
}
.snap-state {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}
.snap-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule);
}
.snap-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.snap-row__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.snap-row__no {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 26px;
  line-height: 1;
  min-width: 56px;
}
.snap-row.is-now .snap-row__no {
  color: var(--tb-orange);
}
.snap-row__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.snap-row__time {
  font-size: 14px;
  font-weight: 600;
}
.snap-row__src {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.snap-row__fields {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.snap-row__fields .tb-tag {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.snap-muted {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.snap-row__acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.snap-more {
  padding-top: 14px;
}

.snap-diff {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid var(--tb-rule);
}
.snap-diff__item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.snap-diff__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.snap-diff__label {
  font-weight: 700;
  font-size: 15px;
}
.snap-diff__pair {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.snap-diff__cap {
  font-size: 12px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.snap-diff__val {
  display: block;
  padding: 8px 10px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: var(--tb-radius-s);
  background: var(--tb-paper-2);
}
.snap-diff__val.is-before {
  color: var(--tb-ink-2);
}
.snap-diff__val.is-after {
  background: transparent;
  border: 1px solid var(--tb-rule-soft);
}
.snap-note {
  display: block;
  padding-top: 12px;
  font-size: 14px;
  color: var(--tb-ink);
}
.snap-note.is-danger {
  color: var(--tb-danger);
}
</style>
