// عامل الخدمة: يحفظ كل ملفات التطبيق ليعمل بدون إنترنت
// غيّر رقم الإصدار عند إضافة ملفات جديدة
// كل تطبيق له بادئة خاصة (العربي والإنجليزي على نفس الموقع)، ولا يحذف إلا نسخه القديمة
const PREFIX = "huroofi-v";
const CACHE = PREFIX + "20";
const FILES = [
  "./", "index.html", "manifest.json", "icon.svg",
  "css/style.css", "css/lang.css",
  "js/main.js", "js/data.js", "js/store.js", "js/games.js", "js/sfx.js", "js/util.js", "js/parents.js", "js/rewards.js", "js/stories.js", "js/garden.js", "js/exercises.js", "js/spellguide.js", "js/tracecheck.js", "js/arcade.js", "js/vocab.js", "js/native.js", "js/lang.js", "js/lang-exercises.js", "vendor/capacitor.js", "privacy.html",
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
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
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
