"""يحاكي بيئة تطبيق أندرويد (جسر Capacitor) داخل المتصفح ويتحقق من:
- النطق يمر عبر محرّك الجوال (TextToSpeech) لا عبر المتصفح، بلا قطع للمديح وبلا نطق بعد الإجابة
- حفظ الشهادة والنسخة الاحتياطية يمر عبر Filesystem + Share
- زر الرجوع في أندرويد يرجع داخل التطبيق
- لا يُسجَّل عامل الخدمة داخل التطبيق"""
import asyncio, sys
from helpers import async_playwright, BASE, start_server, new_kid

NATIVE = r"""
(() => {
  const log = []; window.__native = log; window.__speech = log;
  let cur = null;
  const methods = {
    TextToSpeech: ['speak', 'stop', 'isLanguageSupported', 'openInstall', 'getSupportedLanguages'],
    Filesystem: ['writeFile'], Share: ['share'], App: ['exitApp', 'minimizeApp']
  };
  const impl = {
    TextToSpeech: {
      speak: (o) => new Promise((res) => {
        log.push({ ev: 'start', text: o.text, t: performance.now() });
        cur = { res, timer: setTimeout(() => { log.push({ ev: 'end', text: o.text, t: performance.now() }); cur = null; res(); }, o.text.length * 60 / (o.rate || 1)) };
        cur.text = o.text;
      }),
      stop: async () => { if (cur) { clearTimeout(cur.timer); log.push({ ev: 'cancel', text: cur.text, t: performance.now() }); const r = cur.res; cur = null; r(); } },
      isLanguageSupported: async () => ({ supported: true }),
      openInstall: async () => log.push({ ev: 'openInstall' }),
      getSupportedLanguages: async () => ({ languages: ['ar-SA'] })
    },
    Filesystem: { writeFile: async (o) => { log.push({ ev: 'writeFile', path: o.path, size: o.data.length, dir: o.directory }); return { uri: 'file:///cache/' + o.path }; } },
    Share: { share: async (o) => { log.push({ ev: 'share', files: o.files }); return {}; } },
    App: { exitApp: async () => log.push({ ev: 'exit' }), minimizeApp: async () => log.push({ ev: 'minimize' }) }
  };
  const listeners = {};
  window.androidBridge = { postMessage() {} };
  window.Capacitor = {
    PluginHeaders: Object.entries(methods).map(([name, ms]) => ({ name, methods: [...ms.map((m) => ({ name: m, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] })),
    nativePromise: (p, m, o) => impl[p][m](o || {}),
    nativeCallback: (p, m, o, cb) => { if (m === 'addListener') { (listeners[o.eventName] ||= []).push(cb); return Promise.resolve('cb1'); } }
  };
  window.__fireBack = () => (listeners.backButton || []).forEach((cb) => cb({ canGoBack: false }));
  // نطق المتصفح يجب ألا يُستخدم في التطبيق
  window.__webSpeechUsed = false;
  Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [], speak() { window.__webSpeechUsed = true; }, cancel() {}, speaking: false, pending: false } });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  new MutationObserver(() => {
    const r = document.querySelector('.choice.right');
    if (r && !r.__seen) { r.__seen = 1; log.push({ ev: 'answered', t: performance.now() }); }
    const p = document.querySelector('.prompt');
    if (p && !p.__seen && document.querySelector('.choices')) { p.__seen = 1; log.push({ ev: 'render', t: performance.now() }); }
  }).observe(document, { subtree: true, childList: true, attributes: true });
})();
"""

