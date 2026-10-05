// © 2026 Nikita Berger
// App-Shell wird vorab gecacht, CDN-Dateien (daisyUI, KaTeX, Fonts, web-haptics) beim ersten Laden.
const V = "induktion-v2";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/gen.js", "js/core.js", "js/fx.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

// stale-while-revalidate: sofort aus dem Cache, im Hintergrund aktualisieren
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.open(V).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: false });
    const net = fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
