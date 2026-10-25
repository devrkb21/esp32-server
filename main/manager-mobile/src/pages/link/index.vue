<!-- Link a robot to the account: opened by a scanned QR or "add with a code" on Robots (?code=123456) -->
<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationStyle": "custom",
    "navigationBarTitleText": "Link your robot"
  }
}
</route>

<script lang="ts" setup>
import type { Agent } from '@/api/agent/types'
import type { LinkInfo, LinkResult } from '@/api/device'
import { onLoad } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import { getAgentList } from '@/api/agent/agent'
import { getLinkInfo, linkDevice } from '@/api/device'
import { getCurrentLanguage, initI18n, t } from '@/i18n'
import AuthFrame from '@/pages/login/components/auth-frame.vue'
import { digits } from '@/utils/calendar.mjs'
import { codeFromScan, codeFromText, errorCodeOf, linkErrorKind, linkPagePath, linkPlan } from '@/utils/linkCode.mjs'
import { loadRobots, robot, selectRobot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'

defineOptions({ name: 'LinkPage' })

initI18n()

// Signed out: sign in (the login page brings the owner back here). Signed in: look the code up
// (GET /device/link/{code}); with 0 or 1 characters link right away, with more let the owner pick
// one (POST /device/link). On success the robot becomes "this robot" and Today opens.
type State = 'guest' | 'enter' | 'looking' | 'choose' | 'linking' | 'done' | 'error'

const lang = computed(() => getCurrentLanguage())
const num = (n: number) => digits(n, lang.value)

function hasToken() {
  try {
    return Boolean(JSON.parse(uni.getStorageSync('token') || '{}').token)
  }
  catch {
    return false
  }
}

const signedIn = ref(hasToken())
const code = ref('')
const raw = ref('') // what the hidden field holds (may briefly be longer than the code)
const state = ref<State>('enter')
const info = ref<LinkInfo | null>(null)
const agents = ref<Agent[]>([])
const pick = ref('')
const errorKind = ref('')
const lastStep = ref<'lookup' | 'link'>('lookup')
const focused = ref(false)
const focusField = ref(false)
let seq = 0 // only the newest request may change the screen

const busy = computed(() => state.value === 'looking' || state.value === 'linking')
const canRetry = computed(() => ['failed', 'agents', 'denied', 'auth'].includes(errorKind.value))
const productLabel = computed(() => {
  const i: any = info.value || {}
  const name = lang.value === 'bn' ? (i.productNameBn || i.productNameEn) : (i.productNameEn || i.productNameBn)
  return name || t('link.robotFallback')
})
const title = computed(() => ({
  enter: t('link.enter.title'),
  choose: t('link.choose.title'),
  error: t('link.err.title'),
} as Record<string, string>)[state.value] || t('link.title'))
const lead = computed(() => ({
  enter: t('link.enter.lead'),
  choose: t('link.choose.lead'),
  guest: t('link.signInLead'),
  error: '',
} as Record<string, string>)[state.value] ?? t('link.lead'))
const mood = computed(() => ({
  guest: 'sleepy',
  enter: code.value ? 'awake' : 'sleepy',
  done: 'happy',
  error: 'confused',
} as Record<string, string>)[state.value] || 'awake')
const pickedName = computed(() => agents.value.find(a => a.id === pick.value)?.agentName || '')
const waitText = computed(() => {
  if (state.value === 'looking')
    return t('link.looking')
  return pickedName.value && agents.value.length > 1 ? t('link.linkingInto', { name: pickedName.value }) : t('link.linking')
})
const errorText = computed(() => {
  const known: Record<string, string> = { format: 'link.err.format', expired: 'link.err.expired', taken: 'link.err.taken', denied: 'link.err.denied', agents: 'link.err.agents' }
  return t(known[errorKind.value] || 'link.err.failed')
})
const cells = computed(() => Array.from({ length: 6 }, (_, i) => (code.value[i] === undefined ? '' : num(Number(code.value[i])))))
const active = computed(() => Math.min(code.value.length, 5))
const canScan = ref(false)
// #ifdef APP-PLUS
canScan.value = true
// #endif

function fail(kind: string) {
  errorKind.value = kind
  state.value = 'error'
}

async function lookup() {
  if (code.value.length !== 6) {
    state.value = 'enter'
    return
  }
  const my = ++seq
  lastStep.value = 'lookup'
  errorKind.value = ''
  state.value = 'looking'
  const [found, mine] = await Promise.allSettled([getLinkInfo(code.value), getAgentList()])
  if (my !== seq)
    return
  if (found.status === 'rejected') {
    info.value = null
    fail(linkErrorKind(errorCodeOf(found.reason)))
    return
  }
  info.value = found.value
  if (mine.status === 'rejected') {
    fail('agents')
    return
  }
  agents.value = Array.isArray(mine.value) ? mine.value : []
  if (linkPlan(agents.value.length) === 'auto') {
    pick.value = ''
    link()
    return
  }
  if (!agents.value.some(a => a.id === pick.value))
    pick.value = agents.value.some(a => a.id === robot.agentId) ? robot.agentId : agents.value[0].id
  state.value = 'choose'
}

async function link() {
  const my = ++seq
  lastStep.value = 'link'
  errorKind.value = ''
  state.value = 'linking'
  const body: { code: string, agentId?: string } = { code: code.value }
  if (agents.value.length > 1 && pick.value)
    body.agentId = pick.value
  try {
    const result = await linkDevice(body)
    if (my !== seq)
      return
    finish(result)
  }
  catch (e) {
    if (my !== seq)
      return
    const kind = linkErrorKind(errorCodeOf(e))
    // The account gained characters since we looked: ask which one.
    if (kind === 'choose')
      lookup()
    else fail(kind)
  }
}

async function finish(result: LinkResult) {
  state.value = 'done'
  const i: any = info.value || {}
  toast.success(result?.agentCreated ? t('link.doneNew') : t('link.done'))
  if (result?.deviceId) {
    selectRobot({
      deviceId: result.deviceId,
      agentId: result.agentId,
      name: '',
      productKey: i.productKey || undefined,
      productName: i.productNameEn || undefined,
      productNameBn: i.productNameBn || undefined,
    })
  }
  try {
    await loadRobots(true)
  }
  catch {}
  uni.reLaunch({ url: '/pages/index/index' })
}

function retry() {
  if (lastStep.value === 'link' && info.value)
    link()
  else lookup()
}

function setCode(next: string) {
  if (next === code.value)
    return
  code.value = next
  if (!signedIn.value || state.value === 'linking' || state.value === 'done')
    return
  if (next.length === 6) {
    lookup()
    return
  }
  seq++
  info.value = null
  errorKind.value = ''
  state.value = 'enter'
}

function onInput(e: any) {
  const value = String(e?.detail?.value ?? '')
  const next = codeFromText(value)
  // take what was typed, then settle on the clean code so the hidden field holds just that
  raw.value = value
  nextTick(() => {
    raw.value = next
  })
  setCode(next)
}

function manual() {
  seq++
  raw.value = ''
  code.value = ''
  info.value = null
  errorKind.value = ''
  state.value = signedIn.value ? 'enter' : 'guest'
  focusField.value = false
  nextTick(() => {
    focusField.value = true
  })
}

function pickAgent(id: string) {
  pick.value = id
}

function signIn() {
  const back = linkPagePath(code.value.length === 6 ? code.value : '')
  uni.navigateTo({ url: `/pages/login/index?redirect=${encodeURIComponent(back)}` })
}
function register() {
  const back = linkPagePath(code.value.length === 6 ? code.value : '')
  uni.navigateTo({ url: `/pages/register/index?redirect=${encodeURIComponent(back)}` })
}
function goRobots() {
  uni.reLaunch({ url: '/pages/robots/index' })
}

function scan() {
  // #ifdef APP-PLUS
  uni.scanCode({
    scanType: ['qrCode'],
    success: (res) => {
      const next = codeFromScan(res.result)
      if (!next) {
        toast.warning(t('link.scanWrong'))
        return
      }
      raw.value = next
      if (next === code.value && signedIn.value)
        lookup()
      else setCode(next)
    },
  })
  // #endif
}

onLoad((options?: Record<string, string>) => {
  const first = codeFromText(options?.code ? decodeURIComponent(options.code) : '')
  code.value = first
  raw.value = first
  if (!signedIn.value) {
    state.value = 'guest'
    return
  }
  if (first.length === 6) {
    lookup()
  }
  else {
    state.value = 'enter'
    focusField.value = true
  }
})
</script>

<template>
  <AuthFrame :title="title" :lead="lead" :mood="mood" :pulse="state === 'linking'">
    <view class="lk" :aria-busy="busy ? 'true' : 'false'">
      <!-- The robot being linked: its product (once the code is known) and the code, editable -->
      <view class="lk-robot">
        <view v-if="info" class="lk-robot__head">
          <text class="lk-robot__name">
            {{ productLabel }}
          </text>
          <text v-if="info.macTail" class="lk-robot__mac tb-num">
            {{ t('link.macTail', { tail: info.macTail }) }}
          </text>
        </view>
        <text class="lk-robot__label">
          {{ t('link.codeLabel') }}
        </text>
        <view class="lk-code" :class="{ 'is-focus': focused, 'is-invalid': errorKind === 'format' || errorKind === 'expired' }">
          <view v-for="(c, i) in cells" :key="i" class="lk-code__cell" :class="{ 'is-active': focused && i === active }" aria-hidden="true">
            <text>{{ c }}</text>
          </view>
          <input
            class="lk-code__input" type="text" inputmode="numeric" :value="raw" :maxlength="-1" :focus="focusField"
            :disabled="state === 'linking' || state === 'done'" :aria-label="t('link.codeLabel')" confirm-type="go"
            @input="onInput" @focus="focused = true" @blur="focused = false; focusField = false"
            @confirm="state === 'choose' ? link() : (signedIn && code.length === 6 && !busy ? lookup() : null)"
          >
        </view>
        <text class="lk-robot__hint">
          {{ t('link.codeHint') }}
        </text>
      </view>

      <!-- Signed out: sign in (or make an account), then come back here -->
      <view v-if="state === 'guest'" class="lk-step">
        <text class="lk-step__text">
          {{ t('link.guest.text') }}
        </text>
        <tb-button variant="primary" size="l" icon="user" block @click="signIn">
          {{ t('link.guest.signIn') }}
        </tb-button>
        <tb-button variant="quiet" block @click="register">
          {{ t('link.guest.register') }}
        </tb-button>
      </view>

      <!-- No full code yet -->
      <view v-else-if="state === 'enter'" class="lk-step">
        <tb-button variant="primary" size="l" icon="search" block :disabled="code.length !== 6" @click="lookup">
          {{ t('link.enter.next') }}
        </tb-button>
        <tb-button v-if="canScan" icon="qr" block @click="scan">
          {{ t('link.scan') }}
        </tb-button>
      </view>

      <!-- Working: looking the code up, or linking -->
      <view v-else-if="state === 'looking' || state === 'linking' || state === 'done'" class="lk-step lk-step--wait">
        <tb-loading :label="waitText" />
      </view>

      <!-- Several characters: which one should the robot be? -->
      <view v-else-if="state === 'choose'" class="lk-step">
        <view class="lk-agents" role="radiogroup" :aria-label="t('link.choose.legend')">
          <text class="lk-agents__legend">
            {{ t('link.choose.legend') }}
          </text>
          <view
            v-for="a in agents" :key="a.id" class="lk-agent" :class="{ 'is-picked': pick === a.id }" role="radio"
            :aria-checked="pick === a.id ? 'true' : 'false'" hover-class="is-press" @click="pickAgent(a.id)"
          >
            <view class="lk-agent__mark" />
            <text class="lk-agent__name">
              {{ a.agentName }}
            </text>
            <text class="tb-num lk-agent__meta">
              {{ t('link.choose.robots', { n: num(Number(a.deviceCount) || 0) }) }}
            </text>
          </view>
        </view>
        <tb-button variant="primary" size="l" icon="link" block :disabled="!pick" @click="link">
          {{ t('link.submit') }}
        </tb-button>
      </view>

      <!-- Something went wrong: say what, in plain words, and what to do -->
      <view v-else-if="state === 'error'" class="lk-step" role="alert">
        <view class="lk-alert">
          <tb-icon name="warning" :size="18" />
          <text>{{ errorText }}</text>
        </view>
        <!-- A wrong or old code: typing the new one is the way on. A failed request: try again. -->
        <tb-button v-if="errorKind === 'taken'" variant="primary" size="l" icon="robots" block @click="goRobots">
          {{ t('link.toRobots') }}
        </tb-button>
        <tb-button v-else-if="canRetry" variant="primary" size="l" icon="refresh" block @click="retry">
          {{ t('link.retry') }}
        </tb-button>
        <tb-button :variant="errorKind === 'taken' || canRetry ? 'secondary' : 'primary'" size="l" icon="edit" block @click="manual">
          {{ t('link.manual') }}
        </tb-button>
      </view>
    </view>

    <template v-if="signedIn && state !== 'done'" #foot>
      <view class="lk-back" role="link" hover-class="is-press" @click="goRobots">
        <tb-icon name="chevron-left" :size="16" />
        <text>{{ t('link.back') }}</text>
      </view>
    </template>
  </AuthFrame>
</template>

<style lang="scss">
.lk {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 16px;
  border-top: 3px solid var(--tb-rule);
}

.lk-robot {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lk-robot__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.lk-robot__name {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 24px;
  line-height: 1.15;
  color: var(--tb-ink);
}
.lk-robot__mac,
.lk-robot__label,
.lk-robot__hint {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.lk-robot__label {
  font-weight: 600;
}

/* six ruled cells, a heavier rule between the two halves; one real input lies over them */
.lk-code {
  position: relative;
  display: flex;
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-s);
  background: var(--tb-paper);
  transition: border-color 120ms var(--tb-ease);
}
.lk-code.is-focus {
  border-color: var(--tb-focus);
}
.lk-code.is-invalid {
  border-color: var(--tb-danger);
}
.lk-code__cell {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 30px;
  font-variant-numeric: tabular-nums;
  color: var(--tb-ink);
}
.lk-code__cell + .lk-code__cell {
  border-left: 1px solid var(--tb-rule-soft);
}
.lk-code__cell:nth-child(4) {
  border-left: 3px solid var(--tb-rule);
}
.lk-code__cell::after {
  content: '';
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: 9px;
  height: 3px;
  border-radius: 2px;
  background: var(--tb-orange);
  transform: scaleX(0);
  transition: transform 160ms var(--tb-ease);
}
.lk-code__cell.is-active::after {
  transform: scaleX(1);
}
.lk-code__input {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  opacity: 0;
  font-size: 16px;
}

.lk-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lk-step__text {
  font-size: 15px;
  color: var(--tb-ink-2);
}
.lk-step--wait {
  min-height: 52px;
  justify-content: center;
}
.lk-alert {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: var(--tb-danger);
  font-weight: 500;
  font-size: 14px;
}

.lk-agents {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--tb-rule-soft);
}
.lk-agents__legend {
  padding: 8px 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.lk-agent {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.lk-agent.is-press {
  background: var(--tb-paper-2);
}
.lk-agent__mark {
  flex: none;
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--tb-ink);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lk-agent__mark::after {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--tb-orange);
  transform: scale(0);
  transition: transform 160ms var(--tb-ease);
}
.lk-agent.is-picked .lk-agent__mark {
  border-color: var(--tb-orange);
}
.lk-agent.is-picked .lk-agent__mark::after {
  transform: scale(1);
}
.lk-agent__name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 16px;
  word-break: break-word;
}
.lk-agent__meta {
  flex: none;
  font-size: 13px;
  color: var(--tb-ink-2);
}

.lk-back {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  font-weight: 600;
  font-size: 14px;
  color: var(--tb-ink);
}
</style>
