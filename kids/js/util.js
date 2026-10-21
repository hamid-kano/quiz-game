// أدوات عامة صغيرة

import { LANG } from "./lang.js";
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const pick = (arr, n) => shuffle(arr).slice(0, n);
export const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const app = () => document.getElementById("app");

// يعرض شاشة جديدة
export function render(html) {
  app().innerHTML = `<div class="screen">${html}</div>`;
  window.scrollTo(0, 0);
}

export const $ = (sel) => app().querySelector(sel);
export const $$ = (sel) => [...app().querySelectorAll(sel)];

// تاريخ اليوم بتوقيت الجهاز بصيغة YYYY-MM-DD
export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}

export const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
// أرقام المحتوى: هندية في التطبيق العربي، ولاتينية (1 2 3) في تطبيق الإنجليزية
export const contentDigits = (n) => (LANG.digits === "latin" ? String(n) : toArabicDigits(n));

export const uid = () => Math.random().toString(36).slice(2, 10);

export function toast(msg) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

// أشكال الحرف داخل الكلمة
export function letterForms(L) {
  // لغات أخرى تحدد أشكال الحرف بنفسها (مثل الحرف الكبير والصغير في الإنجليزية)
  if (L.forms) return L.forms;
  const t = "ـ";
  return L.c
    ? [["منفرد", L.l], ["أول", L.l + t], ["وسط", t + L.l + t], ["آخر", t + L.l]]
    : [["منفرد", L.l], ["آخر", t + L.l]];
}

// صيغة العدد بالعربية: plural(3, ["مرة","مرتان","مرات"])
export function plural(n, [one, two, few, many = one]) {
  const d = toArabicDigits(n);
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${d} ${few}`;
  return `${d} ${many}`;
}
