<script lang="ts" setup>
import type { ChatHistory, CreateSpeakerData, VoicePrint, VoiceprintSecurityConfig } from '@/api/voiceprint'
import { computed, onMounted, ref } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box'
import { useToast } from 'wot-design-uni/components/wd-toast'
import {
  createVoicePrint,
  deleteVoicePrint,
  getAudioDownloadId,
  getChatHistory,
  getVoicePrintList,
  getVoiceprintSecurity,
  updateVoicePrint,
  updateVoiceprintSecurity,
} from '@/api/voiceprint'
import { t } from '@/i18n'
import { getEnvBaseUrl } from '@/utils'

defineOptions({
  name: 'VoicePrintManage',
})

const props = withDefaults(defineProps<Props>(), {
  agentId: 'default',
})

const emits = defineEmits(['update-refresher-enabled'])

// Receive props
interface Props {
  agentId?: string
}

/** Translate with an English fallback for keys still waiting in src/i18n/_pending */
function tx(key: string, fallback: string) {
  const text = t(key)
  return text === key ? fallback : text
}

const message = useMessage()
const toast = useToast()

// Page data
const voicePrintList = ref<VoicePrint[]>([])
const chatHistoryList = ref<ChatHistory[]>([])
const chatHistoryActions = ref<any[]>([])
const swipeStates = ref<Record<string, 'left' | 'close' | 'right'>>({})
const loading = ref(false)

// Audio playback related
const audioRef = ref<UniApp.InnerAudioContext | null>(null)
const playingAudioId = ref<string>('')

// Use provided agent ID
const currentAgentId = computed(() => {
  return props.agentId
})

// Agent selection related functions removed

// Dialog related
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showChatHistoryDialog = ref(false)
const addForm = ref<CreateSpeakerData>({
  agentId: '',
  audioId: '',
  sourceName: '',
  introduce: '',
})
const editForm = ref<VoicePrint>({
  id: '',
  audioId: '',
  sourceName: '',
  introduce: '',
  createDate: '',
})

// Voiceprint Security policy state
const securityConfig = ref<VoiceprintSecurityConfig>({
  confidenceThreshold: 0.70,
  requireVoiceMatchSmartHome: false,
  adminSpeakerOnly: true,
})
const confidencePercent = ref<number>(70)
const isSavingSecurity = ref<boolean>(false)

async function loadSecuritySettings() {
  try {
    const data = await getVoiceprintSecurity()
    if (data) {
      securityConfig.value = {
        confidenceThreshold: data.confidenceThreshold ?? 0.70,
        requireVoiceMatchSmartHome: !!data.requireVoiceMatchSmartHome,
        adminSpeakerOnly: !!data.adminSpeakerOnly,
      }
      confidencePercent.value = Math.round((data.confidenceThreshold ?? 0.70) * 100)
    }
  }
  catch (error) {
    console.error('Failed to load voiceprint security settings:', error)
  }
}

async function saveSecuritySettings() {
  isSavingSecurity.value = true
  try {
    await updateVoiceprintSecurity({
      confidenceThreshold: Number((confidencePercent.value / 100).toFixed(2)),
      requireVoiceMatchSmartHome: securityConfig.value.requireVoiceMatchSmartHome,
      adminSpeakerOnly: securityConfig.value.adminSpeakerOnly,
    })
    toast.success(t('voiceprint.securitySaved'))
  }
  catch (error) {
    console.error('Failed to update voiceprint security settings:', error)
    toast.error(t('voiceprint.securitySaveFailed'))
  }
  finally {
    isSavingSecurity.value = false
  }
}

// Get voiceprint list
async function loadVoicePrintList() {
  try {
    console.log('Get voiceprint list')

    // Check whether agent is currently selected
    if (!currentAgentId.value) {
      console.warn(t('voiceprint.noSelectedAgent'))
      voicePrintList.value = []
      return
    }

    loading.value = true
    const data = await getVoicePrintList(currentAgentId.value)

    // Initialize swipe state
    const list = data || []
    list.forEach((item) => {
      if (!swipeStates.value[item.id]) {
        swipeStates.value[item.id] = 'close'
      }
    })

    voicePrintList.value = list
  }
  catch (error) {
    console.error('Failed to get voiceprint list:', error)
    voicePrintList.value = []
  }
  finally {
    loading.value = false
  }
}

