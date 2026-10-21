// ============================================================
//  الأنشطة: مولّدات الأسئلة + طريقة عرض كل نوع + مشغّل الجلسة
// ============================================================
import { LETTERS } from "./data.js";
import { store } from "./store.js";
import { speak, stopSpeech, speechDone, sfx, canHear } from "./sfx.js";
import { shuffle, pick, randomOf, esc, render, $, $$, toast, letterForms, toArabicDigits } from "./util.js";


export { GEN } from "./exercises.js";

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
  // qid: رقم السؤال الحالي، answered: هل أجاب الطفل عليه
  // نستخدمهما حتى لا يُنطق سؤال قديم بعد الإجابة أو بعد الانتقال
  const s = { ...opt, round: 0, results: [], mistakes: 0, missed: false, seen: new Set(), qid: 0, answered: false, ended: false };

  clearInterval(tickTimer);
  tickTimer = setInterval(() => { if (!document.hidden) store.addSeconds(5); }, 5000);

  const stop = () => { s.ended = true; clearInterval(tickTimer); stopSpeech(); };

  s.exit = () => { stop(); opt.onExit(); };

  // ينطق نصاً فقط إذا كان السؤال نفسه ما زال معروضاً ولم يُجب عليه
  s.sayIfCurrent = (text, opts, delay = 0) => {
    const id = s.qid;
    setTimeout(() => { if (!s.ended && id === s.qid && !s.answered) speak(text, opts); }, delay);
  };

  s.wrong = (target, chosen) => {
    sfx.wrong();
    if (!s.missed) { s.missed = true; s.mistakes++; }
    store.confuse(target, chosen);
  };

  // بعد الإجابة الصحيحة: ننتظر انتهاء عبارة المديح (وحداً أدنى من الوقت) ثم ننتقل
  s.right = (q, delay = 900) => {
    if (s.answered) return;
    s.answered = true;
    sfx.right();
    store.record(q.key, !s.missed);
    s.results.push(!s.missed);
    s.round++;
    s.missed = false;
    const id = s.qid;
    const minWait = new Promise((r) => setTimeout(r, delay));
    // speechDone يُقرأ بعد لحظة لأن المديح قد يبدأ بعد استدعاء right مباشرة
    const praise = new Promise((r) => setTimeout(r, 80)).then(() => speechDone());
    const maxWait = new Promise((r) => setTimeout(r, 7000));
    Promise.race([Promise.all([minWait, praise]), maxWait]).then(() => {
      if (s.ended || id !== s.qid) return;
      if (s.round >= s.total) { stop(); opt.onFinish({ firstTry: s.results.filter(Boolean).length, total: s.total, mistakes: s.mistakes }); }
      else setTimeout(show, 250);
    });
  };

  function show() {
    s.qid++;
    s.answered = false;
    stopSpeech();
    // تجنّب تكرار نفس السؤال في الجلسة قدر الإمكان
    let q;
    for (let tries = 0; tries < 6; tries++) {
      q = opt.next(s.round);
      if (!s.seen.has(q.key)) break;
    }
    s.seen.add(q.key);
    if (q.kind === "build") buildRound(s, q);
    else if (q.kind === "memory") memoryRound(s, q);
    else if (q.kind === "hunt") huntRound(s, q);
    else if (q.kind === "order") orderRound(s, q);
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

function bindCommon(s, sayText, slow = false) {
  $("#back").onclick = s.exit;
  const btn = $("#say");
  if (btn && sayText) {
    btn.onclick = () => { if (!s.answered) speak(sayText, { slow }); };
    s.sayIfCurrent(sayText, { slow }, 300);
  }
}

// بدون صوت عربي في الجهاز: نعرض للأهل ما يجب قراءته للطفل بصوت عالٍ
function parentNote(text) {
  if (!text || canHear() || store.active.age !== "small") return "";
  return `<div class="parent-note">👪 لا يوجد صوت في الجهاز، اقرأ لطفلك: <b>«${esc(text)}»</b></div>`;
}

// ---------- سؤال اختيار ----------
function choiceRound(s, q) {
  const cols = q.wide ? "one" : q.cols === 3 || q.options.length === 3 ? "three" : q.options.length === 2 ? "two" : "";
  render(`
    ${header(s)}
    <div class="prompt">${q.promptHtml}
      ${q.say ? `<div class="say-row"><button class="speak" id="say">🔊 استمع</button></div>` : ""}
      ${parentNote(q.say)}
    </div>
    <div class="choices ${cols}">
      ${q.options.map((o, i) => `<button class="choice ${o.emoji ? "emoji" : ""} ${o.text ? "text" : ""} ${o.num ? "num" : ""} ${o.word ? "word" : ""} ${o.sentence ? "sentence-opt" : ""}" data-i="${i}">${o.html}</button>`).join("")}
    </div>
  `);
  bindCommon(s, q.say, q.slow);
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
      // عند اختيار صورة خاطئة ننطق اسمها ليسمع الطفل الفرق
      if (q.sayOption && o.emoji) speak(o.id);
      s.wrong(q.target, o.id);
      wrongCount++;
      // بعد خطأين نلمّح للإجابة بلطف حتى لا يُحبط الطفل
      if (wrongCount >= 2) $$(".choice")[q.options.findIndex((x) => x.right)].classList.add("hint");
    }
  }));
}

