package app.enredo.editor;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

final class EditorDocuments {
    private static final String TAG = "Enredo";
    private static final int OPEN_PROJECT = 1;
    private static final int SAVE_PROJECT = 2;
    private static final int OPEN_IMAGE = 3;

    private final Activity activity;
    private final Consumer<String> notifyEditor;
    private final ExecutorService fileWorker = Executors.newSingleThreadExecutor();
    private final AtomicReference<Uri> pendingImport = new AtomicReference<>();
    private final AtomicReference<Uri> pendingImage = new AtomicReference<>();
    private final File exportDraft;

    private int pickerRequest;
    private boolean writingExport;
    private boolean closed;

    EditorDocuments(Activity activity, Bundle savedState, Consumer<String> notifyEditor) {
        this.activity = activity;
        this.notifyEditor = notifyEditor;
        if (savedState != null) pickerRequest = savedState.getInt("pickerRequest");
        String draftName = pickerRequest == SAVE_PROJECT ? savedState.getString("exportDraft") : null;
        if (draftName == null) draftName = "enredo-export-" + UUID.randomUUID() + ".json";
        exportDraft = new File(activity.getCacheDir(), draftName);
    }

    void saveState(Bundle state) {
        state.putInt("pickerRequest", pickerRequest);
        if (pickerRequest == SAVE_PROJECT) state.putString("exportDraft", exportDraft.getName());
    }

    void chooseProject() {
        if (canChooseFile()) openDocument("*/*", OPEN_PROJECT);
    }

    void chooseImage() {
        if (canChooseFile()) openDocument("image/*", OPEN_IMAGE);
        else imageFailed();
    }

    private void openDocument(String mimeType, int request) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mimeType);
        launchPicker(intent, request);
    }

    void exportProject(String filename, String json) {
        if (!canChooseFile()) return;
        writingExport = true;
        fileWorker.execute(() -> stageExport(filename, json));
    }

    private boolean canChooseFile() {
        return !closed && !activity.isDestroyed() && pickerRequest == 0 && !writingExport
                && pendingImport.get() == null && pendingImage.get() == null;
    }

    private void stageExport(String filename, String json) {
        try (OutputStream output = new FileOutputStream(exportDraft)) {
            output.write(json.getBytes(StandardCharsets.UTF_8));
        } catch (IOException | RuntimeException error) {
            Log.w(TAG, "Could not prepare export", error);
            activity.runOnUiThread(() -> finishExport(false));
            return;
        }
        activity.runOnUiThread(() -> {
            writingExport = false;
            if (closed || activity.isDestroyed()) {
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
            activity.startActivityForResult(intent, request);
        } catch (ActivityNotFoundException | SecurityException error) {
            pickerRequest = 0;
            if (request == SAVE_PROJECT) finishExport(false);
            else if (request == OPEN_IMAGE) imageFailed();
            else notifyEditor.accept("Enredo.preferences.flash('importFailed')");
        }
    }

    void onActivityResult(int request, int result, Intent data) {
        if (request != OPEN_PROJECT && request != SAVE_PROJECT && request != OPEN_IMAGE) return;
        pickerRequest = 0;
        if (result != Activity.RESULT_OK) {
            if (request == SAVE_PROJECT) exportDraft.delete();
            else if (request == OPEN_IMAGE) notifyEditor.accept("Enredo.imageEditor.cancelAndroidImage()");
            return;
        }

        Uri uri = data == null ? null : data.getData();
        boolean isDocument = uri != null && ContentResolver.SCHEME_CONTENT.equals(uri.getScheme());
        if (request == OPEN_IMAGE) {
            if (isDocument) {
                pendingImage.set(uri);
                notifyEditor.accept("Enredo.imageEditor.importAndroidImage()");
            } else {
                imageFailed();
            }
        } else if (request == OPEN_PROJECT) {
            if (isDocument) {
                pendingImport.set(uri);
                notifyEditor.accept("Enredo.projectFiles.importAndroidProject()");
            } else {
                notifyEditor.accept("Enredo.preferences.flash('importFailed')");
            }
        } else if (isDocument) {
            writingExport = true;
            fileWorker.execute(() -> writeExport(uri));
        } else {
            finishExport(false);
        }
    }

    // Only the next fetch reads the document selected in the system picker.
    Uri takeProject() {
        return pendingImport.getAndSet(null);
    }

    Uri takeImage() {
        return pendingImage.getAndSet(null);
    }

    private void writeExport(Uri uri) {
        boolean saved = false;
        try {
            try (InputStream source = new FileInputStream(exportDraft);
                 OutputStream destination = activity.getContentResolver().openOutputStream(uri, "wt")) {
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
        activity.runOnUiThread(() -> finishExport(result));
    }

    private void finishExport(boolean saved) {
        writingExport = false;
        exportDraft.delete();
        notifyEditor.accept(saved ? "Enredo.preferences.flash('exported')" : "Enredo.preferences.flash('exportFailed')");
    }

    private void imageFailed() {
        notifyEditor.accept("Enredo.imageEditor.cancelAndroidImage('imageReadFailed')");
    }

    void close() {
        closed = true;
        fileWorker.shutdown();
        pendingImport.set(null);
        pendingImage.set(null);
    }
}
