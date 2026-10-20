// عامل الخدمة: يحفظ كل ملفات التطبيق ليعمل بدون إنترنت
// غيّر رقم الإصدار عند إضافة ملفات جديدة
const CACHE = "huroofi-v5";
const FILES = [
  "./", "index.html", "manifest.json", "icon.svg",
  "css/style.css",
  "js/main.js", "js/data.js", "js/store.js", "js/games.js", "js/sfx.js", "js/util.js", "js/parents.js", "js/rewards.js", "js/stories.js", "js/garden.js",
  "fonts/cairo-arabic-400-normal.woff2", "fonts/cairo-arabic-700-normal.woff2", "fonts/cairo-arabic-900-normal.woff2",
  "fonts/cairo-latin-400-normal.woff2", "fonts/cairo-latin-700-normal.woff2", "fonts/cairo-latin-900-normal.woff2",
  "fonts/noto-naskh-arabic-arabic-700-normal.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-192.png", "icons/maskable-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// الشبكة أولاً (لتصل التحديثات فوراً) ثم النسخة المحفوظة عند انقطاع الإنترنت
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
