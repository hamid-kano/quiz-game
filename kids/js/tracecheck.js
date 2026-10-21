// ============================================================
//  تقييم ما يكتبه الطفل بإصبعه
//  - مع الخط المساعد: نقارن التغطية والدقة مباشرة في نفس المكان
//  - بدون خط (من الذاكرة أو كتابة حرّة): نحجّم الرسم ليطابق حجم الشكل ومكانه،
//    ثم نقيس متوسط المسافة بين خطوط الطفل وخطوط الشكل في الاتجاهين
// ============================================================

const N = 96;
// حدود القبول في الكتابة الحرّة (معايَرة على كل الحروف)
export const TH = { cov: 0.6, prec: 0.8, ink: 2.8 };
const FONT = (px) => `700 ${px}px "Naskh", "Cairo", serif`;

// يرسم النص في منتصف مربع بحجم sz بنفس طريقة لوحة الرسم
export function placeText(ctx, sz, text) {
  let px = sz * 0.62;
  ctx.font = FONT(px);
  const w = ctx.measureText(text).width;
  if (w > sz * 0.86) px *= (sz * 0.86) / w;
  ctx.font = FONT(px);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(text);
  const asc = m.actualBoundingBoxAscent || px * 0.5;
  const desc = m.actualBoundingBoxDescent || 0;
  return { x: sz / 2, y: sz / 2 + (asc - desc) / 2, px };
}

function canvas() {
  const c = document.createElement("canvas");
  c.width = c.height = N;
  return c.getContext("2d", { willReadFrequently: true });
}

function textMask(text, outline = 0) {
  const ctx = canvas();
  const pl = placeText(ctx, N, text);
  ctx.fillStyle = "#000";
  ctx.fillText(text, pl.x, pl.y);
  if (outline) { ctx.lineWidth = outline; ctx.strokeStyle = "#000"; ctx.lineJoin = "round"; ctx.strokeText(text, pl.x, pl.y); }
  return { data: alpha(ctx), px: pl.px };
}

function strokeMask(strokes, lw) {
  const ctx = canvas();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = lw;
  ctx.strokeStyle = "#000";
  for (const st of strokes) {
    ctx.beginPath();
    st.forEach((p, i) => (i ? ctx.lineTo(p.x * N, p.y * N) : ctx.moveTo(p.x * N, p.y * N)));
    if (st.length === 1) ctx.lineTo(st[0].x * N + 0.1, st[0].y * N);
    ctx.stroke();
  }
  return alpha(ctx);
}

function alpha(ctx) {
  const d = ctx.getImageData(0, 0, N, N).data;
  const out = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) out[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  return out;
}

function bbox(m) {
  let x0 = N, y0 = N, x1 = -1, y1 = -1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (m[y * N + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1 + 1) / 2 / N, cy: (y0 + y1 + 1) / 2 / N };
}

// تحويل المسافة (تقريب 3-4): لكل خلية، المسافة إلى أقرب خلية ممتلئة
function distance(m) {
  const INF = 1e6;
  const d = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) d[i] = m[i] ? 0 : INF;
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? INF : d[y * N + x]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
  }
  for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) {
    const i = y * N + x;
    d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
  }
  for (let i = 0; i < N * N; i++) d[i] /= 3;
  return d;
}

const meanDist = (from, dist) => {
  let s = 0, n = 0;
  for (let i = 0; i < N * N; i++) if (from[i]) { s += dist[i]; n++; }
  return n ? s / n : 99;
};

/**
 * @param {string} text  الحرف أو الكلمة المطلوبة
 * @param {Array<Array<{x,y}>>} strokes  خطوط الطفل بإحداثيات 0..1
 * @param {boolean} free  بدون خط مساعد؟
 * @param {number} lineFrac  سماكة خط الطفل نسبة لحجم اللوحة
 */
