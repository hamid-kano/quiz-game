// ============================================================
//  قوافل: الواجهة (الخريطة، السوق، القافلة، العقود، الأخبار)
// ============================================================
import { GOODS, CITIES } from "./data.js";
import * as E from "./engine.js";
import { mapSvg } from "./map.js";

const SAVE = "qawafil-save-v1";
const BEST = "qawafil-best-v1";
const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = (n) => Math.round(n).toLocaleString("en-US");

let s = null;          // حالة اللعبة
let view = "title";
let selected = null;   // المدينة المختارة على الخريطة
let timer = null;      // مؤقّت السفر
let speed = 1;
try { speed = +localStorage.getItem("qawafil-speed") || 1; } catch {}

// ---------------- الحفظ ----------------
const save = () => { try { if (s) localStorage.setItem(SAVE, JSON.stringify(s)); } catch {} };
function load() {
  try { const t = localStorage.getItem(SAVE); return t ? JSON.parse(t) : null; } catch { return null; }
}
function bests() { try { return JSON.parse(localStorage.getItem(BEST)) || []; } catch { return []; } }
function addBest(w) {
  const list = bests();
  list.push({ w, date: new Date().toLocaleDateString("ar-EG") });
  list.sort((a, b) => b.w - a.w);
  try { localStorage.setItem(BEST, JSON.stringify(list.slice(0, 5))); } catch {}
}

// ---------------- أصوات صغيرة مولّدة (بلا ملفات) ----------------
let actx = null;
let soundOn = true;
try { soundOn = localStorage.getItem("qawafil-sound") !== "0"; } catch {}
function tone(freqs, dur = 0.09, type = "triangle", gain = 0.15) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f;
      const t0 = actx.currentTime + i * dur;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    });
  } catch {}
}
const sfx = {
  coin: () => tone([988, 1319], 0.07),
  buy: () => tone([660, 520], 0.06),
  bell: () => tone([523, 659, 784], 0.12, "sine", 0.12),
  bad: () => tone([220, 165], 0.18, "sawtooth", 0.08),
  win: () => tone([523, 659, 784, 1047], 0.12, "sine", 0.14)
};

// ---------------- أدوات العرض ----------------
function toast(text, kind = "") {
  const t = $("#toast");
  const el = document.createElement("div");
  el.className = "t " + kind;
  el.textContent = text;
  t.appendChild(el);
  setTimeout(() => el.classList.add("out"), 2600);
  setTimeout(() => el.remove(), 3100);
}
function modal(html, cls = "") {
  const m = $("#modal");
  m.innerHTML = `<div class="sheet ${cls}">${html}</div>`;
  m.hidden = false;
  return m;
}
const closeModal = () => { $("#modal").hidden = true; $("#modal").innerHTML = ""; };

const hud = () => `
  <header class="hud">
    <div class="chip day" title="اليوم">📅 <b>${Math.min(s.day, E.DAYS)}</b><small>/${E.DAYS}</small></div>
    <div class="chip gold" title="المال">🪙 <b>${num(s.money)}</b></div>
    <div class="chip" title="الجمال">🐪 <b>${s.camels}</b></div>
    <div class="chip" title="الحرّاس">⚔️ <b>${s.guards}</b></div>
    <div class="chip ${s.supplies < 6 ? "warn" : ""}" title="الماء والزاد">💧 <b>${s.supplies}</b><small>/${E.maxSupplies(s)}</small></div>
    <div class="chip" title="الحمولة">📦 <b>${E.cargoUsed(s)}</b><small>/${E.capacity(s)}</small></div>
  </header>`;

const TABS = [["map", "🗺️", "الخريطة"], ["market", "🏪", "السوق"], ["caravan", "🐪", "القافلة"], ["contracts", "📜", "العقود"], ["news", "📰", "الأخبار"]];
const nav = () => `
  <nav class="tabs">${TABS.map(([id, e, t]) => {
    const off = s.travel && (id === "market" || id === "caravan");
    const badge = id === "contracts" && s.active.some((k) => E.canDeliver(s, k)) ? `<i class="badge">!</i>` : id === "news" && s.news[0]?.day >= s.day - 1 && s.news[0]?.kind === "event" ? `<i class="badge">•</i>` : "";
    return `<button class="tab ${view === id ? "on" : ""}" data-tab="${id}" ${off ? "disabled" : ""}><span>${e}</span>${t}${badge}</button>`;
  }).join("")}</nav>`;