// ---------- لعبة الذاكرة ----------
// q.pairs = [{ a: {face, cls, say}, b: {face, cls, say}, done, rec }]
function memoryRound(s, q) {
  const cards = shuffle(q.pairs.flatMap((p, idx) => [
    { idx, side: "a", ...p.a },
    { idx, side: "b", ...p.b }
  ]));
  let open = [];
  let matched = 0;
  let misses = 0;
  let busy = false;
  const missed = new Set();

  render(`
    ${header(s)}
    <div class="prompt compact"><div class="q">اقلب بطاقتين: ${q.title}</div></div>
    <div class="memory ${cards.length > 6 ? "four" : ""}">
      ${cards.map((c, i) => `
        <button class="mcard" data-i="${i}" aria-label="بطاقة">
          <span class="mback">❓</span>
          <span class="mface ${c.cls}">${c.face}</span>
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
    speak(cards[i].say);
    open.push(i);
    if (open.length < 2) return;

    const [a, b] = open.map((k) => cards[k]);
    busy = true;
    if (a.idx === b.idx && a.side !== b.side) {
      setTimeout(() => {
        open.forEach((k) => els[k].classList.add("done"));
        open = [];
        busy = false;
        matched++;
        sfx.right();
        const p = q.pairs[a.idx];
        speak(p.done);
        if (p.rec) store.record(p.rec, !missed.has(a.idx));
        if (matched === q.pairs.length) {
          // في لعبة الذاكرة بعض الأخطاء طبيعية، نحتسب الخطأ فقط إذا زاد عن عدد الأزواج
          if (misses > q.pairs.length) { s.missed = true; s.mistakes++; }
          s.right({ key: q.key }, 1300);
        }
      }, 450);
    } else {
      misses++;
      missed.add(a.idx);
      missed.add(b.idx);
      setTimeout(() => {
        sfx.wrong();
        open.forEach((k) => els[k].classList.remove("open"));
        open = [];
        busy = false;
      }, 950);
    }
  }));
}

// ---------- صيد الحرف: اضغط كل كلمة فيها الحرف ----------
function huntRound(s, q) {
  const L = q.letter;
  const words = q.text.split(" ");
  const targets = words.map((w) => w.includes(L.l));
  const need = targets.filter(Boolean).length;
  let found = 0;
  let wrongCount = 0;

  render(`
    ${header(s)}
    <div class="prompt">
      <div class="q">اضغط على كل كلمة فيها حرف <b>${L.name}</b></div>
      <div class="big small-big">${L.l}</div>
      <div class="say-row"><button class="speak" id="say">🔊 استمع</button></div>
    </div>
    <div class="hunt">${words.map((w, i) => `<button class="hword" data-i="${i}">${esc(w)}</button>`).join("")}</div>
    <p class="sub hunt-count" id="count"></p>
  `);
  bindCommon(s, `اضغط على كل كلمة فيها حرف ${L.name}`);
  const count = () => { $("#count").textContent = `وجدت ${toArabicDigits(found)} من ${toArabicDigits(need)}`; };
  count();

  $$(".hword").forEach((btn) => (btn.onclick = () => {
    const i = Number(btn.dataset.i);
    if (btn.classList.contains("got")) return;
    if (targets[i]) {
      btn.classList.add("got");
      btn.disabled = true;
      sfx.tap();
      speak(words[i].replace(/[.،!؟:]/g, ""));
      found++;
      count();
      if (found === need) {
        $$(".hword").forEach((b) => (b.disabled = true));
        s.right(q, 1200);
      }
    } else {
      btn.classList.remove("wrong"); void btn.offsetWidth; btn.classList.add("wrong");
      s.wrong(null, null);
      if (++wrongCount >= 2) $$(".hword").forEach((b, k) => targets[k] && !b.classList.contains("got") && b.classList.add("hint"));
    }
  }));
}

// ---------- رتّب الجمل كما حدثت في القصة ----------
function orderRound(s, q) {
  const items = shuffle(q.pages.map((p, k) => ({ ...p, k })));
  let next = 0;
  let wrongCount = 0;

  render(`
    ${header(s)}
    <div class="prompt compact">
      <div class="q">${q.story.cover} من قصة «${esc(q.story.title)}»</div>
      <div class="q">رتّب الجمل: اضغط الأولى ثم التي بعدها</div>
    </div>
    <div class="order">
      ${items.map((it, i) => `<button class="oitem" data-i="${i}"><span class="onum"></span><span class="opic">${it.pic}</span><span class="otext">${esc(it.text)}</span></button>`).join("")}
    </div>
  `);
  bindCommon(s, null);

  const els = $$(".oitem");
  els.forEach((btn) => (btn.onclick = () => {
    const it = items[Number(btn.dataset.i)];
    if (btn.classList.contains("placed")) return;
    if (it.k === next) {
      next++;
      wrongCount = 0;
      btn.classList.add("placed");
      btn.querySelector(".onum").textContent = String(next).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
      els.forEach((b) => b.classList.remove("hint"));
      sfx.tap();
      speak(it.text);
      if (next === q.pages.length) { els.forEach((b) => (b.disabled = true)); s.right(q, 1600); }
    } else {
      btn.classList.remove("wrong"); void btn.offsetWidth; btn.classList.add("wrong");
      s.wrong(null, null);
      if (++wrongCount >= 2) els[items.findIndex((x) => x.k === next)].classList.add("hint");
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
      <div class="q">ارسم ${L.num ? "رقم" : "حرف"} <b>${L.name}</b> فوق الخط الرمادي</div>
      <div class="say-row"><button class="speak" id="say">🔊 ${L.num ? "رقم" : "حرف"} ${L.name}</button></div>
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
  bindCommon(s, `${L.num ? "رقم" : "حرف"} ${L.name}`);

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
