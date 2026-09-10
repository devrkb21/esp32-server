<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { onMounted, watch } from 'vue'
import { usePageAuth } from '@/hooks/usePageAuth'
import { t } from '@/i18n'
import { useConfigStore } from '@/store'
import { useLangStore } from '@/store/lang'
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only'

usePageAuth()

const configStore = useConfigStore()
const langStore = useLangStore()

onLaunch(() => {
  console.log('App Launch')
  // Fetch public configuration
  configStore.fetchPublicConfig().catch((error) => {
    console.error('Failed to fetch public configuration:', error)
  })
})
onShow(() => {
  console.log('App Show')
  // Use setTimeout to delay execution so that the tabBar has already been initialized
  setTimeout(() => {
    updateTabBarText()
  }, 100)
})

// Dynamically update tabBar text
function updateTabBarText() {
  try {
    // Set home tabBar text
    uni.setTabBarItem({
      index: 0,
      text: t('tabBar.home'),
      success: () => {},
      fail: (err) => {
        console.log('Failed to set home tabBar text:', err)
      },
    })

    // Set device configuration tabBar text
    uni.setTabBarItem({
      index: 1,
      text: t('tabBar.deviceConfig'),
      success: () => {},
      fail: (err) => {
        console.log('Failed to set device configuration tabBar text:', err)
      },
    })

    // Set settings tabBar text
    uni.setTabBarItem({
      index: 2,
      text: t('tabBar.settings'),
      success: () => {},
      fail: (err) => {
        console.log('Failed to set settings tabBar text:', err)
      },
    })
  }
  catch (error) {
    console.log('Error while updating tabBar text:', error)
  }
}
// Listen for language switch events
onMounted(() => {
  // Watch for language changes and update the tabBar text automatically when the language changes
  watch(() => langStore.currentLang, () => {
    console.log('Language switched, updating tabBar text')
    // Update tabBar text immediately after language switch
    updateTabBarText()
  })
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style lang="scss">
swiper,
scroll-view {
  flex: 1;
  height: 100%;
  overflow: hidden;
}

image {
  width: 100%;
  height: 100%;
  vertical-align: middle;
}
</style>