function render() {
  if (!s || view === "title") return renderTitle();
  if (s.over && !s.travel) return renderEnd();
  const body = { map: viewMap, market: viewMarket, caravan: viewCaravan, contracts: viewContracts, news: viewNews }[view]();
  $("#app").innerHTML = hud() + `<main class="view view-${view}">${body}</main>` + nav();
  $$(".tab").forEach((b) => (b.onclick = () => { view = b.dataset.tab; render(); }));
  bind[view]?.();
}

// ---------------- الشاشة الأولى ----------------
function renderTitle() {
  const saved = load();
  const list = bests();
  $("#app").innerHTML = `
    <main class="title-screen">
      <div class="logo"><span>🐪</span><h1>قوافل</h1><p>تجارة على طرق القوافل العربية</p></div>
      <div class="title-actions">
        ${saved && !saved.over ? `<button class="btn big" id="cont">▶ أكمل رحلتك <small>اليوم ${Math.min(saved.day, E.DAYS)} · 🪙 ${num(saved.money)}</small></button>` : ""}
        <button class="btn big ${saved && !saved.over ? "alt" : ""}" id="new">🐪 موسم جديد</button>
        <button class="btn alt" id="help">📖 كيف ألعب؟</button>
      </div>
      ${list.length ? `<section class="bests"><h3>🏆 أفضل مواسمك</h3>${list.map((b, i) => {
        const t = E.titleFor(b.w);
        return `<div class="best"><b>${i + 1}</b><span>${t.icon} ${t.name}</span><span class="w">🪙 ${num(b.w)}</span></div>`;
      }).join("")}</section>` : ""}
      <p class="foot">تعمل بدون إنترنت · بلا إعلانات</p>
    </main>`;
  $("#new").onclick = () => {
    if (saved && !saved.over && !confirm("ستبدأ موسماً جديداً وتُمحى رحلتك الحالية. متأكد؟")) return;
    s = E.newGame(); selected = s.city; view = "map"; save(); render();
    if (!localStorage.getItem("qawafil-helped")) { try { localStorage.setItem("qawafil-helped", "1"); } catch {} showHelp(); }
  };
  if ($("#cont")) $("#cont").onclick = () => { s = saved; selected = s.travel ? s.travel.to : s.city; view = "map"; render(); if (s.travel) resumeTravel(); };
  $("#help").onclick = showHelp;
}

function showHelp() {
  modal(`
    <h2>📖 كيف ألعب؟</h2>
    <ol class="help">
      <li><b>اشترِ بثمن رخيص وبِع بثمن غالٍ.</b> كل مدينة تنتج بضائع رخيصة فيها، وتطلب بضائع تدفع فيها أكثر.</li>
      <li><b>اختر مدينة على الخريطة</b> وانطلق إليها عبر الطرق. كل يوم في الطريق يستهلك ماءً وزاداً 💧، فلا تنطلق بقِرب فارغة!</li>
      <li><b>الأسعار تتغيّر:</b> أنت لا تعرف أسعار مدينة إلا حين تزورها، وكل ما تشتريه يرفع سعره قليلاً، وكل ما تبيعه يخفضه.</li>
      <li><b>اشترِ جمالاً</b> لتحمل أكثر، <b>واستأجر حرّاساً</b> ⚔️ قبل الطرق الخطرة.</li>
      <li><b>اقرأ الأخبار</b> 📰: موسم الحج وسفن الهند والقحط تغيّر الأسعار كثيراً.</li>
      <li><b>العقود</b> 📜 تدفع مكافأة كبيرة إن سلّمت البضاعة في موعدها.</li>
      <li>بعد <b>120 يوماً</b> تُحسب ثروتك: المال + الجمال + البضاعة. كن «ملك القوافل»!</li>
    </ol>
    <button class="btn block" id="ok">يلا نبدأ 🐪</button>`);
  $("#ok").onclick = closeModal;
}

