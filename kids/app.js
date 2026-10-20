(() => {
  "use strict";

  const app = document.getElementById("app");
  const ROUNDS = 6;
  const TRACE_ROUNDS = 4;
  const STORE_KEY = "huroofi-progress-v1";

  // ================= الحفظ =================
  const defaults = () => ({ name: "", age: "", stars: {}, plays: {} });
  let save = load();

  function load() {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE_KEY)) || {}); }
    catch { return defaults(); }
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch { /* غير متاح */ }
  }

  // ================= أدوات =================
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const h = (html) => { app.innerHTML = `<div class="screen">${html}</div>`; window.scrollTo(0, 0); };
  const $ = (sel) => app.querySelector(sel);
  const $$ = (sel) => [...app.querySelectorAll(sel)];
  const optionCount = () => (save.age === "small" ? 3 : 4);

  // الحروف داخل كلمة (يتعامل مع الهمزات كحرف واحد)
  const splitWord = (w) => [...w];

  // أشكال الحرف في الكلمة
  function forms(L) {
    const t = "ـ";
    return L.c
      ? [["منفرد", L.l], ["أول", L.l + t], ["وسط", t + L.l + t], ["آخر", t + L.l]]
      : [["منفرد", L.l], ["آخر", t + L.l]];
  }

  // ================= الصوت =================
  let arVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const voices = speechSynthesis.getVoices();
    arVoice = voices.find((v) => /^ar/i.test(v.lang)) || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-SA";
    if (arVoice) u.voice = arVoice;
    u.rate = 0.8;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  }

  let audioCtx = null;
  function tone(freqs, dur = 0.12, type = "sine") {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = type;
        o.frequency.value = f;
        const t0 = audioCtx.currentTime + i * dur;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(audioCtx.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.02);
      });
    } catch { /* الصوت غير متاح */ }
  }
  const sfx = {
    right: () => tone([660, 880, 1175], 0.1),
    wrong: () => tone([220, 180], 0.15, "triangle"),
    win: () => tone([523, 659, 784, 1047, 1319], 0.12),
    tap: () => tone([500], 0.05)
  };

  function confetti(count = 70) {
    const box = document.getElementById("confetti");
    const colors = ["#ffb703", "#fb8500", "#8e7dff", "#2bb673", "#ef476f", "#219ebc"];
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
      p.style.animationDelay = Math.random() * 0.4 + "s";
      box.appendChild(p);
      setTimeout(() => p.remove(), 4200);
    }
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  // ================= المستويات =================
  function visibleLevels() {
    return save.age === "small" ? LEVELS.filter((l) => l.age === "small") : LEVELS;
  }
  function isUnlocked(level) {
    const list = visibleLevels();
    const i = list.indexOf(level);
    if (i <= 0) return true;
    if (save.age === "big" && level.age === "small") return true;
    if (save.age === "big" && level === list.find((l) => l.age === "big")) return true;
    return (save.stars[list[i - 1].id] || 0) > 0;
  }
  const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
  const starsText = (n) => "⭐".repeat(n) + "☆".repeat(3 - n);

  // ================= الشاشة الأولى =================
  function screenWelcome() {
    h(`
      <div class="mascot">🦉</div>
      <h1>حروفي</h1>
      <p class="sub">نتعلّم العربية ونحن نلعب!</p>
      <input class="name-input" id="kid-name" maxlength="16" placeholder="ما اسمك؟" value="${esc(save.name)}">
      <div class="age-cards">
        <button class="age-card ${save.age === "small" ? "active" : ""}" data-age="small">
          <span class="e">🐣</span><b>صغير</b><span>من 3 إلى 5 سنوات</span>
        </button>
        <button class="age-card ${save.age === "big" ? "active" : ""}" data-age="big">
          <span class="e">🦁</span><b>كبير</b><span>من 6 إلى 8 سنوات</span>
        </button>
      </div>
      <button class="btn block" id="go">يلا نبدأ 🚀</button>
    `);
    $$(".age-card").forEach((b) => b.onclick = () => {
      sfx.tap();
      save.age = b.dataset.age;
      $$(".age-card").forEach((x) => x.classList.toggle("active", x === b));
    });
    $("#go").onclick = () => {
      if (!save.age) { toast("اختر العمر أولاً 👆"); return; }
      save.name = $("#kid-name").value.trim();
      persist();
      speak(save.name ? `أهلاً ${save.name}` : "أهلاً بك");
      screenMap();
    };
  }

  // ================= خريطة المستويات =================
  function screenMap() {
    const list = visibleLevels();
    const current = list.find((l) => isUnlocked(l) && !save.stars[l.id]);
    let lastAge = null;
    const items = list.map((l, i) => {
      const unlocked = isUnlocked(l);
      const s = save.stars[l.id] || 0;
      let header = "";
      if (save.age === "big" && l.age !== lastAge) {
        header = `<div class="section-title">${l.age === "small" ? "🐣 مراجعة الأساسيات" : "🦁 مستويات الكبار"}</div>`;
        lastAge = l.age;
      }
      return `${header}
        <button class="level ${unlocked ? "" : "locked"} ${l === current ? "current" : ""}" data-id="${l.id}">
          <span class="num">${unlocked ? l.icon : "🔒"}</span>
          <span class="info"><b>${i + 1}. ${l.title}</b><small>${l.desc}</small></span>
          <span class="lstars">${unlocked ? starsText(s) : ""}</span>
        </button>`;
    }).join("");

    h(`
      <div class="topbar">
        <button class="icon-btn" id="home" aria-label="الرئيسية">🏠</button>
        <span class="stars-pill">⭐ ${totalStars()}</span>
        <button class="icon-btn" id="parents" aria-label="للأهل">👪</button>
      </div>
      <h2>${save.name ? `مرحباً ${esc(save.name)}!` : "اختر مستوى"}</h2>
      <div class="map">${items}</div>
    `);
    $("#home").onclick = screenWelcome;
    $("#parents").onclick = screenParents;
    $$(".level").forEach((b) => b.onclick = () => {
      const level = LEVELS.find((l) => l.id === Number(b.dataset.id));
      if (!isUnlocked(level)) { sfx.wrong(); toast("أكمل المستوى السابق أولاً 🔒"); return; }
      sfx.tap();
      startLevel(level);
    });
    if (current) setTimeout(() => app.querySelector(".level.current")?.scrollIntoView({ block: "center", behavior: "smooth" }), 200);
  }

  // ================= تشغيل مستوى =================
  let game = null;

  function startLevel(level) {
    game = { level, round: 0, mistakes: 0, results: [], roundMissed: false };
    game.total = level.type === "trace" ? TRACE_ROUNDS : ROUNDS;
    if (level.type === "letters") showLesson(0);
    else nextRound();
  }

  function dots() {
    let out = "";
    for (let i = 0; i < game.total; i++) {
      const cls = i < game.round ? (game.results[i] ? "done" : "miss") : i === game.round ? "now" : "";
      out += `<i class="${cls}"></i>`;
    }
    return `<div class="progress-dots">${out}</div>`;
  }

  function header() {
    return `
      <div class="topbar">
        <button class="icon-btn" id="back" aria-label="رجوع">✖</button>
        <b>${game.level.icon} ${game.level.title}</b>
        <span style="width:48px"></span>
      </div>${dots()}`;
  }
  function bindBack() {
    $("#back").onclick = () => { window.speechSynthesis?.cancel(); screenMap(); };
  }

  function roundWrong() {
    sfx.wrong();
    if (!game.roundMissed) { game.roundMissed = true; game.mistakes++; }
  }

  function roundRight(delay = 900) {
    sfx.right();
    game.results.push(!game.roundMissed);
    game.round++;
    game.roundMissed = false;
    setTimeout(() => (game.round >= game.total ? finishLevel() : nextRound()), delay);
  }

  function nextRound() {
    const t = game.level.type;
    if (t === "letters") roundLetters();
    else if (t === "first") roundFirst();
    else if (t === "harakat") roundHarakat();
    else if (t === "build") roundBuild();
    else if (t === "read") roundRead();
    else if (t === "trace") roundTrace();
  }

  // ---------- درس الحروف ----------
  function lessonLetters() {
    const [a, b] = game.level.range;
    return LETTERS.slice(a, b);
  }

  function showLesson(i) {
    const list = lessonLetters();
    const L = list[i];
    h(`
      <div class="topbar">
        <button class="icon-btn" id="back" aria-label="رجوع">✖</button>
        <b>${game.level.icon} تعلّم: ${i + 1} / ${list.length}</b>
        <span style="width:48px"></span>
      </div>
      <div class="prompt learn-card">
        <div class="big">${L.l}</div>
        <button class="speak" id="say">🔊 حرف ${L.name}</button>
        <div class="forms">${forms(L).map(([n, f]) => `<div><b>${f}</b><small>${n}</small></div>`).join("")}</div>
        <div class="example"><span class="pic">${L.emoji}</span>${L.word}</div>
      </div>
      <div class="learn-nav">
        <button class="btn alt small" id="prev" ${i === 0 ? "disabled style='visibility:hidden'" : ""}>→ السابق</button>
        ${i < list.length - 1
          ? `<button class="btn small" id="next">التالي ←</button>`
          : `<button class="btn small" id="play">يلا نلعب 🎮</button>`}
      </div>
    `);
    bindBack();
    const say = () => speak(`حرف ${L.name}، ${L.word}`);
    $("#say").onclick = say;
    $(".example").onclick = () => speak(L.word);
    say();
    $("#prev").onclick = () => showLesson(i - 1);
    if ($("#next")) $("#next").onclick = () => { sfx.tap(); showLesson(i + 1); };
    if ($("#play")) $("#play").onclick = () => { sfx.tap(); nextRound(); };
  }

  // ---------- جولات عامة بالاختيار ----------
  function choiceRound({ promptHtml, say, options, isRight, render, emoji = false, onRight }) {
    const cols = options.length === 3 ? "three" : "";
    h(`
      ${header()}
      <div class="prompt">${promptHtml}
        ${say ? `<div style="margin-top:10px"><button class="speak" id="say">🔊 استمع</button></div>` : ""}
      </div>
      <div class="choices ${cols}">
        ${options.map((o, i) => `<button class="choice ${emoji ? "emoji" : ""}" data-i="${i}">${render(o)}</button>`).join("")}
      </div>
    `);
    bindBack();
    if (say) { $("#say").onclick = say; setTimeout(say, 250); }
    $$(".choice").forEach((btn) => btn.onclick = () => {
      const o = options[Number(btn.dataset.i)];
      if (isRight(o)) {
        $$(".choice").forEach((b) => (b.disabled = true));
        btn.classList.add("right");
        onRight?.(o);
        roundRight();
      } else {
        btn.classList.add("wrong");
        btn.disabled = true;
        roundWrong();
      }
    });
  }

  function roundLetters() {
    const pool = lessonLetters();
    const target = pool[Math.floor(Math.random() * pool.length)];
    const others = pick(pool.filter((x) => x !== target), optionCount() - 1);
    choiceRound({
      promptHtml: `<div class="q">أين حرف <b>${target.name}</b>؟</div><div class="pic">${target.emoji}</div>`,
      say: () => speak(`أين حرف ${target.name}؟`),
      options: shuffle([target, ...others]),
      isRight: (o) => o === target,
      render: (o) => o.l,
      onRight: () => speak(`أحسنت! ${target.name}`)
    });
  }

  function roundFirst() {
    const target = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const others = pick(LETTERS.filter((x) => x !== target), optionCount() - 1);
    choiceRound({
      promptHtml: `<div class="q">بأي حرف تبدأ هذه الكلمة؟</div><div class="pic">${target.emoji}</div>`,
      say: () => speak(target.word),
      options: shuffle([target, ...others]),
      isRight: (o) => o === target,
      render: (o) => o.l,
      onRight: () => speak(`${target.word} تبدأ بحرف ${target.name}`)
    });
  }

  function roundHarakat() {
    const L = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const target = HARAKAT[Math.floor(Math.random() * HARAKAT.length)];
    const base = L.l === "أ" ? "ا" : L.l;
    const make = (hk) => (L.l === "أ" ? (hk.sound === "i" ? "إ" + hk.mark : "أ" + hk.mark) : base + hk.mark);
    choiceRound({
      promptHtml: `<div class="q">اختر حرف <b>${L.name}</b> مع <b>${target.name}</b></div>`,
      say: () => speak(make(target)),
      options: shuffle(HARAKAT),
      isRight: (o) => o === target,
      render: (o) => make(o)
    });
  }

  function roundRead() {
    const pool = [...WORDS_SHORT, ...WORDS_LONG];
    const target = pool[Math.floor(Math.random() * pool.length)];
    const others = pick(pool.filter((x) => x.emoji !== target.emoji), optionCount() - 1);
    choiceRound({
      promptHtml: `<div class="q">اقرأ الكلمة واختر صورتها</div><div class="big">${target.w}</div>`,
      say: null,
      options: shuffle([target, ...others]),
      isRight: (o) => o === target,
      render: (o) => o.emoji,
      emoji: true,
      onRight: () => speak(target.w)
    });
  }

  // ---------- تركيب الكلمة ----------
  function roundBuild() {
    const pool = game.level.words === "long" ? WORDS_LONG : WORDS_SHORT;
    if (!game.usedWords) game.usedWords = [];
    const fresh = pool.filter((w) => !game.usedWords.includes(w.w));
    const target = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
    game.usedWords.push(target.w);

    const letters = splitWord(target.w);
    const extra = pick(LETTERS.map((x) => x.l).filter((l) => !letters.includes(l)), save.age === "big" ? 2 : 1);
    const tiles = shuffle([...letters, ...extra]);
    let pos = 0;

    h(`
      ${header()}
      <div class="prompt">
        <div class="q">ركّب الكلمة</div>
        <div class="pic">${target.emoji}</div>
        <button class="speak" id="say">🔊 استمع</button>
        <div class="slots">${letters.map(() => `<div class="slot"></div>`).join("")}</div>
        <div class="built-word" id="built"></div>
      </div>
      <div class="tiles">${tiles.map((t, i) => `<button class="tile" data-i="${i}">${t}</button>`).join("")}</div>
    `);
    bindBack();
    const say = () => speak(target.w);
    $("#say").onclick = say;
    setTimeout(say, 250);

    const slots = $$(".slot");
    $$(".tile").forEach((btn) => btn.onclick = () => {
      const t = tiles[Number(btn.dataset.i)];
      if (t === letters[pos]) {
        sfx.tap();
        btn.classList.add("used");
        slots[pos].textContent = t;
        slots[pos].classList.add("filled");
        pos++;
        $("#built").textContent = letters.slice(0, pos).join("");
        if (pos === letters.length) {
          $$(".tile").forEach((b) => (b.disabled = true));
          speak(`أحسنت! ${target.w}`);
          roundRight(1300);
        }
      } else {
        btn.classList.remove("wrong");
        void btn.offsetWidth;
        btn.classList.add("wrong");
        roundWrong();
      }
    });
  }

  // ---------- ارسم الحرف ----------
  function roundTrace() {
    if (!game.traceQueue) game.traceQueue = pick(LETTERS, TRACE_ROUNDS);
    const L = game.traceQueue[game.round];
    h(`
      ${header()}
      <div class="prompt" style="padding:12px">
        <div class="q">ارسم حرف <b>${L.name}</b> فوق الخط الرمادي</div>
        <button class="speak" id="say">🔊 حرف ${L.name}</button>
      </div>
      <div class="trace-wrap" id="wrap">
        <canvas id="guide"></canvas>
        <canvas id="draw"></canvas>
      </div>
      <div class="trace-actions">
        <button class="btn alt small" id="clear">🧽 امسح</button>
        <button class="btn small" id="check">✔ تحقّق</button>
      </div>
    `);
    bindBack();
    const say = () => speak(`حرف ${L.name}`);
    $("#say").onclick = say;
    setTimeout(say, 250);

    const wrap = $("#wrap");
    const guide = $("#guide");
    const draw = $("#draw");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = wrap.clientWidth;
    [guide, draw].forEach((c) => { c.width = size * dpr; c.height = size * dpr; });
    const gctx = guide.getContext("2d");
    const dctx = draw.getContext("2d");
    gctx.scale(dpr, dpr);
    dctx.scale(dpr, dpr);

    const font = (px) => `700 ${px}px "Noto Naskh Arabic", "Cairo", serif`;
    // يضع الحرف في منتصف اللوحة تماماً اعتماداً على حدود شكله الفعلية
    const placeLetter = (ctx, s) => {
      ctx.font = font(s * 0.62);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const m = ctx.measureText(L.l);
      const asc = m.actualBoundingBoxAscent || s * 0.3;
      const desc = m.actualBoundingBoxDescent || 0;
      return { x: s / 2, y: s / 2 + (asc - desc) / 2 };
    };
    const drawLetter = (ctx, s, color, outline = 0) => {
      ctx.clearRect(0, 0, s, s);
      const { x, y } = placeLetter(ctx, s);
      ctx.fillStyle = color;
      ctx.fillText(L.l, x, y);
      if (outline) { ctx.lineWidth = outline; ctx.strokeStyle = color; ctx.lineJoin = "round"; ctx.strokeText(L.l, x, y); }
      return { x, y };
    };

    const paintGuide = () => {
      const { x, y } = drawLetter(gctx, size, "#dfe7ee");
      gctx.setLineDash([6, 8]);
      gctx.lineWidth = 2;
      gctx.strokeStyle = "#9fb3c6";
      gctx.strokeText(L.l, x, y);
      gctx.setLineDash([]);
    };
    document.fonts?.load(font(40), L.l).finally(paintGuide);
    paintGuide();

    const strokes = [];
    let cur = null;
    const lineW = size * 0.075;
    const pt = (e) => {
      const r = draw.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };
    const renderStrokes = (ctx, s, w, color) => {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = w;
      ctx.strokeStyle = color;
      strokes.forEach((st) => {
        ctx.beginPath();
        st.forEach((p, i) => (i ? ctx.lineTo(p.x * s, p.y * s) : ctx.moveTo(p.x * s, p.y * s)));
        if (st.length === 1) ctx.lineTo(st[0].x * s + 0.1, st[0].y * s);
        ctx.stroke();
      });
    };
    const repaint = () => { dctx.clearRect(0, 0, size, size); renderStrokes(dctx, size, lineW, "#fb8500"); };

    draw.addEventListener("pointerdown", (e) => {
      draw.setPointerCapture(e.pointerId);
      cur = [pt(e)];
      strokes.push(cur);
      repaint();
    });
    draw.addEventListener("pointermove", (e) => {
      if (!cur) return;
      cur.push(pt(e));
      repaint();
    });
    const end = () => { cur = null; };
    draw.addEventListener("pointerup", end);
    draw.addEventListener("pointercancel", end);

    $("#clear").onclick = () => { strokes.length = 0; repaint(); };

    $("#check").onclick = () => {
      const pts = strokes.reduce((n, s) => n + s.length, 0);
      if (pts < 8) { toast("ارسم الحرف أولاً ✏️"); return; }

      // مقارنة الرسم بشكل الحرف على شبكة صغيرة
      const N = 120;
      const mk = () => { const c = document.createElement("canvas"); c.width = c.height = N; return c.getContext("2d"); };
      const mask = mk();
      drawLetter(mask, N, "#000", N * 0.06);
      const core = mk();
      drawLetter(core, N, "#000");
      const user = mk();
      renderStrokes(user, N, N * 0.075, "#000");

      const m = mask.getImageData(0, 0, N, N).data;
      const c = core.getImageData(0, 0, N, N).data;
      const u = user.getImageData(0, 0, N, N).data;
      let coreTotal = 0, coreHit = 0, userTotal = 0, userIn = 0;
      for (let i = 3; i < m.length; i += 4) {
        const inUser = u[i] > 40;
        if (c[i] > 40) { coreTotal++; if (inUser) coreHit++; }
        if (inUser) { userTotal++; if (m[i] > 40) userIn++; }
      }
      const coverage = coreHit / Math.max(coreTotal, 1);
      const precision = userIn / Math.max(userTotal, 1);

      if (coverage >= 0.45 && precision >= 0.6) {
        $("#check").disabled = true;
        $("#clear").disabled = true;
        dctx.clearRect(0, 0, size, size);
        renderStrokes(dctx, size, lineW, "#2bb673");
        speak("رائع!");
        roundRight(1100);
      } else {
        roundWrong();
        toast(coverage < 0.45 ? "ارسم الحرف كاملاً 💪" : "حاول أن تبقى فوق الحرف 🙂");
        setTimeout(() => { strokes.length = 0; repaint(); }, 700);
      }
    };
  }

  // ================= نهاية المستوى =================
  function finishLevel() {
    const lvl = game.level;
    const s = game.mistakes === 0 ? 3 : game.mistakes <= 2 ? 2 : 1;
    save.stars[lvl.id] = Math.max(save.stars[lvl.id] || 0, s);
    save.plays[lvl.id] = (save.plays[lvl.id] || 0) + 1;
    persist();

    const list = visibleLevels();
    const next = list[list.indexOf(lvl) + 1];
    const msg = s === 3 ? "ممتاز! أنت بطل 🏆" : s === 2 ? "أحسنت! 👏" : "جيد! جرّب مرة أخرى لتحصل على نجوم أكثر";

    h(`
      <div class="result">
        <div class="mascot">${s === 3 ? "🥳" : s === 2 ? "😄" : "🙂"}</div>
        <h1>${msg}</h1>
        <div class="stars">${[1, 2, 3].map((n) => `<span class="${n <= s ? "" : "off"}">⭐</span>`).join("")}</div>
        <p class="sub">${game.results.filter(Boolean).length} من ${game.total} من المحاولة الأولى</p>
        <div class="result-actions">
          ${next ? `<button class="btn block" id="next">المستوى التالي ${next.icon}</button>` : `<p class="sub">🎉 أنهيت كل المستويات!</p>`}
          <button class="btn alt block" id="again">العب مرة أخرى 🔁</button>
          <button class="btn alt block" id="map">الخريطة 🗺️</button>
        </div>
      </div>
    `);
    sfx.win();
    if (s >= 2) confetti(s === 3 ? 90 : 45);
    speak(s === 3 ? "ممتاز! أنت بطل" : "أحسنت");
    if (next) $("#next").onclick = () => startLevel(next);
    $("#again").onclick = () => startLevel(lvl);
    $("#map").onclick = screenMap;
  }

  // ================= لوحة الأهل =================
  function screenParents() {
    const list = visibleLevels();
    const done = list.filter((l) => save.stars[l.id]).length;
    const plays = Object.values(save.plays).reduce((a, b) => a + b, 0);
    h(`
      <div class="topbar">
        <button class="icon-btn" id="back" aria-label="رجوع">→</button>
        <b>👪 لوحة الأهل</b>
        <span style="width:48px"></span>
      </div>
      <div class="parents">
        <div class="summary">
          <div><b>${totalStars()}</b><small>نجمة</small></div>
          <div><b>${done}/${list.length}</b><small>مستوى مكتمل</small></div>
          <div><b>${plays}</b><small>مرة لعب</small></div>
        </div>
        <table>
          <tr><th>المستوى</th><th>النجوم</th><th>مرات اللعب</th></tr>
          ${list.map((l) => `<tr><td>${l.icon} ${l.title}</td><td>${starsText(save.stars[l.id] || 0)}</td><td>${save.plays[l.id] || 0}</td></tr>`).join("")}
        </table>
        <p class="sub" style="margin-top:16px">العمر الحالي: ${save.age === "small" ? "صغير (3–5)" : "كبير (6–8)"}</p>
        <div class="result-actions">
          <button class="btn alt block" id="age">تغيير العمر أو الاسم</button>
          <button class="btn alt block" id="reset">🗑️ مسح كل التقدّم</button>
        </div>
      </div>
    `);
    $("#back").onclick = screenMap;
    $("#age").onclick = screenWelcome;
    $("#reset").onclick = () => {
      if (!confirm("هل تريد مسح كل النجوم والتقدّم؟")) return;
      save = Object.assign(defaults(), { name: save.name, age: save.age });
      persist();
      toast("تم مسح التقدّم");
      screenParents();
    };
  }

  // ================= البدء =================
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  save.age ? screenMap() : screenWelcome();
})();
