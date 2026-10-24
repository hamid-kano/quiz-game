// ============================================================
//  الحلبات: كل حلبة مسار مغلق على شبكة مربّعات (10 وحدات)،
//  يُكتب بحركات: R يمين(+X) L يسار D أسفل(+Z) U أعلى(-Z) مع عدد المربّعات.
//  من المسار نبني: قطع الطريق (مستقيم/منعطف بزاوية دوران)، وخط المنتصف الدقيق
//  الذي تُقاس عليه المسافة والترتيب والجدران.
// ============================================================
export const CELL = 10;
export const HALF_ROAD = 4.15;      // نصف عرض الطريق حتى الحاجز

export const TRACKS = [
  { id: "forest", name: "حلبة الغابة", path: "R6D3L6U3", laps: 4, theme: "day", bumps: 0, pads: 1, coins: 120 },
  { id: "hook", name: "منعطف الصنّارة", path: "R5D2L2D3L3U5", laps: 4, theme: "day", bumps: 2, pads: 2, coins: 160 },
  { id: "zigzag", name: "المتعرّج", path: "R4D2R3D3L3D2L4U7", laps: 3, theme: "sunset", bumps: 2, pads: 2, coins: 200 },
  { id: "snake", name: "الأفعى", path: "R2D1R2U1R2D4L6U4", laps: 4, theme: "day", bumps: 3, pads: 2, coins: 240 },
  { id: "double", name: "الحلقة المزدوجة", path: "R7D2L3D2R3D2L7U6", laps: 3, theme: "sunset", bumps: 3, pads: 3, coins: 280 },
  { id: "castle", name: "القلعة", path: "R3U2R4D2R2D5L4U2L5U3", laps: 3, theme: "night", bumps: 3, pads: 3, coins: 320 },
  { id: "chicane", name: "الشيكان", path: "R8D2L2D2R2D2L8U6", laps: 3, theme: "night", bumps: 4, pads: 3, coins: 380 },
  { id: "grand", name: "الجائزة الكبرى", path: "R4U3R4D3R4D5L3U2L3D2L6U5", laps: 3, theme: "sunset", bumps: 4, pads: 4, coins: 450 }
];

const DIR = { R: [1, 0], L: [-1, 0], D: [0, 1], U: [0, -1] };
const OPP = { R: "L", L: "R", D: "U", U: "D" };
// دوران المنعطف الأساسي (يصل الجهة D بالجهة L) ليصل جهتين أخريين
const CORNER_ROT = { "D,L": 0, "D,R": 1, "R,U": 2, "L,U": 3 };
const key2 = (a, b) => [a, b].sort().join(",");

export function parsePath(path) {
  const moves = [];
  for (const m of path.matchAll(/([RLDU])(\d+)/g)) for (let k = 0; k < +m[2]; k++) moves.push(m[1]);
  return moves;
}

