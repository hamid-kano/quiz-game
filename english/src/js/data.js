// ============================================================
//  محتوى تطبيق «حروفي English»
//  التعليمات بالعربية، والمحتوى الذي يتعلّمه الطفل بالإنجليزية.
//  يصدّر نفس الأسماء التي يصدّرها محتوى التطبيق العربي حتى يعمل المحرّك نفسه.
// ============================================================

export const DEFAULT_ROUNDS = 6;

// l: الحرف الصغير (تُكتب به الكلمات) · name: الحرف الكبير (يُنطق اسمه) · alike: حروف لها نفس الصوت
const L = (l, word, emoji, extra = {}) => ({
  l, name: l.toUpperCase(), word, emoji, c: false,
  forms: [["كبير", l.toUpperCase()], ["صغير", l]],
  say: `حرف ${l.toUpperCase()}، ${word}... ${word}`,
  ...extra
});
export const LETTERS = [
  L("a", "apple", "🍎"), L("b", "ball", "⚽"), L("c", "cat", "🐱", { alike: ["k"] }), L("d", "dog", "🐶"),
  L("e", "egg", "🥚"), L("f", "fish", "🐟"), L("g", "goat", "🐐"), L("h", "hat", "🎩"),
  L("i", "insect", "🐛"), L("j", "juice", "🧃"), L("k", "kite", "🪁", { alike: ["c"] }), L("l", "lion", "🦁"),
  L("m", "moon", "🌙"), L("n", "nose", "👃"), L("o", "octopus", "🐙"), L("p", "pig", "🐷"),
  L("q", "queen", "👸"), L("r", "rabbit", "🐰"), L("s", "sun", "☀️"), L("t", "tiger", "🐯"),
  L("u", "umbrella", "☂️"), L("v", "van", "🚐"), L("w", "web", "🕸️"),
  // لا توجد كلمة مناسبة للأطفال تبدأ بصوت x، فنعلّمه في آخر الكلمة
  L("x", "box", "📦", { say: "حرف X، نسمعه في آخر كلمة box... box" }),
  L("y", "yarn", "🧶"), L("z", "zebra", "🦓")
];

// حروف متشابهة في الشكل: الاتجاه هو الفرق (b d p q) أو خط صغير
export const SIMILAR_GROUPS = [
  ["b", "d", "p", "q"],
  ["m", "n", "h", "u"],
  ["i", "j", "l", "t"],
  ["v", "w", "y"],
  ["a", "c", "e", "o"]
];

const W = (list) => list.map(([w, emoji]) => ({ w, emoji }));
export const WORDS_SHORT = W([
  ["cat", "🐱"], ["dog", "🐶"], ["pig", "🐷"], ["hen", "🐔"], ["bus", "🚌"], ["sun", "☀️"], ["bed", "🛏️"],
  ["cup", "🥤"], ["hat", "🎩"], ["fox", "🦊"], ["box", "📦"], ["bat", "🦇"], ["bee", "🐝"], ["cow", "🐄"],
  ["egg", "🥚"], ["ant", "🐜"], ["map", "🗺️"], ["net", "🥅"], ["pen", "🖊️"], ["bag", "👜"], ["car", "🚗"],
  ["key", "🔑"], ["van", "🚐"], ["web", "🕸️"], ["ox", "🐂"], ["toy", "🧸"], ["leg", "🦵"], ["rat", "🐀"],
  ["mug", "☕"], ["tub", "🛁"], ["nut", "🥜"], ["jet", "🛩️"], ["six", "6️⃣"], ["ten", "🔟"], ["red", "🔴"]
]);
export const WORDS_LONG = W([
  ["ball", "⚽"], ["fish", "🐟"], ["frog", "🐸"], ["duck", "🦆"], ["milk", "🥛"], ["cake", "🎂"], ["kite", "🪁"],
  ["lion", "🦁"], ["moon", "🌙"], ["star", "⭐"], ["tree", "🌳"], ["ship", "🚢"], ["bird", "🐦"], ["bear", "🐻"],
  ["book", "📖"], ["door", "🚪"], ["hand", "✋"], ["nose", "👃"], ["apple", "🍎"], ["horse", "🐴"], ["mouse", "🐭"],
  ["house", "🏠"], ["train", "🚆"], ["snake", "🐍"], ["sheep", "🐑"], ["chair", "🪑"], ["clock", "🕰️"], ["bread", "🍞"],
  ["juice", "🧃"], ["tiger", "🐯"], ["zebra", "🦓"], ["rabbit", "🐰"], ["monkey", "🐵"], ["banana", "🍌"], ["pencil", "✏️"],
  ["rocket", "🚀"], ["robot", "🤖"], ["queen", "👸"], ["goat", "🐐"], ["sock", "🧦"], ["ring", "💍"], ["king", "🤴"],
  ["rain", "🌧️"], ["boat", "⛵"], ["shoe", "👟"], ["tooth", "🦷"], ["crab", "🦀"], ["drum", "🥁"], ["flag", "🚩"],
  ["plane", "✈️"], ["truck", "🚚"], ["grapes", "🍇"], ["lemon", "🍋"], ["gift", "🎁"], ["pizza", "🍕"], ["carrot", "🥕"],
  ["corn", "🌽"], ["octopus", "🐙"], ["insect", "🐛"], ["yarn", "🧶"], ["watch", "⌚"], ["elephant", "🐘"], ["vase", "🏺"],
  ["bike", "🚲"], ["bone", "🦴"], ["rose", "🌹"], ["cheese", "🧀"], ["whale", "🐳"], ["shell", "🐚"], ["spoon", "🥄"]
]);

export const ALL_WORDS = [...WORDS_SHORT, ...WORDS_LONG];

// الكلمات التي «يُسمع» حرفها الأول كما يُكتب: نستبعد ما يبدأ بصوتين مدموجين (sh, ch, th...)
const firstSound = (w) => (/^(ch|sh|th|wh|kn|wr|ph)/.test(w) ? null : w[0]);
export const LETTER_WORDS = Object.fromEntries(LETTERS.map((x) => {
  const list = x.l === "x" ? [] : [{ w: x.word, emoji: x.emoji }];
  if (x.l !== "x") for (const y of ALL_WORDS) if (firstSound(y.w) === x.l && !list.some((z) => z.w === y.w)) list.push(y);
  return [x.l, list];
}));
LETTER_WORDS.y.push({ w: "yo-yo", emoji: "🪀" });
LETTER_WORDS.u.push({ w: "up", emoji: "⬆️" });

export const HARAKAT = [];
export const CLOSED_SYLLABLES = [];
export const TANWEEN = [];
export const SHAMS_LETTERS = [];

const NUM_NAMES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
export const NUMBERS = NUM_NAMES.slice(1, 11).map((name, i) => ({ n: i + 1, d: String(i + 1), name, ...(i === 0 ? { zero: "zero" } : {}) }));
// الأعداد حتى عشرين (للكبار)
export const NUMBERS_20 = NUM_NAMES.slice(1).map((name, i) => ({ n: i + 1, d: String(i + 1), name }));

