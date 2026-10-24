// ============================================================
//  المحاكاة: قواعد سيطرة كلها هنا بلا واجهة.
//  خطوات ثابتة (10 في الثانية) تتغيّر بأوامر اللاعبين فقط، وعشوائية مبذورة:
//  لذلك يمكن لاحقاً تشغيلها أونلاين بتبادل الأوامر فقط.
// ============================================================
import { generateCity, findPath, nearestOnRoad, openBlockAt, POINT_TYPES, W, H } from "./city.js";
import { FACTIONS, UNITS, BUILDINGS, WEAPON, POWERS, SUPER, RANKS, START_MONEY, TRUCK_LOAD, DEPOT_AMOUNT, LOAD_TIME, MAX_UNITS, builderOf, truckOf } from "./rules.js";
import { makeRng } from "./rng.js";

export const TICK = 0.1;
export const CELL = 50;
export const CAPTURE_R = 75;
export const QUEUE_MAX = 5;
export { MAX_UNITS };

const LOT_R = 52, PAD_R = 16;
const bRadius = (b) => (BUILDINGS[b.type].size === "pad" ? PAD_R : LOT_R);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createWorld(seed, factions = ["shield", "falcon"]) {
  const city = generateCity(seed);
  const gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
  const w = {
    seed, city, rng: makeRng(seed * 13 + 1), tick: 0, nextId: 1, gw, gh,
    players: [0, 1].map((p) => ({
      p, faction: factions[p], money: START_MONEY, incomeMul: 1, xp: 0, rank: 1, points: 1, earned: 0,
      powers: Object.fromEntries(Object.keys(POWERS).map((k) => [k, { unlocked: false, ready: 0 }])),
      power: { prod: 0, use: 0 }, low: false, alive: true
    })),
    units: [], buildings: [], shells: [], strikes: [], reveals: [], cmds: [], events: [],
    depots: city.depots.map((d) => ({ ...d, amount: d.base ? DEPOT_AMOUNT : DEPOT_AMOUNT * 1.5 })),
    points: city.points.map((pt) => ({ ...pt, prog: 0, by: -1 })),
    lotUsed: new Map(), padUsed: new Map(),
    vis: [new Uint8Array(gw * gh), new Uint8Array(gw * gh)],
    seen: [new Uint8Array(gw * gh), new Uint8Array(gw * gh)],
    known: [new Map(), new Map()],
    stats: [0, 1].map(() => ({ built: 0, kills: 0, lost: 0, captured: 0, buildings: 0, razed: 0, gathered: 0 })),
    over: false, winner: null
  };
  // البداية: مركز القيادة وجرّافة
  for (const p of [0, 1]) {
    const lot = city.hqLots[p];
    addBuilding(w, p, "hq", { lot: lot.id, done: true });
    spawnUnit(w, p, builderOf(w.players[p].faction), city.nodes[lot.entry]);
  }
  updatePower(w);
  computeVision(w);
  return w;
}

const rnd = (w) => w.rng();
export const seconds = (w) => Math.round(w.tick * TICK);
export const unitCount = (w, p) => w.units.reduce((n, u) => n + (u.p === p ? 1 : 0), 0) + w.buildings.reduce((n, b) => n + (b.p === p ? b.queue.length : 0), 0);
export const hasBuilding = (w, p, type) => w.buildings.some((b) => b.p === p && b.type === type && b.done);
export const incomeOf = (w, p) => w.points.reduce((a, pt) => a + (pt.owner === p ? POINT_TYPES[pt.type].income : 0), 0);
export const buildCost = (w, p, type) => Math.round(BUILDINGS[type].cost * FACTIONS[w.players[p].faction].buildCost / 10) * 10;
export const powerOf = (w, b) => { const v = BUILDINGS[b.type].power; return v === "faction" ? FACTIONS[w.players[b.p].faction].power : v; };

function addBuilding(w, p, type, { lot = null, pad = null, done = false }) {
  const B = BUILDINGS[type];
  const spot = lot != null ? w.city.lots[lot] : w.city.pads[pad];
  const maxHp = Math.round(B.hp * FACTIONS[w.players[p].faction].hpMul);
  const b = { id: w.nextId++, p, type, x: spot.x, y: spot.y, lot, pad, entry: w.city.nodes[spot.entry], hp: done ? maxHp : maxHp * 0.1, maxHp, built: done ? 1 : 0, done, queue: [], cd: 0, charge: 0 };
  w.buildings.push(b);
  if (lot != null) w.lotUsed.set(lot, b.id); else w.padUsed.set(pad, b.id);
  return b;
}

