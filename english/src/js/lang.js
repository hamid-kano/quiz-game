// ============================================================
//  إعدادات تطبيق «حروفي English»: الواجهة والتعليمات بالعربية،
//  والمحتوى الذي يتعلّمه الطفل بالإنجليزية
//  (يستبدل kids/js/lang.js عند بناء تطبيق الإنجليزية)
// ============================================================
export const LANG = {
  code: "en",
  appName: "حروفي English",
  tagline: "نتعلّم الإنجليزية ونحن نلعب",
  mascot: "🐝",
  contentDir: "ltr",
  contentTts: "en-US",
  digits: "latin",
  storageKey: "huroofi-en-v1",
  legacyKey: "",
  ages: [
    { id: "small", e: "🐣", name: "صغير", range: "3 – 5 سنوات" },
    { id: "big", e: "🦁", name: "كبير", range: "6 – 8 سنوات" },
    { id: "older", e: "🚀", name: "متقدّم", range: "9 – 12 سنة" }
  ],
  keyboard: "abcdefghijklmnopqrstuvwxyz".split(""),
  certFooter: "تطبيق حروفي English 🐝",
  letterWord: "حرف",
  // كتابة الاسم بالإنجليزية في تمرين «اكتب اسمك»
  nameRe: /^[A-Za-z]{2,8}$/,
  nameHint: "بالإنجليزية",
  // كلمات لا يُسمع حرفها الأخير كما يُكتب (cake, bunny, cow, fish, king...)
  silentEnd: /(e|y|w|sh|ch|th|ng|gh|x)$/
};

const RANK = { small: 0, big: 1, older: 2 };
export const ageRank = (age) => RANK[age] ?? 0;
export const ageInfo = (age) => LANG.ages.find((a) => a.id === age) || LANG.ages[0];
