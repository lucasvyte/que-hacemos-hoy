/* Service worker: guarda la app para abrirla sin conexión. Cambiar CACHE en cada versión. */
const CACHE = "qhh-0.19.0";
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

/* Avisos: llega un aviso del servidor (worker/avisos.js) y se muestra como notificación */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "¿Qué hacemos hoy?", {
    body: d.body || "Hay algo nuevo en tu lista",
    icon: "icons/icon-192.png",
    badge: "icons/badge-96.png",
    tag: d.tag || undefined,
    renotify: !!d.tag, // si ya había un aviso de lo mismo, lo reemplaza y vuelve a sonar
    data: { url: d.url || "./" },
    lang: "es-AR"
  }));
});
/* Tocar el aviso: abre la app directo en lo que se creó (?g=lista&i=ítem o &p=plan).
   En Android siempre se abre de nuevo: traer al frente una ventana que estaba en segundo plano
   a veces deja la pantalla en negro. En la compu, si la app ya está abierta, se usa esa. */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  const android = /Android/i.test(self.navigator.userAgent);
  e.waitUntil((async () => {
    if (!android) {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const c = list.find(w => w.url.startsWith(self.registration.scope));
      if (c) {
        try { await c.focus(); c.postMessage({ qhhOpen: url }); return; } catch {}
      }
    }
    await self.clients.openWindow(url);
  })());
});
