"""لعبة سيطرة: صحة الخرائط، ومعارك آلية كاملة، واللعب الفعلي باللمس في المتصفح، والاتساع على الجوال."""
import asyncio, sys
from helpers import async_playwright, start_server, PORT, APP

BASE = f"http://127.0.0.1:{PORT}/saytara/?test"

ENGINE = """async () => {
  const { generateMap } = await import('./js/mapgen.js');
  const S = await import('./js/sim.js');
  const A = await import('./js/ai.js');
  const { LEVELS } = await import('./js/levels.js');
  const problems = [];
  for (const players of [2, 3, 4]) for (const size of ['small', 'medium', 'large']) for (let k = 1; k <= 25; k++) {
    const m = generateMap({ seed: k * 9173 + players, players, size });
    if (!m.connected) problems.push(`disconnected map ${players}/${size}/${k}`);
    if (m.districts.filter((d) => d.type === 'hq').length !== players) problems.push('hq count');
    if (m.bridges.length < 2) problems.push(`few bridges ${players}/${size}/${k}`);
    // الجيرة متناظرة
    for (const d of m.districts) for (const j of d.nb) if (!m.districts[j].nb.includes(d.id)) problems.push('asymmetric neighbours');
  }
  // نفس البذرة = نفس الخريطة
  if (JSON.stringify(generateMap({ seed: 5, players: 3, size: 'medium' })) !== JSON.stringify(generateMap({ seed: 5, players: 3, size: 'medium' }))) problems.push('map not deterministic');
  // معارك آلية: الصعب يهزم السهل، وكل معركة تنتهي
  const results = [];
  for (let k = 0; k < 6; k++) {
    const g = S.createGame(generateMap({ seed: 777 + k, players: 2, size: 'medium' }));
    const ais = [A.createAI(g, 0, 'hard', k), A.createAI(g, 1, 'easy', k)];
    while (!g.over && g.tick < 12000) {
      A.thinkAll(g, ais); S.step(g);
      for (const x of g.d) if (!(x.troops >= 0) || !Number.isFinite(x.troops)) { problems.push('bad troops'); break; }
    }
    if (!g.over) problems.push('battle did not end');
    results.push(g.winner);
  }
  if (results.filter((w) => w === 0).length < 5) problems.push('hard AI did not beat easy AI: ' + results);
  // كل مستويات الحملة تُولّد بلا مشكلة
  for (const L of LEVELS) { const m = generateMap({ seed: L.seed, players: L.ai.length + 1, size: L.size }); if (!m.connected) problems.push('level map ' + L.title); }
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
    await pg.click(".lvl[data-i='0']"); await pg.wait_for_timeout(600); await check("game")
    # سحب حقيقي من المقر إلى حي مجاور
    pos = await pg.evaluate("""()=>{const S=__sy.S,m=S.map,v=S.view;const hq=m.districts.findIndex(d=>d.owner===0);const n=m.districts[hq].nb[0];
      const r=v.canvas.getBoundingClientRect();const P=(d)=>({x:r.left+v.ox+d.x*v.scale,y:r.top+v.oy+d.y*v.scale});return {a:P(m.districts[hq]),b:P(m.districts[n]),n}}""")
    await pg.mouse.move(pos["a"]["x"], pos["a"]["y"]); await pg.mouse.down()
    await pg.mouse.move(pos["b"]["x"], pos["b"]["y"], steps=8); await pg.mouse.up()
    await pg.wait_for_timeout(300)
    sent = await pg.evaluate("()=>__sy.S.g.stats[0].sent")
    if sent < 1: out.append(f"{width}px: drag did not send troops")
    # الإيقاف المؤقت والمتابعة
    await pg.click("#pause"); await pg.wait_for_timeout(150); await check("pause")
    t1 = await pg.evaluate("()=>__sy.S.g.tick"); await pg.wait_for_timeout(500)
    if await pg.evaluate("()=>__sy.S.g.tick") != t1: out.append("game kept running while paused")
    await pg.click("#resume")
    # اللاعب الأزرق يلعب آلياً حتى النهاية
    await pg.evaluate("()=>{__sy.autoplay('hard'); __sy.S.speed=8}")
    for _ in range(90):
        await pg.wait_for_timeout(500)
        if await pg.locator(".sheet.result").count(): break
    else:
        out.append(f"{width}px: battle never ended")
    await check("result")
    if await pg.locator(".bigstars").count() == 0: out.append("no stars on campaign result")
    stars = await pg.evaluate("()=>JSON.parse(localStorage.getItem('saytara-progress')||'{}').stars||{}")
    if not stars.get("0"): out.append("campaign progress not saved")
    await pg.click("#menu"); await pg.wait_for_timeout(200)
    if not await pg.locator(".lvl[data-i='1']:not([disabled])").count(): out.append("level 2 not unlocked")
    # معركة سريعة بأربعة لاعبين
    await pg.click("#back"); await pg.click("#quick"); await pg.wait_for_timeout(200); await check("quick")
    await pg.fill("#code", "bad"); await pg.click("#go"); await pg.wait_for_timeout(200)
    if await pg.locator(".game").count(): out.append("invalid map code accepted")
    await pg.click("#dice"); await pg.click(".seg[data-name=foes] [data-v='3']"); await pg.click(".seg[data-name=size] [data-v='large']")
    await pg.click("#go"); await pg.wait_for_timeout(1500); await check("4 players")
    n = await pg.evaluate("()=>__sy.S.g.players.length")
    if n != 4: out.append(f"expected 4 players, got {n}")
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
