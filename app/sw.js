// © 2026 Nikita Berger
// App-Shell wird vorab gecacht, CDN-Dateien (daisyUI, KaTeX, Fonts, ios-vibrator-pro-max) beim ersten Laden.
// Nach jeder Änderung an den Dateien V erhöhen, dann holt sich jedes Gerät die neue Fassung geschlossen.
const V = "induktion-v26";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/gen.js", "js/core.js", "js/fx.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

// Eigene Dateien: erst Netz (immer frisch, am Gerät umgehen wir auch den HTTP-Cache), offline aus dem Cache.
// CDN-Dateien (ändern sich nie): aus dem Cache, beim ersten Mal aus dem Netz.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const own = new URL(e.request.url).origin === location.origin;
  e.respondWith(caches.open(V).then(async (c) => {
    const hit = await c.match(e.request);
    if (!own && hit) return hit;
    try {
      const r = await fetch(own ? new Request(e.request, { cache: "no-cache" }) : e.request);
      if (r.status === 200 || r.type === "opaque") c.put(e.request, r.clone()).catch(() => {});
      return r;
    } catch (err) { if (hit) return hit; throw err; }
  }));
});
