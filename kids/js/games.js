// ============================================================
//  الأنشطة: مولّدات الأسئلة + طريقة عرض كل نوع + مشغّل الجلسة
// ============================================================
import { LETTERS } from "./data.js";
import { store } from "./store.js";
import { speak, stopSpeech, speechDone, sfx, canHear, praiseText } from "./sfx.js";
import { scoreTrace, frameOf, letterGuide, checkOrder, letterLayers } from "./tracecheck.js";
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

  // نزيل احتفال الشاشة السابقة حتى لا يغطي التمرين الجديد
  const conf = document.getElementById("confetti");
  if (conf) conf.innerHTML = "";

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
    else if (q.kind === "keyboard") keyboardRound(s, q);
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
      if (q.praise) speak(praiseText(q.praise));
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

  const cols = cards.length === 4 ? "two" : cards.length <= 6 ? "" : "four";
  render(`
    ${header(s)}
    <div class="prompt compact"><div class="q" id="mtitle">${q.preview ? "👀 احفظ أماكن البطاقات!" : `اقلب بطاقتين: ${q.title}`}</div></div>
    <div class="memory ${cols} ${cards.length > 8 ? "many" : ""}">
      ${cards.map((c, i) => `
        <button class="mcard" data-i="${i}" data-p="${c.idx}" aria-label="بطاقة">
          <span class="mback">❓</span>
          <span class="mface ${c.cls}">${c.face}</span>
        </button>`).join("")}
    </div>
  `);
  $("#back").onclick = s.exit;

  const els = $$(".mcard");
  // كشف كل البطاقات لحظات ثم قلبها
  if (q.preview) {
    busy = true;
    els.forEach((el) => el.classList.add("open"));
    const id = s.qid;
    speak("احفظ أماكن البطاقات");
    setTimeout(() => {
      if (id !== s.qid) return;
      els.forEach((el) => el.classList.remove("open"));
      $("#mtitle").textContent = `اقلب بطاقتين: ${q.title}`;
      busy = false;
    }, q.preview);
  }
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
// q.word = { w, emoji }
// اختياري:
//  q.parts   أجزاء الكلمة بالترتيب (حروف أو مقاطع أو أشكال الحروف)، الافتراضي حروف الكلمة
//  q.extras  بطاقات مشتّتة · q.title · q.slow · q.praise · q.sayParts (نطق كل جزء)
//  q.hidePic (إملاء: تظهر الصورة عند الإكمال) · q.mystery (الصورة مخفية وتظهر كتلميح بعد خطأين، بلا صوت)
//  q.ghost   (حروف باهتة داخل الخانات للمطابقة، للصغار) · q.given (عدد الأجزاء المعطاة مسبقاً)
//  q.shown   ما يُعرض في المعاينة لكل جزء (مثلاً الحرف المجرد بدل شكله)
function buildRound(s, q) {
  const target = q.word;
  const parts = q.parts || [...target.w];
  const shown = q.shown || parts;
  const given = q.given || 0;
  const syllables = !!q.parts && q.parts.some((x) => [...x].length > 1);
  const extra = q.extras || pick(LETTERS.map((x) => x.l).filter((l) => !parts.includes(l)), store.active.age === "big" ? 2 : 1);
  const tiles = shuffle([...parts.slice(given), ...extra]);
  let pos = given;
  let wrongCount = 0;
  let totalWrong = 0;
  const picHtml = q.hidePic ? "👂" : q.mystery ? "❓" : target.emoji;

  render(`
    ${header(s)}
    <div class="prompt">
      <div class="q">${q.title || "ركّب الكلمة"}</div>
      <div class="pic" id="pic">${picHtml}</div>
      ${q.mystery ? "" : `<div class="say-row"><button class="speak" id="say">🔊 استمع</button></div>${parentNote(target.w)}`}
      <div class="slots ${syllables ? "syl" : ""}">${parts.map((p, i) => `<div class="slot ${i < given ? "filled given" : ""} ${q.ghost && i >= given ? "ghost" : ""}" ${q.ghost ? `data-ghost="${esc(p)}"` : ""}>${i < given ? p : ""}</div>`).join("")}</div>
      <div class="built-word" id="built" aria-live="polite">${shown.slice(0, given).join("")}</div>
    </div>
    <div class="tiles ${syllables ? "syl" : ""}">${tiles.map((t, i) => `<button class="tile" data-i="${i}">${t}</button>`).join("")}</div>
  `);
  if (q.mystery) $("#back").onclick = s.exit;
  else bindCommon(s, target.w, q.slow);

  const slots = $$(".slot");
  const tileEls = $$(".tile");
  tileEls.forEach((btn) => (btn.onclick = () => {
    if (s.answered) return;
    const t = tiles[Number(btn.dataset.i)];
    if (t === parts[pos]) {
      sfx.tap();
      if (q.sayParts) speak(t, { slow: true });
      btn.classList.add("used");
      slots[pos].textContent = t;
      slots[pos].classList.add("filled");
      slots[pos].classList.remove("ghost");
      pos++;
      wrongCount = 0;
      tileEls.forEach((b) => b.classList.remove("hint"));
      $("#built").textContent = pos === parts.length ? target.w : shown.slice(0, pos).join("");
      if (pos === parts.length) {
        tileEls.forEach((b) => (b.disabled = true));
        if (q.hidePic || q.mystery) $("#pic").textContent = target.emoji;
        speak(praiseText(q.praise || target.w));
        s.right(q, 1300);
      }
    } else {
      btn.classList.remove("wrong");
      void btn.offsetWidth;
      btn.classList.add("wrong");
      if (q.sayParts) speak(t, { slow: true });
      s.wrong(parts[pos], t);
      totalWrong++;
      if (q.mystery && totalWrong === 2) { $("#pic").textContent = target.emoji; toast("تلميح: هذه صورة الكلمة 💡"); }
      if (++wrongCount >= 2) {
        const hintEl = tileEls.find((b, i) => tiles[i] === parts[pos] && !b.classList.contains("used"));
        hintEl?.classList.add("hint");
      }
    }
  }));
}

