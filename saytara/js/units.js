// ============================================================
//  الوحدات: كل نوع له نقاط قوة ونقاط ضعف (المدرّعة تسحق المشاة، والمدفعية تدمّر المدرّعات
//  من بعيد، والمسيّرة تصطاد المدفعية، والمشاة يُسقطون المسيّرات ويحتلّون المواقع)
// ============================================================
export const UNITS = {
  infantry: {
    name: "مشاة", icon: "🪖", cost: 60, build: 3.5, hp: 100, dmg: 10, range: 75, rof: 0.8, speed: 30, vision: 150,
    armor: "inf", air: false, hitsAir: true, capture: true, radius: 9,
    about: "رخيصة، وهي الوحيدة التي تحتلّ المواقع، وتُسقط المسيّرات"
  },
  tank: {
    name: "مدرّعة", icon: "🛡️", cost: 170, build: 7, hp: 460, dmg: 42, range: 115, rof: 1.5, speed: 48, vision: 160,
    armor: "heavy", air: false, hitsAir: false, capture: false, radius: 16,
    about: "قوية وسريعة، تسحق المشاة، لكنها لا تصيب المسيّرات"
  },
  artillery: {
    name: "مدفعية", icon: "💥", cost: 150, build: 8, hp: 140, dmg: 75, range: 340, minRange: 90, rof: 4, speed: 24, vision: 120,
    armor: "light", air: false, hitsAir: false, capture: false, radius: 14, splash: 45, shellTime: 1.3,
    about: "تقصف من بعيد جداً وتدمّر المدرّعات، لكنها تحتاج من يكشف لها الهدف وضعيفة عن قرب"
  },
  drone: {
    name: "مسيّرة", icon: "🛸", cost: 100, build: 5, hp: 70, dmg: 15, range: 95, rof: 1, speed: 72, vision: 280,
    armor: "air", air: true, hitsAir: true, capture: false, radius: 11,
    about: "تطير فوق المباني وترى بعيداً، تصطاد المدفعية، ويُسقطها المشاة"
  }
};
export const UNIT_ORDER = ["infantry", "tank", "artillery", "drone"];

// مضاعف الضرر: [نوع المهاجم][درع الهدف]
export const MOD = {
  infantry: { inf: 1, heavy: 0.3, light: 0.9, air: 1.1, building: 0.4 },
  tank: { inf: 1.5, heavy: 1, light: 1.3, air: 0, building: 1.2 },
  artillery: { inf: 1.0, heavy: 1.6, light: 1.2, air: 0, building: 1.5 },
  drone: { inf: 0.6, heavy: 0.5, light: 2.2, air: 0.6, building: 0.3 },
  hq: { inf: 1, heavy: 0.7, light: 1, air: 1.3, building: 0 }
};

// المقرّ: مبنى بدفاع ذاتي
export const HQ = { hp: 2400, dmg: 20, range: 170, rof: 0.7, vision: 300, radius: 55 };

export const TEAM = ["#2f7cf6", "#e5484d"];
export const TEAM_DARK = ["#1b4fa6", "#9e2a2e"];
export const NEUTRAL_COLOR = "#9aa3ad";
export const START_MONEY = 300;
export const BASE_INCOME = 4; // دينار في الثانية
