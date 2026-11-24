(async () => {
  'use strict';

  const { platform, dom, preferences, store, workspace, structure, mapGrouping, diagram, diagramInput,
    dialogs, projects, storyBeats, paths, imageEditor, mediaGallery, characters, projectManagement, projectFiles, chapterGroups, projectPdf } = Enredo;

  platform.initialize();
  dom.renderIcons();
  await store.initialize();
  for (const feature of [preferences, store, projects, storyBeats, paths, structure, dialogs,
    imageEditor, mediaGallery, characters, projectManagement, projectFiles, chapterGroups, projectPdf, workspace, mapGrouping, diagram, diagramInput]) feature.bindEvents();

  preferences.applyFontSize();
  preferences.applyTheme();
  preferences.setupThemeListener();
  preferences.renderLanguage();
  workspace.render(true);
})();
