// ============================================================
//  سيطرة: الشاشات، حلقة اللعب، التحكّم باللمس، الأصوات، الحفظ
// ============================================================
import { generateMap, TYPES } from "./mapgen.js";
import { createGame, step, command, canReach, totalTroops, districtsOf, seconds, rateOf, TICK, COLORS, PLAYER_NAMES } from "./sim.js";
import { createAI, thinkAll, LEVELS as AI_LEVELS } from "./ai.js";
import { createView, resize, draw, toMap, hitDistrict, addFx } from "./render.js";
import { LEVELS, starsFor } from "./levels.js";
import { seedToCode, codeToSeed, randomSeed } from "./rng.js";

const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const TICK_MS = TICK * 1000;
const store = {
  get(k, d) { try { const v = localStorage.getItem("saytara-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("saytara-" + k, JSON.stringify(v)); } catch {} }
};
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---------------- الأصوات (مولّدة، بلا ملفات) ----------------
let actx = null;
let soundOn = store.get("sound", true);
function tone(freqs, dur = 0.08, type = "triangle", gain = 0.12, glide = 0) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = type;
      const t0 = actx.currentTime + i * dur;
      o.frequency.setValueAtTime(f, t0);
      if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, t0 + dur);
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(gn).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    });
  } catch {}
}
const sfx = {
  select: () => tone([660], 0.05, "sine", 0.08),
  send: () => tone([300], 0.18, "sawtooth", 0.05, 2.2),
  capture: () => tone([523, 784], 0.09, "triangle", 0.12),
  lost: () => tone([330, 220], 0.14, "square", 0.06),
  clash: () => tone([120], 0.12, "square", 0.05, 0.5),
  win: () => tone([523, 659, 784, 1047], 0.13, "sine", 0.14),
  lose: () => tone([392, 330, 262, 196], 0.18, "triangle", 0.12)
};

// ---------------- النوافذ ----------------
function modal(html, cls = "") {
  const m = $("#modal");
  m.innerHTML = `<div class="sheet ${cls}">${html}</div>`;
  m.hidden = false;
}
const closeModal = () => { $("#modal").hidden = true; $("#modal").innerHTML = ""; };
function toast(t) {
  const el = document.createElement("div");
  el.className = "t"; el.textContent = t;
  $("#toast").appendChild(el);
  setTimeout(() => el.classList.add("out"), 1800);
  setTimeout(() => el.remove(), 2300);
}

// ---------------- الشاشة الرئيسية ----------------
function home() {
  stopGame();
  const prog = store.get("progress", { stars: {}, best: {} });
  const total = Object.values(prog.stars).reduce((a, b) => a + b, 0);
  $("#app").innerHTML = `
    <main class="home">
      <div class="logo">
        <div class="emblem"><span>🏙️</span></div>
        <h1>سيطرة</h1>
        <p>حرب المدن · استراتيجية بالوقت الحقيقي</p>
      </div>
      <div class="menu">
        <button class="btn big" id="campaign">🎖️ الحملة <small>${total} / ${LEVELS.length * 3} ⭐</small></button>
        <button class="btn big alt" id="quick">⚔️ معركة سريعة <small>اختر الخريطة والأعداء والصعوبة</small></button>
        <div class="row">
          <button class="btn ghost" id="help">📖 كيف ألعب؟</button>
          <button class="btn ghost" id="sound">${soundOn ? "🔊" : "🔇"} الصوت</button>
        </div>
      </div>
      <p class="foot">تعمل بدون إنترنت · بلا إعلانات</p>
    </main>`;
  $("#campaign").onclick = campaign;
  $("#quick").onclick = quickSetup;
  $("#help").onclick = help;
  $("#sound").onclick = () => { soundOn = !soundOn; store.set("sound", soundOn); home(); };
}

