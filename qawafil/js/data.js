// ============================================================
//  قوافل: محتوى اللعبة (المدن، البضائع، الطرق، أحداث العالم)
//  لتعديل التوازن أو إضافة مدينة أو بضاعة: عدّل هذا الملف فقط
// ============================================================

// base: السعر الأساسي بالدينار للوحدة الواحدة (كل جمل يحمل 10 وحدات)
export const GOODS = [
  { id: "dates", name: "تمر", e: "🌴", base: 10 },
  { id: "cloth", name: "قماش", e: "🧵", base: 22 },
  { id: "coffee", name: "بنّ", e: "☕", base: 30 },
  { id: "glass", name: "زجاج", e: "🏺", base: 36 },
  { id: "spice", name: "توابل", e: "🌶️", base: 42 },
  { id: "incense", name: "بخور", e: "🪔", base: 55 },
  { id: "silk", name: "حرير", e: "🧣", base: 85 },
  { id: "pearl", name: "لؤلؤ", e: "🦪", base: 130 }
];

// make: ما تنتجه المدينة (رخيص فيها) · want: ما تطلبه (غالٍ فيها)
// x,y: موقعها على الخريطة (مأخوذ من خطوط الطول والعرض الحقيقية)
// water: سعر وحدة الماء والزاد · camel: سعر الجمل
export const CITIES = [
  { id: "aleppo", name: "حلب", x: 263, y: 58, make: ["glass", "cloth"], want: ["spice", "coffee", "dates"], water: 2, camel: 65,
    about: "ملتقى طرق الشام والعراق، أسواقها المسقوفة مليئة بالقماش والزجاج" },
  { id: "damascus", name: "دمشق", x: 235, y: 138, make: ["cloth", "glass"], want: ["pearl", "incense", "coffee"], water: 2, camel: 65,
    about: "مدينة الدمشقي والزجاج المنفوخ، ومنها ينطلق ركب الحج" },
  { id: "jerusalem", name: "القدس", x: 196, y: 193, make: ["glass"], want: ["incense", "silk", "dates"], water: 2, camel: 70,
    about: "يقصدها الزوار من كل مكان، فيُطلب فيها البخور والحرير" },
  { id: "cairo", name: "القاهرة", x: 66, y: 250, make: ["cloth"], want: ["spice", "silk", "pearl", "coffee"], water: 2, camel: 70,
    about: "أكبر أسواق الشرق، تدفع ثمناً عالياً للتوابل والحرير" },
  { id: "baghdad", name: "بغداد", x: 497, y: 145, make: ["silk"], want: ["pearl", "glass", "incense", "dates"], water: 2, camel: 60,
    about: "دار السلام، يصلها حرير فارس والصين" },
  { id: "basra", name: "البصرة", x: 606, y: 231, make: ["dates", "spice"], want: ["cloth", "glass"], water: 2, camel: 55,
    about: "ميناء السفن القادمة من الهند، وبساتين النخيل بلا نهاية" },
  { id: "hajar", name: "هَجَر", x: 665, y: 388, make: ["pearl", "dates"], want: ["cloth", "silk", "coffee"], water: 3, camel: 50,
    about: "واحة النخيل على ساحل الخليج، وفيها غوّاصو اللؤلؤ" },
  { id: "medina", name: "المدينة", x: 342, y: 415, make: ["dates"], want: ["cloth", "glass", "spice"], water: 3, camel: 50,
    about: "مدينة التمر الطيب، ومحطة القوافل بين الشام ومكة" },
  { id: "mecca", name: "مكة", x: 348, y: 511, make: [], want: ["incense", "silk", "cloth", "glass"], water: 3, camel: 55,
    about: "يجتمع فيها الحجاج والتجار من كل البلاد، فكل شيء يُباع فيها" },
  { id: "sanaa", name: "صنعاء", x: 490, y: 695, make: ["coffee", "incense"], want: ["glass", "cloth", "silk"], water: 2, camel: 60,
    about: "بلاد البنّ واللبان في جبال اليمن" },
  { id: "muscat", name: "مسقط", x: 940, y: 445, make: ["spice", "incense", "pearl"], want: ["glass", "cloth", "coffee"], water: 2, camel: 55,
    about: "ميناء عُمان، تصله التوابل من الهند واللبان من ظفار" }
];