export const SHOP_ITEMS = [
  ["an apple", "🍎"], ["a banana", "🍌"], ["a ball", "⚽"], ["a teddy bear", "🧸"], ["a balloon", "🎈"], ["a cake", "🍰"],
  ["a juice", "🧃"], ["a pencil", "✏️"], ["a book", "📖"], ["an ice cream", "🍦"], ["a cookie", "🍪"], ["a toy car", "🚗"]
];
export const COUNT_EMOJIS = ["🍎", "⭐", "🐟", "🎈", "🌸", "🍓", "🐞", "⚽", "🍪", "🐥"];

// جمل بسيطة (بلا نقطة في آخرها حتى يعمل تمرين «أكمل الجملة»)
export const SENTENCES = [
  { s: "The cat is asleep", pic: "🐱💤", ar: "القطة نائمة" },
  { s: "The boy eats an apple", pic: "👦🍎", ar: "الولد يأكل تفاحة" },
  { s: "The girl reads a book", pic: "👧📖", ar: "البنت تقرأ كتاباً" },
  { s: "The duck swims in the water", pic: "🦆🌊", ar: "البطة تسبح في الماء" },
  { s: "The plane is in the sky", pic: "✈️☁️", ar: "الطائرة في السماء" },
  { s: "The dog plays with a ball", pic: "🐶⚽", ar: "الكلب يلعب بالكرة" },
  { s: "Dad drives the car", pic: "👨🚗", ar: "أبي يقود السيارة" },
  { s: "The bee is on the flower", pic: "🐝🌸", ar: "النحلة على الزهرة" },
  { s: "The moon is out at night", pic: "🌙🌃", ar: "القمر يظهر في الليل" },
  { s: "The baby is in bed", pic: "👶🛏️", ar: "الطفل في السرير" },
  { s: "The boy drinks milk", pic: "👦🥛", ar: "الولد يشرب الحليب" },
  { s: "It is raining", pic: "🌧️☔", ar: "إنها تمطر" },
  { s: "The lion is in the jungle", pic: "🦁🌳", ar: "الأسد في الغابة" },
  { s: "The girl has a balloon", pic: "👧🎈", ar: "مع البنت بالون" },
  { s: "The fish lives in the sea", pic: "🐟🌊", ar: "السمكة تعيش في البحر" },
  { s: "The frog can jump", pic: "🐸💧", ar: "الضفدع يستطيع القفز" },
  { s: "The bird is in the tree", pic: "🐦🌳", ar: "العصفور في الشجرة" },
  { s: "The monkey eats a banana", pic: "🐵🍌", ar: "القرد يأكل موزة" },
  { s: "The snow is cold", pic: "❄️⛄", ar: "الثلج بارد" },
  { s: "Mom is cooking", pic: "👩‍🍳🍲", ar: "أمي تطبخ" },
  { s: "The rocket goes to the moon", pic: "🚀🌙", ar: "الصاروخ يذهب إلى القمر" },
  { s: "The hen has an egg", pic: "🐔🥚", ar: "عند الدجاجة بيضة" },
  { s: "I wash my hands", pic: "🧼👐", ar: "أغسل يديّ" },
  { s: "The car is fast", pic: "🚗💨", ar: "السيارة سريعة" },
  { s: "The sun is hot", pic: "☀️🔥", ar: "الشمس حارّة" },
  { s: "I can ride a bike", pic: "🚲😃", ar: "أستطيع ركوب الدراجة" },
  { s: "The cow gives us milk", pic: "🐄🥛", ar: "البقرة تعطينا الحليب" },
  { s: "The baby is happy", pic: "👶😀", ar: "الطفل سعيد" },
  { s: "The cake is big", pic: "🎂🎉", ar: "الكعكة كبيرة" },
  { s: "The turtle is slow", pic: "🐢🐌", ar: "السلحفاة بطيئة" },
  { s: "The owl sleeps in the day", pic: "🦉☀️", ar: "البومة تنام في النهار" },
  { s: "I brush my teeth", pic: "🪥🦷", ar: "أنظّف أسناني" },
  { s: "The ship is on the sea", pic: "🚢🌊", ar: "السفينة في البحر" },
  { s: "Grandma tells a story", pic: "👵📖", ar: "جدتي تحكي قصة" }
];

