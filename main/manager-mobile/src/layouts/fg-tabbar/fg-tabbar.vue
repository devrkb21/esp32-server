<script setup lang="ts">
import { t } from '@/i18n'
import { tabbarStore } from './tabbar'
import { tabbarList as _tabBarList, cacheTabbarEnable, selectedTabbarStrategy, TABBAR_MAP } from './tabbarList'

// TinyBot's bottom bar: four tabs under a heavy ink rule, the current one underlined in orange.
const customTabbarEnable
  = selectedTabbarStrategy === TABBAR_MAP.CUSTOM_TABBAR_WITH_CACHE
    || selectedTabbarStrategy === TABBAR_MAP.CUSTOM_TABBAR_WITHOUT_CACHE

const tabbarList = _tabBarList.map(item => ({ ...item, path: `/${item.pagePath}` }))

function current() {
  const pages = getCurrentPages()
  const route = pages.length ? `/${(pages[pages.length - 1] as any).route}` : ''
  const i = tabbarList.findIndex(x => x.path === route)
  return i >= 0 ? i : tabbarStore.curIdx
}
function select(index: number) {
  const url = tabbarList[index].path
  tabbarStore.setCurIdx(index)
  if (cacheTabbarEnable)
    uni.switchTab({ url })
  else uni.navigateTo({ url })
}
onLoad(() => {
  if (selectedTabbarStrategy === TABBAR_MAP.CUSTOM_TABBAR_WITH_CACHE)
    uni.hideTabBar({ fail: () => {} })
})
onShow(() => { tabbarStore.setCurIdx(current()) })
</script>

<template>
  <view v-if="customTabbarEnable" class="tb-tabbar" role="tablist">
    <view v-for="(item, idx) in tabbarList" :key="item.path" class="tb-tabbar__tab" :class="{ 'is-on': idx === tabbarStore.curIdx }"
      role="tab" :aria-selected="idx === tabbarStore.curIdx ? 'true' : 'false'" @click="select(idx)">
      <tb-icon :name="item.icon" :size="22" />
      <text class="tb-tabbar__label">{{ item.labelKey ? t(item.labelKey) : item.text }}</text>
    </view>
  </view>
</template>

<style lang="scss">
.tb-tabbar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: flex;
  padding: 6px 4px calc(8px + env(safe-area-inset-bottom)); background: var(--tb-paper); border-top: 3px solid var(--tb-rule);
}
.tb-tabbar__tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 52px; padding-top: 4px; color: var(--tb-ink-2); }
.tb-tabbar__tab.is-on { color: var(--tb-ink); }
.tb-tabbar__label { font-size: 12px; font-weight: 600; }
.tb-tabbar__tab.is-on .tb-tabbar__label { box-shadow: inset 0 -2px 0 var(--tb-orange); }
</style>
