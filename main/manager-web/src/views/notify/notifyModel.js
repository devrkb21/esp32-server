// Notification page rules (pure: unit tested in tests/notify.test.mjs). Shapes follow manager-api's
// notify module: list items {id, type, group, titleBn, titleEn, bodyBn, bodyEn, deviceId,
// robotName, createdAt, read} and prefs {types, offlineMinutes, summaryPush, webPush}.

/** The groups a person can switch, in the order the settings list them. */
export const GROUPS = ['offline', 'alarm', 'reminder', 'care', 'summary', 'family'];

/** Minutes offline before a "robot offline" notification (server allows 10..720). */
export const OFFLINE_CHOICES = [10, 15, 30, 60, 120, 240];

const TYPE_GROUP = {
  robot_offline: 'offline',
  alarm_missed: 'alarm',
  reminder_missed: 'reminder',
  care_no_activity: 'care',
  care_fall: 'care',
  care_medicine: 'care',
  daily_summary: 'summary',
  family_invite: 'family',
  family_joined: 'family',
};

/** The switchable group of a notification (its own `group` first, then by type; 'other' if unknown). */
export function groupOf(n) {
  if (n && GROUPS.includes(n.group)) return n.group;
  return TYPE_GROUP[n && n.type] || 'other';
}

/** The square mark's ink of a group: alarms and reminders red, care warn, the rest quiet. */
export function inkOf(group) {
  return { alarm: 'alarm', reminder: 'alarm', care: 'warn', summary: 'routine', family: 'ink', offline: 'ink-3' }[group] || 'ink-2';
}

/** Title and body in the reader's language, falling back to the other one. */
export function textOf(n, lang) {
  const x = n || {};
  const en = lang === 'en';
  return {
    title: (en ? x.titleEn || x.titleBn : x.titleBn || x.titleEn) || '',
    body: (en ? x.bodyEn || x.bodyBn : x.bodyBn || x.bodyEn) || '',
  };
}

/** Where a notification leads when opened (a route path), or '' to stay. */
export function linkOf(n) {
  const g = groupOf(n);
  if (n && n.type === 'family_invite') return '/invitations';
  if (g === 'summary') return '/summary';
  if (g === 'alarm' || g === 'reminder') return '/day';
  if (g === 'family') return '/robot?tab=family';
  if (g === 'care') return '/robot?tab=care';
  return '';
}

/** Day buckets for headings: 'today' | 'yesterday' | 'earlier'. */
export function bucketOf(createdAt, now = Date.now()) {
  const d = new Date(Number(createdAt) || 0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (d >= start) return 'today';
  if (d >= new Date(start.getTime() - 86400000)) return 'yesterday';
  return 'earlier';
}

/** Group a newest-first list into [{ key, items }] buckets, keeping order. */
export function bucketed(list, now = Date.now()) {
  const out = [];
  for (const n of list || []) {
    const key = bucketOf(n.createdAt, now);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(n);
    else out.push({ key, items: [n] });
  }
  return out;
}

/** The prefs as the page edits them, with every group present (missing = on). */
export function prefsForm(raw) {
  const p = raw || {};
  const types = {};
  for (const g of GROUPS) types[g] = !(p.types && p.types[g] === false);
  const min = Number(p.offlineMinutes);
  return {
    types,
    offlineMinutes: Number.isFinite(min) && min >= 10 && min <= 720 ? Math.round(min) : 30,
    summaryPush: p.summaryPush !== false,
  };
}

/** Merge newly fetched items into a list, newest first, without duplicates. */
export function mergeList(list, more) {
  const seen = new Set();
  return [...(list || []), ...(more || [])].filter((n) => (seen.has(n.id) ? false : seen.add(n.id)))
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
}
