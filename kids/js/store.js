// ============================================================
//  التخزين المحلي: ملفات الأطفال، التقدّم، الإتقان، الإعدادات
//  كل البيانات تبقى على جهاز المستخدم (localStorage) ولا تُرسل لأي جهة
// ============================================================
import { today, daysBetween, uid, randomOf } from "./util.js";
import { STICKERS, DEFAULT_ROUNDS } from "./data.js";

const KEY = "huroofi-v2";
const OLD_KEY = "huroofi-progress-v1";

// صناديق التكرار (نظام لايتنر): كلما ارتفع الصندوق قلّ ظهور العنصر
// 0 = جديد أو أخطأ فيه مؤخراً، 4 = متقن
export const MAX_BOX = 4;
const BOX_WEIGHT = [8, 5, 3, 2, 1];
const NEW_WEIGHT = 6;

const defaultSettings = () => ({ sfx: true, speech: true, vibrate: true, rounds: DEFAULT_ROUNDS });

export function newProfile({ name = "", age = "small", avatar = "🦁" } = {}) {
  return {
    id: uid(),
    name,
    age,
    avatar,
    created: today(),
    stars: {},       // levelId -> أفضل عدد نجوم
    plays: {},       // levelId -> عدد مرات اللعب
    mastery: {},     // key -> { box, seen, right, last }
    confusions: {},  // "الصحيح>المختار" -> عدد المرات
    days: {},        // التاريخ -> { answers, right, seconds }
    stickers: [],    // رموز الملصقات المكتسبة بالترتيب
    daily: { last: null, streak: 0, best: 0 },
    certificates: [] // معرّفات الشهادات المكتسبة
  };
}

function blank() {
  return { active: null, profiles: {}, order: [], settings: defaultSettings() };
}

function readRaw() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && data.profiles) return data;
  } catch {}
  // ترحيل بيانات النسخة الأولى إن وُجدت
  const fresh = blank();
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (old && old.age) {
      const p = newProfile({ name: old.name || "", age: old.age });
      const idMap = { 1: "letters1", 2: "letters2", 3: "letters3", 4: "trace", 5: "first", 6: "harakat", 7: "build", 8: "read", 9: "build2" };
      for (const [k, v] of Object.entries(old.stars || {})) if (idMap[k]) p.stars[idMap[k]] = v;
      for (const [k, v] of Object.entries(old.plays || {})) if (idMap[k]) p.plays[idMap[k]] = v;
      fresh.profiles[p.id] = p;
      fresh.order.push(p.id);
      fresh.active = p.id;
    }
  } catch {}
  return fresh;
}

