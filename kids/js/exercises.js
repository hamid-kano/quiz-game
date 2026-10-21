// ============================================================
//  مولّدات التمارين
//  كل مستوى له عدة أنواع من الأسئلة تتناوب عشوائياً حسب العمر،
//  وكل نوع يختار العنصر الأضعف أولاً عبر التكرار الذكي (store.pickWeighted)
// ============================================================
import {
  LETTERS, SIMILAR_GROUPS, WORDS_SHORT, WORDS_LONG, ALL_WORDS, LETTER_WORDS, HARAKAT,
  NUMBERS, COUNT_EMOJIS, SENTENCES, STORIES, OPPOSITES, CATEGORIES, RIDDLES,
  SPELL_WORDS, CLOSED_SYLLABLES, TANWEEN, SHAMS_LETTERS
} from "./data.js";
import { store } from "./store.js";
import { shuffle, pick, randomOf, esc, letterForms, toArabicDigits } from "./util.js";

const byLetter = Object.fromEntries(LETTERS.map((L) => [L.l, L]));
const big = () => store.active.age === "big";
const optionCount = () => (big() ? 4 : 3);

// شكل كل حرف داخل الكلمة حسب اتصاله بما قبله وما بعده
const joinsNext = (ch) => (byLetter[ch] ? byLetter[ch].c : !["ة", "ى", "ء", "ا", "إ", "آ"].includes(ch));
export function wordForms(w) {
  const chars = [...w];
  const T = "\u0640";
  return chars.map((ch, i) => {
    const prev = i > 0 && joinsNext(chars[i - 1]);
    const next = i < chars.length - 1 && joinsNext(ch);
    return (prev ? T : "") + ch + (next ? T : "");
  });
}
// مشتّتان: الحرف نفسه بشكل خاطئ، وحرف آخر
function formDistractors(w, parts) {
  const T = "\u0640";
  const out = [];
  const chars = [...w];
  const k = Math.floor(Math.random() * chars.length);
  const ch = chars[k];
  for (const f of shuffle([ch, ch + T, T + ch + T, T + ch])) {
    if (!parts.includes(f) && (byLetter[ch]?.c || !f.endsWith(T))) { out.push(f); break; }
  }
  const other = randomOf(LETTERS.filter((L) => !chars.includes(L.l)));
  out.push(other.c ? T + other.l + T : T + other.l);
  return out;
}

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

  // ---------------- الأصوات: أول صوت وآخر صوت ----------------
  // الطفل الذي لا يقرأ يعرف أول الكلمة من صوتها، لذلك ننطقها ببطء مرتين
  // ولا نكتبها للصغار حتى لا يطابق الحرف بالنظر بدل السمع
  first(level) {
    if (level?.mode === "last") {
      const items = ALL_WORDS.filter((w) => byLetter[w.w.at(-1)]);
      const [w] = store.pickWeighted(items, (x) => "end:" + x.w);
      const t = byLetter[w.w.at(-1)];
      return {
        kind: "choice", key: "end:" + w.w, target: t.l,
        promptHtml: `<div class="q">بأي حرف تنتهي هذه الكلمة؟</div><div class="pic">${w.emoji}</div><div class="hint-word">${w.w}</div>`,
        say: `${w.w}... ${w.w}`, slow: true,
        options: letterChoices(t).map((L) => letterOpt(L, t)),
        praise: `${w.w} تنتهي بحرف ${t.name}`
      };
    }
    const v = variant({ first: [3, 2], toPic: [2, 2] });
    const [target] = store.pickWeighted(LETTERS, (L) => "snd:" + L.l);
    const w = wordFor(target);
    if (v === "toPic") {
      return {
        kind: "choice", key: "snd:" + target.l, target: target.l,
        promptHtml: `<div class="q">أي صورة تبدأ بحرف <b>${target.name}</b>؟</div><div class="big">${target.l}</div>`,
        say: `أي صورة تبدأ بحرف ${target.name}؟`,
        options: shuffle([picOpt(w, true), ...otherPics([target.l], optionCount() - 1, [w.emoji]).map((x) => picOpt(x, false))]),
        sayOption: true,
        praise: `${w.w} تبدأ بحرف ${target.name}`
      };
    }
    return {
      kind: "choice", key: "snd:" + target.l, target: target.l,
      promptHtml: `<div class="q">اسمع: بأي حرف تبدأ هذه الكلمة؟</div><div class="pic">${w.emoji}</div>${big() ? `<div class="hint-word">${w.w}</div>` : ""}`,
      say: `${w.w}... ${w.w}`, slow: !big(),
      options: letterChoices(target).map((L) => letterOpt(L, target)),
      praise: `${w.w} تبدأ بحرف ${target.name}`
    };
  },

  // نفس الصوت: بالصور فقط، بلا حروف ولا كتابة (وعي صوتي خالص)
  sounds() {
    const pool = LETTERS.filter((L) => LETTER_WORDS[L.l].length >= 2);
    const [L] = store.pickWeighted(pool, (x) => "same:" + x.l);
    const [a, b] = pick(LETTER_WORDS[L.l].filter((w, i, arr) => arr.findIndex((y) => y.emoji === w.emoji) === i), 2);
    const others = otherPics([L.l], optionCount() - 1, [a.emoji, b.emoji]);
    return {
      kind: "choice", key: "same:" + L.l, target: b.w,
      promptHtml: `<div class="q">أي صورة تبدأ بنفس صوت هذه الكلمة؟</div><div class="pic">${a.emoji}</div>${big() ? `<div class="hint-word">${a.w}</div>` : ""}`,
      say: `${a.w}... ${a.w}`, slow: !big(),
      options: shuffle([picOpt(b, true), ...others.map((x) => picOpt(x, false))]),
      sayOption: true,
      praise: `${a.w} و${b.w}، تبدآن بحرف ${L.name}`
    };
  },

  // ---------------- الأرقام ----------------
  numbers(level) {
    const max = big() ? 10 : 5;
    const pool = NUMBERS.slice(0, max);
    const mode = level?.mode || "count";
    const v = mode === "compare" ? "compare"
      : mode === "math" ? variant({ add: 3, sub: 2 })
      : variant({ count: [3, 2], find: [2, 2], name: [0, 2] });
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

  // ---------------- تركيب الكلمة بالضغط على الحروف ----------------
  build(level) {
    const pool = level?.words === "long" ? WORDS_LONG : WORDS_SHORT;
    const [target] = store.pickWeighted(pool, (w) => "sp:" + w.w);
    const chars = [...target.w];
    const v = variant({ tiles: 3, missing: 2, forms: 2, given: 2 });
    if (v === "missing") {
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
    if (v === "forms") {
      // البطاقات بأشكال الحروف كما تُكتب داخل الكلمة (أول/وسط/آخر)
      const parts = wordForms(target.w);
      const extras = formDistractors(target.w, parts);
      return { kind: "build", key: "sp:" + target.w, word: target, parts, shown: chars, extras,
        title: "ركّب الكلمة بأشكال الحروف كما تُكتب" };
    }
    if (v === "given") {
      return { kind: "build", key: "sp:" + target.w, word: target, given: 1, title: "أكمل الكلمة: الحرف الأول جاهز" };
    }
    return { kind: "build", key: "sp:" + target.w, word: target };
  },

  // كلمتي الأولى: للصغار، حروف باهتة داخل الخانات ليطابق الطفل الشكل
  buildFirst() {
    const pool = WORDS_SHORT.filter((w) => [...w.w].length <= 3);
    const [target] = store.pickWeighted(pool, (w) => "sp:" + w.w);
    const extras = big() ? pick(LETTERS.map((x) => x.l).filter((l) => !target.w.includes(l)), 1) : [];
    return { kind: "build", key: "sp:" + target.w, word: target, ghost: true, extras, slow: !big(),
      title: "طابق الحروف وركّب الكلمة" };
  },

  // رتّب الحروف: كلمة مبعثرة بلا صورة ولا صوت، والصورة تلميح بعد خطأين
  anagram() {
    const pool = ALL_WORDS.filter((w) => [...w.w].length >= 3 && [...w.w].length <= 5 && new Set(w.w).size === [...w.w].length);
    const [target] = store.pickWeighted(pool, (w) => "ana:" + w.w);
    return { kind: "build", key: "ana:" + target.w, word: target, mystery: true, extras: [],
      title: "رتّب الحروف لتكوّن كلمة" };
  },

  // لوحة المفاتيح: اكتب الكلمة كاملة بنفسك
  keyboard(level) {
    const pool = ALL_WORDS.filter((w) => [...w.w].length <= (level?.mode === "dict" ? 4 : 5));
    const [target] = store.pickWeighted(pool, (w) => "kb:" + w.w);
    return level?.mode === "dict"
      ? { kind: "keyboard", key: "kb:" + target.w, word: target, hidePic: true, title: "اسمع الكلمة واكتبها بلوحة الحروف" }
      : { kind: "keyboard", key: "kb:" + target.w, word: target, title: "اكتب اسم الصورة بلوحة الحروف" };
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
        promptHtml: `<div class="q">اسمع واختر الحرف</div><div class="ear">👂</div>`,
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
      promptHtml: `<div class="q">اسمع الكلمة واختر صورتها</div><div class="ear">👂</div>`,
      say: `${target.w}... ${target.w}`, slow: !big(),
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
      const [L] = store.pickWeighted(letters, (x) => "hunt:" + x.l);
      const options = texts.filter((t) => {
        const ws = t.split(" ");
        const hits = ws.filter((w) => w.includes(L.l)).length;
        return hits >= 1 && hits < ws.length && ws.length >= 3;
      });
      if (options.length) return { kind: "hunt", key: "hunt:" + L.l, letter: L, text: randomOf(options) };
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

  // ---------------- الكتابة بالإصبع ----------------
  // mode: letters (فوق الخط) · numbers · memory (من الذاكرة) · free (اسمع واكتب بلا خط) · word (كلمة) · name (اسمك)
  trace(level) {
    const mode = level?.mode || "letters";
    if (mode === "numbers") {
      const nums = NUMBERS.slice(0, big() ? 9 : 5).map((n) => ({ l: n.d, name: n.name, num: true }));
      const [t] = store.pickWeighted(nums, (x) => "trcn:" + x.l);
      return { kind: "trace", key: "trcn:" + t.l, letter: t, guide: big() && Math.random() < 0.3 ? "memory" : "full" };
    }
    if (mode === "word") {
      const pool = ALL_WORDS.filter((w) => [...w.w].length >= 2 && [...w.w].length <= (big() ? 4 : 3));
      const [w] = store.pickWeighted(pool, (x) => "trw:" + x.w);
      const g = big() ? variant({ full: 3, memory: 1 }) : "full";
      return { kind: "trace", key: "trw:" + w.w, text: w.w, pic: w.emoji, guide: g,
        title: g === "memory" ? `انظر جيداً ثم اكتب كلمة <b>${w.w}</b> من ذاكرتك` : `اكتب كلمة <b>${w.w}</b> فوق الخط` };
    }
    if (mode === "name") {
      const raw = (store.active.name || "").trim().split(/\s+/)[0] || "";
      const ok = /^[\u0621-\u064A]{2,8}$/.test(raw);
      const text = ok ? raw : randomOf(WORDS_SHORT).w;
      return { kind: "trace", key: "trn:" + text, text, pic: ok ? store.active.avatar : "",
        title: ok ? `اكتب اسمك: <b>${text}</b>` : `اكتب كلمة <b>${text}</b> (أضف اسمك بالعربية من ملفك لتكتبه هنا)`,
        say: ok ? `اكتب اسمك، ${text}` : text };
    }
    const [target] = store.pickWeighted(LETTERS, (L) => "trc:" + L.l);
    if (mode === "memory") return { kind: "trace", key: "trm:" + target.l, letter: target, guide: "memory" };
    if (mode === "free") {
      return { kind: "trace", key: "trf:" + target.l, letter: target, guide: "none",
        title: `اسمع واكتب الحرف بنفسك`, say: `اكتب حرف ${target.name}` };
    }
    // فوق الخط: للكبار أحياناً بشكل الحرف داخل الكلمة
    if (big() && target.c && Math.random() < 0.35) {
      const [label, shape] = randomOf(letterForms(target).slice(1));
      return { kind: "trace", key: "trc:" + target.l, text: shape, letter: target,
        title: `ارسم حرف <b>${target.name}</b> في <b>${label}</b> الكلمة`, say: `حرف ${target.name} في ${label} الكلمة` };
    }
    return { kind: "trace", key: "trc:" + target.l, letter: target };
  },

  // ---------------- الذاكرة ----------------
  // الذاكرة: البطاقات تزداد مع كل جولة، ومن الجولة الثانية تُكشف كلها لحظات ليحفظ الطفل أماكنها
  memory(level, round = 0) {
    const sizes = big() ? [3, 4, 5, 6] : [2, 3, 3, 4];
    const pairsCount = sizes[Math.min(round, sizes.length - 1)];
    const preview = round >= 1 ? (big() ? 2200 : 3000) + pairsCount * 250 : 0;
    const q = GEN._memory(level, pairsCount);
    return { ...q, preview, key: q.key + ":" + round };
  },

  _memory(level, pairsCount) {
    const v = level?.mode || "pic";
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
      const kind = variant({ pic: 3, vowel: 2, opp: 2 });
      if (kind === "vowel") {
        // الكلمة بلا تشكيل ↔ نفسها مشكولة
        const strip = (x) => x.replace(/[\u064B-\u0652]/g, "");
        const pool = shuffle(SPELL_WORDS.filter((w) => w.type !== "shadda"));
        const seen = new Set();
        const words = pool.filter((w) => { const k = strip(w.w); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, pairsCount);
        return {
          kind: "memory", key: "mem:v", title: "طابق الكلمة مع نفسها مشكولة",
          pairs: words.map((w) => ({
            a: { face: strip(w.w), cls: "word", say: w.w },
            b: { face: w.w, cls: "word alt", say: w.w },
            done: w.w, rec: "rv:" + w.w
          }))
        };
      }
      if (kind === "opp") {
        const pairs = pick(OPPOSITES, Math.min(pairsCount, OPPOSITES.length));
        return {
          kind: "memory", key: "mem:o", title: "طابق كل كلمة مع ضدّها",
          pairs: pairs.map(([a, b]) => ({
            a: { face: `${a.w}<small>${a.e}</small>`, cls: "word", say: a.w },
            b: { face: `${b.w}<small>${b.e}</small>`, cls: "word alt", say: b.w },
            done: `${a.w} عكسها ${b.w}`, rec: "opp:" + a.w
          }))
        };
      }
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
  },

  // ---------------- التهجئة ----------------
  spell(level) {
    return SPELL_GEN[level.mode](level);
  }
};

// ============================================================
//  مولّدات قسم التهجئة
// ============================================================
const HK = Object.fromEntries(HARAKAT.map((h) => [h.id, h]));
const SUKUN = "\u0652";
const SHADDA = "\u0651";
// حروف للمقاطع (نستبعد حروف المدّ حتى لا تختلط الأمثلة)
const SYL_LETTERS = LETTERS.filter((L) => !["أ", "و", "ي"].includes(L.l));
const withH = (L, h) => (L.l === "أ" ? (h.id === "i" ? "إ" : "أ") : L.l) + h.mark;
const MADD = [
  { id: "a", name: "بالألف", after: "ا", h: "a" },
  { id: "u", name: "بالواو", after: "و", h: "u" },
  { id: "i", name: "بالياء", after: "ي", h: "i" }
];
const maddOf = (L, m) => L.l + HK[m.h].mark + m.after;
const sylOpt = (id, html, right) => ({ id, html, right });
const isShams = (ch) => SHAMS_LETTERS.includes(ch);
// يغيّر حركة مقطع ليصنع مقطعاً مشتّتاً قريباً منه
function altSyllable(sy) {
  const marks = ["\u064E", "\u064F", "\u0650"];
  const m = [...sy].find((c) => marks.includes(c));
  if (!m) return null;
  const other = randomOf(marks.filter((x) => x !== m));
  return sy.replace(m, other);
}
const wordsOf = (types) => SPELL_WORDS.filter((w) => !types || types.includes(w.type));

const SPELL_GEN = {
  // 1) الحركات القصيرة
  short() {
    const v = variant({ hear: [3, 2], byName: [2, 2], name: [0, 2] });
    const [h] = store.pickWeighted(HARAKAT, (x) => "hs:" + x.id);
    const L = randomOf(SYL_LETTERS);
    if (v === "name") {
      return {
        kind: "choice", key: "hs:" + h.id, target: h.id, cols: 3,
        promptHtml: `<div class="q">ما الحركة على هذا الحرف؟</div><div class="big">${withH(L, h)}</div>`,
        say: withH(L, h),
        options: shuffle(HARAKAT).map((x) => textOpt(x.id, x.name, x === h)),
        praise: `${h.name}: ${withH(L, h)}`
      };
    }
    return {
      kind: "choice", key: "hs:" + h.id, target: h.id, cols: 3,
      promptHtml: v === "hear"
        ? `<div class="q">اسمع واختر المقطع</div><div class="ear">👂</div>`
        : `<div class="q">اختر حرف <b>${L.name}</b> مع <b>${h.name}</b></div>`,
      say: v === "hear" ? withH(L, h) : `حرف ${L.name} مع ${h.name}`, slow: v === "hear",
      options: shuffle(HARAKAT).map((x) => sylOpt(x.id, withH(L, x), x === h)),
      praise: withH(L, h)
    };
  },

  // 2) المدود
  madd() {
    const v = variant({ shortLong: [3, 1], hear: [2, 2], byName: [1, 2] });
    const L = randomOf(SYL_LETTERS);
    const [m] = store.pickWeighted(MADD, (x) => "md:" + x.id);
    const long = maddOf(L, m);
    const short = withH(L, HK[m.h]);
    if (v === "shortLong") {
      const askLong = Math.random() < 0.6;
      const ans = askLong ? long : short;
      return {
        kind: "choice", key: "md:" + m.id, target: ans, cols: 2,
        promptHtml: `<div class="q">اسمع: هل الصوت قصير أم ممدود؟</div><div class="ear">👂</div>`,
        say: ans, slow: true,
        options: [sylOpt(short, `${short}<small>قصير</small>`, ans === short), sylOpt(long, `${long}<small>ممدود</small>`, ans === long)],
        praise: ans
      };
    }
    return {
      kind: "choice", key: "md:" + m.id, target: m.id, cols: 3,
      promptHtml: v === "hear"
        ? `<div class="q">اسمع واختر المقطع الممدود</div><div class="ear">👂</div>`
        : `<div class="q">اختر حرف <b>${L.name}</b> ممدوداً <b>${m.name}</b></div>`,
      say: v === "hear" ? long : `حرف ${L.name} ممدود ${m.name}`, slow: v === "hear",
      options: shuffle(MADD).map((x) => sylOpt(x.id, maddOf(L, x), x === m)),
      praise: long
    };
  },

  // 3) السكون
  sukun() {
    const v = variant({ mark: 2, hear: 3, closed: 2 });
    if (v === "mark") {
      const L = randomOf(SYL_LETTERS);
      const opts = [...HARAKAT.map((h) => sylOpt(h.id, withH(L, h), false)), sylOpt("s", L.l + SUKUN, true)];
      return {
        kind: "choice", key: "sk:mark", target: "s",
        promptHtml: `<div class="q">أين حرف <b>${L.name}</b> الساكن؟</div><div class="ooo-icon">⭕</div>`,
        say: `أين حرف ${L.name} الساكن؟`,
        options: shuffle(opts),
        praise: `${L.l + SUKUN}، ساكن`
      };
    }
    const [w] = store.pickWeighted(CLOSED_SYLLABLES, (x) => "sk:" + x);
    const variants = ["\u064E", "\u064F", "\u0650"].map((mk) => w.replace(/[\u064E\u064F\u0650]/, mk));
    const all = [...new Set(variants)];
    if (v === "closed") {
      // نفس الحروف، مرة بسكون ومرة بحركة على الحرف الأخير
      const open = w.replace(SUKUN, "\u064E");
      return {
        kind: "choice", key: "sk:" + w, target: w, cols: 2,
        promptHtml: `<div class="q">اسمع: أين الكلمة التي تنتهي بحرف ساكن؟</div><div class="ear">👂</div>`,
        say: w, slow: true,
        options: shuffle([sylOpt(w, w, true), sylOpt(open, open, false)]),
        praise: w
      };
    }
    return {
      kind: "choice", key: "sk:" + w, target: w, cols: 3,
      promptHtml: `<div class="q">اسمع واختر ما سمعت</div><div class="ear">👂</div>`,
      say: w, slow: true,
      options: shuffle(all).map((x) => sylOpt(x, x, x === w)),
      praise: w
    };
  },

  // 4) المقاطع
  syllables() {
    const v = variant({ count: 2, first: 2, last: 2 });
    const [w] = store.pickWeighted(wordsOf(["short", "sukun", "madd"]), (x) => "syl:" + x.w);
    if (v === "count") {
      const n = w.syl.length;
      return {
        kind: "choice", key: "syl:" + w.w, target: String(n),
        promptHtml: `<div class="q">كم مقطعاً في هذه الكلمة؟</div><div class="pic small-pic">${w.emoji}</div><div class="big">${w.w}</div>`,
        say: w.syl.join("، "), slow: true,
        options: [1, 2, 3, 4].map((k) => ({ id: String(k), html: toArabicDigits(k), right: k === n, num: true })),
        praise: `${w.syl.join("، ")}: ${w.w}`
      };
    }
    const k = v === "first" ? 0 : w.syl.length - 1;
    const right = w.syl[k];
    const pool = new Set([right]);
    const alt = altSyllable(right);
    if (alt) pool.add(alt);
    // المشتّتات: المقطع نفسه بحركة مختلفة + مقاطع من نفس الموضع في كلمات أخرى
    for (const x of shuffle(SPELL_WORDS)) {
      if (pool.size >= 3) break;
      const other = v === "first" ? x.syl[0] : x.syl.at(-1);
      if (other) pool.add(other);
    }
    return {
      kind: "choice", key: "syl:" + w.w, target: right, cols: 3,
      promptHtml: `<div class="q">ما المقطع ${v === "first" ? "الأول" : "الأخير"} في كلمة:</div><div class="pic small-pic">${w.emoji}</div><div class="big">${w.w}</div>`,
      say: w.w, slow: true,
      options: shuffle([...pool]).map((x) => sylOpt(x, x, x === right)),
      praise: right
    };
  },

  // 5) التنوين
  tanween() {
    const v = variant({ hear: 3, name: 2, vs: 2 });
    const [t] = store.pickWeighted(TANWEEN, (x) => "tn:" + x.id);
    const L = randomOf(SYL_LETTERS);
    if (v === "name") {
      return {
        kind: "choice", key: "tn:" + t.id, target: t.id, cols: 3,
        promptHtml: `<div class="q">ما نوع التنوين؟</div><div class="big">${L.l + t.mark}</div>`,
        say: L.l + t.mark,
        options: shuffle(TANWEEN).map((x) => textOpt(x.id, x.name, x === t)),
        praise: t.name
      };
    }
    if (v === "vs") {
      const h = HARAKAT[TANWEEN.indexOf(t)];
      const opts = [sylOpt("t", L.l + t.mark, true), sylOpt("h", L.l + h.mark, false), ...pick(TANWEEN.filter((x) => x !== t), 2).map((x) => sylOpt("o" + x.id, L.l + x.mark, false))];
      return {
        kind: "choice", key: "tn:" + t.id, target: "t",
        promptHtml: `<div class="q">اختر حرف <b>${L.name}</b> مع <b>${t.name}</b></div>`,
        say: `حرف ${L.name} مع ${t.name}`,
        options: shuffle(opts),
        praise: L.l + t.mark
      };
    }
    return {
      kind: "choice", key: "tn:" + t.id, target: t.id, cols: 3,
      promptHtml: `<div class="q">اسمع واختر</div><div class="ear">👂</div>`,
      say: L.l + t.mark, slow: true,
      options: shuffle(TANWEEN).map((x) => sylOpt(x.id, L.l + x.mark, x === t)),
      praise: `${t.name}: ${L.l + t.mark}`
    };
  },

  // 6) الشدّة
  shadda() {
    const v = variant({ mark: 2, word: 2, split: 3 });
    if (v === "mark") {
      const L = randomOf(SYL_LETTERS);
      const [h] = store.pickWeighted(HARAKAT, (x) => "sh:" + x.id);
      const opts = [
        sylOpt("r", L.l + SHADDA + h.mark, true),
        sylOpt("p", withH(L, h), false),
        ...HARAKAT.filter((x) => x !== h).map((x) => sylOpt("o" + x.id, L.l + SHADDA + x.mark, false))
      ];
      return {
        kind: "choice", key: "sh:" + h.id, target: "r",
        promptHtml: `<div class="q">اختر حرف <b>${L.name}</b> مع الشدّة و<b>${h.name}</b></div>`,
        say: `حرف ${L.name} مع الشدة و${h.name}`,
        options: shuffle(opts),
        praise: L.l + SHADDA + h.mark
      };
    }
    const sh = wordsOf(["shadda"]);
    const [w] = store.pickWeighted(sh, (x) => "sh:" + x.w);
    if (v === "word") {
      const others = pick(SPELL_WORDS.filter((x) => x.type !== "shadda"), optionCount() - 1);
      return {
        kind: "choice", key: "sh:" + w.w, target: w.w,
        promptHtml: `<div class="q">أي كلمة فيها شدّة؟</div><div class="ooo-icon">💪</div>`,
        say: "أي كلمة فيها شدة؟",
        options: shuffle([w, ...others]).map((x) => ({ id: x.w, html: x.w, right: x === w, word: true })),
        praise: w.w
      };
    }
    // تفكيك الشدّة إلى مقاطع
    const right = w.syl.join(" + ");
    const wrong1 = w.syl.map((x, i) => (i === 0 ? x.replace(SUKUN, "") : x)).join(" + ");
    const wrong2 = w.syl.filter((_, i) => i !== 1).join(" + ");
    return {
      kind: "choice", key: "sh:" + w.w, target: right, wide: true,
      promptHtml: `<div class="q">كيف نتهجّى هذه الكلمة؟</div><div class="pic small-pic">${w.emoji}</div><div class="big">${w.w}</div>`,
      say: w.w, slow: true,
      options: shuffle([...new Set([right, wrong1, wrong2])]).map((x) => ({ id: x, html: x, right: x === right, sentence: true })),
      praise: `${w.syl.join("، ")}: ${w.w}`
    };
  },

  // 7) ال الشمسية والقمرية
  lam() {
    const items = ALL_WORDS.filter((w) => byLetter[w.w[0]] && w.w[0] !== "ل");
    const [w] = store.pickWeighted(items, (x) => "lam:" + x.w);
    const shams = isShams(w.w[0]);
    const word = "ال" + w.w;
    if (variant({ classify: 3, pick: 2 }) === "pick") {
      const wantShams = Math.random() < 0.5;
      const right = shuffle(items.filter((x) => isShams(x.w[0]) === wantShams))[0];
      const wrong = pick(items.filter((x) => isShams(x.w[0]) !== wantShams), 2);
      return {
        kind: "choice", key: "lam:" + right.w, target: right.w, cols: 3,
        promptHtml: `<div class="q">اختر الكلمة التي لامها <b>${wantShams ? "شمسية ☀️" : "قمرية 🌙"}</b></div>`,
        say: `اختر الكلمة التي لامها ${wantShams ? "شمسية" : "قمرية"}`,
        options: shuffle([right, ...wrong]).map((x) => ({ id: x.w, html: "ال" + x.w, right: x === right, word: true })),
        praise: "ال" + right.w
      };
    }
    return {
      kind: "choice", key: "lam:" + w.w, target: shams ? "s" : "q", cols: 2,
      promptHtml: `<div class="q">هل اللام هنا شمسية أم قمرية؟</div><div class="pic small-pic">${w.emoji}</div><div class="big">${word}</div>`,
      say: word,
      options: [textOpt("s", "☀️ شمسية<br><small>لا نقرأ اللام</small>", shams), textOpt("q", "🌙 قمرية<br><small>نقرأ اللام</small>", !shams)],
      praise: shams ? `${word}، لام شمسية` : `${word}، لام قمرية`
    };
  },

  // 8) تهجّ الكلمة: تركيب الكلمة من مقاطعها
  build() {
    const [w] = store.pickWeighted(SPELL_WORDS, (x) => "tj:" + x.w);
    const extras = [];
    for (const sy of shuffle(w.syl)) {
      const a = altSyllable(sy);
      if (a && !w.syl.includes(a) && !extras.includes(a)) extras.push(a);
      if (extras.length >= 2) break;
    }
    return {
      kind: "build", key: "tj:" + w.w, word: { w: w.w, emoji: w.emoji },
      parts: w.syl, extras, sayParts: true, slow: true,
      title: "تهجَّ الكلمة: رتّب المقاطع",
      praise: `${w.syl.join("، ")}... ${w.w}`
    };
  },

  // 9) الإملاء: اسمع واكتب بالحروف، بلا صورة
  dictation() {
    const pool = ALL_WORDS.filter((w) => [...w.w].length <= 5);
    const [w] = store.pickWeighted(pool, (x) => "dict:" + x.w);
    return {
      kind: "build", key: "dict:" + w.w, word: w, hidePic: true, slow: true,
      title: "اسمع الكلمة واكتبها",
      praise: `أحسنت! ${w.w}`
    };
  },

  // قراءة الكلمة المشكولة (في قسم القراءة)
  readVowel() {
    const [w] = store.pickWeighted(SPELL_WORDS, (x) => "rv:" + x.w);
    const seen = new Set([w.emoji]);
    const others = shuffle(SPELL_WORDS).filter((x) => !seen.has(x.emoji) && seen.add(x.emoji)).slice(0, optionCount() - 1);
    return {
      kind: "choice", key: "rv:" + w.w, target: w.w,
      promptHtml: `<div class="q">اقرأ الكلمة واختر صورتها</div><div class="big">${w.w}</div>`,
      say: null,
      options: shuffle([w, ...others]).map((x) => ({ id: x.w, html: x.emoji, right: x === w, emoji: true })),
      praise: w.w
    };
  }
};