function spawnUnit(w, p, type, at) {
  const Ud = UNITS[type];
  const a = rnd(w) * Math.PI * 2;
  const u = { id: w.nextId++, p, type, x: at.x + Math.cos(a) * 10, y: at.y + Math.sin(a) * 10, ang: p === 0 ? -Math.PI / 2 : Math.PI / 2, hp: Ud.hp, cd: rnd(w) * Ud.rof, path: [], order: "idle", engaged: false, task: null, auto: Ud.role === "truck" };
  u.px = u.x; u.py = u.y;
  if (Ud.role === "truck") u.truck = { state: "seek", load: 0, timer: 0, depot: -1 };
  w.units.push(u);
  return u;
}

// ---------------- الطاقة ----------------
function updatePower(w) {
  for (const pl of w.players) {
    let prod = 0, use = 0;
    for (const b of w.buildings) if (b.p === pl.p && b.done) { const v = powerOf(w, b); if (v > 0) prod += v; else use -= v; }
    pl.power = { prod, use };
    pl.low = use > prod;
  }
}

// ---------------- الرؤية ----------------
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
    for (const b of w.buildings) if (b.p === p) stamp(w, g, w.seen[p], b.x, b.y, b.type === "hq" ? 320 : BUILDINGS[b.type].size === "pad" ? 260 : 200);
    for (const pt of w.points) if (pt.owner === p) stamp(w, g, w.seen[p], pt.x, pt.y, POINT_TYPES[pt.type].vision);
    for (const u of w.units) if (u.p === p) stamp(w, g, w.seen[p], u.x, u.y, UNITS[u.type].vision);
    for (const r of w.reveals) if (r.p === p) stamp(w, g, w.seen[p], r.x, r.y, r.r);
  }
  // ذاكرة مباني العدو (تبقى ظاهرة كأشباح في الضباب حتى تُرى مهدّمة)
  for (const p of [0, 1]) {
    const K = w.known[p];
    for (const b of w.buildings) if (b.p !== p && visible(w, p, b.x, b.y)) K.set(b.id, { id: b.id, type: b.type, x: b.x, y: b.y, p: b.p, done: b.done });
    for (const [id, k] of K) if (visible(w, p, k.x, k.y) && !w.buildings.some((b) => b.id === id)) K.delete(id);
  }
}
export const visible = (w, p, x, y) => {
  const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
  return i >= 0 && j >= 0 && i < w.gw && j < w.gh && w.vis[p][j * w.gw + i] === 1;
};

// ---------------- الأوامر ----------------
export const command = (w, c) => w.cmds.push(c);

// هل يمكن البناء هنا؟ (يعيد سبب الرفض بالعربية)
export function canBuild(w, p, type, spot) {
  const B = BUILDINGS[type];
  if (!B || type === "hq") return "لا يمكن";
  if (B.req && !hasBuilding(w, p, B.req)) return `يحتاج ${BUILDINGS[B.req].name} أولاً`;
  if (type === "super" && w.buildings.some((b) => b.p === p && b.type === "super")) return "مسموح بواحد فقط";
  if (w.players[p].money < buildCost(w, p, type)) return "المؤن لا تكفي";
  if (!w.units.some((u) => u.p === p && UNITS[u.type].role === "builder")) return "تحتاج جرّافة";
  if (spot) {
    const pos = B.size === "pad" ? w.city.pads[spot.pad] : w.city.lots[spot.lot];
    if (!pos) return "مكان غير صالح";
    if (B.size === "pad" ? w.padUsed.has(spot.pad) : w.lotUsed.has(spot.lot)) return "المكان مشغول";
    if (B.size === "pad" && w.lotUsed.has(pos.lot) && w.buildings.find((b) => b.id === w.lotUsed.get(pos.lot))?.p !== p) return "أرض للعدو";
    if (!visible(w, p, pos.x, pos.y)) return "المكان خارج رؤيتك";
    if (w.units.some((u) => u.p !== p && !UNITS[u.type].air && d2(u, pos) < 60)) return "العدو قريب جداً";
  }
  return null;
}

