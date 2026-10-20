// ============================================================
//  حديقة الحروف: كل حرف بذرة تكبر كلما أتقنه الطفل
// ============================================================
import { LETTERS } from "./data.js";
import { store } from "./store.js";
import { speak } from "./sfx.js";
import { render, $, $$, esc, toArabicDigits } from "./util.js";
import { letterStatus } from "./parents.js";

const FLOWERS = ["🌷", "🌻", "🌹", "🌼", "🌸", "🪻", "🌺"];
const STAGE = { unseen: "🟫", weak: "🌱", mid: "🌿" };

export function screenGarden(back) {
  const p = store.active;
  const items = LETTERS.map((L, i) => ({ L, st: letterStatus(p, L.l), flower: FLOWERS[i % FLOWERS.length] }));
  const bloomed = items.filter((x) => x.st.cls === "good").length;
  const growing = items.filter((x) => x.st.cls === "mid" || x.st.cls === "weak").length;
  const msg = bloomed === LETTERS.length
    ? "حديقتك كلها أزهرت! أنت بطل الحروف 🏆"
    : bloomed
      ? `أزهر ${toArabicDigits(bloomed)} من ${toArabicDigits(LETTERS.length)} حرفاً. تمرّن أكثر لتزهر البقية!`
      : growing
        ? "بذورك بدأت تنمو! استمر في اللعب لتزهر 🌱"
        : "حديقتك تنتظرك! العب لتزرع أول بذرة 🌱";

  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>🌷 حديقة ${esc(p.name || "الحروف")}</b>
      <span class="spacer"></span>
    </div>
    <p class="sub">${msg}</p>
    <div class="garden">
      ${items.map((x) => `
        <button class="plot ${x.st.cls}" data-l="${x.L.l}" aria-label="${x.L.name}: ${x.st.label}">
          <span class="plant">${x.st.cls === "good" ? x.flower : STAGE[x.st.cls]}</span>
          <span class="pl">${x.L.l}</span>
        </button>`).join("")}
    </div>
    <div class="legend garden-legend">
      <span>🟫 لم تُزرع</span><span>🌱 بذرة</span><span>🌿 تكبر</span><span>🌷 أزهرت</span>
    </div>
  `);
  $("#back").onclick = back;
  $$(".plot").forEach((b) => (b.onclick = () => {
    const x = items.find((i) => i.L.l === b.dataset.l);
    b.classList.remove("wiggle"); void b.offsetWidth; b.classList.add("wiggle");
    speak(`حرف ${x.L.name}`);
  }));
}
