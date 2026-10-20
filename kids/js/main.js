// ============================================================
//  الشاشات الرئيسية والتنقل بينها
// ============================================================
import { LEVELS, LETTERS, AVATARS, STICKERS, LOCK_LEVELS } from "./data.js";
import { store } from "./store.js";
import { speak, sfx, confetti } from "./sfx.js";
import { render, $, $$, esc, toast, randomOf, plural } from "./util.js";
import { GEN, runSession, showLesson } from "./games.js";
import { screenParents } from "./parents.js";
import { CERTIFICATES, checkCertificates, screenCertificate } from "./rewards.js";

// ---------- المستويات ----------
export function visibleLevels(p = store.active) {
  return p.age === "small" ? LEVELS.filter((l) => l.age === "small") : LEVELS;
}

function isUnlocked(level, p = store.active) {
  if (!LOCK_LEVELS) return true;
  const list = visibleLevels(p);
  const i = list.indexOf(level);
  if (i <= 0) return true;
  if (p.age === "big" && level.age === "small") return true;
  if (p.age === "big" && level === list.find((l) => l.age === "big")) return true;
  return (p.stars[list[i - 1].id] || 0) > 0;
}

const starsText = (n) => "⭐".repeat(n) + "☆".repeat(3 - n);

function starsFor(mistakes, total) {
  if (mistakes === 0) return 3;
  if (mistakes <= Math.ceil(total / 3)) return 2;
  return 1;
}

// ---------- اختيار الطفل ----------
export function screenProfiles() {
  const list = store.profiles;
  if (!list.length) return screenEditProfile();
  render(`
    <div class="mascot">🦉</div>
    <h1>حروفي</h1>
    <p class="sub">من سيلعب الآن؟</p>
    <div class="profiles">
      ${list.map((p) => `
        <button class="profile-card" data-id="${p.id}">
          <span class="avatar">${p.avatar}</span>
          <b>${esc(p.name || "بطل")}</b>
          <small>⭐ ${store.totalStars(p)} · ${p.age === "small" ? "صغير" : "كبير"}</small>
        </button>`).join("")}
      ${list.length < 6 ? `<button class="profile-card add" id="add"><span class="avatar">➕</span><b>طفل جديد</b></button>` : ""}
    </div>
  `);
  $$(".profile-card[data-id]").forEach((b) => (b.onclick = () => {
    sfx.tap();
    store.setActive(b.dataset.id);
    const p = store.active;
    speak(p.name ? `أهلاً ${p.name}` : "أهلاً بك");
    screenMap();
  }));
  $("#add")?.addEventListener("click", () => screenEditProfile());
}

export function screenEditProfile(id = null, back = null) {
  const p = id ? store.data.profiles[id] : null;
  const st = { name: p?.name || "", avatar: p?.avatar || randomOf(AVATARS), age: p?.age || "" };
  render(`
    <div class="topbar">
      ${store.profiles.length ? `<button class="icon-btn" id="back" aria-label="رجوع">→</button>` : `<span class="spacer"></span>`}
      <b>${p ? "تعديل الملف" : "طفل جديد"}</b>
      <span class="spacer"></span>
    </div>
    <div class="mascot" id="preview">${st.avatar}</div>
    <input class="name-input" id="kid-name" maxlength="16" placeholder="ما اسمك؟" value="${esc(st.name)}" autocomplete="off">
    <p class="label">اختر شخصيتك</p>
    <div class="avatars">${AVATARS.map((a) => `<button class="av ${a === st.avatar ? "active" : ""}" data-a="${a}">${a}</button>`).join("")}</div>
    <p class="label">كم عمرك؟</p>
    <div class="age-cards">
      <button class="age-card ${st.age === "small" ? "active" : ""}" data-age="small">
        <span class="e">🐣</span><b>صغير</b><span>من 3 إلى 5 سنوات</span>
      </button>
      <button class="age-card ${st.age === "big" ? "active" : ""}" data-age="big">
        <span class="e">🦁</span><b>كبير</b><span>من 6 إلى 8 سنوات</span>
      </button>
    </div>
    <button class="btn block" id="go">${p ? "حفظ ✔" : "يلا نبدأ 🚀"}</button>
  `);
  $("#back")?.addEventListener("click", () => (back ? back() : screenProfiles()));
  $$(".av").forEach((b) => (b.onclick = () => {
    sfx.tap();
    st.avatar = b.dataset.a;
    $$(".av").forEach((x) => x.classList.toggle("active", x === b));
    $("#preview").textContent = st.avatar;
  }));
  $$(".age-card").forEach((b) => (b.onclick = () => {
    sfx.tap();
    st.age = b.dataset.age;
    $$(".age-card").forEach((x) => x.classList.toggle("active", x === b));
  }));
  $("#go").onclick = () => {
    if (!st.age) { toast("اختر العمر أولاً 👆"); return; }
    st.name = $("#kid-name").value.trim();
    if (p) { store.updateProfile(p.id, st); toast("تم الحفظ"); return back ? back() : screenMap(); }
    store.addProfile(st);
    speak(st.name ? `أهلاً ${st.name}` : "أهلاً بك");
    screenMap();
  };
}

