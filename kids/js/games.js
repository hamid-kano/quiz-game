// ============================================================
//  الأنشطة: مولّدات الأسئلة + طريقة عرض كل نوع + مشغّل الجلسة
// ============================================================
import {
  LETTERS, SIMILAR_GROUPS, WORDS_SHORT, WORDS_LONG, ALL_WORDS, HARAKAT,
  NUMBERS, COUNT_EMOJIS, SENTENCES
} from "./data.js";
import { store } from "./store.js";
import { speak, stopSpeech, sfx, hasArabicVoice } from "./sfx.js";
import { shuffle, pick, randomOf, esc, render, $, $$, toast, letterForms } from "./util.js";

const byLetter = Object.fromEntries(LETTERS.map((L) => [L.l, L]));
const optionCount = () => (store.active.age === "small" ? 3 : 4);
const TATWEEL = "ـ";

// ------------------------------------------------------------
//  المولّدات: كل مولّد يعيد "سؤالاً" جاهزاً للعرض
// ------------------------------------------------------------
function letterChoices(target, pool, n = optionCount()) {
  // نفضّل أحياناً حرفاً مشابهاً كمشتّت لأن الخلط بينها هو الأصعب
  const group = SIMILAR_GROUPS.find((g) => g.includes(target.l)) || [];
  const similar = pool.filter((x) => x !== target && group.includes(x.l));
  const others = pool.filter((x) => x !== target && !group.includes(x.l));
  const distract = [...pick(similar, Math.random() < 0.6 ? 1 : 0), ...pick(others, n)].slice(0, n - 1);
  return shuffle([target, ...distract]);
}

