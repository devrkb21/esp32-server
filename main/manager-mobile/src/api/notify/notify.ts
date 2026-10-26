import { http } from '@/http/request/alova'

// Notifications (manager-api module `notify`): the account's notification rows, what notifies,
// and push subscriptions (web push for the H5 build; a native hook for uni-push/FCM later).
export interface NotificationItem {
  id: string
  type: string
  group: string
  titleBn: string
  titleEn: string
  bodyBn: string
  bodyEn: string
  deviceId?: string | null
  robotName?: string | null
  createdAt: number
  read: boolean
}

export interface NotificationPage {
  total: number
  unread: number
  list: NotificationItem[]
}

export interface NotifyPrefs {
  types: Record<string, boolean>
  offlineMinutes: number
  summaryPush: boolean
  webPush?: { publicKey: string, subscriptions: number }
}

const quiet = { meta: { ignoreAuth: false, toast: false }, cacheFor: { expire: 0 } }

export function getNotifications(page = 1, limit = 20, unread = false) {
  return http.Get<NotificationPage>('/notify/list', { ...quiet, params: { page, limit, unread: unread ? 1 : 0 } })
}

export function getUnreadCount() {
  return http.Get<{ unread: number }>('/notify/unread-count', quiet)
}

export function markNotificationRead(id: string) {
  return http.Post(`/notify/${id}/read`, {})
}

export function markAllNotificationsRead() {
  return http.Post('/notify/read-all', {})
}

export function getNotifyPrefs() {
  return http.Get<NotifyPrefs>('/notify/prefs', quiet)
}

export function saveNotifyPrefs(patch: Partial<Pick<NotifyPrefs, 'types' | 'offlineMinutes' | 'summaryPush'>>) {
  return http.Put<NotifyPrefs>('/notify/prefs', patch)
}

export function getVapidKey() {
  return http.Get<{ publicKey: string }>('/notify/push/vapid', quiet)
}

export interface PushSubscriptionBody {
  endpoint: string
  keys: { p256dh: string, auth: string }
  platform: 'web' | 'h5'
}

export function subscribePush(body: PushSubscriptionBody) {
  return http.Post('/notify/push/subscribe', body)
}

export function unsubscribePush(endpoint: string) {
  return http.Post('/notify/push/unsubscribe', { endpoint })
}

export function sendTestPush() {
  return http.Post('/notify/push/test', {})
}

/** Register a native push token (uni-push / FCM). The server keeps it; sending is not configured yet. */
export function registerNativePush(provider: 'unipush' | 'fcm', token: string) {
  return http.Post('/notify/push/native', { provider, token })
}
