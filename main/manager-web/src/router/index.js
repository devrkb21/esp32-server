import { createRouter, createWebHashHistory } from 'vue-router';

// Every page lives in src/views/<owner>/, one owner per folder (see .bunshin/owners.json).
// `meta.bare` pages render without the app shell (sign-in pages). `meta.admin` pages are for super
// admins. `meta.title` is an i18n key. Old paths redirect so bookmarks keep working.
const v = {
  login: () => import('../views/auth/Login.vue'),
  register: () => import('../views/auth/Register.vue'),
  retrieve: () => import('../views/auth/RetrievePassword.vue'),
  account: () => import('../views/auth/Account.vue'),
  today: () => import('../views/today/Today.vue'),
  more: () => import('../views/more/More.vue'),
  robots: () => import('../views/robots/Robots.vue'),
  devices: () => import('../views/devices/Devices.vue'),
  day: () => import('../views/day/Day.vue'),
  messages: () => import('../views/messages/Messages.vue'),
  look: () => import('../views/look/Look.vue'),
  robot: () => import('../views/robot/RobotSettings.vue'),
  roleConfig: () => import('../views/character/RoleConfig.vue'),
  voicePrint: () => import('../views/voiceprint/VoicePrint.vue'),
  users: () => import('../views/users/UserManagement.vue'),
  ota: () => import('../views/ota/OtaManagement.vue'),
  modelConfig: () => import('../views/models/ModelConfig.vue'),
  providers: () => import('../views/models/ProviderManagement.vue'),
  templates: () => import('../views/templates/AgentTemplateManagement.vue'),
  quickConfig: () => import('../views/templates/TemplateQuickConfig.vue'),
  knowledge: () => import('../views/knowledge/KnowledgeBaseManagement.vue'),
  voiceResources: () => import('../views/voices/VoiceResourceManagement.vue'),
  voiceClone: () => import('../views/voices/VoiceCloneManagement.vue'),
  replacementWords: () => import('../views/words/ReplacementWordManagement.vue'),
  addressBook: () => import('../views/words/AddressBookManagement.vue'),
  params: () => import('../views/system/ParamsManagement.vue'),
  dict: () => import('../views/system/DictManagement.vue'),
  features: () => import('../views/system/FeatureManagement.vue'),
  server: () => import('../views/system/ServerSideManager.vue'),
  theme: () => import('../views/theme/ThemeGenerator.vue'),
};

export const routes = [
  { path: '/', name: 'welcome', redirect: '/login' },
  { path: '/login', name: 'login', component: v.login, meta: { bare: true, title: 'nav.signIn' } },
  { path: '/register', name: 'Register', component: v.register, meta: { bare: true, title: 'nav.register' } },
  { path: '/retrieve-password', name: 'RetrievePassword', component: v.retrieve, meta: { bare: true, title: 'nav.retrieve' } },
  { path: '/account', name: 'Account', component: v.account, meta: { title: 'nav.account' } },

  { path: '/today', name: 'Today', component: v.today, meta: { title: 'nav.today' } },
  { path: '/more', name: 'More', component: v.more, meta: { title: 'nav.more' } },
  { path: '/robots', name: 'Robots', component: v.robots, meta: { title: 'nav.robots' } },
  { path: '/device-management', name: 'DeviceManagement', component: v.devices, meta: { title: 'nav.devices' } },
  { path: '/day', name: 'Day', component: v.day, meta: { title: 'nav.day' } },
  { path: '/messages', name: 'Messages', component: v.messages, meta: { title: 'nav.messages' } },
  { path: '/look', name: 'Look', component: v.look, meta: { title: 'nav.look' } },
  { path: '/robot', name: 'RobotSettings', component: v.robot, meta: { title: 'nav.robot' } },
  { path: '/role-config', name: 'RoleConfig', component: v.roleConfig, meta: { title: 'nav.character' } },
  { path: '/voice-print', name: 'VoicePrint', component: v.voicePrint, meta: { title: 'nav.voiceprint' } },

  { path: '/user-management', name: 'UserManagement', component: v.users, meta: { admin: true, title: 'nav.users' } },
  { path: '/ota-management', name: 'OtaManagement', component: v.ota, meta: { admin: true, title: 'nav.ota' } },
  { path: '/model-config', name: 'ModelConfig', component: v.modelConfig, meta: { admin: true, title: 'nav.models' } },
  { path: '/provider-management', name: 'ProviderManagement', component: v.providers, meta: { admin: true, title: 'nav.providers' } },
  { path: '/agent-template-management', name: 'AgentTemplateManagement', component: v.templates, meta: { admin: true, title: 'nav.templates' } },
  { path: '/template-quick-config', name: 'TemplateQuickConfig', component: v.quickConfig, meta: { admin: true, title: 'nav.templates' } },
  { path: '/knowledge-base-management', name: 'KnowledgeBaseManagement', component: v.knowledge, meta: { admin: true, title: 'nav.knowledge' } },
  { path: '/voice-resource-management', name: 'VoiceResourceManagement', component: v.voiceResources, meta: { admin: true, title: 'nav.voiceResources' } },
  { path: '/voice-clone-management', name: 'VoiceCloneManagement', component: v.voiceClone, meta: { title: 'nav.voiceClone' } },
  { path: '/replacement-word-management', name: 'ReplacementWordManagement', component: v.replacementWords, meta: { admin: true, title: 'nav.replacementWords' } },
  { path: '/address-book-management', name: 'AddressBookManagement', component: v.addressBook, meta: { admin: true, title: 'nav.addressBook' } },
  { path: '/params-management', name: 'ParamsManagement', component: v.params, meta: { admin: true, title: 'nav.params' } },
  { path: '/dict-management', name: 'DictManagement', component: v.dict, meta: { admin: true, title: 'nav.dict' } },
  { path: '/feature-management', name: 'FeatureManagement', component: v.features, meta: { admin: true, title: 'nav.features' } },
  { path: '/server-side-management', name: 'ServerSideManager', component: v.server, meta: { admin: true, title: 'nav.server' } },
  { path: '/theme-generator', name: 'ThemeGenerator', component: v.theme, meta: { title: 'nav.themeGenerator' } },

  // Old paths
  { path: '/home', redirect: '/today' },
  { path: '/companion-management', name: 'CompanionManagement', redirect: (to) => ({ path: '/today', query: to.query }) },
  { path: '/:pathMatch(.*)*', redirect: '/today' },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

const anonRouteNames = new Set(['login', 'Register', 'RetrievePassword', 'welcome']);

router.beforeEach((to) => {
  let token = null;
  try { token = localStorage.getItem('token'); } catch (e) { /* private mode */ }
  const isAnon = anonRouteNames.has(to.name);
  if (isAnon && token) return { path: '/today', replace: true };
  if (!isAnon && !token) return { name: 'login', replace: true };
  return true;
});

export default router;
