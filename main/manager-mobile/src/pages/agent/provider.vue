<!-- Fresh information: the addresses TinyBot reads each time it wakes up (owner: m-agent).
     Edits the provider store; the character screen saves them with the rest. -->
<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Fresh information",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import type { Providers } from '@/api/agent/types'
import { onMounted, ref } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { useProvider } from '@/store/provider'
import { digits } from '@/utils/calendar.mjs'
import { fromEditableProviders, toEditableProviders } from './agentModel.mjs'

defineOptions({
  name: 'Provider',
})

interface EditableProvider { url: string, headers: { key: string, value: string }[] }

const providerStore = useProvider()
const localProviders = ref<EditableProvider[]>([])
const num = (n: any) => digits(n, getCurrentLanguage())

function initLocalData() {
  localProviders.value = toEditableProviders(providerStore.providers as any[])
}

function addProvider(index: number) {
  localProviders.value.splice(index, 0, {
    url: '',
    headers: [{ key: '', value: '' }],
  })
}

function removeProvider(index: number) {
  localProviders.value.splice(index, 1)
}

function addHeader(pIndex: number, hIndex: number) {
  localProviders.value[pIndex].headers.splice(hIndex, 0, { key: '', value: '' })
}

function removeHeader(pIndex: number, hIndex: number) {
  localProviders.value[pIndex].headers.splice(hIndex, 1)
}

function handleConfirm() {
  providerStore.updateProviders(fromEditableProviders(localProviders.value) as unknown as Providers[])
  goBack()
}

function goBack() {
  uni.navigateBack()
}

onMounted(() => {
  initLocalData()
})
</script>

<template>
  <view class="tb-wrap ctx">
    <tb-page-header :title="t('mAgent.ctx.title')" :description="t('mAgent.ctx.lead')" back />

    <view v-if="localProviders.length === 0" class="ctx__empty">
      <tb-empty :title="t('mAgent.ctx.emptyTitle')" :text="t('mAgent.ctx.emptyText')">
        <tb-button icon="plus" @click="addProvider(0)">
          {{ t('mAgent.ctx.addSource') }}
        </tb-button>
      </tb-empty>
    </view>

    <block v-else>
      <view v-for="(provider, pIndex) in localProviders" :key="pIndex" class="ctx-src">
        <view class="ctx-src__head">
          <text class="ctx-src__title">
            {{ t('mAgent.ctx.sourceN', { n: num(pIndex + 1) }) }}
          </text>
          <tb-button size="s" variant="quiet" icon="trash" @click="removeProvider(pIndex)">
            {{ t('mAgent.ctx.remove') }}
          </tb-button>
        </view>

        <view class="ctx-field">
          <text class="ctx-field__label">
            {{ t('mAgent.ctx.url') }}
          </text>
          <tb-input v-model="provider.url" icon="link" :maxlength="500" :placeholder="t('mAgent.ctx.urlPlaceholder')" :aria-label="t('mAgent.ctx.url')" />
        </view>

        <view class="ctx-field">
          <text class="ctx-field__label">
            {{ t('mAgent.ctx.headers') }}
          </text>
          <text v-if="provider.headers.length === 0" class="ctx-muted">
            {{ t('mAgent.ctx.noHeaders') }}
          </text>
          <view v-for="(header, hIndex) in provider.headers" :key="hIndex" class="ctx-hdr">
            <tb-input v-model="header.key" class="ctx-hdr__in" :maxlength="200" :placeholder="t('mAgent.ctx.headerName')" :aria-label="t('mAgent.ctx.headerName')" />
            <tb-input v-model="header.value" class="ctx-hdr__in" :maxlength="1000" :placeholder="t('mAgent.ctx.headerValue')" :aria-label="t('mAgent.ctx.headerValue')" />
            <view class="ctx-hdr__x" role="button" :aria-label="t('mAgent.ctx.removeHeader')" hover-class="is-press" @click="removeHeader(pIndex, hIndex)">
              <tb-icon name="close" :size="18" />
            </view>
          </view>
          <view>
            <tb-button size="s" variant="quiet" icon="plus" @click="addHeader(pIndex, provider.headers.length)">
              {{ t('mAgent.ctx.addHeader') }}
            </tb-button>
          </view>
        </view>
      </view>

      <view class="ctx__add">
        <tb-button icon="plus" block @click="addProvider(localProviders.length)">
          {{ t('mAgent.ctx.addSource') }}
        </tb-button>
        <text class="ctx-muted">
          {{ t('mAgent.ctx.footer') }}
        </text>
      </view>
    </block>

    <view class="ctx-bar">
      <tb-button variant="primary" size="l" block @click="handleConfirm">
        {{ t('mAgent.ctx.keep') }}
      </tb-button>
    </view>
  </view>
</template>

<style lang="scss">
.ctx { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
.ctx__empty { padding: 40px 0; }
.ctx-src { display: flex; flex-direction: column; gap: 14px; padding: 16px 0 20px; border-bottom: 1px solid var(--tb-rule); }
.ctx-src__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ctx-src__title { font-family: var(--tb-font-display); font-weight: 700; font-size: 19px; }
.ctx-field { display: flex; flex-direction: column; gap: 8px; }
.ctx-field__label { font-size: 13px; font-weight: 600; color: var(--tb-ink-2); }
.ctx-hdr { display: flex; align-items: center; gap: 6px; }
.ctx-hdr__in { flex: 1; min-width: 0; }
.ctx-hdr__x { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: var(--tb-ink-2); border-radius: 999px; }
.ctx-hdr__x.is-press { background: var(--tb-paper-2); }
.ctx-muted { font-size: 13px; color: var(--tb-ink-2); }
.ctx__add { display: flex; flex-direction: column; gap: 10px; padding-top: 20px; }
.ctx-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 800; padding: 12px var(--tb-gutter) calc(12px + env(safe-area-inset-bottom));
  background: var(--tb-paper); border-top: 3px solid var(--tb-rule);
}
</style>
