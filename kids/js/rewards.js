// ============================================================
//  الشهادات: تُرسم محلياً على Canvas وتُحمَّل أو تُطبع بدون أي خدمة خارجية
// ============================================================
import { SKILLS } from "./data.js";
import { store } from "./store.js";
import { render, $, esc, today, toArabicDigits, toast } from "./util.js";
import { sfx } from "./sfx.js";

// شهادة لكل مهارة عند بلوغ 80٪ من إتقانها، وشهادة للمواظبة
const SKILL_CERT_TEXT = {
  sounds: "لتميّزه في سماع الأصوات وتمييزها في الكلمات",
  letters: "لإتقانه التعرّف على حروف اللغة العربية وأشكالها",
  writing: "لتميّزه في كتابة الحروف والأرقام وتهجئة الكلمات",
  reading: "لتميّزه في قراءة المقاطع والكلمات",
  understanding: "لتميّزه في فهم المعاني والجمل والقصص",
  numbers: "لتميّزه في العدّ والمقارنة والحساب"
};

export const CERTIFICATES = [
  ...SKILLS.map((sk) => ({
    id: "skill-" + sk.id, skill: sk.id, icon: sk.icon, title: `بطل ${sk.name}`,
    text: SKILL_CERT_TEXT[sk.id],
    how: `اوصل إلى ٨٠٪ من إتقان مهارة ${sk.name}`,
    check: (p) => store.skillProgress(sk, p).value >= 0.8
  })),
  {
    id: "streak-7", icon: "🔥", title: "بطل الأسبوع",
    text: "لمواظبته على التعلّم سبعة أيام متتالية",
    how: "أنجز تحدّي اليوم 7 أيام متتالية",
    check: (p) => (p.daily.best || 0) >= 7
  }
];

// يعيد الشهادات الجديدة المكتسبة الآن
export function checkCertificates() {
  const p = store.active;
  return CERTIFICATES.filter((c) => !p.certificates.includes(c.id) && c.check(p) && store.addCertificate(c.id));
}

function arabicDate(iso = today()) {
  const months = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${toArabicDigits(d)} ${months[m - 1]} ${toArabicDigits(y)}`;
}

async function drawCertificate(canvas, c, p) {
  const W = 1600, H = 1130;
  canvas.width = W;
  canvas.height = H;
  const x = canvas.getContext("2d");
  try {
    await Promise.all([
      document.fonts.load('900 80px "Cairo"', "شهادة"),
      document.fonts.load('700 40px "Cairo"', "شهادة")
    ]);
  } catch {}

  // الخلفية
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#fffaf0");
  g.addColorStop(1, "#fff1cc");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  // الإطار
  x.strokeStyle = "#e0a100"; x.lineWidth = 18; x.strokeRect(40, 40, W - 80, H - 80);
  x.strokeStyle = "#12355b"; x.lineWidth = 4; x.strokeRect(78, 78, W - 156, H - 156);

  // زخارف الزوايا
  x.font = "64px serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  [[140, 140], [W - 140, 140], [140, H - 140], [W - 140, H - 140]].forEach(([a, b]) => x.fillText("⭐", a, b));

  x.direction = "rtl";
  x.fillStyle = "#12355b";
  x.font = '900 104px "Cairo", sans-serif';
  x.fillText("شهادة تقدير", W / 2, 215);

  x.font = '700 46px "Cairo", sans-serif';
  x.fillStyle = "#fb8500";
  x.fillText(`${c.icon}  ${c.title}  ${c.icon}`, W / 2, 330);

  x.fillStyle = "#12355b";
  x.font = '400 42px "Cairo", sans-serif';
  x.fillText("تُمنح هذه الشهادة إلى", W / 2, 445);

  x.font = '900 120px "Cairo", sans-serif';
  x.fillText(`${p.name || "البطل الصغير"}`, W / 2, 580);
  x.font = "110px serif";
  x.fillText(p.avatar, W / 2, 725);

  x.font = '400 42px "Cairo", sans-serif';
  x.fillText(c.text, W / 2, 850);

  x.font = '700 34px "Cairo", sans-serif';
  x.fillStyle = "#4a6380";
  x.textAlign = "right";
  x.fillText(`التاريخ: ${arabicDate()}`, W - 150, H - 150);
  x.textAlign = "left";
  x.fillText(`⭐ ${toArabicDigits(store.totalStars(p))} نجمة  ·  تطبيق حروفي 🦉`, 150, H - 150);
}

export async function screenCertificate(c, back) {
  const p = store.active;
  render(`
    <div class="topbar no-print">
      <button class="icon-btn" id="back" aria-label="رجوع">→</button>
      <b>📜 ${esc(c.title)}</b>
      <span class="spacer"></span>
    </div>
    <div class="cert-view" id="print-area"><canvas id="cert"></canvas><img id="cert-img" alt="شهادة ${esc(c.title)}"></div>
    <div class="result-actions no-print">
      <button class="btn block" id="dl">⬇️ تحميل الشهادة</button>
      <button class="btn alt block" id="print">🖨️ طباعة</button>
    </div>
  `);
  $("#back").onclick = back;
  const canvas = $("#cert");
  await drawCertificate(canvas, c, p);
  const url = canvas.toDataURL("image/png");
  $("#cert-img").src = url;
  canvas.remove();
  sfx.sticker();

  $("#dl").onclick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `شهادة-${p.name || "حروفي"}-${c.title}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("تم تحميل الشهادة ✔");
  };
  $("#print").onclick = () => window.print();
}