export const GEN = {
  letters(level) {
    const pool = LETTERS.slice(...level.range);
    const [target] = store.pickWeighted(pool, (L) => "rec:" + L.l);
    return {
      kind: "choice",
      key: "rec:" + target.l,
      target: target.l,
      promptHtml: `<div class="q">أين حرف <b>${target.name}</b>؟</div><div class="pic">${target.emoji}</div>`,
      say: `أين حرف ${target.name}؟`,
      options: letterChoices(target, pool).map((L) => ({ id: L.l, html: L.l, right: L === target })),
      praise: `أحسنت! ${target.name}`
    };
  },

  similar() {
    const groupLetters = SIMILAR_GROUPS.flat().map((l) => byLetter[l]);
    const [target] = store.pickWeighted(groupLetters, (L) => "rec:" + L.l);
    const group = SIMILAR_GROUPS.find((g) => g.includes(target.l)).map((l) => byLetter[l]);
    const opts = shuffle([target, ...pick(group.filter((x) => x !== target), optionCount() - 1)]);
    return {
      kind: "choice",
      key: "rec:" + target.l,
      target: target.l,
      promptHtml: `<div class="q">انتبه للنقاط! أين حرف <b>${target.name}</b>؟</div><div class="pic">${target.emoji}</div>`,
      say: `أين حرف ${target.name}؟`,
      options: opts.map((L) => ({ id: L.l, html: L.l, right: L === target })),
      praise: `ممتاز! ${target.name}`
    };
  },

  first() {
    const [target] = store.pickWeighted(LETTERS, (L) => "snd:" + L.l);
    return {
      kind: "choice",
      key: "snd:" + target.l,
      target: target.l,
      promptHtml: `<div class="q">بأي حرف تبدأ هذه الكلمة؟</div><div class="pic">${target.emoji}</div><div class="hint-word">${target.word}</div>`,
      say: target.word,
      options: letterChoices(target, LETTERS).map((L) => ({ id: L.l, html: L.l, right: L === target })),
      praise: `${target.word} تبدأ بحرف ${target.name}`
    };
  },

  harakat() {
    const target = randomOf(store.pickWeighted(HARAKAT, (h) => "hk:" + h.id, 1));
    const L = randomOf(LETTERS);
    const make = (hk) => (L.l === "أ" ? (hk.id === "i" ? "إ" : "أ") + hk.mark : L.l + hk.mark);
    return {
      kind: "choice",
      key: "hk:" + target.id,
      target: target.id,
      promptHtml: `<div class="q">اختر حرف <b>${L.name}</b> مع <b>${target.name}</b></div>`,
      say: make(target),
      options: shuffle(HARAKAT).map((h) => ({ id: h.id, html: make(h), right: h === target })),
      cols: 3
    };
  },

  forms() {
    const pool = LETTERS.filter((L) => L.c);
    const [target] = store.pickWeighted(pool, (L) => "frm:" + L.l);
    const [label, shape] = randomOf(letterForms(target).slice(1));
    return {
      kind: "choice",
      key: "frm:" + target.l,
      target: target.l,
      promptHtml: `<div class="q">هذا الحرف في <b>${label}</b> الكلمة، ما هو؟</div><div class="big">${shape}</div>`,
      say: "ما هذا الحرف؟",
      options: letterChoices(target, LETTERS).map((L) => ({ id: L.l, html: L.l, right: L === target })),
      praise: `أحسنت! حرف ${target.name}`
    };
  },

  position() {
    // كل (كلمة، حرف يظهر فيها مرة واحدة)
    const items = [];
    for (const w of ALL_WORDS) {
      const chars = [...w.w];
      chars.forEach((ch, i) => {
        if (!byLetter[ch] || chars.filter((c) => c === ch).length !== 1) return;
        const pos = i === 0 ? "first" : i === chars.length - 1 ? "last" : "mid";
        items.push({ w, ch, pos });
      });
    }
    const [t] = store.pickWeighted(items, (x) => `pos:${x.w.w}:${x.ch}`);
    const names = { first: "أول الكلمة", mid: "وسط الكلمة", last: "آخر الكلمة" };
    const L = byLetter[t.ch];
    return {
      kind: "choice",
      key: `pos:${t.w.w}:${t.ch}`,
      target: t.pos,
      promptHtml: `<div class="q">أين حرف <b>${L.name}</b> في كلمة:</div><div class="pic small-pic">${t.w.emoji}</div><div class="big">${t.w.w}</div>`,
      say: `أين حرف ${L.name} في كلمة ${t.w.w}؟`,
      options: ["first", "mid", "last"].map((p) => ({ id: p, html: names[p], right: p === t.pos, text: true })),
      cols: 3
    };
  },

  read() {
    const [target] = store.pickWeighted(ALL_WORDS, (w) => "w:" + w.w);
    const others = pick(ALL_WORDS.filter((x) => x.emoji !== target.emoji), optionCount() - 1);
    return {
      kind: "choice",
      key: "w:" + target.w,
      target: target.w,
      promptHtml: `<div class="q">اقرأ الكلمة واختر صورتها</div><div class="big">${target.w}</div>`,
      say: null,
      options: shuffle([target, ...others]).map((w) => ({ id: w.w, html: w.emoji, right: w === target, emoji: true })),
      praise: target.w
    };
  },

  sentences() {
    const [target] = store.pickWeighted(SENTENCES, (s) => "s:" + s.s);
    const others = pick(SENTENCES.filter((x) => x !== target), 3);
    return {
      kind: "choice",
      key: "s:" + target.s,
      target: target.s,
      promptHtml: `<div class="q">اقرأ الجملة واختر الصورة المناسبة</div><div class="sentence">${target.s}</div>`,
      say: null,
      options: shuffle([target, ...others]).map((s) => ({ id: s.s, html: s.pic, right: s === target, emoji: true })),
      praise: target.s
    };
  },

  numbers() {
    const max = store.active.age === "small" ? 5 : 10;
    const pool = NUMBERS.slice(0, Math.max(max, 5));
    const [target] = store.pickWeighted(pool, (n) => "n:" + n.n);
    const e = randomOf(COUNT_EMOJIS);
    const others = pick(pool.filter((x) => x !== target), optionCount() - 1);
    return {
      kind: "choice",
      key: "n:" + target.n,
      target: String(target.n),
      promptHtml: `<div class="q">عُدّ، كم عددها؟</div><div class="count-box">${Array(target.n).fill(`<span>${e}</span>`).join("")}</div>`,
      say: "كم عددها؟",
      options: shuffle([target, ...others]).map((n) => ({ id: String(n.n), html: `${n.d}<small>${n.n}</small>`, right: n === target, num: true })),
      praise: `${target.name}! أحسنت`
    };
  },

  listen() {
    const pool = WORDS_SHORT.concat(WORDS_LONG.slice(0, 8));
    const [target] = store.pickWeighted(pool, (w) => "lis:" + w.w);
    const others = pick(pool.filter((x) => x.emoji !== target.emoji), optionCount() - 1);
    // بدون صوت عربي نعرض الكلمة مكتوبة حتى لا يعلق الطفل
    const canHear = store.settings.speech && hasArabicVoice();
    return {
      kind: "choice",
      key: "lis:" + target.w,
      target: target.w,
      promptHtml: `<div class="q">اسمع الكلمة واختر صورتها</div><div class="ear">👂</div>${canHear ? "" : `<div class="big">${target.w}</div>`}`,
      say: target.w,
      options: shuffle([target, ...others]).map((w) => ({ id: w.w, html: w.emoji, right: w === target, emoji: true })),
      praise: target.w
    };
  },

  memory() {
    const pairs = store.active.age === "small" ? 3 : 4;
    const letters = store.pickWeighted(LETTERS, (L) => "snd:" + L.l, pairs);
    return { kind: "memory", key: "mem:" + letters.map((L) => L.l).join(""), letters };
  },

  build(level) {
    const pool = level?.words === "long" ? WORDS_LONG : WORDS_SHORT;
    const [target] = store.pickWeighted(pool, (w) => "w:" + w.w);
    return { kind: "build", key: "w:" + target.w, word: target };
  },

  trace() {
    const [target] = store.pickWeighted(LETTERS, (L) => "trc:" + L.l);
    return { kind: "trace", key: "trc:" + target.l, letter: target };
  }
};

