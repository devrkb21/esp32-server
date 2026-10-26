<!-- Robot-to-robot messages (owner: HOME), shown on the Messages screen: a composer for another
     robot ("অন্য রোবটে বার্তা") and the contacts this robot may message (ask, accept, rename, remove). -->
<script lang="ts" setup>
import type { ContactTarget, RobotContact } from '@/api/home/home'
import { computed, reactive, ref, watch } from 'vue'
import {
  acceptContact,
  contactTargets,
  declineContact,
  getContacts,
  removeContact,
  renameContact,
  requestContact,
  sendToRobot,
} from '@/api/home/home'
import { t } from '@/i18n'
import { tbConfirm } from '@/utils/tbConfirm'
import { toast } from '@/utils/toast'
import {
  aliasesToText,
  contactBody,
  contactProblems,
  groupContacts,
  MAX_NAME,
  MAX_TEXT,
  requestErrorKey,
  sendProblems,
  sendResultKey,
  serverMsg,
  sortTargets,
} from '../homeModel.mjs'

const props = withDefaults(defineProps<{ deviceId?: string }>(), { deviceId: '' })

const loading = ref(false)
const loaded = ref(false)
const failed = ref(false)
const robots = ref<{ deviceId: string, name: string }[]>([])
const contacts = ref<RobotContact[]>([])
const targets = ref<ContactTarget[]>([])
const groups = computed(() => groupContacts(contacts.value) as { accepted: RobotContact[], incoming: RobotContact[], outgoing: RobotContact[] })
const listed = computed(() => [...groups.value.accepted, ...groups.value.outgoing])
const targetOpts = computed(() => (sortTargets(targets.value) as ContactTarget[]).map(x => ({
  value: x.key,
  label: x.kind === 'own' ? t('mrmsg.compose.own', { name: x.name }) : x.name,
})))
const robotOpts = computed(() => robots.value.map(r => ({ value: r.deviceId, label: r.name })))
const draft = reactive({ target: '', text: '' })
const sendErrors = reactive<Record<string, string>>({})
const sending = ref(false)

async function load() {
  loading.value = true
  try {
    const [overview, list] = await Promise.all([getContacts(), props.deviceId ? contactTargets(props.deviceId) : Promise.resolve([])])
    robots.value = (overview && overview.robots) || []
    contacts.value = (overview && overview.contacts) || []
    targets.value = Array.isArray(list) ? list : []
    if (draft.target && !targets.value.some(x => x.key === draft.target))
      draft.target = ''
    if (!draft.target && targets.value.length === 1)
      draft.target = targets.value[0].key
    failed.value = false
    loaded.value = true
  }
  catch (e) {
    console.warn('[robot messages] load failed', e)
    failed.value = true
  }
  finally {
    loading.value = false
  }
}
watch(() => props.deviceId, () => load(), { immediate: true })
defineExpose({ load })

// ---- composer
async function send() {
  if (sending.value)
    return
  for (const k of Object.keys(sendErrors)) delete sendErrors[k]
  const problems = sendProblems(draft) as unknown as Record<string, string>
  if (Object.keys(problems).length) {
    Object.assign(sendErrors, problems)
    return
  }
  sending.value = true
  try {
    const r = await sendToRobot({ fromDeviceId: props.deviceId, target: draft.target, text: draft.text.trim() })
    if (r && r.ok) {
      draft.text = ''
      toast.success(t(sendResultKey(r), { name: r.to || '' }))
    }
    else {
      toast.error(t(sendResultKey(r), { name: (r && r.to) || '' }))
    }
  }
  catch (e) {
    toast.error(serverMsg(e) || t('mrmsg.send.err.unreachable'))
  }
  finally {
    sending.value = false
  }
}

