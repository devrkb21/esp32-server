// The app's navigation, one list for the desktop sidebar, the phone's bottom bar and the
// "More" page. Labels are i18n keys (nav.*). `admin: true` groups show to super admins only.
// `feature: <name>` items show only when that feature is on (pub config systemWebMenu.features);
// `ownerOnly` items show to people who are not admins (admins reach them in the back office).
// `needs: <feature>` items show only when the chosen robot's product has that feature (a generic
// Nobix device has no Day or Look); with no robot chosen everything shows. `unless: <feature>`
// items hide when the robot has that feature (History lives inside Messages when there is one).
import { allows } from './products';

export const NAV = [
  {
    group: 'nav.group.robot',
    items: [
      { to: '/today', label: 'nav.today', icon: 'today', tab: true },
      { to: '/day', label: 'nav.day', icon: 'day', tab: true, ink: 'alarm', needs: 'day' },
      { to: '/messages', label: 'nav.messages', icon: 'message', tab: true, ink: 'message', needs: 'messages' },
      { to: '/history', label: 'nav.history', icon: 'history', ink: 'message', needs: 'chat_history', unless: 'messages' },
      { to: '/look', label: 'nav.look', icon: 'look', tab: true, ink: 'look', needs: 'look' },
      { to: '/robot', label: 'nav.robot', icon: 'settings', needs: 'companion' },
      { to: '/summary', label: 'nav.summary', icon: 'chart', needs: 'summary' },
    ],
  },
  {
    group: 'nav.group.inbox',
    items: [
      { to: '/notifications', label: 'nav.notifications', icon: 'bell', count: 'unread' },
      { to: '/invitations', label: 'nav.invitations', icon: 'family', count: 'invites' },
    ],
  },
  {
    group: 'nav.group.character',
    items: [
      { to: '/role-config', label: 'nav.character', icon: 'agent', needs: 'character' },
      { to: '/voice-print', label: 'nav.voiceprint', icon: 'voiceprint', needs: 'voiceprint' },
      { to: '/robots', label: 'nav.robots', icon: 'robots' },
      { to: '/voice-clone-management', label: 'nav.voiceClone', icon: 'voice', feature: 'voiceClone', ownerOnly: true },
    ],
  },
  {
    group: 'nav.group.backoffice',
    admin: true,
    items: [
      { to: '/user-management', label: 'nav.users', icon: 'users' },
      { to: '/ota-management', label: 'nav.ota', icon: 'firmware' },
      { to: '/model-config', label: 'nav.models', icon: 'model' },
      { to: '/usage', label: 'nav.usage', icon: 'history' },
      { to: '/provider-management', label: 'nav.providers', icon: 'provider' },
      { to: '/agent-template-management', label: 'nav.templates', icon: 'template' },
      { to: '/knowledge-base-management', label: 'nav.knowledge', icon: 'book', feature: 'knowledgeBase' },
      { to: '/voice-resource-management', label: 'nav.voiceResources', icon: 'voice' },
      { to: '/voice-clone-management', label: 'nav.voiceClone', icon: 'voice', feature: 'voiceClone' },
      { to: '/replacement-word-management', label: 'nav.replacementWords', icon: 'replace' },
      { to: '/address-book-management', label: 'nav.addressBook', icon: 'addressbook', feature: 'addressBook' },
      { to: '/params-management', label: 'nav.params', icon: 'params' },
      { to: '/sms-settings', label: 'nav.sms', icon: 'send' },
      { to: '/dict-management', label: 'nav.dict', icon: 'dict' },
      { to: '/feature-management', label: 'nav.features', icon: 'feature' },
      { to: '/product-management', label: 'nav.products', icon: 'devices' },
      { to: '/calendar-days', label: 'nav.calendar', icon: 'today' },
      { to: '/server-side-management', label: 'nav.server', icon: 'server' },
      { to: '/theme-generator', label: 'nav.themeGenerator', icon: 'palette' },
    ],
  },
];

export const TABS = [
  ...NAV[0].items.filter((i) => i.tab),
  { to: '/more', label: 'nav.more', icon: 'more' },
];

/** Features switched on in the public config (systemWebMenu may arrive as a JSON string). */
export function featuresOf(pubConfig) {
  let menu = pubConfig && pubConfig.systemWebMenu;
  if (typeof menu === 'string') { try { menu = JSON.parse(menu); } catch (e) { menu = null; } }
  const f = (menu && menu.features) || {};
  return (name) => (f[name] ? f[name].enabled !== false : true); // unknown: shown
}

/** The phone's tab bar for the chosen robot's features (`null`: no robot, every tab). */
export function visibleTabs(features) {
  return TABS.filter((t) => shows(features, t));
}

/** Does an item show for a robot's features? (`needs` it has; not `unless` it has; null: no robot) */
export function shows(features, item) {
  if (!allows(features, item.needs)) return false;
  return !item.unless || (Array.isArray(features) && !features.includes(item.unless));
}

/** The groups one person sees (`features`: the chosen robot's, or null when none is chosen). */
export function visibleNav(isAdmin, pubConfig, features = null) {
  const on = featuresOf(pubConfig);
  return NAV.filter((g) => !g.admin || isAdmin)
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => (!i.feature || on(i.feature)) && !(i.ownerOnly && isAdmin) && shows(features, i)),
    }))
    .filter((g) => g.items.length);
}
