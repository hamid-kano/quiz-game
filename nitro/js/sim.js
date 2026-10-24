// ============================================================
//  محاكاة السباق (بدون رسم): فيزياء السيارات، الجدران، القفزات، النيترو،
//  الاصطدامات بين السيارات، اللفّات والترتيب، والسائق الآلي.
//  خطوة ثابتة 1/60 ثانية، فتكون النتيجة واحدة على كل الأجهزة.
// ============================================================
import { project, pointAt, HALF_ROAD } from "./tracks.js";

export const DT = 1 / 60;
const CAR_R = 1.0;           // نصف قطر السيارة للاصطدام
const WALL = HALF_ROAD - 0.85;

// السيارات: speed السرعة القصوى · accel التسارع · grip التماسك · steer سرعة الالتفاف
export const VEHICLES = {
  red: { name: "البرق الأحمر", model: "vehicle-truck-red", speed: 21, accel: 12, grip: 7.5, steer: 2.6, price: 0 },
  green: { name: "الجبلي", model: "vehicle-truck-green", speed: 21.5, accel: 14, grip: 8.5, steer: 2.75, price: 1200 },
  yellow: { name: "الصحراوي", model: "vehicle-truck-yellow", speed: 23, accel: 12.5, grip: 7.5, steer: 2.6, price: 2600 },
  purple: { name: "العاصفة", model: "vehicle-truck-purple", speed: 24, accel: 14.5, grip: 8.5, steer: 2.8, price: 4500 },
  moto: { name: "الدرّاجة النارية", model: "vehicle-motorcycle", speed: 25.5, accel: 16, grip: 7, steer: 3.05, price: 7000 }
};
export const UPGRADES = {
  engine: { name: "المحرك", icon: "⚙️", about: "سرعة قصوى أعلى", costs: [300, 700, 1300] },
  turbo: { name: "التيربو", icon: "🌀", about: "تسارع أقوى", costs: [250, 600, 1100] },
  tires: { name: "الإطارات", icon: "🛞", about: "تماسك والتفاف أفضل", costs: [250, 600, 1100] },
  nitro: { name: "النيترو", icon: "🔥", about: "نيترو أقوى وأطول", costs: [300, 700, 1300] }
};

// الخصائص النهائية بعد التطويرات (lv: {engine,turbo,tires,nitro} من 0 إلى 3)
export function statsOf(vid, lv = {}) {
  const V = VEHICLES[vid];
  return {
    speed: V.speed * (1 + 0.045 * (lv.engine || 0)),
    accel: V.accel * (1 + 0.1 * (lv.turbo || 0)),
    grip: V.grip * (1 + 0.08 * (lv.tires || 0)),
    steer: V.steer * (1 + 0.04 * (lv.tires || 0)),
    nitro: 1 + 0.15 * (lv.nitro || 0)
  };
}

export const LEVELS = {
  easy: { name: "سهل", skill: 0.84, mistakes: 0.6 },
  normal: { name: "متوسط", skill: 0.93, mistakes: 0.3 },
  hard: { name: "صعب", skill: 1.0, mistakes: 0.1 }
};

