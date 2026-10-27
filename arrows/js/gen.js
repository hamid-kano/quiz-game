// ============================================================
//  توليد لوحات «فكّ المتاهة»: أسهم متعرّجة كالأفاعي على شبكة.
//  السهم يخرج من اللوحة إذا كان الطريق أمام رأسه (حتى الحافة) فارغاً.
//  البناء بالعكس يضمن الحل: نضيف كل سهم جديد بحيث يكون طريقه فارغاً من كل الأسهم الموجودة،
//  فيكون آخر سهم يُضاف أول سهم يمكن إخراجه، وهكذا حتى أول سهم.
// ============================================================
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // 0 يمين، 1 أسفل، 2 يسار، 3 أعلى

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- أشكال اللوحة ----------
export const SHAPES = {
  square: () => true,
  circle: (x, y, w, h) => { const cx = (w - 1) / 2, cy = (h - 1) / 2, r = Math.min(w, h) / 2; return (x - cx) ** 2 + (y - cy) ** 2 <= r * r * 0.98; },
  diamond: (x, y, w, h) => Math.abs(x - (w - 1) / 2) + Math.abs(y - (h - 1) / 2) <= Math.min(w, h) / 2 + 0.6,
  plus: (x, y, w, h) => { const t = Math.floor(w / 3.2); return (x >= t && x < w - t) || (y >= t && y < h - t); },
  heart: (x, y, w, h) => {
    const u = ((x + 0.5) / w) * 2.4 - 1.2, v = 1.25 - ((y + 0.5) / h) * 2.5;
    const q = u * u + v * v - 1; return q * q * q - u * u * v * v * v <= 0.02;
  },
  ring: (x, y, w, h) => { const cx = (w - 1) / 2, cy = (h - 1) / 2, d = Math.hypot(x - cx, y - cy), r = Math.min(w, h) / 2; return d <= r * 0.99 && d >= r * 0.3; },
  hourglass: (x, y, w, h) => { const cy = (h - 1) / 2, k = Math.abs(y - cy) / (h / 2); return Math.abs(x - (w - 1) / 2) <= (w / 2) * Math.max(0.3, k) + 0.3; },
  stairs: (x, y, w, h) => x + y >= Math.floor(Math.min(w, h) * 0.35) && x + y <= w + h - 2 - Math.floor(Math.min(w, h) * 0.35),
  frame: (x, y, w, h) => { const b = Math.max(2, Math.floor(Math.min(w, h) / 3.4)); return x < b || y < b || x >= w - b || y >= h - b || (Math.abs(x - (w - 1) / 2) < 1 && Math.abs(y - (h - 1) / 2) < 1); }
};
export const SHAPE_NAMES = { square: "مربع", circle: "دائرة", diamond: "معيّن", plus: "صليب", heart: "قلب", ring: "حلقة", hourglass: "ساعة رملية", stairs: "درج", frame: "إطار" };

// ---------- مواصفات كل مستوى ----------
const SHAPE_CYCLE = ["circle", "diamond", "heart", "plus", "ring", "hourglass", "stairs", "frame"];
// المسارات: عادي، صعب، خبير. كل مسار له لوحات مختلفة وتقدّم مستقل
export const DIFFS = {
  normal: { name: "عادي", icon: "😊", hearts: 3 },
  hard: { name: "صعب", icon: "🔥", hearts: 3 },
  expert: { name: "خبير", icon: "💀", hearts: 2 }
};
export function levelSpec(n, diff = "normal") {
  const D = { normal: { start: 4, step: 5, cap: 18, len: 0, turn: 0, lock: 0, k: 1 }, hard: { start: 8, step: 4, cap: 18, len: 3, turn: 0.1, lock: 1.2, k: 6, deep: 3 }, expert: { start: 10, step: 3, cap: 20, len: 5, turn: 0.16, lock: 2.2, k: 10, deep: 6 } }[diff] || {};
  const size = Math.min(D.cap, D.start + Math.floor((n - 1) / D.step));
  let shape = "square", w = size, h = size;
  if (n >= (diff === "normal" ? 12 : 4) && n % 5 === 0) { shape = SHAPE_CYCLE[Math.floor(n / 5) % SHAPE_CYCLE.length]; w = h = Math.min(D.cap + 2, size + 2); }
  else if (n >= 8 && n % 7 === 3) { h = Math.min(D.cap + 2, size + 3); } // لوحات مستطيلة طولية تناسب الجوال
  const seed = 7919 * n + 104729 + { normal: 0, hard: 1000003, expert: 2000006 }[diff];
  return {
    n, diff, seed, w, h, shape,
    maxLen: 3 + Math.floor(Math.max(w, h) / 2.2) + D.len,
    turn: Math.min(0.62, 0.18 + n * 0.006 + D.turn),
    lock: Math.min(2.5 + D.lock * 1.5, 0.3 + n * 0.04 + D.lock),
    tries: D.k, deep: D.deep || 0
  };
}
export function dailySpec(dateStr) {
  let s = 0; for (const ch of dateStr) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const R = rng(s);
  const shapes = ["square", "circle", "heart", "diamond", "plus", "ring", "hourglass", "stairs"];
  const sz = 13 + Math.floor(R() * 4);
  return { n: 0, daily: dateStr, seed: s, w: sz, h: sz + (R() < 0.3 ? 3 : 0), shape: shapes[Math.floor(R() * shapes.length)], maxLen: 10, turn: 0.45, lock: 2.6, tries: 6, deep: 3 };
}

