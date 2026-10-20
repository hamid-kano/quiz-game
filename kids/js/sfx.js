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

export function speak(text) {
  if (!store.settings.speech || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = arVoice?.lang || "ar-SA";
    if (arVoice) u.voice = arVoice;
    u.rate = 0.8;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  } catch { /* غير مدعوم */ }
}

export function stopSpeech() {
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
