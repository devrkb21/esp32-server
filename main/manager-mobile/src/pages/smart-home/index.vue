<!-- Smart home (owner: HOME): Home Assistant and MQTT settings (secrets written, never read back),
     and the devices TinyBot may switch by voice, with Bangla aliases and on/off test buttons. -->
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
import type { HomeDevice, HomeResult } from '@/api/home/home'
import { onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import {
  actOnDevice,
  addDevice,
  deleteDevice,
  getIntegration,
  importHa,
  listDevices,
  saveIntegration,
  testIntegration,
  updateDevice,
} from '@/api/home/home'
import { getCurrentLanguage, t } from '@/i18n'
import { digits } from '@/utils/calendar.mjs'
import { tbConfirm } from '@/utils/tbConfirm'
import { toast } from '@/utils/toast'
import {
  deviceBody,
  deviceProblems,
  DOMAINS,
  editState,
  integrationBody,
  integrationProblems,
  needsSecretAgain,
  readIntegration,
  resultKey,
  SECRET_MASK,
  serverMsg,
  sortDevices,
  testActions,
} from './homeModel.mjs'

defineOptions({ name: 'SmartHomePage' })

const lang = computed(() => getCurrentLanguage())
const num = (n: any) => digits(n ?? '', lang.value)

const ready = ref(false)
const loading = ref(false)
const failed = ref(false)
const form = reactive<Record<string, any>>(readIntegration(null).form)
const saved = reactive({ token: false, password: false })
const errors = reactive<Record<string, string>>({})
const results = reactive<Record<string, HomeResult | null>>({ ha: null, mqtt: null })
const saving = ref('')
const testing = ref('')
const importing = ref(false)
const devices = ref<HomeDevice[]>([])
const busy = ref('')
const shown = computed(() => sortDevices(devices.value) as HomeDevice[])
const domainOptions = computed(() => DOMAINS.map(d => ({ value: d, label: t(`mhome.domain.${d}`) })))

function clearErrors() {
  for (const k of Object.keys(errors)) delete errors[k]
}
function err(key: string) {
  return errors[key] ? t(errors[key]) : ''
}

async function load() {
  loading.value = true
  try {
    const [view, list] = await Promise.all([getIntegration(), listDevices()])
    const s = readIntegration(view)
    Object.assign(form, s.form)
    Object.assign(saved, s.saved)
    devices.value = Array.isArray(list) ? list : []
    clearErrors()
    ready.value = true
    failed.value = false
  }
  catch (e) {
    console.warn('[smart home] load failed', e)
    failed.value = true
  }
  finally {
    loading.value = false
  }
}
onShow(() => load())

function resultText(part: 'ha' | 'mqtt') {
  const r = results[part]
  if (!r)
    return ''
  if (r.ok && r.version)
    return t('mhome.result.okVersion', { v: r.version })
  return t(resultKey(r.ok ? 'ok' : r.code))
}

async function save(part: 'ha' | 'mqtt') {
  if (saving.value)
    return
  const problems = integrationProblems(form, part, saved) as unknown as Record<string, string>
  if (Object.keys(problems).length) {
    Object.assign(errors, problems)
    toast.error(t('mhome.fixFields'))
    return
  }
  saving.value = part
  try {
    const view = await saveIntegration(integrationBody(form, part))
    Object.assign(saved, readIntegration(view).saved)
    if (part === 'ha')
      form.haToken = ''
    else form.mqttPassword = ''
    results[part] = null
    toast.success(t('mhome.savedToast'))
  }
  catch (e) {
    const field = needsSecretAgain(e)
    if (field) {
      errors[field] = field === 'haToken' ? 'mhome.err.tokenRequired' : 'mhome.err.hostRequired'
      toast.error(t('mhome.secretAgain'))
    }
    else {
      toast.error(serverMsg(e) || t('mhome.result.error'))
    }
  }
  finally {
    saving.value = ''
  }
}

async function test(part: 'ha' | 'mqtt') {
  if (testing.value)
    return
  testing.value = part
  try {
    results[part] = await testIntegration(part)
  }
  catch {
    results[part] = { ok: false, code: 'error' }
  }
  finally {
    testing.value = ''
  }
}

async function runImport() {
  if (importing.value)
    return
  importing.value = true
  try {
    const r = await importHa()
    if (r && r.ok) {
      if (Array.isArray(r.devices))
        devices.value = r.devices
      toast.success(r.added ? t('mhome.devices.imported', { n: num(r.added) }) : t('mhome.devices.importedNone'))
    }
    else {
      results.ha = r || { ok: false, code: 'error' }
      toast.error(t(resultKey(r && r.code)))
    }
  }
  catch (e) {
    toast.error(serverMsg(e) || t('mhome.result.error'))
  }
  finally {
    importing.value = false
  }
}

async function act(d: HomeDevice, action: string) {
  if (busy.value)
    return
  busy.value = `${d.id}:${action}`
  try {
    const r = await actOnDevice(d.id, action)
    if (r && r.ok)
      toast.success(t('mhome.devices.done', { name: d.name }))
    else toast.error(t('mhome.devices.failed', { name: d.name, why: t(resultKey(r && r.code)) }))
  }
  catch (e) {
    toast.error(serverMsg(e) || t('mhome.result.error'))
  }
  finally {
    busy.value = ''
  }
}

// ---- edit sheet
const sheet = ref(false)
const edit = reactive<Record<string, any>>(editState(null))
const editErrors = reactive<Record<string, string>>({})
const savingDevice = ref(false)
function openEdit(d: HomeDevice | null) {
  Object.assign(edit, editState(d))
  for (const k of Object.keys(editErrors)) delete editErrors[k]
  sheet.value = true
}
async function saveDevice() {
  if (savingDevice.value)
    return
  const mqtt = edit.source === 'mqtt'
  const problems = deviceProblems(edit, mqtt) as unknown as Record<string, string>
  for (const k of Object.keys(editErrors)) delete editErrors[k]
  if (Object.keys(problems).length) {
    Object.assign(editErrors, problems)
    return
  }
  savingDevice.value = true
  try {
    const body = deviceBody(edit, mqtt)
    const out = edit.id ? await updateDevice(edit.id, body) : await addDevice(body)
    const i = devices.value.findIndex(x => x.id === out.id)
    if (i >= 0)
      devices.value.splice(i, 1, out)
    else devices.value.push(out)
    sheet.value = false
    toast.success(t('mhome.savedToast'))
  }
  catch (e) {
    toast.error(serverMsg(e) || t('mhome.result.error'))
  }
  finally {
    savingDevice.value = false
  }
}
async function removeDevice() {
  const ok = await tbConfirm({ title: t('mhome.edit.delete'), message: t('mhome.edit.deleteConfirm', { name: edit.name }), confirmText: t('mhome.edit.delete'), danger: true })
  if (!ok)
    return
  try {
    await deleteDevice(edit.id)
    devices.value = devices.value.filter(x => x.id !== edit.id)
    sheet.value = false
    toast.success(t('mhome.edit.deleted'))
  }
  catch (e) {
    toast.error(serverMsg(e) || t('mhome.result.error'))
  }
}
</script>

<template>
  <view class="tb-wrap sh">
    <tb-page-header :title="t('nav.smartHome')" :description="t('mhome.desc')" back />

    <view v-if="!ready && !failed" class="sh__state">
      <tb-loading :label="t('mhome.loading')" />
    </view>
    <view v-else-if="!ready" class="sh__state">
      <tb-empty face="confused" :title="t('mhome.loadFailed')" :text="t('common.loadFailed')">
        <tb-button icon="refresh" :loading="loading" @click="load">
          {{ t('common.retry') }}
        </tb-button>
      </tb-empty>
    </view>

    <block v-else>
      <!-- What to say -->
      <view class="sh-say">
        <text class="sh-say__title">
          {{ t('mhome.say.title') }}
        </text>
        <text v-for="k in [1, 2, 3]" :key="k" class="sh-say__line">
          “{{ t(`mhome.say.${k}`) }}”
        </text>
        <text class="sh-say__note">
          {{ t('mhome.say.note') }}
        </text>
      </view>

      <!-- Devices -->
      <tb-section :title="t('mhome.devices.title')" :description="t('mhome.devices.desc')">
        <tb-empty v-if="!devices.length" face="awake" :title="t('mhome.devices.none')" :text="t('mhome.devices.noneText')" />
        <view v-else class="sh-list" role="list">
          <view v-for="d in shown" :key="d.id" class="sh-row" :class="{ 'is-off': !d.enabled }" role="listitem">
            <view class="sh-row__top">
              <view class="sh-row__who">
                <text class="sh-row__kind">
                  {{ t(`mhome.domain.${d.domain}`) }} · {{ t(`mhome.source.${d.source}`) }}
                </text>
                <text class="sh-row__name">
                  {{ d.name }}
                </text>
              </view>
              <view class="sh-row__edit" role="button" :aria-label="t('mhome.devices.edit', { name: d.name })" @click="openEdit(d)">
                <tb-icon name="edit" :size="20" />
              </view>
            </view>
            <view class="sh-row__aliases">
              <text v-for="a in d.aliases" :key="a" class="sh-row__alias">
                “{{ a }}”
              </text>
              <text v-if="!d.aliases || !d.aliases.length" class="sh-row__none">
                {{ t('mhome.devices.noAliases') }}
              </text>
              <tb-tag v-if="!d.enabled">
                {{ t('mhome.devices.voiceOff') }}
              </tb-tag>
            </view>
            <view class="sh-row__acts">
              <tb-button
                v-for="a in testActions(d.domain)" :key="a.action" size="s" :loading="busy === `${d.id}:${a.action}`"
                :disabled="!!busy" @click="act(d, a.action)"
              >
                {{ t(a.label) }}
              </tb-button>
            </view>
          </view>
        </view>
        <view class="sh__btns">
          <tb-button icon="download" :loading="importing" :disabled="!saved.token" @click="runImport">
            {{ t('mhome.devices.import') }}
          </tb-button>
          <tb-button icon="plus" @click="openEdit(null)">
            {{ t('mhome.devices.addMqtt') }}
          </tb-button>
        </view>
      </tb-section>

      <!-- Home Assistant -->
      <tb-section :title="t('mhome.ha.title')" :description="t('mhome.ha.desc')">
        <view class="sh-field">
          <text class="sh-field__label">
            {{ t('mhome.ha.url') }}
          </text>
          <tb-input v-model="form.haBaseUrl" :maxlength="300" placeholder="http://192.168.0.50:8123" :invalid="!!errors.haBaseUrl" :aria-label="t('mhome.ha.url')" @update:model-value="errors.haBaseUrl = ''" />
          <text v-if="errors.haBaseUrl" class="sh-field__err">
            {{ err('haBaseUrl') }}
          </text>
        </view>
        <view class="sh-field">
          <view class="sh-field__head">
            <text class="sh-field__label">
              {{ t('mhome.ha.token') }}
            </text>
            <text v-if="saved.token && !form.haToken" class="sh__saved">
              {{ t('mhome.saved') }}
            </text>
          </view>
          <tb-input v-model="form.haToken" type="password" :maxlength="2000" :placeholder="saved.token ? SECRET_MASK : t('mhome.notSet')" :invalid="!!errors.haToken" :aria-label="t('mhome.ha.token')" @update:model-value="errors.haToken = ''" />
          <text v-if="errors.haToken" class="sh-field__err">
            {{ err('haToken') }}
          </text>
          <text v-else class="sh-field__hint">
            {{ saved.token ? t('mhome.ha.tokenHintSaved') : t('mhome.ha.tokenHintEmpty') }}
          </text>
        </view>
        <text v-if="results.ha" class="sh-result" :class="results.ha.ok ? 'is-ok' : 'is-bad'" role="status">
          {{ resultText('ha') }}
        </text>
        <view class="sh__btns">
          <tb-button icon="wifi" :loading="testing === 'ha'" @click="test('ha')">
            {{ t('mhome.test') }}
          </tb-button>
          <tb-button variant="primary" icon="check" :loading="saving === 'ha'" @click="save('ha')">
            {{ t('mhome.save') }}
          </tb-button>
        </view>
      </tb-section>

      <!-- MQTT -->
      <tb-section :title="t('mhome.mqtt.title')" :description="t('mhome.mqtt.desc')">
        <view class="sh-pair">
          <view class="sh-field sh-pair__wide">
            <text class="sh-field__label">
              {{ t('mhome.mqtt.host') }}
            </text>
            <tb-input v-model="form.mqttHost" :maxlength="200" placeholder="192.168.0.60" :invalid="!!errors.mqttHost" :aria-label="t('mhome.mqtt.host')" @update:model-value="errors.mqttHost = ''" />
            <text v-if="errors.mqttHost" class="sh-field__err">
              {{ err('mqttHost') }}
            </text>
          </view>
          <view class="sh-field">
            <text class="sh-field__label">
              {{ t('mhome.mqtt.port') }}
            </text>
            <tb-input v-model="form.mqttPort" type="number" :maxlength="5" :invalid="!!errors.mqttPort" :aria-label="t('mhome.mqtt.port')" @update:model-value="errors.mqttPort = ''" />
            <text v-if="errors.mqttPort" class="sh-field__err">
              {{ err('mqttPort') }}
            </text>
          </view>
        </view>
        <view class="sh-field">
          <text class="sh-field__label">
            {{ t('mhome.mqtt.username') }}
          </text>
          <tb-input v-model="form.mqttUsername" :maxlength="200" :aria-label="t('mhome.mqtt.username')" />
        </view>
        <view class="sh-field">
          <view class="sh-field__head">
            <text class="sh-field__label">
              {{ t('mhome.mqtt.password') }}
            </text>
            <text v-if="saved.password && !form.mqttPassword" class="sh__saved">
              {{ t('mhome.saved') }}
            </text>
          </view>
          <tb-input v-model="form.mqttPassword" type="password" :maxlength="500" :placeholder="saved.password ? SECRET_MASK : t('mhome.notSet')" :aria-label="t('mhome.mqtt.password')" />
          <text v-if="saved.password" class="sh-field__hint">
            {{ t('mhome.mqtt.passwordHintSaved') }}
          </text>
        </view>
        <view class="sh-switch">
          <text>{{ t('mhome.mqtt.tls') }}</text>
          <tb-switch v-model="form.mqttTls" :label="t('mhome.mqtt.tls')" />
        </view>
        <text v-if="results.mqtt" class="sh-result" :class="results.mqtt.ok ? 'is-ok' : 'is-bad'" role="status">
          {{ resultText('mqtt') }}
        </text>
        <view class="sh__btns">
          <tb-button icon="wifi" :loading="testing === 'mqtt'" @click="test('mqtt')">
            {{ t('mhome.test') }}
          </tb-button>
          <tb-button variant="primary" icon="check" :loading="saving === 'mqtt'" @click="save('mqtt')">
            {{ t('mhome.save') }}
          </tb-button>
        </view>
      </tb-section>
    </block>

    <tb-sheet v-model:open="sheet" :title="edit.id ? t('mhome.edit.title') : t('mhome.edit.addTitle')">
      <view class="sh-field">
        <text class="sh-field__label">
          {{ t('mhome.edit.name') }}
        </text>
        <tb-input v-model="edit.name" :maxlength="100" :invalid="!!editErrors.name" :aria-label="t('mhome.edit.name')" />
        <text v-if="editErrors.name" class="sh-field__err">
          {{ t(editErrors.name) }}
        </text>
      </view>
      <view class="sh-field">
        <text class="sh-field__label">
          {{ t('mhome.edit.aliases') }}
        </text>
        <textarea v-model="edit.aliasText" class="sh-area" :maxlength="500" auto-height :aria-label="t('mhome.edit.aliases')" />
        <text v-if="editErrors.aliasText" class="sh-field__err">
          {{ t(editErrors.aliasText) }}
        </text>
        <text v-else class="sh-field__hint">
          {{ t('mhome.edit.aliasesHint') }}
        </text>
      </view>
      <block v-if="edit.source === 'mqtt'">
        <view class="sh-field">
          <text class="sh-field__label">
            {{ t('mhome.edit.kind') }}
          </text>
          <tb-choice v-model="edit.domain" :options="domainOptions" wrap :aria-label="t('mhome.edit.kind')" />
        </view>
        <view class="sh-field">
          <text class="sh-field__label">
            {{ t('mhome.edit.topic') }}
          </text>
          <tb-input v-model="edit.topic" :maxlength="300" placeholder="home/plug1/set" :invalid="!!editErrors.topic" :aria-label="t('mhome.edit.topic')" />
          <text v-if="editErrors.topic" class="sh-field__err">
            {{ t(editErrors.topic) }}
          </text>
        </view>
        <view class="sh-pair">
          <view class="sh-field">
            <text class="sh-field__label">
              {{ t('mhome.edit.payloadOn') }}
            </text>
            <tb-input v-model="edit.payloadOn" :maxlength="200" :aria-label="t('mhome.edit.payloadOn')" />
          </view>
          <view class="sh-field">
            <text class="sh-field__label">
              {{ t('mhome.edit.payloadOff') }}
            </text>
            <tb-input v-model="edit.payloadOff" :maxlength="200" :aria-label="t('mhome.edit.payloadOff')" />
          </view>
        </view>
      </block>
      <text v-else class="sh-field__hint">
        {{ edit.entityId }}
      </text>
      <view class="sh-switch">
        <text>{{ t('mhome.edit.enabled') }}</text>
        <tb-switch v-model="edit.enabled" :label="t('mhome.edit.enabled')" />
      </view>
      <template #footer>
        <tb-button v-if="edit.id" variant="danger" icon="trash" @click="removeDevice">
          {{ t('mhome.edit.delete') }}
        </tb-button>
        <tb-button variant="primary" :loading="savingDevice" @click="saveDevice">
          {{ t('mhome.save') }}
        </tb-button>
      </template>
    </tb-sheet>
  </view>
</template>

<style lang="scss">
.sh {
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
}
.sh__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
}
.sh__btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}
.sh__saved {
  color: var(--tb-ok);
  font-size: 13px;
  font-weight: 600;
}

