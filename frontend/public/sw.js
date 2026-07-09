const CACHE_NAME = "constructor-ai-v1";
const APP_SCOPE = new URL(self.registration.scope);
const APP_SHELL = [
  APP_SCOPE.pathname,
  `${APP_SCOPE.pathname}manifest.webmanifest`,
  `${APP_SCOPE.pathname}icons/icon-192.png`,
  `${APP_SCOPE.pathname}icons/icon-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(APP_SCOPE.pathname)));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