// Refresh method exposed to parent
async function refresh() {
  await loadVoicePrintList()
}

// Get voice dialogue history
async function loadChatHistory() {
  try {
    if (!currentAgentId.value) {
      toast.error(t('voiceprint.pleaseSelectAgent'))
      return
    }

    const data = await getChatHistory(currentAgentId.value)
    chatHistoryList.value = data || []
    // Convert to ActionSheet format
    chatHistoryActions.value = chatHistoryList.value.map((item, index) => ({
      name: item.content,
      audioId: item.audioId,
      index,
    }))
  }
  catch (error) {
    console.error('Failed to get dialogue records:', error)
    toast.error(t('voiceprint.fetchHistoryFailed'))
  }
}

// Open add dialog
function openAddDialog() {
  if (!currentAgentId.value) {
    toast.error(t('voiceprint.pleaseSelectAgent'))
    return
  }

  // Check if voiceprint API is configured
  const checkVoicePrintConfig = async () => {
    try {
      await getVoicePrintList(currentAgentId.value)
      // API is normal, open add dialog
      addForm.value = {
        agentId: currentAgentId.value,
        audioId: '',
        sourceName: '',
        introduce: '',
      }
      showAddDialog.value = true
    }
    catch (error: any) {
      // Catch unconfigured voiceprint API error
      if (error.message && error.message.includes('10054')) {
        toast.error(t('voiceprint.voiceprintInterfaceNotConfigured'))
      }
      else {
        // Continue opening dialog on other errors
        addForm.value = {
          agentId: currentAgentId.value,
          audioId: '',
          sourceName: '',
          introduce: '',
        }
        showAddDialog.value = true
      }
    }
  }

  checkVoicePrintConfig()
}

// Open edit dialog
function openEditDialog(item: VoicePrint) {
  editForm.value = { ...item }
  showEditDialog.value = true
}

// Get display content of selected audio
function getSelectedAudioContent(audioId: string) {
  if (!audioId)
    return t('voiceprint.clickToSelectVector')
  const chatItem = chatHistoryList.value.find(item => item.audioId === audioId)
  return chatItem ? chatItem.content : `Selected: ${audioId.substring(0, 8)}...`
}

// Select voiceprint vector
function selectAudioId({ item }: { item: any }) {
  if (showAddDialog.value) {
    addForm.value.audioId = item.audioId
  }
  else if (showEditDialog.value) {
    editForm.value.audioId = item.audioId
  }
  showChatHistoryDialog.value = false
}

// Click to select
function handleItemClick(item: any) {
  selectAudioId({ item })
}

// Submit add speaker
async function submitAdd() {
  if (!addForm.value.sourceName.trim()) {
    toast.error(t('voiceprint.pleaseInputName'))
    return
  }
  if (!addForm.value.audioId) {
    toast.error(t('voiceprint.pleaseSelectVector'))
    return
  }

  try {
    await createVoicePrint(addForm.value)
    toast.success(t('voiceprint.addSuccess'))
    showAddDialog.value = false
    await loadVoicePrintList()
  }
  catch (error) {
    console.error('Failed to add speaker:', error)
    toast.error(t('voiceprint.addFailed'))
  }
}

// Submit edit speaker
async function submitEdit() {
  if (!editForm.value.sourceName.trim()) {
    toast.error(t('voiceprint.pleaseInputName'))
    return
  }
  if (!editForm.value.audioId) {
    toast.error(t('voiceprint.pleaseSelectVector'))
    return
  }

  try {
    await updateVoicePrint({
      id: editForm.value.id,
      audioId: editForm.value.audioId,
      sourceName: editForm.value.sourceName,
      introduce: editForm.value.introduce,
      createDate: editForm.value.createDate,
    })
    toast.success(t('voiceprint.editSuccess'))
    showEditDialog.value = false
    await loadVoicePrintList()
  }
  catch (error) {
    console.error('Failed to edit speaker:', error)
    toast.error(t('voiceprint.editFailed'))
  }
}