// ---------------- الخريطة ----------------
function viewMap() {
  const sc = selected || s.city;
  return `
    ${s.travel ? travelBar() : ""}
    <div class="map-wrap">${mapSvg(s, sc)}</div>
    <section class="panel" id="panel">${cityPanel(sc)}</section>`;
}

function travelBar() {
  const tr = s.travel;
  const pct = Math.round((tr.done / tr.total) * 100);
  return `<div class="travel-bar">
    <div><b>${E.C[tr.from].name} ← ${E.C[tr.to].name}</b><small>اليوم ${tr.done} من ${tr.total}</small></div>
    <div class="prog"><i style="width:${pct}%"></i></div>
    <button class="speed" id="speed" title="سرعة السفر">${speed === 1 ? "⏩" : "⏩⏩"}</button>
  </div>`;
}

const goodsIcons = (ids) => ids.map((g) => `<span title="${E.G[g].name}">${E.G[g].e} ${E.G[g].name}</span>`).join("") || "<span>—</span>";

function cityPanel(id) {
  const c = E.C[id];
  const header = `<h2>${c.name} ${id === s.city && !s.travel ? `<small class="here">📍 أنت هنا</small>` : ""}</h2>
    <p class="about">${c.about}</p>
    <div class="mw"><div><small>تنتج (رخيص)</small>${goodsIcons(c.make)}</div><div><small>تطلب (غالٍ)</small>${goodsIcons(c.want)}</div></div>`;
  if (s.travel) {
    return header + knownPrices(id);
  }
  if (id === s.city) {
    const deliver = s.active.filter((k) => E.canDeliver(s, k)).length;
    return header + `<div class="row-btns">
      <button class="btn" data-go="market">🏪 السوق</button>
      <button class="btn alt" data-go="caravan">🐪 القافلة</button>
      ${deliver ? `<button class="btn gold" data-go="contracts">📜 سلّم العقد</button>` : ""}
    </div>`;
  }
  const r = E.routeBetween(s.city, id);
  if (!r) {
    const p = E.shortestPath(s.city, id);
    return header + `<div class="route far">
        <p>🧭 لا طريق مباشر من ${E.C[s.city].name}. أقصر طريق (${p.days} يوماً):</p>
        <p class="path">${p.path.map((x) => E.C[x].name).join(" ← ")}</p>
        <button class="btn alt" data-select="${p.path[1]}">اختر ${E.C[p.path[1]].name} أولاً</button>
      </div>` + knownPrices(id);
  }
  const need = E.dailyNeed(s, r) * r.days;
  const [dl, dk] = E.dangerLabel(E.routeDanger(s, r));
  const short = s.supplies < need;
  const contractsTo = s.active.filter((k) => k.to === id);
  return header + `<div class="route">
      <div class="facts">
        <span>⏳ <b>${r.days}</b> أيام</span>
        <span class="danger ${dk}">⚔️ ${dl}</span>
        <span class="${short ? "bad" : ""}">💧 تحتاج نحو <b>${need}</b></span>
        ${r.dry >= 1.5 ? `<span>🏜️ صحراء قاحلة</span>` : ""}
      </div>
      ${contractsTo.length ? `<p class="hint">📜 لديك ${contractsTo.length === 1 ? "عقد" : "عقود"} إلى ${c.name}</p>` : ""}
      ${short ? `<p class="warn-line">⚠️ ماؤك (${s.supplies}) لا يكفي الرحلة! اشترِ الماء من قسم القافلة.</p>` : ""}
      <button class="btn block ${short ? "danger-btn" : ""}" id="go" data-to="${id}">🐪 انطلق إلى ${c.name}</button>
    </div>` + knownPrices(id);
}

