(() => {
  'use strict';

  const { platform, dom, preferences, store, workspace, structure, diagram, diagramInput,
    dialogs, projects, storyBeats, paths, imageEditor, projectFiles } = Enredo;

  platform.initialize();
  dom.renderIcons();
  for (const feature of [preferences, store, projects, storyBeats, paths, structure, dialogs,
    imageEditor, projectFiles, workspace, diagram, diagramInput]) feature.bindEvents();

  preferences.applyFontSize();
  preferences.applyTheme();
  preferences.setupThemeListener();
  preferences.renderLanguage();
  store.save();
  workspace.render(true);
})();