// ---------- التوليد ----------
// النتيجة: { w, h, mask, arrows: [{ id, cells: [[x,y], ...] (من الذيل إلى الرأس), dir }] }
// في المسارات الأصعب نولّد عدة لوحات ونختار الأصعب: أقل نسبة أسهم حرة في البداية وأعمق سلسلة اعتماد
export function generate(spec) {
  const pick = (attempts) => {
    let best = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const b = build(spec, rng(spec.seed + attempt * 977));
      if (!best || b.fill > best.fill) best = b;
      if (b.fill >= 0.9) break;
    }
    return best;
  };
  const tries = spec.tries || 1;
  if (tries <= 1) return pick(6);
  let best = null, bestScore = -1e9;
  for (let k = 0; k < tries; k++) {
    const b = pick(3, k);
    spec = { ...spec, seed: spec.seed + 7777 };
    if (b.fill < 0.78) continue;
    const s = solve(b), free = freeArrows(makeBoard(b)).length / b.arrows.length;
    const score = s.depth * 1.5 - free * 12 + b.fill * 6 + b.arrows.reduce((a, x) => a + x.cells.length, 0) / b.arrows.length * 0.6;
    b.depth = s.depth; b.freeRatio = free;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best || pick(6);
}

function build(spec, R) {
  const { w, h } = spec;
  const inMask = SHAPES[spec.shape] || SHAPES.square;
  const mask = new Uint8Array(w * h);
  let total = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inMask(x, y, w, h)) { mask[y * w + x] = 1; total++; }
  const occ = new Int16Array(w * h).fill(-1);
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const free = (x, y) => inside(x, y) && mask[y * w + x] && occ[y * w + x] < 0;
  const rayClear = (x, y, d) => { const [dx, dy] = DIRS[d]; x += dx; y += dy; while (inside(x, y)) { if (occ[y * w + x] >= 0) return false; x += dx; y += dy; } return true; };
  const arrows = [];
  const cover = new Uint8Array(w * h); // كم سهماً سابقاً يمرّ طريقه بهذه الخلية (وضع سهم هنا يعيقه = عمق أكبر)
  let filled = 0, fails = 0;
  const minLen = Math.max(2, Math.floor(spec.maxLen / 2.5));
  while (fails < 60) {
    // كل الرؤوس الممكنة: خلية فارغة واتجاه طريقه فارغ حتى الحافة
    const cands = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!free(x, y)) continue;
      for (let d = 0; d < 4; d++) {
        if (!rayClear(x, y, d)) continue;
        const [dx, dy] = DIRS[d];
        const back = free(x - dx, y - dy);
        // نفضّل الخلايا الملاصقة لأسهم موجودة (لوحة متماسكة) والبعيدة عن الحافة
        let wgt = back ? 1 : 0.08;
        let nb = 0; for (const [ax, ay] of DIRS) if (inside(x + ax, y + ay) && occ[(y + ay) * w + x + ax] >= 0) nb++;
        wgt *= 1 + nb * 1.4;
        wgt *= (1 + cover[y * w + x] * spec.lock) ** 2;
        // في المسارات الأصعب: رؤوس بعيدة عن الحافة (طريقها طويل فيسهل أن تعيقه أسهم لاحقة)
        if (spec.deep) { const ray = [w - 1 - x, h - 1 - y, x, y][d]; wgt *= 1 + (ray / Math.max(w, h)) * spec.deep; }
        cands.push({ x, y, d, wgt });
      }
    }
    if (!cands.length) break;
    let r = R() * cands.reduce((a, c) => a + c.wgt, 0), c = cands[0];
    for (const k of cands) { r -= k.wgt; if (r <= 0) { c = k; break; } }
    // الجسم: نمشي إلى الخلف من الرأس
    const [dx, dy] = DIRS[c.d];
    const ray = new Set(); { let x = c.x + dx, y = c.y + dy; while (inside(x, y)) { ray.add(y * w + x); x += dx; y += dy; } }
    const cells = [[c.x, c.y]];
    const used = new Set([c.y * w + c.x]);
    const target = Math.max(1, Math.round(minLen + R() * (spec.maxLen - minLen)));
    let px = c.x, py = c.y, pd = (c.d + 2) % 4; // اتجاه المشي (عكس اتجاه السهم)
    if (free(c.x - dx, c.y - dy)) {
      while (cells.length < target) {
        const opts = [];
        for (let d = 0; d < 4; d++) {
          if (d === (pd + 2) % 4) continue;
          if (cells.length === 1 && d !== (c.d + 2) % 4) continue; // الخلية الثانية خلف الرأس مباشرة
          const nx = px + DIRS[d][0], ny = py + DIRS[d][1], k = ny * w + nx;
          if (!free(nx, ny) || used.has(k) || ray.has(k)) continue;
          let free2 = 0; for (const [ax, ay] of DIRS) if (free(nx + ax, ny + ay) && !used.has((ny + ay) * w + nx + ax)) free2++;
          // الاستمرار مستقيماً أكثر احتمالاً، والتفاف إلى الزوايا الضيقة لملء الفراغات
          const wgt = (d === pd ? 1 - spec.turn : spec.turn) * (free2 <= 1 ? 1.6 : 1) * (1 + cover[k] * spec.lock * 0.6);
          opts.push({ d, nx, ny, k, wgt });
        }
        if (!opts.length) break;
        let rr = R() * opts.reduce((a, o) => a + o.wgt, 0), o = opts[0];
        for (const q of opts) { rr -= q.wgt; if (rr <= 0) { o = q; break; } }
        cells.push([o.nx, o.ny]); used.add(o.k); px = o.nx; py = o.ny; pd = o.d;
      }
    }
    // سهم من خلية واحدة مسموح نادراً (لسدّ الفراغات الصغيرة)
    if (cells.length < 2 && R() > 0.12) { fails++; continue; }
    if (cells.length < Math.min(2, minLen) && cells.length !== 1) { fails++; continue; }
    fails = 0;
    const id = arrows.length;
    for (const [x, y] of cells) occ[y * w + x] = id;
    for (const k of ray) cover[k]++;
    filled += cells.length;
    arrows.push({ id, cells: cells.reverse(), dir: c.d });
  }
  // الأسهم مرقّمة بترتيب الإضافة: آخرها يخرج أولاً. نخلطها حتى لا يكشف الترتيب الحل
  const order = arrows.map((_, i) => i).sort(() => R() - 0.5);
  const out = order.map((i, k) => ({ ...arrows[i], id: k }));
  return { w, h, mask, shape: spec.shape, arrows: out, fill: filled / total };
}

