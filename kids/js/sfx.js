// الصوت والمؤثرات: كلها تعمل محلياً داخل المتصفح بدون أي خدمة خارجية
import { store } from "./store.js";

let arVoice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  arVoice =
    voices.find((v) => /^ar[-_]SA/i.test(v.lang)) ||
    voices.find((v) => /^ar/i.test(v.lang)) ||
    null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export const hasArabicVoice = () => !!arVoice;

export const canHear = () => store.settings.speech && !!arVoice;

// ------------------------------------------------------------
//  النطق: جملة واحدة فقط في كل لحظة.
//  كل نطق جديد يلغي السابق، و speechDone() يعيد وعداً ينتهي عند انتهاء النطق الحالي
//  (مع حدّ أقصى للوقت لأن بعض المتصفحات لا ترسل حدث الانتهاء أحياناً)
// ------------------------------------------------------------
let speechId = 0;
let current = Promise.resolve();

const estimateMs = (text, rate) => Math.min(7000, 600 + (text.length * 95) / rate);

// slow = نطق أبطأ (للتمارين الصوتية عند الصغار)
export function speak(text, { slow = false } = {}) {
  const id = ++speechId;
  if (!text || !store.settings.speech || !("speechSynthesis" in window)) {
    current = Promise.resolve();
    return current;
  }
  const rate = slow ? 0.55 : 0.8;
  current = new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    try {
      speechSynthesis.cancel();
      // مهلة قصيرة بعد الإلغاء لأن بعض المتصفحات تتجاهل النطق الذي يأتي فوراً بعده
      setTimeout(() => {
        if (id !== speechId) return finish(); // جاء نطق أحدث، نتجاهل هذا
        const u = new SpeechSynthesisUtterance(text);
        u.lang = arVoice?.lang || "ar-SA";
        if (arVoice) u.voice = arVoice;
        u.rate = rate;
        u.pitch = 1.1;
        u.onend = finish;
        u.onerror = finish;
        speechSynthesis.speak(u);
        // بدون صوت عربي قد لا يُنطق شيء، فلا ننتظر طويلاً
        setTimeout(finish, arVoice ? estimateMs(text, rate) : 300);
      }, 60);
    } catch { finish(); }
  });
  return current;
}

// ينتهي عند انتهاء النطق الحالي (أو فوراً إن لم يكن هناك نطق)
export const speechDone = () => current;

export function stopSpeech() {
  speechId++;
  current = Promise.resolve();
  try { window.speechSynthesis?.cancel(); } catch {}
}

let ctx = null;
function tone(freqs, dur = 0.12, type = "sine", gain = 0.22) {
  if (!store.settings.sfx) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      const t0 = ctx.currentTime + i * dur;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    });
  } catch { /* الصوت غير متاح */ }
}

function vibrate(pattern) {
  if (!store.settings.vibrate) return;
  try { navigator.vibrate?.(pattern); } catch {}
}

export const sfx = {
  right: () => { tone([660, 880, 1175], 0.1); vibrate(30); },
  wrong: () => { tone([220, 180], 0.15, "triangle"); vibrate([60, 40, 60]); },
  win: () => tone([523, 659, 784, 1047, 1319], 0.12),
  tap: () => tone([520], 0.05, "sine", 0.12),
  sticker: () => tone([784, 988, 1175, 1568], 0.09, "triangle")
};

export function confetti(count = 70) {
  const box = document.getElementById("confetti");
  if (!box || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#ffb703", "#fb8500", "#8e7dff", "#2bb673", "#ef476f", "#219ebc"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
    p.style.animationDelay = Math.random() * 0.4 + "s";
    box.appendChild(p);
    setTimeout(() => p.remove(), 4300);
  }
}
