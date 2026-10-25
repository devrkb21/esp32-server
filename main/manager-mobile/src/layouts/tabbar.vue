<script lang="ts" setup>
import { useThemeStore } from '@/store/theme'
import FgTabbar from './fg-tabbar/fg-tabbar.vue'

const themeStore = useThemeStore()
</script>

<template>
  <view class="tb-page has-tabbar" :class="{ 'is-dark': themeStore.currentTheme === 'dark' }">
    <slot />
    <tb-toast-host />
    <tb-confirm-host />
    <FgTabbar />
  </view>
</template>
