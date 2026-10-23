// ============================================================
//  الرسم: المدينة من الأعلى بأسلوب واقعي (شوارع، أرصفة، أبنية بظلال، أشجار، نهر، جسور)
//  الطبقة الثابتة تُرسم مرة واحدة، وفوقها كل إطار: المواقع، الوحدات، المؤثرات، ضباب الحرب
// ============================================================
import { W, H, STREET, AVENUE, riverY, POINT_TYPES } from "./city.js";
import { UNITS, TEAM, TEAM_DARK, NEUTRAL_COLOR } from "./units.js";
import { makeRng } from "./rng.js";
import { CELL, CAPTURE_R } from "./world.js";
import { HQ } from "./units.js";

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
    c.fillStyle = b.kind === "park" ? "#8db36e" : b.kind === "industrial" ? "#a6a39b" : b.kind === "plaza" || b.kind === "hq" ? "#d3cbbb" : "#c7c0b1";
    c.fill(I);
    if (b.kind === "plaza" || b.kind === "hq") {
      // بلاط الساحة
      c.save(); c.clip(I);
      c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1;
      for (let k = -300; k < 300; k += 16) { c.beginPath(); c.moveTo(b.x + k, b.y - 300); c.lineTo(b.x + k, b.y + 300); c.stroke(); c.beginPath(); c.moveTo(b.x - 300, b.y + k); c.lineTo(b.x + 300, b.y + k); c.stroke(); }
      c.restore();
      c.fillStyle = "#8db36e";
      for (const [dx, dy] of [[-46, -30], [46, 30], [-46, 30], [46, -30]]) { c.beginPath(); c.arc(b.x + dx, b.y + dy, 9, 0, 7); c.fill(); }
    }
    if (b.kind === "hq") {
      c.strokeStyle = "#8b8578"; c.lineWidth = 5; c.stroke(path(shrink(b.poly, 10)));
    }
    const B = b.buildings;
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
//  الطبقة المتحركة
// ============================================================

