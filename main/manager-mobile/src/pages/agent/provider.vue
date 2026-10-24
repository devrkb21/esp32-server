<route lang="jsonc" type="page">
{
  "layout": "default",
  "style": {
    "navigationBarTitleText": "Edit Source",
    "navigationStyle": "custom"
  }
}
</route>

<script lang="ts" setup>
import type { Providers } from '@/api/agent/types'
import { onMounted, ref } from 'vue'
import { t } from '@/i18n'
import { useProvider } from '@/store/provider'

defineOptions({
  name: 'Provider',
})

const providerStore = useProvider()

const localProviders = ref<Providers[]>([])

function initLocalData() {
  localProviders.value = providerStore.providers.map((p) => {
    const headers = p.headers || {}
    return {
      url: p.url,
      headers: Object.entries(headers).map(([key, value]: [string, string]) => ({ key, value })),
    }
  })

  if (localProviders.value.length === 0) {
    localProviders.value.push({ url: '', headers: [{ key: '', value: '' }] })
  }
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
  const result = localProviders.value
    .filter(p => p.url.trim() !== '')
    .map((p) => {
      const headersObj = {}
      p.headers.forEach((h) => {
        if (h.key.trim()) {
          headersObj[h.key.trim()] = h.value
        }
      })
      return {
        url: p.url.trim(),
        headers: headersObj,
      }
    })

  providerStore.updateProviders(result as Providers[])
  goBack()
}

function goBack() {
  uni.navigateBack()
}

// Safe area for the custom navigation bar
const safeTop = (uni.getSystemInfoSync().safeAreaInsets?.top) || 0

// Pending copy (src/i18n/_pending/mobile-home-agents.ts): English fallback until merged
function tx(key: string, fallback: string, params?: Record<string, string | number>) {
  const value = t(key, params)
  if (value !== key)
    return value
  if (!params)
    return fallback
  return Object.entries(params).reduce((text, [name, val]) => text.replace(`{${name}}`, String(val)), fallback)
}

onMounted(() => {
  initLocalData()
})
</script>

