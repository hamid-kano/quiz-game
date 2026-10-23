"""لعبة سيطرة: مدن متناظرة سليمة، معارك آلية كاملة بالمستويات الثلاثة، واللعب الفعلي في المتصفح (شراء، اختيار، أوامر، كاميرا)."""
import asyncio, sys
from helpers import async_playwright, start_server, PORT, APP

BASE = f"http://127.0.0.1:{PORT}/saytara/?test"

ENGINE = """async () => {
  const { generateCity, findPath, W, H } = await import('./js/city.js');
  const Wd = await import('./js/world.js');
  const A = await import('./js/ai.js');
  const { LEVELS } = await import('./js/levels.js');
  const problems = [];
  for (let s = 1; s <= 60; s++) {
    const c = generateCity(s * 7919);
    const seen = new Set([0]), q = [0];
    while (q.length) { const u = q.shift(); for (const { to } of c.adj[u]) if (!seen.has(to)) { seen.add(to); q.push(to); } }
    if (seen.size !== c.nodes.length) problems.push('disconnected city ' + s);
    const key = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;
    const set = new Set(c.edges.map((e) => [key(c.nodes[e.a]), key(c.nodes[e.b])].sort().join('|')));
    if (c.edges.some((e) => !set.has([key({ x: W - c.nodes[e.a].x, y: H - c.nodes[e.a].y }), key({ x: W - c.nodes[e.b].x, y: H - c.nodes[e.b].y })].sort().join('|')))) problems.push('asymmetric city ' + s);
    if (c.points.filter((p) => p.type === 'hq').length !== 2 || c.points.length < 10) problems.push('points ' + s);
    if (c.bridges.length !== 3) problems.push('bridges ' + s);
    if (findPath(c, c.hq[0], c.hq[1]).length < 4) problems.push('path ' + s);
  }
  if (JSON.stringify(generateCity(99)) !== JSON.stringify(generateCity(99))) problems.push('city not deterministic');
  // معارك آلية: الأقوى يفوز في الغالب، وكل معركة تنتهي، ولا قيم غير صالحة
  const res = { hardVsEasy: 0, normalVsEasy: 0 };
  for (const [key, a, b] of [['hardVsEasy', 'hard', 'easy'], ['normalVsEasy', 'normal', 'easy']]) for (let k = 0; k < 4; k++) {
    const w = Wd.createWorld(500 + k);
    const flip = k % 2;
    const ais = flip ? [A.createAI(w, 0, b), A.createAI(w, 1, a)] : [A.createAI(w, 0, a), A.createAI(w, 1, b)];
    while (!w.over && w.tick < 12000) {
      ais.forEach((x) => A.think(w, x)); Wd.step(w); w.events.length = 0;
      if (w.tick % 500 === 0) for (const u of w.units) if (!Number.isFinite(u.x) || !Number.isFinite(u.hp)) { problems.push('bad unit state'); break; }
      if (w.players.some((p) => !Number.isFinite(p.money) || p.money < -1)) { problems.push('bad money'); break; }
    }
    if (!w.over) problems.push(`${key} battle ${k} did not end`);
    if (w.winner === (flip ? 1 : 0)) res[key]++;
  }
  if (res.hardVsEasy < 3) problems.push('hard did not beat easy: ' + res.hardVsEasy + '/4');
  if (res.normalVsEasy < 3) problems.push('normal did not beat easy: ' + res.normalVsEasy + '/4');
  for (const L of LEVELS) generateCity(L.seed);
  return [...new Set(problems)];
}"""

