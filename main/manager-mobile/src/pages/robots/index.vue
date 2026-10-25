<!-- Robots: every robot of the account by character; pick "this robot", add one, reach its character (owner: m-robots) -->
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
import type { Agent } from '@/api/agent/types'
import type { Device } from '@/api/device'
import { onHide, onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { createAgent, deleteAgent, getAgentList } from '@/api/agent/agent'
import { getBindDevices, getDeviceOnlineStatus } from '@/api/device'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { codeFromScan, linkPagePath } from '@/utils/linkCode.mjs'
import { productName, productOf } from '@/utils/tbProducts.mjs'
import { clearRobot, loadProducts, products, robot, selectRobot } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'
import AddRobotSheet from './components/AddRobotSheet.vue'
import { characterNameError, isOnline, keepSelection, NAME_MAX, nameMatches, parseStatus, toRobot, voiceName } from './robotsModel.mjs'
import { countText, whenText } from './robotsText'

defineOptions({ name: 'RobotsPage' })

const lang = computed(() => getCurrentLanguage())
const num = (n: number) => digits(n, lang.value)

/* ---------- data: GET /agent/list, GET /device/bind/{id}, POST /device/bind/{id} (online map) ---------- */
const agents = ref<Agent[]>([])
const devicesByAgent = reactive<Record<string, Device[]>>({})
const failedAgents = reactive<Record<string, boolean>>({})
const statusByAgent = reactive<Record<string, any>>({})
const loading = ref(true)
const loaded = ref(false)
const failed = ref(false)
const clock = ref(Date.now())

// More than one product among the account's devices: rows are grouped by product inside each
// character (with a small product heading); with one product the tag on each row is enough.
const productKeys = computed(() => new Set(agents.value.flatMap(a => (devicesByAgent[a.id] || [])
  .map(d => productOf(d, products.list).productKey))))
const multiProduct = computed(() => productKeys.value.size > 1)
function productRank(k: string) {
  const i = products.list.findIndex((p: any) => p.productKey === k)
  return i < 0 ? products.list.length : i
}
const groups = computed(() => agents.value.map((agent) => {
  const raw = devicesByAgent[agent.id]
  const status = statusByAgent[agent.id]
  let robots = (raw || []).map((d) => {
    const r = toRobot(agent, d)
    const online = isOnline(status, d)
    const known = Boolean(status)
    return {
      ...r,
      ...productOf(d, products.list),
      productHead: false,
      online,
      state: online ? 'online' : 'offline',
      stateText: online ? t('common.online') : (known ? t('common.offline') : t('robots.stateUnknown')),
      seen: r.lastConnectedAt ? t('robots.seen', { when: whenText(r.lastConnectedAt, lang.value, clock.value) }) : t('robots.never'),
    }
  })
  if (multiProduct.value) {
    robots = robots.map((r, i) => ({ r, i }))
      .sort((a, b) => (productRank(a.r.productKey) - productRank(b.r.productKey)) || a.r.productKey.localeCompare(b.r.productKey) || a.i - b.i)
      .map(({ r }, i, all) => ({ ...r, productHead: i === 0 || all[i - 1].r.productKey !== r.productKey }))
  }
  return { agent, robots, count: raw ? robots.length : (Number(agent.deviceCount) || 0), failed: Boolean(failedAgents[agent.id]) }
}))
const robotCount = computed(() => groups.value.reduce((n, g) => n + g.count, 0))
const onlineCount = computed(() => groups.value.reduce((n, g) => n + g.robots.filter(r => r.online).length, 0))
const summary = computed(() => [
  countText('robots.count.characters', groups.value.length, lang.value),
  countText('robots.count.robots', robotCount.value, lang.value),
].join(', '))

function talkedText(a: Agent) {
  return a.lastConnectedAt ? t('robots.talked', { when: whenText(a.lastConnectedAt, lang.value, clock.value) }) : t('robots.never')
}
/** The character's voice by its person name only; engine and model ids are not owner words. */
function voiceText(a: Agent) {
  const name = voiceName(a.ttsVoiceName, lang.value)
  return name ? t('robots.voice', { name }) : ''
}

function tagsOf(a: Agent) {
  return ((a as any).tags || []).map((tag: any) => tag?.tagName).filter(Boolean) as string[]
}

async function fetchDevices(id: string) {
  try {
    devicesByAgent[id] = ((await getBindDevices(id)) || []) as Device[]
    delete failedAgents[id]
  }
  catch {
    failedAgents[id] = true
  }
}
async function fetchStatus(id: string) {
  try {
    statusByAgent[id] = parseStatus(await getDeviceOnlineStatus(id))
  }
  catch {
    statusByAgent[id] = null
  }
}
async function loadDevices(id: string) {
  await fetchDevices(id)
  if (!failedAgents[id])
    fetchStatus(id)
  syncShell()
}

/** Keep the app's "this robot" in step with the list (same rule as loadRobots). */
function syncShell() {
  const list = agents.value.flatMap(a => (devicesByAgent[a.id] || []).map(d => ({ ...toRobot(a, d), board: d.board || '', ...productOf(d, products.list) })))
  robot.list = list as any
  robot.loaded = true
  const keep = keepSelection(list, robot.deviceId)
  if (!keep)
    clearRobot()
  else if (keep.deviceId !== robot.deviceId || keep.name !== robot.name || (keep as any).productKey !== robot.productKey)
    selectRobot(keep)
}

async function load(quiet = false) {
  if (!quiet)
    loading.value = true
  failed.value = false
  clock.value = Date.now()
  try {
    const [agentList] = await Promise.all([getAgentList(), loadProducts()])
    const list = (agentList || []) as Agent[]
    await Promise.all(list.map(a => fetchDevices(a.id)))
    agents.value = list
    list.forEach((a) => {
      if (!failedAgents[a.id])
        fetchStatus(a.id)
    })
    syncShell()
  }
  catch {
    if (!quiet || !agents.value.length)
      failed.value = true
  }
  loading.value = false
  loaded.value = true
}

function refreshStatus() {
  if (loading.value)
    return
  clock.value = Date.now()
  agents.value.forEach((a) => {
    if (devicesByAgent[a.id]?.length)
      fetchStatus(a.id)
  })
}

/* ---------- this robot ---------- */
function choose(r: { deviceId: string, agentId: string, name: string, agentName: string }) {
  const changed = r.deviceId !== robot.deviceId
  selectRobot(r)
  if (changed)
    toast.success(t('robots.picked', { name: r.name || r.agentName || t('nav.robotFallback') }))
  uni.switchTab({ url: '/pages/index/index' })
}
function goCharacter(id: string) {
  uni.navigateTo({ url: `/pages/agent/edit?agentId=${encodeURIComponent(id)}` })
}
function goDevices(id: string) {
  uni.navigateTo({ url: `/pages/device/index?agentId=${encodeURIComponent(id)}` })
}
function goSetup() {
  uni.navigateTo({ url: '/pages/device-config/index' })
}

/* ---------- link a robot by its code or QR (pages/link) ---------- */
// The link screen looks the code up, then links the robot to the only character, makes a first
// one, or asks which one. Scanning (native app only) opens it with the code filled in.
function goLink(code = '') {
  uni.navigateTo({ url: linkPagePath(code) })
}
function scanQr() {
  // #ifdef APP-PLUS
  uni.scanCode({
    scanType: ['qrCode'],
    success: (res) => {
      const code = codeFromScan(res.result)
      if (code)
        goLink(code)
      else toast.warning(t('link.scanWrong'))
    },
  })
  // #endif
}

/* ---------- add a robot ---------- */
const addOpen = ref(false)
const addAgentId = ref('')
function openAdd(agentId = '') {
  if (!agents.value.length) {
    openCharacter(true)
    return
  }
  addAgentId.value = agentId || (agents.value.some(a => a.id === robot.agentId) ? robot.agentId : agents.value[0].id)
  addOpen.value = true
}
function onAdded(agentId: string) {
  clock.value = Date.now()
  loadDevices(agentId)
}

/* ---------- new character (POST /agent) ---------- */
const charOpen = ref(false)
const charName = ref('')
const charError = ref('')
const charSaving = ref(false)
let thenAddRobot = false

function openCharacter(addRobotAfter: boolean) {
  thenAddRobot = addRobotAfter
  charName.value = ''
  charError.value = ''
  charOpen.value = true
}
async function submitCharacter() {
  if (charSaving.value)
    return
  const problem = characterNameError(charName.value)
  if (problem) {
    charError.value = problem === 'tooLong' ? t('robots.addChar.tooLong') : t('robots.addChar.required')
    return
  }
  const name = charName.value.trim()
  charSaving.value = true
  try {
    const before = new Set(agents.value.map(a => a.id))
    const id = await createAgent({ agentName: name })
    toast.success(t('robots.addChar.done', { name }))
    charOpen.value = false
    await load(true)
    if (thenAddRobot) {
      const made = (typeof id === 'string' && agents.value.find(a => a.id === id))
        || agents.value.find(a => !before.has(a.id) && a.agentName === name)
        || agents.value.find(a => !before.has(a.id))
      if (made)
        setTimeout(() => openAdd(made.id), 260)
    }
  }
  catch (e: any) {
    toast.error(e?.message || t('robots.addChar.failed'))
  }
  thenAddRobot = false
  charSaving.value = false
}

/* ---------- delete a character: type its name (DELETE /agent/{id}) ---------- */
const delOpen = ref(false)
const delTarget = reactive({ id: '', name: '', count: 0 })
const delText = ref('')
const deleting = ref(false)
const delMatches = computed(() => nameMatches(delText.value, delTarget.name))

function openDelete(g: { agent: Agent, count: number }) {
  if (!g.agent.id || !g.agent.agentName) {
    toast.error(t('robots.del.missing'))
    return
  }
  Object.assign(delTarget, { id: g.agent.id, name: g.agent.agentName, count: g.count })
  delText.value = ''
  delOpen.value = true
}
function onDelOpen(v: boolean) {
  if (!v && deleting.value)
    return
  delOpen.value = v
}
function noPaste() {
  toast.warning(t('robots.del.noPaste'))
}
function onDelInput(e: any) {
  delText.value = String(e?.detail?.value ?? '')
}
async function confirmDelete() {
  if (!delMatches.value || deleting.value)
    return
  deleting.value = true
  try {
    await deleteAgent(delTarget.id)
    toast.success(t('robots.del.done'))
    delete devicesByAgent[delTarget.id]
    delOpen.value = false
    delText.value = ''
    await load(true)
  }
  catch (e: any) {
    toast.error(e?.message || t('robots.del.failed'))
  }
  deleting.value = false
}

/* ---------- life ---------- */
let poll: any = null
onShow(() => {
  load(loaded.value)
  clearInterval(poll)
  poll = setInterval(refreshStatus, 30000)
})
onHide(() => clearInterval(poll))
</script>

<template>
  <view class="robots tb-wrap">
    <tb-page-header :title="t('nav.robots')" :description="t('robots.desc')" back />

    <view v-if="loading && !loaded" class="robots__state">
      <tb-loading :label="t('robots.loading')" />
    </view>

    <view v-else-if="failed" class="robots__state">
      <tb-empty face="confused" :title="t('common.loadFailed')">
        <tb-button icon="refresh" @click="load()">
          {{ t('common.retry') }}
        </tb-button>
      </tb-empty>
    </view>

    <view v-else-if="!groups.length" class="robots__state">
      <tb-empty face="awake" :title="t('robots.empty.title')" :text="t('robots.empty.linkText')">
        <!-- #ifdef APP-PLUS -->
        <tb-button variant="primary" icon="qr" @click="scanQr">
          {{ t('link.scan') }}
        </tb-button>
        <tb-button icon="edit" @click="goLink()">
          {{ t('robots.addByCode') }}
        </tb-button>
        <!-- #endif -->
        <!-- #ifndef APP-PLUS -->
        <tb-button variant="primary" icon="edit" @click="goLink()">
          {{ t('robots.addByCode') }}
        </tb-button>
        <!-- #endif -->
        <tb-button icon="agent" @click="openCharacter(true)">
          {{ t('robots.empty.action') }}
        </tb-button>
        <tb-button icon="wifi" @click="goSetup">
          {{ t('robots.setup') }}
        </tb-button>
      </tb-empty>
    </view>

    <block v-else>
      <view class="robots__sum">
        <text>{{ summary }}</text>
        <text v-if="onlineCount" class="robots__on">
          {{ t('robots.count.online', { n: num(onlineCount) }) }}
        </text>
      </view>

      <view v-for="g in groups" :key="g.agent.id" class="rb-group">
        <view class="rb-group__head">
          <text class="rb-group__name">
            {{ g.agent.agentName }}
          </text>
          <view class="rb-group__meta">
            <text class="rb-group__count">
              {{ countText('robots.count.robots', g.count, lang) }}
            </text>
            <text>{{ talkedText(g.agent) }}</text>
          </view>
          <text v-if="voiceText(g.agent)" class="rb-group__models">
            {{ voiceText(g.agent) }}
          </text>
          <view v-if="tagsOf(g.agent).length" class="rb-group__tags">
            <tb-tag v-for="tag in tagsOf(g.agent)" :key="tag">
              {{ tag }}
            </tb-tag>
          </view>
          <view class="rb-group__act">
            <tb-button size="s" icon="agent" @click="goCharacter(g.agent.id)">
              {{ t('robots.character') }}
            </tb-button>
            <tb-button size="s" icon="devices" @click="goDevices(g.agent.id)">
              {{ t('robots.devices') }}
            </tb-button>
            <view class="rb-group__del" role="button" :aria-label="t('robots.deleteFor', { name: g.agent.agentName })" @click="openDelete(g)">
              <tb-icon name="trash" :size="20" />
            </view>
          </view>
        </view>

        <block v-for="r in g.robots" :key="r.deviceId">
        <view v-if="r.productHead" class="rb-prodhead">
          <text>{{ productName(r, lang) }}</text>
        </view>
        <view class="rb-row" :class="{ 'is-current': r.deviceId === robot.deviceId }">
          <view
            class="rb-row__main" role="button" :aria-label="t('robots.pickFor', { name: r.name || g.agent.agentName })"
            hover-class="is-press" @click="choose(r)"
          >
            <tb-face v-if="r.features.includes('companion')" class="rb-row__face" :mood="r.online ? 'awake' : 'offline'" :width="72" :alt="t('robots.faceAlt', { name: r.name || g.agent.agentName })" />
            <view v-else class="rb-row__face rb-row__device" aria-hidden="true">
              <tb-icon name="devices" :size="24" />
            </view>
            <view class="rb-row__plate">
              <tb-name-plate :name="r.name || t('robots.unnamed')" :detail="r.seen" :state="r.state" :state-text="r.stateText" />
              <tb-tag class="rb-row__product">{{ productName(r, lang) }}</tb-tag>
            </view>
          </view>
          <view class="rb-row__act">
            <view v-if="r.deviceId === robot.deviceId" class="rb-now" role="status">
              <view class="rb-now__rule" /><text>{{ t('robots.current') }}</text>
            </view>
            <tb-button v-else size="s" icon="check" @click="choose(r)">
              {{ t('robots.pick') }}
            </tb-button>
          </view>
        </view>
        </block>

        <view v-if="g.failed" class="rb-note is-fail" role="alert">
          <text>{{ t('robots.devicesFailed') }}</text>
          <tb-button size="s" variant="quiet" icon="refresh" @click="loadDevices(g.agent.id)">
            {{ t('common.retry') }}
          </tb-button>
        </view>
        <view v-else-if="!g.robots.length" class="rb-note">
          <text>{{ t('robots.noneHere') }}</text>
        </view>

        <view class="rb-addrow" role="button" hover-class="is-press" @click="openAdd(g.agent.id)">
          <tb-icon name="plus" :size="18" /><text>{{ t('robots.addHere') }}</text>
        </view>
      </view>

      <tb-section class="robots__add" :title="t('robots.addSection')" :description="t('robots.addSectionDesc')">
        <!-- #ifdef APP-PLUS -->
        <tb-button variant="primary" size="l" icon="qr" block @click="scanQr">
          {{ t('link.scan') }}
        </tb-button>
        <tb-button size="l" icon="edit" block @click="goLink()">
          {{ t('robots.addByCode') }}
        </tb-button>
        <!-- #endif -->
        <!-- #ifndef APP-PLUS -->
        <tb-button variant="primary" size="l" icon="edit" block @click="goLink()">
          {{ t('robots.addByCode') }}
        </tb-button>
        <!-- #endif -->
        <view class="robots__more">
          <tb-button icon="wifi" block @click="goSetup">
            {{ t('robots.setup') }}
          </tb-button>
          <tb-button icon="agent" variant="quiet" block @click="openCharacter(false)">
            {{ t('robots.newCharacter') }}
          </tb-button>
        </view>
      </tb-section>
    </block>

    <AddRobotSheet v-model:open="addOpen" :agents="agents" :agent-id="addAgentId" @added="onAdded" />

    <!-- New character -->
    <tb-sheet v-model:open="charOpen" :title="t('robots.addChar.title')" :close-on-scrim="!charSaving">
      <view class="rb-field">
        <text class="rb-field__label">
          {{ t('robots.addChar.name') }}
        </text>
        <tb-input
          v-model="charName" :maxlength="NAME_MAX" :invalid="!!charError" :placeholder="t('robots.addChar.placeholder')"
          :aria-label="t('robots.addChar.name')" @update:model-value="charError = ''" @confirm="submitCharacter"
        />
        <view class="rb-field__foot">
          <text v-if="charError" class="rb-field__err" role="alert">
            {{ charError }}
          </text>
          <text v-else class="rb-field__hint">
            {{ t('robots.addChar.hint') }}
          </text>
          <text class="rb-field__count tb-num">
            {{ num(charName.length) }}/{{ num(NAME_MAX) }}
          </text>
        </view>
      </view>
      <template #footer>
        <tb-button :disabled="charSaving" @click="charOpen = false">
          {{ t('common.cancel') }}
        </tb-button>
        <tb-button variant="primary" :loading="charSaving" @click="submitCharacter">
          {{ t('robots.addChar.submit') }}
        </tb-button>
      </template>
    </tb-sheet>

    <!-- Delete a character: type its name, no pasting -->
    <tb-sheet :open="delOpen" :title="t('robots.del.title')" :close-on-scrim="!deleting" @update:open="onDelOpen">
      <text class="rb-del__text">
        {{ t('robots.del.text') }}
      </text>
      <text v-if="delTarget.count" class="rb-del__count">
        {{ countText('robots.del.robots', delTarget.count, lang) }}
      </text>
      <text class="rb-del__name" @copy.prevent @cut.prevent @contextmenu.prevent @longpress.prevent>
        {{ delTarget.name }}
      </text>
      <view class="rb-field">
        <text class="rb-field__label">
          {{ t('robots.del.input') }}
        </text>
        <view
          class="rb-del__box" :class="{ 'is-invalid': !!delText && !delMatches }"
          @paste.capture.prevent="noPaste" @drop.capture.prevent="noPaste" @contextmenu.prevent
        >
          <input
            class="rb-del__input" :value="delText" type="text" :maxlength="delTarget.name.length || NAME_MAX"
            :placeholder="t('robots.del.placeholder')" placeholder-class="rb-del__ph" :disabled="deleting"
            :aria-label="t('robots.del.input')" @input="onDelInput" @confirm="confirmDelete"
          >
        </view>
        <text v-if="delText && !delMatches" class="rb-field__err" role="alert">
          {{ t('robots.del.mismatch') }}
        </text>
      </view>
      <template #footer>
        <tb-button :disabled="deleting" @click="onDelOpen(false)">
          {{ t('common.cancel') }}
        </tb-button>
        <tb-button variant="danger" icon="trash" :loading="deleting" :disabled="!delMatches" @click="confirmDelete">
          {{ t('robots.del.confirm') }}
        </tb-button>
      </template>
    </tb-sheet>
  </view>
</template>

<style lang="scss">
.robots {
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
}
.robots__state {
  padding: 48px 0;
  display: flex;
  justify-content: center;
}
.robots__sum {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  padding: 12px 0 2px;
  font-size: 14px;
  color: var(--tb-ink-2);
}
.robots__on {
  color: var(--tb-ok);
  font-weight: 600;
}

/* a character: its name over a heavy rule, its robots as ruled rows beneath */
.rb-group {
  padding-top: 22px;
}
.rb-group__head {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-bottom: 12px;
  border-bottom: 3px solid var(--tb-rule);
}
.rb-group__name {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 24px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.rb-group__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  font-size: 14px;
  color: var(--tb-ink-2);
}
.rb-group__count {
  color: var(--tb-ink);
  font-weight: 600;
}
.rb-group__models {
  font-size: 13px;
  color: var(--tb-ink-3);
  overflow-wrap: anywhere;
}
.rb-group__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.rb-group__act {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.rb-group__act .tb-btn {
  --h: 40px;
}
.rb-group__del {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-left: auto;
  margin-right: -10px;
  color: var(--tb-ink-2);
}

.rb-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.rb-row__main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
  border-radius: var(--tb-radius-s);
}
.rb-row__main.is-press {
  background: var(--tb-paper-2);
}
/* tb-face pads by 6% of its container; a fixed pad keeps the small window drawn */
.rb-row__face {
  flex: none;
  padding: 4px;
}
.rb-row__plate {
  flex: 1;
  overflow-wrap: anywhere;
}
.rb-row__plate { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.rb-row__device { display: flex; align-items: center; justify-content: center; width: 72px; height: 54px; border: 1px solid var(--tb-rule); border-radius: 8px; color: var(--tb-ink-2); flex: none; }
.rb-prodhead { padding: 14px 0 4px; font-size: 13px; font-weight: 700; color: var(--tb-ink-2); border-bottom: 1px solid var(--tb-rule-soft); }
.rb-row__act {
  display: flex;
  justify-content: flex-end;
  min-height: 44px;
  align-items: center;
}
.rb-row__act .tb-btn {
  --h: 44px;
}

@media (min-width: 600px) {
  .rb-row {
    flex-direction: row;
    align-items: center;
    gap: 16px;
  }
  .rb-row__main {
    flex: 1;
  }
}

/* the current robot: the orange now-mark drawn as a rule, with its word */
.rb-now {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: var(--tb-action);
  font-weight: 700;
  font-size: 14px;
}
.rb-now__rule {
  width: 22px;
  height: 0;
  border-top: 3px solid var(--tb-orange);
}

.rb-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
  font-size: 14px;
  color: var(--tb-ink-2);
}
.rb-note.is-fail {
  color: var(--tb-danger);
}
.rb-addrow {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  font-weight: 600;
  font-size: 15px;
  color: var(--tb-ink);
  border-bottom: 1px solid var(--tb-rule);
}
.rb-addrow.is-press {
  background: var(--tb-paper-2);
}

.robots__add {
  margin-top: 28px;
  border-top: 3px solid var(--tb-rule);
}
.robots__more {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* sheets */
.rb-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rb-field__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.rb-field__foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.rb-field__hint {
  font-size: 13px;
  color: var(--tb-ink-2);
}
.rb-field__err {
  font-size: 13px;
  color: var(--tb-danger);
}
.rb-field__count {
  flex: none;
  font-size: 12px;
  color: var(--tb-ink-3);
}
.rb-del__text {
  font-size: 15px;
}
.rb-del__count {
  font-size: 14px;
  color: var(--tb-ink-2);
}
.rb-del__name {
  font-family: var(--tb-font-display);
  font-weight: 800;
  font-size: 20px;
  padding: 8px 0;
  border-top: 1px solid var(--tb-rule-soft);
  border-bottom: 1px solid var(--tb-rule-soft);
  user-select: none;
  -webkit-user-select: none;
  overflow-wrap: anywhere;
}
.rb-del__box {
  display: flex;
  align-items: center;
  min-height: 46px;
  padding: 0 12px;
  border: 1.5px solid var(--tb-ink);
  border-radius: var(--tb-radius-m);
  background: var(--tb-paper);
}
.rb-del__box.is-invalid {
  border-color: var(--tb-danger);
}
.rb-del__input {
  flex: 1;
  min-width: 0;
  height: 42px;
  font-size: 16px;
  color: var(--tb-ink);
  background: transparent;
}
.rb-del__ph {
  color: var(--tb-ink-3);
}
</style>
