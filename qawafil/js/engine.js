// ============================================================
//  محرّك قوافل: كل قواعد اللعبة هنا، بلا أي واجهة
//  الحالة كلها كائن واحد قابل للحفظ (JSON)، والعشوائية مبذورة فتُعاد بدقة
// ============================================================
import { GOODS, CITIES, ROUTES, WORLD_EVENTS, TITLES, START } from "./data.js";

export const DAYS = 120;          // طول الموسم
export const CAMEL_CAP = 10;      // ما يحمله الجمل من البضاعة
export const SUPPLY_PER_CAMEL = 20; // ما يحمله الجمل من الماء والزاد
export const GUARD_HIRE = 15;     // أجرة التعاقد مع حارس
export const GUARD_WAGE = 2;      // أجرة الحارس اليومية
export const SELL_RATE = 0.88;    // سعر البيع نسبة من سعر الشراء
export const MAX_CONTRACTS = 3;

export const G = Object.fromEntries(GOODS.map((g) => [g.id, g]));
export const C = Object.fromEntries(CITIES.map((c) => [c.id, c]));

// ---------------- العشوائية المبذورة ----------------
export function rand(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pickR = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------------- الطرق ----------------
export const routeBetween = (a, b) => ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
export const neighbors = (c) => ROUTES.filter((r) => r.a === c || r.b === c).map((r) => (r.a === c ? r.b : r.a));

// أقصر طريق بالأيام (للعقود ولإرشاد اللاعب)
export function shortestPath(from, to) {
  const dist = { [from]: 0 }, prev = {}, done = new Set();
  while (true) {
    let u = null;
    for (const k in dist) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k;
    if (u === null) return null;
    if (u === to) break;
    done.add(u);
    for (const v of neighbors(u)) {
      const d = dist[u] + routeBetween(u, v).days;
      if (dist[v] === undefined || d < dist[v]) { dist[v] = d; prev[v] = u; }
    }
  }
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return { days: dist[to], path };
}

// خطر الطريق مع أحداث العالم
export function routeDanger(s, r) {
  let d = r.danger;
  for (const e of s.effects) {
    const ev = WORLD_EVENTS.find((x) => x.id === e.id);
    if (ev?.route && routeBetween(ev.route[0], ev.route[1]) === r) d *= ev.danger;
  }
  return d;
}
export const dangerLabel = (d) => (d < 0.013 ? ["آمن", "safe"] : d < 0.022 ? ["متوسط الخطر", "mid"] : ["خطِر", "high"]);

// ماء القافلة لكل يوم على هذا الطريق
export const dailyNeed = (s, r) => Math.max(1, Math.ceil((s.camels + s.guards) * r.dry * 0.5));

// ---------------- لعبة جديدة ----------------
export function newGame(seed = (Math.random() * 2 ** 31) | 0) {
  const s = {
    v: 1, seed, rng: seed, day: 1,
    money: START.money, city: START.city, camels: START.camels, guards: START.guards, supplies: START.supplies,
    cargo: {}, cost: {},
    factor: {}, trend: {}, press: {},
    known: {}, effects: [], news: [], offers: {}, active: [],
    travel: null, pending: null, over: false,
    stats: { bought: 0, sold: 0, profit: 0, bestTrade: 0, contracts: 0, fights: 0, won: 0, days: 0, cities: [START.city] }
  };
  for (const c of CITIES) {
    s.factor[c.id] = {}; s.trend[c.id] = {}; s.press[c.id] = {};
    for (const g of GOODS) {
      const f = c.make.includes(g.id) ? 0.55 : c.want.includes(g.id) ? 1.65 : 1;
      s.factor[c.id][g.id] = f * (0.9 + rand(s) * 0.2);
      s.trend[c.id][g.id] = 0.85 + rand(s) * 0.3;
      s.press[c.id][g.id] = 1;
    }
  }
  addNews(s, "بدأ الموسم. أمامك 120 يوماً لتصبح أغنى تاجر على طرق القوافل.");
  remember(s);
  makeOffers(s, s.city);
  return s;
}

// ---------------- الأسعار ----------------
function eventMult(s, c, g) {
  let m = 1;
  for (const e of s.effects) {
    const ev = WORLD_EVENTS.find((x) => x.id === e.id);
    if (ev?.cities?.includes(c) && ev.goods.includes(g)) m *= ev.mult;
  }
  return m;
}
const rawPrice = (s, c, g) => G[g].base * s.factor[c][g] * s.trend[c][g] * s.press[c][g] * eventMult(s, c, g);
export const buyPrice = (s, g, c = s.city) => Math.max(1, Math.round(rawPrice(s, c, g)));
export const sellPrice = (s, g, c = s.city) => Math.max(1, Math.floor(rawPrice(s, c, g) * SELL_RATE));

export const cargoUsed = (s) => Object.values(s.cargo).reduce((a, b) => a + b, 0);
export const capacity = (s) => s.camels * CAMEL_CAP;
export const maxSupplies = (s) => s.camels * SUPPLY_PER_CAMEL;
export const waterPrice = (s, c = s.city) => C[c].water;
export const camelPrice = (s, c = s.city) => C[c].camel;
export const camelSellPrice = (s, c = s.city) => Math.round(C[c].camel * 0.7);

// يحفظ آخر أسعار رآها التاجر في المدينة الحالية (لا يعرف أسعار المدن الأخرى إلا من زيارته لها)
export function remember(s) {
  const buy = {}, sell = {};
  for (const g of GOODS) { buy[g.id] = buyPrice(s, g.id); sell[g.id] = sellPrice(s, g.id); }
  s.known[s.city] = { day: s.day, buy, sell };
  if (!s.stats.cities.includes(s.city)) s.stats.cities.push(s.city);
}

// أفضل سعر بيع معروف لهذه البضاعة في مدينة أخرى
export function bestKnownSell(s, g) {
  let best = null;
  for (const [c, k] of Object.entries(s.known)) {
    if (c === s.city) continue;
    if (!best || k.sell[g] > best.price) best = { city: c, price: k.sell[g], day: k.day };
  }
  return best;
}

export function buy(s, g, n = 1) {
  let got = 0, spent = 0;
  for (let i = 0; i < n; i++) {
    const p = buyPrice(s, g);
    if (s.money < p || cargoUsed(s) >= capacity(s)) break;
    s.money -= p; spent += p; got++;
    s.cargo[g] = (s.cargo[g] || 0) + 1;
    s.cost[g] = (s.cost[g] || 0) + p;
    s.press[s.city][g] *= 1.008;
  }
  if (got) { s.stats.bought += got; remember(s); }
  return { got, spent };
}

export function sell(s, g, n = 1) {
  let sold = 0, earned = 0, profit = 0;
  for (let i = 0; i < n && (s.cargo[g] || 0) > 0; i++) {
    const p = sellPrice(s, g);
    const avg = s.cost[g] / s.cargo[g];
    s.money += p; earned += p; sold++; profit += p - avg;
    s.cost[g] -= avg; s.cargo[g]--;
    s.press[s.city][g] *= 0.992;
  }
  if (!s.cargo[g]) { delete s.cargo[g]; delete s.cost[g]; }
  if (sold) {
    s.stats.sold += sold; s.stats.profit += profit;
    s.stats.bestTrade = Math.max(s.stats.bestTrade, Math.round(profit));
    remember(s);
  }
  return { sold, earned, profit: Math.round(profit) };
}
export const avgCost = (s, g) => (s.cargo[g] ? s.cost[g] / s.cargo[g] : 0);

// ---------------- القافلة ----------------
export function buyCamel(s) {
  const p = camelPrice(s);
  if (s.money < p) return false;
  s.money -= p; s.camels++;
  return true;
}
export function sellCamel(s) {
  if (s.camels <= 1) return false;
  if (cargoUsed(s) > (s.camels - 1) * CAMEL_CAP) return false;
  s.money += camelSellPrice(s); s.camels--;
  s.supplies = Math.min(s.supplies, maxSupplies(s));
  return true;
}
export function hireGuard(s) {
  if (s.money < GUARD_HIRE || s.guards >= s.camels * 2) return false;
  s.money -= GUARD_HIRE; s.guards++;
  return true;
}
export function dismissGuard(s) {
  if (!s.guards) return false;
  s.guards--;
  return true;
}
export function buySupplies(s, n) {
  const p = waterPrice(s);
  const room = maxSupplies(s) - s.supplies;
  const k = Math.max(0, Math.min(n, room, Math.floor(s.money / p)));
  s.money -= k * p; s.supplies += k;
  return k;
}

// ---------------- مرور الأيام ----------------
function addNews(s, text, kind = "info") {
  s.news.unshift({ day: s.day, text, kind });
  s.news.length = Math.min(s.news.length, 40);
}

function tickDay(s) {
  s.day++;
  s.stats.days++;
  // الأسعار تتحرك ببطء، وأثر بيعك وشرائك يزول تدريجياً
  for (const c of CITIES) for (const g of GOODS) {
    const t = s.trend[c.id][g.id];
    s.trend[c.id][g.id] = clamp(t + (1 - t) * 0.05 + (rand(s) - 0.5) * 0.09, 0.7, 1.4);
    const p = s.press[c.id][g.id];
    s.press[c.id][g.id] = 1 + (p - 1) * 0.85;
  }
  // أحداث العالم
  for (const e of [...s.effects]) if (s.day > e.until) {
    s.effects.splice(s.effects.indexOf(e), 1);
    addNews(s, "انتهى: " + WORLD_EVENTS.find((x) => x.id === e.id).text, "end");
  }
  if (s.effects.length < 3 && rand(s) < 0.09) {
    const ev = pickR(s, WORLD_EVENTS.filter((x) => !s.effects.some((e) => e.id === x.id)));
    if (ev) { s.effects.push({ id: ev.id, until: s.day + ev.days }); addNews(s, ev.text, "event"); }
  }
  // أجور الحرّاس
  if (s.guards) {
    const wage = s.guards * GUARD_WAGE;
    if (s.money >= wage) s.money -= wage;
    else { s.guards--; addNews(s, "لم تستطع دفع أجرة حارس فترك القافلة", "bad"); }
  }
  // العقود المتأخرة
  for (const k of [...s.active]) if (s.day > k.deadline) {
    s.active.splice(s.active.indexOf(k), 1);
    addNews(s, `فات موعد عقد ${k.qty} ${G[k.good].name} إلى ${C[k.to].name}`, "bad");
  }
  if (s.day > DAYS) s.over = true;
}

// الانتظار في المدينة (لتتغيّر الأسعار أو يزول أثر بيعك)
export function rest(s, days = 1) {
  for (let i = 0; i < days && !s.over; i++) tickDay(s);
  remember(s);
  maybeRefreshOffers(s);
}

// ---------------- السفر ----------------
export function canTravel(s, to) {
  const r = routeBetween(s.city, to);
  if (!r) return { ok: false, why: "لا يوجد طريق مباشر" };
  if (s.camels < 1) return { ok: false, why: "تحتاج جملاً واحداً على الأقل" };
  return { ok: true, route: r, need: dailyNeed(s, r) * r.days };
}

export function startTravel(s, to) {
  const t = canTravel(s, to);
  if (!t.ok) return t;
  s.travel = { from: s.city, to, total: t.route.days, done: 0 };
  return t;
}

// يوم واحد في الطريق. يعيد ما حدث: { notes, event, arrived }
export function travelDay(s) {
  const tr = s.travel;
  if (!tr || s.pending) return { notes: [] };
  const r = routeBetween(tr.from, tr.to);
  const notes = [];
  tickDay(s);
  tr.done++;
  const need = dailyNeed(s, r);
  if (s.supplies >= need) s.supplies -= need;
  else {
    s.supplies = 0;
    notes.push("💧 نفد الماء! القافلة تعطش");
    if (s.camels > 1 && rand(s) < 0.5) { loseCamel(s); notes.push("🐪 نفق جمل من العطش"); }
    if (s.guards && rand(s) < 0.5) { s.guards--; notes.push("⚔️ ترك حارس القافلة"); }
  }
  if (s.over) return { notes, over: true };
  if (tr.done >= tr.total) return { notes, arrived: arrive(s) };
  const ev = rollEvent(s, r);
  if (ev) { if (ev.choices) s.pending = ev; else notes.push(ev.text); return { notes, event: ev }; }
  return { notes };
}

function loseCamel(s) {
  s.camels = Math.max(0, s.camels - 1);
  dropOverflow(s);
}
// إذا قلّت الجمال تسقط البضاعة الزائدة
function dropOverflow(s) {
  let over = cargoUsed(s) - capacity(s);
  for (const g of Object.keys(s.cargo).sort((a, b) => G[a].base - G[b].base)) {
    while (over > 0 && s.cargo[g]) { s.cost[g] -= avgCost(s, g); s.cargo[g]--; over--; }
    if (!s.cargo[g]) { delete s.cargo[g]; delete s.cost[g]; }
  }
  s.supplies = Math.min(s.supplies, maxSupplies(s));
}

function arrive(s) {
  const tr = s.travel;
  s.city = tr.to;
  s.travel = null;
  remember(s);
  maybeRefreshOffers(s);
  return tr.to;
}

export const cargoValue = (s) => Object.entries(s.cargo).reduce((a, [g, n]) => a + n * G[g].base, 0);

// خسارة جزء من البضاعة
function loseCargo(s, frac) {
  let lost = 0;
  for (const g of Object.keys(s.cargo)) {
    const k = Math.ceil(s.cargo[g] * frac);
    lost += k;
    s.cost[g] -= avgCost(s, g) * k; s.cargo[g] -= k;
    if (s.cargo[g] <= 0) { delete s.cargo[g]; delete s.cost[g]; }
  }
  return lost;
}

function rollEvent(s, r) {
  const remaining = s.travel.total - s.travel.done;
  const x = rand(s);
  const danger = routeDanger(s, r);
  let acc = danger;
  if (x < acc) {
    const tribute = Math.max(10, Math.round((cargoValue(s) * 0.2 + s.money * 0.1) / 5) * 5);
    return {
      type: "bandits", icon: "🏴", title: "قطّاع طرق!",
      text: `اعترض قطّاع الطرق قافلتك ويطلبون ${tribute} ديناراً لتمرّ بسلام.` + (s.guards ? ` معك ${s.guards} من الحرّاس.` : " ليس معك حرّاس!"),
      tribute,
      choices: [
        { id: "fight", label: "⚔️ قاتِل", hint: `فرصة النصر نحو ${Math.round(fightChance(s) * 100)}٪` },
        { id: "pay", label: `🪙 ادفع ${tribute}`, hint: s.money >= tribute ? "تمرّ بسلام" : "لا تملك المبلغ: سيأخذون من البضاعة" },
        { id: "flee", label: "🏃 اهرب", hint: "تخسر يوماً وبعض الماء، وقد يلحقون بك" }
      ]
    };
  }
  acc += 0.03 * r.dry;
  if (x < acc) {
    const d = rand(s) < 0.6 ? 1 : 2;
    s.travel.total += d;
    return { type: "storm", icon: "🌪️", text: `🌪️ عاصفة رملية أخّرت القافلة ${d === 1 ? "يوماً" : "يومين"}` };
  }
  acc += 0.04;
  if (x < acc) {
    const add = Math.min(maxSupplies(s) - s.supplies, 6 + s.camels * 3);
    s.supplies += add;
    return { type: "oasis", icon: "🌴", text: add > 0 ? `🌴 وجدتم واحة، فملأتم القِرب: +${add} ماء` : "🌴 مررتم بواحة جميلة واسترحتم" };
  }
  acc += 0.035;
  const owned = Object.keys(s.cargo);
  if (x < acc && owned.length) {
    const g = pickR(s, owned);
    const price = Math.round(G[g].base * (1.15 + rand(s) * 0.45));
    const qty = Math.min(s.cargo[g], 5 + Math.floor(rand(s) * 10));
    return {
      type: "merchant", icon: "🧔", title: "تاجر في الطريق",
      text: `قابلت تاجراً يريد شراء ${qty} ${G[g].name} ${G[g].e} بسعر ${price} للوحدة. (تكلفتها عليك ${Math.round(avgCost(s, g))})`,
      good: g, qty, price,
      choices: [{ id: "sell", label: `🤝 بِعه (${qty * price})` }, { id: "no", label: "لا، شكراً" }]
    };
  }
  acc += 0.02;
  if (x < acc && remaining >= 4) {
    const cost = 10 + s.camels * 4;
    return {
      type: "guide", icon: "🧭", title: "دليل صحراوي",
      text: `يعرض عليك دليل خبير طريقاً مختصراً يوفّر يومين، مقابل ${cost} ديناراً.`,
      cost,
      choices: [{ id: "take", label: `🧭 اقبل (${cost})` }, { id: "no", label: "سأكمل طريقي" }]
    };
  }
  acc += 0.008;
  if (x < acc && s.camels > 1) {
    loseCamel(s);
    return { type: "lost", icon: "🐪", text: "🐪 شرد جمل في الليل ولم تجدوه" + (cargoUsed(s) >= capacity(s) ? "، وسقط بعض ما يحمله" : "") };
  }
  return null;
}

export const fightChance = (s) => clamp(0.15 + (s.guards / (s.camels + 1)) * 1.2, 0.1, 0.92);

// قرار اللاعب في حدث له خيارات
export function resolve(s, choice) {
  const ev = s.pending;
  if (!ev) return null;
  s.pending = null;
  if (ev.type === "bandits") {
    if (choice === "pay") {
      if (s.money >= ev.tribute) { s.money -= ev.tribute; return `دفعت ${ev.tribute} ديناراً ومررت بسلام.`; }
      const paid = s.money; s.money = 0;
      const lost = loseCargo(s, 0.25);
      return `دفعت ${paid} ديناراً، وأخذوا ${lost} وحدة من البضاعة.`;
    }
    if (choice === "flee") {
      s.travel.total += 1;
      s.supplies = Math.max(0, s.supplies - Math.ceil(s.camels * 1.5));
      if (rand(s) < 0.55) return "هربتم في الظلام ونجت القافلة، لكنكم ضللتم الطريق يوماً.";
      const lost = loseCargo(s, 0.35);
      return `لحقوا بكم وأخذوا ${lost} وحدة من البضاعة.`;
    }
    s.stats.fights++;
    if (rand(s) < fightChance(s)) {
      s.stats.won++;
      const loot = 10 + Math.floor(rand(s) * 40);
      s.money += loot;
      let t = `انتصرتم وفرّ قطّاع الطرق! غنمتم ${loot} ديناراً.`;
      if (s.guards && rand(s) < 0.25) { s.guards--; t += " لكن جُرح حارس وعاد إلى بيته."; }
      return t;
    }
    const lost = loseCargo(s, 0.5);
    let t = `هُزمتم! أخذوا ${lost} وحدة من البضاعة.`;
    if (s.guards) { s.guards--; t += " وفقدتم حارساً."; }
    if (s.camels > 1 && rand(s) < 0.3) { loseCamel(s); t += " وأخذوا جملاً."; }
    return t;
  }
  if (ev.type === "merchant" && choice === "sell") {
    const n = Math.min(ev.qty, s.cargo[ev.good] || 0);
    const avg = avgCost(s, ev.good);
    s.money += n * ev.price;
    s.cost[ev.good] -= avg * n; s.cargo[ev.good] -= n;
    if (!s.cargo[ev.good]) { delete s.cargo[ev.good]; delete s.cost[ev.good]; }
    const profit = Math.round((ev.price - avg) * n);
    s.stats.sold += n; s.stats.profit += profit; s.stats.bestTrade = Math.max(s.stats.bestTrade, profit);
    return `بعت ${n} ${G[ev.good].name} بـ ${n * ev.price} ديناراً (ربح ${profit}).`;
  }
  if (ev.type === "guide" && choice === "take") {
    if (s.money < ev.cost) return "لا تملك ما يكفي لأجرة الدليل.";
    s.money -= ev.cost;
    s.travel.total = Math.max(s.travel.done + 1, s.travel.total - 2);
    return "سلك الدليل بكم طريقاً مختصراً بين الكثبان: وفّرتم يومين.";
  }
  return "واصلتم الطريق.";
}

// ---------------- العقود ----------------
function makeOffers(s, c) {
  const offers = [];
  for (let i = 0; i < 2; i++) {
    const g = pickR(s, GOODS.filter((x) => CITIES.some((d) => d.id !== c && d.want.includes(x.id)))).id;
    const dests = CITIES.filter((d) => d.id !== c && d.want.includes(g));
    const to = pickR(s, dests).id;
    const path = shortestPath(c, to);
    const qty = Math.max(5, Math.min(30, Math.round((5 + rand(s) * 10) * (G[g].base > 60 ? 0.6 : 1) * Math.max(1, s.camels / 3))));
    const deadline = s.day + Math.ceil(path.days * 1.5) + 6;
    const reward = Math.round((qty * G[g].base * 1.45 + path.days * 10) / 5) * 5;
    offers.push({ id: `${c}-${s.day}-${i}`, from: c, to, good: g, qty, deadline, reward });
  }
  s.offers[c] = { day: s.day, list: offers };
}
function maybeRefreshOffers(s) {
  const o = s.offers[s.city];
  if (!o || s.day - o.day >= 12) makeOffers(s, s.city);
}
export const offersHere = (s) => s.offers[s.city]?.list || [];

export function acceptContract(s, id) {
  if (s.active.length >= MAX_CONTRACTS) return false;
  const o = s.offers[s.city];
  const k = o?.list.find((x) => x.id === id);
  if (!k) return false;
  o.list.splice(o.list.indexOf(k), 1);
  s.active.push(k);
  addNews(s, `قبلت عقداً: ${k.qty} ${G[k.good].name} إلى ${C[k.to].name} قبل اليوم ${k.deadline}`);
  return true;
}
export const canDeliver = (s, k) => k.to === s.city && (s.cargo[k.good] || 0) >= k.qty;
export function deliver(s, id) {
  const k = s.active.find((x) => x.id === id);
  if (!k || !canDeliver(s, k)) return false;
  const avg = avgCost(s, k.good);
  s.cargo[k.good] -= k.qty; s.cost[k.good] -= avg * k.qty;
  if (!s.cargo[k.good]) { delete s.cargo[k.good]; delete s.cost[k.good]; }
  s.money += k.reward;
  s.active.splice(s.active.indexOf(k), 1);
  s.stats.contracts++;
  s.stats.profit += k.reward - avg * k.qty;
  addNews(s, `سلّمت العقد وقبضت ${k.reward} ديناراً`, "good");
  return true;
}

// ---------------- النهاية ----------------
export const netWorth = (s) =>
  Math.round(s.money + s.camels * 40 + Object.entries(s.cargo).reduce((a, [g, n]) => a + n * G[g].base * 0.8, 0));
export function titleFor(w) {
  let t = TITLES[0];
  for (const x of TITLES) if (w >= x[0]) t = x;
  return { name: t[1], icon: t[2] };
}
export function endEarly(s) { s.over = true; }
export const effectsList = (s) => s.effects.map((e) => ({ ...WORLD_EVENTS.find((x) => x.id === e.id), left: e.until - s.day + 1 }));
