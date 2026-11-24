package app.enredo.editor;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
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
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

final class EditorDocuments {
    private static final String TAG = "Enredo";
    private static final int OPEN_PROJECT = 1;
    private static final int SAVE_PROJECT = 2;
    private static final int OPEN_IMAGE = 3;
    private static final int OPEN_GALLERY_IMAGES = 4;

    private final Activity activity;
    private final Consumer<String> notifyEditor;
    private final ExecutorService fileWorker = Executors.newSingleThreadExecutor();
    private final AtomicReference<Uri> pendingImport = new AtomicReference<>();
    private final AtomicReference<Uri> pendingImage = new AtomicReference<>();
    private final ConcurrentLinkedQueue<Uri> pendingGalleryImages = new ConcurrentLinkedQueue<>();
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

    void chooseImages() {
        if (canChooseFile()) openDocument("image/*", OPEN_GALLERY_IMAGES);
        else galleryImagesFailed();
    }

    private void openDocument(String mimeType, int request) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mimeType);
        if (request == OPEN_GALLERY_IMAGES) intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        launchPicker(intent, request);
    }

    void exportProject(String filename, String json) {
        if (!canChooseFile()) return;
        writingExport = true;
        fileWorker.execute(() -> stageExport(filename, json));
    }

    private boolean canChooseFile() {
        return !closed && !activity.isDestroyed() && pickerRequest == 0 && !writingExport
                && pendingImport.get() == null && pendingImage.get() == null && pendingGalleryImages.isEmpty();
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
            else if (request == OPEN_GALLERY_IMAGES) galleryImagesFailed();
            else notifyEditor.accept("Enredo.preferences.flash('importFailed')");
        }
    }

    void onActivityResult(int request, int result, Intent data) {
        if (request != OPEN_PROJECT && request != SAVE_PROJECT && request != OPEN_IMAGE && request != OPEN_GALLERY_IMAGES) return;
        pickerRequest = 0;
        if (result != Activity.RESULT_OK) {
            if (request == SAVE_PROJECT) exportDraft.delete();
            else if (request == OPEN_IMAGE) notifyEditor.accept("Enredo.imageEditor.cancelAndroidImage()");
            else if (request == OPEN_GALLERY_IMAGES) notifyEditor.accept("Enredo.imageGallery.cancelAndroidImages()");
            return;
        }

        if (request == OPEN_GALLERY_IMAGES) {
            acceptGalleryImages(data);
            return;
        }

        Uri uri = data == null ? null : data.getData();
        boolean isDocument = isContentDocument(uri);
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

    private static boolean isContentDocument(Uri uri) {
        return uri != null && ContentResolver.SCHEME_CONTENT.equals(uri.getScheme());
    }

    private void acceptGalleryImages(Intent data) {
        Set<Uri> images = new LinkedHashSet<>();
        ClipData clip = data == null ? null : data.getClipData();
        if (clip != null) {
            for (int index = 0; index < clip.getItemCount(); index++) {
                Uri uri = clip.getItemAt(index).getUri();
                if (isContentDocument(uri)) images.add(uri);
            }
        }
        Uri single = data == null ? null : data.getData();
        if (isContentDocument(single)) images.add(single);
        if (images.isEmpty()) {
            galleryImagesFailed();
            return;
        }
        pendingGalleryImages.addAll(images);
        notifyEditor.accept("Enredo.imageGallery.importAndroidImages(" + images.size() + ")");
    }

    // Only the next fetch reads the document selected in the system picker.
    Uri takeProject() {
        return pendingImport.getAndSet(null);
    }

    Uri takeImage() {
        return pendingImage.getAndSet(null);
    }

    Uri takeGalleryImage() {
        return pendingGalleryImages.poll();
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

    private void galleryImagesFailed() {
        notifyEditor.accept("Enredo.imageGallery.cancelAndroidImages('imageReadFailed')");
    }

    void close() {
        closed = true;
        fileWorker.shutdown();
        pendingImport.set(null);
        pendingImage.set(null);
        pendingGalleryImages.clear();
    }
}
