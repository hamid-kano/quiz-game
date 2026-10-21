// ============================================================
//  تمارين خاصة بتطبيق الإنجليزية:
//  الحروف الكبيرة والصغيرة، ترتيب الحروف، القراءة الصوتية (Phonics)،
//  الكلمات المتشابهة في نهايتها، المعاني، قواعد بسيطة، وأسماء الأعداد
//  (يستبدل kids/js/lang-exercises.js عند بناء تطبيق الإنجليزية)
// ============================================================
import { LETTERS, SIMILAR_GROUPS, LETTER_WORDS, ALL_WORDS, SPELL_WORDS, SIGHT_WORDS, VOCAB, NUMBERS_20 } from "./data.js";
import { store } from "./store.js";
import { ageRank } from "./lang.js";
import { shuffle, pick, randomOf } from "./util.js";

export function extendGen(GEN, H) {
  const { variant, letterChoices, letterOpt, picOpt, textOpt, oddOneOut, big, optionCount, byLetter } = H;
  const older = () => ageRank(store.active.age) >= 2;
  const wordOpt = (w, right) => ({ id: w, html: w, right, word: true });
  const sylOf = (w) => w.syl;
  const blankOut = (w, part) => {
    const i = w.indexOf(part);
    return `${w.slice(0, i)}<span class="blank">${"_".repeat(part.length)}</span>${w.slice(i + part.length)}`;
  };
  const wordBox = (html) => `<div class="big en-word">${html}</div>`;
  // صور مختلفة عن بعضها
  const distinct = (list, n, except = []) => {
    const seen = new Set(except);
    const out = [];
    for (const x of shuffle(list)) {
      if (seen.has(x.emoji)) continue;
      seen.add(x.emoji);
      out.push(x);
      if (out.length >= n) break;
    }
    return out;
  };

  // ---------------- حروف متشابهة: الاتجاه هو الفرق ----------------
  GEN.similar = () => {
    const pool = SIMILAR_GROUPS.flat().map((l) => byLetter[l]);
    const [t] = store.pickWeighted(pool, (L) => "rec:" + L.l);
    const group = SIMILAR_GROUPS.find((g) => g.includes(t.l)).map((l) => byLetter[l]);
    const v = variant({ pick: [3, 2], odd: [1, 2], pic: [2, 2] });
    if (v === "odd") {
      const odd = randomOf(group.filter((x) => x !== t));
      return { ...oddOneOut(t.l, odd.l, { q: "انتبه لاتجاه الحرف! أي حرف مختلف؟", say: "أي حرف مختلف؟", key: "rec:" + odd.l }), letterFont: true };
    }
    const opts = shuffle([t, ...pick(group.filter((x) => x !== t), optionCount() - 1)]);
    const w = LETTER_WORDS[t.l]?.[0];
    if (v === "pic" && w) {
      return {
        kind: "choice", key: "rec:" + t.l, target: t.l,
        promptHtml: `<div class="q">بأي حرف تبدأ هذه الكلمة؟</div><div class="pic">${w.emoji}</div>${big() ? `<div class="hint-word">${w.w}</div>` : ""}`,
        say: `${w.w}... ${w.w}`, slow: !big(),
        options: opts.map((L) => letterOpt(L, t)),
        praise: `${w.w} تبدأ بحرف ${t.name}`
      };
    }
    return {
      kind: "choice", key: "rec:" + t.l, target: t.l,
      promptHtml: `<div class="q">انتبه للاتجاه! أين الحرف الصغير <b>${t.l}</b>؟</div>${w ? `<div class="pic">${w.emoji}</div>` : ""}`,
      say: `أين حرف ${t.name}؟`,
      options: opts.map((L) => letterOpt(L, t)),
      praise: `أحسنت! ${t.name}`
    };
  };

  // ---------------- الكتابة: الحرف الصغير والكبير ----------------
  const baseTrace = GEN.trace;
  GEN.trace = (level, i) => {
    const mode = level?.mode || "letters";
    if (!["letters", "upper", "memory", "free"].includes(mode)) return baseTrace(level, i);
    const upper = mode === "upper";
    const [L] = store.pickWeighted(LETTERS, (x) => (upper ? "trcu:" : mode === "memory" ? "trm:" : mode === "free" ? "trf:" : "trc:") + x.l);
    const letter = upper ? { ...L, l: L.name } : { ...L, name: L.l };
    const kind = upper ? "الكبير" : "الصغير";
    if (mode === "memory") return { kind: "trace", key: "trm:" + L.l, letter, guide: "memory", say: `حرف ${L.name} ${kind}` };
    if (mode === "free") return { kind: "trace", key: "trf:" + L.l, letter, guide: "none", title: "اسمع واكتب الحرف الصغير بنفسك", say: `اكتب حرف ${L.name} الصغير` };
    return {
      kind: "trace", key: (upper ? "trcu:" : "trc:") + L.l, letter,
      title: `ارسم الحرف ${kind} <b>${letter.l}</b> فوق الخط الرمادي`, say: `حرف ${L.name} ${kind}`
    };
  };

  // ---------------- الذاكرة: الكبير مع الصغير ----------------
  const baseMemory = GEN._memory;
  GEN._memory = (level, pairsCount) => {
    if (level?.mode !== "case") return baseMemory(level, pairsCount);
    const letters = store.pickWeighted(LETTERS, (L) => "case:" + L.l, pairsCount);
    return {
      kind: "memory", key: "mem:c", title: "طابق كل حرف كبير مع الحرف الصغير",
      pairs: letters.map((L) => ({
        a: { face: L.name, cls: "letter", say: L.name },
        b: { face: L.l, cls: "letter alt", say: L.name },
        done: `${L.name}، ${L.l}`, rec: "case:" + L.l
      }))
    };
  };

  // ============================================================
  //  تمارين بنوع spell (لكل منها mode)
  // ============================================================
  const PH = {};

  // كلمات تتشابه في نهايتها (cat – hat): وعي صوتي بالسمع والصور
  PH.rhyme = () => {
    const pool = SPELL_WORDS.filter((w) => w.syl.length === 2 && w.type !== "multi");
    const fam = {};
    for (const w of pool) (fam[w.syl[1]] ||= []).push(w);
    const rimes = Object.keys(fam).filter((r) => fam[r].length >= 2);
    const [rime] = store.pickWeighted(rimes, (r) => "rhy:" + r);
    const [a, b] = pick(fam[rime], 2);
    const others = distinct(pool.filter((w) => w.syl[1] !== rime && !w.w.endsWith(rime)), optionCount() - 1, [a.emoji, b.emoji]);
    return {
      kind: "choice", key: "rhy:" + rime, target: b.w,
      promptHtml: `<div class="q">أي صورة تنتهي بنفس صوت هذه الكلمة؟</div><div class="pic">${a.emoji}</div>${big() ? `<div class="hint-word">${a.w}</div>` : ""}`,
      say: `${a.w}... ${a.w}`, slow: !big(),
      options: shuffle([picOpt(b, true), ...others.map((x) => picOpt(x, false))]),
      sayOption: true,
      praise: `${a.w}، ${b.w}`
    };
  };

  // الحرف الكبير والصغير
  PH.case = () => {
    const [t] = store.pickWeighted(LETTERS, (L) => "case:" + L.l);
    const toLower = variant({ lower: 3, upper: 2 }) === "lower";
    const opts = letterChoices(t, LETTERS, optionCount());
    return {
      kind: "choice", key: "case:" + t.l, target: t.l,
      promptHtml: `<div class="q">${toLower ? "أين الحرف الصغير لهذا الحرف؟" : "أين الحرف الكبير لهذا الحرف؟"}</div><div class="big">${toLower ? t.name : t.l}</div>`,
      say: toLower ? `أين حرف ${t.name} الصغير؟` : `أين حرف ${t.name} الكبير؟`,
      options: opts.map((L) => ({ id: L.l, html: toLower ? L.l : L.name, right: L === t })),
      praise: `${t.name}، ${t.l}`
    };
  };

  // ترتيب الحروف: ما الحرف التالي أو السابق؟
  PH.abc = () => {
    const [t] = store.pickWeighted(LETTERS.slice(1, 25), (L) => "abc:" + L.l);
    const i = LETTERS.indexOf(t);
    const after = Math.random() < 0.65;
    const ans = LETTERS[after ? i + 1 : i - 1];
    const seq = after ? [LETTERS[i - 1], t] : [t, LETTERS[i + 1]];
    const others = pick(LETTERS.filter((x) => x !== ans && !seq.includes(x)), optionCount() - 1);
    const show = after ? `${seq[0].l} ${seq[1].l} <span class="blank">?</span>` : `<span class="blank">?</span> ${seq[0].l} ${seq[1].l}`;
    return {
      kind: "choice", key: "abc:" + t.l, target: ans.l,
      promptHtml: `<div class="q">ما الحرف الذي يأتي ${after ? "بعد" : "قبل"} <b>${t.l}</b>؟</div><div class="big en-word">${show}</div>`,
      say: `ما الحرف الذي يأتي ${after ? "بعد" : "قبل"} ${t.name}؟`,
      options: shuffle([ans, ...others]).map((L) => letterOpt(L, ans)),
      praise: after ? `${seq[0].name}، ${t.name}، ${ans.name}` : `${ans.name}، ${t.name}، ${seq[1].name}`
    };
  };

  // 1) حروف العلة القصيرة: ما الحرف الناقص في وسط الكلمة؟
  const VOWELS = ["a", "e", "i", "o", "u"];
  PH.short = () => {
    const cvc = SPELL_WORDS.filter((w) => w.type === "cvc");
    const [w] = store.pickWeighted(cvc, (x) => "phs:" + x.w);
    const v = w.w[1];
    const opts = [v, ...pick(VOWELS.filter((x) => x !== v), big() ? 3 : 2)];
    return {
      kind: "choice", key: "phs:" + w.w, target: v, cols: opts.length > 3 ? 2 : 3,
      promptHtml: `<div class="q">اسمع: ما الحرف الناقص في وسط الكلمة؟</div><div class="pic small-pic">${w.emoji}</div>${wordBox(blankOut(w.w, v))}`,
      say: `${w.w}... ${w.w}`, slow: true,
      options: shuffle(opts).map((x) => ({ id: x, html: x, right: x === v })),
      praise: `${w.w}`
    };
  };

  // 2) كلمات من ثلاثة حروف: اقرأ واختر الصورة، أو اختر الكتابة الصحيحة
  PH.cvc = () => {
    const cvc = SPELL_WORDS.filter((w) => w.type === "cvc");
    const [w] = store.pickWeighted(cvc, (x) => "phc:" + x.w);
    const v = variant({ read: [2, 3], spell: [3, 2], hear: [2, 2] });
    if (v === "read") {
      const others = distinct(cvc.filter((x) => x !== w), optionCount() - 1, [w.emoji]);
      return {
        kind: "choice", key: "phc:" + w.w, target: w.w,
        promptHtml: `<div class="q">اقرأ الكلمة صوتاً صوتاً واختر صورتها</div>${wordBox(w.w)}`,
        say: null,
        options: shuffle([w, ...others]).map((x) => picOpt(x, x === w)),
        praise: `${w.syl.join("، ")}... ${w.w}`
      };
    }
    if (v === "spell") {
      // نفس الكلمة بحرف علة مختلف
      const wrong = pick(VOWELS.filter((x) => x !== w.w[1]), optionCount() - 1).map((x) => w.w[0] + x + w.w[2]);
      return {
        kind: "choice", key: "phc:" + w.w, target: w.w,
        promptHtml: `<div class="q">ما الكتابة الصحيحة لهذه الصورة؟</div><div class="pic">${w.emoji}</div>`,
        say: `${w.w}... ${w.w}`, slow: !big(),
        options: shuffle([w.w, ...wrong]).map((x) => wordOpt(x, x === w.w)),
        praise: w.w
      };
    }
    const near = cvc.filter((x) => x !== w && (x.w[0] === w.w[0] || x.syl[1] === w.syl[1]));
    const others = pick(near.length >= optionCount() - 1 ? near : cvc.filter((x) => x !== w), optionCount() - 1);
    return {
      kind: "choice", key: "phc:" + w.w, target: w.w,
      promptHtml: `<div class="q">اسمع واختر الكلمة</div><div class="ear">👂</div>`,
      say: `${w.w}... ${w.w}`, slow: true,
      options: shuffle([w, ...others]).map((x) => wordOpt(x.w, x === w)),
      praise: w.w
    };
  };

  // 3) كلمات نراها كثيراً
  PH.sight = () => {
    const pool = big() ? SIGHT_WORDS : SIGHT_WORDS.slice(0, 12);
    const [w] = store.pickWeighted(pool, (x) => "phw:" + x.w);
    const others = pick(pool.filter((x) => x !== w), optionCount() - 1);
    return {
      kind: "choice", key: "phw:" + w.w, target: w.w,
      promptHtml: `<div class="q">اسمع واختر الكلمة</div><div class="ear">👂</div>`,
      say: `${w.w}... ${w.w}`, slow: !big(),
      options: shuffle([w, ...others]).map((x) => wordOpt(x.w, x === w)),
      praise: `${w.w}، معناها ${w.ar}`
    };
  };

  // 4–7) حرفان بصوت واحد · حروف متجاورة · الـ e السحرية · فرق الحروف
  const UNITS = {
    digraph: { list: ["sh", "ch", "th", "ck"], key: "phd:", q: "أي حرفين ينقصان الكلمة؟" },
    blend: { list: ["fr", "fl", "cr", "dr", "st", "sw", "pl", "sl", "cl", "tr", "nt", "nd", "lk", "ft"], key: "phb:", q: "أي حرفين ينقصان الكلمة؟" },
    team: { list: ["ai", "ee", "oa", "oo", "ea", "ie", "ar", "or"], key: "pht:", q: "أي فريق حروف ينقص الكلمة؟" }
  };
  const unitGen = (type) => () => {
    const U = UNITS[type];
    const words = SPELL_WORDS.filter((w) => w.type === type && U.list.some((u) => w.w.includes(u)));
    const [w] = store.pickWeighted(words, (x) => U.key + x.w);
    const unit = U.list.find((u) => w.w.includes(u));
    // المشتّتات من نفس الموضع في الكلمة (أول/آخر)
    const atStart = w.w.startsWith(unit);
    const same = U.list.filter((u) => u !== unit && (type !== "blend" || (atStart ? u[0] !== "n" && u !== "lk" && u !== "ft" : ["nt", "nd", "lk", "ft"].includes(u))));
    const opts = shuffle([unit, ...pick(same, optionCount() - 1)]);
    return {
      kind: "choice", key: U.key + w.w, target: unit,
      promptHtml: `<div class="q">${U.q}</div><div class="pic small-pic">${w.emoji}</div>${wordBox(blankOut(w.w, unit))}`,
      say: `${w.w}... ${w.w}`, slow: true,
      options: opts.map((x) => ({ id: x, html: x, right: x === unit, word: true })),
      praise: `${unit}... ${w.w}`
    };
  };
  PH.digraph = unitGen("digraph");
  PH.blend = unitGen("blend");
  PH.team = unitGen("team");

  PH.magic = () => {
    const magic = SPELL_WORDS.filter((w) => w.type === "magic");
    const [w] = store.pickWeighted(magic, (x) => "phm:" + x.w);
    const without = w.w.slice(0, -1);
    if (variant({ pic: 3, which: 2 }) === "which") {
      const cvc = pick(SPELL_WORDS.filter((x) => x.type === "cvc"), optionCount() - 1);
      return {
        kind: "choice", key: "phm:" + w.w, target: w.w,
        promptHtml: `<div class="q">أي كلمة فيها e سحرية؟</div><div class="ooo-icon">🪄</div>`,
        say: "أي كلمة فيها e سحرية؟",
        options: shuffle([w.w, ...cvc.map((x) => x.w)]).map((x) => wordOpt(x, x === w.w)),
        praise: `${w.w}: الـ e لا تُنطق`
      };
    }
    const third = SPELL_WORDS.filter((x) => x.type === "magic" && x !== w)[0];
    const opts = [w.w, without, ...(big() ? [randomOf(magic.filter((x) => x !== w)).w] : [])];
    return {
      kind: "choice", key: "phm:" + w.w, target: w.w,
      promptHtml: `<div class="q">أي كلمة تناسب الصورة؟</div><div class="pic">${w.emoji}</div>`,
      say: `${w.w}... ${w.w}`, slow: true,
      options: shuffle([...new Set(opts)]).map((x) => wordOpt(x, x === w.w)),
      praise: `${without}... ${w.w}`
    };
  };

  // 8) ركّب الكلمة من أجزائها
  PH.build = () => {
    const pool = older() ? SPELL_WORDS : SPELL_WORDS.filter((w) => w.type !== "multi" || w.syl.length === 2);
    const [w] = store.pickWeighted(pool, (x) => "tj:" + x.w);
    const extras = [];
    for (const p of shuffle(w.syl)) {
      const vw = [...p].find((c) => VOWELS.includes(c));
      if (!vw) continue;
      const alt = p.replace(vw, randomOf(VOWELS.filter((x) => x !== vw)));
      if (!w.syl.includes(alt) && !extras.includes(alt)) extras.push(alt);
      if (extras.length >= 2) break;
    }
    return {
      kind: "build", key: "tj:" + w.w, word: { w: w.w, emoji: w.emoji },
      parts: sylOf(w), extras, sayParts: true, slow: true,
      title: "رتّب أجزاء الكلمة",
      praise: `${w.syl.join("، ")}... ${w.w}`
    };
  };

  // 9) الإملاء: اسمع واكتب بالحروف، بلا صورة
  PH.dictation = () => {
    const pool = ALL_WORDS.filter((w) => w.w.length <= (older() ? 6 : 4));
    const [w] = store.pickWeighted(pool, (x) => "dict:" + x.w);
    return { kind: "build", key: "dict:" + w.w, word: w, hidePic: true, slow: true, title: "اسمع الكلمة واكتبها", praise: `أحسنت! ${w.w}` };
  };

  // ما المعنى؟ من الإنجليزية إلى العربية وبالعكس
  PH.meaning = () => {
    const theme = randomOf(VOCAB);
    const [w] = store.pickWeighted(theme.words, (x) => "mean:" + x.w);
    const others = pick(theme.words.filter((x) => x !== w && x.ar !== w.ar), optionCount() - 1);
    if (variant({ toAr: 3, toEn: 2 }) === "toAr") {
      return {
        kind: "choice", key: "mean:" + w.w, target: w.w,
        promptHtml: `<div class="q">ما معنى هذه الكلمة؟</div>${wordBox(w.w)}`,
        say: `${w.w}... ${w.w}`,
        options: shuffle([w, ...others]).map((x) => textOpt(x.w, x.ar, x === w)),
        praise: `${w.w}، ${w.ar}`
      };
    }
    return {
      kind: "choice", key: "mean:" + w.w, target: w.w,
      promptHtml: `<div class="q">كيف نقول «${w.ar}» بالإنجليزية؟</div><div class="pic small-pic">${w.emoji}</div>`,
      say: `كيف نقول ${w.ar} بالإنجليزية؟`,
      options: shuffle([w, ...others]).map((x) => wordOpt(x.w, x === w)),
      praise: `${w.ar}: ${w.w}`
    };
  };

  // قواعد بسيطة للمتقدّمين: a/an · is/are · المفرد والجمع · this/these
  const NOUNS = [["cat", "🐱"], ["dog", "🐶"], ["ball", "⚽"], ["book", "📖"], ["car", "🚗"], ["apple", "🍎"], ["egg", "🥚"],
    ["pen", "🖊️"], ["hat", "🎩"], ["kite", "🪁"], ["star", "⭐"], ["tree", "🌳"], ["box", "📦"], ["bus", "🚌"], ["orange", "🍊"],
    ["umbrella", "☂️"], ["elephant", "🐘"], ["octopus", "🐙"], ["owl", "🦉"], ["insect", "🐛"], ["duck", "🦆"], ["fish", "🐟"]];
  const plural = (w) => (/(s|x|sh|ch)$/.test(w) ? w + "es" : w === "fish" ? "fish" : w + "s");
  const ADJ = [["big", "كبير"], ["small", "صغير"], ["happy", "سعيد"], ["fast", "سريع"], ["hungry", "جائع"], ["red", "أحمر"]];
  PH.grammar = () => {
    const v = variant({ an: 2, is: 2, pl: 2, th: 2 });
    const [w, e] = randomOf(NOUNS.filter(([x]) => v !== "pl" || x !== "fish"));
    const sentence = (s) => `<div class="sentence en-sentence">${s}</div>`;
    const blank = `<span class="blank">___</span>`;
    if (v === "an") {
      const ans = /^[aeiou]/.test(w) ? "an" : "a";
      return {
        kind: "choice", key: "gr:an", target: ans, cols: 2,
        promptHtml: `<div class="q">a أم an؟</div><div class="pic small-pic">${e}</div>${sentence(`${blank} ${w}`)}`,
        say: "a أم an؟",
        options: ["a", "an"].map((x) => wordOpt(x, x === ans)),
        praise: `${ans} ${w}. ${ans === "an" ? "an قبل الكلمة التي تبدأ بحرف علة" : "a قبل الكلمة التي تبدأ بحرف ساكن"}`
      };
    }
    if (v === "is") {
      const many = Math.random() < 0.5;
      const [adj] = randomOf(ADJ);
      const ans = many ? "are" : "is";
      const noun = many ? plural(w) : w;
      return {
        kind: "choice", key: "gr:is", target: ans, cols: 2,
        promptHtml: `<div class="q">is أم are؟</div><div class="pic small-pic">${many ? e + e + e : e}</div>${sentence(`The ${noun} ${blank} ${adj}`)}`,
        say: "is أم are؟",
        options: ["is", "are"].map((x) => wordOpt(x, x === ans)),
        praise: `The ${noun} ${ans} ${adj}. ${many ? "are للجمع" : "is للمفرد"}`
      };
    }
    if (v === "pl") {
      const n = 2 + Math.floor(Math.random() * 4);
      const nums = ["", "", "two", "three", "four", "five"];
      const ans = plural(w);
      return {
        kind: "choice", key: "gr:pl", target: ans, cols: 2,
        promptHtml: `<div class="q">اختر الكلمة الصحيحة</div><div class="pic small-pic">${e.repeat(n)}</div>${sentence(`${nums[n]} ${blank}`)}`,
        say: "اختر الكلمة الصحيحة",
        options: shuffle([w, ans]).map((x) => wordOpt(x, x === ans)),
        praise: `${nums[n]} ${ans}`
      };
    }
    const many = Math.random() < 0.5;
    const ans = many ? "These" : "This";
    return {
      kind: "choice", key: "gr:this", target: ans, cols: 2,
      promptHtml: `<div class="q">This أم These؟</div><div class="pic small-pic">${many ? e + e : e}</div>${sentence(`${blank} ${many ? "are" : "is"} ${many ? plural(w) : (/^[aeiou]/.test(w) ? "an " : "a ") + w}`)}`,
      say: "This أم These؟",
      options: ["This", "These"].map((x) => wordOpt(x, x === ans)),
      praise: `${many ? "These للجمع" : "This للمفرد"}`
    };
  };

  // أسماء الأعداد: من الرقم إلى الكلمة وبالعكس
  PH.numWords = () => {
    const pool = NUMBERS_20.slice(0, older() ? 20 : 12);
    const [t] = store.pickWeighted(pool, (x) => "nw:" + x.n);
    const others = pick(pool.filter((x) => x !== t), optionCount() - 1);
    const v = variant({ toWord: 3, toNum: 2, hear: 2 });
    if (v === "toWord") {
      return {
        kind: "choice", key: "nw:" + t.n, target: String(t.n),
        promptHtml: `<div class="q">كيف يُكتب هذا الرقم بالإنجليزية؟</div><div class="big latin-num">${t.d}</div>`,
        say: "كيف يكتب هذا الرقم بالإنجليزية؟",
        options: shuffle([t, ...others]).map((x) => ({ id: String(x.n), html: x.name, right: x === t, word: true })),
        praise: t.name
      };
    }
    return {
      kind: "choice", key: "nw:" + t.n, target: String(t.n),
      promptHtml: v === "hear" ? `<div class="q">اسمع واختر الرقم</div><div class="ear">👂</div>` : `<div class="q">ما هذا الرقم؟</div>${wordBox(t.name)}`,
      say: v === "hear" ? `${t.name}... ${t.name}` : null,
      options: shuffle([t, ...others]).map((x) => ({ id: String(x.n), html: x.d, right: x === t, num: true })),
      praise: t.name
    };
  };

  GEN.spell = (level) => (PH[level.mode] || PH.cvc)(level);
}
