<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  activityAnim,
  createCanvas,
  createLiveliness,
  LIFE_DURATION,
  MEAL_CYCLE_MS,
  MEALS,
  renderActivityFrame,
  renderActivityStill,
  toSvgDataUri,
} from '@/utils/faceLook.mjs'

// TinyBot's OLED doing one daily-life activity, drawn by the same renderer as the robot's face,
// in the face window. It plays the activity once when asked (`animate` on change, or replay())
// and rests on the still frame: no endless loop. Reduced motion: the still frame only.
const props = withDefaults(defineProps<{ activity?: string, look?: any, animate?: boolean, alt?: string, width?: number }>(), {
  activity: 'exercise',
  look: null,
  animate: false,
  alt: 'TinyBot',
  width: 0,
})
const emit = defineEmits<{ (e: 'playing', v: boolean): void }>()

// OLED pixels: lit white on the black panel, whatever the theme (hardware, not a theme colour)
const ON = 'white'
const OFF = 'black'
const FRAME_MS = 60
const frame = createCanvas()
const src = ref('')
const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
let timer: ReturnType<typeof setTimeout> | undefined

function paint() {
  const uri = toSvgDataUri(frame, ON, OFF)
  if (uri !== src.value)
    src.value = uri
}
function still() {
  renderActivityStill(props.activity, props.look, frame)
  paint()
}
function stop() {
  if (timer)
    clearTimeout(timer)
  timer = undefined
  emit('playing', false)
}
/** Plays the activity once, then rests on its still frame. */
function replay() {
  stop()
  const anim = activityAnim(props.activity, 0)
  if (reduced || !anim) {
    still()
    return
  }
  const length = (MEALS as string[]).includes(props.activity)
    ? MEAL_CYCLE_MS
    : Math.min(12000, Math.max(4000, ((LIFE_DURATION as Record<string, number>)[anim] || 3) * 2000))
  const live = createLiveliness(Math.random, 0)
  const start = Date.now()
  emit('playing', true)
  const tick = () => {
    const t = Date.now() - start
    if (t >= length) {
      timer = undefined
      still()
      emit('playing', false)
      return
    }
    if (typeof document === 'undefined' || !document.hidden) {
      renderActivityFrame(props.activity, props.look, t, live, t, frame)
      paint()
    }
    timer = setTimeout(tick, FRAME_MS)
  }
  tick()
}

watch(() => props.activity, () => (props.animate ? replay() : still()))
watch(() => props.look, () => {
  if (!timer)
    still()
}, { deep: true })
onMounted(() => (props.animate ? replay() : still()))
onBeforeUnmount(stop)
defineExpose({ replay })
</script>

<template>
  <tb-face :src="src" :alt="alt" :width="width" />
</template>
