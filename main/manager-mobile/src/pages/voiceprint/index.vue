<!-- Voiceprints: the people TinyBot recognises by voice, and the voice security policy (owner: m-voiceprint).
     A page (?agentId=, else the character of "this robot") and also embedded by pages/agent/index.vue as
     <VoiceprintManagement :agent-id>, which calls the exposed refresh(). Embedded, it draws no page header. -->
<route lang="jsonc">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Nobix"
  }
}
</route>

<script lang="ts" setup>
import type { ChatHistory, VoicePrint } from '@/api/voiceprint'
import { onHide, onLoad } from '@dcloudio/uni-app'
import { computed, onMounted, ref, watch } from 'vue'
import {
  deleteVoicePrint,
  getChatHistory,
  getVoicePrintList,
  getVoiceprintSecurity,
  updateVoiceprintSecurity,
} from '@/api/voiceprint'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { tbConfirm } from '@/utils/tbConfirm'
import { loadRobots, robot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'
import VoicePrintSheet from './components/VoicePrintSheet.vue'
import { useVoicePlayer } from './useVoicePlayer'
import {
  clampPercent,
  CONFIDENCE,
  dateText,
  isNotConfigured,
  recordingsFrom,
  sameSecurity,
  securityOf,
  securityPayload,
  serverSaid,
} from './voiceprintModel.mjs'

defineOptions({ name: 'VoicePrintManage' })

const props = withDefaults(defineProps<{ agentId?: string, embedded?: boolean }>(), { agentId: 'default', embedded: false })
const emits = defineEmits(['update-refresher-enabled'])

const lang = computed(() => getCurrentLanguage())
const num = (n: any) => digits(n, lang.value)

/* ---------- which character, page or embedded ---------- */
function onOwnRoute() {
  try {
    const pages = getCurrentPages()
    const last: any = pages[pages.length - 1]
    if (last && String(last.route || '').includes('pages/voiceprint/'))
      return true
  }
  catch {}
  try {
    return window.location.hash.includes('/pages/voiceprint/')
  }
  catch {
    return false
  }
}
const pageMode = ref(!props.embedded && onOwnRoute())
const queryAgentId = ref('')
onLoad((q: any) => {
  pageMode.value = !props.embedded && onOwnRoute()
  if (pageMode.value && q?.agentId)
    queryAgentId.value = decodeURIComponent(String(q.agentId))
})
const propAgentId = computed(() => (props.agentId && props.agentId !== 'default' ? props.agentId : ''))
const currentAgentId = computed(() => queryAgentId.value || propAgentId.value || robot.agentId || '')

/* ---------- people ---------- */
const voicePrintList = ref<VoicePrint[]>([])
const loading = ref(false)
const loaded = ref(false)
const failed = ref(false)

/* ---------- recent recordings (to pick from, and the words of each row) ---------- */
const recordings = ref<{ audioId: string, text: string, speaker: string }[]>([])
const recentState = ref<'loading' | 'failed' | 'ok'>('ok')

/* ---------- sheet ---------- */
const sheetOpen = ref(false)
const editing = ref<VoicePrint | null>(null)
const opening = ref(false)

/* ---------- security policy ---------- */
const security = ref(securityOf(null))
const savedSecurity = ref(securityOf(null))
const securityLoaded = ref(false)
const securityFailed = ref(false)
const isSavingSecurity = ref(false)
const securityDirty = computed(() => !sameSecurity(security.value, savedSecurity.value))

const player = useVoicePlayer((kind) => {
  toast.error(kind === 'fetch' ? t('voiceprint.getAudioFailed') : t('mVp.playFailed'))
})

const wordsById = computed(() => {
  const m: Record<string, { text: string, speaker: string }> = {}
  for (const r of recordings.value) m[r.audioId] = r
  return m
})
const nameOf = (row: VoicePrint) => (row.sourceName || '').trim() || t('mVp.unnamed')
const wordsOf = (row: VoicePrint) => wordsById.value[row.audioId]?.text || ''

function playLabel(row: VoicePrint) {
  if (player.loadingId.value === row.audioId)
    return t('mVp.fetchingAudio')
  return player.playingId.value === row.audioId ? t('mVp.stop') : t('mVp.listen', { name: nameOf(row) })
}

async function loadVoicePrintList() {
  if (!currentAgentId.value) {
    voicePrintList.value = []
    return
  }
  loading.value = true
  failed.value = false
  try {
    const data = await getVoicePrintList(currentAgentId.value)
    voicePrintList.value = Array.isArray(data) ? data : []
  }
  catch (error) {
    console.error('Failed to get voiceprint list:', error)
    failed.value = true
  }
  finally {
    loading.value = false
    loaded.value = true
  }
}

async function loadChatHistory() {
  if (!currentAgentId.value)
    return
  recentState.value = 'loading'
  try {
    const data = await getChatHistory(currentAgentId.value)
    recordings.value = recordingsFrom((data || []) as ChatHistory[]) as any
    recentState.value = 'ok'
  }
  catch (error) {
    console.error('Failed to get dialogue records:', error)
    recentState.value = 'failed'
  }
}

async function loadSecuritySettings() {
  try {
    const data = await getVoiceprintSecurity()
    const s = securityOf(data)
    security.value = { ...s }
    savedSecurity.value = { ...s }
    securityFailed.value = false
  }
  catch (error) {
    console.error('Failed to load voiceprint security settings:', error)
    securityFailed.value = true
  }
  finally {
    securityLoaded.value = true
  }
}

async function saveSecuritySettings() {
  isSavingSecurity.value = true
  try {
    await updateVoiceprintSecurity(securityPayload(security.value))
    savedSecurity.value = { ...security.value }
    securityFailed.value = false
    toast.success(t('mVp.sec.saved'))
  }
  catch (error) {
    console.error('Failed to update voiceprint security settings:', error)
    if (!serverSaid(error))
      toast.error(t('mVp.sec.saveFailed'))
  }
  finally {
    isSavingSecurity.value = false
  }
}

function onThreshold(e: any) {
  security.value = { ...security.value, percent: clampPercent(e?.detail?.value) }
}

/** Refresh method exposed to the character page */
async function refresh() {
  await Promise.all([loadVoicePrintList(), loadChatHistory()])
}

/* ---------- add, edit, delete ---------- */
async function openAdd() {
  if (!currentAgentId.value) {
    toast.error(t('voiceprint.pleaseSelectAgent'))
    return
  }
  if (opening.value)
    return
  opening.value = true
  // The legacy check: is the voiceprint service configured? (error 10054 says it is not)
  try {
    await getVoicePrintList(currentAgentId.value)
  }
  catch (error: any) {
    if (isNotConfigured(error)) {
      toast.error(t('mVp.notConfigured'))
      opening.value = false
      return
    }
  }
  opening.value = false
  player.stop()
  editing.value = null
  sheetOpen.value = true
  if (recentState.value !== 'loading')
    loadChatHistory()
}

function openEdit(row: VoicePrint) {
  player.stop()
  editing.value = { ...row }
  sheetOpen.value = true
  if (recentState.value === 'failed' || !recordings.value.length)
    loadChatHistory()
}

async function remove(row: VoicePrint) {
  sheetOpen.value = false
  const ok = await tbConfirm({
    title: t('mVp.confirm.title'),
    message: t('mVp.confirm.text', { name: nameOf(row) }),
    confirmText: t('mVp.confirm.ok'),
    cancelText: t('common.cancel'),
    danger: true,
  })
  if (!ok)
    return
  if (player.playingId.value === row.audioId)
    player.stop()
  try {
    await deleteVoicePrint(row.id)
    toast.success(t('mVp.deleted'))
    await loadVoicePrintList()
  }
  catch (error) {
    console.error('Failed to delete speaker:', error)
    if (!serverSaid(error))
      toast.error(t('mVp.deleteFailed'))
  }
}

function onRowPlay(row: VoicePrint) {
  if (!row.audioId) {
    toast.warning(t('voiceprint.audioNotExist'))
    return
  }
  player.toggle(row.audioId)
}

function goRobots() {
  uni.navigateTo({ url: '/pages/robots/index' })
}

// The character page turns its pull-down off while a sheet is open (legacy contract)
watch(sheetOpen, open => emits('update-refresher-enabled', !open))

watch(currentAgentId, (id, old) => {
  if (!id || id === old)
    return
  player.stop()
  voicePrintList.value = []
  recordings.value = []
  loaded.value = false
  refresh()
})

onHide(() => player.stop())

onMounted(async () => {
  loadSecuritySettings()
  if (currentAgentId.value) {
    refresh()
    return
  }
  await loadRobots()
  loaded.value = true // with no robot, the empty state; otherwise the watch above loads
})

defineExpose({ refresh, sheetOpen })
</script>

<template>
  <view class="vp" :class="{ 'tb-wrap': pageMode, 'is-page': pageMode }">
    <tb-page-header v-if="pageMode" :title="t('nav.voiceprint')" :description="t('mVp.desc')" back />

    <view v-if="!currentAgentId && robot.loaded" class="vp__state">
      <tb-empty face="confused" :title="t('common.noRobot')" :text="t('common.noRobotText')">
        <tb-button variant="primary" icon="robots" @click="goRobots">
          {{ t('common.goRobots') }}
        </tb-button>
      </tb-empty>
    </view>

    <block v-else>
      <tb-section :title="t('mVp.list.title')">
        <template v-if="voicePrintList.length" #actions>
          <text class="vp__count tb-num">
            {{ t('mVp.list.count', { n: num(voicePrintList.length) }) }}
          </text>
        </template>

        <view v-if="(loading || !loaded) && !voicePrintList.length" class="vp__state">
          <tb-loading :label="t('mVp.loading')" />
        </view>

        <view v-else-if="failed && !voicePrintList.length" class="vp__state vp__fail" role="alert">
          <text>{{ t('common.loadFailed') }}</text>
          <tb-button size="s" icon="refresh" @click="refresh">
            {{ t('common.retry') }}
          </tb-button>
        </view>

        <tb-empty v-else-if="!voicePrintList.length" face="awake" :title="t('mVp.empty.title')" :text="t('mVp.empty.text')">
          <tb-button variant="primary" icon="plus" :loading="opening" @click="openAdd">
            {{ t('mVp.add') }}
          </tb-button>
        </tb-empty>

        <block v-else>
          <view class="vp__rows" role="list" :aria-busy="loading ? 'true' : 'false'">
            <view
              v-for="row in voicePrintList" :key="row.id" class="vp-row" role="listitem"
              :class="{ 'is-playing': player.playingId.value === row.audioId }"
            >
              <view class="vp-row__top">
                <view class="vp-row__who" @click="openEdit(row)">
                  <text class="vp-row__name">
                    {{ nameOf(row) }}
                  </text>
                  <text v-if="row.introduce" class="vp-row__intro">
                    {{ row.introduce }}
                  </text>
                </view>
                <view class="vp-row__act">
                  <view class="vp-row__btn" role="button" :aria-label="t('mVp.editOf', { name: nameOf(row) })" @click="openEdit(row)">
                    <tb-icon name="edit" :size="20" />
                  </view>
                  <view class="vp-row__btn vp-row__btn--del" role="button" :aria-label="t('mVp.deleteOf', { name: nameOf(row) })" @click="remove(row)">
                    <tb-icon name="trash" :size="20" />
                  </view>
                </view>
              </view>
              <view class="vp-row__src">
                <view
                  class="vp-play" :class="{ 'is-on': player.playingId.value === row.audioId }" role="button"
                  :aria-label="playLabel(row)" :aria-pressed="player.playingId.value === row.audioId ? 'true' : 'false'"
                  @click.stop="onRowPlay(row)"
                >
                  <view v-if="player.loadingId.value === row.audioId" class="vp-play__spin" />
                  <tb-icon v-else :name="player.playingId.value === row.audioId ? 'pause' : 'play'" :size="16" />
                </view>
                <view class="vp-row__words">
                  <text class="vp-row__from">
                    {{ player.playingId.value === row.audioId ? t('mVp.playing') : t('mVp.learnedFrom') }}
                  </text>
                  <text v-if="wordsOf(row)" class="vp-row__quote">
                    “{{ wordsOf(row) }}”
                  </text>
                  <text v-else class="vp-row__nowords">
                    {{ t('mVp.noWords') }}
                  </text>
                </view>
              </view>
              <text v-if="row.createDate" class="tb-num vp-row__date">
                {{ t('mVp.added.on', { date: dateText(row.createDate, lang) }) }}
              </text>
            </view>
          </view>
          <view class="vp__add">
            <tb-button variant="primary" size="l" icon="plus" block :loading="opening" @click="openAdd">
              {{ t('mVp.add') }}
            </tb-button>
          </view>
        </block>
      </tb-section>

      <tb-section :title="t('mVp.sec.title')" :description="t('mVp.sec.desc')">
        <view class="vp-sec">
          <view class="vp-sec__row">
            <view class="vp-sec__text">
              <text class="vp-sec__title">
                {{ t('mVp.sec.smartHome') }}
              </text>
              <text class="vp-sec__desc">
                {{ t('mVp.sec.smartHomeDesc') }}
              </text>
            </view>
            <tb-switch v-model="security.requireVoiceMatchSmartHome" :aria-label="t('mVp.sec.smartHome')" />
          </view>
          <view class="vp-sec__row">
            <view class="vp-sec__text">
              <text class="vp-sec__title">
                {{ t('mVp.sec.admin') }}
              </text>
              <text class="vp-sec__desc">
                {{ t('mVp.sec.adminDesc') }}
              </text>
            </view>
            <tb-switch v-model="security.adminSpeakerOnly" :aria-label="t('mVp.sec.admin')" />
          </view>
          <view class="vp-sec__row vp-sec__row--col">
            <view class="vp-sec__head">
              <text class="vp-sec__title">
                {{ t('mVp.sec.threshold') }}
              </text>
              <text class="tb-num vp-sec__pct">
                {{ num(security.percent) }}%
              </text>
            </view>
            <slider
              class="vp-sec__slider" :value="security.percent" :min="CONFIDENCE.min" :max="CONFIDENCE.max" :step="CONFIDENCE.step"
              active-color="var(--tb-action)" background-color="var(--tb-rule-soft)" block-color="var(--tb-ink)" :block-size="22"
              :aria-label="t('mVp.sec.threshold')" @changing="onThreshold" @change="onThreshold"
            />
            <view class="tb-num vp-sec__scale">
              <text>{{ num(CONFIDENCE.min) }}% {{ t('mVp.sec.flexible') }}</text>
              <text>{{ num(CONFIDENCE.fallback) }}% {{ t('mVp.sec.default') }}</text>
              <text>{{ num(CONFIDENCE.max) }}% {{ t('mVp.sec.strict') }}</text>
            </view>
          </view>
          <text v-if="securityFailed" class="vp-sec__warn" role="alert">
            {{ t('mVp.sec.loadFailed') }}
          </text>
          <view class="vp-sec__save">
            <tb-sync v-if="securityLoaded" :state="securityDirty ? 'pending' : 'applied'" :text="securityDirty ? t('mVp.sec.unsaved') : t('mVp.sec.applied')" />
            <tb-button :loading="isSavingSecurity" :disabled="!securityDirty && !securityFailed" @click="saveSecuritySettings">
              {{ t('mVp.sec.save') }}
            </tb-button>
          </view>
        </view>
      </tb-section>

      <tb-section :title="t('mVp.how.title')">
        <view class="vp-how">
          <text>{{ t('mVp.how.pick') }}</text>
          <text>{{ t('mVp.how.source') }}</text>
          <text>{{ t('mVp.how.name') }}</text>
        </view>
      </tb-section>
    </block>

    <VoicePrintSheet
      v-model:open="sheetOpen" :agent-id="currentAgentId" :row="editing" :player="player"
      :recordings="recordings" :recent-state="recentState" @saved="loadVoicePrintList" @retry="loadChatHistory" @delete="remove"
    />
  </view>
</template>

<style lang="scss">
.vp.is-page {
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
}
.vp__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
}
.vp__fail {
  color: var(--tb-danger);
  font-size: 14px;
  text-align: center;
}
.vp__count {
  color: var(--tb-ink-2);
  font-size: 14px;
}
.vp__add {
  padding-top: 4px;
}

