// ============================================================
//  الشاشات الرئيسية والتنقل بينها
//  الفلسفة: كل قسم ينمّي مهارة واحدة، والطفل يتنقّل بحرية بين الأقسام
// ============================================================
import { SKILLS, ACTIVITIES, LETTERS, AVATARS, STICKERS } from "./data.js";
import { store } from "./store.js";
import { speak, sfx, confetti } from "./sfx.js";
import { render, $, $$, esc, toast, randomOf, plural, toArabicDigits } from "./util.js";
import { GEN, runSession, showLesson } from "./games.js";
import { screenParents } from "./parents.js";
import { CERTIFICATES, checkCertificates, screenCertificate } from "./rewards.js";
import { screenStories } from "./stories.js";
import { screenGarden } from "./garden.js";
import { screenSpellGuide } from "./spellguide.js";
import { runArcade } from "./arcade.js";
import { screenVocab } from "./vocab.js";
import { isNative, setupBackButton } from "./native.js";

// ---------- الأقسام والأنشطة المتاحة حسب العمر ----------
const fitsAge = (a, p = store.active) => a.age === "all" || p.age === "big";

export function skillsFor(p = store.active) {
  return SKILLS
    .map((sk) => ({ ...sk, activities: sk.activities.filter((a) => fitsAge(a, p)) }))
    .filter((sk) => sk.activities.length);
}

export const activitiesFor = (p = store.active) => ACTIVITIES.filter((a) => fitsAge(a, p));
const skillOf = (a) => SKILLS.find((s) => s.id === a.skill);
const pct = (v) => Math.round(v * 100);
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
    screenHome();
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
    if (p) { store.updateProfile(p.id, st); toast("تم الحفظ"); return back ? back() : screenHome(); }
    store.addProfile(st);
    speak(st.name ? `أهلاً ${st.name}` : "أهلاً بك");
    screenHome();
  };
}

// ---------- الشاشة الرئيسية: الأقسام ----------
export function screenHome() {
  const p = store.active;
  if (!p) return screenProfiles();
  const streak = store.currentStreak();
  const dailyDone = store.dailyDoneToday();
  const skills = skillsFor();

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
        <small>${dailyDone ? "أنجزته اليوم! عد غداً 🔥" : "8 أسئلة من المهارات التي تحتاج تمريناً"}</small>
      </span>
      <span class="d-go">${dailyDone ? "🔁" : "▶"}</span>
    </button>

    <div class="skills">
      ${skills.map((sk) => {
        const pr = store.skillProgress(sk);
        return `<button class="skill-card" data-skill="${sk.id}" style="--c:${sk.color}">
          <span class="sk-icon">${sk.icon}</span>
          <b>${sk.name}</b>
          <span class="meter" aria-label="الإتقان ${pct(pr.value)}٪"><i style="width:${Math.max(4, pct(pr.value))}%"></i></span>
          <small>${pr.seen ? `${toArabicDigits(pct(pr.value))}٪ إتقان` : "ابدأ هنا"}</small>
        </button>`;
      }).join("")}
    </div>

    <div class="quick">
      <button class="quick-btn" id="garden">🌷<span>حديقتي</span><small>الحروف</small></button>
      <button class="quick-btn" id="album">🎁<span>ألبومي</span><small>${p.stickers.length}/${STICKERS.length}</small></button>
      <button class="quick-btn" id="certs">📜<span>شهاداتي</span><small>${CERTIFICATES.filter((c) => p.certificates.includes(c.id)).length}/${CERTIFICATES.length}</small></button>
      <button class="quick-btn" id="parents">👪<span>للأهل</span><small>التقرير</small></button>
    </div>
  `);

  $("#who").onclick = screenProfiles;
  $("#daily").onclick = startDaily;
  $("#album").onclick = screenAlbum;
  $("#garden").onclick = () => screenGarden(screenHome);
  $("#certs").onclick = screenCertificates;
  $("#parents").onclick = () => screenParents(screenHome);
  $$(".skill-card").forEach((b) => (b.onclick = () => { sfx.tap(); screenSkill(b.dataset.skill); }));
}

// للتوافق مع الشاشات الأخرى
export const screenMap = screenHome;

// ---------- شاشة القسم: أنشطة مهارة واحدة ----------
export function screenSkill(skillId) {
  const p = store.active;
  const sk = skillsFor().find((s) => s.id === skillId);
  if (!sk) return screenHome();
  const pr = store.skillProgress(sk);
  speak(sk.name);

  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>${sk.icon} ${sk.name}</b>
      <span class="spacer"></span>
    </div>
    <div class="skill-head" style="--c:${sk.color}">
      <p>${sk.goal}</p>
      <span class="meter big"><i style="width:${Math.max(3, pct(pr.value))}%"></i></span>
      <small>الإتقان: ${toArabicDigits(pct(pr.value))}٪</small>
    </div>
    <div class="activities">
      ${sk.activities.map((a) => {
        const s = p.stars[a.id] || 0;
        return `<button class="activity ${a.game ? "is-game" : ""}" data-id="${a.id}" style="--c:${sk.color}">
          <span class="num">${a.icon}</span>
          <span class="info"><b>${a.step ? `<span class="stepno">${toArabicDigits(a.step)}</span>` : ""}${a.title}${a.game ? ` <span class="gbadge">🎮 لعبة</span>` : ""}</b><small>${a.desc}</small></span>
          <span class="lstars">${a.type === "lesson" || a.type === "spellGuide" ? "📖" : starsText(s)}</span>
        </button>`;
      }).join("")}
    </div>
  `);
  $("#back").onclick = screenHome;
  $$(".activity").forEach((b) => (b.onclick = () => {
    sfx.tap();
    startActivity(ACTIVITIES.find((a) => a.id === b.dataset.id));
  }));
}

