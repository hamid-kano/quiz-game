// ============================================================
//  الرسم: المدينة من الأعلى بأسلوب واقعي (شوارع، أرصفة، أبنية بظلال، أشجار، نهر، جسور)
//  الطبقة الثابتة تُرسم مرة واحدة، وفوقها كل إطار: المواقع، الوحدات، المؤثرات، ضباب الحرب
// ============================================================
import { W, H, STREET, AVENUE, riverY, POINT_TYPES } from "./city.js";
import { UNITS, BUILDINGS, TEAM, TEAM_DARK, NEUTRAL_COLOR, SUPER } from "./rules.js";
import { makeRng } from "./rng.js";
import { CELL, CAPTURE_R } from "./world.js";

const STATIC_SCALE = 1.4;
const SHADOW = { x: 0.55, y: 0.75 }; // اتجاه الظل (الشمس من الشمال الغربي)

export function drawCity(city) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * STATIC_SCALE); cv.height = Math.round(H * STATIC_SCALE);
  const c = cv.getContext("2d");
  c.scale(STATIC_SCALE, STATIC_SCALE);
  const rng = makeRng(city.seed + 5);
  // الأرض (إسفلت تحت كل شيء = الشوارع)
  c.fillStyle = "#6b6f75"; c.fillRect(0, 0, W, H);
  // النهر وضفّتاه
  const river = new Path2D();
  for (let x = -20; x <= W + 20; x += 20) x === -20 ? river.moveTo(x, riverY(x)) : river.lineTo(x, riverY(x));
  c.lineJoin = "round"; c.lineCap = "round";
  c.strokeStyle = "#a8a191"; c.lineWidth = 150; c.stroke(river);        // كورنيش
  c.strokeStyle = "#7d9c74"; c.lineWidth = 128; c.stroke(river);        // عشب الضفاف
  c.strokeStyle = "#3f7393"; c.lineWidth = 106; c.stroke(river);
  c.strokeStyle = "#4b84a6"; c.lineWidth = 80; c.stroke(river);
  c.strokeStyle = "rgba(255,255,255,.08)"; c.lineWidth = 2;
  for (let k = 0; k < 60; k++) { const x = rng() * W, y = riverY(x) + (rng() - 0.5) * 70; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y); c.stroke(); }
  // الشوارع: خطوط وسطية للجادّات، وممرات مشاة عند التقاطعات
  for (const e of city.edges) {
    const A = city.nodes[e.a], B = city.nodes[e.b];
    if (e.kind === "bridge") continue;
    c.strokeStyle = "#63676d";
    c.lineWidth = (e.kind === "avenue" ? AVENUE : STREET) * 2 + 4;
    c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
  }
  for (const e of city.edges) {
    if (e.kind === "bridge") continue;
    const A = city.nodes[e.a], B = city.nodes[e.b];
    c.setLineDash(e.kind === "avenue" ? [] : [10, 12]);
    c.strokeStyle = e.kind === "avenue" ? "rgba(240,200,80,.75)" : "rgba(255,255,255,.45)";
    c.lineWidth = e.kind === "avenue" ? 2.2 : 1.6;
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy), m = 26 / L;
    c.beginPath(); c.moveTo(A.x + dx * m, A.y + dy * m); c.lineTo(B.x - dx * m, B.y - dy * m); c.stroke();
  }
  c.setLineDash([]);
  // الجسور
  for (const b of city.bridges) {
    const A = city.nodes[b.a], B = city.nodes[b.b];
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    c.save(); c.translate(b.x, b.y); c.rotate(b.ang);
    c.fillStyle = "rgba(0,0,0,.28)"; c.fillRect(-L / 2 + 6, -AVENUE - 2 + 8, L, AVENUE * 2 + 4);
    c.fillStyle = "#8d8f93"; c.fillRect(-L / 2, -AVENUE - 4, L, AVENUE * 2 + 8);
    c.fillStyle = "#5f6369"; c.fillRect(-L / 2, -AVENUE + 2, L, AVENUE * 2 - 4);
    c.strokeStyle = "rgba(240,200,80,.8)"; c.lineWidth = 2; c.beginPath(); c.moveTo(-L / 2, 0); c.lineTo(L / 2, 0); c.stroke();
    c.fillStyle = "#b9bbbe";
    for (let x = -L / 2 + 8; x < L / 2; x += 18) { c.fillRect(x, -AVENUE - 4, 4, 3); c.fillRect(x, AVENUE + 1, 4, 3); }
    c.restore();
  }
  // الكتل: رصيف ثم أرض ثم أبنية بظلال
  for (const b of city.blocks) {
    const P = path(b.poly);
    c.fillStyle = "#b8b2a6"; c.fill(P);                       // رصيف
    const inner = shrink(b.poly, 5);
    const I = path(inner);
    c.fillStyle = b.kind === "park" ? "#8db36e" : b.kind === "industrial" ? "#a6a39b" : b.kind === "plaza" ? "#d3cbbb" : "#c7c0b1";
    c.fill(I);
    if (b.kind === "plaza") {
      // بلاط الساحة
      c.save(); c.clip(I);
      c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1;
      for (let k = -300; k < 300; k += 16) { c.beginPath(); c.moveTo(b.x + k, b.y - 300); c.lineTo(b.x + k, b.y + 300); c.stroke(); c.beginPath(); c.moveTo(b.x - 300, b.y + k); c.lineTo(b.x + 300, b.y + k); c.stroke(); }
      c.restore();
      c.fillStyle = "#8db36e";
      for (const [dx, dy] of [[-46, -30], [46, 30], [-46, 30], [46, -30]]) { c.beginPath(); c.arc(b.x + dx, b.y + dy, 9, 0, 7); c.fill(); }
    }
    if (b.kind === "lot" || b.kind === "hq") {
      // أرض بناء: خرسانة بخطوط تقسيم وزوايا صفراء
      c.fillStyle = "#b4b1a8"; c.fill(I);
      c.save(); c.clip(I);
      c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 1.5;
      for (let k = -300; k < 300; k += 34) { c.beginPath(); c.moveTo(b.x + k, b.y - 300); c.lineTo(b.x + k, b.y + 300); c.stroke(); c.beginPath(); c.moveTo(b.x - 300, b.y + k); c.lineTo(b.x + 300, b.y + k); c.stroke(); }
      c.restore();
      c.strokeStyle = "rgba(240,190,60,.75)"; c.lineWidth = 3;
      inner.forEach((v, k) => {
        const n1 = inner[(k + 1) % 4], n0 = inner[(k + 3) % 4];
        c.beginPath();
        c.moveTo(v.x + (n0.x - v.x) * 0.12, v.y + (n0.y - v.y) * 0.12); c.lineTo(v.x, v.y); c.lineTo(v.x + (n1.x - v.x) * 0.12, v.y + (n1.y - v.y) * 0.12);
        c.stroke();
      });
    }
    if (b.kind === "depot") {
      c.fillStyle = "#b59f78"; c.fill(I);
      c.save(); c.clip(I); c.strokeStyle = "rgba(90,70,40,.18)"; c.lineWidth = 6;
      for (let k = -300; k < 300; k += 22) { c.beginPath(); c.moveTo(b.x + k, b.y - 300); c.lineTo(b.x + k + 300, b.y + 300); c.stroke(); }
      c.restore();
    }
    const B = b.buildings;
    for (const cr of B.crates || []) {
      c.save(); c.translate(cr.x, cr.y); c.rotate(cr.a);
      c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(-cr.s / 2 + 4, -cr.s / 2 + 5, cr.s, cr.s);
      c.fillStyle = "#9b7440"; c.fillRect(-cr.s / 2, -cr.s / 2, cr.s, cr.s);
      c.strokeStyle = "#6e4f27"; c.lineWidth = 2; c.strokeRect(-cr.s / 2, -cr.s / 2, cr.s, cr.s);
      c.beginPath(); c.moveTo(-cr.s / 2, -cr.s / 2); c.lineTo(cr.s / 2, cr.s / 2); c.stroke();
      c.restore();
    }
    for (const t of B.tanks) {
      c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.arc(t.x + 6, t.y + 8, t.r, 0, 7); c.fill();
      c.fillStyle = "#c9ccd0"; c.beginPath(); c.arc(t.x, t.y, t.r, 0, 7); c.fill();
      c.strokeStyle = "#9da2a8"; c.lineWidth = 2; c.beginPath(); c.arc(t.x, t.y, t.r * 0.6, 0, 7); c.stroke();
    }
    for (const bd of B.list) {
      // الظل: نسخة مزاحة بحسب الارتفاع
      const sx = bd.h * SHADOW.x, sy = bd.h * SHADOW.y;
      c.fillStyle = "rgba(20,24,30,.32)";
      c.beginPath();
      bd.poly.forEach((p, k) => (k ? c.lineTo(p.x + sx, p.y + sy) : c.moveTo(p.x + sx, p.y + sy)));
      c.closePath(); c.fill();
      // جدران ظاهرة
      c.fillStyle = shade(bd.roof, -38);
      for (let k = 0; k < 4; k++) {
        const a = bd.poly[k], z = bd.poly[(k + 1) % 4];
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(z.x, z.y); c.lineTo(z.x + sx * 0.35, z.y + sy * 0.35); c.lineTo(a.x + sx * 0.35, a.y + sy * 0.35); c.closePath(); c.fill();
      }
      const R = path(bd.poly);
      c.fillStyle = bd.roof; c.fill(R);
      c.strokeStyle = shade(bd.roof, 18); c.lineWidth = 1.2; c.stroke(R);
      if (bd.ind) {
        // سقف معدني مضلّع
        c.save(); c.clip(R); c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 2;
        const cx = bd.poly.reduce((a, p) => a + p.x, 0) / 4, cy = bd.poly.reduce((a, p) => a + p.y, 0) / 4;
        for (let k = -120; k < 120; k += 9) { c.beginPath(); c.moveTo(cx + k, cy - 120); c.lineTo(cx + k, cy + 120); c.stroke(); }
        c.restore();
      } else if (bd.ac) {
        const cx = bd.poly.reduce((a, p) => a + p.x, 0) / 4, cy = bd.poly.reduce((a, p) => a + p.y, 0) / 4;
        c.fillStyle = shade(bd.roof, -22); c.fillRect(cx - 5, cy - 4, 10, 8);
        c.fillStyle = shade(bd.roof, 25); c.fillRect(cx + 7, cy - 9, 6, 6);
      }
    }
    for (const t of B.trees) {
      c.fillStyle = "rgba(20,30,15,.3)"; c.beginPath(); c.arc(t.x + t.r * 0.5, t.y + t.r * 0.6, t.r, 0, 7); c.fill();
      c.fillStyle = "#4f7d3a"; c.beginPath(); c.arc(t.x, t.y, t.r, 0, 7); c.fill();
      c.fillStyle = "#6a9a4b"; c.beginPath(); c.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.6, 0, 7); c.fill();
    }
  }
  // ممرات المشاة عند التقاطعات الكبيرة
  c.fillStyle = "rgba(255,255,255,.55)";
  for (const e of city.edges) {
    if (e.kind !== "avenue") continue;
    for (const [P, Q] of [[city.nodes[e.a], city.nodes[e.b]], [city.nodes[e.b], city.nodes[e.a]]]) {
      const dx = Q.x - P.x, dy = Q.y - P.y, L = Math.hypot(dx, dy);
      const ux = dx / L, uy = dy / L;
      for (let k = -3; k <= 3; k++) {
        const cx = P.x + ux * 30 - uy * k * 6, cy = P.y + uy * 30 + ux * k * 6;
        c.save(); c.translate(cx, cy); c.rotate(Math.atan2(uy, ux)); c.fillRect(-5, -1.5, 10, 3); c.restore();
      }
    }
  }
  return cv;
}

