Enredo.projects = ((app) => {
  'use strict';

  const { t, tx } = app.preferences;
  const { field, input, $, option, esc, uid, number, bindActions } = app.dom;

  function editProject() {
    const p = app.store.project();
    app.dialogs.showDialog({title:t('renameProject'),body:field(t('name'),input('title',p.title,'',true)),submitKey:'save',
      onSubmit: data => {
        const title = data.get('title').trim();
        if (!title) return;
        app.dialogs.closeDialog();
        app.store.edit(() => { p.title = title; });
      },remove:() => removeProject(p)});
  }

  function removeProject(p) {
    if (!p) return;
    app.dialogs.confirmation(t('confirmProject'),t('confirmProjectMessage',{name:p.title}),() => {
        app.store.edit(() => {
          app.store.state.projects = app.store.state.projects.filter(item => item.id !== p.id);
          if (app.store.state.active === p.id) {
            app.store.state.active = null;
            app.store.state.chapter = null;
          }
          app.session.atHome = true;
          app.workspace.resetEditor();
        });
        $('spaceTitle').focus();
        app.preferences.flash('projectDeleted');
      });
  }

  function narrativeModelField(selected) {
    const {models} = app.narrative;
    const choices = models.map(model => option(model.id,app.structure.narrativeText(model.name),model.id === selected)).join('');
    const placeholder = app.narrative.getNarrativeModel(selected) ? '' :
      '<option value="" selected disabled>' + tx('chooseNarrativeModel') + '</option>';
    const explanations = models.map(model => '<div><dt>' + esc(app.structure.narrativeText(model.name)) + '</dt><dd>' +
      esc(app.structure.narrativeText(model.summary)) + '</dd></div>').join('');
    return field(t('narrativeModel'),'<select name="narrativeModel" required>' + placeholder + choices + '</select>') +
      '<dl class="model-options">' + explanations + '</dl>';
  }

  function createProject() {
    app.dialogs.showDialog({title:t('newProject'),body:'<div class="fields">' +
      field(t('storyName'),input('title','',t('myStory'),true)) + narrativeModelField(app.narrative.defaultModelId) + '</div>',
      submitKey:'createProject',onSubmit:data => {
        const title = data.get('title').trim();
        if (!title) return;
        const model = app.narrative.getNarrativeModel(data.get('narrativeModel'));
        app.dialogs.closeDialog();
        app.store.edit(() => {
          const p = {id:uid(),title,chapters:[{id:uid(),title:t('newChapter')}],nodes:[],edges:[],
            narrativeModel:model?.id ?? app.narrative.defaultModelId};
          app.store.state.projects.push(p);
          app.workspace.enterProject(p);
        },{fit:true});
        $('chapterTitle').focus();
      }});
  }

  function editNarrativeModel() {
    const p = app.store.project();
    const saved = p.nodes.some(node => node.narrativeStage);
    const hint = saved ? '<p class="hint">' + tx('keepAssociations') + '</p>' : '';
    app.dialogs.showDialog({title:t('changeNarrativeModel'),body:'<div class="fields">' +
      narrativeModelField(p.narrativeModel) + hint + '</div>',submitKey:'save',onSubmit:data => {
        const model = app.narrative.getNarrativeModel(data.get('narrativeModel'));
        if (!model) return;
        app.dialogs.closeDialog();
        if (p.narrativeModel !== model.id) {
          app.session.structureStageSelection = null;
          app.store.edit(() => { p.narrativeModel = model.id; });
        }
        $('changeNarrativeModel').focus({preventScroll:true});
      }});
  }

  function chapterDialog(existing = null) {
    const p = app.store.project();
    const position = existing ? field(t('chapterPosition'),'<select name="position">' +
      p.chapters.map((c,i) => option(i,number(i),existing.id === c.id)).join('') + '</select>') : '';
    app.dialogs.showDialog({title:t(existing ? 'editChapter' : 'newChapter'),body:'<div class="fields">' +
      field(t('chapterName'),input('title',existing?.title ?? '',t('chapterName'),true)) + position + '</div>',
      submitKey:existing ? 'save' : 'createChapter',onSubmit:data => {
        const title = data.get('title').trim();
        if (!title) return;
        app.dialogs.closeDialog();
        app.store.edit(() => {
          if (existing) {
            existing.title = title;
            p.chapters.splice(p.chapters.indexOf(existing),1);
            p.chapters.splice(Number(data.get('position')),0,existing);
          } else {
            const c = {id:uid(),title};
            p.chapters.push(c);
            app.workspace.enterProject(p,c.id);
          }
        },{fit:!existing});
        if (!existing) $('chapterTitle').focus();
      },remove:existing ? () => removeChapter(p,existing) : null});
  }

  function removeChapter(p,c) {
    if (!c) return;
    app.dialogs.confirmation(t('confirmChapter'),t('confirmChapterMessage',{name:c.title}),() => {
        const wasCurrent = app.store.chapter()?.id === c.id;
        const showsWholeMap = app.session.isWholeStory() || (app.session.isStructureView() && app.session.lastMapMode === 'whole-story');
        app.store.edit(() => {
          const index = p.chapters.indexOf(c);
          p.chapters.splice(index,1);
          const removed = new Set(p.nodes.filter(n => n.chapter === c.id).map(n => n.id));
          p.nodes = p.nodes.filter(n => !removed.has(n.id));
          p.edges = p.edges.filter(e => !removed.has(e.from) && !removed.has(e.to));
          if (removed.has(app.session.selection)) app.session.selection = null;
          if (wasCurrent) app.store.state.chapter = (p.chapters[index] ?? p.chapters.at(-1))?.id ?? null;
          if (!p.chapters.length) {
            app.session.lastMapMode = 'timeline';
            if (!app.session.isStructureView()) app.session.viewMode = 'timeline';
          }
          app.diagram.stopConnect();
        },{fit:wasCurrent || showsWholeMap});
        $('chapterTitle').focus();
        app.preferences.flash('chapterDeleted');
      });
  }

  function bindEvents() {
    bindActions({
      newHomeProject:createProject,
      addChapter:() => chapterDialog(),
      renameChapter:() => chapterDialog(app.store.chapter()),
      newEmptyChapter:() => chapterDialog(),
      changeNarrativeModel:editNarrativeModel
    });
    document.addEventListener('click',event => {
      const button = event.target.closest('button');
      if (!button) return;
      const {chapter:chapterId,project:projectId,deleteProject:projectToDelete,deleteChapter:chapterToDelete} = button.dataset;
      if (chapterId !== undefined) app.workspace.navigate(app.store.project().id,chapterId);
      if (projectId !== undefined) app.workspace.navigate(projectId);
      if (projectToDelete !== undefined) removeProject(app.store.state.projects.find(p => p.id === projectToDelete));
      if (chapterToDelete !== undefined) {
        const p = app.store.project();
        removeChapter(p,p?.chapters.find(c => c.id === chapterToDelete));
      }
      if (button.id === 'newProject') createProject();
      if (button.id === 'renameProject') editProject();
    });
  }

  return {
    bindEvents
  };
})(Enredo);
