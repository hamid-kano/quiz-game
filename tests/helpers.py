"""
أدوات مشتركة لاختبارات حروفي الآلية (Playwright).
- MOCK: صوت عربي محاكى يسجّل بداية كل عبارة ونهايتها، ويحاكي أجهزة مختلفة
- حلول آلية لكل نوع من التمارين والألعاب
"""
import asyncio, sys, os, re, contextlib, threading, http.server, socketserver, functools
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def _pick_port():
    """منفذ الخادم: من متغير البيئة، أو أول منفذ يعمل عليه خادم حروفي، أو أول منفذ فارغ."""
    if os.environ.get("HUROOFI_PORT"):
        return int(os.environ["HUROOFI_PORT"])
    import socket, urllib.request
    for p in range(8765, 8800):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{p}/kids/js/data.js", timeout=1)
            return p
        except Exception:
            pass
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            return p
        except OSError:
            continue
        finally:
            s.close()
    return 8765

PORT = _pick_port()
os.environ["HUROOFI_PORT"] = str(PORT)
# التطبيق المختبَر: العربي (kids) أو الإنجليزي (english/www) — HUROOFI_APP=english
APP = os.environ.get("HUROOFI_APP", "kids")
APP_DIR = {"kids": "kids", "english": "english/www"}[APP]
BASE = f"http://127.0.0.1:{PORT}/{APP_DIR}/"
STORE_KEY = {"kids": "huroofi-v2", "english": "huroofi-en-v1"}[APP]

def start_server():
    """يشغّل خادماً محلياً للمستودع إن لم يكن يعمل."""
    import urllib.request
    try:
        urllib.request.urlopen(BASE, timeout=5)
        return None
    except Exception:
        pass
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    class Quiet(handler.func):
        def log_message(self, *a): pass
    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True  # يسمح بإعادة استخدام المنفذ مباشرة بعد إغلاق خادم سابق
    try:
        httpd = Server(("127.0.0.1", PORT), functools.partial(Quiet, directory=ROOT))
    except OSError:
        return None  # خادم آخر يعمل على المنفذ نفسه
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

MOCK = r"""
(() => {
  const MODE = window.__ttsMode || localStorage.getItem('__ttsMode') || 'normal';
  const log = []; window.__speech = log; let cur = null;
  const voice = { lang: 'ar-SA', name: 'Fake Arabic', voiceURI: 'fake', localService: true, default: true };
  const synth = {
    getVoices: () => (MODE === 'android' ? [] : [voice]), onvoiceschanged: null,
    get speaking() { return !!cur; }, get pending() { return queue.length > 0; },
    // مثل المتصفحات الحقيقية: العبارات تنتظر في طابور، و cancel يلغي الحالية وكل ما ينتظر
    cancel() {
      const waiting = queue.splice(0);
      if (cur) { log.push({ ev: 'cancel', text: cur.u.text, t: performance.now() }); clearTimeout(cur.timer); const u = cur.u; cur = null; u.onerror && u.onerror({ error: 'canceled' }); }
      waiting.forEach((u) => u.onerror && u.onerror({ error: 'canceled' }));
    },
    speak(u) { if (cur) queue.push(u); else play(u); }
  };
  const queue = [];
  const play = (u) => {
    const dur = u.text.length * 60 / u.rate;
    log.push({ ev: 'start', text: u.text, t: performance.now() });
    u.onstart && setTimeout(() => u.onstart({}), 10);
    cur = { u, timer: setTimeout(() => { log.push({ ev: 'end', text: u.text, t: performance.now() }); cur = null; if (MODE !== 'noend') u.onend && u.onend(); if (queue.length) play(queue.shift()); }, dur) };
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.rate = 1; };
  new MutationObserver(() => {
    const r = document.querySelector('.choice.right');
    if (r && !r.__seen) { r.__seen = 1; log.push({ ev: 'answered', t: performance.now() }); }
    const p = document.querySelector('.prompt');
    if (p && !p.__seen && document.querySelector('.choices')) { p.__seen = 1; log.push({ ev: 'render', t: performance.now() }); }
  }).observe(document, { subtree: true, childList: true, attributes: true });
})();
"""

