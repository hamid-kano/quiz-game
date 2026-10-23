// ============================================================
//  سيطرة: الشاشات، حلقة اللعب، الكاميرا واللمس، الشراء والأوامر، الأصوات، الحفظ
// ============================================================
import { createWorld, step, command, TICK, seconds, incomeOf, unitCount, MAX_UNITS, QUEUE_MAX } from "./world.js";
import { createAI, think, LEVELS as AI } from "./ai.js";
import { createView, resizeView, clampCam, screenToWorld, addEvent, render, createMinimap, renderMinimap, minZoom } from "./draw.js";
import { UNITS, UNIT_ORDER, HQ } from "./units.js";
import { POINT_TYPES, pointAt } from "./city.js";
import { LEVELS, starsFor } from "./levels.js";
import { seedToCode, codeToSeed, randomSeed } from "./rng.js";

const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const TICK_MS = TICK * 1000;
const store = {
  get(k, d) { try { const v = localStorage.getItem("saytara2-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("saytara2-" + k, JSON.stringify(v)); } catch {} }
};
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---------------- الأصوات: مولّدة بالكامل (ضجيج مفلتر لإطلاق النار والانفجارات) ----------------
let actx = null, noise = null;
let soundOn = store.get("sound", true);
let lastSound = {};
function audio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    noise = actx.createBuffer(1, actx.sampleRate * 0.6, actx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function burst(freq, dur, gain, q = 1) {
  if (!soundOn) return;
  try {
    const a = audio();
    const src = a.createBufferSource(); src.buffer = noise;
    const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain();
    const t = a.currentTime;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t); src.stop(t + dur);
  } catch {}
}
function tone(freqs, dur = 0.08, type = "triangle", gain = 0.1) {
  if (!soundOn) return;
  try {
    const a = audio();
    freqs.forEach((fr, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = fr;
      const t0 = a.currentTime + i * dur;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    });
  } catch {}
}
// لا نكرّر نفس الصوت أكثر من مرة كل فترة قصيرة
const limited = (k, ms, fn) => { const n = performance.now(); if (n - (lastSound[k] || 0) > ms) { lastSound[k] = n; fn(); } };
const sfx = {
  rifle: () => limited("rifle", 70, () => burst(3200, 0.07, 0.05)),
  cannon: () => limited("cannon", 120, () => burst(700, 0.25, 0.14)),
  arty: () => limited("arty", 200, () => burst(400, 0.35, 0.16)),
  boom: () => limited("boom", 120, () => burst(250, 0.7, 0.22)),
  select: () => tone([880], 0.04, "sine", 0.06),
  order: () => tone([520, 700], 0.05, "sine", 0.06),
  ready: () => tone([660, 880], 0.06, "triangle", 0.07),
  capture: () => tone([523, 659, 784], 0.09, "triangle", 0.1),
  lost: () => tone([392, 262], 0.15, "square", 0.05),
  win: () => tone([523, 659, 784, 1047], 0.14, "sine", 0.12),
  lose: () => tone([392, 330, 262, 196], 0.2, "triangle", 0.1)
};

// ---------------- النوافذ ----------------
function modal(html, cls = "") { const m = $("#modal"); m.innerHTML = `<div class="sheet ${cls}">${html}</div>`; m.hidden = false; }
const closeModal = () => { $("#modal").hidden = true; $("#modal").innerHTML = ""; };
function toast(t) {
  const el = document.createElement("div"); el.className = "t"; el.textContent = t;
  $("#toast").appendChild(el);
  setTimeout(() => el.classList.add("out"), 1900); setTimeout(() => el.remove(), 2400);
}

// ---------------- الشاشة الرئيسية ----------------
function home() {
  stopGame();
  const prog = store.get("progress", { stars: {}, best: {} });
  const total = Object.values(prog.stars).reduce((a, b) => a + b, 0);
  $("#app").innerHTML = `
    <main class="home">
      <div class="logo">
        <div class="emblem"><img src="icons/icon-192.png" alt=""></div>
        <h1>سيطرة</h1>
        <p>حرب المدن · استراتيجية بالوقت الحقيقي</p>
      </div>
      <div class="menu">
        <button class="btn big" id="campaign">🎖️ الحملة <small>${total} / ${LEVELS.length * 3} ⭐</small></button>
        <button class="btn big alt" id="quick">⚔️ معركة سريعة <small>اختر الخريطة والصعوبة</small></button>
        <div class="row">
          <button class="btn ghost" id="help">📖 كيف ألعب؟</button>
          <button class="btn ghost" id="sound">${soundOn ? "🔊" : "🔇"} الصوت</button>
        </div>
      </div>
      <p class="foot">تعمل بدون إنترنت · بلا إعلانات</p>
    </main>`;
  $("#campaign").onclick = campaign;
  $("#quick").onclick = quickSetup;
  $("#help").onclick = () => help();
  $("#sound").onclick = () => { soundOn = !soundOn; store.set("sound", soundOn); home(); };
}

function help(after = closeModal) {
  modal(`
    <h2>📖 كيف ألعب؟</h2>
    <div class="help">
      <p><b>🎯 الهدف:</b> دمّر مقرّ العدو الأحمر 🟥 قبل أن يدمّر مقرّك.</p>
      <p><b>💰 المال:</b> يأتيك دخل كل ثانية، ويزيد مع كل موقع تحتلّه: 🏘️ حي (+2) · 🏭 مصنع (+4) · 📡 برج اتصالات (يكشف مساحة واسعة).</p>
      <p><b>🏭 الشراء:</b> اضغط على الوحدة في الأسفل فتخرج من مقرّك:</p>
      <ul>
        ${UNIT_ORDER.map((t) => `<li><b>${UNITS[t].icon} ${UNITS[t].name} (${UNITS[t].cost})</b>: ${UNITS[t].about}</li>`).join("")}
      </ul>
      <p><b>👆 القيادة:</b> اختر وحداتك بأزرار الأنواع (أو اضغط على وحدة)، ثم اضغط على المكان الذي تريده في الخريطة. الوحدات تمشي في الشوارع وتقاتل كل عدو في مداها تلقائياً.</p>
      <p><b>🚩 الاحتلال:</b> المشاة فقط يحتلّون المواقع: أوقفهم داخل الدائرة حتى تمتلئ.</p>
      <p><b>🌫️ ضباب الحرب:</b> لا ترى العدو إلا قرب وحداتك ومواقعك. المسيّرات ترى بعيداً.</p>
      <p><b>🗺️ الكاميرا:</b> اسحب بإصبع لتحريك الخريطة، وبإصبعين لتقريبها وتبعيدها، واضغط على الخريطة المصغّرة للانتقال.</p>
    </div>
    <button class="btn block" id="ok">فهمت 👍</button>`);
  $("#ok").onclick = after;
}

// ---------------- الحملة ----------------
function campaign() {
  stopGame();
  const prog = store.get("progress", { stars: {}, best: {} });
  $("#app").innerHTML = `
    <main class="screen">
      <div class="top"><button class="icon" id="back">→</button><h2>🎖️ الحملة</h2><span></span></div>
      <div class="levels">${LEVELS.map((L, i) => {
        const open = i === 0 || prog.stars[i - 1] > 0;
        const st = prog.stars[i] || 0;
        return `<button class="lvl ${open ? "" : "locked"} ${st ? "done" : ""}" data-i="${i}" ${open ? "" : "disabled"}>
          <b class="n">${open ? i + 1 : "🔒"}</b>
          <span class="t">${L.title}</span>
          <small class="brief">${L.brief}</small>
          <span class="foes"><i style="background:#e5484d"></i><small>${AI[L.ai].name}</small></span>
          <span class="stars">${"★".repeat(st)}<em>${"★".repeat(3 - st)}</em></span>
          ${prog.best[i] ? `<small class="bt">⏱ ${fmt(prog.best[i])}</small>` : ""}
        </button>`;
      }).join("")}</div>
    </main>`;
  $("#back").onclick = home;
  $$(".lvl").forEach((b) => (b.onclick = () => startLevel(+b.dataset.i)));
}
const startLevel = (i) => startGame({ seed: LEVELS[i].seed, ai: LEVELS[i].ai, level: i, tutorial: LEVELS[i].tutorial });

// ---------------- المعركة السريعة ----------------
function quickSetup() {
  stopGame();
  const cfg = store.get("quick", { diff: "normal", code: seedToCode(randomSeed()) });
  $("#app").innerHTML = `
    <main class="screen">
      <div class="top"><button class="icon" id="back">→</button><h2>⚔️ معركة سريعة</h2><span></span></div>
      <div class="form">
        <label>الصعوبة</label>
        <div class="seg" data-name="diff">${Object.entries(AI).map(([k, v]) => `<button data-v="${k}" class="${cfg.diff === k ? "on" : ""}">${v.name}</button>`).join("")}</div>
        <p class="note">${"الصعب: قائد ذكي يملك موارد أكثر منك بربع"}</p>
        <label>رمز الخريطة <small>شارك الرمز مع أصدقائك وتنافسوا على أسرع انتصار في نفس المدينة</small></label>
        <div class="code"><input id="code" value="${cfg.code}" maxlength="6" dir="ltr" autocomplete="off" spellcheck="false"><button class="btn ghost" id="dice">🎲 جديدة</button></div>
        <button class="btn big block" id="go">⚔️ ابدأ المعركة</button>
      </div>
    </main>`;
  $("#back").onclick = home;
  $$(".seg button").forEach((b) => (b.onclick = () => { $$(".seg button").forEach((x) => x.classList.toggle("on", x === b)); cfg.diff = b.dataset.v; }));
  $("#dice").onclick = () => { $("#code").value = seedToCode(randomSeed()); };
  $("#go").onclick = () => {
    const seed = codeToSeed($("#code").value);
    if (seed == null) { toast("رمز الخريطة غير صحيح (6 حروف وأرقام)"); return; }
    cfg.code = seedToCode(seed); store.set("quick", cfg);
    startGame({ seed, ai: cfg.diff, code: cfg.code });
  };
}

// ---------------- المعركة ----------------
let S = null;
function stopGame() {
  if (!S) return;
  cancelAnimationFrame(S.raf);
  window.removeEventListener("resize", S.onResize);
  document.removeEventListener("visibilitychange", S.onVis);
  S = null;
}

function startGame(opts) {
  stopGame(); closeModal();
  const w = createWorld(opts.seed);
  const ai = createAI(w, 1, opts.ai);
  $("#app").innerHTML = `
    <div class="game">
      <header class="ghud">
        <button class="icon" id="pause" aria-label="إيقاف مؤقت">⏸</button>
        <div class="money"><b id="money">0</b><small id="income">+0/ث</small></div>
        <div class="hqbars"><div class="hb me"><i id="hq0"></i></div><div class="hb foe"><i id="hq1"></i></div></div>
        <div class="clock" id="clock">0:00</div>
      </header>
      <div class="tip" id="tip" hidden></div>
      <div class="stage">
        <canvas id="cv"></canvas>
        <canvas id="mini" width="96" height="151"></canvas>
        <button class="icon home-btn" id="toHq" aria-label="مقرّك">🏠</button>
      </div>
      <footer class="gfoot">
        <div class="selbar" id="selbar"></div>
        <div class="build" id="build">${UNIT_ORDER.map((t) => `<button data-u="${t}"><span class="ue">${UNITS[t].icon}</span><b>${UNITS[t].name}</b><small>${UNITS[t].cost}</small><i class="q"></i><i class="pr"></i></button>`).join("")}</div>
      </footer>
    </div>`;
  const view = createView($("#cv"), w);
  S = { opts, w, ai, view, ui: { selected: [] }, acc: 0, last: performance.now(), paused: false, speed: 1, ended: false, hudAt: 0, miniAt: 0, tip: -1, pointers: new Map() };
  resizeView(view);
  const hq = w.players[0].hq;
  view.cam = { x: hq.x, y: hq.y - 160, z: Math.max(minZoom(view), Math.min(1.3, view.cw / 420)) };
  clampCam(view);
  S.mini = createMinimap($("#mini"), view, w);
  S.onResize = () => { resizeView(view); };
  S.onVis = () => { if (document.hidden && !S.ended) pause(); };
  window.addEventListener("resize", S.onResize);
  document.addEventListener("visibilitychange", S.onVis);
  bindInput();
  $("#pause").onclick = pause;
  $("#toHq").onclick = () => { view.cam.x = hq.x; view.cam.y = hq.y - 150; clampCam(view); };
  $$("#build button").forEach((b) => (b.onclick = () => buy(b.dataset.u)));
  if (opts.tutorial) showTip(0);
  S.raf = requestAnimationFrame(frame);
}

function buy(t) {
  const w = S.w, pl = w.players[0], U = UNITS[t];
  if (pl.money < U.cost) { toast(`تحتاج ${U.cost} 💰 (معك ${Math.floor(pl.money)})`); return; }
  if (pl.queue.length >= QUEUE_MAX) { toast("قائمة الإنتاج ممتلئة"); return; }
  if (unitCount(w, 0) >= MAX_UNITS) { toast(`وصلت الحد الأقصى (${MAX_UNITS} وحدة)`); return; }
  command(w, { type: "build", p: 0, unit: t });
  sfx.select();
}

function frame(now) {
  if (!S) return;
  const { w } = S;
  if (!S.paused && !w.over) {
    S.acc += Math.min(250, now - S.last) * S.speed;
    while (S.acc >= TICK_MS) {
      think(w, S.ai);
      if (S.auto) think(w, S.auto);
      step(w);
      S.acc -= TICK_MS;
      for (const ev of w.events.splice(0)) onEvent(ev, now);
      if (w.over) break;
    }
  }
  S.last = now;
  render(S.view, w, S.ui, now, S.paused ? 1 : Math.min(1, S.acc / TICK_MS));
  if (now - S.miniAt > 250) { S.miniAt = now; renderMinimap(S.mini, S.view, w); }
  if (now - S.hudAt > 150) { S.hudAt = now; hud(); }
  if (w.over && !S.ended) { S.ended = true; setTimeout(result, 1600); }
  S.raf = requestAnimationFrame(frame);
}

// هل الحدث قريب من الكاميرا؟ (لا نُسمع أصوات المعارك البعيدة)
const nearCam = (x, y) => { const v = S.view; return Math.abs(x - v.cam.x) < v.cw / v.cam.z && Math.abs(y - v.cam.y) < v.ch / v.cam.z; };
function onEvent(ev, now) {
  const w = S.w;
  addEvent(S.view, ev, now);
  if (ev.type === "shot" && nearCam(ev.x, ev.y) && (ev.p === 0 || w.vis[0][Math.floor(ev.y / 50) * w.gw + Math.floor(ev.x / 50)])) (ev.kind === "tank" ? sfx.cannon : sfx.rifle)();
  if (ev.type === "artyFire" && ev.p === 0) sfx.arty();
  if ((ev.type === "boom" || (ev.type === "death" && (ev.unit === "tank" || ev.unit === "artillery"))) && nearCam(ev.x, ev.y)) sfx.boom();
  if (ev.type === "spawn" && ev.p === 0) { sfx.ready(); if (S.opts.tutorial) tutorial("spawn"); }
  if (ev.type === "captured") {
    const pt = w.points[ev.id];
    if (ev.p === 0) { sfx.capture(); toast(`🚩 احتللت ${POINT_TYPES[pt.type].name}! دخلك +${POINT_TYPES[pt.type].income}/ث`); if (S.opts.tutorial) tutorial("capture"); }
    else { toast(`⚠️ العدو احتلّ ${POINT_TYPES[pt.type].name}`); }
  }
  if (ev.type === "neutral" && ev.from === 0) { sfx.lost(); toast("⚠️ العدو يحتلّ أحد مواقعك!"); }
  if (ev.type === "death" && ev.p === 0) S.ui.selected = S.ui.selected.filter((id) => w.units.some((u) => u.id === id));
}

function hud() {
  const { w } = S, pl = w.players[0];
  $("#money").textContent = Math.floor(pl.money);
  $("#income").textContent = `+${incomeOf(w, 0)}/ث`;
  $("#hq0").style.width = `${Math.max(0, pl.hq.hp / HQ.hp) * 100}%`;
  $("#hq1").style.width = `${Math.max(0, w.players[1].hq.hp / HQ.hp) * 100}%`;
  $("#clock").textContent = fmt(seconds(w));
  // أزرار الشراء: السعر، قائمة الانتظار، تقدّم الإنتاج
  const q = pl.queue;
  $$("#build button").forEach((b) => {
    const t = b.dataset.u;
    b.classList.toggle("poor", pl.money < UNITS[t].cost);
    const n = q.filter((x) => x.unit === t).length;
    b.querySelector(".q").textContent = n ? n : "";
    b.querySelector(".pr").style.width = q[0]?.unit === t ? `${(1 - q[0].t / q[0].total) * 100}%` : "0";
  });
  // أزرار التحديد حسب النوع
  const mine = w.units.filter((u) => u.p === 0);
  const counts = {}; for (const u of mine) counts[u.type] = (counts[u.type] || 0) + 1;
  const sel = new Set(S.ui.selected);
  const html = `<button data-s="all" class="${mine.length && mine.every((u) => sel.has(u.id)) ? "on" : ""}" ${mine.length ? "" : "disabled"}>الكل <b>${mine.length}</b></button>` +
    UNIT_ORDER.map((t) => `<button data-s="${t}" class="${counts[t] && mine.filter((u) => u.type === t).every((u) => sel.has(u.id)) && sel.size === counts[t] ? "on" : ""}" ${counts[t] ? "" : "disabled"}>${UNITS[t].icon} <b>${counts[t] || 0}</b></button>`).join("") +
    `<button data-s="none" ${sel.size ? "" : "disabled"}>✖</button>`;
  const bar = $("#selbar");
  if (bar.dataset.h !== html) {
    bar.innerHTML = html; bar.dataset.h = html;
    bar.querySelectorAll("button").forEach((b) => (b.onclick = () => selectGroup(b.dataset.s)));
  }
}

function selectGroup(kind) {
  const mine = S.w.units.filter((u) => u.p === 0);
  S.ui.selected = kind === "none" ? [] : mine.filter((u) => kind === "all" || u.type === kind).map((u) => u.id);
  if (S.ui.selected.length) sfx.select();
  if (S.opts.tutorial && S.ui.selected.length) tutorial("select");
  hud();
}

// ---------------- اللمس: سحب = تحريك الكاميرا، إصبعان = تقريب، نقرة = اختيار أو أمر ----------------
function bindInput() {
  const cv = $("#cv"), v = S.view;
  const P = S.pointers;
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    P.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, t: performance.now() });
    if (P.size === 2) { const [a, b] = [...P.values()]; S.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: v.cam.z }; }
  });
  cv.addEventListener("pointermove", (e) => {
    const p = P.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 9) p.moved = true;
    if (P.size === 1 && p.moved) { v.cam.x -= dx / v.cam.z; v.cam.y -= dy / v.cam.z; clampCam(v); }
    else if (P.size === 2 && S.pinch) {
      const [a, b] = [...P.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      v.cam.z = S.pinch.z * (d / S.pinch.d);
      v.cam.x -= dx / 2 / v.cam.z; v.cam.y -= dy / 2 / v.cam.z;
      clampCam(v);
    }
  });
  const end = (e) => {
    const p = P.get(e.pointerId);
    P.delete(e.pointerId);
    if (P.size < 2) S.pinch = null;
    if (!p || p.moved || S.paused || S.w.over || P.size) return;
    const r = cv.getBoundingClientRect();
    tap(screenToWorld(v, e.clientX - r.left, e.clientY - r.top));
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", (e) => { P.delete(e.pointerId); S.pinch = null; });
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const before = screenToWorld(v, e.clientX - r.left, e.clientY - r.top);
    v.cam.z *= e.deltaY < 0 ? 1.12 : 0.89; clampCam(v);
    const after = screenToWorld(v, e.clientX - r.left, e.clientY - r.top);
    v.cam.x += before.x - after.x; v.cam.y += before.y - after.y; clampCam(v);
  }, { passive: false });
  // الخريطة المصغّرة
  const mini = $("#mini");
  const jump = (e) => {
    const r = mini.getBoundingClientRect();
    v.cam.x = ((e.clientX - r.left) / r.width) * S.w.city.W;
    v.cam.y = ((e.clientY - r.top) / r.height) * S.w.city.H;
    clampCam(v);
  };
  mini.addEventListener("pointerdown", (e) => { mini.setPointerCapture(e.pointerId); jump(e); });
  mini.addEventListener("pointermove", (e) => { if (e.buttons) jump(e); });
}