// ============================================================
//  الأقسام: كل قسم ينمّي مهارة واحدة
//  age: all = من 3 سنوات، big = من 6 سنوات، older = من 9 سنوات
// ============================================================
export const SKILLS = [
  {
    id: "sounds", icon: "👂", name: "الأصوات", color: "#8e7dff",
    goal: "يسمع أصوات الكلمات الإنجليزية ويميّز أولها وآخرها والكلمات المتشابهة في نهايتها",
    certText: "لتميّزه في سماع أصوات الكلمات الإنجليزية وتمييزها",
    prefixes: ["snd:", "lis:", "same:", "end:", "rhy:"], target: 40,
    activities: [
      { id: "gBubbles", type: "arcade", game: true, mode: "bubbles", title: "فقاعات الأصوات", desc: "فقّع الصور التي تبدأ بالصوت", icon: "🎈", age: "all" },
      { id: "listen", type: "listen", title: "اسمع واختر", desc: "اسمع الكلمة واختر صورتها", icon: "🎧", age: "all" },
      { id: "sameSound", type: "sounds", title: "نفس الصوت", desc: "أي صورة تبدأ بنفس الصوت؟", icon: "🔔", age: "all" },
      { id: "first", type: "first", title: "أول صوت", desc: "بأي حرف تبدأ الكلمة؟", icon: "🖼️", age: "all" },
      { id: "rhyme", type: "spell", mode: "rhyme", title: "كلمات تتشابه", desc: "cat و hat: نفس النهاية", icon: "🎶", age: "all" },
      { id: "memory", type: "memory", mode: "pic", title: "ذاكرة الأصوات", desc: "طابق الحرف مع صورة تبدأ به", icon: "🃏", age: "all" },
      { id: "lastSound", type: "first", mode: "last", title: "آخر صوت", desc: "بأي حرف تنتهي الكلمة؟", icon: "🔚", age: "big" }
    ]
  },
  {
    id: "letters", icon: "🔤", name: "الحروف", color: "#fb8500",
    goal: "يتعرّف على الحروف الإنجليزية الكبيرة والصغيرة وأسمائها وترتيبها",
    certText: "لإتقانه الحروف الإنجليزية الكبيرة والصغيرة",
    prefixes: ["rec:", "case:", "abc:"], target: 52,
    activities: [
      { id: "board", type: "lesson", title: "لوحة الحروف", desc: "كل حرف: شكله وصوته وكلمة تبدأ به", icon: "📋", age: "all" },
      { id: "gMole", type: "arcade", game: true, mode: "mole", title: "اضرب الخُلد", desc: "اضرب الخُلد الذي يحمل الحرف", icon: "🔨", age: "all" },
      { id: "letters1", type: "letters", title: "A – I", desc: "من A إلى I", range: [0, 9], icon: "🌱", age: "all" },
      { id: "letters2", type: "letters", title: "J – R", desc: "من J إلى R", range: [9, 18], icon: "🌿", age: "all" },
      { id: "letters3", type: "letters", title: "S – Z", desc: "من S إلى Z", range: [18, 26], icon: "🌳", age: "all" },
      { id: "case", type: "spell", mode: "case", title: "الكبير والصغير", desc: "A مع a، و B مع b", icon: "🔠", age: "all" },
      { id: "similar", type: "similar", title: "حروف متشابهة", desc: "b و d و p و q", icon: "🔍", age: "all" },
      { id: "abc", type: "spell", mode: "abc", title: "ترتيب الحروف", desc: "ما الحرف الذي يأتي بعد؟", icon: "🔢", age: "big" },
      { id: "memoryCase", type: "memory", mode: "case", title: "ذاكرة الحروف", desc: "طابق الحرف الكبير مع الصغير", icon: "🃏", age: "big" }
    ]
  },
  {
    id: "phonics", icon: "🔡", name: "القراءة الصوتية", color: "#6a4c93",
    goal: "يتعلّم كيف تُقرأ الكلمات الإنجليزية خطوة بخطوة: حروف العلة القصيرة، ثم الحروف المدموجة، ثم الـ e السحرية وفرق الحروف",
    certText: "لإتقانه طريقة قراءة الكلمات الإنجليزية (Phonics)",
    prefixes: ["ph", "tj:", "dict:"], target: 60,
    activities: [
      { id: "spGuide", type: "spellGuide", title: "دليل القراءة", desc: "القواعد خطوة بخطوة مع أمثلة مسموعة", icon: "🧭", age: "all" },
      { id: "gTrain", type: "arcade", game: true, mode: "train", title: "قطار الكلمات", desc: "اربط العربات لتكوّن الكلمة", icon: "🚂", age: "all" },
      { id: "phShort", type: "spell", mode: "short", step: 1, title: "حروف العلة", desc: "a e i o u في وسط الكلمة", icon: "🎵", age: "all" },
      { id: "phCvc", type: "spell", mode: "cvc", step: 2, title: "كلمات من 3 حروف", desc: "c-a-t = cat", icon: "🧩", age: "all" },
      { id: "phSight", type: "spell", mode: "sight", step: 3, title: "كلمات نراها كثيراً", desc: "the, and, is, I", icon: "👀", age: "all" },
      { id: "phDigraph", type: "spell", mode: "digraph", step: 4, title: "حرفان بصوت واحد", desc: "sh, ch, th, ck", icon: "🤝", age: "big" },
      { id: "phBlend", type: "spell", mode: "blend", step: 5, title: "حروف متجاورة", desc: "fr, st, cl, tr", icon: "🔗", age: "big" },
      { id: "phMagic", type: "spell", mode: "magic", step: 6, title: "الـ e السحرية", desc: "kit ← kite", icon: "🪄", age: "big" },
      { id: "phTeam", type: "spell", mode: "team", step: 7, title: "فرق الحروف", desc: "ee, oa, ai, oo", icon: "👯", age: "big" },
      { id: "phBuild", type: "spell", mode: "build", step: 8, title: "ركّب الكلمة", desc: "اسمع وركّب الكلمة من أجزائها", icon: "🏆", age: "big" },
      { id: "phDict", type: "spell", mode: "dictation", step: 9, title: "الإملاء", desc: "اسمع الكلمة واكتبها", icon: "📝", age: "big" }
    ]
  },
  {
    id: "writing", icon: "✏️", name: "الكتابة", color: "#219ebc",
    goal: "يكتب الحروف الكبيرة والصغيرة والكلمات بيده، ثم يكتب الكلمات بلوحة الحروف",
    certText: "لتميّزه في كتابة الحروف والكلمات الإنجليزية",
    prefixes: ["trc:", "trcu:", "trcn:", "trm:", "trf:", "trw:", "trn:", "sp:", "miss:", "ana:", "kb:"], target: 70,
    activities: [
      { id: "gMaze", type: "arcade", game: true, mode: "maze", title: "طريق الحرف", desc: "قُد السيارة على طريق الحرف", icon: "🚗", age: "all" },
      { id: "trace", type: "trace", mode: "letters", title: "الحروف الصغيرة", desc: "تتبّع a b c فوق الخط", icon: "✍️", age: "all" },
      { id: "traceUpper", type: "trace", mode: "upper", title: "الحروف الكبيرة", desc: "تتبّع A B C فوق الخط", icon: "🅰️", age: "all" },
      { id: "traceNum", type: "trace", mode: "numbers", title: "الأرقام", desc: "تتبّع الرقم بإصبعك", icon: "🔢", age: "all" },
      { id: "traceWord", type: "trace", mode: "word", title: "اكتب الكلمة", desc: "اكتب كلمة كاملة فوق الخط", icon: "🖊️", age: "all" },
      { id: "traceName", type: "trace", mode: "name", title: "اكتب اسمك", desc: "اسمك بالإنجليزية", icon: "🪪", age: "all" },
      { id: "buildFirst", type: "buildFirst", title: "كلمتي الأولى", desc: "طابق الحروف وركّب الكلمة", icon: "🧸", age: "all" },
      { id: "traceMemory", type: "trace", mode: "memory", title: "من الذاكرة", desc: "انظر للحرف ثم اكتبه وهو مخفي", icon: "🧠", age: "big" },
      { id: "traceFree", type: "trace", mode: "free", title: "اسمع واكتب الحرف", desc: "اكتب الحرف بلا خط مساعد", icon: "👂", age: "big" },
      { id: "build", type: "build", title: "ركّب الكلمة", desc: "كلمات من 3 حروف", words: "short", icon: "🧩", age: "big" },
      { id: "build2", type: "build", title: "كلمات أطول", desc: "كلمات من 4–6 حروف", words: "long", icon: "🏗️", age: "big" },
      { id: "anagram", type: "anagram", title: "رتّب الحروف", desc: "حروف مبعثرة، ما الكلمة؟", icon: "🔀", age: "big" },
      { id: "keyboard", type: "keyboard", title: "لوحة الحروف", desc: "اكتب اسم الصورة حرفاً حرفاً", icon: "⌨️", age: "big" },
      { id: "keyboardDict", type: "keyboard", mode: "dict", title: "إملاء بلوحة الحروف", desc: "اسمع واكتب بلا صورة", icon: "📝", age: "older" }
    ]
  },
  {
    id: "reading", icon: "📖", name: "القراءة", color: "#2bb673",
    goal: "يقرأ الكلمات والجمل الإنجليزية القصيرة ويفهمها",
    certText: "لتميّزه في قراءة الكلمات والجمل الإنجليزية",
    prefixes: ["w:", "s:", "hunt:"], target: 50,
    activities: [
      { id: "gRace", type: "arcade", game: true, mode: "race", title: "سباق الكلمات", desc: "اضغط السيارة التي تحمل الكلمة", icon: "🏁", age: "big" },
      { id: "read", type: "read", title: "اقرأ واختر", desc: "اقرأ الكلمة واختر صورتها", icon: "📖", age: "big" },
      { id: "sentences", type: "sentences", title: "اقرأ الجملة", desc: "جمل قصيرة ومعناها", icon: "💬", age: "big" },
      { id: "hunt", type: "hunt", title: "صيد الحرف", desc: "اعثر على الكلمات التي فيها الحرف", icon: "🎯", age: "big" },
      { id: "memoryWords", type: "memory", mode: "word", title: "ذاكرة الكلمات", desc: "طابق الكلمة مع صورتها", icon: "🃏", age: "big" }
    ]
  },
  {
    id: "vocabulary", icon: "🧠", name: "المفردات والفهم", color: "#ef476f",
    goal: "يتعلّم كلمات إنجليزية جديدة ومعانيها، ويفهم القصص، ثم قواعد بسيطة",
    certText: "لتميّزه في مفردات اللغة الإنجليزية وفهمها",
    prefixes: ["voc:", "mean:", "opp:", "cat:", "rid:", "ord:", "story:", "gr:"], target: 60,
    activities: [
      { id: "gBaskets", type: "arcade", game: true, mode: "baskets", title: "سلال التصنيف", desc: "اسحب كل شيء إلى سلّته", icon: "🧺", age: "all" },
      { id: "vocab", type: "vocab", title: "مفرداتي", desc: "كلمات جديدة حسب المواضيع", icon: "🗂️", age: "all" },
      { id: "opposites", type: "opposites", title: "الأضداد", desc: "big و small، hot و cold", icon: "⚖️", age: "all" },
      { id: "categories", type: "categories", title: "صنّف الأشياء", desc: "animal أم fruit أم vehicle؟", icon: "🧺", age: "all" },
      { id: "meaning", type: "spell", mode: "meaning", title: "ما المعنى؟", desc: "الكلمة الإنجليزية ومعناها بالعربية", icon: "🌐", age: "big" },
      { id: "order", type: "order", title: "رتّب القصة", desc: "رتّب الجمل كما حدثت", icon: "🔢", age: "big" },
      { id: "stories", type: "stories", title: "قصص قصيرة", desc: "اقرأ قصة وأجب عن الأسئلة", icon: "📚", age: "big" },
      { id: "riddles", type: "riddles", title: "Who am I?", desc: "اقرأ الأحجية واعرف الجواب", icon: "🕵️", age: "older" },
      { id: "grammar", type: "spell", mode: "grammar", title: "قواعد بسيطة", desc: "a/an · is/are · this/these", icon: "📐", age: "older" }
    ]
  },
  {
    id: "numbers", icon: "🔢", name: "الأرقام", color: "#e0a100",
    goal: "يعدّ بالإنجليزية ويقرأ أسماء الأعداد ويقارن ويجمع ويطرح",
    certText: "لتميّزه في العدّ والأرقام بالإنجليزية",
    prefixes: ["n:", "nn:", "cmp:", "add:", "sub:", "shop:", "nw:"], target: 30,
    activities: [
      { id: "gShop", type: "arcade", game: true, mode: "shop", title: "الدكّان", desc: "اشترِ وادفع الثمن بالقطع النقدية", icon: "🏪", age: "all" },
      { id: "numbers", type: "numbers", mode: "count", title: "العدّ", desc: "one, two, three…", icon: "🍎", age: "all" },
      { id: "compare", type: "numbers", mode: "compare", title: "أكثر وأقل", desc: "أين المجموعة الأكبر؟", icon: "🐘", age: "all" },
      { id: "memoryNum", type: "memory", mode: "num", title: "ذاكرة الأرقام", desc: "طابق الرقم مع عدده", icon: "🃏", age: "all" },
      { id: "numWords", type: "spell", mode: "numWords", title: "أسماء الأعداد", desc: "من one إلى twenty", icon: "🔤", age: "big" },
      { id: "math", type: "numbers", mode: "math", title: "جمع وطرح", desc: "بالصور خطوة بخطوة", icon: "➕", age: "big" }
    ]
  }
];

