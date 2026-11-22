# Working on Enredo

## Architecture

- Enredo is an offline editor that opens directly from `index.html` in a browser. Keep the shared editor in plain HTML, CSS, and JavaScript. Changes to the editor must work without a server, a network connection, or a bundler.
- Keep HTML markup in `index.html`, styles in the relevant file under `web/css/`, and behavior in the relevant module under `web/js/`. Follow the existing `Enredo` module pattern and expose only the functions other modules call. Register new shared scripts and styles in `index.html` in dependency order.
- Android packages the same editor. Put Android-specific window, WebView, bridge, and document-picker behavior in the corresponding Java class under `android/app/src/main/java/app/enredo/editor/`. Keep the WebView origin stable so Android updates can read saved projects and images.

## Interface and saved data

- Use the existing controls, theme variables, and labels. Add English and Brazilian Portuguese strings to `web/js/messages.js`, and update both README languages when a user-facing workflow changes.
- Preserve existing project data and support importing older Enredo JSON backups. Keep editor preferences separate from story data, and keep original images in IndexedDB. Backups with original images use version 2. Backups without originals use version 1.
- When changing the diagram or its details panel, check Timeline, Whole story, and full screen. Check narrow and wide layouts and make sure selecting a beat keeps the diagram controls accessible.

## Verification and commits

- Test the offline browser entry point. For changes to project files, test export and reimport and open an older backup. For shared asset or packaging changes, run `pwsh -File ./scripts/build-html.ps1` and, when the SDK and JDK are available, `pwsh -File ./android/build.ps1`.
- Keep generated HTML, APKs, build output, and signing keys out of Git.
- Write commit titles and bodies in English. Follow the recent history with a short imperative subject such as `feat: add ...`, `fix: correct ...`, or `chore: update ...`. Use the body to explain other changes and compatibility decisions when needed.