function tap(pt) {
  const w = S.w, ui = S.ui;
  const R = 26 / Math.min(1, S.view.cam.z);
  // وحدة لك تحت الإصبع؟
  const own = w.units.filter((u) => u.p === 0).map((u) => ({ u, d: Math.hypot(u.x - pt.x, u.y - pt.y) })).filter((x) => x.d < R).sort((a, b) => a.d - b.d)[0];
  if (own) {
    const id = own.u.id;
    if (ui.selected.length === 1 && ui.selected[0] === id) ui.selected = [];
    else ui.selected = [id];
    sfx.select(); hud();
    return;
  }
  if (ui.selected.length) {
    command(w, { type: "move", p: 0, ids: [...ui.selected], x: pt.x, y: pt.y });
    S.view.markers.push({ x: pt.x, y: pt.y, t0: performance.now() });
    sfx.order();
    if (S.opts.tutorial) tutorial("move", pt);
    return;
  }
  // معلومات الموقع عند النقر عليه دون تحديد
  const p = pointAt(w.city, pt.x, pt.y);
  if (p) {
    const live = w.points[p.id], T = POINT_TYPES[live.type];
    const who = live.owner === 0 ? "لك" : live.owner === 1 ? "للعدو" : "محايد";
    toast(`${T.icon} ${T.name} · ${who}${T.income ? ` · دخل +${T.income}/ث` : ""}`);
  } else toast("اختر وحداتك أولاً من الأزرار في الأسفل");
}

