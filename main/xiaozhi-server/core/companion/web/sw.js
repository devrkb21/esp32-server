/* TinyBot companion service worker: caches the app shell, never the API. */
var CACHE = "tinybot-app-v1";
var SHELL = ["./", "index.html", "app.js", "app.css", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin || url.pathname.indexOf("/app/") !== 0) return;
  // Network first so updates show up at once; cached shell when the server is unreachable
  event.respondWith(fetch(event.request).then(function (resp) {
    if (resp.ok) {
      var copy = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(event.request, copy); });
    }
    return resp;
  }).catch(function () {
    return caches.match(event.request).then(function (hit) { return hit || caches.match("index.html"); });
  }));
});
