// ============================================================
//  سيطرة: الشاشات، حلقة اللعب، الكاميرا واللمس، البناء والإنتاج والجيش وصلاحيات الجنرال
// ============================================================
import { createWorld, step, command, TICK, seconds, unitCount, hasBuilding, buildCost, canBuild, powerOf, MAX_UNITS, QUEUE_MAX } from "./world.js";
import { createAI, think, LEVELS as AI } from "./ai.js";
import { createView, resizeView, clampCam, screenToWorld, addEvent, render, createMinimap, renderMinimap, minZoom } from "./draw.js";
import { FACTIONS, UNITS, BUILDINGS, BUILD_ORDER, POWERS, SUPER, RANKS, RANK_NAMES, buildingName, unitsOf, builderOf, truckOf } from "./rules.js";
import { POINT_TYPES, inPoly } from "./city.js";
import { LEVELS, starsFor } from "./levels.js";
import { seedToCode, codeToSeed, randomSeed } from "./rng.js";

const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const TICK_MS = TICK * 1000;
const store = {
  get(k, d) { try { const v = localStorage.getItem("saytara3-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("saytara3-" + k, JSON.stringify(v)); } catch {} }
};
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------------- الأصوات: مولّدة بالكامل ----------------
let actx = null, noise = null;
let soundOn = store.get("sound", true);
const lastSound = {};
function audio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    noise = actx.createBuffer(1, actx.sampleRate * 0.8, actx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function burst(freq, dur, gain, q = 1) {
  if (!soundOn) return;
  try {
    const a = audio();
    const src = a.createBufferSource(); src.buffer = noise;
    const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain(), t = a.currentTime;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t); src.stop(t + dur);
  } catch {}
}
function tone(freqs, dur = 0.08, type = "triangle", gain = 0.1) {
  if (!soundOn) return;
  try {
    const a = audio();
    freqs.forEach((fr, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = fr;
      const t0 = a.currentTime + i * dur;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    });
  } catch {}
}
const limited = (k, ms, fn) => { const n = performance.now(); if (n - (lastSound[k] || 0) > ms) { lastSound[k] = n; fn(); } };
const sfx = {
  rifle: () => limited("rifle", 70, () => burst(3200, 0.07, 0.05)),
  cannon: () => limited("cannon", 120, () => burst(700, 0.25, 0.14)),
  rocket: () => limited("rocket", 120, () => burst(1600, 0.3, 0.08, 4)),
  arty: () => limited("arty", 200, () => burst(400, 0.35, 0.16)),
  boom: () => limited("boom", 120, () => burst(250, 0.7, 0.22)),
  big: () => burst(120, 1.6, 0.35),
  planes: () => burst(500, 2.2, 0.08, 2),
  select: () => tone([880], 0.04, "sine", 0.06),
  order: () => tone([520, 700], 0.05, "sine", 0.06),
  place: () => tone([330, 440], 0.06, "square", 0.05),
  ready: () => tone([660, 880], 0.06, "triangle", 0.07),
  built: () => tone([523, 784], 0.08, "triangle", 0.09),
  capture: () => tone([523, 659, 784], 0.09, "triangle", 0.1),
  rank: () => tone([523, 659, 784, 1047, 1319], 0.08, "sine", 0.1),
  alarm: () => tone([880, 660, 880, 660], 0.18, "square", 0.06),
  lost: () => tone([392, 262], 0.15, "square", 0.05),
  bad: () => tone([220], 0.12, "square", 0.05),
  win: () => tone([523, 659, 784, 1047], 0.14, "sine", 0.12),
  lose: () => tone([392, 330, 262, 196], 0.2, "triangle", 0.1)
};

// ---------------- النوافذ ----------------
function modal(html, cls = "") { const m = $("#modal"); m.innerHTML = `<div class="sheet ${cls}">${html}</div>`; m.hidden = false; }
const closeModal = () => { $("#modal").hidden = true; $("#modal").innerHTML = ""; };
function toast(t, warn = false) {
  const box = $("#toast");
  while (box.children.length > 1) box.firstChild.remove();
  const el = document.createElement("div"); el.className = "t" + (warn ? " warn" : ""); el.textContent = t;
  box.appendChild(el);
  setTimeout(() => el.classList.add("out"), 2200); setTimeout(() => el.remove(), 2700);
}

// ---------------- الشاشة الرئيسية ----------------
function home() {
  stopGame();
  const prog = store.get("progress", { stars: {}, best: {} });
  const total = Object.values(prog.stars).reduce((a, b) => a + b, 0);
  $("#app").innerHTML = `
    <main class="home">
      <div class="logo">
        <div class="emblem"><img src="icons/icon-192.png" alt=""></div>
        <h1>سيطرة</h1>
        <p>ابنِ قاعدتك · اجمع المؤن · قُد جيشك</p>
      </div>
      <div class="menu">
        <button class="btn big" id="campaign">🎖️ الحملة <small>${total} / ${LEVELS.length * 3} ⭐</small></button>
        <button class="btn big alt" id="quick">⚔️ معركة سريعة <small>اختر جيشك والخريطة والصعوبة</small></button>
        <div class="row">
          <button class="btn ghost" id="help">📖 كيف ألعب؟</button>
          <button class="btn ghost" id="sound">${soundOn ? "🔊" : "🔇"} الصوت</button>
        </div>
      </div>
      <p class="foot">تعمل بدون إنترنت · بلا إعلانات</p>
    </main>`;
  $("#campaign").onclick = campaign;
  $("#quick").onclick = quickSetup;
  $("#help").onclick = () => help();
  $("#sound").onclick = () => { soundOn = !soundOn; store.set("sound", soundOn); home(); };
}

function unitList(f) {
  return unitsOf(f).map((t) => `<li><b>${UNITS[t].icon} ${UNITS[t].name} (${UNITS[t].cost})</b>${UNITS[t].about ? `: ${UNITS[t].about}` : UNITS[t].role === "builder" ? ": تبني المباني" : ": تنقل المؤن"}</li>`).join("");
}
function help(after = closeModal) {
  modal(`
    <h2>📖 كيف ألعب؟</h2>
    <div class="help">
      <p><b>🎯 الهدف:</b> دمّر كل مباني العدو الأحمر، واحمِ قاعدتك.</p>
      <p><b>🏗️ البناء:</b> من تبويب «بناء» اختر مبنى ثم اضغط على أرض فارغة خضراء قرب قاعدتك، فتذهب الجرّافة وتبنيه. الأبراج الدفاعية تُبنى في زوايا الأراضي.</p>
      <p><b>⚡ الطاقة:</b> كل مبنى يستهلك طاقة. إن نقصت الطاقة يبطؤ الإنتاج وتتعطّل الدفاعات، فابنِ محطات طاقة.</p>
      <p><b>📦 المؤن:</b> ابنِ «مركز الإمداد» قرب مستودع الصناديق، فتنقل الشاحنات المؤن إليه تلقائياً. المصافي 🛢️ في وسط المدينة تعطي دخلاً إضافياً لمن يحتلّها بالمشاة.</p>
      <p><b>🏭 الإنتاج:</b> الثكنة تدرّب المشاة، المصنع ينتج المركبات، المطار ينتج الطائرات، ومركز الأبحاث يفتح الوحدات النخبوية والسلاح الاستراتيجي.</p>
      <p><b>👆 القيادة:</b> من تبويب «الجيش» اختر وحداتك (أو اضغط على وحدة)، ثم اضغط على المكان في الخريطة.</p>
      <p><b>⭐ الجنرال:</b> تدمير العدو يرفع رتبتك ويعطيك نقاطاً تفتح بها صلاحيات: غارة جوية، إنزال مظلي، استطلاع، إمداد طارئ، قصف مدفعي.</p>
      <p><b>🛡️ ${FACTIONS.shield.name}:</b> ${FACTIONS.shield.about}</p>
      <ul>${unitList("shield")}</ul>
      <p><b>🦅 ${FACTIONS.falcon.name}:</b> ${FACTIONS.falcon.about}</p>
      <ul>${unitList("falcon")}</ul>
      <p><b>🗺️ الكاميرا:</b> اسحب بإصبع لتحريك الخريطة، وبإصبعين للتقريب، واضغط على الخريطة المصغّرة للانتقال.</p>
    </div>
    <button class="btn block" id="ok">فهمت 👍</button>`);
  $("#ok").onclick = after;
}

// ---------------- الحملة ----------------
function campaign() {
  stopGame();
  const prog = store.get("progress", { stars: {}, best: {} });
  $("#app").innerHTML = `
    <main class="screen">
      <div class="top"><button class="icon" id="back">→</button><h2>🎖️ الحملة</h2><span></span></div>
      <div class="levels">${LEVELS.map((L, i) => {
        const open = i === 0 || prog.stars[i - 1] > 0;
        const st = prog.stars[i] || 0;
        return `<button class="lvl ${open ? "" : "locked"} ${st ? "done" : ""}" data-i="${i}" ${open ? "" : "disabled"}>
          <b class="n">${open ? i + 1 : "🔒"}</b>
          <span class="t">${L.title}</span>
          <small class="brief">${L.brief}</small>
          <span class="foes"><small>${FACTIONS[L.me].emblem} ${FACTIONS[L.me].name} ضد ${FACTIONS[L.foe].emblem} ${FACTIONS[L.foe].name} · ${AI[L.ai].name}</small></span>
          <span class="stars">${"★".repeat(st)}<em>${"★".repeat(3 - st)}</em></span>
          ${prog.best[i] ? `<small class="bt">⏱ ${fmt(prog.best[i])}</small>` : ""}
        </button>`;
      }).join("")}</div>
    </main>`;
  $("#back").onclick = home;
  $$(".lvl").forEach((b) => (b.onclick = () => startLevel(+b.dataset.i)));
}
const startLevel = (i) => { const L = LEVELS[i]; startGame({ seed: L.seed, ai: L.ai, me: L.me, foe: L.foe, level: i, tutorial: L.tutorial }); };

// ---------------- المعركة السريعة ----------------
function quickSetup() {
  stopGame();
  const cfg = store.get("quick", { diff: "normal", me: "shield", foe: "falcon", code: seedToCode(randomSeed()) });
  const fCard = (name, k) => `<button data-v="${k}" class="fac ${cfg[name] === k ? "on" : ""}"><span>${FACTIONS[k].emblem}</span><b>${FACTIONS[k].name}</b><small>${FACTIONS[k].motto}</small></button>`;
  $("#app").innerHTML = `
    <main class="screen">
      <div class="top"><button class="icon" id="back">→</button><h2>⚔️ معركة سريعة</h2><span></span></div>
      <div class="form">
        <label>جيشك</label>
        <div class="facs" data-name="me">${fCard("me", "shield")}${fCard("me", "falcon")}</div>
        <label>جيش العدو</label>
        <div class="facs" data-name="foe">${fCard("foe", "shield")}${fCard("foe", "falcon")}</div>
        <label>الصعوبة</label>
        <div class="seg" data-name="diff">${Object.entries(AI).map(([k, v]) => `<button data-v="${k}" class="${cfg.diff === k ? "on" : ""}">${v.name}</button>`).join("")}</div>
        <p class="note">الصعب: قائد يملك موارد أكثر منك بربع ويبني سلاحاً استراتيجياً</p>
        <label>رمز الخريطة <small>شارك الرمز مع أصدقائك وتنافسوا على أسرع انتصار في نفس المدينة</small></label>
        <div class="code"><input id="code" value="${cfg.code}" maxlength="6" dir="ltr" autocomplete="off" spellcheck="false"><button class="btn ghost" id="dice">🎲 جديدة</button></div>
        <button class="btn big block" id="go">⚔️ ابدأ المعركة</button>
      </div>
    </main>`;
  $("#back").onclick = home;
  $$("[data-name]").forEach((g) => g.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    g.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); cfg[g.dataset.name] = b.dataset.v;
  })));
  $("#dice").onclick = () => { $("#code").value = seedToCode(randomSeed()); };
  $("#go").onclick = () => {
    const seed = codeToSeed($("#code").value);
    if (seed == null) { toast("رمز الخريطة غير صحيح (6 حروف وأرقام)"); return; }
    cfg.code = seedToCode(seed); store.set("quick", cfg);
    startGame({ seed, ai: cfg.diff, me: cfg.me, foe: cfg.foe, code: cfg.code });
  };
}

