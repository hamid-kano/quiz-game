// ============================================================
//  مولّدات التمارين
//  كل مستوى له عدة أنواع من الأسئلة تتناوب عشوائياً حسب العمر،
//  وكل نوع يختار العنصر الأضعف أولاً عبر التكرار الذكي (store.pickWeighted)
// ============================================================
import {
  LETTERS, SIMILAR_GROUPS, WORDS_SHORT, WORDS_LONG, ALL_WORDS, LETTER_WORDS, HARAKAT,
  NUMBERS, COUNT_EMOJIS, SENTENCES, STORIES, OPPOSITES, CATEGORIES, RIDDLES
} from "./data.js";
import { store } from "./store.js";
import { hasArabicVoice } from "./sfx.js";
import { shuffle, pick, randomOf, esc, letterForms, toArabicDigits } from "./util.js";

const byLetter = Object.fromEntries(LETTERS.map((L) => [L.l, L]));
const big = () => store.active.age === "big";
const optionCount = () => (big() ? 4 : 3);
const canHear = () => store.settings.speech && hasArabicVoice();

// اختيار نوع السؤال حسب أوزان مختلفة للصغار والكبار
function variant(table) {
  const list = Object.entries(table).map(([k, w]) => [k, Array.isArray(w) ? w[big() ? 1 : 0] : w]).filter(([, w]) => w > 0);
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of list) { if ((r -= w) <= 0) return k; }
  return list[0][0];
}

// مشتّتات الحروف: نضيف أحياناً حرفاً مشابهاً لأن الخلط بينها هو الأصعب
function letterChoices(target, pool = LETTERS, n = optionCount()) {
  const group = SIMILAR_GROUPS.find((g) => g.includes(target.l)) || [];
  const similar = pool.filter((x) => x !== target && group.includes(x.l));
  const others = pool.filter((x) => x !== target && !group.includes(x.l));
  const distract = [...pick(similar, Math.random() < 0.6 ? 1 : 0), ...pick(others, n)].slice(0, n - 1);
  return shuffle([target, ...distract]);
}

// يختار n عناصر بصور مختلفة عن بعضها وعن صورة الهدف
function distinctPics(pool, target, n) {
  const seen = new Set([target.emoji]);
  const out = [];
  for (const w of shuffle(pool)) {
    if (seen.has(w.emoji) || w.w === target.w) continue;
    seen.add(w.emoji);
    out.push(w);
    if (out.length >= n) break;
  }
  return out;
}

const letterOpt = (L, target) => ({ id: L.l, html: L.l, right: L === target });
const picOpt = (w, right) => ({ id: w.w, html: w.emoji, right, emoji: true });
const textOpt = (id, html, right) => ({ id, html, right, text: true });

// صورة لكلمة تبدأ بالحرف (تتنوع في كل مرة)
const wordFor = (L) => randomOf(LETTER_WORDS[L.l]);

// صور لكلمات تبدأ بحروف أخرى، بدون تكرار الصورة
function otherPics(exceptLetters, n, exceptEmojis = []) {
  const used = new Set(exceptEmojis);
  const out = [];
  for (const L of shuffle(LETTERS.filter((x) => !exceptLetters.includes(x.l)))) {
    const w = wordFor(L);
    if (used.has(w.emoji)) continue;
    used.add(w.emoji);
    out.push(w);
    if (out.length >= n) break;
  }
  return out;
}

// عدد النقاط ومكانها لكل حرف (للتمييز بين الحروف المتشابهة)
const DOTS = { ب: [1, "تحت"], ت: [2, "فوق"], ث: [3, "فوق"], ن: [1, "فوق"], ي: [2, "تحت"], ج: [1, "تحت"], ح: [0], خ: [1, "فوق"], د: [0], ذ: [1, "فوق"], ر: [0], ز: [1, "فوق"], س: [0], ش: [3, "فوق"], ص: [0], ض: [1, "فوق"], ط: [0], ظ: [1, "فوق"], ع: [0], غ: [1, "فوق"], ف: [1, "فوق"], ق: [2, "فوق"] };
const AR_NUM = ["٠", "١", "٢", "٣"];

// سؤال "أي واحد مختلف؟"
function oddOneOut(same, odd, { q, say, key, render = (x) => x, emoji = false }) {
  const n = optionCount();
  const items = shuffle([...Array(n - 1).fill(same), odd]);
  return {
    kind: "choice", key, target: null,
    promptHtml: `<div class="q">${q}</div><div class="ooo-icon">🔎</div>`,
    say,
    options: items.map((x, i) => ({ id: "o" + i, html: render(x), right: x === odd, emoji })),
    praise: "أحسنت! وجدته"
  };
}

