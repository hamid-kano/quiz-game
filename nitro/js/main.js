// ============================================================
//  نيترو: الشاشات (الرئيسية، البطولة، سباق سريع، الكراج، الإعدادات)، حلقة السباق،
//  التحكم باللمس والإمالة ولوحة المفاتيح، شاشة السباق، النتائج، والحفظ.
// ============================================================
import { TRACKS, buildTrack } from "./tracks.js";
import { createRace, stepRace, DT, VEHICLES, UPGRADES, LEVELS, statsOf, placeName } from "./sim.js";
import { loadAssets, createRenderer, resize, createRaceView, createShowroom, THEMES } from "./view.js";
import * as A from "./audio.js";

const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const KEY = "nitro-v1-";
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} }
};
const fmt = (t) => { if (!Number.isFinite(t)) return "--:--"; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? "0" : ""}${s.toFixed(2)}`; };
const isTest = /[?&]test\b/.test(location.search);

// ---------------- الحالة المحفوظة ----------------
const P = {
  coins: store.get("coins", 0),
  owned: store.get("owned", ["red"]),
  car: store.get("car", "red"),
  up: store.get("up", {}),               // up[vid] = {engine, turbo, tires, nitro}
  stars: store.get("stars", {}),         // stars[trackId]
  best: store.get("best", {}),           // أفضل زمن للسباق كاملاً
  settings: store.get("settings", { sound: true, controls: "buttons", quality: "medium" })
};
const save = () => { for (const k of ["coins", "owned", "car", "up", "stars", "best", "settings"]) store.set(k, P[k]); };
const upOf = (vid) => P.up[vid] || (P.up[vid] = { engine: 0, turbo: 0, tires: 0, nitro: 0 });
A.setSound(P.settings.sound);

// ---------------- العرض ثلاثي الأبعاد ----------------
const canvas = $("#gl");
let renderer = null, assets = null, showroom = null, G = null; // G: السباق الحالي
let last = performance.now();

function modal(html, cls = "") { const m = $("#modal"); m.innerHTML = `<div class="sheet ${cls}">${html}</div>`; m.hidden = false; }
const closeModal = () => { $("#modal").hidden = true; $("#modal").innerHTML = ""; };
function toast(t) {
  const box = $("#toast");
  while (box.children.length > 1) box.firstChild.remove();
  const el = document.createElement("div"); el.className = "t"; el.textContent = t; box.appendChild(el);
  setTimeout(() => el.classList.add("out"), 1800); setTimeout(() => el.remove(), 2300);
}
const gesture = () => A.initAudio();
document.addEventListener("pointerdown", gesture, { passive: true });

// ---------------- التحميل ----------------
async function boot() {
  $("#app").innerHTML = `<main class="loading"><h1 class="logo">نيترو<span>NITRO</span></h1><div class="bar"><i id="lb"></i></div><p>جارٍ تحميل الحلبات والسيارات…</p></main>`;
  try {
    renderer = createRenderer(canvas, P.settings.quality);
    assets = await loadAssets((k) => { const b = $("#lb"); if (b) b.style.width = `${k * 100}%`; });
  } catch (e) {
    $("#app").innerHTML = `<main class="loading"><h1 class="logo">نيترو</h1><p>تعذّر تشغيل الرسوم ثلاثية الأبعاد على هذا الجهاز.<br><small>${String(e.message || e)}</small></p></main>`;
    return;
  }
  showroom = createShowroom(renderer, assets);
  showroom.setCar(P.car);
  window.addEventListener("resize", onResize);
  onResize();
  requestAnimationFrame(frame);
  home();
}
function onResize() {
  if (!renderer) return;
  resize(renderer, G ? G.view.camera : showroom.camera, P.settings.quality);
  if (G) resize(renderer, G.view.camera, P.settings.quality); else resize(renderer, showroom.camera, P.settings.quality);
}

// ---------------- الشاشة الرئيسية ----------------
function totalStars() { return Object.values(P.stars).reduce((a, b) => a + b, 0); }
function coinsBadge() { return `<span class="coins" id="coins">🪙 ${P.coins}</span>`; }
function home() {
  endRace();
  showroom.setCar(P.car);
  $("#app").innerHTML = `
    <main class="home">
      <header class="top">${coinsBadge()}<span class="stars">⭐ ${totalStars()} / ${TRACKS.length * 3}</span></header>
      <h1 class="logo">نيترو<span>NITRO</span></h1>
      <div class="menu">
        <button class="btn big" id="cup">🏆 البطولة</button>
        <button class="btn" id="quick">🏁 سباق سريع</button>
        <button class="btn alt" id="garage">🔧 الكراج</button>
        <div class="row"><button class="btn ghost" id="help">📖 كيف ألعب؟</button><button class="btn ghost" id="settings">⚙️ الإعدادات</button></div>
      </div>
      <p class="foot">${VEHICLES[P.car].name} · تعمل بدون إنترنت</p>
    </main>`;
  $("#cup").onclick = championship;
  $("#quick").onclick = quickRace;
  $("#garage").onclick = garage;
  $("#help").onclick = () => help();
  $("#settings").onclick = settings;
}

function help(after = closeModal) {
  modal(`
    <h2>📖 كيف ألعب؟</h2>
    <div class="help">
      <p><b>🏁 الهدف:</b> أنهِ اللفّات قبل منافسيك. المراكز الثلاثة الأولى تفتح الحلبة التالية وتعطيك نجوماً وعملات.</p>
      <p><b>🎮 التحكم:</b> السيارة تتسارع وحدها. ◀ ▶ للالتفاف، وزر <b>الفرامل</b> للتوقف.</p>
      <p><b>💨 الدرفت:</b> اضغط الفرامل <b>وأنت تلتفّ</b> بسرعة فتنزلق السيارة. الدرفت يملأ عدّاد النيترو، والدرفت الطويل يعطيك دفعة عند الخروج منه (شرارات زرقاء).</p>
      <p><b>🔥 النيترو:</b> اضغط زر النيترو حين يمتلئ العدّاد لسرعة هائلة. والأسهم البرتقالية على الطريق تعطيك دفعة مجانية.</p>
      <p><b>🦘 القفزات:</b> المطبّات الدائرية تقذف سيارتك في الهواء.</p>
      <p><b>🔧 الكراج:</b> اشترِ سيارات أسرع وطوّر المحرك والتيربو والإطارات والنيترو بالعملات.</p>
      <p><b>⌨️ على الكمبيوتر:</b> الأسهم أو WASD للقيادة، المسافة للدرفت، وShift للنيترو، وEsc للإيقاف.</p>
    </div>
    <button class="btn block" id="ok">فهمت 👍</button>`);
  $("#ok").onclick = after;
}

function settings() {
  const S = P.settings;
  const seg = (name, opts) => `<div class="seg" data-name="${name}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(S[name]) === String(v) ? "on" : ""}">${t}</button>`).join("")}</div>`;
  modal(`
    <h2>⚙️ الإعدادات</h2>
    <div class="form">
      <label>الصوت</label>${seg("sound", [[true, "🔊 يعمل"], [false, "🔇 مطفأ"]])}
      <label>التحكم بالالتفاف</label>${seg("controls", [["buttons", "◀ ▶ أزرار"], ["tilt", "📱 إمالة الجوال"]])}
      <label>جودة الرسوم <small>اختر «منخفضة» إن كانت اللعبة بطيئة على جهازك</small></label>${seg("quality", [["low", "منخفضة"], ["medium", "متوسطة"], ["high", "عالية"]])}
    </div>
    <button class="btn block" id="ok">تم</button>`);
  $$("#modal .seg").forEach((g) => g.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    g.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    const v = b.dataset.v, name = g.dataset.name;
    S[name] = v === "true" ? true : v === "false" ? false : v;
    if (name === "sound") A.setSound(S.sound);
    if (name === "controls" && v === "tilt") askTilt();
    save();
  })));
  $("#ok").onclick = () => { closeModal(); if (renderer && renderer.__q !== S.quality) location.reload(); };
  if (renderer) renderer.__q = renderer.__q || S.quality;
}
async function askTilt() {
  try { if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission(); } catch {}
}

