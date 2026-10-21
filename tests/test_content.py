"""سلامة المحتوى + صحة كل الأسئلة التي تولّدها التمارين (آلاف الأسئلة للعمرين)."""
import asyncio, sys
from helpers import async_playwright, BASE, start_server

JS = """async () => {
  const d = await import('./js/data.js');
  const { LANG } = await import('./js/lang.js');
  const problems = [];
  // المقاطع تعيد تكوين الكلمة (عدا الشدّة التي تُفكّك إلى ساكن + متحرك)
  for (const x of d.SPELL_WORDS) {
    let j = x.syl.join('');
    if (x.type === 'shadda') j = j.replace(/(\\p{L})\\u0652\\1([\\u064B-\\u0650])/u, '$1\\u0651$2');
    const norm = s => s.normalize('NFC').replace(/([\\u064B-\\u0650])\\u0651/g, '\\u0651$1');
    if (norm(j) !== norm(x.w)) problems.push('syllables ' + x.w);
  }
  const e = {}, w = {};
  for (const x of d.ALL_WORDS) { if (e[x.emoji]) problems.push('dup emoji ' + x.emoji); e[x.emoji] = 1; if (w[x.w]) problems.push('dup word ' + x.w); w[x.w] = 1; }
  // في العربية كلمتان على الأقل لكل حرف. في الإنجليزية كلمة على الأقل، إلا x (لا كلمة مناسبة تبدأ بصوته)
  for (const [l, v] of Object.entries(d.LETTER_WORDS)) if (v.length < (LANG.code === 'ar' ? 2 : l === 'x' ? 0 : 1)) problems.push('few words for ' + l);
  // كل كلمة في قائمة الحرف تبدأ به فعلاً
  if (LANG.code !== 'ar') for (const [l, v] of Object.entries(d.LETTER_WORDS)) for (const x of v) if (x.w[0] !== l) problems.push(`${x.w} listed under ${l}`);
  // كل نشاط له مولّد أو شاشة
  const { GEN } = await import('./js/exercises.js');
  const screens = ['stories', 'lesson', 'spellGuide', 'arcade', 'vocab'];
  for (const a of d.ACTIVITIES) if (!screens.includes(a.type) && !GEN[a.type]) problems.push('no generator for ' + a.id);
  const ids = d.ACTIVITIES.map(a => a.id); ids.forEach((x, i) => ids.indexOf(x) !== i && problems.push('dup activity ' + x));
  return problems;
}"""

GEN = """async () => {
  const { store } = await import('./js/store.js');
  const { GEN } = await import('./js/exercises.js');
  const { ACTIVITIES } = await import('./js/data.js');
  const { LANG, ageRank } = await import('./js/lang.js');
  const ages = LANG.ages.map(a => a.id);
  const MIN = { all: 0, big: 1, older: 2 };
  const KEYS = LANG.keyboard.join('');
  const out = { checked: 0, problems: [] };
  for (const age of ages) {
    store.addProfile({ name: 't' + age, age });
    for (const lv of ACTIVITIES) {
      if (['stories', 'lesson', 'spellGuide', 'arcade'].includes(lv.type) || ageRank(age) < (MIN[lv.age] ?? 0)) continue;
      for (let i = 0; i < 150; i++) {
        let q;
        try { q = GEN[lv.type](lv, i % 4); } catch (err) { out.problems.push(`${lv.id}: THROW ${err.message}`); break; }
        out.checked++;
        const where = `${age}/${lv.id}`;
        const prompt = q.promptHtml || '';
        if (/undefined|NaN/.test(prompt)) out.problems.push(`${where}: bad prompt`);
        if (q.kind === 'choice') {
          const r = q.options.filter(o => o.right).length;
          if (r !== 1) out.problems.push(`${where}: ${r} right answers`);
          const ids = q.options.map(o => o.id); if (new Set(ids).size !== ids.length) out.problems.push(`${where}: duplicate option ids`);
          const html = q.options.map(o => String(o.html));
          if (q.target !== null && new Set(html).size !== html.length) out.problems.push(`${where}: duplicate options ${html.join('|')}`);
          if (html.some(h => /undefined|NaN/.test(h) || !h)) out.problems.push(`${where}: empty option`);
          if (age === 'small' && ['first', 'sounds'].includes(lv.type) && prompt.includes('hint-word')) out.problems.push(`${where}: written word shown to a non-reader`);
        }
        if (q.kind === 'build') { const parts = q.parts || [...q.word.w]; if ((q.extras || []).some(x => parts.includes(x))) out.problems.push(`${where}: distractor equals a part`); }
        if (q.kind === 'keyboard' && [...q.word.w].some(ch => !KEYS.includes(ch))) out.problems.push(`${where}: missing key for ${q.word.w}`);
        if (q.kind === 'memory' && new Set(q.pairs.map(p => p.b.face)).size !== q.pairs.length) out.problems.push(`${where}: duplicate memory cards`);
      }
    }
  }
  out.problems = [...new Set(out.problems)];
  return out;
}"""

async def main():
    start_server()
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.wait_for_timeout(400)
        content = await pg.evaluate(JS)
        gen = await pg.evaluate(GEN)
        await b.close()
    print(f"content problems: {content or 'none'}")
    print(f"generated {gen['checked']} questions, problems: {gen['problems'][:10] or 'none'}")
    ok = not content and not gen["problems"] and not errs
    if errs: print("page errors:", errs)
    sys.exit(0 if ok else 1)

asyncio.run(main())