function help() {
  modal(`
    <h2>📖 كيف ألعب؟</h2>
    <div class="help">
      <p><b>🎯 الهدف:</b> احتلّ كل أحياء أعدائك. الأزرق لك، والرمادي محايد.</p>
      <p><b>👆 الهجوم:</b> اسحب إصبعك من حيّك إلى حي مجاور. يمكنك المرور على عدة أحياء لك أثناء السحب لتهاجم منها كلها معاً.</p>
      <p><b>⚔️ القتال:</b> إذا وصل جنودك أكثر من المدافعين احتللت الحي. والجنود المتقابلون على نفس الطريق يتقاتلون في منتصفه.</p>
      <p><b>📊 النسبة:</b> أزرار الأسفل تحدد كم ترسل من جنود كل حي: 25٪ أو 50٪ أو 75٪ أو الكل.</p>
      <p><b>🌉 النهر:</b> لا يُعبر إلا من الجسور، فالجسور مواقع حاسمة.</p>
      <p><b>🏛️ المقرّ</b> ينتج أسرع ودفاعه أقوى · <b>🏭 المصنع</b> إنتاج سريع · <b>⚡ محطة الكهرباء</b> تزيد إنتاج كل أحيائك ٢٠٪ · <b>✈️ المطار</b> يرسل جسراً جوياً إلى أي حي في المدينة · <b>🛡️ القاعدة</b> دفاعها مضاعف تقريباً.</p>
      <p><b>💡 نصيحة:</b> الحلقة حول الرقم تمتلئ حين يقترب الحي من حدّه الأقصى، فلا تترك جنودك ينتظرون بلا فائدة.</p>
    </div>
    <button class="btn block" id="ok">فهمت 👍</button>`);
  $("#ok").onclick = closeModal;
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
          <span class="foes">${L.ai.map((a, k) => `<i style="background:${COLORS[k + 1]}" title="${AI_LEVELS[a].name}"></i>`).join("")}<small>${L.ai.map((a) => AI_LEVELS[a].name).join(" · ")}</small></span>
          <span class="stars">${"★".repeat(st)}<em>${"★".repeat(3 - st)}</em></span>
          ${prog.best[i] ? `<small class="bt">⏱ ${fmt(prog.best[i])}</small>` : ""}
        </button>`;
      }).join("")}</div>
    </main>`;
  $("#back").onclick = home;
  $$(".lvl").forEach((b) => (b.onclick = () => startLevel(+b.dataset.i)));
}

function startLevel(i) {
  const L = LEVELS[i];
  startGame({ seed: L.seed, size: L.size, ai: L.ai, level: i, tutorial: L.tutorial });
}

