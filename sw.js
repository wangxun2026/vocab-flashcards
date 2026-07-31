const CACHE_NAME = "vocab-cache-v3";
const ASSETS = ["./", "index.html", "style.css?v=3", "app.js?v=3", "seed.js?v=3", "manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  self.clients.claim();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    // no-cache: revalidate with the server instead of trusting the HTTP cache
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