// ---- ask / accept / rename
const sheet = ref(false)
const mode = ref<'ask' | 'accept' | 'rename'>('ask')
const current = ref<RobotContact | null>(null)
const form = reactive<Record<string, string>>({ deviceId: '', username: '', name: '', aliasText: '' })
const formErrors = reactive<Record<string, string>>({})
const saving = ref(false)
const busy = ref('')
function open(m: 'ask' | 'accept' | 'rename', c: RobotContact | null) {
  mode.value = m
  current.value = c
  Object.assign(form, {
    deviceId: props.deviceId || (robots.value[0] && robots.value[0].deviceId) || '',
    username: '',
    name: m === 'rename' && c ? c.name : '',
    aliasText: m === 'rename' && c ? aliasesToText(c.aliases) : '',
  })
  for (const k of Object.keys(formErrors)) delete formErrors[k]
  sheet.value = true
}
async function submit() {
  if (saving.value)
    return
  for (const k of Object.keys(formErrors)) delete formErrors[k]
  const problems = contactProblems(form, mode.value) as unknown as Record<string, string>
  if (Object.keys(problems).length) {
    Object.assign(formErrors, problems)
    return
  }
  saving.value = true
  try {
    const body = contactBody(form, mode.value)
    if (mode.value === 'ask')
      await requestContact(body)
    else if (mode.value === 'accept' && current.value)
      await acceptContact(current.value.id, body)
    else if (current.value)
      await renameContact(current.value.id, body)
    sheet.value = false
    toast.success(t(`mrmsg.form.done.${mode.value}`))
    load()
  }
  catch (e) {
    const key = requestErrorKey(e)
    if (key === 'mrmsg.err.user_not_found' || key === 'mrmsg.err.own_account')
      formErrors.username = key
    toast.error(key ? t(key) : (serverMsg(e) || t('mrmsg.send.err.unreachable')))
  }
  finally {
    saving.value = false
  }
}
async function decline(c: RobotContact) {
  busy.value = c.id
  try {
    await declineContact(c.id)
    load()
  }
  catch (e) {
    toast.error(serverMsg(e) || t('mrmsg.send.err.unreachable'))
  }
  finally {
    busy.value = ''
  }
}
async function remove(c: RobotContact) {
  const ok = await tbConfirm({ title: t('mrmsg.contacts.remove'), message: t('mrmsg.contacts.removeConfirm', { name: c.name }), confirmText: t('mrmsg.contacts.remove'), danger: true })
  if (!ok)
    return
  busy.value = c.id
  try {
    await removeContact(c.id)
    load()
  }
  catch (e) {
    toast.error(serverMsg(e) || t('mrmsg.send.err.unreachable'))
  }
  finally {
    busy.value = ''
  }
}
</script>

<template>
  <view class="rm">
    <tb-section :title="t('mrmsg.compose.title')" :description="t('mrmsg.compose.desc')" ink="message">
      <text v-if="loaded && !targets.length" class="rm__muted">
        {{ t('mrmsg.compose.none') }}
      </text>
      <block v-else-if="targets.length">
        <view class="rm-field">
          <text class="rm-field__label">
            {{ t('mrmsg.compose.to') }}
          </text>
          <tb-choice v-model="draft.target" :options="targetOpts" wrap :aria-label="t('mrmsg.compose.to')" />
          <text v-if="sendErrors.target" class="rm-field__err">
            {{ t(sendErrors.target) }}
          </text>
        </view>
        <view class="rm-field">
          <text class="rm-field__label">
            {{ t('mrmsg.compose.text') }}
          </text>
          <textarea v-model="draft.text" class="rm-area" :maxlength="MAX_TEXT" auto-height :placeholder="t('mrmsg.compose.textPlaceholder')" :aria-label="t('mrmsg.compose.text')" />
          <text v-if="sendErrors.text" class="rm-field__err">
            {{ t(sendErrors.text) }}
          </text>
          <text v-else class="rm__muted">
            {{ t('mrmsg.compose.night') }}
          </text>
        </view>
        <tb-button variant="primary" icon="send" block :loading="sending" @click="send">
          {{ t('mrmsg.compose.send') }}
        </tb-button>
      </block>
    </tb-section>

    <tb-section :title="t('mrmsg.contacts.title')" :description="t('mrmsg.contacts.desc')" ink="message">
      <view v-if="loading && !loaded" class="rm__state">
        <tb-loading :label="t('common.loading')" />
      </view>
      <view v-else-if="failed" class="rm__state rm__fail" role="alert">
        <text>{{ t('common.loadFailed') }}</text>
        <tb-button size="s" icon="refresh" @click="load">
          {{ t('common.retry') }}
        </tb-button>
      </view>
      <block v-else>
        <view v-for="c in groups.incoming" :key="c.id" class="rm-ask">
          <text class="rm-ask__text">
            {{ t('mrmsg.contacts.incoming', { owner: c.otherOwner || c.otherUsername, robot: c.otherDeviceName }) }}
          </text>
          <view class="rm-ask__acts">
            <tb-button size="s" variant="primary" @click="open('accept', c)">
              {{ t('mrmsg.contacts.accept') }}
            </tb-button>
            <tb-button size="s" variant="quiet" :loading="busy === c.id" @click="decline(c)">
              {{ t('mrmsg.contacts.decline') }}
            </tb-button>
          </view>
        </view>
        <tb-empty v-if="!listed.length && !groups.incoming.length" face="awake" :title="t('mrmsg.contacts.none')" :text="t('mrmsg.contacts.noneText')" />
        <view v-if="listed.length" class="rm-list" role="list">
          <view v-for="c in listed" :key="c.id" class="rm-row" role="listitem">
            <view class="rm-row__who">
              <text class="rm-row__name">
                {{ c.name }}
              </text>
              <text class="rm-row__meta">
                {{ c.otherOwner || c.otherUsername }} · {{ t('mrmsg.contacts.withRobot', { robot: c.myDeviceName }) }}
              </text>
              <text v-if="c.aliases && c.aliases.length" class="rm-row__meta">
                {{ c.aliases.join(', ') }}
              </text>
              <tb-sync v-if="c.status === 'pending'" state="pending" :text="t('mrmsg.contacts.waiting')" />
            </view>
            <view class="rm-row__acts">
              <view v-if="c.status === 'accepted'" class="rm-row__btn" role="button" :aria-label="t('mrmsg.contacts.rename', { name: c.name })" @click="open('rename', c)">
                <tb-icon name="edit" :size="20" />
              </view>
              <view class="rm-row__btn rm-row__btn--del" role="button" :aria-label="t('mrmsg.contacts.removeOf', { name: c.name })" @click="remove(c)">
                <tb-icon name="trash" :size="20" />
              </view>
            </view>
          </view>
        </view>
        <view class="rm__add">
          <tb-button icon="plus" @click="open('ask', null)">
            {{ t('mrmsg.contacts.add') }}
          </tb-button>
        </view>
      </block>
    </tb-section>

    <tb-sheet v-model:open="sheet" :title="t(`mrmsg.form.title.${mode}`)">
      <text v-if="mode === 'accept' && current" class="rm-sheet__lead">
        {{ t('mrmsg.contacts.incoming', { owner: current.otherOwner || current.otherUsername, robot: current.otherDeviceName }) }}
      </text>
      <view v-if="mode !== 'rename'" class="rm-field">
        <text class="rm-field__label">
          {{ t('mrmsg.form.robot') }}
        </text>
        <tb-choice v-model="form.deviceId" :options="robotOpts" wrap :aria-label="t('mrmsg.form.robot')" />
        <text v-if="formErrors.deviceId" class="rm-field__err">
          {{ t(formErrors.deviceId) }}
        </text>
      </view>
      <view v-if="mode === 'ask'" class="rm-field">
        <text class="rm-field__label">
          {{ t('mrmsg.form.username') }}
        </text>
        <tb-input v-model="form.username" :maxlength="64" :invalid="!!formErrors.username" :aria-label="t('mrmsg.form.username')" />
        <text v-if="formErrors.username" class="rm-field__err">
          {{ t(formErrors.username) }}
        </text>
      </view>
      <view class="rm-field">
        <text class="rm-field__label">
          {{ t('mrmsg.form.name') }}
        </text>
        <tb-input v-model="form.name" :maxlength="MAX_NAME" :placeholder="t('mrmsg.form.namePlaceholder')" :invalid="!!formErrors.name" :aria-label="t('mrmsg.form.name')" />
        <text v-if="formErrors.name" class="rm-field__err">
          {{ t(formErrors.name) }}
        </text>
        <text v-else class="rm__muted">
          {{ t('mrmsg.form.nameHint') }}
        </text>
      </view>
      <view class="rm-field">
        <text class="rm-field__label">
          {{ t('mrmsg.form.aliases') }}
        </text>
        <tb-input v-model="form.aliasText" :maxlength="300" :aria-label="t('mrmsg.form.aliases')" />
        <text v-if="formErrors.aliasText" class="rm-field__err">
          {{ t(formErrors.aliasText) }}
        </text>
        <text v-else class="rm__muted">
          {{ t('mrmsg.form.aliasesHint') }}
        </text>
      </view>
      <template #footer>
        <tb-button @click="sheet = false">
          {{ t('common.cancel') }}
        </tb-button>
        <tb-button variant="primary" :loading="saving" @click="submit">
          {{ t(`mrmsg.form.submit.${mode}`) }}
        </tb-button>
      </template>
    </tb-sheet>
  </view>
