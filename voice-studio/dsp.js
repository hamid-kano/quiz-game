// dsp.js — معالجة الصوت (بدون مكتبات خارجية)
// كل الدوال تعمل على Float32Array أحادي القناة (mono)
(function (root) {
  'use strict';

  // ---------- FFT (radix-2, in-place) ----------
  function makeFFT(n) {
    const levels = Math.log2(n) | 0;
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0, v = i;
      for (let j = 0; j < levels; j++) { r = (r << 1) | (v & 1); v >>= 1; }
      rev[i] = r;
    }
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
    return function fft(re, im, inverse) {
      for (let i = 0; i < n; i++) {
        const j = rev[i];
        if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
      }
      const s = inverse ? 1 : -1;
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1, step = n / size;
        for (let i = 0; i < n; i += size) {
          for (let j = 0, k = 0; j < half; j++, k += step) {
            const a = i + j, b = a + half;
            const tr = re[b] * cos[k] - s * im[b] * sin[k];
            const ti = re[b] * s * sin[k] + im[b] * cos[k];
            re[b] = re[a] - tr; im[b] = im[a] - ti;
            re[a] += tr; im[a] += ti;
          }
        }
      }
      if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    };
  }

  function hann(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n);
    return w;
  }

  // ---------- إزالة الضجة (Spectral subtraction) ----------
  // amount: 0..1
  function denoise(x, sr, amount) {
    if (!amount || amount <= 0) return x;
    const N = sr > 32000 ? 2048 : 1024, H = N / 4;
    const w = hann(N), fft = makeFFT(N), bins = N / 2 + 1;
    const pad = N;
    const len = x.length;
    const src = new Float32Array(len + 2 * pad); src.set(x, pad);
    const frames = Math.floor((src.length - N) / H) + 1;

    // 1) طاقة كل إطار لاختيار الإطارات الأهدأ كبصمة ضجة
    const energy = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let e = 0; const o = f * H;
      for (let i = 0; i < N; i += 4) { const v = src[o + i]; e += v * v; }
      energy[f] = e;
    }
    const sorted = Array.from(energy).filter(e => e > 1e-12).sort((a, b) => a - b);
    if (!sorted.length) return x;
    const cut = sorted[Math.max(0, Math.floor(sorted.length * 0.1) - 1)];

    // 2) متوسط طيف الضجة
    const noise = new Float64Array(bins);
    const re = new Float64Array(N), im = new Float64Array(N);
    let cnt = 0;
    for (let f = 0; f < frames; f++) {
      if (energy[f] > cut || energy[f] <= 1e-12) continue;
      const o = f * H;
      for (let i = 0; i < N; i++) { re[i] = src[o + i] * w[i]; im[i] = 0; }
      fft(re, im, false);
      for (let k = 0; k < bins; k++) noise[k] += Math.hypot(re[k], im[k]);
      cnt++;
    }
    if (!cnt) return x;
    for (let k = 0; k < bins; k++) noise[k] /= cnt;

    // 3) المعالجة
    const over = 1 + amount * 2.0;                     // over-subtraction
    const floor = Math.pow(10, -(6 + amount * 20) / 20); // أقل كسب مسموح
    const out = new Float64Array(src.length);
    const prevG = new Float64Array(bins).fill(1);
    const g = new Float64Array(bins), gs = new Float64Array(bins);
    for (let f = 0; f < frames; f++) {
      const o = f * H;
      for (let i = 0; i < N; i++) { re[i] = src[o + i] * w[i]; im[i] = 0; }
      fft(re, im, false);
      for (let k = 0; k < bins; k++) {
        const m = Math.hypot(re[k], im[k]) + 1e-12;
        g[k] = Math.max(floor, 1 - over * noise[k] / m);
      }
      for (let k = 0; k < bins; k++) { // تنعيم ترددي + زمني لتقليل "الضجة الموسيقية"
        const a = g[Math.max(0, k - 1)], b = g[k], c = g[Math.min(bins - 1, k + 1)];
        let v = (a + 2 * b + c) / 4;
        v = v > prevG[k] ? 0.6 * v + 0.4 * prevG[k] : 0.4 * v + 0.6 * prevG[k];
        gs[k] = v; prevG[k] = v;
      }
      for (let k = 0; k < bins; k++) { re[k] *= gs[k]; im[k] *= gs[k]; }
      for (let k = 1; k < N / 2; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
      fft(re, im, true);
      for (let i = 0; i < N; i++) out[o + i] += re[i] * w[i];
    }
    const norm = 1 / 1.5; // مجموع hann² عند تداخل 75%
    const y = new Float32Array(len);
    for (let i = 0; i < len; i++) y[i] = out[pad + i] * norm;
    return y;
  }

  // ---------- بوابة الضجة (Noise gate / expander) ----------
  function gate(x, sr, threshDb, rangeDb) {
    if (threshDb == null || threshDb <= -79) return x;
    rangeDb = rangeDb == null ? -25 : rangeDb;
    const thr = Math.pow(10, threshDb / 20), floor = Math.pow(10, rangeDb / 20);
    const envC = Math.exp(-1 / (0.010 * sr));
    const atk = Math.exp(-1 / (0.002 * sr)), rel = Math.exp(-1 / (0.120 * sr));
    const holdN = Math.round(0.08 * sr);
    const y = new Float32Array(x.length);
    let ms = 0, gcur = floor, hold = 0;
    for (let i = 0; i < x.length; i++) {
      ms = envC * ms + (1 - envC) * x[i] * x[i];
      const env = Math.sqrt(ms);
      let target;
      if (env > thr) { target = 1; hold = holdN; }
      else if (hold > 0) { target = 1; hold--; }
      else target = floor;
      gcur = target > gcur ? atk * gcur + (1 - atk) * target : rel * gcur + (1 - rel) * target;
      y[i] = x[i] * gcur;
    }
    return y;
  }

  // ---------- فلاتر Biquad (RBJ) ----------
  function biquadCoefs(type, f0, sr, Q, gainDb) {
    const A = Math.pow(10, (gainDb || 0) / 40), w0 = 2 * Math.PI * f0 / sr;
    const cs = Math.cos(w0), sn = Math.sin(w0), alpha = sn / (2 * Q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'highpass') {
      b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
    } else if (type === 'highshelf') {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cs + s); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - s);
      a0 = (A + 1) - (A - 1) * cs + s; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - s;
    } else throw new Error('type');
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function biquad(x, c) {
    const [b0, b1, b2, a1, a2] = c; const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = x[i], o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o;
    }
    return y;
  }

  // ---------- مزيل الصفير (De-esser ديناميكي) ----------
  function deess(x, sr, amount) {
    if (!amount || amount <= 0) return x;
    const hi = biquad(x, biquadCoefs('highpass', 5000, sr, 0.707));
    const a = Math.exp(-1 / (0.001 * sr)), r = Math.exp(-1 / (0.060 * sr));
    const sm = Math.exp(-1 / (0.003 * sr));
    const k = 0.45 - amount * 0.25;        // كلما زادت الكمية كان التدخل أبكر
    const minG = 1 - amount * 0.85;
    let eh = 0, ef = 0, g = 1;
    const y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      const h = Math.abs(hi[i]), f = Math.abs(x[i]);
      eh = h > eh ? a * eh + (1 - a) * h : r * eh + (1 - r) * h;
      ef = f > ef ? a * ef + (1 - a) * f : r * ef + (1 - r) * f;
      let tg = 1;
      if (eh > k * ef && eh > 1e-5) tg = Math.max(minG, (k * ef) / eh);
      g = sm * g + (1 - sm) * tg;
      const lo = x[i] - hi[i];
      y[i] = lo + hi[i] * g;
    }
    return y;
  }

  // ---------- تغيير طبقة الصوت (WSOLA + إعادة تحجيم) ----------
  function wsola(x, stretch, sr) {
    const N = sr > 32000 ? 2048 : 1024, Hs = N / 2, Ha = Hs / stretch;
    const delta = Math.round(N / 4), L = Hs;
    const w = hann(N);
    const outLen = Math.ceil(x.length * stretch);
    const out = new Float32Array(outLen + N);
    const xin = new Float32Array(x.length + 2 * N + 2 * delta); xin.set(x, N + delta);
    const off = N + delta;
    let prev = 0;
    for (let k = 0; ; k++) {
      const outPos = k * Hs;
      if (outPos >= outLen) break;
      const nominal = Math.round(k * Ha);
      let best = nominal;
      if (k > 0) {
        const nat = prev + Hs;
        let bestC = -Infinity;
        for (let d = -delta; d <= delta; d += 2) {
          const cand = nominal + d;
          let c = 0;
          for (let i = 0; i < L; i += 4) c += xin[off + cand + i] * xin[off + nat + i];
          if (c > bestC) { bestC = c; best = cand; }
        }
      }
      for (let i = 0; i < N; i++) out[outPos + i] += xin[off + best + i] * w[i];
      prev = best;
      if (best > x.length) break;
    }
    return out.subarray(0, outLen);
  }
  function resample(x, ratio) { // ratio>1 => أقصر
    const n = Math.floor(x.length / ratio), y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = i * ratio, j = p | 0, f = p - j;
      y[i] = x[j] * (1 - f) + (x[j + 1] || 0) * f;
    }
    return y;
  }
  function pitchShift(x, sr, semitones) {
    if (!semitones) return x;
    const r = Math.pow(2, semitones / 12);
    const st = wsola(x, r, sr);
    const y = resample(st, r);
    const out = new Float32Array(x.length);
    out.set(y.subarray(0, Math.min(y.length, x.length)));
    return out;
  }

  // ---------- قياس الارتفاع LUFS (ITU-R BS.1770) — قناة أو أكثر ----------
  function lufsCh(chs, sr) {
    const ks = chs.map(x => biquad(biquad(x, biquadCoefs('highshelf', 1681.974, sr, 0.7072, 3.99984)), biquadCoefs('highpass', 38.1355, sr, 0.5003)));
    const len = ks[0].length, block = Math.round(0.4 * sr), step = Math.round(0.1 * sr);
    const L = m => -0.691 + 10 * Math.log10(m + 1e-20);
    const ms = [];
    for (let s = 0; s + block <= len; s += step) {
      let e = 0; for (const k of ks) for (let i = s; i < s + block; i++) e += k[i] * k[i];
      ms.push(e / block);
    }
    if (!ms.length) { let e = 0; for (const k of ks) for (let i = 0; i < len; i++) e += k[i] * k[i]; return L(e / Math.max(1, len)); }
    const g1 = ms.filter(m => L(m) > -70);
    if (!g1.length) return -70;
    const rel = L(g1.reduce((a, b) => a + b, 0) / g1.length) - 10;
    const g2 = g1.filter(m => L(m) > rel);
    return L(g2.reduce((a, b) => a + b, 0) / g2.length);
  }
  function lufs(x, sr) { return lufsCh([x], sr); }
  function peakDb(x) { let p = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > p) p = v; } return 20 * Math.log10(p + 1e-20); }

  // ---------- محدد (Look-ahead limiter) — مربوط بين القنوات ----------
  function limitCh(chs, sr, ceilDb) {
    const ceil = Math.pow(10, ceilDb / 20), L = Math.max(1, Math.round(0.005 * sr)), n = chs[0].length;
    const r = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let a = 0; for (const c of chs) { const v = Math.abs(c[i]); if (v > a) a = v; }
      r[i] = a > ceil ? ceil / a : 1;
    }
    const m = new Float32Array(n), dq = new Int32Array(n + L + 1); let h = 0, t = 0;
    for (let i = n - 1; i >= 0; i--) {
      while (t > h && r[dq[t - 1]] >= r[i]) t--;
      dq[t++] = i;
      while (dq[h] > i + L) h++;
      m[i] = r[dq[h]];
    }
    const rel = Math.exp(-1 / (0.08 * sr));
    let g = 1;
    for (let i = 0; i < n; i++) { g = m[i] < g ? m[i] : rel * g + (1 - rel) * m[i]; if (g > m[i]) g = m[i]; m[i] = g; }
    const outs = chs.map(() => new Float32Array(n));
    const buf = new Float32Array(L + 1).fill(1); let bi = 0, sum = L + 1;
    for (let i = 0; i < n; i++) {
      sum += m[i] - buf[bi]; buf[bi] = m[i]; bi = (bi + 1) % (L + 1);
      const gg = sum / (L + 1);
      for (let c = 0; c < chs.length; c++) outs[c][i] = chs[c][i] * gg;
    }
    return outs;
  }
  function limit(x, sr, ceilDb) { return limitCh([x], sr, ceilDb)[0]; }

  // ---------- منحنى خفض الموسيقى وقت الكلام (Ducking) ----------
  // يرجع كسب لكل عيّنة على طول total، والصوت يبدأ عند start
  function duckCurve(voice, sr, total, start, duckDb) {
    const g = new Float32Array(total).fill(1);
    if (!voice || !duckDb) return g;
    const fr = Math.round(0.01 * sr), nf = Math.ceil(voice.length / fr);
    const rms = new Float32Array(nf);
    for (let f = 0; f < nf; f++) {
      let e = 0, c = 0; for (let i = f * fr; i < Math.min(voice.length, (f + 1) * fr); i++) { e += voice[i] * voice[i]; c++; }
      rms[f] = Math.sqrt(e / Math.max(1, c));
    }
    const sorted = Array.from(rms).sort((a, b) => a - b);
    const ref = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const thr = ref * Math.pow(10, -26 / 20);
    const low = Math.pow(10, -Math.abs(duckDb) / 20);
    const hold = 35, aC = Math.exp(-1 / 25), rC = Math.exp(-1 / 80); // إطارات 10ms
    const gf = new Float32Array(nf + 1); let h = 0, cur = 1;
    for (let f = 0; f < nf; f++) {
      if (rms[f] > thr) h = hold; else if (h > 0) h--;
      const tgt = h > 0 ? low : 1;
      cur = tgt < cur ? aC * cur + (1 - aC) * tgt : rC * cur + (1 - rC) * tgt;
      gf[f] = cur;
    }
    gf[nf] = 1;
    // تبدأ النزلة قبل الكلام بقليل (look-ahead 150ms)
    const la = Math.round(0.15 * sr);
    for (let i = 0; i < total; i++) {
      const vi = i - start + la;
      if (vi < 0 || vi >= voice.length + fr) continue;
      const p = vi / fr, f = Math.min(nf - 1, p | 0), t = p - f;
      g[i] = gf[f] * (1 - t) + gf[f + 1] * t;
    }
    return g;
  }

  // ---------- صدى (Impulse response) ----------
  function makeImpulse(sr, seconds) {
    const n = Math.max(1, Math.round(sr * seconds)), ir = new Float32Array(n);
    const pre = Math.round(0.012 * sr);
    let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / (n - pre);
      lp = 0.7 * lp + 0.3 * rnd();           // تنعيم بسيط لصدى أدفأ
      ir[i] = lp * Math.pow(1 - t, 2.2) * Math.exp(-3 * t);
    }
    let e = 0; for (let i = 0; i < n; i++) e += ir[i] * ir[i];
    const s = 1 / Math.sqrt(e + 1e-12) * 0.35;
    for (let i = 0; i < n; i++) ir[i] *= s;
    return ir;
  }

  // ---------- ترميز WAV ----------
  function encodeWav(channels, sr) {
    const nc = channels.length, n = channels[0].length, bytes = 44 + n * nc * 2;
    const b = new ArrayBuffer(bytes), v = new DataView(b);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, bytes - 8, true); ws(8, 'WAVE'); ws(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * nc * 2, true); v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, n * nc * 2, true);
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
    return new Blob([b], { type: 'audio/wav' });
  }
  function toInt16(x) { const y = new Int16Array(x.length); for (let i = 0; i < x.length; i++) { const s = Math.max(-1, Math.min(1, x[i])); y[i] = s < 0 ? s * 0x8000 : s * 0x7fff; } return y; }

  const DSP = { denoise, gate, deess, pitchShift, lufs, lufsCh, peakDb, limit, limitCh, duckCurve, makeImpulse, encodeWav, toInt16, biquad, biquadCoefs };
  if (typeof module !== 'undefined' && module.exports) module.exports = DSP; else root.DSP = DSP;
})(typeof self !== 'undefined' ? self : this);
