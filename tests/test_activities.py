"""يلعب كل نشاط وكل لعبة في كل الأقسام للعمرين حتى شاشة النتيجة."""
import asyncio, sys, time
import helpers as H
from helpers import async_playwright, BASE, MOCK, start_server, new_kid

GAMES = {"gBubbles": H.bubbles, "gMole": H.mole, "gTrain": H.train, "gMaze": H.maze, "gRace": H.race, "gBaskets": H.baskets, "gShop": H.shop}

async def play_game(pg, gid, M):
    t0 = time.time()
    while not await pg.locator(".result").count() and time.time() - t0 < 150:
        try:
            pg.set_default_timeout(2000)
            await GAMES[gid](pg, M)
        except Exception:
            pass
        finally:
            pg.set_default_timeout(30000)
        await pg.wait_for_timeout(150)
    return await pg.locator(".result").count() > 0

async def run_age(browser, age, results, errs):
    ctx = await browser.new_context(viewport={"width": 390, "height": 844})
    await ctx.add_init_script("window.__ttsMode = 'normal';")
    await ctx.add_init_script(MOCK)
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(f"{age}: {e}"))
    await new_kid(pg, age)
    # جلسات أقصر لتسريع الاختبار
    await pg.evaluate("(k)=>{const d=JSON.parse(localStorage.getItem(k));d.settings.rounds=4;localStorage.setItem(k,JSON.stringify(d))}", H.STORE_KEY)
    await pg.reload(); await pg.wait_for_timeout(400)
    M = await H.maps(pg)
    skills = await pg.evaluate("()=>[...document.querySelectorAll('.skill-card')].map(b=>b.dataset.skill)")
    for sk in skills:
        await pg.click(f".skill-card[data-skill='{sk}']"); await pg.wait_for_timeout(250)
        acts = await pg.evaluate("()=>[...document.querySelectorAll('.activity')].map(b=>b.dataset.id)")
        for a in acts:
            await pg.click(f".activity[data-id='{a}']"); await pg.wait_for_timeout(300)
            if a == "board":
                await pg.click(".bl >> nth=3"); await pg.wait_for_timeout(200)
                await pg.click("#back"); await pg.wait_for_timeout(150); await pg.click("#back"); await pg.wait_for_timeout(150)
                results.append((age, sk, a, True)); continue
            if a == "spGuide":
                for _ in range(7): await pg.click("#next"); await pg.wait_for_timeout(80)
                await pg.click("#back"); await pg.wait_for_timeout(150)
                results.append((age, sk, a, True)); continue
            t0 = time.time()
            ok = await (play_game(pg, a, M) if a in GAMES else H.play_until_result(pg, maxr=30))
            results.append((age, sk, a, ok))
            print(f"  {age:5s} {sk:13s} {a:14s} {'ok' if ok else 'FAIL'} {time.time() - t0:5.1f}s", flush=True)
            if not ok:
                await pg.goto(BASE); await pg.wait_for_timeout(400)
                await pg.click(f".skill-card[data-skill='{sk}']"); await pg.wait_for_timeout(250); continue
            await pg.click("#map"); await pg.wait_for_timeout(250)
        await pg.click("#back"); await pg.wait_for_timeout(250)
    # الشاشات الأخرى
    await pg.click("#daily"); results.append((age, "home", "daily", await H.play_until_result(pg, maxr=30)))
    await ctx.close()

async def main():
    start_server()
    results, errs = [], []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ages = ["small", "big"] + (["older"] if H.APP == "english" else [])
        await asyncio.gather(*[run_age(browser, a, results, errs) for a in ages])
        await browser.close()
    fails = [r for r in results if not r[3]]
    print(f"played {len(results)} activities, failed: {[(a, s, x) for a, s, x, _ in fails] or 'none'}")
    if errs: print("page errors:", errs[:5])
    sys.exit(0 if not fails and not errs else 1)

asyncio.run(main())
