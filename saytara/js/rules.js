// ============================================================
//  قواعد سيطرة: الجيشان، الوحدات، المباني، الأسلحة، صلاحيات الجنرال
//  (أسماء ومحتوى أصلي بالكامل)
// ============================================================

export const FACTIONS = {
  shield: {
    name: "الدرع", emblem: "🛡️", motto: "دروع ثقيلة ونيران كثيفة",
    about: "جيش نظامي: دبابات قوية، مدفعية بعيدة المدى، مروحيات هجومية، ومبانٍ متينة. أبطأ لكنه يصمد.",
    power: 12, buildCost: 1, buildSpeed: 1, hpMul: 1.25
  },
  falcon: {
    name: "الصقر", emblem: "🦅", motto: "سرعة وطيران وضربات خاطفة",
    about: "جيش خفيف: مركبات سريعة، راجمات صواريخ، مسيّرات وطائرات. مبانيه أرخص وأسرع بناءً لكنها أضعف.",
    power: 10, buildCost: 0.9, buildSpeed: 1.15, hpMul: 0.85
  }
};

// مضاعف الضرر: [السلاح][درع الهدف]
export const WEAPON = {
  bullet: { inf: 1, light: 0.55, heavy: 0.18, air: 0.6, building: 0.2 },
  rocket: { inf: 0.35, light: 1.2, heavy: 1.4, air: 1.1, building: 0.9 },
  shell: { inf: 0.7, light: 1.2, heavy: 1, air: 0, building: 1 },
  arty: { inf: 1.1, light: 1.2, heavy: 1.1, air: 0, building: 1.4 },
  flak: { inf: 0.45, light: 0.25, heavy: 0.08, air: 1.9, building: 0 },
  missile: { inf: 0.6, light: 1.2, heavy: 1.15, air: 0.35, building: 1.1 }
};

