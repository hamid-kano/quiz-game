// الحملة: 8 معارك متدرّجة على خرائط ثابتة (يمكن مقارنة الأوقات بين اللاعبين)
// par: الوقت بالثواني للنجمة الثالثة، والنجمة الثانية حتى ضعفه ونصف
export const LEVELS = [
  { title: "التدريب", seed: 1201, ai: "easy", par: 420, tutorial: true, brief: "تعلّم الأساسيات: اشترِ المشاة واحتلّ الساحات" },
  { title: "عبور النهر", seed: 3317, ai: "easy", par: 420, brief: "الجسور ثلاثة فقط. سيطر عليها قبل العدو" },
  { title: "المنطقة الصناعية", seed: 5521, ai: "normal", par: 600, brief: "المصانع تضاعف دخلك. احتلّها مبكراً" },
  { title: "حرب الشوارع", seed: 7741, ai: "normal", par: 600, brief: "العدو يبني مدرّعات: المدفعية تدمّرها من بعيد" },
  { title: "برج الاتصالات", seed: 9907, ai: "normal", par: 600, brief: "البرج يكشف مساحة واسعة من المدينة" },
  { title: "القائد الصعب", seed: 12011, ai: "hard", par: 780, brief: "قائد ذكي بموارد أكثر منك. نوّع جيشك" },
  { title: "الحصار", seed: 14423, ai: "hard", par: 780, brief: "اقطع دخل العدو باحتلال مواقعه قبل مهاجمة مقرّه" },
  { title: "السيطرة الكاملة", seed: 16661, ai: "hard", par: 840, brief: "المعركة الأخيرة. المدينة لمن يسيطر عليها" }
];

export function starsFor(level, won, secs) {
  if (!won) return 0;
  if (secs <= level.par) return 3;
  if (secs <= level.par * 1.5) return 2;
  return 1;
}
