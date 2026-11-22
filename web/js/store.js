Enredo.store = ((app) => {
  'use strict';

  const { $, icon, bindActions } = app.dom;
  const { t, tx } = app.preferences;

  function readState() {
    try {
      const raw = localStorage.getItem(app.storyData.storageKey);
      if (raw) {
        const result = JSON.parse(raw);
        if (Array.isArray(result?.projects) && result.projects.every(app.storyData.validProject)) {
          return app.storyData.normalizeState(result);
        }
      }
    } catch {}
    return {active:'exemplo',chapter:'sinal',projects:[app.storyData.sample()]};
  }

  let state = readState();

  const undoStack = [], redoStack = [];

  let storageFailed = false;

  const project = () => state.projects.find(p => p.id === state.active) ?? state.projects[0];

  function chapter() {
    const p = project();
    return p?.chapters.find(c => c.id === state.chapter) ?? p?.chapters[0];
  }

  const nodeById = id => project()?.nodes.find(n => n.id === id);

  const selectedNode = () => nodeById(app.session.selection);

  function renderSaveStatus() {
    const status = $('saveStatus');
    const message = storageFailed ? 'saveFailed' : 'saved';
    status.classList.toggle('failed',storageFailed);
    status.title = t(message);
    status.innerHTML = (storageFailed ? '' : icon('check')) + '<span class="save-copy">' + tx(message) + '</span>';
  }

  function save(serialized = JSON.stringify(state), reportFailure = true) {
    const previous = storageFailed;
    try {
      localStorage.setItem(app.storyData.storageKey,serialized);
      storageFailed = false;
    } catch {
      if (!reportFailure) return false;
      storageFailed = true;
    }
    if (previous !== storageFailed) renderSaveStatus();
    return !storageFailed;
  }

  function remember(before) {
    undoStack.push(before);
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
    renderHistory();
  }

  function edit(callback,{fit = false, saveError, afterSave} = {}) {
    const before = app.characterData.captureHistory(state);
    callback();
    const after = app.characterData.captureHistory(state);
    if (!save(JSON.stringify(state),!saveError) && saveError) {
      state = app.characterData.restoreHistory(before);
      app.workspace.render();
      app.preferences.flash(saveError);
      return false;
    }
    if (JSON.stringify(after) !== JSON.stringify(before)) remember(before);
    afterSave?.();
    app.workspace.render(fit);
    return true;
  }

  function mapLayoutChanged(before,after) {
    if (before.chapters.length !== after.chapters.length ||
        before.chapters.some((c,i) => c.id !== after.chapters[i].id)) return true;
    if (before.nodes.length !== after.nodes.length || before.nodes.some((n,i) => {
      const next = after.nodes[i];
      return n.id !== next.id || n.chapter !== next.chapter || n.x !== next.x || n.y !== next.y ||
        app.diagram.layoutNodeHeight(n) !== app.diagram.layoutNodeHeight(next);
    })) return true;
    return before.edges.length !== after.edges.length ||
      before.edges.some((e,i) => e.from !== after.edges[i].from || e.to !== after.edges[i].to);
  }

  function historyStep(direction) {
    const [take,put] = direction === 'undo' ? [undoStack,redoStack] : [redoStack,undoStack];
    if (!take.length) return;
    const previousProject = project(), previousChapter = chapter()?.id;
    put.push(app.characterData.captureHistory(state));
    state = app.characterData.restoreHistory(take.pop());
    const restoredProject = project();
    if (previousProject?.id !== restoredProject?.id) app.workspace.resetEditor();
    else app.diagram.stopConnect();
    save();
    const keepFraming = app.session.isStructureView() && previousProject && restoredProject &&
      (app.session.lastMapMode !== 'timeline' || previousChapter === chapter()?.id) && !mapLayoutChanged(previousProject,restoredProject);
    app.workspace.render(!keepFraming);
  }

  function renderHistory() {
    for (const id of ['undo','undoHome','undoEmptyChapter']) $(id).disabled = !undoStack.length;
    for (const id of ['redo','redoHome','redoEmptyChapter']) $(id).disabled = !redoStack.length;
  }

  function bindEvents() {
    const undo = () => historyStep('undo'), redo = () => historyStep('redo');
    bindActions({undo,redo,undoHome:undo,redoHome:redo,undoEmptyChapter:undo,redoEmptyChapter:redo});
  }

  return {
    bindEvents,
    chapter,
    edit,
    historyStep,
    nodeById,
    project,
    remember,
    renderHistory,
    renderSaveStatus,
    save,
    selectedNode,
    get state() { return state; }
  };
})(Enredo);
