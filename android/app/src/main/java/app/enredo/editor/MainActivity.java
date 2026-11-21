package app.enredo.editor;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

public final class MainActivity extends Activity {
    private static final String TAG = "Enredo";
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String EDITOR_URL = ORIGIN + "/index.html";
    private static final String IMPORT_URL = ORIGIN + "/project-import.json";
    private static final String PORTRAIT_URL = ORIGIN + "/character-portrait";
    private static final String POLICY = "default-src 'none'; script-src 'unsafe-inline'; "
            + "style-src 'unsafe-inline'; img-src data:; connect-src 'self'; "
            + "base-uri 'none'; form-action 'none'";
    private static final Map<String, String> NO_CACHE = Collections.singletonMap("Cache-Control", "no-store");
    private static final int OPEN_PROJECT = 1;
    private static final int SAVE_PROJECT = 2;
    private static final int OPEN_PORTRAIT = 3;

    private final ExecutorService fileWorker = Executors.newSingleThreadExecutor();
    private final AtomicReference<Uri> pendingImport = new AtomicReference<>();
    private final AtomicReference<Uri> pendingPortrait = new AtomicReference<>();
    private WebView editor;
    private File exportDraft;
    private boolean editorReady;
    private boolean writingExport;
    private int pickerRequest;
    private String pendingEditorAction;

