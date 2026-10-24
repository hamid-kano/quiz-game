// ============================================================
//  قائد العدو: يبني قاعدته بخطة، يدير الشاحنات والطاقة، ينتج جيشاً متوازناً
//  يغيّره لمواجهة ما يراه، يحتلّ المصافي، يدافع، يهاجم بموجات، ويستخدم صلاحيات الجنرال.
//  لا يغشّ: يعرف فقط ما رأته وحداته (وموقع مقرّك).
// ============================================================
import { command, visible, unitCount, hasBuilding, buildCost, canBuild, MAX_UNITS } from "./world.js";
import { UNITS, BUILDINGS, POWERS, SUPER, unitsOf, builderOf, truckOf } from "./rules.js";

// income: مضاعف الدخل · plan: خطة البناء
export const LEVELS = {
  easy: { name: "سهل", think: 30, income: 0.8, wave: 6, trucks: 2, defendR: 350, hqAt: 720, army: 7000, powers: false,
    plan: ["power", "barracks", "supply", "power", "factory", "turret", "power", "airfield"] },
  normal: { name: "متوسط", think: 16, income: 1, wave: 7, trucks: 3, defendR: 450, hqAt: 540, army: 6000, powers: true,
    plan: ["power", "barracks", "supply", "power", "factory", "supply", "turret", "airfield", "power", "aadef", "tech", "power", "turret"] },
  hard: { name: "صعب", think: 10, income: 1.25, wave: 8, trucks: 3, defendR: 520, hqAt: 480, army: 6000, powers: true,
    plan: ["power", "supply", "barracks", "power", "factory", "supply", "turret", "airfield", "power", "aadef", "tech", "power", "turret", "super", "power", "aadef"] }
};
// نسب الجيش لكل فصيل
const MIX = {
  shield: { s_rifle: 0.22, s_rocket: 0.16, s_tank: 0.3, s_arty: 0.1, s_aa: 0.07, s_heli: 0.1, s_fortress: 0.05 },
  falcon: { f_rifle: 0.2, f_rocket: 0.16, f_raider: 0.16, f_tank: 0.22, f_mlrs: 0.1, f_drone: 0.11, f_jet: 0.05 }
};
// ما يهزم كل درع
const COUNTER_BY_ARMOR = { heavy: ["rocket", "arty"], light: ["shell", "rocket"], inf: ["bullet", "arty"], air: ["flak", "rocket"] };

