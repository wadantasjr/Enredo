Enredo.paths = ((app) => {
  'use strict';

  const { option, number, esc, field, input, $, uid } = app.dom;
  const { t } = app.preferences;

  function chapterOptions(selected) {
    return app.store.project().chapters.map((c,i) => option(c.id,number(i) + ' · ' + c.title,c.id === selected)).join('');
  }

  function destinationOptions(from,selected) {
    const p = app.store.project();
    return p.chapters.map(c => {
      const matches = p.nodes.filter(n => n.id !== from && n.chapter === c.id);
      return matches.length ? '<optgroup label="' + esc(c.title) + '">' +
        matches.map(n => option(n.id,n.title || t('untitled'),n.id === selected)).join('') + '</optgroup>' : '';
    }).join('');
  }

  function editPath(origin,existing = null,destination = null) {
    const p = app.store.project();
    const destOptions = destinationOptions(origin.id,existing?.to ?? destination?.id);
    const choices = '<div class="fields" id="newDestination">' +
      field(t('newNodeTitle'),input('title','',t('newNodeExample'),true)) +
      field(t('nodeType'),'<select name="kind">' + app.storyBeats.kindOptions('outcome') + '</select>') +
      field(t('destinationChapter'),'<select name="chapter">' + chapterOptions(origin.chapter) + '</select>') + '</div>';
    app.dialogs.showDialog({title:t(existing ? 'editConnection' : 'addPath'),
      body:'<div class="fields">' +
        field(t('connectionLabel'),input('label',existing?.label ?? '',t('connectionExample'))) +
        (existing ? '' : field(t('destination'),'<select name="mode">' +
          option('new',t('createNode'),!destination) + (destOptions ? option('existing',t('useExistingNode'),!!destination) : '') + '</select>')) +
        '<div id="existingDestination">' + field(t('destinationNode'),'<select name="target">' +
          option('',t('chooseNode')) + destOptions + '</select>') + '</div>' + (existing ? '' : choices) + '</div>',
      submitKey:existing ? 'save' : 'addPath',extra:form => {
        const mode = form.elements.mode;
        const sync = () => {
          const isNew = mode?.value === 'new';
          $('existingDestination').hidden = isNew;
          form.elements.target.required = !isNew;
          if (mode) {
            $('newDestination').hidden = !isNew;
            form.elements.title.required = isNew;
          }
        };
        if (mode) mode.onchange = sync;
        sync();
      },
      onSubmit:data => {
        const isNew = data.get('mode') === 'new';
        const title = data.get('title')?.trim();
        const target = data.get('target');
        const label = data.get('label').trim();
        if (isNew && !title) return;
        if (!isNew && p.edges.some(e => e.id !== existing?.id && e.from === origin.id && e.to === target && e.label === label)) {
          app.preferences.flash('duplicateConnection');
          return;
        }
        app.dialogs.closeDialog();
        app.store.edit(() => {
          const to = isNew ? app.storyBeats.appendNode({chapterId:data.get('chapter'),title,kind:data.get('kind'),origin}).id : target;
          if (existing) Object.assign(existing,{to,label});
          else p.edges.push({id:uid(),from:origin.id,to,label});
          app.session.selection = origin.id;
          app.diagram.stopConnect();
        },{fit:isNew && (app.session.isWholeStory() || data.get('chapter') === app.store.chapter()?.id)});
      },
      remove:existing ? () => app.dialogs.confirmation(t('confirmConnection'),t('confirmConnectionMessage'),() => {
        app.store.edit(() => { p.edges = p.edges.filter(e => e.id !== existing.id); });
      }) : null});
  }

  function edgeDialog(id) {
    const edge = app.store.project().edges.find(e => e.id === id);
    if (edge) editPath(app.store.nodeById(edge.from),edge);
  }

  function bindEvents() {
    $('inspector').addEventListener('click',event => {
      const button = event.target.closest('button');
      if (!button) return;
      const {target,edge} = button.dataset;
      if (target !== undefined) app.workspace.inspect(target,true);
      if (edge !== undefined) edgeDialog(edge);
      if (button.id === 'addPath' && app.store.selectedNode()) editPath(app.store.selectedNode());
    });
  }

  return {
    bindEvents,
    chapterOptions,
    edgeDialog,
    editPath
  };
})(Enredo);