// ---------------- الدرس الأول ----------------
const TIPS = [
  "🪖 اشترِ 3 مشاة من الأزرار في الأسفل (تخرج من مقرّك)",
  "👆 اضغط زر «🪖» فوق أزرار الشراء لتختار المشاة",
  "🚩 الآن اضغط على ساحة قريبة (دائرة رمادية فيها علم) ليذهبوا ويحتلّوها",
  "💰 ممتاز! كل موقع تحتلّه يزيد دخلك. احتلّ مواقع أكثر",
  "🛡️ اشترِ مدرّعات ومشاة، ثم أرسل جيشك إلى مقرّ الأحمر في الشمال ودمّره"
];
function showTip(k) {
  S.tip = k;
  const t = $("#tip");
  if (k >= TIPS.length) { t.hidden = true; return; }
  t.hidden = false; t.textContent = TIPS[k];
}
function tutorial(kind) {
  const w = S.w;
  const inf = w.units.filter((u) => u.p === 0 && u.type === "infantry").length;
  if (S.tip === 0 && kind === "spawn" && inf >= 3) showTip(1);
  else if (S.tip === 1 && kind === "select") showTip(2);
  else if (S.tip === 2 && kind === "move") setTimeout(() => S && S.tip === 2 && showTip(2.5), 10);
  else if ((S.tip === 2 || S.tip === 2.5) && kind === "capture") showTip(3);
  else if (S.tip === 3 && kind === "capture") { showTip(4); setTimeout(() => S && S.tip === 4 && showTip(9), 20000); }
  if (S.tip === 2.5) $("#tip").textContent = "⏳ المشاة في طريقهم. سيحتلّون الساحة حين يقفون داخل الدائرة";
}