const sheetOpen = computed({
  get: () => showAddDialog.value || showEditDialog.value,
  set: (open: boolean) => {
    if (!open) {
      showAddDialog.value = false
      showEditDialog.value = false
    }
  },
})

/** The form the open sheet edits (add or edit) */
const sheetForm = computed(() => (showEditDialog.value ? editForm.value : addForm.value))

function submitSheet() {
  if (showEditDialog.value)
    submitEdit()
  else
    submitAdd()
}

function deleteFromSheet() {
  const id = editForm.value.id
  showEditDialog.value = false
  handleDelete(id)
}

// Handle edit operation
function handleEdit(item: VoicePrint) {
  openEditDialog(item)
  swipeStates.value[item.id] = 'close'
}

// Delete voiceprint
async function handleDelete(id: string) {
  message.confirm({
    msg: t('voiceprint.deleteConfirmMsg'),
    title: t('voiceprint.deleteConfirmTitle'),
  }).then(async () => {
    await deleteVoicePrint(id)
    toast.success(t('voiceprint.deleteSuccess'))
    await loadVoicePrintList()
  }).catch(() => {
    console.log('Clicked cancel button')
  })
}

// Play audio
async function playAudio(audioId: string, event: Event) {
  event.stopPropagation() // Stop event propagation

  if (!audioId) {
    toast.warning(t('voiceprint.audioNotExist'))
    return
  }

  // Stop if currently playing same audio
  if (playingAudioId.value === audioId) {
    stopAudio()
    return
  }

  // Stop previous audio
  stopAudio()

  try {
    // First get audio download ID
    playingAudioId.value = audioId
    const downloadId = await getAudioDownloadId(audioId)

    if (!downloadId) {
      toast.error(t('voiceprint.getAudioFailed'))
      playingAudioId.value = ''
      return
    }

    // Get baseURL
    const baseURL = getEnvBaseUrl()
    const audioUrl = `${baseURL}/agent/play/${downloadId}`

    // Create new Audio instance
    audioRef.value = uni.createInnerAudioContext()
    audioRef.value.src = audioUrl
    audioRef.value.autoplay = true

    // Listen for playback end
    audioRef.value.onEnded(() => {
      playingAudioId.value = ''
    })

    // Listen for playback error
    audioRef.value.onError((error) => {
      console.error('Audio playback error:', error)
      toast.error(t('voiceprint.audioPlayFailed'))
      playingAudioId.value = ''
    })
  }
  catch (error) {
    console.error('Failed to play audio:', error)
    toast.error(t('voiceprint.audioPlayFailed'))
    playingAudioId.value = ''
  }
}

// Stop audio
function stopAudio() {
  if (audioRef.value) {
    audioRef.value.stop()
    audioRef.value.destroy()
    audioRef.value = null
  }
  playingAudioId.value = ''
}

watch(() => [showAddDialog.value, showEditDialog.value], (newValues) => {
  if (newValues.some((value: boolean) => value)) {
    emits('update-refresher-enabled', false)
  }
  else {
    emits('update-refresher-enabled', true)
  }
})

onMounted(async () => {
  // Agent simplified to default
  loadSecuritySettings()
  loadVoicePrintList()
  loadChatHistory()
})

// Expose method to parent
defineExpose({
  showAddDialog,
  showEditDialog,
  refresh,
})
</script>

