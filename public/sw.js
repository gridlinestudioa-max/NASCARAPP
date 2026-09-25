// Deliberately narrow in scope: every page in this app is a dynamic,
// per-user server render (picks, lock times, standings — see the "ƒ"
// route table from `next build`), so caching HTML/API/RSC responses risks
// showing a user a stale lineup-lock state or another account's page on a
// shared device. This worker only ever caches genuinely static, non-
// personalized assets, and exists mainly to (a) satisfy the installability
// signal some browsers still want and (b) show a friendly offline page
// instead of a browser error when navigation truly has no network.

const SHELL_CACHE = "nascarhq-shell-v1";
const ASSET_CACHE = "nascarhq-assets-v1";
const OFFLINE_URL = "/offline.html";

const SHELL_ASSETS = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];

// Static, non-personalized image folders — safe to serve stale-while-
// revalidate since a mismatch is cosmetic (an old driver photo/number/
// logo for one extra visit), never wrong game-state data.
const STATIC_ASSET_PREFIXES = ["/driver-photos/", "/driver-numbers/", "/race-logos/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations: always go to the network for real, current data;
  // only fall back to the offline page if the network is truly down.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error())),
    );
    return;
  }

  // Next's own content-hashed build output — safe to cache-first forever.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Driver photos / number badges / race logos — stale-while-revalidate.
  if (STATIC_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request).then((res) => {
            cache.put(request, res.clone());
            return res;
          });
          return cached ?? network;
        }),
      ),
    );
    return;
  }

  // Everything else (API routes, RSC payloads, auth-sensitive data) —
  // untouched, straight to the network every time.
});
