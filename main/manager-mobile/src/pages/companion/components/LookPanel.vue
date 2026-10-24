<script lang="ts" setup>
import type { FaceLook } from '@/api/companion'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { t } from '@/i18n'
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
} from '../faceLook.mjs'
import { useCompanion } from './context'

defineOptions({
  name: 'CompanionLookPanel',
})

const { dev, save } = useCompanion()

// OLED hardware colours (white pixels on a near-black panel), not theme tokens
const PIXEL_ON = '#f2f6fa'
const PIXEL_OFF = '#06080b'
const FRAME_MS = 50

type Mood = (typeof MOODS)[number]
type Choice = 'shape' | 'eyes' | 'mouth' | 'blink' | 'energy'

const moods = MOODS as Mood[]
const chatFonts = CHAT_FONTS as { id: FaceLook['chat_font'], style: 'pixel' | 'clean', px: number, strip: number }[]
const choiceRows: { key: Choice, label: string, hint?: string }[] = [
  { key: 'shape', label: 'companion.look.shapeLabel' },
  { key: 'eyes', label: 'companion.look.eyesLabel' },
  { key: 'mouth', label: 'companion.look.mouthLabel', hint: 'companion.look.mouthHint' },
]
const paceRows: { key: Choice, label: string, hint?: string }[] = [
  { key: 'blink', label: 'companion.look.blinkLabel' },
  { key: 'energy', label: 'companion.look.energyLabel', hint: 'companion.look.energyHint' },
]
const sliders: { key: 'size' | 'spacing' | 'height', label: string, step: number, ends?: [string, string] }[] = [
  { key: 'size', label: 'companion.look.size', step: 5 },
  { key: 'spacing', label: 'companion.look.spacing', step: 1, ends: ['companion.look.spacingCloser', 'companion.look.spacingWider'] },
  { key: 'height', label: 'companion.look.height', step: 1, ends: ['companion.look.heightUp', 'companion.look.heightDown'] },
]

// The saved look and a local draft that follows it until edited
const serverLook = computed<FaceLook>(() => normalizeLook(dev.value?.settings?.look) as FaceLook)
const form = ref<FaceLook>(normalizeLook(dev.value?.settings?.look) as FaceLook)
const dirty = computed(() => !sameLook(form.value, serverLook.value))
const isDefault = computed(() => isDefaultLook(form.value))
const saving = ref(false)

// a newer server look (poll, other app) replaces the draft only while nothing is edited
watch(serverLook, (look, before) => {
  if (sameLook(form.value, before))
    form.value = { ...look }
})

function choices(key: Choice): string[] {
  return LOOK_CHOICES[key] as string[]
}

function pick(key: Choice, value: string) {
  form.value = { ...form.value, [key]: value } as FaceLook
}

function pickFont(id: FaceLook['chat_font']) {
  form.value = { ...form.value, chat_font: id }
}

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n)
}

function sliderText(key: 'size' | 'spacing' | 'height') {
  const v = form.value[key]
  return key === 'size' ? t('companion.look.sizeValue', { n: v }) : signed(v)
}

function reset() {
  form.value = defaultLook() as FaceLook
}

async function saveLook() {
  if (!dirty.value || saving.value)
    return
  saving.value = true
  const look = normalizeLook(form.value) as FaceLook
  const ok = await save({ settings: { look } }, t('companion.look.saved'))
  saving.value = false
  if (ok)
    form.value = { ...serverLook.value }
}

// ---------------------------------------------------------------- preview
const mood = ref<Mood>('neutral')
const frameUri = ref('')
const frame = createCanvas()
const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
let live = createLiveliness(Math.random, Date.now())
let moodStart = Date.now()
let timer: ReturnType<typeof setTimeout> | undefined

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
  if (typeof document === 'undefined' || !document.hidden)
    draw()
  timer = setTimeout(loop, FRAME_MS)
}

function setMood(m: Mood) {
  mood.value = m
  moodStart = Date.now()
  draw()
}

watch(form, draw, { deep: true })

onMounted(() => {
  live = createLiveliness(Math.random, Date.now())
  moodStart = Date.now()
  draw()
  if (!reducedMotion)
    timer = setTimeout(loop, FRAME_MS)
})

onBeforeUnmount(() => {
  if (timer)
    clearTimeout(timer)
  timer = undefined
})
</script>