<template>
  <view class="vp">
    <!-- Large title -->
    <view class="vp__header">
      <view class="min-w-0 flex-1">
        <view class="vp__title">
          {{ tx('voiceprint.listTitle', 'Voiceprints') }}
        </view>
        <view class="vp__subtitle">
          {{ tx('voiceprint.listSubtitle', 'Let the robot recognise who is speaking.') }}
        </view>
      </view>
      <view
        v-if="voicePrintList.length"
        class="vp__add"
        role="button"
        :aria-label="t('voiceprint.addSpeaker')"
        @click="openAddDialog"
      >
        <wd-icon name="add" size="16px" />
        <text>{{ tx('voiceprint.add', 'Add') }}</text>
      </view>
    </view>

    <!-- Speakers -->
    <view v-if="loading && voicePrintList.length === 0" class="nx-group">
      <view class="nx-group__body">
        <view v-for="i in 3" :key="i" class="nx-row">
          <view class="nx-skeleton vp__skeleton-icon" />
          <view class="nx-row__main">
            <view class="nx-skeleton vp__skeleton-line" />
            <view class="nx-skeleton vp__skeleton-line vp__skeleton-line--short" />
          </view>
        </view>
      </view>
    </view>

    <view v-else-if="voicePrintList.length > 0" class="nx-group">
      <view class="nx-group__header">
        {{ tx('voiceprint.speakers', 'Speakers') }}
      </view>
      <view class="nx-group__body">
        <wd-swipe-action
          v-for="item in voicePrintList"
          :key="item.id"
          :model-value="swipeStates[item.id] || 'close'"
          custom-class="vp__swipe"
          @update:model-value="swipeStates[item.id] = $event"
        >
          <view class="nx-row nx-row--tap vp__row" @click="handleEdit(item)">
            <view class="vp__avatar" aria-hidden="true">
              {{ (item.sourceName || '?').trim().charAt(0).toUpperCase() }}
            </view>
            <view class="nx-row__main">
              <view class="nx-row__title nx-truncate vp__name" :title="item.sourceName">
                {{ item.sourceName }}
              </view>
              <view class="nx-truncate nx-row__subtitle" :title="item.introduce">
                {{ item.introduce || tx('voiceprint.noDescription', 'No description') }}
              </view>
            </view>
            <view class="nx-caption nx-num vp__date">
              {{ item.createDate }}
            </view>
            <wd-icon name="arrow-right" size="16px" custom-class="nx-row__chevron" />
          </view>

          <template #right>
            <view class="vp__swipe-btn" @click="handleDelete(item.id)">
              <wd-icon name="delete" size="18px" />
              <text>{{ t('voiceprint.delete') }}</text>
            </view>
          </template>
        </wd-swipe-action>
      </view>
      <view class="nx-group__footer">
        {{ tx('voiceprint.swipeHint', 'Tap a speaker to edit. Swipe left to delete.') }}
      </view>
    </view>

    <view v-else-if="!loading" class="nx-empty vp__empty">
      <view class="nx-icon-tile nx-icon-tile--lg">
        <wd-icon name="user-talk" size="28px" />
      </view>
      <view class="nx-empty__title">
        {{ t('voiceprint.emptyTitle') }}
      </view>
      <view class="nx-empty__text">
        {{ tx('voiceprint.emptyText', 'Add a family member’s voice from a recent conversation so the robot knows who it is talking to.') }}
      </view>
      <view class="nx-btn nx-btn--primary vp__empty-btn" @click="openAddDialog">
        <wd-icon name="add" size="16px" />
        {{ t('voiceprint.addSpeaker') }}
      </view>
    </view>

    <!-- Security policy -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('voiceprint.securitySettings') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('voiceprint.requireSmartHome') }}
            </view>
            <view class="nx-row__subtitle">
              {{ t('voiceprint.requireSmartHomeDesc') }}
            </view>
          </view>
          <wd-switch v-model="securityConfig.requireVoiceMatchSmartHome" size="22px" />
        </view>
        <view class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('voiceprint.adminSpeakerOnly') }}
            </view>
            <view class="nx-row__subtitle">
              {{ t('voiceprint.adminSpeakerOnlyDesc') }}
            </view>
          </view>
          <wd-switch v-model="securityConfig.adminSpeakerOnly" size="22px" />
        </view>
        <view class="nx-row vp__slider-row">
          <view class="vp__slider-head">
            <view class="nx-row__title">
              {{ t('voiceprint.confidenceThreshold') }}
            </view>
            <view class="nx-num nx-badge nx-badge--accent">
              {{ confidencePercent }}%
            </view>
          </view>
          <wd-slider
            v-model="confidencePercent"
            :min="50"
            :max="95"
            :step="5"
            hide-label
            hide-min-max
          />
          <view class="nx-num vp__scale">
            <text>50% · {{ tx('voiceprint.flexible', 'Flexible') }}</text>
            <text>70% · {{ tx('voiceprint.default', 'Default') }}</text>
            <text>95% · {{ tx('voiceprint.strict', 'Strict') }}</text>
          </view>
        </view>
      </view>
      <view class="nx-group__footer">
        {{ t('voiceprint.securityDesc') }}
      </view>
      <view class="vp__save">
        <wd-button block type="info" :loading="isSavingSecurity" @click="saveSecuritySettings">
          {{ t('voiceprint.saveSecurity') }}
        </wd-button>
      </view>
    </view>

    <!-- Add / edit speaker sheet -->
    <wd-popup
      v-model="sheetOpen"
      position="bottom"
      safe-area-inset-bottom
      :z-index="100"
      custom-class="vp-sheet"
    >
      <view class="vp-sheet__inner">
        <view class="vp-sheet__handle" />
        <view class="vp-sheet__header">
          <view class="nx-truncate vp-sheet__title">
            {{ showEditDialog ? t('voiceprint.editSpeaker') : t('voiceprint.addSpeaker') }}
          </view>
          <view class="vp-sheet__close" role="button" :aria-label="t('voiceprint.cancel')" @click="sheetOpen = false">
            <wd-icon name="close" size="18px" />
          </view>
        </view>

        <view class="field">
          <view class="field__label">
            {{ t('voiceprint.voiceVector') }}
          </view>
          <view class="field__picker" role="button" @click="showChatHistoryDialog = true">
            <wd-icon name="sound" size="18px" custom-class="field__picker-icon" />
            <text class="nx-truncate field__picker-text" :class="{ 'is-placeholder': !sheetForm.audioId }">
              {{ getSelectedAudioContent(sheetForm.audioId) }}
            </text>
            <wd-icon name="arrow-right" size="16px" custom-class="nx-row__chevron" />
          </view>
          <view class="field__help">
            {{ tx('voiceprint.vectorHelp', 'Pick a clear sentence this person said to the robot.') }}
          </view>
        </view>

        <view class="field">
          <view class="field__label">
            {{ t('voiceprint.name') }}
          </view>
          <input
            v-model="sheetForm.sourceName"
            class="field__input"
            type="text"
            :maxlength="32"
            :placeholder="t('voiceprint.pleaseInputName')"
          >
        </view>

        <view class="field">
          <view class="field__label">
            {{ t('voiceprint.description') }}
          </view>
          <textarea
            v-model="sheetForm.introduce"
            class="field__textarea"
            :maxlength="100"
            :placeholder="t('voiceprint.pleaseInputDescription')"
          />
          <view class="nx-num field__count">
            {{ (sheetForm.introduce || '').length }}/100
          </view>
        </view>

        <view class="vp-sheet__actions">
          <wd-button block size="large" @click="submitSheet">
            {{ t('voiceprint.save') }}
          </wd-button>
          <view v-if="showEditDialog" class="vp-sheet__delete" role="button" @click="deleteFromSheet">
            {{ t('voiceprint.delete') }}
          </view>
        </view>
      </view>
    </wd-popup>

    <!-- Voice sample picker -->
    <wd-popup
      v-model="showChatHistoryDialog"
      position="bottom"
      safe-area-inset-bottom
      :z-index="110"
      custom-class="vp-sheet"
      @close="stopAudio"
    >
      <view class="vp-sheet__inner">
        <view class="vp-sheet__handle" />
        <view class="vp-sheet__header">
          <view class="vp-sheet__title nx-truncate">
            {{ t('voiceprint.selectVector') }}
          </view>
          <view class="vp-sheet__close" role="button" :aria-label="t('voiceprint.cancel')" @click="showChatHistoryDialog = false">
            <wd-icon name="close" size="18px" />
          </view>
        </view>

        <scroll-view scroll-y class="vp-sheet__list">
          <view v-if="!chatHistoryActions.length" class="nx-empty vp-sheet__empty">
            <view class="nx-icon-tile nx-icon-tile--lg">
              <wd-icon name="sound" size="28px" />
            </view>
            <view class="nx-empty__text">
              {{ tx('voiceprint.noSamples', 'No voice recordings yet. Talk to the robot first, then come back.') }}
            </view>
          </view>
          <view v-else class="vp-sheet__body">
            <view
              v-for="item in chatHistoryActions"
              :key="item.audioId"
              class="nx-row nx-row--tap"
              :class="{ 'is-playing': playingAudioId === item.audioId }"
              @click="handleItemClick(item)"
            >
              <view
                class="vp__play"
                :class="{ 'is-playing': playingAudioId === item.audioId }"
                role="button"
                :aria-label="playingAudioId === item.audioId ? tx('voiceprint.stopAudio', 'Stop') : tx('voiceprint.playAudio', 'Play')"
                @click.stop="playAudio(item.audioId, $event)"
              >
                <wd-icon :name="playingAudioId === item.audioId ? 'pause' : 'play'" size="14px" />
              </view>
              <view class="nx-row__main">
                <view class="nx-row__title vp__sample">
                  {{ item.name }}
                </view>
                <view v-if="playingAudioId === item.audioId" class="nx-row__subtitle vp__playing">
                  {{ tx('voiceprint.playing', 'Playing…') }}
                </view>
              </view>
              <wd-icon
                v-if="sheetForm.audioId === item.audioId"
                name="check"
                size="18px"
                custom-class="vp__check"
              />
            </view>
          </view>
        </scroll-view>
      </view>
    </wd-popup>

    <!-- MessageBox component -->
    <wd-message-box />
  </view>
