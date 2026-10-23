// ============================================================
//  المحاكاة: خطوات ثابتة (10 في الثانية) تتغيّر بأوامر اللاعبين فقط، وعشوائية مبذورة.
//  لهذا يمكن لاحقاً تشغيلها أونلاين: كل جهاز يشغّل نفس المحاكاة ويتبادل الأوامر فقط.
// ============================================================
import { generateCity, findPath, nearestOnRoad, pointAt, POINT_TYPES, W, H } from "./city.js";
import { UNITS, MOD, HQ, START_MONEY, BASE_INCOME } from "./units.js";
import { makeRng } from "./rng.js";

export const TICK = 0.1;
export const CELL = 50;
export const MAX_UNITS = 40;
export const QUEUE_MAX = 5;
export const CAPTURE_R = 75;

export function createWorld(seed) {
  const city = generateCity(seed);
  const gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
  const w = {
    seed, city, rng: makeRng(seed * 13 + 1), tick: 0, nextId: 1, gw, gh,
    players: [0, 1].map((p) => ({ p, money: START_MONEY, queue: [], hq: { x: city.hq[p].x, y: city.hq[p].y, hp: HQ.hp, cd: 0 } })),
    units: [], shells: [], cmds: [], events: [],
    points: city.points.map((pt) => ({ ...pt, prog: pt.owner >= 0 ? 1 : 0, by: -1 })),
    vis: [new Uint8Array(gw * gh), new Uint8Array(gw * gh)],
    seen: [new Uint8Array(gw * gh), new Uint8Array(gw * gh)],
    stats: [0, 1].map(() => ({ built: 0, kills: 0, lost: 0, captured: 0, spent: 0 })),
    over: false, winner: null
  };
  computeVision(w);
  return w;
}

const rnd = (w) => w.rng();
export const incomeOf = (w, p) => BASE_INCOME + w.points.reduce((a, pt) => a + (pt.owner === p && pt.type !== "hq" ? POINT_TYPES[pt.type].income : 0), 0);
export const unitCount = (w, p) => w.units.reduce((n, u) => n + (u.p === p ? 1 : 0), 0) + w.players[p].queue.length;
export const seconds = (w) => Math.round(w.tick * TICK);

// ---------------- الرؤية (ضباب الحرب) ----------------
function stamp(w, grid, seen, x, y, r) {
  const { gw, gh } = w;
  const x0 = Math.max(0, Math.floor((x - r) / CELL)), x1 = Math.min(gw - 1, Math.floor((x + r) / CELL));
  const y0 = Math.max(0, Math.floor((y - r) / CELL)), y1 = Math.min(gh - 1, Math.floor((y + r) / CELL));
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const cx = (i + 0.5) * CELL, cy = (j + 0.5) * CELL;
    if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r) { grid[j * gw + i] = 1; seen[j * gw + i] = 1; }
  }
}
export function computeVision(w) {
  for (const p of [0, 1]) {
    const g = w.vis[p]; g.fill(0);
    const hq = w.players[p].hq;
    if (hq.hp > 0) stamp(w, g, w.seen[p], hq.x, hq.y, HQ.vision);
    for (const pt of w.points) if (pt.owner === p) stamp(w, g, w.seen[p], pt.x, pt.y, POINT_TYPES[pt.type].vision);
    for (const u of w.units) if (u.p === p) stamp(w, g, w.seen[p], u.x, u.y, UNITS[u.type].vision);
  }
}
export const visible = (w, p, x, y) => {
  const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
  return i >= 0 && j >= 0 && i < w.gw && j < w.gh && w.vis[p][j * w.gw + i] === 1;
};

// ---------------- الأوامر ----------------
export const command = (w, c) => w.cmds.push(c);

function applyCmd(w, c) {
  const pl = w.players[c.p];
  if (c.type === "build") {
    const U = UNITS[c.unit];
    if (!U || pl.money < U.cost || pl.queue.length >= QUEUE_MAX || unitCount(w, c.p) >= MAX_UNITS) return;
    pl.money -= U.cost;
    w.stats[c.p].spent += U.cost;
    pl.queue.push({ unit: c.unit, t: U.build, total: U.build });
  } else if (c.type === "cancel") {
    const q = pl.queue.pop();
    if (q) pl.money += UNITS[q.unit].cost;
  } else if (c.type === "move") {
    const units = c.ids.map((id) => w.units.find((u) => u.id === id && u.p === c.p)).filter(Boolean);
    const plaza = pointAt(w.city, c.x, c.y);
    const target = plaza ? { x: plaza.x, y: plaza.y } : { x: Math.max(20, Math.min(W - 20, c.x)), y: Math.max(20, Math.min(H - 20, c.y)) };
    units.forEach((u, k) => {
      // تشكيل: كل وحدة في مكان قريب من الهدف حتى لا تتكدّس
      const a = k * 2.39996, r = k ? 16 * Math.sqrt(k) : 0;
      const dest = { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r };
      if (UNITS[u.type].air) u.path = [dest];
      else {
        // داخل ساحة: إلى المكان نفسه. خارجها: إلى أقرب نقطة على الشارع
        const road = plaza ? dest : nearestOnRoad(w.city, dest.x, dest.y);
        u.path = findPath(w.city, u, { x: road.x, y: road.y });
      }
      u.order = "move"; u.force = !!c.force;
    });
  } else if (c.type === "stop") {
    for (const u of w.units) if (u.p === c.p && c.ids.includes(u.id)) { u.path = []; u.order = "idle"; }
  }
}