export function createAI(w, p, level = "normal") {
  const L = LEVELS[level];
  w.players[p].incomeMul = L.income;
  return { p, L, level, next: 5 + p * 3, step: 0, seen: { inf: 0, light: 0, heavy: 0, air: 0 } };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const centroid = (l) => ({ x: l.reduce((a, u) => a + u.x, 0) / l.length, y: l.reduce((a, u) => a + u.y, 0) / l.length });

export function think(w, ai) {
  if (w.tick < ai.next || w.over || !w.players[ai.p].alive) return;
  const { p, L } = ai;
  ai.next = w.tick + L.think;
  const me = w.players[p], f = me.faction;
  const hq = w.city.hqLots[p], foeHq = w.city.hqLots[1 - p];
  const mine = w.units.filter((u) => u.p === p);
  const myB = w.buildings.filter((b) => b.p === p);
  const foes = w.units.filter((u) => u.p !== p && visible(w, p, u.x, u.y));
  for (const e of foes) ai.seen[UNITS[e.type].armor] = ai.seen[UNITS[e.type].armor] * 0.95 + 1;
  const dozers = mine.filter((u) => UNITS[u.type].role === "builder");
  const trucks = mine.filter((u) => UNITS[u.type].role === "truck");
  const army = mine.filter((u) => !UNITS[u.type].role);
  const queued = (t) => myB.reduce((n, b) => n + b.queue.filter((q) => q.unit === t).length, 0);

  // ---------- الاقتصاد والبناء ----------
  if (!dozers.length && !queued(builderOf(f))) command(w, { type: "produce", p, unit: builderOf(f) });
  const centers = myB.filter((b) => b.type === "supply" && b.done).length;
  if (centers && trucks.length + queued(truckOf(f)) < centers * L.trucks) command(w, { type: "produce", p, unit: truckOf(f) });
  const building = myB.some((b) => !b.done);
  let wantB = null;
  if (me.power.use + 3 > me.power.prod && ai.step > 0) wantB = "power";
  else if (ai.step < L.plan.length) wantB = L.plan[ai.step];
  // بعد الخطة: أبراج إضافية أحياناً
  else if (w.tick % 600 < L.think && myB.filter((b) => b.type === "turret").length < 4) wantB = "turret";
  if (wantB && !building && dozers.some((d) => !d.task)) {
    if (wantB === "super" && myB.some((b) => b.type === "super")) ai.step++;
    else {
      const spot = pickSpot(w, p, wantB);
      if (spot && !canBuild(w, p, wantB, spot)) {
        command(w, { type: "build", p, building: wantB, ...spot });
        if (wantB === L.plan[ai.step]) ai.step++;
      } else if (!spot) ai.step++;
    }
  }
  const reserve = wantB && !building ? buildCost(w, p, wantB) : 0;

  // ---------- الجيش ----------
  const mix = { ...MIX[f] };
  const totalSeen = Object.values(ai.seen).reduce((a, b) => a + b, 0);
  if (totalSeen > 3) for (const [armor, n] of Object.entries(ai.seen)) for (const t of Object.keys(mix)) {
    if (COUNTER_BY_ARMOR[armor].includes(UNITS[t].weapon)) mix[t] += (n / totalSeen) * 0.25;
    if (armor === "air" && UNITS[t].hitsAir) mix[t] += (n / totalSeen) * 0.2;
  }
  if (me.money - reserve > 0 && unitCount(w, p) < MAX_UNITS - 2) {
    const have = {};
    for (const u of army) have[u.type] = (have[u.type] || 0) + 1;
    for (const b of myB) for (const q of b.queue) have[q.unit] = (have[q.unit] || 0) + 1;
    const total = Object.values(have).reduce((a, b) => a + b, 0) + 1;
    const sum = Object.values(mix).reduce((a, b) => a + b, 0);
    const options = Object.keys(mix).filter((t) => {
      const Ud = UNITS[t];
      return myB.some((b) => b.done && b.type === Ud.from && b.queue.length < 2) && (!Ud.req || hasBuilding(w, p, Ud.req)) && me.money - reserve >= Ud.cost;
    }).sort((a, b) => ((have[a] || 0) / total - mix[a] / sum) - ((have[b] || 0) / total - mix[b] / sum));
    if (options[0]) command(w, { type: "produce", p, unit: options[0] });
  }

  // ---------- صلاحيات الجنرال ----------
  if (L.powers || me.rank >= 3) {
    for (const k of ["airstrike", "cash", "paradrop", "reveal", "barrage"]) if (me.points > 0 && !me.powers[k].unlocked && me.rank >= POWERS[k].rank) { command(w, { type: "unlock", p, power: k }); break; }
    const ready = (k) => me.powers[k].unlocked && w.tick >= me.powers[k].ready;
    if (ready("cash")) command(w, { type: "power", p, power: "cash", x: 0, y: 0 });
    const target = bestStrikeTarget(w, p, foes);
    if (target && ready("airstrike")) command(w, { type: "power", p, power: "airstrike", x: target.x, y: target.y });
    else if (target && ready("barrage") && target.value > 1500) command(w, { type: "power", p, power: "barrage", x: target.x, y: target.y });
    if (ready("paradrop")) {
      const raid = w.points.find((pt) => pt.owner === 1 - p) || w.points.find((pt) => pt.owner === -1);
      if (raid) command(w, { type: "power", p, power: "paradrop", x: raid.x, y: raid.y });
    }
    if (ready("reveal")) command(w, { type: "power", p, power: "reveal", x: foeHq.x, y: foeHq.y });
  }
  const sup = myB.find((b) => b.type === "super" && b.done && b.charge >= SUPER.charge);
  if (sup) {
    const known = [...w.known[p].values()];
    const t = known.sort((a, b) => cluster(known, b) - cluster(known, a))[0] || foeHq;
    command(w, { type: "super", p, x: t.x, y: t.y });
  }

  // ---------- الدفاع ----------
  const threat = foes.filter((e) => myB.some((b) => dist(e, b) < L.defendR) && !UNITS[e.type].role);
  if (threat.length) {
    const c = centroid(threat);
    const near = army.filter((u) => dist(u, c) < 900 && (u.order !== "move" || dist(u, hq) < 500));
    if (near.length) command(w, { type: "move", p, ids: near.map((u) => u.id), x: c.x, y: c.y });
    return;
  }
  for (const pt of w.points) {
    if (pt.owner !== p) continue;
    const raid = foes.filter((e) => UNITS[e.type].capture && dist(e, pt) < 120);
    if (!raid.length) continue;
    const helpers = army.filter((u) => u.order === "idle" && dist(u, pt) < 800).slice(0, 5);
    if (helpers.length) { command(w, { type: "move", p, ids: helpers.map((u) => u.id), x: pt.x, y: pt.y }); return; }
  }

  // ---------- الهجوم بموجات ----------
  const idle = army.filter((u) => u.order === "idle");
  const home = idle.filter((u) => dist(u, hq) < 650);
  const field = idle.filter((u) => dist(u, hq) >= 650);
  const secs = w.tick / 10;
  const value = army.reduce((a, u) => a + UNITS[u.type].cost * (u.hp / UNITS[u.type].hp), 0);
  const known = [...w.known[p].values()];
  const goBase = (secs > L.hqAt && value > L.army * 0.6) || value > L.army || secs > L.hqAt * 1.8;
  const pickTarget = (from, withInf) => {
    if (!goBase) {
      const pts = w.points.filter((x) => x.owner !== p);
      if (withInf && pts.length) return pts.sort((a, b) => dist(a, from) - dist(b, from))[0];
    }
    // أقرب مبنى معروف للعدو، وإلا مقرّه
    const k = known.sort((a, b) => dist(a, from) - dist(b, from))[0];
    if (goBase || !withInf) return k || foeHq;
    return null;
  };
  if (field.length) {
    const groups = [];
    for (const u of field) {
      let g = groups.find((x) => dist(x.c, u) < 260);
      if (!g) groups.push((g = { c: { x: u.x, y: u.y }, list: [] }));
      g.list.push(u);
    }
    for (const g of groups) {
      const here = w.points.find((pt) => pt.owner !== p && dist(pt, g.c) < 130);
      const inf = g.list.some((u) => UNITS[u.type].capture);
      if (here && inf) continue;
      const strong = g.list.length >= Math.ceil(L.wave * 0.5);
      const t = strong ? pickTarget(g.c, inf) || foeHq : hq;
      command(w, { type: "move", p, ids: g.list.map((u) => u.id), x: t.x, y: t.y });
    }
  }
  const ground = home.filter((u) => !UNITS[u.type].air);
  if (ground.length >= L.wave) {
    const inf = home.some((u) => UNITS[u.type].capture);
    const t = pickTarget(hq, inf) || foeHq;
    command(w, { type: "move", p, ids: home.map((u) => u.id), x: t.x, y: t.y });
  } else {
    // الطائرات تستطلع وتغير على الشاحنات والمصافي
    const air = home.filter((u) => UNITS[u.type].air);
    if (air.length >= 2) {
      const t = w.points.find((pt) => pt.owner === 1 - p) || known[0] || foeHq;
      command(w, { type: "move", p, ids: air.map((u) => u.id), x: t.x, y: t.y });
    }
  }
}

// أفضل هدف لضربة جوية: أكبر تجمّع ظاهر لوحدات العدو، أو مبنى معروف
function bestStrikeTarget(w, p, foes) {
  let best = null;
  for (const e of foes) {
    if (UNITS[e.type].air) continue;
    const value = foes.filter((x) => Math.hypot(x.x - e.x, x.y - e.y) < 110 && !UNITS[x.type].air).reduce((a, x) => a + UNITS[x.type].cost, 0);
    if (!best || value > best.value) best = { x: e.x, y: e.y, value };
  }
  if (best && best.value >= 1200) return best;
  const k = [...w.known[p].values()].filter((b) => b.done).sort((a, b) => BUILDINGS[b.type].cost - BUILDINGS[a.type].cost)[0];
  return k ? { x: k.x, y: k.y, value: BUILDINGS[k.type].cost } : null;
}
const cluster = (list, k) => list.filter((x) => Math.hypot(x.x - k.x, x.y - k.y) < 180).length;

// أين نبني؟ أرض القاعدة الأقرب للمقرّ، والإمداد قرب مستودع، والدفاعات باتجاه العدو
function pickSpot(w, p, type) {
  const B = BUILDINGS[type];
  const hq = w.city.hqLots[p], foeHq = w.city.hqLots[1 - p];
  const ok = (spot) => !canBuild(w, p, type, spot) || canBuild(w, p, type, spot) === "المؤن لا تكفي";
  if (B.size === "pad") {
    const myLots = w.buildings.filter((b) => b.p === p && b.lot != null).map((b) => b.lot);
    const pads = w.city.pads.filter((pd) => myLots.includes(pd.lot) && !w.padUsed.has(pd.id))
      .sort((a, b) => Math.hypot(a.x - foeHq.x, a.y - foeHq.y) - Math.hypot(b.x - foeHq.x, b.y - foeHq.y));
    const pd = pads.find((x) => ok({ pad: x.id }));
    return pd ? { pad: pd.id } : null;
  }
  let lots = w.city.lots.filter((l) => l.hq < 0 && !w.lotUsed.has(l.id) && l.half === (p === 0 ? 1 : 0));
  if (type === "supply") {
    // قرب مستودع لم نخدمه بعد
    const served = w.buildings.filter((b) => b.p === p && b.type === "supply");
    const depots = w.depots.filter((d) => d.amount > 0 && !served.some((s) => Math.hypot(s.x - d.x, s.y - d.y) < 300))
      .sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y));
    const d = depots[0];
    if (d) lots = lots.sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y));
  } else lots = lots.sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y));
  const l = lots.find((x) => ok({ lot: x.id }));
  return l ? { lot: l.id } : null;
}

export const thinkAll = (w, ais) => ais.forEach((a) => think(w, a));
export { unitsOf };
