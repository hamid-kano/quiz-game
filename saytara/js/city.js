// ============================================================
//  مولّد المدينة: شبكة شوارع وجادّات، كتل أبنية وحدائق ومناطق صناعية،
//  نهر تعبره جسور، ومواقع للسيطرة ومقرّان.
//  الخريطة متناظرة بالدوران 180° حول المركز: النصفان متطابقان تماماً فالمعركة عادلة.
//  كل شيء مبذور: نفس الرمز = نفس المدينة.
// ============================================================
import { makeRng } from "./rng.js";

export const W = 1400, H = 2200;
const C = 9;            // أعمدة التقاطعات
const R = 7;            // صفوف التقاطعات في كل نصف
const RIVER_A = 46;     // تموّج النهر
export const riverY = (x) => H / 2 + RIVER_A * Math.sin((2 * Math.PI * (x - W / 2)) / W);
export const STREET = 13, AVENUE = 22; // نصف عرض الشارع والجادّة

export const POINT_TYPES = {
  civic: { name: "حي سكني", icon: "🏘️", income: 2, vision: 160 },
  factory: { name: "مصنع", icon: "🏭", income: 4, vision: 160 },
  tower: { name: "برج اتصالات", icon: "📡", income: 1, vision: 420 },
  hq: { name: "المقرّ", icon: "🏛️", income: 0, vision: 300 }
};

const rot = (p) => ({ x: W - p.x, y: H - p.y });