// أسعار المدينة كما رآها التاجر في آخر زيارة
function knownPrices(id) {
  const k = s.known[id];
  if (!k) return `<p class="unknown">❔ لم تزر ${E.C[id].name} بعد، فلا تعرف أسعارها. تذكّر: ما «تطلبه» يُباع فيها غالياً.</p>`;
  const ago = s.day - k.day;
  return `<div class="known">
    <h4>أسعار ${E.C[id].name} <small>${id === s.city && !s.travel ? "اليوم" : ago === 0 ? "اليوم" : `قبل ${ago} ${ago === 1 ? "يوم" : ago <= 10 ? "أيام" : "يوماً"}`}</small></h4>
    <div class="kgrid">${GOODS.map((g) => `<div class="${s.cargo[g.id] ? "mine" : ""}"><span>${g.e}</span><small>شراء</small><b>${k.buy[g.id]}</b><small>بيع</small><b>${k.sell[g.id]}</b></div>`).join("")}</div>
  </div>`;
}

// ---------------- السوق ----------------
function priceClass(g, p, isBuy) {
  const b = E.G[g].base;
  if (isBuy && p <= b * 0.75) return "cheap";
  if (!isBuy && p >= b * 1.3) return "dear";
  return "";
}
function viewMarket() {
  const free = E.capacity(s) - E.cargoUsed(s);
  return `
    <div class="title-row"><h2>🏪 سوق ${E.C[s.city].name}</h2><small>مساحة فارغة: ${free} · كل جمل يحمل ${E.CAMEL_CAP}</small></div>
    <div class="goods">${GOODS.map((g) => {
      const bp = E.buyPrice(s, g.id), sp = E.sellPrice(s, g.id);
      const own = s.cargo[g.id] || 0;
      const avg = E.avgCost(s, g.id);
      const best = E.bestKnownSell(s, g.id);
      const maxBuy = Math.min(free, Math.floor(s.money / bp));
      const gain = own ? Math.round((sp - avg) * own) : 0;
      return `<div class="good ${own ? "owned" : ""}" data-g="${g.id}">
        <div class="g-top">
          <span class="ge">${g.e}</span>
          <div class="gi"><b>${g.name}</b>
            ${own ? `<small>معك <b>${own}</b> · تكلفتها ${Math.round(avg)} · <span class="${gain >= 0 ? "up" : "down"}">${gain >= 0 ? "ربح" : "خسارة"} ${num(Math.abs(gain))}</span></small>`
              : best ? `<small>أعلى بيع تعرفه: ${E.C[best.city].name} ${best.price}</small>` : `<small>&nbsp;</small>`}
          </div>
          <div class="gp"><span class="p ${priceClass(g.id, bp, true)}"><small>شراء</small>${bp}</span><span class="p ${priceClass(g.id, sp, false)}"><small>بيع</small>${sp}</span></div>
        </div>
        <div class="g-btns">
          <button class="b buy" data-act="buy" data-n="1" ${maxBuy < 1 ? "disabled" : ""}>+1</button>
          <button class="b buy" data-act="buy" data-n="5" ${maxBuy < 1 ? "disabled" : ""}>+5</button>
          <button class="b buy" data-act="buy" data-n="max" ${maxBuy < 1 ? "disabled" : ""}>اشترِ ${maxBuy > 0 ? maxBuy : ""}</button>
          <button class="b sell" data-act="sell" data-n="1" ${own ? "" : "disabled"}>بِع 1</button>
          <button class="b sell" data-act="sell" data-n="max" ${own ? "" : "disabled"}>بِع الكل</button>
        </div>
      </div>`;
    }).join("")}</div>
    <p class="note">💡 كل وحدة تشتريها ترفع السعر قليلاً، وكل وحدة تبيعها تخفضه. يعود السعر لطبيعته مع الأيام.</p>`;
}

