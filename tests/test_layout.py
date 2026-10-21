"""يتحقق أن كل الشاشات تتسع لعرض الجوال بلا تمرير أفقي ولا عناصر مقطوعة،
بعرض 320 و360 بكسل، وبحجم خط عادي ومكبّر (يحاكي إعداد «حجم الخط» في أندرويد)."""
import asyncio, sys, re
from helpers import async_playwright, BASE, MOCK, start_server

# تكبير كل الخطوط بنسبة ثابتة (كما يفعل أندرويد مع textZoom)
ZOOM_JS = r"""(z) => {
  if (z === 1) return;
  const apply = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.dataset.zoomed) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      el.dataset.zoomed = '1';
      el.style.setProperty('font-size', (fs * z) + 'px', 'important');
    }
  };
  // نكبّر من الأعلى للأسفل حتى لا يتضاعف التكبير بالوراثة
  const run = () => { for (const el of document.querySelectorAll('[data-zoomed]')) {} apply(document.body); };
  run();
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
}"""

CHECK_JS = r"""() => {
  const W = document.documentElement.clientWidth;
  const bad = [];
  if (document.documentElement.scrollWidth > W + 1) bad.push('page scrolls horizontally: ' + document.documentElement.scrollWidth + ' > ' + W);
  for (const el of document.querySelectorAll('#app *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
    if (el.closest('.stage, .confetti, .train, .lane, .rcar')) continue;  // مسارح الألعاب تتحرك عناصرها خارج الحدود عمداً
    if (r.right > W + 1 || r.left < -1) bad.push((el.id ? '#' + el.id : el.className || el.tagName) + ` [${Math.round(r.left)}..${Math.round(r.right)}]`);
  }
  return [...new Set(bad)].slice(0, 6);
}"""

async def visit(pg, label, problems, width, zoom):
    await pg.wait_for_timeout(250)
    bad = await pg.evaluate(CHECK_JS)
    if bad: problems.append(f"{width}px x{zoom} {label}: {bad}")

async def run(browser, width, zoom, problems):
    ctx = await browser.new_context(viewport={"width": width, "height": 720})
    await ctx.add_init_script("window.__ttsMode='normal';"); await ctx.add_init_script(MOCK)
    pg = await ctx.new_page()
    await pg.goto(BASE); await pg.evaluate("()=>localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(400)
    await pg.evaluate(ZOOM_JS, zoom)
    await visit(pg, "new profile", problems, width, zoom)
    await pg.fill("#kid-name", "رضا"); await pg.click("[data-age=big]"); await pg.click("#go"); await pg.wait_for_timeout(300)
    await visit(pg, "home", problems, width, zoom)
    await pg.click("#who"); await visit(pg, "profiles", problems, width, zoom)
    await pg.click(".profile-card[data-id]"); await pg.wait_for_timeout(200)
    skills = await pg.evaluate("()=>[...document.querySelectorAll('.skill-card')].map(b=>b.dataset.skill)")
    for sk in skills:
        await pg.click(f".skill-card[data-skill='{sk}']"); await visit(pg, f"skill {sk}", problems, width, zoom)
        acts = await pg.evaluate("()=>[...document.querySelectorAll('.activity')].map(b=>b.dataset.id)")
        for a in acts:
            await pg.click(f".activity[data-id='{a}']"); await pg.wait_for_timeout(500)
            if await pg.locator(".theme").count(): await pg.locator(".theme").first.click(); await pg.wait_for_timeout(200)
            if await pg.locator(".book").count(): await pg.locator(".book").first.click(); await pg.wait_for_timeout(200)
            await visit(pg, f"activity {a}", problems, width, zoom)
            # رجوع حتى صفحة القسم
            for _ in range(3):
                if await pg.locator(".activity").count(): break
                if await pg.locator("#back").count(): await pg.click("#back"); await pg.wait_for_timeout(200)
        await pg.click("#back"); await pg.wait_for_timeout(200)
    for btn, label in [("#album", "album"), ("#garden", "garden"), ("#certs", "certificates")]:
        await pg.click(btn); await visit(pg, label, problems, width, zoom); await pg.click("#back"); await pg.wait_for_timeout(200)
    await pg.click("#parents"); await visit(pg, "parents gate", problems, width, zoom)
    q = await pg.locator(".prompt .big").inner_text(); x, y = map(int, re.findall(r"\d+", q)[:2])
    await pg.click(f".choice[data-v='{x*y}']"); await visit(pg, "parents report", problems, width, zoom)
    await pg.click("#edit"); await visit(pg, "edit profile", problems, width, zoom)
    await ctx.close()

async def main():
    start_server()
    problems = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await asyncio.gather(*[run(b, w, z, problems) for w in (320, 360) for z in (1, 1.3)])
        await b.close()
    for pr in problems[:40]: print(" -", pr)
    print(f"layout problems: {len(problems) or 'none'}")
    sys.exit(1 if problems else 0)

asyncio.run(main())
