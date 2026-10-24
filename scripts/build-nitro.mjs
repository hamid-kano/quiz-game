// ============================================================
//  بناء تطبيق أندرويد للعبة «نيترو»: ينسخ ملفات اللعبة من nitro/ إلى nitro-app/www
//  (بدون ملفات التطوير)، ثم يُشغَّل: cap sync android
//  التشغيل: node scripts/build-nitro.mjs
// ============================================================
import { cpSync, rmSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "nitro");
const OUT = join(ROOT, "nitro-app", "www");
rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true, filter: (p) => !basename(p).startsWith("_") && !p.endsWith("LICENSE-three.txt.bak") });
for (const f of ["index.html", "js/main.js", "lib/three.module.min.js", "models/vehicle-truck-red.glb", "audio/engine.wav", "privacy.html"])
  if (!existsSync(join(OUT, f))) throw new Error("build-nitro: missing " + f);
console.log("nitro-app/www ready");