// ---------------- القافلة ----------------
function viewCaravan() {
  const room = E.maxSupplies(s) - s.supplies;
  const wp = E.waterPrice(s);
  const nbrs = E.neighbors(s.city).map((n) => E.routeBetween(s.city, n));
  const longest = Math.max(...nbrs.map((r) => E.dailyNeed(s, r) * r.days));
  return `
    <div class="title-row"><h2>🐪 قافلتك</h2><small>في ${E.C[s.city].name}</small></div>
    <div class="cards">
      <div class="card">
        <div class="c-head"><span>🐪</span><div><b>الجمال: ${s.camels}</b><small>كل جمل يحمل ${E.CAMEL_CAP} من البضاعة و${E.SUPPLY_PER_CAMEL} من الماء</small></div></div>
        <div class="row-btns">
          <button class="btn" id="buyCamel" ${s.money < E.camelPrice(s) ? "disabled" : ""}>اشترِ جملاً (${E.camelPrice(s)})</button>
          <button class="btn alt" id="sellCamel" ${s.camels <= 1 ? "disabled" : ""}>بِع جملاً (${E.camelSellPrice(s)})</button>
        </div>
      </div>
      <div class="card">
        <div class="c-head"><span>⚔️</span><div><b>الحرّاس: ${s.guards}</b><small>أجرة الحارس ${E.GUARD_HIRE} ثم ${E.GUARD_WAGE} كل يوم · فرصة النصر على قطّاع الطرق: <b>${Math.round(E.fightChance(s) * 100)}٪</b></small></div></div>
        <div class="row-btns">
          <button class="btn" id="hire" ${s.money < E.GUARD_HIRE || s.guards >= s.camels * 2 ? "disabled" : ""}>استأجر حارساً (${E.GUARD_HIRE})</button>
          <button class="btn alt" id="fire" ${s.guards ? "" : "disabled"}>اصرف حارساً</button>
        </div>
      </div>
      <div class="card">
        <div class="c-head"><span>💧</span><div><b>الماء والزاد: ${s.supplies} / ${E.maxSupplies(s)}</b><small>سعر الوحدة هنا ${wp} · أطول طريق من هنا يحتاج نحو ${longest}</small></div></div>
        <div class="meter"><i style="width:${(s.supplies / Math.max(1, E.maxSupplies(s))) * 100}%"></i></div>
        <div class="row-btns">
          <button class="btn" id="water10" ${room < 1 || s.money < wp ? "disabled" : ""}>+10 (${10 * wp})</button>
          <button class="btn" id="waterFull" ${room < 1 || s.money < wp ? "disabled" : ""}>املأ القِرب (${room * wp})</button>
        </div>
      </div>
      <div class="card">
        <div class="c-head"><span>📦</span><div><b>الحمولة: ${E.cargoUsed(s)} / ${E.capacity(s)}</b><small>${Object.keys(s.cargo).length ? Object.entries(s.cargo).map(([g, n]) => `${E.G[g].e} ${n}`).join(" · ") : "القافلة فارغة"}</small></div></div>
      </div>
      <div class="card">
        <div class="c-head"><span>⏳</span><div><b>انتظر في المدينة</b><small>تتغيّر الأسعار، ويعود سعر ما بعته أو اشتريته لطبيعته. الحرّاس يأخذون أجرتهم.</small></div></div>
        <div class="row-btns">
          <button class="btn alt" id="rest1">انتظر يوماً</button>
          <button class="btn alt" id="rest3">انتظر 3 أيام</button>
        </div>
      </div>
    </div>
    <div class="stats">
      <h3>📊 موسمك</h3>
      <div class="sgrid">
        <div><b>${num(E.netWorth(s))}</b><small>ثروتك الآن</small></div>
        <div><b>${num(s.stats.profit)}</b><small>أرباح التجارة</small></div>
        <div><b>${s.stats.contracts}</b><small>عقود سلّمتها</small></div>
        <div><b>${s.stats.cities.length}/${CITIES.length}</b><small>مدن زرتها</small></div>
      </div>
      <div class="row-btns">
        <button class="btn alt small" id="sound">${soundOn ? "🔊 الصوت" : "🔇 الصوت"}</button>
        <button class="btn alt small" id="helpBtn">📖 كيف ألعب؟</button>
        <button class="btn alt small" id="end">🏁 أنهِ الموسم</button>
      </div>
    </div>`;
}

