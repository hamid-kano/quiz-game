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

  // ---------- إعدادات الدمج (موسيقى + فيديو) ----------
  const MIX = [
    { k: 'musicVol', label: 'مستوى الموسيقى بين الكلام', min: -30, max: 0, step: 1, unit: 'dB', show: 'music', tip: 'نسبةً لصوتك. ‎-12 مناسب لأغلب الإعلانات.' },
    { k: 'duck', label: 'خفض الموسيقى وقت الكلام', min: 0, max: 24, step: 1, unit: 'dB', show: 'music', tip: 'الموسيقى بتوطى لحالها لما تحكي وبترجع لما تسكت. 8–12 طبيعي.' },
    { k: 'musicStart', label: 'ابدأ الموسيقى من الثانية', min: 0, max: 180, step: 0.5, unit: 'ث', show: 'music', tip: 'لتتخطى مقدمة المقطع الموسيقي.' },
    { k: 'intro', label: 'مقدمة موسيقية قبل الكلام', min: 0, max: 8, step: 0.5, unit: 'ث', show: 'music-novideo', tip: 'كم ثانية موسيقى قبل ما تبلّش تحكي.' },
    { k: 'outro', label: 'خاتمة موسيقية بعد الكلام', min: 0, max: 10, step: 0.5, unit: 'ث', show: 'music-novideo', tip: 'كم ثانية تكمل الموسيقى بعد آخر كلمة.' },
    { k: 'fadeOut', label: 'تلاشي الموسيقى بالنهاية', min: 0, max: 6, step: 0.5, unit: 'ث', show: 'music', tip: 'الموسيقى بتختفي تدريجياً بآخر المقطع.' },
    { k: 'voiceAt', label: 'بداية صوتك بالفيديو', min: 0, max: 60, step: 0.1, unit: 'ث', show: 'video', tip: 'إذا بدك الصوت يبلّش بعد لحظة معيّنة من الفيديو.' },
    { k: 'videoVol', label: 'صوت الفيديو الأصلي', min: -40, max: 0, step: 1, unit: 'dB', show: 'video', tip: '‎-40 = مكتوم. ارفعه إذا بدك يبقى صوت المكان خفيف بالخلفية.' },
  ];
  const MIX_DEF = { musicVol: -12, duck: 10, musicStart: 0, intro: 1.5, outro: 2.5, fadeOut: 2, voiceAt: 0, videoVol: -40 };

  const ALL = SCHEMA.flatMap(s => s.items);
  const PRE_KEYS = ALL.filter(i => i.stage === 'pre').map(i => i.k);
  const LS_T = 'vs_templates', LS_LAST = 'vs_last', LS_MIX = 'vs_mix';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  let P = Object.assign({}, PRESETS['إذاعي فخم'], store.get(LS_LAST, {}));
  let M = Object.assign({}, MIX_DEF, store.get(LS_MIX, {}), { voiceAt: 0 });
  let target = store.get('vs_target', '-14');
  let exportStereo = true;

  // ---------- الحالة ----------
  let ctx = null, nodes = null, sr = 48000;
  let orig = null, pre = null, preKey = '', fileName = 'voice';
  let music = null;   // { chs:[L,R], lufs, name }
  let video = null;   // { file, url, dur, chs|null, lufs, name }
  let bed = null;     // AudioBuffer ستيريو: موسيقى + صوت الفيديو بعد الخفض
  let vsrc = null, bsrc = null, playing = false, startedAt = 0, offset = 0, mode = 'pro';
  let normDb = 0, origNormDb = 0, lastLufs = null, origLufs = null;
  let busy = 0;

  function ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ---------- سلسلة معالجة الصوت (نفسها للمعاينة والتصدير) ----------
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
    n.makeup.gain.value = Math.pow(10, (-p.compThr * (1 - 1 / p.compRatio) * 0.35) / 20);
    const wet = p.reverb / 100;
    n.dry.gain.value = 1 - wet * 0.5; n.wet.gain.value = wet * 1.6;
    if (force || irRoom !== p.room || !n.conv.buffer) n.conv.buffer = getIR(c);
  }

  // ---------- الخط الزمني ----------
  function timeline() {
    const vLen = (pre || orig) ? (pre || orig).duration : 0;
    if (video) return { total: video.dur, vStart: Math.min(M.voiceAt, video.dur), vLen };
    if (music) return { total: M.intro + vLen + M.outro, vStart: M.intro, vLen };
    return { total: vLen, vStart: 0, vLen };
  }

  // ---------- المعالجة المسبقة للصوت ----------
  function preSig() { return PRE_KEYS.map(k => P[k]).join('|'); }
  function setBusy(on, msg) {
    busy += on ? 1 : -1; if (busy < 0) busy = 0;
    if (on && msg) $('#status').textContent = msg;
    $('#status').classList.toggle('on', !!busy);
  }
  function status(msg) { $('#status').textContent = msg; }
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
    await measure();
    buildBed();
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
  // الصوت الأحادي بيتسمع بالسماعتين، فارتفاعه بالستيريو أعلى بـ 3dB
  function voiceTarget() { return parseFloat(target) - 3.01; }
  let measureSeq = 0;
  async function measure() {
    if (!pre) return;
    const id = ++measureSeq;
    const y = await renderChain(pre, false, 0);
    if (id !== measureSeq) return;
    lastLufs = DSP.lufs(y, sr);
    normDb = Math.max(-30, Math.min(30, voiceTarget() - lastLufs));
    if (nodes) nodes.norm.gain.setTargetAtTime(Math.pow(10, normDb / 20), ctx.currentTime, 0.05);
    updateMeters();
  }
  let liveT = null; function scheduleMeasure() { clearTimeout(liveT); liveT = setTimeout(measure, 350); }
  let preT = null; function schedulePre() { clearTimeout(preT); preT = setTimeout(computePre, 450); }
  let bedT = null; function scheduleBed() { clearTimeout(bedT); bedT = setTimeout(() => { buildBed(); if (playing) restart(); }, 300); }

  // ---------- طبقة الخلفية: موسيقى + صوت الفيديو، مع خفض تلقائي ----------
  function buildBed() {
    const useVid = video && video.chs && M.videoVol > -40;
    if (!orig || (!music && !useVid)) { bed = null; drawWave(); return; }
    const tl = timeline(), N = Math.max(1, Math.round(tl.total * sr));
    const L = new Float32Array(N), R = new Float32Array(N);
    const voice = (pre || orig).getChannelData(0), vs = Math.round(tl.vStart * sr);
    const tgt = parseFloat(target);
    if (music) {
      const duck = DSP.duckCurve(voice, sr, N, vs, M.duck);
      const g = Math.pow(10, (tgt + M.musicVol - music.lufs) / 20);
      const [mL, mR] = music.chs, ml = mL.length;
      const st = Math.min(ml - 1, Math.round(M.musicStart * sr));
      const fi = Math.round(0.8 * sr), fo = Math.round(M.fadeOut * sr);
      for (let i = 0; i < N; i++) {
        const j = (st + i) % ml;
        let f = 1;
        if (i < fi) f = i / fi;
        if (fo && i > N - fo) f *= Math.max(0, (N - i) / fo);
        const k = g * f * duck[i];
        L[i] += mL[j] * k; R[i] += mR[j] * k;
      }
    }
    if (useVid) {
      const duck = DSP.duckCurve(voice, sr, N, vs, 10);
      const g = Math.pow(10, (tgt + M.videoVol - video.lufs) / 20);
      const [a, b] = video.chs, n = Math.min(N, a.length);
      for (let i = 0; i < n; i++) { const k = g * duck[i]; L[i] += a[i] * k; R[i] += b[i] * k; }
    }
    const buf = ensureCtx().createBuffer(2, N, sr);
    buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
    bed = buf;
    drawWave();
  }

  function updateMeters() {
    $('#mIn').textContent = origLufs == null ? '—' : (origLufs + 3.01).toFixed(1);
    $('#mOut').textContent = lastLufs == null ? '—' : target;
    $('#mGain').textContent = lastLufs == null ? '—' : (normDb >= 0 ? '+' : '') + normDb.toFixed(1) + ' dB';
  }

  // ---------- التشغيل ----------
  function setupLive() {
    ensureCtx();
    if (nodes) return;
    nodes = buildChain(ctx, true);
    nodes.ab = ctx.createGain();
    nodes.bed = ctx.createGain();
    nodes.an = ctx.createAnalyser(); nodes.an.fftSize = 2048; nodes.an.smoothingTimeConstant = 0.8;
    nodes.out.connect(nodes.an); nodes.ab.connect(nodes.an); nodes.bed.connect(nodes.an);
    nodes.an.connect(ctx.destination);
    nodes.norm.gain.value = Math.pow(10, normDb / 20);
    drawSpectrum();
  }
  function voiceBuffer() { return mode === 'pro' ? (pre || orig) : orig; }
  function position() { return playing ? offset + Math.max(0, ctx.currentTime - startedAt) : offset; }
  function stopSrc() {
    for (const s of [vsrc, bsrc]) if (s) { try { s.stop(); } catch (e) {} s.disconnect(); }
    vsrc = bsrc = null;
    const v = $('#vid'); if (video && !v.paused) v.pause();
  }
  function play(at) {
    const vb = voiceBuffer(); if (!vb) return;
    setupLive(); stopSrc();
    const tl = timeline();
    if (at != null) offset = at;
    if (offset >= tl.total - 0.05) offset = 0;
    const now = ctx.currentTime + 0.06, t = offset;
    const vOff = t - tl.vStart;
    if (vOff < vb.duration) {
      vsrc = ctx.createBufferSource(); vsrc.buffer = vb;
      if (mode === 'pro') vsrc.connect(nodes.input);
      else { nodes.ab.gain.value = Math.pow(10, origNormDb / 20); vsrc.connect(nodes.ab); }
      vsrc.start(now + Math.max(0, -vOff), Math.max(0, vOff));
    }
    if (bed && t < bed.duration) {
      bsrc = ctx.createBufferSource(); bsrc.buffer = bed; bsrc.connect(nodes.bed); bsrc.start(now, t);
    }
    if (video) { const v = $('#vid'); v.currentTime = t; v.play().catch(() => {}); }
    startedAt = now; playing = true; uiPlay();
  }
  function pause() { if (!playing) return; offset = position(); stopSrc(); playing = false; uiPlay(); }
  function restart() { play(position()); }
  function uiPlay() { $('#play').textContent = playing ? '⏸ إيقاف مؤقت' : '▶ تشغيل'; }
  function seek(t) {
    if (playing) play(t); else { offset = t; if (video) $('#vid').currentTime = t; }
  }

  // ---------- الرسم ----------
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v);
  function drawWave() {
    const cv = $('#wave'); if (!orig) return;
    const dpr = window.devicePixelRatio || 1, W = Math.max(1, cv.clientWidth * dpr), Hh = Math.max(1, cv.clientHeight * dpr);
    cv.width = W; cv.height = Hh;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, W, Hh);
    const tl = timeline(), spp = tl.total * sr / W;
    const lane = (d, startSec, color, scale) => {
      g.fillStyle = color;
      const x0 = Math.floor(startSec * sr / spp), x1 = Math.min(W, Math.ceil((startSec * sr + d.length) / spp));
      for (let x = Math.max(0, x0); x < x1; x++) {
        let mn = 0, mx = 0; const s = Math.floor(x * spp - startSec * sr), e = Math.floor((x + 1) * spp - startSec * sr);
        for (let i = Math.max(0, s); i < Math.min(d.length, e); i += 4) { const v = d[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
        g.fillRect(x, (1 - mx * scale) * Hh / 2, 1, Math.max(1, (mx - mn) * scale * Hh / 2));
      }
    };
    if (bed) lane(bed.getChannelData(0), 0, css('--accent2') + '99', 3);
    const vb = voiceBuffer();
    lane(vb.getChannelData(0), tl.vStart, mode === 'pro' ? css('--accent') : css('--muted'), 1);
    cv._img = g.getImageData(0, 0, W, Hh);
  }
  function loop() {
    const cv = $('#wave');
    if (orig && cv._img) {
      const tl = timeline();
      if (playing && position() >= tl.total) { stopSrc(); playing = false; offset = 0; uiPlay(); }
      const pos = position();
      const g = cv.getContext('2d'); g.putImageData(cv._img, 0, 0);
      g.fillStyle = css('--fg'); g.fillRect(pos / tl.total * cv.width - 1, 0, 2 * (window.devicePixelRatio || 1), cv.height);
      $('#time').textContent = fmt(pos) + ' / ' + fmt(tl.total);
      if (video && playing) { const v = $('#vid'); if (Math.abs(v.currentTime - pos) > 0.25) v.currentTime = pos; }
    }
    requestAnimationFrame(loop);
  }
  function fmt(t) { t = Math.max(0, t); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
  function drawSpectrum() {
    const cv = $('#spec'), g = cv.getContext('2d'), an = nodes.an, arr = new Uint8Array(an.frequencyBinCount);
    (function l() {
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== cv.clientWidth * dpr) { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; }
      an.getByteFrequencyData(arr);
      g.clearRect(0, 0, cv.width, cv.height);
      g.fillStyle = css('--accent2');
      const bars = 64, nyq = ctx.sampleRate / 2;
      for (let i = 0; i < bars; i++) {
        const f0 = 40 * Math.pow(nyq / 40, i / bars), f1 = 40 * Math.pow(nyq / 40, (i + 1) / bars);
        const a = Math.floor(f0 / nyq * arr.length), z = Math.max(a + 1, Math.floor(f1 / nyq * arr.length));
        let m = 0; for (let k = a; k < z; k++) m = Math.max(m, arr[k]);
        const h = m / 255 * cv.height, w = cv.width / bars;
        g.fillRect(i * w + 1, cv.height - h, w - 2, h);
      }
      requestAnimationFrame(l);
    })();
  }

  // ---------- عناصر التحكم ----------
  function fmtVal(it, v) {
    if (it.k === 'gate' && v <= -79) return 'مطفأ';
    if (it.k === 'lp' && v >= 20000) return 'مطفأ';
    if (it.k === 'hp' && v <= 20) return 'مطفأ';
    if (it.k === 'videoVol' && v <= -40) return 'مكتوم';
    if (it.k === 'duck' && v <= 0) return 'مطفأ';
    return '<bdi>' + (it.k === 'pitch' && v > 0 ? '+' : '') + v + '</bdi> ' + it.unit;
  }
  function ctlRow(it, obj, onChange) {
    const row = document.createElement('div'); row.className = 'ctl'; row.dataset.k = it.k;
    row.innerHTML = `<div class="ctl-h"><label for="c_${it.k}">${it.label}</label><output id="o_${it.k}"></output></div>
      <input type="range" id="c_${it.k}" min="${it.min}" max="${it.max}" step="${it.step}">
      <div class="tip">${it.tip}</div>`;
    const inp = row.querySelector('input');
    inp.addEventListener('input', () => {
      obj()[it.k] = parseFloat(inp.value); row.querySelector('output').innerHTML = fmtVal(it, parseFloat(inp.value));
      onChange(it);
    });
    return row;
  }
  function buildControls() {
    const host = $('#controls'); host.innerHTML = '';
    SCHEMA.forEach(sec => {
      const d = document.createElement('details'); d.className = 'card'; d.open = true;
      d.innerHTML = '<summary>' + sec.g + '</summary>';
      sec.items.forEach(it => d.appendChild(ctlRow(it, () => P, it2 => {
        store.set(LS_LAST, P); $('#preset').value = '';
        if (it2.stage === 'pre') schedulePre();
        else { if (nodes) applyParams(ctx, nodes, P, false); scheduleMeasure(); }
      })));
      host.appendChild(d);
    });
    const mh = $('#mixCtl');
    MIX.forEach(it => mh.appendChild(ctlRow(it, () => M, () => { store.set(LS_MIX, M); scheduleBed(); if (it.k === 'voiceAt' || it.k === 'intro' || it.k === 'outro') drawWave(); })));
    syncControls();
  }
  function syncControls() {
    ALL.forEach(it => { $('#c_' + it.k).value = P[it.k]; $('#o_' + it.k).innerHTML = fmtVal(it, P[it.k]); });
    MIX.forEach(it => { $('#c_' + it.k).value = M[it.k]; $('#o_' + it.k).innerHTML = fmtVal(it, M[it.k]); });
  }
  function updateMixUI() {
    const has = { music: !!music, video: !!video, 'music-novideo': !!music && !video };
    MIX.forEach(it => { document.querySelector(`.ctl[data-k="${it.k}"]`).style.display = has[it.show] ? '' : 'none'; });
    $('#mixHint').style.display = (music || video) ? 'none' : '';
    $('#musicName').textContent = music ? '🎵 ' + music.name : '';
    $('#videoName').textContent = video ? '🎬 ' + video.name + ' — ' + fmt(video.dur) : '';
    $('#rmMusic').style.display = music ? '' : 'none';
    $('#rmVideo').style.display = video ? '' : 'none';
    $('#vidWrap').style.display = video ? '' : 'none';
    $('#mp4').style.display = video ? '' : 'none';
    if (video) { const c = $('#c_voiceAt'); c.max = Math.max(0.1, Math.floor(video.dur * 10) / 10); }
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

  // ---------- تحميل الملفات ----------
  async function decodeFile(f) {
    const dec = await ensureCtx().decodeAudioData(await f.arrayBuffer());
    const L = dec.getChannelData(0), R = dec.numberOfChannels > 1 ? dec.getChannelData(1) : L;
    return { dec, L: new Float32Array(L), R: new Float32Array(R) };
  }
  async function loadVoice(f) {
    if (!f) return;
    fileName = f.name.replace(/\.[^.]+$/, '') || 'voice';
    ensureCtx(); pause(); offset = 0;
    setBusy(true, 'جارٍ قراءة الملف…');
    try {
      const { dec, L, R } = await decodeFile(f);
      sr = dec.sampleRate;
      const mono = new Float32Array(L.length);
      for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) / 2;
      orig = ctx.createBuffer(1, mono.length, sr); orig.copyToChannel(mono, 0);
      origLufs = DSP.lufs(mono, sr);
      origNormDb = Math.max(-30, Math.min(30, voiceTarget() - origLufs));
      pre = null; preKey = '';
      $('#fname').textContent = f.name + ' — ' + fmt(dec.duration);
      document.body.classList.add('loaded');
      setBusy(false);
      await computePre();
    } catch (e) {
      setBusy(false);
      alert('ما قدرت أقرأ الملف. جرّب صيغة mp3 أو wav أو m4a.\n' + e.message);
    }
  }
  async function loadMusic(f) {
    if (!f) return;
    pause(); setBusy(true, 'جارٍ قراءة الموسيقى…');
    try {
      const { L, R } = await decodeFile(f);
      music = { chs: [L, R], lufs: DSP.lufsCh([L, R], sr), name: f.name };
      if (!isFinite(music.lufs) || music.lufs < -60) music.lufs = -20;
      updateMixUI(); buildBed();
    } catch (e) { alert('ما قدرت أقرأ ملف الموسيقى.\n' + e.message); }
    setBusy(false);
  }
  async function loadVideo(f) {
    if (!f) return;
    pause(); setBusy(true, 'جارٍ قراءة الفيديو…');
    try {
      const v = $('#vid');
      if (video && video.url) URL.revokeObjectURL(video.url);
      const url = URL.createObjectURL(f);
      v.src = url;
      await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('صيغة الفيديو غير مدعومة بالمتصفح')); });
      let chs = null, lufs = -20;
      try { const d = await decodeFile(f); chs = [d.L, d.R]; lufs = DSP.lufsCh(chs, sr); if (!isFinite(lufs) || lufs < -60) lufs = -20; } catch (e) { /* فيديو بدون صوت */ }
      video = { file: f, url, dur: v.duration, chs, lufs, name: f.name };
      M.voiceAt = Math.min(M.voiceAt, Math.max(0, v.duration - 0.1));
      updateMixUI(); syncControls(); buildBed();
      const tl = timeline();
      if (tl.vStart + tl.vLen > tl.total + 0.05) $('#done').textContent = '⚠ صوتك أطول من الفيديو، فرح ينقص آخره.';
    } catch (e) { alert('ما قدرت أفتح الفيديو.\n' + e.message); video = null; updateMixUI(); }
    setBusy(false);
  }

  // ---------- التصدير ----------
  async function renderMix(stereo) {
    await computePre();
    const y = await renderChain(pre, true, normDb);
    const tl = timeline(), N = Math.max(1, Math.round(tl.total * sr)), vs = Math.round(tl.vStart * sr);
    let L = new Float32Array(N), R = new Float32Array(N);
    for (let i = 0; i < y.length && vs + i < N; i++) { L[vs + i] = y[i]; R[vs + i] = y[i]; }
    if (bed) { const a = bed.getChannelData(0), b = bed.getChannelData(1); for (let i = 0; i < Math.min(N, a.length); i++) { L[i] += a[i]; R[i] += b[i]; } }
    let chs = stereo ? [L, R] : [L.map((v, i) => (v + R[i]) / 2)];
    const fix = parseFloat(target) - DSP.lufsCh(chs, sr);
    if (Math.abs(fix) > 0.1) { const g = Math.pow(10, fix / 20); chs = chs.map(c => c.map(v => v * g)); }
    chs = DSP.limitCh(chs, sr, -1.5);
    return chs;
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  function report(chs) {
    let p = -100; chs.forEach(c => { p = Math.max(p, DSP.peakDb(c)); });
    return `<bdi>${DSP.lufsCh(chs, sr).toFixed(1)} LUFS</bdi>، الذروة <bdi>${p.toFixed(1)} dB</bdi>`;
  }
  async function doExport(kind) {
    if (!orig) return;
    setBusy(true, 'جارٍ التصدير…'); await tick();
    try {
      const chs = await renderMix(exportStereo);
      let blob, ext;
      if (kind === 'mp3') {
        if (!window.lamejs) throw new Error('مكتبة MP3 ما تحمّلت. صدّر WAV بدلاً منها.');
        const enc = new lamejs.Mp3Encoder(chs.length, sr, 192), parts = [], I = chs.map(DSP.toInt16), B = 1152;
        for (let i = 0; i < I[0].length; i += B) {
          const a = I[0].subarray(i, i + B), b = I[1] ? I[1].subarray(i, i + B) : undefined;
          const o = b ? enc.encodeBuffer(a, b) : enc.encodeBuffer(a); if (o.length) parts.push(new Uint8Array(o));
        }
        const e = enc.flush(); if (e.length) parts.push(new Uint8Array(e));
        blob = new Blob(parts, { type: 'audio/mpeg' }); ext = 'mp3';
      } else { blob = DSP.encodeWav(chs, sr); ext = 'wav'; }
      download(blob, fileName + '_pro.' + ext);
      $('#done').innerHTML = '✔ تم التصدير: ' + report(chs);
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  let ff = null;
  async function loadFF() {
    if (ff) return ff;
    if (!window.FFmpegWASM) throw new Error('مكتبة الفيديو ما تحمّلت.');
    status('جارٍ تحميل محرّك الفيديو (مرة وحدة، ~30MB)…');
    const f = new FFmpegWASM.FFmpeg();
    const base = new URL('ffmpeg/', location.href).href;
    await f.load({ coreURL: base + 'ffmpeg-core.js', wasmURL: base + 'ffmpeg-core.wasm' });
    ff = f; return ff;
  }
  async function exportVideo() {
    if (!orig || !video) return;
    setBusy(true, 'جارٍ تجهيز الصوت…'); await tick();
    try {
      const chs = await renderMix(true);
      const wav = new Uint8Array(await DSP.encodeWav(chs, sr).arrayBuffer());
      const f = await loadFF();
      status('جارٍ دمج الصوت مع الفيديو…');
      const onP = ({ progress }) => { if (progress > 0 && progress <= 1) status('جارٍ الدمج… ' + Math.round(progress * 100) + '%'); };
      f.on('progress', onP);
      const ext = (video.name.match(/\.([a-z0-9]+)$/i) || [, 'mp4'])[1].toLowerCase();
      const inName = 'in.' + ext;
      await f.writeFile(inName, new Uint8Array(await video.file.arrayBuffer()));
      await f.writeFile('mix.wav', wav);
      const code = await f.exec(['-y', '-i', inName, '-i', 'mix.wav', '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'out.mp4']);
      f.off('progress', onP);
      if (code !== 0) throw new Error('فشل الدمج. جرّب فيديو بصيغة MP4.');
      const data = await f.readFile('out.mp4');
      for (const n of [inName, 'mix.wav', 'out.mp4']) { try { await f.deleteFile(n); } catch (e) {} }
      download(new Blob([data.buffer], { type: 'video/mp4' }), fileName + '_video.mp4');
      $('#done').innerHTML = '✔ تم تصدير الفيديو: ' + report(chs);
    } catch (e) { alert(e.message || String(e)); }
    setBusy(false);
  }

  // ---------- ربط الأحداث ----------
  function init() {
    buildControls(); fillPresets(); updateMixUI();
    const tsel = $('#target');
    tsel.innerHTML = Object.entries(TARGETS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    tsel.value = target;
    tsel.onchange = () => {
      target = tsel.value; store.set('vs_target', target);
      if (origLufs != null) origNormDb = Math.max(-30, Math.min(30, voiceTarget() - origLufs));
      measure(); scheduleBed();
    };
    $('#file').onchange = e => loadVoice(e.target.files[0]);
    $('#musicFile').onchange = e => { loadMusic(e.target.files[0]); e.target.value = ''; };
    $('#videoFile').onchange = e => { loadVideo(e.target.files[0]); e.target.value = ''; };
    $('#rmMusic').onclick = () => { pause(); music = null; updateMixUI(); buildBed(); };
    $('#rmVideo').onclick = () => { pause(); if (video) URL.revokeObjectURL(video.url); video = null; $('#vid').removeAttribute('src'); updateMixUI(); buildBed(); };
    const drop = $('#drop');
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => loadVoice(e.dataTransfer.files[0]));
    $('#play').onclick = () => { ensureCtx(); playing ? pause() : play(); };
    $('#stop').onclick = () => { pause(); seek(0); };
    document.querySelectorAll('[name=ab]').forEach(r => r.onchange = () => { mode = r.value; drawWave(); if (playing) restart(); });
    $('#wave').onclick = e => {
      if (!orig) return;
      const rect = e.target.getBoundingClientRect();
      seek((e.clientX - rect.left) / rect.width * timeline().total);
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
    $('#exportT').onclick = () => download(new Blob([JSON.stringify({ templates: store.get(LS_T, {}), current: P, mix: M, target }, null, 2)], { type: 'application/json' }), 'voice-templates.json');
    $('#importT').onchange = async e => {
      try {
        const d = JSON.parse(await e.target.files[0].text());
        const t = Object.assign(store.get(LS_T, {}), d.templates || {}); store.set(LS_T, t); fillPresets();
        if (d.current) applyAll(d.current);
        if (d.mix) { M = Object.assign({}, MIX_DEF, d.mix); store.set(LS_MIX, M); syncControls(); scheduleBed(); }
        alert('تم استيراد ' + Object.keys(d.templates || {}).length + ' قالب.');
      } catch (er) { alert('ملف غير صالح'); }
      e.target.value = '';
    };
    $('#wav').onclick = () => doExport('wav');
    $('#mp3').onclick = () => doExport('mp3');
    $('#mp4').onclick = exportVideo;
    $('#stereo').onchange = e => { exportStereo = e.target.checked; };
    window.addEventListener('resize', drawWave);
    requestAnimationFrame(loop);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
