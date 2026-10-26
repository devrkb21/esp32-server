<script lang="ts" setup>
import type { FamilyMember, FamilyOfDevice } from '@/api/family/family'
import { computed, ref, watch } from 'vue'
import { getFamily, inviteToFamily, removeFamilyShare, setFamilyRole } from '@/api/family/family'
import { getCurrentLanguage, t } from '@/i18n'
import { inviteTarget, roleCan, splitMembers } from '@/utils/familyModel.mjs'
import { notifyRequestError } from '@/utils/requestError'
import { tbConfirm } from '@/utils/tbConfirm'
import { loadRobots, robot, robotRole } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'
import { useRobot } from './context'

// Family (পরিবার): who this robot is shared with. The owner invites by username or phone (as a
// member or a co-owner), changes roles and removes people or cancels invites; everyone else sees
// the list read-only and can leave. Data: GET /family/device/{deviceId}.
defineOptions({ name: 'RobotFamily' })

const r = useRobot()
const lang = computed(() => getCurrentLanguage())
const family = ref<FamilyOfDevice | null>(null)
const loading = ref(false)
const failed = ref(false)
const busy = ref('')

const role = computed(() => family.value?.role || robotRole(r.deviceId.value))
const canShare = computed(() => Boolean(family.value?.canShare) && roleCan(role.value, 'share'))
const people = computed(() => splitMembers(family.value?.members))
const ownerName = computed(() => family.value?.ownerName || robot.list.find(x => x.deviceId === r.deviceId.value)?.sharedBy || '')
const myShareId = computed(() => robot.list.find(x => x.deviceId === r.deviceId.value)?.shareId || '')

function roleName(x: string) {
  return t(`family.role.${x}`)
}
function dateText(ms: number | null | undefined) {
  if (!ms)
    return ''
  return new Intl.DateTimeFormat(lang.value === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(ms))
}

async function load() {
  if (!r.deviceId.value)
    return
  loading.value = true
  failed.value = false
  try {
    family.value = await getFamily(r.deviceId.value)
  }
  catch {
    failed.value = true
  }
  loading.value = false
}
watch(() => r.deviceId.value, () => {
  family.value = null
  load()
}, { immediate: true })

// ---- invite
const open = ref(false)
const target = ref('')
const inviteRole = ref<'member' | 'co_owner'>('member')
const error = ref('')
const sending = ref(false)
const roleOptions = computed(() => [
  { value: 'member', label: roleName('member') },
  { value: 'co_owner', label: roleName('co_owner') },
])
function openInvite() {
  target.value = ''
  inviteRole.value = 'member'
  error.value = ''
  open.value = true
}
async function sendInvite() {
  if (sending.value)
    return
  const said = inviteTarget(target.value)
  if (!said.ok) {
    error.value = t(`family.err.${said.problem}`)
    return
  }
  sending.value = true
  try {
    await inviteToFamily(r.deviceId.value, said.value, inviteRole.value)
    toast.success(t('family.invited', { name: target.value.trim() }))
    open.value = false
    await load()
  }
  catch (e) {
    notifyRequestError(e, 'family.inviteFailed')
  }
  sending.value = false
}

// ---- owner actions
async function changeRole(m: FamilyMember) {
  const next = m.role === 'member' ? 'co_owner' : 'member'
  busy.value = m.id
  try {
    await setFamilyRole(m.id, next)
    toast.success(t('family.roleChanged', { name: m.name, role: roleName(next) }))
    await load()
  }
  catch (e) {
    notifyRequestError(e, 'family.loadFailed')
  }
  busy.value = ''
}
async function remove(m: FamilyMember) {
  const pending = m.status === 'pending'
  const ok = await tbConfirm({
    title: pending ? t('family.cancelTitle') : t('family.removeTitle', { name: m.name }),
    message: pending ? t('family.cancelText', { name: m.name }) : t('family.removeText'),
    confirmText: pending ? t('family.cancelInvite') : t('family.remove'),
    danger: true,
  })
  if (!ok)
    return
  busy.value = m.id
  try {
    await removeFamilyShare(m.id)
    toast.success(t('family.removed'))
    await load()
  }
  catch (e) {
    notifyRequestError(e, 'family.loadFailed')
  }
  busy.value = ''
}

// ---- leave (a member or co-owner)
async function leave() {
  if (!myShareId.value)
    return
  const ok = await tbConfirm({
    title: t('family.leaveTitle'),
    message: t('family.leaveText', { name: r.botName.value }),
    confirmText: t('family.leaveConfirm'),
    danger: true,
  })
  if (!ok)
    return
  busy.value = 'leave'
  try {
    await removeFamilyShare(myShareId.value)
    toast.success(t('family.left'))
    await loadRobots(true)
    uni.navigateTo({ url: '/pages/robots/index' })
  }
  catch (e) {
    notifyRequestError(e, 'family.loadFailed')
  }
  busy.value = ''
}
</script>

