package app.enredo.editor;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Locale;
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
    private static final int SAVE_FILE = 2;
    private static final int OPEN_IMAGE = 3;
    private static final int OPEN_GALLERY_FILES = 4;

    private final Activity activity;
    private final Consumer<String> notifyEditor;
    private final ExecutorService fileWorker = Executors.newSingleThreadExecutor();
    private final AtomicReference<Uri> pendingImport = new AtomicReference<>();
    private final AtomicReference<Uri> pendingImage = new AtomicReference<>();
    private final ConcurrentLinkedQueue<Uri> pendingGalleryFiles = new ConcurrentLinkedQueue<>();
    private final File exportDraft;

    private int pickerRequest;
    private boolean writingExport;
    private boolean savingGalleryFile;
    private boolean closed;

    EditorDocuments(Activity activity, Bundle savedState, Consumer<String> notifyEditor) {
        this.activity = activity;
        this.notifyEditor = notifyEditor;
        if (savedState != null) {
            pickerRequest = savedState.getInt("pickerRequest");
            savingGalleryFile = savedState.getBoolean("savingGalleryFile");
        }
        String draftName = pickerRequest == SAVE_FILE ? savedState.getString("exportDraft") : null;
        if (draftName == null) draftName = "enredo-export-" + UUID.randomUUID() + ".json";
        exportDraft = new File(activity.getCacheDir(), draftName);
    }

    void saveState(Bundle state) {
        state.putInt("pickerRequest", pickerRequest);
        if (pickerRequest == SAVE_FILE) {
            state.putString("exportDraft", exportDraft.getName());
            state.putBoolean("savingGalleryFile", savingGalleryFile);
        }
    }

    void chooseProject() {
        if (canChooseFile()) openDocument("*/*", OPEN_PROJECT);
    }

    void chooseImage() {
        if (canChooseFile()) openDocument("image/*", OPEN_IMAGE);
        else imageFailed();
    }

    void chooseGalleryFiles(boolean includeDocuments) {
        if (canChooseFile()) openDocument(includeDocuments ? "*/*" : "image/*", OPEN_GALLERY_FILES);
        else galleryFilesFailed();
    }

    private void openDocument(String mimeType, int request) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mimeType);
        if (request == OPEN_GALLERY_FILES) intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        launchPicker(intent, request);
    }

    void exportProject(String filename, String json) {
        if (!canChooseFile()) return;
        savingGalleryFile = false;
        writingExport = true;
        fileWorker.execute(() -> stageExport(filename, "application/json", json, false));
    }

    void saveGalleryFile(String filename, String base64) {
        if (!canChooseFile()) {
            notifyEditor.accept("Enredo.mediaGallery.reportAndroidDownload(false)");
            return;
        }
        int dot = filename.lastIndexOf('.');
        String extension = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
        String mimeType = type == null ? "application/octet-stream" : type;
        savingGalleryFile = true;
        writingExport = true;
        fileWorker.execute(() -> stageExport(filename, mimeType, base64, true));
    }

    private boolean canChooseFile() {
        return !closed && !activity.isDestroyed() && pickerRequest == 0 && !writingExport
                && pendingImport.get() == null && pendingImage.get() == null && pendingGalleryFiles.isEmpty();
    }

    private void stageExport(String filename, String mimeType, String contents, boolean encoded) {
        try (OutputStream output = new FileOutputStream(exportDraft)) {
            output.write(encoded ? Base64.decode(contents, Base64.DEFAULT) : contents.getBytes(StandardCharsets.UTF_8));
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
                    .setType(mimeType)
                    .putExtra(Intent.EXTRA_TITLE, filename);
            launchPicker(intent, SAVE_FILE);
        });
    }

    @SuppressWarnings("deprecation")
    private void launchPicker(Intent intent, int request) {
        pickerRequest = request;
        try {
            activity.startActivityForResult(intent, request);
        } catch (ActivityNotFoundException | SecurityException error) {
            pickerRequest = 0;
            if (request == SAVE_FILE) finishExport(false);
            else if (request == OPEN_IMAGE) imageFailed();
            else if (request == OPEN_GALLERY_FILES) galleryFilesFailed();
            else notifyEditor.accept("Enredo.preferences.flash('importFailed')");
        }
    }

    void onActivityResult(int request, int result, Intent data) {
        if (request != OPEN_PROJECT && request != SAVE_FILE && request != OPEN_IMAGE && request != OPEN_GALLERY_FILES) return;
        pickerRequest = 0;
        if (result != Activity.RESULT_OK) {
            if (request == SAVE_FILE) exportDraft.delete();
            else if (request == OPEN_IMAGE) notifyEditor.accept("Enredo.imageEditor.cancelAndroidImage()");
            else if (request == OPEN_GALLERY_FILES) notifyEditor.accept("Enredo.mediaGallery.cancelAndroidFiles()");
            return;
        }

        if (request == OPEN_GALLERY_FILES) {
            acceptGalleryFiles(data);
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

    private void acceptGalleryFiles(Intent data) {
        Set<Uri> files = new LinkedHashSet<>();
        ClipData clip = data == null ? null : data.getClipData();
        if (clip != null) {
            for (int index = 0; index < clip.getItemCount(); index++) {
                Uri uri = clip.getItemAt(index).getUri();
                if (isContentDocument(uri)) files.add(uri);
            }
        }
        Uri single = data == null ? null : data.getData();
        if (isContentDocument(single)) files.add(single);
        if (files.isEmpty()) {
            galleryFilesFailed();
            return;
        }
        pendingGalleryFiles.addAll(files);
        notifyEditor.accept("Enredo.mediaGallery.importAndroidFiles(" + files.size() + ")");
    }

    // Only the next fetch reads the document selected in the system picker.
    Uri takeProject() {
        return pendingImport.getAndSet(null);
    }

    Uri takeImage() {
        return pendingImage.getAndSet(null);
    }

    Uri takeGalleryFile() {
        return pendingGalleryFiles.poll();
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
        if (savingGalleryFile) {
            notifyEditor.accept("Enredo.mediaGallery.reportAndroidDownload(" + saved + ")");
        } else {
            notifyEditor.accept(saved ? "Enredo.preferences.flash('exported')" : "Enredo.preferences.flash('exportFailed')");
        }
    }

    private void imageFailed() {
        notifyEditor.accept("Enredo.imageEditor.cancelAndroidImage('imageReadFailed')");
    }

    private void galleryFilesFailed() {
        notifyEditor.accept("Enredo.mediaGallery.cancelAndroidFiles(true)");
    }

    void close() {
        closed = true;
        fileWorker.shutdown();
        pendingImport.set(null);
        pendingImage.set(null);
        pendingGalleryFiles.clear();
    }
}