</template>

<style lang="scss" scoped>
.vp {
  position: relative;
  min-height: 100%;
  padding: 0 var(--nx-gutter) calc(var(--nx-space-7) + env(safe-area-inset-bottom));
  background: var(--nx-bg);
  box-sizing: border-box;

  &__header {
    display: flex;
    align-items: flex-end;
    gap: var(--nx-space-3);
    padding: var(--nx-space-2) 0 var(--nx-space-4);
  }

  &__title {
    font-size: var(--nx-text-display);
    font-weight: 700;
    letter-spacing: -0.022em;
    line-height: 1.15;
    color: var(--nx-text);
  }

  &__subtitle {
    margin-top: 8rpx;
    font-size: var(--nx-text-callout);
    color: var(--nx-text-2);
  }

  &__add {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8rpx;
    min-height: 64rpx;
    padding: 0 var(--nx-space-3);
    border-radius: var(--nx-radius-pill);
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-callout);
    font-weight: 600;
    transition: transform var(--nx-dur-1) var(--nx-ease);

    &:active {
      transform: scale(0.97);
    }
  }

  &__row {
    background: var(--nx-surface);
  }

  &__avatar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-headline);
    font-weight: 600;
  }

  &__name {
    font-weight: 600;
  }

  &__date {
    flex: none;
    max-width: 30%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__swipe-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6rpx;
    min-width: 144rpx;
    height: 100%;
    padding: 0 var(--nx-space-3);
    box-sizing: border-box;
    background: var(--nx-danger);
    color: var(--nx-on-accent);
    font-size: var(--nx-text-caption);
    font-weight: 600;
  }

  &__empty {
    padding-top: var(--nx-space-5);
  }

  &__empty-btn {
    margin-top: var(--nx-space-3);
  }

  &__slider-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nx-space-1);
  }

  &__slider-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__scale {
    display: flex;
    justify-content: space-between;
    gap: var(--nx-space-1);
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }

  &__save {
    margin-top: var(--nx-space-3);
  }

  &__play {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    transition: transform var(--nx-dur-1) var(--nx-ease);

    &:active {
      transform: scale(0.92);
    }

    &.is-playing {
      background: var(--nx-accent);
      color: var(--nx-on-accent);
    }
  }

  &__sample {
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }

  &__playing {
    color: var(--nx-accent);
  }

  &__skeleton-icon {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
  }

  &__skeleton-line {
    width: 50%;
    height: 28rpx;

    &--short {
      width: 70%;
      height: 22rpx;
      margin-top: 12rpx;
    }
  }
}