// ---------------- المعركة ----------------
let S = null;
function stopGame() {
  if (!S) return;
  cancelAnimationFrame(S.raf);
  window.removeEventListener("resize", S.onResize);
  document.removeEventListener("visibilitychange", S.onVis);
  S = null;
}

const TABS = [["build", "🏗️", "بناء"], ["make", "🏭", "إنتاج"], ["army", "⚔️", "الجيش"], ["gen", "⭐", "الجنرال"]];
function startGame(opts) {
  stopGame(); closeModal();
  const w = createWorld(opts.seed, [opts.me || "shield", opts.foe || "falcon"]);
  const ai = createAI(w, 1, opts.ai);
  const F = FACTIONS[w.players[0].faction];
  $("#app").innerHTML = `
    <div class="game fac-${w.players[0].faction}">
      <header class="ghud">
        <button class="icon" id="pause" aria-label="إيقاف مؤقت">⏸</button>
        <div class="money"><b id="money">0</b><small id="pwr">⚡ 0/0</small></div>
        <button class="rank" id="rankBtn"><span id="rankName">${F.emblem} ${RANK_NAMES[0]}</span><i class="xp"><i id="xp"></i></i><em id="pts" hidden></em></button>
        <div class="clock" id="clock">0:00</div>
      </header>
      <div class="tip" id="tip" hidden></div>
      <div class="stage">
        <canvas id="cv"></canvas>
        <canvas id="mini" width="96" height="151"></canvas>
        <button class="icon home-btn" id="toHq" aria-label="قاعدتك">🏠</button>
        <button class="superbtn" id="superBtn" hidden></button>
        <div class="modebar" id="modebar" hidden><span id="modeText"></span><button id="modeX">✖ إلغاء</button></div>
      </div>
      <footer class="gfoot">
        <nav class="tabs">${TABS.map(([k, i, n]) => `<button data-t="${k}"><span>${i}</span>${n}<em class="dot" hidden></em></button>`).join("")}</nav>
        <div class="panel" id="panel"></div>
      </footer>
    </div>`;
  const view = createView($("#cv"), w);
  S = { opts, w, ai, view, ui: { selected: [], tab: "build", place: null, aim: null, selectedBuilding: null }, acc: 0, last: performance.now(), paused: false, speed: 1, ended: false, hudAt: 0, miniAt: 0, tip: -1, pointers: new Map(), panelKey: "", hpWatch: new Map(), attackAt: -1e9 };
  resizeView(view);
  const hq = w.city.hqLots[0];
  view.cam = { x: hq.x, y: hq.y - 120, z: Math.max(minZoom(view), Math.min(1.2, view.cw / 460)) };
  clampCam(view);
  S.mini = createMinimap($("#mini"), view, w);
  S.onResize = () => resizeView(view);
  S.onVis = () => { if (document.hidden && !S.ended) pause(); };
  window.addEventListener("resize", S.onResize);
  document.addEventListener("visibilitychange", S.onVis);
  bindInput();
  $("#pause").onclick = pause;
  $("#toHq").onclick = () => { view.cam.x = hq.x; view.cam.y = hq.y - 120; clampCam(view); };
  $("#rankBtn").onclick = () => setTab("gen");
  $("#modeX").onclick = cancelMode;
  $("#superBtn").onclick = superClick;
  $$(".tabs button").forEach((b) => (b.onclick = () => setTab(b.dataset.t)));
  setTab("build");
  if (opts.tutorial) showTip(0);
  S.raf = requestAnimationFrame(frame);
}