// ---------------- العقود ----------------
function contractCard(k, mode) {
  const left = k.deadline - s.day;
  const has = s.cargo[k.good] || 0;
  const p = k.to === s.city ? null : E.shortestPath(s.city, k.to);
  return `<div class="contract ${left <= 5 ? "urgent" : ""}">
    <div class="k-top"><span class="ke">${E.G[k.good].e}</span>
      <div><b>${k.qty} ${E.G[k.good].name} إلى ${E.C[k.to].name}</b>
      <small>المكافأة <b class="gold-t">🪙 ${num(k.reward)}</b> · ${mode === "offer" ? `المهلة ${left} يوماً` : `بقي ${left} ${left === 1 ? "يوم" : "يوماً"}`}${p ? ` · المسافة ${p.days} يوماً` : ""}</small>
      ${mode === "active" ? `<small>معك ${has} من ${k.qty}</small>` : ""}</div></div>
    ${mode === "offer" ? `<button class="btn small" data-accept="${k.id}" ${s.active.length >= E.MAX_CONTRACTS ? "disabled" : ""}>اقبل العقد</button>` : ""}
    ${mode === "active" && E.canDeliver(s, k) ? `<button class="btn gold small" data-deliver="${k.id}">📜 سلّم واقبض</button>` : ""}
  </div>`;
}
function viewContracts() {
  const offers = s.travel ? [] : E.offersHere(s);
  return `
    <div class="title-row"><h2>📜 العقود</h2><small>حتى ${E.MAX_CONTRACTS} عقود في نفس الوقت</small></div>
    <h3 class="sub">عقودك (${s.active.length})</h3>
    ${s.active.length ? s.active.map((k) => contractCard(k, "active")).join("") : `<p class="empty">لا عقود الآن. اقبل عقداً من تجّار المدينة.</p>`}
    ${s.travel ? "" : `<h3 class="sub">عروض تجّار ${E.C[s.city].name}</h3>
    ${offers.length ? offers.map((k) => contractCard(k, "offer")).join("") : `<p class="empty">لا عروض جديدة الآن. تتجدّد العروض كل بضعة أيام.</p>`}`}
    <p class="note">💡 العقد لا يكلّفك شيئاً، لكن عليك شراء البضاعة بنفسك وإيصالها قبل الموعد.</p>`;
}

// ---------------- الأخبار ----------------
function viewNews() {
  const eff = E.effectsList(s);
  return `
    <div class="title-row"><h2>📰 أخبار الطرق</h2></div>
    ${eff.length ? `<div class="effects">${eff.map((e) => `<div class="effect"><span>${e.route ? "⚔️" : e.mult > 1 ? "📈" : "📉"}</span><p>${e.text}</p><small>${e.left} يوماً</small></div>`).join("")}</div>` : `<p class="empty">الأحوال هادئة على الطرق.</p>`}
    <h3 class="sub">السجل</h3>
    <div class="log">${s.news.map((n) => `<div class="ln ${n.kind}"><small>يوم ${n.day}</small><p>${esc(n.text)}</p></div>`).join("")}</div>`;
}