:deep(.vp__swipe) {
  position: relative;
  background: var(--nx-surface);

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    left: var(--nx-space-4);
    right: 0;
    bottom: 0;
    height: 1rpx;
    background: var(--nx-border);
  }
}

:deep(.vp__check) {
  flex: none;
  color: var(--nx-accent);
}

/* ---------- bottom sheets ---------- */
:deep(.vp-sheet) {
  border-radius: var(--nx-radius-xl) var(--nx-radius-xl) 0 0;
  background: var(--nx-bg);
  overflow: hidden;
}

.vp-sheet {
  &__inner {
    display: flex;
    flex-direction: column;
    max-height: 85vh;
    padding: 0 var(--nx-gutter) var(--nx-space-4);
    overflow-y: auto;
    box-sizing: border-box;
  }

  &__handle {
    flex: none;
    width: 72rpx;
    height: 10rpx;
    margin: var(--nx-space-2) auto var(--nx-space-1);
    border-radius: var(--nx-radius-pill);
    background: var(--nx-border-strong);
  }

  &__header {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--nx-space-2);
    padding: var(--nx-space-2) 0 var(--nx-space-4);
  }

  &__title {
    flex: 1;
    min-width: 0;
    font-size: var(--nx-text-headline);
    font-weight: 600;
    color: var(--nx-text);
  }

  &__close {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: var(--nx-surface-3);
    color: var(--nx-text-2);
  }

  &__actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--nx-space-2);
    margin-top: var(--nx-space-2);
  }

  &__delete {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--nx-touch);
    padding: 0 var(--nx-space-4);
    color: var(--nx-danger);
    font-size: var(--nx-text-body);
    font-weight: 500;
  }

  &__list {
    max-height: 60vh;
  }

  &__body {
    overflow: hidden;
    border-radius: var(--nx-radius-lg);
    background: var(--nx-surface);
  }

  &__empty {
    padding: var(--nx-space-5) var(--nx-space-4);
  }
}