function setTab(t) {
  S.ui.tab = t; S.ui.selectedBuilding = null;
  $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
  S.panelKey = ""; panel();
}

function frame(now) {
  if (!S) return;
  const { w } = S;
  if (!S.paused && !w.over) {
    S.acc += Math.min(250, now - S.last) * S.speed;
    while (S.acc >= TICK_MS) {
      think(w, S.ai);
      if (S.auto) think(w, S.auto);
      step(w);
      S.acc -= TICK_MS;
      for (const ev of w.events.splice(0)) onEvent(ev, now);
      if (w.over) break;
    }
  }
  S.last = now;
  if (S.ui.place && now - (S.placeAt || 0) > 400) { S.placeAt = now; S.ui.place.spots = placeSpots(S.ui.place.type); }
  render(S.view, w, S.ui, now, S.paused ? 1 : Math.min(1, S.acc / TICK_MS));
  if (now - S.miniAt > 250) { S.miniAt = now; renderMinimap(S.mini, S.view, w); }
  if (now - S.hudAt > 200) { S.hudAt = now; hud(); panel(); }
  if (w.over && !S.ended) { S.ended = true; setTimeout(result, 1800); }
  S.raf = requestAnimationFrame(frame);
}

const nearCam = (x, y) => { const v = S.view; return Math.abs(x - v.cam.x) < v.cw / v.cam.z && Math.abs(y - v.cam.y) < v.ch / v.cam.z; };
const seesCell = (x, y) => { const w = S.w; return w.vis[0][Math.floor(y / 50) * w.gw + Math.floor(x / 50)] === 1; };
function onEvent(ev, now) {
  const w = S.w;
  addEvent(S.view, ev, now);
  const mine = ev.p === 0;
  switch (ev.type) {
    case "shot":
      if (nearCam(ev.x, ev.y) && (mine || seesCell(ev.x, ev.y))) ({ shell: sfx.cannon, rocket: sfx.rocket, missile: sfx.rocket }[ev.weapon] || sfx.rifle)();
      break;
    case "artyFire": if (mine || (nearCam(ev.x, ev.y) && seesCell(ev.x, ev.y))) sfx.arty(); break;
    case "boom": case "airBoom": if (nearCam(ev.x, ev.y)) sfx.boom(); break;
    case "death":
      if (UNITS[ev.unit].armor !== "inf" && nearCam(ev.x, ev.y)) sfx.boom();
      if (mine) S.ui.selected = S.ui.selected.filter((id) => w.units.some((u) => u.id === id));
      break;
    case "spawn": if (mine) { sfx.ready(); tutorial(); } break;
    case "placed": if (mine) tutorial(); break;
    case "built": if (mine) { sfx.built(); toast(`✅ اكتمل بناء ${buildingName(ev.building, w.players[0].faction)}`); if (ev.building === "supply") toast("🚚 وصلت شاحنة إمداد مجانية"); tutorial(); } break;
    case "razed":
      sfx.boom();
      if (mine) { toast(`💥 خسرت ${buildingName(ev.building, w.players[0].faction)}`, true); if (S.ui.selectedBuilding && !w.buildings.some((b) => b.id === S.ui.selectedBuilding)) S.ui.selectedBuilding = null; }
      else if (seesCell(ev.x, ev.y)) toast(`🔥 دمّرت ${buildingName(ev.building, w.players[1].faction)} للعدو`);
      break;
    case "captured": {
      const T = POINT_TYPES[w.points[ev.id].type];
      if (mine) { sfx.capture(); toast(`🚩 احتللت ${T.name}! دخل +${T.income}/ث`); tutorial(); }
      else toast(`⚠️ العدو احتلّ ${T.name}`, true);
      break;
    }
    case "neutral": if (ev.from === 0) { sfx.lost(); toast("⚠️ العدو يحتلّ أحد مواقعك!", true); } break;
    case "rankUp": if (mine) { sfx.rank(); toast(`🎖️ ترقية! أصبحت ${RANK_NAMES[ev.rank - 1]} · لك نقطة صلاحية جديدة`); } break;
    case "planes": sfx.planes(); if (!mine && ev.kind !== "reveal") toast(ev.kind === "paradrop" ? "🪂 العدو ينزل مظليين!" : "✈️ غارة جوية للعدو!", true); break;
    case "barrage": if (!mine) toast("💣 العدو يقصف بالمدفعية!", true); break;
    case "superReady": if (mine) { sfx.ready(); toast("☢️ السلاح الاستراتيجي جاهز!"); } else { sfx.alarm(); toast("⚠️ العدو جهّز سلاحه الاستراتيجي!", true); } break;
    case "superLaunch": sfx.alarm(); if (!mine) toast("☢️ إطلاق صاروخ استراتيجي! أبعد قواتك عن الدائرة", true); break;
    case "superBoom": sfx.big(); break;
    case "cash": if (mine) sfx.capture(); break;
    case "delivered": break;
  }
}