// ---------------- خطوة واحدة ----------------
export function step(w) {
  if (w.over) return;
  // المواضع السابقة (للرسم السلس بين الخطوات)
  for (const u of w.units) { u.px = u.x; u.py = u.y; }
  for (const c of w.cmds.splice(0)) applyCmd(w, c);
  // الإنتاج
  for (const pl of w.players) {
    const q = pl.queue[0];
    if (!q) continue;
    q.t -= TICK;
    if (q.t <= 0) {
      pl.queue.shift();
      const hq = w.city.hq[pl.p];
      const ex = w.city.nodes[hq.entry];
      const a = rnd(w) * Math.PI * 2;
      const U = UNITS[q.unit];
      w.units.push({ id: w.nextId++, p: pl.p, type: q.unit, x: ex.x + Math.cos(a) * 12, y: ex.y + Math.sin(a) * 12, ang: pl.p === 0 ? -Math.PI / 2 : Math.PI / 2, hp: U.hp, cd: rnd(w) * U.rof, path: [], order: "idle", engaged: false, born: w.tick });
      w.stats[pl.p].built++;
      w.events.push({ type: "spawn", p: pl.p, unit: q.unit });
    }
  }
  if (w.tick % 3 === 0) computeVision(w);
  // القتال
  for (const u of w.units) {
    const U = UNITS[u.type];
    u.cd -= TICK;
    const t = acquire(w, u.p, u.x, u.y, U, u.type);
    u.engaged = !!t;
    if (t && u.cd <= 0) { fire(w, u, U, u.type, t); u.cd = U.rof * (0.9 + rnd(w) * 0.2); }
    if (t) u.ang = Math.atan2(t.y - u.y, t.x - u.x);
  }
  for (const pl of w.players) {
    const hq = pl.hq;
    if (hq.hp <= 0) continue;
    hq.cd -= TICK;
    if (hq.cd <= 0) {
      const t = acquire(w, pl.p, hq.x, hq.y, { range: HQ.range, hitsAir: true, air: false }, "hq");
      if (t) { fire(w, { p: pl.p, x: hq.x, y: hq.y, isHq: true }, { dmg: HQ.dmg }, "hq", t); hq.cd = HQ.rof; }
    }
  }
  // القذائف
  for (const s of w.shells) if (w.tick >= s.land) land(w, s);
  w.shells = w.shells.filter((s) => w.tick < s.land);
  // الموتى
  const dead = w.units.filter((u) => u.hp <= 0);
  for (const u of dead) {
    w.events.push({ type: "death", p: u.p, unit: u.type, x: u.x, y: u.y });
    w.stats[u.p].lost++;
  }
  if (dead.length) w.units = w.units.filter((u) => u.hp > 0);
  // الحركة
  for (const u of w.units) {
    if (!u.path.length) continue;
    const U = UNITS[u.type];
    if (u.engaged && !u.force) continue; // تتوقف لتقاتل ما دام العدو في مداها
    let left = U.speed * TICK;
    while (left > 0 && u.path.length) {
      const wp = u.path[0];
      const dx = wp.x - u.x, dy = wp.y - u.y, d = Math.hypot(dx, dy);
      if (d > 0.01) u.ang = Math.atan2(dy, dx);
      if (d <= left) { u.x = wp.x; u.y = wp.y; left -= d; u.path.shift(); }
      else { u.x += (dx / d) * left; u.y += (dy / d) * left; left = 0; }
    }
    if (!u.path.length) { u.order = "idle"; u.force = false; }
  }
  // تباعد خفيف بين الوحدات الأرضية المتلاصقة
  for (let a = 0; a < w.units.length; a++) {
    const A = w.units[a];
    if (UNITS[A.type].air || A.path.length) continue;
    for (let b = a + 1; b < w.units.length; b++) {
      const B = w.units[b];
      if (UNITS[B.type].air) continue;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.01;
      const min = (UNITS[A.type].radius + UNITS[B.type].radius) * 0.8;
      if (d < min) { const k = ((min - d) / d) * 0.25; A.x -= dx * k; A.y -= dy * k; if (!B.path.length) { B.x += dx * k; B.y += dy * k; } }
    }
  }
  capture(w);
  if (w.tick % 10 === 0) for (const pl of w.players) pl.money += incomeOf(w, pl.p) * (pl.incomeMul || 1);
  w.tick++;
  for (const pl of w.players) if (pl.hq.hp <= 0 && !w.over) {
    w.over = true; w.winner = 1 - pl.p;
    w.events.push({ type: "hqDown", p: pl.p, x: pl.hq.x, y: pl.hq.y });
  }
}