.field {
  margin-bottom: var(--nx-space-4);

  &__label {
    margin-bottom: var(--nx-space-1);
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }

  &__help {
    margin-top: var(--nx-space-1);
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }

  &__count {
    margin-top: var(--nx-space-1);
    text-align: right;
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }

  &__picker,
  &__input,
  &__textarea {
    width: 100%;
    border: 2rpx solid transparent;
    border-radius: var(--nx-radius);
    background: var(--nx-surface);
    color: var(--nx-text);
    font-size: var(--nx-text-body);
    box-sizing: border-box;
  }

  &__picker {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    min-height: var(--nx-touch);
    padding: 0 var(--nx-space-3);

    &:active {
      background: var(--nx-surface-2);
    }
  }

  &__picker-text {
    flex: 1;

    &.is-placeholder {
      color: var(--nx-text-3);
    }
  }

  &__input {
    height: var(--nx-touch);
    padding: 0 var(--nx-space-3);
  }

  &__textarea {
    height: 200rpx;
    padding: var(--nx-space-2) var(--nx-space-3);
    line-height: 1.5;
  }

  &__input:focus,
  &__textarea:focus {
    border-color: var(--nx-accent);
    box-shadow: 0 0 0 6rpx var(--nx-accent-soft);
  }
}

:deep(.field__picker-icon) {
  flex: none;
  color: var(--nx-accent);
}
</style>
