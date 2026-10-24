// The app's navigation, one list for the desktop sidebar, the phone's bottom bar and the
// "More" page. Labels are i18n keys (nav.*). `admin: true` items show to super admins only.
export const NAV = [
  {
    group: 'nav.group.robot',
    items: [
      { to: '/today', label: 'nav.today', icon: 'today', tab: true },
      { to: '/day', label: 'nav.day', icon: 'day', tab: true, ink: 'alarm' },
      { to: '/messages', label: 'nav.messages', icon: 'message', ink: 'message' },
      { to: '/look', label: 'nav.look', icon: 'look', tab: true, ink: 'look' },
      { to: '/robot', label: 'nav.robot', icon: 'settings' },
    ],
  },
  {
    group: 'nav.group.character',
    items: [
      { to: '/role-config', label: 'nav.character', icon: 'agent' },
      { to: '/voice-print', label: 'nav.voiceprint', icon: 'voiceprint' },
      { to: '/robots', label: 'nav.robots', icon: 'robots' },
    ],
  },
  {
    group: 'nav.group.backoffice',
    admin: true,
    items: [
      { to: '/user-management', label: 'nav.users', icon: 'users' },
      { to: '/ota-management', label: 'nav.ota', icon: 'firmware' },
      { to: '/model-config', label: 'nav.models', icon: 'model' },
      { to: '/provider-management', label: 'nav.providers', icon: 'provider' },
      { to: '/agent-template-management', label: 'nav.templates', icon: 'template' },
      { to: '/knowledge-base-management', label: 'nav.knowledge', icon: 'book' },
      { to: '/voice-resource-management', label: 'nav.voiceResources', icon: 'voice' },
      { to: '/voice-clone-management', label: 'nav.voiceClone', icon: 'voice' },
      { to: '/replacement-word-management', label: 'nav.replacementWords', icon: 'replace' },
      { to: '/address-book-management', label: 'nav.addressBook', icon: 'addressbook' },
      { to: '/params-management', label: 'nav.params', icon: 'params' },
      { to: '/dict-management', label: 'nav.dict', icon: 'dict' },
      { to: '/feature-management', label: 'nav.features', icon: 'feature' },
      { to: '/server-side-management', label: 'nav.server', icon: 'server' },
      { to: '/theme-generator', label: 'nav.themeGenerator', icon: 'palette' },
    ],
  },
];

export const TABS = [
  ...NAV[0].items.filter((i) => i.tab),
  { to: '/more', label: 'nav.more', icon: 'more' },
];