const path = (poly) => { const p = new Path2D(); poly.forEach((q, k) => (k ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y))); p.closePath(); return p; };
function shrink(poly, d) {
  const cx = poly.reduce((a, p) => a + p.x, 0) / poly.length, cy = poly.reduce((a, p) => a + p.y, 0) / poly.length;
  return poly.map((p) => { const L = Math.hypot(cx - p.x, cy - p.y); return { x: p.x + ((cx - p.x) * d * 1.4) / L, y: p.y + ((cy - p.y) * d * 1.4) / L }; });
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
export { STATIC_SCALE };

// ============================================================
//  الطبقة المتحركة: المباني، الوحدات، المؤثرات، ضباب الحرب
// ============================================================
export function createView(canvas, w) {
  const view = { canvas, ctx: canvas.getContext("2d"), dpr: 1, cw: 0, ch: 0, cam: { x: 0, y: 0, z: 1 }, bg: drawCity(w.city), fx: [], decals: [], fog: document.createElement("canvas"), markers: [], floats: [] };
  view.fog.width = w.gw; view.fog.height = w.gh;
  view.fogCtx = view.fog.getContext("2d");
  view.fogImg = view.fogCtx.createImageData(w.gw, w.gh);
  return view;
}
export function resizeView(v) {
  const r = v.canvas.getBoundingClientRect();
  v.dpr = Math.min(2, window.devicePixelRatio || 1);
  v.cw = r.width; v.ch = r.height;
  v.canvas.width = Math.round(r.width * v.dpr); v.canvas.height = Math.round(r.height * v.dpr);
  clampCam(v);
}
export const minZoom = (v) => v.cw / W;
export function clampCam(v) {
  v.cam.z = Math.max(minZoom(v), Math.min(2.4, v.cam.z));
  const hw = v.cw / 2 / v.cam.z, hh = v.ch / 2 / v.cam.z;
  v.cam.x = hw * 2 >= W ? W / 2 : Math.max(hw, Math.min(W - hw, v.cam.x));
  v.cam.y = hh * 2 >= H ? H / 2 : Math.max(hh, Math.min(H - hh, v.cam.y));
}
export const screenToWorld = (v, sx, sy) => ({ x: (sx - v.cw / 2) / v.cam.z + v.cam.x, y: (sy - v.ch / 2) / v.cam.z + v.cam.y });

const lerp = (a, b, t) => a + (b - a) * t;
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const visibleCell = (w, p, x, y) => {
  const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
  return i >= 0 && j >= 0 && i < w.gw && j < w.gh && w.vis[p][j * w.gw + i] === 1;
};

// مؤثرات من أحداث المحاكاة
export function addEvent(v, ev, now) {
  const F = (o) => v.fx.push({ t0: now, ...o });
  if (ev.type === "shot") F({ k: "tracer", ...ev, life: ev.weapon === "shell" ? 160 : ev.weapon === "rocket" || ev.weapon === "missile" ? 260 : 110 });
  else if (ev.type === "artyFire") F({ k: "flash", x: ev.x + Math.cos(ev.ang) * 22, y: ev.y + Math.sin(ev.ang) * 22, life: 180 });
  else if (ev.type === "boom") { F({ k: "boom", x: ev.x, y: ev.y, life: 900, s: ev.small ? 0.7 : 1 }); scorch(v, ev.x, ev.y, ev.small ? 12 : 18); }
  else if (ev.type === "death") {
    const veh = UNITS[ev.unit].armor !== "inf";
    F({ k: veh ? "boom" : "puff", x: ev.x, y: ev.y, life: veh ? 1100 : 500, s: 1 });
    if (veh && !UNITS[ev.unit].air) { scorch(v, ev.x, ev.y, 16); v.decals.push({ k: "wreck", x: ev.x, y: ev.y, a: Math.random() * 6 }); }
  } else if (ev.type === "razed") {
    for (let k = 0; k < (ev.big ? 7 : 3); k++) F({ k: "boom", x: ev.x + (Math.random() - 0.5) * 70, y: ev.y + (Math.random() - 0.5) * 70, t0: now + k * 140, life: 1300, s: 1.3 });
    v.decals.push({ k: "ruin", x: ev.x, y: ev.y, big: ev.big, a: Math.random() });
  } else if (ev.type === "captured") F({ k: "ring", id: ev.id, p: ev.p, life: 900 });
  else if (ev.type === "planes") F({ k: "planes", ...ev, life: 3600 });
  else if (ev.type === "airBoom") { for (let k = 0; k < 9; k++) F({ k: "boom", x: ev.x + (Math.random() - 0.5) * ev.r * 1.4, y: ev.y + (Math.random() - 0.5) * ev.r * 1.4, t0: now + k * 70, life: 1100, s: 1.2 }); for (let k = 0; k < 5; k++) scorch(v, ev.x + (Math.random() - 0.5) * ev.r, ev.y + (Math.random() - 0.5) * ev.r, 20); }
  else if (ev.type === "superLaunch") F({ k: "target", x: ev.x, y: ev.y, life: 6000, p: ev.p });
  else if (ev.type === "superBoom") { F({ k: "nova", x: ev.x, y: ev.y, life: 2200, r: ev.r }); for (let k = 0; k < 18; k++) F({ k: "boom", x: ev.x + (Math.random() - 0.5) * ev.r * 1.6, y: ev.y + (Math.random() - 0.5) * ev.r * 1.6, t0: now + k * 60, life: 1600, s: 1.6 }); for (let k = 0; k < 10; k++) scorch(v, ev.x + (Math.random() - 0.5) * ev.r, ev.y + (Math.random() - 0.5) * ev.r, 30); }
  else if (ev.type === "delivered" && ev.p === 0) v.floats.push({ x: ev.x, y: ev.y - 40, text: `+${ev.amount}`, t0: now, color: "#7CFF6B" });
  else if (ev.type === "landed") F({ k: "chutes", x: ev.x, y: ev.y, life: 1600 });
  if (v.decals.length > 90) v.decals.shift();
}
function scorch(v, x, y, r) { v.decals.push({ k: "scorch", x, y, r: r * (0.8 + Math.random() * 0.5) }); }

export function render(v, w, ui, now, alpha, me = 0) {
  const c = v.ctx, { cam } = v;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = "#2b2f35"; c.fillRect(0, 0, v.canvas.width, v.canvas.height);
  c.setTransform(v.dpr * cam.z, 0, 0, v.dpr * cam.z, v.dpr * (v.cw / 2 - cam.x * cam.z), v.dpr * (v.ch / 2 - cam.y * cam.z));
  c.imageSmoothingEnabled = true;
  c.drawImage(v.bg, 0, 0, W, H);
  // آثار
  for (const d of v.decals) {
    if (d.k === "scorch") {
      const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 1.6);
      g.addColorStop(0, "rgba(25,20,15,.55)"); g.addColorStop(1, "rgba(25,20,15,0)");
      c.fillStyle = g; c.beginPath(); c.arc(d.x, d.y, d.r * 1.6, 0, 7); c.fill();
    } else if (d.k === "wreck") {
      c.save(); c.translate(d.x, d.y); c.rotate(d.a);
      c.fillStyle = "#2c2a27"; c.fillRect(-13, -8, 26, 16); c.fillStyle = "#45403a"; c.beginPath(); c.arc(1, 0, 6, 0, 7); c.fill();
      c.restore();
    } else if (d.k === "ruin") {
      // أنقاض: أساس محروق وقطع ركام متناثرة
      const R = d.big ? 40 : 13;
      c.fillStyle = "rgba(55,50,45,.45)"; c.fillRect(d.x - R, d.y - R, R * 2, R * 2);
      for (let k = 0; k < (d.big ? 14 : 5); k++) {
        const a = k * 2.399 + d.a * 6, r = R * (0.25 + ((k * 0.37 + d.a) % 0.75));
        c.fillStyle = k % 3 ? "#6d655c" : "#857b70";
        c.save(); c.translate(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r); c.rotate(a);
        const sz = (d.big ? 7 : 4) + (k % 4) * 2; c.fillRect(-sz / 2, -sz / 3, sz, sz * 0.66); c.restore();
      }
    }
  }
  // مستودعات المؤن: كمية متبقية
  for (const d of w.depots) {
    const f = d.amount / (d.base ? 15000 : 22500);
    c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(d.x - 30, d.y + 48, 60, 7);
    c.fillStyle = "#f5c542"; c.fillRect(d.x - 29, d.y + 49, 58 * Math.max(0, f), 5);
    c.font = "22px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("📦", d.x, d.y - 52);
  }
  // المصافي والأبراج
  for (const pt of w.points) {
    const col = pt.owner >= 0 ? TEAM[pt.owner] : NEUTRAL_COLOR;
    c.setLineDash([10, 8]); c.lineWidth = 3; c.strokeStyle = hexA(col, 0.8);
    c.beginPath(); c.arc(pt.x, pt.y, CAPTURE_R, 0, 7); c.stroke(); c.setLineDash([]);
    if (pt.owner >= 0) { c.fillStyle = hexA(col, 0.12); c.beginPath(); c.arc(pt.x, pt.y, CAPTURE_R, 0, 7); c.fill(); }
    const prog = pt.owner === -1 ? pt.prog : pt.prog < 1 ? pt.prog : 0;
    if (prog > 0) {
      c.strokeStyle = TEAM[pt.owner === -1 ? pt.by : pt.owner]; c.lineWidth = 8;
      c.beginPath(); c.arc(pt.x, pt.y, CAPTURE_R - 4, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); c.stroke();
    }
    if (pt.type === "refinery") drawRefinery(c, pt.x, pt.y, col, now); else drawTower(c, pt.x, pt.y, col, now);
  }
  // المباني (مبانينا دائماً، ومباني العدو إن رأيناها أو نتذكّرها)
  const seenNow = new Set();
  for (const b of w.buildings) {
    if (b.p !== me && !visibleCell(w, me, b.x, b.y)) continue;
    seenNow.add(b.id);
    drawBuilding(c, b, w, now, 1, ui.selectedBuilding === b.id);
  }
  for (const [id, k] of w.known[me]) if (!seenNow.has(id)) drawBuilding(c, { ...k, built: k.done ? 1 : 0.5, hp: 1, maxHp: 1, ghost: true }, w, now, 0.55, false);
  // القذائف في الجو
  for (const s of w.shells) {
    const t = Math.max(0, Math.min(1, (w.tick + alpha - s.fired) / (s.land - s.fired)));
    if (w.tick + alpha < s.fired) continue;
    const x = lerp(s.x0, s.x, t), y = lerp(s.y0, s.y, t), hgt = s.sky ? (1 - t) * 300 : Math.sin(t * Math.PI) * 90;
    c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(s.x * (s.sky ? 1 : 0) + x * (s.sky ? 0 : 1), y, 3, 0, 7); c.fill();
    c.fillStyle = s.rocket ? "#ffb35a" : "#ffd27a"; c.beginPath(); c.arc(s.sky ? s.x : x, (s.sky ? s.y : y) - hgt, s.rocket ? 3 : 3.5, 0, 7); c.fill();
    if (s.rocket || s.sky) { c.strokeStyle = "rgba(230,230,230,.45)"; c.lineWidth = 3; c.beginPath(); c.moveTo(s.sky ? s.x : x, (s.sky ? s.y : y) - hgt); c.lineTo(s.sky ? s.x : lerp(s.x0, s.x, Math.max(0, t - 0.08)), (s.sky ? s.y - hgt - 26 : lerp(s.y0, s.y, Math.max(0, t - 0.08)) - Math.sin(Math.max(0, t - 0.08) * Math.PI) * 90)); c.stroke(); }
  }
  // الوحدات
  const sel = new Set(ui.selected);
  const order = [...w.units].sort((a, b) => (UNITS[a.type].air ? 1 : 0) - (UNITS[b.type].air ? 1 : 0));
  for (const u of order) {
    const x = lerp(u.px ?? u.x, u.x, alpha), y = lerp(u.py ?? u.y, u.y, alpha);
    if (u.p !== me && !visibleCell(w, me, x, y)) continue;
    const Ud = UNITS[u.type];
    if (sel.has(u.id)) { c.strokeStyle = "#7CFF6B"; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, Ud.radius * 1.35 + 8, 0, 7); c.stroke(); }
    drawUnit(c, u, Ud, x, y, now);
    if (u.truck?.load > 0) { c.font = "14px serif"; c.textAlign = "center"; c.fillText("💰", x, y - Ud.radius - 14); }
    if (u.hp < Ud.hp || sel.has(u.id)) bar(c, x, y - Ud.radius * 1.35 - 10, 28, u.hp / Ud.hp, TEAM[u.p]);
  }
  // مؤثرات
  v.fx = v.fx.filter((f) => now - f.t0 < f.life);
  for (const f of v.fx) {
    const k = (now - f.t0) / f.life;
    if (k < 0) continue;
    drawFx(c, f, k, w, me, now);
  }
  // أرقام عائمة (المؤن المسلّمة)
  v.floats = v.floats.filter((f) => now - f.t0 < 1200);
  for (const f of v.floats) {
    const k = (now - f.t0) / 1200;
    c.globalAlpha = 1 - k; c.font = "900 22px Cairo, sans-serif"; c.textAlign = "center"; c.lineWidth = 4; c.strokeStyle = "#000";
    c.strokeText(f.text, f.x, f.y - k * 40); c.fillStyle = f.color; c.fillText(f.text, f.x, f.y - k * 40); c.globalAlpha = 1;
  }
  // علامات الأوامر والاستهداف
  v.markers = v.markers.filter((m) => now - m.t0 < 700);
  for (const m of v.markers) {
    const k = (now - m.t0) / 700;
    c.globalAlpha = 1 - k; c.strokeStyle = m.color || "#7CFF6B"; c.lineWidth = 3;
    c.beginPath(); c.arc(m.x, m.y, 10 + k * 22, 0, 7); c.stroke(); c.globalAlpha = 1;
  }
  // ضباب الحرب
  const img = v.fogImg, vis = w.vis[me], seen = w.seen[me];
  for (let i = 0; i < vis.length; i++) {
    img.data[i * 4] = 10; img.data[i * 4 + 1] = 16; img.data[i * 4 + 2] = 26;
    img.data[i * 4 + 3] = vis[i] ? 0 : seen[i] ? 110 : 195;
  }
  v.fogCtx.putImageData(img, 0, 0);
  c.drawImage(v.fog, 0, 0, w.gw * CELL, w.gh * CELL);
  // واجهة الاستهداف/البناء فوق الضباب
  if (ui.place) drawPlacement(c, w, ui.place, now, me);
  if (ui.aim) {
    const r = ui.aim.radius || 60;
    c.strokeStyle = "rgba(255,90,70,.9)"; c.lineWidth = 3; c.setLineDash([12, 8]);
    if (ui.aim.at) { c.beginPath(); c.arc(ui.aim.at.x, ui.aim.at.y, r, 0, 7); c.stroke(); }
    c.setLineDash([]);
  }
}

