// app.js — واجهة استوديو الصوت
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  // ---------- تعريف الإعدادات ----------
  // stage: pre = معالجة مسبقة (تحتاج إعادة حساب)، live = فورية
  const SCHEMA = [
    { g: 'تنظيف الصوت', items: [
      { k: 'nr', label: 'إزالة الضجة', min: 0, max: 100, step: 1, unit: '%', stage: 'pre', tip: 'يشيل الوشّة الثابتة (مروحة، مكيف). أكثر من 70% ممكن يخلّي الصوت معدني.' },
      { k: 'gate', label: 'تسكير الصمت (Gate)', min: -80, max: -30, step: 1, unit: 'dB', stage: 'pre', tip: 'يخفض الصوت بين الكلمات. -80 = مطفأ. ارفعه تدريجياً لحد ما تختفي الأصوات الخلفية بين الجمل.' },
      { k: 'hp', label: 'قص الطبقات الواطية', min: 20, max: 400, step: 5, unit: 'Hz', stage: 'live', tip: 'يشيل الطنين والدعسات وضربات الهوا. للرجال 70–90، للنساء 100–120.' },
      { k: 'deess', label: 'مزيل الصفير (س/ش)', min: 0, max: 100, step: 1, unit: '%', stage: 'pre', tip: 'يخفف حدّة السين والشين بدون ما يأثر على باقي الصوت.' },
    ]},
    { g: 'خامة الصوت', items: [
      { k: 'pitch', label: 'طبقة الصوت', min: -4, max: 4, step: 0.5, unit: 'نغمة', stage: 'pre', tip: 'بالسالب يصير الصوت أعمق وأفخم. خليك بين -1 و -2 لصوت طبيعي.' },
      { k: 'warmth', label: 'الفخامة والعمق (120Hz)', min: -6, max: 10, step: 0.5, unit: 'dB', stage: 'live', tip: 'يعطي “صدر” للصوت. الزيادة الكبيرة تخلّيه مكتوم.' },
      { k: 'mud', label: 'تنظيف الكتمة (300Hz)', min: -10, max: 4, step: 0.5, unit: 'dB', stage: 'live', tip: 'بالسالب يشيل صوت “الصندوق” والغرفة الصغيرة.' },
      { k: 'presence', label: 'الوضوح والحضور (3.5kHz)', min: -4, max: 10, step: 0.5, unit: 'dB', stage: 'live', tip: 'يخلّي الكلام مفهوم ويطلع قدّام الموسيقى. الزيادة الكبيرة تتعب الأذن.' },
      { k: 'air', label: 'اللمعة (10kHz)', min: -12, max: 8, step: 0.5, unit: 'dB', stage: 'live', tip: 'يعطي إحساس الاستوديو والنظافة.' },
      { k: 'lp', label: 'قص الطبقات العالية', min: 2000, max: 20000, step: 100, unit: 'Hz', stage: 'live', tip: '20000 = مطفأ. قلّله لتأثير راديو أو هاتف.' },
    ]},
    { g: 'الضغط والتوازن', items: [
      { k: 'compThr', label: 'عتبة الضغط', min: -40, max: 0, step: 1, unit: 'dB', stage: 'live', tip: 'كل ما نزلت أكثر صار الصوت متساوي ومليان أكثر.' },
      { k: 'compRatio', label: 'قوة الضغط', min: 1, max: 12, step: 0.5, unit: ':1', stage: 'live', tip: '2–4 طبيعي، 4–6 إذاعي وإعلاني.' },
    ]},
    { g: 'المساحة (صدى)', items: [
      { k: 'reverb', label: 'كمية الصدى', min: 0, max: 50, step: 1, unit: '%', stage: 'live', tip: 'للإعلانات خليه قليل (0–10%). الكثير يبعّد الصوت.' },
      { k: 'room', label: 'حجم المكان', min: 0.3, max: 4, step: 0.1, unit: 'ث', stage: 'live', tip: 'صغير = غرفة، كبير = قاعة.' },
    ]},
  ];

  const PRESETS = {
    'محسّن طبيعي':      { nr: 50, gate: -80, hp: 80,  deess: 35, pitch: 0,    warmth: 1,  mud: -2, presence: 2, air: 2,   lp: 20000, compThr: -20, compRatio: 3,   reverb: 0,  room: 1 },
    'إذاعي فخم':        { nr: 55, gate: -60, hp: 70,  deess: 45, pitch: -1,   warmth: 4,  mud: -3, presence: 3, air: 3,   lp: 20000, compThr: -24, compRatio: 4,   reverb: 0,  room: 1 },
    'عميق سينمائي':     { nr: 55, gate: -60, hp: 60,  deess: 45, pitch: -2.5, warmth: 6,  mud: -4, presence: 2, air: 2,   lp: 20000, compThr: -24, compRatio: 4,   reverb: 12, room: 2.2 },
    'إعلاني حماسي':     { nr: 55, gate: -58, hp: 100, deess: 50, pitch: 0,    warmth: 2,  mud: -3, presence: 5, air: 4,   lp: 20000, compThr: -26, compRatio: 5,   reverb: 5,  room: 0.8 },
    'دافئ (بودكاست)':   { nr: 45, gate: -80, hp: 80,  deess: 30, pitch: 0,    warmth: 3,  mud: -2, presence: 1, air: 0,   lp: 20000, compThr: -20, compRatio: 2.5, reverb: 0,  room: 1 },
    'واضح للموبايل':    { nr: 55, gate: -60, hp: 120, deess: 45, pitch: 0,    warmth: -1, mud: -3, presence: 4, air: 2,   lp: 20000, compThr: -22, compRatio: 3.5, reverb: 0,  room: 1 },
    'قاعة فخمة':        { nr: 55, gate: -60, hp: 70,  deess: 40, pitch: -1,   warmth: 4,  mud: -3, presence: 2, air: 3,   lp: 20000, compThr: -22, compRatio: 3.5, reverb: 25, room: 3 },
    'راديو قديم':       { nr: 50, gate: -80, hp: 350, deess: 20, pitch: 0,    warmth: -6, mud: 2,  presence: 7, air: -10, lp: 3800,  compThr: -28, compRatio: 6,   reverb: 0,  room: 1 },
    'بدون تأثيرات':     { nr: 0,  gate: -80, hp: 20,  deess: 0,  pitch: 0,    warmth: 0,  mud: 0,  presence: 0, air: 0,   lp: 20000, compThr: 0,   compRatio: 1,   reverb: 0,  room: 1 },
  };
  const TARGETS = { '-14': 'سوشيال ميديا (‎-14 LUFS)', '-16': 'بودكاست / آبل (‎-16)', '-19': 'هادئ (‎-19)', '-23': 'تلفزيون EBU (‎-23)' };

  const ALL = SCHEMA.flatMap(s => s.items);
  const PRE_KEYS = ALL.filter(i => i.stage === 'pre').map(i => i.k);
  const LS_T = 'vs_templates', LS_LAST = 'vs_last';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  let P = Object.assign({}, PRESETS['إذاعي فخم'], store.get(LS_LAST, {}));
  let target = store.get('vs_target', '-14');
  let exportStereo = true;

  // ---------- حالة الصوت ----------
  let ctx = null, nodes = null, sr = 48000;
  let orig = null, pre = null, preKey = '', fileName = 'voice';
  let src = null, playing = false, startedAt = 0, offset = 0, mode = 'pro';
  let normDb = 0, origNormDb = 0, lastLufs = null, origLufs = null;
  let busy = 0;

  function ensureCtx() {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ---------- سلسلة المعالجة (نفسها للمعاينة والتصدير) ----------
  function buildChain(c, withOut) {
    const n = {};
    n.input = c.createGain();
    n.hp = c.createBiquadFilter(); n.hp.type = 'highpass'; n.hp.Q.value = 0.707;
    n.warm = c.createBiquadFilter(); n.warm.type = 'lowshelf'; n.warm.frequency.value = 120;
    n.mud = c.createBiquadFilter(); n.mud.type = 'peaking'; n.mud.frequency.value = 300; n.mud.Q.value = 1.0;
    n.pres = c.createBiquadFilter(); n.pres.type = 'peaking'; n.pres.frequency.value = 3500; n.pres.Q.value = 0.9;
    n.air = c.createBiquadFilter(); n.air.type = 'highshelf'; n.air.frequency.value = 10000;
    n.lp = c.createBiquadFilter(); n.lp.type = 'lowpass'; n.lp.Q.value = 0.707;
    n.comp = c.createDynamicsCompressor(); n.comp.knee.value = 6; n.comp.attack.value = 0.008; n.comp.release.value = 0.15;
    n.makeup = c.createGain();
    n.dry = c.createGain(); n.wet = c.createGain(); n.conv = c.createConvolver(); n.conv.normalize = false;
    n.sum = c.createGain();
    n.input.connect(n.hp).connect(n.warm).connect(n.mud).connect(n.pres).connect(n.air).connect(n.lp).connect(n.comp).connect(n.makeup);
    n.makeup.connect(n.dry).connect(n.sum);
    n.makeup.connect(n.conv).connect(n.wet).connect(n.sum);
    n.out = n.sum;
    if (withOut) {
      n.norm = c.createGain();
      n.lim = c.createDynamicsCompressor();
      n.lim.threshold.value = -2; n.lim.knee.value = 0; n.lim.ratio.value = 20; n.lim.attack.value = 0.002; n.lim.release.value = 0.1;
      n.sum.connect(n.norm).connect(n.lim);
      n.out = n.lim;
    }
    applyParams(c, n, P, true);
    return n;
  }
  let irRoom = null, irBuf = null;
  function getIR(c) {
    if (!irBuf || irRoom !== P.room || irBuf.sampleRate !== c.sampleRate) {
      const data = DSP.makeImpulse(c.sampleRate, P.room);
      irBuf = c.createBuffer(1, data.length, c.sampleRate); irBuf.copyToChannel(data, 0); irRoom = P.room;
    }
    if (c === ctx) return irBuf;
    const b = c.createBuffer(1, irBuf.length, c.sampleRate); b.copyToChannel(irBuf.getChannelData(0), 0); return b;
  }
  function applyParams(c, n, p, force) {
    n.hp.frequency.value = p.hp;
    n.warm.gain.value = p.warmth; n.mud.gain.value = p.mud; n.pres.gain.value = p.presence; n.air.gain.value = p.air;
    n.lp.frequency.value = Math.min(p.lp, c.sampleRate / 2 - 100);
    n.comp.threshold.value = p.compThr; n.comp.ratio.value = p.compRatio;
    // تعويض تقريبي لانخفاض المستوى بسبب الضغط
    n.makeup.gain.value = Math.pow(10, (-p.compThr * (1 - 1 / p.compRatio) * 0.35) / 20);
    const wet = p.reverb / 100;
    n.dry.gain.value = 1 - wet * 0.5; n.wet.gain.value = wet * 1.6;
    if (force || irRoom !== p.room || !n.conv.buffer) n.conv.buffer = getIR(c);
  }

  // ---------- المعالجة المسبقة ----------
  function preSig() { return PRE_KEYS.map(k => P[k]).join('|'); }
  function setBusy(on, msg) {
    busy += on ? 1 : -1; if (busy < 0) busy = 0;
    $('#status').textContent = busy ? (msg || 'جارٍ المعالجة…') : '';
    $('#status').classList.toggle('on', !!busy);
  }
  const tick = () => new Promise(r => setTimeout(r, 30));
  async function computePre() {
    if (!orig) return;
    const sig = preSig(); if (sig === preKey && pre) return;
    setBusy(true, 'جارٍ تنظيف الصوت…'); await tick();
    let x = orig.getChannelData(0);
    x = DSP.denoise(x, sr, P.nr / 100);
    x = DSP.gate(x, sr, P.gate, -25);
    x = DSP.deess(x, sr, P.deess / 100);
    x = DSP.pitchShift(x, sr, P.pitch);
    const b = ensureCtx().createBuffer(1, x.length, sr); b.copyToChannel(x, 0);
    pre = b; preKey = sig;
    setBusy(false);
    drawWave();
    await measure();
    if (playing && mode === 'pro') restart();
  }

  async function renderChain(buffer, withOut, gainDb) {
    const oc = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
    const n = buildChain(oc, withOut);
    if (withOut) n.norm.gain.value = Math.pow(10, gainDb / 20);
    const s = oc.createBufferSource(); s.buffer = buffer; s.connect(n.input); n.out.connect(oc.destination); s.start();
    const r = await oc.startRendering();
    return r.getChannelData(0);
  }
  function targetMono() { return parseFloat(target) - (exportStereo ? 3.01 : 0); }
  let measureSeq = 0;
  async function measure() {
    if (!pre) return;
    const id = ++measureSeq;
    const y = await renderChain(pre, false, 0);
    if (id !== measureSeq) return;
    lastLufs = DSP.lufs(y, sr);
    normDb = Math.max(-30, Math.min(30, targetMono() - lastLufs));
    if (nodes) nodes.norm.gain.setTargetAtTime(Math.pow(10, normDb / 20), ctx.currentTime, 0.05);
    updateMeters();
  }
  let liveT = null;
  function scheduleMeasure() { clearTimeout(liveT); liveT = setTimeout(measure, 350); }
  let preT = null;
  function schedulePre() { clearTimeout(preT); preT = setTimeout(computePre, 450); }

  function updateMeters() {
    const add = exportStereo ? 3.01 : 0;
    $('#mIn').textContent = origLufs == null ? '—' : (origLufs + add).toFixed(1);
    $('#mOut').textContent = lastLufs == null ? '—' : target;
    $('#mGain').textContent = lastLufs == null ? '—' : (normDb >= 0 ? '+' : '') + normDb.toFixed(1) + ' dB';
  }

  // ---------- التشغيل ----------
  function setupLive() {
    ensureCtx();
    if (nodes) return;
    nodes = buildChain(ctx, true);
    nodes.ab = ctx.createGain();
    nodes.an = ctx.createAnalyser(); nodes.an.fftSize = 2048; nodes.an.smoothingTimeConstant = 0.8;
    nodes.out.connect(nodes.an);
    nodes.ab.connect(nodes.an);
    nodes.an.connect(ctx.destination);
    nodes.norm.gain.value = Math.pow(10, normDb / 20);
    drawSpectrum();
  }
  function curBuffer() { return mode === 'pro' ? (pre || orig) : orig; }
  function position() { return playing ? offset + (ctx.currentTime - startedAt) : offset; }
  function play(at) {
    const b = curBuffer(); if (!b) return;
    setupLive();
    stopSrc();
    if (at != null) offset = at;
    if (offset >= b.duration) offset = 0;
    src = ctx.createBufferSource(); src.buffer = b;
    if (mode === 'pro') src.connect(nodes.input);
    else { nodes.ab.gain.value = Math.pow(10, origNormDb / 20); src.connect(nodes.ab); }
    src.onended = () => { if (src && src._me === mySrc) { playing = false; offset = 0; uiPlay(); } };
    const mySrc = {}; src._me = mySrc;
    src.start(0, offset); startedAt = ctx.currentTime; playing = true; uiPlay();
  }
  function stopSrc() { if (src) { src.onended = null; try { src.stop(); } catch (e) {} src.disconnect(); src = null; } }
  function pause() { if (!playing) return; offset = position(); stopSrc(); playing = false; uiPlay(); }
  function restart() { const p = position(); play(p); }
  function uiPlay() { $('#play').textContent = playing ? '⏸ إيقاف مؤقت' : '▶ تشغيل'; }

  // ---------- الرسم ----------
  function drawWave() {
    const cv = $('#wave'), b = curBuffer(); if (!b) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth * dpr, Hh = cv.clientHeight * dpr;
    cv.width = W; cv.height = Hh;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, W, Hh);
    const d = b.getChannelData(0), step = Math.max(1, Math.floor(d.length / W));
    g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(mode === 'pro' ? '--accent' : '--muted');
    for (let x = 0; x < W; x++) {
      let mn = 1, mx = -1; const s = x * step;
      for (let i = 0; i < step; i += 4) { const v = d[s + i] || 0; if (v < mn) mn = v; if (v > mx) mx = v; }
      g.fillRect(x, (1 - mx) * Hh / 2, 1, Math.max(1, (mx - mn) * Hh / 2));
    }
    cv._img = g.getImageData(0, 0, W, Hh);
  }
  function drawHead() {
    const cv = $('#wave'), b = curBuffer();
    if (b && cv._img) {
      const g = cv.getContext('2d'); g.putImageData(cv._img, 0, 0);
      const x = (position() / b.duration) * cv.width;
      g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg'); g.fillRect(x - 1, 0, 2 * (window.devicePixelRatio || 1), cv.height);
      $('#time').textContent = fmt(position()) + ' / ' + fmt(b.duration);
    }
    requestAnimationFrame(drawHead);
  }
  function fmt(t) { t = Math.max(0, t); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
  function drawSpectrum() {
    const cv = $('#spec'), g = cv.getContext('2d'), an = nodes.an, arr = new Uint8Array(an.frequencyBinCount);
    (function loop() {
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== cv.clientWidth * dpr) { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; }
      an.getByteFrequencyData(arr);
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent2');
      const bars = 64, nyq = ctx.sampleRate / 2;
      for (let i = 0; i < bars; i++) {
        const f0 = 40 * Math.pow(nyq / 40, i / bars), f1 = 40 * Math.pow(nyq / 40, (i + 1) / bars);
        const a = Math.floor(f0 / nyq * arr.length), z = Math.max(a + 1, Math.floor(f1 / nyq * arr.length));
        let m = 0; for (let k = a; k < z; k++) m = Math.max(m, arr[k]);
        const h = m / 255 * cv.height, w = cv.width / bars;
        g.fillRect(i * w + 1, cv.height - h, w - 2, h);
      }
      requestAnimationFrame(loop);
    })();
  }

  // ---------- الواجهة ----------
  function fmtVal(it, v) {
    if (it.k === 'gate' && v <= -79) return 'مطفأ';
    if (it.k === 'lp' && v >= 20000) return 'مطفأ';
    if (it.k === 'hp' && v <= 20) return 'مطفأ';
    return '<bdi>' + (it.k === 'pitch' && v > 0 ? '+' : '') + v + '</bdi> ' + it.unit;
  }
  function buildControls() {
    const host = $('#controls'); host.innerHTML = '';
    SCHEMA.forEach(sec => {
      const d = document.createElement('details'); d.className = 'card'; d.open = true;
      d.innerHTML = '<summary>' + sec.g + '</summary>';
      sec.items.forEach(it => {
        const row = document.createElement('div'); row.className = 'ctl';
        row.innerHTML = `<div class="ctl-h"><label for="c_${it.k}">${it.label}</label><output id="o_${it.k}"></output></div>
          <input type="range" id="c_${it.k}" min="${it.min}" max="${it.max}" step="${it.step}">
          <div class="tip">${it.tip}</div>`;
        d.appendChild(row);
        const inp = row.querySelector('input');
        inp.addEventListener('input', () => {
          P[it.k] = parseFloat(inp.value); row.querySelector('output').innerHTML = fmtVal(it, P[it.k]);
          store.set(LS_LAST, P); $('#preset').value = '';
          onParam(it);
        });
      });
      host.appendChild(d);
    });
    syncControls();
  }
  function syncControls() {
    ALL.forEach(it => { const i = $('#c_' + it.k); i.value = P[it.k]; $('#o_' + it.k).innerHTML = fmtVal(it, P[it.k]); });
  }
  function onParam(it) {
    if (it.stage === 'pre') schedulePre();
    else { if (nodes) applyParams(ctx, nodes, P, false); scheduleMeasure(); }
  }
  function applyAll(p) {
    P = Object.assign({}, P, p); store.set(LS_LAST, P); syncControls();
    if (nodes) applyParams(ctx, nodes, P, true);
    schedulePre(); scheduleMeasure();
  }

  function fillPresets() {
    const sel = $('#preset'), user = store.get(LS_T, {});
    sel.innerHTML = '<option value="">— اختر خامة / قالب —</option>' +
      '<optgroup label="خامات جاهزة">' + Object.keys(PRESETS).map(k => `<option value="p:${k}">${k}</option>`).join('') + '</optgroup>' +
      (Object.keys(user).length ? '<optgroup label="قوالبي">' + Object.keys(user).map(k => `<option value="u:${k}">${k}</option>`).join('') + '</optgroup>' : '');
  }

  async function loadFile(f) {
    if (!f) return;
    fileName = f.name.replace(/\.[^.]+$/, '') || 'voice';
    ensureCtx(); pause(); offset = 0;
    setBusy(true, 'جارٍ قراءة الملف…');
    try {
      const ab = await f.arrayBuffer();
      const dec = await ctx.decodeAudioData(ab);
      sr = dec.sampleRate;
      const mono = new Float32Array(dec.length);
      for (let c = 0; c < dec.numberOfChannels; c++) { const d = dec.getChannelData(c); for (let i = 0; i < d.length; i++) mono[i] += d[i] / dec.numberOfChannels; }
      orig = ctx.createBuffer(1, mono.length, sr); orig.copyToChannel(mono, 0);
      origLufs = DSP.lufs(mono, sr);
      origNormDb = Math.max(-30, Math.min(30, targetMono() - origLufs));
      pre = null; preKey = '';
      $('#fname').textContent = f.name + ' — ' + fmt(dec.duration);
      document.body.classList.add('loaded');
      setBusy(false);
      drawWave();
      await computePre();
    } catch (e) {
      setBusy(false);
      alert('ما قدرت أقرأ الملف. جرّب صيغة mp3 أو wav أو m4a.\n' + e.message);
    }
  }

  async function doExport(fmtKind) {
    if (!orig) return;
    await computePre();
    setBusy(true, 'جارٍ التصدير…'); await tick();
    try {
      let y = await renderChain(pre, true, normDb);
      // تصحيح نهائي دقيق للارتفاع + محدد للذروة
      const l = DSP.lufs(y, sr), fix = targetMono() - l;
      if (Math.abs(fix) > 0.1) { const g = Math.pow(10, fix / 20); y = y.map(v => v * g); }
      y = DSP.limit(y, sr, -1.5);
      const finalL = DSP.lufs(y, sr) + (exportStereo ? 3.01 : 0);
      const ch = exportStereo ? [y, y] : [y];
      let blob, ext;
      if (fmtKind === 'mp3') {
        if (!window.lamejs) throw new Error('مكتبة MP3 ما تحمّلت (تحتاج إنترنت). صدّر WAV بدلاً منها.');
        const enc = new lamejs.Mp3Encoder(ch.length, sr, 192), parts = [], L16 = ch.map(DSP.toInt16), B = 1152;
        for (let i = 0; i < L16[0].length; i += B) {
          const a = L16[0].subarray(i, i + B), b = L16[1] ? L16[1].subarray(i, i + B) : undefined;
          const o = b ? enc.encodeBuffer(a, b) : enc.encodeBuffer(a); if (o.length) parts.push(new Uint8Array(o));
        }
        const e = enc.flush(); if (e.length) parts.push(new Uint8Array(e));
        blob = new Blob(parts, { type: 'audio/mpeg' }); ext = 'mp3';
      } else { blob = DSP.encodeWav(ch, sr); ext = 'wav'; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = fileName + '_pro.' + ext;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      $('#done').innerHTML = `✔ تم التصدير: <bdi>${finalL.toFixed(1)} LUFS</bdi>، الذروة <bdi>${DSP.peakDb(y).toFixed(1)} dB</bdi>`;
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  // ---------- ربط الأحداث ----------
  function init() {
    buildControls(); fillPresets();
    const tsel = $('#target');
    tsel.innerHTML = Object.entries(TARGETS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    tsel.value = target;
    tsel.onchange = () => {
      target = tsel.value; store.set('vs_target', target);
      if (origLufs != null) origNormDb = Math.max(-30, Math.min(30, targetMono() - origLufs));
      measure();
    };
    $('#file').onchange = e => loadFile(e.target.files[0]);
    const drop = $('#drop');
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
    $('#play').onclick = () => { ensureCtx(); playing ? pause() : play(); };
    $('#stop').onclick = () => { pause(); offset = 0; };
    document.querySelectorAll('[name=ab]').forEach(r => r.onchange = () => {
      mode = r.value; drawWave(); if (playing) restart();
    });
    $('#wave').onclick = e => {
      const b = curBuffer(); if (!b) return;
      const rect = e.target.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      const t = frac * b.duration;
      if (playing) play(t); else offset = t;
    };
    $('#preset').onchange = e => {
      const v = e.target.value; if (!v) return;
      const p = v.startsWith('p:') ? PRESETS[v.slice(2)] : store.get(LS_T, {})[v.slice(2)];
      if (p) applyAll(p);
      e.target.value = v;
    };
    $('#save').onclick = () => {
      const name = prompt('اسم القالب:', 'قالبي ' + (Object.keys(store.get(LS_T, {})).length + 1));
      if (!name) return;
      const t = store.get(LS_T, {}); t[name] = Object.assign({}, P); store.set(LS_T, t); fillPresets(); $('#preset').value = 'u:' + name;
    };
    $('#del').onclick = () => {
      const v = $('#preset').value; if (!v.startsWith('u:')) return alert('اختر قالب من «قوالبي» لحذفه.');
      if (!confirm('حذف القالب «' + v.slice(2) + '»؟')) return;
      const t = store.get(LS_T, {}); delete t[v.slice(2)]; store.set(LS_T, t); fillPresets();
    };
    $('#exportT').onclick = () => {
      const data = { templates: store.get(LS_T, {}), current: P, target };
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = 'voice-templates.json'; a.click();
    };
    $('#importT').onchange = async e => {
      try {
        const d = JSON.parse(await e.target.files[0].text());
        const t = Object.assign(store.get(LS_T, {}), d.templates || {}); store.set(LS_T, t); fillPresets();
        if (d.current) applyAll(d.current);
        alert('تم استيراد ' + Object.keys(d.templates || {}).length + ' قالب.');
      } catch (er) { alert('ملف غير صالح'); }
      e.target.value = '';
    };
    $('#wav').onclick = () => doExport('wav');
    $('#mp3').onclick = () => doExport('mp3');
    $('#stereo').onchange = e => { exportStereo = e.target.checked; if (origLufs != null) origNormDb = Math.max(-30, Math.min(30, targetMono() - origLufs)); measure(); };
    window.addEventListener('resize', drawWave);
    requestAnimationFrame(drawHead);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
