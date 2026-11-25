Enredo.storyBeats = ((app) => {
  'use strict';

  const { $, icon, esc, option, uid, field, input, bindActions } = app.dom;
  const { tx, t } = app.preferences;

  function renderInspector() {
    const p = app.store.project();
    const n = app.store.selectedNode();
    const inspector = $('inspector');
    if (inspector.dataset.inspectedBeat !== (n?.id ?? '')) inspector.scrollTop = 0;
    inspector.dataset.inspectedBeat = n?.id ?? '';
    $('inspectorTitle').innerHTML = icon(n ? 'panel' : 'book') + ' ' + tx(n ? 'nodeDetails' : 'navigation');
    $('clearSelection').hidden = !n;
    if (!n) {
      const items = app.session.isStoryOverview() ? '<div class="overview-chapters">' +
        p.chapters.map((c,i) => app.workspace.chapterButton(c,i,false)).join('') + '</div>' : '';
      inspector.innerHTML = '<p class="hint">' + tx('selectNodeHint') + '</p>' + items;
      return;
    }
    const outgoing = p.edges.filter(e => e.from === n.id);
    const list = outgoing.map(e => {
      const target = app.store.nodeById(e.to);
      const crossChapter = target.chapter !== n.chapter ? ' · ' + p.chapters.find(c => c.id === target.chapter).title : '';
      const label = (e.label || t('noLabel')) + crossChapter;
      return '<div class="path-item"><button class="path-target" data-target="' + esc(e.to) + '" title="' + esc(target.title + ' · ' + label) + '">' +
        icon('link') + '<span class="clip"><span class="clip">' + esc(target.title) + '</span><small class="clip">' + esc(label) + '</small></span></button>' +
        '<button class="icon-btn small" data-edge="' + esc(e.id) + '" title="' + tx('editConnection') + '" aria-label="' +
        tx('editNamedConnection',{name:target.title}) + '">' + icon('edit') + '</button></div>';
    }).join('');
    inspector.innerHTML =
      '<div class="fields"><label class="field"><span>' + tx('title') + '</span><input id="nodeTitle" maxlength="120" value="' + esc(n.title) + '"></label>' +
      '<label class="field"><span>' + tx('nodeType') + '</span><select id="nodeKind">' + kindOptions(n.kind) + '</select></label>' +
      app.structure.narrativeStageField(n,p) +
      '<div class="field" role="group" aria-label="' + tx('nodeImage') + '"><span>' + tx('nodeImage') + '</span>' +
      (n.image ? '<img class="node-image-preview" src="' + esc(n.image) + '" alt="' + tx('nodeImagePreview') + '">' : '') +
      '<div class="node-image-actions">' + (n.image ? '<button type="button" class="btn" id="viewNodeImage">' +
        icon('expand') + ' ' + tx(n.originalImageId ? 'viewOriginalImage' : 'viewSavedImage') + '</button>' : '') +
      '<button type="button" class="btn" id="chooseNodeImage">' + icon('upload') + ' ' +
      tx(n.image ? 'replaceNodeImage' : 'addNodeImage') + '</button>' +
      (n.image ? '<button type="button" class="btn" id="removeNodeImage">' + icon('trash') + ' ' + tx('removeNodeImage') + '</button>' : '') +
      app.mediaGallery.launcher('beat',n) +
      '</div></div>' +
      '<label class="field"><span>' + tx('notes') + '</span><textarea id="nodeNotes" placeholder="' + tx('notesHint') + '" rows="3">' +
      esc(n.notes[0] === '\n' ? '\n' + n.notes : n.notes) + '</textarea></label></div>' +
      app.projectManagement.renderBeatTasks(n,p) +
      app.characters.renderNodeParticipants(n,p) +
      app.universe.renderNodeReferences(n,p) +
      '<section class="paths"><div class="paths-title"><span>' + tx('outgoingPaths') + '</span><span class="count">' + outgoing.length +
      '</span></div><div class="path-list">' + (list || '<p class="hint">' + tx('noPaths') + '</p>') +
      '</div><button class="btn path-add" id="addPath">' + icon('plus') + ' ' + tx('addPath') + '</button></section>' +
      '<div class="node-actions"><button class="btn ghost" id="duplicate">' + icon('copy') + ' ' + tx('duplicate') + '</button>' +
      '<button class="btn ghost remove" id="removeNode">' + icon('trash') + ' ' + tx('delete') + '</button></div>';
  }

  function kindOptions(active) {
    return app.storyData.kinds.map(value => option(value,t(value),value === active)).join('');
  }

  function openSpot(chapterId,x,y,height,position) {
    const nodes = app.store.project().nodes.filter(n => n.chapter === chapterId && Math.abs(position(n).x - x) < app.diagram.W + 15);
    while (nodes.some(n => {
      const top = position(n).y;
      return y < top + app.diagram.layoutNodeHeight(n) + 23 && top < y + height + 23;
    })) y += height + 28;
    return {x:Math.round(x),y:Math.round(y)};
  }

  function appendNode({chapterId,title,kind,origin = null,copy = false}) {
    const graph = $('graph');
    const image = copy ? origin.image : undefined;
    const height = copy ? app.diagram.layoutNodeHeight(origin) : app.diagram.H;
    function placement(field) {
      const position = node => field ? node[field] : node;
      let x = 0, y = 0;
      if (origin?.chapter === chapterId) {
        const start = position(origin);
        x = start.x + (copy ? 24 : app.diagram.W + 64);
        y = start.y + (copy ? height + 28 : 0);
      } else if (!field && app.session.viewMode === 'timeline' && chapterId === app.store.chapter()?.id && app.diagram.scene.nodes.length) {
        const {positionScale} = app.diagram.scene;
        x = ((graph.clientWidth/2 - app.diagram.view.x)/app.diagram.view.zoom - app.diagram.W/2)/positionScale.x;
        y = ((graph.clientHeight/2 - app.diagram.view.y)/app.diagram.view.zoom - height/2)/positionScale.y;
      }
      return openSpot(chapterId,x,y,height,position);
    }
    const n = {id:uid(),chapter:chapterId,kind,title,notes:copy ? origin.notes : '',...placement(),
      wholeStoryPosition:placement('wholeStoryPosition'),storyMapPosition:placement('storyMapPosition'),
      narrativeStage:copy && origin.narrativeStage ? {...origin.narrativeStage} : null,
      participants:copy ? app.characterData.participantsOf(origin).map(person => ({...person})) : [],
      ...(copy && origin.focalCharacterId ? {focalCharacterId:origin.focalCharacterId} : {}),
      ...(copy && origin.galleryImages?.length ? {galleryImages:origin.galleryImages.map(image => ({...image}))} : {}),
      ...(copy && origin.galleryDocuments?.length ? {galleryDocuments:origin.galleryDocuments.map(document => ({...document}))} : {}),
      ...(image ? {image,...(origin.originalImageId ? {originalImageId:origin.originalImageId} : {})} : {})};
    app.store.project().nodes.push(n);
    return n;
  }

  function addNodeDialog() {
    const chapterId = app.store.selectedNode()?.chapter ?? app.store.chapter()?.id;
    if (chapterId === undefined || app.session.isStructureView()) return;
    app.dialogs.showDialog({title:t('addNode'),body:'<div class="fields">' +
      field(t('title'),input('title','',t('nodeExample'),true)) +
      field(t('nodeType'),'<select name="kind">' + kindOptions('scene') + '</select>') +
      (app.session.isStoryOverview() ? field(t('chapter'),'<select name="chapter">' + app.paths.chapterOptions(chapterId) + '</select>') : '') +
      '</div>',submitKey:'add',onSubmit:data => {
        const title = data.get('title').trim();
        if (!title) return;
        app.dialogs.closeDialog();
        const wasEmpty = !app.diagram.scene.nodes.length;
        app.store.edit(() => {
          const targetChapter = data.get('chapter') ?? chapterId;
          app.session.selection = appendNode({chapterId:targetChapter,title,kind:data.get('kind')}).id;
          app.mapGrouping.expandChapter(app.store.project(),targetChapter);
          app.diagram.stopConnect();
        },{fit:wasEmpty});
        app.diagram.reveal(app.session.selection);
      }});
  }

  function removeSelected() {
    const n = app.store.selectedNode(), p = app.store.project();
    if (!n) return;
    app.dialogs.confirmation(t('confirmNode'),t('confirmNodeMessage',{name:n.title || t('untitled')}),() => {
      app.store.edit(() => {
        const removedEdges = p.edges.filter(edge => edge.from === n.id || edge.to === n.id);
        const removed = new Set([n.id]);
        app.characterData.detachSituations(p,removed);
        app.projectManagementData.detachBeats(p,removed);
        for (const edge of removedEdges) app.characterData.detachConnection(p,edge.id,{unlinkRoute:true});
        p.nodes = p.nodes.filter(item => item.id !== n.id);
        p.edges = p.edges.filter(edge => edge.from !== n.id && edge.to !== n.id);
        app.session.selection = null;
        app.diagram.stopConnect();
      });
    });
  }

  function duplicateSelected() {
    const n = app.store.selectedNode();
    if (!n) return;
    let copy;
    if (app.store.edit(() => {
      copy = appendNode({chapterId:n.chapter,title:n.title + t('copySuffix'),kind:n.kind,origin:n,copy:true});
    },{saveError:n.image ? 'projectSaveFailed' : undefined,afterSave:() => { app.session.selection = copy.id; }})) app.diagram.reveal(app.session.selection);
  }

  function updateText(event) {
    const element = event.target;
    const node = app.store.selectedNode();
    if (!node || (element.id !== 'nodeTitle' && element.id !== 'nodeNotes')) return;
    const key = element.id === 'nodeTitle' ? 'title' : 'notes';
    if (node[key] === element.value) return;
    if (!element.dataset.edited) {
      app.store.remember(app.characterData.captureHistory(app.store.state));
      element.dataset.edited = 'true';
    }
    node[key] = element.value;
    app.store.save();
    if (key === 'title') {
      app.diagram.rebuildScene();
      app.diagram.renderCards();
    }
  }

  function bindEvents() {
    bindActions({addNode:addNodeDialog,emptyAdd:addNodeDialog,addNodeFullscreen:addNodeDialog});
    const inspector = $('inspector');
    inspector.addEventListener('input',updateText);
    inspector.addEventListener('focusout',event => { delete event.target.dataset.edited; });
    inspector.addEventListener('change',event => {
      const node = app.store.selectedNode();
      if (node && event.target.id === 'nodeKind') {
        app.store.edit(() => { node.kind = event.target.value; });
        $('nodeKind').focus();
      }
    });
    inspector.addEventListener('keydown',event => {
      if (event.key === 'Enter' && event.target.id === 'nodeTitle') {
        event.preventDefault();
        event.target.blur();
      }
    });
    inspector.addEventListener('click',event => {
      const button = event.target.closest('button');
      if (button?.id === 'duplicate') duplicateSelected();
      if (button?.id === 'removeNode') removeSelected();
    });
  }

  return {
    addNodeDialog,
    appendNode,
    bindEvents,
    kindOptions,
    removeSelected,
    renderInspector
  };
})(Enredo);