// ---------------- الأحداث ----------------
const bind = {
  map() {
    $$(".city").forEach((g) => (g.onclick = () => { selected = g.dataset.city; sfx.bell(); render(); }));
    $$("[data-select]").forEach((b) => (b.onclick = () => { selected = b.dataset.select; render(); }));
    $$("[data-go]").forEach((b) => (b.onclick = () => { view = b.dataset.go; render(); }));
    if ($("#go")) $("#go").onclick = () => {
      const to = $("#go").dataset.to;
      const r = E.routeBetween(s.city, to);
      const need = E.dailyNeed(s, r) * r.days;
      if (s.supplies < need && !confirm(`ماؤك ${s.supplies} والرحلة تحتاج نحو ${need}. قد تعطش القافلة وتنفق الجمال! تنطلق رغم ذلك؟`)) return;
      E.startTravel(s, to);
      selected = to;
      save(); sfx.bell();
      render();
      resumeTravel();
    };
    if ($("#speed")) $("#speed").onclick = () => {
      speed = speed === 1 ? 2 : 1;
      try { localStorage.setItem("qawafil-speed", speed); } catch {}
      resumeTravel(); updateMapOnly();
    };
  },
  market() {
    $$(".good .b").forEach((b) => (b.onclick = () => {
      const g = b.closest(".good").dataset.g;
      const n = b.dataset.n === "max" ? 999 : +b.dataset.n;
      if (b.dataset.act === "buy") {
        const r = E.buy(s, g, n);
        if (r.got) { sfx.buy(); if (n > 1) toast(`اشتريت ${r.got} ${E.G[g].name} بـ ${num(r.spent)}`); }
        else toast(E.cargoUsed(s) >= E.capacity(s) ? "القافلة ممتلئة! اشترِ جملاً." : "لا يكفي مالك", "bad");
      } else {
        const r = E.sell(s, g, n);
        if (r.sold) { sfx.coin(); toast(`بعت ${r.sold} ${E.G[g].name} بـ ${num(r.earned)} · ${r.profit >= 0 ? "ربح" : "خسارة"} ${num(Math.abs(r.profit))}`, r.profit >= 0 ? "good" : "bad"); }
      }
      save(); render();
    }));
  },
  caravan() {
    const act = (id, fn, ok, fail) => { const b = $("#" + id); if (b) b.onclick = () => { const r = fn(); if (r) { ok && toast(ok); sfx.coin(); } else if (fail) toast(fail, "bad"); save(); render(); }; };
    act("buyCamel", () => E.buyCamel(s), "🐪 انضم جمل جديد إلى قافلتك");
    act("sellCamel", () => E.sellCamel(s), "بعت جملاً", "أفرغ بعض الحمولة أولاً، فالجمال الباقية لن تحملها");
    act("hire", () => E.hireGuard(s), "⚔️ انضم حارس إلى القافلة", "لا يمكن استئجار أكثر من حارسين لكل جمل");
    act("fire", () => E.dismissGuard(s), "صرفت حارساً");
    act("water10", () => E.buySupplies(s, 10));
    act("waterFull", () => E.buySupplies(s, 999), "💧 امتلأت القِرب");
    act("rest1", () => { E.rest(s, 1); return true; }, "مرّ يوم");
    act("rest3", () => { E.rest(s, 3); return true; }, "مرّت ثلاثة أيام");
    $("#sound").onclick = () => { soundOn = !soundOn; try { localStorage.setItem("qawafil-sound", soundOn ? "1" : "0"); } catch {} render(); };
    $("#helpBtn").onclick = showHelp;
    $("#end").onclick = () => { if (confirm("تنهي الموسم الآن وتُحسب ثروتك؟")) { E.endEarly(s); save(); render(); } };
  },
  contracts() {
    $$("[data-accept]").forEach((b) => (b.onclick = () => { if (E.acceptContract(s, b.dataset.accept)) { sfx.bell(); toast("📜 قبلت العقد"); } save(); render(); }));
    $$("[data-deliver]").forEach((b) => (b.onclick = () => { if (E.deliver(s, b.dataset.deliver)) { sfx.win(); toast("🪙 سلّمت العقد وقبضت المكافأة!", "good"); } save(); render(); }));
  },
  news() {}
};

