package app.enredo.editor;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

final class EditorWebViewClient extends WebViewClient {
    private static final String TAG = "Enredo";
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    static final String EDITOR_URL = ORIGIN + "/index.html";
    static final String PDF_URL = ORIGIN + "/project-pdf.html";

    private static final String IMPORT_URL = ORIGIN + "/project-import.json";
    private static final String IMAGE_URL = ORIGIN + "/node-image";
    private static final String GALLERY_FILE_URL = ORIGIN + "/gallery-file";
    private static final Pattern WEB_ASSET = Pattern.compile("web/(css|js)/[a-z][a-z0-9-]*\\.(css|js)");
    private static final String POLICY = "default-src 'none'; script-src 'self'; "
            + "style-src 'self' 'unsafe-inline'; img-src data: blob:; connect-src 'self'; "
            + "base-uri 'none'; form-action 'none'";
    private static final Map<String, String> NO_CACHE = Collections.singletonMap("Cache-Control", "no-store");

    private final Context context;
    private final EditorDocuments documents;
    private final Runnable editorReady;

    EditorWebViewClient(Context context, EditorDocuments documents, Runnable editorReady) {
        this.context = context;
        this.documents = documents;
        this.editorReady = editorReady;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return true;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        if (!"GET".equals(request.getMethod())) return unavailable(405, "Method Not Allowed");
        try {
            if (request.isForMainFrame()) {
                if (EDITOR_URL.equals(url)) return openEditor();
                return unavailable(404, "Not Found");
            }
            if (IMPORT_URL.equals(url)) {
                return readPickedDocument(documents.takeProject(), "application/json", "UTF-8", NO_CACHE);
            }
            if (IMAGE_URL.equals(url)) {
                return readPickedDocument(documents.takeImage(), null, null, NO_CACHE);
            }
            if (GALLERY_FILE_URL.equals(url)) {
                Uri uri = documents.takeGalleryFile();
                return readPickedDocument(uri, null, null, galleryFileHeaders(uri));
            }
            if (url.startsWith(ORIGIN + "/")) {
                String asset = url.substring(ORIGIN.length() + 1);
                if (WEB_ASSET.matcher(asset).matches()) {
                    String mimeType = asset.endsWith(".css") ? "text/css" : "text/javascript";
                    return new WebResourceResponse(mimeType, "UTF-8", 200, "OK", NO_CACHE,
                            context.getAssets().open(asset));
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
        if (EDITOR_URL.equals(url)) editorReady.run();
    }

    private WebResourceResponse openEditor() throws IOException {
        Map<String, String> headers = new HashMap<>(NO_CACHE);
        headers.put("Content-Security-Policy", POLICY);
        return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers,
                context.getAssets().open("index.html"));
    }

    private Map<String, String> galleryFileHeaders(Uri uri) {
        if (uri == null) return NO_CACHE;
        try (Cursor cursor = context.getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                String name = column < 0 ? null : cursor.getString(column);
                if (name != null) {
                    Map<String, String> headers = new HashMap<>(NO_CACHE);
                    headers.put("X-Enredo-File-Name", Uri.encode(name));
                    return headers;
                }
            }
        } catch (RuntimeException error) {
            Log.w(TAG, "Could not read gallery attachment name", error);
        }
        return NO_CACHE;
    }

    private WebResourceResponse readPickedDocument(Uri uri, String mimeType, String encoding,
                                                   Map<String, String> headers) throws IOException {
        if (uri != null) {
            if (mimeType == null) {
                String detectedType = context.getContentResolver().getType(uri);
                mimeType = detectedType != null && detectedType.startsWith("image/")
                        ? detectedType : "application/octet-stream";
            }
            InputStream document = context.getContentResolver().openInputStream(uri);
            if (document != null) {
                return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, document);
            }
        }
        return unavailable(404, "Not Found");
    }

    private static WebResourceResponse unavailable(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, NO_CACHE, null);
    }
}