// ---------------- شريط الأعلى ----------------
function hud() {
  const { w } = S, pl = w.players[0];
  $("#money").textContent = Math.floor(pl.money);
  const pw = $("#pwr");
  pw.textContent = `⚡ ${pl.power.use}/${pl.power.prod}`;
  pw.classList.toggle("low", pl.low);
  const R = pl.rank;
  $("#rankName").textContent = `${FACTIONS[pl.faction].emblem} ${RANK_NAMES[R - 1]}`;
  const lo = RANKS[R - 1], hi = RANKS[R];
  $("#xp").style.width = hi == null ? "100%" : `${Math.min(100, ((pl.xp - lo) / (hi - lo)) * 100)}%`;
  const pts = $("#pts"); pts.hidden = !pl.points; pts.textContent = pl.points;
  $("#clock").textContent = fmt(seconds(w));
  $$(".tabs .dot")[3].hidden = !(pl.points > 0 && Object.entries(POWERS).some(([k, P]) => !pl.powers[k].unlocked && pl.rank >= P.rank));
  // السلاح الاستراتيجي
  const sup = w.buildings.find((b) => b.p === 0 && b.type === "super" && b.done);
  const sb = $("#superBtn");
  sb.hidden = !sup;
  if (sup) {
    const f = sup.charge / SUPER.charge;
    sb.classList.toggle("ready", f >= 1);
    sb.textContent = f >= 1 ? "☢️ أطلق!" : `☢️ ${Math.floor(f * 100)}٪`;
  }
  // تنبيه الهجوم على القاعدة
  let hit = null;
  for (const b of w.buildings) if (b.p === 0) { const prev = S.hpWatch.get(b.id); if (prev != null && b.hp < prev - 1 && b.done) hit = b; S.hpWatch.set(b.id, b.hp); }
  if (hit && performance.now() - S.attackAt > 15000) { S.attackAt = performance.now(); sfx.alarm(); toast(`⚠️ ${buildingName(hit.type, pl.faction)} تحت الهجوم!`, true); }
}