export function generateCity(seed, attempt = 0) {
  const rng = makeRng(seed + attempt * 7919);
  const jit = () => (rng() - 0.5) * 30;
  // ---------- التقاطعات (النصف العلوي ثم نسخته المدوّرة) ----------
  const top = [];
  const avenueCols = new Set([2, 6]);
  const avenueRows = new Set([3]);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const x0 = 60 + c * ((W - 120) / (C - 1));
    let x = x0 + (c === 0 || c === C - 1 ? 0 : jit());
    let y;
    if (r === R - 1) y = riverY(x) - 92;                    // الصف المحاذي للنهر يتبع انحناءه
    else y = 70 + r * ((H / 2 - 92 - 70 - 40) / (R - 1)) + (r === 0 ? 0 : jit());
    top.push({ x, y, r, c });
  }
  const nodes = [...top, ...top.map((n) => ({ ...rot(n), r: n.r, c: n.c, bottom: true }))];
  const N = top.length;
  // العقدة (r,c) في النصف السفلي هي صورة العقدة (r,c) من العلوي بعد الدوران: رقمها + N
  const id = (half, r, c) => half * N + r * C + c;

  // ---------- الشوارع ----------
  const edges = [];
  const addEdge = (a, b, kind) => edges.push({ a, b, kind, len: Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) });
  const removed = new Set();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (c < C - 1) {
      const kind = avenueRows.has(r) ? "avenue" : "street";
      const edgeKey = `h${r}-${c}`;
      // نحذف بعض الشوارع الصغيرة الداخلية لتبدو المدينة طبيعية (لا الجادّات ولا الأطراف)
      if (kind === "street" && r > 0 && r < R - 1 && rng() < 0.12) removed.add(edgeKey);
      else for (const h of [0, 1]) addEdge(id(h, r, c), id(h, r, c + 1), kind);
    }
    if (r < R - 1) {
      const kind = avenueCols.has(c) || avenueCols.has(C - 1 - c) ? "avenue" : "street";
      const edgeKey = `v${r}-${c}`;
      if (kind === "street" && c > 0 && c < C - 1 && rng() < 0.12) removed.add(edgeKey);
      else for (const h of [0, 1]) addEdge(id(h, r, c), id(h, r + 1, c), kind);
    }
  }
  // الجسور: ثلاثة، متناظرة (الأعمدة 1 و4 و7)
  const bridges = [];
  for (const c of [1, 4, 7]) {
    const a = id(0, R - 1, c), b = id(1, R - 1, C - 1 - c);
    addEdge(a, b, "bridge");
    bridges.push({ a, b, x: (nodes[a].x + nodes[b].x) / 2, y: (nodes[a].y + nodes[b].y) / 2, ang: Math.atan2(nodes[b].y - nodes[a].y, nodes[b].x - nodes[a].x) });
  }
  const adj = nodes.map(() => []);
  edges.forEach((e, k) => { adj[e.a].push({ to: e.b, k }); adj[e.b].push({ to: e.a, k }); });

  // ---------- كتل الأبنية ----------
  const halfW = (a, b) => {
    const e = edges.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    return e ? (e.kind === "avenue" ? AVENUE : STREET) : 4; // شارع محذوف: الكتلتان تكادان تلتصقان
  };
  const topBlocks = [];
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
    const q = [id(0, r, c), id(0, r, c + 1), id(0, r + 1, c + 1), id(0, r + 1, c)];
    topBlocks.push({ r, c, q });
  }
  const makePoly = (q) => {
    const P = q.map((i) => nodes[i]);
    const cx = P.reduce((a, p) => a + p.x, 0) / 4, cy = P.reduce((a, p) => a + p.y, 0) / 4;
    return P.map((p, k) => {
      const w1 = halfW(q[k], q[(k + 1) % 4]), w2 = halfW(q[k], q[(k + 3) % 4]);
      const d = Math.hypot(cx - p.x, cy - p.y);
      const inset = (Math.max(w1, w2) + 5) * Math.SQRT2;
      return { x: p.x + ((cx - p.x) * inset) / d, y: p.y + ((cy - p.y) * inset) / d };
    });
  };
  // أنواع الكتل في النصف العلوي (والسفلي نسخة منها)
  const kinds = topBlocks.map((b) => {
    const x = rng();
    if (b.r === R - 2) return x < 0.5 ? "riverside" : "dense";
    return x < 0.13 ? "park" : x < 0.24 ? "industrial" : "dense";
  });
  // ---------- المواقع: المقرّ + مواقع السيطرة (في النصف العلوي ثم نسختها) ----------
  const pick = new Map();
  const hqCol = 3 + Math.floor(rng() * 2); // عمود المقرّ (3 أو 4) قرب الوسط
  pick.set(`0-${hqCol}`, "hq");
  const cand = topBlocks.filter((b) => !(b.r === 0 && Math.abs(b.c - hqCol) <= 1)).sort(() => rng() - 0.5);
  const wanted = ["factory", "factory", "tower", "civic", "civic", "civic"];
  const chosen = [];
  for (const b of cand) {
    if (chosen.length >= wanted.length) break;
    // متباعدة عن بعضها وعن المقرّ
    if (chosen.some((o) => Math.abs(o.r - b.r) + Math.abs(o.c - b.c) < 3)) continue;
    if (b.r <= 1 && Math.abs(b.c - hqCol) <= 2) continue;
    chosen.push(b);
  }
  // المصانع أقرب للنهر (موارد يتنافس عليها الطرفان)، والبرج في الوسط
  chosen.sort((a, b) => b.r - a.r);
  chosen.forEach((b, k) => pick.set(`${b.r}-${b.c}`, wanted[k]));

  const blocks = [];
  const points = [];
  for (const h of [0, 1]) topBlocks.forEach((b, k) => {
    const q = h ? b.q.map((i) => i + N) : b.q;
    const poly = makePoly(q);
    const cx = poly.reduce((a, p) => a + p.x, 0) / 4, cy = poly.reduce((a, p) => a + p.y, 0) / 4;
    const pt = pick.get(`${b.r}-${b.c}`);
    const block = { poly, x: cx, y: cy, kind: pt ? (pt === "hq" ? "hq" : "plaza") : kinds[k], half: h, seed: seed * 7 + k, q };
    blocks.push(block);
    if (pt) {
      // أقرب تقاطع للموقع (منه يدخل الجنود)
      const entry = q.reduce((best, i) => (Math.hypot(nodes[i].x - cx, nodes[i].y - cy) < Math.hypot(nodes[best].x - cx, nodes[best].y - cy) ? i : best), q[0]);
      points.push({ id: points.length, type: pt, x: cx, y: cy, entry, block: blocks.length - 1, owner: pt === "hq" ? (h ? 0 : 1) : -1 });
    }
  });
  // الأبنية داخل كل كتلة (مبذورة بكتلتها: النصف السفلي يأخذ نفس الأبنية مدوّرة)
  for (const b of blocks) b.buildings = makeBuildings(b, makeRng(b.seed));
  // نادراً ما تنعزل تقاطعات بسبب الشوارع المحذوفة: نعيد التوليد بمحاولة أخرى
  const seen = new Set([0]), bfs = [0];
  while (bfs.length) { const u = bfs.shift(); for (const { to } of adj[u]) if (!seen.has(to)) { seen.add(to); bfs.push(to); } }
  if (seen.size !== nodes.length && attempt < 20) return generateCity(seed, attempt + 1);
  return { seed, W, H, nodes, edges, adj, bridges, blocks, points, hq: [points.find((p) => p.type === "hq" && p.owner === 0), points.find((p) => p.type === "hq" && p.owner === 1)] };
}

// نقطة داخل الكتلة بالإحداثيين (u,v) من 0 إلى 1
const bilerp = (P, u, v) => {
  const ax = P[0].x + (P[1].x - P[0].x) * u, ay = P[0].y + (P[1].y - P[0].y) * u;
  const bx = P[3].x + (P[2].x - P[3].x) * u, by = P[3].y + (P[2].y - P[3].y) * u;
  return { x: ax + (bx - ax) * v, y: ay + (by - ay) * v };
};
const quad = (P, u0, u1, v0, v1) => [bilerp(P, u0, v0), bilerp(P, u1, v0), bilerp(P, u1, v1), bilerp(P, u0, v1)];

