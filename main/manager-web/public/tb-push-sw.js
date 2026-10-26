/* Nobix web push service worker (manager-web). Shows the notifications manager-api pushes
 * (module notify, VAPID) and opens the notifications page when one is clicked. The page tells
 * it the reader's language with a message {type: 'lang', lang: 'bn' | 'en'}; Bangla is the default. */
const DB = 'tb-push';
let lang = 'bn';

function withStore(mode, fn) {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const req = fn(open.result.transaction('kv', mode).objectStore('kv'));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      };
    } catch (e) { resolve(null); }
  });
}

async function readLang() {
  const saved = await withStore('readonly', (s) => s.get('lang'));
  return saved || lang;
}

function saveLang(value) {
  lang = value === 'en' ? 'en' : 'bn';
  withStore('readwrite', (s) => s.put(lang, 'lang'));
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'lang') saveLang(event.data.lang);
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
    const l = await readLang();
    const title = (l === 'en' ? data.titleEn : data.titleBn) || data.title || 'Nobix';
    const body = (l === 'en' ? data.bodyEn : data.bodyBn) || data.body || '';
    const scope = self.registration.scope;
    await self.registration.showNotification(title, {
      body,
      tag: data.id ? 'tb-' + data.id : undefined,
      icon: scope + 'apple-touch-icon.png',
      badge: scope + 'favicon.ico',
      lang: l === 'en' ? 'en' : 'bn',
      data: { url: data.url || '/notifications', id: data.id },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const scope = self.registration.scope;
  const path = (event.notification.data && event.notification.data.url) || '/notifications';
  const target = scope + '#' + path;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.indexOf(scope) === 0) {
        await w.focus();
        if ('navigate' in w) { try { await w.navigate(target); } catch (e) { /* gone */ } }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
