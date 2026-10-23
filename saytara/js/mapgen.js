// ============================================================
//  مولّد خرائط المدينة: أحياء (خلايا فورونوي) يقسمها نهر تعبره جسور قليلة،
//  ومبانٍ خاصة: المقرّ، المصانع، محطات الكهرباء، المطار، القواعد العسكرية
//  كل شيء مبذور: نفس الرمز = نفس الخريطة دائماً (للمنافسة ومشاركة الخرائط)
// ============================================================
import { makeRng } from "./rng.js";

export const W = 900, H = 1500;

export const TYPES = {
  home: { name: "حي سكني", icon: "", rate: 1, cap: 60, def: 1 },
  hq: { name: "المقرّ", icon: "🏛️", rate: 1.5, cap: 120, def: 1.4 },
  factory: { name: "مصنع", icon: "🏭", rate: 1.8, cap: 80, def: 1 },
  power: { name: "محطة كهرباء", icon: "⚡", rate: 1, cap: 60, def: 1 },
  airport: { name: "مطار", icon: "✈️", rate: 1, cap: 80, def: 1 },
  base: { name: "قاعدة عسكرية", icon: "🛡️", rate: 1.2, cap: 100, def: 1.7 }
};

const NAMES = ["الزيتون", "النخيل", "الياسمين", "السوق القديم", "الجامعة", "الميناء", "الحدائق", "الورود", "التلال", "الصفصاف",
  "الشروق", "الغروب", "القلعة", "المحطة", "السنديان", "الرمّان", "البستان", "المنارة", "الفرات", "الكرمة", "الربوة", "العين",
  "اللوز", "الأرز", "الواحة", "النسيم", "الهلال", "الجسر", "الطاحونة", "البيادر", "الكروم", "الضيعة", "الساحة", "النجمة"];

// نقاط موزّعة بتباعد متقارب (Poisson disc بأسلوب بسيط)
function scatter(rng, n, river) {
  const pts = [];
  const minD = Math.sqrt((W * H) / n) * 0.78;
  for (let tries = 0; pts.length < n && tries < 20000; tries++) {
    const p = { x: 55 + rng() * (W - 110), y: 60 + rng() * (H - 120) };
    if (Math.abs(p.y - river(p.x)) < 70) continue;
    if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > minD)) pts.push(p);
  }
  return pts;
}

// قصّ مضلّع بنصف مستوى a·x <= b (يحفظ رقم الجار على كل ضلع)
function clip(poly, ax, ay, b, label) {
  const out = [];
  const inside = (p) => ax * p.x + ay * p.y <= b + 1e-7;
  for (let k = 0; k < poly.length; k++) {
    const P = poly[k], Q = poly[(k + 1) % poly.length];
    const iP = inside(P), iQ = inside(Q);
    const cut = () => {
      const dP = ax * P.x + ay * P.y - b, dQ = ax * Q.x + ay * Q.y - b;
      const t = dP / (dP - dQ);
      return { x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t };
    };
    if (iP && iQ) out.push({ ...P });
    else if (iP && !iQ) { out.push({ ...P }); out.push({ ...cut(), l: label }); }
    else if (!iP && iQ) out.push({ ...cut(), l: P.l });
  }
  return out;
}

function voronoi(sites) {
  return sites.map((p, i) => {
    let poly = [{ x: 0, y: 0, l: -1 }, { x: W, y: 0, l: -1 }, { x: W, y: H, l: -1 }, { x: 0, y: H, l: -1 }];
    sites.forEach((q, j) => {
      if (i === j) return;
      const ax = q.x - p.x, ay = q.y - p.y;
      const b = (q.x * q.x + q.y * q.y - p.x * p.x - p.y * p.y) / 2;
      poly = clip(poly, ax, ay, b, j);
    });
    return poly;
  });
}

const area = (poly) => Math.abs(poly.reduce((a, p, k) => { const q = poly[(k + 1) % poly.length]; return a + p.x * q.y - q.x * p.y; }, 0)) / 2;

// نقاط البداية حسب عدد اللاعبين (اللاعب البشري دائماً في الأسفل)
const ANCHORS = {
  2: [[0.5, 0.94], [0.5, 0.06]],
  3: [[0.5, 0.94], [0.12, 0.06], [0.88, 0.06]],
  4: [[0.12, 0.94], [0.88, 0.06], [0.12, 0.06], [0.88, 0.94]]
};