// ---------------- البطولة ----------------
const cupLevel = (i) => (i < 3 ? "easy" : i < 6 ? "normal" : "hard");
const unlocked = (i) => i === 0 || (P.stars[TRACKS[i - 1].id] || 0) > 0;
function championship() {
  $("#app").innerHTML = `
    <main class="screen">
      <div class="top"><button class="icon" id="back">→</button><h2>🏆 البطولة</h2>${coinsBadge()}</div>
      <div class="tracks">${TRACKS.map((t, i) => {
        const open = unlocked(i), st = P.stars[t.id] || 0;
        return `<button class="trk ${open ? "" : "locked"} th-${t.theme}" data-i="${i}" ${open ? "" : "disabled"}>
          <canvas class="mapc" width="120" height="90" data-i="${i}"></canvas>
          <span class="nm"><b>${open ? i + 1 + ". " : "🔒 "}${t.name}</b><small>${THEMES[t.theme].name} · ${t.laps} لفّات · ${LEVELS[cupLevel(i)].name}</small></span>
          <span class="st">${"★".repeat(st)}<em>${"★".repeat(3 - st)}</em>${P.best[t.id] ? `<small>⏱ ${fmt(P.best[t.id])}</small>` : `<small>🪙 ${t.coins}</small>`}</span>
        </button>`;
      }).join("")}</div>
    </main>`;
  $("#back").onclick = home;
  $$(".trk").forEach((b) => (b.onclick = () => startRace({ track: +b.dataset.i, level: cupLevel(+b.dataset.i), cup: true })));
  $$(".mapc").forEach((c) => drawMap(c, buildTrack(TRACKS[+c.dataset.i])));
}
function drawMap(cv, T, cars = null, me = -1) {
  const g = cv.getContext("2d"), W = cv.width, H = cv.height, b = T.bounds;
  const sc = Math.min((W - 16) / (b.maxX - b.minX), (H - 16) / (b.maxZ - b.minZ));
  const ox = (W - (b.maxX - b.minX) * sc) / 2 - b.minX * sc, oz = (H - (b.maxZ - b.minZ) * sc) / 2 - b.minZ * sc;
  if (!cars || !cv.__bg) {
    const bg = document.createElement("canvas"); bg.width = W; bg.height = H;
    const c = bg.getContext("2d");
    c.lineJoin = c.lineCap = "round";
    c.beginPath(); T.pts.forEach((p, i) => (i ? c.lineTo(p.x * sc + ox, p.z * sc + oz) : c.moveTo(p.x * sc + ox, p.z * sc + oz))); c.closePath();
    c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = Math.max(5, 8.3 * sc + 3); c.stroke();
    c.strokeStyle = "#e9edf5"; c.lineWidth = Math.max(3, 8.3 * sc); c.stroke();
    const s = T.pts[0]; c.fillStyle = "#ff4d4d"; c.fillRect(s.x * sc + ox - 4, s.z * sc + oz - 4, 8, 8);
    cv.__bg = bg;
  }
  g.clearRect(0, 0, W, H); g.drawImage(cv.__bg, 0, 0);
  if (cars) for (const c of [...cars].sort((a, b2) => (a.id === me) - (b2.id === me))) {
    g.fillStyle = c.id === me ? "#ffd84a" : "#ff5a4f"; g.strokeStyle = "#000"; g.lineWidth = 1.5;
    g.beginPath(); g.arc(c.x * sc + ox, c.z * sc + oz, c.id === me ? 5 : 4, 0, 7); g.fill(); g.stroke();
  }
}

