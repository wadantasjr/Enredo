package app.enredo.editor;

import android.app.Activity;
import android.webkit.JavascriptInterface;

public final class EditorBridge {
    private final Activity activity;
    private final EditorDocuments documents;
    private final EditorPdfPrint pdfPrint;

    EditorBridge(Activity activity, EditorDocuments documents, EditorPdfPrint pdfPrint) {
        this.activity = activity;
        this.documents = documents;
        this.pdfPrint = pdfPrint;
    }

    @JavascriptInterface
    public void setDiagramFullscreen(boolean fullscreen) {
        activity.runOnUiThread(() -> EditorWindow.setDiagramFullscreen(activity, fullscreen));
    }

    @JavascriptInterface
    public void chooseImport() {
        activity.runOnUiThread(documents::chooseProject);
    }

    @JavascriptInterface
    public void chooseImage() {
        activity.runOnUiThread(documents::chooseImage);
    }

    @JavascriptInterface
    public void chooseGalleryFiles(boolean includeDocuments) {
        activity.runOnUiThread(() -> documents.chooseGalleryFiles(includeDocuments));
    }

    @JavascriptInterface
    public void saveGalleryFile(String filename, String base64) {
        activity.runOnUiThread(() -> documents.saveGalleryFile(filename, base64));
    }

    @JavascriptInterface
    public void exportProject(String filename, String json) {
        activity.runOnUiThread(() -> documents.exportProject(filename, json));
    }

    @JavascriptInterface
    public void printProject(String title, String locale, String report) {
        activity.runOnUiThread(() -> pdfPrint.printProject(title, locale, report));
    }
}