export function createRace(track, entries, opts = {}) {
  // entries: [{ vid, stats, ai: level|null, name }] · الأول في القائمة يقف في المقدّمة
  const L = track.length;
  const cars = entries.map((e, k) => {
    const row = Math.floor(k / 2), side = k % 2 ? 1 : -1;
    const p = pointAt(track, -4 - row * 4.2, side * 1.9);
    const pr = project(track, p.x, p.z);
    return {
      id: k, vid: e.vid, name: e.name, st: e.stats, ai: e.ai ? { lvl: LEVELS[e.ai], lane: side * 1.2, laneT: 0, seed: k * 97 + 13 } : null,
      x: p.x, z: p.z, h: Math.atan2(p.tx, p.tz), vx: 0, vz: 0, y: 0, vy: 0,
      steer: 0, fs: 0, ls: 0, nitro: 0.35, nitroOn: false, boostT: 0, drifting: false, driftDir: 0, driftT: 0,
      idx: pr.i, lastS: pr.s, lap: pr.s > L / 2 ? -1 : 0, prog: 0, place: k + 1, finished: false, finishT: 0,
      wrongT: 0, impact: 0, air: false, bestLap: Infinity, lapStart: 0, laps: [], input: { steer: 0, throttle: 0, drift: false, nitro: false }
    };
  });
  for (const c of cars) c.prog = c.lap * L + c.lastS;
  // المطبّات ومنصّات الدفع: تُوزّع على المستقيمات بشكل ثابت لكل حلبة
  const straights = track.tiles.map((t, i) => ({ t, i })).filter((o) => o.t.kind === "straight");
  const pick = (n, salt) => { const out = []; for (let k = 0; k < n && straights.length; k++) out.push(straights[(k * 7 + salt) % straights.length]); return out; };
  const tileS = (i) => track.pts[track.tiles[i].p0];
  const bumps = pick(track.def.bumps || 0, 3).map((o, k) => { const p0 = tileS(o.i); const p = pointAt(track, p0.s + 5, k % 2 ? 2.2 : -2.2); return { x: p.x, z: p.z }; });
  const pads = pick(track.def.pads || 0, 1).filter((o) => !bumps.some((b) => Math.hypot(b.x - o.t.x, b.z - o.t.z) < 6)).map((o, k) => { const p0 = tileS(o.i); const p = pointAt(track, p0.s + 5, k % 2 ? -1.8 : 1.8); return { x: p.x, z: p.z, tx: p.tx, tz: p.tz }; });
  return { track, cars, laps: opts.laps || track.def.laps, t: 0, phase: "countdown", countdown: 3.2, events: [], bumps, pads, finishedCount: 0, player: opts.player ?? cars.length - 1 };
}

const fwdOf = (h) => [Math.sin(h), Math.cos(h)];
const rightOf = (h) => [-Math.cos(h), Math.sin(h)];

export function stepRace(R) {
  R.events.length = 0;
  if (R.phase === "countdown") {
    const before = Math.ceil(R.countdown);
    R.countdown -= DT;
    if (Math.ceil(R.countdown) !== before) R.events.push({ type: "count", n: Math.max(0, Math.ceil(R.countdown)) });
    if (R.countdown <= 0) { R.phase = "race"; R.events.push({ type: "go" }); for (const c of R.cars) c.lapStart = 0; }
    // يمكن الضغط على الوقود أثناء العدّ (لا تتحرك السيارة)
    return;
  }
  R.t += DT;
  for (const c of R.cars) {
    if (c.ai && !c.finished) aiDrive(R, c);
    if (c.finished && c.id === R.player) aiDrive(R, c, true); // بعد خط النهاية يقود الكمبيوتر سيارتك
    stepCar(R, c);
  }
  collide(R);
  ranks(R);
}