function applyCmd(w, c) {
  const pl = w.players[c.p];
  if (!pl.alive) return;
  if (c.type === "build") {
    if (canBuild(w, c.p, c.building, c)) return;
    const cost = buildCost(w, c.p, c.building);
    pl.money -= cost;
    const b = addBuilding(w, c.p, c.building, { lot: c.lot ?? null, pad: c.pad ?? null });
    w.events.push({ type: "placed", p: c.p, id: b.id, building: c.building });
    // أقرب جرّافة غير مشغولة (أو أقربها إن كانت كلها مشغولة)
    const dozers = w.units.filter((u) => u.p === c.p && UNITS[u.type].role === "builder").sort((a, z) => (a.task ? 1 : 0) - (z.task ? 1 : 0) || d2(a, b) - d2(z, b));
    if (dozers[0]) assignBuild(w, dozers[0], b);
  } else if (c.type === "produce") {
    const Ud = UNITS[c.unit];
    if (!Ud || Ud.f !== pl.faction || pl.money < Ud.cost || unitCount(w, c.p) >= MAX_UNITS) return;
    if (Ud.req && !hasBuilding(w, c.p, Ud.req)) return;
    const prods = w.buildings.filter((b) => b.p === c.p && b.done && b.type === Ud.from && b.queue.length < QUEUE_MAX).sort((a, z) => a.queue.length - z.queue.length);
    if (!prods.length) return;
    pl.money -= Ud.cost;
    prods[0].queue.push({ unit: c.unit, t: Ud.build, total: Ud.build });
  } else if (c.type === "cancel") {
    const b = w.buildings.find((x) => x.id === c.id && x.p === c.p);
    const q = b?.queue.pop();
    if (q) pl.money += UNITS[q.unit].cost;
  } else if (c.type === "move") {
    const units = c.ids.map((id) => w.units.find((u) => u.id === id && u.p === c.p)).filter(Boolean);
    const open = openBlockAt(w.city, c.x, c.y);
    const target = { x: Math.max(20, Math.min(W - 20, c.x)), y: Math.max(20, Math.min(H - 20, c.y)) };
    units.forEach((u, k) => {
      const a = k * 2.39996, r = k ? 16 * Math.sqrt(k) : 0;
      const dest = { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r };
      moveTo(w, u, open || UNITS[u.type].air ? dest : nearestOnRoad(w.city, dest.x, dest.y));
      u.order = "move"; u.force = !!c.force; u.task = null;
      if (UNITS[u.type].role === "truck") u.auto = false;
    });
  } else if (c.type === "stop") {
    for (const u of w.units) if (u.p === c.p && c.ids.includes(u.id)) { u.path = []; u.order = "idle"; }
  } else if (c.type === "resume") {
    // أعد الجرّافة لإكمال مبنى غير مكتمل
    const u = w.units.find((x) => x.id === c.unit && x.p === c.p);
    const b = w.buildings.find((x) => x.id === c.id && x.p === c.p && !x.done);
    if (u && b && UNITS[u.type].role === "builder") assignBuild(w, u, b);
  } else if (c.type === "sell") {
    const b = w.buildings.find((x) => x.id === c.id && x.p === c.p && x.type !== "hq");
    if (b) { pl.money += Math.round(buildCost(w, c.p, b.type) * 0.5 * (b.hp / b.maxHp)); removeBuilding(w, b, false); }
  } else if (c.type === "unlock") {
    const P = POWERS[c.power], st = pl.powers[c.power];
    if (P && !st.unlocked && pl.points > 0 && pl.rank >= P.rank) { st.unlocked = true; pl.points--; st.ready = w.tick; }
  } else if (c.type === "power") {
    usePower(w, c.p, c.power, c.x, c.y);
  } else if (c.type === "super") {
    const s = w.buildings.find((b) => b.p === c.p && b.type === "super" && b.done && b.charge >= SUPER.charge);
    if (s) {
      s.charge = 0;
      w.strikes.push({ kind: "super", p: c.p, x: c.x, y: c.y, at: w.tick + 60 });
      w.events.push({ type: "superLaunch", p: c.p, x: c.x, y: c.y });
    }
  }
}

function moveTo(w, u, dest) {
  if (UNITS[u.type].air) { u.path = [{ x: dest.x, y: dest.y }]; return; }
  u.path = findPath(w.city, u, dest);
}
function assignBuild(w, u, b) {
  u.task = { build: b.id };
  u.order = "move"; u.force = true;
  moveTo(w, u, { x: b.x + (b.x < W / 2 ? 1 : -1) * 6, y: b.y });
}

