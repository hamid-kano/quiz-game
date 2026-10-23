"""لعبة قوافل: قواعد المحرّك (مئات الأيام بلاعب آلي) + اللعب الفعلي في المتصفح + الاتساع على الجوال."""
import asyncio, sys, os
from helpers import async_playwright, start_server, PORT, APP

BASE = f"http://127.0.0.1:{PORT}/qawafil/"

ENGINE = """async () => {
  const E = await import('./js/engine.js');
  const { GOODS } = await import('./js/data.js');
  const problems = [];
  const worths = [];
  for (let seed = 1; seed <= 25; seed++) {
    const s = E.newGame(seed * 104729);
    let steps = 0;
    while (!s.over && steps++ < 3000) {
      for (const k of [...s.active]) if (E.canDeliver(s, k)) E.deliver(s, k.id);
      for (const g of Object.keys(s.cargo)) E.sell(s, g, 999);
      if (E.offersHere(s).length && s.active.length < 2) E.acceptContract(s, E.offersHere(s)[0].id);
      while (s.money > s.camels * 450 && E.buyCamel(s)) {}
      let best = null;
      for (const to of E.neighbors(s.city)) {
        const r = E.routeBetween(s.city, to);
        for (const g of GOODS) {
          const m = (E.sellPrice(s, g.id, to) - E.buyPrice(s, g.id)) / r.days;
          if (!best || m > best.m) best = { to, g: g.id, m, r };
        }
      }
      while (s.guards < Math.ceil(s.camels * 0.4) && E.hireGuard(s)) {}
      E.buySupplies(s, E.dailyNeed(s, best.r) * best.r.days + 4 - s.supplies);
      if (best.m > 0) E.buy(s, best.g, Math.floor((s.money - 30) / E.buyPrice(s, best.g)));
      E.startTravel(s, best.to);
      while (s.travel && !s.over) {
        E.travelDay(s);
        if (s.pending) E.resolve(s, s.pending.choices[seed % s.pending.choices.length].id);
        if (s.money < 0) problems.push('negative money');
        if (E.cargoUsed(s) > E.capacity(s)) problems.push('cargo over capacity');
        if (s.supplies > E.maxSupplies(s) || s.supplies < 0) problems.push('bad supplies');
        if (Object.values(s.cargo).some((n) => n <= 0)) problems.push('empty cargo entry');
        if (!Number.isFinite(E.netWorth(s))) problems.push('NaN worth');
      }
      if (steps > 2900) problems.push('game did not end');
    }
    // الحالة قابلة للحفظ والاستعادة
    const copy = JSON.parse(JSON.stringify(s));
    if (E.netWorth(copy) !== E.netWorth(s)) problems.push('save/load mismatch');
    worths.push(E.netWorth(s));
  }
  // نفس البذرة = نفس اللعبة
  const a = E.newGame(42), b = E.newGame(42);
  if (JSON.stringify(a) !== JSON.stringify(b)) problems.push('seed not deterministic');
  return { problems: [...new Set(problems)], worths: worths.sort((x, y) => x - y) };
}"""

async def play_ui(b, width, errs):
    pg = await b.new_page(viewport={"width": width, "height": 740})
    pg.on("pageerror", lambda e: errs.append(f"{width}: {e}"))
    pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(BASE); await pg.evaluate("()=>{localStorage.clear();localStorage.setItem('qawafil-speed','2')}"); await pg.reload(); await pg.wait_for_timeout(400)
    await pg.click("#new"); await pg.wait_for_timeout(200); await pg.click("#ok")
    over = []
    async def check(label):
        w = await pg.evaluate("()=>document.documentElement.scrollWidth - document.documentElement.clientWidth")
        if w > 1: over.append(f"{width}px {label}: page scrolls sideways by {w}px")
    await check("map")
    await pg.click("[data-tab=market]"); await pg.wait_for_timeout(150); await check("market")
    await pg.locator(".good[data-g='spice'] .buy[data-n='5']").click(); await pg.wait_for_timeout(100)
    await pg.click("[data-tab=caravan]"); await pg.wait_for_timeout(150); await check("caravan")
    await pg.click("#waterFull"); await pg.click("#hire")
    await pg.click("[data-tab=contracts]"); await pg.wait_for_timeout(150); await check("contracts")
    await pg.click("[data-tab=news]"); await pg.wait_for_timeout(150); await check("news")
    # رحلتان كاملتان مع الأحداث
    for to in ("aleppo", "damascus"):
        await pg.click("[data-tab=map]"); await pg.wait_for_timeout(150)
        await pg.click(f".city[data-city='{to}']"); await pg.wait_for_timeout(150); await check("route panel")
        await pg.click("#go")
        for _ in range(80):
            await pg.wait_for_timeout(250)
            if await pg.locator(".sheet.event [data-c]").count():
                await check("event"); await pg.locator("[data-c]").first.click(); await pg.wait_for_timeout(150); await pg.click("#cont")
            if await pg.locator(".view-market").count(): break
        else:
            over.append(f"{width}px: never arrived at {to}")
        await pg.locator(".good .b.sell[data-n='max']:not([disabled])").first.click() if await pg.locator(".good .b.sell[data-n='max']:not([disabled])").count() else None
    day = await pg.evaluate("()=>JSON.parse(localStorage.getItem('qawafil-save-v1')).day")
    # رحلتان من 5 أيام، وقد يختصرهما الدليل الصحراوي يومين
    if day < 6: over.append(f"{width}px: days did not pass ({day})")
    # المتابعة بعد إعادة التحميل
    await pg.reload(); await pg.wait_for_timeout(300)
    if not await pg.locator("#cont").count(): over.append("no continue button after reload")
    await pg.click("#cont"); await pg.wait_for_timeout(200)
    await pg.click("[data-tab=caravan]"); await pg.click("#end"); await pg.wait_for_timeout(400)
    if not await pg.locator(".end-screen").count(): over.append("end screen missing")
    await check("end")
    await pg.close()
    return over

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
        print(f"engine: 25 bot seasons, worth range {eng['worths'][0]}..{eng['worths'][-1]} (median {eng['worths'][12]}), problems: {eng['problems'] or 'none'}")
        ui = []
        for w in (320, 390): ui += await play_ui(b, w, errs)
        await b.close()
    print(f"ui problems: {ui or 'none'}")
    if errs: print("page errors:", errs[:5])
    sys.exit(0 if not eng["problems"] and not ui and not errs else 1)

asyncio.run(main())