<template>
  <view v-if="dev">
    <!-- Preview -->
    <view class="nx-card look__preview">
      <view class="look__bezel">
        <image
          class="look__screen"
          :src="frameUri"
          mode="widthFix"
          role="img"
          :aria-label="t('companion.look.previewAlt', { mood: t(`companion.look.mood.${mood}`) })"
        />
      </view>
      <view class="look__moods" role="radiogroup" :aria-label="t('companion.look.moodLabel')">
        <view
          v-for="m in moods"
          :key="m"
          class="look__mood"
          :class="{ 'is-active': mood === m }"
          role="radio"
          :aria-checked="mood === m"
          @click="setMood(m)"
        >
          {{ t(`companion.look.mood.${m}`) }}
        </view>
      </view>
      <view class="nx-caption look__hint">
        {{ reducedMotion ? t('companion.look.previewStatic') : t('companion.look.previewHint') }}
      </view>
      <view v-if="!dev.online" class="nx-caption look__offline" role="status">
        {{ t('companion.look.offline') }}
      </view>
    </view>

    <!-- Eyes and mouth -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.look.title') }}
      </view>
      <view class="nx-group__body">
        <view v-for="row in choiceRows" :key="row.key" class="nx-row look__field">
          <view class="look__label">
            {{ t(row.label) }}
          </view>
          <view class="nx-segmented" role="radiogroup" :aria-label="t(row.label)">
            <view
              v-for="v in choices(row.key)"
              :key="v"
              class="nx-segmented__item"
              :class="{ 'is-active': form[row.key] === v }"
              role="radio"
              :aria-checked="form[row.key] === v"
              @click="pick(row.key, v)"
            >
              {{ t(`companion.look.${row.key}.${v}`) }}
            </view>
          </view>
          <view v-if="row.hint" class="nx-caption">
            {{ t(row.hint) }}
          </view>
        </view>

        <view v-for="s in sliders" :key="s.key" class="nx-row look__field">
          <view class="look__slider-head">
            <view class="look__label">
              {{ t(s.label) }}
            </view>
            <view class="nx-row__value nx-num">
              {{ sliderText(s.key) }}
            </view>
          </view>
          <wd-slider
            v-model="form[s.key]"
            :min="LOOK_RANGES[s.key][0]"
            :max="LOOK_RANGES[s.key][1]"
            :step="s.step"
            hide-label
            hide-min-max
          />
          <view v-if="s.ends" class="nx-caption look__ends" aria-hidden="true">
            <text>{{ t(s.ends[0]) }}</text>
            <text>{{ t(s.ends[1]) }}</text>
          </view>
        </view>

        <view class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('companion.look.blush') }}
            </view>
            <view class="nx-row__subtitle">
              {{ t('companion.look.blushHint') }}
            </view>
          </view>
          <wd-switch :model-value="form.blush" size="24px" @change="({ value }) => (form = { ...form, blush: !!value })" />
        </view>

        <view class="nx-row">
          <view class="nx-row__main">
            <view class="nx-row__title">
              {{ t('companion.look.hands') }}
            </view>
            <view class="nx-row__subtitle">
              {{ t('companion.look.handsHint') }}
            </view>
          </view>
          <wd-switch :model-value="form.hands" size="24px" @change="({ value }) => (form = { ...form, hands: !!value })" />
        </view>
      </view>
    </view>

    <!-- Behaviour -->
    <view class="nx-group">
      <view class="nx-group__body">
        <view v-for="row in paceRows" :key="row.key" class="nx-row look__field">
          <view class="look__label">
            {{ t(row.label) }}
          </view>
          <view class="nx-segmented" role="radiogroup" :aria-label="t(row.label)">
            <view
              v-for="v in choices(row.key)"
              :key="v"
              class="nx-segmented__item"
              :class="{ 'is-active': form[row.key] === v }"
              role="radio"
              :aria-checked="form[row.key] === v"
              @click="pick(row.key, v)"
            >
              {{ t(`companion.look.${row.key}.${v}`) }}
            </view>
          </view>
          <view v-if="row.hint" class="nx-caption">
            {{ t(row.hint) }}
          </view>
        </view>
      </view>
    </view>

    <!-- Chat font -->
    <view class="nx-group">
      <view class="nx-group__header">
        {{ t('companion.look.fontLabel') }}
      </view>
      <view class="nx-group__body">
        <view class="nx-row look__field">
          <view class="nx-caption">
            {{ t('companion.look.fontHint') }}
          </view>
          <view class="look__fonts" role="radiogroup" :aria-label="t('companion.look.fontLabel')">
            <view
              v-for="f in chatFonts"
              :key="f.id"
              class="look__font"
              :class="{ 'is-active': form.chat_font === f.id }"
              role="radio"
              :aria-checked="form.chat_font === f.id"
              @click="pickFont(f.id)"
            >
              <!-- 128 px wide black strip, drawn at 2x: an approximation of the robot's subtitle -->
              <view class="look__font-strip" aria-hidden="true">
                <view
                  class="look__font-line"
                  :class="`is-${f.style}`"
                  :style="{ height: `${f.strip}px`, lineHeight: `${f.strip}px`, fontSize: `${f.px}px` }"
                >
                  {{ CHAT_FONT_SAMPLE }}
                </view>
              </view>
              <view class="look__font-name">
                {{ t(`companion.look.font.${f.id}`) }}
              </view>
              <view class="nx-caption">
                {{ t(`companion.look.fontStyle.${f.style}`) }} · {{ t('companion.look.fontSize', { n: f.px }) }}
              </view>
            </view>
          </view>
          <view class="nx-caption">
            {{ t('companion.look.fontApprox') }}
          </view>
        </view>
      </view>
    </view>

    <view class="look__actions">
      <view v-if="dirty" class="look__unsaved" role="status">
        {{ t('companion.look.unsaved') }}
      </view>
      <wd-button block :loading="saving" :disabled="!dirty" @click="saveLook">
        {{ t('companion.look.save') }}
      </wd-button>
      <wd-button type="info" plain block :disabled="isDefault || saving" @click="reset">
        {{ t('companion.look.reset') }}
      </wd-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.look {
  &__preview {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-3);
    margin-bottom: var(--nx-space-4);
  }

  &__bezel {
    padding: var(--nx-space-2);
    border-radius: var(--nx-radius-lg);
    background: #15181d; // robot bezel, hardware colour
  }

  &__screen {
    display: block;
    width: 100%;
    border-radius: var(--nx-radius-sm);
    background: #06080b;
    image-rendering: pixelated;
  }

  &__moods {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--nx-space-2);
  }

  &__mood {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--nx-touch);
    padding: 0 var(--nx-space-2);
    box-sizing: border-box;
    border-radius: var(--nx-radius);
    background: var(--nx-surface-3);
    color: var(--nx-text-2);
    font-size: var(--nx-text-footnote);
    font-weight: 500;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.is-active {
      background: var(--nx-accent-soft);
      color: var(--nx-accent);
    }
  }

  &__hint,
  &__offline {
    line-height: 1.4;
  }

  &__offline {
    color: var(--nx-warning);
  }

  &__field {
    flex-direction: column;
    align-items: stretch;
    gap: var(--nx-space-2);
  }

  &__label {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }

  &__slider-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__ends {
    display: flex;
    justify-content: space-between;
  }

  // Chat font tiles: the sample sits on a 128 px black strip (the OLED is 128 px wide), shown at 2x
  &__fonts {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-2);
  }

  &__font {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-1);
    padding: var(--nx-space-2);
    border: 1px solid var(--nx-border);
    border-radius: var(--nx-radius);
    background: var(--nx-surface);

    &.is-active {
      border-color: var(--nx-accent);
      background: var(--nx-accent-soft);
    }
  }

  &__font-strip {
    width: 256px;
    max-width: 100%;
    height: 44px; // tallest strip (22 px) at 2x
    overflow: hidden;
    border-radius: var(--nx-radius-sm);
    background: #06080b; // OLED panel, hardware colour
  }

  &__font-line {
    display: flex;
    align-items: center;
    justify-content: safe center;
    width: 128px;
    overflow: hidden;
    white-space: nowrap;
    color: #f2f6fa; // lit OLED pixels, hardware colour
    background: #000;
    transform: scale(2);
    transform-origin: 0 0;
    image-rendering: pixelated;
    -webkit-font-smoothing: none;

    &.is-pixel {
      font-family: 'Cascadia Mono', Consolas, 'Lucida Console', 'Courier New', monospace;
    }

    &.is-clean {
      font-family: Montserrat, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
  }

  &__font-name {
    font-size: var(--nx-text-callout);
    font-weight: 600;
    color: var(--nx-text);
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-2);
    margin-top: var(--nx-space-3);
  }

  &__unsaved {
    font-size: var(--nx-text-caption);
    font-weight: 600;
    color: var(--nx-warning);
    text-align: center;
  }
}
</style>