// ---------------- الإيقاف المؤقت ----------------
function pause() {
  if (!S || S.ended) return;
  S.paused = true;
  modal(`
    <h2>⏸ استراحة</h2>
    <div class="col">
      <button class="btn block" id="resume">▶ تابع المعركة</button>
      <div class="seg" id="spd">${[1, 1.5, 2].map((x) => `<button data-v="${x}" class="${S.speed === x ? "on" : ""}">سرعة ×${x}</button>`).join("")}</div>
      <button class="btn block alt" id="restart">🔄 أعد المعركة</button>
      <button class="btn block ghost" id="helpP">📖 كيف ألعب؟</button>
      <button class="btn block ghost" id="soundP">${soundOn ? "🔊 الصوت يعمل" : "🔇 الصوت مطفأ"}</button>
      <button class="btn block ghost" id="quit">🏳️ انسحب إلى القائمة</button>
    </div>`);
  $("#resume").onclick = () => { closeModal(); S.paused = false; S.last = performance.now(); };
  $$("#spd button").forEach((b) => (b.onclick = () => { S.speed = +b.dataset.v; $$("#spd button").forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#restart").onclick = () => startGame(S.opts);
  $("#helpP").onclick = () => help(pause);
  $("#soundP").onclick = () => { soundOn = !soundOn; store.set("sound", soundOn); pause(); };
  $("#quit").onclick = () => { closeModal(); S.opts.level != null ? campaign() : home(); };
}

// ---------------- النتيجة ----------------
function result() {
  if (!S) return;
  const { w, opts } = S;
  const won = w.winner === 0;
  const secs = seconds(w);
  const st = w.stats[0];
  won ? sfx.win() : sfx.lose();
  let extra = "";
  if (opts.level != null) {
    const L = LEVELS[opts.level];
    const stars = starsFor(L, won, secs);
    const prog = store.get("progress", { stars: {}, best: {} });
    if (stars > (prog.stars[opts.level] || 0)) prog.stars[opts.level] = stars;
    if (won && (!prog.best[opts.level] || secs < prog.best[opts.level])) prog.best[opts.level] = secs;
    store.set("progress", prog);
    extra = `<div class="bigstars">${"★".repeat(stars)}<em>${"★".repeat(3 - stars)}</em></div>${won ? `<p class="par">⭐⭐⭐ في أقل من ${fmt(L.par)} · أفضل وقت لك: ${fmt(prog.best[opts.level])}</p>` : ""}`;
  } else if (opts.code) {
    const key = `${opts.code}-${opts.ai}`;
    const bests = store.get("codes", {});
    const prev = bests[key];
    if (won && (!prev || secs < prev)) { bests[key] = secs; store.set("codes", bests); }
    extra = `<p class="par">رمز المدينة: <b dir="ltr">${opts.code}</b> · ${AI[opts.ai].name}${won ? ` · ${!prev || secs < prev ? "🏆 أفضل وقت لك!" : `أفضل وقت لك: ${fmt(prev)}`}` : ""}</p>`;
  }
  const next = opts.level != null && won && opts.level < LEVELS.length - 1;
  modal(`
    <div class="res-icon">${won ? "🏆" : "🏳️"}</div>
    <h2>${won ? "انتصرت! سقط مقرّ العدو" : "سقط مقرّك"}</h2>
    ${extra}
    <div class="sgrid">
      <div><b>${fmt(secs)}</b><small>مدة المعركة</small></div>
      <div><b>${st.kills}</b><small>وحدات دمّرتها</small></div>
      <div><b>${st.lost}</b><small>وحدات خسرتها</small></div>
      <div><b>${st.captured}</b><small>مواقع احتللتها</small></div>
    </div>
    <div class="col">
      ${next ? `<button class="btn block" id="next">المعركة التالية ⬅</button>` : ""}
      <button class="btn block ${next ? "alt" : ""}" id="again">🔄 ${won ? "العب مجدداً" : "حاول مجدداً"}</button>
      <button class="btn block ghost" id="menu">القائمة</button>
    </div>`, "result");
  if ($("#next")) $("#next").onclick = () => startLevel(opts.level + 1);
  $("#again").onclick = () => startGame(opts);
  $("#menu").onclick = () => { closeModal(); opts.level != null ? campaign() : home(); };
}

$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" && !S) closeModal(); });
home();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
// للاختبارات الآلية فقط (?test): يجعل جيشك الأزرق يقاتل آلياً
if (/[?&]test\b/.test(location.search)) window.__sy = { get S() { return S; }, autoplay(level = "hard") { S.auto = createAI(S.w, 0, level); S.w.players[0].incomeMul = 1; } };