SCAN = """()=>{const g=document.getElementById('guide');const c=g.getContext('2d');const W=g.width,H=g.height;const d=c.getImageData(0,0,W,H).data;
  // نرسم فقط بكسلات الحرف (رمادي فاتح/بنفسجي) ونتجاهل الإطار والعلامات الملونة
  const ink=(x,y)=>{const k=(y*W+x)*4;if(d[k+3]<=40)return false;const r=d[k],gg=d[k+1],b=d[k+2];const green=gg>150&&r<100;const yellow=r>200&&gg>150&&b<80;const frame=r>170&&b>220&&gg<200;return !green&&!yellow&&!frame;};
  const N=96,cell=W/N,grid=new Int32Array(N*N).fill(-1),on=new Uint8Array(N*N);
  for(let gy=0;gy<N;gy++)for(let gx=0;gx<N;gx++){if(ink(Math.floor((gx+.5)*cell),Math.floor((gy+.5)*cell)))on[gy*N+gx]=1;}
  const parts=[];for(let i=0;i<N*N;i++){if(!on[i]||grid[i]>=0)continue;const id=parts.length,q=[i];grid[i]=id;for(let k=0;k<q.length;k++){const j=q[k],x=j%N,y=(j/N)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,m=ny*N+nx;if(nx>=0&&ny>=0&&nx<N&&ny<N&&on[m]&&grid[m]<0){grid[m]=id;q.push(m)}}}parts.push(q.length)}
  const body=parts.indexOf(Math.max(...parts));
  const segs=[];const step=Math.max(2,Math.round(W/45));
  for(let y=0;y<H;y+=step){let s=-1;for(let x=0;x<W;x++){const a=ink(x,y);if(a&&s<0)s=x;if((!a||x==W-1)&&s>=0){const gx=Math.floor((s+x)/2/cell),gy=Math.floor(y/cell);segs.push({seg:[s/W,x/W,y/H],body:grid[gy*N+gx]===body});s=-1}}}
  return [...segs.filter(z=>z.body),...segs.filter(z=>!z.body)].map(z=>z.seg)}"""