function stepCar(R, c) {
  const T = R.track, st = c.st, inp = c.input, L = T.length;
  let [fx, fz] = fwdOf(c.h), [rx, rz] = rightOf(c.h);
  let fs = c.vx * fx + c.vz * fz, ls = c.vx * rx + c.vz * rz;
  // النيترو ومنصّات الدفع
  c.boostT = Math.max(0, c.boostT - DT);
  const wantNitro = inp.nitro && c.nitro > 0.02;
  c.nitroOn = wantNitro || c.boostT > 0;
  if (wantNitro && c.boostT <= 0) c.nitro = Math.max(0, c.nitro - DT * 0.42 / st.nitro);
  const top = st.speed * (c.nitroOn ? 1.38 + 0.08 * (st.nitro - 1) : 1);
  const acc = st.accel * (c.nitroOn ? 2 : 1);
  const onGround = c.y <= 0.001;
  if (onGround) {
    const thr = inp.throttle;
    if (c.nitroOn) fs += acc * DT * Math.max(0, 1 - fs / top) * 1.6;
    else if (thr > 0) fs += acc * thr * DT * Math.max(0, 1 - fs / top) * 1.6 + (fs > top ? -(fs - top) * 1.5 * DT : 0);
    else if (thr < 0) {
      if (fs > 0.5) fs -= 32 * -thr * DT;
      else fs = Math.max(-top * 0.35, fs - acc * 0.7 * -thr * DT);
    } else fs -= Math.sign(fs) * Math.min(Math.abs(fs), 5 * DT);
    fs -= fs * 0.08 * DT;
  }
  // التوجيه
  c.steer += (inp.steer - c.steer) * Math.min(1, DT * 9);
  const spd = Math.abs(fs);
  // الانزلاق (درفت): زر الدرفت مع التفاف وسرعة
  if (!c.drifting && inp.drift && Math.abs(c.steer) > 0.3 && fs > 9 && onGround) { c.drifting = true; c.driftDir = Math.sign(c.steer); c.driftT = 0; R.events.push({ type: "driftStart", id: c.id }); }
  if (c.drifting && (!inp.drift || fs < 6)) {
    c.drifting = false;
    // درفت طويل = دفعة صغيرة عند الخروج
    if (c.driftT > 1.1) { c.boostT = Math.max(c.boostT, Math.min(1.2, c.driftT * 0.45)); R.events.push({ type: "miniBoost", id: c.id }); }
  }
  if (c.drifting) { c.driftT += DT; c.nitro = Math.min(1, c.nitro + DT * 0.2); }
  if (onGround) {
    const grip = Math.min(1, spd / 5) * (1 - 0.15 * Math.min(1, spd / top));
    let rate = st.steer * grip;
    let s = c.steer;
    if (c.drifting) s = c.driftDir * (0.65 + 0.55 * Math.max(0, c.steer * c.driftDir)) + (c.steer - c.driftDir) * 0.25;
    if (c.drifting) rate *= 1.3;
    c.h -= s * rate * Math.sign(fs || 1) * DT;
  }
  // التماسك الجانبي: يقلّ أثناء الدرفت فتنزلق السيارة
  const g = c.drifting ? 2.2 : onGround ? st.grip : 0.4;
  ls *= Math.exp(-g * DT);
  [fx, fz] = fwdOf(c.h); [rx, rz] = rightOf(c.h);
  c.vx = fx * fs + rx * ls; c.vz = fz * fs + rz * ls;
  c.fs = fs; c.ls = ls;
  c.x += c.vx * DT; c.z += c.vz * DT;
  // القفز
  if (!onGround || c.vy > 0) {
    c.y += c.vy * DT; c.vy -= 28 * DT;
    if (c.y <= 0) { if (c.vy < -6) R.events.push({ type: "land", id: c.id, v: -c.vy }); c.y = 0; c.vy = 0; }
  }
  c.air = c.y > 0.05;
  if (!c.air) for (const b of R.bumps) if (Math.hypot(b.x - c.x, b.z - c.z) < 1.7 && fs > 5) { c.vy = 4 + fs * 0.22; c.y = 0.01; R.events.push({ type: "jump", id: c.id }); }
  for (const p of R.pads) if (Math.hypot(p.x - c.x, p.z - c.z) < 1.9 && c.boostT < 0.9) { c.boostT = 1.4; R.events.push({ type: "pad", id: c.id }); }
  // الجدران
  const pr = project(T, c.x, c.z, c.idx);
  c.idx = pr.i;
  c.impact = 0;
  if (Math.abs(pr.off) > WALL) {
    const sg = Math.sign(pr.off), ex = pr.off - sg * WALL;
    c.x -= pr.nx * ex; c.z -= pr.nz * ex;
    const vn = c.vx * pr.nx + c.vz * pr.nz;
    if (vn * sg > 0) {
      c.vx -= pr.nx * vn * 1.35; c.vz -= pr.nz * vn * 1.35;
      const keep = 1 - Math.min(0.35, Math.abs(vn) * 0.03);
      c.vx *= keep; c.vz *= keep;
      if (Math.abs(vn) > 2.5) { c.impact = Math.abs(vn); R.events.push({ type: "wall", id: c.id, v: Math.abs(vn), x: c.x, z: c.z }); }
      // تعديل الاتجاه قليلاً بموازاة الحاجز
      const ta = Math.atan2(pr.tx, pr.tz);
      let d = ta - c.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) < 1.7) c.h += d * 0.45;
    }
  }
  // التقدّم واللفّات
  let ds = pr.s - c.lastS;
  if (ds < -L / 2) { c.lap++; onLap(R, c); }
  else if (ds > L / 2) c.lap--;
  c.lastS = pr.s;
  c.prog = c.lap * L + pr.s;
  // الاتجاه المعاكس
  const dot = fx * pr.tx + fz * pr.tz;
  c.wrongT = dot < -0.35 && spd > 2 ? c.wrongT + DT : 0;
}

function onLap(R, c) {
  if (c.finished || R.phase !== "race") return;
  if (c.lap >= 1) {
    const lt = R.t - c.lapStart;
    c.laps.push(lt); c.bestLap = Math.min(c.bestLap, lt);
  }
  c.lapStart = R.t;
  if (c.lap >= R.laps) {
    c.finished = true; c.finishT = R.t; R.finishedCount++;
    c.place = R.finishedCount;
    R.events.push({ type: "finish", id: c.id, place: c.place, t: R.t });
    if (c.id === R.player) R.events.push({ type: "playerFinish", place: c.place });
  } else if (c.lap >= 1) R.events.push({ type: "lap", id: c.id, lap: c.lap + 1 });
}