// ------------------------------------------------------------
export const GEN = {
  // ---------------- الحروف ----------------
  letters(level) {
    const pool = LETTERS.slice(...(level.range || [0, LETTERS.length]));
    const v = variant({ pick: [3, 2], toPic: [2, 2], odd: [2, 1], name: [0, 2] });
    const [target] = store.pickWeighted(pool, (L) => "rec:" + L.l);

    if (v === "toPic") {
      const w = wordFor(target);
      return {
        kind: "choice", key: "snd:" + target.l, target: target.l,
        promptHtml: `<div class="q">أي صورة تبدأ بحرف <b>${target.name}</b>؟</div><div class="big">${target.l}</div>`,
        say: `أي صورة تبدأ بحرف ${target.name}؟`,
        options: shuffle([picOpt(w, true), ...otherPics([target.l], optionCount() - 1, [w.emoji]).map((x) => picOpt(x, false))]),
        praise: `${w.w} تبدأ بحرف ${target.name}`
      };
    }
    if (v === "odd") {
      const group = SIMILAR_GROUPS.find((g) => g.includes(target.l));
      const oddL = group ? byLetter[randomOf(group.filter((x) => x !== target.l))] : randomOf(pool.filter((x) => x !== target));
      return { ...oddOneOut(target.l, oddL.l, { q: "أي حرف مختلف عن الباقي؟", say: "أي حرف مختلف عن الباقي؟", key: "rec:" + oddL.l }), letterFont: true };
    }
    if (v === "name") {
      const opts = letterChoices(target, LETTERS, 3);
      return {
        kind: "choice", key: "rec:" + target.l, target: target.l, cols: 3,
        promptHtml: `<div class="q">ما اسم هذا الحرف؟</div><div class="big">${target.l}</div>`,
        say: "ما اسم هذا الحرف؟",
        options: opts.map((L) => textOpt(L.l, L.name, L === target)),
        praise: `صحيح! حرف ${target.name}`
      };
    }
    return {
      kind: "choice", key: "rec:" + target.l, target: target.l,
      promptHtml: `<div class="q">أين حرف <b>${target.name}</b>؟</div><div class="pic">${wordFor(target).emoji}</div>`,
      say: `أين حرف ${target.name}؟`,
      options: letterChoices(target, pool).map((L) => letterOpt(L, target)),
      praise: `أحسنت! ${target.name}`
    };
  },

  // ---------------- الحروف المتشابهة ----------------
  similar() {
    const v = variant({ pick: [3, 2], count: [2, 2], place: [1, 2], odd: [1, 1] });
    const groupLetters = SIMILAR_GROUPS.flat().map((l) => byLetter[l]);

    if (v === "count") {
      const [t] = store.pickWeighted(groupLetters, (L) => "dot:" + L.l);
      const n = DOTS[t.l][0];
      return {
        kind: "choice", key: "dot:" + t.l, target: String(n),
        promptHtml: `<div class="q">كم نقطة في حرف <b>${t.name}</b>؟</div><div class="big">${t.l}</div>`,
        say: `كم نقطة في حرف ${t.name}؟`,
        options: [0, 1, 2, 3].map((k) => ({ id: String(k), html: AR_NUM[k], right: k === n, num: true })),
        praise: `صحيح! ${n === 0 ? "لا نقاط فيه" : n === 1 ? "نقطة واحدة" : n === 2 ? "نقطتان" : "ثلاث نقاط"}`
      };
    }
    if (v === "place") {
      const [t] = store.pickWeighted(groupLetters, (L) => "dot:" + L.l);
      const [n, where] = DOTS[t.l];
      const ans = n === 0 ? "none" : where === "فوق" ? "up" : "down";
      return {
        kind: "choice", key: "dot:" + t.l, target: ans, cols: 3,
        promptHtml: `<div class="q">أين نقاط حرف <b>${t.name}</b>؟</div><div class="big">${t.l}</div>`,
        say: `أين نقاط حرف ${t.name}؟`,
        options: [textOpt("up", "⬆️ فوق", ans === "up"), textOpt("down", "⬇️ تحت", ans === "down"), textOpt("none", "⭕ بلا نقاط", ans === "none")],
        praise: "أحسنت!"
      };
    }
    const [target] = store.pickWeighted(groupLetters, (L) => "rec:" + L.l);
    const group = SIMILAR_GROUPS.find((g) => g.includes(target.l)).map((l) => byLetter[l]);
    if (v === "odd") {
      const oddL = randomOf(group.filter((x) => x !== target));
      return { ...oddOneOut(target.l, oddL.l, { q: "انتبه للنقاط! أي حرف مختلف؟", say: "أي حرف مختلف؟", key: "rec:" + oddL.l }), letterFont: true };
    }
    const opts = shuffle([target, ...pick(group.filter((x) => x !== target), optionCount() - 1)]);
    return {
      kind: "choice", key: "rec:" + target.l, target: target.l,
      promptHtml: `<div class="q">انتبه للنقاط! أين حرف <b>${target.name}</b>؟</div><div class="pic">${wordFor(target).emoji}</div>`,
      say: `أين حرف ${target.name}؟`,
      options: opts.map((L) => letterOpt(L, target)),
      praise: `ممتاز! ${target.name}`
    };
  },

  // ---------------- أول حرف وآخر حرف ----------------
  first() {
    const v = variant({ first: [3, 2], toPic: [2, 2], last: [0, 2] });
    if (v === "last") {
      const items = ALL_WORDS.filter((w) => byLetter[w.w.at(-1)]);
      const [w] = store.pickWeighted(items, (x) => "end:" + x.w);
      const t = byLetter[w.w.at(-1)];
      return {
        kind: "choice", key: "end:" + w.w, target: t.l,
        promptHtml: `<div class="q">بأي حرف تنتهي هذه الكلمة؟</div><div class="pic">${w.emoji}</div><div class="hint-word">${w.w}</div>`,
        say: w.w,
        options: letterChoices(t).map((L) => letterOpt(L, t)),
        praise: `${w.w} تنتهي بحرف ${t.name}`
      };
    }
    const [target] = store.pickWeighted(LETTERS, (L) => "snd:" + L.l);
    const w = wordFor(target);
    if (v === "toPic") {
      return {
        kind: "choice", key: "snd:" + target.l, target: target.l,
        promptHtml: `<div class="q">أي صورة تبدأ بحرف <b>${target.name}</b>؟</div><div class="big">${target.l}</div>`,
        say: `أي صورة تبدأ بحرف ${target.name}؟`,
        options: shuffle([picOpt(w, true), ...otherPics([target.l], optionCount() - 1, [w.emoji]).map((x) => picOpt(x, false))]),
        praise: `${w.w} تبدأ بحرف ${target.name}`
      };
    }
    return {
      kind: "choice", key: "snd:" + target.l, target: target.l,
      promptHtml: `<div class="q">بأي حرف تبدأ هذه الكلمة؟</div><div class="pic">${w.emoji}</div><div class="hint-word">${w.w}</div>`,
      say: w.w,
      options: letterChoices(target).map((L) => letterOpt(L, target)),
      praise: `${w.w} تبدأ بحرف ${target.name}`
    };
  },

  // ---------------- الأرقام ----------------
  numbers() {
    const max = big() ? 10 : 5;
    const pool = NUMBERS.slice(0, max);
    const v = variant({ count: [3, 2], find: [2, 1], compare: [2, 1], add: [0, 3], name: [0, 2], sub: [0, 1] });
    const e = randomOf(COUNT_EMOJIS);
    const group = (k, size = "") => `<span class="group ${size}">${Array(k).fill(`<i>${e}</i>`).join("")}</span>`;

    if (v === "find") {
      const [t] = store.pickWeighted(pool, (n) => "n:" + n.n);
      const others = pick(pool.filter((x) => x !== t), 2);
      return {
        kind: "choice", key: "n:" + t.n, target: String(t.n), cols: 3,
        promptHtml: `<div class="q">أين المجموعة التي فيها</div><div class="big latin-num">${t.d}</div>`,
        say: `أين ${t.name}؟`,
        options: shuffle([t, ...others]).map((n) => ({ id: String(n.n), html: group(n.n, "mini"), right: n === t, emoji: true })),
        praise: `${t.name}! أحسنت`
      };
    }
    if (v === "compare") {
      const [a, b] = pick(pool, 2);
      const more = a.n > b.n ? a : b;
      const askMore = Math.random() < 0.6;
      const ans = askMore ? more : (more === a ? b : a);
      return {
        kind: "choice", key: "cmp:" + (askMore ? "more" : "less"), target: String(ans.n),
        promptHtml: `<div class="q">أين المجموعة ${askMore ? "الأكبر" : "الأصغر"}؟</div><div class="ooo-icon">${askMore ? "🐘" : "🐭"}</div>`,
        say: `أين المجموعة ${askMore ? "الأكبر" : "الأصغر"}؟`,
        options: [a, b].map((n) => ({ id: String(n.n), html: group(n.n, "mini"), right: n === ans, emoji: true })),
        praise: "صحيح!"
      };
    }
    if (v === "add" || v === "sub") {
      // جمع: النتيجة حتى 10 · طرح: من 2 إلى 6 ننقص منها 1 أو أكثر
      const x = v === "add" ? 1 + Math.floor(Math.random() * 5) : 2 + Math.floor(Math.random() * 5);
      const y = v === "add" ? 1 + Math.floor(Math.random() * Math.min(5, 10 - x)) : 1 + Math.floor(Math.random() * (x - 1));
      const res = v === "add" ? x + y : x - y;
      const choices = shuffle([...new Set([res, res + 1, Math.max(0, res - 1), res + 2])]).slice(0, 4);
      if (!choices.includes(res)) choices[0] = res;
      const d = (k) => toArabicDigits(k);
      return {
        kind: "choice", key: `${v}:${x}${v === "add" ? "+" : "-"}${y}`, target: String(res),
        promptHtml: v === "add"
          ? `<div class="q">كم المجموع؟</div><div class="sum">${group(x, "mini")}<b>+</b>${group(y, "mini")}</div>`
          : `<div class="q">كان عندي ${NUMBERS[x - 1].name} وأكلت ${y === 1 ? "واحدة" : NUMBERS[y - 1].name}. كم بقي؟</div><div class="sum">${group(x, "mini")}</div>`,
        say: v === "add" ? "كم المجموع؟" : `كان عندي ${NUMBERS[x - 1].name}، وأكلت ${y === 1 ? "واحدة" : NUMBERS[y - 1].name}. كم بقي؟`,
        options: shuffle(choices).map((k) => ({ id: String(k), html: d(k), right: k === res, num: true })),
        praise: `${res === 0 ? "صفر" : NUMBERS[res - 1].name}! أحسنت`
      };
    }
    const [t] = store.pickWeighted(pool, (n) => "n:" + n.n);
    if (v === "name") {
      return {
        kind: "choice", key: "nn:" + t.n, target: String(t.n), cols: 3,
        promptHtml: `<div class="q">ما اسم هذا الرقم؟</div><div class="big latin-num">${t.d}</div>`,
        say: "ما اسم هذا الرقم؟",
        options: shuffle([t, ...pick(pool.filter((x) => x !== t), 2)]).map((n) => textOpt(String(n.n), n.name, n === t)),
        praise: t.name
      };
    }
    const others = pick(pool.filter((x) => x !== t), optionCount() - 1);
    return {
      kind: "choice", key: "n:" + t.n, target: String(t.n),
      promptHtml: `<div class="q">عُدّ، كم عددها؟</div><div class="count-box">${Array(t.n).fill(`<span>${e}</span>`).join("")}</div>`,
      say: "كم عددها؟",
      options: shuffle([t, ...others]).map((n) => ({ id: String(n.n), html: `${n.d}<small>${n.n}</small>`, right: n === t, num: true })),
      praise: `${t.name}! أحسنت`
    };
  },

  // ---------------- الحركات والمدود ----------------
  harakat() {
    const v = variant({ pick: 2, name: 2, madd: 2 });
    const L = randomOf(LETTERS.filter((x) => !["أ", "و", "ي"].includes(x.l)));

    if (v === "madd") {
      const MADD = [
        { id: "a", s: L.l + "َا", name: "بالألف" },
        { id: "u", s: L.l + "ُو", name: "بالواو" },
        { id: "i", s: L.l + "ِي", name: "بالياء" }
      ];
      const [t] = store.pickWeighted(MADD, (m) => "madd:" + m.id);
      return {
        kind: "choice", key: "madd:" + t.id, target: t.id, cols: 3,
        promptHtml: `<div class="q">اختر حرف <b>${L.name}</b> ممدوداً <b>${t.name}</b></div>`,
        say: t.s,
        options: shuffle(MADD).map((m) => ({ id: m.id, html: m.s, right: m === t })),
        praise: t.s
      };
    }
    const [target] = store.pickWeighted(HARAKAT, (h) => "hk:" + h.id);
    if (v === "name") {
      return {
        kind: "choice", key: "hk:" + target.id, target: target.id, cols: 3,
        promptHtml: `<div class="q">ما الحركة على هذا الحرف؟</div><div class="big">${L.l + target.mark}</div>`,
        say: L.l + target.mark,
        options: shuffle(HARAKAT).map((h) => textOpt(h.id, h.name, h === target)),
        praise: target.name
      };
    }
    return {
      kind: "choice", key: "hk:" + target.id, target: target.id, cols: 3,
      promptHtml: `<div class="q">اختر حرف <b>${L.name}</b> مع <b>${target.name}</b></div>`,
      say: L.l + target.mark,
      options: shuffle(HARAKAT).map((h) => ({ id: h.id, html: L.l + h.mark, right: h === target }))
    };
  },

  // ---------------- أشكال الحرف ----------------
  forms() {
    const pool = LETTERS.filter((L) => L.c);
    const [target] = store.pickWeighted(pool, (L) => "frm:" + L.l);
    const forms = letterForms(target).slice(1);
    const [label, shape] = randomOf(forms);
    if (variant({ toLetter: 2, toForm: 2 }) === "toForm") {
      return {
        kind: "choice", key: "frm:" + target.l, target: label, cols: 3,
        promptHtml: `<div class="q">كيف يُكتب حرف <b>${target.name}</b> في <b>${label}</b> الكلمة؟</div>`,
        say: `كيف يكتب حرف ${target.name} في ${label} الكلمة؟`,
        options: shuffle(forms).map(([lb, sh]) => ({ id: lb, html: sh, right: lb === label })),
        praise: "أحسنت!"
      };
    }
    return {
      kind: "choice", key: "frm:" + target.l, target: target.l,
      promptHtml: `<div class="q">هذا الحرف في <b>${label}</b> الكلمة، ما هو؟</div><div class="big">${shape}</div>`,
      say: "ما هذا الحرف؟",
      options: letterChoices(target).map((L) => letterOpt(L, target)),
      praise: `أحسنت! حرف ${target.name}`
    };
  },

  // ---------------- مكان الحرف ----------------
  position() {
    const v = variant({ where: 3, starts: 2, ends: 1 });
    if (v === "starts" || v === "ends") {
      const [L] = store.pickWeighted(LETTERS.filter((x) => x.l !== "أ"), (x) => `${v}:${x.l}`);
      const at = (w) => (v === "starts" ? w.w[0] : w.w.at(-1));
      const good = ALL_WORDS.filter((w) => at(w) === L.l);
      if (!good.length) return GEN.position();
      const right = randomOf(good);
      const wrong = pick(ALL_WORDS.filter((w) => at(w) !== L.l && !w.w.includes(L.l)), optionCount() - 1);
      return {
        kind: "choice", key: `${v}:${L.l}`, target: right.w,
        promptHtml: `<div class="q">أي كلمة ${v === "starts" ? "تبدأ" : "تنتهي"} بحرف <b>${L.name}</b>؟</div><div class="big">${L.l}</div>`,
        say: `أي كلمة ${v === "starts" ? "تبدأ" : "تنتهي"} بحرف ${L.name}؟`,
        options: shuffle([right, ...wrong]).map((w) => ({ id: w.w, html: w.w, right: w === right, word: true })),
        praise: right.w
      };
    }
    const items = [];
    for (const w of ALL_WORDS) {
      const chars = [...w.w];
      chars.forEach((ch, i) => {
        if (!byLetter[ch] || chars.filter((c) => c === ch).length !== 1) return;
        items.push({ w, ch, pos: i === 0 ? "first" : i === chars.length - 1 ? "last" : "mid" });
      });
    }
    const [t] = store.pickWeighted(items, (x) => `pos:${x.w.w}:${x.ch}`);
    const names = { first: "أول الكلمة", mid: "وسط الكلمة", last: "آخر الكلمة" };
    const L = byLetter[t.ch];
    return {
      kind: "choice", key: `pos:${t.w.w}:${t.ch}`, target: t.pos, cols: 3,
      promptHtml: `<div class="q">أين حرف <b>${L.name}</b> في كلمة:</div><div class="pic small-pic">${t.w.emoji}</div><div class="big">${t.w.w}</div>`,
      say: `أين حرف ${L.name} في كلمة ${t.w.w}؟`,
      options: ["first", "mid", "last"].map((p) => textOpt(p, names[p], p === t.pos))
    };
  },

  // ---------------- تركيب الكلمة ----------------
  build(level) {
    const pool = level?.words === "long" ? WORDS_LONG : WORDS_SHORT;
    const [target] = store.pickWeighted(pool, (w) => "w:" + w.w);
    if (variant({ tiles: 3, missing: 2 }) === "missing") {
      const chars = [...target.w];
      const idxs = chars.map((c, i) => (byLetter[c] ? i : -1)).filter((i) => i >= 0);
      const k = randomOf(idxs);
      const t = byLetter[chars[k]];
      return {
        kind: "choice", key: "miss:" + target.w, target: t.l,
        promptHtml: `<div class="q">ما الحرف الناقص؟</div><div class="pic small-pic">${target.emoji}</div>
          <div class="slots">${chars.map((c, i) => `<div class="slot ${i === k ? "gap" : "filled"}">${i === k ? "؟" : c}</div>`).join("")}</div>`,
        say: target.w,
        options: letterChoices(t).map((L) => letterOpt(L, t)),
        praise: `أحسنت! ${target.w}`
      };
    }
    return { kind: "build", key: "w:" + target.w, word: target };
  },

  // ---------------- القراءة ----------------
  read() {
    const [target] = store.pickWeighted(ALL_WORDS, (w) => "w:" + w.w);
    const others = distinctPics(ALL_WORDS, target, optionCount() - 1);
    if (variant({ toPic: 2, toWord: 2 }) === "toWord") {
      return {
        kind: "choice", key: "w:" + target.w, target: target.w,
        promptHtml: `<div class="q">ما اسم هذه الصورة؟ اقرأ واختر</div><div class="pic">${target.emoji}</div>`,
        say: null,
        options: shuffle([target, ...others]).map((w) => ({ id: w.w, html: w.w, right: w === target, word: true })),
        praise: target.w
      };
    }
    return {
      kind: "choice", key: "w:" + target.w, target: target.w,
      promptHtml: `<div class="q">اقرأ الكلمة واختر صورتها</div><div class="big">${target.w}</div>`,
      say: null,
      options: shuffle([target, ...others]).map((w) => picOpt(w, w === target)),
      praise: target.w
    };
  },

  // ---------------- الجمل ----------------
  sentences() {
    const [target] = store.pickWeighted(SENTENCES, (s) => "s:" + s.s);
    const others = pick(SENTENCES.filter((x) => x !== target), 3);
    const v = variant({ toPic: 2, toSentence: 2, complete: 2 });
    if (v === "toSentence") {
      const opts = shuffle([target, ...others.slice(0, 2)]);
      return {
        kind: "choice", key: "s:" + target.s, target: target.s,
        promptHtml: `<div class="q">أي جملة تناسب الصورة؟</div><div class="pic">${target.pic}</div>`,
        say: null,
        options: opts.map((s) => ({ id: s.s, html: s.s, right: s === target, sentence: true })),
        wide: true,
        praise: target.s
      };
    }
    if (v === "complete") {
      const words = target.s.split(" ");
      const last = words.pop();
      const pool = [...new Set(SENTENCES.map((s) => s.s.split(" ").at(-1)))].filter((w) => w !== last);
      return {
        kind: "choice", key: "s:" + target.s, target: last, cols: 3,
        promptHtml: `<div class="q">أكمل الجملة</div><div class="pic small-pic">${target.pic}</div><div class="sentence">${words.join(" ")} <span class="blank">؟</span></div>`,
        say: null,
        options: shuffle([last, ...pick(pool, 2)]).map((w) => ({ id: w, html: w, right: w === last, word: true })),
        praise: target.s
      };
    }
    return {
      kind: "choice", key: "s:" + target.s, target: target.s,
      promptHtml: `<div class="q">اقرأ الجملة واختر الصورة المناسبة</div><div class="sentence">${target.s}</div>`,
      say: null,
      options: shuffle([target, ...others]).map((s) => ({ id: s.s, html: s.pic, right: s === target, emoji: true })),
      praise: target.s
    };
  },

  // ---------------- الاستماع ----------------
  listen() {
    if (variant({ word: 3, letter: 2 }) === "letter") {
      const [t] = store.pickWeighted(LETTERS, (L) => "rec:" + L.l);
      return {
        kind: "choice", key: "rec:" + t.l, target: t.l,
        promptHtml: `<div class="q">اسمع واختر الحرف</div><div class="ear">👂</div>${canHear() ? "" : `<div class="hint-word">حرف ${t.name}</div>`}`,
        say: `حرف ${t.name}`,
        options: letterChoices(t).map((L) => letterOpt(L, t)),
        praise: `${t.name}! أحسنت`
      };
    }
    const pool = WORDS_SHORT.concat(WORDS_LONG.slice(0, 12));
    const [target] = store.pickWeighted(pool, (w) => "lis:" + w.w);
    const others = distinctPics(pool, target, optionCount() - 1);
    return {
      kind: "choice", key: "lis:" + target.w, target: target.w,
      promptHtml: `<div class="q">اسمع الكلمة واختر صورتها</div><div class="ear">👂</div>${canHear() ? "" : `<div class="big">${target.w}</div>`}`,
      say: target.w,
      options: shuffle([target, ...others]).map((w) => picOpt(w, w === target)),
      praise: target.w
    };
  },

  // ---------------- الأضداد ----------------
  opposites() {
    const [pair] = store.pickWeighted(OPPOSITES, (p) => "opp:" + p[0].w);
    const [a, b] = Math.random() < 0.5 ? pair : [pair[1], pair[0]];
    const others = pick(OPPOSITES.filter((p) => p !== pair).flat(), optionCount() - 1);
    if (big() && Math.random() < 0.5) {
      return {
        kind: "choice", key: "opp:" + pair[0].w, target: b.w,
        promptHtml: `<div class="q">ما عكس كلمة</div><div class="big">${a.w}</div><div class="pic small-pic">${a.e}</div>`,
        say: `ما عكس كلمة ${a.w}؟`,
        options: shuffle([b, ...others]).map((x) => ({ id: x.w, html: x.w, right: x === b, word: true })),
        praise: `${a.w} عكسها ${b.w}`
      };
    }
    return {
      kind: "choice", key: "opp:" + pair[0].w, target: b.w,
      promptHtml: `<div class="q">هذا <b>${a.w}</b>، أين العكس؟</div><div class="pic">${a.e}</div>`,
      say: `هذا ${a.w}، أين ${b.w}؟`,
      options: shuffle([b, ...others]).map((x) => ({ id: x.w, html: x.e, right: x === b, emoji: true })),
      praise: `${a.w} و${b.w}`
    };
  },

  // ---------------- التصنيف ----------------
  categories() {
    const cats = big() ? CATEGORIES : CATEGORIES.slice(0, 3);
    const [cat] = store.pickWeighted(cats, (c) => "cat:" + c.id);
    if (variant({ which: 3, odd: 2 }) === "odd") {
      const other = randomOf(cats.filter((c) => c !== cat));
      const same = pick(cat.items, optionCount() - 1);
      const odd = randomOf(other.items);
      return {
        kind: "choice", key: "cat:" + cat.id, target: null,
        promptHtml: `<div class="q">أيّ واحد ليس <b>${cat.name}</b>؟</div><div class="pic small-pic">${cat.icon}</div>`,
        say: `أي واحد ليس ${cat.name}؟`,
        options: shuffle([...same.map((e) => ({ e, r: false })), { e: odd, r: true }]).map((x, i) => ({ id: "c" + i, html: x.e, right: x.r, emoji: true })),
        praise: `صحيح! هذا ${other.name}`
      };
    }
    const item = randomOf(cat.items);
    return {
      kind: "choice", key: "cat:" + cat.id, target: cat.id,
      promptHtml: `<div class="q">إلى أي مجموعة ينتمي؟</div><div class="pic">${item}</div>`,
      say: "إلى أي مجموعة ينتمي؟",
      options: shuffle([cat, ...pick(cats.filter((c) => c !== cat), Math.min(cats.length - 1, optionCount() - 1))])
        .map((c) => ({ id: c.id, html: `${c.icon}<small>${c.name}</small>`, right: c === cat, num: true })),
      praise: `صحيح! ${cat.name}`
    };
  },

  // ---------------- من أنا؟ ----------------
  riddles() {
    const [r] = store.pickWeighted(RIDDLES, (x) => "rid:" + x.e);
    const others = pick(RIDDLES.filter((x) => x !== r), optionCount() - 1);
    return {
      kind: "choice", key: "rid:" + r.e, target: r.e,
      promptHtml: `<div class="ooo-icon">🕵️</div><div class="sentence riddle">${r.q}</div>`,
      say: r.q,
      options: shuffle([r, ...others]).map((x) => ({ id: x.e, html: x.e, right: x === r, emoji: true })),
      praise: "أحسنت! عرفت الجواب"
    };
  },

  // ---------------- صيد الحرف ----------------
  hunt() {
    const texts = [...SENTENCES.map((s) => s.s), ...STORIES.flatMap((st) => st.pages.map((p) => p.text))];
    const letters = LETTERS.filter((L) => L.l !== "أ");
    for (let tries = 0; tries < 30; tries++) {
      const [L] = store.pickWeighted(letters, (x) => "rec:" + x.l);
      const options = texts.filter((t) => {
        const ws = t.split(" ");
        const hits = ws.filter((w) => w.includes(L.l)).length;
        return hits >= 1 && hits < ws.length && ws.length >= 3;
      });
      if (options.length) return { kind: "hunt", key: "rec:" + L.l, letter: L, text: randomOf(options) };
    }
    return GEN.read();
  },

  // ---------------- رتّب القصة ----------------
  order() {
    const st = randomOf(STORIES);
    const n = big() ? 4 : 3;
    const start = Math.floor(Math.random() * (st.pages.length - n + 1));
    const pages = st.pages.slice(start, start + n);
    return { kind: "order", key: `ord:${st.id}:${start}`, story: st, pages };
  },

  // ---------------- الرسم ----------------
  trace() {
    if (!big() && Math.random() < 0.2) {
      const nums = NUMBERS.slice(0, 9).map((n) => ({ l: n.d, name: n.name, num: true }));
      const [t] = store.pickWeighted(nums, (x) => "trcn:" + x.l);
      return { kind: "trace", key: "trcn:" + t.l, letter: t };
    }
    const [target] = store.pickWeighted(LETTERS, (L) => "trc:" + L.l);
    return { kind: "trace", key: "trc:" + target.l, letter: target };
  },

  // ---------------- الذاكرة ----------------
  memory() {
    const pairsCount = big() ? 4 : 3;
    const v = variant({ pic: [3, 2], num: [2, 0], form: [0, 2], word: [0, 2] });
    if (v === "num") {
      const nums = pick(NUMBERS.slice(0, 6), pairsCount);
      const e = randomOf(COUNT_EMOJIS);
      return {
        kind: "memory", key: "mem:n", title: "طابق كل رقم مع عدده",
        pairs: nums.map((n) => ({
          a: { face: n.d, cls: "letter", say: n.name },
          b: { face: `<span class="mgroup">${Array(n.n).fill(e).join("")}</span>`, cls: "pic", say: n.name },
          done: n.name, rec: "n:" + n.n
        }))
      };
    }
    if (v === "form") {
      const letters = store.pickWeighted(LETTERS.filter((L) => L.c), (L) => "frm:" + L.l, pairsCount);
      return {
        kind: "memory", key: "mem:f", title: "طابق كل حرف مع شكله في وسط الكلمة",
        pairs: letters.map((L) => ({
          a: { face: L.l, cls: "letter", say: L.name },
          b: { face: "ـ" + L.l + "ـ", cls: "letter alt", say: L.name },
          done: `حرف ${L.name}`, rec: "frm:" + L.l
        }))
      };
    }
    if (v === "word") {
      const short = ALL_WORDS.filter((w) => w.w.length <= 4);
      const first = randomOf(short);
      const words = [first, ...distinctPics(short, first, pairsCount - 1)];
      return {
        kind: "memory", key: "mem:w", title: "طابق كل كلمة مع صورتها",
        pairs: words.map((w) => ({
          a: { face: w.w, cls: "word", say: w.w },
          b: { face: w.emoji, cls: "pic", say: w.w },
          done: w.w, rec: "w:" + w.w
        }))
      };
    }
    const letters = store.pickWeighted(LETTERS, (L) => "snd:" + L.l, pairsCount);
    return {
      kind: "memory", key: "mem:" + letters.map((L) => L.l).join(""), title: "طابق كل حرف مع صورة تبدأ به",
      pairs: letters.map((L) => {
        const w = wordFor(L);
        return {
          a: { face: L.l, cls: "letter", say: L.name },
          b: { face: w.emoji, cls: "pic", say: w.w },
          done: `${w.w} تبدأ بحرف ${L.name}`, rec: "snd:" + L.l
        };
      })
    };
  }
};

// مولّد لأسئلة مختلطة (للتحدي اليومي)
export const DAILY_TYPES = {
  small: ["letters", "similar", "first", "numbers", "listen", "opposites", "categories"],
  big: ["letters", "similar", "first", "harakat", "forms", "position", "read", "sentences", "riddles", "opposites", "numbers"]
};
