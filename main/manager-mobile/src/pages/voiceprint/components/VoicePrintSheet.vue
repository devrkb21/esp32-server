<!-- Add or edit one voice (owner: m-voiceprint): pick the recording (play it, read its words),
     then the name and a few words about the person. The screen owns the recordings and the player. -->
<script lang="ts" setup>
import type { VoicePlayer } from '../useVoicePlayer'
import type { VoicePrint } from '@/api/voiceprint'
import { computed, reactive, ref, watch } from 'vue'
import { createVoicePrint, updateVoicePrint } from '@/api/voiceprint'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { notifyRequestError } from '@/utils/requestError'
import { toast } from '@/utils/toast'
import { filterRecordings, INTRO_MAX, NAME_MAX, payloadOf, validate, withCurrent } from '../voiceprintModel.mjs'

interface Recording { audioId: string, text: string, speaker: string }

const props = withDefaults(defineProps<{
  open?: boolean
  agentId: string
  row?: VoicePrint | null
  player: VoicePlayer
  recordings?: Recording[]
  recentState?: 'loading' | 'failed' | 'ok'
}>(), { open: false, row: null, recordings: () => [], recentState: 'ok' })

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'saved'): void
  (e: 'retry'): void
  (e: 'delete', row: VoicePrint): void
}>()

const lang = computed(() => getCurrentLanguage())
const num = (n: any) => digits(n, lang.value)

const form = reactive({ id: '', audioId: '', sourceName: '', introduce: '', createDate: '' })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const filter = ref('')
const originalAudio = ref('')
const isEdit = computed(() => !!form.id)

const list = computed(() => withCurrent(props.recordings, originalAudio.value) as Recording[])
const shown = computed(() => filterRecordings(list.value, filter.value, form.audioId) as Recording[])

function reset() {
  const r = props.row
  Object.assign(form, {
    id: r?.id || '',
    audioId: r?.audioId || '',
    sourceName: r?.sourceName || '',
    introduce: r?.introduce || '',
    createDate: r?.createDate || '',
  })
  originalAudio.value = r?.audioId || ''
  errors.value = {}
  filter.value = ''
  saving.value = false
}

watch(() => props.open, (v) => {
  if (v)
    reset()
  else
    props.player.stop()
}, { immediate: true })

function close() {
  emit('update:open', false)
}
function pick(id: string) {
  form.audioId = id
  clearError('audioId')
}
function clearError(key: string) {
  if (errors.value[key])
    errors.value = { ...errors.value, [key]: '' }
}
function errorText(key: string) {
  const k = errors.value[key]
  if (!k)
    return ''
  return t(k, { n: num(key === 'introduce' ? INTRO_MAX : NAME_MAX) })
}
function playLabel(id: string) {
  if (props.player.loadingId.value === id)
    return t('mVp.fetchingAudio')
  return props.player.playingId.value === id ? t('mVp.stop') : t('mVp.f.listenOne')
}
function onPlay(id: string) {
  if (!id) {
    toast.warning(t('voiceprint.audioNotExist'))
    return
  }
  props.player.toggle(id)
}

async function submit() {
  const found = validate(form)
  errors.value = found
  if (Object.keys(found).length)
    return
  saving.value = true
  const body = payloadOf(form, props.agentId, props.row)
  try {
    if (form.id)
      await updateVoicePrint(body as VoicePrint)
    else
      await createVoicePrint(body as any)
    toast.success(form.id ? t('mVp.updated') : t('mVp.addedToast', { name: body.sourceName }))
    emit('saved')
    close()
  }
  catch (error) {
    console.error('Failed to save speaker:', error)
    notifyRequestError(error, 'mVp.saveFailed')
  }
  finally {
    saving.value = false
  }
}

function onDelete() {
  if (props.row)
    emit('delete', props.row)
}
</script>

