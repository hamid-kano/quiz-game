// ============================================================
//  قائد العدو: يشتري الوحدات حسب خطة ويغيّرها لمواجهة ما يراه منك،
//  ويحتلّ المواقع بموجات، ويدافع عن مقرّه ومواقعه، ثم يهاجم مقرّك حين يقوى.
//  لا يغشّ: يرى فقط ما تراه وحداته (إلا موقع مقرّك فهو معروف للجميع).
// ============================================================
import { command, visible, unitCount, MAX_UNITS } from "./world.js";
import { UNITS } from "./units.js";
import { POINT_TYPES } from "./city.js";

// income: مضاعف الدخل (القائد الصعب يملك موارد أكثر، والسهل أقل)
export const LEVELS = {
  easy: { name: "سهل", think: 30, wave: 6, mix: { infantry: 0.75, tank: 0.2, artillery: 0, drone: 0.05 }, counter: false, hqAt: 600, army: 1800, defendR: 300, income: 0.8 },
  normal: { name: "متوسط", think: 16, wave: 5, mix: { infantry: 0.55, tank: 0.25, artillery: 0.1, drone: 0.1 }, counter: true, hqAt: 420, army: 1500, defendR: 420, income: 1 },
  hard: { name: "صعب", think: 12, wave: 5, mix: { infantry: 0.5, tank: 0.28, artillery: 0.12, drone: 0.1 }, counter: true, hqAt: 450, army: 1800, defendR: 480, income: 1.25 }
};
// ما يهزم كل نوع
const COUNTER = { tank: "artillery", infantry: "tank", artillery: "drone", drone: "infantry" };
const VALUE = { factory: 3, tower: 2, civic: 2, hq: 0 };