    @Override
    protected void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        if (savedState != null) pickerRequest = savedState.getInt("pickerRequest");
        String draftName = pickerRequest == SAVE_PROJECT ? savedState.getString("exportDraft") : null;
        if (draftName == null) draftName = "enredo-export-" + UUID.randomUUID() + ".json";
        exportDraft = new File(getCacheDir(), draftName);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundResource(R.color.window_background);
        editor = new WebView(this);
        root.addView(editor, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                int system = WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout();
                Insets safe = insets.getInsets(system);
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, keyboard.bottom));
                return new WindowInsets.Builder(insets)
                        .setInsets(system | WindowInsets.Type.ime(), Insets.NONE)
                        .build();
            });
        }
        setContentView(root);

        WebSettings settings = editor.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        editor.setWebChromeClient(new WebChromeClient());
        editor.setWebViewClient(new EditorClient());
        editor.addJavascriptInterface(new EditorBridge(), "EnredoAndroid");
        editor.loadUrl(EDITOR_URL);

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::navigateBack);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        state.putInt("pickerRequest", pickerRequest);
        if (pickerRequest == SAVE_PROJECT) state.putString("exportDraft", exportDraft.getName());
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        navigateBack();
    }

    private void navigateBack() {
        if (!editorReady) {
            moveTaskToBack(true);
            return;
        }
        editor.evaluateJavascript("handleAndroidBack()", result -> {
            if (!"true".equals(result) && !isDestroyed()) moveTaskToBack(true);
        });
    }

    @SuppressWarnings("deprecation")
    private void setDiagramSystemBars(boolean fullscreen) {
        if (isDestroyed()) return;
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller == null) return;
            int bars = WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars();
            if (fullscreen) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(bars);
            } else {
                controller.show(bars);
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_DEFAULT);
            }
        } else {
            View decor = getWindow().getDecorView();
            int visibility = decor.getSystemUiVisibility();
            int immersive = View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            decor.setSystemUiVisibility(fullscreen ? visibility | immersive : visibility & ~immersive);
        }
    }

    public final class EditorBridge {
        @JavascriptInterface
        public void setDiagramFullscreen(boolean fullscreen) {
            runOnUiThread(() -> setDiagramSystemBars(fullscreen));
        }

        @JavascriptInterface
        public void chooseImport() {
            runOnUiThread(() -> {
                if (!canChooseFile()) return;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("*/*");
                launchPicker(intent, OPEN_PROJECT);
            });
        }

        @JavascriptInterface
        public void choosePortrait() {
            runOnUiThread(() -> {
                if (!canChooseFile()) {
                    runEditorAction("cancelAndroidPortrait(true)");
                    return;
                }
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("image/*")
                        .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/jpeg", "image/png", "image/webp"});
                launchPicker(intent, OPEN_PORTRAIT);
            });
        }

        @JavascriptInterface
        public void exportProject(String filename, String json) {
            runOnUiThread(() -> {
                if (!canChooseFile()) return;
                writingExport = true;
                fileWorker.execute(() -> stageExport(filename, json));
            });
        }
    }

    private boolean canChooseFile() {
        return !isDestroyed() && pickerRequest == 0 && !writingExport
                && pendingImport.get() == null && pendingPortrait.get() == null;
    }

    private void stageExport(String filename, String json) {
        try (OutputStream output = new FileOutputStream(exportDraft)) {
            output.write(json.getBytes(StandardCharsets.UTF_8));
        } catch (IOException | RuntimeException error) {
            Log.w(TAG, "Could not prepare export", error);
            runOnUiThread(() -> {
                writingExport = false;
                finishExport(false);
            });
            return;
        }
        runOnUiThread(() -> {
            writingExport = false;
            if (isDestroyed()) {
                exportDraft.delete();
                return;
            }
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/json")
                    .putExtra(Intent.EXTRA_TITLE, filename);
            launchPicker(intent, SAVE_PROJECT);
        });
    }

    @SuppressWarnings("deprecation")
    private void launchPicker(Intent intent, int request) {
        pickerRequest = request;
        try {
            startActivityForResult(intent, request);
        } catch (ActivityNotFoundException | SecurityException error) {
            pickerRequest = 0;
            if (request == SAVE_PROJECT) finishExport(false);
            else if (request == OPEN_PORTRAIT) runEditorAction("cancelAndroidPortrait(true)");
            else runEditorAction("flash('importFailed')");
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != OPEN_PROJECT && request != SAVE_PROJECT && request != OPEN_PORTRAIT) return;
        pickerRequest = 0;
        if (result != RESULT_OK) {
            if (request == SAVE_PROJECT) exportDraft.delete();
            else if (request == OPEN_PORTRAIT) runEditorAction("cancelAndroidPortrait()");
            return;
        }
        Uri uri = data == null ? null : data.getData();
        boolean isDocument = uri != null && ContentResolver.SCHEME_CONTENT.equals(uri.getScheme());
        if (request == OPEN_PORTRAIT) {
            if (isDocument) {
                pendingPortrait.set(uri);
                runEditorAction("receiveAndroidPortrait()");
            } else {
                runEditorAction("cancelAndroidPortrait(true)");
            }
        } else if (request == OPEN_PROJECT) {
            if (isDocument) {
                pendingImport.set(uri);
                runEditorAction("importAndroidProject()");
            } else {
                runEditorAction("flash('importFailed')");
            }
        } else if (isDocument) {
            writingExport = true;
            fileWorker.execute(() -> writeExport(uri));
        } else {
            finishExport(false);
        }
    }

    private void writeExport(Uri uri) {
        boolean saved = false;
        try {
            try (InputStream source = new FileInputStream(exportDraft);
                 OutputStream destination = getContentResolver().openOutputStream(uri, "wt")) {
                if (destination == null) throw new IOException("No output stream for export");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = source.read(buffer)) != -1) destination.write(buffer, 0, count);
            }
            saved = true;
        } catch (IOException | SecurityException error) {
            Log.w(TAG, "Could not write export", error);
        }
        boolean result = saved;
        runOnUiThread(() -> {
            writingExport = false;
            finishExport(result);
        });
    }

    private void finishExport(boolean saved) {
        exportDraft.delete();
        runEditorAction(saved ? "flash('exported')" : "flash('exportFailed')");
    }

    private void runEditorAction(String script) {
        if (isDestroyed()) return;
        if (editorReady) editor.evaluateJavascript(script, null);
        else pendingEditorAction = script;
    }

    private final class EditorClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            if (!"GET".equals(request.getMethod())) return unavailable(405, "Method Not Allowed");
            try {
                if (request.isForMainFrame() && EDITOR_URL.equals(url)) {
                    Map<String, String> headers = new HashMap<>(NO_CACHE);
                    headers.put("Content-Security-Policy", POLICY);
                    return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers,
                            getAssets().open("index.html"));
                }
                if (!request.isForMainFrame() && IMPORT_URL.equals(url)) {
                    // Only the next fetch can read the document selected in the system picker.
                    Uri uri = pendingImport.getAndSet(null);
                    if (uri != null) {
                        InputStream document = getContentResolver().openInputStream(uri);
                        if (document != null) {
                            return new WebResourceResponse("application/json", "UTF-8", 200, "OK",
                                    NO_CACHE, document);
                        }
                    }
                }
                if (!request.isForMainFrame() && PORTRAIT_URL.equals(url)) {
                    Uri uri = pendingPortrait.getAndSet(null);
                    if (uri != null) {
                        InputStream image = getContentResolver().openInputStream(uri);
                        if (image != null) {
                            return new WebResourceResponse("application/octet-stream", null, 200, "OK", NO_CACHE, image);
                        }
                    }
                }
            } catch (IOException | SecurityException error) {
                Log.w(TAG, "Could not read local content", error);
                return unavailable(500, "Read Failed");
            }
            return unavailable(404, "Not Found");
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (!EDITOR_URL.equals(url)) return;
            editorReady = true;
            if (pendingEditorAction != null) {
                runEditorAction(pendingEditorAction);
                pendingEditorAction = null;
            }
        }
    }

    private static WebResourceResponse unavailable(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, NO_CACHE, null);
    }

    @Override
    protected void onDestroy() {
        fileWorker.shutdown();
        editorReady = false;
        pendingImport.set(null);
        pendingPortrait.set(null);
        editor.removeJavascriptInterface("EnredoAndroid");
        ((FrameLayout) editor.getParent()).removeView(editor);
        editor.destroy();
        super.onDestroy();
    }
}
