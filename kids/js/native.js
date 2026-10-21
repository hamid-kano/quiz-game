// ============================================================
//  طبقة التطبيق الأصلي (أندرويد عبر Capacitor)
//  نفس الكود يعمل في المتصفح وفي التطبيق: هنا فقط ما يختلف بينهما
//  - النطق بمحرّك الجوال (لا يعمل نطق المتصفح داخل تطبيقات أندرويد)
//  - حفظ الملفات ومشاركتها (الشهادات والنسخ الاحتياطي)
//  - زر الرجوع في أندرويد
// ============================================================
const C = window.Capacitor;
export const isNative = !!(C && typeof C.isNativePlatform === "function" && C.isNativePlatform());

const plugin = (name) => (isNative && C.registerPlugin ? C.registerPlugin(name) : null);
export const TTS = plugin("TextToSpeech");
const Filesystem = plugin("Filesystem");
const Share = plugin("Share");
const App = plugin("App");

// ---------- النطق ----------
let ttsArabic = null; // null = لم نتحقق بعد
export async function checkNativeArabic() {
  if (!TTS) return false;
  try {
    const r = await TTS.isLanguageSupported({ lang: "ar-SA" });
    const r2 = r?.supported ? r : await TTS.isLanguageSupported({ lang: "ar" });
    ttsArabic = !!r2?.supported;
  } catch { ttsArabic = false; }
  return ttsArabic;
}
export const nativeArabicReady = () => ttsArabic === true;
export async function openTtsInstall() {
  try { await TTS?.openInstall(); } catch {}
}

// ---------- حفظ الملفات ومشاركتها ----------
const toBase64 = (text) => btoa(unescape(encodeURIComponent(text)));

/**
 * يحفظ ملفاً: في المتصفح يُحمَّل مباشرة، وفي التطبيق يُحفظ ثم تفتح نافذة المشاركة
 * (ليختار الأهل: حفظ في الملفات، إرسال، طباعة...)
 * @param {string} name اسم الملف
 * @param {{dataUrl?: string, text?: string, mime?: string}} content
 */
export async function saveFile(name, { dataUrl, text, mime = "application/octet-stream" }) {
  if (isNative && Filesystem && Share) {
    const data = dataUrl ? dataUrl.split(",")[1] : toBase64(text || "");
    const safe = name.replace(/[\\/:*?"<>|\s]+/g, "-");
    const res = await Filesystem.writeFile({ path: safe, data, directory: "CACHE" });
    await Share.share({ title: name, files: [res.uri], dialogTitle: name });
    return;
  }
  const a = document.createElement("a");
  a.href = dataUrl || URL.createObjectURL(new Blob([text || ""], { type: mime }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (!dataUrl) setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- زر الرجوع في أندرويد ----------
// يضغط زر الرجوع/الخروج الظاهر في الشاشة، وإن لم يوجد (الشاشة الرئيسية) يخرج من التطبيق
export function setupBackButton() {
  if (!App) return;
  App.addListener("backButton", () => {
    const btn = document.querySelector("#back") || document.querySelector("#map") || document.querySelector("#home");
    if (btn) btn.click();
    else App.minimizeApp ? App.minimizeApp() : App.exitApp();
  });
}