function ranks(R) {
  const live = R.cars.filter((c) => !c.finished).sort((a, b) => b.prog - a.prog);
  live.forEach((c, k) => (c.place = R.finishedCount + k + 1));
  // ينتهي السباق بعد وصول اللاعب ثم مهلة قصيرة، أو بعد وصول الجميع
  if (R.phase === "race" && R.cars[R.player].finished) {
    R.endT = R.endT ?? R.t + 4;
    if (R.t >= R.endT || R.finishedCount === R.cars.length) {
      R.phase = "done";
      // من لم يصل يُرتّب حسب تقدّمه
      R.events.push({ type: "done" });
    }
  }
}

function collide(R) {
  const C = R.cars;
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
    const a = C[i], b = C[j];
    if (Math.abs(a.y - b.y) > 1) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d >= CAR_R * 2 || d < 1e-4) continue;
    const nx = dx / d, nz = dz / d, push = (CAR_R * 2 - d) / 2;
    a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
    const va = a.vx * nx + a.vz * nz, vb = b.vx * nx + b.vz * nz;
    if (va - vb > 0) {
      const ex = (va - vb) * 0.75;
      a.vx -= nx * ex; a.vz -= nz * ex; b.vx += nx * ex; b.vz += nz * ex;
      if (va - vb > 3) R.events.push({ type: "bump", a: a.id, b: b.id, v: va - vb, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    }
  }
}

// ---------------- السائق الآلي ----------------
function rnd(c) { c.ai.seed = (c.ai.seed * 16807) % 2147483647; return c.ai.seed / 2147483647; }

function aiDrive(R, c, cruise = false) {
  const T = R.track, inp = c.input, lvl = cruise ? LEVELS.normal : c.ai.lvl;
  const P = T.pts, n = P.length;
  // تغيير المسار الجانبي من حين لآخر (لتبدو القيادة طبيعية وللتجاوز)
  c.ai.laneT -= DT;
  if (c.ai.laneT <= 0) { c.ai.laneT = 2 + rnd(c) * 3; c.ai.lane = (rnd(c) - 0.5) * 3.2; }
  const spd = Math.max(0, c.fs);
  const look = 5 + spd * 0.42;
  const s0 = P[c.idx].s;
  // أقصى انحناء قادم يحدد السرعة المناسبة
  let curve = 0;
  const span = Math.ceil((8 + spd * 1.1) / 0.5);
  for (let k = 2; k < span; k++) curve = Math.max(curve, P[(c.idx + k) % n].curve);
  const corner = Math.min(1, curve / 0.38);
  // في المنعطفات يقطع نحو الداخل
  const tgt = pointAt(T, s0 + look, c.ai.lane * (1 - corner));
  const desired = Math.atan2(tgt.x - c.x, tgt.z - c.z);
  let d = desired - c.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  inp.steer = Math.max(-1, Math.min(1, -d * 2.6));
  // سرعة الهدف + توازن بسيط مع اللاعب (يبقي السباق متقارباً)
  const me = R.cars[R.player];
  let band = 1;
  if (!cruise && !me.finished) { const gap = c.prog - me.prog; band = gap > 25 ? 0.93 : gap < -25 ? 1.05 : 1; }
  const top = c.st.speed * lvl.skill * band;
  const vt = top * (1 - corner * 0.33);
  inp.throttle = spd < vt ? 1 : spd > vt + 2.5 ? -0.6 : 0;
  // خطأ عشوائي نادر: يتأخر في الالتفاف
  if (!cruise && rnd(c) < lvl.mistakes * 0.004) c.ai.laneT = 0;
  // نيترو على المستقيمات الطويلة
  inp.nitro = !cruise && c.nitro > 0.4 && corner < 0.05 && Math.abs(d) < 0.15 && rnd(c) < 0.03 ? true : inp.nitro && c.nitro > 0.05 && corner < 0.2;
  inp.drift = false;
  // شحن النيترو ببطء للسائق الآلي (بدل الدرفت)
  c.nitro = Math.min(1, c.nitro + DT * 0.025 * lvl.skill);
  if (c.wrongT > 1) inp.steer = 1;
}

export const placeName = (p) => ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"][p - 1] || `${p}`;
