// ============================================================
//  محتوى تطبيق حروفي
//  كل المحتوى هنا: لإضافة حرف أو كلمة أو مستوى عدّل هذا الملف فقط
// ============================================================

// LOCK_LEVELS = false: كل المستويات مفتوحة (أثناء التطوير والتجربة)
// LOCK_LEVELS = true : يجب إنهاء كل مستوى لفتح الذي بعده
export const LOCK_LEVELS = false;

// عدد الأسئلة الافتراضي في كل مستوى (يمكن تغييره من لوحة الأهل)
export const DEFAULT_ROUNDS = 6;

// c: هل يتصل الحرف بما بعده؟
export const LETTERS = [
  { l: "أ", name: "ألف", word: "أرنب", emoji: "🐰", c: false },
  { l: "ب", name: "باء", word: "بطة", emoji: "🦆", c: true },
  { l: "ت", name: "تاء", word: "تفاحة", emoji: "🍎", c: true },
  { l: "ث", name: "ثاء", word: "ثعلب", emoji: "🦊", c: true },
  { l: "ج", name: "جيم", word: "جمل", emoji: "🐫", c: true },
  { l: "ح", name: "حاء", word: "حصان", emoji: "🐴", c: true },
  { l: "خ", name: "خاء", word: "خروف", emoji: "🐑", c: true },
  { l: "د", name: "دال", word: "دب", emoji: "🐻", c: false },
  { l: "ذ", name: "ذال", word: "ذرة", emoji: "🌽", c: false },
  { l: "ر", name: "راء", word: "ريشة", emoji: "🪶", c: false },
  { l: "ز", name: "زاي", word: "زرافة", emoji: "🦒", c: false },
  { l: "س", name: "سين", word: "سمكة", emoji: "🐟", c: true },
  { l: "ش", name: "شين", word: "شمس", emoji: "☀️", c: true },
  { l: "ص", name: "صاد", word: "صقر", emoji: "🦅", c: true },
  { l: "ض", name: "ضاد", word: "ضفدع", emoji: "🐸", c: true },
  { l: "ط", name: "طاء", word: "طائرة", emoji: "✈️", c: true },
  { l: "ظ", name: "ظاء", word: "ظرف", emoji: "✉️", c: true },
  { l: "ع", name: "عين", word: "عنب", emoji: "🍇", c: true },
  { l: "غ", name: "غين", word: "غيمة", emoji: "☁️", c: true },
  { l: "ف", name: "فاء", word: "فيل", emoji: "🐘", c: true },
  { l: "ق", name: "قاف", word: "قطة", emoji: "🐱", c: true },
  { l: "ك", name: "كاف", word: "كتاب", emoji: "📖", c: true },
  { l: "ل", name: "لام", word: "ليمون", emoji: "🍋", c: true },
  { l: "م", name: "ميم", word: "موز", emoji: "🍌", c: true },
  { l: "ن", name: "نون", word: "نحلة", emoji: "🐝", c: true },
  { l: "ه", name: "هاء", word: "هدية", emoji: "🎁", c: true },
  { l: "و", name: "واو", word: "وردة", emoji: "🌹", c: false },
  { l: "ي", name: "ياء", word: "يد", emoji: "✋", c: true }
];

// مجموعات الحروف المتشابهة في الشكل (تختلف بالنقاط غالباً)
export const SIMILAR_GROUPS = [
  ["ب", "ت", "ث", "ن", "ي"],
  ["ج", "ح", "خ"],
  ["د", "ذ"],
  ["ر", "ز"],
  ["س", "ش"],
  ["ص", "ض"],
  ["ط", "ظ"],
  ["ع", "غ"],
  ["ف", "ق"]
];

export const WORDS_SHORT = [
  { w: "دب", emoji: "🐻" }, { w: "يد", emoji: "✋" }, { w: "قطة", emoji: "🐱" },
  { w: "بطة", emoji: "🦆" }, { w: "جمل", emoji: "🐫" }, { w: "فيل", emoji: "🐘" },
  { w: "شمس", emoji: "☀️" }, { w: "موز", emoji: "🍌" }, { w: "عنب", emoji: "🍇" },
  { w: "بيت", emoji: "🏠" }, { w: "قمر", emoji: "🌙" }, { w: "أسد", emoji: "🦁" },
  { w: "باب", emoji: "🚪" }, { w: "ورد", emoji: "🌹" }, { w: "كلب", emoji: "🐶" }
];

export const WORDS_LONG = [
  { w: "سمكة", emoji: "🐟" }, { w: "نحلة", emoji: "🐝" }, { w: "كتاب", emoji: "📖" },
  { w: "أرنب", emoji: "🐰" }, { w: "ثعلب", emoji: "🦊" }, { w: "حصان", emoji: "🐴" },
  { w: "خروف", emoji: "🐑" }, { w: "وردة", emoji: "🌹" }, { w: "غيمة", emoji: "☁️" },
  { w: "تفاحة", emoji: "🍎" }, { w: "زرافة", emoji: "🦒" }, { w: "ليمون", emoji: "🍋" },
  { w: "قلم", emoji: "✏️" }, { w: "نجمة", emoji: "⭐" }, { w: "شجرة", emoji: "🌳" }
];

export const ALL_WORDS = [...WORDS_SHORT, ...WORDS_LONG];

export const HARAKAT = [
  { id: "a", mark: "َ", name: "الفتحة" },
  { id: "u", mark: "ُ", name: "الضمة" },
  { id: "i", mark: "ِ", name: "الكسرة" }
];