// ---------------- المعركة السريعة ----------------
function quickSetup() {
  stopGame();
  const cfg = store.get("quick", { foes: 1, diff: "normal", size: "medium", code: seedToCode(randomSeed()) });
  const seg = (name, opts) => `<div class="seg" data-name="${name}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(cfg[name]) === String(v) ? "on" : ""}">${t}</button>`).join("")}</div>`;
  $("#app").innerHTML = `
    <main class="screen">
      <div class="top"><button class="icon" id="back">→</button><h2>⚔️ معركة سريعة</h2><span></span></div>
      <div class="form">
        <label>عدد الأعداء</label>${seg("foes", [[1, "واحد"], [2, "اثنان"], [3, "ثلاثة"]])}
        <label>الصعوبة</label>${seg("diff", [["easy", "سهل"], ["normal", "متوسط"], ["hard", "صعب"]])}
        <label>حجم المدينة</label>${seg("size", [["small", "صغيرة"], ["medium", "متوسطة"], ["large", "كبيرة"]])}
        <label>رمز الخريطة <small>شارك الرمز مع أصدقائك وتنافسوا على أسرع وقت في نفس الخريطة</small></label>
        <div class="code"><input id="code" value="${cfg.code}" maxlength="6" dir="ltr" autocomplete="off" spellcheck="false"><button class="btn ghost" id="dice">🎲 جديدة</button></div>
        <button class="btn big block" id="go">⚔️ ابدأ المعركة</button>
      </div>
    </main>`;
  $("#back").onclick = home;
  $$(".seg").forEach((s) => s.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    s.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    cfg[s.dataset.name] = s.dataset.name === "foes" ? +b.dataset.v : b.dataset.v;
  })));
  $("#dice").onclick = () => { $("#code").value = seedToCode(randomSeed()); };
  $("#go").onclick = () => {
    const seed = codeToSeed($("#code").value);
    if (seed == null) { toast("رمز الخريطة غير صحيح (6 حروف وأرقام)"); return; }
    cfg.code = seedToCode(seed);
    store.set("quick", cfg);
    startGame({ seed, size: cfg.size, ai: Array(cfg.foes).fill(cfg.diff), code: cfg.code });
  };
}

// ---------------- المعركة ----------------
let S = null; // الجلسة الحالية

function stopGame() {
  if (S) { cancelAnimationFrame(S.raf); window.removeEventListener("resize", S.onResize); document.removeEventListener("visibilitychange", S.onVis); }
  S = null;
}

function startGame(opts) {
  stopGame();
  closeModal();
  const map = generateMap({ seed: opts.seed, players: opts.ai.length + 1, size: opts.size });
  const g = createGame(map);
  const ais = opts.ai.map((lvl, k) => createAI(g, k + 1, lvl, opts.seed));
  $("#app").innerHTML = `
    <div class="game">
      <header class="ghud">
        <button class="icon" id="pause" aria-label="إيقاف مؤقت">⏸</button>
        <div class="power" id="power"></div>
        <div class="clock" id="clock">0:00</div>
      </header>
      <div class="tip" id="tip" hidden></div>
      <div class="stage"><canvas id="cv"></canvas></div>
      <footer class="gfoot">
        <div class="info" id="info">اسحب من حيّك الأزرق إلى حي مجاور لتهاجمه</div>
        <div class="pct">${[0.25, 0.5, 0.75, 1].map((p) => `<button data-p="${p}" class="${p === store.get("pct", 0.5) ? "on" : ""}">${p === 1 ? "الكل" : Math.round(p * 100) + "٪"}</button>`).join("")}</div>
      </footer>
    </div>`;
  const view = createView($("#cv"));
  S = { opts, map, g, ais, view, ui: { sources: [], hover: null, pointer: null, pct: store.get("pct", 0.5), dragging: false, moved: false }, acc: 0, last: performance.now(), paused: false, speed: 1, ended: false, hudAt: 0, tip: 0 };
  S.onResize = () => resize(view, map);
  S.onVis = () => { if (document.hidden && !S.ended) pause(); };
  window.addEventListener("resize", S.onResize);
  document.addEventListener("visibilitychange", S.onVis);
  resize(view, map);
  bindInput();
  $("#pause").onclick = pause;
  $$(".pct button").forEach((b) => (b.onclick = () => {
    S.ui.pct = +b.dataset.p; store.set("pct", S.ui.pct);
    $$(".pct button").forEach((x) => x.classList.toggle("on", x === b));
  }));
  if (opts.tutorial) showTip(0);
  S.raf = requestAnimationFrame(frame);
}

function frame(now) {
  if (!S) return;
  const { g } = S;
  if (!S.paused && !g.over) {
    S.acc += Math.min(250, now - S.last) * S.speed;
    while (S.acc >= TICK_MS) {
      thinkAll(g, S.ais);
      step(g);
      S.acc -= TICK_MS;
      for (const ev of g.events.splice(0)) onEvent(ev, now);
      if (g.over) break;
    }
  }
  S.last = now;
  draw(S.view, g, S.ui, now, S.paused ? 0 : S.acc / TICK_MS);
  if (now - S.hudAt > 200) { S.hudAt = now; hud(); }
  if (g.over && !S.ended) { S.ended = true; setTimeout(result, 900); }
  S.raf = requestAnimationFrame(frame);
}

function onEvent(ev, now) {
  addFx(S.view, ev, S.g, now);
  if (ev.type === "capture") {
    if (ev.p === 0) { sfx.capture(); if (S.opts.tutorial) tutorialProgress("capture", ev); }
    else if (ev.from === 0) { sfx.lost(); navigator.vibrate?.(40); }
  }
  if (ev.type === "clash") sfx.clash();
  if (ev.type === "eliminated" && ev.p !== 0) toast(`💥 خرج ${PLAYER_NAMES[ev.p]} من المعركة!`);
}

function hud() {
  const { g } = S;
  const tot = g.players.map((p) => Math.max(0, totalTroops(g, p.id)));
  const sum = tot.reduce((a, b) => a + b, 0) || 1;
  $("#power").innerHTML = g.players.map((p) => `<i style="width:${(tot[p.id] / sum) * 100}%;background:${p.color}" class="${p.alive ? "" : "dead"}"></i>`).join("");
  $("#clock").textContent = fmt(seconds(g));
  const sel = S.ui.sources;
  const info = $("#info");
  const focus = S.ui.hover != null ? S.ui.hover : sel.length === 1 ? sel[0] : null;
  if (focus != null) {
    const d = S.map.districts[focus], x = g.d[focus], T = TYPES[d.type];
    const who = x.owner === 0 ? "لك" : x.owner > 0 ? PLAYER_NAMES[x.owner] : "محايد";
    info.innerHTML = `<b>${T.icon || "🏘️"} ${d.name}</b> · ${who} · ⚔️ ${Math.floor(x.troops)}${x.owner >= 0 ? ` · +${rateOf(g, focus).toFixed(1)}/ث` : ""}${T.def > 1 ? ` · دفاع ×${T.def}` : ""}`;
  } else if (sel.length > 1) info.textContent = `${sel.length} أحياء محدّدة · اختر الهدف`;
  else info.innerHTML = `أحياؤك: <b>${districtsOf(g, 0)}</b> · جنودك: <b>${Math.floor(tot[0])}</b>`;
}

// ---------------- التحكّم باللمس ----------------
function bindInput() {
  const cv = $("#cv");
  const at = (e) => { const p = toMap(S.view, e.clientX, e.clientY); return { p, i: hitDistrict(S.view, S.map, p.x, p.y) }; };
  cv.addEventListener("pointerdown", (e) => {
    if (S.paused || S.g.over) return;
    cv.setPointerCapture(e.pointerId);
    const { p, i } = at(e);
    const ui = S.ui;
    ui.pointer = p; ui.down = { x: e.clientX, y: e.clientY }; ui.moved = false;
    if (i < 0) return;
    if (ui.sources.length && !ui.dragging) {
      // وضع النقر: مصادر محددة سابقاً، والنقر الآن على الهدف
      if (ui.sources.length === 1 && ui.sources[0] === i) { ui.sources = []; ui.hover = null; return; }
      ui.pending = i;
      return;
    }
    if (S.g.d[i].owner === 0) { ui.sources = [i]; ui.dragging = true; sfx.select(); }
  });
  cv.addEventListener("pointermove", (e) => {
    const ui = S.ui;
    if (!ui.dragging) return;
    const { p, i } = at(e);
    ui.pointer = p;
    if (Math.hypot(e.clientX - ui.down.x, e.clientY - ui.down.y) > 8) ui.moved = true;
    ui.hover = i >= 0 ? i : null;
    // المرور على أحياء لك يضيفها إلى المهاجمين
    if (i >= 0 && S.g.d[i].owner === 0 && !ui.sources.includes(i) && ui.moved) {
      const last = ui.sources[ui.sources.length - 1];
      if (S.map.districts[last].nb.includes(i)) { ui.sources.push(i); sfx.select(); }
    }
  });
  const up = (e) => {
    const ui = S.ui;
    const { i } = at(e);
    if (ui.pending != null) {
      const t = ui.pending; ui.pending = null;
      if (t === i) send(ui.sources, t);
      return;
    }
    if (!ui.dragging) return;
    ui.dragging = false;
    if (!ui.moved) { ui.hover = null; return; }       // نقرة واحدة: يبقى الحي محدداً
    if (i < 0) { ui.sources = []; ui.hover = null; return; }
    // إذا انتهى السحب على آخر حي أضفناه، فالهدف هو الحي الذي قبله (تعزيز)
    let srcs = ui.sources, target = i;
    if (srcs.length > 1 && srcs[srcs.length - 1] === i) srcs = srcs.slice(0, -1);
    else if (srcs.includes(i)) { ui.sources = []; ui.hover = null; return; }
    send(srcs, target);
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", () => { S.ui.dragging = false; S.ui.sources = []; S.ui.hover = null; });
}

function send(srcs, target) {
  const ui = S.ui, g = S.g;
  const ok = srcs.filter((s) => g.d[s].owner === 0 && canReach(g, s, target) && g.d[s].troops >= 1);
  ui.sources = []; ui.hover = null; ui.pointer = null;
  if (!ok.length) { toast(srcs.length && srcs.some((s) => !canReach(g, s, target)) ? "بعيد! هاجم الأحياء المجاورة فقط (أو من المطار ✈️)" : "لا جنود كافية"); return; }
  command(g, { type: "send", p: 0, from: ok, to: target, pct: ui.pct });
  sfx.send();
  if (S.opts.tutorial) tutorialProgress("send");
}

// ---------------- الدرس الأول ----------------
const TIPS = [
  "👆 اسحب إصبعك من مقرّك الأزرق 🏛️ إلى حي رمادي مجاور له",
  "👏 ممتاز! أحياؤك تنتج جنوداً باستمرار. احتلّ أحياء أكثر لتكبر قوتك",
  "🏭 المصنع ينتج بسرعة: احتلّه! ويمكنك السحب عبر عدّة أحياء لك لتهاجم منها معاً",
  "🔴 الآن اهجم على الأحمر واحتلّ مقرّه وكل أحيائه"
];
function showTip(k) {
  S.tip = k;
  const t = $("#tip");
  if (k >= TIPS.length) { t.hidden = true; return; }
  t.hidden = false; t.textContent = TIPS[k];
}
function tutorialProgress(kind) {
  const n = districtsOf(S.g, 0);
  if (S.tip === 0 && kind === "capture") showTip(1);
  else if (S.tip === 1 && n >= 4) showTip(2);
  else if (S.tip === 2 && n >= 6) showTip(3);
  else if (S.tip === 3 && kind === "capture" && n >= 8) setTimeout(() => S && showTip(9), 3000);
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
  const resume = () => { closeModal(); S.paused = false; S.last = performance.now(); };
  $("#resume").onclick = resume;
  $$("#spd button").forEach((b) => (b.onclick = () => { S.speed = +b.dataset.v; $$("#spd button").forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#restart").onclick = () => startGame(S.opts);
  $("#helpP").onclick = () => { help(); $("#ok").onclick = pause; };
  $("#soundP").onclick = () => { soundOn = !soundOn; store.set("sound", soundOn); pause(); };
  $("#quit").onclick = () => { closeModal(); S.opts.level != null ? campaign() : home(); };
}

// ---------------- النتيجة ----------------
function result() {
  if (!S) return;
  const { g, opts } = S;
  const won = g.winner === 0;
  const secs = seconds(g);
  const st = g.stats[0];
  won ? sfx.win() : sfx.lose();
  let extra = "";
  if (opts.level != null) {
    const L = LEVELS[opts.level];
    const stars = starsFor(L, won, secs);
    const prog = store.get("progress", { stars: {}, best: {} });
    if (stars > (prog.stars[opts.level] || 0)) prog.stars[opts.level] = stars;
    if (won && (!prog.best[opts.level] || secs < prog.best[opts.level])) prog.best[opts.level] = secs;
    store.set("progress", prog);
    extra = `<div class="bigstars">${"★".repeat(stars)}<em>${"★".repeat(3 - stars)}</em></div>
      ${won ? `<p class="par">⭐⭐⭐ في أقل من ${fmt(L.par)} · أفضل وقت لك: ${fmt(prog.best[opts.level])}</p>` : ""}`;
  } else if (opts.code) {
    const key = `${opts.code}-${opts.ai.length}-${opts.ai[0]}-${opts.size}`;
    const bests = store.get("codes", {});
    const prev = bests[key];
    if (won && (!prev || secs < prev)) { bests[key] = secs; store.set("codes", bests); }
    extra = `<p class="par">رمز الخريطة: <b dir="ltr">${opts.code}</b>${won ? ` · ${!prev || secs < prev ? "🏆 أفضل وقت لك!" : `أفضل وقت لك: ${fmt(prev)}`}` : ""}</p>`;
  }
  const next = opts.level != null && won && opts.level < LEVELS.length - 1;
  modal(`
    <div class="res-icon">${won ? "🏆" : "🏳️"}</div>
    <h2>${won ? "انتصرت! المدينة تحت سيطرتك" : "خسرت المعركة"}</h2>
    ${extra}
    <div class="sgrid">
      <div><b>${fmt(secs)}</b><small>مدة المعركة</small></div>
      <div><b>${st.captured}</b><small>أحياء احتللتها</small></div>
      <div><b>${st.sent}</b><small>جنود أرسلتهم</small></div>
      <div><b>${st.peak}</b><small>أكبر جيش لك</small></div>
    </div>
    <div class="col">
      ${next ? `<button class="btn block" id="next">التالية ⬅</button>` : ""}
      <button class="btn block ${next ? "alt" : ""}" id="again">🔄 ${won ? "العب مجدداً" : "حاول مجدداً"}</button>
      <button class="btn block ghost" id="menu">القائمة</button>
    </div>`, "result");
  if ($("#next")) $("#next").onclick = () => startLevel(opts.level + 1);
  $("#again").onclick = () => startGame(opts);
  $("#menu").onclick = () => { closeModal(); opts.level != null ? campaign() : home(); };
}

$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" && !S) closeModal(); });
// للاختبارات الآلية فقط (?test): يتيح جعل اللاعب الأزرق يلعب آلياً
if (/[?&]test\b/.test(location.search)) window.__sy = { get S() { return S; }, createAI, autoplay(level = "hard") { S.ais.push(createAI(S.g, 0, level, 7)); } };
home();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
