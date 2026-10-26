import { getVapidKey, subscribePush, unsubscribePush } from '@/api/notify/notify'
import { base64UrlToBytes, bytesToBase64Url } from '@/utils/notifyModel.mjs'

/**
 * Web push for the H5 build: a service worker (src/static/tb-push-sw.js, served at static/) shows
 * the notifications the server pushes with its VAPID key (GET /notify/push/vapid). The private key
 * never leaves the server. The native app does not use this: see src/utils/nativePush.ts.
 *
 *   pushState()   'unsupported' | 'denied' | 'off' | 'on'
 *   enablePush()  asks for permission, subscribes and tells the server (platform 'h5')
 *   disablePush() unsubscribes here and on the server
 */
export type PushState = 'unsupported' | 'denied' | 'off' | 'on'

const SW_PATH = 'static/tb-push-sw.js'

function supported(): boolean {
  // #ifdef H5
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  // #endif
  // #ifndef H5
  return false
  // #endif
}

async function registration(create: boolean): Promise<ServiceWorkerRegistration | null> {
  // #ifdef H5
  const url = new URL(SW_PATH, document.baseURI)
  const scope = new URL('static/', document.baseURI).pathname
  const found = await navigator.serviceWorker.getRegistration(scope)
  if (found || !create)
    return found || null
  return navigator.serviceWorker.register(url.pathname, { scope })
  // #endif
  // #ifndef H5
  return null
  // #endif
}

export async function pushState(): Promise<PushState> {
  if (!supported())
    return 'unsupported'
  if (Notification.permission === 'denied')
    return 'denied'
  try {
    const reg = await registration(false)
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return sub ? 'on' : 'off'
  }
  catch {
    return 'off'
  }
}

export async function enablePush(): Promise<PushState> {
  if (!supported())
    return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted')
    return permission === 'denied' ? 'denied' : 'off'
  const { publicKey } = await getVapidKey()
  const reg = await registration(true)
  if (!reg || !publicKey)
    return 'off'
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
  await subscribePush({
    endpoint: sub.endpoint,
    keys: { p256dh: bytesToBase64Url(sub.getKey('p256dh')), auth: bytesToBase64Url(sub.getKey('auth')) },
    platform: 'h5',
  })
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  if (!supported())
    return 'unsupported'
  const reg = await registration(false)
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (sub) {
    await unsubscribePush(sub.endpoint).catch(() => {})
    await sub.unsubscribe()
  }
  return 'off'
}