// ------------------------------------------------------------
//  مشغّل الجلسة
// ------------------------------------------------------------
let tickTimer = null;

/**
 * @param {object} opt
 *  title, icon       عنوان الجلسة
 *  total             عدد الأسئلة
 *  next(i)           يعيد السؤال رقم i
 *  onFinish(result)  { firstTry, total, mistakes }
 *  onExit()
 */
export function runSession(opt) {
  const s = { ...opt, round: 0, results: [], mistakes: 0, missed: false, seen: new Set() };

  clearInterval(tickTimer);
  tickTimer = setInterval(() => { if (!document.hidden) store.addSeconds(5); }, 5000);

  const stop = () => { clearInterval(tickTimer); stopSpeech(); };

  s.exit = () => { stop(); opt.onExit(); };

  s.wrong = (target, chosen) => {
    sfx.wrong();
    if (!s.missed) { s.missed = true; s.mistakes++; }
    store.confuse(target, chosen);
  };

  s.right = (q, delay = 900) => {
    sfx.right();
    store.record(q.key, !s.missed);
    s.results.push(!s.missed);
    s.round++;
    s.missed = false;
    setTimeout(() => {
      if (s.round >= s.total) { stop(); opt.onFinish({ firstTry: s.results.filter(Boolean).length, total: s.total, mistakes: s.mistakes }); }
      else show();
    }, delay);
  };

  function show() {
    // تجنّب تكرار نفس السؤال في الجلسة قدر الإمكان
    let q;
    for (let tries = 0; tries < 6; tries++) {
      q = opt.next(s.round);
      if (!s.seen.has(q.key)) break;
    }
    s.seen.add(q.key);
    if (q.kind === "build") buildRound(s, q);
    else if (q.kind === "memory") memoryRound(s, q);
    else if (q.kind === "trace") traceRound(s, q);
    else choiceRound(s, q);
  }

  show();
  return s;
}

function header(s) {
  let dots = "";
  for (let i = 0; i < s.total; i++) {
    const cls = i < s.round ? (s.results[i] ? "done" : "miss") : i === s.round ? "now" : "";
    dots += `<i class="${cls}"></i>`;
  }
  return `
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="خروج">✖</button>
      <b class="session-title">${s.icon} ${esc(s.title)}</b>
      <span class="spacer"></span>
    </div>
    <div class="progress-dots" aria-label="السؤال ${s.round + 1} من ${s.total}">${dots}</div>`;
}

function bindCommon(s, sayText) {
  $("#back").onclick = s.exit;
  const btn = $("#say");
  if (btn && sayText) {
    btn.onclick = () => speak(sayText);
    setTimeout(() => speak(sayText), 250);
  }
}