async def new_kid(pg, age, name="تجربة"):
    await pg.goto(BASE); await pg.evaluate("()=>localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(500)
    await pg.fill("#kid-name", name); await pg.click(f"[data-age={age}]"); await pg.click("#go"); await pg.wait_for_timeout(300)

# ---------------- حلول التمارين ----------------
async def solve_choice(pg):
    n = await pg.locator(".choice").count()
    for i in range(n):
        b = pg.locator(".choice").nth(i)
        if await b.is_disabled(): continue
        await b.click(); await pg.wait_for_timeout(60)
        if await pg.locator(".choice.right").count(): return
async def solve_build(pg):
    while await pg.locator(".slot:not(.filled)").count():
        n = await pg.locator(".tile").count()
        for i in range(n):
            t = pg.locator(".tile").nth(i)
            if "used" in (await t.get_attribute("class")): continue
            before = await pg.locator(".slot.filled").count()
            await t.click(); await pg.wait_for_timeout(20)
            if await pg.locator(".slot.filled").count() > before: break
async def solve_trace(pg):
    await pg.wait_for_timeout(300)
    segs = await pg.evaluate("""()=>{const g=document.getElementById('guide');const c=g.getContext('2d');const W=g.width,H=g.height;const d=c.getImageData(0,0,W,H).data;const out=[];const step=Math.round(W/30);
      for(let y=0;y<H;y+=step){let s=-1;for(let x=0;x<W;x++){const a=d[(y*W+x)*4+3]>40;if(a&&s<0)s=x;if((!a||x==W-1)&&s>=0){out.push([s/W,x/W,y/H]);s=-1}}}return out}""")
    box = await pg.locator("#draw").bounding_box()
    for x0,x1,y in segs:
        await pg.mouse.move(box["x"]+x0*box["width"], box["y"]+y*box["height"]); await pg.mouse.down()
        await pg.mouse.move(box["x"]+x1*box["width"], box["y"]+y*box["height"], steps=3); await pg.mouse.up()
    await pg.click("#check")
async def solve_memory(pg):
    # ننتظر انتهاء "احفظ الأماكن" ثم نطابق الأزواج (رقم الزوج مخفي في data-p)
    try:
        await pg.wait_for_function("()=>!document.querySelector('#mtitle') || document.querySelector('#mtitle').textContent.startsWith('اقلب')", timeout=15000)
    except Exception:
        pass
    pairs = await pg.evaluate("()=>{const m={};document.querySelectorAll('.mcard:not(.done)').forEach((c,i)=>{(m[c.dataset.p]=m[c.dataset.p]||[]).push(+c.dataset.i)});return Object.values(m)}")
    for a, b in [p for p in pairs if len(p) == 2]:
        await pg.click(f".mcard[data-i='{a}']"); await pg.wait_for_timeout(30)
        await pg.click(f".mcard[data-i='{b}']"); await pg.wait_for_timeout(700)
async def solve_clicks(pg, sel, done_cls):
    for _ in range(4):
        n = await pg.locator(sel).count()
        progressed = False
        for i in range(n):
            el = pg.locator(sel).nth(i)
            if done_cls in (await el.get_attribute("class") or "") or await el.is_disabled(): continue
            before = await pg.locator(f"{sel}.{done_cls}").count()
            await el.click(); await pg.wait_for_timeout(40)
            if await pg.locator(f"{sel}.{done_cls}").count() > before: progressed = True
        if not progressed: break
async def play_until_result(pg, shot=None, maxr=20):
    for r in range(maxr):
        await pg.wait_for_timeout(150)
        if await pg.locator(".result").count(): return True
        pass
        if await pg.locator("#play").count(): await pg.click("#play"); continue
        if await pg.locator(".learn-card").count():
            await pg.click("#skip"); continue
        if await pg.locator(".book").count(): await pg.locator(".book").first.click(); continue
        if await pg.locator(".theme").count(): await pg.locator(".theme").nth(r % 11).click(); continue
        if await pg.locator("#quiz").count(): await pg.locator(".vcard").first.click(); await pg.click("#quiz"); continue
        if await pg.locator(".story-page").count():
            await pg.click("#next"); await pg.wait_for_timeout(100); continue
        if await pg.locator(".key").count(): await solve_keyboard(pg)
        elif await pg.locator(".hword").count(): await solve_clicks(pg, ".hword", "got")
        elif await pg.locator(".oitem").count(): await solve_clicks(pg, ".oitem", "placed")
        elif await pg.locator(".mcard").count(): await solve_memory(pg)
        elif await pg.locator(".tile").count(): await solve_build(pg)
        elif await pg.locator("#guide").count(): await solve_trace2(pg)
        elif await pg.locator(".choice").count(): await solve_choice(pg)
        await pg.wait_for_timeout(1500)
    return await pg.locator(".result").count() > 0
# ---------------- حلول الكتابة ولوحة المفاتيح ----------------
async def draw_segs(pg, segs):
    box = await pg.locator("#draw").bounding_box()
    for x0,x1,y in segs:
        # من اليمين إلى اليسار كما يكتب الطفل بالعربية
        await pg.mouse.move(box["x"]+x1*box["width"], box["y"]+y*box["height"]); await pg.mouse.down()
        await pg.mouse.move(box["x"]+x0*box["width"], box["y"]+y*box["height"], steps=3); await pg.mouse.up()
async def solve_trace2(pg):
    # ننتظر انتهاء عرض طريقة الكتابة إن وُجد
    await pg.wait_for_timeout(250 + (3200 if await pg.locator("#demo").count() else 0))
    segs = await pg.evaluate(SCAN)
    if not segs:   # free writing: make a wrong attempt so the correct shape is shown, then copy it
        await draw_segs(pg, [[0.1,0.2,0.1]]); await pg.click("#check"); await pg.wait_for_timeout(300)
        segs = await pg.evaluate(SCAN)
        await pg.wait_for_timeout(500)
    await draw_segs(pg, segs); await pg.click("#check")
async def solve_keyboard(pg):
    for attempt in range(3):
        log = await pg.evaluate("()=>window.__speech")
        word = [e['text'] for e in log if e['ev']=='start'][-1]
        word = word.replace("أحسنت! ","").strip()
        for ch in word:
            k = pg.locator(f".key[data-k='{ch}']")
            if await k.count(): await k.first.click(); await pg.wait_for_timeout(30)
        await pg.wait_for_timeout(1200)
        if await pg.locator(".slot.good").count() == await pg.locator(".kb-slots .slot").count(): return
        await pg.click("#say"); await pg.wait_for_timeout(300)



# ---------------- حلول الألعاب ----------------
AR = "٠١٢٣٤٥٦٧٨٩"
def parse_num(s):
    """رقم مكتوب بالأرقام العربية الهندية أو اللاتينية"""
    return int("".join(str(AR.index(ch)) if ch in AR else ch for ch in s if ch in AR or ch.isdigit()))
async def maps(pg):
    return await pg.evaluate("""async()=>{const d=await import('./js/data.js');const e2w={};for(const w of d.ALL_WORDS)e2w[w.emoji]=w.w;for(const [l,ws] of Object.entries(d.LETTER_WORDS))for(const w of ws)e2w[w.emoji]=w.w;
      const e2c={};for(const c of d.CATEGORIES)for(const i of c.items)e2c[i]=c.id;return {e2w,e2c}}""")
async def bubbles(pg, M):
    await pg.evaluate("""(e2w)=>{const t=document.querySelector('.atask .big-l').textContent.trim();
      for(const b of document.querySelectorAll('.bubble:not(.pop)')){const w=e2w[b.textContent.trim()]||'';const r=b.getBoundingClientRect();
        if(w[0]===t && r.top>0 && r.bottom<innerHeight) b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));}}""", M['e2w'])
async def mole(pg, M):
    t = (await pg.locator(".atask .big-l").inner_text()).strip()
    for h in await pg.locator(".hole.up:not(.bonk)").all():
        try:
            if (await h.locator(".mletter").inner_text()).strip()==t: await h.locator(".mole").click(timeout=300)
        except Exception: pass
async def train(pg, M):
    for t in await pg.locator(".wtile:not(.used)").all():
        try: await t.click(timeout=300); await pg.wait_for_timeout(120)
        except Exception: pass
async def maze(pg, M):
    if not await pg.locator(".car").count() or "🏎" in (await pg.locator(".car").inner_text()): return
    segs = await pg.evaluate("""()=>{const c=document.querySelectorAll('.maze-wrap canvas')[0];const x=c.getContext('2d');const W=c.width,H=c.height;const d=x.getImageData(0,0,W,H).data;const out=[];const st=Math.max(2,Math.round(W/40));
      for(let y=0;y<H;y+=st){let s=-1;for(let i=W-1;i>=0;i--){const a=d[(y*W+i)*4+3]>40;if(a&&s<0)s=i;if((!a||i===0)&&s>=0){out.push([s/W,i/W,y/H]);s=-1}}}return out}""")
    box = await pg.locator(".maze-wrap canvas").nth(1).bounding_box()
    car = await pg.locator(".car").bounding_box()
    # first: start at car and drive onto the road nearby
    await pg.mouse.move(car["x"]+car["width"]/2, car["y"]+car["height"]/2); await pg.mouse.down(); await pg.mouse.up()
    first = True
    for x0,x1,y in segs:
        if not await pg.locator(".maze-wrap").count(): return
        if first:
            cx, cy = car["x"]+car["width"]/2, car["y"]+car["height"]/2
            await pg.mouse.move(cx, cy); await pg.mouse.down()
            await pg.mouse.move(box["x"]+x0*box["width"], box["y"]+y*box["height"], steps=6)
            first = False
        else:
            await pg.mouse.move(box["x"]+x0*box["width"], box["y"]+y*box["height"]); await pg.mouse.down()
        await pg.mouse.move(box["x"]+x1*box["width"], box["y"]+y*box["height"], steps=8); await pg.mouse.up()
        if "🏎" in (await pg.locator(".car").inner_text()): return
async def race(pg, M):
    e = (await pg.locator(".atask .big-pic").inner_text()).strip(); w = M['e2w'].get(e)
    for c in await pg.locator(".rcar:not(.zoom)").all():
        try:
            if (await c.locator(".rword").inner_text()).strip()==w: await c.click(timeout=300, force=True)
        except Exception: pass
async def baskets(pg, M):
    it = pg.locator(".fitem:not(.in)")
    if not await it.count(): return
    e = (await it.first.inner_text()).strip(); cat = M['e2c'].get(e)
    try:
        await it.first.click(timeout=500, force=True); await pg.locator(f".basket[data-cat='{cat}']").click(timeout=500)
    except Exception: pass
async def shop(pg, M):
    if not await pg.locator(".paybtn").count() or not await pg.locator(".paybtn").is_visible(): return
    tag = (await pg.locator(".tag").inner_text()).split()[0]
    price = parse_num(tag)
    coins = [5,2,1] if await pg.locator(".wallet .c5").count() else [1]
    left = price
    for c in coins:
        while left >= c: await pg.locator(f".wallet .c{c}").click(); left -= c; await pg.wait_for_timeout(40)
    await pg.locator(".paybtn").click()
SOLVERS = {"gBubbles":bubbles,"gMole":mole,"gTrain":train,"gMaze":maze,"gRace":race,"gBaskets":baskets,"gShop":shop}