// ---------------- اللوحة السفلية ----------------
function panel() {
  if (!S) return;
  const { w, ui } = S, pl = w.players[0];
  let html = "", key = "";
  if (ui.selectedBuilding) {
    const b = w.buildings.find((x) => x.id === ui.selectedBuilding);
    if (!b) { ui.selectedBuilding = null; return panel(); }
    const B = BUILDINGS[b.type];
    const pw = powerOf(w, b);
    key = `b${b.id}|${Math.round(b.hp / 20)}|${b.queue.map((q) => q.unit + Math.round(q.t)).join()}|${b.done}`;
    html = `<div class="binfo">
      <div class="bh"><span class="bi">${B.icon}</span><div><b>${buildingName(b.type, pl.faction)}</b><small>❤️ ${Math.ceil(b.hp)} / ${b.maxHp}${pw ? ` · ⚡ ${pw > 0 ? "+" : ""}${pw}` : ""}${b.done ? "" : ` · 🚧 ${Math.floor(b.built * 100)}٪`}</small></div>
      <button class="x" id="bclose">✖</button></div>
      ${b.queue.length ? `<div class="bq">${b.queue.map((q, i) => `<span>${UNITS[q.unit].icon}${i === 0 ? `<i style="width:${(1 - q.t / q.total) * 100}%"></i>` : ""}</span>`).join("")}<button id="bcancel">↩️ ألغِ الأخير</button></div>` : B.about ? `<p class="bab">${B.about}</p>` : ""}
      <div class="brow">${b.type !== "hq" ? `<button id="bsell" class="danger">💲 بِع (+${Math.round(buildCost(w, 0, b.type) * 0.5 * (b.hp / b.maxHp))})</button>` : ""}
      ${!b.done ? `<button id="bresume">🚜 أرسل جرّافة</button>` : ""}</div>
    </div>`;
  } else if (ui.tab === "build") {
    key = "build|" + BUILD_ORDER.map((t) => canBuild(w, 0, t) || "").join() + Math.floor(pl.money / 50);
    html = `<div class="grid">${BUILD_ORDER.map((t) => {
      const why = canBuild(w, 0, t);
      const B = BUILDINGS[t], locked = B.req && !hasBuilding(w, 0, B.req);
      const pw = powerOf(w, { type: t, p: 0 });
      return `<button data-b="${t}" class="${why ? (locked ? "locked" : "poor") : ""}"><span class="ue">${locked ? "🔒" : B.icon}</span><b>${buildingName(t, pl.faction)}</b><small>${buildCost(w, 0, t)}</small><em class="pw ${pw > 0 ? "plus" : ""}">⚡${pw > 0 ? "+" : ""}${pw}</em></button>`;
    }).join("")}</div>`;
  } else if (ui.tab === "make") {
    const list = [builderOf(pl.faction), truckOf(pl.faction), ...unitsOf(pl.faction).filter((t) => !UNITS[t].role)];
    const queues = w.buildings.filter((b) => b.p === 0);
    const state = list.map((t) => {
      const U = UNITS[t];
      const has = hasBuilding(w, 0, U.from), req = !U.req || hasBuilding(w, 0, U.req);
      const qs = queues.filter((b) => b.type === U.from);
      const n = qs.reduce((a, b) => a + b.queue.filter((q) => q.unit === t).length, 0);
      const cur = qs.map((b) => b.queue[0]).find((q) => q?.unit === t);
      return { t, U, ok: has && req, why: !has ? BUILDINGS[U.from].name : !req ? BUILDINGS[U.req].name : "", n, pr: cur ? 1 - cur.t / cur.total : 0 };
    });
    key = "make|" + state.map((s) => `${s.ok}${s.n}${Math.round(s.pr * 20)}`).join() + (pl.money >= 0 ? state.map((s) => pl.money >= s.U.cost).join() : "");
    html = `<div class="grid">${state.map((s) => `<button data-u="${s.t}" class="${!s.ok ? "locked" : pl.money < s.U.cost ? "poor" : ""}">
      <span class="ue">${s.ok ? s.U.icon : "🔒"}</span><b>${s.U.name}</b><small>${s.ok ? s.U.cost : ""}</small>${s.ok ? "" : `<em class="need">${s.why}</em>`}
      <i class="q">${s.n || ""}</i><i class="pr" style="width:${s.pr * 100}%"></i></button>`).join("")}</div>`;
  } else if (ui.tab === "army") {
    const mine = w.units.filter((u) => u.p === 0);
    const fighters = mine.filter((u) => !UNITS[u.type].role);
    const sel = new Set(ui.selected);
    const types = [builderOf(pl.faction), truckOf(pl.faction), ...unitsOf(pl.faction).filter((t) => !UNITS[t].role)];
    const counts = {}; for (const u of mine) counts[u.type] = (counts[u.type] || 0) + 1;
    const allOn = fighters.length && fighters.every((u) => sel.has(u.id)) && sel.size === fighters.length;
    const typeOn = (t) => counts[t] && mine.filter((u) => u.type === t).every((u) => sel.has(u.id)) && sel.size === counts[t];
    key = "army|" + JSON.stringify(counts) + [...sel].join();
    html = `<div class="army">
      <button data-s="all" class="wide ${allOn ? "on" : ""}" ${fighters.length ? "" : "disabled"}>⚔️ كل المقاتلين <b>${fighters.length}</b></button>
      ${types.filter((t) => counts[t]).map((t) => `<button data-s="${t}" class="${typeOn(t) ? "on" : ""}" ${counts[t] ? "" : "disabled"}>${UNITS[t].icon}<b>${counts[t] || 0}</b></button>`).join("")}
      <button data-s="none" ${sel.size ? "" : "disabled"}>✖</button>
    </div><p class="hint">${sel.size ? `اخترت ${sel.size} · اضغط على الخريطة لإرسالهم` : `الوحدات: ${unitCount(w, 0)} / ${MAX_UNITS}`}</p>`;
  } else if (ui.tab === "gen") {
    const R = pl.rank;
    const st = Object.entries(POWERS).map(([k, P]) => {
      const s = pl.powers[k];
      const left = s.unlocked ? Math.max(0, Math.ceil((s.ready - w.tick) * TICK)) : 0;
      return { k, P, s, left, can: !s.unlocked && pl.points > 0 && R >= P.rank };
    });
    key = "gen|" + R + pl.points + st.map((x) => `${x.s.unlocked}${x.left}${x.can}`).join() + (S.ui.aim?.power || "");
    html = `<p class="hint">🎖️ ${RANK_NAMES[R - 1]} · الخبرة ${Math.floor(pl.xp)}${RANKS[R] ? ` / ${RANKS[R]}` : ""} · نقاط: <b>${pl.points}</b></p>
      <div class="grid">${st.map((x) => `<button data-p="${x.k}" class="${x.s.unlocked ? (x.left ? "cool" : "ready") : x.can ? "unlock" : "locked"}">
        <span class="ue">${x.s.unlocked || x.can ? x.P.icon : "🔒"}</span><b>${x.P.name}</b>
        <small>${x.s.unlocked ? (x.left ? `⏳ ${fmt(x.left)}` : "جاهزة") : x.can ? "افتح ⭐" : R < x.P.rank ? `رتبة ${RANK_NAMES[x.P.rank - 1]}` : "تحتاج نقطة"}</small></button>`).join("")}</div>`;
  }
  if (key === S.panelKey) return;
  S.panelKey = key;
  const el = $("#panel");
  el.innerHTML = html;
  el.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => startPlace(b.dataset.b)));
  el.querySelectorAll("[data-u]").forEach((b) => (b.onclick = () => produce(b.dataset.u)));
  el.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => selectGroup(b.dataset.s)));
  el.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => powerClick(b.dataset.p)));
  if ($("#bclose")) $("#bclose").onclick = () => { ui.selectedBuilding = null; S.panelKey = ""; panel(); };
  if ($("#bsell")) $("#bsell").onclick = () => sell(ui.selectedBuilding);
  if ($("#bcancel")) $("#bcancel").onclick = () => { command(w, { type: "cancel", p: 0, id: ui.selectedBuilding }); sfx.select(); };
  if ($("#bresume")) $("#bresume").onclick = () => resumeSite(ui.selectedBuilding);
}

