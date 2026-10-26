import { reactive } from 'vue';
import Api from '@/apis/api';

// The account's inbox counts the shell shows: unread notifications (the bell) and pending family
// invitations (More and the account menu). The shell refreshes them every minute while visible;
// the notification and invitation pages set them right away after a change.
export const inbox = reactive({ unread: 0, invites: 0, loaded: false });

function call(fn, ...args) {
  return new Promise((resolve) => {
    if (typeof fn !== 'function') { resolve(null); return; }
    fn(...args, (res) => resolve(res?.data?.data ?? null), () => resolve(null));
  });
}

export async function refreshInbox() {
  const [count, invites] = await Promise.all([
    call(Api.notify && Api.notify.getUnreadCount),
    call(Api.family && Api.family.getInvites),
  ]);
  if (count && Number.isFinite(Number(count.unread))) inbox.unread = Number(count.unread);
  if (Array.isArray(invites)) inbox.invites = invites.length;
  inbox.loaded = true;
  return inbox;
}

/** The bell's number: at most "99+". */
export function badgeText(n, digitsFn = String) {
  const v = Number(n) || 0;
  if (v <= 0) return '';
  return v > 99 ? `${digitsFn(99)}+` : digitsFn(v);
}
