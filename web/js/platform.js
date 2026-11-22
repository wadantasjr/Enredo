Enredo.platform = ((app) => {
  'use strict';

  const { $ } = app.dom;

  const android = window.EnredoAndroid;

  function handleAndroidBack() {
    if ($('imageViewer').open) $('imageViewer').close();
    else if ($('dialog').open) app.dialogs.closeDialog();
    else if (document.querySelector('[data-menu][aria-expanded="true"]')) app.workspace.closeMenus();
    else if (app.session.connectMode) app.diagramInput.toggleConnect();
    else if (app.session.diagramFullscreen) app.workspace.setDiagramFullscreen(false);
    else if (!app.session.atHome && app.session.charactersOpen) app.characters.goBack();
    else if (!app.session.atHome && app.session.isStructureView()) {
      app.workspace.switchView(app.store.chapter() ? app.session.lastMapMode : 'timeline');
      $(app.session.isWholeStory() ? 'overviewTab' : 'currentTab').focus();
    }
    else if (!app.session.atHome) app.workspace.openHome();
    else return false;
    return true;
  }

  function initialize() {
    if (!android) return;
    document.documentElement.classList.add('android');
    $('graphHint').dataset.i18n = 'touchGraphHint';
    $('storageLocation').dataset.i18n = 'storedOnDevice';
  }

  return {
    android,
    handleAndroidBack,
    initialize
  };
})(Enredo);
