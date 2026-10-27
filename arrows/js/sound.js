// أصوات مولّدة بالكامل (بدون ملفات): نقرة، انزلاق، اصطدام، فوز، خسارة، تلميح
let ctx = null, master = null, on = true, noise = null;
export function setSound(v) { on = v; if (master) master.gain.value = v ? 0.9 : 0; }
function ac() {
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ctx = new A(); master = ctx.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
export const unlock = () => ac();
function tone(f, dur, type = "sine", vol = 0.12, at = 0, slide = 0) {
  const c = ac(); if (!c || !on) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.03);
}
function hiss(dur, f0, f1, vol, q = 1.4) {
  const c = ac(); if (!c || !on) return;
  const s = c.createBufferSource(); s.buffer = noise;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = q;
  const g = c.createGain(), t = c.currentTime;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.05);
}
let combo = 0, comboT = 0;
export const sfx = {
  tap: () => tone(880, 0.05, "sine", 0.05),
  // كل خروج متتالٍ سريع يرفع النغمة قليلاً (إحساس بالسلسلة)
  exit: () => { const n = performance.now(); combo = n - comboT < 1400 ? Math.min(combo + 1, 10) : 0; comboT = n; hiss(0.35, 500, 3200, 0.16); tone(520 * Math.pow(1.06, combo), 0.12, "triangle", 0.07, 0.02, 1.5); },
  bump: () => { tone(140, 0.18, "sine", 0.28, 0, 0.6); hiss(0.08, 1800, 900, 0.1, 3); },
  wrong: () => tone(220, 0.22, "square", 0.05, 0.05, 0.7),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, "triangle", 0.11, i * 0.09)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "triangle", 0.1, i * 0.14)),
  hint: () => [1319, 1568, 2093].forEach((f, i) => tone(f, 0.18, "sine", 0.06, i * 0.06)),
  star: (i) => tone(660 * Math.pow(1.26, i), 0.25, "triangle", 0.12),
  click: () => tone(1200, 0.03, "square", 0.03)
};
