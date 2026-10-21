// الصوت والمؤثرات: كلها تعمل محلياً داخل المتصفح بدون أي خدمة خارجية
import { store } from "./store.js";
import { isNative, TTS, checkNativeArabic, nativeArabicReady } from "./native.js";

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

// بعض الأجهزة (خصوصاً أندرويد) لا تُعلن عن الصوت العربي في القائمة رغم أنها تنطق به.
// لذلك نعتبر الجهاز "ينطق" إذا رأيناه ينطق فعلاً مرة واحدة على الأقل.
let deviceSpeaks = false;
try { deviceSpeaks = localStorage.getItem("huroofi-tts-ok") === "1"; } catch {}
const markSpeaks = () => {
  if (deviceSpeaks) return;
  deviceSpeaks = true;
  try { localStorage.setItem("huroofi-tts-ok", "1"); } catch {}
};

// داخل تطبيق أندرويد: النطق بمحرّك الجوال نفسه
if (isNative) checkNativeArabic();

export const hasArabicVoice = () => (isNative ? nativeArabicReady() : !!arVoice || deviceSpeaks);

export const canHear = () => store.settings.speech && hasArabicVoice();

// عبارة المديح تبدأ دائماً بكلمة تشجيع، حتى لا يظن الطفل أن السؤال يتكرر
export const praiseText = (t) => (!t ? "" : /^(أحسنت|ممتاز|رائع|صحيح|جيد|برافو)/.test(t) ? t : `أحسنت! ${t}`);

// ------------------------------------------------------------
//  النطق: جملة واحدة فقط في كل لحظة.
//  كل نطق جديد يلغي السابق، و speechDone() يعيد وعداً ينتهي عند انتهاء النطق الحالي.
//  لا نعتمد على حدث الانتهاء وحده: نراقب هل الجهاز ينطق فعلاً (speaking)،
//  وننتظر حتى يتوقف، مع حدّ أقصى للأمان.
// ------------------------------------------------------------
let speechId = 0;
let current = Promise.resolve();

const estimateMs = (text, rate) => 700 + (text.length * 110) / rate;

// slow = نطق أبطأ (للتمارين الصوتية عند الصغار)
export function speak(text, { slow = false } = {}) {
  const id = ++speechId;
  if (isNative && TTS) return speakNative(text, slow, id);
  if (!text || !store.settings.speech || !("speechSynthesis" in window)) {
    current = Promise.resolve();
    return current;
  }
  const rate = slow ? 0.55 : 0.8;
  current = new Promise((resolve) => {
    let done = false;
    let poll = null;
    const finish = () => { if (done) return; done = true; clearInterval(poll); resolve(); };
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
        let started = false;
        u.onstart = () => { started = true; markSpeaks(); };
        u.onend = () => { if (started || deviceSpeaks || arVoice) finish(); };
        u.onerror = finish;
        speechSynthesis.speak(u);
        const t0 = performance.now();
        const maxMs = Math.min(14000, estimateMs(text, rate) * 1.8 + 1500);
        poll = setInterval(() => {
          if (id !== speechId) return finish();
          const busy = speechSynthesis.speaking || speechSynthesis.pending;
          if (busy && !started && performance.now() - t0 > 150) { started = true; markSpeaks(); }
          const elapsed = performance.now() - t0;
          // انتهى النطق فعلاً
          if (started && !busy) return finish();
          // لم يبدأ أي نطق خلال ثانية وربع: الجهاز لا ينطق، لا ننتظر
          if (!started && elapsed > 1200) return finish();
          // حدّ أقصى للأمان
          if (elapsed > maxMs) finish();
        }, 120);
      }, 60);
    } catch { finish(); }
  });
  return current;
}

// النطق في التطبيق: الوعد ينتهي عندما ينتهي الجوال من النطق فعلاً
function speakNative(text, slow, id) {
  if (!text || !store.settings.speech) {
    current = Promise.resolve();
    return current;
  }
  const maxMs = Math.min(14000, estimateMs(text, slow ? 0.55 : 0.8) * 1.8 + 1500);
  const run = (async () => {
    try { await TTS.stop(); } catch {}
    if (id !== speechId) return;
    try {
      await TTS.speak({ text, lang: "ar-SA", rate: slow ? 0.6 : 0.85, pitch: 1.1, volume: 1, category: "playback", queueStrategy: 0 });
    } catch { /* لا يوجد صوت عربي أو أُلغي النطق */ }
  })();
  current = Promise.race([run, new Promise((r) => setTimeout(r, maxMs))]);
  return current;
}

// ينتهي عند انتهاء النطق الحالي (أو فوراً إن لم يكن هناك نطق)
export const speechDone = () => current;

export function stopSpeech() {
  speechId++;
  current = Promise.resolve();
  if (isNative && TTS) { TTS.stop().catch(() => {}); return; }
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
