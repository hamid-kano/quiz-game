// ============================================================
//  بناء تطبيق «حروفي English»:
//  1) ينسخ المحرّك كاملاً من kids/ (نفس الألعاب والتمارين والشاشات)
//  2) يضع فوقه ملفات english/src/ (المحتوى الإنجليزي، الإعدادات، الأيقونات، الخط)
//  3) يعدّل اسم التطبيق في الصفحة وعامل الخدمة وصفحة الخصوصية
//  الناتج: english/www (لا يُحفظ في git، يُبنى في كل مرة)
//  التشغيل: node scripts/build-english.mjs
// ============================================================
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KIDS = join(ROOT, "kids");
const SRC = join(ROOT, "english", "src");
const OUT = join(ROOT, "english", "www");

rmSync(OUT, { recursive: true, force: true });
cpSync(KIDS, OUT, { recursive: true });
cpSync(SRC, OUT, { recursive: true });

// تعديل نصي يفشل البناء إن لم يجد النص (حتى لا يمرّ تغيير في kids/ دون أن ننتبه)
function patch(file, pairs) {
  const p = join(OUT, file);
  let s = readFileSync(p, "utf8");
  for (const [from, to] of pairs) {
    if (!s.includes(from)) throw new Error(`build-english: "${from}" not found in ${file}`);
    s = s.split(from).join(to);
  }
  writeFileSync(p, s);
}

patch("index.html", [
  ["<title>حروفي</title>", "<title>حروفي English</title>"],
  ['content="تطبيق تعليمي للأطفال لتعلّم الحروف والكلمات العربية باللعب، يعمل بدون إنترنت"',
    'content="تطبيق للأطفال لتعلّم الإنجليزية باللعب: الحروف والأصوات والقراءة والكتابة والمفردات، يعمل بدون إنترنت"'],
  ['<meta name="theme-color" content="#ffb703">', '<meta name="theme-color" content="#219ebc">'],
  ['content="حروفي">', 'content="حروفي English">'],
  ['<link rel="preload" href="fonts/noto-naskh-arabic-arabic-700-normal.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="preload" href="fonts/andika-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>']
]);

// عامل الخدمة: بادئة مختلفة حتى لا يحذف أحد التطبيقين نسخة الآخر، وإضافة خط Andika
const fonts = readdirSync(join(SRC, "fonts")).map((f) => `"fonts/${f}"`).join(", ");
patch("sw.js", [
  ['const PREFIX = "huroofi-v";', 'const PREFIX = "huroofi-en-v";'],
  ['"fonts/noto-naskh-arabic-arabic-700-normal.woff2",', `"fonts/noto-naskh-arabic-arabic-700-normal.woff2", ${fonts},`]
]);

patch("privacy.html", [
  ["حروفي»", "حروفي English»"],
  ["من 3 إلى 8 سنوات", "من 3 إلى 12 سنة"],
  ["(صغير أو كبير)", "(صغير أو كبير أو متقدّم)"],
  ["Huroofi", "Huroofi English"],
  ["aged 3–8", "aged 3–12"],
  ['<div class="logo">🦉</div>', '<div class="logo">🐝</div>']
]);

// تأكد أن كل ملف في قائمة عامل الخدمة موجود (وإلا لن يعمل التطبيق بدون إنترنت)
const sw = readFileSync(join(OUT, "sw.js"), "utf8");
const list = [...sw.matchAll(/"([^"]+\.(?:html|json|svg|css|js|woff2|png))"/g)].map((m) => m[1]);
const missing = list.filter((f) => !existsSync(join(OUT, f)));
if (missing.length) throw new Error("build-english: missing files listed in sw.js: " + missing.join(", "));

const count = (d) => readdirSync(d).reduce((n, f) => n + (statSync(join(d, f)).isDirectory() ? count(join(d, f)) : 1), 0);
console.log(`english/www built: ${count(OUT)} files`);
