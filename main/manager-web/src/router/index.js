import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'welcome',
    component: function () {
      return import('../views/login.vue')
    }
  },
  {
    path: '/role-config',
    name: 'RoleConfig',
    component: function () {
      return import('../views/roleConfig.vue')
    }
  },
  {
    path: '/voice-print',
    name: 'VoicePrint',
    component: function () {
      return import('../views/VoicePrint.vue')
    }
  },
  {
    path: '/login',
    name: 'login',
    component: function () {
      return import('../views/login.vue')
    }
  },
  {
    path: '/home',
    name: 'home',
    component: function () {
      return import('../views/home.vue')
    }
  },
  {
    path: '/register',
    name: 'Register',
    component: function () {
      return import('../views/register.vue')
    }
  },
  {
    path: '/retrieve-password',
    name: 'RetrievePassword',
    component: function () {
      return import('../views/retrievePassword.vue')
    }
  },
  // Device management route
  {
    path: '/device-management',
    name: 'DeviceManagement',
    component: function () {
      return import('../views/DeviceManagement.vue')
    }
  },
  // TinyBot companion (alarms, reminders, prayer, messages...) of one device
  {
    path: '/companion-management',
    name: 'CompanionManagement',
    component: function () {
      return import('../views/CompanionManagement.vue')
    },
    meta: {
      title: 'Companion'
    }
  },
  // TinyBot look: face look editor (settings.look) + wake word assets.bin builder/installer
  {
    path: '/theme-generator',
    name: 'ThemeGenerator',
    component: function () {
      return import('../views/ThemeGenerator.vue')
    },
    meta: {
      title: 'TinyBot look'
    }
  },
  // User management route
  {
    path: '/user-management',
    name: 'UserManagement',
    component: function () {
      return import('../views/UserManagement.vue')
    }
  },
  {
    path: '/model-config',
    name: 'ModelConfig',
    component: function () {
      return import('../views/ModelConfig.vue')
    }
  },
  {
    path: '/params-management',
    name: 'ParamsManagement',
    component: function () {
      return import('../views/ParamsManagement.vue')
    },
    meta: {
      title: 'Params Management'
    }
  },
  {
    path: '/knowledge-base-management',
    name: 'KnowledgeBaseManagement',
    component: function () {
      return import('../views/KnowledgeBaseManagement.vue')
    },
    meta: {
      title: 'Knowledge Base Management'
    }
  },
  {
    path: '/server-side-management',
    name: 'ServerSideManager',
    component: function () {
      return import('../views/ServerSideManager.vue')
    },
    meta: {
      title: 'Server Management'
    }
  },
  {
    path: '/ota-management',
    name: 'OtaManagement',
    component: function () {
      return import('../views/OtaManagement.vue')
    },
    meta: {
      title: 'OTA Management'
    }
  },
  {
    path: '/voice-resource-management',
    name: 'VoiceResourceManagement',
    component: function () {
      return import('../views/VoiceResourceManagement.vue')
    },
    meta: {
      title: 'Voice Resource Management'
    }
  },
  {
    path: '/voice-clone-management',
    name: 'VoiceCloneManagement',
    component: function () {
      return import('../views/VoiceCloneManagement.vue')
    },
    meta: {
      title: 'Voice Clone Management'
    }
  },
  {
    path: '/dict-management',
    name: 'DictManagement',
    component: function () {
      return import('../views/DictManagement.vue')
    }
  },
  {
    path: '/provider-management',
    name: 'ProviderManagement',
    component: function () {
      return import('../views/ProviderManagement.vue')
    }
  },
  // Default role templates route
  {
    path: '/agent-template-management',
    name: 'AgentTemplateManagement',
    component: function () {
      return import('../views/AgentTemplateManagement.vue')
    }
  },
  // Quick config templates route
  {
    path: '/template-quick-config',
    name: 'TemplateQuickConfig',
    component: function () {
      return import('../views/TemplateQuickConfig.vue')
    }
  },
  // Feature management route
  {
    path: '/feature-management',
    name: 'FeatureManagement',
    component: function () {
      return import('../views/FeatureManagement.vue')
    },
    meta: {
      title: 'Feature Management'
    }
  },
  // Replacement word management
  {
    path: '/replacement-word-management',
    name: 'ReplacementWordManagement',
    component: function () {
      return import('../views/ReplacementWordManagement.vue')
    },
    meta: {
      title: 'Replacement Word Management'
    }
  },
  // Address book management route
  {
    path: '/address-book-management',
    name: 'AddressBookManagement',
    component: function () {
      return import('../views/AddressBookManagement.vue')
    },
    meta: {
      title: 'Address Book Management'
    }
  },
]
const router = new VueRouter({
  base: process.env.VUE_APP_PUBLIC_PATH || '/',
  routes
})

// Globally handle duplicate navigation by reloading page
const originalPush = VueRouter.prototype.push
VueRouter.prototype.push = function push(location) {
  return originalPush.call(this, location).catch(err => {
    if (err.name === 'NavigationDuplicated') {
      // If duplicate navigation, reload page
      window.location.reload()
    } else {
      // Re-throw other errors
      throw err
    }
  })
}

// 匿名可访问的路由白名单
const anonRouteNames = new Set(['login', 'Register', 'RetrievePassword', 'welcome'])

// Route guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const isAnonRoute = anonRouteNames.has(to.name);

  if (isAnonRoute && token) {
    next({ name: 'home', replace: true })
    return
  }

  if (!isAnonRoute && !token) {
    next({
      name: 'login',
      replace: true
    })
    return
  }

  next()
})

router.afterEach((to) => {
  const defaultTitle = process.env.VUE_APP_TITLE || 'ESP Console'
  document.title = to.meta && to.meta.title ? `${to.meta.title} - ${defaultTitle}` : defaultTitle
})

export default router