// ---------- سؤال اختيار ----------
function choiceRound(s, q) {
  const cols = q.cols === 3 || q.options.length === 3 ? "three" : q.options.length === 2 ? "two" : "";
  render(`
    ${header(s)}
    <div class="prompt">${q.promptHtml}
      ${q.say ? `<div class="say-row"><button class="speak" id="say">🔊 استمع</button></div>` : ""}
    </div>
    <div class="choices ${cols}">
      ${q.options.map((o, i) => `<button class="choice ${o.emoji ? "emoji" : ""} ${o.text ? "text" : ""} ${o.num ? "num" : ""}" data-i="${i}">${o.html}</button>`).join("")}
    </div>
  `);
  bindCommon(s, q.say);
  let wrongCount = 0;
  $$(".choice").forEach((btn) => (btn.onclick = () => {
    const o = q.options[Number(btn.dataset.i)];
    if (o.right) {
      $$(".choice").forEach((b) => (b.disabled = true));
      btn.classList.add("right");
      if (q.praise) speak(q.praise);
      s.right(q);
    } else {
      btn.classList.add("wrong");
      btn.disabled = true;
      s.wrong(q.target, o.id);
      wrongCount++;
      // بعد خطأين نلمّح للإجابة بلطف حتى لا يُحبط الطفل
      if (wrongCount >= 2) $$(".choice")[q.options.findIndex((x) => x.right)].classList.add("hint");
    }
  }));
}

// ---------- لعبة الذاكرة ----------
function memoryRound(s, q) {
  const cards = shuffle(q.letters.flatMap((L) => [
    { L, face: L.l, kind: "letter" },
    { L, face: L.emoji, kind: "pic" }
  ]));
  let open = [];
  let matched = 0;
  let misses = 0;
  let busy = false;
  const missedLetters = new Set();

  render(`
    ${header(s)}
    <div class="prompt compact"><div class="q">اقلب بطاقتين: طابق كل حرف مع صورة تبدأ به</div></div>
    <div class="memory ${cards.length > 6 ? "four" : ""}">
      ${cards.map((c, i) => `
        <button class="mcard" data-i="${i}" aria-label="بطاقة">
          <span class="mback">❓</span>
          <span class="mface ${c.kind}">${c.face}</span>
        </button>`).join("")}
    </div>
  `);
  $("#back").onclick = s.exit;

  const els = $$(".mcard");
  els.forEach((el) => (el.onclick = () => {
    const i = Number(el.dataset.i);
    if (busy || el.classList.contains("open") || el.classList.contains("done")) return;
    sfx.tap();
    el.classList.add("open");
    const c = cards[i];
    speak(c.kind === "letter" ? c.L.name : c.L.word);
    open.push(i);
    if (open.length < 2) return;

    const [a, b] = open.map((k) => cards[k]);
    open.forEach((k) => els[k].classList.add("checking"));
    busy = true;
    if (a.L === b.L && a.kind !== b.kind) {
      setTimeout(() => {
        open.forEach((k) => { els[k].classList.remove("checking"); els[k].classList.add("done"); });
        open = [];
        busy = false;
        matched++;
        sfx.right();
        speak(`${a.L.word} تبدأ بحرف ${a.L.name}`);
        store.record("snd:" + a.L.l, !missedLetters.has(a.L.l));
        if (matched === q.letters.length) {
          // في لعبة الذاكرة بعض الأخطاء طبيعية، نحتسب الخطأ فقط إذا زاد عن عدد الأزواج
          if (misses > q.letters.length) s.missed = true, s.mistakes++;
          s.right({ key: q.key }, 1300);
        }
      }, 450);
    } else {
      misses++;
      if (a.L !== b.L) { missedLetters.add(a.L.l); missedLetters.add(b.L.l); }
      setTimeout(() => {
        sfx.wrong();
        open.forEach((k) => els[k].classList.remove("open", "checking"));
        open = [];
        busy = false;
      }, 950);
    }
  }));
}