const ROOFS = ["#cbc4b6", "#b9ad9c", "#d6cfc2", "#a99e8d", "#c2b6a3", "#9fa8b0", "#bfb3a0", "#d9d2c3", "#b3a28c"];
function makeBuildings(b, rng) {
  const P = b.poly, out = { list: [], trees: [], tanks: [] };
  if (b.kind === "park") {
    for (let k = 0; k < 22; k++) out.trees.push({ ...bilerp(P, 0.08 + rng() * 0.84, 0.08 + rng() * 0.84), r: 9 + rng() * 9 });
    return out;
  }
  if (b.kind === "plaza" || b.kind === "hq") {
    // أبنية على الأطراف وساحة في الوسط
    for (const [u0, u1, v0, v1] of [[0.04, 0.3, 0.04, 0.26], [0.7, 0.96, 0.04, 0.26], [0.04, 0.3, 0.74, 0.96], [0.7, 0.96, 0.74, 0.96]])
      out.list.push({ poly: quad(P, u0, u1, v0, v1), h: 10 + rng() * 14, roof: ROOFS[Math.floor(rng() * ROOFS.length)] });
    return out;
  }
  if (b.kind === "industrial") {
    out.list.push({ poly: quad(P, 0.06, 0.62, 0.08, 0.55), h: 9, roof: "#8f979e", ind: true });
    out.list.push({ poly: quad(P, 0.06, 0.48, 0.64, 0.94), h: 7, roof: "#9aa1a6", ind: true });
    for (let k = 0; k < 3; k++) out.tanks.push({ ...bilerp(P, 0.72 + (k % 2) * 0.14, 0.2 + k * 0.25), r: 15 });
    return out;
  }
  // كتلة سكنية كثيفة: قطع أراضٍ بأحجام مختلفة
  const nu = 2 + Math.floor(rng() * 2), nv = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    if (rng() < 0.12) { out.trees.push({ ...bilerp(P, (i + 0.5) / nu, (j + 0.5) / nv), r: 12 }); continue; }
    const m = 0.03;
    out.list.push({
      poly: quad(P, i / nu + m, (i + 1) / nu - m, j / nv + m, (j + 1) / nv - m),
      h: (b.kind === "riverside" ? 6 : 8) + rng() * (b.kind === "riverside" ? 10 : 30),
      roof: ROOFS[Math.floor(rng() * ROOFS.length)], ac: rng() < 0.6
    });
  }
  return out;
}

// ---------- الطرق: أقرب نقطة على الشبكة، وأقصر مسار ----------
export function nearestOnRoad(city, x, y) {
  let best = null;
  for (const e of city.edges) {
    const A = city.nodes[e.a], B = city.nodes[e.b];
    const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - A.x) * dx + (y - A.y) * dy) / L2));
    const px = A.x + dx * t, py = A.y + dy * t;
    const d = Math.hypot(px - x, py - y);
    if (!best || d < best.d) best = { x: px, y: py, d, e, t };
  }
  return best;
}

// الموقع (الساحة) الذي يقع فيه هذا المكان، إن وُجد
export function pointAt(city, x, y) {
  return city.points.find((p) => Math.hypot(p.x - x, p.y - y) < 70) || null;
}

// أقصر مسار بين موضعين على الشبكة (A*)، يعيد نقاط الطريق
export function findPath(city, from, to) {
  const s = nearestOnRoad(city, from.x, from.y), g = nearestOnRoad(city, to.x, to.y);
  const nodes = city.nodes;
  // نقطتا البداية: طرفا الشارع الذي نحن عليه
  const startCands = [s.e.a, s.e.b], goalCands = new Set([g.e.a, g.e.b]);
  const dist = new Map(), prev = new Map(), open = [];
  for (const n of startCands) { const d = Math.hypot(nodes[n].x - s.x, nodes[n].y - s.y); dist.set(n, d); open.push(n); }
  const h = (n) => Math.hypot(nodes[n].x - g.x, nodes[n].y - g.y);
  const closed = new Set();
  let end = null;
  while (open.length) {
    open.sort((a, b) => dist.get(a) + h(a) - (dist.get(b) + h(b)));
    const u = open.shift();
    if (closed.has(u)) continue;
    closed.add(u);
    if (goalCands.has(u)) {
      // نتحقق من الطرف الآخر أيضاً (قد يكون أقرب عبره)
      end = end == null || dist.get(u) + Math.hypot(nodes[u].x - g.x, nodes[u].y - g.y) < dist.get(end) + Math.hypot(nodes[end].x - g.x, nodes[end].y - g.y) ? u : end;
      if ([...goalCands].every((x) => closed.has(x))) break;
      continue;
    }
    for (const { to: v, k } of city.adj[u]) {
      const d = dist.get(u) + city.edges[k].len;
      if (!dist.has(v) || d < dist.get(v)) { dist.set(v, d); prev.set(v, u); open.push(v); }
    }
  }
  const path = [];
  // الخطوة الأخيرة: من الشارع إلى الهدف نفسه (مثل وسط الساحة) إن كان خارج الشارع
  const tail = Math.hypot(to.x - g.x, to.y - g.y) > 2 ? [{ x: g.x, y: g.y }, { x: to.x, y: to.y }] : [{ x: g.x, y: g.y }];
  if (s.e === g.e || end == null) return tail;
  let n = end;
  while (n != null) { path.unshift({ x: nodes[n].x, y: nodes[n].y }); n = prev.get(n); }
  return [...path, ...tail];
}
