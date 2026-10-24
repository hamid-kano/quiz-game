// الحملة: 8 مهمات على خرائط ثابتة (يمكن مقارنة الأوقات بين اللاعبين)
// me/foe: جيشك وجيش العدو · par: الوقت بالثواني للنجمة الثالثة، والنجمة الثانية حتى ضعفه ونصف
export const LEVELS = [
  { title: "التدريب", seed: 1201, me: "shield", foe: "falcon", ai: "easy", par: 900, tutorial: true, brief: "ابنِ قاعدتك، اجمع المؤن، ودرّب جيشك الأول" },
  { title: "عبور النهر", seed: 3317, me: "shield", foe: "falcon", ai: "easy", par: 900, brief: "الجسور ثلاثة فقط. سيطر عليها قبل العدو" },
  { title: "جناح الصقر", seed: 5521, me: "falcon", foe: "shield", ai: "easy", par: 900, brief: "قُد جيش الصقر السريع: مسيّرات وراجمات" },
  { title: "حرب المصافي", seed: 7741, me: "falcon", foe: "shield", ai: "normal", par: 1080, brief: "المصافي تضاعف دخلك. احتلّها بالمشاة مبكراً" },
  { title: "الدروع الثقيلة", seed: 9907, me: "shield", foe: "shield", ai: "normal", par: 1080, brief: "درع ضد درع: الصواريخ والمدفعية تحسم المعركة" },
  { title: "سماء مشتعلة", seed: 12011, me: "shield", foe: "falcon", ai: "normal", par: 1080, brief: "العدو يملك طيراناً كثيراً: ابنِ دفاعات جوية" },
  { title: "القائد الصعب", seed: 14423, me: "falcon", foe: "shield", ai: "hard", par: 1320, brief: "قائد ذكي بموارد أكثر منك وسلاح استراتيجي" },
  { title: "السيطرة الكاملة", seed: 16661, me: "shield", foe: "falcon", ai: "hard", par: 1320, brief: "المعركة الأخيرة. المدينة لمن يسيطر عليها" }
];

export function starsFor(level, won, secs) {
  if (!won) return 0;
  if (secs <= level.par) return 3;
  if (secs <= level.par * 1.5) return 2;
  return 1;
}
