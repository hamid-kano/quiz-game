// بيانات تطبيق حروفي

// إعدادات عامة
// LOCK_LEVELS = false: كل المستويات مفتوحة (أثناء التطوير والتجربة)
// LOCK_LEVELS = true : يجب إنهاء كل مستوى لفتح الذي بعده
const LOCK_LEVELS = false;

// c: يتصل بما بعده؟ (false للحروف التي لا تتصل بما بعدها)
const LETTERS = [
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

// كلمات قصيرة للتركيب والقراءة
const WORDS_SHORT = [
  { w: "دب", emoji: "🐻" }, { w: "يد", emoji: "✋" }, { w: "قطة", emoji: "🐱" },
  { w: "بطة", emoji: "🦆" }, { w: "جمل", emoji: "🐫" }, { w: "فيل", emoji: "🐘" },
  { w: "شمس", emoji: "☀️" }, { w: "موز", emoji: "🍌" }, { w: "عنب", emoji: "🍇" },
  { w: "بيت", emoji: "🏠" }, { w: "قمر", emoji: "🌙" }, { w: "أسد", emoji: "🦁" },
  { w: "باب", emoji: "🚪" }, { w: "ورد", emoji: "🌹" }, { w: "كلب", emoji: "🐶" }
];

const WORDS_LONG = [
  { w: "سمكة", emoji: "🐟" }, { w: "نحلة", emoji: "🐝" }, { w: "كتاب", emoji: "📖" },
  { w: "أرنب", emoji: "🐰" }, { w: "ثعلب", emoji: "🦊" }, { w: "حصان", emoji: "🐴" },
  { w: "خروف", emoji: "🐑" }, { w: "وردة", emoji: "🌹" }, { w: "غيمة", emoji: "☁️" },
  { w: "تفاحة", emoji: "🍎" }, { w: "زرافة", emoji: "🦒" }, { w: "ليمون", emoji: "🍋" },
  { w: "قلم", emoji: "✏️" }, { w: "نجمة", emoji: "⭐" }, { w: "شجرة", emoji: "🌳" }
];

const HARAKAT = [
  { mark: "َ", name: "الفتحة", sound: "a" },
  { mark: "ُ", name: "الضمة", sound: "u" },
  { mark: "ِ", name: "الكسرة", sound: "i" }
];

// المستويات: age = "small" للصغار (3–5) أو "big" للكبار (6–8)
const LEVELS = [
  { id: 1,  type: "letters", title: "حروف 1", desc: "من الألف إلى الخاء", range: [0, 7],   icon: "🌱", age: "small" },
  { id: 2,  type: "letters", title: "حروف 2", desc: "من الدال إلى الضاد", range: [7, 15],  icon: "🌿", age: "small" },
  { id: 3,  type: "letters", title: "حروف 3", desc: "من الطاء إلى الياء", range: [15, 28], icon: "🌳", age: "small" },
  { id: 4,  type: "trace",   title: "ارسم الحرف", desc: "تتبّع الحرف بإصبعك", icon: "✏️", age: "small" },
  { id: 5,  type: "first",   title: "أول حرف", desc: "بأي حرف تبدأ الصورة؟", icon: "🖼️", age: "small" },
  { id: 6,  type: "harakat", title: "الحركات", desc: "فتحة، ضمة، كسرة", icon: "🎵", age: "big" },
  { id: 7,  type: "build",   title: "ركّب الكلمة", desc: "كلمات من 2–3 حروف", words: "short", icon: "🧩", age: "big" },
  { id: 8,  type: "read",    title: "اقرأ واختر", desc: "اقرأ الكلمة واختر صورتها", icon: "📖", age: "big" },
  { id: 9,  type: "build",   title: "كلمات أطول", desc: "كلمات من 4–5 حروف", words: "long", icon: "🏆", age: "big" }
];
