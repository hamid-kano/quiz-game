// ============================================================
//  لوحة الأهل: بوابة بسيطة + تقرير التقدّم ونقاط الضعف + الإعدادات
// ============================================================
import { LETTERS, HARAKAT, SKILLS } from "./data.js";
import { store, MAX_BOX } from "./store.js";
import { hasArabicVoice, sfx } from "./sfx.js";
import { render, $, $$, esc, shuffle, today, toArabicDigits, toast, plural } from "./util.js";
import { screenEditProfile, screenProfiles, skillsFor, activitiesFor } from "./main.js";

const byLetter = Object.fromEntries(LETTERS.map((L) => [L.l, L]));
const hkName = Object.fromEntries(HARAKAT.map((h) => [h.id, h.name]));
const n = (x) => toArabicDigits(x);

// ---------- بوابة الأهل: سؤال ضرب بسيط يصعب على الطفل ----------
export function screenParents(back) {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  const right = a * b;
  const opts = shuffle([right, right + a, right - b, right + 1 + Math.floor(Math.random() * 5)].filter((v, i, arr) => arr.indexOf(v) === i));
  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>👪 للأهل فقط</b>
      <span class="spacer"></span>
    </div>
    <div class="prompt">
      <div class="q">للدخول، أجب عن هذا السؤال:</div>
      <div class="big latin">${a} × ${b} = ?</div>
    </div>
    <div class="choices">${opts.map((o) => `<button class="choice num" data-v="${o}">${o}</button>`).join("")}</div>
  `);
  $("#back").onclick = back;
  $$(".choice").forEach((btn) => (btn.onclick = () => {
    if (Number(btn.dataset.v) === right) { sfx.tap(); screenReport(back); }
    else { sfx.wrong(); toast("إجابة خاطئة"); back(); }
  }));
}

// ---------- حساب الإحصاءات ----------
export function letterStatus(p, l) {
  const keys = ["rec:", "snd:", "frm:", "trc:"].map((k) => p.mastery[k + l]).filter(Boolean);
  if (!keys.length) return { cls: "unseen", label: "لم يتدرّب بعد", score: -1, seen: 0, acc: 0 };
  const seen = keys.reduce((s, m) => s + m.seen, 0);
  const right = keys.reduce((s, m) => s + m.right, 0);
  const box = keys.reduce((s, m) => s + m.box, 0) / keys.length;
  const acc = right / seen;
  const score = box / MAX_BOX * 0.6 + acc * 0.4;
  const cls = score >= 0.7 ? "good" : score >= 0.4 ? "mid" : "weak";
  const label = cls === "good" ? "متقن" : cls === "mid" ? "يتحسّن" : "يحتاج تمريناً";
  return { cls, label, score, seen, acc };
}

function lastDays(p, count = 7) {
  const out = [];
  const names = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = today(d);
    const v = p.days[key] || { answers: 0, right: 0, seconds: 0 };
    out.push({ key, label: i === 0 ? "اليوم" : names[d.getDay()], ...v });
  }
  return out;
}

function confusionList(p) {
  return Object.entries(p.confusions)
    .map(([k, c]) => { const [t, ch] = k.split(">"); return { t, ch, c }; })
    .filter((x) => (byLetter[x.t] && byLetter[x.ch]) || (hkName[x.t] && hkName[x.ch]))
    .sort((a, b) => b.c - a.c)
    .slice(0, 5);
}

const confText = (x) => byLetter[x.t]
  ? `<b class="ltr-l">${x.t}</b> مع <b class="ltr-l">${x.ch}</b> <small>(${byLetter[x.t].name} / ${byLetter[x.ch].name})</small>`
  : `<b>${hkName[x.t]}</b> مع <b>${hkName[x.ch]}</b>`;

// ---------- التقرير ----------
function screenReport(back) {
  const p = store.active;
  const levels = activitiesFor(p).filter((a) => a.type !== "lesson");
  const done = levels.filter((l) => p.stars[l.id]).length;
  const skills = skillsFor(p).map((sk) => ({ sk, pr: store.skillProgress(sk, p) }));
  const weakest = skills.filter((x) => x.pr.seen).sort((a, b) => a.pr.value - b.pr.value)[0];
  const week = lastDays(p);
  const weekAnswers = week.reduce((s, d) => s + d.answers, 0);
  const weekRight = week.reduce((s, d) => s + d.right, 0);
  const weekMin = Math.round(week.reduce((s, d) => s + d.seconds, 0) / 60);
  const maxAns = Math.max(1, ...week.map((d) => d.answers));
  const statuses = LETTERS.map((L) => ({ L, ...letterStatus(p, L.l) }));
  const weak = statuses.filter((s) => s.seen && s.cls !== "good").sort((a, b) => a.score - b.score).slice(0, 5);
  const mastered = statuses.filter((s) => s.cls === "good").length;
  const conf = confusionList(p);

  let advice;
  if (!weekAnswers && !Object.keys(p.mastery).length) advice = "لا توجد بيانات كافية بعد. بعد بضعة مستويات سيظهر هنا ما يتقنه طفلك وما يحتاج تمريناً.";
  else if (weak.length) advice = `ننصح بالتركيز على: ${weak.map((s) => `<b>${s.L.l}</b>`).join("، ")}. التطبيق يكرّر هذه الحروف تلقائياً أكثر من غيرها، و«تحدّي اليوم» يركّز عليها.`;
  else advice = "أداء ممتاز! جرّب المستويات التالية أو حافظ على تحدّي اليوم للمراجعة المنتظمة.";
  if (weakest && weakest.pr.value < 0.6) advice += ` أضعف مهارة الآن: <b>${weakest.sk.icon} ${weakest.sk.name}</b>، جرّبا معاً أنشطة هذا القسم.`;
  if (weekAnswers && weekMin < 10) advice += " جلسات قصيرة يومية (5–10 دقائق) أفضل من جلسة طويلة أسبوعياً.";

  render(`
    <div class="topbar">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>👪 تقرير ${esc(p.name || "طفلك")}</b>
      <span class="spacer"></span>
    </div>

    <div class="parents">
      <div class="summary">
        <div><b>${n(store.totalStars(p))}</b><small>نجمة</small></div>
        <div><b>${n(done)}/${n(levels.length)}</b><small>نشاط مكتمل</small></div>
        <div><b>${n(mastered)}/${n(LETTERS.length)}</b><small>حرف متقن</small></div>
        <div><b>${n(weekMin)}</b><small>دقيقة هذا الأسبوع</small></div>
        <div><b>${weekAnswers ? n(Math.round(weekRight / weekAnswers * 100)) + "٪" : "—"}</b><small>دقة هذا الأسبوع</small></div>
        <div><b>🔥 ${n(store.currentStreak())}</b><small>أفضل سلسلة ${n(p.daily.best || 0)}</small></div>
      </div>

      <div class="panel advice">💡 ${advice}</div>

      <h3>🎯 المهارات</h3>
      <div class="panel skill-bars">
        ${skills.map(({ sk, pr }) => `
          <div class="sbar" style="--c:${sk.color}">
            <span class="sname">${sk.icon} ${sk.name}</span>
            <span class="meter"><i style="width:${Math.max(2, Math.round(pr.value * 100))}%"></i></span>
            <b>${pr.seen ? n(Math.round(pr.value * 100)) + "٪" : "—"}</b>
          </div>
          <small class="sgoal">${sk.goal}</small>`).join("")}
      </div>

      <h3>📅 آخر 7 أيام</h3>
      <div class="panel bars" role="img" aria-label="عدد الإجابات في آخر سبعة أيام">
        ${week.map((d) => `
          <div class="bar">
            <span class="bar-val">${d.answers ? n(d.answers) : ""}</span>
            <span class="bar-fill" style="height:${Math.round(d.answers / maxAns * 100)}%"></span>
            <small>${d.label}</small>
          </div>`).join("")}
      </div>

      <h3>🔤 خريطة الحروف</h3>
      <div class="panel">
        <div class="letter-grid">
          ${statuses.map((s) => `<button class="lg ${s.cls}" data-l="${s.L.l}" title="${s.L.name}: ${s.label}">${s.L.l}</button>`).join("")}
        </div>
        <div class="legend">
          <span><i class="good"></i>متقن</span><span><i class="mid"></i>يتحسّن</span>
          <span><i class="weak"></i>يحتاج تمريناً</span><span><i class="unseen"></i>لم يبدأ</span>
        </div>
      </div>

      <h3>🔀 أكثر ما يخلط بينه</h3>
      <div class="panel">
        ${conf.length
          ? `<ul class="conf">${conf.map((x) => `<li>${confText(x)} <span class="cnt">${plural(x.c, ["مرة واحدة", "مرتان", "مرات", "مرة"])}</span></li>`).join("")}</ul>`
          : `<p class="muted">لا يوجد خلط متكرر حتى الآن 👍</p>`}
      </div>

      <h3>🗂️ الأنشطة</h3>
      <table>
        <tr><th>النشاط</th><th>النجوم</th><th>مرات اللعب</th></tr>
        ${skills.map(({ sk }) => `<tr class="group-row"><th colspan="3">${sk.icon} ${sk.name}</th></tr>` +
          sk.activities.filter((a) => a.type !== "lesson").map((l) => `<tr><td>${l.icon} ${l.title}</td><td>${"⭐".repeat(p.stars[l.id] || 0) || "—"}</td><td>${n(p.plays[l.id] || 0)}</td></tr>`).join("")).join("")}
      </table>

      <h3>⚙️ الإعدادات</h3>
      <div class="panel settings">
        ${toggle("sfx", "🔔 المؤثرات الصوتية")}
        ${toggle("speech", "🗣️ نطق الحروف والكلمات")}
        ${toggle("vibrate", "📳 الاهتزاز عند الإجابة")}
        <div class="setting">
          <span>❓ عدد الأسئلة في كل مستوى</span>
          <div class="seg">${[4, 6, 8, 10].map((v) => `<button class="${store.settings.rounds === v ? "on" : ""}" data-rounds="${v}">${n(v)}</button>`).join("")}</div>
        </div>
        <p class="muted">${hasArabicVoice() ? "✔ يوجد صوت عربي على هذا الجهاز." : "⚠️ لم نجد صوتاً عربياً على هذا الجهاز. يمكن إضافته من إعدادات الجهاز ← اللغة ← تحويل النص إلى كلام."}</p>
      </div>

      <h3>👶 الملفات</h3>
      <div class="result-actions">
        <button class="btn alt block" id="edit">✏️ تعديل اسم أو عمر ${esc(p.name || "الطفل")}</button>
        <button class="btn alt block" id="switch">👥 تبديل الطفل أو إضافة طفل</button>
        <button class="btn alt block" id="export">💾 حفظ نسخة احتياطية</button>
        <label class="btn alt block" for="import-file">📂 استعادة نسخة احتياطية</label>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <button class="btn alt block danger" id="reset">🗑️ مسح تقدّم ${esc(p.name || "الطفل")}</button>
        ${store.profiles.length > 1 ? `<button class="btn alt block danger" id="delete">❌ حذف ملف ${esc(p.name || "الطفل")}</button>` : ""}
      </div>
      <p class="muted center">كل البيانات محفوظة على هذا الجهاز فقط، ولا تُرسل إلى أي جهة.</p>
    </div>
  `);

  $("#back").onclick = back;
  $$(".lg").forEach((b) => (b.onclick = () => {
    const s = statuses.find((x) => x.L.l === b.dataset.l);
    toast(`${s.L.name}: ${s.label}${s.seen ? ` · ${n(Math.round(s.acc * 100))}٪ من ${n(s.seen)} محاولة` : ""}`);
  }));
  $$("[data-setting]").forEach((inp) => (inp.onchange = () => store.setSetting(inp.dataset.setting, inp.checked)));
  $$("[data-rounds]").forEach((b) => (b.onclick = () => {
    store.setSetting("rounds", Number(b.dataset.rounds));
    $$("[data-rounds]").forEach((x) => x.classList.toggle("on", x === b));
  }));
  $("#edit").onclick = () => screenEditProfile(p.id, () => screenReport(back));
  $("#switch").onclick = screenProfiles;
  $("#export").onclick = exportBackup;
  $("#import-file").onchange = (e) => importBackup(e.target.files[0], () => screenReport(back));
  $("#reset").onclick = () => {
    if (!confirm(`هل تريد مسح كل نجوم وتقدّم ${p.name || "الطفل"}؟ لا يمكن التراجع.`)) return;
    store.resetProgress(p.id);
    toast("تم مسح التقدّم");
    screenReport(back);
  };
  $("#delete")?.addEventListener("click", () => {
    if (!confirm(`هل تريد حذف ملف ${p.name || "الطفل"} نهائياً؟`)) return;
    store.deleteProfile(p.id);
    screenProfiles();
  });
}

function toggle(key, label) {
  return `<label class="setting"><span>${label}</span>
    <input type="checkbox" class="switch" data-setting="${key}" ${store.settings[key] ? "checked" : ""}></label>`;
}

// ---------- النسخ الاحتياطي (ملف محلي) ----------
function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: "huroofi", version: 2, saved: new Date().toISOString(), data: store.data }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `huroofi-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("تم حفظ النسخة الاحتياطية ✔");
}

function importBackup(file, done) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const json = JSON.parse(r.result);
      if (json.app !== "huroofi" || !json.data?.profiles) throw new Error("bad");
      if (!confirm("سيتم استبدال كل البيانات الحالية بالنسخة الاحتياطية. متابعة؟")) return;
      store.data = json.data;
      store.save();
      location.reload();
    } catch {
      toast("الملف غير صالح ❌");
      done();
    }
  };
  r.readAsText(file);
}