// ---------------- سباق سريع ----------------
function quickRace() {
  const cfg = store.get("quick", { track: 0, level: "normal" });
  if (!unlocked(cfg.track)) cfg.track = 0;
  $("#app").innerHTML = `
    <main class="screen">
      <div class="top"><button class="icon" id="back">→</button><h2>🏁 سباق سريع</h2>${coinsBadge()}</div>
      <div class="form">
        <label>الحلبة <small>تُفتح الحلبات من البطولة</small></label>
        <div class="tgrid">${TRACKS.map((t, i) => `<button data-t="${i}" class="${cfg.track === i ? "on" : ""}" ${unlocked(i) ? "" : "disabled"}>${unlocked(i) ? t.name : "🔒"}</button>`).join("")}</div>
        <label>المنافسون</label>
        <div class="seg">${Object.entries(LEVELS).map(([k, v]) => `<button data-l="${k}" class="${cfg.level === k ? "on" : ""}">${v.name}</button>`).join("")}</div>
        <button class="btn big block" id="go">🏁 انطلق</button>
      </div>
    </main>`;
  $("#back").onclick = home;
  $$("[data-t]").forEach((b) => (b.onclick = () => { cfg.track = +b.dataset.t; $$("[data-t]").forEach((x) => x.classList.toggle("on", x === b)); }));
  $$("[data-l]").forEach((b) => (b.onclick = () => { cfg.level = b.dataset.l; $$("[data-l]").forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#go").onclick = () => { store.set("quick", cfg); startRace({ track: cfg.track, level: cfg.level, cup: false }); };
}

// ---------------- الكراج ----------------
function garage() {
  const ids = Object.keys(VEHICLES);
  let k = Math.max(0, ids.indexOf(P.car));
  const bars = (vid) => {
    const s = statsOf(vid, upOf(vid)), base = statsOf("red");
    const row = (n, v, max) => `<div class="sb"><span>${n}</span><i><b style="width:${Math.min(100, (v / max) * 100)}%"></b></i></div>`;
    return row("السرعة", s.speed, 30) + row("التسارع", s.accel, 22) + row("التحكم", s.grip * s.steer, 12 * 3.4) + row("النيترو", s.nitro, 1.5) + (base ? "" : "");
  };
  const draw = () => {
    const vid = ids[k], V = VEHICLES[vid], own = P.owned.includes(vid), lv = upOf(vid);
    showroom.setCar(vid);
    $("#app").innerHTML = `
      <main class="garage">
        <div class="top"><button class="icon" id="back">→</button><h2>🔧 الكراج</h2>${coinsBadge()}</div>
        <div class="gnav"><button class="icon" id="prev">▶</button><div class="gname"><b>${V.name}</b><small>${own ? (P.car === vid ? "✅ سيارتك الحالية" : "تملكها") : `🪙 ${V.price}`}</small></div><button class="icon" id="next">◀</button></div>
        <div class="gpanel">
          <div class="stats">${bars(vid)}</div>
          ${own ? `<div class="ups">${Object.entries(UPGRADES).map(([u, U]) => {
            const l = lv[u] || 0, cost = U.costs[l];
            return `<button class="up" data-u="${u}" ${l >= 3 ? "disabled" : ""}><span class="ui">${U.icon}</span><span class="un"><b>${U.name}</b><small>${U.about}</small></span><span class="dots">${[0, 1, 2].map((d) => `<i class="${d < l ? "on" : ""}"></i>`).join("")}</span><span class="uc">${l >= 3 ? "الأقصى" : `🪙 ${cost}`}</span></button>`;
          }).join("")}</div>` : ""}
          ${own ? (P.car === vid ? "" : `<button class="btn block" id="use">اختر هذه السيارة</button>`) : `<button class="btn block ${P.coins < V.price ? "poor" : ""}" id="buy">اشترِ بـ 🪙 ${V.price}</button>`}
        </div>
      </main>`;
    $("#back").onclick = home;
    $("#prev").onclick = () => { k = (k - 1 + ids.length) % ids.length; draw(); };
    $("#next").onclick = () => { k = (k + 1) % ids.length; draw(); };
    if ($("#use")) $("#use").onclick = () => { P.car = vid; save(); A.jingle([660, 880]); draw(); };
    if ($("#buy")) $("#buy").onclick = () => {
      if (P.coins < V.price) { toast(`تحتاج ${V.price - P.coins} عملة أخرى. اربح السباقات!`); return; }
      P.coins -= V.price; P.owned.push(vid); P.car = vid; save(); A.jingle([523, 659, 784, 1047]); toast(`🎉 صارت ${V.name} لك!`); draw();
    };
    $$(".up").forEach((b) => (b.onclick = () => {
      const u = b.dataset.u, l = lv[u] || 0, cost = UPGRADES[u].costs[l];
      if (l >= 3) return;
      if (P.coins < cost) { toast(`تحتاج ${cost - P.coins} عملة أخرى`); return; }
      P.coins -= cost; lv[u] = l + 1; save(); A.jingle([660, 990]); toast(`${UPGRADES[u].icon} تطوير ${UPGRADES[u].name} إلى المستوى ${l + 1}`); draw();
    }));
  };
  draw();
}

// ---------------- السباق ----------------
const NAMES = ["سامر", "ليلى", "كرم", "نور", "زيد", "ريم"];
function opponents(level, trackIdx) {
  const ids = Object.keys(VEHICLES).filter((v) => v !== P.car);
  // منافسون أقوى في الحلبات المتقدمة
  const tier = Math.min(3, Math.floor(trackIdx / 2));
  const lvl = level === "easy" ? 0 : level === "normal" ? 1 : 2;
  return [0, 1, 2].map((k) => {
    const vid = ids[(k + trackIdx) % ids.length];
    const u = Math.min(3, Math.max(0, tier + lvl - 1));
    return { vid, stats: statsOf(vid, { engine: u, turbo: u, tires: u, nitro: u }), ai: level, name: NAMES[(k + trackIdx) % NAMES.length] };
  });
}

function startRace(cfg) {
  endRace(); closeModal();
  const def = TRACKS[cfg.track], T = buildTrack(def);
  const entries = [...opponents(cfg.level, cfg.track), { vid: P.car, stats: statsOf(P.car, upOf(P.car)), ai: null, name: "أنت" }];
  const race = createRace(T, entries, { player: 3 });
  const view = createRaceView(renderer, assets, T, race, { quality: P.settings.quality });
  G = { cfg, def, T, race, view, acc: 0, paused: false, input: { left: false, right: false, brake: false, nitro: false, kUp: false }, tilt: 0, hud: {}, wrongShown: false, lastLapMsg: 0 };
  resize(renderer, view.camera, P.settings.quality);
  $("#app").innerHTML = `
    <div class="race">
      <div class="hud-l">
        <div class="pos"><b id="pos">4</b><small>/4</small></div>
        <div class="lap">لفّة <b id="lap">1/${race.laps}</b></div>
        <div class="time" id="time">0:00.00</div>
      </div>
      <div class="hud-r">
        <button class="icon pause" id="pause" aria-label="إيقاف مؤقت">⏸</button>
        <canvas id="map" width="140" height="110"></canvas>
      </div>
      <div class="center"><div class="count" id="count"></div><div class="msg" id="msg"></div></div>
      <div class="speedo"><b id="spd">0</b><small>كم/س</small></div>
      <div class="ctl ctl-steer ${P.settings.controls === "tilt" ? "tilt" : ""}">
        <button class="pad" id="left" aria-label="يسار">◀</button>
        <button class="pad" id="right" aria-label="يمين">▶</button>
      </div>
      <div class="ctl ctl-act">
        <button class="pad brake" id="brake" aria-label="فرامل ودرفت"><span>🛑</span><small>فرامل<br>درفت</small></button>
        <button class="pad nitro" id="nitro" aria-label="نيترو"><i id="nfill"></i><span>🔥</span><small>نيترو</small></button>
      </div>
    </div>`;
  bindRaceInput();
  $("#pause").onclick = pause;
  A.startEngine(P.car === "moto");
  drawMap($("#map"), T);
}

function endRace() {
  if (!G) return;
  A.stopEngine();
  G.view.dispose();
  G = null;
  if (showroom) resize(renderer, showroom.camera, P.settings.quality);
}

function bindRaceInput() {
  const hold = (id, key) => {
    const el = $("#" + id);
    const on = (e) => { e.preventDefault(); G.input[key] = true; el.classList.add("on"); };
    const off = (e) => { e.preventDefault(); if (G) G.input[key] = false; el.classList.remove("on"); };
    el.addEventListener("pointerdown", (e) => { el.setPointerCapture?.(e.pointerId); on(e); });
    el.addEventListener("pointerup", off); el.addEventListener("pointercancel", off); el.addEventListener("lostpointercapture", off);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  };
  hold("left", "left"); hold("right", "right"); hold("brake", "brake"); hold("nitro", "nitro");
}
const KEYS = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowDown: "brake", KeyS: "brake", Space: "drift", ShiftLeft: "nitro", ShiftRight: "nitro", KeyN: "nitro", ArrowUp: "kUp", KeyW: "kUp" };
window.addEventListener("keydown", (e) => {
  if (!G) return;
  if (e.code === "Escape" || e.code === "KeyP") { G.paused ? resume() : pause(); return; }
  const k = KEYS[e.code]; if (!k) return;
  e.preventDefault();
  if (k === "drift") { G.input.brake = true; G.input.driftKey = true; } else G.input[k] = true;
});
window.addEventListener("keyup", (e) => {
  if (!G) return;
  const k = KEYS[e.code]; if (!k) return;
  if (k === "drift") { G.input.brake = false; G.input.driftKey = false; } else G.input[k] = false;
});
window.addEventListener("deviceorientation", (e) => {
  if (!G || P.settings.controls !== "tilt") return;
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  let v = ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma;
  G.tilt = Math.max(-1, Math.min(1, (v || 0) / 22));
});

function playerInput() {
  const i = G.input, me = G.race.cars[G.race.player];
  let steer = (i.right ? 1 : 0) - (i.left ? 1 : 0);
  if (P.settings.controls === "tilt" && !i.left && !i.right) steer = Math.abs(G.tilt) < 0.08 ? 0 : G.tilt;
  const turning = Math.abs(steer) > 0.25;
  me.input.steer = steer;
  me.input.drift = i.brake && (turning || me.drifting);
  me.input.throttle = i.brake && !turning && !me.drifting ? -1 : 1;
  me.input.nitro = i.nitro;
}

// ---------------- الحلقة ----------------
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G) {
    if (!G.paused && G.race.phase !== "done") {
      G.acc += dt * (G.speed || 1);
      let n = 0;
      while (G.acc >= DT && n++ < 8 * (G.speed || 1)) {
        for (const c of G.race.cars) { c.px = c.x; c.pz = c.z; c.ph = c.h; }
        if (!G.race.cars[G.race.player].finished && !G.auto) playerInput();
        stepRace(G.race);
        for (const e of G.race.events) onRaceEvent(e);
        G.acc -= DT;
        if (!G) return requestAnimationFrame(frame);
      }
      if (G.acc > DT) G.acc = 0;
    }
    if (G) { G.view.update(now, G.paused ? 1 : Math.min(1, G.acc / DT), G.paused ? 0 : dt); hud(); }
  } else if (showroom) {
    const land = innerWidth > innerHeight, gar = !!document.querySelector(".garage");
    showroom.render(dt, now, gar && !land ? 0.9 : 0, land ? (gar ? 0.24 : 0.1) : 0);
  }
  requestAnimationFrame(frame);
}

