<script lang="ts" setup>
import type { ConfigProviderThemeVars } from 'wot-design-uni/components/wd-config-provider/types'
import { useThemeStore } from '@/store/theme'
import { nobixThemeVars } from '@/style/nobixTheme'
import FgTabbar from './fg-tabbar/fg-tabbar.vue'

const themeStore = useThemeStore()

const themeVars: ConfigProviderThemeVars = nobixThemeVars
</script>

<template>
  <wd-config-provider :theme="themeStore.currentTheme" :theme-vars="themeVars">
    <slot />
    <FgTabbar />
    <wd-toast />
    <wd-message-box />
  </wd-config-provider>
</template>