// ---------- ركّب الكلمة ----------
function buildRound(s, q) {
  const target = q.word;
  const letters = [...target.w];
  const extra = pick(LETTERS.map((x) => x.l).filter((l) => !letters.includes(l)), store.active.age === "big" ? 2 : 1);
  const tiles = shuffle([...letters, ...extra]);
  let pos = 0;
  let wrongCount = 0;

  render(`
    ${header(s)}
    <div class="prompt">
      <div class="q">ركّب الكلمة</div>
      <div class="pic">${target.emoji}</div>
      <div class="say-row"><button class="speak" id="say">🔊 استمع</button></div>
      <div class="slots">${letters.map(() => `<div class="slot"></div>`).join("")}</div>
      <div class="built-word" id="built" aria-live="polite"></div>
    </div>
    <div class="tiles">${tiles.map((t, i) => `<button class="tile" data-i="${i}">${t}</button>`).join("")}</div>
  `);
  bindCommon(s, target.w);

  const slots = $$(".slot");
  const tileEls = $$(".tile");
  tileEls.forEach((btn) => (btn.onclick = () => {
    const t = tiles[Number(btn.dataset.i)];
    if (t === letters[pos]) {
      sfx.tap();
      btn.classList.add("used");
      slots[pos].textContent = t;
      slots[pos].classList.add("filled");
      pos++;
      wrongCount = 0;
      tileEls.forEach((b) => b.classList.remove("hint"));
      $("#built").textContent = letters.slice(0, pos).join("");
      if (pos === letters.length) {
        tileEls.forEach((b) => (b.disabled = true));
        speak(`أحسنت! ${target.w}`);
        s.right(q, 1300);
      }
    } else {
      btn.classList.remove("wrong");
      void btn.offsetWidth;
      btn.classList.add("wrong");
      s.wrong(letters[pos], t);
      if (++wrongCount >= 2) {
        const hintEl = tileEls.find((b, i) => tiles[i] === letters[pos] && !b.classList.contains("used"));
        hintEl?.classList.add("hint");
      }
    }
  }));
}

// ---------- ارسم الحرف ----------
function traceRound(s, q) {
  const L = q.letter;
  render(`
    ${header(s)}
    <div class="prompt compact">
      <div class="q">ارسم حرف <b>${L.name}</b> فوق الخط الرمادي</div>
      <div class="say-row"><button class="speak" id="say">🔊 حرف ${L.name}</button></div>
    </div>
    <div class="trace-wrap" id="wrap">
      <canvas id="guide"></canvas>
      <canvas id="draw" aria-label="لوحة الرسم"></canvas>
    </div>
    <div class="trace-actions">
      <button class="btn alt small" id="clear">🧽 امسح</button>
      <button class="btn small" id="check">✔ تحقّق</button>
    </div>
  `);
  bindCommon(s, `حرف ${L.name}`);

  const wrap = $("#wrap");
  const guide = $("#guide");
  const draw = $("#draw");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = wrap.clientWidth;
  [guide, draw].forEach((c) => { c.width = size * dpr; c.height = size * dpr; });
  const gctx = guide.getContext("2d");
  const dctx = draw.getContext("2d");
  gctx.scale(dpr, dpr);
  dctx.scale(dpr, dpr);

  const font = (px) => `700 ${px}px "Naskh", "Cairo", serif`;
  const place = (ctx, sz) => {
    ctx.font = font(sz * 0.62);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const m = ctx.measureText(L.l);
    const asc = m.actualBoundingBoxAscent || sz * 0.3;
    const desc = m.actualBoundingBoxDescent || 0;
    return { x: sz / 2, y: sz / 2 + (asc - desc) / 2 };
  };
  const drawLetter = (ctx, sz, color, outline = 0) => {
    ctx.clearRect(0, 0, sz, sz);
    const { x, y } = place(ctx, sz);
    ctx.fillStyle = color;
    ctx.fillText(L.l, x, y);
    if (outline) { ctx.lineWidth = outline; ctx.strokeStyle = color; ctx.lineJoin = "round"; ctx.strokeText(L.l, x, y); }
    return { x, y };
  };
  const paintGuide = () => {
    const { x, y } = drawLetter(gctx, size, "#e3ebf2");
    gctx.setLineDash([6, 8]);
    gctx.lineWidth = 2;
    gctx.strokeStyle = "#9fb3c6";
    gctx.strokeText(L.l, x, y);
    gctx.setLineDash([]);
  };
  paintGuide();
  document.fonts?.load(font(40), L.l).then(paintGuide).catch(() => {});

  const strokes = [];
  let cur = null;
  const lineW = size * 0.075;
  const pt = (e) => {
    const r = draw.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const paintStrokes = (ctx, sz, w, color) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    strokes.forEach((st) => {
      ctx.beginPath();
      st.forEach((p, i) => (i ? ctx.lineTo(p.x * sz, p.y * sz) : ctx.moveTo(p.x * sz, p.y * sz)));
      if (st.length === 1) ctx.lineTo(st[0].x * sz + 0.1, st[0].y * sz);
      ctx.stroke();
    });
  };
  const repaint = () => { dctx.clearRect(0, 0, size, size); paintStrokes(dctx, size, lineW, "#fb8500"); };

  draw.addEventListener("pointerdown", (e) => { draw.setPointerCapture(e.pointerId); cur = [pt(e)]; strokes.push(cur); repaint(); });
  draw.addEventListener("pointermove", (e) => { if (!cur) return; cur.push(pt(e)); repaint(); });
  const end = () => { cur = null; };
  draw.addEventListener("pointerup", end);
  draw.addEventListener("pointercancel", end);

  $("#clear").onclick = () => { strokes.length = 0; repaint(); };

  $("#check").onclick = () => {
    const pts = strokes.reduce((n, st) => n + st.length, 0);
    if (pts < 8) { toast("ارسم الحرف أولاً ✏️"); return; }

    // نقارن الرسم بشكل الحرف على شبكة صغيرة:
    // التغطية = كم من الحرف رُسم، الدقة = كم من الرسم داخل الحرف
    const N = 120;
    const mk = () => { const c = document.createElement("canvas"); c.width = c.height = N; return c.getContext("2d", { willReadFrequently: true }); };
    const mask = mk(); drawLetter(mask, N, "#000", N * 0.06);
    const core = mk(); drawLetter(core, N, "#000");
    const user = mk(); paintStrokes(user, N, N * 0.075, "#000");
    const m = mask.getImageData(0, 0, N, N).data;
    const c = core.getImageData(0, 0, N, N).data;
    const u = user.getImageData(0, 0, N, N).data;
    let coreTotal = 0, coreHit = 0, userTotal = 0, userIn = 0;
    for (let i = 3; i < m.length; i += 4) {
      const inUser = u[i] > 40;
      if (c[i] > 40) { coreTotal++; if (inUser) coreHit++; }
      if (inUser) { userTotal++; if (m[i] > 40) userIn++; }
    }
    const coverage = coreHit / Math.max(coreTotal, 1);
    const precision = userIn / Math.max(userTotal, 1);

    if (coverage >= 0.45 && precision >= 0.6) {
      $("#check").disabled = true;
      $("#clear").disabled = true;
      dctx.clearRect(0, 0, size, size);
      paintStrokes(dctx, size, lineW, "#2bb673");
      speak("رائع!");
      s.right(q, 1100);
    } else {
      s.wrong(null, null);
      toast(coverage < 0.45 ? "ارسم الحرف كاملاً 💪" : "حاول أن تبقى فوق الحرف 🙂");
      setTimeout(() => { strokes.length = 0; repaint(); }, 700);
    }
  };
}