export function createView(canvas, w) {
  const view = { canvas, ctx: canvas.getContext("2d"), dpr: 1, cw: 0, ch: 0, cam: { x: 0, y: 0, z: 1 }, bg: drawCity(w.city), fx: [], decals: [], fog: document.createElement("canvas"), markers: [] };
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
// أقصى تبعيد: المدينة كلها في الشاشة
export const minZoom = (v) => v.cw / W;
export function clampCam(v) {
  const z0 = minZoom(v);
  v.cam.z = Math.max(z0, Math.min(2.4, v.cam.z));
  const hw = v.cw / 2 / v.cam.z, hh = v.ch / 2 / v.cam.z;
  v.cam.x = hw * 2 >= W ? W / 2 : Math.max(hw, Math.min(W - hw, v.cam.x));
  v.cam.y = hh * 2 >= H ? H / 2 : Math.max(hh, Math.min(H - hh, v.cam.y));
}
export const screenToWorld = (v, sx, sy) => ({ x: (sx - v.cw / 2) / v.cam.z + v.cam.x, y: (sy - v.ch / 2) / v.cam.z + v.cam.y });

// مؤثرات من أحداث المحاكاة
export function addEvent(v, ev, now) {
  if (ev.type === "shot") v.fx.push({ k: "tracer", ...ev, t0: now, life: ev.kind === "tank" ? 160 : 110 });
  else if (ev.type === "artyFire") v.fx.push({ k: "flash", x: ev.x + Math.cos(ev.ang) * 22, y: ev.y + Math.sin(ev.ang) * 22, t0: now, life: 160, big: true });
  else if (ev.type === "boom") { v.fx.push({ k: "boom", x: ev.x, y: ev.y, t0: now, life: 900 }); decal(v, ev.x, ev.y, 18); }
  else if (ev.type === "death") {
    const big = ev.unit === "tank" || ev.unit === "artillery";
    v.fx.push({ k: big ? "boom" : "puff", x: ev.x, y: ev.y, t0: now, life: big ? 1100 : 500 });
    if (big) { decal(v, ev.x, ev.y, 16); v.decals.push({ k: "wreck", x: ev.x, y: ev.y, a: Math.random() * 6, unit: ev.unit, t0: now }); }
  } else if (ev.type === "captured") v.fx.push({ k: "ring", id: ev.id, p: ev.p, t0: now, life: 900 });
  else if (ev.type === "hqDown") { for (let k = 0; k < 6; k++) v.fx.push({ k: "boom", x: ev.x + (Math.random() - 0.5) * 80, y: ev.y + (Math.random() - 0.5) * 80, t0: now + k * 180, life: 1200 }); }
  if (v.decals.length > 70) v.decals.shift();
}
function decal(v, x, y, r) { v.decals.push({ k: "scorch", x, y, r: r * (0.8 + Math.random() * 0.5) }); }

const lerp = (a, b, t) => a + (b - a) * t;

export function render(v, w, ui, now, alpha, me = 0) {
  const c = v.ctx, { cam } = v;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = "#2b2f35"; c.fillRect(0, 0, v.canvas.width, v.canvas.height);
  c.setTransform(v.dpr * cam.z, 0, 0, v.dpr * cam.z, v.dpr * (v.cw / 2 - cam.x * cam.z), v.dpr * (v.ch / 2 - cam.y * cam.z));
  c.imageSmoothingEnabled = true;
  c.drawImage(v.bg, 0, 0, W, H);
  // آثار المعارك
  for (const d of v.decals) {
    if (d.k === "scorch") {
      const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 1.6);
      g.addColorStop(0, "rgba(25,20,15,.55)"); g.addColorStop(1, "rgba(25,20,15,0)");
      c.fillStyle = g; c.beginPath(); c.arc(d.x, d.y, d.r * 1.6, 0, 7); c.fill();
    } else if (d.k === "wreck") {
      c.save(); c.translate(d.x, d.y); c.rotate(d.a);
      c.fillStyle = "#2c2a27"; c.fillRect(-13, -8, 26, 16); c.fillStyle = "#45403a"; c.beginPath(); c.arc(1, 0, 6, 0, 7); c.fill();
      c.restore();
    }
  }
  // المواقع
  for (const pt of w.points) {
    const col = pt.owner >= 0 ? TEAM[pt.owner] : NEUTRAL_COLOR;
    if (pt.type === "hq") continue;
    c.setLineDash([10, 8]); c.lineWidth = 3; c.strokeStyle = hexA(col, 0.8);
    c.beginPath(); c.arc(pt.x, pt.y, CAPTURE_R, 0, 7); c.stroke(); c.setLineDash([]);
    if (pt.owner >= 0) { c.fillStyle = hexA(col, 0.12); c.beginPath(); c.arc(pt.x, pt.y, CAPTURE_R, 0, 7); c.fill(); }
    // تقدّم الاحتلال
    if (pt.by >= 0 && pt.owner === -1 && pt.prog > 0) {
      c.strokeStyle = TEAM[pt.by]; c.lineWidth = 8;
      c.beginPath(); c.arc(pt.x, pt.y, CAPTURE_R - 4, -Math.PI / 2, -Math.PI / 2 + pt.prog * Math.PI * 2); c.stroke();
    } else if (pt.owner >= 0 && pt.prog < 1) {
      c.strokeStyle = TEAM[pt.owner]; c.lineWidth = 8;
      c.beginPath(); c.arc(pt.x, pt.y, CAPTURE_R - 4, -Math.PI / 2, -Math.PI / 2 + pt.prog * Math.PI * 2); c.stroke();
    }
    flag(c, pt.x, pt.y, col, now);
    c.font = "26px serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(POINT_TYPES[pt.type].icon, pt.x + 26, pt.y + 22);
  }
  // المقرّان
  w.players.forEach((pl, p) => {
    const h = pl.hq;
    c.save(); c.translate(h.x, h.y);
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(-44 + 10, -44 + 14, 88, 88);
    c.fillStyle = TEAM_DARK[p]; c.fillRect(-46, -46, 92, 92);
    c.fillStyle = TEAM[p]; c.fillRect(-38, -38, 76, 76);
    c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 2; c.strokeRect(-30, -30, 60, 60);
    c.fillStyle = "#fff"; c.beginPath(); c.arc(0, 0, 13, 0, 7); c.fill();
    c.fillStyle = TEAM_DARK[p]; c.font = "900 18px Cairo, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("H", 0, 1);
    c.restore();
    bar(c, h.x, h.y - 62, 90, Math.max(0, h.hp) / HQ.hp, TEAM[p]);
  });
  // القذائف في الجو
  for (const s of w.shells) {
    const t = Math.min(1, (w.tick + alpha - s.fired) / (s.land - s.fired));
    const x = lerp(s.x0, s.x, t), y = lerp(s.y0, s.y, t), hgt = Math.sin(t * Math.PI) * 90;
    c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill();
    c.fillStyle = "#ffd27a"; c.beginPath(); c.arc(x, y - hgt, 3.5, 0, 7); c.fill();
  }
  // الوحدات (وحدات العدو تظهر فقط إن كانت في مدى رؤيتك)
  const sel = new Set(ui.selected);
  const order = [...w.units].sort((a, b) => (UNITS[a.type].air ? 1 : 0) - (UNITS[b.type].air ? 1 : 0));
  for (const u of order) {
    const x = lerp(u.px ?? u.x, u.x, alpha), y = lerp(u.py ?? u.y, u.y, alpha);
    if (u.p !== me && !visibleCell(w, me, x, y)) continue;
    if (sel.has(u.id)) {
      c.strokeStyle = "#7CFF6B"; c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, UNITS[u.type].radius * 1.35 + 8, 0, 7); c.stroke();
    }
    drawUnit(c, u, x, y, now);
    if (u.hp < UNITS[u.type].hp || sel.has(u.id)) bar(c, x, y - UNITS[u.type].radius - 10, 26, u.hp / UNITS[u.type].hp, TEAM[u.p]);
  }
  // مؤثرات
  v.fx = v.fx.filter((f) => now - f.t0 < f.life);
  for (const f of v.fx) {
    const k = (now - f.t0) / f.life;
    if (k < 0) continue;
    if (f.k === "tracer") {
      if (f.p !== me && !visibleCell(w, me, f.x, f.y) && !visibleCell(w, me, f.tx, f.ty)) continue;
      c.globalAlpha = 1 - k;
      c.strokeStyle = f.kind === "tank" ? "#ffd27a" : f.kind === "hq" ? "#a8e1ff" : "#fff3b0";
      c.lineWidth = f.kind === "tank" ? 3 : 1.6;
      const t0 = Math.min(1, k * 1.6), t1 = Math.min(1, k * 1.6 + 0.3);
      c.beginPath(); c.moveTo(lerp(f.x, f.tx, t0), lerp(f.y, f.ty, t0)); c.lineTo(lerp(f.x, f.tx, t1), lerp(f.y, f.ty, t1)); c.stroke();
      if (k < 0.4) { c.fillStyle = "#ffe08a"; c.beginPath(); c.arc(f.x + Math.cos(Math.atan2(f.ty - f.y, f.tx - f.x)) * 12, f.y + Math.sin(Math.atan2(f.ty - f.y, f.tx - f.x)) * 12, f.kind === "tank" ? 6 : 3, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    } else if (f.k === "flash") {
      c.globalAlpha = 1 - k; c.fillStyle = "#ffcf6a"; c.beginPath(); c.arc(f.x, f.y, 10 + k * 10, 0, 7); c.fill(); c.globalAlpha = 1;
    } else if (f.k === "boom" || f.k === "puff") {
      const R = (f.k === "boom" ? 34 : 14) * (0.4 + k);
      c.globalAlpha = Math.max(0, 1 - k);
      if (f.k === "boom") {
        const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
        g.addColorStop(0, "#fff2b3"); g.addColorStop(0.35, "#ffae3b"); g.addColorStop(0.7, "rgba(200,70,20,.6)"); g.addColorStop(1, "rgba(60,40,30,0)");
        c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, R, 0, 7); c.fill();
      }
      c.fillStyle = "rgba(70,70,70,.5)";
      for (let j = 0; j < 5; j++) { const a = j * 1.26 + f.x; c.beginPath(); c.arc(f.x + Math.cos(a) * R * 0.7, f.y + Math.sin(a) * R * 0.7 - k * 20, R * 0.35, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    } else if (f.k === "ring") {
      const pt = w.points[f.id];
      c.globalAlpha = 1 - k; c.strokeStyle = TEAM[f.p]; c.lineWidth = 6;
      c.beginPath(); c.arc(pt.x, pt.y, CAPTURE_R + k * 60, 0, 7); c.stroke(); c.globalAlpha = 1;
    }
  }
  // علامة الأمر
  v.markers = v.markers.filter((m) => now - m.t0 < 700);
  for (const m of v.markers) {
    const k = (now - m.t0) / 700;
    c.globalAlpha = 1 - k; c.strokeStyle = "#7CFF6B"; c.lineWidth = 3;
    c.beginPath(); c.arc(m.x, m.y, 10 + k * 22, 0, 7); c.stroke(); c.globalAlpha = 1;
  }
  // ضباب الحرب
  const img = v.fogImg, vis = w.vis[me], seen = w.seen[me];
  for (let i = 0; i < vis.length; i++) {
    img.data[i * 4] = 10; img.data[i * 4 + 1] = 16; img.data[i * 4 + 2] = 26;
    img.data[i * 4 + 3] = vis[i] ? 0 : seen[i] ? 105 : 190;
  }
  v.fogCtx.putImageData(img, 0, 0);
  c.imageSmoothingEnabled = true;
  c.drawImage(v.fog, 0, 0, w.gw * CELL, w.gh * CELL);
}

const visibleCell = (w, p, x, y) => {
  const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
  return i >= 0 && j >= 0 && i < w.gw && j < w.gh && w.vis[p][j * w.gw + i] === 1;
};

function flag(c, x, y, col, now) {
  c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(x + 3, y - 2, 3, 6);
  c.strokeStyle = "#ddd"; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 40); c.stroke();
  const wave = Math.sin(now / 250 + x) * 3;
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x, y - 40); c.quadraticCurveTo(x + 14, y - 36 + wave, x + 28, y - 38); c.lineTo(x + 28, y - 24); c.quadraticCurveTo(x + 14, y - 22 + wave, x, y - 26); c.closePath(); c.fill();
}