// ---------------- صلاحيات الجنرال ----------------
function usePower(w, p, key, x, y) {
  const pl = w.players[p], P = POWERS[key], st = pl.powers[key];
  if (!P || !st.unlocked || w.tick < st.ready) return;
  st.ready = w.tick + P.cd / TICK;
  const from = { x: p === 0 ? x : x, y: p === 0 ? H + 80 : -80 };
  if (key === "airstrike") { w.strikes.push({ kind: "airstrike", p, x, y, at: w.tick + 30 }); w.events.push({ type: "planes", p, x, y, from, kind: "airstrike" }); }
  else if (key === "paradrop") { w.strikes.push({ kind: "paradrop", p, x, y, at: w.tick + 30 }); w.events.push({ type: "planes", p, x, y, from, kind: "paradrop" }); }
  else if (key === "reveal") { w.reveals.push({ p, x, y, r: P.radius, until: w.tick + P.time / TICK }); w.events.push({ type: "planes", p, x, y, from, kind: "reveal" }); }
  else if (key === "cash") { pl.money += P.amount; w.events.push({ type: "cash", p, amount: P.amount }); }
  else if (key === "barrage") {
    for (let k = 0; k < P.shells; k++) {
      const a = rnd(w) * Math.PI * 2, r = Math.sqrt(rnd(w)) * P.radius;
      w.shells.push({ p, x0: x, y0: y - 600, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, fired: w.tick + k * 3, land: w.tick + 25 + k * 3, dmg: P.dmg, splash: 50, weapon: "arty", sky: true });
    }
    w.events.push({ type: "barrage", p, x, y });
  }
  w.events.push({ type: "powerUsed", p, power: key, x, y });
}

function strike(w, s) {
  if (s.kind === "airstrike" || s.kind === "super") {
    const R = s.kind === "super" ? SUPER.radius : POWERS.airstrike.radius;
    const D = s.kind === "super" ? SUPER.dmg : POWERS.airstrike.dmg;
    for (const u of w.units) if (u.p !== s.p) { const d = d2(u, s); if (d < R) hit(w, s.p, u, D * (1 - d / (R * 1.5)) * (UNITS[u.type].armor === "heavy" ? 0.8 : 1)); }
    for (const b of w.buildings) if (b.p !== s.p) { const d = d2(b, s); if (d < R + bRadius(b)) hit(w, s.p, b, D * 0.9 * (1 - Math.min(1, d / (R * 1.6)))); }
    w.events.push({ type: s.kind === "super" ? "superBoom" : "airBoom", x: s.x, y: s.y, r: R });
  } else if (s.kind === "paradrop") {
    const rifle = w.players[s.p].faction === "shield" ? "s_rifle" : "f_rifle";
    for (let k = 0; k < POWERS.paradrop.count; k++) {
      const a = (k / POWERS.paradrop.count) * Math.PI * 2;
      spawnUnit(w, s.p, rifle, { x: s.x + Math.cos(a) * 26, y: s.y + Math.sin(a) * 26 });
    }
    w.events.push({ type: "landed", p: s.p, x: s.x, y: s.y });
  }
}