// ---------------- البناء ----------------
function placeSpots(type) {
  const w = S.w, B = BUILDINGS[type];
  if (B.size === "pad") return w.city.pads.map((pd, i) => ({ pad: i, ok: !canBuild(w, 0, type, { pad: i }) })).filter((s) => s.ok);
  return w.city.lots.map((l) => ({ lot: l.id, ok: !canBuild(w, 0, type, { lot: l.id }) })).filter((s) => s.ok);
}
function startPlace(type) {
  const why = canBuild(S.w, 0, type);
  if (why) { sfx.bad(); toast(`${buildingName(type, S.w.players[0].faction)}: ${why}`); return; }
  const spots = placeSpots(type);
  if (!spots.length) { sfx.bad(); toast("لا يوجد مكان فارغ مكشوف لهذا المبنى. وسّع رؤيتك"); return; }
  S.ui.aim = null;
  S.ui.place = { type, spots };
  setMode(`اضغط على مكان أخضر لبناء ${buildingName(type, S.w.players[0].faction)}`);
  sfx.select();
}
function setMode(text) { $("#modebar").hidden = false; $("#modeText").textContent = text; }
function cancelMode() { S.ui.place = null; S.ui.aim = null; $("#modebar").hidden = true; S.panelKey = ""; }
function tryPlace(pt) {
  const w = S.w, { type } = S.ui.place;
  const B = BUILDINGS[type];
  let spot = null;
  if (B.size === "pad") {
    let best = 40;
    w.city.pads.forEach((pd, i) => { const d = Math.hypot(pd.x - pt.x, pd.y - pt.y); if (d < best) { best = d; spot = { pad: i }; } });
  } else {
    const l = w.city.lots.find((l) => inPoly(l.poly, pt.x, pt.y));
    if (l) spot = { lot: l.id };
  }
  if (!spot) { sfx.bad(); toast("اختر أحد الأماكن الخضراء الوامضة"); return; }
  const why = canBuild(w, 0, type, spot);
  if (why) { sfx.bad(); toast(why); return; }
  command(w, { type: "build", p: 0, building: type, ...spot });
  const pos = spot.pad != null ? w.city.pads[spot.pad] : w.city.lots[spot.lot];
  S.view.markers.push({ x: pos.x, y: pos.y, t0: performance.now(), color: "#ffd43b" });
  sfx.place();
  cancelMode();
}
function sell(id) {
  const b = S.w.buildings.find((x) => x.id === id);
  if (!b) return;
  command(S.w, { type: "sell", p: 0, id });
  S.ui.selectedBuilding = null; S.panelKey = "";
  toast(`💲 بعت ${buildingName(b.type, S.w.players[0].faction)}`);
}
function resumeSite(id) {
  const w = S.w;
  const b = w.buildings.find((x) => x.id === id);
  const dozers = w.units.filter((u) => u.p === 0 && UNITS[u.type].role === "builder").sort((a, z) => (a.task ? 1 : 0) - (z.task ? 1 : 0) || Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(z.x - b.x, z.y - b.y));
  if (!dozers.length) { toast("ليس لديك جرّافة. أنتجها من مركز القيادة"); return; }
  command(w, { type: "resume", p: 0, unit: dozers[0].id, id });
  sfx.order();
}

// ---------------- الإنتاج ----------------
function produce(t) {
  const w = S.w, pl = w.players[0], U = UNITS[t];
  if (!hasBuilding(w, 0, U.from)) { sfx.bad(); toast(`تحتاج ${buildingName(U.from, pl.faction)} أولاً`); return; }
  if (U.req && !hasBuilding(w, 0, U.req)) { sfx.bad(); toast(`تحتاج ${BUILDINGS[U.req].name} أولاً`); return; }
  if (pl.money < U.cost) { sfx.bad(); toast(`تحتاج ${U.cost} 💰 (معك ${Math.floor(pl.money)})`); return; }
  if (unitCount(w, 0) >= MAX_UNITS) { sfx.bad(); toast(`وصلت الحد الأقصى (${MAX_UNITS} وحدة)`); return; }
  if (!w.buildings.some((b) => b.p === 0 && b.done && b.type === U.from && b.queue.length < QUEUE_MAX)) { sfx.bad(); toast("قائمة الإنتاج ممتلئة"); return; }
  command(w, { type: "produce", p: 0, unit: t });
  sfx.select();
  if (pl.low) toast("⚡ الطاقة ناقصة: الإنتاج أبطأ. ابنِ محطة طاقة");
}

// ---------------- الجيش ----------------
function selectGroup(kind) {
  const mine = S.w.units.filter((u) => u.p === 0);
  S.ui.selected = kind === "none" ? [] : mine.filter((u) => (kind === "all" ? !UNITS[u.type].role : u.type === kind)).map((u) => u.id);
  if (S.ui.selected.length) sfx.select();
  S.panelKey = ""; panel(); tutorial();
}

// ---------------- صلاحيات الجنرال ----------------
function powerClick(k) {
  const w = S.w, pl = w.players[0], P = POWERS[k], st = pl.powers[k];
  if (!st.unlocked) {
    if (pl.rank < P.rank) { sfx.bad(); toast(`${P.name} تحتاج رتبة ${RANK_NAMES[P.rank - 1]}`); return; }
    if (pl.points <= 0) { sfx.bad(); toast("ليس لديك نقاط. دمّر قوات العدو لترتفع رتبتك"); return; }
    command(w, { type: "unlock", p: 0, power: k });
    sfx.rank(); toast(`⭐ فتحت ${P.name}: ${P.about}`);
    S.panelKey = ""; tutorial();
    return;
  }
  if (w.tick < st.ready) { sfx.bad(); toast(`${P.name} غير جاهزة بعد`); return; }
  if (k === "cash") { command(w, { type: "power", p: 0, power: k, x: 0, y: 0 }); toast(`💰 +${P.amount}`); return; }
  S.ui.place = null;
  S.ui.aim = { power: k, radius: P.radius || 60 };
  setMode(`${P.icon} اضغط على الهدف في الخريطة`);
  sfx.select();
}
function superClick() {
  const sup = S.w.buildings.find((b) => b.p === 0 && b.type === "super" && b.done);
  if (!sup) return;
  if (sup.charge < SUPER.charge) { toast(`☢️ يشحن… ${fmt(Math.ceil(SUPER.charge - sup.charge))}`); return; }
  S.ui.place = null;
  S.ui.aim = { power: "super", radius: SUPER.radius };
  setMode("☢️ اختر هدف السلاح الاستراتيجي");
  sfx.alarm();
}
function fireAim(pt) {
  const { power } = S.ui.aim;
  if (power === "super") command(S.w, { type: "super", p: 0, x: pt.x, y: pt.y });
  else if (power === "reveal" || power === "airstrike" || power === "paradrop" || power === "barrage") command(S.w, { type: "power", p: 0, power, x: pt.x, y: pt.y });
  S.ui.aim.at = pt;
  S.view.markers.push({ x: pt.x, y: pt.y, t0: performance.now(), color: "#ff5a4f" });
  sfx.order();
  cancelMode();
}

