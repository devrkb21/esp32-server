<script lang="ts" setup>
import { useThemeStore } from '@/store/theme'

const themeStore = useThemeStore()
</script>

<template>
  <view class="tb-page" :class="{ 'is-dark': themeStore.currentTheme === 'dark', 'has-tabbar': false }">
    <slot />
    <tb-toast-host />
    <tb-confirm-host />
  </view>
</template>