function onRaceEvent(e) {
  const R = G.race, me = R.player;
  G.view.onEvent(e);
  if (e.type === "count") { if (e.n > 0) { showCount(e.n); A.beep(440, 0.2); } }
  else if (e.type === "go") { showCount("انطلق!"); A.beep(880, 0.45); }
  else if (e.type === "wall" && e.id === me) { A.impact(e.v); if (e.v > 6) navigator.vibrate?.(30); }
  else if (e.type === "bump" && (e.a === me || e.b === me)) A.impact(e.v * 0.7);
  else if (e.type === "pad" && e.id === me) { A.whoosh(); msg("💨 دفعة!"); }
  else if (e.type === "miniBoost" && e.id === me) { A.whoosh(); msg("⚡ درفت ممتاز!"); }
  else if (e.type === "jump" && e.id === me) A.beep(300, 0.1, "sine", 0.08);
  else if (e.type === "land" && e.id === me) A.impact(e.v * 0.4);
  else if (e.type === "lap" && e.id === me) { const last = e.lap === R.laps; msg(last ? "🏁 اللفّة الأخيرة!" : `لفّة ${e.lap}`); A.jingle(last ? [660, 880, 1100] : [660, 880]); }
  else if (e.type === "playerFinish") { A.muteEngine(); A.jingle(e.place === 1 ? [523, 659, 784, 1047, 1319] : e.place <= 3 ? [523, 659, 784] : [392, 330, 262]); msg(e.place === 1 ? "🏆 المركز الأول!" : `وصلت ${placeName(e.place)}`); }
  else if (e.type === "done") setTimeout(results, 600);
}
let msgT = 0;
function msg(t) { const m = $("#msg"); if (!m) return; m.textContent = t; m.classList.remove("show"); void m.offsetWidth; m.classList.add("show"); clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove("show"), 1600); }
function showCount(t) { const c = $("#count"); if (!c) return; c.textContent = t; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); }

