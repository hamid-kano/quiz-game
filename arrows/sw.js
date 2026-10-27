// يحفظ ملفات اللعبة لتعمل بدون إنترنت (الشبكة أولاً ثم النسخة المحفوظة)
const PREFIX = "arrows-v";
const CACHE = PREFIX + "3";
const FILES = ["./", "css/style.css", "fonts/cairo-arabic-400-normal.woff2", "fonts/cairo-arabic-700-normal.woff2", "fonts/cairo-arabic-900-normal.woff2", "fonts/cairo-latin-400-normal.woff2", "fonts/cairo-latin-700-normal.woff2", "fonts/cairo-latin-900-normal.woff2", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "index.html", "js/gen.js", "js/main.js", "js/sound.js", "manifest.json", "privacy.html"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
});