<template>
  <view class="nx-subpage">
    <view class="nx-subpage__nav" :style="{ paddingTop: `${safeTop}px` }">
      <view class="nx-subpage__back" role="button" :aria-label="tx('agent.navBack', 'Back')" @click="goBack">
        <wd-icon name="arrow-left" size="20px" />
      </view>
      <text class="nx-truncate nx-subpage__nav-title">
        {{ t('contextProviderDialog.title') }}
      </text>
      <view class="nx-subpage__back" />
    </view>

    <scroll-view scroll-y class="nx-subpage__scroll">
      <view class="nx-subpage__content">
        <view class="nx-large-title">
          <view class="nx-large-title__title">
            {{ t('agent.contextProvider') }}
          </view>
          <view class="nx-large-title__subtitle">
            {{ tx('agent.contextSubtitle', 'Sources your agent reads before it answers, such as a calendar or home sensors.') }}
          </view>
        </view>

        <!-- Empty -->
        <view v-if="localProviders.length === 0" class="nx-empty">
          <view class="nx-icon-tile nx-icon-tile--lg">
            <wd-icon name="link" size="28px" />
          </view>
          <text class="nx-empty__title">
            {{ t('contextProviderDialog.noContextApi') }}
          </text>
          <text class="nx-empty__text">
            {{ tx('agent.contextEmptyText', 'Add an API address to give your agent live context.') }}
          </text>
          <view class="nx-btn nx-btn--primary src-empty-btn" role="button" @click="addProvider(0)">
            <wd-icon name="add" size="18px" />
            {{ t('contextProviderDialog.add') }}
          </view>
        </view>

        <template v-else>
          <view v-for="(provider, pIndex) in localProviders" :key="pIndex" class="nx-group">
            <view class="src-header">
              <text class="nx-group__header src-header__title">
                {{ tx('agent.contextSourceN', 'Source {n}', { n: pIndex + 1 }) }}
              </text>
              <text class="src-header__remove" role="button" @click="removeProvider(pIndex)">
                {{ t('common.delete') }}
              </text>
            </view>
            <view class="nx-group__body">
              <view class="nx-row src-field">
                <text class="nx-row__subtitle src-field__label">
                  {{ t('contextProviderDialog.apiUrl') }}
                </text>
                <input
                  v-model="provider.url"
                  class="nx-mono src-input"
                  type="text"
                  :placeholder="t('contextProviderDialog.apiUrlPlaceholder')"
                  placeholder-class="src-placeholder"
                >
              </view>

              <view v-for="(header, hIndex) in provider.headers" :key="hIndex" class="nx-row src-header-row">
                <view class="src-header-row__fields">
                  <input
                    v-model="header.key"
                    class="src-input nx-mono src-input--key"
                    type="text"
                    :placeholder="t('contextProviderDialog.headerKeyPlaceholder')"
                    placeholder-class="src-placeholder"
                  >
                  <input
                    v-model="header.value"
                    class="src-input nx-mono"
                    type="text"
                    :placeholder="t('contextProviderDialog.headerValuePlaceholder')"
                    placeholder-class="src-placeholder"
                  >
                </view>
                <view
                  class="src-icon-btn"
                  role="button"
                  :aria-label="t('common.delete')"
                  @click="removeHeader(pIndex, hIndex)"
                >
                  <wd-icon name="close" size="16px" />
                </view>
              </view>

              <view class="nx-row nx-row--tap src-add" @click="addHeader(pIndex, provider.headers.length)">
                <wd-icon name="add" size="16px" />
                <text>{{ t('contextProviderDialog.addHeader') }}</text>
              </view>
            </view>
            <view v-if="provider.headers.length === 0" class="nx-group__footer">
              {{ t('contextProviderDialog.noHeaders') }}
            </view>
          </view>

          <view class="nx-group">
            <view class="nx-group__body">
              <view class="nx-row nx-row--tap src-add" @click="addProvider(localProviders.length)">
                <wd-icon name="add" size="16px" />
                <text>{{ tx('agent.contextAddSource', 'Add source') }}</text>
              </view>
            </view>
            <view class="nx-group__footer">
              {{ tx('agent.contextFooter', 'Sources without an address are skipped. Changes apply after you save the agent.') }}
            </view>
          </view>
        </template>
      </view>
    </scroll-view>

    <view class="nx-action-bar">
      <wd-button type="primary" block size="large" custom-class="src-save" @click="handleConfirm">
        {{ t('contextProviderDialog.confirm') }}
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.nx-subpage {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--nx-bg);

  &__nav {
    display: flex;
    align-items: center;
    flex: none;
    gap: var(--nx-space-2);
    padding-left: var(--nx-gutter);
    padding-right: var(--nx-gutter);
    min-height: var(--nx-touch);
    background: var(--nx-bg);
  }
  &__back {
    display: flex;
    align-items: center;
    flex: none;
    width: var(--nx-touch);
    height: var(--nx-touch);
    color: var(--nx-accent);
    &:active {
      opacity: 0.6;
    }
  }
  &__nav-title {
    flex: 1;
    text-align: center;
    font-size: var(--nx-text-headline);
    font-weight: 600;
    color: var(--nx-text);
  }
  &__scroll {
    flex: 1;
    height: 0;
  }
  &__content {
    padding: 0 var(--nx-gutter) calc(220rpx + env(safe-area-inset-bottom));
  }
}

.src-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  &__title {
    flex: 1;
  }
  &__remove {
    padding: 0 var(--nx-space-2) var(--nx-space-2);
    color: var(--nx-danger);
    font-size: var(--nx-text-footnote);
    font-weight: 600;
  }
}

.src-field {
  flex-direction: column;
  align-items: stretch;
  gap: var(--nx-space-1);
  &__label {
    margin-top: 0;
  }
}

.src-input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  font-size: var(--nx-text-callout);
  color: var(--nx-text);
  &--key {
    flex: 0 0 38%;
    padding-right: var(--nx-space-2);
    border-right: 1rpx solid var(--nx-border);
  }
}

:deep(.src-placeholder) {
  color: var(--nx-text-3);
}

.src-header-row {
  &__fields {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
  }
}

.src-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  color: var(--nx-text-3);
  &:active {
    background: var(--nx-surface-2);
  }
}

.src-add {
  gap: var(--nx-space-2);
  color: var(--nx-accent);
  font-size: var(--nx-text-body);
  font-weight: 500;
}

.src-empty-btn {
  margin-top: var(--nx-space-3);
}

:deep(.src-save) {
  border-radius: var(--nx-radius);
}
</style>