// ---------- رسم المباني ----------
const FOOT = { lot: 44, pad: 15 };
function drawBuilding(c, b, w, now, alpha, selected) {
  const B = BUILDINGS[b.type], col = TEAM[b.p], dark = TEAM_DARK[b.p];
  const s = B.size === "pad" ? FOOT.pad : FOOT.lot;
  c.save(); c.globalAlpha = alpha; c.translate(b.x, b.y);
  const built = b.built ?? 1;
  if (built < 1) {
    // موقع بناء: أساس وسقالات تكبر مع التقدّم
    c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(-s + 4, -s + 6, s * 2, s * 2);
    c.fillStyle = "#8a8378"; c.fillRect(-s, -s, s * 2, s * 2);
    const hh = s * 2 * built;
    c.fillStyle = col; c.fillRect(-s, s - hh, s * 2, hh);
    c.strokeStyle = "#e0c060"; c.lineWidth = 2;
    for (let k = -s; k <= s; k += s / 2) { c.beginPath(); c.moveTo(k, -s); c.lineTo(k, s); c.stroke(); c.beginPath(); c.moveTo(-s, k); c.lineTo(s, k); c.stroke(); }
    c.fillStyle = "#fff"; c.font = `900 ${B.size === "pad" ? 11 : 16}px Cairo, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(`${Math.floor(built * 100)}٪`, 0, 0);
    c.restore();
    if (!b.ghost) bar(c, b.x, b.y - s - 14, s * 2, b.hp / b.maxHp, col);
    return;
  }
  // ظل
  c.fillStyle = "rgba(0,0,0,.33)"; c.fillRect(-s + 8, -s + 11, s * 2, s * 2);
  c.fillStyle = dark; c.fillRect(-s, -s, s * 2, s * 2);
  c.fillStyle = col; c.fillRect(-s + 4, -s + 4, s * 2 - 8, s * 2 - 8);
  const t = b.type;
  c.textAlign = "center"; c.textBaseline = "middle";
  if (t === "hq") {
    c.fillStyle = dark; c.fillRect(-28, -28, 56, 56);
    c.fillStyle = "#e9eef5"; c.beginPath(); c.arc(0, 0, 18, 0, 7); c.fill();
    c.fillStyle = dark; c.font = "900 22px Cairo, sans-serif"; c.fillText("H", 0, 1);
    c.strokeStyle = "#e9eef5"; c.lineWidth = 2; c.beginPath(); c.moveTo(22, -22); c.lineTo(36, -36); c.stroke();
  } else if (t === "power") {
    for (const [x, y] of [[-16, -14], [16, 14]]) {
      c.fillStyle = "#cfd4d9"; c.beginPath(); c.arc(x, y, 15, 0, 7); c.fill();
      c.fillStyle = "#9aa3ab"; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill();
      // بخار
      const k = (((now / 1200 + x / 40) % 1) + 1) % 1;
      c.fillStyle = `rgba(240,240,240,${0.45 * (1 - k)})`; c.beginPath(); c.arc(x + k * 10, y - k * 22, 8 + k * 10, 0, 7); c.fill();
    }
    c.fillStyle = "#ffd43b"; c.font = "18px serif"; c.fillText("⚡", 18, -20);
  } else if (t === "supply") {
    c.fillStyle = dark; c.fillRect(-30, -30, 40, 60);
    for (let k = 0; k < 4; k++) { c.fillStyle = "#9b7440"; c.fillRect(16, -30 + k * 15, 12, 12); }
    c.font = "20px serif"; c.fillText("📦", -10, 0);
  } else if (t === "barracks") {
    for (const y of [-18, 6]) { c.fillStyle = dark; c.fillRect(-32, y, 64, 14); c.fillStyle = "rgba(255,255,255,.25)"; c.fillRect(-32, y, 64, 3); }
    c.font = "18px serif"; c.fillText("🪖", 0, 30);
  } else if (t === "factory") {
    c.fillStyle = dark; c.fillRect(-34, -34, 68, 50);
    c.strokeStyle = "rgba(255,255,255,.25)"; c.lineWidth = 2;
    for (let x = -30; x < 34; x += 8) { c.beginPath(); c.moveTo(x, -34); c.lineTo(x, 16); c.stroke(); }
    c.fillStyle = "#3a3d42"; c.fillRect(-16, 16, 32, 20);
    c.fillStyle = "#555"; c.fillRect(24, -40, 8, 14);
  } else if (t === "airfield") {
    c.fillStyle = "#3a3d42"; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fill();
    c.strokeStyle = "#f5f5f5"; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 22, 0, 7); c.stroke();
    c.fillStyle = "#f5f5f5"; c.font = "900 22px Cairo, sans-serif"; c.fillText("H", 0, 1);
  } else if (t === "tech") {
    c.fillStyle = "#dfe6ee"; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fill();
    c.fillStyle = "#b9c6d3"; c.beginPath(); c.arc(-6, -6, 18, 0, 7); c.fill();
    c.strokeStyle = dark; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.stroke();
    c.font = "18px serif"; c.fillText("🔬", 0, 0);
  } else if (t === "super") {
    c.fillStyle = "#30343a"; c.beginPath(); c.arc(0, 0, 34, 0, 7); c.fill();
    const f = (b.charge ?? 0) / SUPER.charge;
    c.fillStyle = f >= 1 ? "#ff4d3d" : "#ffb03b";
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); c.fill();
    c.fillStyle = "#e9e9e9"; c.beginPath(); c.arc(0, 0, 10, 0, 7); c.fill();
    if (f >= 1 && Math.floor(now / 400) % 2) { c.strokeStyle = "#ff4d3d"; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 40, 0, 7); c.stroke(); }
  } else if (t === "turret" || t === "aadef") {
    c.fillStyle = dark; c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fill();
    c.save(); c.rotate(b.ang ?? (b.p === 0 ? -Math.PI / 2 : Math.PI / 2));
    c.fillStyle = "#2b2b2b";
    if (t === "turret") c.fillRect(4, -2.5, 18, 5); else { c.fillRect(4, -5, 14, 3); c.fillRect(4, 2, 14, 3); }
    c.restore();
  }
  c.restore();
  if (selected) { c.strokeStyle = "#7CFF6B"; c.lineWidth = 3; c.strokeRect(b.x - s - 5, b.y - s - 5, s * 2 + 10, s * 2 + 10); }
  if (!b.ghost && (b.hp < b.maxHp || selected)) bar(c, b.x, b.y - s - 14, s * 2, b.hp / b.maxHp, col);
  // قائمة الإنتاج: تقدّم الوحدة الحالية
  if (!b.ghost && b.queue?.length) {
    const q = b.queue[0];
    c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(b.x - s, b.y + s + 4, s * 2, 6);
    c.fillStyle = "#7CFF6B"; c.fillRect(b.x - s, b.y + s + 4, s * 2 * (1 - q.t / q.total), 6);
  }
}

function drawRefinery(c, x, y, col, now) {
  c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(x + 5, y + 7, 22, 0, 7); c.fill();
  c.fillStyle = "#c9ccd0"; c.beginPath(); c.arc(x, y, 22, 0, 7); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(x, y, 14, 0, 7); c.fill();
  c.strokeStyle = "#555"; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 18, y - 4); c.lineTo(x + 38, y - 24); c.stroke();
  const k = (now / 900) % 1;
  c.fillStyle = `rgba(255,${150 + 60 * k},40,${0.8 - k * 0.6})`; c.beginPath(); c.arc(x + 40, y - 28 - k * 8, 4 + k * 4, 0, 7); c.fill();
  c.font = "18px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("🛢️", x, y + 36);
}
function drawTower(c, x, y, col, now) {
  c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(x - 10 + 8, y - 10 + 12, 20, 20);
  c.fillStyle = "#9aa1a9"; c.fillRect(x - 10, y - 10, 20, 20);
  c.strokeStyle = "#ccd2d8"; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 10, y - 10); c.lineTo(x + 10, y + 10); c.moveTo(x + 10, y - 10); c.lineTo(x - 10, y + 10); c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill();
  const k = (now / 1400) % 1;
  c.strokeStyle = hexA(col, 1 - k); c.lineWidth = 2; c.beginPath(); c.arc(x, y, 10 + k * 40, 0, 7); c.stroke();
}

// ---------- رسم الوحدات ----------
function drawUnit(c, u, Ud, x, y, now) {
  const col = TEAM[u.p], dark = TEAM_DARK[u.p];
  c.save(); c.translate(x, y); c.scale(1.35, 1.35);
  const sp = Ud.sprite;
  if (Ud.air) {
    // ظل الطائرة على الأرض
    c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(16, 22, Ud.radius * 0.9, Ud.radius * 0.6, 0, 0, 7); c.fill();
  }
  c.rotate(u.ang);
  if (sp === "squad" || sp === "rocketeer") {
    for (const [dx, dy] of [[4, 0], [-5, -7], [-5, 7]]) {
      c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(dx + 1.5, dy + 2, 4.5, 0, 7); c.fill();
      c.strokeStyle = "#222"; c.lineWidth = sp === "rocketeer" ? 3 : 1.6; c.beginPath(); c.moveTo(dx - (sp === "rocketeer" ? 4 : 0), dy); c.lineTo(dx + 9, dy + 1); c.stroke();
      c.fillStyle = dark; c.beginPath(); c.arc(dx, dy, 4.5, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(dx, dy, 3, 0, 7); c.fill();
    }
  } else if (sp === "tank" || sp === "ltank" || sp === "fortress") {
    const L = sp === "fortress" ? 22 : sp === "ltank" ? 14 : 16, Wd = sp === "fortress" ? 15 : sp === "ltank" ? 9 : 11;
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(-L + 3, -Wd + 4, L * 2, Wd * 2);
    c.fillStyle = "#2a2a2a"; c.fillRect(-L, -Wd, L * 2, 5); c.fillRect(-L, Wd - 5, L * 2, 5);
    c.fillStyle = dark; c.fillRect(-L + 1, -Wd + 3, L * 2 - 2, Wd * 2 - 6);
    c.fillStyle = col; c.fillRect(-L + 4, -Wd + 5, L * 2 - 10, Wd * 2 - 10);
    c.fillStyle = "#2b2b2b"; c.fillRect(4, -1.8, L + 6, 3.6);
    if (sp === "fortress") c.fillRect(4, -6, L + 4, 3.6), c.fillRect(4, 2.4, L + 4, 3.6);
    c.fillStyle = dark; c.beginPath(); c.arc(0, 0, Wd * 0.7, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(-1, -1, Wd * 0.45, 0, 7); c.fill();
  } else if (sp === "arty" || sp === "mlrs" || sp === "aa" || sp === "raider" || sp === "truck" || sp === "dozer") {
    const L = sp === "raider" ? 12 : 14, Wd = sp === "raider" ? 8 : 9;
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(-L + 3, -Wd + 4, L * 2, Wd * 2);
    c.fillStyle = "#2a2a2a";
    for (const xx of [-L + 3, L - 7]) { c.fillRect(xx, -Wd - 1, 5, 3); c.fillRect(xx, Wd - 2, 5, 3); }
    c.fillStyle = dark; c.fillRect(-L, -Wd, L * 2, Wd * 2);
    c.fillStyle = col; c.fillRect(L - 9, -Wd + 2, 7, Wd * 2 - 4); // مقصورة السائق
    if (sp === "arty") { c.fillStyle = "#333"; c.fillRect(-2, -2.2, 30, 4.4); c.fillStyle = "#555"; c.fillRect(-10, -6, 12, 12); }
    else if (sp === "mlrs") { c.fillStyle = "#3b3b3b"; c.fillRect(-12, -7, 16, 14); c.fillStyle = "#ff9b3d"; for (let i = 0; i < 6; i++) c.fillRect(-10 + (i % 3) * 5, -5 + Math.floor(i / 3) * 6, 3, 3); }
    else if (sp === "aa") { c.fillStyle = "#333"; c.fillRect(-4, -5, 22, 3); c.fillRect(-4, 2, 22, 3); c.fillStyle = "#555"; c.beginPath(); c.arc(-4, 0, 6, 0, 7); c.fill(); }
    else if (sp === "raider") { c.fillStyle = "#333"; c.fillRect(-6, -1.5, 14, 3); c.fillStyle = "#555"; c.beginPath(); c.arc(-6, 0, 4, 0, 7); c.fill(); }
    else if (sp === "truck") { c.fillStyle = "#9b7440"; c.fillRect(-L + 2, -Wd + 2, 15, Wd * 2 - 4); }
    else if (sp === "dozer") { c.fillStyle = "#f2b632"; c.fillRect(L, -Wd - 2, 4, Wd * 2 + 4); c.fillStyle = "#f2b632"; c.fillRect(-L + 2, -Wd + 2, 12, Wd * 2 - 4); }
  } else if (sp === "heli") {
    c.fillStyle = dark; c.beginPath(); c.ellipse(0, 0, 14, 7, 0, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.ellipse(3, 0, 8, 5, 0, 0, 7); c.fill();
    c.fillStyle = dark; c.fillRect(-24, -1.5, 14, 3);
    c.save(); c.rotate(now / 50); c.fillStyle = "rgba(230,230,230,.5)"; c.fillRect(-20, -1.5, 40, 3); c.fillRect(-1.5, -20, 3, 40); c.restore();
  } else if (sp === "drone") {
    c.rotate(Math.PI / 4);
    c.strokeStyle = "#333"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-10, -10); c.lineTo(10, 10); c.moveTo(10, -10); c.lineTo(-10, 10); c.stroke();
    for (const [dx, dy] of [[-10, -10], [10, 10], [10, -10], [-10, 10]]) { c.fillStyle = "rgba(220,220,220,.45)"; c.beginPath(); c.ellipse(dx, dy, 6.5, 2.2, now / 40 + dx, 0, 7); c.fill(); }
    c.fillStyle = dark; c.beginPath(); c.arc(0, 0, 6.5, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 4.5, 0, 7); c.fill();
  } else if (sp === "jet") {
    c.fillStyle = dark;
    c.beginPath(); c.moveTo(20, 0); c.lineTo(-12, -16); c.lineTo(-6, 0); c.lineTo(-12, 16); c.closePath(); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(18, 0); c.lineTo(-8, -4); c.lineTo(-8, 4); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,170,60,.8)"; c.beginPath(); c.arc(-10, 0, 3 + Math.random() * 2, 0, 7); c.fill();
  }
  c.restore();
}

function drawFx(c, f, k, w, me, now) {
  if (f.k === "tracer") {
    if (f.p !== me && !visibleCell(w, me, f.x, f.y) && !visibleCell(w, me, f.tx, f.ty)) return;
    c.globalAlpha = 1 - k;
    const rocket = f.weapon === "rocket" || f.weapon === "missile";
    c.strokeStyle = f.weapon === "shell" ? "#ffd27a" : rocket ? "rgba(230,230,230,.7)" : f.weapon === "flak" ? "#a8e1ff" : "#fff3b0";
    c.lineWidth = f.weapon === "shell" ? 3 : rocket ? 3 : 1.6;
    const t0 = Math.min(1, k * 1.5), t1 = Math.min(1, k * 1.5 + (rocket ? 0.15 : 0.3));
    c.beginPath(); c.moveTo(lerp(f.x, f.tx, t0), lerp(f.y, f.ty, t0)); c.lineTo(lerp(f.x, f.tx, t1), lerp(f.y, f.ty, t1)); c.stroke();
    if (rocket) { c.fillStyle = "#ffb35a"; c.beginPath(); c.arc(lerp(f.x, f.tx, t1), lerp(f.y, f.ty, t1), 3, 0, 7); c.fill(); }
    if (k < 0.35) { const a = Math.atan2(f.ty - f.y, f.tx - f.x); c.fillStyle = "#ffe08a"; c.beginPath(); c.arc(f.x + Math.cos(a) * 12, f.y + Math.sin(a) * 12, f.weapon === "shell" ? 6 : 3, 0, 7); c.fill(); }
    if (k > 0.6 && f.weapon !== "bullet") { c.fillStyle = "rgba(255,170,60,.6)"; c.beginPath(); c.arc(f.tx, f.ty, 6 * (1 - k) * 3, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  } else if (f.k === "flash") {
    c.globalAlpha = 1 - k; c.fillStyle = "#ffcf6a"; c.beginPath(); c.arc(f.x, f.y, 10 + k * 10, 0, 7); c.fill(); c.globalAlpha = 1;
  } else if (f.k === "boom" || f.k === "puff") {
    const R = (f.k === "boom" ? 34 : 14) * (f.s || 1) * (0.4 + k);
    c.globalAlpha = Math.max(0, 1 - k);
    if (f.k === "boom") {
      const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      g.addColorStop(0, "#fff2b3"); g.addColorStop(0.35, "#ffae3b"); g.addColorStop(0.7, "rgba(200,70,20,.6)"); g.addColorStop(1, "rgba(60,40,30,0)");
      c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, R, 0, 7); c.fill();
    }
    c.fillStyle = "rgba(95,95,95,.33)";
    for (let j = 0; j < 5; j++) { const a = j * 1.26 + f.x; c.beginPath(); c.arc(f.x + Math.cos(a) * R * 0.7, f.y + Math.sin(a) * R * 0.7 - k * 20, R * 0.35, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  } else if (f.k === "ring") {
    const pt = w.points[f.id];
    c.globalAlpha = 1 - k; c.strokeStyle = TEAM[f.p]; c.lineWidth = 6;
    c.beginPath(); c.arc(pt.x, pt.y, CAPTURE_R + k * 60, 0, 7); c.stroke(); c.globalAlpha = 1;
  } else if (f.k === "planes") {
    // ثلاث طائرات تعبر من طرف الخريطة إلى الهدف ثم تكمل
    const t = k * 1.6;
    const sx = f.x, sy = f.p === 0 ? H + 200 : -200, ex = f.x, ey = f.p === 0 ? -400 : H + 400;
    const ang = Math.atan2(ey - sy, ex - sx);
    for (let i = 0; i < 3; i++) {
      const tt = t - i * 0.05;
      if (tt < 0 || tt > 1) continue;
      const x = lerp(sx, ex, tt) + (i - 1) * 40, y = lerp(sy, ey, tt);
      c.save(); c.translate(x, y); c.rotate(ang);
      c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(30, 40, 26, 10, 0, 0, 7); c.fill();
      c.fillStyle = TEAM_DARK[f.p];
      c.beginPath(); c.moveTo(28, 0); c.lineTo(-18, -26); c.lineTo(-8, 0); c.lineTo(-18, 26); c.closePath(); c.fill();
      c.fillStyle = TEAM[f.p]; c.beginPath(); c.moveTo(26, 0); c.lineTo(-12, -6); c.lineTo(-12, 6); c.closePath(); c.fill();
      c.restore();
    }
  } else if (f.k === "chutes") {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, x = f.x + Math.cos(a) * 26, y = f.y + Math.sin(a) * 26 - (1 - k) * 40;
      c.globalAlpha = 1 - k; c.fillStyle = "#f0f0f0"; c.beginPath(); c.arc(x, y - 14, 10, Math.PI, 0); c.fill(); c.globalAlpha = 1;
    }
  } else if (f.k === "target") {
    const pulse = Math.floor(now / 300) % 2;
    c.strokeStyle = pulse ? "#ff3b30" : "#ffd60a"; c.lineWidth = 6; c.setLineDash([18, 12]);
    c.beginPath(); c.arc(f.x, f.y, SUPER.radius, 0, 7); c.stroke(); c.setLineDash([]);
    c.font = "40px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("☢️", f.x, f.y);
  } else if (f.k === "nova") {
    const R = f.r * (0.3 + k * 1.4);
    c.globalAlpha = 1 - k;
    const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, "#ffd27a"); g.addColorStop(0.75, "rgba(255,90,30,.6)"); g.addColorStop(1, "rgba(80,40,20,0)");
    c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, R, 0, 7); c.fill(); c.globalAlpha = 1;
  }
}

function drawPlacement(c, w, place, now, me) {
  // الأماكن المتاحة للبناء تومض
  const pulse = 0.55 + Math.sin(now / 200) * 0.25;
  for (const s of place.spots) {
    c.strokeStyle = s.ok ? `rgba(124,255,107,${pulse})` : "rgba(255,90,70,.35)";
    c.fillStyle = s.ok ? `rgba(124,255,107,${pulse * 0.25})` : "rgba(255,90,70,.1)";
    c.lineWidth = 4;
    if (s.lot != null) {
      const P = new Path2D(); w.city.lots[s.lot].poly.forEach((q, k) => (k ? P.lineTo(q.x, q.y) : P.moveTo(q.x, q.y))); P.closePath();
      c.fill(P); c.stroke(P);
    } else { const pd = w.city.pads[s.pad]; c.beginPath(); c.arc(pd.x, pd.y, 15, 0, 7); c.fill(); c.stroke(); }
  }
}

function bar(c, x, y, wdt, f, col) {
  c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(x - wdt / 2 - 1, y - 1, wdt + 2, 6);
  c.fillStyle = f > 0.5 ? col : f > 0.25 ? "#f5b83d" : "#ff5a4f";
  c.fillRect(x - wdt / 2, y, wdt * Math.max(0, f), 4);
}

// ============================================================
//  الخريطة المصغّرة
// ============================================================
export function createMinimap(canvas, v, w) {
  const mw = canvas.width, mh = canvas.height;
  const base = document.createElement("canvas");
  base.width = mw; base.height = mh;
  base.getContext("2d").drawImage(v.bg, 0, 0, mw, mh);
  return { canvas, ctx: canvas.getContext("2d"), base, sx: mw / W, sy: mh / H };
}
export function renderMinimap(m, v, w, me = 0) {
  const c = m.ctx;
  c.drawImage(m.base, 0, 0);
  c.globalAlpha = 0.85; c.drawImage(v.fog, 0, 0, w.gw * CELL * m.sx, w.gh * CELL * m.sy); c.globalAlpha = 1;
  for (const pt of w.points) { c.fillStyle = pt.owner >= 0 ? TEAM[pt.owner] : "#dfe3e8"; c.strokeStyle = "#000"; c.lineWidth = 1; c.beginPath(); c.arc(pt.x * m.sx, pt.y * m.sy, 3.5, 0, 7); c.fill(); c.stroke(); }
  for (const d of w.depots) if (d.amount > 0) { c.fillStyle = "#f5c542"; c.fillRect(d.x * m.sx - 2, d.y * m.sy - 2, 4, 4); }
  const shown = new Set();
  for (const b of w.buildings) if (b.p === me || visibleCell(w, me, b.x, b.y)) { shown.add(b.id); c.fillStyle = TEAM[b.p]; const s = BUILDINGS[b.type].size === "pad" ? 2 : 4; c.fillRect(b.x * m.sx - s, b.y * m.sy - s, s * 2, s * 2); }
  for (const [id, k] of w.known[me]) if (!shown.has(id)) { c.fillStyle = hexA(TEAM[k.p], 0.6); c.fillRect(k.x * m.sx - 3, k.y * m.sy - 3, 6, 6); }
  for (const u of w.units) {
    if (u.p !== me && !visibleCell(w, me, u.x, u.y)) continue;
    c.fillStyle = TEAM[u.p]; c.fillRect(u.x * m.sx - 1.5, u.y * m.sy - 1.5, 3, 3);
  }
  const hw = v.cw / 2 / v.cam.z, hh = v.ch / 2 / v.cam.z;
  c.strokeStyle = "#fff"; c.lineWidth = 1.5;
  c.strokeRect((v.cam.x - hw) * m.sx, (v.cam.y - hh) * m.sy, hw * 2 * m.sx, hh * 2 * m.sy);
}