// ---------------- خطوة واحدة ----------------
export function step(w) {
  if (w.over) return;
  for (const u of w.units) { u.px = u.x; u.py = u.y; }
  for (const c of w.cmds.splice(0)) applyCmd(w, c);
  if (w.tick % 5 === 0) updatePower(w);

  // البناء: الجرّافة يجب أن تقف عند المبنى
  for (const b of w.buildings) {
    if (b.done) continue;
    const dozer = w.units.find((u) => u.p === b.p && u.task?.build === b.id && d2(u, b) < 75);
    if (!dozer) continue;
    const t = BUILDINGS[b.type].build / FACTIONS[w.players[b.p].faction].buildSpeed;
    const k = TICK / t;
    b.built = Math.min(1, b.built + k);
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.9 * k);
    if (b.built >= 1) {
      b.done = true; dozer.task = null; dozer.order = "idle";
      w.stats[b.p].buildings++;
      w.events.push({ type: "built", p: b.p, id: b.id, building: b.type });
      if (b.type === "supply") spawnUnit(w, b.p, truckOf(w.players[b.p].faction), b.entry);
      updatePower(w);
    }
  }
  // الجرّافات الفارغة تكمل المباني المتروكة
  if (w.tick % 10 === 0) for (const u of w.units) {
    if (UNITS[u.type].role !== "builder" || u.task || u.path.length) continue;
    const site = w.buildings.filter((b) => b.p === u.p && !b.done && !w.units.some((x) => x.task?.build === b.id)).sort((a, z) => d2(a, u) - d2(z, u))[0];
    if (site) assignBuild(w, u, site);
  }
  // الإنتاج (أبطأ إلى النصف عند نقص الطاقة)
  for (const b of w.buildings) {
    const q = b.queue[0];
    if (!q || !b.done) continue;
    q.t -= TICK * (w.players[b.p].low ? 0.5 : 1);
    if (q.t <= 0) {
      b.queue.shift();
      const u = spawnUnit(w, b.p, q.unit, b.entry);
      // تخرج الوحدة قليلاً نحو وسط المدينة
      if (!UNITS[q.unit].role) moveTo(w, u, nearestOnRoad(w.city, b.entry.x, b.entry.y + (b.p === 0 ? -50 : 50)));
      w.stats[b.p].built++;
      w.events.push({ type: "spawn", p: b.p, unit: q.unit });
    }
  }
  // شاحنات الإمداد
  for (const u of w.units) if (u.truck) truckStep(w, u);
  // السلاح الاستراتيجي يشحن
  for (const b of w.buildings) if (b.type === "super" && b.done && !w.players[b.p].low && b.charge < SUPER.charge) {
    b.charge += TICK;
    if (b.charge >= SUPER.charge) w.events.push({ type: "superReady", p: b.p });
  }
  if (w.tick % 3 === 0) { w.reveals = w.reveals.filter((r) => w.tick < r.until); computeVision(w); }

  // القتال: الوحدات
  for (const u of w.units) {
    const Ud = UNITS[u.type];
    u.cd -= TICK;
    if (!Ud.weapon) { u.engaged = false; continue; }
    const t = acquire(w, u.p, u.x, u.y, Ud);
    u.engaged = !!t;
    if (t) {
      u.ang = Math.atan2(t.y - u.y, t.x - u.x);
      if (u.cd <= 0) { fire(w, u, Ud, t); u.cd = Ud.rof * (0.9 + rnd(w) * 0.2); }
    }
  }
  // القتال: الدفاعات (تتعطّل عند نقص الطاقة)
  for (const b of w.buildings) {
    const B = BUILDINGS[b.type];
    if (!B.weapon || !b.done || w.players[b.p].low) continue;
    b.cd -= TICK;
    if (b.cd > 0) continue;
    const t = acquire(w, b.p, b.x, b.y, B);
    if (t) { fire(w, b, B, t); b.cd = B.rof; b.ang = Math.atan2(t.y - b.y, t.x - b.x); }
  }
  // القذائف والضربات
  for (const s of w.shells) if (w.tick >= s.land) land(w, s);
  w.shells = w.shells.filter((s) => w.tick < s.land);
  for (const s of w.strikes) if (w.tick >= s.at) strike(w, s);
  w.strikes = w.strikes.filter((s) => w.tick < s.at);
  // الموتى والمباني المهدّمة
  for (const u of w.units) if (u.hp <= 0) {
    w.events.push({ type: "death", p: u.p, unit: u.type, x: u.x, y: u.y });
    w.stats[u.p].lost++;
    if (u.killedBy != null) { w.stats[u.killedBy].kills++; addXp(w, u.killedBy, UNITS[u.type].cost * 0.5); }
  }
  w.units = w.units.filter((u) => u.hp > 0);
  for (const b of [...w.buildings]) if (b.hp <= 0) removeBuilding(w, b, true);
  // الحركة
  for (const u of w.units) {
    if (!u.path.length) continue;
    const Ud = UNITS[u.type];
    if (u.engaged && !u.force) continue;
    let left = Ud.speed * TICK;
    while (left > 0 && u.path.length) {
      const wp = u.path[0];
      const dx = wp.x - u.x, dy = wp.y - u.y, d = Math.hypot(dx, dy);
      if (d > 0.01 && !u.engaged) u.ang = Math.atan2(dy, dx);
      if (d <= left) { u.x = wp.x; u.y = wp.y; left -= d; u.path.shift(); }
      else { u.x += (dx / d) * left; u.y += (dy / d) * left; left = 0; }
    }
    if (!u.path.length) { u.order = "idle"; u.force = false; if (u.truck) u.auto = true; }
  }
  // تباعد خفيف
  for (let a = 0; a < w.units.length; a++) {
    const A = w.units[a], UA = UNITS[A.type];
    if (A.path.length) continue;
    for (let b = a + 1; b < w.units.length; b++) {
      const B = w.units[b], UB = UNITS[B.type];
      if (UA.air !== UB.air) continue;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.01;
      const min = (UA.radius + UB.radius) * 0.85;
      if (d < min) { const k = ((min - d) / d) * 0.25; A.x -= dx * k; A.y -= dy * k; if (!B.path.length) { B.x += dx * k; B.y += dy * k; } }
    }
  }
  capture(w);
  if (w.tick % 10 === 0) for (const pl of w.players) { const inc = incomeOf(w, pl.p) * pl.incomeMul; pl.money += inc; pl.earned += inc; }
  w.tick++;
  if (w.tick % 10 === 0) checkVictory(w);
}

