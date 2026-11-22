package app.enredo.editor;

import android.app.Activity;
import android.graphics.Insets;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;

final class EditorWindow {
    private EditorWindow() {}

    static void configureInsets(Activity activity, View root) {
        if (Build.VERSION.SDK_INT < 30) return;
        activity.getWindow().setDecorFitsSystemWindows(false);
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

    @SuppressWarnings("deprecation")
    static void setDiagramFullscreen(Activity activity, boolean fullscreen) {
        if (activity.isDestroyed()) return;
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = activity.getWindow().getInsetsController();
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
            View decor = activity.getWindow().getDecorView();
            int visibility = decor.getSystemUiVisibility();
            int immersive = View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            decor.setSystemUiVisibility(fullscreen ? visibility | immersive : visibility & ~immersive);
        }
    }
}