// الطرق: [مدينة، مدينة، الأيام، خطر قطّاع الطرق يومياً، جفاف (يضاعف استهلاك الماء)]
export const ROUTES = [
  ["aleppo", "damascus", 5, 0.02, 1],
  ["aleppo", "baghdad", 12, 0.04, 1.3],
  ["damascus", "jerusalem", 4, 0.02, 1],
  ["damascus", "baghdad", 12, 0.06, 2],
  ["jerusalem", "cairo", 8, 0.03, 1.4],
  ["jerusalem", "medina", 16, 0.05, 1.6],
  ["damascus", "medina", 17, 0.04, 1.5],
  ["medina", "mecca", 5, 0.03, 1.2],
  ["mecca", "sanaa", 16, 0.05, 1.4],
  ["baghdad", "basra", 6, 0.03, 1],
  ["basra", "hajar", 9, 0.04, 1.3],
  ["hajar", "medina", 15, 0.06, 2],
  ["hajar", "muscat", 13, 0.05, 1.6],
  ["sanaa", "muscat", 20, 0.07, 1.8],
  ["baghdad", "mecca", 22, 0.05, 1.8]
].map(([a, b, days, danger, dry]) => ({ a, b, days, danger: danger * 0.4, dry }));

// أحداث العالم: تغيّر الأسعار أو الخطر لمدة محدودة، ويسمع بها التاجر في كل مكان
export const WORLD_EVENTS = [
  { id: "hajj", text: "اقترب موسم الحج: البخور والقماش مطلوبان بشدة في مكة والمدينة", cities: ["mecca", "medina"], goods: ["incense", "cloth"], mult: 1.6, days: 20 },
  { id: "ships", text: "وصلت سفن الهند إلى البصرة: التوابل والحرير رخيصة هناك", cities: ["basra"], goods: ["spice", "silk"], mult: 0.6, days: 15 },
  { id: "drought", text: "قحط في الشام: التمر غالٍ جداً في دمشق وحلب", cities: ["damascus", "aleppo"], goods: ["dates"], mult: 2.2, days: 20 },
  { id: "wedding", text: "عرس أمير في القاهرة: الحرير واللؤلؤ يُطلبان بأي ثمن", cities: ["cairo"], goods: ["silk", "pearl"], mult: 1.7, days: 16 },
  { id: "coffeehouses", text: "انتشرت المقاهي في بغداد: البنّ مطلوب جداً هناك", cities: ["baghdad"], goods: ["coffee"], mult: 1.9, days: 25 },
  { id: "diving", text: "موسم الغوص في هجر: اللؤلؤ وفير ورخيص", cities: ["hajar"], goods: ["pearl"], mult: 0.65, days: 15 },
  { id: "glassfire", text: "حريق في سوق الزجاجين بدمشق: الزجاج نادر وغالٍ هناك", cities: ["damascus"], goods: ["glass"], mult: 1.7, days: 15 },
  { id: "harvest", text: "محصول بنّ وفير في اليمن: البنّ رخيص في صنعاء", cities: ["sanaa"], goods: ["coffee"], mult: 0.6, days: 20 },
  { id: "pilgrims", text: "زوّار كثيرون في القدس: الطلب على البخور والتمر ارتفع", cities: ["jerusalem"], goods: ["incense", "dates"], mult: 1.6, days: 18 },
  { id: "silkglut", text: "قوافل حرير كثيرة وصلت حلب: الحرير أرخص من المعتاد هناك", cities: ["aleppo"], goods: ["silk"], mult: 0.7, days: 15 },
  { id: "muscatdemand", text: "أسطول عُمان يتجهّز للإبحار: مسقط تشتري القماش والتمر بسعر عالٍ", cities: ["muscat"], goods: ["cloth", "dates"], mult: 1.7, days: 18 },
  { id: "raids1", text: "كثر قطّاع الطرق على طريق دمشق – بغداد", route: ["damascus", "baghdad"], danger: 3, days: 20 },
  { id: "raids2", text: "غارات على طريق صنعاء – مسقط", route: ["sanaa", "muscat"], danger: 2.5, days: 20 },
  { id: "raids3", text: "طريق هجر – المدينة غير آمن هذه الأيام", route: ["hajar", "medina"], danger: 2.5, days: 18 },
  { id: "peace", text: "قافلة حراسة السلطان تجوب طريق الحج: طريق دمشق – المدينة آمن تماماً", route: ["damascus", "medina"], danger: 0.2, days: 20 }
];

// ألقاب التاجر حسب ثروته في نهاية الموسم
export const TITLES = [
  [0, "بائع متجوّل", "🎒"],
  [1000, "تاجر صغير", "🧺"],
  [3000, "تاجر معروف", "🏪"],
  [7000, "تاجر كبير", "💰"],
  [15000, "شيخ التجّار", "👑"],
  [30000, "ملك القوافل", "🐪"]
];

export const START = { city: "damascus", money: 400, camels: 2, guards: 0, supplies: 20 };