function hud() {
  const R = G.race, me = R.cars[R.player], H = G.hud;
  const set = (id, v) => { if (H[id] !== v) { H[id] = v; const el = $("#" + id); if (el) el.textContent = v; } };
  set("pos", String(me.place));
  set("lap", `${Math.min(R.laps, Math.max(1, me.lap + 1))}/${R.laps}`);
  set("time", fmt(me.finished ? me.finishT : R.t));
  set("spd", String(Math.round(Math.max(0, me.fs) * 9)));
  const nf = $("#nfill"); if (nf) nf.style.height = `${me.nitro * 100}%`;
  $("#nitro")?.classList.toggle("ready", me.nitro > 0.25);
  const wrong = me.wrongT > 1.2 && !me.finished;
  if (wrong !== G.wrongShown) { G.wrongShown = wrong; if (wrong) msg("⛔ الاتجاه خاطئ! استدر"); }
  G.mapT = (G.mapT || 0) + 1;
  if (G.mapT % 3 === 0) drawMap($("#map"), G.T, R.cars, R.player);
  A.updateEngine(Math.max(0, me.fs) / me.st.speed, me.input.throttle > 0 ? 1 : 0, me.drifting ? 1 : Math.min(1, Math.abs(me.ls) / 6), me.nitroOn);
}