// ---------------- اللمس ----------------
function bindInput() {
  const cv = $("#cv"), v = S.view;
  const P = S.pointers;
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    P.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
    if (P.size === 2) { const [a, b] = [...P.values()]; S.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: v.cam.z }; }
  });
  cv.addEventListener("pointermove", (e) => {
    const p = P.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 9) p.moved = true;
    if (P.size === 1 && p.moved) { v.cam.x -= dx / v.cam.z; v.cam.y -= dy / v.cam.z; clampCam(v); }
    else if (P.size === 2 && S.pinch) {
      const [a, b] = [...P.values()];
      v.cam.z = S.pinch.z * (Math.hypot(a.x - b.x, a.y - b.y) / S.pinch.d);
      v.cam.x -= dx / 2 / v.cam.z; v.cam.y -= dy / 2 / v.cam.z;
      clampCam(v);
    }
  });
  const end = (e) => {
    const p = P.get(e.pointerId);
    P.delete(e.pointerId);
    if (P.size < 2) S.pinch = null;
    if (!p || p.moved || S.paused || S.w.over || P.size) return;
    const r = cv.getBoundingClientRect();
    tap(screenToWorld(v, e.clientX - r.left, e.clientY - r.top));
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", (e) => { P.delete(e.pointerId); S.pinch = null; });
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const before = screenToWorld(v, e.clientX - r.left, e.clientY - r.top);
    v.cam.z *= e.deltaY < 0 ? 1.12 : 0.89; clampCam(v);
    const after = screenToWorld(v, e.clientX - r.left, e.clientY - r.top);
    v.cam.x += before.x - after.x; v.cam.y += before.y - after.y; clampCam(v);
  }, { passive: false });
  const mini = $("#mini");
  const jump = (e) => {
    const r = mini.getBoundingClientRect();
    v.cam.x = ((e.clientX - r.left) / r.width) * S.w.city.W;
    v.cam.y = ((e.clientY - r.top) / r.height) * S.w.city.H;
    clampCam(v);
  };
  mini.addEventListener("pointerdown", (e) => { mini.setPointerCapture(e.pointerId); jump(e); });
  mini.addEventListener("pointermove", (e) => { if (e.buttons) jump(e); });
}