class Store {
  constructor() {
    this.data = readRaw();
    this.data.settings = Object.assign(defaultSettings(), this.data.settings || {});
    // إكمال الحقول الناقصة في الملفات القديمة
    for (const p of Object.values(this.data.profiles)) {
      const base = newProfile();
      for (const k of Object.keys(base)) if (p[k] === undefined) p[k] = base[k];
    }
    this.save();
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* التخزين ممتلئ أو غير متاح */ }
  }

  get settings() { return this.data.settings; }
  setSetting(k, v) { this.data.settings[k] = v; this.save(); }

  // ---------- الملفات ----------
  get profiles() { return this.data.order.map((id) => this.data.profiles[id]).filter(Boolean); }
  get active() { return this.data.profiles[this.data.active] || null; }

  addProfile(info) {
    const p = newProfile(info);
    this.data.profiles[p.id] = p;
    this.data.order.push(p.id);
    this.data.active = p.id;
    this.save();
    return p;
  }

  updateProfile(id, info) {
    Object.assign(this.data.profiles[id], info);
    this.save();
  }

  setActive(id) { this.data.active = id; this.save(); }

  deleteProfile(id) {
    delete this.data.profiles[id];
    this.data.order = this.data.order.filter((x) => x !== id);
    if (this.data.active === id) this.data.active = this.data.order[0] || null;
    this.save();
  }

  resetProgress(id) {
    const p = this.data.profiles[id];
    const fresh = newProfile({ name: p.name, age: p.age, avatar: p.avatar });
    fresh.id = p.id;
    fresh.created = p.created;
    this.data.profiles[id] = fresh;
    this.save();
  }

  // ---------- الإتقان والتكرار الذكي ----------
  m(key) { return this.active.mastery[key]; }

  weight(key) {
    const m = this.m(key);
    if (!m) return NEW_WEIGHT;
    let w = BOX_WEIGHT[m.box] ?? 1;
    // ما لم يُر منذ أيام يعود تدريجياً
    if (m.last) w += Math.min(3, Math.max(0, daysBetween(m.last, today())) * 0.5);
    return w;
  }

  // يختار n عناصر مختلفة، والأضعف يظهر أكثر
  pickWeighted(items, keyFn, n = 1) {
    const pool = [...items];
    const out = [];
    while (out.length < n && pool.length) {
      const ws = pool.map((it) => this.weight(keyFn(it)));
      const total = ws.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let i = 0;
      while (r > ws[i] && i < ws.length - 1) { r -= ws[i]; i++; }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  // يسجّل إجابة: firstTry = صحيحة من المحاولة الأولى
  record(key, firstTry, { confusedWith = null, target = null } = {}) {
    const p = this.active;
    const m = p.mastery[key] || { box: 0, seen: 0, right: 0, last: null };
    m.seen++;
    if (firstTry) { m.right++; m.box = Math.min(MAX_BOX, m.box + 1); }
    else m.box = 0;
    m.last = today();
    p.mastery[key] = m;

    if (confusedWith && target && confusedWith !== target) {
      const ck = `${target}>${confusedWith}`;
      p.confusions[ck] = (p.confusions[ck] || 0) + 1;
    }

    const d = (p.days[today()] ||= { answers: 0, right: 0, seconds: 0 });
    d.answers++;
    if (firstTry) d.right++;
    this.save();
  }

  // يسجّل خطأً فقط (المحاولة الأولى خاطئة) دون إنهاء السؤال
  confuse(target, chosen) {
    if (!target || !chosen || target === chosen) return;
    const p = this.active;
    const ck = `${target}>${chosen}`;
    p.confusions[ck] = (p.confusions[ck] || 0) + 1;
    this.save();
  }

  addSeconds(sec) {
    const p = this.active;
    if (!p) return;
    const d = (p.days[today()] ||= { answers: 0, right: 0, seconds: 0 });
    d.seconds += sec;
    this.save();
  }

  // ---------- المستويات ----------
  finishLevel(levelId, stars) {
    const p = this.active;
    const before = p.stars[levelId] || 0;
    p.stars[levelId] = Math.max(before, stars);
    p.plays[levelId] = (p.plays[levelId] || 0) + 1;
    this.save();
    return { before, after: p.stars[levelId] };
  }

  // إتقان مهارة: مجموع (صندوق كل عنصر ÷ 4) لكل العناصر التابعة لها، مقسوماً على هدف المهارة
  skillProgress(skill, p = this.active) {
    let sum = 0;
    let seen = 0;
    for (const [k, m] of Object.entries(p.mastery)) {
      if (!skill.prefixes.some((pre) => k.startsWith(pre))) continue;
      sum += Math.min(m.box, MAX_BOX) / MAX_BOX;
      seen++;
    }
    return { value: Math.min(1, sum / skill.target), seen };
  }

  totalStars(p = this.active) { return Object.values(p.stars).reduce((a, b) => a + b, 0); }

  // ---------- الملصقات ----------
  awardSticker() {
    const p = this.active;
    const left = STICKERS.filter((s) => !p.stickers.includes(s.e));
    if (!left.length) return null;
    const s = randomOf(left);
    p.stickers.push(s.e);
    this.save();
    return s;
  }

  // ---------- التحدي اليومي ----------
  dailyDoneToday() { return this.active.daily.last === today(); }

  // السلسلة الحالية (تنكسر إذا فات يوم كامل)
  currentStreak() {
    const d = this.active.daily;
    if (!d.last) return 0;
    const gap = daysBetween(d.last, today());
    return gap <= 1 ? d.streak : 0;
  }

  completeDaily() {
    const d = this.active.daily;
    const t = today();
    if (d.last === t) return d.streak;
    d.streak = d.last && daysBetween(d.last, t) === 1 ? d.streak + 1 : 1;
    d.best = Math.max(d.best, d.streak);
    d.last = t;
    this.save();
    return d.streak;
  }

  addCertificate(id) {
    const p = this.active;
    if (p.certificates.includes(id)) return false;
    p.certificates.push(id);
    this.save();
    return true;
  }
}

export const store = new Store();
