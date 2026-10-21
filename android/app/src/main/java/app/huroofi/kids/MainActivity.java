package app.huroofi.kids;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // أقصى تكبير للخط نحترمه من إعدادات الجوال (التصميم مختبَر حتى 130%)
    private static final int MAX_TEXT_ZOOM = 130;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyTextZoom();
    }

    @Override
    public void onResume() {
        super.onResume();
        // المستخدم قد يغيّر حجم الخط من الإعدادات ثم يعود للتطبيق
        applyTextZoom();
    }

    private void applyTextZoom() {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        float scale = getResources().getConfiguration().fontScale;
        int zoom = Math.round(scale * 100);
        WebSettings settings = webView.getSettings();
        settings.setTextZoom(Math.max(85, Math.min(zoom, MAX_TEXT_ZOOM)));
    }
}
