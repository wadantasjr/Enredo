package app.enredo.editor;

import android.app.Activity;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

final class EditorWebView {
    private static final String BRIDGE_NAME = "EnredoAndroid";

    private final Activity activity;
    private final WebView view;
    private boolean ready;
    private boolean closed;
    private String pendingAction;

    EditorWebView(Activity activity) {
        this.activity = activity;
        view = new WebView(activity);
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        view.setWebChromeClient(new WebChromeClient());
    }

    WebView view() {
        return view;
    }

    void open(EditorDocuments documents, EditorBridge bridge) {
        view.setWebViewClient(new EditorWebViewClient(activity, documents, this::onReady));
        view.addJavascriptInterface(bridge, BRIDGE_NAME);
        view.loadUrl(EditorWebViewClient.EDITOR_URL);
    }

    void handleBack(Runnable fallback) {
        if (!ready) {
            fallback.run();
            return;
        }
        view.evaluateJavascript("Enredo.platform.handleAndroidBack()", result -> {
            if (!"true".equals(result) && !closed && !activity.isDestroyed()) fallback.run();
        });
    }

    void evaluateWhenReady(String script) {
        if (closed || activity.isDestroyed()) return;
        if (ready) view.evaluateJavascript(script, null);
        else pendingAction = script;
    }

    private void onReady() {
        if (closed) return;
        ready = true;
        if (pendingAction != null) {
            evaluateWhenReady(pendingAction);
            pendingAction = null;
        }
    }

    void close() {
        closed = true;
        ready = false;
        pendingAction = null;
        view.removeJavascriptInterface(BRIDGE_NAME);
        ((FrameLayout) view.getParent()).removeView(view);
        view.destroy();
    }
}
