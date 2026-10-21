// ============================================================
//  مفرداتي: بطاقات كلمات حسب المواضيع ثم اختبار قصير
// ============================================================
import { VOCAB } from "./data.js";
import { store } from "./store.js";
import { ageRank } from "./lang.js";
import { speak, stopSpeech, sfx } from "./sfx.js";
import { render, $, $$, esc, toArabicDigits } from "./util.js";
import { GEN, runSession } from "./games.js";

// نسبة الكلمات التي أتقنها الطفل في الموضوع
const themeProgress = (t) => {
  const m = store.active.mastery;
  const known = t.words.filter((w) => (m["voc:" + w.w]?.box || 0) >= 2).length;
  return known / t.words.length;
};

export function screenVocab(act, back, onFinish) {
  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>🗂️ مفرداتي</b>
      <span class="spacer"></span>
    </div>
    <p class="sub">اختر موضوعاً لتتعلّم كلماته</p>
    <div class="themes">
      ${VOCAB.map((t) => {
        const p = Math.round(themeProgress(t) * 100);
        return `<button class="theme" data-id="${t.id}">
          <span class="ticon">${t.icon}</span><b>${t.name}</b>
          <span class="meter"><i style="width:${Math.max(3, p)}%"></i></span>
          <small>${toArabicDigits(t.words.length)} كلمة</small>
        </button>`;
      }).join("")}
    </div>
  `);
  $("#back").onclick = back;
  $$(".theme").forEach((b) => (b.onclick = () => { sfx.tap(); screenTheme(act, VOCAB.find((t) => t.id === b.dataset.id), back, onFinish); }));
}

function screenTheme(act, theme, back, onFinish) {
  const goBack = () => { stopSpeech(); screenVocab(act, back, onFinish); };
  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>${theme.icon} ${theme.name}</b>
      <span class="spacer"></span>
    </div>
    <p class="sub">اضغط على كل صورة لتسمع اسمها</p>
    <div class="vcards">
      ${theme.words.map((w) => `<button class="vcard" data-w="${esc(w.w)}" data-ar="${esc(w.ar || "")}"><span>${w.emoji}</span><b class="cword">${w.w}</b>${w.ar ? `<small class="mean">${w.ar}</small>` : ""}</button>`).join("")}
    </div>
    <div class="result-actions">
      <button class="btn block" id="quiz">🎯 اختبرني في ${theme.name}</button>
    </div>
  `);
  speak(theme.name);
  $("#back").onclick = goBack;
  $$(".vcard").forEach((b) => (b.onclick = () => {
    $$(".vcard").forEach((x) => x.classList.remove("lit"));
    b.classList.add("lit");
    // في تطبيق الإنجليزية: الكلمة ثم معناها بالعربية
    speak(b.dataset.ar ? `${b.dataset.w}... ${b.dataset.w}، ${b.dataset.ar}` : b.dataset.w, { slow: ageRank(store.active.age) === 0 });
  }));
  $("#quiz").onclick = () => {
    stopSpeech();
    const level = { ...act, theme: theme.id };
    runSession({
      title: theme.name,
      icon: theme.icon,
      total: store.settings.rounds,
      next: () => GEN.vocab(level),
      onExit: goBack,
      onFinish: (r) => onFinish(r, () => screenTheme(act, theme, back, onFinish))
    });
  };
}
