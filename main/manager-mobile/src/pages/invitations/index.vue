<!-- Invitations (আমন্ত্রণ): robots others want to share with this account; accept or decline (owner: FAMILY) -->
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
import type { FamilyInvite } from '@/api/family/family'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { acceptInvite, declineInvite, getInvites } from '@/api/family/family'
import { getCurrentLanguage, t } from '@/i18n'
import { notifyRequestError } from '@/utils/requestError'
import { badges } from '@/utils/tbBadges'
import { productName } from '@/utils/tbProducts.mjs'
import { loadRobots } from '@/utils/tbRobot'
import { toast } from '@/utils/toast'

defineOptions({ name: 'InvitationsPage' })

const lang = computed(() => getCurrentLanguage())
const list = ref<FamilyInvite[]>([])
const loading = ref(false)
const loaded = ref(false)
const failed = ref(false)
const busy = ref('')

function when(ms: number) {
  return ms ? new Intl.DateTimeFormat(lang.value === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(ms)) : ''
}
function nameOf(i: FamilyInvite) {
  return i.robotName || productName(i, lang.value) || t('nav.robotFallback')
}

async function load() {
  loading.value = true
  failed.value = false
  try {
    list.value = ((await getInvites()) || []) as FamilyInvite[]
    badges.invites = list.value.length
  }
  catch {
    failed.value = true
  }
  loading.value = false
  loaded.value = true
}

async function answer(i: FamilyInvite, yes: boolean) {
  busy.value = `${i.id}:${yes ? 'y' : 'n'}`
  try {
    if (yes)
      await acceptInvite(i.id)
    else await declineInvite(i.id)
    list.value = list.value.filter(x => x.id !== i.id)
    badges.invites = list.value.length
    toast.success(yes ? t('invites.accepted', { name: nameOf(i) }) : t('invites.declined'))
    if (yes)
      loadRobots(true)
  }
  catch (e) {
    notifyRequestError(e, 'invites.failed')
  }
  busy.value = ''
}

onShow(load)
</script>

<template>
  <view class="tb-wrap inv">
    <tb-page-header :title="t('invites.title')" :description="t('invites.lede')" back />

    <view v-if="loading && !loaded" class="inv__state">
      <tb-loading :label="t('common.loading')" />
    </view>
    <view v-else-if="failed" class="inv__state">
      <tb-empty face="confused" :title="t('invites.failed')">
        <tb-button icon="refresh" @click="load">
          {{ t('common.retry') }}
        </tb-button>
      </tb-empty>
    </view>
    <view v-else-if="!list.length" class="inv__state">
      <tb-empty face="sleepy" :title="t('invites.empty')" :text="t('invites.emptyText')" />
    </view>

    <view v-else class="inv__list" role="list">
      <view v-for="(i, k) in list" :key="i.id" class="inv__row" role="listitem">
        <view class="inv__face">
          <tb-face mood="awake" :width="72" alt="" />
        </view>
        <view class="inv__body">
          <text class="inv__name">
            {{ nameOf(i) }}
          </text>
          <text class="inv__small">
            {{ t('invites.from', { name: i.ownerName, when: when(i.createdAt) }) }}
          </text>
          <view class="inv__tags">
            <tb-tag>{{ productName(i, lang) }}</tb-tag>
            <tb-tag ink="ink">
              {{ t('invites.as', { role: t(`family.role.${i.role}`) }) }}
            </tb-tag>
          </view>
          <text class="inv__small">
            {{ t(`family.roleHelp.${i.role === 'co_owner' ? 'co_owner' : 'member'}`) }}
          </text>
          <view class="inv__act">
            <tb-button :variant="k === 0 ? 'primary' : 'secondary'" icon="check" :loading="busy === `${i.id}:y`" :disabled="!!busy" @click="answer(i, true)">
              {{ t('invites.accept') }}
            </tb-button>
            <tb-button variant="quiet" :loading="busy === `${i.id}:n`" :disabled="!!busy" @click="answer(i, false)">
              {{ t('invites.decline') }}
            </tb-button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss">
.inv {
  max-width: 720px;
  margin: 0 auto;
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}
.inv__state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}
.inv__list {
  display: flex;
  flex-direction: column;
}
.inv__face {
  flex: none;
  align-self: flex-start;
  width: 72px;
  padding: 4px 0;
}
.inv__row {
  display: flex;
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid var(--tb-rule-soft);
}
.inv__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.inv__name {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 18px;
  overflow-wrap: anywhere;
}
.inv__small {
  font-size: 13px;
  line-height: 1.55;
  color: var(--tb-ink-2);
}
.inv__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.inv__act {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 4px;
}
</style>
