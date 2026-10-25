import { VueQueryPlugin } from '@tanstack/vue-query'
import { createSSRApp } from 'vue'
import App from './App.vue'
import { DEMO, DEMO_TOKEN } from './api/demo'
// Internationalization helpers
import { initI18n } from './i18n'

import { routeInterceptor } from './router/interceptor'
import store from './store'

import '@/style/nobix.scss'
import '@/style/index.scss'
import '@/style/tb.scss'
import 'virtual:uno.css'

export function createApp() {
  // Demo build: signed in as a sample owner, every request answered from fixtures (src/api/demo)
  // The sign-in screens stay reachable: no token is seeded while one of them is open.
  let authPage = false
  try {
    authPage = /^#\/pages\/(login|register|forgot-password)\//.test(window.location.hash)
  }
  catch {}
  if (DEMO && !authPage && !uni.getStorageSync('token'))
    uni.setStorageSync('token', DEMO_TOKEN)

  const app = createSSRApp(App)
  app.use(store)
  app.use(routeInterceptor)
  app.use(VueQueryPlugin)

  // Initialize internationalization
  initI18n()

  return {
    app,
  }
}