// ---------- خريطة المستويات ----------
export function screenMap() {
  const p = store.active;
  if (!p) return screenProfiles();
  const list = visibleLevels();
  const current = list.find((l) => isUnlocked(l) && !p.stars[l.id]);
  const streak = store.currentStreak();
  const dailyDone = store.dailyDoneToday();
  let lastAge = null;

  const items = list.map((l, i) => {
    const unlocked = isUnlocked(l);
    const s = p.stars[l.id] || 0;
    let head = "";
    if (p.age === "big" && l.age !== lastAge) {
      head = `<div class="section-title">${l.age === "small" ? "🐣 الأساسيات" : "🦁 مستويات الكبار"}</div>`;
      lastAge = l.age;
    }
    return `${head}
      <button class="level ${unlocked ? "" : "locked"} ${l === current ? "current" : ""}" data-id="${l.id}">
        <span class="num">${unlocked ? l.icon : "🔒"}</span>
        <span class="info"><b>${i + 1}. ${l.title}</b><small>${l.desc}</small></span>
        <span class="lstars" aria-label="${s} نجوم">${unlocked ? starsText(s) : ""}</span>
      </button>`;
  }).join("");

  render(`
    <div class="topbar">
      <button class="chip-btn" id="who" aria-label="تغيير الطفل"><span>${p.avatar}</span>${esc(p.name || "بطل")}</button>
      <div class="pills">
        <span class="stars-pill">⭐ ${store.totalStars()}</span>
        <span class="stars-pill ${streak ? "fire" : "dim"}" title="أيام متتالية">🔥 ${streak}</span>
      </div>
    </div>

    <button class="daily-card ${dailyDone ? "done" : ""}" id="daily">
      <span class="d-icon">${dailyDone ? "✅" : "📅"}</span>
      <span class="d-info">
        <b>تحدّي اليوم</b>
        <small>${dailyDone ? "أنجزته اليوم! عد غداً 🔥" : "8 أسئلة من الأشياء التي تحتاج تمريناً"}</small>
      </span>
      <span class="d-go">${dailyDone ? "🔁" : "▶"}</span>
    </button>

    <div class="quick">
      <button class="quick-btn" id="album">🎁<span>ألبومي</span><small>${p.stickers.length}/${STICKERS.length}</small></button>
      <button class="quick-btn" id="certs">📜<span>شهاداتي</span><small>${p.certificates.length}/${CERTIFICATES.length}</small></button>
      <button class="quick-btn" id="parents">👪<span>للأهل</span><small>التقرير</small></button>
    </div>

    <div class="map">${items}</div>
  `);

  $("#who").onclick = screenProfiles;
  $("#daily").onclick = startDaily;
  $("#album").onclick = screenAlbum;
  $("#certs").onclick = screenCertificates;
  $("#parents").onclick = () => screenParents(screenMap);
  $$(".level").forEach((b) => (b.onclick = () => {
    const level = LEVELS.find((l) => l.id === b.dataset.id);
    if (!isUnlocked(level)) { sfx.wrong(); toast("أكمل المستوى السابق أولاً 🔒"); return; }
    sfx.tap();
    startLevel(level);
  }));
  if (current && store.totalStars()) setTimeout(() => document.querySelector(".level.current")?.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
}

// ---------- تشغيل مستوى ----------
export function startLevel(level) {
  const total = level.type === "trace" ? Math.min(4, store.settings.rounds) : store.settings.rounds;
  const go = () => runSession({
    title: level.title,
    icon: level.icon,
    total,
    next: () => GEN[level.type](level),
    onExit: screenMap,
    onFinish: (r) => finishLevel(level, r)
  });
  // الدرس يظهر في أول مرة فقط، ويمكن فتحه لاحقاً من زر المراجعة
  if (level.type === "letters" && !store.active.plays[level.id]) showLesson(level, go, screenMap);
  else go();
}

function finishLevel(level, r) {
  const stars = starsFor(r.mistakes, r.total);
  const { before, after } = store.finishLevel(level.id, stars);
  const rewards = [];
  if (before === 0 && after > 0) rewards.push(store.awardSticker());
  if (before < 3 && after === 3) rewards.push(store.awardSticker());
  const certs = checkCertificates();

  const list = visibleLevels();
  const next = list[list.indexOf(level) + 1];
  showResult({
    stars,
    r,
    stickers: rewards.filter(Boolean),
    certs,
    title: stars === 3 ? "ممتاز! أنت بطل 🏆" : stars === 2 ? "أحسنت! 👏" : "جيد! جرّب مرة أخرى لتحصل على نجوم أكثر",
    primary: next && isUnlocked(next) ? { label: `المستوى التالي ${next.icon}`, run: () => startLevel(next) } : null,
    again: () => startLevel(level),
    extra: level.type === "letters" ? { label: "📚 راجع الدرس", run: () => showLesson(level, () => startLevel(level), screenMap) } : null
  });
}

function showResult({ stars, r, stickers, certs, title, primary, again, extra, note = "" }) {
  render(`
    <div class="result">
      <div class="mascot">${stars === 3 ? "🥳" : stars === 2 ? "😄" : "🙂"}</div>
      <h1>${title}</h1>
      <div class="stars" aria-label="${stars} نجوم">${[1, 2, 3].map((n) => `<span class="${n <= stars ? "" : "off"}">⭐</span>`).join("")}</div>
      <p class="sub">${r.firstTry} من ${r.total} من المحاولة الأولى</p>
      ${note}
      ${stickers.map((s) => `<div class="reward"><span class="sticker-big">${s.e}</span><b>ملصق جديد: ${s.n}!</b><small>تجده في ألبومك 🎁</small></div>`).join("")}
      ${certs.map((c) => `<button class="reward cert" data-cert="${c.id}"><span class="sticker-big">📜</span><b>شهادة جديدة: ${c.title}</b><small>اضغط لعرضها وطباعتها</small></button>`).join("")}
      <div class="result-actions">
        ${primary ? `<button class="btn block" id="primary">${primary.label}</button>` : ""}
        <button class="btn alt block" id="again">العب مرة أخرى 🔁</button>
        ${extra ? `<button class="btn alt block" id="extra">${extra.label}</button>` : ""}
        <button class="btn alt block" id="map">الخريطة 🗺️</button>
      </div>
    </div>
  `);
  sfx.win();
  if (stickers.length || certs.length) setTimeout(sfx.sticker, 700);
  if (stars >= 2) confetti(stars === 3 ? 90 : 45);
  speak(stars === 3 ? "ممتاز! أنت بطل" : stars === 2 ? "أحسنت" : "جيد، حاول مرة أخرى");
  primary && ($("#primary").onclick = primary.run);
  $("#again").onclick = again;
  extra && ($("#extra").onclick = extra.run);
  $("#map").onclick = screenMap;
  $$("[data-cert]").forEach((b) => (b.onclick = () => screenCertificate(CERTIFICATES.find((c) => c.id === b.dataset.cert), screenMap)));
}

// ---------- التحدي اليومي ----------
const DAILY_TYPES = {
  small: ["letters", "similar", "first", "numbers"],
  big: ["letters", "similar", "first", "harakat", "forms", "position", "read", "sentences"]
};
const ALL_LETTERS_LEVEL = { range: [0, LETTERS.length] };

function startDaily() {
  const types = DAILY_TYPES[store.active.age];
  const alreadyDone = store.dailyDoneToday();
  runSession({
    title: "تحدّي اليوم",
    icon: "📅",
    total: 8,
    next: () => GEN[randomOf(types)](ALL_LETTERS_LEVEL),
    onExit: screenMap,
    onFinish: (r) => {
      const stars = starsFor(r.mistakes, r.total);
      const prevStreak = store.currentStreak();
      const streak = store.completeDaily();
      const stickers = [];
      if (!alreadyDone) {
        stickers.push(store.awardSticker());
        if ([3, 7, 14, 30].includes(streak) && streak !== prevStreak) stickers.push(store.awardSticker());
      }
      showResult({
        stars,
        r,
        stickers: stickers.filter(Boolean),
        certs: checkCertificates(),
        title: alreadyDone ? "تمرين إضافي رائع! 💪" : `أنجزت تحدّي اليوم! 🔥 ${streak}`,
        note: alreadyDone ? "" : `<p class="streak-note">${streak === 1 ? "🔥 بدأت سلسلتك اليوم! عد غداً لتكملها" : `🔥 ${plural(streak, ["يوم", "يومان", "أيام", "يوماً"])} متتالية، استمر!`}</p>`,
        primary: null,
        again: startDaily
      });
    }
  });
}

// ---------- ألبوم الملصقات ----------
function screenAlbum() {
  const p = store.active;
  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>🎁 ألبوم ${esc(p.name || "الملصقات")}</b>
      <span class="spacer"></span>
    </div>
    <p class="sub">${p.stickers.length} من ${STICKERS.length} ملصقاً. اجمعها كلها بإنهاء المستويات وتحدّي اليوم!</p>
    <div class="album">
      ${STICKERS.map((s) => p.stickers.includes(s.e)
        ? `<button class="sticker" data-n="${esc(s.n)}">${s.e}<small>${s.n}</small></button>`
        : `<div class="sticker locked">❔</div>`).join("")}
    </div>
  `);
  $("#back").onclick = screenMap;
  $$(".sticker[data-n]").forEach((b) => (b.onclick = () => {
    b.classList.remove("wiggle"); void b.offsetWidth; b.classList.add("wiggle");
    speak(b.dataset.n);
  }));
}

// ---------- الشهادات ----------
function screenCertificates() {
  const p = store.active;
  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>📜 شهاداتي</b>
      <span class="spacer"></span>
    </div>
    <div class="cert-list">
      ${CERTIFICATES.map((c) => {
        const has = p.certificates.includes(c.id);
        return `<button class="cert-item ${has ? "" : "locked"}" data-id="${c.id}">
          <span class="ci">${has ? c.icon : "🔒"}</span>
          <span class="info"><b>${c.title}</b><small>${c.how}</small></span>
        </button>`;
      }).join("")}
    </div>
  `);
  $("#back").onclick = screenMap;
  $$(".cert-item").forEach((b) => (b.onclick = () => {
    const c = CERTIFICATES.find((x) => x.id === b.dataset.id);
    if (!p.certificates.includes(c.id)) { toast(c.how); return; }
    screenCertificate(c, screenCertificates);
  }));
}

// ---------- البدء ----------
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// منع التكبير بالنقر المزدوج على أزرار اللعب
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });

store.active ? screenMap() : screenProfiles();