function bar(c, x, y, wdt, f, col) {
  c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(x - wdt / 2 - 1, y - 1, wdt + 2, 6);
  c.fillStyle = f > 0.5 ? col : f > 0.25 ? "#f5b83d" : "#ff5a4f";
  c.fillRect(x - wdt / 2, y, wdt * Math.max(0, f), 4);
}

function drawUnit(c, u, x, y, now) {
  const col = TEAM[u.p], dark = TEAM_DARK[u.p];
  c.save(); c.translate(x, y); c.scale(1.35, 1.35);
  if (u.type === "infantry") {
    // فرقة من ثلاثة جنود
    c.rotate(u.ang);
    for (const [dx, dy] of [[4, 0], [-5, -7], [-5, 7]]) {
      c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(dx + 1.5, dy + 2, 4.5, 0, 7); c.fill();
      c.strokeStyle = "#222"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + 8, dy + 1); c.stroke();
      c.fillStyle = dark; c.beginPath(); c.arc(dx, dy, 4.5, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(dx, dy, 3, 0, 7); c.fill();
    }
  } else if (u.type === "tank") {
    c.rotate(u.ang);
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(-15 + 3, -10 + 4, 32, 21);
    c.fillStyle = "#2a2a2a"; c.fillRect(-16, -11, 32, 5); c.fillRect(-16, 6, 32, 5);
    c.fillStyle = dark; c.fillRect(-15, -8, 30, 16);
    c.fillStyle = col; c.fillRect(-12, -6, 22, 12);
    c.fillStyle = "#2b2b2b"; c.fillRect(4, -1.8, 20, 3.6);
    c.fillStyle = dark; c.beginPath(); c.arc(0, 0, 7, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(-1, -1, 4.5, 0, 7); c.fill();
  } else if (u.type === "artillery") {
    c.rotate(u.ang);
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(-14 + 3, -8 + 4, 28, 17);
    c.fillStyle = "#2a2a2a"; c.fillRect(-14, -9, 28, 4); c.fillRect(-14, 5, 28, 4);
    c.fillStyle = dark; c.fillRect(-14, -7, 28, 14);
    c.fillStyle = col; c.fillRect(-12, -5, 12, 10);
    c.fillStyle = "#333"; c.fillRect(0, -2.2, 30, 4.4);
    c.fillStyle = "#555"; c.fillRect(26, -3, 5, 6);
  } else {
    // مسيّرة رباعية المراوح وظلها على الأرض
    c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(14, 20, 11, 8, 0, 0, 7); c.fill();
    c.rotate(u.ang + Math.PI / 4);
    c.strokeStyle = "#333"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-10, -10); c.lineTo(10, 10); c.moveTo(10, -10); c.lineTo(-10, 10); c.stroke();
    const spin = now / 40;
    for (const [dx, dy] of [[-10, -10], [10, 10], [10, -10], [-10, 10]]) {
      c.fillStyle = "rgba(220,220,220,.45)"; c.beginPath(); c.ellipse(dx, dy, 6.5, 2.2, spin + dx, 0, 7); c.fill();
      c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = 1; c.beginPath(); c.arc(dx, dy, 6, 0, 7); c.stroke();
    }
    c.fillStyle = dark; c.beginPath(); c.arc(0, 0, 6.5, 0, 7); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 4.5, 0, 7); c.fill();
  }
  c.restore();
}

