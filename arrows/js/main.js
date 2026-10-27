// ============================================================
//  فكّ المتاهة: الشاشات، الرسم والحركة، اللمس (نقر، سحب، تقريب)، القلوب والنجوم والتلميحات، والحفظ
// ============================================================
import { DIRS, DIFFS, levelSpec, dailySpec, generate, makeBoard, blocker, exitLength, removeArrow, freeArrows, SHAPE_NAMES } from "./gen.js";
import { sfx, setSound, unlock } from "./sound.js";

const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const isTest = /[?&]test\b/.test(location.search);
const KEY = "arrows-v1-";
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} }
};
// التقدّم مستقل لكل مسار صعوبة: tracks[diff] = { level (أعلى مستوى مفتوح), stars, best }
const blank = () => ({ level: 1, stars: {}, best: {} });
const P = {
  tracks: store.get("tracks", null) || { normal: { level: store.get("level", 1), stars: store.get("stars", {}), best: store.get("best", {}) }, hard: blank(), expert: blank() },
  diff: store.get("diff", "normal"),
  hints: store.get("hints", 5),
  daily: store.get("daily", {}),            // daily[YYYY-MM-DD] = نجوم
  settings: { sound: true, vibe: true, theme: "paper", colors: false, size: "m", ...store.get("settings", {}) },
  tut: store.get("tut", 0)
};
for (const d of Object.keys(DIFFS)) P.tracks[d] = P.tracks[d] || blank();
if (!DIFFS[P.diff]) P.diff = "normal";
// P.level و P.stars و P.best تشير إلى المسار المختار حالياً
for (const k of ["level", "stars", "best"]) Object.defineProperty(P, k, { get: () => P.tracks[P.diff][k], set: (v) => { P.tracks[P.diff][k] = v; } });
const save = () => { for (const k of ["tracks", "diff", "hints", "daily", "settings", "tut"]) store.set(k, P[k]); };
// حجم الأسهم: سماكة الخط وأقصى حجم للخلية على الشاشة
export const SIZES = { s: { name: "صغير", lw: 0.12, max: 40 }, m: { name: "متوسط", lw: 0.15, max: 50 }, l: { name: "كبير", lw: 0.19, max: 64 } };
const sizeOf = () => SIZES[P.settings.size] || SIZES.m;
setSound(P.settings.sound);
const vibe = (ms) => { if (P.settings.vibe) try { navigator.vibrate?.(ms); } catch {} };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const totalStars = () => Object.values(P.tracks).reduce((a, t) => a + Object.values(t.stars).reduce((x, y) => x + y, 0), 0);

// ---------------- الألوان ----------------
export const THEMES = {
  paper: { name: "ورق", bg: "#e9ece4", board: "#f8f7f2", edge: "#d7d4c8", dot: "#cfcbbe", ink: "#2e3a44", palette: ["#2e3a44", "#3f5566", "#4b4453", "#36505a"], ui: "light" },
  night: { name: "ليل", bg: "#0d1220", board: "#151d2f", edge: "#26314a", dot: "#2a3550", ink: "#e6edf9", palette: ["#5ee7ff", "#ff7ad9", "#ffd166", "#7cff9b", "#a78bfa", "#ff8a5b"], ui: "dark" },
  ocean: { name: "بحر", bg: "#d9f0f4", board: "#ffffff", edge: "#b9dce4", dot: "#cde6ec", ink: "#0f4c64", palette: ["#0f4c64", "#1679a1", "#12a3a3", "#3a6ea5", "#0b6e8a"], ui: "light" },
  candy: { name: "حلوى", bg: "#fff0f6", board: "#ffffff", edge: "#f6cfe0", dot: "#f7dbe7", ink: "#5b2a4a", palette: ["#ff4d8d", "#7b61ff", "#00b894", "#ff9f1c", "#2ec4f1", "#e84393"], ui: "light" }
};
const theme = () => THEMES[P.settings.theme] || THEMES.paper;
function applyTheme() {
  const t = theme();
  document.documentElement.dataset.ui = t.ui;
  document.documentElement.style.setProperty("--bg", t.bg);
  document.documentElement.style.setProperty("--ink", t.ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.bg);
}

// ---------------- النوافذ والتنبيهات ----------------
function modal(html, cls = "") { const m = $("#modal"); m.innerHTML = `<div class="sheet ${cls}">${html}</div>`; m.hidden = false; }
const closeModal = () => { $("#modal").hidden = true; $("#modal").innerHTML = ""; };
function toast(t) {
  const box = $("#toast"); while (box.children.length > 1) box.firstChild.remove();
  const el = document.createElement("div"); el.className = "t"; el.textContent = t; box.appendChild(el);
  setTimeout(() => el.classList.add("out"), 1800); setTimeout(() => el.remove(), 2300);
}
document.addEventListener("pointerdown", unlock, { passive: true });