function addXp(w, p, n) {
  const pl = w.players[p];
  pl.xp += n;
  while (pl.rank < RANKS.length && pl.xp >= RANKS[pl.rank]) {
    pl.rank++; pl.points++;
    w.events.push({ type: "rankUp", p, rank: pl.rank });
  }
}

function removeBuilding(w, b, destroyed) {
  w.buildings = w.buildings.filter((x) => x !== b);
  if (b.lot != null) w.lotUsed.delete(b.lot); else w.padUsed.delete(b.pad);
  for (const u of w.units) if (u.task?.build === b.id) { u.task = null; u.order = "idle"; }
  if (destroyed) {
    w.events.push({ type: "razed", p: b.p, building: b.type, x: b.x, y: b.y, big: BUILDINGS[b.type].size === "lot" });
    if (b.killedBy != null) { w.stats[b.killedBy].razed++; addXp(w, b.killedBy, b.type === "hq" ? 1500 : BUILDINGS[b.type].cost * 0.4); }
  }
  updatePower(w);
}

function checkVictory(w) {
  for (const pl of w.players) {
    const alive = w.buildings.some((b) => b.p === pl.p) || w.units.some((u) => u.p === pl.p && UNITS[u.type].role === "builder");
    if (!alive && pl.alive) { pl.alive = false; w.events.push({ type: "defeated", p: pl.p }); }
  }
  const alive = w.players.filter((p) => p.alive);
  if (alive.length <= 1) { w.over = true; w.winner = alive.length ? alive[0].p : -1; }
}

// ---------------- الشاحنات: مستودع ← مركز إمداد ← مستودع ----------------
function truckStep(w, u) {
  const t = u.truck;
  if (!u.auto) return;
  const centers = w.buildings.filter((b) => b.p === u.p && b.type === "supply" && b.done);
  if (!centers.length) return;
  if (t.state === "seek") {
    // أقرب مستودع فيه مؤن إلى أقرب مركز إمداد
    let best = null, bs = 1e9;
    for (const d of w.depots) {
      if (d.amount <= 0) continue;
      const c = centers.reduce((m, x) => (d2(x, d) < d2(m, d) ? x : m), centers[0]);
      const s = d2(c, d) + d2(u, d) * 0.5 + (w.units.filter((x) => x.truck?.depot === d.id && x.p === u.p).length * 120);
      if (s < bs) { bs = s; best = d; }
    }
    if (!best) return;
    t.depot = best.id; t.state = "toDepot";
    moveTo(w, u, { x: best.x, y: best.y });
  } else if (t.state === "toDepot") {
    const d = w.depots[t.depot];
    if (!u.path.length) {
      if (d2(u, d) > 45) { moveTo(w, u, { x: d.x, y: d.y }); return; }
      t.state = "loading"; t.timer = LOAD_TIME;
    }
  } else if (t.state === "loading") {
    t.timer -= TICK;
    if (t.timer > 0) return;
    const d = w.depots[t.depot];
    t.load = Math.min(TRUCK_LOAD, d.amount);
    d.amount -= t.load;
    if (!t.load) { t.state = "seek"; return; }
    const c = centers.reduce((m, x) => (d2(x, u) < d2(m, u) ? x : m), centers[0]);
    t.center = c.id; t.state = "toBase";
    moveTo(w, u, { x: c.x, y: c.y });
  } else if (t.state === "toBase") {
    const c = centers.find((x) => x.id === t.center) || centers[0];
    if (!u.path.length) {
      if (d2(u, c) > 70) { moveTo(w, u, { x: c.x, y: c.y }); return; }
      const amount = t.load * w.players[u.p].incomeMul;
      w.players[u.p].money += amount; w.players[u.p].earned += amount;
      w.stats[u.p].gathered += t.load;
      w.events.push({ type: "delivered", p: u.p, x: c.x, y: c.y, amount: Math.round(amount) });
      t.load = 0; t.state = "seek";
    }
  }
}

