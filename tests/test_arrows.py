"""لعبة فكّ المتاهة: كل لوحة قابلة للحل وصحيحة البناء (300 مستوى + التحدّي اليومي)، ثابتة لكل رقم مستوى،
ثم لعب حقيقي باللمس: الدرس الأول، سهم محجوب يرتدّ ويخسر قلباً، إخراج كل الأسهم، شاشة الفوز وفتح المستوى التالي،
الخسارة عند نفاد القلوب، التلميح، التقريب على اللوحات الكبيرة، الإعدادات، وعدم وجود تمرير جانبي."""
import asyncio, sys
from helpers import async_playwright, start_server, PORT, APP

BASE = f"http://127.0.0.1:{PORT}/arrows/?test"

ENGINE = """async () => {
  const G = await import('./js/gen.js');
  const problems = [];
  const check = (spec, L) => {
    const seen = new Set();
    for (const a of L.arrows) {
      if (!a.cells.length) problems.push('empty arrow');
      a.cells.forEach(([x, y], i) => {
        const k = y * L.w + x;
        if (x < 0 || y < 0 || x >= L.w || y >= L.h || !L.mask[k]) problems.push(`cell outside board ${spec.n}`);
        if (seen.has(k)) problems.push(`overlap ${spec.n}`); seen.add(k);
        if (i) { const [px, py] = a.cells[i - 1]; if (Math.abs(px - x) + Math.abs(py - y) !== 1) problems.push(`broken arrow ${spec.n}`); }
      });
      if (a.cells.length > 1) { const [px, py] = a.cells.at(-2), [hx, hy] = a.cells.at(-1), [dx, dy] = G.DIRS[a.dir]; if (hx - px !== dx || hy - py !== dy) problems.push(`head not along body ${spec.n}`); }
    }
    const s = G.solve(L);
    if (!s.solvable) problems.push(`unsolvable ${spec.n || spec.daily}`);
    if (G.freeArrows(G.makeBoard(L)).length === L.arrows.length && L.arrows.length > 6) problems.push(`trivial (all free) ${spec.n}`);
    return s;
  };
  let fillSum = 0;
  for (let n = 1; n <= 300; n++) { const sp = G.levelSpec(n), L = G.generate(sp); check(sp, L); fillSum += L.fill; if (L.arrows.length < 4) problems.push('too few arrows ' + n); }
  if (fillSum / 300 < 0.85) problems.push('boards too empty: ' + (fillSum / 300).toFixed(2));
  for (const d of ['2026-10-27', '2026-12-31', '2027-02-28']) check(G.dailySpec(d), G.generate(G.dailySpec(d)));
  // المسارات الأصعب: قابلة للحل، وأصعب فعلاً (سلسلة اعتماد أعمق من العادي)
  const depth = { normal: 0, hard: 0, expert: 0 };
  for (const d of ['normal', 'hard', 'expert']) for (let n = 1; n <= 40; n++) {
    const sp = G.levelSpec(n, d), L = G.generate(sp), r = check(sp, L);
    depth[d] += r.depth || 0;
  }
  if (!(depth.hard > depth.normal * 1.2 && depth.expert >= depth.hard)) problems.push('difficulty not increasing: ' + JSON.stringify(depth));
  if (G.generate(G.levelSpec(7, 'hard')).arrows.length === G.generate(G.levelSpec(7, 'normal')).arrows.length && JSON.stringify(G.generate(G.levelSpec(7, 'hard')).arrows) === JSON.stringify(G.generate(G.levelSpec(7, 'normal')).arrows)) problems.push('hard track same as normal');
  if (JSON.stringify(G.generate(G.levelSpec(42)).arrows) !== JSON.stringify(G.generate(G.levelSpec(42)).arrows)) problems.push('level not deterministic');
  return [...new Set(problems)].slice(0, 12);
}"""