/* the people: ruled rows, the name as a plate over its description, then the recording it learned from */
.vp__rows {
  border-top: 3px solid var(--tb-rule);
}
.vp-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 0 16px;
  border-bottom: 1px solid var(--tb-rule-soft);
  transition: border-color var(--tb-t-hover) var(--tb-ease);
}
.vp-row:last-child {
  border-bottom-color: var(--tb-rule);
}
.vp-row__top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.vp-row__who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 4px;
}
.vp-row__name {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 20px;
  line-height: 1.2;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.vp-row__intro {
  color: var(--tb-ink-2);
  font-size: 14px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.vp-row__act {
  flex: none;
  display: flex;
  margin-right: -10px;
}
.vp-row__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--tb-ink-2);
  border-radius: 50%;
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.vp-row__btn:active {
  background: var(--tb-paper-2);
}
.vp-row__btn--del {
  color: var(--tb-danger);
}
.vp-row__src {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.vp-row__words {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.vp-row__from {
  font-size: 12px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.vp-row.is-playing .vp-row__from {
  color: var(--tb-action);
}
.vp-row__quote {
  font-size: 15px;
  line-height: 1.5;
  color: var(--tb-ink);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.vp-row__nowords {
  font-size: 14px;
  color: var(--tb-ink-3);
}
.vp-row__date {
  font-size: 13px;
  color: var(--tb-ink-2);
}

/* the security policy: ruled setting rows */
.vp-sec {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule);
}
.vp-sec__row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.vp-sec__row--col {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}
.vp-sec__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.vp-sec__title {
  font-weight: 600;
  font-size: 15px;
}
.vp-sec__desc {
  font-size: 13px;
  color: var(--tb-ink-2);
  line-height: 1.5;
}
.vp-sec__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.vp-sec__pct {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 26px;
  line-height: 1;
}
.vp-sec__slider {
  margin: 6px 4px;
}
.vp-sec__scale {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--tb-ink-2);
}
.vp-sec__scale > text:nth-child(2) {
  text-align: center;
}
.vp-sec__scale > text:last-child {
  text-align: right;
}
.vp-sec__warn {
  padding-top: 10px;
  font-size: 13px;
  color: var(--tb-danger);
}
.vp-sec__save {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 14px;
}

.vp-play {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  box-sizing: border-box;
  border: 1.5px solid var(--tb-ink);
  border-radius: 50%;
  color: var(--tb-ink);
  transition:
    background-color var(--tb-t-hover) var(--tb-ease),
    color var(--tb-t-hover) var(--tb-ease),
    border-color var(--tb-t-hover) var(--tb-ease),
    transform var(--tb-t-hover) var(--tb-ease);
}
.vp-play:active {
  transform: translateY(1px);
}
.vp-play.is-on {
  background: var(--tb-action);
  border-color: var(--tb-action);
  color: var(--tb-on-action);
}
.vp-play__spin {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: vp-spin 0.8s linear infinite;
}
@keyframes vp-spin {
  to {
    transform: rotate(360deg);
  }
}

.vp-how {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--tb-ink-2);
  font-size: 14px;
  line-height: 1.6;
}
</style>