async def play(b, width, errs):
    pg = await b.new_page(viewport={"width": width, "height": 720})
    pg.on("pageerror", lambda e: errs.append(f"{width}: {e}"))
    out = []
    async def check(label):
        w = await pg.evaluate("()=>document.documentElement.scrollWidth - document.documentElement.clientWidth")
        if w > 1: out.append(f"{width}px {label}: scrolls sideways {w}px")
    await pg.goto(BASE); await pg.evaluate("()=>localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(400)
    await check("home")
    await pg.click("#campaign"); await pg.wait_for_timeout(200); await check("campaign")
    await pg.click(".lvl[data-i='0']"); await pg.wait_for_timeout(800); await check("game")
    # شراء
    for _ in range(3): await pg.click("#build [data-u='infantry']")
    q = await pg.evaluate("()=>__sy.S.w.cmds.length + __sy.S.w.players[0].queue.length")
    if q < 3: out.append(f"{width}px: buying did not queue units ({q})")
    await pg.evaluate("()=>{__sy.S.speed=6}")
    for _ in range(30):
        await pg.wait_for_timeout(300)
        if await pg.evaluate("()=>__sy.S.w.units.filter(u=>u.p===0).length") >= 3: break
    else: out.append(f"{width}px: units never spawned")
    # اختيار وأمر حركة بالنقر على ساحة
    await pg.click("#selbar [data-s='infantry']"); await pg.wait_for_timeout(150)
    if await pg.evaluate("()=>__sy.S.ui.selected.length") < 3: out.append(f"{width}px: group selection failed")
    pos = await pg.evaluate("""()=>{const S=__sy.S,w=S.w,v=S.view;const hq=w.players[0].hq;const t=w.points.filter(p=>p.owner<0).sort((a,b)=>Math.hypot(a.x-hq.x,a.y-hq.y)-Math.hypot(b.x-hq.x,b.y-hq.y))[0];
      v.cam.x=t.x;v.cam.y=t.y;const r=v.canvas.getBoundingClientRect();return {x:r.left+v.cw/2,y:r.top+v.ch/2,id:t.id}}""")
    await pg.mouse.click(pos["x"], pos["y"]); await pg.wait_for_timeout(200)
    moving = await pg.evaluate("()=>__sy.S.w.units.filter(u=>u.p===0&&u.path.length).length")
    if moving < 3: out.append(f"{width}px: move order not given ({moving})")
    for _ in range(60):
        await pg.wait_for_timeout(300)
        if await pg.evaluate(f"()=>__sy.S.w.points[{pos['id']}].owner") == 0: break
    else: out.append(f"{width}px: infantry did not capture the plaza")
    # الكاميرا: سحب يحرّكها
    cam0 = await pg.evaluate("()=>__sy.S.view.cam.y")
    box = await pg.locator("#cv").bounding_box()
    await pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + 200); await pg.mouse.down()
    await pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + 380, steps=6); await pg.mouse.up()
    if abs(await pg.evaluate("()=>__sy.S.view.cam.y") - cam0) < 20: out.append(f"{width}px: camera did not pan")
    # الإيقاف المؤقت
    await pg.click("#pause"); await pg.wait_for_timeout(150); await check("pause")
    t1 = await pg.evaluate("()=>__sy.S.w.tick"); await pg.wait_for_timeout(400)
    if await pg.evaluate("()=>__sy.S.w.tick") != t1: out.append("game kept running while paused")
    await pg.click("#resume")
    # جيشك يقاتل آلياً حتى النهاية
    await pg.evaluate("()=>{__sy.autoplay('hard'); __sy.S.speed=12}")
    for _ in range(150):
        await pg.wait_for_timeout(500)
        if await pg.locator(".sheet.result").count(): break
    else: out.append(f"{width}px: battle never ended")
    await check("result")
    await pg.click("#menu"); await pg.wait_for_timeout(200)
    await pg.click("#back"); await pg.click("#quick"); await pg.wait_for_timeout(200); await check("quick")
    await pg.fill("#code", "bad"); await pg.click("#go"); await pg.wait_for_timeout(200)
    if await pg.locator(".game").count(): out.append("invalid map code accepted")
    await pg.click("#dice"); await pg.click("#go"); await pg.wait_for_timeout(800); await check("quick game")
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
