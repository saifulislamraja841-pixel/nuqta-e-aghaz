/* Nuqta-e-Aghaz app — service worker
   - Pages: network first, so people always see the latest version; the saved copy is used offline.
   - Styles, scripts, images: served from the saved copy and refreshed in the background.
   - Google (Apps Script, Forms) and other sites: never cached, always live.
   Change VERSION whenever you deploy big changes, to clear old saved copies. */
const VERSION = "nuqta-app-20261120";
const SHELL = [
  "/app.html", "/index.html", "/portal.html", "/install.html", "/offline.html",
  "/about.html", "/competitions.html", "/talent.html", "/ambassadors.html", "/stalls.html", "/sponsors.html", "/faq.html",
  "/config.js", "/assets/core.js", "/assets/site.js", "/assets/style.css", "/assets/app.css", "/assets/mobile.css",
  "/assets/logo.png", "/assets/logo-full.png", "/assets/favicon.png", "/assets/app/icon-192.png", "/assets/app/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  const sameSite = url.origin === self.location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameSite && !fonts) return;                         // Apps Script, Google Forms, WhatsApp… always live
  if (sameSite && /^\/(dashboard\.html|apps-script\/)/.test(url.pathname)) return;   // team dashboard: never cached

  if (req.mode === "navigate") {                            // pages: network first, saved copy offline
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copy)); return res; })
        .catch(() => caches.match(url.pathname).then((r) => r || caches.match("/offline.html")))
    );
    return;
  }
  // assets: the exact same file (same ?v= version) comes from the saved copy; a new version is
  // downloaded and saved; when offline, any saved version of the file is used.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })))
  );
});
