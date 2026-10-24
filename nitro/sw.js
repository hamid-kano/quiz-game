// يحفظ ملفات اللعبة لتعمل بدون إنترنت (الشبكة أولاً ثم النسخة المحفوظة)
const PREFIX = "nitro-v";
const CACHE = PREFIX + "1";
const FILES = ["./", "audio/engine-motorcycle.wav", "audio/engine.wav", "audio/impact.mp3", "audio/skid.wav", "css/style.css", "fonts/cairo-arabic-400-normal.woff2", "fonts/cairo-arabic-700-normal.woff2", "fonts/cairo-arabic-900-normal.woff2", "fonts/cairo-latin-400-normal.woff2", "fonts/cairo-latin-700-normal.woff2", "fonts/cairo-latin-900-normal.woff2", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "img/smoke.png", "index.html", "js/audio.js", "js/main.js", "js/sim.js", "js/tracks.js", "js/view.js", "lib/loaders/GLTFLoader.js", "lib/three.core.min.js", "lib/three.module.min.js", "lib/utils/BufferGeometryUtils.js", "lib/utils/SkeletonUtils.js", "manifest.json", "models/Textures/colormap.png", "models/decoration-empty.glb", "models/decoration-forest.glb", "models/decoration-tents.glb", "models/track-bump.glb", "models/track-corner.glb", "models/track-finish.glb", "models/track-straight.glb", "models/track-tents.glb", "models/vehicle-motorcycle.glb", "models/vehicle-truck-green.glb", "models/vehicle-truck-purple.glb", "models/vehicle-truck-red.glb", "models/vehicle-truck-yellow.glb", "privacy.html"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
});