// ============================================================
//  محرّك اللوحة: يُستخدم في اللعب وفي العرض المتحرك في الشاشة الرئيسية
// ============================================================
function createEngine(canvas, level, opts = {}) {
  const ctx = canvas.getContext("2d");
  const board = makeBoard(level);
  const E = {
    level, board, canvas, ctx, view: { s: 20, ox: 0, oy: 0, fit: 20 }, anims: new Map(), flash: new Map(), parts: [],
    shakeT: -1e9, hint: null, pressed: -1, opts, dpr: 1, cw: 0, ch: 0, dirty: true
  };
  // مسار كل سهم ممدّداً حتى خارج اللوحة (بوحدة الخلية)
  E.paths = level.arrows.map((a) => {
    const pts = a.cells.map(([x, y]) => [x + 0.5, y + 0.5]);
    const [dx, dy] = DIRS[a.dir], [hx, hy] = pts[pts.length - 1];
    const ext = exitLength(board, a) + a.cells.length + 4;
    for (let k = 1; k <= ext; k++) pts.push([hx + dx * k, hy + dy * k]);
    return pts;
  });
  E.resize = () => {
    const r = canvas.getBoundingClientRect();
    E.dpr = Math.min(3, window.devicePixelRatio || 1); E.cw = r.width; E.ch = r.height;
    canvas.width = Math.max(1, Math.round(r.width * E.dpr)); canvas.height = Math.max(1, Math.round(r.height * E.dpr));
    fit();
  };
  function fit() {
    const pad = opts.pad ?? 18;
    const s = Math.min((E.cw - pad * 2) / level.w, (E.ch - pad * 2) / level.h, opts.maxCell ?? sizeOf().max);
    E.view = { s, fit: s, ox: (E.cw - s * level.w) / 2, oy: (E.ch - s * level.h) / 2 };
    E.dirty = true;
  }
  E.fit = fit;
  E.clampView = () => {
    const v = E.view, bw = v.s * level.w, bh = v.s * level.h, m = 60;
    v.ox = bw <= E.cw ? (E.cw - bw) / 2 : Math.min(m, Math.max(E.cw - bw - m, v.ox));
    v.oy = bh <= E.ch ? (E.ch - bh) / 2 : Math.min(m, Math.max(E.ch - bh - m, v.oy));
  };
  E.zoomAt = (px, py, f) => {
    const v = E.view, ns = Math.max(v.fit, Math.min(Math.max(v.fit * 3.2, 46), v.s * f));
    v.ox = px - ((px - v.ox) * ns) / v.s; v.oy = py - ((py - v.oy) * ns) / v.s; v.s = ns;
    E.clampView(); E.dirty = true;
  };
  // أي سهم تحت الإصبع (مع هامش للأصابع على اللوحات الكبيرة)
  E.hit = (px, py) => {
    const v = E.view, gx = (px - v.ox) / v.s, gy = (py - v.oy) / v.s;
    const tol = Math.max(0.55, Math.min(1.1, 22 / v.s));
    let best = -1, bd = 1e9;
    for (let y = Math.floor(gy - tol); y <= Math.floor(gy + tol); y++) for (let x = Math.floor(gx - tol); x <= Math.floor(gx + tol); x++) {
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) continue;
      const id = board.occ[y * level.w + x]; if (id < 0) continue;
      const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
      if (d < bd && d < tol + 0.25) { bd = d; best = id; }
    }
    return best;
  };
  // الضغط على سهم: يخرج إن كان حراً، وإلا يرتدّ عن العائق
  E.tap = (id, now = performance.now()) => {
    if (id < 0 || !board.alive.has(id) || E.anims.get(id)?.type === "exit") return null;
    const a = level.arrows[id], blk = blocker(board, a);
    if (!blk) {
      removeArrow(board, id);
      E.anims.set(id, { type: "exit", t0: now, total: exitLength(board, a) + a.cells.length + 1.5 });
      if (E.hint && E.hint.id === id) E.hint = null;
      E.dirty = true;
      return { ok: true };
    }
    E.anims.set(id, { type: "bump", t0: now, dist: blk.dist });
    E.flash.set(blk.id, now + 140);
    E.shakeT = now;
    E.dirty = true;
    return { ok: false, by: blk.id };
  };
  E.busy = () => [...E.anims.values()].some((a) => a.type === "exit");
  E.screenOf = (id) => {
    const a = level.arrows[id], [x, y] = a.cells[Math.floor((a.cells.length - 1) / 2)], v = E.view;
    return { x: v.ox + (x + 0.5) * v.s, y: v.oy + (y + 0.5) * v.s };
  };
  E.burst = (x, y, color, n = 10) => {
    for (let i = 0; i < n; i++) { const an = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3; E.parts.push({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 1, life: 0.6 + Math.random() * 0.4, t: 0, c: color, r: 0.06 + Math.random() * 0.08 }); }
  };
  E.confetti = () => {
    const cols = ["#ff4d6d", "#ffd166", "#06d6a0", "#118ab2", "#a78bfa", "#ff8a5b"];
    for (let i = 0; i < 140; i++) E.parts.push({ x: Math.random() * level.w, y: -1 - Math.random() * 4, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, life: 2.6 + Math.random(), t: 0, c: cols[i % cols.length], r: 0.12 + Math.random() * 0.1, conf: true, rot: Math.random() * 6 });
    E.dirty = true;
  };

  // ---------- الرسم ----------
  const pAt = (pts, t) => {
    if (t <= 0) { const [a, b] = [pts[0], pts[1]]; return [a[0] + (a[0] - b[0]) * -t, a[1] + (a[1] - b[1]) * -t]; }
    const i = Math.floor(t);
    if (i >= pts.length - 1) { const a = pts[pts.length - 2], b = pts[pts.length - 1], k = t - (pts.length - 1); return [b[0] + (b[0] - a[0]) * k, b[1] + (b[1] - a[1]) * k]; }
    const a = pts[i], b = pts[i + 1], k = t - i;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  function drawArrow(id, off, color, widthMul = 1, alpha = 1) {
    const a = level.arrows[id], pts = E.paths[id], v = E.view, n = a.cells.length;
    const t0 = off - 0.36, t1 = off + n - 1 + 0.02;
    const line = [pAt(pts, t0)];
    for (let i = Math.ceil(t0); i <= Math.floor(t1); i++) if (i > t0 && i < t1) line.push(pts[i]);
    const head = pAt(pts, t1);
    line.push(head);
    const hd = pAt(pts, t1 + 0.01), dx = hd[0] - head[0], dy = hd[1] - head[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const X = (p) => v.ox + p[0] * v.s, Y = (p) => v.oy + p[1] * v.s;
    const lwF = sizeOf().lw, lw = Math.max(2, v.s * lwF) * widthMul;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(X(line[0]), Y(line[0])); for (let i = 1; i < line.length; i++) ctx.lineTo(X(line[i]), Y(line[i])); ctx.stroke();
    // رأس السهم
    const tipL = (0.16 + lwF * 1.3) * widthMul ** 0.5, half = Math.max(0.14 + lwF * 0.4, (lw / v.s) * 1.25);
    const tip = [head[0] + ux * tipL, head[1] + uy * tipL], bx = head[0] - ux * 0.04, by = head[1] - uy * 0.04;
    ctx.beginPath();
    ctx.moveTo(X(tip), Y(tip));
    ctx.lineTo(v.ox + (bx - uy * half) * v.s, v.oy + (by + ux * half) * v.s);
    ctx.lineTo(v.ox + (bx + uy * half) * v.s, v.oy + (by - ux * half) * v.s);
    ctx.closePath(); ctx.lineWidth = Math.max(1, lw * 0.35); ctx.stroke(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  const colorOf = (id) => { const t = theme(); return P.settings.colors || opts.colors ? t.palette[(id * 7 + 3) % t.palette.length] : t.ink; };
  E.draw = (now) => {
    const t = theme(), v = E.view;
    ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
    ctx.clearRect(0, 0, E.cw, E.ch);
    // اهتزاز عند الخطأ
    const sk = (now - E.shakeT) / 320;
    ctx.save();
    if (sk < 1) ctx.translate(Math.sin(sk * 40) * 5 * (1 - sk), 0);
    // اللوحة
    const m = level.mask, w = level.w, h = level.h, r = v.s * 0.22;
    const full = m.every((x) => x);
    ctx.fillStyle = "rgba(0,0,0,.08)";
    const shapePath = (dx, dy, grow) => {
      ctx.beginPath();
      if (full) ctx.roundRect(v.ox - grow + dx, v.oy - grow + dy, w * v.s + grow * 2, h * v.s + grow * 2, r + grow);
      else for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) ctx.rect(v.ox + x * v.s - grow + dx, v.oy + y * v.s - grow + dy, v.s + grow * 2, v.s + grow * 2);
    };
    shapePath(0, v.s * 0.12, v.s * 0.16); ctx.fill();
    ctx.fillStyle = t.edge; shapePath(0, 0, v.s * 0.16); ctx.fill();
    ctx.fillStyle = t.board; shapePath(0, 0, v.s * 0.08); ctx.fill();
    // نقاط الخلايا الفارغة
    ctx.fillStyle = t.dot;
    const dr = Math.max(1, v.s * 0.05);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x] && board.occ[y * w + x] < 0) { ctx.beginPath(); ctx.arc(v.ox + (x + 0.5) * v.s, v.oy + (y + 0.5) * v.s, dr, 0, 7); ctx.fill(); }
    // التلميح: مسار منقّط وتوهّج
    if (E.hint && board.alive.has(E.hint.id)) {
      const k = (now - E.hint.t0) / 1000, a = level.arrows[E.hint.id], pts = E.paths[E.hint.id];
      const n = a.cells.length, ex = exitLength(board, a);
      ctx.setLineDash([v.s * 0.12, v.s * 0.22]); ctx.lineDashOffset = -k * v.s * 1.2;
      ctx.strokeStyle = "#f5a524"; ctx.lineWidth = Math.max(2, v.s * 0.1); ctx.lineCap = "round";
      const h0 = pAt(pts, n - 1 + 0.45), h1 = pAt(pts, n - 1 + ex + 0.4);
      ctx.beginPath(); ctx.moveTo(v.ox + h0[0] * v.s, v.oy + h0[1] * v.s); ctx.lineTo(v.ox + h1[0] * v.s, v.oy + h1[1] * v.s); ctx.stroke();
      ctx.setLineDash([]);
      drawArrow(E.hint.id, 0, `rgba(245,165,36,${0.35 + 0.25 * Math.sin(k * 6)})`, 2.4);
    }
    // الأسهم الثابتة
    const order = [...board.alive].filter((id) => !E.anims.has(id));
    for (const id of order) {
      const fl = E.flash.get(id);
      const red = fl && now < fl + 650 && now > fl;
      drawArrow(id, 0, red ? (Math.floor((now - fl) / 110) % 2 ? "#e5484d" : "#ff8f8f") : colorOf(id), id === E.pressed ? 1.25 : 1);
    }
    // الأسهم المتحركة
    for (const [id, an] of E.anims) {
      const el = (now - an.t0) / 1000;
      if (an.type === "bump") {
        const D = 0.32, k = el / D;
        if (k >= 1) { E.anims.delete(id); continue; }
        const reach = Math.max(0.16, an.dist + 0.06);
        const off = reach * (k < 0.4 ? Math.sin((k / 0.4) * Math.PI / 2) : Math.cos(((k - 0.4) / 0.6) * Math.PI / 2));
        drawArrow(id, off, "#e5484d", 1.1);
      } else {
        const off = 7 * el + 45 * el * el;
        const a = level.arrows[id], n = a.cells.length, ex = exitLength(board, a);
        if (off > n - 1 + ex + 1.2) { E.anims.delete(id); continue; }
        const fade = Math.min(1, Math.max(0, (n - 1 + ex + 1.2 - off) / 1.6));
        drawArrow(id, off, colorOf(id), 1, fade);
      }
    }
    // جسيمات
    for (const p of E.parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c;
      if (p.conf) { ctx.save(); ctx.translate(v.ox + p.x * v.s, v.oy + p.y * v.s); ctx.rotate(p.rot + p.t * 6); ctx.fillRect(-p.r * v.s, -p.r * v.s * 0.5, p.r * v.s * 2, p.r * v.s); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(v.ox + p.x * v.s, v.oy + p.y * v.s, p.r * v.s, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  };
  E.tick = (dt) => {
    for (const p of E.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.conf ? 3 : 6) * dt; if (p.conf) p.vx *= 0.99; }
    E.parts = E.parts.filter((p) => p.t < p.life);
    return E.anims.size || E.parts.length || E.hint || (E.flash.size && [...E.flash.values()].some((f) => performance.now() < f + 700)) || performance.now() - E.shakeT < 400;
  };
  E.resize();
  return E;
}

// ============================================================
//  الحلقة: نرسم فقط عند وجود حركة أو تغيير
// ============================================================
let G = null, DEMO = null, last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  for (const E of [G?.E, DEMO?.E]) {
    if (!E) continue;
    const moving = E.tick(dt);
    if (moving || E.dirty) { E.draw(now); E.dirty = !!moving; }
  }
  if (DEMO) demoStep(now);
  if (G) gameStep(now);
  requestAnimationFrame(frame);
}

// ---------------- الشاشة الرئيسية مع لوحة تحلّ نفسها ----------------
function home() {
  stopGame(); closeModal();
  applyTheme();
  const daily = P.daily[today()];
  $("#app").innerHTML = `
    <main class="home">
      <div class="hero"><canvas id="demo"></canvas></div>
      <h1 class="logo">فكّ <b>المتاهة</b></h1>
      <p class="tag">اضغط السهم الذي طريقه فارغ… وأفرغ اللوحة</p>
      <div class="menu">
        ${diffSeg()}
        <button class="btn big" id="play"><span>▶</span> المستوى ${P.level}</button>
        <div class="row">
          <button class="btn alt" id="levels">🗂️ المستويات</button>
          <button class="btn alt ${daily ? "done" : ""}" id="daily">📅 تحدّي اليوم${daily ? ` <small>${"★".repeat(daily)}</small>` : ""}</button>
        </div>
        <div class="row">
          <button class="btn ghost" id="help">❔ كيف ألعب</button>
          <button class="btn ghost" id="settings">⚙️ الإعدادات</button>
        </div>
      </div>
      <p class="foot">⭐ ${totalStars()} · 💡 ${P.hints} · تعمل بدون إنترنت</p>
    </main>`;
  $("#play").onclick = () => startLevel(P.level);
  bindDiffSeg(home);
  $("#levels").onclick = () => levels();
  $("#daily").onclick = () => startDaily();
  $("#help").onclick = () => help();
  $("#settings").onclick = settings;
  startDemo();
}
function diffSeg() {
  return `<div class="diffs">${Object.entries(DIFFS).map(([k, d]) => `<button data-d="${k}" class="${P.diff === k ? "on" : ""}"><span>${d.icon}</span>${d.name}<small>${P.tracks[k].level - 1 ? "✓ " + (P.tracks[k].level - 1) : ""}</small></button>`).join("")}</div>`;
}
function bindDiffSeg(again) {
  $$(".diffs button").forEach((b) => (b.onclick = () => { if (P.diff === b.dataset.d) return; P.diff = b.dataset.d; save(); sfx.click(); again(); if (b.dataset.d === "expert" && !store.get("expertSeen", false)) { store.set("expertSeen", true); toast("💀 الخبير: لوحات أكبر، أسهم أطول وأكثر تشابكاً، وقلبان فقط"); } }));
}
let demoSeed = 1;
function startDemo() {
  const cv = $("#demo"); if (!cv) return;
  const L = generate({ seed: 4242 + demoSeed++ * 13, w: 7, h: 7, shape: "square", maxLen: 6, turn: 0.35, lock: 1.5 });
  DEMO = { E: createEngine(cv, L, { pad: 6, colors: P.settings.theme !== "paper" }), next: performance.now() + 900 };
}
function demoStep(now) {
  if (!document.body.contains(DEMO.E.canvas)) { DEMO = null; return; }
  if (now < DEMO.next) return;
  const E = DEMO.E;
  if (!E.board.alive.size) { if (!E.anims.size) { DEMO.next = now + 700; startDemo(); } return; }
  const f = freeArrows(E.board);
  E.tap(f[Math.floor(Math.random() * f.length)], now);
  DEMO.next = now + 420;
}

function help(after = closeModal) {
  modal(`
    <h2>❔ كيف ألعب؟</h2>
    <div class="howto">
      <div class="step"><span class="ic">👆</span><p>اضغط على سهم، فينزلق في اتجاه رأسه ويخرج من اللوحة.</p></div>
      <div class="step"><span class="ic">🚧</span><p>السهم يخرج فقط إذا كان <b>الطريق أمام رأسه فارغاً</b> حتى حافة اللوحة. إن اصطدم بسهم آخر يرتدّ و<b>تخسر قلباً</b> ❤️.</p></div>
      <div class="step"><span class="ic">🏁</span><p>أفرغ اللوحة كلها لتفوز. بلا أخطاء = ⭐⭐⭐.</p></div>
      <div class="step"><span class="ic">💡</span><p>التلميح يضيء سهماً حراً. تربح تلميحاً مع كل مستوى تنهيه.</p></div>
      <div class="step"><span class="ic">🔍</span><p>في اللوحات الكبيرة: قرّب بإصبعين واسحب لتتحرك.</p></div>
    </div>
    <button class="btn block" id="ok">فهمت 👍</button>`);
  $("#ok").onclick = after;
}

function settings() {
  const S = P.settings;
  modal(`
    <h2>⚙️ الإعدادات</h2>
    <div class="form">
      <label class="sw"><span>🔊 الأصوات</span><input type="checkbox" id="s_sound" ${S.sound ? "checked" : ""}></label>
      <label class="sw"><span>📳 الاهتزاز</span><input type="checkbox" id="s_vibe" ${S.vibe ? "checked" : ""}></label>
      <label class="sw"><span>🌈 أسهم ملوّنة</span><input type="checkbox" id="s_colors" ${S.colors ? "checked" : ""}></label>
      <p class="lbl">حجم الأسهم</p>
      <div class="seg" id="s_size">${Object.entries(SIZES).map(([k, z]) => `<button data-z="${k}" class="${(S.size || "m") === k ? "on" : ""}"><i style="--w:${z.lw * 30}px"></i>${z.name}</button>`).join("")}</div>
      <p class="lbl">الألوان</p>
      <div class="themes">${Object.entries(THEMES).map(([k, t]) => `<button data-t="${k}" class="${S.theme === k ? "on" : ""}" style="--a:${t.board};--b:${t.ink};--c:${t.bg}"><i></i>${t.name}</button>`).join("")}</div>
      <button class="btn ghost block danger" id="reset">🗑️ مسح التقدّم</button>
    </div>
    <button class="btn block" id="ok">تم</button>`);
  $("#s_sound").onchange = (e) => { S.sound = e.target.checked; setSound(S.sound); save(); };
  $("#s_vibe").onchange = (e) => { S.vibe = e.target.checked; save(); vibe(30); };
  $("#s_colors").onchange = (e) => { S.colors = e.target.checked; save(); if (G) G.E.dirty = true; };
  $$("#s_size button").forEach((b) => (b.onclick = () => { S.size = b.dataset.z; save(); $$("#s_size button").forEach((x) => x.classList.toggle("on", x === b)); if (G) G.E.fit(); if (DEMO) DEMO.E.fit(); }));
  $$(".themes button").forEach((b) => (b.onclick = () => { S.theme = b.dataset.t; save(); applyTheme(); $$(".themes button").forEach((x) => x.classList.toggle("on", x === b)); if (G) G.E.dirty = true; if (DEMO) DEMO.E.dirty = true; }));
  $("#reset").onclick = () => {
    if ($("#reset").dataset.sure) { for (const k of ["level", "stars", "best", "tracks", "diff", "hints", "daily", "tut"]) localStorage.removeItem(KEY + k); location.reload(); }
    else { $("#reset").dataset.sure = 1; $("#reset").textContent = "اضغط مرة أخرى للتأكيد"; }
  };
  $("#ok").onclick = () => { closeModal(); if (!G) home(); };
}

// ---------------- قائمة المستويات ----------------
const PAGE = 24;
function levels(page = Math.floor((P.level - 1) / PAGE)) {
  stopGame(); closeModal();
  const from = page * PAGE + 1;
  $("#app").innerHTML = `
    <main class="screen">
      <div class="top"><button class="icon" id="back">→</button><h2>🗂️ المستويات</h2><span class="pill">⭐ ${totalStars()}</span></div>
      ${diffSeg()}
      <div class="pager"><button class="icon" id="prev" ${page ? "" : "disabled"}>▶</button><b>${from} – ${from + PAGE - 1}</b><button class="icon" id="nextp" ${from + PAGE <= P.level ? "" : "disabled"}>◀</button></div>
      <div class="grid">${Array.from({ length: PAGE }, (_, i) => {
        const n = from + i, open = n <= P.level, st = P.stars[n] || 0, sp = levelSpec(n, P.diff);
        return `<button class="lv ${open ? "" : "locked"} ${n === P.level ? "cur" : ""}" data-n="${n}" ${open ? "" : "disabled"}>
          <b>${open ? n : "🔒"}</b><small>${sp.w}×${sp.h}${sp.shape !== "square" ? " · " + SHAPE_NAMES[sp.shape] : ""}</small>
          <span class="st">${"★".repeat(st)}<em>${"★".repeat(3 - st)}</em></span></button>`;
      }).join("")}</div>
    </main>`;
  $("#back").onclick = home;
  $("#prev").onclick = () => levels(page - 1);
  $("#nextp").onclick = () => levels(page + 1);
  $$(".lv").forEach((b) => (b.onclick = () => startLevel(+b.dataset.n)));
  bindDiffSeg(() => levels());
}

// ============================================================
//  اللعب
// ============================================================
function stopGame() { G = null; DEMO = null; }
const startLevel = (n) => startGame(levelSpec(n, P.diff));
const startDaily = () => startGame(dailySpec(today()));

function startGame(spec) {
  closeModal(); stopGame(); applyTheme();
  const level = generate(spec);
  if (!spec.daily) P.diff = spec.diff;
  const D = DIFFS[spec.diff] || DIFFS.normal;
  const title = spec.daily ? "📅 تحدّي اليوم" : `${spec.diff !== "normal" ? D.icon + " " : ""}المستوى ${spec.n}`;
  $("#app").innerHTML = `
    <div class="game">
      <header class="bar">
        <button class="icon" id="back" aria-label="رجوع">→</button>
        <div class="ttl"><b>${title}</b><small>${level.w}×${level.h}${spec.shape !== "square" ? " · " + SHAPE_NAMES[spec.shape] : ""} · <span id="tm">0:00</span></small></div>
        <div class="hearts" id="hearts"></div>
      </header>
      <div class="prog"><i id="pg"></i></div>
      <div class="stage"><canvas id="cv"></canvas><div class="coach" id="coach" hidden><div class="hand">👆</div><div class="bubble" id="bubble"></div></div></div>
      <footer class="tools">
        <button class="tool" id="restart" aria-label="إعادة"><span>🔄</span><small>إعادة</small></button>
        <button class="tool hint" id="hint" aria-label="تلميح"><span>💡</span><small>تلميح</small><em id="hc">${P.hints}</em></button>
        <button class="tool" id="fitb" aria-label="ملاءمة"><span>🔍</span><small>ملاءمة</small></button>
      </footer>
    </div>`;
  const E = createEngine($("#cv"), level, { pad: 16 });
  G = { spec, E, hearts: D.hearts, maxHearts: D.hearts, mistakes: 0, t: 0, startT: performance.now(), over: false, total: level.arrows.length, pointers: new Map(), tut: !spec.daily && spec.n === 1 && spec.diff === "normal" && P.tut < 2 ? 0 : -1 };
  hearts();
  progress();
  $("#back").onclick = () => (spec.daily ? home() : levels());
  $("#restart").onclick = () => startGame(spec);
  $("#hint").onclick = useHint;
  $("#fitb").onclick = () => { E.fit(); };
  bindInput();
  if (G.tut === 0) coach();
}
function hearts() {
  $("#hearts").innerHTML = Array.from({ length: G.maxHearts }, (_, i) => `<i class="${i < G.hearts ? "" : "lost"}">❤</i>`).join("");
}
function progress() {
  const left = G.E.board.alive.size;
  $("#pg").style.width = `${((G.total - left) / G.total) * 100}%`;
}
let tmShown = -1;
function gameStep(now) {
  if (!document.body.contains(G.E.canvas)) { G = null; return; }
  if (!G.over && !G.paused) {
    const s = Math.floor((now - G.startT) / 1000);
    if (s !== tmShown) { tmShown = s; const el = $("#tm"); if (el) el.textContent = fmt(s); }
  }
  if (G.tut >= 0) placeCoach();
  if (!G.over && !G.E.board.alive.size && !G.E.anims.size) win();
}

function onTap(id) {
  if (!G || G.over || id < 0) return;
  const r = G.E.tap(id);
  if (!r) return;
  if (r.ok) {
    sfx.exit(); vibe(8);
    progress();
    if (G.tut >= 0) { G.tut++; P.tut = Math.max(P.tut, 1); save(); coach(); }
  } else {
    G.mistakes++; G.hearts--;
    sfx.bump(); vibe([40, 30, 60]);
    hearts();
    const h = $$("#hearts i")[G.hearts]; h?.classList.add("pop");
    if (G.tut >= 0) coach(true);
    if (G.hearts <= 0) { G.over = true; setTimeout(lose, 650); }
  }
}

function useHint() {
  if (!G || G.over) return;
  if (P.hints <= 0) { toast("انتهت التلميحات 💡 تربح تلميحاً مع كل مستوى تنهيه"); sfx.wrong(); return; }
  const B = G.E.board, f = freeArrows(B);
  if (!f.length) return;
  // التلميح الأفضل: السهم الذي يحرّر أكبر عدد من الأسهم الأخرى
  const score = (id) => [...B.alive].filter((o) => blocker(B, B.arrows[o])?.id === id).length;
  const id = f.sort((a, b) => score(b) - score(a))[0];
  G.E.hint = { id, t0: performance.now() };
  P.hints--; save(); $("#hc").textContent = P.hints;
  sfx.hint();
  // نقرّب الكاميرا إلى السهم إن كان خارج الشاشة
  const p = G.E.screenOf(id), E = G.E;
  if (p.x < 20 || p.y < 20 || p.x > E.cw - 20 || p.y > E.ch - 20) { E.view.ox += E.cw / 2 - p.x; E.view.oy += E.ch / 2 - p.y; E.clampView(); }
}

// ---------------- الدرس الأول: يد تشير إلى سهم حر ----------------
function coach(afterMistake = false) {
  const c = $("#coach"); if (!c) return;
  if (G.tut >= 2 || !G.E.board.alive.size) { c.hidden = true; G.tut = -1; P.tut = 2; save(); return; }
  c.hidden = false;
  $("#bubble").innerHTML = afterMistake ? "اصطدم! ❤️ خسرت قلباً.<br>اختر سهماً <b>طريقه فارغ</b> حتى الحافة" : G.tut === 0 ? "اضغط على هذا السهم 👇<br>طريقه فارغ فسيخرج من اللوحة" : "رائع! 🎉 الآن اختر سهماً آخر طريقه فارغ";
  G.coachId = freeArrows(G.E.board).sort((a, b) => a - b)[0];
}
function placeCoach() {
  const c = $("#coach"); if (!c || c.hidden || G.coachId == null || !G.E.board.alive.has(G.coachId)) { if (c && G.E.board.alive.size) G.coachId = freeArrows(G.E.board)[0]; return; }
  const p = G.E.screenOf(G.coachId);
  c.style.setProperty("--x", `${p.x}px`); c.style.setProperty("--y", `${p.y}px`);
}

// ---------------- اللمس: نقر، سحب، تقريب بإصبعين، عجلة الفأرة ----------------
function bindInput() {
  const cv = $("#cv"), E = G.E, P2 = G.pointers;
  const rel = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture?.(e.pointerId);
    const p = rel(e);
    P2.set(e.pointerId, { ...p, sx: p.x, sy: p.y, moved: false });
    if (P2.size === 1) { E.pressed = E.hit(p.x, p.y); E.dirty = true; if (E.pressed >= 0) sfx.tap(); }
    else { E.pressed = -1; const [a, b] = [...P2.values()]; G.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; }
  });
  cv.addEventListener("pointermove", (e) => {
    const q = P2.get(e.pointerId); if (!q) return;
    const p = rel(e), dx = p.x - q.x, dy = p.y - q.y;
    q.x = p.x; q.y = p.y;
    if (Math.hypot(q.x - q.sx, q.y - q.sy) > 9) { q.moved = true; if (E.pressed >= 0) { E.pressed = -1; E.dirty = true; } }
    if (P2.size === 1 && q.moved && E.view.s > E.view.fit + 0.5) { E.view.ox += dx; E.view.oy += dy; E.clampView(); E.dirty = true; }
    else if (P2.size === 2 && G.pinch) {
      const [a, b] = [...P2.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      E.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / G.pinch.d); G.pinch.d = d;
      E.view.ox += dx / 2; E.view.oy += dy / 2; E.clampView();
    }
  });
  const up = (e) => {
    const q = P2.get(e.pointerId); P2.delete(e.pointerId);
    if (P2.size < 2) G.pinch = null;
    const id = E.pressed; E.pressed = -1; E.dirty = true;
    if (!q || q.moved || P2.size || G.wasPinch) { if (!P2.size) G.wasPinch = false; return; }
    const p = rel(e);
    const hitNow = E.hit(p.x, p.y);
    onTap(hitNow >= 0 ? hitNow : id);
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", (e) => { P2.delete(e.pointerId); G.pinch = null; E.pressed = -1; });
  cv.addEventListener("pointerdown", () => { if (P2.size > 1) G.wasPinch = true; });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); const p = rel(e); E.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 0.87); }, { passive: false });
}
window.addEventListener("resize", () => { G?.E.resize(); DEMO?.E.resize(); });