// الوحدات. from: المبنى الذي ينتجها · req: مبنى إضافي مطلوب
// role: builder (يبني) · truck (ينقل المؤن) · وغيرها مقاتلة
const U = (o) => ({ armor: "inf", air: false, range: 0, dmg: 0, rof: 1, vision: 150, radius: 9, capture: false, ...o });
export const UNITS = {
  // ---------- الدرع ----------
  s_dozer: U({ f: "shield", role: "builder", name: "جرّافة", icon: "🚜", from: "hq", cost: 400, build: 8, hp: 550, armor: "light", speed: 34, radius: 14, sprite: "dozer" }),
  s_truck: U({ f: "shield", role: "truck", name: "شاحنة إمداد", icon: "🚚", from: "supply", cost: 500, build: 8, hp: 550, armor: "light", speed: 40, radius: 14, sprite: "truck" }),
  s_rifle: U({ f: "shield", name: "جندي", icon: "🪖", from: "barracks", cost: 200, build: 4, hp: 120, weapon: "bullet", dmg: 12, rof: 0.7, range: 95, speed: 30, capture: true, hitsAir: true, sprite: "squad",
    about: "رخيص، يحتلّ المصافي والأبراج، جيد ضد المشاة" }),
  s_rocket: U({ f: "shield", name: "صاروخي", icon: "🎯", from: "barracks", cost: 280, build: 5, hp: 110, weapon: "rocket", dmg: 32, rof: 2, range: 135, speed: 28, capture: true, hitsAir: true, sprite: "rocketeer",
    about: "يدمّر المدرّعات والمروحيات" }),
  s_tank: U({ f: "shield", name: "دبابة ثقيلة", icon: "🛡️", from: "factory", cost: 800, build: 10, hp: 850, armor: "heavy", weapon: "shell", dmg: 58, rof: 1.7, range: 135, speed: 40, radius: 17, sprite: "tank",
    about: "عمود الجيش: قوية ضد المركبات والمباني" }),
  s_arty: U({ f: "shield", name: "مدفعية", icon: "💥", from: "factory", cost: 1000, build: 12, hp: 320, armor: "light", weapon: "arty", dmg: 95, rof: 4.5, range: 390, minRange: 100, splash: 50, shells: 1, speed: 26, radius: 15, sprite: "arty",
    about: "تقصف من بعيد جداً، تحتاج من يكشف لها الهدف" }),
  s_aa: U({ f: "shield", name: "مدفع جوي", icon: "🎇", from: "factory", cost: 700, build: 8, hp: 420, armor: "light", weapon: "flak", dmg: 22, rof: 0.5, range: 210, speed: 42, radius: 15, hitsAir: true, sprite: "aa",
    about: "يُسقط الطائرات والمسيّرات" }),
  s_heli: U({ f: "shield", name: "مروحية هجومية", icon: "🚁", from: "airfield", cost: 1300, build: 14, hp: 480, armor: "air", air: true, weapon: "missile", dmg: 42, rof: 1.5, range: 150, speed: 72, vision: 220, radius: 16, sprite: "heli",
    about: "تطير فوق المدينة وتصطاد الدبابات" }),
  s_fortress: U({ f: "shield", name: "دبابة الحصن", icon: "🏰", from: "factory", req: "tech", cost: 2200, build: 18, hp: 2200, armor: "heavy", weapon: "shell", dmg: 115, rof: 2.2, range: 165, speed: 30, radius: 22, sprite: "fortress",
    about: "دبابة عملاقة نخبوية (تحتاج مركز الأبحاث)" }),
  // ---------- الصقر ----------
  f_dozer: U({ f: "falcon", role: "builder", name: "شاحنة بناء", icon: "🏗️", from: "hq", cost: 350, build: 6, hp: 420, armor: "light", speed: 42, radius: 13, sprite: "dozer" }),
  f_truck: U({ f: "falcon", role: "truck", name: "شاحنة إمداد", icon: "🚚", from: "supply", cost: 450, build: 6, hp: 450, armor: "light", speed: 48, radius: 13, sprite: "truck" }),
  f_rifle: U({ f: "falcon", name: "مقاتل", icon: "🪖", from: "barracks", cost: 170, build: 3, hp: 100, weapon: "bullet", dmg: 9, rof: 0.6, range: 90, speed: 36, capture: true, hitsAir: true, sprite: "squad",
    about: "رخيص وسريع، يحتلّ المصافي والأبراج" }),
  f_rocket: U({ f: "falcon", name: "رامي صواريخ", icon: "🎯", from: "barracks", cost: 260, build: 4, hp: 90, weapon: "rocket", dmg: 28, rof: 1.8, range: 130, speed: 34, capture: true, hitsAir: true, sprite: "rocketeer",
    about: "ضد المدرّعات والطائرات" }),
  f_raider: U({ f: "falcon", name: "عربة رشاش", icon: "🛻", from: "factory", cost: 550, build: 6, hp: 360, armor: "light", weapon: "bullet", dmg: 15, rof: 0.3, range: 115, speed: 72, radius: 14, hitsAir: true, sprite: "raider",
    about: "سريعة جداً، تحصد المشاة وتطارد الشاحنات" }),
  f_tank: U({ f: "falcon", name: "دبابة خفيفة", icon: "🛡️", from: "factory", cost: 650, build: 8, hp: 520, armor: "heavy", weapon: "shell", dmg: 42, rof: 1.5, range: 125, speed: 56, radius: 15, sprite: "ltank",
    about: "أسرع وأرخص من الدبابة الثقيلة" }),
  f_mlrs: U({ f: "falcon", name: "راجمة صواريخ", icon: "🚀", from: "factory", cost: 900, build: 10, hp: 280, armor: "light", weapon: "arty", dmg: 34, rof: 5, range: 350, minRange: 90, splash: 45, shells: 3, speed: 36, radius: 15, sprite: "mlrs",
    about: "رشقات صواريخ على مساحة واسعة" }),
  f_drone: U({ f: "falcon", name: "مسيّرة هجومية", icon: "🛸", from: "airfield", cost: 600, build: 7, hp: 170, armor: "air", air: true, weapon: "missile", dmg: 26, rof: 1.2, range: 125, speed: 92, vision: 300, radius: 11, sprite: "drone",
    about: "رخيصة وسريعة وترى بعيداً" }),
  f_jet: U({ f: "falcon", name: "طائرة هجومية", icon: "✈️", from: "airfield", req: "tech", cost: 1800, build: 14, hp: 650, armor: "air", air: true, weapon: "missile", dmg: 85, rof: 2.4, range: 175, speed: 115, vision: 240, radius: 18, sprite: "jet",
    about: "طائرة نخبوية مدمّرة (تحتاج مركز الأبحاث)" })
};
export const unitsOf = (faction) => Object.keys(UNITS).filter((k) => UNITS[k].f === faction);
export const builderOf = (faction) => (faction === "shield" ? "s_dozer" : "f_dozer");
export const truckOf = (faction) => (faction === "shield" ? "s_truck" : "f_truck");

