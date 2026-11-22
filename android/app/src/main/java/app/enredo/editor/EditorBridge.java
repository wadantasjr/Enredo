package app.enredo.editor;

import android.app.Activity;
import android.webkit.JavascriptInterface;

public final class EditorBridge {
    private final Activity activity;
    private final EditorDocuments documents;

    EditorBridge(Activity activity, EditorDocuments documents) {
        this.activity = activity;
        this.documents = documents;
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
    public void exportProject(String filename, String json) {
        activity.runOnUiThread(() -> documents.exportProject(filename, json));
    }
}
