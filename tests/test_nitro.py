"""لعبة نيترو: حلبات مغلقة سليمة، سباقات آلية تنتهي على كل الحلبات، والصعوبة منطقية،
ثم اللعب في المتصفح أفقياً وعمودياً: القوائم، الكراج (شراء وتطوير)، البطولة، أزرار القيادة،
النيترو والدرفت، الإيقاف المؤقت، إكمال السباق والنتائج، وعدم وجود أخطاء أو قيم غير صالحة."""
import asyncio, sys
from helpers import async_playwright, start_server, PORT, APP

BASE = f"http://127.0.0.1:{PORT}/nitro/?test"
GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

ENGINE = """async () => {
  const { TRACKS, buildTrack } = await import('./js/tracks.js');
  const S = await import('./js/sim.js');
  const problems = [];
  const race = (T, ents, player, limit = 240) => {
    const R = S.createRace(T, ents, { player });
    let n = 0;
    while (R.phase !== 'done' && n++ < limit * 60) {
      S.stepRace(R);
      if (n % 300 === 0 && R.cars.some((c) => !Number.isFinite(c.x) || !Number.isFinite(c.z) || !Number.isFinite(c.h))) { problems.push('bad car state on ' + T.def.id); break; }
    }
    return R;
  };
  for (const def of TRACKS) {
    const T = buildTrack(def);
    if (!T.valid) problems.push('track not closed or overlapping: ' + def.id);
    if (Math.abs(T.length - T.pts.reduce((a, p) => a + p.len, 0)) > 0.01) problems.push('length mismatch ' + def.id);
    if (T.tiles[0].kind !== 'finish' || T.tiles.some((t) => t.rot == null || Number.isNaN(t.rot))) problems.push('bad tiles ' + def.id);
    // أربع سيارات آلية: يجب أن يكمل الجميع السباق ضمن وقت معقول
    const ents = ['green', 'yellow', 'purple', 'red'].map((v, k) => ({ vid: v, stats: S.statsOf(v), ai: ['hard', 'normal', 'easy', 'normal'][k], name: 'c' + k }));
    const R = race(T, ents, 3);
    if (R.phase !== 'done') problems.push('race did not end on ' + def.id);
    const me = R.cars[3];
    if (!me.finished) problems.push('player-autopilot did not finish ' + def.id);
    const lap = me.bestLap;
    if (!(lap > 5 && lap < 45)) problems.push(`odd lap time on ${def.id}: ${lap}`);
  }
  // الصعوبة: سائق ماهر بسيارة البداية يفوز على المنافسين السهلين في الحلبة الأولى
  let wins = 0;
  for (let k = 0; k < 3; k++) {
    const T = buildTrack(TRACKS[k]);
    const ents = ['green', 'yellow', 'purple'].map((v, i) => ({ vid: v, stats: S.statsOf(v), ai: 'easy', name: 'e' + i }));
    ents.push({ vid: 'red', stats: S.statsOf('red', { engine: 1, turbo: 1, tires: 1 }), ai: 'hard', name: 'me' });
    const R = race(T, ents, 3);
    if (R.cars[3].place === 1) wins++;
  }
  if (wins < 2) problems.push('skilled driver beat easy opponents only ' + wins + '/3');
  // التطويرات ترفع الخصائص
  const a = S.statsOf('red'), b = S.statsOf('red', { engine: 3, turbo: 3, tires: 3, nitro: 3 });
  if (!(b.speed > a.speed && b.accel > a.accel && b.grip > a.grip && b.nitro > a.nitro)) problems.push('upgrades do nothing');
  return problems;
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
    await pg.goto(BASE); await ev("()=>localStorage.clear()"); await pg.reload()
    try:
        await pg.wait_for_selector("#cup", timeout=90000)
    except Exception:
        out.append(f"{tag}: game did not load: " + (await pg.inner_text("#app"))[:200]); await pg.close(); return out
    await check("home")
    # الكراج: لا يمكن الشراء بلا عملات، ثم شراء وتطوير
    await pg.click("#garage"); await pg.wait_for_timeout(300); await check("garage")
    await pg.click("#next"); await pg.wait_for_timeout(200)
    if not await pg.locator("#buy").count(): out.append(f"{tag}: buy button missing for locked car")
    await pg.click("#buy"); await pg.wait_for_timeout(150)
    if await ev("()=>__nx.P.owned.length") != 1: out.append(f"{tag}: bought a car without coins")
    await ev("()=>{__nx.P.coins=5000}")
    await pg.click("#buy"); await pg.wait_for_timeout(200)
    if await ev("()=>__nx.P.owned.length") != 2: out.append(f"{tag}: buying a car failed")
    await pg.click(".up[data-u='engine']"); await pg.wait_for_timeout(200)
    car = await ev("()=>__nx.P.car")
    if await ev(f"()=>__nx.P.up['{car}'].engine") != 1: out.append(f"{tag}: upgrade failed")
    await pg.click("#back"); await pg.wait_for_timeout(200)
    # البطولة: الحلبة الأولى مفتوحة والثانية مقفلة
    await pg.click("#cup"); await pg.wait_for_timeout(300); await check("championship")
    if await pg.locator(".trk[data-i='1'][disabled]").count() != 1: out.append(f"{tag}: second track should be locked")
    await pg.click(".trk[data-i='0']"); await pg.wait_for_timeout(1200); await check("race")
    if await ev("()=>__nx.nan().length"): out.append(f"{tag}: NaN geometry in scene")
    if await ev("()=>__nx.G.view.scene.children.length") < 10: out.append(f"{tag}: scene looks empty")
    await ev("()=>__nx.fast(4)")  # بعد العدّ التنازلي
    if await ev("()=>__nx.G.race.phase") != "race": out.append(f"{tag}: countdown did not finish")
    # الدرفت: فرامل مع التفاف بسرعة
    await ev("()=>__nx.fast(1.2)")
    await ev("()=>{__nx.G.input.right=true; __nx.G.input.brake=true}")
    await ev("()=>__nx.fast(0.3)")
    if not await ev("()=>__nx.G.race.cars[3].drifting || __nx.G.race.cars[3].driftT > 0"): out.append(f"{tag}: drift did not start " + await ev("()=>{const m=__nx.G.race.cars[3];return `fs ${m.fs.toFixed(1)} steer ${m.steer.toFixed(2)} ${JSON.stringify(m.input)} wrong ${m.wrongT} ${__nx.G.race.phase} t ${__nx.G.race.t.toFixed(1)}`}"))
    await ev("()=>{__nx.G.input.right=false; __nx.G.input.brake=false}")
    await ev("()=>__nx.fast(1)")
    # أزرار القيادة
    async def hold(sel, js_check, label):
        box = await pg.locator(sel).bounding_box()
        await pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2); await pg.mouse.down()
        await ev("()=>__nx.fast(0.6)")
        ok = await ev(js_check)
        await pg.mouse.up()
        if not ok: out.append(f"{tag}: {label} button had no effect")
    await hold("#left", "()=>__nx.G.race.cars[3].input.steer < -0.5", "left")
    await hold("#right", "()=>__nx.G.race.cars[3].input.steer > 0.5", "right")
    await ev("()=>{__nx.G.race.cars[3].nitro=1}")
    await hold("#nitro", "()=>__nx.G.race.cars[3].nitroOn", "nitro")
    await ev("()=>__nx.fast(1.5)")
    await hold("#brake", "()=>__nx.G.race.cars[3].input.throttle < 0", "brake")
    # الإيقاف المؤقت
    await pg.click("#pause"); await pg.wait_for_timeout(200); await check("pause")
    t1 = await ev("()=>__nx.G.race.t"); await pg.wait_for_timeout(700)
    if await ev("()=>__nx.G.race.t") != t1: out.append(f"{tag}: race kept running while paused")
    await pg.click("#resume")
    # إكمال السباق آلياً والنتائج
    coins0 = await ev("()=>__nx.P.coins")
    await ev("()=>{__nx.autopilot(); __nx.fast(400)}")
    try:
        await pg.wait_for_selector(".sheet.result", timeout=15000)
    except Exception:
        out.append(f"{tag}: results never shown (phase {await ev('()=>__nx.G && __nx.G.race.phase')})")
    else:
        await check("results")
        if await ev("()=>__nx.P.coins") <= coins0: out.append(f"{tag}: no coins earned")
        if await pg.locator(".standings li").count() != 4: out.append(f"{tag}: standings incomplete")
        await pg.click("#menu"); await pg.wait_for_timeout(300)
    # الإعدادات والمساعدة
    await pg.click("#back") if await pg.locator("#back").count() else None
    if await pg.locator("#help").count():
        await pg.click("#help"); await pg.wait_for_timeout(150); await check("help"); await pg.click("#ok")
    await pg.close()
    return out

async def main():
    if APP != "kids":
        print("skipped (game is not part of this app)"); return
    start_server()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=GL_ARGS); errs = []
        pg = await b.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.wait_for_timeout(300)
        eng = await pg.evaluate(ENGINE)
        await pg.close()
        print(f"engine problems: {eng or 'none'}")
        ui = []
        for w, h in ((844, 390), (390, 844)): ui += await play(b, w, h, errs)
        await b.close()
    print(f"ui problems: {ui or 'none'}")
    if errs: print("page errors:", errs[:5])
    sys.exit(0 if not eng and not ui and not errs else 1)

asyncio.run(main())
