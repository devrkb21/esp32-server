/**
 * by Feige on 2024-03-06
 * Route interceptor, usually used as a login interceptor.
 * You can choose either a whitelist or a blacklist depending on the business needs.
 * In this project, most pages are freely accessible, so a blacklist is used.
 */
import { useUserStore } from '@/store'
import { needLoginPages as _needLoginPages, getLastPage, getNeedLoginPages } from '@/utils'

// TODO: Check
const loginRoute = import.meta.env.VITE_LOGIN_URL

function isLogined() {
  const userStore = useUserStore()
  return !!userStore.userInfo.username
}

const isDev = import.meta.env.DEV

// Blacklist-based login interceptor — suitable when most pages do not require login and only a few pages do.
const navigateToInterceptor = {
  // Note: the URL here starts with '/', such as '/pages/index/index', which is different from the path in 'pages.json'.
  // Added support for relative paths, courtesy of @ideal.
  invoke({ url }: { url: string }) {
    // console.log(url) // /pages/route-interceptor/index?name=feige&age=30
    let path = url.split('?')[0]
    console.log('Page changed')

    // Handle relative paths.
    if (!path.startsWith('/')) {
      const currentPath = getLastPage().route
      const normalizedCurrentPath = currentPath.startsWith('/') ? currentPath : `/${currentPath}`
      const baseDir = normalizedCurrentPath.substring(0, normalizedCurrentPath.lastIndexOf('/'))
      path = `${baseDir}/${path}`
    }

    let needLoginPages: string[] = []
    // To avoid bugs during development, fetch this every time. In production, this can be moved outside the function for better performance.
    if (isDev) {
      needLoginPages = getNeedLoginPages()
    }
    else {
      needLoginPages = _needLoginPages
    }
    const isNeedLogin = needLoginPages.includes(path)
    if (!isNeedLogin) {
      return true
    }
    const hasLogin = isLogined()
    if (hasLogin) {
      return true
    }
    const redirectRoute = `${loginRoute}?redirect=${encodeURIComponent(url)}`
    uni.navigateTo({ url: redirectRoute })
    return false
  },
}

export const routeInterceptor = {
  install() {
    uni.addInterceptor('navigateTo', navigateToInterceptor)
    uni.addInterceptor('reLaunch', navigateToInterceptor)
    uni.addInterceptor('redirectTo', navigateToInterceptor)
    uni.addInterceptor('switchTab', navigateToInterceptor)
  },
}