// يبني الحلبة: الخلايا، القطع، خط المنتصف (نقاط كل ~0.5 وحدة مع المسافة التراكمية)
export function buildTrack(def) {
  let moves = parsePath(def.path);
  // خط البداية على مستقيم طويل (الخلية الثانية أو الثالثة من أطول مستقيم) لتقف السيارات خلفه
  {
    const n = moves.length;
    let best = 0, bestLen = 0;
    for (let j = 0; j < n; j++) {
      if (moves[(j - 1 + n) % n] === moves[j]) continue;
      let L = 1; while (L < n && moves[(j + L) % n] === moves[j]) L++;
      if (L > bestLen) { bestLen = L; best = j; }
    }
    const start = (best + (bestLen >= 4 ? 2 : 1)) % n;
    moves = moves.slice(start).concat(moves.slice(0, start));
  }
  const cells = [];
  let x = 0, z = 0;
  for (let i = 0; i < moves.length; i++) {
    cells.push({ x, z, inDir: moves[(i - 1 + moves.length) % moves.length], outDir: moves[i] });
    x += DIR[moves[i]][0]; z += DIR[moves[i]][1];
  }
  const closed = x === 0 && z === 0;
  const seen = new Set(cells.map((c) => `${c.x},${c.z}`));
  const valid = closed && seen.size === cells.length;
  const tiles = cells.map((c, i) => {
    const from = OPP[c.inDir], to = c.outDir;
    const cx = c.x * CELL, cz = c.z * CELL;
    if (from === OPP[to]) return { kind: i === 0 ? "finish" : "straight", x: cx, z: cz, rot: c.outDir === "R" || c.outDir === "L" ? 1 : 0, from, to };
    return { kind: "corner", x: cx, z: cz, rot: CORNER_ROT[key2(from, to)], from, to };
  });
  // خط المنتصف
  const pts = [];
  for (const t of tiles) {
    const a = DIR[t.from], b = DIR[t.to];
    const p0 = { x: t.x + a[0] * CELL / 2, z: t.z + a[1] * CELL / 2 };
    t.p0 = pts.length;
    if (t.kind !== "corner") {
      for (let k = 0; k < 20; k++) pts.push({ x: p0.x + (b[0] * CELL * k) / 20, z: p0.z + (b[1] * CELL * k) / 20 });
    } else {
      const c = { x: t.x + (a[0] + b[0]) * CELL / 2, z: t.z + (a[1] + b[1]) * CELL / 2 };
      const a0 = Math.atan2(p0.z - c.z, p0.x - c.x);
      const p1 = { x: t.x + b[0] * CELL / 2, z: t.z + b[1] * CELL / 2 };
      let a1 = Math.atan2(p1.z - c.z, p1.x - c.x);
      let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      for (let k = 0; k < 16; k++) { const an = a0 + (d * k) / 16; pts.push({ x: c.x + Math.cos(an) * CELL / 2, z: c.z + Math.sin(an) * CELL / 2 }); }
    }
  }
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    p.s = s;
    const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1e-6;
    p.tx = dx / L; p.tz = dz / L; p.len = L;
    s += L;
  }
  // انحناء الطريق أمام كل نقطة (للقائد الآلي: يبطئ قبل المنعطفات)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 4) % pts.length];
    p.curve = Math.abs(Math.atan2(p.tx * q.tz - p.tz * q.tx, p.tx * q.tx + p.tz * q.tz));
  }
  const xs = cells.map((c) => c.x), zs = cells.map((c) => c.z);
  return {
    def, cells, tiles, pts, length: s, valid,
    bounds: { minX: Math.min(...xs) * CELL - CELL / 2, maxX: Math.max(...xs) * CELL + CELL / 2, minZ: Math.min(...zs) * CELL - CELL / 2, maxZ: Math.max(...zs) * CELL + CELL / 2 },
    occupied: seen
  };
}

// أقرب نقطة على خط المنتصف (مع تلميح لتسريع البحث): المسافة على المسار والإزاحة الجانبية
export function project(track, x, z, hint = -1) {
  const P = track.pts, n = P.length;
  let best = -1, bd = Infinity;
  const scan = (i) => {
    const p = P[(i + n) % n];
    const dx = x - p.x, dz = z - p.z;
    let t = dx * p.tx + dz * p.tz;
    t = Math.max(0, Math.min(p.len, t));
    const ex = p.x + p.tx * t - x, ez = p.z + p.tz * t - z;
    const d = ex * ex + ez * ez;
    if (d < bd) { bd = d; best = (i + n) % n; }
  };
  if (hint >= 0) for (let k = -12; k <= 30; k++) scan(hint + k);
  if (hint < 0 || bd > 30) for (let i = 0; i < n; i++) scan(i);
  const p = P[best];
  const dx = x - p.x, dz = z - p.z;
  const t = Math.max(0, Math.min(p.len, dx * p.tx + dz * p.tz));
  // الإزاحة الجانبية: موجبة إلى يمين اتجاه السير
  const off = dx * -p.tz + dz * p.tx;
  return { i: best, s: p.s + t, off, tx: p.tx, tz: p.tz, nx: -p.tz, nz: p.tx };
}

// نقطة على المسار عند مسافة s مع إزاحة جانبية
export function pointAt(track, s, off = 0) {
  const P = track.pts, L = track.length;
  s = ((s % L) + L) % L;
  let lo = 0, hi = P.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P[m].s <= s) lo = m; else hi = m - 1; }
  const p = P[lo], t = s - p.s;
  return { x: p.x + p.tx * t - p.tz * off, z: p.z + p.tz * t + p.tx * off, tx: p.tx, tz: p.tz, i: lo };
}
