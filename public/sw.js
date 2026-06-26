/* Equilibrio — service worker
   App-shell cache per il funzionamento offline.
   Aggiorna CACHE (es. v2) quando cambi i file per forzare il refresh. */

const CACHE = "equilibrio-v8";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(handle(req));
});

async function handle(req) {
  const url = new URL(req.url);
  const cache = await caches.open(CACHE);

  // Navigazioni: rete prima (per avere aggiornamenti), poi la shell in cache
  if (req.mode === "navigate") {
    try {
      return await fetch(req);
    } catch {
      return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
    }
  }

  // Google Fonts: cache-first a runtime (così funzionano offline dopo il primo caricamento)
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      cache.put(req, res.clone());
      return res;
    } catch {
      return hit || Response.error();
    }
  }

  // Tutto il resto: cache-first, poi rete
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (url.origin === self.location.origin && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}
