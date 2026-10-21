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