<template>
  <tb-sheet :open="open" :title="isEdit ? t('mVp.sheet.edit') : t('mVp.sheet.add')" @update:open="(v: boolean) => !v && close()">
    <view class="vps__field">
      <text class="vps__label">
        {{ t('mVp.f.audio') }}
      </text>
      <text class="vps__hint">
        {{ t('mVp.f.audioHint') }}
      </text>

      <view v-if="recentState === 'loading' && !list.length" class="vps__state">
        <tb-loading :label="t('mVp.f.recentLoading')" />
      </view>

      <view v-else-if="recentState === 'failed' && !list.length" class="vps__state vps__fail" role="alert">
        <text>{{ t('mVp.f.recentFailed') }}</text>
        <tb-button size="s" icon="refresh" @click="emit('retry')">
          {{ t('common.retry') }}
        </tb-button>
      </view>

      <tb-empty v-else-if="!list.length" class="vps__none" :title="t('mVp.f.noRecent.title')" :text="t('mVp.f.noRecent.text')" />

      <block v-else>
        <tb-input v-if="list.length > 6" v-model="filter" icon="search" clearable :placeholder="t('mVp.f.filter')" :aria-label="t('mVp.f.filter')" />
        <view class="vps__list" role="radiogroup" :aria-label="t('mVp.f.audio')">
          <view
            v-for="r in shown" :key="r.audioId" class="vps__rec"
            :class="{ 'is-on': form.audioId === r.audioId, 'is-playing': player.playingId.value === r.audioId }"
          >
            <view
              class="vp-play" :class="{ 'is-on': player.playingId.value === r.audioId }" role="button"
              :aria-label="playLabel(r.audioId)" :aria-pressed="player.playingId.value === r.audioId ? 'true' : 'false'"
              @click.stop="onPlay(r.audioId)"
            >
              <view v-if="player.loadingId.value === r.audioId" class="vp-play__spin" />
              <tb-icon v-else :name="player.playingId.value === r.audioId ? 'pause' : 'play'" :size="16" />
            </view>
            <view class="vps__choice" role="radio" :aria-checked="form.audioId === r.audioId ? 'true' : 'false'" @click="pick(r.audioId)">
              <view class="vps__dot" />
              <view class="vps__words">
                <text :class="{ vps__nowords: !r.text }">
                  {{ r.text || t('mVp.noWords') }}
                </text>
                <view v-if="r.speaker || r.audioId === originalAudio || player.playingId.value === r.audioId" class="vps__meta">
                  <text v-if="player.playingId.value === r.audioId" class="vps__now">
                    {{ t('mVp.playing') }}
                  </text>
                  <text v-if="r.audioId === originalAudio" class="vps__inuse">
                    {{ t('mVp.f.inUse') }}
                  </text>
                  <text v-if="r.speaker">
                    {{ t('mVp.f.heardAs', { name: r.speaker }) }}
                  </text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <text v-if="!shown.length" class="vps__hint">
          {{ t('mVp.f.filterEmpty') }}
        </text>
      </block>
      <text v-if="errors.audioId" class="vps__err" role="alert">
        {{ errorText('audioId') }}
      </text>
    </view>

    <view class="vps__field">
      <text class="vps__label">
        {{ t('mVp.f.name') }}
      </text>
      <tb-input
        v-model="form.sourceName" :maxlength="NAME_MAX" :placeholder="t('mVp.f.namePlaceholder')" :invalid="!!errors.sourceName"
        :aria-label="t('mVp.f.name')" @update:model-value="clearError('sourceName')"
      />
      <text v-if="errors.sourceName" class="vps__err" role="alert">
        {{ errorText('sourceName') }}
      </text>
    </view>

    <view class="vps__field">
      <text class="vps__label">
        {{ t('mVp.f.intro') }}
      </text>
      <textarea
        v-model="form.introduce" class="vps__area" :class="{ 'is-invalid': !!errors.introduce }" :maxlength="INTRO_MAX"
        :placeholder="t('mVp.f.introPlaceholder')" placeholder-class="vps__ph" :aria-label="t('mVp.f.intro')"
        @input="clearError('introduce')"
      />
      <view class="vps__under">
        <text v-if="errors.introduce" class="vps__err" role="alert">
          {{ errorText('introduce') }}
        </text>
        <text class="tb-num vps__count">
          {{ t('mVp.f.count', { n: num((form.introduce || '').length), max: num(INTRO_MAX) }) }}
        </text>
      </view>
    </view>

    <view v-if="isEdit" class="vps__del">
      <tb-button variant="danger" size="s" icon="trash" @click="onDelete">
        {{ t('mVp.deleteThis') }}
      </tb-button>
    </view>

    <template #footer>
      <tb-button @click="close">
        {{ t('common.cancel') }}
      </tb-button>
      <tb-button variant="primary" :loading="saving" @click="submit">
        {{ t('common.save') }}
      </tb-button>
    </template>
  </tb-sheet>