// ---------- لوحة المفاتيح: اكتب الكلمة كاملة بالضغط على الحروف ----------
const KEYS = ["ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي", "ة", "أ", "إ", "آ", "ى", "ء", "ئ", "ؤ"];
function keyboardRound(s, q) {
  const target = q.word;
  const letters = [...target.w];
  let typed = [];
  let tries = 0;

  render(`
    ${header(s)}
    <div class="prompt">
      <div class="q">${q.title || "اكتب اسم الصورة"}</div>
      <div class="pic" id="pic">${q.hidePic ? "👂" : target.emoji}</div>
      <div class="say-row"><button class="speak" id="say">🔊 استمع</button></div>
      ${parentNote(target.w)}
      <div class="slots kb-slots">${letters.map(() => `<div class="slot"></div>`).join("")}</div>
      <div class="built-word" id="built" aria-live="polite"></div>
    </div>
    <div class="keyboard">
      ${KEYS.map((k) => `<button class="key" data-k="${k}">${k}</button>`).join("")}
      <button class="key back-key" id="bs" aria-label="حذف">⌫</button>
    </div>
  `);
  bindCommon(s, target.w, true);
  const slots = $$(".slot");
  const keyEls = $$(".key[data-k]");
  const paint = () => {
    slots.forEach((sl, i) => { sl.textContent = typed[i] || ""; sl.classList.toggle("filled", !!typed[i]); sl.classList.remove("bad", "good"); });
    $("#built").textContent = typed.join("");
  };
  const check = () => {
    if (typed.join("") === target.w) {
      slots.forEach((sl) => sl.classList.add("good"));
      keyEls.forEach((b) => (b.disabled = true));
      if (q.hidePic) $("#pic").textContent = target.emoji;
      speak(`أحسنت! ${target.w}`);
      s.right(q, 1300);
      return;
    }
    tries++;
    const firstBad = typed.findIndex((ch, i) => ch !== letters[i]);
    s.wrong(letters[firstBad], typed[firstBad]);
    typed.forEach((ch, i) => slots[i].classList.add(ch === letters[i] ? "good" : "bad"));
    speak(target.w, { slow: true });
    // نُبقي الحروف الصحيحة في أماكنها ونمسح ما بعد أول خطأ
    setTimeout(() => {
      typed = typed.slice(0, firstBad);
      paint();
      if (tries >= 2) keyEls.find((b) => b.dataset.k === letters[typed.length])?.classList.add("hint");
    }, 900);
  };
  keyEls.forEach((b) => (b.onclick = () => {
    if (s.answered || typed.length >= letters.length) return;
    sfx.tap();
    keyEls.forEach((x) => x.classList.remove("hint"));
    typed.push(b.dataset.k);
    paint();
    if (typed.length === letters.length) setTimeout(check, 250);
  }));
  $("#bs").onclick = () => { if (s.answered) return; typed.pop(); paint(); };
}

