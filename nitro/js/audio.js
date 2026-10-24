// الأصوات: محرك متغيّر النغمة حسب السرعة، صرير الإطارات، الاصطدام، ونغمات مولّدة للعدّ والنيترو
let ctx = null, master = null, buffers = {}, engine = null, skid = null, enabled = true, loaded = false;

export function setSound(on) { enabled = on; if (master) master.gain.value = on ? 1 : 0; }

export async function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = enabled ? 1 : 0; master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (loaded) return;
  loaded = true;
  await Promise.all(["engine.wav", "engine-motorcycle.wav", "skid.wav", "impact.mp3"].map(async (f) => {
    try { const r = await fetch(`audio/${f}`); buffers[f.split(".")[0]] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch {}
  }));
}

function loop(buf, gain) {
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(g).connect(master); src.start();
  return { src, g };
}

export function startEngine(moto) {
  stopEngine();
  if (!ctx || !buffers.engine) return;
  engine = loop(buffers[moto ? "engine-motorcycle" : "engine"] || buffers.engine, 0);
  if (buffers.skid) skid = loop(buffers.skid, 0);
}
export function stopEngine() {
  for (const s of [engine, skid]) if (s) { try { s.src.stop(); } catch {} }
  engine = skid = null;
}
// speed: 0..1+ · throttle: 0..1 · drift: 0..1
export function updateEngine(speed, throttle, drift, nitro) {
  if (!engine) return;
  const t = ctx.currentTime;
  engine.src.playbackRate.setTargetAtTime(0.55 + speed * 1.55 + (nitro ? 0.25 : 0), t, 0.08);
  engine.g.gain.setTargetAtTime(0.16 + speed * 0.14 + throttle * 0.08, t, 0.1);
  if (skid) { skid.g.gain.setTargetAtTime(drift * 0.28, t, 0.05); skid.src.playbackRate.setTargetAtTime(0.9 + speed * 0.4, t, 0.1); }
}
export function muteEngine() { if (engine) engine.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); if (skid) skid.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }

export function impact(v) {
  if (!ctx || !buffers.impact) return;
  const s = ctx.createBufferSource(); s.buffer = buffers.impact; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const g = ctx.createGain(); g.gain.value = Math.min(1, 0.15 + v * 0.06);
  s.connect(g).connect(master); s.start();
}
export function beep(freq, dur = 0.18, type = "square", vol = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
export function whoosh() {
  if (!ctx) return;
  const len = ctx.sampleRate * 0.7, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
  const t = ctx.currentTime; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
  const g = ctx.createGain(); g.gain.value = 0.25;
  s.connect(f).connect(g).connect(master); s.start();
}
export function jingle(notes, step = 0.12) { notes.forEach((n, i) => setTimeout(() => beep(n, 0.22, "triangle", 0.14), i * step * 1000)); }