// المباني. size: lot (أرض كبيرة) أو pad (زاوية صغيرة للدفاعات)
export const BUILDINGS = {
  hq: { name: "مركز القيادة", icon: "🏛️", cost: 0, build: 0, hp: 4000, power: 5, size: "lot", produces: true },
  power: { name: "محطة طاقة", icon: "⚡", cost: 600, build: 10, hp: 1000, power: "faction", size: "lot", about: "تزوّد قاعدتك بالطاقة. بلا طاقة كافية يبطؤ الإنتاج وتتعطّل الدفاعات" },
  supply: { name: "مركز الإمداد", icon: "📦", cost: 1000, build: 12, hp: 1500, power: -1, size: "lot", produces: true, about: "تفرغ فيه الشاحنات المؤن. ابنه قرب مستودع، ويأتي معه شاحنة مجانية" },
  barracks: { name: "ثكنة", icon: "🏠", cost: 600, build: 10, hp: 1200, power: -1, size: "lot", produces: true, about: "تدرّب المشاة" },
  factory: { name: "مصنع المركبات", icon: "🏭", cost: 1600, build: 16, hp: 2000, power: -2, size: "lot", req: "supply", produces: true, about: "ينتج الدبابات والمدفعية والمركبات" },
  airfield: { name: "مطار", icon: "🛫", cost: 1600, build: 16, hp: 1600, power: -2, size: "lot", req: "factory", produces: true, about: "ينتج الطائرات" },
  tech: { name: "مركز الأبحاث", icon: "🔬", cost: 2500, build: 20, hp: 2000, power: -3, size: "lot", req: "factory", about: "يفتح الوحدات النخبوية والسلاح الاستراتيجي" },
  super: { name: "السلاح الاستراتيجي", icon: "☢️", cost: 5000, build: 30, hp: 2600, power: -5, size: "lot", req: "tech", about: "ضربة مدمّرة على أي مكان كل 4 دقائق" },
  turret: { name: "برج مدفع", icon: "🗼", cost: 800, build: 8, hp: 1000, power: -1, size: "pad", weapon: "shell", dmg: 42, rof: 1.5, range: 210, about: "دفاع ثابت ضد القوات الأرضية" },
  aadef: { name: "دفاع جوي", icon: "📡", cost: 700, build: 8, hp: 800, power: -1, size: "pad", weapon: "flak", dmg: 26, rof: 0.6, range: 270, hitsAir: true, airOnly: true, about: "يُسقط الطائرات قرب قاعدتك" }
};
export const BUILD_ORDER = ["power", "supply", "barracks", "factory", "airfield", "turret", "aadef", "tech", "super"];
export const buildingName = (type, faction) => (type === "airfield" && faction === "falcon" ? "منصة المسيّرات" : type === "super" ? (faction === "shield" ? "الصاروخ الاستراتيجي" : "سرب الصواريخ") : BUILDINGS[type].name);

// صلاحيات الجنرال: تُفتح بنقاط الرتبة، ولكل منها وقت انتظار
export const POWERS = {
  airstrike: { name: "غارة جوية", icon: "✈️", rank: 1, cd: 150, radius: 100, dmg: 320, about: "طائرات تقصف منطقة صغيرة بقوة" },
  paradrop: { name: "إنزال مظلي", icon: "🪂", rank: 1, cd: 180, count: 6, about: "ستة جنود يهبطون حيث تريد" },
  reveal: { name: "طائرة استطلاع", icon: "🔭", rank: 1, cd: 90, radius: 380, time: 25, about: "تكشف منطقة واسعة لمدة قصيرة" },
  cash: { name: "إمداد طارئ", icon: "💰", rank: 2, cd: 240, amount: 1500, about: "1500 من المؤن فوراً" },
  barrage: { name: "قصف مدفعي", icon: "💣", rank: 3, cd: 220, radius: 150, shells: 16, dmg: 120, about: "وابل قذائف على منطقة واسعة" }
};
export const SUPER = { charge: 240, radius: 170, dmg: 2600 };
export const RANKS = [0, 600, 1800, 4000, 8000]; // الخبرة اللازمة للرتب 1–5
export const RANK_NAMES = ["ملازم", "نقيب", "رائد", "عقيد", "لواء"];

export const TEAM = ["#2f7cf6", "#e5484d"];
export const TEAM_DARK = ["#1b4fa6", "#9e2a2e"];
export const NEUTRAL_COLOR = "#9aa3ad";
export const START_MONEY = 2500;
export const TRUCK_LOAD = 300;   // ما تحمله الشاحنة في الرحلة
export const DEPOT_AMOUNT = 15000;
export const LOAD_TIME = 2.5;     // ثوانٍ للتحميل
export const MAX_UNITS = 45;