// ---------- تشغيل نشاط ----------
export function startActivity(act) {
  const back = () => screenSkill(act.skill);
  if (act.type === "stories") return screenStories(back, (st, r) => finishStory(st, r, act));
  if (act.type === "lesson") return screenBoard(act);
  if (act.type === "spellGuide") return screenSpellGuide(back, startActivity);
  if (act.type === "arcade") return runArcade(act, { onExit: back, onFinish: (r) => finishActivity(act, r) });
  if (act.type === "vocab") return screenVocab(act, back, (r, again) => finishActivity(act, r, again));
  const total =
    act.type === "trace" ? Math.min(4, store.settings.rounds)
    : act.type === "memory" ? 4
    : act.type === "order" ? Math.min(4, store.settings.rounds)
    : act.type === "keyboard" || act.type === "anagram" ? Math.min(5, store.settings.rounds)
    : store.settings.rounds;
  runSession({
    title: act.title,
    icon: act.icon,
    total,
    next: (i) => GEN[act.type](act, i),
    onExit: back,
    onFinish: (r) => finishActivity(act, r)
  });
}

// للتوافق: كان اسمها startLevel
export const startLevel = startActivity;

function rewardsFor(id, stars) {
  const { before, after } = store.finishLevel(id, stars);
  const stickers = [];
  if (before === 0 && after > 0) stickers.push(store.awardSticker());
  if (before < 3 && after === 3) stickers.push(store.awardSticker());
  return stickers.filter(Boolean);
}

function finishActivity(act, r, againFn = null) {
  const stars = starsFor(r.mistakes, r.total);
  const stickers = rewardsFor(act.id, stars);
  const sk = skillsFor().find((s) => s.id === act.skill);
  const list = sk.activities.filter((a) => a.type !== "lesson" && a.type !== "spellGuide");
  const next = list[(list.findIndex((a) => a.id === act.id) + 1) % list.length];
  const pr = store.skillProgress(sk);
  showResult({
    stars, r, stickers,
    certs: checkCertificates(),
    title: stars === 3 ? "ممتاز! أنت بطل 🏆" : stars === 2 ? "أحسنت! 👏" : "جيد! جرّب مرة أخرى لتحصل على نجوم أكثر",
    note: `<div class="skill-note" style="--c:${sk.color}">${sk.icon} مهارة ${sk.name}: ${toArabicDigits(pct(pr.value))}٪ <span class="meter"><i style="width:${Math.max(3, pct(pr.value))}%"></i></span></div>`,
    primary: next && next.id !== act.id ? { label: `${next.icon} ${next.title}`, run: () => startActivity(next) } : null,
    again: againFn || (() => startActivity(act)),
    home: { label: `${sk.icon} قسم ${sk.name}`, run: () => screenSkill(sk.id) }
  });
}

function finishStory(st, r, act) {
  const stars = starsFor(r.mistakes, r.total);
  const stickers = rewardsFor("story-" + st.id, stars);
  store.finishLevel(act.id, stars);
  const back = () => screenSkill(act.skill);
  showResult({
    stars, r, stickers,
    certs: checkCertificates(),
    title: stars === 3 ? "فهمت القصة تماماً! 📚" : "أحسنت القراءة! 👏",
    primary: { label: "📚 قصة أخرى", run: () => screenStories(back, (s2, r2) => finishStory(s2, r2, act)) },
    again: () => screenStories(back, (s2, r2) => finishStory(s2, r2, act)),
    home: { label: "🧠 قسم الفهم واللغة", run: back }
  });
}