export function generateMap({ seed, players = 2, size = "medium" }) {
  const rng = makeRng(seed);
  const n = { small: 14, medium: 20, large: 27 }[size] + (players - 2) * 2;
  // النهر: منحنى متموّج يعبر المدينة من الغرب إلى الشرق
  const ry = H * (0.47 + rng() * 0.06), a1 = 40 + rng() * 50, f1 = 1.2 + rng() * 1.6, ph = rng() * 6.28, a2 = 15 + rng() * 25;
  const river = (x) => ry + a1 * Math.sin((x / W) * f1 * Math.PI + ph) + a2 * Math.sin((x / W) * 5.3 + ph * 2);

  let sites = scatter(rng, n, river);
  const polys = voronoi(sites);
  const side = sites.map((p) => (p.y < river(p.x) ? 0 : 1));

  // الجيران: خلايا تشترك بضلع، والنهر يقطع كل الصلات إلا عند الجسور
  const nb = sites.map(() => new Set());
  polys.forEach((poly, i) => poly.forEach((v) => { if (v.l >= 0) { nb[i].add(v.l); nb[v.l].add(i); } }));
  const cross = [];
  for (let i = 0; i < sites.length; i++) for (const j of nb[i]) if (i < j && side[i] !== side[j]) cross.push([i, j]);
  for (const [i, j] of cross) { nb[i].delete(j); nb[j].delete(i); }
  const nBridges = Math.max(2, Math.min(4, Math.round(sites.length / 7)));
  const bridges = [];
  const sorted = cross.map(([i, j]) => ({ i, j, mx: (sites[i].x + sites[j].x) / 2, d: Math.hypot(sites[i].x - sites[j].x, sites[i].y - sites[j].y) }));
  for (let b = 0; b < nBridges; b++) {
    const lo = (W * b) / nBridges, hi = (W * (b + 1)) / nBridges;
    const pick = sorted.filter((c) => c.mx >= lo && c.mx < hi && c.mx > 70 && c.mx < W - 70).sort((a, c) => a.d - c.d)[0];
    if (pick && !bridges.some((x) => Math.abs(x.x - pick.mx) < 110)) {
      nb[pick.i].add(pick.j); nb[pick.j].add(pick.i);
      bridges.push({ a: pick.i, b: pick.j, x: pick.mx, y: river(pick.mx) });
    }
  }
  // الأحياء: النوع، الحامية، الاسم، والزينة (اتجاه الشوارع والحدائق)
  const names = [...NAMES].sort(() => rng() - 0.5);
  const D = sites.map((p, i) => ({
    id: i, x: p.x, y: p.y, poly: polys[i].map(({ x, y }) => ({ x, y })), nb: [...nb[i]].sort((a, b) => a - b),
    side: side[i], type: "home", owner: -1, troops: 0, name: "حي " + names[i % names.length],
    deco: { angle: rng() * Math.PI, park: rng() < 0.3, dense: 0.6 + rng() * 0.6 }, area: area(polys[i])
  }));
  // المقرّات
  const taken = new Set();
  const nearest = (fx, fy, filter = () => true) => D.filter((d) => !taken.has(d.id) && filter(d)).sort((a, b) => Math.hypot(a.x - fx * W, a.y - fy * H) - Math.hypot(b.x - fx * W, b.y - fy * H))[0];
  ANCHORS[players].forEach(([fx, fy], p) => {
    const d = nearest(fx, fy);
    d.type = "hq"; d.owner = p; d.troops = 30; d.name = p === 0 ? "مقرّك" : "مقرّ العدو"; taken.add(d.id);
  });
  // لكل لاعب مصنع قريب (للعدل)
  for (let p = 0; p < players; p++) {
    const hq = D.find((d) => d.type === "hq" && d.owner === p);
    const f = D.filter((d) => !taken.has(d.id) && d.side === hq.side).sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[1];
    if (f) { f.type = "factory"; taken.add(f.id); }
  }
  // مبانٍ خاصة في وسط الخريطة يتنافس عليها الجميع
  const mid = D.filter((d) => !taken.has(d.id)).sort((a, b) => Math.abs(a.y - H / 2) - Math.abs(b.y - H / 2));
  const place = (type, count) => {
    for (let k = 0; k < count; k++) {
      const d = mid.find((x) => !taken.has(x.id) && (type !== "airport" || Math.abs(x.y - H / 2) < H * 0.3));
      if (d) { d.type = type; taken.add(d.id); }
    }
  };
  place("airport", 1);
  place("power", players >= 3 ? 2 : 1 + (sites.length > 18 ? 1 : 0));
  place("base", 1 + Math.floor(sites.length / 12));
  place("factory", Math.floor(sites.length / 10));
  const typeName = { factory: "المنطقة الصناعية", power: "محطة الكهرباء", airport: "المطار", base: "القاعدة العسكرية" };
  for (const d of D) {
    if (d.owner >= 0) continue;
    d.troops = { home: 6, factory: 14, power: 16, airport: 22, base: 18 }[d.type] + Math.floor(rng() * 8);
    if (typeName[d.type]) d.name = typeName[d.type];
  }
  // تأكد أن كل الأحياء متصلة
  const seen = new Set([0]), q = [0];
  while (q.length) { const u = q.shift(); for (const v of D[u].nb) if (!seen.has(v)) { seen.add(v); q.push(v); } }
  const connected = seen.size === D.length;
  return { seed, players, size, W, H, districts: D, bridges, river: Array.from({ length: 46 }, (_, k) => { const x = (k / 45) * W; return { x, y: river(x) }; }), connected };
}
