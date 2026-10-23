// ============================================================
//  رسم المعركة على Canvas: طبقة ثابتة (المدينة، الشوارع، النهر، الجسور) تُرسم مرة واحدة،
//  وطبقة متحركة كل إطار (الألوان، الجنود، الاشتباكات، التحديد)
// ============================================================
import { W, H, TYPES } from "./mapgen.js";
import { COLORS, NEUTRAL, TICK, canReach } from "./sim.js";
import { makeRng } from "./rng.js";

export function createView(canvas) {
  return { canvas, ctx: canvas.getContext("2d"), scale: 1, ox: 0, oy: 0, dpr: 1, bg: null, paths: null, fx: [], flash: {} };
}

export function resize(v, map) {
  const r = v.canvas.getBoundingClientRect();
  v.dpr = Math.min(2, window.devicePixelRatio || 1);
  v.canvas.width = Math.round(r.width * v.dpr);
  v.canvas.height = Math.round(r.height * v.dpr);
  v.scale = Math.min(r.width / W, r.height / H);
  v.ox = (r.width - W * v.scale) / 2;
  v.oy = (r.height - H * v.scale) / 2;
  v.paths = map.districts.map((d) => {
    const p = new Path2D();
    d.poly.forEach((q, k) => (k ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
    p.closePath();
    return p;
  });
  v.bg = drawStatic(v, map);
}

// من إحداثيات الشاشة إلى إحداثيات الخريطة
export const toMap = (v, cx, cy) => {
  const r = v.canvas.getBoundingClientRect();
  return { x: (cx - r.left - v.ox) / v.scale, y: (cy - r.top - v.oy) / v.scale };
};
const inPoly = (poly, x, y) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
export function hitDistrict(v, map, x, y) {
  for (let i = 0; i < map.districts.length; i++) if (inPoly(map.districts[i].poly, x, y)) return i;
  // خارج كل المضلّعات (حافة الخريطة): أقرب حي
  let best = -1, bd = 1e9;
  map.districts.forEach((d, i) => { const k = Math.hypot(d.x - x, d.y - y); if (k < bd) { bd = k; best = i; } });
  return bd < 90 ? best : -1;
}

function riverPath(map) {
  const p = new Path2D();
  map.river.forEach((q, k) => (k ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
  return p;
}

function drawStatic(v, map) {
  const off = document.createElement("canvas");
  off.width = v.canvas.width; off.height = v.canvas.height;
  const c = off.getContext("2d");
  c.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.dpr * v.ox, v.dpr * v.oy);
  const rng = makeRng(map.seed + 99);
  // الأرض
  c.fillStyle = "#e7e1d3"; c.fillRect(0, 0, W, H);
  map.districts.forEach((d, i) => {
    const P = v.paths[i];
    c.save(); c.clip(P);
    c.fillStyle = d.type === "base" ? "#dcd8c8" : d.type === "airport" ? "#e3e0d6" : rng() < 0.5 ? "#ede7da" : "#e9e2d2";
    c.fillRect(0, 0, W, H);
    // الشوارع: شبكة مائلة لكل حي
    const step = 30 / d.deco.dense;
    c.translate(d.x, d.y); c.rotate(d.deco.angle);
    c.strokeStyle = "#fbf8f1"; c.lineWidth = 4;
    for (let k = -14; k <= 14; k++) {
      c.beginPath(); c.moveTo(k * step, -500); c.lineTo(k * step, 500); c.stroke();
      c.beginPath(); c.moveTo(-500, k * step * 1.4); c.lineTo(500, k * step * 1.4); c.stroke();
    }
    // كتل الأبنية (ظلال خفيفة)
    c.fillStyle = "#d9d0bd";
    for (let k = 0; k < 26; k++) {
      const gx = Math.floor((rng() - 0.5) * 12), gy = Math.floor((rng() - 0.5) * 9);
      c.fillRect(gx * step + 4, gy * step * 1.4 + 4, step - 8, step * 1.4 - 8);
    }
    if (d.deco.park && d.type === "home") {
      c.fillStyle = "#b9d39a"; c.beginPath(); c.ellipse(step * 0.6, -step, step * 1.5, step * 1.1, 0, 0, 7); c.fill();
      c.fillStyle = "#8fb874";
      for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(step * 0.6 + (rng() - 0.5) * step * 2, -step + (rng() - 0.5) * step * 1.5, 5, 0, 7); c.fill(); }
    }
    c.rotate(-d.deco.angle);
    // رسم مميّز للمباني الخاصة
    if (d.type === "airport") {
      c.rotate(0.35);
      c.fillStyle = "#7d7f86"; c.fillRect(-130, -14, 260, 28);
      c.strokeStyle = "#f4f4f4"; c.setLineDash([16, 14]); c.lineWidth = 3;
      c.beginPath(); c.moveTo(-120, 0); c.lineTo(120, 0); c.stroke(); c.setLineDash([]);
      c.fillStyle = "#9a9ca3"; c.fillRect(-60, 26, 70, 26);
      c.rotate(-0.35);
    } else if (d.type === "power") {
      c.fillStyle = "#c9c6bd";
      for (const [x, y] of [[-46, -30], [10, -38], [-18, 24]]) { c.beginPath(); c.arc(x, y, 20, 0, 7); c.fill(); c.strokeStyle = "#a8a49a"; c.lineWidth = 3; c.stroke(); }
    } else if (d.type === "factory") {
      c.fillStyle = "#b8ad99";
      for (let k = 0; k < 4; k++) c.fillRect(-70 + k * 36, -40 + (k % 2) * 30, 30, 46);
    } else if (d.type === "base") {
      c.strokeStyle = "#a9a38c"; c.lineWidth = 6; c.strokeRect(-70, -55, 140, 110);
      c.fillStyle = "#c2bca3"; c.fillRect(-40, -25, 80, 50);
    } else if (d.type === "hq") {
      c.fillStyle = "#f6f1e4"; c.beginPath(); c.arc(0, 0, 60, 0, 7); c.fill();
      c.strokeStyle = "#d6ccb6"; c.lineWidth = 4; c.stroke();
    }
    c.restore();
  });
  // النهر
  const R = riverPath(map);
  c.lineCap = "round"; c.lineJoin = "round";
  c.strokeStyle = "#cfe0d9"; c.lineWidth = 78; c.stroke(R);
  c.strokeStyle = "#7fb3cf"; c.lineWidth = 58; c.stroke(R);
  c.strokeStyle = "#95c4dc"; c.lineWidth = 30; c.stroke(R);
  // الجسور
  for (const b of map.bridges) {
    const k = map.river.findIndex((q) => q.x >= b.x);
    const a = map.river[Math.max(0, k - 1)], z = map.river[Math.min(map.river.length - 1, k)];
    const ang = Math.atan2(z.y - a.y, z.x - a.x);
    c.save(); c.translate(b.x, b.y); c.rotate(ang + Math.PI / 2);
    c.fillStyle = "#6f6a60"; c.fillRect(-52, -16, 104, 32);
    c.fillStyle = "#a39d90"; c.fillRect(-52, -11, 104, 22);
    c.strokeStyle = "#f2efe6"; c.setLineDash([10, 8]); c.lineWidth = 2; c.beginPath(); c.moveTo(-48, 0); c.lineTo(48, 0); c.stroke(); c.setLineDash([]);
    c.restore();
  }
  // حدود الأحياء
  c.strokeStyle = "#b7ad99"; c.lineWidth = 2.5;
  v.paths.forEach((P) => c.stroke(P));
  return off;
}

const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

// حدث للرسم (اشتباك، احتلال...)
export function addFx(v, ev, g, now) {
  if (ev.type === "clash") v.fx.push({ kind: "clash", x: ev.x, y: ev.y, t0: now, n: ev.n });
  if (ev.type === "capture") { v.flash[ev.id] = now; const d = g.map.districts[ev.id]; v.fx.push({ kind: "ring", x: d.x, y: d.y, t0: now, color: COLORS[ev.p] }); }
  if (ev.type === "hit") { const d = g.map.districts[ev.id]; v.fx.push({ kind: "hit", x: d.x, y: d.y, t0: now, color: COLORS[ev.p] }); }
}

export function draw(v, g, ui, now, alpha) {
  const c = v.ctx;
  const map = g.map;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = "#cfc6b2"; c.fillRect(0, 0, v.canvas.width, v.canvas.height);
  c.drawImage(v.bg, 0, 0);
  c.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.dpr * v.ox, v.dpr * v.oy);
  // ألوان المالكين
  map.districts.forEach((d, i) => {
    const o = g.d[i].owner;
    const col = o >= 0 ? COLORS[o] : NEUTRAL;
    const fl = v.flash[i] ? Math.max(0, 1 - (now - v.flash[i]) / 700) : 0;
    c.fillStyle = hexA(col, (o >= 0 ? 0.26 : 0.1) + fl * 0.45);
    c.fill(v.paths[i]);
  });
  // حدود الملكية
  map.districts.forEach((d, i) => {
    const o = g.d[i].owner;
    if (o < 0) return;
    c.save(); c.clip(v.paths[i]);
    c.strokeStyle = hexA(COLORS[o], 0.85); c.lineWidth = 7; c.stroke(v.paths[i]);
    c.restore();
  });
  // التحديد والأهداف الممكنة
  const sel = ui.sources || [];
  if (sel.length) {
    const reach = new Set();
    for (const s of sel) map.districts.forEach((d, j) => { if (canReach(g, s, j)) reach.add(j); });
    for (const j of reach) {
      if (sel.includes(j)) continue;
      c.save(); c.clip(v.paths[j]);
      c.setLineDash([14, 10]); c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 6; c.stroke(v.paths[j]);
      c.restore(); c.setLineDash([]);
    }
    for (const s of sel) {
      c.save(); c.clip(v.paths[s]);
      c.strokeStyle = "#fff"; c.lineWidth = 12; c.stroke(v.paths[s]);
      c.restore();
    }
    // خط السحب نحو الإصبع أو الهدف
    const tgt = ui.hover != null && !sel.includes(ui.hover) ? map.districts[ui.hover] : ui.pointer;
    if (tgt) for (const s of sel) {
      const a = map.districts[s];
      const ok = ui.hover == null || canReach(g, s, ui.hover);
      arrow(c, a.x, a.y, tgt.x, tgt.y, ok ? COLORS[0] : "#888", ok ? 1 : 0.5);
    }
  }
  // الجنود في الطريق
  for (const s of g.squads) {
    const A = map.districts[s.from], B = map.districts[s.to];
    const t = Math.min(1, (s.prog + s.speed * TICK * alpha) / s.len);
    const x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t;
    const ang = Math.atan2(B.y - A.y, B.x - A.x);
    const col = COLORS[s.owner];
    if (s.air) {
      c.save(); c.translate(x, y); c.font = "44px serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("✈️", 0, 0); c.restore();
    } else {
      const dots = Math.min(10, Math.max(2, Math.ceil(s.n / 5)));
      c.fillStyle = col; c.strokeStyle = "#fff"; c.lineWidth = 2;
      for (let k = 0; k < dots; k++) {
        const back = k * 12, side = (k % 2 ? 1 : -1) * 8;
        const px = x - Math.cos(ang) * back - Math.sin(ang) * side, py = y - Math.sin(ang) * back + Math.cos(ang) * side;
        c.beginPath(); c.arc(px, py, 8, 0, 7); c.fill(); c.stroke();
      }
    }
    label(c, x, y - 28, Math.floor(s.n), col, 22);
  }
  // شارات الأحياء
  map.districts.forEach((d, i) => {
    const x = g.d[i];
    const col = x.owner >= 0 ? COLORS[x.owner] : NEUTRAL;
    const T = TYPES[d.type];
    const r = d.type === "hq" ? 44 : d.type === "home" ? 34 : 39;
    const fl = v.flash[i] ? Math.max(0, 1 - (now - v.flash[i]) / 500) : 0;
    c.save(); c.translate(d.x, d.y); c.scale(1 + fl * 0.25, 1 + fl * 0.25);
    c.shadowColor = "rgba(0,0,0,.25)"; c.shadowBlur = 8; c.shadowOffsetY = 3;
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
    c.shadowColor = "transparent";
    c.strokeStyle = "#fff"; c.lineWidth = 4; c.stroke();
    // حلقة الامتلاء
    if (x.owner >= 0) {
      const f = Math.min(1, x.troops / T.cap);
      c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 4;
      c.beginPath(); c.arc(0, 0, r + 6, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); c.stroke();
    }
    c.fillStyle = "#fff"; c.font = `900 ${r > 38 ? 34 : 30}px Cairo, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(Math.floor(x.troops)), 0, 2);
    if (T.icon) { c.font = "34px serif"; c.fillText(T.icon, 0, -r - 22); }
    c.restore();
  });
  // المؤثرات
  v.fx = v.fx.filter((f) => now - f.t0 < 700);
  for (const f of v.fx) {
    const k = (now - f.t0) / 700;
    c.globalAlpha = 1 - k;
    if (f.kind === "clash") {
      c.fillStyle = "#ffcf5a";
      for (let j = 0; j < 8; j++) { const a = (j / 8) * 6.28; c.beginPath(); c.arc(f.x + Math.cos(a) * k * 30, f.y + Math.sin(a) * k * 30, 5 * (1 - k) + 1, 0, 7); c.fill(); }
    } else {
      c.strokeStyle = f.color; c.lineWidth = f.kind === "ring" ? 8 : 4;
      c.beginPath(); c.arc(f.x, f.y, 30 + k * (f.kind === "ring" ? 70 : 30), 0, 7); c.stroke();
    }
    c.globalAlpha = 1;
  }
}

function label(c, x, y, n, col, size) {
  c.font = `900 ${size}px Cairo, sans-serif`;
  const w = c.measureText(String(n)).width + 12;
  c.fillStyle = "rgba(255,255,255,.92)";
  c.beginPath(); c.roundRect ? c.roundRect(x - w / 2, y - size / 2 - 3, w, size + 6, 8) : c.rect(x - w / 2, y - size / 2 - 3, w, size + 6); c.fill();
  c.fillStyle = col; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(n), x, y + 1);
}

function arrow(c, x1, y1, x2, y2, col, a) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  c.globalAlpha = a;
  c.strokeStyle = col; c.lineWidth = 10; c.lineCap = "round";
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - Math.cos(ang) * 14, y2 - Math.sin(ang) * 14); c.stroke();
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x2, y2);
  c.lineTo(x2 - Math.cos(ang - 0.5) * 34, y2 - Math.sin(ang - 0.5) * 34);
  c.lineTo(x2 - Math.cos(ang + 0.5) * 34, y2 - Math.sin(ang + 0.5) * 34);
  c.closePath(); c.fill();
  c.globalAlpha = 1;
}