export const ACTIVITIES = SKILLS.flatMap((sk) => sk.activities.map((a) => ({ ...a, skill: sk.id })));
export const LEVELS = ACTIVITIES;

export const AVATARS = ["🦁", "🐼", "🐰", "🦊", "🐯", "🐨", "🐸", "🦄", "🐧", "🐵", "🐱", "🐶"];

export const STICKERS = [
  { e: "🦋", n: "butterfly" }, { e: "🐳", n: "whale" }, { e: "🦖", n: "dinosaur" }, { e: "🚀", n: "rocket" },
  { e: "🌈", n: "rainbow" }, { e: "🍉", n: "watermelon" }, { e: "🎨", n: "paint" }, { e: "🐢", n: "turtle" },
  { e: "🦉", n: "owl" }, { e: "🌻", n: "sunflower" }, { e: "🚂", n: "train" }, { e: "🐙", n: "octopus" },
  { e: "🎠", n: "carousel" }, { e: "🦩", n: "flamingo" }, { e: "🍩", n: "donut" }, { e: "🪁", n: "kite" },
  { e: "🐬", n: "dolphin" }, { e: "🦜", n: "parrot" }, { e: "🌵", n: "cactus" }, { e: "🏰", n: "castle" },
  { e: "🐞", n: "ladybug" }, { e: "🦒", n: "giraffe" }, { e: "🍭", n: "lollipop" }, { e: "⛵", n: "boat" },
  { e: "🐘", n: "elephant" }, { e: "🎁", n: "gift" }, { e: "🦔", n: "hedgehog" }, { e: "🌋", n: "volcano" },
  { e: "🐝", n: "bee" }, { e: "🎡", n: "Ferris wheel" }, { e: "🦀", n: "crab" }, { e: "🏆", n: "trophy" }
];

