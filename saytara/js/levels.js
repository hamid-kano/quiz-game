// الحملة: 12 معركة متدرّجة، الخرائط ثابتة للجميع (فيمكن مقارنة الأوقات بين اللاعبين)
// par: الوقت (بالثواني) للنجمة الثالثة، والنجمة الثانية حتى ضعفه ونصف
export const LEVELS = [
  { title: "الحيّ الأول", seed: 1201, size: "small", ai: ["easy"], par: 90, tutorial: true },
  { title: "عبور الجسر", seed: 3317, size: "small", ai: ["easy"], par: 95 },
  { title: "جبهتان", seed: 9907, size: "small", ai: ["easy", "easy"], par: 105 },
  { title: "المنطقة الصناعية", seed: 5521, size: "medium", ai: ["easy"], par: 110 },
  { title: "المدينة الكبرى", seed: 18917, size: "large", ai: ["easy", "easy", "easy"], par: 160 },
  { title: "تحالف الأعداء", seed: 14423, size: "medium", ai: ["normal", "easy"], par: 150 },
  { title: "قائد متمرّس", seed: 7741, size: "medium", ai: ["normal"], par: 160 },
  { title: "حصار المقرّ", seed: 23399, size: "medium", ai: ["hard", "normal"], par: 130 },
  { title: "ثلاثة جيوش", seed: 21143, size: "large", ai: ["normal", "normal"], par: 210 },
  { title: "معركة المطار", seed: 12011, size: "medium", ai: ["normal"], par: 240 },
  { title: "القائد الصعب", seed: 35586, size: "medium", ai: ["hard"], par: 200 },
  { title: "السيطرة الكاملة", seed: 31118, size: "large", ai: ["hard", "normal", "normal"], par: 300 }
];

export function starsFor(level, won, secs) {
  if (!won) return 0;
  if (secs <= level.par) return 3;
  if (secs <= level.par * 1.5) return 2;
  return 1;
}