// ---------------- الاستهداف والنار ----------------
function acquire(w, p, x, y, spec) {
  let best = null, bs = 1e9;
  const M = WEAPON[spec.weapon];
  for (const e of w.units) {
    if (e.p === p) continue;
    const E = UNITS[e.type];
    if (E.air ? !spec.hitsAir : spec.airOnly) continue;
    const m = M[E.armor];
    if (!m) continue;
    if (!visible(w, p, e.x, e.y)) continue;
    const d = d2(e, { x, y });
    if (d > spec.range + E.radius || (spec.minRange && d < spec.minRange)) continue;
    const s = (d / (m + 0.15)) * (e.hp / E.hp * 0.5 + 0.5);
    if (s < bs) { bs = s; best = e; }
  }
  if (best || spec.airOnly || !M.building) return best;
  for (const b of w.buildings) {
    if (b.p === p) continue;
    const d = d2(b, { x, y });
    if (d > spec.range + bRadius(b) || (spec.minRange && d < spec.minRange)) continue;
    if (!visible(w, p, b.x, b.y)) continue;
    const s = d * (BUILDINGS[b.type].weapon ? 0.6 : 1);
    if (s < bs) { bs = s; best = b; }
  }
  return best;
}
const armorOf = (t) => (t.type in BUILDINGS && t.maxHp ? "building" : UNITS[t.type].armor);

function fire(w, src, spec, t) {
  if (spec.weapon === "arty") {
    for (let k = 0; k < (spec.shells || 1); k++) {
      const spread = 16 + k * 14;
      w.shells.push({ p: src.p, x0: src.x, y0: src.y, x: t.x + (rnd(w) - 0.5) * spread, y: t.y + (rnd(w) - 0.5) * spread, fired: w.tick + k * 2, land: w.tick + 13 + k * 2, dmg: spec.dmg, splash: spec.splash, weapon: "arty", rocket: (spec.shells || 1) > 1 });
    }
    w.events.push({ type: "artyFire", p: src.p, x: src.x, y: src.y, ang: Math.atan2(t.y - src.y, t.x - src.x), rocket: (spec.shells || 1) > 1 });
    return;
  }
  const dmg = spec.dmg * WEAPON[spec.weapon][armorOf(t)] * (0.85 + rnd(w) * 0.3);
  hit(w, src.p, t, dmg);
  w.events.push({ type: "shot", p: src.p, weapon: spec.weapon, x: src.x, y: src.y, tx: t.x, ty: t.y, air: !!(UNITS[src.type]?.air) });
}

function hit(w, p, t, dmg) {
  const before = t.hp;
  t.hp -= dmg;
  if (before > 0 && t.hp <= 0) t.killedBy = p;
}

function land(w, s) {
  for (const e of w.units) {
    if (e.p === s.p || UNITS[e.type].air) continue;
    const d = d2(e, s);
    if (d < s.splash) hit(w, s.p, e, s.dmg * WEAPON.arty[UNITS[e.type].armor] * (1 - d / (s.splash * 1.6)));
  }
  for (const b of w.buildings) {
    if (b.p === s.p) continue;
    if (d2(b, s) < bRadius(b) + s.splash * 0.5) hit(w, s.p, b, s.dmg * WEAPON.arty.building);
  }
  w.events.push({ type: "boom", x: s.x, y: s.y, small: !!s.rocket });
}

// ---------------- احتلال المصافي والأبراج (بالمشاة) ----------------
function capture(w) {
  for (const pt of w.points) {
    const n = [0, 0];
    for (const u of w.units) if (UNITS[u.type].capture && d2(u, pt) < CAPTURE_R) n[u.p]++;
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