export function createAI(w, p, level = "normal") {
  w.players[p].incomeMul = LEVELS[level].income;
  return { p, L: LEVELS[level], next: 5, seenEnemy: { infantry: 0, tank: 0, artillery: 0, drone: 0 } };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const centroid = (list) => ({ x: list.reduce((a, u) => a + u.x, 0) / list.length, y: list.reduce((a, u) => a + u.y, 0) / list.length });

export function think(w, ai) {
  if (w.tick < ai.next || w.over) return;
  const { p, L } = ai;
  ai.next = w.tick + L.think;
  const me = w.players[p], hq = me.hq, foeHq = w.players[1 - p].hq;
  const mine = w.units.filter((u) => u.p === p);
  const foes = w.units.filter((u) => u.p !== p && visible(w, p, u.x, u.y));
  for (const f of foes) ai.seenEnemy[f.type] = ai.seenEnemy[f.type] * 0.9 + 1; // ذاكرة متناقصة

  // ---------- الشراء ----------
  const mix = { ...L.mix };
  if (L.counter) {
    const total = Object.values(ai.seenEnemy).reduce((a, b) => a + b, 0);
    if (total > 2) for (const [t, n] of Object.entries(ai.seenEnemy)) mix[COUNTER[t]] += (n / total) * 0.5;
  }
  if (me.queue.length < 2 && unitCount(w, p) < MAX_UNITS) {
    const have = {};
    for (const u of mine) have[u.type] = (have[u.type] || 0) + 1;
    for (const q of me.queue) have[q.unit] = (have[q.unit] || 0) + 1;
    const total = Object.values(have).reduce((a, b) => a + b, 0) + 1;
    const sum = Object.values(mix).reduce((a, b) => a + b, 0);
    // النوع الأبعد عن نسبته المطلوبة
    const want = Object.keys(mix).filter((t) => mix[t] > 0)
      .sort((a, b) => ((have[a] || 0) / total - mix[a] / sum) - ((have[b] || 0) / total - mix[b] / sum))[0];
    if (me.money >= UNITS[want].cost) command(w, { type: "build", p, unit: want });
  }

  // ---------- الدفاع ----------
  const threat = foes.filter((f) => dist(f, hq) < L.defendR);
  if (threat.length) {
    const c = centroid(threat);
    const near = mine.filter((u) => (dist(u, hq) < 700 && u.order !== "move") || dist(u, hq) < 350);
    if (near.length) command(w, { type: "move", p, ids: near.map((u) => u.id), x: c.x, y: c.y });
    return;
  }
  // موقع لنا يحتلّه العدو
  for (const pt of w.points) {
    if (pt.owner !== p || pt.type === "hq") continue;
    const raid = foes.filter((f) => UNITS[f.type].capture && dist(f, pt) < 110);
    if (!raid.length) continue;
    const helpers = mine.filter((u) => u.order === "idle" && dist(u, pt) < 700).slice(0, 5);
    if (helpers.length) { command(w, { type: "move", p, ids: helpers.map((u) => u.id), x: pt.x, y: pt.y }); return; }
  }

  // ---------- الهجوم ----------
  const idle = mine.filter((u) => u.order === "idle");
  const home = idle.filter((u) => dist(u, hq) < 420);
  const field = idle.filter((u) => dist(u, hq) >= 420);
  const owned = w.points.filter((x) => x.owner === p && x.type !== "hq").length;
  const capturable = w.points.filter((x) => x.type !== "hq" && x.owner !== p);
  const secs = w.tick / 10;
  const armyValue = mine.reduce((a, u) => a + UNITS[u.type].cost * (u.hp / UNITS[u.type].hp), 0);
  const theirs = w.points.filter((x) => x.owner === 1 - p && x.type !== "hq").length;
  // نهاجم المقرّ حين نسيطر على المدينة، أو حين يكبر جيشنا بعد وقت كافٍ
  const goHq = capturable.length === 0 || (owned >= theirs + 3 && armyValue > L.army * 0.7) || (secs > L.hqAt && armyValue > L.army) || secs > L.hqAt * 2;
  const pickTarget = (from) => {
    if (goHq) return { x: foeHq.x, y: foeHq.y };
    let best = null, bs = -1;
    for (const pt of capturable) {
      const s = (VALUE[pt.type] + (pt.owner === -1 ? 1 : 0.4)) / (dist(from, pt) + 400);
      if (s > bs) { bs = s; best = pt; }
    }
    return best;
  };
  // وحدات في الميدان أنهت مهمتها: تتابع إلى الهدف التالي إن كانت قوية، وإلا تعود
  if (field.length) {
    const groups = [];
    for (const u of field) {
      let g = groups.find((x) => dist(x.c, u) < 220);
      if (!g) groups.push((g = { c: { x: u.x, y: u.y }, list: [] }));
      g.list.push(u);
    }
    for (const g of groups) {
      // ما زال هناك موقع يُحتل هنا: نبقى
      const here = w.points.find((pt) => pt.type !== "hq" && pt.owner !== p && dist(pt, g.c) < 120);
      if (here && g.list.some((u) => UNITS[u.type].capture)) continue;
      const strong = g.list.length >= Math.ceil(L.wave * 0.6) && g.list.some((u) => UNITS[u.type].capture);
      const t = strong ? pickTarget(g.c) : hq;
      if (t) command(w, { type: "move", p, ids: g.list.map((u) => u.id), x: t.x, y: t.y });
    }
  }
  const ground = home.filter((u) => !UNITS[u.type].air);
  if (ground.length >= L.wave && ground.filter((u) => UNITS[u.type].capture).length >= 2) {
    const t = pickTarget(hq);
    if (t) command(w, { type: "move", p, ids: home.map((u) => u.id), x: t.x, y: t.y });
  } else {
    // المسيّرات تستطلع أمام المقر
    const drones = home.filter((u) => u.type === "drone");
    if (drones.length) {
      const t = pickTarget(hq) || foeHq;
      command(w, { type: "move", p, ids: drones.map((u) => u.id), x: (t.x + hq.x) / 2, y: (t.y + hq.y) / 2 });
    }
  }
}

export const thinkAll = (w, ais) => ais.forEach((a) => think(w, a));
export { POINT_TYPES };
