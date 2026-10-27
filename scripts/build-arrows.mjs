// ============================================================
//  بناء تطبيق أندرويد للعبة «فكّ المتاهة»: ينسخ ملفات اللعبة من arrows/ إلى arrows-app/www
//  (بدون ملفات التطوير)، ثم يُشغَّل: cap sync android
//  التشغيل: node scripts/build-arrows.mjs
// ============================================================
import { cpSync, rmSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "arrows");
const OUT = join(ROOT, "arrows-app", "www");
rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true, filter: (p) => !basename(p).startsWith("_") && !p.endsWith("LICENSE-three.txt.bak") });
for (const f of ["index.html", "js/main.js", "js/gen.js", "js/sound.js", "css/style.css", "privacy.html"])
  if (!existsSync(join(OUT, f))) throw new Error("build-arrows: missing " + f);
console.log("arrows-app/www ready");