async def play(b, w, h, errs):
    pg = await b.new_page(viewport={"width": w, "height": h}, has_touch=True)
    tag = f"{w}x{h}"
    pg.on("pageerror", lambda e: errs.append(f"{tag}: {e}"))
    out = []
    ev = pg.evaluate
    async def check(label):
        o = await ev("()=>document.documentElement.scrollWidth - document.documentElement.clientWidth")
        if o > 1: out.append(f"{tag} {label}: scrolls sideways {o}px")
    async def tap(i):
        p = await ev("(id)=>__mz.pos(id)", i)
        if await ev(f"()=>__mz.hitAt({p['x']},{p['y']})") != i: out.append(f"{tag}: hit test missed arrow {i}")
        await pg.mouse.click(p["x"], p["y"])
    await pg.goto(BASE); await ev("()=>localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(500)
    await check("home")
    if not await pg.locator("#demo").count(): out.append(f"{tag}: home demo board missing")
    await pg.click("#play"); await pg.wait_for_timeout(400); await check("level 1")
    if await pg.locator("#coach:not([hidden])").count() != 1: out.append(f"{tag}: tutorial coach not shown")
    # سهم محجوب: يرتدّ ويخسر قلباً ولا يخرج
    blocked = await ev("()=>__mz.blocked()")
    if not blocked: out.append(f"{tag}: level 1 has no blocked arrow")
    else:
        n0 = await ev("()=>__mz.G.E.board.alive.size")
        await tap(blocked[0]); await pg.wait_for_timeout(150)
        if await ev("()=>__mz.G.hearts") != 2: out.append(f"{tag}: blocked tap did not cost a heart")
        if await ev("()=>__mz.G.E.board.alive.size") != n0: out.append(f"{tag}: blocked arrow left the board")
        if await pg.locator("#hearts i.lost").count() != 1: out.append(f"{tag}: heart not shown as lost")
    # إخراج كل الأسهم الحرة حتى الفوز
    for _ in range(60):
        f = await ev("()=>__mz.free()")
        if not f: break
        await tap(f[0]); await pg.wait_for_timeout(60)
    try:
        await pg.wait_for_selector(".sheet.win", timeout=6000)
    except Exception:
        out.append(f"{tag}: win screen not shown (left {await ev('()=>__mz.G && __mz.G.E.board.alive.size')})")
    else:
        await check("win")
        if await ev("()=>__mz.P.level") != 2: out.append(f"{tag}: next level not unlocked")
        if await ev("()=>__mz.P.stars[1]") != 2: out.append(f"{tag}: wrong stars for one mistake")
        if await ev("()=>__mz.P.tut") != 2: out.append(f"{tag}: tutorial not completed")
        await pg.click("#next"); await pg.wait_for_timeout(400)
        if await ev("()=>__mz.G.spec.n") != 2: out.append(f"{tag}: next button did not open level 2")
    # الخسارة: ثلاثة اصطدامات
    await ev("()=>__mz.startLevel(9)"); await pg.wait_for_timeout(300)
    for _ in range(3):
        bl = await ev("()=>__mz.blocked()")
        if bl: await tap(bl[0]); await pg.wait_for_timeout(380)
    try:
        await pg.wait_for_selector(".sheet.lose", timeout=3000)
        await check("lose"); await pg.click("#cont"); await pg.wait_for_timeout(200)
        if await ev("()=>__mz.G.hearts") != 1 or await ev("()=>__mz.G.over"): out.append(f"{tag}: continue with hint failed")
    except Exception: out.append(f"{tag}: lose screen not shown")
    # التلميح يضيء سهماً حراً وينقص العدد
    h0 = await ev("()=>__mz.P.hints")
    await pg.click("#hint"); await pg.wait_for_timeout(150)
    hid = await ev("()=>__mz.G.E.hint && __mz.G.E.hint.id")
    if hid is None or hid not in await ev("()=>__mz.free()"): out.append(f"{tag}: hint did not point to a free arrow")
    if await ev("()=>__mz.P.hints") != h0 - 1: out.append(f"{tag}: hint count not reduced")
    # لوحة كبيرة: التقريب بالعجلة والسحب ثم الملاءمة
    await ev("()=>__mz.startLevel(80)"); await pg.wait_for_timeout(400); await check("big board")
    s0 = await ev("()=>__mz.G.E.view.s")
    box = await pg.locator("#cv").bounding_box()
    await pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    for _ in range(4): await pg.mouse.wheel(0, -200); await pg.wait_for_timeout(40)
    if await ev("()=>__mz.G.E.view.s") <= s0 * 1.3: out.append(f"{tag}: zoom did not work")
    v0 = await ev("()=>__mz.G.E.view.ox + __mz.G.E.view.oy")
    await pg.mouse.down(); await pg.mouse.move(box["x"] + box["width"] / 2 + 80, box["y"] + box["height"] / 2 + 80, steps=6); await pg.mouse.up()
    if abs(await ev("()=>__mz.G.E.view.ox + __mz.G.E.view.oy") - v0) < 30: out.append(f"{tag}: pan did not work")
    if await ev("()=>__mz.G.E.board.alive.size") != await ev("()=>__mz.G.total"): out.append(f"{tag}: a drag removed an arrow")
    await pg.click("#fitb"); await pg.wait_for_timeout(100)
    if abs(await ev("()=>__mz.G.E.view.s") - s0) > 0.5: out.append(f"{tag}: fit button did not reset zoom")
    # مسار الخبير: قلبان، وتقدّم مستقل
    await ev("()=>__mz.home()"); await pg.wait_for_timeout(200)
    await pg.click(".diffs [data-d='expert']"); await pg.wait_for_timeout(200); await check("home expert")
    await pg.click("#play"); await pg.wait_for_timeout(500)
    if await ev("()=>__mz.G.spec.diff") != "expert" or await pg.locator("#hearts i").count() != 2: out.append(f"{tag}: expert track not applied")
    if await ev("()=>__mz.P.level") != 1: out.append(f"{tag}: expert progress not separate")
    for _ in range(80):
        f = await ev("()=>__mz.free()")
        if not f: break
        await ev("(id)=>__mz.G.E.tap(id)", f[0])
    await pg.wait_for_timeout(1500)
    if await ev("()=>__mz.P.tracks.expert.level") != 2 or await ev("()=>__mz.P.tracks.normal.level") != 2: out.append(f"{tag}: expert win did not advance its own track")
    await pg.click("#menu"); await pg.wait_for_timeout(200)
    await pg.click(".diffs [data-d='normal']"); await pg.wait_for_timeout(200)
    # حجم الأسهم: الصغير يصغّر الخلايا في اللوحات الصغيرة
    await ev("()=>__mz.startLevel(1)"); await pg.wait_for_timeout(300)
    s_m = await ev("()=>__mz.G.E.view.s")
    await ev("()=>{__mz.P.settings.size='s'; __mz.G.E.fit()}")
    s_s = await ev("()=>__mz.G.E.view.s")
    if not s_s < s_m: out.append(f"{tag}: arrow size setting has no effect ({s_m} -> {s_s})")
    await ev("()=>{__mz.P.settings.size='m'}")
    # التحدّي اليومي، المستويات، الإعدادات
    await ev("()=>__mz.startDaily()"); await pg.wait_for_timeout(300); await check("daily")
    await ev("()=>__mz.levels()"); await pg.wait_for_timeout(200); await check("levels")
    if await pg.locator(".lv:not(.locked)").count() != 2: out.append(f"{tag}: wrong unlocked level count")
    await pg.click("#back"); await pg.wait_for_timeout(200)
    await pg.click("#settings"); await pg.wait_for_timeout(150); await check("settings")
    await pg.click("#s_size [data-z='l']"); await pg.wait_for_timeout(100)
    if await ev("()=>__mz.P.settings.size") != "l": out.append(f"{tag}: size setting not saved")
    await pg.click(".themes [data-t='night']"); await pg.wait_for_timeout(100)
    if await ev("()=>document.documentElement.dataset.ui") != "dark": out.append(f"{tag}: theme did not apply")
    await pg.click("#ok")
    await pg.click("#help"); await pg.wait_for_timeout(150); await check("help"); await pg.click("#ok")
    await pg.close()
    return out

async def main():
    if APP != "kids":
        print("skipped (game is not part of this app)"); return
    start_server()
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        pg = await b.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.wait_for_timeout(300)
        eng = await pg.evaluate(ENGINE)
        await pg.close()
        print(f"engine problems: {eng or 'none'}")
        ui = []
        for w, h in ((320, 640), (390, 844), (844, 390)): ui += await play(b, w, h, errs)
        await b.close()
    print(f"ui problems: {ui or 'none'}")
    if errs: print("page errors:", errs[:5])
    sys.exit(0 if not eng and not ui and not errs else 1)

asyncio.run(main())