.sh-say {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding: 12px 0;
  border-top: 2px solid var(--tb-rule);
  border-bottom: 1px solid var(--tb-rule-soft);
}
.sh-say__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.sh-say__line {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 19px;
  line-height: 1.35;
  color: var(--tb-ink);
}
.sh-say__note {
  font-size: 13px;
  color: var(--tb-ink-2);
}

.sh-list {
  border-top: 3px solid var(--tb-rule);
}
.sh-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.sh-row.is-off .sh-row__name {
  color: var(--tb-ink-3);
}
.sh-row__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.sh-row__who {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sh-row__kind {
  font-size: 12px;
  color: var(--tb-ink-3);
}
.sh-row__name {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 17px;
  color: var(--tb-ink);
  word-break: break-word;
}
.sh-row__edit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -8px -8px 0 0;
  color: var(--tb-ink-2);
}
.sh-row__aliases {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  font-size: 14px;
  color: var(--tb-ink-2);
}
.sh-row__none {
  font-size: 13px;
  color: var(--tb-ink-3);
}
.sh-row__acts {
  display: flex;
  gap: 8px;
}

.sh-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.sh-field__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.sh-field__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.sh-field__hint {
  font-size: 12px;
  color: var(--tb-ink-3);
  line-height: 1.5;
}
.sh-field__err {
  font-size: 13px;
  color: var(--tb-danger);
}
.sh-pair {
  display: flex;
  gap: 12px;
}
.sh-pair > .sh-field {
  flex: 1 1 0;
}
.sh-pair__wide {
  flex: 2 1 0 !important;
}
.sh-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  font-size: 15px;
  color: var(--tb-ink);
}
.sh-result {
  font-size: 14px;
}
.sh-result.is-ok {
  color: var(--tb-ok);
  font-weight: 600;
}
.sh-result.is-bad {
  color: var(--tb-danger);
}
.sh-area {
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: 10px 12px;
  border: 1.5px solid var(--tb-ink-2);
  border-radius: var(--tb-radius-m);
  background: var(--tb-paper);
  color: var(--tb-ink);
  font-size: 16px;
  line-height: 1.5;
}
</style>
