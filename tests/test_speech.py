"""توقيت الصوت على ثلاثة أنواع أجهزة: عادي، أندرويد (الصوت غير معلن)، ومتصفح لا يرسل حدث الانتهاء.
يتحقق من: لا يُنطق السؤال بعد الإجابة، ولا تُقطع عبارة المديح بالانتقال للسؤال التالي."""
import asyncio, sys
from helpers import async_playwright, BASE, MOCK, start_server, new_kid

async def run(mode, act):
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width": 390, "height": 844})
        await ctx.add_init_script("window.__ttsMode = %r;" % mode)
        await ctx.add_init_script(MOCK)
        pg = await ctx.new_page()
        await new_kid(pg, "small")
        await pg.click(".skill-card[data-skill='sounds']"); await pg.click(f".activity[data-id='{act}']")
        for _ in range(6):
            await pg.wait_for_selector(".choice:not([disabled])", timeout=15000)
            await pg.evaluate("()=>{for(const b of document.querySelectorAll('.choice')){if(document.querySelector('.choice.right'))break;b.click()}}")
            await pg.wait_for_selector(".choice.right")
            await pg.wait_for_function("() => !document.querySelector('.choice.right') || document.querySelector('.result')", timeout=20000)
        await pg.wait_for_selector(".result", timeout=20000)
        log = await pg.evaluate("()=>window.__speech")
        await b.close()
    problems, state, pending = [], None, []
    for e in log:
        if e["ev"] == "answered": state, pending = "after", []
        elif e["ev"] == "render":
            if state == "after":
                problems += ["praise cut: " + t["text"] for t in pending if t["status"] != "ended"]
            state = "q"
        elif e["ev"] == "start" and state == "after":
            if "..." in e["text"]: problems.append("question audio after answer: " + e["text"])
            pending.append({"text": e["text"], "status": "playing"})
        elif e["ev"] in ("end", "cancel") and state == "after":
            for t in pending:
                if t["text"] == e["text"] and t["status"] == "playing": t["status"] = "ended" if e["ev"] == "end" else "cancelled"
    return problems

async def main():
    start_server()
    failed = False
    for mode in ["normal", "android", "noend"]:
        for act in ["first", "listen"]:
            pr = await run(mode, act)
            print(f"[{mode}/{act}] {'ok' if not pr else pr[:3]}")
            failed |= bool(pr)
    sys.exit(1 if failed else 0)

asyncio.run(main())