<template>
  <tb-section :title="t('family.title')" :description="t('family.lede')">
    <template v-if="canShare" #actions>
      <tb-button size="s" icon="plus" @click="openInvite">
        {{ t('family.invite') }}
      </tb-button>
    </template>

    <view class="rbf">
      <view v-if="loading && !family" class="rbf__state">
        <tb-loading :label="t('common.loading')" />
      </view>
      <view v-else-if="failed && !family" class="rbf__fail" role="alert">
        <text>{{ t('family.loadFailed') }}</text>
        <tb-button size="s" variant="quiet" icon="refresh" @click="load">
          {{ t('common.retry') }}
        </tb-button>
      </view>

      <block v-else-if="family">
        <text v-if="!family.canShare" class="rbf__note">
          {{ t('family.readOnly', { owner: ownerName }) }}
        </text>

        <!-- the owner first, then the people who accepted -->
        <view class="rbf__row">
          <view class="rbf__who">
            <text class="rbf__name">
              {{ family.canShare ? t('family.you') : ownerName }}
            </text>
          </view>
          <tb-tag ink="ink" mark>
            {{ roleName('owner') }}
          </tb-tag>
        </view>
        <view v-for="m in people.accepted" :key="m.id" class="rbf__row">
          <view class="rbf__who">
            <text class="rbf__name">
              {{ m.name }}
            </text>
            <text class="rbf__small">
              {{ t('family.since', { when: dateText(m.respondedAt || m.createdAt) }) }}
            </text>
          </view>
          <tb-tag :ink="m.role === 'co_owner' ? 'ink' : 'ink-2'">
            {{ roleName(m.role) }}
          </tb-tag>
          <view v-if="family.canShare" class="rbf__act">
            <tb-button size="s" variant="quiet" :loading="busy === m.id" @click="changeRole(m)">
              {{ t('family.makeRole', { role: roleName(m.role === 'member' ? 'co_owner' : 'member') }) }}
            </tb-button>
            <tb-button size="s" variant="danger" :disabled="busy === m.id" @click="remove(m)">
              {{ t('family.remove') }}
            </tb-button>
          </view>
        </view>

        <view v-if="!people.accepted.length && family.canShare" class="rbf__empty">
          <text class="rbf__name">
            {{ t('family.empty') }}
          </text>
          <text class="rbf__small">
            {{ t('family.emptyText') }}
          </text>
        </view>

        <block v-if="people.pending.length">
          <view class="rb-sub rbf__sub">
            <text class="rb-sub__title">
              {{ t('family.pending') }}
            </text>
          </view>
          <view v-for="m in people.pending" :key="m.id" class="rbf__row is-pending">
            <view class="rbf__who">
              <text class="rbf__name">
                {{ m.name }}
              </text>
              <text class="rbf__small">
                {{ t('family.sent', { when: dateText(m.createdAt) }) }} · {{ t('family.pendingNote') }}
              </text>
            </view>
            <tb-tag ink="ink-2">
              {{ roleName(m.role) }}
            </tb-tag>
            <view v-if="family.canShare" class="rbf__act">
              <tb-button size="s" variant="danger" :loading="busy === m.id" @click="remove(m)">
                {{ t('family.cancelInvite') }}
              </tb-button>
            </view>
          </view>
        </block>

        <view v-if="!family.canShare" class="rbf__mine">
          <text class="rbf__small">
            {{ t('family.yourRole', { role: roleName(role) }) }} · {{ t(`family.roleHelp.${role === 'co_owner' ? 'co_owner' : 'member'}`) }}
          </text>
          <tb-button v-if="myShareId" size="s" variant="danger" :loading="busy === 'leave'" @click="leave">
            {{ t('family.leave') }}
          </tb-button>
        </view>
      </block>
    </view>

    <tb-sheet v-model:open="open" :title="t('family.inviteTitle')" :close-on-scrim="!sending">
      <view class="rbf__field">
        <text class="rbf__label">
          {{ t('family.target') }}
        </text>
        <tb-input
          v-model="target" :maxlength="64" :invalid="!!error" :placeholder="t('family.targetPlaceholder')"
          :aria-label="t('family.target')" @update:model-value="error = ''" @confirm="sendInvite"
        />
        <text v-if="error" class="rbf__err" role="alert">
          {{ error }}
        </text>
        <text v-else class="rbf__small">
          {{ t('family.targetHint') }}
        </text>
      </view>
      <view class="rbf__field">
        <text class="rbf__label">
          {{ t('family.roleLabel') }}
        </text>
        <tb-choice v-model="inviteRole" :options="roleOptions" wrap :aria-label="t('family.roleLabel')" />
        <text class="rbf__small">
          {{ t(`family.roleHelp.${inviteRole}`) }}
        </text>
      </view>
      <template #footer>
        <tb-button :disabled="sending" @click="open = false">
          {{ t('common.cancel') }}
        </tb-button>
        <tb-button variant="primary" :loading="sending" @click="sendInvite">
          {{ t('family.invite') }}
        </tb-button>
      </template>
    </tb-sheet>
  </tb-section>
</template>

<style lang="scss">
@import './robot.scss';

.rbf {
  display: flex;
  flex-direction: column;
}
.rbf__state {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}
.rbf__fail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  color: var(--tb-danger);
  font-size: 14px;
}
.rbf__note {
  display: block;
  padding: 4px 0 10px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--tb-ink-2);
}
.rbf__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  min-height: 56px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.rbf__row.is-pending {
  border-bottom-style: dashed;
}
.rbf__who {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.rbf__name {
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.rbf__small {
  font-size: 13px;
  line-height: 1.55;
  color: var(--tb-ink-2);
}
.rbf__act {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
  width: 100%;
}
.rbf__empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.rbf__sub {
  margin-top: 16px;
}
.rbf__mine {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding-top: 12px;
}
.rbf__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 16px;
}
.rbf__label {
  font-size: 14px;
  font-weight: 600;
}
.rbf__err {
  font-size: 13px;
  color: var(--tb-danger);
}
</style>
