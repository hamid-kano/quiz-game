"""تشغيل كل الاختبارات. يخرج برمز خطأ إذا فشل أي اختبار (يمنع النشر في GitHub Actions)."""
import subprocess, sys, os, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from helpers import start_server

TESTS = ["test_content.py", "test_native.py", "test_layout.py", "test_speech.py", "test_writing_check.py", "test_activities.py"]
only = sys.argv[1:]
server = start_server()
failed = []
for t in TESTS:
    if only and t not in only: continue
    t0 = time.time()
    print(f"\n=== {t} ===", flush=True)
    r = subprocess.run([sys.executable, os.path.join(HERE, t)], cwd=HERE)
    print(f"--- {t}: {'PASS' if r.returncode == 0 else 'FAIL'} ({int(time.time() - t0)}s)", flush=True)
    if r.returncode != 0: failed.append(t)
print("\nALL PASSED" if not failed else f"\nFAILED: {failed}")
sys.exit(1 if failed else 0)
