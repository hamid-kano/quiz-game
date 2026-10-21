#!/usr/bin/env bash
# ============================================================
# ينشئ مفتاح الرفع (upload key) لتطبيق حروفي، ويطبع القيم المطلوبة لأسرار GitHub.
# شغّله مرة واحدة فقط على جهازك (يحتاج Java/JDK لأمر keytool).
# احفظ ملف المفتاح وكلمة المرور في مكان آمن: بدونهما لا يمكن رفع تحديثات للتطبيق.
# ============================================================
set -euo pipefail
KEYSTORE="huroofi-upload.jks"
ALIAS="huroofi-upload"
if [ -f "$KEYSTORE" ]; then echo "الملف $KEYSTORE موجود مسبقاً، لن أستبدله."; exit 1; fi
read -r -s -p "اختر كلمة مرور قوية للمفتاح (12 حرفاً على الأقل): " PASS; echo
read -r -s -p "أعد كتابتها: " PASS2; echo
[ "$PASS" = "$PASS2" ] || { echo "كلمتا المرور غير متطابقتين"; exit 1; }
[ ${#PASS} -ge 12 ] || { echo "كلمة المرور قصيرة"; exit 1; }
keytool -genkeypair -v -keystore "$KEYSTORE" -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=Huroofi, O=Huroofi, C=SY"
echo
echo "تم إنشاء $KEYSTORE. أضف هذه الأسرار في GitHub:"
echo "  المستودع ← Settings ← Secrets and variables ← Actions ← New repository secret"
echo
echo "ANDROID_KEY_ALIAS          = $ALIAS"
echo "ANDROID_KEYSTORE_PASSWORD  = (كلمة المرور التي اخترتها)"
echo "ANDROID_KEY_PASSWORD       = (كلمة المرور نفسها)"
echo "ANDROID_KEYSTORE_BASE64    = محتوى الملف huroofi-upload.jks.base64.txt"
base64 -w0 "$KEYSTORE" > huroofi-upload.jks.base64.txt 2>/dev/null || base64 -i "$KEYSTORE" | tr -d '\n' > huroofi-upload.jks.base64.txt
echo
echo "بعد إضافة الأسرار، كل بناء جديد سيُنتج ملف AAB موقّعاً جاهزاً للرفع إلى المتجر."
echo "احذف ملف base64 بعد نسخه، واحتفظ بملف jks وكلمة المرور في مكان آمن (مثلاً مدير كلمات مرور)."