</template>

<style lang="scss">
.vps__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.vps__label {
  font-weight: 600;
  font-size: 15px;
  color: var(--tb-ink);
}
.vps__hint {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.vps__err {
  font-size: 13px;
  font-weight: 500;
  color: var(--tb-danger);
}
.vps__state {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px 0;
  border-top: 1px solid var(--tb-rule);
}
.vps__fail {
  color: var(--tb-danger);
  font-size: 14px;
}
.vps__none {
  border-top: 1px solid var(--tb-rule);
  padding: 16px 0;
}

/* the recordings: a short ruled list that scrolls inside the sheet */
.vps__list {
  max-height: 42vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-top: 1px solid var(--tb-rule);
  border-bottom: 1px solid var(--tb-rule);
}
.vps__rec {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px 6px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  transition: background-color var(--tb-t-hover) var(--tb-ease);
}
.vps__rec:last-child {
  border-bottom: 0;
}
.vps__rec.is-on {
  background: var(--tb-paper-2);
}
.vps__choice {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 44px;
  padding: 8px 6px 8px 0;
}
.vps__dot {
  flex: none;
  position: relative;
  width: 18px;
  height: 18px;
  margin-top: 3px;
  border: 1.5px solid var(--tb-ink);
  border-radius: 50%;
  transition: border-color var(--tb-t-hover) var(--tb-ease);
}
.vps__dot::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: var(--tb-orange);
  transform: scale(0);
  transition: transform var(--tb-t-fast) var(--tb-ease);
}
.vps__rec.is-on .vps__dot {
  border-color: var(--tb-orange);
}
.vps__rec.is-on .vps__dot::after {
  transform: scale(1);
}
.vps__words {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 15px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.vps__rec.is-on .vps__words > text:first-child {
  font-weight: 600;
}
.vps__nowords {
  color: var(--tb-ink-3);
}
.vps__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  font-size: 12px;
  color: var(--tb-ink-2);
}
.vps__inuse,
.vps__now {
  color: var(--tb-action);
  font-weight: 600;
}

.vps__area {
  box-sizing: border-box;
  width: 100%;
  height: 96px;
  padding: 10px 12px;
  font-size: 16px;
  line-height: 1.5;
  color: var(--tb-ink);
  background: var(--tb-paper);
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-m);
}
.vps__area.is-invalid {
  border-color: var(--tb-danger);
}
.vps__ph {
  color: var(--tb-ink-3);
}
.vps__under {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.vps__count {
  margin-left: auto;
  font-size: 12px;
  color: var(--tb-ink-3);
}
.vps__del {
  display: flex;
  padding-top: 6px;
  border-top: 1px solid var(--tb-rule-soft);
}

/* play: an outline ring in ink; while it sounds, the orange "now" fill (the screen draws the same ring on its rows) */
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
  animation: vps-spin 0.8s linear infinite;
}
@keyframes vps-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