// ---------- حالة اللعب ----------
export function makeBoard(level) {
  const { w, h } = level;
  const occ = new Int16Array(w * h).fill(-1);
  for (const a of level.arrows) for (const [x, y] of a.cells) occ[y * w + x] = a.id;
  return { w, h, occ, alive: new Set(level.arrows.map((a) => a.id)), arrows: level.arrows };
}
// أول خلية تعيق السهم، أو null إذا كان حراً. dist: عدد الخلايا الفارغة قبل العائق
export function blocker(board, a) {
  const { w, h, occ } = board;
  const [hx, hy] = a.cells[a.cells.length - 1], [dx, dy] = DIRS[a.dir];
  let x = hx + dx, y = hy + dy, dist = 0;
  while (x >= 0 && y >= 0 && x < w && y < h) {
    const o = occ[y * w + x];
    if (o >= 0 && o !== a.id) return { id: o, x, y, dist };
    x += dx; y += dy; dist++;
  }
  return null;
}
export function exitLength(board, a) {
  const [hx, hy] = a.cells[a.cells.length - 1];
  return [board.w - 1 - hx, board.h - 1 - hy, hx, hy][a.dir] + 1;
}
export function removeArrow(board, id) {
  const a = board.arrows[id];
  for (const [x, y] of a.cells) if (board.occ[y * board.w + x] === id) board.occ[y * board.w + x] = -1;
  board.alive.delete(id);
}
export const freeArrows = (board) => [...board.alive].filter((id) => !blocker(board, board.arrows[id]));

// حلّ تلقائي (للاختبار): إخراج أي سهم حر لا يمنع غيره أبداً، فالطريقة الجشعة تكفي
export function solve(level) {
  const b = makeBoard(level);
  let steps = 0, depth = 0;
  while (b.alive.size) {
    const f = freeArrows(b);
    if (!f.length) return { solvable: false, left: b.alive.size, steps };
    for (const id of f) removeArrow(b, id);
    steps += f.length; depth++;
  }
  return { solvable: true, steps, depth };
}