// أفضل هدف ظاهر في المدى (يفضّل ما يتضرر أكثر من سلاحنا)
function acquire(w, p, x, y, U, type) {
  let best = null, bs = 1e9;
  const range = U.range;
  for (const e of w.units) {
    if (e.p === p) continue;
    const E = UNITS[e.type];
    if (E.air && !U.hitsAir) continue;
    if (type !== "hq" && !visible(w, p, e.x, e.y)) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > range + E.radius || (U.minRange && d < U.minRange)) continue;
    const m = MOD[type][E.armor];
    if (m <= 0) continue;
    const s = d / (m + 0.15) * (e.hp / E.hp * 0.5 + 0.5);
    if (s < bs) { bs = s; best = e; }
  }
  if (type === "hq") return best;
  if (!best && MOD[type].building > 0) {
    const hq = w.players[1 - p].hq;
    const d = Math.hypot(hq.x - x, hq.y - y);
    if (hq.hp > 0 && d <= range + HQ.radius && (!U.minRange || d >= U.minRange) && visible(w, p, hq.x, hq.y)) return { isHq: true, p: 1 - p, x: hq.x, y: hq.y, ref: hq };
  }
  return best;
}

function fire(w, u, U, type, t) {
  if (type === "artillery") {
    // القذيفة تسقط حيث كان الهدف لحظة الإطلاق (الأهداف السريعة قد تفلت)
    const spread = 14;
    const s = { p: u.p, x0: u.x, y0: u.y, x: t.x + (rnd(w) - 0.5) * spread, y: t.y + (rnd(w) - 0.5) * spread, fired: w.tick, land: w.tick + Math.round(UNITS.artillery.shellTime / TICK), dmg: U.dmg };
    w.shells.push(s);
    w.events.push({ type: "artyFire", p: u.p, x: u.x, y: u.y, ang: Math.atan2(t.y - u.y, t.x - u.x) });
    return;
  }
  const armor = t.isHq ? "building" : UNITS[t.type].armor;
  const dmg = U.dmg * MOD[type][armor] * (0.85 + rnd(w) * 0.3);
  hit(w, u.p, t, dmg);
  w.events.push({ type: "shot", p: u.p, kind: type, x: u.x, y: u.y, tx: t.x, ty: t.y });
}

function hit(w, p, t, dmg) {
  if (t.isHq) { t.ref.hp -= dmg; return; }
  const before = t.hp;
  t.hp -= dmg;
  if (before > 0 && t.hp <= 0) w.stats[p].kills++;
}

function land(w, s) {
  const R = UNITS.artillery.splash;
  for (const e of w.units) {
    if (e.p === s.p || UNITS[e.type].air) continue;
    const d = Math.hypot(e.x - s.x, e.y - s.y);
    if (d < R) hit(w, s.p, e, s.dmg * MOD.artillery[UNITS[e.type].armor] * (1 - d / (R * 1.6)));
  }
  const hq = w.players[1 - s.p].hq;
  if (Math.hypot(hq.x - s.x, hq.y - s.y) < HQ.radius + 20) hq.hp -= s.dmg * MOD.artillery.building;
  w.events.push({ type: "boom", x: s.x, y: s.y });
}

// احتلال المواقع: المشاة فقط، وبلا وجود مشاة للعدو
function capture(w) {
  for (const pt of w.points) {
    if (pt.type === "hq") continue;
    const n = [0, 0];
    for (const u of w.units) if (UNITS[u.type].capture && Math.hypot(u.x - pt.x, u.y - pt.y) < CAPTURE_R) n[u.p]++;
    if ((n[0] > 0) === (n[1] > 0)) continue;
    const q = n[0] > 0 ? 0 : 1;
    const rate = 0.12 * Math.min(3, n[q]) * TICK;
    if (pt.owner === q) { pt.prog = 1; continue; }
    if (pt.owner >= 0) {
      pt.prog -= rate;
      if (pt.prog <= 0) { w.events.push({ type: "neutral", id: pt.id, from: pt.owner }); pt.owner = -1; pt.prog = 0; pt.by = q; }
      continue;
    }
    if (pt.by !== q) { pt.by = q; pt.prog = 0; }
    pt.prog += rate;
    if (pt.prog >= 1) { pt.owner = q; pt.prog = 1; w.stats[q].captured++; w.events.push({ type: "captured", id: pt.id, p: q }); }
  }
}
