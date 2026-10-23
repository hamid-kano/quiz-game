// عشوائية مبذورة: نفس البذرة تعطي نفس النتائج دائماً
export function makeRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// رمز خريطة قصير يمكن مشاركته (مثل: K7Q2M) ⇄ بذرة رقمية
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function seedToCode(seed) {
  let n = seed >>> 0, out = "";
  for (let i = 0; i < 6; i++) { out += ABC[n % 32]; n = Math.floor(n / 32); }
  return out;
}
export function codeToSeed(code) {
  const c = String(code).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length !== 6 || [...c].some((ch) => !ABC.includes(ch))) return null;
  let n = 0;
  for (let i = 5; i >= 0; i--) n = n * 32 + ABC.indexOf(c[i]);
  return n | 0;
}
export const randomSeed = () => (Math.random() * 2 ** 30) | 0;
