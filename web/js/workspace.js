Enredo.workspace = ((app) => {
  'use strict';

  const { $, esc, number, icon, bindActions } = app.dom;
  const { t, tx } = app.preferences;

  function resetEditor() {
    app.session.viewMode = 'timeline';
    app.session.lastMapMode = app.session.viewMode;
    app.session.structureStageSelection = null;
    $('structureView').scrollTop = 0;
    $('structurePreserved').open = false;
    app.session.selection = null;
    app.diagram.stopConnect();
  }

  function enterProject(p,chapterId = p.chapters[0]?.id) {
    app.session.atHome = false;
    app.store.state.active = p.id;
    app.store.state.chapter = chapterId ?? null;
    resetEditor();
  }

  function navigate(pId,chapterId) {
    const p = app.store.state.projects.find(item => item.id === pId);
    if (!p) return;
    const lastChapter = p.id === app.store.state.active ? app.store.chapter()?.id : undefined;
    enterProject(p,chapterId ?? lastChapter);
    app.store.save();
    render(true);
    $(app.session.diagramFullscreen ? 'graph' : 'chapterTitle').focus();
  }

  function openHome() {
    app.session.atHome = true;
    resetEditor();
    render();
    $('spaceTitle').focus();
  }

  function chapterButton(c,index,active) {
    return '<button class="chapter-link' + (active ? ' active" aria-current="true' : '') + '" data-chapter="' + esc(c.id) + '"><span class="chapter-no">' +
      number(index) + '</span><span class="clip" title="' + esc(c.title) + '">' + esc(c.title) + '</span></button>';
  }

  function countText(amount,key) {
    return amount + ' ' + t(amount === 1 ? key : key + 'Plural');
  }

  function renderHome() {
    $('projectCount').textContent = countText(app.store.state.projects.length,'countProject');
    $('emptyProjects').hidden = app.store.state.projects.length > 0;
    $('projectGrid').hidden = !app.store.state.projects.length;
    $('projectGrid').innerHTML = app.store.state.projects.map(p => {
      const id = esc(p.id), title = p.title || t('untitled');
      const summary = countText(p.chapters.length,'countChapter') + ' · ' + countText(p.nodes.length,'countNode');
      return '<article class="project-card">' +
        '<button type="button" class="project-open" data-project="' + id + '" aria-label="' + tx('openProject',{name:title}) + '">' +
        '<span class="project-glyph">' + icon('book') + '</span><span><strong class="project-card-name">' + esc(title) +
        '</strong><span class="project-card-summary">' + esc(summary) + '</span></span></button>' +
        '<div class="project-card-actions"><button type="button" class="btn ghost" data-delete-project="' + id +
        '" aria-label="' + tx('deleteNamedProject',{name:title}) + '">' + icon('trash') + ' ' + tx('delete') + '</button></div></article>';
    }).join('');
  }

  function renderHeader() {
    const p = app.store.project(), c = app.store.chapter();
    const chapterIndex = p.chapters.indexOf(c);
    const structure = app.session.isStructureView();
    const timeline = app.session.viewMode === 'timeline';
    const showMap = !!c && !structure;
    $('projectName').textContent = p.title;
    $('breadcrumb').textContent = p.title;
    $('chapters').innerHTML = p.chapters.map((item,index) =>
      '<div class="chapter-row">' + chapterButton(item,index,timeline && item.id === c?.id) +
      '<button type="button" class="icon-btn small remove-button" data-delete-chapter="' + esc(item.id) +
      '" title="' + tx('deleteChapter') + '" aria-label="' + tx('deleteNamedChapter',{name:item.title}) + '">' + icon('trash') + '</button></div>').join('');
    const projectButtons = app.store.state.projects.map(item => '<button class="' + (item.id === p.id ? 'current' : '') +
      '" data-project="' + esc(item.id) + '">' + icon('book') + '<span class="clip">' + esc(item.title) + '</span></button>').join('');
    $('projectMenu').innerHTML = projectButtons + '<hr><button id="newProject">' + icon('plus') + ' ' + tx('newProject') + '</button>' +
      '<button id="renameProject">' + icon('edit') + ' ' + tx('renameProject') + '</button>' +
      '<button data-delete-project="' + esc(p.id) + '">' + icon('trash') + ' ' + tx('deleteProject') + '</button>';
    $('chapterLabel').textContent = structure ? t('structure') : app.session.isWholeStory() ? t('overview') :
      c ? t('chapterNumber',{number:number(chapterIndex)}) : t('project');
    $('chapterTitle').textContent = timeline && c ? c.title : p.title;
    $('renameChapter').hidden = !timeline || !c;
    $('addNode').hidden = !showMap;
    $('emptyChapters').hidden = !!c || structure;
    $('graph').hidden = !showMap;
    $('legend').hidden = !showMap;
    $('structureView').hidden = !structure;
    $('editorFooter').hidden = !showMap;
    $('editorWorkspace').classList.toggle('structure-mode',structure);
    $('editorWorkspace').classList.toggle('no-map',!c);
    $('editorWorkspace').setAttribute('aria-label',t(structure ? 'structure' : 'storyMap'));
    $('graphActions').setAttribute('aria-label',t(structure ? 'historyTools' : 'mapTools'));
    $('overviewTab').disabled = !c;
    for (const [id,mode] of [['currentTab','timeline'],['overviewTab','whole-story'],['structureTab','structure']]) {
      $(id).classList.toggle('active',app.session.viewMode === mode);
      $(id).setAttribute('aria-pressed',app.session.viewMode === mode);
    }
    const chapters = countText(p.chapters.length,'countChapter');
    let stats = chapters;
    if (showMap) {
      const group = timeline ? p.nodes.filter(n => n.chapter === c.id) : p.nodes;
      const ids = new Set(group.map(n => n.id));
      const links = timeline ? p.edges.filter(e => ids.has(e.from) && ids.has(e.to)).length : p.edges.length;
      const mapStats = countText(group.length,'countNode') + ' · ' + countText(links,'countConnection');
      stats = timeline ? mapStats : chapters + ' · ' + mapStats;
    }
    $('stats').textContent = stats;
    renderWorkspaceControls();
  }

  function renderWorkspaceControls() {
    const fullscreenButton = $('toggleFullscreen');
    const fullscreenLabel = t(app.session.diagramFullscreen ? 'exitFullscreen' : 'diagramFullscreen');
    fullscreenButton.title = fullscreenLabel;
    fullscreenButton.setAttribute('aria-label',fullscreenLabel);
    fullscreenButton.innerHTML = icon(app.session.diagramFullscreen ? 'contract' : 'expand');

    const detailsButton = $('toggleDetails');
    const detailsLabel = t(app.session.detailsCollapsed ? 'showDetails' : 'hideDetails');
    detailsButton.hidden = !app.session.diagramFullscreen;
    detailsButton.title = detailsLabel;
    detailsButton.setAttribute('aria-label',detailsLabel);
    detailsButton.setAttribute('aria-expanded',!app.session.detailsCollapsed);
    detailsButton.classList.toggle('on',!app.session.detailsCollapsed);
    $('detailPanel').hidden = app.session.detailsCollapsed || app.session.isStructureView() || !app.store.chapter();
    $('editorWorkspace').classList.toggle('details-collapsed',app.session.detailsCollapsed);
    $('addNodeFullscreen').hidden = !app.session.diagramFullscreen;
  }

  function setDiagramFullscreen(active) {
    if (active === app.session.diagramFullscreen || (active && (app.session.atHome || app.session.isStructureView() || !app.store.chapter()))) return;
    if (active) app.session.diagramScroll = window.scrollY;
    app.session.diagramFullscreen = active;
    app.session.detailsCollapsed = false;
    closeMenus();
    document.documentElement.classList.toggle('diagram-fullscreen',active);
    renderWorkspaceControls();
    app.platform.android?.setDiagramFullscreen?.(active);
    if (!active) window.scrollTo(0,app.session.diagramScroll);
  }

  function toggleDiagramDetails() {
    if (!app.session.diagramFullscreen) return;
    app.session.detailsCollapsed = !app.session.detailsCollapsed;
    renderWorkspaceControls();
  }

  function render(fit = false) {
    if (fit) app.session.mapNeedsFit = true;
    if (!app.store.project()) app.session.atHome = true;
    if (app.session.diagramFullscreen && (app.session.atHome || app.session.isStructureView() || !app.store.chapter())) setDiagramFullscreen(false);
    $('goHome').classList.toggle('active',app.session.atHome);
    $('goHome').setAttribute('aria-current',app.session.atHome ? 'page' : 'false');
    $('spaceView').hidden = !app.session.atHome;
    $('editorView').hidden = app.session.atHome;
    $('projectNavigation').hidden = app.session.atHome;
    $('projectCrumb').hidden = app.session.atHome;
    $('exportProject').hidden = app.session.atHome;
    app.store.renderHistory();
    if (app.session.atHome) {
      renderHome();
      return;
    }
    const currentChapter = app.store.chapter(), currentNode = app.store.selectedNode();
    if (!currentChapter && app.session.isWholeStory()) app.session.viewMode = 'timeline';
    if (app.session.selection && (!currentNode || (app.session.viewMode === 'timeline' && currentNode.chapter !== currentChapter?.id))) app.session.selection = null;
    renderHeader();
    if (app.session.isStructureView()) {
      app.structure.renderStructure();
      return;
    }
    if (!currentChapter) return;
    app.diagram.rebuildScene();
    app.diagram.renderCards();
    app.storyBeats.renderInspector();
    app.diagram.renderMode();
    $('emptyCanvas').hidden = app.diagram.scene.nodes.length > 0;
    $('connect').disabled = app.diagram.scene.nodes.length < 2;
    $('layout').disabled = app.diagram.scene.nodes.length < 2;
    if (app.session.mapNeedsFit) {
      app.diagram.fitMap();
      app.session.mapNeedsFit = false;
    } else {
      app.diagram.renderWires();
      app.diagram.updateView();
    }
  }

  function switchView(next) {
    if (app.session.atHome || app.session.viewMode === next || (next === 'whole-story' && !app.store.chapter())) return;
    const previousMapMode = app.session.isStructureView() ? app.session.lastMapMode : app.session.viewMode;
    app.session.viewMode = next;
    app.session.lastMapMode = previousMapMode;
    app.diagram.stopConnect();
    if (next !== 'structure') {
      if (next === 'timeline' && app.store.selectedNode()) app.store.state.chapter = app.store.selectedNode().chapter;
      app.store.save();
    }
    render(next !== 'structure' && next !== previousMapMode);
  }

  function inspect(id,recenter = false) {
    const n = app.store.nodeById(id);
    if (!n || app.session.isStructureView()) return;
    const changedChapter = app.session.viewMode === 'timeline' && n.chapter !== app.store.chapter()?.id;
    if (changedChapter) app.store.state.chapter = n.chapter;
    app.session.selection = id;
    app.store.save();
    render(changedChapter);
    if (recenter) app.diagram.reveal(id);
  }

  function closeMenus() {
    document.querySelectorAll('[data-menu]').forEach(button => {
      $(button.dataset.menu).hidden = true;
      button.setAttribute('aria-expanded','false');
    });
  }

  function handleEditorShortcut(event) {
    if ($('dialog').open || $('imageViewer').open) return;
    if (event.key === 'Escape') {
      closeMenus();
      if (app.session.connectMode) app.diagramInput.toggleConnect();
      else if (app.session.diagramFullscreen) setDiagramFullscreen(false);
      return;
    }
    const editingStage = event.target.id === 'nodeNarrativeStage';
    if (!editingStage && event.target.matches('input, textarea, select, [contenteditable]')) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
      event.preventDefault();
      app.store.historyStep(key === 'y' || event.shiftKey ? 'redo' : 'undo');
      const node = app.store.selectedNode();
      if (editingStage && node) app.structure.focusNarrativeStage(node);
      return;
    }
    if (editingStage) return;
    if (event.ctrlKey || event.metaKey || event.altKey || app.session.atHome || app.session.isStructureView() || !app.store.chapter()) return;
    if (key === 'n') app.storyBeats.addNodeDialog();
    if (key === 'c') app.diagramInput.toggleConnect();
    if (key === 'f') app.diagram.fitMap();
    if (key === 'delete' && app.session.selection) app.storyBeats.removeSelected();
  }

  function bindEvents() {
    bindActions({
      goHome:openHome,
      toggleFullscreen:() => setDiagramFullscreen(!app.session.diagramFullscreen),
      toggleDetails:toggleDiagramDetails,
      currentTab:() => switchView('timeline'),
      overviewTab:() => switchView('whole-story'),
      structureTab:() => switchView('structure'),
      clearSelection:() => { app.session.selection = null; app.diagram.stopConnect(); render(); }
    });
    document.addEventListener('click',event => {
      const button = event.target.closest('[data-menu]');
      if (!button) {
        closeMenus();
        return;
      }
      const menu = $(button.dataset.menu), opening = menu.hidden;
      closeMenus();
      menu.hidden = !opening;
      button.setAttribute('aria-expanded',opening);
    });
    document.addEventListener('keydown',handleEditorShortcut);
  }

  return {
    bindEvents,
    chapterButton,
    closeMenus,
    countText,
    enterProject,
    inspect,
    navigate,
    openHome,
    render,
    renderWorkspaceControls,
    resetEditor,
    setDiagramFullscreen,
    switchView
  };
})(Enredo);