export function scoreTrace(text, strokes, free, lineFrac) {
  const core = textMask(text);
  const lw = Math.max(1.5, lineFrac * N);
  const isWord = [...text].filter((c) => /[ء-ي٠-٩]/.test(c)).length > 1;

  if (!free) {
    // مع الخط المساعد: الرسم يجب أن يكون فوق الشكل نفسه
    const mask = textMask(text, N * 0.06).data;
    const user = strokeMask(strokes, lw);
    let coreTotal = 0, coreHit = 0, userTotal = 0, userIn = 0;
    for (let i = 0; i < N * N; i++) {
      if (core.data[i]) { coreTotal++; if (user[i]) coreHit++; }
      if (user[i]) { userTotal++; if (mask[i]) userIn++; }
    }
    const coverage = coreHit / Math.max(coreTotal, 1);
    const precision = userIn / Math.max(userTotal, 1);
    const ink = userTotal / Math.max(coreTotal, 1);
    const needCov = isWord ? 0.4 : 0.45;
    const pass = coverage >= needCov && precision >= 0.6 && ink <= 3.2;
    const reason = pass ? "" : ink > 3.2 ? "ink" : coverage < needCov ? "coverage" : "precision";
    return { pass, reason, coverage, precision, ink };
  }

  // بدون خط: الطفل يكتب داخل إطار الحرف، ونسمح بإزاحة وتحجيم بسيطين داخل الإطار
  // (نجرّب عدة إزاحات وأحجام ونأخذ أفضلها)
  const mask = textMask(text, N * 0.07).data;
  const cb = bbox(core.data);
  let best = null;
  for (const k of [0.8, 0.9, 1, 1.12, 1.25]) {
    for (const dx of [-0.08, -0.04, 0, 0.04, 0.08]) {
      for (const dy of [-0.08, -0.04, 0, 0.04, 0.08]) {
        const moved = strokes.map((st) => st.map((p) => ({ x: cb.cx + (p.x - cb.cx) * k + dx, y: cb.cy + (p.y - cb.cy) * k + dy })));
        const user = strokeMask(moved, lw * k);
        let coreTotal = 0, coreHit = 0, userTotal = 0, userIn = 0;
        for (let i = 0; i < N * N; i++) {
          if (core.data[i]) { coreTotal++; if (user[i]) coreHit++; }
          if (user[i]) { userTotal++; if (mask[i]) userIn++; }
        }
        const coverage = coreHit / Math.max(coreTotal, 1);
        const precision = userIn / Math.max(userTotal, 1);
        const ink = userTotal / Math.max(coreTotal, 1);
        const score = Math.min(coverage / TH.cov, precision / TH.prec);
        if (!best || score > best.score) best = { score, coverage, precision, ink };
      }
    }
  }
  const pass = best.coverage >= TH.cov && best.precision >= TH.prec && best.ink <= TH.ink;
  const reason = pass ? "" : best.ink > TH.ink ? "ink" : best.coverage < TH.cov ? "coverage" : "precision";
  return { pass, reason, coverage: best.coverage, precision: best.precision, ink: best.ink };
}

// إطار الكتابة: مربع حول الشكل الصحيح بإحداثيات 0..1 (يُرسم للطفل في الكتابة الحرّة)
export function frameOf(text) {
  const b = bbox(textMask(text).data);
  if (!b) return { x: 0.15, y: 0.15, w: 0.7, h: 0.7 };
  const pad = 0.07;
  return { x: b.x0 / N - pad, y: b.y0 / N - pad, w: b.w / N + pad * 2, h: b.h / N + pad * 2 };
}


// ============================================================
//  اتجاه الكتابة وترتيبها
//  نحلّل شكل الحرف: الجسم الرئيسي (أكبر جزء) والنقاط (الأجزاء الصغيرة)،
//  ونقطة البداية: أعلى اليمين للحروف الأفقية، والأعلى للحروف العمودية (ا، ل...)
// ============================================================
function components(m) {
  const comp = new Int32Array(N * N).fill(-1);
  const parts = [];
  for (let i0 = 0; i0 < N * N; i0++) {
    if (!m[i0] || comp[i0] >= 0) continue;
    const id = parts.length;
    const cells = [i0];
    comp[i0] = id;
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k], x = i % N, y = (i / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, j = ny * N + nx;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && m[j] && comp[j] < 0) { comp[j] = id; cells.push(j); }
      }
    }
    parts.push(cells);
  }
  return { comp, parts };
}

const guideCache = new Map();

