// ============================================================
//  القصص القصيرة: قراءة صفحة صفحة مع نطق كل كلمة، ثم أسئلة فهم
// ============================================================
import { STORIES } from "./data.js";
import { store } from "./store.js";
import { speak, stopSpeech, sfx } from "./sfx.js";
import { render, $, $$, esc, shuffle } from "./util.js";
import { runSession } from "./games.js";

export function screenStories(back, onFinish) {
  const p = store.active;
  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>📚 مكتبة القصص</b>
      <span class="spacer"></span>
    </div>
    <p class="sub">اختر قصة، اقرأها، ثم أجب عن الأسئلة</p>
    <div class="library">
      ${STORIES.map((st) => {
        const stars = p.stars["story-" + st.id] || 0;
        return `<button class="book" data-id="${st.id}">
          <span class="cover">${st.cover}</span>
          <b>${esc(st.title)}</b>
          <small>${stars ? "⭐".repeat(stars) : `${st.pages.length} صفحات`}</small>
        </button>`;
      }).join("")}
    </div>
  `);
  $("#back").onclick = back;
  $$(".book").forEach((b) => (b.onclick = () => {
    sfx.tap();
    readStory(STORIES.find((x) => x.id === b.dataset.id), 0, back, onFinish);
  }));
}

function readStory(st, i, back, onFinish) {
  const page = st.pages[i];
  const last = i === st.pages.length - 1;
  // كل كلمة زر يمكن الضغط عليه لسماعها
  const words = page.text.split(" ").map((w) => `<button class="word" data-w="${esc(w.replace(/[.،!؟]/g, ""))}">${esc(w)}</button>`).join(" ");
  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="خروج">✖</button>
      <b>${st.cover} ${esc(st.title)}</b>
      <span class="spacer"></span>
    </div>
    <div class="progress-dots">${st.pages.map((_, k) => `<i class="${k < i ? "done" : k === i ? "now" : ""}"></i>`).join("")}</div>
    <div class="prompt story-page">
      <div class="story-pic">${page.pic}</div>
      <p class="story-text">${words}</p>
      <button class="speak" id="read">🔊 اقرأ لي</button>
      <p class="muted">اضغط على أي كلمة لتسمعها</p>
    </div>
    <div class="learn-nav">
      <button class="btn alt small" id="prev" ${i === 0 ? "style='visibility:hidden'" : ""}>→ السابق</button>
      <button class="btn small" id="next">${last ? "الأسئلة ❓" : "التالي ←"}</button>
    </div>
  `);
  $("#back").onclick = () => { stopSpeech(); back(); };
  $("#read").onclick = () => speak(page.text);
  $$(".word").forEach((w) => (w.onclick = () => {
    $$(".word").forEach((x) => x.classList.remove("lit"));
    w.classList.add("lit");
    speak(w.dataset.w);
  }));
  $("#prev").onclick = () => readStory(st, i - 1, back, onFinish);
  $("#next").onclick = () => {
    sfx.tap();
    if (!last) return readStory(st, i + 1, back, onFinish);
    stopSpeech();
    runSession({
      title: st.title,
      icon: st.cover,
      total: st.questions.length,
      next: (k) => {
        const q = st.questions[k];
        return {
          kind: "choice",
          key: `story:${st.id}:${k}`,
          target: String(q.a),
          promptHtml: `<div class="story-pic small">${st.cover}</div><div class="q">${esc(q.q)}</div>`,
          say: q.q,
          options: shuffle(q.o.map((o, idx) => ({ id: String(idx), html: esc(o), right: idx === q.a, text: true }))),
          cols: 3,
          praise: q.o[q.a]
        };
      },
      onExit: back,
      onFinish: (r) => onFinish(st, r)
    });
  };
  speak(page.text);
}
