(async () => {
  'use strict';

  const { platform, dom, preferences, store, workspace, structure, mapGrouping, diagram, diagramInput,
    dialogs, projects, storyBeats, paths, imageEditor, imageGallery, characters, projectManagement, projectFiles, chapterGroups } = Enredo;

  platform.initialize();
  dom.renderIcons();
  await store.initialize();
  for (const feature of [preferences, store, projects, storyBeats, paths, structure, dialogs,
    imageEditor, imageGallery, characters, projectManagement, projectFiles, chapterGroups, workspace, mapGrouping, diagram, diagramInput]) feature.bindEvents();

  preferences.applyFontSize();
  preferences.applyTheme();
  preferences.setupThemeListener();
  preferences.renderLanguage();
  workspace.render(true);
})();