function buildingAt(pt, p) {
  return S.w.buildings.find((b) => b.p === p && (BUILDINGS[b.type].size === "pad" ? Math.hypot(b.x - pt.x, b.y - pt.y) < 22 : Math.abs(b.x - pt.x) < 46 && Math.abs(b.y - pt.y) < 46));
}
function tap(pt) {
  const w = S.w, ui = S.ui;
  if (ui.place) return tryPlace(pt);
  if (ui.aim) return fireAim(pt);
  const R = 26 / Math.min(1, S.view.cam.z);
  const own = w.units.filter((u) => u.p === 0).map((u) => ({ u, d: Math.hypot(u.x - pt.x, u.y - pt.y) })).filter((x) => x.d < R).sort((a, b) => a.d - b.d)[0];
  if (own) {
    const id = own.u.id;
    ui.selected = ui.selected.length === 1 && ui.selected[0] === id ? [] : [id];
    ui.selectedBuilding = null;
    if (ui.tab !== "army") setTab("army");
    sfx.select(); S.panelKey = ""; panel(); tutorial();
    return;
  }
  const myB = buildingAt(pt, 0);
  if (ui.selected.length) {
    // جرّافات مختارة + موقع بناء غير مكتمل = أكمل البناء
    const site = myB && !myB.done ? myB : null;
    const dozer = site && ui.selected.map((id) => w.units.find((u) => u.id === id)).find((u) => u && UNITS[u.type].role === "builder");
    if (dozer) { command(w, { type: "resume", p: 0, unit: dozer.id, id: site.id }); sfx.order(); return; }
    command(w, { type: "move", p: 0, ids: [...ui.selected], x: pt.x, y: pt.y });
    S.view.markers.push({ x: pt.x, y: pt.y, t0: performance.now() });
    sfx.order(); tutorial();
    return;
  }
  if (myB) { ui.selectedBuilding = myB.id; S.panelKey = ""; panel(); sfx.select(); return; }
  const pnt = w.points.find((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 80);
  if (pnt) {
    const T = POINT_TYPES[pnt.type];
    toast(`${T.icon} ${T.name} · ${pnt.owner === 0 ? "لك" : pnt.owner === 1 ? "للعدو" : "محايد"} · دخل +${T.income}/ث · يحتلّه المشاة`);
    return;
  }
  const dep = w.depots.find((d) => Math.hypot(d.x - pt.x, d.y - pt.y) < 70);
  if (dep) { toast(`📦 مستودع مؤن · باقٍ ${Math.floor(dep.amount)} · ابنِ مركز إمداد قربه`); return; }
  toast("اختر وحداتك من تبويب «الجيش» أو اضغط على مبنى لك");
}

// ---------------- الدرس الأول ----------------
const TIPS = [
  "⚡ من تبويب «🏗️ بناء» اختر «محطة طاقة»، ثم اضغط على أرض خضراء وامضة",
  "🏠 أحسنت! الجرّافة ستبنيها. الآن ابنِ «ثكنة» بنفس الطريقة",
  "📦 ابنِ «مركز الإمداد» قرب صناديق المؤن، فتأتيك شاحنة تجمعها تلقائياً",
  "🪖 من تبويب «🏭 إنتاج» درّب 3 جنود (بعد اكتمال الثكنة)",
  "🚩 من تبويب «⚔️ الجيش» اختر المقاتلين، ثم اضغط على مصفاة النفط 🛢️ لاحتلالها",
  "🏭 ممتاز! ابنِ «مصنع المركبات» وجيشاً قوياً، ثم دمّر كل مباني العدو في الشمال",
  "⭐ عند الترقية افتح صلاحية من تبويب «الجنرال» واستخدمها على العدو"
];
function showTip(k) {
  S.tip = k;
  const t = $("#tip");
  if (k >= TIPS.length) { t.hidden = true; return; }
  t.hidden = false; t.textContent = TIPS[k];
}
function tutorial() {
  if (!S || !S.opts.tutorial || S.tip < 0 || S.tip >= TIPS.length) return;
  const w = S.w, mineB = (t) => w.buildings.some((b) => b.p === 0 && b.type === t);
  const done = [
    () => mineB("power"),
    () => mineB("barracks"),
    () => mineB("supply"),
    () => w.units.filter((u) => u.p === 0 && !UNITS[u.type].role).length >= 3,
    () => w.points.some((p) => p.owner === 0),
    () => mineB("factory") || w.players[0].points > 1,
    () => Object.values(w.players[0].powers).some((s) => s.unlocked)
  ];
  while (S.tip < TIPS.length && done[S.tip]()) showTip(S.tip + 1);
}

// ---------------- الإيقاف المؤقت ----------------
function pause() {
  if (!S || S.ended) return;
  S.paused = true;
  modal(`
    <h2>⏸ استراحة</h2>
    <div class="col">
      <button class="btn block" id="resume">▶ تابع المعركة</button>
      <div class="seg" id="spd">${[1, 1.5, 2].map((x) => `<button data-v="${x}" class="${S.speed === x ? "on" : ""}">سرعة ×${x}</button>`).join("")}</div>
      <button class="btn block alt" id="restart">🔄 أعد المعركة</button>
      <button class="btn block ghost" id="helpP">📖 كيف ألعب؟</button>
      <button class="btn block ghost" id="soundP">${soundOn ? "🔊 الصوت يعمل" : "🔇 الصوت مطفأ"}</button>
      <button class="btn block ghost" id="quit">🏳️ انسحب إلى القائمة</button>
    </div>`);
  $("#resume").onclick = () => { closeModal(); S.paused = false; S.last = performance.now(); };
  $$("#spd button").forEach((b) => (b.onclick = () => { S.speed = +b.dataset.v; $$("#spd button").forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#restart").onclick = () => startGame(S.opts);
  $("#helpP").onclick = () => help(pause);
  $("#soundP").onclick = () => { soundOn = !soundOn; store.set("sound", soundOn); pause(); };
  $("#quit").onclick = () => { closeModal(); S.opts.level != null ? campaign() : home(); };
}

// ---------------- النتيجة ----------------
function result() {
  if (!S) return;
  const { w, opts } = S;
  const won = w.winner === 0;
  const secs = seconds(w);
  const st = w.stats[0], pl = w.players[0];
  won ? sfx.win() : sfx.lose();
  let extra = "";
  if (opts.level != null) {
    const L = LEVELS[opts.level];
    const stars = starsFor(L, won, secs);
    const prog = store.get("progress", { stars: {}, best: {} });
    if (stars > (prog.stars[opts.level] || 0)) prog.stars[opts.level] = stars;
    if (won && (!prog.best[opts.level] || secs < prog.best[opts.level])) prog.best[opts.level] = secs;
    store.set("progress", prog);
    extra = `<div class="bigstars">${"★".repeat(stars)}<em>${"★".repeat(3 - stars)}</em></div>${won ? `<p class="par">⭐⭐⭐ في أقل من ${fmt(L.par)} · أفضل وقت لك: ${fmt(prog.best[opts.level])}</p>` : ""}`;
  } else if (opts.code) {
    const key = `${opts.code}-${opts.ai}-${opts.me}-${opts.foe}`;
    const bests = store.get("codes", {});
    const prev = bests[key];
    if (won && (!prev || secs < prev)) { bests[key] = secs; store.set("codes", bests); }
    extra = `<p class="par">رمز المدينة: <b dir="ltr">${esc(opts.code)}</b> · ${AI[opts.ai].name}${won ? ` · ${!prev || secs < prev ? "🏆 أفضل وقت لك!" : `أفضل وقت لك: ${fmt(prev)}`}` : ""}</p>`;
  }
  const next = opts.level != null && won && opts.level < LEVELS.length - 1;
  modal(`
    <div class="res-icon">${won ? "🏆" : "🏳️"}</div>
    <h2>${won ? "انتصرت! دمّرت قاعدة العدو" : "سقطت قاعدتك"}</h2>
    ${extra}
    <div class="sgrid">
      <div><b>${fmt(secs)}</b><small>مدة المعركة</small></div>
      <div><b>${RANK_NAMES[pl.rank - 1]}</b><small>رتبتك</small></div>
      <div><b>${st.kills}</b><small>وحدات دمّرتها</small></div>
      <div><b>${st.razed}</b><small>مبانٍ دمّرتها</small></div>
      <div><b>${st.lost}</b><small>وحدات خسرتها</small></div>
      <div><b>${Math.floor(pl.earned)}</b><small>مؤن جمعتها</small></div>
    </div>
    <div class="col">
      ${next ? `<button class="btn block" id="next">المعركة التالية ⬅</button>` : ""}
      <button class="btn block ${next ? "alt" : ""}" id="again">🔄 ${won ? "العب مجدداً" : "حاول مجدداً"}</button>
      <button class="btn block ghost" id="menu">القائمة</button>
    </div>`, "result");
  if ($("#next")) $("#next").onclick = () => startLevel(opts.level + 1);
  $("#again").onclick = () => startGame(opts);
  $("#menu").onclick = () => { closeModal(); opts.level != null ? campaign() : home(); };
}

$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" && !S) closeModal(); });
home();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
// للاختبارات الآلية فقط (?test)
if (/[?&]test\b/.test(location.search)) window.__sy = {
  get S() { return S; },
  autoplay(level = "hard") { S.auto = createAI(S.w, 0, level); S.w.players[0].incomeMul = 1; },
  start: (o) => startGame(o)
};
