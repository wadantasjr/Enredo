package app.enredo.editor;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

public final class MainActivity extends Activity {
    private EditorWebView editor;
    private EditorDocuments documents;

    @Override
    protected void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        editor = new EditorWebView(this);
        documents = new EditorDocuments(this, savedState, editor::evaluateWhenReady);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundResource(R.color.window_background);
        root.addView(editor.view(), new FrameLayout.LayoutParams(-1, -1));
        EditorWindow.configureInsets(this, root);
        setContentView(root);

        editor.open(documents, new EditorBridge(this, documents));
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::onBackPressed);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        documents.saveState(state);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        editor.handleBack(() -> moveTaskToBack(true));
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        documents.onActivityResult(request, result, data);
    }

    @Override
    protected void onDestroy() {
        documents.close();
        editor.close();
        super.onDestroy();
    }
}
