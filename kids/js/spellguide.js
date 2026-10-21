// ============================================================
//  دليل التهجئة: خطوات الطريقة بالترتيب، لكل خطوة قاعدة وأمثلة مسموعة وزر تمرين
// ============================================================
import { SPELL_LESSONS, ACTIVITIES } from "./data.js";
import { store } from "./store.js";
import { speak, stopSpeech, sfx } from "./sfx.js";
import { render, $, $$, esc, toArabicDigits } from "./util.js";

export function screenSpellGuide(back, startActivity, i = 0) {
  const L = SPELL_LESSONS[i];
  const act = ACTIVITIES.find((a) => a.id === L.act);
  const canPlay = act && (act.age === "all" || store.active.age === "big");
  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>🧭 دليل التهجئة</b>
      <span class="spacer"></span>
    </div>
    <div class="steps">${SPELL_LESSONS.map((x, k) => `<button class="step ${k === i ? "on" : ""} ${k < i ? "done" : ""}" data-k="${k}" aria-label="${esc(x.title)}">${toArabicDigits(k + 1)}</button>`).join("")}</div>
    <div class="prompt guide">
      <div class="guide-icon">${L.icon}</div>
      <h2>الخطوة ${toArabicDigits(i + 1)}: ${esc(L.title)}</h2>
      <p class="rule">${esc(L.rule)}</p>
      <button class="speak" id="read">🔊 اقرأ القاعدة</button>
      <p class="muted">اضغط على كل مثال لتسمعه:</p>
      <div class="examples">${L.examples.map((e) => `<button class="ex" data-e="${esc(e)}">${esc(e)}</button>`).join("")}</div>
    </div>
    <div class="learn-nav">
      <button class="btn alt small" id="prev" ${i === 0 ? "style='visibility:hidden'" : ""}>→ السابق</button>
      ${canPlay ? `<button class="btn small" id="play">تمرّن ${L.icon}</button>` : `<span class="muted">التمرين للكبار</span>`}
      <button class="btn alt small" id="next" ${i === SPELL_LESSONS.length - 1 ? "style='visibility:hidden'" : ""}>التالي ←</button>
    </div>
  `);
  const go = (k) => { stopSpeech(); screenSpellGuide(back, startActivity, k); };
  $("#back").onclick = () => { stopSpeech(); back(); };
  $("#read").onclick = () => speak(L.rule);
  $$(".ex").forEach((b) => (b.onclick = () => {
    $$(".ex").forEach((x) => x.classList.remove("lit"));
    b.classList.add("lit");
    speak(b.dataset.e, { slow: true });
  }));
  $$(".step").forEach((b) => (b.onclick = () => { sfx.tap(); go(Number(b.dataset.k)); }));
  $("#prev").onclick = () => go(i - 1);
  $("#next").onclick = () => { sfx.tap(); go(i + 1); };
  $("#play")?.addEventListener("click", () => { stopSpeech(); startActivity(act); });
  speak(`${L.title}. ${L.rule}`);
}