</template>

<style lang="scss">
.rm__muted {
  font-size: 13px;
  color: var(--tb-ink-2);
  line-height: 1.5;
}
.rm__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 0;
}
.rm__fail {
  color: var(--tb-danger);
  font-size: 14px;
}
.rm__add {
  padding-top: 8px;
}
.rm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rm-field__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tb-ink-2);
}
.rm-field__err {
  font-size: 13px;
  color: var(--tb-danger);
}
.rm-area {
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: 10px 12px;
  border: 1.5px solid var(--tb-ink-2);
  border-radius: var(--tb-radius-m);
  background: var(--tb-paper);
  color: var(--tb-message);
  font-size: 17px;
  line-height: 1.5;
}
.rm-ask {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-top: 3px solid var(--tb-message);
  border-bottom: 1px solid var(--tb-rule-soft);
}
.rm-ask__text {
  font-size: 15px;
  font-weight: 600;
  color: var(--tb-ink);
  line-height: 1.5;
}
.rm-ask__acts {
  display: flex;
  gap: 8px;
}
.rm-list {
  border-top: 3px solid var(--tb-rule);
}
.rm-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.rm-row__who {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.rm-row__name {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 17px;
  color: var(--tb-message);
  word-break: break-word;
}
.rm-row__meta {
  font-size: 13px;
  color: var(--tb-ink-2);
  word-break: break-word;
}
.rm-row__acts {
  display: flex;
}
.rm-row__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--tb-ink-2);
}
.rm-row__btn--del {
  color: var(--tb-danger);
}
.rm-sheet__lead {
  display: block;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  margin-bottom: 8px;
}
</style>