const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

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
  // ضباب
  c.globalAlpha = 0.85; c.imageSmoothingEnabled = true;
  c.drawImage(v.fog, 0, 0, w.gw * CELL * m.sx, w.gh * CELL * m.sy);
  c.globalAlpha = 1;
  for (const pt of w.points) {
    c.fillStyle = pt.owner >= 0 ? TEAM[pt.owner] : "#dfe3e8";
    c.strokeStyle = "#000"; c.lineWidth = 1;
    c.beginPath(); c.arc(pt.x * m.sx, pt.y * m.sy, pt.type === "hq" ? 6 : 4, 0, 7); c.fill(); c.stroke();
  }
  for (const u of w.units) {
    if (u.p !== me && !visibleCell(w, me, u.x, u.y)) continue;
    c.fillStyle = TEAM[u.p]; c.fillRect(u.x * m.sx - 1.5, u.y * m.sy - 1.5, 3, 3);
  }
  // إطار الكاميرا
  const hw = v.cw / 2 / v.cam.z, hh = v.ch / 2 / v.cam.z;
  c.strokeStyle = "#fff"; c.lineWidth = 1.5;
  c.strokeRect((v.cam.x - hw) * m.sx, (v.cam.y - hh) * m.sy, hw * 2 * m.sx, hh * 2 * m.sy);
}
