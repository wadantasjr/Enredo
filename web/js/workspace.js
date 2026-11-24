Enredo.workspace = ((app) => {
  'use strict';

  const { $, esc, number, icon, bindActions } = app.dom;
  const { t, tx } = app.preferences;

  function bindNavigationResize() {
    const root = $('app'), handle = $('navigationResizer');
    const widthKey = 'enredo.navigation-width';
    const minimum = parseInt(getComputedStyle(root).getPropertyValue('--navigation-min-width'),10);
    let preferred = minimum, width = minimum, maximum = minimum;
    let drag;
    try { preferred = Number(localStorage.getItem(widthKey)) || minimum; } catch {}

    function applyWidth(requested) {
      maximum = Math.max(minimum,Math.min(480,Math.floor(root.clientWidth * 0.42)));
      width = Math.max(minimum,Math.min(maximum,requested));
      root.style.setProperty('--navigation-width',width + 'px');
      handle.setAttribute('aria-valuemax',maximum);
      handle.setAttribute('aria-valuenow',width);
    }

    function saveWidth() {
      preferred = width;
      try { localStorage.setItem(widthKey,String(width)); } catch {}
    }

    handle.setAttribute('aria-valuemin',minimum);
    applyWidth(preferred);
    window.addEventListener('resize',() => applyWidth(drag ? width : preferred));

    handle.addEventListener('pointerdown',event => {
      if (event.button !== 0 || drag) return;
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('resizing');
      drag = {id:event.pointerId,x:event.clientX,width};
    });
    handle.addEventListener('pointermove',event => {
      if (event.pointerId === drag?.id) applyWidth(drag.width + event.clientX - drag.x);
    });
    handle.addEventListener('lostpointercapture',event => {
      if (event.pointerId !== drag?.id) return;
      if (width !== drag.width) saveWidth();
      drag = null;
      handle.classList.remove('resizing');
    });
    handle.addEventListener('keydown',event => {
      const targets = {ArrowLeft:width - 16,ArrowRight:width + 16,Home:minimum,End:maximum};
      if (!Object.hasOwn(targets,event.key)) return;
      event.preventDefault();
      const previous = width;
      applyWidth(targets[event.key]);
      if (width !== previous) saveWidth();
    });
  }

  function resetEditor() {
    app.session.viewMode = 'timeline';
    app.session.charactersOpen = false;
    app.session.managementOpen = false;
    app.session.presentation = null;
    app.projectManagement.resetView();
    app.characters?.clearOrigin();
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

  function openCharacters() {
    if (app.session.atHome || app.session.charactersOpen) return;
    app.characters.clearOrigin();
    if (app.session.diagramFullscreen) setDiagramFullscreen(false);
    app.session.charactersOpen = true;
    app.session.managementOpen = false;
    app.session.presentation = null;
    app.diagram.stopConnect();
    closeMenus();
    render();
    $('charactersTitle').focus();
  }

  function openProjectManagement() {
    if (app.session.atHome || app.session.managementOpen) return;
    if (app.session.diagramFullscreen) setDiagramFullscreen(false);
    app.session.charactersOpen = false;
    app.characters.clearOrigin();
    app.session.managementOpen = true;
    app.session.presentation = null;
    app.diagram.stopConnect();
    closeMenus();
    render();
    $('managementTitle').focus();
  }

  function closeProjectManagement() {
    switchView(app.session.viewMode);
    $(app.session.isStructureView() ? 'structureTab' : app.session.isWholeStory() ? 'overviewTab' : 'currentTab').focus();
  }

  function chapterButton(c,index,active) {
    const cover = c.cover?.assetId ? app.imageEditor.coverMarkup(c.cover,'chapter-nav-cover') : '';
    return '<button class="chapter-link' + (active ? ' active" aria-current="true' : '') + '" data-chapter="' + esc(c.id) + '">' + cover + '<span class="chapter-no">' +
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
        '<button type="button" class="project-open" data-project="' + id + '" aria-label="' + esc(tx('openProject',{name:title})) + '">' +
        app.imageEditor.coverMarkup(p.cover,'project-card-cover') + '<span class="project-card-copy"><strong class="project-card-name">' + esc(title) +
        '</strong><span class="project-card-summary">' + esc(summary) + '</span></span></button>' +
        '<div class="project-card-actions"><button type="button" class="btn ghost" data-project-overview="' + id + '">' + icon('book') + ' ' + tx('projectOverview') + '</button>' +
        '<button type="button" class="btn ghost" data-delete-project="' + id +
        '" aria-label="' + tx('deleteNamedProject',{name:title}) + '">' + icon('trash') + ' ' + tx('delete') + '</button></div></article>';
    }).join('');
    app.imageEditor.renderCoverPreviews($('projectGrid'));
  }

  function renderHeader() {
    const p = app.store.project(), c = app.store.chapter();
    const chapterIndex = p.chapters.indexOf(c);
    const characters = app.session.charactersOpen;
    const management = app.session.managementOpen;
    const presentation = app.session.presentation;
    const structure = !presentation && app.session.isStructureView() && !characters && !management;
    const timeline = app.session.hasMapView() && !app.session.isWholeStory();
    const showMap = !!c && app.session.hasMapView();
    $('projectName').textContent = p.title;
    const breadcrumb = $('breadcrumb');
    const projectTitle = p.title.trim() ? p.title : t('untitled');
    breadcrumb.textContent = projectTitle;
    breadcrumb.title = projectTitle;
    breadcrumb.setAttribute('aria-current',presentation?.type === 'project' ? 'page' : 'false');
    app.chapterGroups.renderNavigation();
    const projectButtons = app.store.state.projects.map(item => '<button class="' + (item.id === p.id ? 'current' : '') +
      '" data-project="' + esc(item.id) + '">' + icon('book') + '<span class="clip">' + esc(item.title) + '</span></button>').join('');
    $('projectMenu').innerHTML = projectButtons + '<hr><button id="newProject">' + icon('plus') + ' ' + tx('newProject') + '</button>' +
      '<button id="renameProject">' + icon('edit') + ' ' + tx('projectDetails') + '</button>' +
      '<button data-project-overview="' + esc(p.id) + '">' + icon('book') + ' ' + tx('projectOverview') + '</button>' +
      '<button data-delete-project="' + esc(p.id) + '">' + icon('trash') + ' ' + tx('deleteProject') + '</button>';
    $('chapterLabel').textContent = presentation ? t(presentation.type === 'project' ? 'projectOverview' :
      presentation.type === 'ungrouped' ? 'ungrouped' : 'group') :
      management ? t('project') : characters ? t('characters') : structure ? t('structure') : app.session.isWholeStory() ? t('overview') :
      c ? t('chapterNumber',{number:number(chapterIndex)}) : t('project');
    const shownGroup = presentation?.type === 'group' ? p.chapterGroups?.find(group => group.id === presentation.id) : null;
    $('chapterTitle').textContent = presentation?.type === 'ungrouped' ? t('ungrouped') : shownGroup?.title ?? (timeline && c ? c.title : p.title);
    $('renameChapter').hidden = !timeline || !c;
    $('chapterGallery').hidden = !timeline || !c;
    $('chapterGallery').innerHTML = timeline && c ? app.mediaGallery.launcher('chapter',c) : '';
    $('addNode').hidden = !showMap;
    const showWholeStory = showMap && app.session.isWholeStory();
    $('mapGrouping').hidden = !showWholeStory;
    $('mapBackgroundButton').hidden = !showWholeStory;
    app.imageEditor.renderMapBackground(showWholeStory ? p.mapBackgroundId : null,p.mapBackgroundSize);
    $('emptyChapters').hidden = !!c || !app.session.hasMapView();
    $('graph').hidden = !showMap;
    $('legend').hidden = !showMap;
    $('structureView').hidden = !structure;
    $('charactersView').hidden = !characters;
    $('projectManagementView').hidden = !management;
    $('chapterPresentation').hidden = !presentation;
    $('graphBar').hidden = !!presentation;
    $('editorFooter').hidden = !showMap;
    $('editorWorkspace').classList.toggle('structure-mode',structure);
    $('editorWorkspace').classList.toggle('characters-mode',characters);
    $('editorWorkspace').classList.toggle('management-mode',management);
    $('editorWorkspace').classList.toggle('presentation-mode',!!presentation);
    $('editorWorkspace').classList.toggle('no-map',!c);
    $('editorWorkspace').setAttribute('aria-label',t(presentation ? (presentation.type === 'project' ? 'projectOverview' : 'group') :
      management ? 'projectManagement' : characters ? 'characters' : structure ? 'structure' : 'storyMap'));
    $('overviewTab').disabled = !c;
    for (const [id,active] of [['currentTab',timeline],['overviewTab',showMap && app.session.isWholeStory()],
      ['structureTab',structure],['charactersTab',characters],['projectManagementTab',management]]) {
      $(id).classList.toggle('active',active);
      $(id).setAttribute('aria-pressed',active);
    }
    const chapters = countText(p.chapters.length,'countChapter');
    let stats = chapters;
    if (presentation?.type === 'group') {
      const amount = p.chapters.filter(item => item.groupId === presentation.id).length;
      stats = countText(amount,'countChapter');
    } else if (presentation?.type === 'ungrouped') {
      stats = countText(p.chapters.filter(item => !item.groupId).length,'countChapter');
    } else if (management) {
      stats = countText(p.tasks.length,'countTask') + ' · ' + countText(p.sprints.length,'countSprint');
    } else if (characters) {
      const people = Array.isArray(p.characters) ? p.characters.length : 0;
      const relations = Array.isArray(p.relationships) ? p.relationships.length : 0;
      stats = countText(people,'countCharacter') + ' · ' + countText(relations,'countRelationship');
    } else if (showMap) {
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
    const {atHome,diagramFullscreen,navigationCollapsed,fullscreenNavigationCollapsed,detailsCollapsed} = app.session;
    const hasDiagram = !atHome && app.session.hasMapView() && !!app.store.chapter();
    const fullscreenButton = $('toggleFullscreen');
    const fullscreenLabel = t(diagramFullscreen ? 'exitFullscreen' : 'diagramFullscreen');
    fullscreenButton.title = fullscreenLabel;
    fullscreenButton.setAttribute('aria-label',fullscreenLabel);
    fullscreenButton.innerHTML = icon(diagramFullscreen ? 'contract' : 'expand');
    fullscreenButton.hidden = !hasDiagram;

    const navigationVisible = atHome || !(diagramFullscreen ? fullscreenNavigationCollapsed : navigationCollapsed);
    renderPanelToggle('toggleNavigation',navigationVisible,'showNavigation','hideNavigation');
    $('navigationPanel').hidden = !navigationVisible;
    $('app').classList.toggle('navigation-collapsed',!navigationVisible);

    $('toggleDetails').hidden = !hasDiagram;
    renderPanelToggle('toggleDetails',hasDiagram && !detailsCollapsed,'showDetails','hideDetails');
    $('detailPanel').hidden = !hasDiagram || detailsCollapsed;
    $('editorWorkspace').classList.toggle('details-collapsed',detailsCollapsed);
    $('addNodeFullscreen').hidden = !diagramFullscreen;
  }

  function renderPanelToggle(id,expanded,show,hide) {
    const button = $(id);
    button.title = t(expanded ? hide : show);
    button.setAttribute('aria-label',button.title);
    button.setAttribute('aria-expanded',expanded);
    button.classList.toggle('on',expanded);
  }

  function setDiagramFullscreen(active) {
    if (active === app.session.diagramFullscreen || (active && (app.session.atHome || !app.session.hasMapView() || !app.store.chapter()))) return;
    if (active) app.session.diagramScroll = window.scrollY;
    app.session.diagramFullscreen = active;
    closeMenus();
    document.documentElement.classList.toggle('diagram-fullscreen',active);
    const displayButton = $('displaySettingsButton');
    if (active) $('toggleFullscreen').before(displayButton);
    else $('displayActions').append(displayButton);
    renderWorkspaceControls();
    app.platform.android?.setDiagramFullscreen?.(active);
    if (!active) window.scrollTo(0,app.session.diagramScroll);
  }

  function togglePanel(preference) {
    app.session[preference] = !app.session[preference];
    renderWorkspaceControls();
  }

  function render(fit = false) {
    if (fit) app.session.mapNeedsFit = true;
    if (!app.store.project()) app.session.atHome = true;
    if (app.session.diagramFullscreen && (app.session.atHome || !app.session.hasMapView() || !app.store.chapter())) setDiagramFullscreen(false);
    $('goHome').classList.toggle('active',app.session.atHome);
    $('goHome').setAttribute('aria-current',app.session.atHome ? 'page' : 'false');
    $('spaceView').hidden = !app.session.atHome;
    $('editorView').hidden = app.session.atHome;
    $('projectNavigation').hidden = app.session.atHome;
    $('projectCrumb').hidden = app.session.atHome;
    $('exportProject').hidden = app.session.atHome;
    $('exportPdf').hidden = app.session.atHome;
    app.store.renderHistory();
    if (app.session.atHome) {
      renderWorkspaceControls();
      renderHome();
      return;
    }
    if (app.session.presentation?.type === 'group' &&
        !app.store.project().chapterGroups?.some(group => group.id === app.session.presentation.id)) {
      app.session.presentation = {type:'project'};
    }
    const currentChapter = app.store.chapter(), currentNode = app.store.selectedNode();
    if (!app.session.presentation && !currentChapter && app.session.isWholeStory()) app.session.viewMode = 'timeline';
    if (app.session.selection && (!currentNode || (app.session.viewMode === 'timeline' && currentNode.chapter !== currentChapter?.id))) app.session.selection = null;
    renderHeader();
    if (app.session.managementOpen) {
      app.projectManagement.render();
      return;
    }
    if (app.session.charactersOpen) {
      app.characters.render();
      return;
    }
    if (app.session.presentation) {
      app.chapterGroups.renderPresentation();
      return;
    }
    if (app.session.isStructureView()) {
      app.structure.renderStructure();
      return;
    }
    if (!currentChapter) return;
    app.diagram.rebuildScene();
    const {nodes,sections,byId} = app.diagram.scene;
    if (app.session.selection && !byId.has(app.session.selection)) app.session.selection = null;
    app.diagram.renderCards();
    app.storyBeats.renderInspector();
    app.diagram.renderMode();
    $('emptyCanvas').hidden = nodes.length > 0 || sections.length > 0;
    $('connect').disabled = nodes.length < 2;
    $('layout').disabled = (app.session.isWholeStory() ? app.store.project().nodes.length : nodes.length) < 2;
    if (app.session.mapNeedsFit) {
      app.diagram.fitMap();
      app.session.mapNeedsFit = false;
    } else {
      app.diagram.updateView();
      app.diagram.renderWires();
    }
  }

  function switchView(next,{revealSelection = false} = {}) {
    if (app.session.atHome || (!app.session.charactersOpen && !app.session.managementOpen && !app.session.presentation && app.session.viewMode === next) ||
        (next === 'whole-story' && !app.store.chapter())) return;
    const previousMapMode = app.session.isStructureView() ? app.session.lastMapMode : app.session.viewMode;
    app.session.charactersOpen = false;
    app.session.managementOpen = false;
    app.session.presentation = null;
    app.characters.clearOrigin();
    app.session.viewMode = next;
    app.session.lastMapMode = previousMapMode;
    app.diagram.stopConnect();
    if (next !== 'structure') {
      const selected = app.store.selectedNode();
      if (next === 'timeline' && selected) app.store.state.chapter = selected.chapter;
      if (next === 'whole-story' && revealSelection && selected) app.mapGrouping.expandChapter(app.store.project(),selected.chapter);
      app.store.save();
    }
    render(next !== 'structure' && next !== previousMapMode);
  }

  function inspect(id,recenter = false) {
    const n = app.store.nodeById(id);
    if (!n) return;
    if (app.session.isStructureView()) {
      if (!app.session.charactersOpen && !app.session.managementOpen) return;
      app.session.viewMode = app.session.lastMapMode;
    }
    app.session.charactersOpen = false;
    app.session.managementOpen = false;
    const changedChapter = app.session.viewMode === 'timeline' && n.chapter !== app.store.chapter()?.id;
    if (changedChapter) app.store.state.chapter = n.chapter;
    const expanded = app.mapGrouping.expandChapter(app.store.project(),n.chapter);
    app.session.selection = id;
    app.store.save();
    render(changedChapter || expanded);
    if (recenter) app.diagram.reveal(id);
  }

  function closeMenus() {
    document.querySelectorAll('[data-menu]').forEach(button => {
      $(button.dataset.menu).hidden = true;
      button.setAttribute('aria-expanded','false');
    });
  }

  function handleEditorShortcut(event) {
    if ($('dialog').open || $('imageViewer').open || $('coverCropDialog').open || $('mediaGallery').open) return;
    if (event.key === 'Escape') {
      closeMenus();
      if (app.session.charactersOpen) app.characters.goBack();
      else if (app.session.managementOpen) closeProjectManagement();
      else if (app.session.connectMode) app.diagramInput.toggleConnect();
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
    if (event.ctrlKey || event.metaKey || event.altKey || app.session.atHome || !app.session.hasMapView() || !app.store.chapter()) return;
    if (key === 'n') app.storyBeats.addNodeDialog();
    if (key === 'c') app.diagramInput.toggleConnect();
    if (key === 'f') app.diagram.fitMap();
    if (key === 'delete' && app.session.selection) app.storyBeats.removeSelected();
  }

  function bindEvents() {
    bindNavigationResize();
    bindActions({
      goHome:openHome,
      breadcrumbHome:openHome,
      toggleFullscreen:() => setDiagramFullscreen(!app.session.diagramFullscreen),
      toggleNavigation:() => togglePanel(app.session.diagramFullscreen ? 'fullscreenNavigationCollapsed' : 'navigationCollapsed'),
      toggleDetails:() => togglePanel('detailsCollapsed'),
      currentTab:() => switchView('timeline'),
      overviewTab:() => switchView('whole-story'),
      structureTab:() => switchView('structure'),
      charactersTab:openCharacters,
      projectManagementTab:openProjectManagement,
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
    closeProjectManagement,
    countText,
    enterProject,
    inspect,
    navigate,
    openCharacters,
    openHome,
    render,
    renderWorkspaceControls,
    resetEditor,
    setDiagramFullscreen,
    switchView
  };
})(Enredo);