// ---------------- السفر ----------------
function resumeTravel() {
  clearInterval(timer);
  if (!s.travel) return;
  if (s.pending) return showEvent(s.pending);
  timer = setInterval(stepTravel, speed === 1 ? 650 : 280);
}
function stepTravel() {
  if (!s.travel || s.pending) { clearInterval(timer); return; }
  const res = E.travelDay(s);
  save();
  for (const n of res.notes) { toast(n, /نفد|نفق|ترك|شرد|عاصفة/.test(n) ? "bad" : ""); if (/نفد|نفق/.test(n)) sfx.bad(); }
  if (res.over) { clearInterval(timer); s.travel = null; save(); render(); return; }
  if (res.arrived) {
    clearInterval(timer);
    sfx.win();
    const deliver = s.active.filter((k) => E.canDeliver(s, k));
    view = "market"; selected = s.city;
    render();
    toast(`🏁 وصلت إلى ${E.C[s.city].name}` + (deliver.length ? " · لديك عقد تسلّمه هنا!" : ""), "good");
    return;
  }
  if (view === "map") updateMapOnly(); else render();
  if (res.event?.choices) { clearInterval(timer); showEvent(res.event); }
}
function updateMapOnly() {
  const hudEl = document.querySelector(".hud");
  if (hudEl) hudEl.outerHTML = hud();
  const wrap = document.querySelector(".map-wrap");
  const bar = document.querySelector(".travel-bar");
  if (wrap) wrap.innerHTML = mapSvg(s, selected);
  if (bar) bar.outerHTML = travelBar();
  if ($("#speed")) $("#speed").onclick = () => { speed = speed === 1 ? 2 : 1; try { localStorage.setItem("qawafil-speed", speed); } catch {} resumeTravel(); updateMapOnly(); };
  $$(".city").forEach((g) => (g.onclick = () => { selected = g.dataset.city; const p = $("#panel"); if (p) p.innerHTML = cityPanel(selected); updateMapOnly(); }));
}

function showEvent(ev) {
  sfx[ev.type === "bandits" ? "bad" : "bell"]();
  modal(`
    <div class="ev-icon">${ev.icon}</div>
    <h2>${ev.title}</h2>
    <p class="ev-text">${ev.text}</p>
    <div class="choices">${ev.choices.map((c) => `<button class="btn block ${c.id === "no" ? "alt" : ""}" data-c="${c.id}">${c.label}${c.hint ? `<small>${c.hint}</small>` : ""}</button>`).join("")}</div>`, "event");
  $$("[data-c]").forEach((b) => (b.onclick = () => {
    const text = E.resolve(s, b.dataset.c);
    save();
    const good = /انتصر|مررت|نجت|بعت|وفّرتم/.test(text);
    good ? sfx.coin() : /هُزمتم|أخذوا/.test(text) ? sfx.bad() : null;
    modal(`<div class="ev-icon">${good ? "✅" : /هُزمتم|أخذوا/.test(text) ? "💔" : "🐪"}</div><p class="ev-text">${text}</p><button class="btn block" id="cont">تابع الرحلة</button>`, "event");
    $("#cont").onclick = () => { closeModal(); render(); resumeTravel(); };
  }));
}

// ---------------- النهاية ----------------
function renderEnd() {
  clearInterval(timer);
  const w = E.netWorth(s);
  const t = E.titleFor(w);
  if (!s.scored) { s.scored = true; addBest(w); save(); sfx.win(); }
  const st = s.stats;
  $("#app").innerHTML = `
    <main class="end-screen">
      <div class="trophy">${t.icon}</div>
      <p class="end-sub">انتهى الموسم</p>
      <h1>${t.name}</h1>
      <div class="worth">🪙 ${num(w)} <small>دينار</small></div>
      <div class="sgrid">
        <div><b>${num(st.profit)}</b><small>أرباح التجارة</small></div>
        <div><b>${st.contracts}</b><small>عقود سلّمتها</small></div>
        <div><b>${st.won}/${st.fights}</b><small>معارك انتصرت فيها</small></div>
        <div><b>${st.cities.length}/${CITIES.length}</b><small>مدن زرتها</small></div>
        <div><b>${num(st.bestTrade)}</b><small>أفضل صفقة</small></div>
        <div><b>${s.camels}</b><small>جمال في قافلتك</small></div>
      </div>
      <button class="btn big block" id="again">🐪 موسم جديد</button>
      <button class="btn alt block" id="home">الشاشة الرئيسية</button>
    </main>`;
  $("#again").onclick = () => { s = E.newGame(); selected = s.city; view = "map"; save(); render(); };
  $("#home").onclick = () => { view = "title"; render(); };
}

// ---------------- البداية ----------------
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" && !s?.pending) closeModal(); });
render();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
