"""لعبة سيطرة: مدن متناظرة سليمة بأراضي البناء والمستودعات، معارك آلية كاملة بالجيشين،
واللعب الفعلي في المتصفح (بناء، شاحنات، إنتاج، احتلال، صلاحيات الجنرال، كاميرا، إيقاف، نتيجة)."""
import asyncio, sys
from helpers import async_playwright, start_server, PORT, APP

BASE = f"http://127.0.0.1:{PORT}/saytara/?test"

ENGINE = """async () => {
  const { generateCity, findPath, W, H } = await import('./js/city.js');
  const Wd = await import('./js/world.js');
  const A = await import('./js/ai.js');
  const { LEVELS } = await import('./js/levels.js');
  const problems = [];
  for (let s = 1; s <= 50; s++) {
    const c = generateCity(s * 7919);
    const seen = new Set([0]), q = [0];
    while (q.length) { const u = q.shift(); for (const { to } of c.adj[u]) if (!seen.has(to)) { seen.add(to); q.push(to); } }
    if (seen.size !== c.nodes.length) problems.push('disconnected city ' + s);
    const key = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;
    const set = new Set(c.edges.map((e) => [key(c.nodes[e.a]), key(c.nodes[e.b])].sort().join('|')));
    if (c.edges.some((e) => !set.has([key({ x: W - c.nodes[e.a].x, y: H - c.nodes[e.a].y }), key({ x: W - c.nodes[e.b].x, y: H - c.nodes[e.b].y })].sort().join('|')))) problems.push('asymmetric city ' + s);
    if (c.bridges.length !== 3) problems.push('bridges ' + s);
    if (!c.hqLots[0] || !c.hqLots[1]) problems.push('hq lots ' + s);
    for (const h of [0, 1]) {
      if (c.lots.filter((l) => l.half === h && l.base).length < 8) problems.push('few base lots ' + s);
      if (c.depots.filter((d) => d.half === h).length < 2) problems.push('few depots ' + s);
    }
    if (c.points.length < 4) problems.push('points ' + s);
    if (c.pads.length < c.lots.length * 4) problems.push('pads ' + s);
    if (findPath(c, c.hq[0], c.hq[1]).length < 4) problems.push('path ' + s);
  }
  if (JSON.stringify(generateCity(99)) !== JSON.stringify(generateCity(99))) problems.push('city not deterministic');
  // معارك آلية بالجيشين: كل معركة تنتهي، الأقوى يفوز غالباً، ولا قيم غير صالحة
  const wins = { hard: 0, normal: 0 }, n = { hard: 0, normal: 0 };
  const runs = [['hard', 'shield', 'falcon', 0], ['hard', 'falcon', 'shield', 1], ['hard', 'shield', 'shield', 0], ['hard', 'falcon', 'falcon', 1], ['normal', 'shield', 'falcon', 1], ['normal', 'falcon', 'shield', 0]];
  let k = 0;
  for (const [lvl, fa, fb, side] of runs) {
    const facs = side ? [fb, fa] : [fa, fb];
    const w = Wd.createWorld(700 + k++, facs);
    const ais = side ? [A.createAI(w, 0, 'easy'), A.createAI(w, 1, lvl)] : [A.createAI(w, 0, lvl), A.createAI(w, 1, 'easy')];
    const used = new Set();
    while (!w.over && w.tick < 20000) {
      ais.forEach((x) => A.think(w, x)); Wd.step(w);
      for (const e of w.events) used.add(e.type);
      w.events.length = 0;
      if (w.tick % 500 === 0) {
        if (w.units.some((u) => !Number.isFinite(u.x) || !Number.isFinite(u.hp))) problems.push('bad unit state');
        if (w.players.some((p) => !Number.isFinite(p.money) || p.money < -1)) problems.push('bad money');
      }
    }
    if (!w.over) problems.push(`${lvl} ${fa} vs easy ${fb} did not end`);
    n[lvl]++; if (w.winner === side) wins[lvl]++;
    for (const t of ['built', 'spawn', 'delivered', 'captured', 'rankUp', 'razed']) if (!used.has(t)) problems.push(`battle ${k}: no ${t} event`);
  }
  if (wins.hard < 3) problems.push(`hard beat easy only ${wins.hard}/${n.hard}`);
  if (wins.normal < 1) problems.push(`normal beat easy ${wins.normal}/${n.normal}`);
  for (const L of LEVELS) generateCity(L.seed);
  return [...new Set(problems)];
}"""

