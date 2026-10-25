<!-- Look: TinyBot's face editor and its live screen (owner: m-look). Legacy: companion LookPanel + LiveScreen. -->
<route lang="jsonc">
{
  "layout": "tabbar",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "TinyBot"
  }
}
</route>

<script lang="ts" setup>
// Edits are previewed at once on a pixel-exact simulation of the 128x64 OLED (faceLook.mjs) and
// saved with one partial settings patch { settings: { look } }; "Live from TinyBot" shows the real
// screen through the device tool self.screen.preview (components/LookLive.vue).
import type { CompanionDevice, FaceLook } from '@/api/companion'
import { onHide, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getCompanion, updateCompanionConfig } from '@/api/companion/companion'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { loadRobots, robot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'
import {
  CHAT_FONT_SAMPLE,
  CHAT_FONTS,
  createCanvas,
  createLiveliness,
  defaultLook,
  isDefaultLook,
  LOOK_CHOICES,
  LOOK_RANGES,
  MOODS,
  normalizeLook,
  renderMoodFrame,
  renderMoodStill,
  sameLook,
  toSvgDataUri,
} from '../companion/faceLook.mjs'
import LookLive from './components/LookLive.vue'

defineOptions({ name: 'LookPage' })

// OLED pixels: lit white on the face window's own black (--tb-face)
const PIXEL_ON = 'white'
const PIXEL_OFF = 'black'
const FRAME_MS = 50

type Choice = 'shape' | 'eyes' | 'mouth' | 'blink' | 'energy'
type Range = 'size' | 'spacing' | 'height'

const lang = computed(() => getCurrentLanguage())
const num = (n: number) => digits(n, lang.value)

// ------------------------------------------------------------------ data
const serverLook = ref<FaceLook>(defaultLook() as FaceLook)
const form = ref<FaceLook>(defaultLook() as FaceLook)
const online = ref<boolean | null>(null)
const loading = ref(false)
const loadError = ref(false)
const saving = ref(false)

const deviceId = computed(() => robot.deviceId)
const dirty = computed(() => !sameLook(form.value, serverLook.value))
const isDefault = computed(() => isDefaultLook(form.value))
const busy = computed(() => loading.value || saving.value)
const canSave = computed(() => !!deviceId.value && dirty.value && !loading.value && !saving.value && !loadError.value)

const sync = computed<{ state: 'applied' | 'pending' | 'off' | 'error', text: string }>(() => {
  if (!deviceId.value)
    return { state: 'off', text: t('lookPage.sync.noRobot') }
  if (loadError.value)
    return { state: 'error', text: t('lookPage.sync.error') }
  if (loading.value)
    return { state: 'pending', text: t('lookPage.sync.loading') }
  if (saving.value)
    return { state: 'pending', text: t('lookPage.sync.saving') }
  if (dirty.value)
    return { state: 'pending', text: t('lookPage.sync.dirty') }
  if (online.value === false)
    return { state: 'pending', text: t('lookPage.sync.offline') }
  return { state: 'applied', text: t('lookPage.sync.applied') }
})

/**
 * Take the server's view. A newer server look replaces the draft only while nothing is edited
 * (or when `force`, after a save or a change of robot).
 */
function applyView(view: CompanionDevice | null | undefined, force = false) {
  const look = normalizeLook(view?.settings?.look) as FaceLook
  const clean = sameLook(form.value, serverLook.value)
  online.value = view && typeof view.online === 'boolean' ? view.online : null
  serverLook.value = look
  if (force || clean)
    form.value = { ...look }
}

async function load(force = false, quiet = false) {
  const id = deviceId.value
  if (!id)
    return
  if (!quiet)
    loading.value = true
  try {
    const view = await getCompanion(id, true)
    if (id === deviceId.value) {
      applyView(view, force)
      loadError.value = false
    }
  }
  catch {
    if (!quiet)
      loadError.value = true
  }
  loading.value = false
}

async function save() {
  if (!canSave.value)
    return
  const look = normalizeLook(form.value) as FaceLook
  saving.value = true
  try {
    const view = await updateCompanionConfig(deviceId.value, { settings: { look } })
    if (view && view.settings)
      applyView(view, true)
    else
      serverLook.value = { ...look }
    toast.success(t('lookPage.saved'))
  }
  catch (e) {
    // the edits stay on screen, still unsaved, so the owner can try again. Business and HTTP
    // errors were already shown by the request layer; network errors and timeouts were not.
    const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
    if (!/^Request error|HTTP request error/.test(raw))
      toast.error(t('lookPage.saveFailed'))
  }
  saving.value = false
}

function reset() {
  form.value = defaultLook() as FaceLook
}

// ------------------------------------------------------------------ controls
function opts(key: Choice) {
  return (LOOK_CHOICES[key] as readonly string[]).map(v => ({ value: v, label: t(`lookPage.${key}.${v}`) }))
}
function set<K extends keyof FaceLook>(key: K, value: FaceLook[K]) {
  form.value = { ...form.value, [key]: value }
}
function signed(n: number) {
  return n > 0 ? `+${num(n)}` : n < 0 ? `−${num(-n)}` : num(0)
}
const sliders: { key: Range, label: string, step: number, ends?: [string, string] }[] = [
  { key: 'size', label: 'lookPage.size', step: 5 },
  { key: 'spacing', label: 'lookPage.spacing', step: 1, ends: ['lookPage.spacingCloser', 'lookPage.spacingWider'] },
  { key: 'height', label: 'lookPage.height', step: 1, ends: ['lookPage.heightUp', 'lookPage.heightDown'] },
]
function sliderText(key: Range) {
  const v = form.value[key]
  return key === 'size' ? t('lookPage.sizeValue', { n: num(v) }) : signed(v)
}
function onSlide(key: Range, e: any) {
  const v = Number(e?.detail?.value)
  if (Number.isFinite(v) && v !== form.value[key])
    set(key, v)
}
const chatFonts = CHAT_FONTS as unknown as { id: FaceLook['chat_font'], style: 'pixel' | 'clean', px: number, strip: number }[]

// ------------------------------------------------------------------ the screen
const view = ref<'preview' | 'live'>('preview')
const viewOptions = computed(() => [
  { value: 'preview', label: t('lookPage.viewPreview') },
  { value: 'live', label: t('lookPage.viewLive'), disabled: !deviceId.value || online.value === false },
])
const mood = ref<string>('neutral')
const moodOptions = computed(() => (MOODS as string[]).map(m => ({ value: m, label: t(`lookPage.mood.${m}`) })))
const frameUri = ref('')
const scale = ref(2)
const pixelSize = computed(() => ({ width: `${128 * scale.value}px`, height: `${64 * scale.value}px` }))
const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const frame = createCanvas()
let live = createLiveliness(Math.random, Date.now())
let moodStart = Date.now()
let timer: ReturnType<typeof setTimeout> | undefined
let shown = false

function draw() {
  const now = Date.now()
  if (reducedMotion)
    renderMoodStill(mood.value, form.value, frame)
  else
    renderMoodFrame(mood.value, form.value, now - moodStart, live, now, frame)
  const uri = toSvgDataUri(frame, PIXEL_ON, PIXEL_OFF)
  if (uri !== frameUri.value)
    frameUri.value = uri
}

function loop() {
  timer = undefined
  if (!shown || view.value !== 'preview')
    return
  if (typeof document === 'undefined' || !document.hidden)
    draw()
  timer = setTimeout(loop, FRAME_MS)
}

function startLoop() {
  if (timer)
    clearTimeout(timer)
  timer = undefined
  draw()
  if (!reducedMotion && shown && view.value === 'preview')
    timer = setTimeout(loop, FRAME_MS)
}

function setMood(m: string) {
  mood.value = m
  moodStart = Date.now()
  draw()
}

// the window keeps a 12 px black margin around the 128 px wide face, at a whole-number scale
function fit() {
  nextTick(() => {
    uni.createSelectorQuery().select('.look__stage').boundingClientRect((r: any) => {
      const width = r?.width || 0
      if (width)
        scale.value = Math.min(4, Math.max(1, Math.floor((width - 24) / 128)))
    }).exec()
  })
}

watch(form, draw, { deep: true })
watch(view, (v) => {
  if (v === 'preview')
    startLoop()
})
watch(online, (v) => {
  if (v === false && view.value === 'live')
    view.value = 'preview'
})
watch(deviceId, (id) => {
  if (!id && view.value === 'live')
    view.value = 'preview'
  online.value = null
  loadError.value = false
  load(true)
})

// ------------------------------------------------------------------ lifecycle
let poll: ReturnType<typeof setInterval> | undefined
let firstShow = true
const onResize = () => fit()
onShow(async () => {
  shown = true
  live = createLiveliness(Math.random, Date.now())
  moodStart = Date.now()
  startLoop()
  fit()
  uni.onWindowResize?.(onResize)
  await loadRobots()
  // first visit: the saved look; later visits refresh quietly and keep any unsaved edits
  load(firstShow, !firstShow)
  firstShow = false
  poll = setInterval(() => load(false, true), 20000)
})
onHide(() => {
  shown = false
  if (timer)
    clearTimeout(timer)
  timer = undefined
  if (poll)
    clearInterval(poll)
  uni.offWindowResize?.(onResize)
})
onBeforeUnmount(() => {
  shown = false
  if (timer)
    clearTimeout(timer)
  if (poll)
    clearInterval(poll)
})

function goRobots() {
  uni.navigateTo({ url: '/pages/robots/index' })
}
</script>

<template>
  <view class="look tb-wrap">
    <tb-page-header :title="t('nav.look')" :description="t('lookPage.desc')" />

    <view v-if="!deviceId && robot.loaded" class="look__none">
      <tb-empty face="confused" :title="t('common.noRobot')" :text="t('lookPage.noRobot')">
        <tb-button icon="robots" @click="goRobots">
          {{ t('common.goRobots') }}
        </tb-button>
      </tb-empty>
    </view>
    <view v-else-if="loadError" class="is-error look__note" role="alert">
      <tb-icon name="warning" :size="18" /><text class="look__notetext">
        {{ t('lookPage.loadFailed') }}
      </text>
      <tb-button size="s" variant="quiet" icon="refresh" @click="load(true)">
        {{ t('common.retry') }}
      </tb-button>
    </view>
    <view v-else-if="online === false" class="look__note" role="status">
      <tb-icon name="warning" :size="18" /><text class="look__notetext">
        {{ t('lookPage.offline') }}
      </text>
    </view>

    <view class="look__grid">
      <view class="look__left">
        <view class="look__stage" role="group" :aria-label="t('lookPage.stageLabel')">
          <tb-choice v-model="view" :options="viewOptions" :aria-label="t('lookPage.view')" />

          <view v-show="view === 'preview'" class="look__sim">
            <view class="look__window">
              <image
                class="look__pixels" :src="frameUri" :style="pixelSize" mode="scaleToFill" role="img"
                :aria-label="t('lookPage.previewAlt', { mood: t(`lookPage.mood.${mood}`) })"
              />
            </view>
            <tb-choice class="look__moods" :model-value="mood" :options="moodOptions" :aria-label="t('lookPage.moodLabel')" @change="setMood" />
            <text class="look__hint">
              {{ reducedMotion ? t('lookPage.previewStatic') : t('lookPage.previewHint') }}
            </text>
          </view>

          <LookLive v-if="view === 'live'" :device-id="deviceId" :scale="scale" />
          <text v-if="online === false" class="look__hint">
            {{ t('lookPage.liveOfflineNote') }}
          </text>
          <text v-else-if="deviceId && view === 'preview'" class="look__hint">
            {{ t('lookPage.liveAfterSave') }}
          </text>
        </view>

        <view class="look__savebar" :class="{ 'is-pinned': canSave || saving }">
          <tb-sync class="look__sync" :state="sync.state" :text="sync.text" />
          <tb-button variant="primary" icon="check" :disabled="!canSave" :loading="saving" @click="save">
            {{ t('lookPage.save') }}
          </tb-button>
        </view>
      </view>

      <view class="look__controls" :aria-busy="loading ? 'true' : 'false'">
        <tb-section ink="look" :title="t('lookPage.eyesTitle')" :description="t('lookPage.eyesDesc')">
          <view class="look__rows">
            <view class="look__field">
              <text class="look__label">
                {{ t('lookPage.shapeLabel') }}
              </text>
              <tb-choice
                wrap :model-value="form.shape" :options="opts('shape')" :disabled="busy" :aria-label="t('lookPage.shapeLabel')"
                @change="(v: any) => set('shape', v)"
              />
            </view>
            <view v-for="s in sliders" :key="s.key" class="look__field">
              <view class="look__fieldhead">
                <text class="look__label">
                  {{ t(s.label) }}
                </text>
                <text class="tb-num look__value">
                  {{ sliderText(s.key) }}
                </text>
              </view>
              <slider
                class="look__slider" :value="form[s.key]" :min="LOOK_RANGES[s.key][0]" :max="LOOK_RANGES[s.key][1]" :step="s.step"
                :disabled="busy" active-color="var(--tb-look)" background-color="var(--tb-rule-soft)" block-color="var(--tb-ink)" :block-size="24"
                :aria-label="t(s.label)" @changing="onSlide(s.key, $event)" @change="onSlide(s.key, $event)"
              />
              <view v-if="s.ends" class="look__ends" aria-hidden="true">
                <text>{{ t(s.ends[0]) }}</text><text>{{ t(s.ends[1]) }}</text>
              </view>
            </view>
            <view class="look__field">
              <text class="look__label">
                {{ t('lookPage.eyesLabel') }}
              </text>
              <tb-choice
                wrap :model-value="form.eyes" :options="opts('eyes')" :disabled="busy" :aria-label="t('lookPage.eyesLabel')"
                @change="(v: any) => set('eyes', v)"
              />
            </view>
          </view>
        </tb-section>

        <tb-section ink="look" :title="t('lookPage.faceTitle')" :description="t('lookPage.faceDesc')">
          <view class="look__rows">
            <view class="look__field">
              <text class="look__label">
                {{ t('lookPage.mouthLabel') }}
              </text>
              <tb-choice
                wrap :model-value="form.mouth" :options="opts('mouth')" :disabled="busy" :aria-label="t('lookPage.mouthLabel')"
                @change="(v: any) => set('mouth', v)"
              />
              <text class="look__hint">
                {{ t('lookPage.mouthHint') }}
              </text>
            </view>
            <view class="look__field is-switch">
              <view class="look__switchtext">
                <text class="look__label">
                  {{ t('lookPage.blush') }}
                </text>
                <text class="look__hint">
                  {{ t('lookPage.blushHint') }}
                </text>
              </view>
              <view class="look__switch">
                <tb-switch :model-value="form.blush" :disabled="busy" :label="t('lookPage.blush')" @change="(v: boolean) => set('blush', v)" />
              </view>
            </view>
          </view>
        </tb-section>

        <tb-section ink="look" :title="t('lookPage.lifeTitle')" :description="t('lookPage.lifeDesc')">
          <view class="look__rows">
            <view class="look__field">
              <text class="look__label">
                {{ t('lookPage.blinkLabel') }}
              </text>
              <tb-choice
                wrap :model-value="form.blink" :options="opts('blink')" :disabled="busy" :aria-label="t('lookPage.blinkLabel')"
                @change="(v: any) => set('blink', v)"
              />
            </view>
            <view class="look__field">
              <text class="look__label">
                {{ t('lookPage.energyLabel') }}
              </text>
              <tb-choice
                wrap :model-value="form.energy" :options="opts('energy')" :disabled="busy" :aria-label="t('lookPage.energyLabel')"
                @change="(v: any) => set('energy', v)"
              />
              <text class="look__hint">
                {{ t('lookPage.energyHint') }}
              </text>
            </view>
            <view class="look__field is-switch">
              <view class="look__switchtext">
                <text class="look__label">
                  {{ t('lookPage.hands') }}
                </text>
                <text class="look__hint">
                  {{ t('lookPage.handsHint') }}
                </text>
              </view>
              <view class="look__switch">
                <tb-switch :model-value="form.hands" :disabled="busy" :label="t('lookPage.hands')" @change="(v: boolean) => set('hands', v)" />
              </view>
            </view>
          </view>
        </tb-section>

        <tb-section ink="look" :title="t('lookPage.fontTitle')" :description="t('lookPage.fontDesc')">
          <view class="look__fonts" role="radiogroup" :aria-label="t('lookPage.fontTitle')">
            <view
              v-for="f in chatFonts" :key="f.id" class="look__font" role="radio"
              :class="{ 'is-on': form.chat_font === f.id, 'is-off': busy }" :aria-checked="form.chat_font === f.id ? 'true' : 'false'"
              hover-class="is-press" @click="!busy && set('chat_font', f.id)"
            >
              <!-- the robot's 128 px wide subtitle strip, drawn at 2x: an approximation of its font -->
              <view class="look__strip" aria-hidden="true">
                <view
                  class="look__stripline" :class="`is-${f.style}`"
                  :style="{ height: `${f.strip}px`, lineHeight: `${f.strip}px`, fontSize: `${f.px}px` }"
                >
                  {{ CHAT_FONT_SAMPLE }}
                </view>
              </view>
              <view class="look__fonttext">
                <text class="look__fontname">
                  {{ t(`lookPage.font.${f.id}`) }}
                </text>
                <text class="look__fontmeta">
                  {{ t(`lookPage.fontStyle.${f.style}`) }}, {{ t('lookPage.fontSize', { n: num(f.px) }) }}
                </text>
              </view>
              <tb-icon v-if="form.chat_font === f.id" class="look__fontcheck" name="check" :size="18" />
            </view>
          </view>
          <text class="look__hint">
            {{ t('lookPage.fontApprox') }}
          </text>
        </tb-section>

        <tb-section :title="t('lookPage.resetTitle')" :description="t('lookPage.resetDesc')">
          <view class="look__reset">
            <tb-button icon="refresh" :disabled="busy || isDefault" @click="reset">
              {{ t('lookPage.reset') }}
            </tb-button>
            <text v-if="isDefault" class="look__hint">
              {{ t('lookPage.isDefault') }}
            </text>
          </view>
        </tb-section>
      </view>
    </view>
  </view>
</template>

<style lang="scss">
.look {
  padding-bottom: 8px;
}
.look__none {
  padding: 8px 0 4px;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.look__note {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  font-size: 14px;
}
.look__note .tb-icon {
  color: var(--tb-look);
}
.look__note.is-error,
.look__note.is-error .tb-icon {
  color: var(--tb-danger);
}
.look__notetext {
  flex: 1 1 24ch;
  min-width: 0;
}

.look__grid {
  display: flex;
  flex-direction: column;
}
.look__left {
  display: contents;
}
.look__stage {
  order: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 18px 0 16px;
}
.look__controls {
  order: 2;
  min-width: 0;
}
.look__savebar {
  order: 3;
}
.look__sim {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* the face window: TinyBot's black OLED, the face at a whole-number pixel scale */
.look__window {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  background: var(--tb-face);
  border-radius: var(--tb-radius-s);
  overflow: hidden;
}
.look__pixels {
  display: block;
  flex: none;
  image-rendering: pixelated;
}
/* one row of moods that scrolls sideways; each label stays on one line. The row bleeds through the
   20 px gutter to the screen edge so a chip slides out of view instead of being cut at the gutter;
   the padding sits inside the scrolled content so the first and last chips still line up with it. */
.look__moods {
  margin: 0 -20px;
  width: calc(100% + 40px);
  scroll-padding: 0 20px;
}
.look__moods .uni-scroll-view {
  scroll-padding: 0 20px;
}
.look__moods .tb-choice {
  padding: 2px 20px;
}
.look__moods :deep(.tb-choice__opt) {
  flex: none;
  white-space: nowrap;
}
.look__hint {
  font-size: 13px;
  color: var(--tb-ink-2);
  line-height: 1.5;
}

/* the save bar sits in the flow; only with an unsaved change (or while saving) does it pin itself
   above the fixed bottom tab bar (3 px rule + 52 px tabs + 14 px padding), under a hairline so the
   tab bar keeps the only heavy rule */
.look__savebar {
  position: static;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  background: var(--tb-paper);
  border-top: 1px solid var(--tb-rule);
}
.look__savebar.is-pinned {
  position: sticky;
  bottom: calc(69px + env(safe-area-inset-bottom));
}
.look__sync {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  color: var(--tb-ink);
  line-height: 1.35;
}
.look__savebar .tb-btn {
  flex: none;
}

.look__rows {
  display: flex;
  flex-direction: column;
}
.look__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 14px 0;
  border-top: 1px solid var(--tb-rule-soft);
}
.look__rows > .look__field:first-child {
  border-top: 0;
  padding-top: 0;
}
.look__field.is-switch {
  flex-direction: row;
  align-items: center;
  gap: 16px;
}
.look__switchtext {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.look__switch {
  flex: none;
}
/* the switch keeps its name for screen readers; the row's own label shows it */
.look__switch :deep(.tb-switch__label) {
  display: none;
}
.look__label {
  font-weight: 600;
  font-size: 15px;
}
.look__fieldhead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.look__value {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 16px;
  color: var(--tb-look);
}
.look__slider {
  margin: 6px 12px;
}
.look__ends {
  display: flex;
  justify-content: space-between;
  margin-top: -4px;
  font-size: 12px;
  color: var(--tb-ink-2);
}

/* chat fonts: ruled rows; the sample sits on the robot's 128 px subtitle strip, shown at 2x, with
   the name and size beside it (below it when the phone is too narrow) and a check on the chosen row */
.look__fonts {
  display: flex;
  flex-direction: column;
}
.look__font {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
  min-height: 44px;
  padding: 10px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  transition: opacity var(--tb-t-hover) var(--tb-ease);
}
.look__font.is-press {
  opacity: 0.7;
}
.look__font.is-off {
  opacity: 0.5;
}
.look__fontcheck {
  flex: none;
  color: var(--tb-look);
}
.look__strip {
  flex: none;
  width: 256px;
  max-width: 100%;
  height: 44px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--tb-face);
}
.look__stripline {
  display: flex;
  align-items: center;
  justify-content: safe center;
  width: 128px;
  overflow: hidden;
  white-space: nowrap;
  color: white;
  transform: scale(2);
  transform-origin: 0 0;
  -webkit-font-smoothing: none;
}
.look__stripline.is-pixel {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace;
}
.look__stripline.is-clean {
  font-family: var(--tb-font-text);
}
.look__fonttext {
  flex: 1 1 7em;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.look__fontname {
  font-weight: 600;
  font-size: 15px;
}
.look__font.is-on .look__fontname {
  font-weight: 700;
}
.look__fontmeta {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.look__reset {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

/* wide screens: two columns, the face window and its save bar stay in view beside the controls */
@media (min-width: 900px) {
  .look__grid {
    flex-direction: row;
    gap: 48px;
    align-items: flex-start;
  }
  .look__left {
    display: flex;
    flex-direction: column;
    flex: 1.05;
    min-width: 0;
    position: sticky;
    top: 0;
  }
  .look__controls {
    flex: 1;
  }
  .look__savebar,
  .look__savebar.is-pinned {
    position: static;
  }
}
</style>