// q.letter = { l, name, num }  أو كلمة: q.text
// q.guide: "full" (الخط الرمادي ظاهر) | "memory" (يظهر ثوانٍ ثم يختفي) | "none" (كتابة حرّة)
// في الكتابة الحرّة وكتابة الذاكرة نقارن الشكل بعد تحجيم الرسم ليطابق حجم الحرف ومكانه
function traceRound(s, q) {
  const L = q.letter || {};
  const text = q.text || L.l;
  let guideMode = q.guide || "full";
  let free = guideMode !== "full";
  let failed = 0;
  let orderWarned = false;
  const kind = q.text ? "الكلمة" : L.num ? "رقم" : "حرف";
  const title = q.title || (guideMode === "none" ? `اكتب ${kind} <b>${esc(L.name || text)}</b> بنفسك` : guideMode === "memory" ? `انظر جيداً ثم اكتب ${kind} <b>${esc(L.name || text)}</b> من ذاكرتك` : `ارسم ${kind} <b>${esc(L.name || text)}</b> فوق الخط الرمادي`);
  const sayText = q.say || (q.text ? text : `${L.num ? "رقم" : "حرف"} ${L.name}`);
  // حرف مفرد (لا كلمة ولا رقم ولا شكل داخل كلمة): نعلّم اتجاه كتابته وترتيبها
  const isLetter = !q.text && !L.num && !!L.l;
  render(`
    ${header(s)}
    <div class="prompt compact">
      <div class="q">${title}</div>
      ${q.pic ? `<div class="pic small-pic">${q.pic}</div>` : ""}
      <div class="say-row"><button class="speak" id="say">🔊 استمع</button>${guideMode === "memory" ? ` <button class="speak alt" id="peek">👀 أرني مرة أخرى</button>` : ""}${isLetter && guideMode === "full" ? ` <button class="speak alt" id="demo">▶ كيف يُكتب؟</button>` : ""}</div>
      ${parentNote(sayText)}
    </div>
    <div class="trace-wrap ${guideMode === "none" ? "lined" : ""}" id="wrap">
      <canvas id="guide"></canvas>
      <canvas id="draw" aria-label="لوحة الرسم"></canvas>
    </div>
    <div class="trace-actions">
      <button class="btn alt small" id="clear">🧽 امسح</button>
      <button class="btn small" id="check">✔ تحقّق</button>
    </div>
  `);
  bindCommon(s, sayText, !!q.text);

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
  // حجم الخط: كبير للحرف، ويصغر للكلمة حتى تتسع داخل اللوحة
  const fontSize = (ctx, sz) => {
    let px = sz * 0.62;
    ctx.font = font(px);
    const w = ctx.measureText(text).width;
    if (w > sz * 0.86) px *= (sz * 0.86) / w;
    return px;
  };
  const place = (ctx, sz) => {
    const px = fontSize(ctx, sz);
    ctx.font = font(px);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const m = ctx.measureText(text);
    const asc = m.actualBoundingBoxAscent || px * 0.5;
    const desc = m.actualBoundingBoxDescent || 0;
    return { x: sz / 2, y: sz / 2 + (asc - desc) / 2, px };
  };
  const drawText = (ctx, sz, color, outline = 0) => {
    ctx.clearRect(0, 0, sz, sz);
    const pl = place(ctx, sz);
    ctx.fillStyle = color;
    ctx.fillText(text, pl.x, pl.y);
    if (outline) { ctx.lineWidth = outline * pl.px / (sz * 0.62); ctx.strokeStyle = color; ctx.lineJoin = "round"; ctx.strokeText(text, pl.x, pl.y); }
    return pl;
  };
  // إطار الكتابة في وضع الذاكرة والكتابة الحرّة: يبقى ظاهراً ليعرف الطفل أين يكتب
  const frame = frameOf(text);
  const paintFrame = () => {
    if (!free) return;
    gctx.save();
    gctx.setLineDash([10, 8]);
    gctx.lineWidth = 3;
    gctx.strokeStyle = "#b9a7e8";
    const r = 18;
    const x = frame.x * size, y = frame.y * size, w = frame.w * size, h = frame.h * size;
    gctx.beginPath();
    gctx.roundRect ? gctx.roundRect(x, y, w, h, r) : gctx.rect(x, y, w, h);
    gctx.stroke();
    gctx.restore();
  };
  const paintGuide = (show = true) => {
    gctx.clearRect(0, 0, size, size);
    if (show) {
      const { x, y } = drawText(gctx, size, "#e3ebf2");
      gctx.setLineDash([6, 8]);
      gctx.lineWidth = 2;
      gctx.strokeStyle = "#9fb3c6";
      gctx.strokeText(text, x, y);
      gctx.setLineDash([]);
    }
    paintFrame();
    if (show && isLetter && guideMode === "full" && !demoRunning) drawMarkers();
  };

  // ---- اتجاه الكتابة: نقطة البداية الخضراء والسهم، ورقم ٢ عند النقاط ----
  const lg = isLetter ? letterGuide(text) : null;
  let demoRunning = false;
  function drawMarkers() {
    if (!lg) return;
    const x = lg.start.x * size, y = lg.start.y * size;
    gctx.save();
    gctx.fillStyle = "#2bb673";
    gctx.beginPath(); gctx.arc(x, y, 13, 0, Math.PI * 2); gctx.fill();
    gctx.fillStyle = "#fff";
    gctx.font = '900 15px "Cairo", sans-serif';
    gctx.textAlign = "center"; gctx.textBaseline = "middle";
    gctx.fillText("١", x, y + 1);
    gctx.fillStyle = "#2bb673";
    gctx.font = '900 28px "Cairo", sans-serif';
    if (lg.vertical) gctx.fillText("↓", x + 26, y + 18);
    else gctx.fillText("←", x - 6, y - 24);
    lg.dots.forEach((d) => {
      gctx.fillStyle = "#ffb703";
      gctx.beginPath(); gctx.arc(d.x * size + 20, d.y * size - 16, 10, 0, Math.PI * 2); gctx.fill();
      gctx.fillStyle = "#12355b";
      gctx.font = '900 12px "Cairo", sans-serif';
      gctx.fillText("٢", d.x * size + 20, d.y * size - 15);
    });
    gctx.restore();
  }
  // عرض متحرك: يُرسم الجسم من نقطة البداية في اتجاه الكتابة، ثم النقاط
  function playDemo() {
    if (!lg || demoRunning) return;
    demoRunning = true;
    const { body, dots } = letterLayers(text, size, dpr, "#8e7dff");
    const t0 = performance.now();
    const BODY = 1700, DOTS = 600;
    const b = lg.box;
    const step = (now) => {
      if (s.answered || !document.body.contains(guide)) { demoRunning = false; return; }
      const t = now - t0;
      gctx.clearRect(0, 0, size, size);
      drawText(gctx, size, "#eef3f7");
      const pb = Math.min(1, t / BODY);
      gctx.save();
      gctx.beginPath();
      if (lg.vertical) gctx.rect(0, 0, size, (b.y0 + (b.y1 - b.y0) * pb) * size + 2);
      else { const xr = (b.x1 - (b.x1 - b.x0) * pb) * size - 2; gctx.rect(xr, 0, size - xr, size); }
      gctx.clip();
      gctx.drawImage(body, 0, 0, size, size);
      gctx.restore();
      if (t > BODY) { gctx.globalAlpha = Math.min(1, (t - BODY) / DOTS); gctx.drawImage(dots, 0, 0, size, size); gctx.globalAlpha = 1; }
      // قلم يتبع مقدّمة الرسم
      const px = lg.vertical ? lg.start.x * size : (b.x1 - (b.x1 - b.x0) * pb) * size;
      const py = lg.vertical ? (b.y0 + (b.y1 - b.y0) * pb) * size : (lg.start.y + (b.y1 - lg.start.y) * Math.sin(pb * Math.PI) * 0.5) * size;
      if (t <= BODY) { gctx.font = "30px serif"; gctx.textAlign = "center"; gctx.textBaseline = "middle"; gctx.fillText("✏️", px - 4, py - 18); }
      if (t < BODY + DOTS + 400) requestAnimationFrame(step);
      else { demoRunning = false; paintGuide(guideVisible); }
    };
    requestAnimationFrame(step);
  }
  let guideVisible = guideMode !== "none";
  let hideTimer = null;
  const showGuide = () => {
    paintGuide(true);
    if (guideMode === "memory") {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { guideVisible = false; paintGuide(false); }, 2500);
    }
  };
  if (guideVisible) showGuide(); else paintGuide(false);
  document.fonts?.load(font(40), text).then(() => {
    paintGuide(guideVisible);
    // للصغار، أو لحرف لم يتقنه الطفل بعد: نعرض طريقة كتابته مرة عند البداية
    const m = store.active.mastery["trc:" + text];
    if (isLetter && guideMode === "full" && (store.active.age === "small" || !m || m.box < 2)) setTimeout(playDemo, 600);
  }).catch(() => {});
  $("#demo")?.addEventListener("click", () => { sfx.tap(); playDemo(); });
  $("#peek")?.addEventListener("click", () => { guideVisible = true; showGuide(); });

  const strokes = [];
  let cur = null;
  const lineW = () => Math.max(size * 0.035, place(dctx, size).px * 0.12);
  const LW = lineW();
  const pt = (e) => {
    const r = draw.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const paintStrokes = (ctx, sz, w, color, list = strokes) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    list.forEach((st) => {
      ctx.beginPath();
      st.forEach((p, i) => (i ? ctx.lineTo(p.x * sz, p.y * sz) : ctx.moveTo(p.x * sz, p.y * sz)));
      if (st.length === 1) ctx.lineTo(st[0].x * sz + 0.1, st[0].y * sz);
      ctx.stroke();
    });
  };
  const repaint = () => { dctx.clearRect(0, 0, size, size); paintStrokes(dctx, size, LW, "#fb8500"); };

  draw.addEventListener("pointerdown", (e) => {
    draw.setPointerCapture(e.pointerId);
    // في وضع الذاكرة يختفي الخط بمجرد أن يبدأ الطفل الكتابة
    if (guideMode === "memory" && guideVisible) { clearTimeout(hideTimer); guideVisible = false; paintGuide(false); }
    cur = [pt(e)]; strokes.push(cur); repaint();
  });
  draw.addEventListener("pointermove", (e) => { if (!cur) return; cur.push(pt(e)); repaint(); });
  const end = () => { cur = null; };
  draw.addEventListener("pointerup", end);
  draw.addEventListener("pointercancel", end);

  $("#clear").onclick = () => { strokes.length = 0; repaint(); };

  // حدود مربع يحيط بالبكسلات المرسومة في شبكة N×N
  const bbox = (data, N) => {
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (data[(y * N + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };

  $("#check").onclick = () => {
    if (s.answered) return;
    const pts = strokes.reduce((n, st) => n + st.length, 0);
    if (pts < 8) { toast(q.text ? "اكتب الكلمة أولاً ✏️" : "ارسم الحرف أولاً ✏️"); return; }

    const sc = scoreTrace(text, strokes, free, LW / size);

    // الشكل صحيح لكن الترتيب أو الاتجاه خطأ: ننبّه مرة واحدة ونعرض الطريقة
    if (sc.pass && isLetter && !orderWarned) {
      const ord = checkOrder(text, strokes);
      if (!ord.ok) {
        orderWarned = true;
        s.wrong(null, null);
        toast(ord.reason === "dots" ? "اكتب الحرف أولاً، ثم النقاط ✏️" : "ابدأ من النقطة الخضراء واتّجه مع السهم ✏️");
        speak(ord.reason === "dots" ? "اكتب الحرف أولاً، ثم النقاط" : "ابدأ من النقطة الخضراء");
        strokes.length = 0;
        repaint();
        if (guideMode === "full") { paintGuide(true); setTimeout(playDemo, 400); }
        return;
      }
    }
    if (sc.pass) {
      $("#check").disabled = true;
      $("#clear").disabled = true;
      // نُظهر الشكل الصحيح بعد النجاح ليقارن الطفل
      paintGuide(true);
      dctx.clearRect(0, 0, size, size);
      paintStrokes(dctx, size, LW, "#2bb673");
      speak(q.text ? `رائع! ${text}` : "رائع!");
      s.right(q, 1100);
    } else {
      s.wrong(null, null);
      failed++;
      if (free && failed >= 2) {
        // بعد محاولتين في الكتابة الحرّة: نُظهر الخط المساعد ليتتبّعه الطفل بدل أن يعلق
        guideMode = "full";
        free = false;
        guideVisible = true;
        paintGuide(true);
        toast("انظر للشكل وارسمه فوق الخط ✍️");
      } else {
        toast(sc.reason === "ink" ? "اكتب الشكل فقط بدون تلوين 🙂" : sc.reason === "coverage" ? (q.text ? "اكتب الكلمة كاملة 💪" : "ارسم الحرف كاملاً 💪") : (free ? "اكتب داخل الإطار بشكل أدق 🙂" : "حاول أن تبقى فوق الخط 🙂"));
        // بعد المحاولة الخاطئة نُري الشكل الصحيح لحظات
        if (free) { guideVisible = true; paintGuide(true); setTimeout(() => { if (!s.answered && free) { guideVisible = false; paintGuide(false); } }, 1800); }
      }
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