export function letterGuide(text) {
  if (guideCache.has(text)) return guideCache.get(text);
  const core = textMask(text).data;
  const { comp, parts } = components(core);
  if (!parts.length) return null;
  const bodyId = parts.reduce((b, p, i) => (p.length > parts[b].length ? i : b), 0);
  const body = parts[bodyId];
  const xs = body.map((i) => i % N), ys = body.map((i) => (i / N) | 0);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const w = box.x1 - box.x0 + 1, h = box.y1 - box.y0 + 1;
  const vertical = h > w * 1.6;
  let start;
  if (vertical) {
    const top = body.filter((i) => ((i / N) | 0) <= box.y0 + 2);
    const sx = top.reduce((a, i) => a + (i % N), 0) / top.length;
    start = { x: (sx + 0.5) / N, y: (box.y0 + 1) / N };
  } else {
    // أقصى اليمين، وأعلى نقطة فيه
    const right = body.filter((i) => i % N >= box.x1 - 3);
    const sy = Math.min(...right.map((i) => (i / N) | 0));
    start = { x: (box.x1 - 1) / N, y: (sy + 1) / N };
  }
  // النقاط والعلامات الصغيرة = كل الأجزاء غير الجسم (نتجاهل الأجزاء الصغيرة جداً)
  const dots = parts
    .filter((p, i) => i !== bodyId && p.length >= 3)
    .map((p) => ({ x: (p.reduce((a, i) => a + (i % N), 0) / p.length + 0.5) / N, y: (p.reduce((a, i) => a + ((i / N) | 0), 0) / p.length + 0.5) / N }));
  const g = {
    vertical, start, dots, hasDots: dots.length > 0, comp, bodyId,
    box: { x0: box.x0 / N, x1: (box.x1 + 1) / N, y0: box.y0 / N, y1: (box.y1 + 1) / N }
  };
  guideCache.set(text, g);
  return g;
}

const pathLen = (st) => st.reduce((a, p, i) => (i ? a + Math.hypot(p.x - st[i - 1].x, p.y - st[i - 1].y) : 0), 0);

// يتحقق من ترتيب الكتابة: الجسم قبل النقاط، والبداية من الجهة الصحيحة
export function checkOrder(text, strokes) {
  const g = letterGuide(text);
  if (!g || !strokes.length) return { ok: true };
  const bw = g.box.x1 - g.box.x0, bh = g.box.y1 - g.box.y0;
  const size = Math.max(bw, bh);
  // أول خط قصير جداً وقريب من نقطة = بدأ بالنقاط
  const first = strokes[0];
  if (g.hasDots && pathLen(first) < size * 0.18) {
    const p = first[0];
    const nearDot = g.dots.some((d) => Math.hypot(d.x - p.x, d.y - p.y) < size * 0.25);
    if (nearDot && strokes.length > 1) return { ok: false, reason: "dots" };
  }
  // الخط الرئيسي = الأطول
  const main = strokes.reduce((a, s) => (pathLen(s) > pathLen(a) ? s : a), strokes[0]);
  if (pathLen(main) < size * 0.3) return { ok: true };
  const s0 = main[0], s1 = main[main.length - 1];
  if (g.vertical) {
    // يبدأ من الأعلى ويتجه للأسفل
    if (s0.y > s1.y + bh * 0.15) return { ok: false, reason: "start" };
  } else {
    // يبدأ من اليمين: نقطة بداية الخط الرئيسي في يمين الحرف أكثر من نهايته
    const relStart = (s0.x - g.box.x0) / bw;
    if (relStart < 0.45 && s1.x > s0.x + bw * 0.25) return { ok: false, reason: "start" };
  }
  return { ok: true };
}

// طبقتا الحرف (الجسم والنقاط) بلون محدد، لرسم العرض المتحرك
export function letterLayers(text, size, dpr, color) {
  const W = Math.round(size * dpr);
  const full = document.createElement("canvas");
  full.width = full.height = W;
  const fx = full.getContext("2d", { willReadFrequently: true });
  fx.scale(dpr, dpr);
  const pl = placeText(fx, size, text);
  fx.fillStyle = color;
  fx.fillText(text, pl.x, pl.y);
  const g = letterGuide(text);
  const body = document.createElement("canvas");
  const dots = document.createElement("canvas");
  body.width = body.height = dots.width = dots.height = W;
  if (!g) { body.getContext("2d").drawImage(full, 0, 0); return { body, dots, g }; }
  const src = fx.getImageData(0, 0, W, W);
  const bImg = new ImageData(W, W), dImg = new ImageData(W, W);
  const near = (gx, gy) => {
    for (let r = 0; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = gx + dx, y = gy + dy;
      if (x >= 0 && y >= 0 && x < N && y < N && g.comp[y * N + x] >= 0) return g.comp[y * N + x];
    }
    return g.bodyId;
  };
  for (let y = 0; y < W; y++) {
    const gy = Math.floor((y / W) * N);
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      if (!src.data[k + 3]) continue;
      const c = near(Math.floor((x / W) * N), gy);
      const dst = c === g.bodyId ? bImg : dImg;
      dst.data[k] = src.data[k]; dst.data[k + 1] = src.data[k + 1]; dst.data[k + 2] = src.data[k + 2]; dst.data[k + 3] = src.data[k + 3];
    }
  }
  body.getContext("2d").putImageData(bImg, 0, 0);
  dots.getContext("2d").putImageData(dImg, 0, 0);
  return { body, dots, g };
}
