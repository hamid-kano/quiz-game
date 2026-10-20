(() => {
  const QUESTIONS_PER_GAME = 10;
  const BASE_POINTS = 100;
  const STORAGE_KEY = "quiz-game-leaderboard";

  const $ = (id) => document.getElementById(id);
  const screens = { start: $("screen-start"), quiz: $("screen-quiz"), result: $("screen-result") };

  const state = {
    category: CATEGORIES[0],
    timePerQuestion: 20,
    questions: [],
    index: 0,
    score: 0,
    correct: 0,
    timeLeft: 0,
    timerId: null,
    locked: false,
    fiftyUsed: false,
    skipUsed: false,
    history: []
  };

  // ---------- أدوات ----------
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const show = (name) => {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo(0, 0);
  };

  const loadBoard = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  };
  const saveBoard = (board) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)); } catch { /* التخزين غير متاح */ }
  };

  // ---------- شاشة البداية ----------
  function renderCategories() {
    const box = $("categories");
    box.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "cat" + (cat.id === state.category.id ? " active" : "");
      btn.innerHTML = `<span class="icon">${cat.icon}</span>${cat.name}`;
      btn.onclick = () => { state.category = cat; renderCategories(); };
      box.appendChild(btn);
    });
  }

  function renderLeaderboard() {
    const list = $("leaderboard-list");
    const board = loadBoard();
    list.innerHTML = board.length
      ? board.map((r) => `<li><b>${escapeHtml(r.name)}</b> — ${r.score} (${r.cat})</li>`).join("")
      : "<li>لا توجد نتائج بعد، كن الأول!</li>";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.onclick = () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.timePerQuestion = Number(chip.dataset.time);
    };
  });

  // ---------- اللعب ----------
  function startGame() {
    state.questions = shuffle(state.category.questions)
      .slice(0, QUESTIONS_PER_GAME)
      .map((q) => {
        const options = shuffle(q.o.map((text, i) => ({ text, correct: i === q.a })));
        return { q: q.q, options };
      });
    Object.assign(state, { index: 0, score: 0, correct: 0, fiftyUsed: false, skipUsed: false, history: [] });
    $("btn-fifty").disabled = false;
    $("btn-skip").disabled = false;
    show("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const item = state.questions[state.index];
    state.locked = false;
    $("q-counter").textContent = `${state.index + 1} / ${state.questions.length}`;
    $("q-score").textContent = `⭐ ${state.score}`;
    $("progress-bar").style.width = `${(state.index / state.questions.length) * 100}%`;
    $("q-text").textContent = item.q;

    const box = $("answers");
    box.innerHTML = "";
    item.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "answer";
      btn.textContent = opt.text;
      btn.onclick = () => choose(btn, opt);
      opt.el = btn;
      box.appendChild(btn);
    });

    startTimer();
  }

  function startTimer() {
    clearInterval(state.timerId);
    state.timeLeft = state.timePerQuestion;
    updateTimer();
    const bar = $("time-bar");
    bar.style.transition = "none";
    bar.style.width = "100%";
    requestAnimationFrame(() => { bar.style.transition = "width 1s linear"; });

    state.timerId = setInterval(() => {
      state.timeLeft--;
      updateTimer();
      if (state.timeLeft <= 0) {
        clearInterval(state.timerId);
        timeUp();
      }
    }, 1000);
  }

  function updateTimer() {
    const t = $("q-timer");
    t.textContent = state.timeLeft;
    t.classList.toggle("danger", state.timeLeft <= 3);
    $("time-bar").style.width = `${(state.timeLeft / state.timePerQuestion) * 100}%`;
  }

  function choose(btn, opt) {
    if (state.locked) return;
    state.locked = true;
    clearInterval(state.timerId);

    const item = state.questions[state.index];
    revealCorrect(item);

    if (opt.correct) {
      const bonus = state.timeLeft * 10;
      state.score += BASE_POINTS + bonus;
      state.correct++;
    } else {
      btn.classList.add("wrong");
    }
    record(item, opt.text, opt.correct);
    next();
  }

  function timeUp() {
    if (state.locked) return;
    state.locked = true;
    const item = state.questions[state.index];
    revealCorrect(item);
    record(item, "انتهى الوقت", false);
    next();
  }

  function revealCorrect(item) {
    item.options.forEach((o) => {
      o.el.disabled = true;
      if (o.correct) o.el.classList.add("correct");
    });
  }

  function record(item, chosen, ok) {
    const right = item.options.find((o) => o.correct).text;
    state.history.push({ q: item.q, chosen, right, ok });
  }

  function next(delay = 1200) {
    setTimeout(() => {
      state.index++;
      if (state.index < state.questions.length) renderQuestion();
      else finish();
    }, delay);
  }

  // ---------- المساعدات ----------
  $("btn-fifty").onclick = () => {
    if (state.fiftyUsed || state.locked) return;
    state.fiftyUsed = true;
    $("btn-fifty").disabled = true;
    const wrong = shuffle(state.questions[state.index].options.filter((o) => !o.correct));
    wrong.slice(0, 2).forEach((o) => { o.el.classList.add("hidden"); o.el.disabled = true; });
  };

  $("btn-skip").onclick = () => {
    if (state.skipUsed || state.locked) return;
    state.skipUsed = true;
    state.locked = true;
    $("btn-skip").disabled = true;
    clearInterval(state.timerId);
    const item = state.questions[state.index];
    record(item, "تم التخطّي", false);
    next(0);
  };

  // ---------- النتيجة ----------
  function finish() {
    $("progress-bar").style.width = "100%";
    const total = state.questions.length;
    const ratio = state.correct / total;

    $("result-score").textContent = state.score;
    $("result-detail").textContent = `أجبت إجابة صحيحة عن ${state.correct} من ${total} أسئلة`;
    const [emoji, title] =
      ratio === 1 ? ["🏆", "علامة كاملة!"] :
      ratio >= 0.7 ? ["🎉", "أداء رائع!"] :
      ratio >= 0.4 ? ["👍", "جيد، يمكنك الأفضل"] :
                     ["📚", "حاول مرة أخرى"];
    $("result-emoji").textContent = emoji;
    $("result-title").textContent = title;

    $("review").innerHTML = state.history.map((h) => `
      <div class="review-item ${h.ok ? "ok" : ""}">
        <div class="q">${escapeHtml(h.q)}</div>
        <div class="a">${h.ok ? "✔" : "✘"} إجابتك: ${escapeHtml(h.chosen)}${h.ok ? "" : ` · الصحيحة: ${escapeHtml(h.right)}`}</div>
      </div>`).join("");

    const name = $("player-name").value.trim() || "لاعب";
    const board = loadBoard();
    board.push({ name, score: state.score, cat: state.category.name });
    board.sort((a, b) => b.score - a.score);
    saveBoard(board.slice(0, 5));

    show("result");
  }

  $("btn-start").onclick = startGame;
  $("btn-again").onclick = startGame;
  $("btn-home").onclick = () => { renderLeaderboard(); show("start"); };

  try { $("player-name").value = localStorage.getItem("quiz-game-name") || ""; } catch {}
  $("player-name").addEventListener("change", (e) => {
    try { localStorage.setItem("quiz-game-name", e.target.value.trim()); } catch {}
  });

  renderCategories();
  renderLeaderboard();
})();