function pause() {
  if (!G || G.race.phase === "done") return;
  G.paused = true; A.muteEngine();
  modal(`
    <h2>⏸ استراحة</h2>
    <div class="col">
      <button class="btn block" id="resume">▶ تابع السباق</button>
      <button class="btn block alt" id="restart">🔄 أعد السباق</button>
      <button class="btn block ghost" id="helpP">📖 كيف ألعب؟</button>
      <button class="btn block ghost" id="soundP">${P.settings.sound ? "🔊 الصوت يعمل" : "🔇 الصوت مطفأ"}</button>
      <button class="btn block ghost" id="quit">🏳️ انسحب إلى القائمة</button>
    </div>`);
  $("#resume").onclick = resume;
  $("#restart").onclick = () => startRace(G.cfg);
  $("#helpP").onclick = () => help(pause);
  $("#soundP").onclick = () => { P.settings.sound = !P.settings.sound; A.setSound(P.settings.sound); save(); pause(); };
  $("#quit").onclick = () => { closeModal(); G.cfg.cup ? (endRace(), championship()) : home(); };
}
function resume() { closeModal(); if (G) { G.paused = false; last = performance.now(); } }
document.addEventListener("visibilitychange", () => { if (document.hidden && G && !G.paused && G.race.phase !== "done") pause(); });

