"""معايرة تقييم الكتابة باليد على الحروف الـ28:
- الكتابة الحرّة: الحرف الصحيح (بحجم أو مكان مختلف قليلاً) يُقبل دائماً، والخربشة تُرفض غالباً
- الترتيب والاتجاه: الكتابة الصحيحة تُقبل دائماً، والمعكوسة تُكتشف، والنقاط قبل الحرف تُكتشف"""
import asyncio, sys
from helpers import async_playwright, BASE, start_server

CALIB = """async () => {
  let __s = 12345; Math.random = () => { __s = (__s * 1103515245 + 12345) % 2147483648; return __s / 2147483648; };

  const { scoreTrace, placeText, frameOf } = await import('./js/tracecheck.js');
  const { LETTERS, SIMILAR_GROUPS } = await import('./js/data.js');
  await document.fonts.load('700 40px "Naskh"', 'ب');
  // خطوط أفقية تملأ شكل النص (تقريب لكتابة الطفل فوق الحرف)
  const S = 300;
  function strokesOf(text, step = 9) {
    const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const pl = placeText(x, S, text); x.fillText(text, pl.x, pl.y);
    const d = x.getImageData(0,0,S,S).data; const out = [];
    for (let y = 0; y < S; y += step) { let s = -1;
      for (let i = 0; i < S; i++) { const a = d[(y*S+i)*4+3] > 40; if (a && s < 0) s = i; if ((!a || i === S-1) && s >= 0) { out.push([{x:s/S,y:y/S},{x:i/S,y:y/S}]); s = -1; } } }
    return out;
  }
  const tf = (st, k, ox, oy) => st.map(l => l.map(p => ({ x: ox + p.x*k, y: oy + p.y*k })));
  const jit = (st, a) => st.map(l => l.map(p => ({ x: p.x + (Math.random()-.5)*a, y: p.y + (Math.random()-.5)*a })));
  const rnd = () => Array.from({length: 12}, () => [{x:.15+Math.random()*.3,y:.1+Math.random()*.8},{x:.55+Math.random()*.3,y:.1+Math.random()*.8}]);
  const groupOf = l => SIMILAR_GROUPS.find(g => g.includes(l)) || [l];
  const rows = [];
  for (const L of LETTERS) {
    const st = strokesOf(L.l);
    const other = LETTERS.filter(o => !groupOf(L.l).includes(o.l));
    const W = other[Math.floor(Math.random()*other.length)];
    const F = frameOf(L.l);
    const around = (st, k, dx, dy) => st.map(l => l.map(p => ({ x: .5 + (p.x - .5) * k + dx, y: .5 + (p.y - .5) * k + dy })));
    const inFrame = () => Array.from({length: 12}, () => [{x:F.x+Math.random()*F.w,y:F.y+Math.random()*F.h},{x:F.x+Math.random()*F.w,y:F.y+Math.random()*F.h}]);
    const cases = {
      exact: st, smaller: around(st, .85, .03, -.03), bigger: around(st, 1.15, -.03, .03), shaky: jit(around(st, .92, .04, .04), .035),
      wrong: strokesOf(W.l), scribble: inFrame(), scribble2: inFrame()
    };
    const r = { l: L.l };
    for (const [k, v] of Object.entries(cases)) { const sc = scoreTrace(L.l, v, true, .075); r[k] = [+sc.coverage.toFixed(2), +sc.precision.toFixed(2), sc.pass, +sc.ink.toFixed(2)]; }
    rows.push(r);
  }
  return rows;
}"""

ORDER = """async () => {
  const { letterGuide, checkOrder, placeText } = await import('./js/tracecheck.js');
  const { LETTERS } = await import('./js/data.js');
  await document.fonts.load('700 40px "Naskh"', 'ب');
  const S = 300;
  // نرسم الحرف كخط واحد طويل يمر على صفوف الجسم (متعرّج) بالاتجاه المطلوب، ثم النقاط
  function strokes(text, mode) {
    const g = letterGuide(text);
    const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const pl = placeText(x, S, text); x.fillText(text, pl.x, pl.y);
    const d = x.getImageData(0,0,S,S).data;
    const isBody = (px, py) => { const N = 96; const gx = Math.floor(px/S*N), gy = Math.floor(py/S*N); return g.comp[gy*N+gx] === g.bodyId; };
    const body = [], dots = [];
    for (let y = 0; y < S; y += 6) {
      let s = -1;
      for (let i = 0; i < S; i++) {
        const a = d[(y*S+i)*4+3] > 40;
        if (a && s < 0) s = i;
        if ((!a || i === S-1) && s >= 0) {
          const mid = (s+i)/2;
          const seg = [{x:i/S,y:y/S},{x:s/S,y:y/S}];  // right -> left
          (isBody(mid, y) ? body : dots).push(seg); s = -1;
        }
      }
    }
    let main;
    if (g.vertical) main = body.map(sg => ({x:(sg[0].x+sg[1].x)/2, y:sg[0].y}));          // top -> bottom
    else {
      // من اليمين لليسار: ننقل النقاط عمودياً ثم أفقياً
      const pts = body.flat().sort((a,b) => b.x - a.x);
      main = pts.filter((_, i) => i % 2 === 0);
    }
    if (mode === 'reverse') main = main.slice().reverse();
    const ds = dots.map(sg => [sg[0], {x: sg[0].x - 0.01, y: sg[0].y}]);
    if (mode === 'dotsFirst') return [...ds.slice(0,1), main, ...ds.slice(1)];
    return [main, ...ds];
  }
  const rows = [];
  for (const L of LETTERS) {
    const g = letterGuide(L.l);
    const r = { l: L.l, vertical: g.vertical, dots: g.dots.length };
    for (const m of ['correct', 'reverse', 'dotsFirst']) { const res = checkOrder(L.l, strokes(L.l, m)); r[m] = res.ok ? 'ok' : res.reason; }
    rows.push(r);
  }
  return rows;
}"""

async def main():
    start_server()
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto(BASE); await pg.wait_for_timeout(500)
        rows = await pg.evaluate(CALIB)
        orows = await pg.evaluate(ORDER)
        await b.close()
    n = len(rows)
    passed = lambda k: sum(r[k][2] for r in rows)
    res = {k: passed(k) for k in ["exact", "smaller", "bigger", "shaky", "wrong", "scribble", "scribble2"]}
    print("free writing accepted per case:", res, "of", n)
    correct_rev = sum(r["correct"] == "ok" for r in orows)
    rev = sum(r["reverse"] != "ok" for r in orows)
    wd = [r for r in orows if r["dots"]]
    dots = sum(r["dotsFirst"] == "dots" for r in wd)
    print(f"order: correct accepted {correct_rev}/{len(orows)}, reversed caught {rev}/{len(orows)}, dots-first caught {dots}/{len(wd)}")
    ok = (all(res[k] == n for k in ["exact", "smaller", "bigger", "shaky"])
          and res["scribble"] <= 5 and res["scribble2"] <= 5
          and correct_rev == len(orows) and rev == len(orows) and dots >= len(wd) - 2)
    sys.exit(0 if ok else 1)

asyncio.run(main())
