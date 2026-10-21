// ============================================================
//  ألعاب حروفي: لعبة لكل قسم تنمّي مهارته بطريقة يحبها الأطفال
//  محرك مشترك: الوقت، النقاط، الأخطاء، التكرار الذكي. لا خسارة في أي لعبة.
// ============================================================
import { LETTERS, SIMILAR_GROUPS, LETTER_WORDS, ALL_WORDS, SPELL_WORDS, CATEGORIES, HARAKAT, NUMBERS, SHOP_ITEMS } from "./data.js";
import { store } from "./store.js";
import { LANG, ageRank } from "./lang.js";
import { speak, stopSpeech, speechDone, sfx, canHear } from "./sfx.js";
import { render, $, $$, esc, shuffle, pick, randomOf, toArabicDigits, contentDigits } from "./util.js";
import { placeText } from "./tracecheck.js";

// «كبير» تعني 6 سنوات فما فوق (تشمل فئة 9–12 في تطبيق الإنجليزية)
const big = () => ageRank(store.active.age) >= 1;
const byLetter = Object.fromEntries(LETTERS.map((L) => [L.l, L]));
const groupOf = (l) => SIMILAR_GROUPS.find((g) => g.includes(l)) || [];

// ------------------------------------------------------------
//  المحرك المشترك
// ------------------------------------------------------------
export function runArcade(act, { onExit, onFinish }) {
  const G = GAMES[act.mode];
  const st = {
    act, alive: true, score: 0, mistakes: 0, goal: G.goal(), timers: new Set(), rafs: new Set(), finishing: false
  };
  const tick = setInterval(() => { if (!document.hidden) store.addSeconds(5); }, 5000);

  st.later = (fn, ms) => {
    const t = setTimeout(() => { st.timers.delete(t); if (st.alive) fn(); }, ms);
    st.timers.add(t);
    return t;
  };
  st.every = (fn, ms) => {
    const t = setInterval(() => { if (st.alive && !document.hidden) fn(); }, ms);
    st.timers.add(t);
    return t;
  };
  // حلقة حركة: fn(dt بالثواني)
  st.loop = (fn) => {
    let last = performance.now();
    const step = (now) => {
      if (!st.alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) fn(dt);
      const id = requestAnimationFrame(step);
      st.rafs.add(id);
    };
    st.rafs.add(requestAnimationFrame(step));
  };
  const stop = () => {
    st.alive = false;
    st.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    st.rafs.forEach(cancelAnimationFrame);
    clearInterval(tick);
    stopSpeech();
  };

  st.updateHud = () => {
    $("#ascore").textContent = `${toArabicDigits(Math.min(st.score, st.goal))} / ${toArabicDigits(st.goal)}`;
    $("#abar").style.width = `${(Math.min(st.score, st.goal) / st.goal) * 100}%`;
  };
  st.setTask = (html, sayText, slow = false) => {
    $("#atask").innerHTML = html;
    st.sayText = sayText;
    st.slow = slow;
    if (sayText) speak(sayText, { slow });
    const note = $("#anote");
    note.innerHTML = !canHear() && sayText && store.active.age === "small"
      ? `👪 لا يوجد صوت في الجهاز، اقرأ لطفلك: <b>«${esc(sayText)}»</b>` : "";
  };
  // إصابة صحيحة
  st.hit = (key) => {
    if (!st.alive || st.finishing) return;
    st.score++;
    if (key) store.record(key, true);
    sfx.right();
    st.updateHud();
    if (st.score >= st.goal) {
      st.finishing = true;
      // ننتظر انتهاء آخر نطق ثم ننهي
      Promise.race([Promise.all([new Promise((r) => setTimeout(r, 900)), new Promise((r) => setTimeout(r, 80)).then(speechDone)]), new Promise((r) => setTimeout(r, 5000))])
        .then(() => { if (!st.alive) return; stop(); onFinish({ firstTry: st.goal - Math.min(st.goal, st.mistakes), total: st.goal, mistakes: st.mistakes }); });
    }
  };
  // خطأ
  st.miss = (key, target, chosen) => {
    if (!st.alive || st.finishing) return;
    st.mistakes++;
    if (key) store.record(key, false);
    if (target && chosen) store.confuse(target, chosen);
    sfx.wrong();
  };

  // نزيل احتفال الشاشة السابقة
  const conf = document.getElementById("confetti");
  if (conf) conf.innerHTML = "";

  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="خروج">✖</button>
      <b class="session-title">${act.icon} ${esc(act.title)}</b>
      <span class="ascore" id="ascore"></span>
    </div>
    <div class="abar"><i id="abar"></i></div>
    <div class="atask-row">
      <div class="atask" id="atask"></div>
      <button class="speak" id="asay" aria-label="استمع">🔊</button>
    </div>
    <div class="anote" id="anote"></div>
    <div class="stage stage-${act.mode}" id="stage"></div>
  `);
  $("#back").onclick = () => { stop(); onExit(); };
  $("#asay").onclick = () => st.sayText && speak(st.sayText, { slow: st.slow });
  st.stage = $("#stage");
  st.updateHud();
  G.start(st);
  return st;
}

// عنصر داخل المسرح
function el(parent, cls, html = "") {
  const d = document.createElement("div");
  d.className = cls;
  d.innerHTML = html;
  parent.appendChild(d);
  return d;
}

function burst(parent, x, y, emoji = "✨") {
  const b = el(parent, "burst", emoji);
  b.style.left = x + "px";
  b.style.top = y + "px";
  setTimeout(() => b.remove(), 700);
}

// ------------------------------------------------------------
//  الألعاب
// ------------------------------------------------------------
const GAMES = {
  // 👂 فقاعات الأصوات: فقّع الصور التي تبدأ بالصوت المطلوب
  bubbles: {
    goal: () => (big() ? 10 : 8),
    start(st) {
      const stage = st.stage;
      const H = () => stage.clientHeight;
      const bubbles = [];
      let target = null;
      let sinceTarget = 0;
      let hitsOnTarget = 0;

      const newTarget = () => {
        [target] = store.pickWeighted(LETTERS.filter((L) => LETTER_WORDS[L.l].length >= 2), (L) => "snd:" + L.l);
        hitsOnTarget = 0;
        const ex = LETTER_WORDS[target.l][0];
        st.setTask(`<span class="big-l">${target.l}</span><span>فقّع الصور التي تبدأ بحرف <b>${target.name}</b><br><small>مثل ${ex.emoji} ${ex.w}</small></span>`,
          `فقّع الصور التي تبدأ بحرف ${target.name}، مثل ${ex.w}`);
      };
      const spawn = () => {
        if (bubbles.length >= (big() ? 7 : 5)) return;
        const isTarget = sinceTarget >= 2 || Math.random() < 0.45;
        let w;
        if (isTarget) { w = randomOf(LETTER_WORDS[target.l]); sinceTarget = 0; }
        else {
          const L = randomOf(LETTERS.filter((x) => x !== target && !groupOf(target.l).includes(x.l) && LETTER_WORDS[x.l]?.length && !(target.alike || []).includes(x.l)));
          w = randomOf(LETTER_WORDS[L.l]);
          sinceTarget++;
        }
        const b = el(stage, "bubble", `<span>${w.emoji}</span>`);
        const size = big() ? 74 : 86;
        b.style.width = b.style.height = size + "px";
        const x = 8 + Math.random() * (stage.clientWidth - size - 16);
        const o = { el: b, w, x, y: H(), speed: H() / ((big() ? 5.2 : 6.5) + Math.random()), wob: Math.random() * 6, good: isTarget, letter: target.l };
        b.style.left = x + "px";
        bubbles.push(o);
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (o.dead) return;
          if (o.w.w[0] === target.l || (target.l === "أ" && /^[أإآا]/.test(o.w.w))) {
            o.dead = true;
            b.classList.add("pop");
            burst(stage, o.x + size / 2, o.y, "💥");
            speak(o.w.w);
            st.hit("snd:" + target.l);
            setTimeout(() => b.remove(), 300);
            if (++hitsOnTarget >= 3 && st.score < st.goal) st.later(newTarget, 700);
          } else {
            b.classList.remove("no"); void b.offsetWidth; b.classList.add("no");
            speak(o.w.w);
            st.miss("snd:" + target.l);
          }
        });
      };
      newTarget();
      spawn();
      st.every(spawn, big() ? 950 : 1250);
      st.loop((dt) => {
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const o = bubbles[i];
          if (o.dead) { bubbles.splice(i, 1); continue; }
          o.y -= o.speed * dt;
          o.wob += dt * 2;
          o.el.style.transform = `translate(${Math.sin(o.wob) * 8}px, ${o.y}px)`;
          if (o.y < -100) { o.el.remove(); bubbles.splice(i, 1); }
        }
      });
    }
  },

  // 🔤 اضرب الخُلد: اضرب الخُلد الذي يحمل الحرف المطلوب
  mole: {
    goal: () => (big() ? 12 : 9),
    start(st) {
      const stage = st.stage;
      const holes = [];
      for (let i = 0; i < 9; i++) {
        const h = el(stage, "hole", `<div class="mole"><span class="mface">🐹</span><span class="mletter"></span></div><div class="dirt"></div>`);
        holes.push({ el: h, mole: h.querySelector(".mole"), up: false });
      }
      let target = null;
      let hitsOnTarget = 0;
      let sinceTarget = 0;
      const newTarget = () => {
        [target] = store.pickWeighted(LETTERS, (L) => "rec:" + L.l);
        hitsOnTarget = 0;
        st.setTask(`<span class="big-l">${target.l}</span><span>اضرب الخُلد الذي يحمل حرف <b>${target.name}</b></span>`, `اضرب حرف ${target.name}`);
      };
      const upTime = () => (big() ? 1500 : 2100) - Math.min(st.score, 8) * 40;
      const popUp = () => {
        const free = holes.filter((h) => !h.up);
        if (!free.length) return;
        const h = randomOf(free);
        const isTarget = sinceTarget >= 2 || Math.random() < 0.42;
        let letter;
        if (isTarget) { letter = target.l; sinceTarget = 0; }
        else {
          const sim = groupOf(target.l).filter((x) => x !== target.l);
          letter = sim.length && Math.random() < 0.45 ? randomOf(sim) : randomOf(LETTERS.filter((x) => x !== target)).l;
          sinceTarget++;
        }
        h.letter = letter;
        h.up = true;
        h.hit = false;
        h.mole.querySelector(".mletter").textContent = letter;
        h.mole.querySelector(".mface").textContent = randomOf(["🐹", "🐭", "🐰", "🐻"]);
        h.el.classList.add("up");
        h.el.classList.remove("bonk", "nope");
        const id = ++h.seq || (h.seq = 1);
        st.later(() => { if (h.seq === id && !h.hit) { h.up = false; h.el.classList.remove("up"); } }, upTime());
      };
      holes.forEach((h) => h.mole.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (!h.up || h.hit) return;
        if (h.letter === target.l) {
          h.hit = true;
          h.el.classList.add("bonk");
          speak(target.name);
          st.hit("rec:" + target.l);
          st.later(() => { h.up = false; h.el.classList.remove("up", "bonk"); }, 450);
          if (++hitsOnTarget >= 3 && st.score < st.goal) st.later(newTarget, 600);
        } else {
          h.el.classList.remove("nope"); void h.el.offsetWidth; h.el.classList.add("nope");
          speak(byLetter[h.letter]?.name || h.letter);
          st.miss("rec:" + target.l, target.l, h.letter);
        }
      }));
      newTarget();
      st.later(popUp, 600);
      st.every(popUp, big() ? 800 : 1100);
    }
  },

  // 🔡 قطار المقاطع: اربط عربات المقاطع بالترتيب لينطلق القطار
  train: {
    goal: () => (big() ? 6 : 4),
    start(st) {
      const stage = st.stage;
      // البديل الخاطئ: تغيير الحركة في العربية، أو تغيير حرف العلة في الإنجليزية
      const marks = LANG.code === "ar" ? ["َ", "ُ", "ِ"] : ["a", "e", "i", "o", "u"];
      const alt = (sy) => {
        const m = [...sy].find((c) => marks.includes(c));
        return m ? sy.replace(m, randomOf(marks.filter((x) => x !== m))) : null;
      };
      const pool = big()
        ? SPELL_WORDS
        : SPELL_WORDS.filter((w) => w.easy ?? (w.syl.length === 2 && (w.type === "madd" || w.type === "sukun")));
      const nextWord = () => {
        stage.innerHTML = "";
        const [w] = store.pickWeighted(pool, (x) => "tj:" + x.w);
        const extras = [];
        for (const sy of shuffle(w.syl)) { const a = alt(sy); if (a && !w.syl.includes(a) && !extras.includes(a)) extras.push(a); if (extras.length >= (big() ? 2 : 1)) break; }
        st.setTask(`<span class="big-pic">${w.emoji}</span><span>اربط عربات المقاطع بالترتيب<br><small>لتكوّن الكلمة التي تسمعها</small></span>`, `${w.w}... ${w.w}`, true);
        const track = el(stage, "track");
        const train = el(track, "train");
        el(train, "engine", "🚂");
        const slots = w.syl.map(() => el(train, "wagon empty", ""));
        el(stage, "rails");
        const depot = el(stage, "depot");
        let pos = 0;
        let wrong = 0;
        shuffle([...w.syl, ...extras]).forEach((sy) => {
          const t = el(depot, "wtile", `<span>${sy}</span>`);
          t.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (t.classList.contains("used") || pos >= w.syl.length) return;
            speak(sy, { slow: true });
            if (sy === w.syl[pos]) {
              t.classList.add("used");
              slots[pos].classList.remove("empty");
              slots[pos].innerHTML = `<span>${sy}</span>`;
              slots[pos].classList.add("attach");
              pos++;
              wrong = 0;
              $$(".wtile").forEach((x) => x.classList.remove("hint"));
              if (pos === w.syl.length) {
                st.later(() => speak(`${w.syl.join("، ")}... ${w.w}`), 500);
                st.later(() => train.classList.add("go"), 1700);
                st.hit("tj:" + w.w);
                if (st.score < st.goal) st.later(nextWord, 3600);
              }
            } else {
              t.classList.remove("no"); void t.offsetWidth; t.classList.add("no");
              st.miss("tj:" + w.w);
              if (++wrong >= 2) [...depot.children].find((x) => x.textContent === w.syl[pos] && !x.classList.contains("used"))?.classList.add("hint");
            }
          });
        });
      };
      nextWord();
    }
  },

  // ✏️ طريق الحرف: قُد السيارة على طريق الحرف حتى تلوّنه كله
  maze: {
    goal: () => 3,
    start(st) {
      const stage = st.stage;
      const nextLetter = () => {
        stage.innerHTML = "";
        const [L] = store.pickWeighted(LETTERS, (x) => "trc:" + x.l);
        st.dotHint = false;
        st.setTask(`<span class="big-l">${L.l}</span><span>قُد السيارة على طريق حرف <b>${L.name}</b><br><small>لوّن الطريق كله دون أن تخرج منه</small></span>`, `قد السيارة على طريق حرف ${L.name}`);
        const wrap = el(stage, "maze-wrap");
        const size = Math.min(stage.clientWidth, stage.clientHeight) - 8;
        wrap.style.width = wrap.style.height = size + "px";
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const road = document.createElement("canvas");
        const trail = document.createElement("canvas");
        [road, trail].forEach((c) => { c.width = c.height = size * dpr; c.style.width = c.style.height = size + "px"; wrap.appendChild(c); });
        const rctx = road.getContext("2d");
        const tctx = trail.getContext("2d");
        rctx.scale(dpr, dpr);
        tctx.scale(dpr, dpr);

        // الطريق: الحرف بخط عريض
        const draw = (ctx, color, extra) => {
          const pl = placeText(ctx, size, L.l);
          ctx.fillStyle = color;
          ctx.fillText(L.l, pl.x, pl.y);
          ctx.lineWidth = pl.px * extra;
          ctx.strokeStyle = color;
          ctx.lineJoin = "round";
          ctx.strokeText(L.l, pl.x, pl.y);
          return pl;
        };
        const pl = draw(rctx, "#cfd8dc", 0.16);
        rctx.setLineDash([8, 10]);
        rctx.lineWidth = 3;
        rctx.strokeStyle = "#fff";
        rctx.strokeText(L.l, pl.x, pl.y);
        rctx.setLineDash([]);

        // قناع الطريق للفحص (شبكة صغيرة)
        const N = 100;
        const mc = document.createElement("canvas"); mc.width = mc.height = N;
        const mctx = mc.getContext("2d", { willReadFrequently: true });
        const plN = placeText(mctx, N, L.l);
        mctx.fillText(L.l, plN.x, plN.y);
        mctx.lineWidth = plN.px * 0.2; mctx.lineJoin = "round"; mctx.strokeText(L.l, plN.x, plN.y);
        const roadMask = mctx.getImageData(0, 0, N, N).data;
        const onRoad = (x, y) => {
          const gx = Math.floor((x / size) * N), gy = Math.floor((y / size) * N);
          return gx >= 0 && gy >= 0 && gx < N && gy < N && roadMask[(gy * N + gx) * 4 + 3] > 40;
        };
        // الخلايا الأساسية للحرف (التي يجب تلوينها)
        const cc = document.createElement("canvas"); cc.width = cc.height = N;
        const cctx = cc.getContext("2d", { willReadFrequently: true });
        const plC = placeText(cctx, N, L.l);
        cctx.fillText(L.l, plC.x, plC.y);
        const coreData = cctx.getImageData(0, 0, N, N).data;
        const coreCells = [];
        for (let i = 0; i < N * N; i++) if (coreData[i * 4 + 3] > 40) coreCells.push(i);
        const covered = new Set();

        // نقطة البداية: أعلى الحرف من جهة الكتابة (يمين في العربية، يسار في الإنجليزية)
        let start = null;
        const ltr = LANG.contentDir === "ltr";
        for (let k = 0; k < N && !start; k++) for (let gy = 0, gx = ltr ? k : N - 1 - k; gy < N; gy++) {
          if (coreData[(gy * N + gx) * 4 + 3] > 40) { start = { x: ((gx + 0.5) / N) * size, y: ((gy + 0.5) / N) * size }; break; }
        }
        const car = el(wrap, "car", "🚗");
        const flag = el(wrap, "flagpin", "🏁");
        let carPos = { ...start };
        const placeCar = () => { car.style.left = carPos.x + "px"; car.style.top = carPos.y + "px"; };
        placeCar();
        flag.style.display = "none";

        tctx.lineCap = "round";
        tctx.lineJoin = "round";
        tctx.strokeStyle = "#2bb673";
        tctx.lineWidth = pl.px * 0.22;
        let driving = false;
        let offCount = 0;
        let missed = false;
        const pt = (e) => { const r = trail.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
        const paintAt = (a, b) => {
          tctx.beginPath(); tctx.moveTo(a.x, a.y); tctx.lineTo(b.x, b.y); tctx.stroke();
          // نقصّ الأثر بشكل الطريق حتى لا يخرج عنه
          tctx.save();
          tctx.globalCompositeOperation = "destination-in";
          draw(tctx, "#000", 0.16);
          tctx.restore();
          // نحسب الخلايا المغطّاة على امتداد الخط
          const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
          const rad = Math.ceil((pl.px * 0.1 / size) * N);
          for (let k = 0; k <= steps; k++) {
            const x = a.x + ((b.x - a.x) * k) / steps, y = a.y + ((b.y - a.y) * k) / steps;
            const gx = Math.floor((x / size) * N), gy = Math.floor((y / size) * N);
            for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
              const cx = gx + dx, cy = gy + dy;
              if (cx >= 0 && cy >= 0 && cx < N && cy < N) covered.add(cy * N + cx);
            }
          }
        };
        // أجزاء الحرف المنفصلة (الجسم والنقاط): يجب المرور على كل جزء
        const comp = new Int32Array(N * N).fill(-1);
        const parts = [];
        for (const i0 of coreCells) {
          if (comp[i0] >= 0) continue;
          const id = parts.length, cells = [i0];
          comp[i0] = id;
          for (let k = 0; k < cells.length; k++) {
            const i = cells[k], x = i % N, y = (i / N) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + dx, ny = y + dy, j = ny * N + nx;
              if (nx >= 0 && ny >= 0 && nx < N && ny < N && comp[j] < 0 && coreData[j * 4 + 3] > 40) { comp[j] = id; cells.push(j); }
            }
          }
          if (cells.length >= 4) parts.push(cells);
        }
        const partsDone = () => parts.every((cells) => cells.filter((i) => covered.has(i)).length / cells.length >= 0.6);
        const progress = () => coreCells.filter((i) => covered.has(i)).length / coreCells.length;
        const meter = el(stage, "maze-meter", `<i></i>`);
        const done = () => {
          driving = false;
          car.textContent = "🏎️";
          speak(`رائع! حرف ${L.name}`);
          st.hit("trc:" + L.l);
          if (st.score < st.goal) st.later(nextLetter, 2200);
        };
        trail.addEventListener("pointerdown", (e) => {
          const p = pt(e);
          // نبدأ من السيارة، أو من أي نقطة ملوّنة سابقاً على الطريق
          if (Math.hypot(p.x - carPos.x, p.y - carPos.y) < 46 || (onRoad(p.x, p.y) && covered.size)) {
            trail.setPointerCapture(e.pointerId);
            driving = true;
            if (onRoad(p.x, p.y)) carPos = p;
            placeCar();
          }
        });
        trail.addEventListener("pointermove", (e) => {
          if (!driving) return;
          const p = pt(e);
          if (onRoad(p.x, p.y)) {
            paintAt(carPos, p);
            carPos = p;
            placeCar();
            car.classList.remove("bump");
            const pr = progress();
            meter.firstChild.style.width = `${Math.round(pr * 100)}%`;
            if (pr >= 0.82 && partsDone()) done();
            else if (pr >= 0.82 && !st.dotHint) { st.dotHint = true; speak("لا تنس النقاط"); }
          } else if (Math.hypot(p.x - carPos.x, p.y - carPos.y) > 30) {
            // خرج عن الطريق: السيارة تتوقف، وبعد عدة مرات نحتسب خطأ واحداً
            driving = false;
            car.classList.remove("bump"); void car.offsetWidth; car.classList.add("bump");
            sfx.tap();
            if (++offCount >= 4 && !missed) { missed = true; st.miss("trc:" + L.l); }
          }
        });
        const end = () => { driving = false; };
        trail.addEventListener("pointerup", end);
        trail.addEventListener("pointercancel", end);
      };
      nextLetter();
    }
  },

  // 📖 سباق الكلمات: اضغط السيارة التي تحمل الكلمة المطلوبة قبل أن تعبر
  race: {
    goal: () => 8,
    start(st) {
      const stage = st.stage;
      const lanes = [0, 1, 2].map((i) => el(stage, "lane", ""));
      const cars = [];
      let target = null;
      let since = 0;
      const pool = ALL_WORDS.filter((w) => [...w.w].length <= 5);
      const newTarget = () => {
        [target] = store.pickWeighted(pool, (w) => "w:" + w.w);
        since = 0;
        st.setTask(`<span class="big-pic">${target.emoji}</span><span>اضغط على السيارة التي تحمل اسم الصورة</span>`, target.w);
      };
      const spawn = () => {
        const free = lanes.filter((ln) => !cars.some((c) => c.lane === ln && c.x < 140));
        if (!free.length) return;
        const lane = randomOf(free);
        const isT = since >= 2 || Math.random() < 0.35;
        const w = isT ? target : randomOf(pool.filter((x) => x.w !== target.w && x.emoji !== target.emoji));
        since = isT ? 0 : since + 1;
        const c = el(lane, "rcar", `<span class="rbody">${randomOf(["🚗", "🚕", "🚙", "🚌", "🚓"])}</span><span class="rword">${w.w}</span>`);
        const o = { el: c, w, lane, x: -10, speed: stage.clientWidth / ((big() ? 5 : 6.5) - Math.min(st.score, 6) * 0.2) };
        cars.push(o);
        c.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (o.dead) return;
          if (o.w.w === target.w) {
            o.dead = true;
            c.classList.add("zoom");
            speak(target.w);
            st.hit("w:" + target.w);
            setTimeout(() => c.remove(), 500);
            if (st.score < st.goal) st.later(newTarget, 800);
          } else {
            c.classList.remove("no"); void c.offsetWidth; c.classList.add("no");
            st.miss("w:" + target.w, target.w, o.w.w);
          }
        });
      };
      newTarget();
      spawn();
      st.every(spawn, 1300);
      st.loop((dt) => {
        const W = stage.clientWidth;
        for (let i = cars.length - 1; i >= 0; i--) {
          const o = cars[i];
          if (o.dead) { cars.splice(i, 1); continue; }
          o.x += o.speed * dt;
          // السيارات تسير من اليمين إلى اليسار
          o.el.style.transform = `translateX(${-o.x}px)`;
          if (o.x > W + 160) {
            if (o.w.w === target.w) speak(target.w);
            o.el.remove(); cars.splice(i, 1);
          }
        }
      });
    }
  },

  // 🧠 سلال التصنيف: اسحب كل شيء إلى سلّته
  baskets: {
    goal: () => (big() ? 12 : 8),
    start(st) {
      const stage = st.stage;
      const cats = pick(big() ? CATEGORIES : CATEGORIES.slice(0, 3), big() ? 3 : 2);
      st.setTask(`<span>اسحب كل شيء إلى سلّته المناسبة</span>`, `اسحب كل شيء إلى سلته: ${cats.map((c) => c.name).join("، ")}`);
      const row = el(stage, "baskets");
      const baskets = cats.map((c) => {
        const b = el(row, "basket", `<span class="bicon">🧺</span><b>${c.icon} ${c.name}</b>`);
        b.dataset.cat = c.id;
        return { el: b, cat: c };
      });
      let item = null;
      let selected = false;
      const spawn = () => {
        const [cat] = store.pickWeighted(cats, (c) => "cat:" + c.id);
        const e = randomOf(cat.items);
        const d = el(stage, "fitem", e);
        const x = 20 + Math.random() * (stage.clientWidth - 100);
        item = { el: d, cat, e, x, y: -60, drag: false };
        d.style.left = x + "px";
        d.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          d.setPointerCapture(ev.pointerId);
          item.drag = true;
          selected = true;
          d.classList.add("held");
          baskets.forEach((b) => b.el.classList.add("ready"));
        });
        d.addEventListener("pointermove", (ev) => {
          if (!item?.drag) return;
          const r = stage.getBoundingClientRect();
          item.x = ev.clientX - r.left - 32;
          item.y = ev.clientY - r.top - 32;
          place();
          baskets.forEach((b) => b.el.classList.toggle("over", inside(b.el, ev)));
        });
        d.addEventListener("pointerup", (ev) => {
          if (!item?.drag) return;
          item.drag = false;
          d.classList.remove("held");
          const b = baskets.find((x) => inside(x.el, ev));
          baskets.forEach((x) => x.el.classList.remove("over"));
          if (b) drop(b);
        });
      };
      const inside = (node, ev) => { const r = node.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top - 30 && ev.clientY <= r.bottom; };
      const place = () => { if (item) item.el.style.transform = `translate(${item.x - parseFloat(item.el.style.left)}px, ${item.y}px)`; };
      // يمكن أيضاً الضغط على الشيء ثم على السلة (أسهل للصغار)
      baskets.forEach((b) => b.el.addEventListener("pointerdown", (ev) => { if (item && selected && !item.drag) drop(b); }));
      const drop = (b) => {
        baskets.forEach((x) => x.el.classList.remove("ready"));
        selected = false;
        if (b.cat === item.cat) {
          const d = item.el;
          d.classList.add("in");
          b.el.classList.add("got");
          setTimeout(() => b.el.classList.remove("got"), 400);
          speak(item.cat.name);
          st.hit("cat:" + item.cat.id);
          item = null;
          setTimeout(() => d.remove(), 300);
          if (st.score < st.goal) st.later(spawn, 500);
        } else {
          b.el.classList.remove("no"); void b.el.offsetWidth; b.el.classList.add("no");
          st.miss("cat:" + item.cat.id, item.cat.id, b.cat.id);
          speak(`لا، هذا ليس ${b.cat.name}`);
          item.y = Math.min(item.y, stage.clientHeight * 0.3);
          place();
        }
      };
      spawn();
      st.loop((dt) => {
        if (!item || item.drag) return;
        item.y += (stage.clientHeight / (big() ? 7 : 9)) * dt;
        // إذا وصل الأسفل دون تصنيف يعود للأعلى بلا عقوبة
        if (item.y > stage.clientHeight - 150) item.y = -60;
        place();
      });
    }
  },

  // 🔢 دكّان حروفي: ادفع ثمن الشيء بالقطع النقدية
  shop: {
    goal: () => 5,
    start(st) {
      const stage = st.stage;
      const ITEMS = SHOP_ITEMS;
      const COINS = big() ? [1, 2, 5] : [1];
      // أسماء الأعداد من محتوى اللغة نفسها
      const AR = [NUMBERS[0]?.zero || "صفر", ...NUMBERS.slice(0, 10).map((x) => x.name)];
      const nextItem = () => {
        stage.innerHTML = "";
        const [name, e] = randomOf(ITEMS);
        const prices = big() ? [3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3, 4, 5];
        const [price] = store.pickWeighted(prices, (p) => "shop:" + p);
        st.setTask(`<span>ادفع ثمن ${name} بالضبط</span>`, `${name} بـ ${AR[price]}. ادفع ثمنها بالضبط`);
        const shelf = el(stage, "shelf", `<span class="sitem">${e}</span><span class="tag">${contentDigits(price)} <small>${"🪙".repeat(Math.min(price, 5))}${price > 5 ? "…" : ""}</small></span>`);
        const tray = el(stage, "tray", `<small>المدفوع: <b id="paid">٠</b></small><div class="paid" id="paidc"></div>`);
        const wallet = el(stage, "wallet", "");
        const pay = el(stage, "paybtn", "💰 ادفع");
        let paid = [];
        let tries = 0;
        const sum = () => paid.reduce((a, b) => a + b, 0);
        const paint = () => {
          $("#paid").textContent = contentDigits(sum());
          const pc = $("#paidc");
          pc.innerHTML = "";
          paid.forEach((v, i) => {
            const c = el(pc, `coin c${v}`, contentDigits(v));
            c.addEventListener("pointerdown", (ev) => { ev.preventDefault(); paid.splice(i, 1); sfx.tap(); paint(); });
          });
        };
        COINS.forEach((v) => {
          const c = el(wallet, `coin big c${v}`, contentDigits(v));
          c.addEventListener("pointerdown", (ev) => {
            ev.preventDefault();
            if (paid.length >= 12) return;
            paid.push(v);
            sfx.tap();
            speak(String(sum()));
            paint();
          });
        });
        if (!big()) el(wallet, "whint", "اضغط على القطعة لتضعها، واضغط عليها في الأعلى لتعيدها");
        pay.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (!paid.length) return;
          const s = sum();
          if (s === price) {
            shelf.classList.add("sold");
            pay.style.visibility = "hidden";
            speak(`اشتريت ${name} بـ ${AR[price]}. أحسنت!`);
            st.hit("shop:" + price);
            if (st.score < st.goal) st.later(nextItem, 2600);
          } else {
            tries++;
            st.miss("shop:" + price);
            const diff = price - s;
            speak(diff > 0 ? `ينقصك ${AR[Math.min(diff, 10)]}` : `دفعت أكثر، أعد ${AR[Math.min(-diff, 10)]}`);
            tray.classList.remove("no"); void tray.offsetWidth; tray.classList.add("no");
            $("#paid").parentElement.innerHTML = `المدفوع: <b id="paid">${toArabicDigits(s)}</b> · ${diff > 0 ? `ينقصك ${toArabicDigits(diff)}` : `زيادة ${toArabicDigits(-diff)}`}`;
          }
        });
        paint();
      };
      nextItem();
    }
  }
};