function results() {
  if (!G) return;
  const { race: R, def, cfg } = G;
  const me = R.cars[R.player];
  const order = [...R.cars].sort((a, b) => (a.finished && b.finished ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.prog - a.prog));
  order.forEach((c, k) => (c.place = k + 1));
  const place = me.place;
  const mult = [1, 0.6, 0.35, 0.15][place - 1] * (cfg.cup ? 1 : 0.6);
  const earned = Math.round(def.coins * mult / 10) * 10;
  const stars = place <= 3 ? 4 - place : 0;
  let newBest = false;
  P.coins += earned;
  if (cfg.cup && stars > (P.stars[def.id] || 0)) P.stars[def.id] = stars;
  if (me.finished && place === 1 && (!P.best[def.id] || me.finishT < P.best[def.id])) { P.best[def.id] = me.finishT; newBest = true; }
  save();
  const next = cfg.cup && stars > 0 && cfg.track < TRACKS.length - 1;
  modal(`
    <div class="res-icon">${place === 1 ? "🏆" : place <= 3 ? "🥈🥉".slice((place - 2) * 2, (place - 2) * 2 + 2) : "🏁"}</div>
    <h2>${place === 1 ? "فزت بالمركز الأول!" : `المركز ${placeName(place)}`}</h2>
    ${cfg.cup ? `<div class="bigstars">${"★".repeat(stars)}<em>${"★".repeat(3 - stars)}</em></div>` : ""}
    <ol class="standings">${order.map((c) => `<li class="${c.id === R.player ? "me" : ""}"><b>${c.place}</b><span>${c.name}</span><small>${VEHICLES[c.vid].name}</small><em>${c.finished ? fmt(c.finishT) : "—"}</em></li>`).join("")}</ol>
    <div class="sgrid">
      <div><b>🪙 +${earned}</b><small>العملات</small></div>
      <div><b>${fmt(me.bestLap)}</b><small>أسرع لفّة${newBest ? " · 🎉 رقم جديد" : ""}</small></div>
    </div>
    ${cfg.cup && !stars ? `<p class="par">احتلّ أحد المراكز الثلاثة الأولى لتفتح الحلبة التالية. طوّر سيارتك في الكراج!</p>` : ""}
    <div class="col">
      ${next ? `<button class="btn block" id="next">الحلبة التالية ⬅</button>` : ""}
      <button class="btn block ${next ? "alt" : ""}" id="again">🔄 أعد السباق</button>
      <button class="btn block ghost" id="garageR">🔧 الكراج</button>
      <button class="btn block ghost" id="menu">القائمة</button>
    </div>`, "result");
  if ($("#next")) $("#next").onclick = () => startRace({ ...cfg, track: cfg.track + 1, level: cupLevel(cfg.track + 1) });
  $("#again").onclick = () => startRace(cfg);
  $("#garageR").onclick = () => { closeModal(); endRace(); garage(); };
  $("#menu").onclick = () => { closeModal(); endRace(); cfg.cup ? championship() : home(); };
}

