import { reactive } from 'vue'
import { getInvites } from '@/api/family/family'
import { getUnreadCount } from '@/api/notify/notify'

/**
 * Small counts the shell shows: unread notifications (the bell on Today) and invitations that
 * wait for an answer (More). Refreshed when a screen shows; a failed call keeps the last count.
 */
export const badges = reactive({ unread: 0, invites: 0 })

export async function refreshUnread() {
  try {
    const res = await getUnreadCount()
    badges.unread = Math.max(0, Number(res?.unread) || 0)
  }
  catch {}
  return badges.unread
}

export async function refreshInvites() {
  try {
    const list = await getInvites()
    badges.invites = Array.isArray(list) ? list.length : 0
  }
  catch {}
  return badges.invites
}
