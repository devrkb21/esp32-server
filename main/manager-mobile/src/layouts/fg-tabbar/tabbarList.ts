import type { TabBar } from '@uni-helper/vite-plugin-uni-pages'

type FgTabBarItem = TabBar['list'][0] & {
  icon: string
  iconType: 'uiLib' | 'unocss' | 'iconfont' | 'tb'
  /** i18n key of the label (nav.*) */
  labelKey?: string
}

/**
 * Tabbar selection strategy, see Tabbar documentation for details
 * 0: 'NO_TABBAR' `No tabbar`
 * 1: 'NATIVE_TABBAR' `Native tabbar`
 * 2: 'CUSTOM_TABBAR_WITH_CACHE' `Custom tabbar with cache`
 * 3: 'CUSTOM_TABBAR_WITHOUT_CACHE' `Custom tabbar without cache`
 *
 * Notice: Re-run build after changing this file to update pages.json
 */
export const TABBAR_MAP = {
  NO_TABBAR: 0,
  NATIVE_TABBAR: 1,
  CUSTOM_TABBAR_WITH_CACHE: 2,
  CUSTOM_TABBAR_WITHOUT_CACHE: 3,
}
// Switch tabbar strategy here
export const selectedTabbarStrategy = TABBAR_MAP.CUSTOM_TABBAR_WITH_CACHE

// When NATIVE_TABBAR(1), fill iconPath and selectedIconPath
// When CUSTOM_TABBAR(2,3), fill icon and iconType
// When NO_TABBAR(0), tabbarList is not effective
export const tabbarList: FgTabBarItem[] = [
  { iconPath: 'static/tabbar/home.png', selectedIconPath: 'static/tabbar/homeHL.png', pagePath: 'pages/index/index', text: 'Today', labelKey: 'nav.today', icon: 'today', iconType: 'tb' },
  { iconPath: 'static/tabbar/example.png', selectedIconPath: 'static/tabbar/exampleHL.png', pagePath: 'pages/day/index', text: 'Day', labelKey: 'nav.day', icon: 'day', iconType: 'tb' },
  { iconPath: 'static/tabbar/robot.png', selectedIconPath: 'static/tabbar/robot_activate.png', pagePath: 'pages/look/index', text: 'Look', labelKey: 'nav.look', icon: 'look', iconType: 'tb' },
  { iconPath: 'static/tabbar/system.png', selectedIconPath: 'static/tabbar/system_activate.png', pagePath: 'pages/settings/index', text: 'More', labelKey: 'nav.more', icon: 'more', iconType: 'tb' },
]

// Cache tabbar for NATIVE_TABBAR(1) and CUSTOM_TABBAR_WITH_CACHE(2)
export const cacheTabbarEnable = selectedTabbarStrategy === TABBAR_MAP.NATIVE_TABBAR
  || selectedTabbarStrategy === TABBAR_MAP.CUSTOM_TABBAR_WITH_CACHE

const _tabbar: TabBar = {
  // Only WeChat mini-program supports custom tabbar. Not effective in App and H5
  custom: selectedTabbarStrategy === TABBAR_MAP.CUSTOM_TABBAR_WITH_CACHE,
  // Nobix palette: warm grey icons, coral for the active tab
  color: '#8E857B',
  selectedColor: '#E2603A',
  backgroundColor: '#FFFFFF',
  borderStyle: 'white',
  height: '50px',
  fontSize: '10px',
  iconWidth: '24px',
  spacing: '3px',
  list: tabbarList as unknown as TabBar['list'],
}

// Tabbar configuration for cache utilization
export const tabBar = cacheTabbarEnable ? _tabbar : undefined