async def main():
    start_server()
    problems = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
        await ctx.add_init_script(NATIVE)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await new_kid(pg, "small")
        if not await pg.evaluate("()=>window.Capacitor.isNativePlatform()"): problems.append("app did not detect native mode")
        sw = await pg.evaluate("async()=>!!(await navigator.serviceWorker.getRegistration())")
        if sw: problems.append("service worker registered inside the app")

        # النطق: سؤال "أول صوت" بإجابات سريعة
        await pg.click(".skill-card[data-skill='sounds']"); await pg.click(".activity[data-id='first']")
        for _ in range(6):
            await pg.wait_for_selector(".choice:not([disabled])", timeout=15000)
            await pg.evaluate("()=>{for(const b of document.querySelectorAll('.choice')){if(document.querySelector('.choice.right'))break;b.click()}}")
            await pg.wait_for_selector(".choice.right")
            await pg.wait_for_function("() => !document.querySelector('.choice.right') || document.querySelector('.result')", timeout=20000)
        await pg.wait_for_selector(".result", timeout=20000)
        log = await pg.evaluate("()=>window.__native")
        state, pending = None, []
        for e in log:
            if e["ev"] == "answered": state, pending = "after", []
            elif e["ev"] == "render":
                if state == "after": problems += ["praise cut: " + t["text"] for t in pending if t["status"] != "ended"]
                state = "q"
            elif e["ev"] == "start" and state == "after":
                if "..." in e["text"]: problems.append("question audio after answer: " + e["text"])
                pending.append({"text": e["text"], "status": "playing"})
            elif e["ev"] in ("end", "cancel") and state == "after":
                for t in pending:
                    if t["text"] == e["text"] and t["status"] == "playing": t["status"] = "ended" if e["ev"] == "end" else "cancelled"
        if not any(e["ev"] == "start" for e in log): problems.append("native TTS never used")
        if await pg.evaluate("()=>window.__webSpeechUsed"): problems.append("browser speech used inside the app")

        # زر الرجوع: من شاشة النتيجة إلى القسم ثم إلى الرئيسية ثم تصغير التطبيق
        await pg.evaluate("()=>window.__fireBack()"); await pg.wait_for_timeout(300)
        if not await pg.locator(".activity").count(): problems.append("back button: result -> skill failed")
        await pg.evaluate("()=>window.__fireBack()"); await pg.wait_for_timeout(300)
        if not await pg.locator(".skill-card").count(): problems.append("back button: skill -> home failed")
        await pg.evaluate("()=>window.__fireBack()"); await pg.wait_for_timeout(300)
        if not any(e["ev"] in ("minimize", "exit") for e in await pg.evaluate("()=>window.__native")): problems.append("back button on home did not leave the app")

        # النسخة الاحتياطية عبر المشاركة
        await pg.click("#parents"); await pg.wait_for_timeout(300)
        q = await pg.locator(".prompt .big").inner_text()
        import re
        x, y = map(int, re.findall(r"\d+", q)[:2])
        await pg.click(f".choice[data-v='{x * y}']"); await pg.wait_for_timeout(400)
        await pg.click("#export"); await pg.wait_for_timeout(500)
        nl = await pg.evaluate("()=>window.__native")
        if not any(e["ev"] == "writeFile" and e["path"].endswith(".json") for e in nl): problems.append("backup not written via Filesystem")
        if not any(e["ev"] == "share" for e in nl): problems.append("backup not shared")
        if not await pg.locator("a[href='privacy.html']").count(): problems.append("privacy link missing")

        # الشهادة: نمنح شهادة ونحفظها
        await pg.evaluate("async()=>{const {store}=await import('./js/store.js');store.active.daily.best=7;store.addCertificate('streak-7');}")
        await pg.click("#back"); await pg.wait_for_timeout(300)
        await pg.click("#certs"); await pg.wait_for_timeout(300)
        await pg.locator(".cert-item:not(.locked)").first.click(); await pg.wait_for_timeout(1500)
        if await pg.locator("#print").is_visible(): problems.append("print button shown inside the app")
        await pg.click("#dl"); await pg.wait_for_timeout(600)
        nl = await pg.evaluate("()=>window.__native")
        if not any(e["ev"] == "writeFile" and e["path"].endswith(".png") and e["size"] > 10000 for e in nl): problems.append("certificate not written via Filesystem")

        # صفحة الخصوصية
        await pg.goto(BASE + "privacy.html"); await pg.wait_for_timeout(300)
        if "سياسة الخصوصية" not in await pg.title(): problems.append("privacy page missing")
        await b.close()
    if errs: problems.append("page errors: " + "; ".join(errs[:3]))
    print("native mode problems:", problems or "none")
    sys.exit(1 if problems else 0)

asyncio.run(main())
