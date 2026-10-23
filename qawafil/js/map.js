// ============================================================
//  خريطة الطرق: SVG مرسوم بالكود (البحار مأخوذة تقريبياً من الخريطة الحقيقية)
// ============================================================
import { CITIES, ROUTES } from "./data.js";
import { C, routeDanger, dangerLabel } from "./engine.js";

const W = 1000, H = 800;
const SEAS = [
  // البحر المتوسط
  "0,0 0,222 60,214 120,212 170,206 186,196 200,160 210,110 222,72 244,50 205,40 120,44 40,38",
  // البحر الأحمر وخليج العقبة
  "108,246 150,320 205,410 255,500 300,580 365,680 430,780 470,800 482,770 410,670 350,580 312,500 265,410 215,330 196,262 186,270 200,330 168,300 120,248",
  // الخليج العربي
  "612,242 650,238 720,288 800,318 890,343 902,370 880,394 810,420 760,410 720,402 700,380 672,342 640,300 618,262",
  // خليج عُمان وبحر العرب
  "890,346 1000,326 1000,800 470,800 482,772 560,758 700,700 800,640 880,560 925,500 905,470 960,430 940,412 900,398 892,372"
];

// نقطة على الطريق بين مدينتين حسب نسبة التقدم (منحنى خفيف ليبدو كطريق قوافل)
function curve(a, b) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(40, len * 0.08);
  return { cx: mx - (dy / len) * bend, cy: my + (dx / len) * bend };
}
export function pointOn(aId, bId, t) {
  const a = C[aId], b = C[bId];
  const { cx, cy } = curve(a, b);
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y };
}

export function mapSvg(s, selected) {
  const here = s.travel ? null : s.city;
  const roads = ROUTES.map((r) => {
    const a = C[r.a], b = C[r.b];
    const { cx, cy } = curve(a, b);
    const active = s.travel && ((s.travel.from === r.a && s.travel.to === r.b) || (s.travel.from === r.b && s.travel.to === r.a));
    const fromHere = here && (r.a === here || r.b === here);
    const lvl = dangerLabel(routeDanger(s, r))[1];
    return `<path class="road ${lvl} ${fromHere ? "near" : ""} ${active ? "active" : ""}" d="M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}"/>`;
  }).join("");
  const cities = CITIES.map((c) => {
    const isHere = c.id === here;
    const sel = c.id === selected;
    const known = s.known[c.id];
    return `<g class="city ${isHere ? "here" : ""} ${sel ? "sel" : ""} ${known ? "known" : ""}" data-city="${c.id}" transform="translate(${c.x},${c.y})" tabindex="0" role="button" aria-label="${c.name}">
      <circle class="hit" r="40"/>
      <circle class="dot" r="${isHere ? 15 : 12}"/>
      <text class="name" y="${c.y > 700 ? -24 : 38}">${c.name}</text>
    </g>`;
  }).join("");
  let caravan = "";
  if (s.travel) {
    const t = Math.min(1, s.travel.done / s.travel.total);
    const p = pointOn(s.travel.from, s.travel.to, t);
    caravan = `<g class="caravan moving" transform="translate(${p.x},${p.y})"><text y="10">🐪</text></g>`;
  } else {
    const c = C[s.city];
    caravan = `<g class="caravan" transform="translate(${c.x},${c.y - 30})"><text y="10">🐪</text></g>`;
  }
  return `<svg class="map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="خريطة طرق القوافل">
    <defs>
      <pattern id="dunes" width="60" height="30" patternUnits="userSpaceOnUse">
        <path d="M0 22 Q15 14 30 22 T60 22" fill="none" stroke="#e2c99a" stroke-width="2"/>
      </pattern>
      <pattern id="waves" width="40" height="20" patternUnits="userSpaceOnUse">
        <path d="M0 12 Q10 6 20 12 T40 12" fill="none" stroke="#8fc0cf" stroke-width="2"/>
      </pattern>
    </defs>
    <rect width="${W}" height="${H}" class="land"/>
    <rect width="${W}" height="${H}" fill="url(#dunes)" opacity=".7"/>
    ${SEAS.map((p) => `<polygon class="sea" points="${p}"/><polygon points="${p}" fill="url(#waves)" opacity=".6"/>`).join("")}
    <text class="sea-name" x="70" y="120">البحر المتوسط</text>
    <text class="sea-name" x="300" y="640" transform="rotate(52 300 640)">البحر الأحمر</text>
    <text class="sea-name" x="770" y="372" transform="rotate(22 770 372)">الخليج</text>
    <text class="sea-name" x="760" y="720">بحر العرب</text>
    <g class="compass" transform="translate(70,700)"><circle r="34"/><path d="M0 -30 L8 0 L0 30 L-8 0Z"/><text y="-38">ش</text></g>
    ${roads}${cities}${caravan}
  </svg>`;
}
