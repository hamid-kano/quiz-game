"""تشغيل كل الاختبارات. يخرج برمز خطأ إذا فشل أي اختبار (يمنع النشر في GitHub Actions).
اختبارات المتصفح تعتمد على التوقيت، وأجهزة GitHub أبطأ وأقل ثباتاً، لذلك يُعاد الاختبار الفاشل مرة واحدة،
ويُكتب سبب الفشل كملاحظة (annotation) تظهر في صفحة البناء."""
import subprocess, sys, os, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from helpers import start_server, APP

TESTS = ["test_content.py", "test_native.py", "test_layout.py", "test_speech.py", "test_writing_check.py", "test_activities.py", "test_qawafil.py"]
only = sys.argv[1:]
server = start_server()
failed = []
CI = os.environ.get("GITHUB_ACTIONS") == "true"

def run(t):
    p = subprocess.Popen([sys.executable, "-u", os.path.join(HERE, t)], cwd=HERE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    lines = []
    for line in p.stdout:
        print(line, end="", flush=True)
        lines.append(line.rstrip())
    return p.wait(), lines

for t in TESTS:
    if only and t not in only: continue
    for attempt in (1, 2):
        t0 = time.time()
        print(f"\n=== {t} ({APP}){' — retry' if attempt == 2 else ''} ===", flush=True)
        code, lines = run(t)
        ok = code == 0
        print(f"--- {t}: {'PASS' if ok else 'FAIL'} ({int(time.time() - t0)}s)", flush=True)
        if not ok and CI:
            why = " | ".join(l for l in lines if any(k in l for k in ("FAIL", "problem", "error", "Error", "failed")))[-900:] or " | ".join(lines[-5:])[-900:]
            level = "warning" if attempt == 1 else "error"
            print(f"::{level} title={APP}/{t} attempt {attempt}::{why}", flush=True)
        if ok: break
    if not ok: failed.append(t)
print("\nALL PASSED" if not failed else f"\nFAILED: {failed}")
sys.exit(1 if failed else 0)