$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" && !G) closeModal(); });
boot();
if ("serviceWorker" in navigator && location.protocol === "https:" && !isTest && !window.Capacitor) navigator.serviceWorker.register("sw.js").catch(() => {});
// للاختبارات الآلية فقط (?test)
if (isTest) window.__nx = {
  get G() { return G; }, P, save, startRace, home, garage, championship,
  autopilot() { const me = G.race.cars[G.race.player]; me.ai = { lvl: LEVELS.hard, lane: 0, laneT: 0, seed: 5 }; G.auto = true; },
  set speed(v) { if (G) G.speed = v; },
  // يشغّل المحاكاة بسرعة دون رسم (للأجهزة البطيئة في الاختبار)
  fast(sec) { for (let i = 0; i < sec / DT && G && G.race.phase !== "done"; i++) { for (const c of G.race.cars) { c.px = c.x; c.pz = c.z; c.ph = c.h; } if (!G.auto && !G.race.cars[G.race.player].finished) playerInput(); stepRace(G.race); for (const e of G.race.events) onRaceEvent(e); } if (G) G.view.snap(); },
  nan() { const bad = []; G.view.scene.traverse((o) => { const a = o.geometry?.attributes?.position; if (a) for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i])) { bad.push(o.type + ":" + (o.name || "") + ":" + a.array.length); break; } }); return bad; }
};
