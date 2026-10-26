/* Nobix web push (H5 build). Registered by src/utils/webPush.ts with the scope static/.
   The server sends JSON: { id, type, title, body, titleBn, titleEn, bodyBn, bodyEn, deviceId, url }.
   The app is Bangla first: the Bangla title and text are shown when the server sent them. */
globalThis.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  }
  catch (e) {
    data = { title: 'Nobix', body: event.data ? event.data.text() : '' }
  }
  const title = data.titleBn || data.title || data.titleEn || 'Nobix'
  const body = data.bodyBn || data.body || data.bodyEn || ''
  event.waitUntil(globalThis.registration.showNotification(title, {
    body,
    tag: data.id ? `nobix-${data.id}` : undefined,
    icon: new URL('brand/nx-mark.png', globalThis.registration.scope).href,
    data: { url: data.url || '/notifications' },
  }))
})

globalThis.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // The phone app routes by hash: /notifications -> #/pages/notifications/index
  const page = String((event.notification.data && event.notification.data.url) || '/notifications').replace(/^\/+/, '')
  const target = page.startsWith('pages/') ? page : `pages/${page}/index`
  const root = new URL('../', globalThis.registration.scope).href
  event.waitUntil(globalThis.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(root) && 'focus' in c) {
        c.navigate(`${root}#/${target}`)
        return c.focus()
      }
    }
    return globalThis.clients.openWindow(`${root}#/${target}`)
  }))
})