// قصص قصيرة أصلية بالإنجليزية، مع معنى كل صفحة بالعربية (يظهر عند الطلب)
export const STORIES = [
  {
    id: "sam", title: "Sam and the Carrot", cover: "🐰",
    pages: [
      { pic: "🐰", text: "This is Sam. Sam is a little rabbit.", ar: "هذا سام. سام أرنب صغير." },
      { pic: "🐰🥕", text: "Sam likes carrots.", ar: "سام يحب الجزر." },
      { pic: "🌳🥕", text: "Sam finds a big carrot.", ar: "يجد سام جزرة كبيرة." },
      { pic: "🐿️", text: "His friend is hungry.", ar: "صديقه جائع." },
      { pic: "🥕🤝", text: "Sam shares the carrot.", ar: "يتقاسم سام الجزرة معه." },
      { pic: "😊😊", text: "They are happy.", ar: "هما سعيدان." }
    ],
    questions: [
      { q: "What is the rabbit's name?", o: ["Sam", "Tom", "Max"], a: 0 },
      { q: "What does Sam like?", o: ["carrots", "bananas", "fish"], a: 0 },
      { q: "What does Sam do with the carrot?", o: ["He shares it", "He throws it", "He hides it"], a: 0 }
    ]
  },
  {
    id: "drop", title: "The Little Raindrop", cover: "💧",
    pages: [
      { pic: "☁️", text: "There is a big cloud in the sky.", ar: "في السماء غيمة كبيرة." },
      { pic: "🌧️", text: "A little drop falls down.", ar: "تسقط قطرة صغيرة." },
      { pic: "🌱", text: "The drop falls on a seed.", ar: "تسقط القطرة على بذرة." },
      { pic: "🌿", text: "The seed drinks and grows.", ar: "تشرب البذرة وتكبر." },
      { pic: "🌻☀️", text: "Now it is a pretty flower.", ar: "الآن صارت زهرة جميلة." }
    ],
    questions: [
      { q: "Where is the cloud?", o: ["in the sky", "in the sea", "in the house"], a: 0 },
      { q: "What does the drop fall on?", o: ["a seed", "a cat", "a car"], a: 0 },
      { q: "What is the seed now?", o: ["a flower", "a stone", "a fish"], a: 0 }
    ]
  },
  {
    id: "beach", title: "A Day at the Beach", cover: "🏖️",
    pages: [
      { pic: "👨‍👩‍👧", text: "Lily goes to the beach with her family.", ar: "تذهب ليلي إلى الشاطئ مع عائلتها." },
      { pic: "🏰", text: "She makes a sand castle.", ar: "تبني قلعة من الرمل." },
      { pic: "🐚", text: "She finds a white shell.", ar: "تجد صدفة بيضاء." },
      { pic: "🐟🌊", text: "She sees a small fish in the water.", ar: "ترى سمكة صغيرة في الماء." },
      { pic: "🌅🏠", text: "At night they go home. Lily is happy.", ar: "في الليل يعودون إلى البيت. ليلي سعيدة." }
    ],
    questions: [
      { q: "Where does Lily go?", o: ["to the beach", "to school", "to the park"], a: 0 },
      { q: "What does she make?", o: ["a sand castle", "a cake", "a kite"], a: 0 },
      { q: "What does she find?", o: ["a shell", "a ball", "a hat"], a: 0 }
    ]
  },
  {
    id: "bee", title: "The Busy Bee", cover: "🐝",
    pages: [
      { pic: "🐝☀️", text: "In the morning the bee flies out.", ar: "في الصباح تطير النحلة." },
      { pic: "🌸🌼", text: "She visits the flowers.", ar: "تزور الأزهار." },
      { pic: "🍯", text: "She makes sweet honey.", ar: "تصنع عسلاً حلواً." },
      { pic: "🐝🏠", text: "She goes back to the hive.", ar: "تعود إلى الخلية." },
      { pic: "😴🌙", text: "At night she sleeps.", ar: "في الليل تنام." }
    ],
    questions: [
      { q: "When does the bee fly out?", o: ["in the morning", "at night", "never"], a: 0 },
      { q: "What does the bee make?", o: ["honey", "milk", "bread"], a: 0 },
      { q: "Where does the bee live?", o: ["in a hive", "in a nest", "in the sea"], a: 0 }
    ]
  },
  {
    id: "party", title: "Happy Birthday, Mia!", cover: "🎂",
    pages: [
      { pic: "🎂", text: "Today is Mia's birthday.", ar: "اليوم عيد ميلاد ميا." },
      { pic: "🎈🎈", text: "Mom puts up red balloons.", ar: "تعلّق أمها بالونات حمراء." },
      { pic: "👧👦", text: "Her friends come to the party.", ar: "يأتي أصدقاؤها إلى الحفلة." },
      { pic: "🎁", text: "Mia opens a gift. It is a doll.", ar: "تفتح ميا هدية. إنها دمية." },
      { pic: "🕯️🎉", text: "Mia blows out the candles.", ar: "تطفئ ميا الشموع." }
    ],
    questions: [
      { q: "Whose birthday is it?", o: ["Mia's", "Mom's", "Sam's"], a: 0 },
      { q: "What color are the balloons?", o: ["red", "blue", "green"], a: 0 },
      { q: "What is in the gift?", o: ["a doll", "a ball", "a book"], a: 0 }
    ]
  },
  {
    id: "race", title: "The Turtle and the Rabbit", cover: "🐢",
    pages: [
      { pic: "🐢🐇", text: "The rabbit says: I am fast!", ar: "يقول الأرنب: أنا سريع!" },
      { pic: "🏁🐇", text: "The race starts. The rabbit runs.", ar: "يبدأ السباق. يركض الأرنب." },
      { pic: "😴🌳", text: "The rabbit is tired. He sleeps.", ar: "الأرنب تعبان. ينام." },
      { pic: "🐢", text: "The turtle walks and walks.", ar: "تمشي السلحفاة وتمشي." },
      { pic: "🏆🐢", text: "The turtle wins the race!", ar: "تفوز السلحفاة بالسباق!" }
    ],
    questions: [
      { q: "Who says: I am fast?", o: ["the rabbit", "the turtle", "the bird"], a: 0 },
      { q: "What does the rabbit do?", o: ["He sleeps", "He swims", "He eats"], a: 0 },
      { q: "Who wins?", o: ["the turtle", "the rabbit", "nobody"], a: 0 }
    ]
  },
  {
    id: "school", title: "My First Day at School", cover: "🎒",
    pages: [
      { pic: "🎒", text: "Tom has a new bag.", ar: "عند توم حقيبة جديدة." },
      { pic: "👩‍🏫", text: "He says hello to his teacher.", ar: "يقول مرحباً لمعلّمته." },
      { pic: "✏️📒", text: "He writes A, B and C.", ar: "يكتب A و B و C." },
      { pic: "⚽", text: "He plays ball with his friends.", ar: "يلعب الكرة مع أصدقائه." },
      { pic: "🏠", text: "He goes home and tells Mom.", ar: "يعود إلى البيت ويخبر أمه." }
    ],
    questions: [
      { q: "What does Tom have?", o: ["a new bag", "a new dog", "a new car"], a: 0 },
      { q: "What does he write?", o: ["A, B and C", "1, 2 and 3", "his name"], a: 0 },
      { q: "What does he play?", o: ["ball", "chess", "piano"], a: 0 }
    ]
  },
  {
    id: "lulu", title: "The Hungry Cat", cover: "🐱",
    pages: [
      { pic: "🐱", text: "Lulu the cat is hungry.", ar: "القطة لولو جائعة." },
      { pic: "🔎", text: "She looks in the kitchen.", ar: "تبحث في المطبخ." },
      { pic: "🥛", text: "She finds some milk.", ar: "تجد بعض الحليب." },
      { pic: "😋", text: "She drinks it all.", ar: "تشربه كله." },
      { pic: "😴", text: "Then she sleeps by the window.", ar: "ثم تنام قرب النافذة." }
    ],
    questions: [
      { q: "What is the cat's name?", o: ["Lulu", "Mia", "Lily"], a: 0 },
      { q: "Where does she look?", o: ["in the kitchen", "in the garden", "in the car"], a: 0 },
      { q: "What does she find?", o: ["milk", "fish", "cake"], a: 0 }
    ]
  },
  {
    id: "owl", title: "The Kind Owl", cover: "🦉",
    pages: [
      { pic: "🦉🌙", text: "It is night. The owl is in the tree.", ar: "إنه الليل. البومة في الشجرة." },
      { pic: "🐰😢", text: "A little rabbit is lost. He is sad.", ar: "أرنب صغير ضائع. إنه حزين." },
      { pic: "🦉🐰", text: "The owl says: Don't be sad. I can help.", ar: "تقول البومة: لا تحزن. أستطيع المساعدة." },
      { pic: "🌟🌳", text: "The owl flies and the rabbit follows.", ar: "تطير البومة ويتبعها الأرنب." },
      { pic: "🐰😊", text: "The rabbit is home. Thank you, owl!", ar: "وصل الأرنب إلى بيته. شكراً أيتها البومة!" }
    ],
    questions: [
      { q: "Where is the owl?", o: ["in the tree", "in the sea", "in the house"], a: 0 },
      { q: "Why is the rabbit sad?", o: ["He is lost", "He is hungry", "He is cold"], a: 0 },
      { q: "Who helps the rabbit?", o: ["the owl", "the cat", "the fish"], a: 0 }
    ]
  },
  {
    id: "garden", title: "Grandpa's Garden", cover: "🌻",
    pages: [
      { pic: "👴🌳", text: "Grandpa has a big garden.", ar: "عند جدّي حديقة كبيرة." },
      { pic: "💧🌱", text: "We water the plants every day.", ar: "نسقي النباتات كل يوم." },
      { pic: "🍅🥕", text: "We grow tomatoes and carrots.", ar: "نزرع الطماطم والجزر." },
      { pic: "🐝🌸", text: "Bees visit the flowers.", ar: "يزور النحل الأزهار." },
      { pic: "🧺🍅", text: "In summer we pick red tomatoes.", ar: "في الصيف نقطف الطماطم الحمراء." }
    ],
    questions: [
      { q: "Who has a garden?", o: ["Grandpa", "Dad", "the teacher"], a: 0 },
      { q: "What do they grow?", o: ["tomatoes and carrots", "bananas", "apples"], a: 0 },
      { q: "Who visits the flowers?", o: ["bees", "cats", "fish"], a: 0 }
    ]
  }
];

