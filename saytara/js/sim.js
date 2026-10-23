// ============================================================
//  محاكاة المعركة: تتقدّم بخطوات ثابتة (10 خطوات في الثانية) وتتغيّر فقط بالأوامر
//  هذا التصميم (أوامر + خطوات ثابتة + عشوائية مبذورة) هو ما يسمح لاحقاً باللعب أونلاين:
//  كل جهاز يشغّل نفس المحاكاة ويتبادل الأوامر فقط
// ============================================================
import { TYPES } from "./mapgen.js";

export const TICK = 0.1;            // ثانية لكل خطوة
export const GROUND_SPEED = 80;     // سرعة الجنود على الأرض (وحدة خريطة/ثانية)
export const AIR_SPEED = 170;       // سرعة الجسر الجوي من المطار
export const POWER_BONUS = 0.2;     // زيادة الإنتاج لكل محطة كهرباء
export const BASE_RATE = 0.9;       // جنود في الثانية للحي العادي

export const COLORS = ["#2f7cf6", "#e5484d", "#f59e0b", "#8b5cf6"];
export const NEUTRAL = "#9aa3ad";
export const PLAYER_NAMES = ["أنت", "الأحمر", "البرتقالي", "البنفسجي"];

export function createGame(map, { ai = [] } = {}) {
  return {
    map,
    tick: 0,
    d: map.districts.map((x) => ({ owner: x.owner, troops: x.troops })),
    squads: [],
    nextId: 1,
    queue: [],
    events: [],
    players: Array.from({ length: map.players }, (_, p) => ({ id: p, alive: true, ai: ai[p] || null, color: COLORS[p], name: PLAYER_NAMES[p], outAt: null })),
    stats: Array.from({ length: map.players }, () => ({ sent: 0, captured: 0, lost: 0, peak: 0, battles: 0 })),
    over: false, winner: null
  };
}

export const dist = (g, a, b) => {
  const A = g.map.districts[a], B = g.map.districts[b];
  return Math.hypot(A.x - B.x, A.y - B.y);
};
export const typeOf = (g, i) => TYPES[g.map.districts[i].type];
export const powerCount = (g, p) => g.d.reduce((n, x, i) => n + (x.owner === p && g.map.districts[i].type === "power" ? 1 : 0), 0);
export const rateOf = (g, i) => {
  const o = g.d[i].owner;
  if (o < 0) return 0;
  return BASE_RATE * typeOf(g, i).rate * (1 + POWER_BONUS * powerCount(g, o));
};
// هل يمكن الإرسال من هذا الحي إلى ذاك؟ (الجيران فقط، إلا من المطار: إلى أي مكان)
export const canReach = (g, from, to) => from !== to && (g.map.districts[from].nb.includes(to) || g.map.districts[from].type === "airport");
export const isAir = (g, from, to) => g.map.districts[from].type === "airport" && !g.map.districts[from].nb.includes(to);

// أمر إرسال: من حي أو عدّة أحياء إلى هدف. pct نسبة الجنود، أو n عدد محدد لكل مصدر
export function command(g, cmd) {
  g.queue.push({ ...cmd, at: g.tick });
}

function applySend(g, { p, from, to, pct = 0.5, n = null }) {
  let sent = 0;
  for (const f of [].concat(from)) {
    const src = g.d[f];
    if (!src || src.owner !== p || !canReach(g, f, to)) continue;
    const k = Math.floor(n != null ? Math.min(n, src.troops) : src.troops * pct);
    if (k < 1) continue;
    src.troops -= k;
    const air = isAir(g, f, to);
    g.squads.push({ id: g.nextId++, owner: p, n: k, from: f, to, len: dist(g, f, to), prog: 0, speed: air ? AIR_SPEED : GROUND_SPEED, air });
    g.stats[p].sent += k;
    sent += k;
  }
  if (sent) g.events.push({ type: "send", p, to, n: sent });
  return sent;
}

export function step(g) {
  if (g.over) return;
  // الأوامر
  for (const c of g.queue.splice(0)) if (c.type === "send" && g.players[c.p].alive) applySend(g, c);
  // الإنتاج
  for (let i = 0; i < g.d.length; i++) {
    const x = g.d[i];
    if (x.owner < 0) continue;
    const cap = typeOf(g, i).cap;
    if (x.troops < cap) x.troops = Math.min(cap, x.troops + rateOf(g, i) * TICK);
    else x.troops = Math.max(cap, x.troops - 0.6 * TICK);
  }
  // الحركة والاشتباك على نفس الطريق
  for (const s of g.squads) s.prog += s.speed * TICK;
  for (const a of g.squads) {
    if (a.n <= 0 || a.air) continue;
    for (const b of g.squads) {
      if (b === a || b.n <= 0 || b.air || b.owner === a.owner || b.from !== a.to || b.to !== a.from) continue;
      if (a.prog + b.prog >= a.len) {
        const k = Math.min(a.n, b.n);
        a.n -= k; b.n -= k;
        const t = a.prog / a.len;
        const A = g.map.districts[a.from], B = g.map.districts[a.to];
        g.events.push({ type: "clash", x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, n: k });
        g.stats[a.owner].battles++; g.stats[b.owner].battles++;
      }
    }
  }
  // الوصول
  for (const s of g.squads) {
    if (s.n <= 0 || s.prog < s.len) continue;
    arrive(g, s);
    s.n = 0;
  }
  g.squads = g.squads.filter((s) => s.n > 0);
  g.tick++;
  // الإحصاءات ونهاية المعركة
  if (g.tick % 10 === 0) {
    for (const pl of g.players) {
      if (!pl.alive) continue;
      const t = totalTroops(g, pl.id);
      g.stats[pl.id].peak = Math.max(g.stats[pl.id].peak, Math.round(t));
      if (!g.d.some((x) => x.owner === pl.id) && !g.squads.some((s) => s.owner === pl.id)) {
        pl.alive = false; pl.outAt = g.tick;
        g.events.push({ type: "eliminated", p: pl.id });
      }
    }
    const alive = g.players.filter((p) => p.alive);
    if (alive.length <= 1 || !g.players[0].alive) {
      g.over = true;
      g.winner = g.players[0].alive && alive.length === 1 ? 0 : alive.length === 1 ? alive[0].id : alive.find((p) => p.id !== 0)?.id ?? -1;
    }
  }
}

function arrive(g, s) {
  const t = g.d[s.to];
  if (t.owner === s.owner) { t.troops += s.n; return; }
  const def = typeOf(g, s.to).def;
  const eff = t.troops * def;
  const before = t.owner;
  if (s.n > eff) {
    t.owner = s.owner;
    t.troops = s.n - eff;
    g.stats[s.owner].captured++;
    if (before >= 0) g.stats[before].lost++;
    g.events.push({ type: "capture", id: s.to, p: s.owner, from: before });
  } else {
    t.troops = (eff - s.n) / def;
    g.events.push({ type: "hit", id: s.to, p: s.owner });
  }
}

export const totalTroops = (g, p) =>
  g.d.reduce((a, x) => a + (x.owner === p ? x.troops : 0), 0) + g.squads.reduce((a, s) => a + (s.owner === p ? s.n : 0), 0);
export const districtsOf = (g, p) => g.d.reduce((n, x) => n + (x.owner === p ? 1 : 0), 0);
export const seconds = (g) => Math.round(g.tick * TICK);
