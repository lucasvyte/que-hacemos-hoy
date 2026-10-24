/* Service worker: guarda la app para abrirla sin conexión. Cambiar CACHE en cada versión. */
const CACHE = "qhh-0.15.0";
const SHELL = ["./", "index.html", "styles.css", "app.js", "caption.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const cdn = /(^|\.)(gstatic\.com|unpkg\.com|googleapis\.com)$/.test(url.hostname) && !url.hostname.startsWith("firestore") && !url.hostname.includes("identitytoolkit") && !url.hostname.includes("securetoken");
  if (url.origin === location.origin) {
    // la app: primero la red sin usar la caché del navegador (GitHub Pages la guarda 10 min), si no hay conexión, la copia guardada
    const key = req.mode === "navigate" ? "./" : req;
    e.respondWith(fetch(req, { cache: "no-cache" }).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(key, cp)); } return r; })
      .catch(() => caches.match(key, { ignoreSearch: true })));
  } else if (cdn) {
    // librerías y fuentes: la copia guardada primero
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
  }
});