// الأضداد
export const OPPOSITES = [
  [{ w: "big", e: "🐘" }, { w: "small", e: "🐭" }],
  [{ w: "hot", e: "🔥" }, { w: "cold", e: "❄️" }],
  [{ w: "day", e: "☀️" }, { w: "night", e: "🌙" }],
  [{ w: "happy", e: "😀" }, { w: "sad", e: "😢" }],
  [{ w: "asleep", e: "😴" }, { w: "awake", e: "😃" }],
  [{ w: "up", e: "⬆️" }, { w: "down", e: "⬇️" }],
  [{ w: "open", e: "🔓" }, { w: "closed", e: "🔒" }],
  [{ w: "fast", e: "🐇" }, { w: "slow", e: "🐢" }],
  [{ w: "heavy", e: "⚓" }, { w: "light", e: "🎈" }],
  [{ w: "tall", e: "🦒" }, { w: "short", e: "🐧" }],
  [{ w: "clean", e: "🧼" }, { w: "dirty", e: "💩" }],
  [{ w: "full", e: "🍔" }, { w: "empty", e: "🍽️" }],
  [{ w: "wet", e: "💦" }, { w: "dry", e: "🏜️" }],
  [{ w: "old", e: "👴" }, { w: "young", e: "👶" }]
];

export const CATEGORIES = [
  { id: "animal", name: "animals", icon: "🐾", items: ["🐱", "🐶", "🦁", "🐘", "🐰", "🐴", "🐑", "🐻", "🦒", "🐯", "🐵", "🐄", "🐔", "🦊"] },
  { id: "fruit", name: "fruit", icon: "🧺", items: ["🍎", "🍌", "🍇", "🍋", "🍉", "🍓", "🍒", "🍐", "🍊", "🥝", "🍑", "🍍"] },
  { id: "vehicle", name: "vehicles", icon: "🛣️", items: ["🚗", "✈️", "🚆", "🚲", "🚢", "🚌", "🚀", "🚑", "🚒", "🚜", "🛵"] },
  { id: "clothes", name: "clothes", icon: "👚", items: ["👕", "👟", "🧢", "👗", "🧦", "🧤", "🧣", "👖", "🥾"] }
];

// أحجيات Who am I? (للمتقدّمين)
export const RIDDLES = [
  { q: "I am big and gray. I have a long nose. Who am I?", e: "🐘" },
  { q: "I can fly. I have two wings. I sing in the tree. Who am I?", e: "🐦" },
  { q: "I am a long yellow fruit. Monkeys love me. What am I?", e: "🍌" },
  { q: "I am hot and yellow. I am in the sky in the day. What am I?", e: "☀️" },
  { q: "You see me in the sky at night. What am I?", e: "🌙" },
  { q: "I live in the water. I can swim. Who am I?", e: "🐟" },
  { q: "I make honey. I like flowers. Who am I?", e: "🐝" },
  { q: "I have a very long neck. Who am I?", e: "🦒" },
  { q: "I am the king of the jungle. Who am I?", e: "🦁" },
  { q: "I have many pages. You read me. What am I?", e: "📖" },
  { q: "I am white and cold. I fall in winter. What am I?", e: "❄️" },
  { q: "You write with me. What am I?", e: "✏️" },
  { q: "I have four wheels. I take you to school. What am I?", e: "🚗" },
  { q: "I carry my house on my back. I am very slow. Who am I?", e: "🐢" },
  { q: "I open the door. What am I?", e: "🔑" },
  { q: "I keep you dry in the rain. What am I?", e: "☂️" },
  { q: "I say meow. I like milk. Who am I?", e: "🐱" },
  { q: "I say moo. I give you milk. Who am I?", e: "🐄" }
];

// ============================================================
//  القراءة الصوتية (Phonics)
//  syl: أجزاء الكلمة كما تُقرأ (البداية + القافية، أو المقاطع في الكلمات الطويلة)
//  type: cvc · digraph · blend · magic · team · multi   · easy: تصلح للصغار
// ============================================================
const S = (type, list) => list.map(([w, syl, emoji]) => ({ w, syl: syl.split("-"), emoji, type, ...(type === "cvc" ? { easy: true } : {}) }));
export const SPELL_WORDS = [
  ...S("cvc", [
    ["cat", "c-at", "🐱"], ["hat", "h-at", "🎩"], ["bat", "b-at", "🦇"], ["rat", "r-at", "🐀"], ["map", "m-ap", "🗺️"],
    ["cap", "c-ap", "🧢"], ["pig", "p-ig", "🐷"], ["dog", "d-og", "🐶"], ["sun", "s-un", "☀️"], ["bus", "b-us", "🚌"],
    ["cup", "c-up", "🥤"], ["hen", "h-en", "🐔"], ["pen", "p-en", "🖊️"], ["ten", "t-en", "🔟"], ["net", "n-et", "🥅"],
    ["jet", "j-et", "🛩️"], ["bed", "b-ed", "🛏️"], ["red", "r-ed", "🔴"], ["fox", "f-ox", "🦊"], ["box", "b-ox", "📦"],
    ["six", "s-ix", "6️⃣"], ["mug", "m-ug", "☕"], ["bug", "b-ug", "🐞"], ["hug", "h-ug", "🤗"], ["nut", "n-ut", "🥜"],
    ["tub", "t-ub", "🛁"], ["van", "v-an", "🚐"], ["can", "c-an", "🥫"], ["pan", "p-an", "🍳"], ["leg", "l-eg", "🦵"]
  ]),
  ...S("digraph", [
    ["ship", "sh-ip", "🚢"], ["shop", "sh-op", "🏪"], ["shell", "sh-ell", "🐚"], ["fish", "f-ish", "🐟"], ["chick", "ch-ick", "🐤"],
    ["chess", "ch-ess", "♟️"], ["thumb", "th-umb", "👍"], ["bath", "b-ath", "🛀"], ["duck", "d-uck", "🦆"], ["sock", "s-ock", "🧦"]
  ]),
  ...S("blend", [
    ["frog", "fr-og", "🐸"], ["flag", "fl-ag", "🚩"], ["crab", "cr-ab", "🦀"], ["drum", "dr-um", "🥁"], ["stop", "st-op", "🛑"],
    ["swim", "sw-im", "🏊"], ["plug", "pl-ug", "🔌"], ["sled", "sl-ed", "🛷"], ["clap", "cl-ap", "👏"], ["truck", "tr-uck", "🚚"],
    ["tent", "t-ent", "⛺"], ["hand", "h-and", "✋"], ["milk", "m-ilk", "🥛"], ["gift", "g-ift", "🎁"]
  ]),
  ...S("magic", [
    ["cake", "c-ake", "🎂"], ["kite", "k-ite", "🪁"], ["bike", "b-ike", "🚲"], ["bone", "b-one", "🦴"], ["cube", "c-ube", "🧊"],
    ["rose", "r-ose", "🌹"], ["nose", "n-ose", "👃"], ["five", "f-ive", "5️⃣"], ["nine", "n-ine", "9️⃣"], ["game", "g-ame", "🎮"],
    ["plane", "pl-ane", "✈️"], ["whale", "wh-ale", "🐳"], ["snake", "sn-ake", "🐍"]
  ]),
  ...S("team", [
    ["rain", "r-ain", "🌧️"], ["snail", "sn-ail", "🐌"], ["train", "tr-ain", "🚆"], ["tree", "tr-ee", "🌳"], ["bee", "b-ee", "🐝"],
    ["sheep", "sh-eep", "🐑"], ["boat", "b-oat", "⛵"], ["goat", "g-oat", "🐐"], ["coat", "c-oat", "🧥"], ["moon", "m-oon", "🌙"],
    ["spoon", "sp-oon", "🥄"], ["book", "b-ook", "📖"], ["foot", "f-oot", "🦶"], ["leaf", "l-eaf", "🍃"], ["tea", "t-ea", "🍵"],
    ["soap", "s-oap", "🧼"], ["pie", "p-ie", "🥧"], ["star", "st-ar", "⭐"], ["car", "c-ar", "🚗"], ["corn", "c-orn", "🌽"]
  ]),
  ...S("multi", [
    ["rabbit", "rab-bit", "🐰"], ["pencil", "pen-cil", "✏️"], ["rocket", "rock-et", "🚀"], ["monkey", "mon-key", "🐵"],
    ["banana", "ba-na-na", "🍌"], ["tiger", "ti-ger", "🐯"], ["robot", "ro-bot", "🤖"], ["lemon", "lem-on", "🍋"],
    ["zebra", "ze-bra", "🦓"], ["carrot", "car-rot", "🥕"], ["basket", "bas-ket", "🧺"], ["dragon", "drag-on", "🐉"],
    ["pumpkin", "pump-kin", "🎃"], ["butterfly", "but-ter-fly", "🦋"], ["dinosaur", "di-no-saur", "🦕"], ["computer", "com-pu-ter", "💻"],
    ["octopus", "oc-to-pus", "🐙"], ["tomato", "to-ma-to", "🍅"], ["potato", "po-ta-to", "🥔"], ["kangaroo", "kan-ga-roo", "🦘"]
  ])
];