// ------------------------------------------------------------
//  درس تعليمي قبل مستويات الحروف
// ------------------------------------------------------------
export function showLesson(level, onDone, onExit, i = 0) {
  const list = LETTERS.slice(...level.range);
  const L = list[i];
  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="خروج">✖</button>
      <b class="session-title">${level.icon} تعلّم: ${i + 1} / ${list.length}</b>
      <button class="icon-btn" id="skip" aria-label="تخطّي الدرس" title="تخطّي الدرس">⏭</button>
    </div>
    <div class="prompt learn-card">
      <div class="big">${L.l}</div>
      <button class="speak" id="say">🔊 حرف ${L.name}</button>
      <div class="forms">${letterForms(L).map(([n, f]) => `<div><b>${f}</b><small>${n}</small></div>`).join("")}</div>
      <button class="example" id="example"><span class="pic">${L.emoji}</span>${L.word}</button>
    </div>
    <div class="learn-nav">
      <button class="btn alt small" id="prev" ${i === 0 ? "style='visibility:hidden'" : ""}>→ السابق</button>
      ${i < list.length - 1
        ? `<button class="btn small" id="next">التالي ←</button>`
        : `<button class="btn small" id="play">يلا نلعب 🎮</button>`}
    </div>
  `);
  const say = () => speak(`حرف ${L.name}، ${L.word}`);
  $("#say").onclick = say;
  $("#example").onclick = () => speak(L.word);
  say();
  $("#back").onclick = () => { stopSpeech(); onExit(); };
  $("#skip").onclick = () => { stopSpeech(); onDone(); };
  $("#prev").onclick = () => showLesson(level, onDone, onExit, i - 1);
  if ($("#next")) $("#next").onclick = () => { sfx.tap(); showLesson(level, onDone, onExit, i + 1); };
  if ($("#play")) $("#play").onclick = () => { sfx.tap(); onDone(); };
}