# يوجّه الكاميرا إلى نقطة في العالم ويعيد مكانها على الشاشة
AT = """([x, y]) => { const v = __sy.S.view; v.cam.x = x; v.cam.y = y; v.cam.z = Math.max(v.cam.z, 0.8);
  const c = v.canvas.getBoundingClientRect();
  const sx = (x - v.cam.x) * v.cam.z + v.cw / 2, sy = (y - v.cam.y) * v.cam.z + v.ch / 2;
  return { x: c.left + sx, y: c.top + sy }; }"""

async def play(b, width, errs):
    pg = await b.new_page(viewport={"width": width, "height": 720})
    pg.on("pageerror", lambda e: errs.append(f"{width}: {e}"))
    out = []
    ev = pg.evaluate
    async def check(label):
        w = await ev("()=>document.documentElement.scrollWidth - document.documentElement.clientWidth")
        if w > 1: out.append(f"{width}px {label}: scrolls sideways {w}px")
    async def tap_world(x, y):
        p = await ev(AT, [x, y]); await pg.wait_for_timeout(80)
        p = await ev(AT, [x, y])
        await pg.mouse.click(p["x"], p["y"]); await pg.wait_for_timeout(120)
    async def run_until(cond, tries=60, speed=8):
        await ev(f"()=>{{__sy.S.speed={speed}}}")
        for _ in range(tries):
            await pg.wait_for_timeout(300)
            if await ev(cond): break
        else:
            await ev("()=>{__sy.S.speed=1}"); return False
        await ev("()=>{__sy.S.speed=1}"); return True
    async def build(kind, near=None):
        await pg.click(".tabs [data-t='build']"); await pg.wait_for_timeout(100)
        await pg.click(f"#panel [data-b='{kind}']"); await pg.wait_for_timeout(150)
        spot = await ev("""(near) => { const S = __sy.S, w = S.w; if (!S.ui.place) return null;
          const ref = near || w.city.hqLots[0];
          const pos = (s) => s.lot != null ? w.city.lots[s.lot] : w.city.pads[s.pad];
          const s = S.ui.place.spots.slice().sort((a, b) => Math.hypot(pos(a).x - ref.x, pos(a).y - ref.y) - Math.hypot(pos(b).x - ref.x, pos(b).y - ref.y))[0];
          return s ? [pos(s).x, pos(s).y] : null; }""", near)
        if not spot: out.append(f"{width}px: no place to build {kind}"); return
        await tap_world(*spot)
        if not await ev(f"()=>__sy.S.w.buildings.some(b=>b.p===0&&b.type==='{kind}')"): out.append(f"{width}px: {kind} not placed")

    await pg.goto(BASE); await ev("()=>localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(400)
    await check("home")
    await pg.click("#campaign"); await pg.wait_for_timeout(200); await check("campaign")
    await pg.click(".lvl[data-i='0']"); await pg.wait_for_timeout(800); await check("game")
    if not await pg.locator("#tip:not([hidden])").count(): out.append(f"{width}px: tutorial tip missing")
    # البناء: محطة طاقة ثم ثكنة ثم مركز إمداد قرب مستودع
    await build("power")
    await build("barracks")
    if not await run_until("()=>__sy.S.w.buildings.filter(b=>b.p===0&&b.done).length>=3", 80):
        out.append(f"{width}px: dozer did not finish power+barracks")
    depot = await ev("()=>{const w=__sy.S.w;const d=w.depots.filter(d=>d.half===w.city.hqLots[0].half).sort((a,b)=>Math.hypot(a.x-w.city.hqLots[0].x,a.y-w.city.hqLots[0].y)-Math.hypot(b.x-w.city.hqLots[0].x,b.y-w.city.hqLots[0].y))[0];return {x:d.x,y:d.y}}")
    await build("supply", depot)
    if not await run_until("()=>__sy.S.w.players[0].earned>0", 120):
        out.append(f"{width}px: supply trucks never delivered")
    tip = await ev("()=>__sy.S.tip")
    if tip < 3: out.append(f"{width}px: tutorial did not advance ({tip})")
    # الإنتاج: جنود من الثكنة
    await pg.click(".tabs [data-t='make']"); await pg.wait_for_timeout(150)
    rifle = await ev("()=>__sy.S.w.players[0].faction==='shield'?'s_rifle':'f_rifle'")
    await ev("()=>{__sy.S.w.players[0].money+=2000}")
    for _ in range(4): await pg.click(f"#panel [data-u='{rifle}']")
    if not await run_until(f"()=>__sy.S.w.units.filter(u=>u.p===0&&u.type==='{rifle}').length>=4", 60):
        out.append(f"{width}px: infantry never trained")
    # الجيش: اختيار المقاتلين ثم النقر على مصفاة
    await pg.click(".tabs [data-t='army']"); await pg.wait_for_timeout(150)
    await pg.click("#panel [data-s='all']"); await pg.wait_for_timeout(150)
    if await ev("()=>__sy.S.ui.selected.length") < 4: out.append(f"{width}px: group selection failed")
    tgt = await ev("()=>{const w=__sy.S.w,h=w.city.hqLots[0];const t=w.points.filter(p=>p.owner<0).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0];return [t.x,t.y,t.id]}")
    await tap_world(tgt[0], tgt[1])
    if await ev("()=>__sy.S.w.units.filter(u=>u.p===0&&u.path.length).length") < 4: out.append(f"{width}px: move order not given")
    if not await run_until(f"()=>__sy.S.w.points[{tgt[2]}].owner===0", 100):
        out.append(f"{width}px: infantry did not capture the refinery")
    await ev("()=>{__sy.S.ui.selected=[]}")
    # الجنرال: افتح الغارة الجوية واستخدمها
    await pg.click(".tabs [data-t='gen']"); await pg.wait_for_timeout(150)
    await pg.click("#panel [data-p='airstrike']"); await pg.wait_for_timeout(250)
    if not await ev("()=>__sy.S.w.players[0].powers.airstrike.unlocked"): out.append(f"{width}px: power not unlocked")
    await pg.click("#panel [data-p='airstrike']"); await pg.wait_for_timeout(150)
    if not await ev("()=>!!__sy.S.ui.aim"): out.append(f"{width}px: aim mode not entered")
    await tap_world(tgt[0], tgt[1] - 300)
    await pg.wait_for_timeout(200)
    if not await ev("()=>__sy.S.w.players[0].powers.airstrike.ready>__sy.S.w.tick"): out.append(f"{width}px: airstrike not used")
    # معلومات مبنى عند النقر عليه
    hq = await ev("()=>[__sy.S.w.city.hqLots[0].x,__sy.S.w.city.hqLots[0].y]")
    await tap_world(*hq)
    if not await pg.locator(".binfo").count(): out.append(f"{width}px: building info not shown")
    await check("building info")
    # الكاميرا: سحب يحرّكها
    cam0 = await ev("()=>__sy.S.view.cam.y")
    box = await pg.locator("#cv").bounding_box()
    await pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + 200); await pg.mouse.down()
    await pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + 330, steps=6); await pg.mouse.up()
    if abs(await ev("()=>__sy.S.view.cam.y") - cam0) < 20: out.append(f"{width}px: camera did not pan")
    # الإيقاف المؤقت
    await pg.click("#pause"); await pg.wait_for_timeout(150); await check("pause")
    t1 = await ev("()=>__sy.S.w.tick"); await pg.wait_for_timeout(400)
    if await ev("()=>__sy.S.w.tick") != t1: out.append("game kept running while paused")
    await pg.click("#resume")
    # جيشك يكمل آلياً حتى النهاية
    await ev("()=>{__sy.autoplay('hard'); __sy.S.speed=16}")
    for _ in range(240):
        await pg.wait_for_timeout(500)
        if await pg.locator(".sheet.result").count(): break
    else: out.append(f"{width}px: battle never ended (tick {await ev('()=>__sy.S.w.tick')})")
    await check("result")
    await pg.click("#menu"); await pg.wait_for_timeout(200)
    await pg.click("#back"); await pg.click("#quick"); await pg.wait_for_timeout(200); await check("quick")
    await pg.click("[data-name='me'] [data-v='falcon']")
    await pg.fill("#code", "bad"); await pg.click("#go"); await pg.wait_for_timeout(200)
    if await pg.locator(".game").count(): out.append("invalid map code accepted")
    await pg.click("#dice"); await pg.click("#go"); await pg.wait_for_timeout(800); await check("quick game")
    if await ev("()=>__sy.S.w.players[0].faction") != "falcon": out.append("faction choice ignored")
    await pg.click(".tabs [data-t='make']"); await pg.wait_for_timeout(150)
    if not await pg.locator("#panel [data-u='f_drone']").count(): out.append("falcon units missing")
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
        for w in (320, 390): ui += await play(b, w, errs)
        await b.close()
    print(f"ui problems: {ui or 'none'}")
    if errs: print("page errors:", errs[:5])
    sys.exit(0 if not eng and not ui and not errs else 1)

asyncio.run(main())