// كلمات نراها كثيراً (Sight words): نتعرّف عليها بالنظر لأنها لا تُقرأ دائماً حرفاً حرفاً
export const SIGHT_WORDS = [
  ["the", "الـ"], ["a", "(أداة نكرة)"], ["and", "و"], ["is", "يكون"], ["I", "أنا"], ["you", "أنت"], ["it", "هو (لغير العاقل)"],
  ["in", "في"], ["on", "على"], ["to", "إلى"], ["my", "لي"], ["we", "نحن"], ["he", "هو"], ["she", "هي"],
  ["can", "يستطيع"], ["see", "يرى"], ["look", "انظر"], ["go", "اذهب"], ["yes", "نعم"], ["no", "لا"],
  ["what", "ماذا"], ["this", "هذا"], ["here", "هنا"], ["like", "يحب"]
].map(([w, ar]) => ({ w, ar }));

// دليل القراءة الصوتية: خطوات الطريقة بالترتيب، كل خطوة مرتبطة بتمرينها
export const SPELL_LESSONS = [
  { icon: "🎵", title: "حروف العلة القصيرة", act: "phShort",
    rule: "في الإنجليزية خمسة حروف علة: a e i o u. في الكلمات القصيرة تُقرأ بصوت قصير، مثل الحركات في العربية: a في cat، و e في bed، و i في pig، و o في dog، و u في sun.",
    examples: ["cat", "bed", "pig", "dog", "sun"] },
  { icon: "🧩", title: "كلمات من ثلاثة حروف", act: "phCvc",
    rule: "نقرأ صوت كل حرف ثم ندمج الأصوات معاً: c ثم a ثم t، فتصبح cat. نبدأ بأول الكلمة ثم نضيف آخرها.",
    examples: ["cat", "hat", "map", "pen", "fox", "bus"] },
  { icon: "👀", title: "كلمات نراها كثيراً", act: "phSight",
    rule: "بعض الكلمات نراها في كل جملة تقريباً، مثل the و and و is. نحفظها بالنظر حتى نقرأ بسرعة.",
    examples: ["the", "and", "is", "I", "you", "can"] },
  { icon: "🤝", title: "حرفان بصوت واحد", act: "phDigraph",
    rule: "أحياناً يجتمع حرفان ليصنعا صوتاً واحداً جديداً: sh مثل «ش»، و ch مثل «تش»، و th مثل «ث» أو «ذ»، و ck مثل «ك».",
    examples: ["ship", "fish", "chick", "thumb", "duck"] },
  { icon: "🔗", title: "حروف متجاورة", act: "phBlend",
    rule: "حرفان ساكنان متجاوران نسمع صوت كل منهما بسرعة وراء الآخر: f و r في frog، و s و t في stop.",
    examples: ["frog", "flag", "crab", "stop", "swim"] },
  { icon: "🪄", title: "الـ e السحرية", act: "phMagic",
    rule: "إذا جاءت e في آخر الكلمة فهي لا تُنطق، لكنها تجعل حرف العلة قبلها يقول اسمه: kit تصبح kite، و cap تصبح cape.",
    examples: ["kit", "kite", "cap", "cape", "cake", "bike"] },
  { icon: "👯", title: "فرق الحروف", act: "phTeam",
    rule: "حرفا علة معاً يصنعان صوتاً طويلاً: ee في tree، و oa في boat، و ai في rain، و oo في moon.",
    examples: ["tree", "boat", "rain", "moon", "book"] },
  { icon: "🏆", title: "ركّب الكلمة", act: "phBuild",
    rule: "نسمع الكلمة، نقسّمها إلى أجزاء، نرتّب الأجزاء، ثم نقرأ الكلمة كاملة.",
    examples: ["rab", "bit", "rabbit", "pen", "cil", "pencil"] }
];

