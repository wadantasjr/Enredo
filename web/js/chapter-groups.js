Enredo.chapterGroups = ((app) => {
  'use strict';

  const { $, esc, field, input, icon, uid, bindActions } = app.dom;
  const { t, tx } = app.preferences;
  const collapsed = new Set();
  let collapseProjectId = null;
  let drag = null;
  let suppressClickUntil = 0;

  const project = () => app.store.project();
  const groups = p => p.chapterGroups ?? [];
  const chapterGroupId = chapter => chapter.groupId ?? null;
  const groupChapters = (p,id) => p.chapters.filter(chapter => chapterGroupId(chapter) === id)
    .sort((a,b) => (a.groupOrder ?? p.chapters.indexOf(a)) - (b.groupOrder ?? p.chapters.indexOf(b)));

  function chapterRow(p,chapter) {
    const index = p.chapters.indexOf(chapter);
    const active = !app.session.presentation && app.store.chapter()?.id === chapter.id;
    const menuId = 'chapter-menu-' + chapter.id;
    return '<div class="chapter-row" data-drop-chapter="' + esc(chapter.id) + '" data-chapter-group="' +
      esc(chapterGroupId(chapter) ?? '') + '">' + app.workspace.chapterButton(chapter,index,active) +
      '<button type="button" class="icon-btn small chapter-drag-handle" data-drag-kind="chapter" data-drag-id="' +
      esc(chapter.id) + '" title="' + tx('dragChapter') + '" aria-label="' + tx('dragChapter') + '">' + icon('move') + '</button>' +
      '<div class="menu-wrap chapter-row-menu-wrap"><button type="button" class="icon-btn small" data-menu="' +
      esc(menuId) + '" aria-expanded="false" aria-label="' + esc(tx('chapterActions',{name:chapter.title})) + '">' + icon('more') +
      '</button><div class="menu align-right" id="' + esc(menuId) + '" hidden>' +
      '<button type="button" data-chapter-action="edit" data-id="' + esc(chapter.id) + '">' + icon('edit') + ' ' + tx('editChapter') + '</button>' +
      (groups(p).length ? '<button type="button" data-chapter-action="move" data-id="' + esc(chapter.id) + '">' + icon('folder') + ' ' + tx('moveChapterToGroup') + '</button>' : '') +
      '<button type="button" data-chapter-action="up" data-id="' + esc(chapter.id) + '">' + icon('up') + ' ' + tx('moveUp') + '</button>' +
      '<button type="button" data-chapter-action="down" data-id="' + esc(chapter.id) + '">' + icon('down') + ' ' + tx('moveDown') + '</button>' +
      '<button type="button" data-chapter-action="delete" data-id="' + esc(chapter.id) + '">' + icon('trash') + ' ' + tx('deleteChapter') + '</button>' +
      '</div></div></div>';
  }

  function groupMenu(group,index,p) {
    const menuId = 'group-menu-' + group.id;
    return '<div class="menu-wrap chapter-row-menu-wrap"><button type="button" class="icon-btn small" data-menu="' +
      esc(menuId) + '" aria-expanded="false" aria-label="' + esc(tx('groupActions',{name:group.title})) + '">' + icon('more') +
      '</button><div class="menu align-right" id="' + esc(menuId) + '" hidden>' +
      '<button type="button" data-group-action="new-chapter" data-id="' + esc(group.id) + '">' + icon('plus') + ' ' + tx('newChapter') + '</button>' +
      '<button type="button" data-group-action="edit" data-id="' + esc(group.id) + '">' + icon('edit') + ' ' + tx('editGroup') + '</button>' +
      '<button type="button" data-group-action="up" data-index="' + index + '">' + icon('up') + ' ' + tx('moveUp') + '</button>' +
      '<button type="button" data-group-action="down" data-index="' + index + '">' + icon('down') + ' ' + tx('moveDown') + '</button>' +
      '<button type="button" data-group-action="delete" data-id="' + esc(group.id) + '">' + icon('trash') + ' ' + tx('deleteGroup') + '</button>' +
      '</div></div>';
  }

  function groupRow(p,group,index) {
    const selected = app.session.presentation?.type === 'group' && app.session.presentation.id === group.id;
    const folded = collapsed.has(group.id);
    const listId = 'group-chapters-' + group.id;
    const items = groupChapters(p,group.id);
    return '<section class="chapter-group" data-drop-group="' + esc(group.id) + '" data-group-id="' + esc(group.id) + '">' +
      '<div class="chapter-group-heading">' +
      '<button type="button" class="chapter-group-open' + (selected ? ' active' : '') + '" data-open-group="' + esc(group.id) +
      '" aria-current="' + (selected ? 'page' : 'false') + '">' + app.imageEditor.coverMarkup(group.cover,'group-nav-cover') +
      '<span class="chapter-group-name clip" title="' + esc(group.title) + '">' + esc(group.title) + '</span>' +
      '<span class="chapter-group-count">' + app.workspace.countText(items.length,'countChapter') + '</span></button>' +
      '<button type="button" class="icon-btn small chapter-group-toggle" data-group-toggle="' + esc(group.id) +
      '" aria-expanded="' + !folded + '" aria-controls="' + esc(listId) + '" aria-label="' + esc(tx(folded ? 'expandGroup' : 'collapseGroup',{name:group.title})) + '">' +
      icon('chevron') + '</button><button type="button" class="icon-btn small chapter-drag-handle" data-drag-kind="group" data-drag-id="' +
      esc(group.id) + '" title="' + tx('dragGroup') + '" aria-label="' + tx('dragGroup') + '">' + icon('move') + '</button>' +
      groupMenu(group,index,p) + '</div><div class="chapter-group-list" id="' + esc(listId) + '"' + (folded ? ' hidden' : '') + '>' +
      items.map(chapter => chapterRow(p,chapter)).join('') +
      '<button type="button" class="chapter-group-new" data-new-group-chapter="' + esc(group.id) + '">' + icon('plus') + ' ' + tx('newChapter') + '</button>' +
      '</div></section>';
  }

  function ungroupedRow(p) {
    const id = '';
    const selected = app.session.presentation?.type === 'ungrouped';
    const folded = collapsed.has('');
    const items = groupChapters(p,null);
    const listId = 'ungrouped-chapters';
    return '<section class="chapter-group ungrouped-group" data-drop-group="" data-group-id="">' +
      '<div class="chapter-group-heading"><button type="button" class="chapter-group-open' + (selected ? ' active' : '') +
      '" data-open-ungrouped="true" aria-current="' + (selected ? 'page' : 'false') + '">' +
      '<span class="cover-frame group-nav-cover"><span class="cover-fallback" aria-hidden="true">' + icon('book') + '</span></span>' +
      '<span class="chapter-group-name">' + tx('ungrouped') + '</span><span class="chapter-group-count">' +
      app.workspace.countText(items.length,'countChapter') + '</span></button>' +
      '<button type="button" class="icon-btn small chapter-group-toggle" data-group-toggle="" aria-expanded="' + !folded +
      '" aria-controls="' + listId + '" aria-label="' + tx(folded ? 'expandGroup' : 'collapseGroup',{name:t('ungrouped')}) + '">' + icon('chevron') + '</button>' +
      '<button type="button" class="icon-btn small" data-new-ungrouped-chapter="true" aria-label="' + tx('newChapter') + '">' + icon('plus') + '</button>' +
      '</div><div class="chapter-group-list" id="' + listId + '"' + (folded ? ' hidden' : '') + '>' +
      items.map(chapter => chapterRow(p,chapter)).join('') + '</div></section>';
  }

  function renderNavigation() {
    const p = project();
    if (!p) return;
    if (collapseProjectId !== p.id) {
      collapsed.clear();
      collapseProjectId = p.id;
    }
    const list = groups(p).map((group,index) => groupRow(p,group,index));
    if (!groups(p).length || groupChapters(p,null).length) list.push(ungroupedRow(p));
    $('chapters').innerHTML = list.join('');
    app.imageEditor.renderCoverPreviews($('chapters'));
  }

  function groupDialog(group = null) {
    const p = project();
    const body = '<div class="fields">' + field(t('groupName'),input('title',group?.title ?? '',t('groupName'),true)) +
      field(t('groupDescription'),'<textarea name="description" maxlength="4000">' + esc(group?.description ?? '') + '</textarea>') +
      (group ? app.imageEditor.coverControls('group',group.id,group.cover) +
        '<div>' + app.imageGallery.launcher('group',group) + '</div>' : '') + '</div>';
    app.dialogs.showDialog({title:t(group ? 'editGroup' : 'newGroup'),body,submitKey:group ? 'save' : 'createGroup',onSubmit:data => {
      const title = data.get('title').trim();
      if (!title) return;
      const description = data.get('description').trim();
      app.dialogs.closeDialog();
      let created;
      app.store.edit(() => {
        if (group) {
          group.title = title;
          group.description = description;
        } else {
          created = {id:uid(),title,description};
          p.chapterGroups ??= [];
          p.chapterGroups.push(created);
        }
      });
      if (created) openGroup(created.id);
      else if (group) Array.from($('chapters').querySelectorAll('[data-open-group]'))
        .find(button => button.dataset.openGroup === group.id)?.focus({preventScroll:true});
    }});
  }

  function deleteGroup(group) {
    if (!group) return;
    const count = groupChapters(project(),group.id).length;
    app.dialogs.confirmation(t('deleteGroup'),t('deleteGroupMessage',{name:group.title,count}),() => {
      const p = project();
      app.store.edit(() => {
        for (const chapter of p.chapters) if (chapter.groupId === group.id) {
          delete chapter.groupId;
          delete chapter.groupOrder;
        }
        p.chapterGroups = groups(p).filter(item => item.id !== group.id);
        if (!p.chapterGroups.length) delete p.chapterGroups;
        if (app.session.presentation?.type === 'group' && app.session.presentation.id === group.id) {
          app.session.presentation = {type:'project'};
        }
        collapsed.delete(group.id);
      });
    });
  }

  function openGroup(id) {
    const group = groups(project()).find(item => item.id === id);
    if (!group) return;
    if (app.session.diagramFullscreen) app.workspace.setDiagramFullscreen(false);
    app.session.charactersOpen = false;
    app.session.managementOpen = false;
    app.session.presentation = {type:'group',id};
    collapsed.delete(id);
    app.diagram.stopConnect();
    app.workspace.render();
    $('chapterTitle').focus();
  }

  function openUngrouped() {
    if (app.session.diagramFullscreen) app.workspace.setDiagramFullscreen(false);
    app.session.charactersOpen = false;
    app.session.managementOpen = false;
    app.session.presentation = {type:'ungrouped'};
    collapsed.delete('');
    app.diagram.stopConnect();
    app.workspace.render();
    $('chapterTitle').focus();
  }

  function openProjectPresentation(projectId = null) {
    const target = projectId ? app.store.state.projects.find(item => item.id === projectId) : project();
    if (!target) return;
    if (target.id !== project()?.id || app.session.atHome) {
      const rememberedChapter = target.id === app.store.state.active &&
        target.chapters.some(chapter => chapter.id === app.store.state.chapter)
        ? app.store.state.chapter : target.chapters[0]?.id;
      app.workspace.enterProject(target,rememberedChapter);
      app.store.save();
    }
    if (app.session.diagramFullscreen) app.workspace.setDiagramFullscreen(false);
    app.session.charactersOpen = false;
    app.session.managementOpen = false;
    app.session.presentation = {type:'project'};
    app.diagram.stopConnect();
    app.workspace.render();
    $('chapterTitle').focus();
  }

  function presentationChapter(chapter,p) {
    const cover = chapter.cover?.assetId ? app.imageEditor.coverMarkup(chapter.cover,'chapter-list-cover') : '';
    return '<li><button type="button" class="presentation-chapter" data-chapter="' + esc(chapter.id) + '">' +
      '<span class="chapter-no">' + app.dom.number(p.chapters.indexOf(chapter)) + '</span>' + cover + '<span class="clip">' +
      esc(chapter.title || t('untitled')) + '</span><span>' + icon('right') + '</span></button></li>';
  }

  function presentationGroup(group,p,index) {
    const groupId = group?.id ?? null;
    const chapters = groupChapters(p,groupId);
    const title = group?.title ?? t('ungrouped');
    const action = group ? 'data-open-group="' + esc(group.id) + '"' : 'data-open-ungrouped="true"';
    const dropTarget = 'data-drop-group="' + esc(groupId ?? '') + '"';
    return '<li ' + dropTarget + '><button type="button" class="presentation-group-link" ' + action + '>' +
      '<span class="chapter-no">' + app.dom.number(index) + '</span>' +
      app.imageEditor.coverMarkup(group?.cover,'group-list-cover') +
      '<span class="clip" title="' + esc(title) + '">' + esc(title) + '</span>' +
      '<span class="presentation-group-count">' + app.workspace.countText(chapters.length,'countChapter') + '</span>' +
      '<span>' + icon('right') + '</span></button></li>';
  }

  function renderPresentation() {
    const p = project(), view = app.session.presentation;
    if (!p || !view) return;
    if (view.type === 'project') {
      const chapterCount = app.workspace.countText(p.chapters.length,'countChapter');
      const nodeCount = app.workspace.countText(p.nodes.length,'countNode');
      const ungrouped = groupChapters(p,null);
      const projectGroups = groups(p).map((group,index) => presentationGroup(group,p,index));
      if (ungrouped.length) projectGroups.push(presentationGroup(null,p,projectGroups.length));
      $('presentationContent').innerHTML = '<div class="project-presentation-hero">' +
        app.imageEditor.coverMarkup(p.cover,'project-presentation-cover') + '<div><span class="eyebrow">' + tx('project') + '</span>' +
        '<h2>' + esc(p.title || t('untitled')) + '</h2><p>' + chapterCount + ' · ' + nodeCount + '</p><div class="presentation-actions">' +
        (p.chapters.length
          ? '<button type="button" class="btn primary" data-chapter="' + esc(app.store.chapter()?.id ?? p.chapters[0].id) + '">' + tx('openEditor') + '</button>'
          : '<button type="button" class="btn primary" data-create-project-chapter="true">' + tx('createChapter') + '</button>') +
        app.imageGallery.launcher('project',p) + '</div></div></div><h3 class="presentation-section-title">' + tx('groups') + '</h3>' +
        (projectGroups.length ? '<ul class="presentation-group-list">' + projectGroups.join('') + '</ul>' : '');
    } else {
      const group = view.type === 'group' ? groups(p).find(item => item.id === view.id) : null;
      if (view.type === 'group' && !group) return;
      const title = group?.title ?? t('ungrouped');
      const members = groupChapters(p,group?.id ?? null);
      $('presentationContent').innerHTML = '<div class="group-presentation-hero">' +
        app.imageEditor.coverMarkup(group?.cover,'group-presentation-cover') + '<div><span class="eyebrow">' + tx('group') + '</span>' +
        '<h2>' + esc(title) + '</h2>' + (group?.description ? '<p class="group-description">' + esc(group.description) + '</p>' : '') +
        '<p>' + app.workspace.countText(members.length,'countChapter') + '</p>' +
        (group ? '<div class="presentation-actions"><button type="button" class="btn" data-new-group-chapter="' + esc(group.id) + '">' +
          icon('plus') + ' ' + tx('newChapter') + '</button>' + app.imageGallery.launcher('group',group) + '</div>' : '') +
        '</div></div><h3 class="presentation-section-title">' + tx('chapters') + '</h3>' +
        (members.length ? '<ul class="presentation-chapter-list">' + members.map(chapter => presentationChapter(chapter,p)).join('') +
          '</ul>' : '<p class="hint">' + tx('noGroupChapters') + '</p>');
    }
    app.imageEditor.renderCoverPreviews($('presentationContent'));
  }

  function reorderGroup(index,step) {
    const p = project(), list = groups(p), next = index + step;
    if (next < 0 || next >= list.length) return;
    const movedId = list[index].id;
    app.store.edit(() => [list[index],list[next]] = [list[next],list[index]]);
    document.getElementById('group-menu-' + movedId)?.parentElement.querySelector('[data-menu]')?.focus({preventScroll:true});
  }

  function reorderChapters(p,id,step) {
    const chapter = p.chapters.find(item => item.id === id);
    if (!chapter) return;
    const groupId = chapterGroupId(chapter);
    const list = groupChapters(p,groupId);
    const index = list.indexOf(chapter), next = index + step;
    if (next < 0 || next >= list.length) return;
    app.store.edit(() => {
      if (groupId == null) {
        const first = p.chapters.indexOf(list[index]);
        const second = p.chapters.indexOf(list[next]);
        [p.chapters[first],p.chapters[second]] = [p.chapters[second],p.chapters[first]];
      } else {
        [list[index].groupOrder,list[next].groupOrder] = [list[next].groupOrder,list[index].groupOrder];
      }
    });
    document.getElementById('chapter-menu-' + id)?.parentElement.querySelector('[data-menu]')?.focus({preventScroll:true});
  }

  function moveChapterToGroup(p,chapter,groupId,order = null) {
    const validId = groupId && groups(p).some(group => group.id === groupId) ? groupId : null;
    const target = groupChapters(p,validId).filter(item => item !== chapter);
    app.store.edit(() => {
      if (validId) {
        chapter.groupId = validId;
        const position = order == null ? target.length : Math.max(0,Math.min(order,target.length));
        target.splice(position,0,chapter);
        target.forEach((item,index) => { item.groupOrder = index; });
      } else {
        delete chapter.groupId;
        delete chapter.groupOrder;
      }
    });
  }

  function moveChapterDialog(p,chapter) {
    const selected = chapterGroupId(chapter);
    const choices = app.dom.option('',t('noGroup'),selected == null) + groups(p)
      .map(group => app.dom.option(group.id,group.title,group.id === selected)).join('');
    app.dialogs.showDialog({title:t('moveChapterToGroup'),body:'<div class="fields">' +
      field(t('chapterGroup'),'<select name="groupId">' + choices + '</select>') + '</div>',submitKey:'save',onSubmit:data => {
        const target = data.get('groupId') || null;
        app.dialogs.closeDialog();
        if (target !== chapterGroupId(chapter)) moveChapterToGroup(p,chapter,target);
        document.getElementById('chapter-menu-' + chapter.id)?.parentElement.querySelector('[data-menu]')?.focus({preventScroll:true});
      }});
  }

  function reorderChapterBefore(p,chapter,target) {
    const sourceGroup = chapterGroupId(chapter), targetGroup = chapterGroupId(target);
    if (!chapter || !target || chapter === target) return;
    if (sourceGroup !== targetGroup) {
      const position = groupChapters(p,targetGroup).indexOf(target);
      moveChapterToGroup(p,chapter,targetGroup,position);
      return;
    }
    const list = groupChapters(p,sourceGroup);
    const from = list.indexOf(chapter), to = list.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    app.store.edit(() => {
      list.splice(from,1);
      list.splice(to,0,chapter);
      if (sourceGroup == null) {
        const oldIndex = p.chapters.indexOf(chapter);
        p.chapters.splice(oldIndex,1);
        p.chapters.splice(p.chapters.indexOf(target),0,chapter);
        return;
      }
      list.forEach((item,index) => { item.groupOrder = index; });
    });
  }

  function dropChapter(chapterId,groupId,chapterTargetId = null) {
    const p = project(), chapter = p?.chapters.find(item => item.id === chapterId);
    if (!chapter) return;
    if (chapterTargetId) {
      const target = p.chapters.find(item => item.id === chapterTargetId);
      if (target) reorderChapterBefore(p,chapter,target);
    } else if (chapterGroupId(chapter) !== (groupId || null)) moveChapterToGroup(p,chapter,groupId || null);
  }

  function pointerDown(event) {
    const handle = event.target.closest('[data-drag-kind]');
    if (!handle || event.button !== 0) return;
    drag = {kind:handle.dataset.dragKind,id:handle.dataset.dragId,pointerId:event.pointerId,
      x:event.clientX,y:event.clientY,moved:false,target:null};
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function pointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x,event.clientY - drag.y) < 8) return;
    drag.moved = true;
    document.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
    const target = document.elementFromPoint(event.clientX,event.clientY);
    const chapterTarget = target?.closest('[data-drop-chapter]');
    const groupTarget = target?.closest('[data-drop-group]');
    if (drag.kind === 'chapter' && chapterTarget && chapterTarget.dataset.dropChapter !== drag.id) {
      drag.target = {type:'chapter',id:chapterTarget.dataset.dropChapter};
      chapterTarget.classList.add('is-drop-target');
    } else if (groupTarget && (drag.kind !== 'group' || groupTarget.dataset.groupId)) {
      drag.target = {type:'group',id:groupTarget.dataset.groupId};
      groupTarget.classList.add('is-drop-target');
    } else drag.target = null;
  }

  function pointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const current = drag;
    drag = null;
    document.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
    if (!current.moved || !current.target) return;
    suppressClickUntil = Date.now() + 400;
    if (current.kind === 'chapter') {
      if (current.target.type === 'chapter') dropChapter(current.id,null,current.target.id);
      else dropChapter(current.id,current.target.id);
    } else if (current.kind === 'group' && current.target.type === 'group') {
      const list = groups(project()), from = list.findIndex(group => group.id === current.id), to = list.findIndex(group => group.id === current.target.id);
      if (from >= 0 && to >= 0 && from !== to) app.store.edit(() => {
        const [item] = list.splice(from,1);
        list.splice(to > from ? to : to,0,item);
      });
    }
  }

  function pointerCancel(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    document.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
  }

  function handleNavigationClick(event) {
    if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.openGroup) openGroup(button.dataset.openGroup);
    else if (button.hasAttribute('data-open-ungrouped')) openUngrouped();
    else if (button.dataset.groupToggle !== undefined) {
      const id = button.dataset.groupToggle;
      if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
      renderNavigation();
      app.workspace.renderWorkspaceControls();
      Array.from($('chapters').querySelectorAll('[data-group-toggle]'))
        .find(item => item.dataset.groupToggle === id)?.focus({preventScroll:true});
    } else if (button.id === 'addChapterGroup') groupDialog();
    else if (button.dataset.newGroupChapter) app.projects.chapterDialog(null,button.dataset.newGroupChapter);
    else if (button.hasAttribute('data-new-ungrouped-chapter')) app.projects.chapterDialog();
    else if (button.dataset.groupAction) handleGroupAction(button);
    else if (button.dataset.chapterAction) handleChapterAction(button);
  }

  function handleGroupAction(button) {
    const p = project(), group = groups(p).find(item => item.id === button.dataset.id);
    if (button.dataset.groupAction === 'new-chapter' && group) app.projects.chapterDialog(null,group.id);
    if (button.dataset.groupAction === 'edit' && group) groupDialog(group);
    if (button.dataset.groupAction === 'delete' && group) deleteGroup(group);
    if (button.dataset.groupAction === 'up' || button.dataset.groupAction === 'down') {
      reorderGroup(Number(button.dataset.index),button.dataset.groupAction === 'up' ? -1 : 1);
    }
  }

  function handleChapterAction(button) {
    const p = project(), chapter = p.chapters.find(item => item.id === button.dataset.id);
    if (!chapter) return;
    if (button.dataset.chapterAction === 'edit') app.projects.chapterDialog(chapter);
    if (button.dataset.chapterAction === 'move') moveChapterDialog(p,chapter);
    if (button.dataset.chapterAction === 'delete') app.projects.removeChapter(p,chapter);
    if (button.dataset.chapterAction === 'up') reorderChapters(p,chapter.id,-1);
    if (button.dataset.chapterAction === 'down') reorderChapters(p,chapter.id,1);
  }

  function handlePresentationClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.openGroup) openGroup(button.dataset.openGroup);
    else if (button.hasAttribute('data-open-ungrouped')) openUngrouped();
    else if (button.dataset.newGroupChapter) app.projects.chapterDialog(null,button.dataset.newGroupChapter);
    else if (button.hasAttribute('data-create-project-chapter')) app.projects.chapterDialog();
  }

  function bindEvents() {
    $('chapters').addEventListener('click',handleNavigationClick);
    $('chapters').addEventListener('pointerdown',pointerDown);
    document.addEventListener('pointermove',pointerMove);
    document.addEventListener('pointerup',pointerUp);
    document.addEventListener('pointercancel',pointerCancel);
    $('presentationContent').addEventListener('click',handlePresentationClick);
    bindActions({addChapterGroup:() => groupDialog()});
    document.addEventListener('click',event => {
      const button = event.target.closest('[data-project-overview]');
      if (button) openProjectPresentation(button.dataset.projectOverview);
    });
  }

  return {
    bindEvents,
    groupChapters,
    openGroup,
    openProjectPresentation,
    renderNavigation,
    renderPresentation
  };
})(Enredo);
