package app.enredo.editor;

import android.app.Activity;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.function.Consumer;
import java.util.stream.Collectors;

final class EditorPdfPrint {
    private static final String TAG = "Enredo";
    private final Activity activity;
    private final Consumer<String> notifyEditor;
    private WebView printView;
    private boolean closed;

    EditorPdfPrint(Activity activity, Consumer<String> notifyEditor) {
        this.activity = activity;
        this.notifyEditor = notifyEditor;
    }

    void printProject(String title, String locale, String report) {
        if (closed || activity.isDestroyed() || printView != null) return;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                activity.getAssets().open("web/css/project-pdf.css"), StandardCharsets.UTF_8))) {
            String css = reader.lines().collect(Collectors.joining("\n"));
            String lang = "pt-BR".equals(locale) ? "pt-BR" : "en";
            String html = "<!doctype html><html lang=\"" + lang + "\"><head><meta charset=\"utf-8\">"
                    + "<style>" + css + "</style></head><body class=\"pdf-document\">" + report + "</body></html>";
            byte[] content = html.getBytes(StandardCharsets.UTF_8);

            printView = new WebView(activity);
            printView.getSettings().setAllowFileAccess(false);
            printView.getSettings().setAllowContentAccess(false);
            printView.setWebViewClient(new WebViewClient() {
                private boolean started;

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return true;
                }

                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    if (request.isForMainFrame() && "GET".equals(request.getMethod())
                            && EditorWebViewClient.PDF_URL.equals(request.getUrl().toString())) {
                        return new WebResourceResponse("text/html", "UTF-8", 200, "OK",
                                Collections.singletonMap("Content-Security-Policy",
                                        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"),
                                new ByteArrayInputStream(content));
                    }
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, null);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    if (view != printView || started || !EditorWebViewClient.PDF_URL.equals(url)) return;
                    started = true;
                    startPrint(view, title);
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    if (request.isForMainFrame() && view == printView) finish(true);
                }

                @Override
                public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    if (view == printView) finish(true);
                    return true;
                }
            });
            printView.loadUrl(EditorWebViewClient.PDF_URL);
        } catch (IOException | RuntimeException error) {
            Log.w(TAG, "Could not prepare the project PDF", error);
            finish(true);
        }
    }

    private void startPrint(WebView view, String title) {
        try {
            PrintManager manager = activity.getSystemService(PrintManager.class);
            if (manager == null) {
                finish(true);
                return;
            }
            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(title);
            PrintAttributes attributes = new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .setMinMargins(new PrintAttributes.Margins(354, 0, 354, 433))
                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                    .build();
            manager.print(title, new PrintDocumentAdapter() {
                @Override
                public void onStart() {
                    adapter.onStart();
                }

                @Override
                public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                                     CancellationSignal cancellation, LayoutResultCallback callback, Bundle extras) {
                    adapter.onLayout(oldAttributes, newAttributes, cancellation, callback, extras);
                }

                @Override
                public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                                    CancellationSignal cancellation, WriteResultCallback callback) {
                    adapter.onWrite(pages, destination, cancellation, callback);
                }

                @Override
                public void onFinish() {
                    try {
                        adapter.onFinish();
                    } finally {
                        if (view == printView) finish(false);
                    }
                }
            }, attributes);
        } catch (RuntimeException error) {
            Log.w(TAG, "Could not start printing the project PDF", error);
            finish(true);
        }
    }

    private void finish(boolean failed) {
        if (printView != null) {
            WebView view = printView;
            printView = null;
            view.destroy();
        }
        if (!closed) notifyEditor.accept("Enredo.projectPdf.finishPrint(" + failed + ")");
    }

    void close() {
        closed = true;
        finish(false);
    }
}