// ============================================================
//  المفردات حسب المواضيع، مع المعنى بالعربية
// ============================================================
const V = (id, name, icon, list) => ({ id, name, icon, words: list.map(([w, emoji, ar]) => ({ w, emoji, ar })) });
export const VOCAB = [
  V("animals", "Animals · الحيوانات", "🐾", [
    ["cat", "🐱", "قطة"], ["dog", "🐶", "كلب"], ["lion", "🦁", "أسد"], ["elephant", "🐘", "فيل"], ["monkey", "🐵", "قرد"],
    ["horse", "🐴", "حصان"], ["cow", "🐄", "بقرة"], ["sheep", "🐑", "خروف"], ["rabbit", "🐰", "أرنب"], ["fish", "🐟", "سمكة"],
    ["bird", "🐦", "عصفور"], ["duck", "🦆", "بطة"], ["frog", "🐸", "ضفدع"], ["bear", "🐻", "دب"], ["owl", "🦉", "بومة"],
    ["turtle", "🐢", "سلحفاة"], ["snake", "🐍", "أفعى"], ["penguin", "🐧", "بطريق"], ["camel", "🐫", "جمل"]]),
  V("food", "Food · الطعام", "🍎", [
    ["apple", "🍎", "تفاحة"], ["banana", "🍌", "موزة"], ["orange", "🍊", "برتقالة"], ["grapes", "🍇", "عنب"], ["strawberry", "🍓", "فراولة"],
    ["watermelon", "🍉", "بطيخ"], ["carrot", "🥕", "جزرة"], ["tomato", "🍅", "طماطم"], ["bread", "🍞", "خبز"], ["cheese", "🧀", "جبنة"],
    ["milk", "🥛", "حليب"], ["egg", "🥚", "بيضة"], ["rice", "🍚", "أرز"], ["water", "💧", "ماء"], ["cake", "🎂", "كعكة"], ["pizza", "🍕", "بيتزا"]]),
  V("home", "Home · البيت", "🏠", [
    ["house", "🏠", "بيت"], ["door", "🚪", "باب"], ["bed", "🛏️", "سرير"], ["chair", "🪑", "كرسي"], ["clock", "🕰️", "ساعة حائط"],
    ["spoon", "🥄", "ملعقة"], ["cup", "🥤", "كوب"], ["key", "🔑", "مفتاح"], ["phone", "📱", "هاتف"], ["TV", "📺", "تلفاز"],
    ["soap", "🧼", "صابون"], ["candle", "🕯️", "شمعة"]]),
  V("school", "School · المدرسة", "🎒", [
    ["school", "🏫", "مدرسة"], ["bag", "🎒", "حقيبة"], ["book", "📖", "كتاب"], ["pencil", "✏️", "قلم رصاص"], ["notebook", "📓", "دفتر"],
    ["scissors", "✂️", "مقص"], ["ruler", "📏", "مسطرة"], ["crayons", "🖍️", "ألوان"], ["computer", "💻", "حاسوب"], ["teacher", "👩‍🏫", "معلّمة"]]),
  V("body", "My body · جسمي", "🧍", [
    ["eye", "👁️", "عين"], ["ear", "👂", "أذن"], ["nose", "👃", "أنف"], ["mouth", "👄", "فم"], ["hand", "✋", "يد"],
    ["foot", "🦶", "قدم"], ["leg", "🦵", "رجل"], ["tooth", "🦷", "سن"], ["heart", "❤️", "قلب"], ["brain", "🧠", "دماغ"]]),
  V("family", "Family · العائلة", "👨‍👩‍👧", [
    ["dad", "👨", "أب"], ["mom", "👩", "أم"], ["baby", "👶", "طفل رضيع"], ["boy", "👦", "ولد"], ["girl", "👧", "بنت"],
    ["grandpa", "👴", "جد"], ["grandma", "👵", "جدة"], ["family", "👨‍👩‍👧", "عائلة"]]),
  V("clothes", "Clothes · الملابس", "👕", [
    ["shirt", "👕", "قميص"], ["dress", "👗", "فستان"], ["shoes", "👟", "حذاء"], ["socks", "🧦", "جوارب"], ["cap", "🧢", "قبعة"],
    ["coat", "🧥", "معطف"], ["gloves", "🧤", "قفازات"], ["scarf", "🧣", "وشاح"], ["jeans", "👖", "بنطال"], ["glasses", "👓", "نظارة"]]),
  V("nature", "Nature & weather · الطبيعة والطقس", "🌳", [
    ["sun", "☀️", "شمس"], ["moon", "🌙", "قمر"], ["star", "⭐", "نجمة"], ["cloud", "☁️", "غيمة"], ["rain", "🌧️", "مطر"],
    ["snow", "❄️", "ثلج"], ["tree", "🌳", "شجرة"], ["flower", "🌸", "زهرة"], ["sea", "🌊", "بحر"], ["mountain", "⛰️", "جبل"],
    ["rainbow", "🌈", "قوس قزح"], ["wind", "💨", "ريح"]]),
  V("transport", "Transport · المواصلات", "🚗", [
    ["car", "🚗", "سيارة"], ["bus", "🚌", "حافلة"], ["train", "🚆", "قطار"], ["plane", "✈️", "طائرة"], ["ship", "🚢", "سفينة"],
    ["bike", "🚲", "دراجة"], ["truck", "🚚", "شاحنة"], ["boat", "⛵", "قارب"], ["helicopter", "🚁", "مروحية"], ["rocket", "🚀", "صاروخ"]]),
  V("colors", "Colors · الألوان", "🎨", [
    ["red", "🔴", "أحمر"], ["green", "🟢", "أخضر"], ["blue", "🔵", "أزرق"], ["yellow", "🟡", "أصفر"], ["orange", "🟠", "برتقالي"],
    ["purple", "🟣", "بنفسجي"], ["black", "⚫", "أسود"], ["white", "⚪", "أبيض"], ["brown", "🟤", "بني"]]),
  V("feelings", "Feelings · المشاعر", "😀", [
    ["happy", "😀", "سعيد"], ["sad", "😢", "حزين"], ["angry", "😠", "غاضب"], ["scared", "😨", "خائف"], ["tired", "😴", "تعبان"],
    ["surprised", "😲", "متفاجئ"], ["sick", "🤒", "مريض"], ["silly", "🤪", "مضحك"]]),
  V("actions", "Actions · الأفعال", "🏃", [
    ["run", "🏃", "يركض"], ["swim", "🏊", "يسبح"], ["eat", "🍽️", "يأكل"], ["drink", "🥤", "يشرب"], ["sleep", "🛌", "ينام"],
    ["read", "📖", "يقرأ"], ["write", "✍️", "يكتب"], ["sing", "🎤", "يغنّي"], ["dance", "💃", "يرقص"], ["play", "⚽", "يلعب"],
    ["jump", "🦘", "يقفز"], ["cook", "🍳", "يطبخ"]])
];

// كلمات المفردات المفردة تُضاف إلى بنك الكلمات (بدون تكرار كلمة أو صورة)
{
  const seenW = new Set(ALL_WORDS.map((x) => x.w));
  const seenE = new Set(ALL_WORDS.map((x) => x.emoji));
  for (const t of VOCAB) for (const x of t.words) {
    if (seenW.has(x.w) || seenE.has(x.emoji) || /[\sA-Z]/.test(x.w)) continue;
    seenW.add(x.w); seenE.add(x.emoji);
    const item = { w: x.w, emoji: x.emoji };
    (x.w.length <= 3 ? WORDS_SHORT : WORDS_LONG).push(item);
    ALL_WORDS.push(item);
    const f = firstSound(x.w);
    if (f && LETTER_WORDS[f] && f !== "x" && !/^[aeiou]/.test(x.w)) LETTER_WORDS[f].push(item);
  }
}

// معاني كل الكلمات بالعربية (لتمرين «ما المعنى؟»)
export const MEANINGS = (() => {
  const out = [];
  const seen = new Set();
  for (const t of VOCAB) for (const x of t.words) {
    if (seen.has(x.w)) continue;
    seen.add(x.w);
    out.push({ w: x.w, emoji: x.emoji, ar: x.ar });
  }
  return out;
})();
