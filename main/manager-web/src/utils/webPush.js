import Api from '@/apis/api';

// Web push for this browser: permission, the service worker (public/tb-push-sw.js) and the push
// subscription manager-api sends to (POST /notify/push/subscribe, VAPID key from
// /notify/push/vapid). Every step answers with a reason the page can put in words; nothing throws.

const SW_FILE = 'tb-push-sw.js';

/** 'ok' when this browser can take web push; else why not: 'insecure' | 'unsupported'. */
export function pushSupport(win = typeof window === 'undefined' ? null : window) {
  if (!win) return 'unsupported';
  if (win.isSecureContext === false) return 'insecure';
  if (!win.navigator || !('serviceWorker' in win.navigator) || !('PushManager' in win) || !('Notification' in win)) return 'unsupported';
  return 'ok';
}

/** The browser's notification permission: 'granted' | 'denied' | 'default' | 'unsupported'. */
export function permissionState(win = typeof window === 'undefined' ? null : window) {
  return win && 'Notification' in win ? win.Notification.permission : 'unsupported';
}

/** A base64url VAPID key as the bytes PushManager.subscribe wants. */
export function keyBytes(base64url) {
  const s = String(base64url || '');
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** A PushSubscription as manager-api takes it. */
export function subscriptionBody(sub, platform = 'web') {
  const json = sub && typeof sub.toJSON === 'function' ? sub.toJSON() : sub || {};
  const keys = json.keys || {};
  return { endpoint: json.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, platform };
}

const call = (fn, ...args) => new Promise((resolve, reject) => {
  fn(...args, (res) => resolve(res && res.data ? res.data.data : null), (err) => reject(err));
});

function swUrl() {
  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${SW_FILE}`;
}

/** Tell the worker the reader's language, so notifications arrive in it. */
export async function sendLanguage(lang) {
  if (pushSupport() !== 'ok') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration(swUrl());
    const w = reg && (reg.active || reg.waiting || reg.installing);
    if (w) w.postMessage({ type: 'lang', lang });
  } catch (e) { /* not registered */ }
}

/** This browser's current push subscription, or null. */
export async function currentSubscription() {
  if (pushSupport() !== 'ok') return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration(swUrl());
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch (e) { return null; }
}

/** Turn push on: { ok: true } or { ok: false, reason: 'unsupported' | 'insecure' | 'denied' | 'nokey' | 'failed' }. */
export async function enablePush(lang) {
  const support = pushSupport();
  if (support !== 'ok') return { ok: false, reason: support };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  try {
    const vapid = await call(Api.notify.getVapidKey);
    if (!vapid || !vapid.publicKey) return { ok: false, reason: 'nokey' };
    const reg = await navigator.serviceWorker.register(swUrl());
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid.publicKey) });
    await call(Api.notify.subscribe, subscriptionBody(sub, 'web'));
    await sendLanguage(lang);
    return { ok: true };
  } catch (e) {
    console.warn('[push] enable failed', e);
    return { ok: false, reason: 'failed' };
  }
}

/** Turn push off for this browser. */
export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return { ok: true };
  try {
    await call(Api.notify.unsubscribe, sub.endpoint).catch(() => null);
    await sub.unsubscribe();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'failed' };
  }
}
