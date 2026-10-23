// ============================================================
//  قادة العدو: يقرّرون كل فترة قصيرة أين يهاجمون، ومتى يعزّزون الجبهة، ومتى يدافعون
//  المستويات تختلف في سرعة القرار، والتنسيق بين الأحياء، والحذر، والأخطاء
// ============================================================
import { command, canReach, isAir, typeOf, rateOf, dist, GROUND_SPEED, AIR_SPEED, TICK } from "./sim.js";
import { makeRng } from "./rng.js";

export const LEVELS = {
  easy: { name: "سهل", think: 32, sources: 1, margin: 1.5, reserve: 0.35, mistakes: 0.25, reinforce: 0.5, defend: false, focus: 0 },
  normal: { name: "متوسط", think: 18, sources: 2, margin: 1.25, reserve: 0.25, mistakes: 0.08, reinforce: 0.75, defend: true, focus: 0.3 },
  hard: { name: "صعب", think: 9, sources: 3, margin: 1.12, reserve: 0.18, mistakes: 0, reinforce: 1, defend: true, focus: 0.6 }
};
const VALUE = { hq: 3, factory: 2.2, power: 2.2, airport: 1.9, base: 1.6, home: 1 };

export function createAI(g, p, level = "normal", seed = 1) {
  return { p, L: LEVELS[level], rng: makeRng(seed * 31 + p * 977), next: 10 + p * 3 };
}

// الجنود المتجهون إلى حي (لنا أو للعدو)
function incoming(g, i) {
  const by = {};
  for (const s of g.squads) if (s.to === i) by[s.owner] = (by[s.owner] || 0) + s.n;
  return by;
}

export function think(g, ai) {
  if (g.tick < ai.next || !g.players[ai.p].alive || g.over) return;
  const { L, p, rng } = ai;
  ai.next = g.tick + L.think + Math.floor(rng() * L.think * 0.5);
  const D = g.map.districts;
  const mine = g.d.map((x, i) => i).filter((i) => g.d[i].owner === p);
  if (!mine.length) return;
  const border = (i) => D[i].nb.some((j) => g.d[j].owner !== p);
  // مع مرور الوقت يصبح القائد أجرأ (حتى لا تتجمّد المعركة)
  const late = Math.min(1, g.tick / (10 * 240));
  const margin = L.margin - (L.margin - 1.02) * late * 0.8;
  const reserve = L.reserve * (1 - late * 0.6);
  const full = (i) => g.d[i].troops >= typeOf(g, i).cap * 0.85;

  // 1) الدفاع: حيّ مهدّد بهجوم قادم
  if (L.defend) {
    for (const i of mine) {
      const inc = incoming(g, i);
      const enemy = Object.entries(inc).filter(([o]) => +o !== p).reduce((a, [, n]) => a + n, 0);
      const ours = (inc[p] || 0) + g.d[i].troops * typeOf(g, i).def;
      if (enemy > ours * 0.9) {
        const helpers = D[i].nb.filter((j) => g.d[j].owner === p && g.d[j].troops > 8 && j !== i);
        for (const h of helpers.slice(0, L.sources)) command(g, { type: "send", p, from: h, to: i, n: Math.ceil(Math.min(g.d[h].troops * 0.6, enemy - ours + 6)) });
        if (helpers.length) return;
      }
    }
  }

  // 2) الهجوم: أفضل هدف بالنسبة بين قيمته وكلفته
  const weakest = g.players.filter((x) => x.alive && x.id !== p).map((x) => x.id)
    .sort((a, b) => g.d.filter((d) => d.owner === a).length - g.d.filter((d) => d.owner === b).length)[0];
  let best = null;
  const targets = new Set();
  for (const i of mine) for (let j = 0; j < D.length; j++) if (g.d[j].owner !== p && canReach(g, i, j)) targets.add(j);
  for (const t of targets) {
    const tx = g.d[t];
    const srcs = mine.filter((i) => canReach(g, i, t) && g.d[i].troops >= 4)
      .sort((a, b) => g.d[b].troops - g.d[a].troops).slice(0, L.sources);
    if (!srcs.length) continue;
    const far = Math.max(...srcs.map((s) => dist(g, s, t) / (isAir(g, s, t) ? AIR_SPEED : GROUND_SPEED)));
    const inc = incoming(g, t);
    const growth = tx.owner >= 0 ? rateOf(g, t) * far : 0;
    const need = (tx.troops + growth) * typeOf(g, t).def * margin + 3 - (inc[p] || 0);
    const avail = srcs.reduce((a, s) => a + g.d[s].troops * (border(s) && !full(s) ? 1 - reserve : 0.9), 0);
    // حصار: إذا امتلأت أحياؤنا فالأفضل استنزاف العدو بدل هدر الجنود
    const siege = avail < need && tx.owner >= 0 && srcs.some(full) && avail > need * 0.5;
    if (avail < need && !siege) continue;
    let score = (VALUE[D[t].type] + (tx.owner >= 0 ? 0.6 : 0)) / (need + 6) * (siege ? 0.5 : 1);
    if (tx.owner === weakest) score *= 1 + L.focus;
    if (tx.owner === -1 && D[t].type === "home") score *= 1.1;
    score /= 1 + far / 30;
    if (!best || score > best.score) best = { t, srcs, need: siege ? avail : need, score };
  }
  if (best && rng() < L.mistakes) {
    // خطأ بشري: هجوم متسرّع على هدف عشوائي
    const t = [...targets][Math.floor(rng() * targets.size)];
    const s = mine.filter((i) => canReach(g, i, t)).sort((a, b) => g.d[b].troops - g.d[a].troops)[0];
    if (s != null) { command(g, { type: "send", p, from: s, to: t, pct: 0.6 }); return; }
  }
  if (best) {
    let left = best.need;
    for (const s of best.srcs) {
      if (left <= 0) break;
      const can = Math.floor(g.d[s].troops * (border(s) && !full(s) ? 1 - reserve : 0.9));
      const k = Math.min(can, Math.ceil(left) + 2);
      if (k >= 1) { command(g, { type: "send", p, from: s, to: best.t, n: k }); left -= k; }
    }
  }

  // 3) التعزيز: الأحياء الداخلية ترسل جنودها نحو الجبهة
  if (rng() < L.reinforce) {
    const front = mine.filter(border);
    if (!front.length) return;
    // المسافة (بالخطوات) من كل حي إلى أقرب جبهة
    const hop = Object.fromEntries(front.map((i) => [i, 0]));
    const q = [...front];
    while (q.length) {
      const u = q.shift();
      for (const v of D[u].nb) if (g.d[v].owner === p && hop[v] === undefined) { hop[v] = hop[u] + 1; q.push(v); }
    }
    // الأحياء الممتلئة أولاً (جنودها الزائدة تضيع إن بقيت)
    let moves = 0;
    const interior = mine.filter((i) => !border(i) && hop[i] !== undefined && g.d[i].troops >= 14)
      .sort((a, b) => g.d[b].troops / typeOf(g, b).cap - g.d[a].troops / typeOf(g, a).cap);
    for (const i of interior) {
      if (moves >= L.sources) break;
      const toward = D[i].nb.filter((j) => g.d[j].owner === p && hop[j] === hop[i] - 1)
        .sort((a, b) => g.d[a].troops - g.d[b].troops)[0];
      if (toward != null) { command(g, { type: "send", p, from: i, to: toward, pct: 0.8 }); moves++; }
    }
  }
}

export const thinkAll = (g, ais) => ais.forEach((a) => think(g, a));
export const AI_TICK_SECONDS = TICK;