export const NUMBERS = [
  { n: 1, d: "١", name: "واحد" }, { n: 2, d: "٢", name: "اثنان" }, { n: 3, d: "٣", name: "ثلاثة" },
  { n: 4, d: "٤", name: "أربعة" }, { n: 5, d: "٥", name: "خمسة" }, { n: 6, d: "٦", name: "ستة" },
  { n: 7, d: "٧", name: "سبعة" }, { n: 8, d: "٨", name: "ثمانية" }, { n: 9, d: "٩", name: "تسعة" },
  { n: 10, d: "١٠", name: "عشرة" }
];
export const COUNT_EMOJIS = ["🍎", "⭐", "🐟", "🎈", "🌸", "🍓", "🐞", "⚽", "🍪", "🐥"];

export const SENTENCES = [
  { s: "القطة نائمة", pic: "🐱💤" },
  { s: "الولد يأكل تفاحة", pic: "👦🍎" },
  { s: "البنت تقرأ كتاباً", pic: "👧📖" },
  { s: "البطة تسبح في الماء", pic: "🦆🌊" },
  { s: "الطائرة في السماء", pic: "✈️☁️" },
  { s: "الكلب يلعب بالكرة", pic: "🐶⚽" },
  { s: "أبي يقود السيارة", pic: "👨🚗" },
  { s: "النحلة على الوردة", pic: "🐝🌹" },
  { s: "القمر في الليل", pic: "🌙🌃" },
  { s: "الطفل نائم في السرير", pic: "👶🛏️" },
  { s: "الولد يشرب الحليب", pic: "👦🥛" },
  { s: "المطر ينزل من الغيمة", pic: "🌧️☔" },
  { s: "الأسد في الغابة", pic: "🦁🌳" },
  { s: "البنت تلعب بالبالون", pic: "👧🎈" },
  { s: "السمكة في البحر", pic: "🐟🌊" }
];

// age: small = 3–5 سنوات، big = 6–8 سنوات
// المستويات تظهر بهذا الترتيب. للصغار: مستويات small فقط. للكبار: الكل.
export const LEVELS = [
  { id: "letters1", type: "letters", title: "حروف 1", desc: "من الألف إلى الخاء", range: [0, 7], icon: "🌱", age: "small" },
  { id: "letters2", type: "letters", title: "حروف 2", desc: "من الدال إلى الضاد", range: [7, 15], icon: "🌿", age: "small" },
  { id: "letters3", type: "letters", title: "حروف 3", desc: "من الطاء إلى الياء", range: [15, 28], icon: "🌳", age: "small" },
  { id: "trace", type: "trace", title: "ارسم الحرف", desc: "تتبّع الحرف بإصبعك", icon: "✏️", age: "small" },
  { id: "first", type: "first", title: "أول حرف", desc: "بأي حرف تبدأ الصورة؟", icon: "🖼️", age: "small" },
  { id: "similar", type: "similar", title: "حروف متشابهة", desc: "انتبه للنقاط!", icon: "🔍", age: "small" },
  { id: "numbers", type: "numbers", title: "الأرقام", desc: "عُدّ واختر الرقم", icon: "🔢", age: "small" },
  { id: "harakat", type: "harakat", title: "الحركات", desc: "فتحة، ضمة، كسرة", icon: "🎵", age: "big" },
  { id: "forms", type: "forms", title: "أشكال الحرف", desc: "اعرف الحرف من شكله", icon: "🔤", age: "big" },
  { id: "position", type: "position", title: "مكان الحرف", desc: "أول الكلمة أم وسطها أم آخرها؟", icon: "📍", age: "big" },
  { id: "build", type: "build", title: "ركّب الكلمة", desc: "كلمات من 2–3 حروف", words: "short", icon: "🧩", age: "big" },
  { id: "read", type: "read", title: "اقرأ واختر", desc: "اقرأ الكلمة واختر صورتها", icon: "📖", age: "big" },
  { id: "build2", type: "build", title: "كلمات أطول", desc: "كلمات من 4–5 حروف", words: "long", icon: "🏗️", age: "big" },
  { id: "sentences", type: "sentences", title: "اقرأ الجملة", desc: "جمل قصيرة ومعناها", icon: "🏆", age: "big" }
];

export const AVATARS = ["🦁", "🐼", "🐰", "🦊", "🐯", "🐨", "🐸", "🦄", "🐧", "🐵", "🐱", "🐶"];

export const STICKERS = [
  { e: "🦋", n: "فراشة" }, { e: "🐳", n: "حوت" }, { e: "🦖", n: "ديناصور" }, { e: "🚀", n: "صاروخ" },
  { e: "🌈", n: "قوس قزح" }, { e: "🍉", n: "بطيخ" }, { e: "🎨", n: "ألوان" }, { e: "🐢", n: "سلحفاة" },
  { e: "🦉", n: "بومة" }, { e: "🌻", n: "عباد الشمس" }, { e: "🚂", n: "قطار" }, { e: "🐙", n: "أخطبوط" },
  { e: "🎠", n: "حصان دوّار" }, { e: "🦩", n: "فلامنغو" }, { e: "🍩", n: "دونات" }, { e: "🪁", n: "طائرة ورقية" },
  { e: "🐬", n: "دلفين" }, { e: "🦜", n: "ببغاء" }, { e: "🌵", n: "صبّار" }, { e: "🏰", n: "قلعة" },
  { e: "🐞", n: "دعسوقة" }, { e: "🦒", n: "زرافة" }, { e: "🍭", n: "مصّاصة" }, { e: "⛵", n: "قارب" },
  { e: "🐘", n: "فيل" }, { e: "🎁", n: "هدية" }, { e: "🦔", n: "قنفذ" }, { e: "🌋", n: "بركان" },
  { e: "🐝", n: "نحلة" }, { e: "🎡", n: "دولاب" }, { e: "🦀", n: "سلطعون" }, { e: "🏆", n: "كأس" }
];