// ---------------- الفوز والخسارة ----------------
function win() {
  G.over = true;
  const { spec } = G, secs = Math.floor((performance.now() - G.startT) / 1000);
  const stars = G.mistakes === 0 ? 3 : G.mistakes === 1 ? 2 : 1;
  G.E.confetti(); sfx.win(); vibe([20, 40, 20]);
  let rec = false;
  if (spec.daily) { P.daily[spec.daily] = Math.max(P.daily[spec.daily] || 0, stars); P.hints += 2; }
  else {
    P.stars[spec.n] = Math.max(P.stars[spec.n] || 0, stars);
    if (!P.best[spec.n] || secs < P.best[spec.n]) { rec = !!P.best[spec.n]; P.best[spec.n] = secs; }
    if (spec.n === P.level) P.level++;
    P.hints += 1;
  }
  save();
  const streak = (() => { let n = 0; const d = new Date(); for (;;) { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; if (!P.daily[k]) break; n++; d.setDate(d.getDate() - 1); } return n; })();
  setTimeout(() => {
    if (!G) return;
    modal(`
      <div class="wstars">${[0, 1, 2].map((i) => `<i class="${i < stars ? "on" : ""}" style="--d:${i * 0.18}s">★</i>`).join("")}</div>
      <h2>${["", "أحسنت!", "رائع!", "مذهل! بلا أخطاء"][stars]}</h2>
      <div class="sgrid">
        <div><b>${fmt(secs)}</b><small>الوقت${rec ? " · 🏆 رقم جديد" : ""}</small></div>
        <div><b>${G.total}</b><small>سهماً</small></div>
        <div><b>+${spec.daily ? 2 : 1} 💡</b><small>تلميح</small></div>
      </div>
      ${spec.daily ? `<p class="par">🔥 سلسلة التحدّي اليومي: ${streak} ${streak === 1 ? "يوم" : "أيام"}</p>` : ""}
      <div class="col">
        ${spec.daily ? `<button class="btn block" id="home2">القائمة</button>` : `<button class="btn block" id="next">المستوى ${spec.n + 1} ⬅</button>`}
        <div class="row"><button class="btn ghost" id="again">🔄 أعد</button><button class="btn ghost" id="menu">🏠 القائمة</button></div>
      </div>`, "win");
    stars && setTimeout(() => [0, 1, 2].slice(0, stars).forEach((i) => setTimeout(() => sfx.star(i), i * 180)), 100);
    if ($("#next")) $("#next").onclick = () => startLevel(spec.n + 1);
    if ($("#home2")) $("#home2").onclick = home;
    $("#again").onclick = () => startGame(spec);
    $("#menu").onclick = home;
  }, 900);
}
function lose() {
  if (!G) return;
  sfx.lose();
  const left = G.E.board.alive.size;
  modal(`
    <div class="res-icon">💔</div>
    <h2>نفدت القلوب</h2>
    <p class="par">بقي ${left} ${left === 1 ? "سهم" : "سهماً"}. تذكّر: السهم يخرج فقط إذا كان الطريق أمام رأسه فارغاً.</p>
    <div class="col">
      <button class="btn block" id="again">🔄 حاول مجدداً</button>
      ${P.hints > 0 ? `<button class="btn alt block" id="cont">❤️ أكمل مقابل تلميح (لديك ${P.hints})</button>` : ""}
      <button class="btn ghost block" id="menu">🏠 القائمة</button>
    </div>`, "lose");
  $("#again").onclick = () => startGame(G.spec);
  $("#menu").onclick = home;
  if ($("#cont")) $("#cont").onclick = () => { P.hints--; save(); G.hearts = 1; G.over = false; hearts(); $("#hc").textContent = P.hints; closeModal(); };
}

// ---------------- البدء ----------------
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && G && $("#modal").hidden) home(); });
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" && !G) closeModal(); });
applyTheme();
home();
requestAnimationFrame(frame);
if ("serviceWorker" in navigator && location.protocol === "https:" && !isTest && !window.Capacitor) navigator.serviceWorker.register("sw.js").catch(() => {});
// للاختبارات الآلية فقط (?test)
if (isTest) window.__mz = {
  get G() { return G; }, P, save, startLevel, startDaily, home, levels,
  free: () => freeArrows(G.E.board),
  blocked: () => [...G.E.board.alive].filter((id) => blocker(G.E.board, G.E.board.arrows[id])),
  pos: (id) => { const p = G.E.screenOf(id), r = G.E.canvas.getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; },
  hitAt: (x, y) => { const r = G.E.canvas.getBoundingClientRect(); return G.E.hit(x - r.left, y - r.top); }
};