function showResult({ stars, r, stickers, certs, title, primary, again, home, note = "" }) {
  home = home || { label: "🏠 الرئيسية", run: screenHome };
  render(`
    <div class="result">
      <div class="mascot">${stars === 3 ? "🥳" : stars === 2 ? "😄" : "🙂"}</div>
      <h1>${title}</h1>
      <div class="stars" aria-label="${stars} نجوم">${[1, 2, 3].map((n) => `<span class="${n <= stars ? "" : "off"}">⭐</span>`).join("")}</div>
      <p class="sub">${toArabicDigits(r.firstTry)} من ${toArabicDigits(r.total)} من المحاولة الأولى</p>
      ${note}
      ${stickers.map((s) => `<div class="reward"><span class="sticker-big">${s.e}</span><b>ملصق جديد: ${s.n}!</b><small>تجده في ألبومك 🎁</small></div>`).join("")}
      ${certs.map((c) => `<button class="reward cert" data-cert="${c.id}"><span class="sticker-big">📜</span><b>شهادة جديدة: ${c.title}</b><small>اضغط لعرضها وطباعتها</small></button>`).join("")}
      <div class="result-actions">
        ${primary ? `<button class="btn block" id="primary">التالي: ${primary.label}</button>` : ""}
        <button class="btn alt block" id="again">العب مرة أخرى 🔁</button>
        <button class="btn alt block" id="map">${home.label}</button>
      </div>
    </div>
  `);
  sfx.win();
  if (stickers.length || certs.length) setTimeout(sfx.sticker, 700);
  if (stars >= 2) confetti(stars === 3 ? 90 : 45);
  speak(stars === 3 ? "ممتاز! أنت بطل" : stars === 2 ? "أحسنت" : "جيد، حاول مرة أخرى");
  primary && ($("#primary").onclick = primary.run);
  $("#again").onclick = again;
  $("#map").onclick = home.run;
  $$("[data-cert]").forEach((b) => (b.onclick = () => screenCertificate(CERTIFICATES.find((c) => c.id === b.dataset.cert), screenHome)));
}

// ---------- لوحة الحروف ----------
function screenBoard(act) {
  const back = () => screenSkill(act.skill);
  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>📋 لوحة الحروف</b>
      <span class="spacer"></span>
    </div>
    <p class="sub">اضغط على أي حرف لتتعرّف عليه</p>
    <div class="board">${LETTERS.map((L, i) => `<button class="bl" data-i="${i}">${L.l}</button>`).join("")}</div>
  `);
  $("#back").onclick = back;
  $$(".bl").forEach((b) => (b.onclick = () => {
    sfx.tap();
    const i = Number(b.dataset.i);
    const all = { range: [0, LETTERS.length], icon: "📋" };
    // بعد الدرس ننتقل لتمرين المجموعة التي فيها الحرف
    const group = ACTIVITIES.find((a) => a.type === "letters" && i >= a.range[0] && i < a.range[1]);
    showLesson(all, () => startActivity(group), () => screenBoard(act), i);
  }));
}

// ---------- التحدي اليومي: يركّز على المهارات الأضعف ----------
function startDaily() {
  const alreadyDone = store.dailyDoneToday();
  const playable = skillsFor().map((sk) => ({
    sk,
    acts: sk.activities.filter((a) => !["lesson", "spellGuide", "stories", "trace", "memory", "order", "arcade"].includes(a.type))
  })).filter((x) => x.acts.length);

  // المهارة الأقل إتقاناً تحصل على فرصة أكبر
  const pickSkill = () => {
    const ws = playable.map((x) => 1.2 - store.skillProgress(x.sk).value);
    let r = Math.random() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ws.length; i++) if ((r -= ws[i]) <= 0) return playable[i];
    return playable[0];
  };

  runSession({
    title: "تحدّي اليوم",
    icon: "📅",
    total: 8,
    next: () => { const x = pickSkill(); const a = randomOf(x.acts); return GEN[a.type](a); },
    onExit: screenHome,
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
        stars, r,
        stickers: stickers.filter(Boolean),
        certs: checkCertificates(),
        title: alreadyDone ? "تمرين إضافي رائع! 💪" : `أنجزت تحدّي اليوم! 🔥 ${toArabicDigits(streak)}`,
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
    <p class="sub">${toArabicDigits(p.stickers.length)} من ${toArabicDigits(STICKERS.length)} ملصقاً. اجمعها كلها بإنهاء الأنشطة وتحدّي اليوم!</p>
    <div class="album">
      ${STICKERS.map((s) => p.stickers.includes(s.e)
        ? `<button class="sticker" data-n="${esc(s.n)}">${s.e}<small>${s.n}</small></button>`
        : `<div class="sticker locked">❔</div>`).join("")}
    </div>
  `);
  $("#back").onclick = screenHome;
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
      ${CERTIFICATES.filter((c) => !c.skill || skillsFor().some((s) => s.id === c.skill)).map((c) => {
        const has = p.certificates.includes(c.id);
        return `<button class="cert-item ${has ? "" : "locked"}" data-id="${c.id}">
          <span class="ci">${has ? c.icon : "🔒"}</span>
          <span class="info"><b>${c.title}</b><small>${c.how}</small></span>
        </button>`;
      }).join("")}
    </div>
  `);
  $("#back").onclick = screenHome;
  $$(".cert-item").forEach((b) => (b.onclick = () => {
    const c = CERTIFICATES.find((x) => x.id === b.dataset.id);
    if (!p.certificates.includes(c.id)) { toast(c.how); return; }
    screenCertificate(c, screenCertificates);
  }));
}

// ---------- البدء ----------
// في التطبيق الأصلي كل الملفات داخل التطبيق، فلا حاجة لعامل الخدمة
if (isNative) setupBackButton();
else if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// منع التكبير بالنقر المزدوج على أزرار اللعب
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });

store.active ? screenHome() : screenProfiles();
