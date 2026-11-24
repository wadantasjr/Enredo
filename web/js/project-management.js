Enredo.projectManagement = ((app) => {
  'use strict';

  const { $, bindActions, esc, field, icon, input, option, uid } = app.dom;
  const { t, tx } = app.preferences;
  const { dateDay, dayMs, priorities, sprintStatuses, taskStatuses, validRange } = app.projectManagementData;
  const statusKeys = {todo:'taskTodo',doing:'taskDoing',review:'taskReview',done:'taskDone',
    planned:'sprintPlanned',active:'sprintActive',completed:'sprintCompleted'};
  const priorityKeys = {low:'priorityLow',normal:'priorityNormal',high:'priorityHigh'};
  const sprintFilterValue = id => 'sprint:' + id;
  const byDate = (a,b) => a < b ? -1 : Number(a > b);
  const datesOf = items => [...items].sort((a,b) => byDate(a.start,b.start));
  const project = () => app.store.project();

  let view = 'tasks', sprintFilter = 'all', draggedTask = null;

  function resetView() {
    view = 'tasks';
    sprintFilter = 'all';
    $('projectManagementView').scrollTop = 0;
  }

  function filteredSprint(p) {
    return p.sprints.find(sprint => sprintFilterValue(sprint.id) === sprintFilter);
  }

  function filteredTasks(p) {
    if (sprintFilter === 'all') return p.tasks;
    const id = filteredSprint(p)?.id ?? null;
    return p.tasks.filter(task => task.sprintId === id);
  }

  function dateFormatter(options) {
    return new Intl.DateTimeFormat(document.documentElement.lang,{...options,timeZone:'UTC'});
  }

  function dateLabel(date) {
    return dateFormatter({dateStyle:'medium'}).format(dateDay(date) * dayMs);
  }

  function dateRange(start,end) {
    if (!start || !end || start === end) return dateLabel(start ?? end);
    return dateLabel(start) + ' – ' + dateLabel(end);
  }

  function statusBadge(status) {
    return '<span class="management-status" data-status="' + status + '">' + tx(statusKeys[status]) + '</span>';
  }

  function choiceList(values,labels,selected) {
    return values.map(value => option(value,t(labels[value]),value === selected)).join('');
  }

  function textBlock(text) {
    return text ? '<p class="management-notes">' + esc(text) + '</p>' : '';
  }

  function itemButton(item,kind) {
    return '<button type="button" class="management-item-title" data-edit-' + kind + '="' + esc(item.id) + '">' +
      esc(item.title) + '</button>';
  }

  function beatName(beat,p) {
    const chapter = p.chapters.find(item => item.id === beat.chapter);
    return t('beatWithChapter',{name:beat.title || t('untitled'),chapter:chapter.title});
  }

  function taskMeta(task,p) {
    const beat = p.nodes.find(item => item.id === task.beatId);
    const sprint = p.sprints.find(item => item.id === task.sprintId);
    const priority = tx('taskPriorityValue',{priority:t(priorityKeys[task.priority])});
    return '<div class="management-meta"><span>' + priority + '</span>' +
      (sprint ? '<span>' + esc(sprint.title) + '</span>' : '<span>' + tx('backlog') + '</span>') +
      (task.start || task.end ? '<span>' + esc(dateRange(task.start,task.end)) + '</span>' : '') +
      (beat ? '<button type="button" class="management-beat" data-task-beat="' + esc(beat.id) + '" title="' +
        tx('locateOnMap') + '">' + icon('branch') + ' ' + esc(beatName(beat,p)) + '</button>' : '') + '</div>';
  }

  function taskCard(task,p,{board = false} = {}) {
    const status = board ? '<select class="management-move" data-move-task="' + esc(task.id) +
      '" aria-label="' + tx('moveTask',{name:task.title}) + '">' +
      choiceList(taskStatuses,statusKeys,task.status) + '</select>' : statusBadge(task.status);
    return '<li class="management-card"' + (board ? ' draggable="true" data-task-card="' + esc(task.id) + '"' : '') +
      '><div class="management-card-heading">' + itemButton(task,'task') + (board ? '' : status) + '</div>' +
      taskMeta(task,p) + (board ? status : textBlock(task.notes)) + '</li>';
  }

  function emptyActivity(key) {
    return '<p class="management-empty hint">' + tx(key) + '</p>';
  }

  function renderTasks(p,tasks) {
    return tasks.length ? '<ul class="management-list">' + tasks.map(task => taskCard(task,p)).join('') + '</ul>' :
      emptyActivity(p.tasks.length ? 'noFilteredTasks' : 'noTasks');
  }

  function renderSprints(p) {
    if (!p.sprints.length) return emptyActivity('noSprints');
    return '<ul class="management-list">' + datesOf(p.sprints).map(sprint => {
      const tasks = p.tasks.filter(task => task.sprintId === sprint.id);
      const done = tasks.filter(task => task.status === 'done').length;
      return '<li class="management-card"><div class="management-card-heading">' + itemButton(sprint,'sprint') +
        statusBadge(sprint.status) + '</div><div class="management-meta"><span>' + esc(dateRange(sprint.start,sprint.end)) +
        '</span><span>' + tx('sprintProgress',{done,total:tasks.length}) + '</span></div>' + textBlock(sprint.goal) +
        '<div class="management-actions"><button type="button" class="btn" data-sprint-tasks="' + esc(sprint.id) + '">' + tx('viewSprintTasks') +
        '</button><button type="button" class="btn" data-new-task-sprint="' + esc(sprint.id) + '">' + icon('plus') + ' ' +
        tx('newTask') + '</button></div></li>';
    }).join('') + '</ul>';
  }

  function renderKanban(p,tasks) {
    return '<div class="management-scroll" tabindex="0" role="region" aria-label="' + tx('kanban') +
      '"><div class="management-board">' + taskStatuses.map(status => {
        const cards = tasks.filter(task => task.status === status);
        return '<section class="management-column" data-board-status="' + status + '" aria-labelledby="column-' + status +
          '"><header><h3 id="column-' + status + '">' + tx(statusKeys[status]) + '</h3><span class="count">' + cards.length +
          '</span><button type="button" class="icon-btn small" data-new-task-status="' + status + '" aria-label="' +
          tx('newTaskInStatus',{status:t(statusKeys[status])}) + '" title="' + tx('newTask') + '">' + icon('plus') +
          '</button></header>' + (cards.length ? '<ul class="management-list">' +
          cards.map(task => taskCard(task,p,{board:true})).join('') + '</ul>' : '<p class="hint">' + tx('emptyColumn') +
          '</p>') + '</section>';
      }).join('') + '</div></div>';
  }

  function scheduledRecords(p,tasks) {
    const sprint = filteredSprint(p);
    const sprints = sprintFilter === 'all' ? p.sprints : sprint ? [sprint] : [];
    return [...sprints.map(item => ({item,kind:'sprint'})),...tasks.map(item => ({item,kind:'task'}))];
  }

  function unscheduledItems(records) {
    return records.length ? '<section class="management-unscheduled"><h3>' + tx('undatedTasks') +
      '</h3><ul class="management-list">' + records.map(({item,kind}) => '<li class="management-card">' +
        itemButton(item,kind) + '</li>').join('') + '</ul></section>' : '';
  }

  function renderSchedule(p,tasks) {
    const records = scheduledRecords(p,tasks);
    const days = new Map();
    function addEntry(date,key,record) {
      if (!days.has(date)) days.set(date,[]);
      days.get(date).push({...record,key});
    }
    for (const record of records) {
      const {item,kind} = record;
      if (item.start && item.end && item.start === item.end) addEntry(item.start,kind + 'SameDay',record);
      else {
        if (item.start) addEntry(item.start,kind + 'Starts',record);
        if (item.end) addEntry(item.end,kind + 'Ends',record);
      }
    }
    const agenda = [...days].sort(([a],[b]) => byDate(a,b)).map(([date,entries]) =>
      '<li class="management-day"><h3><time datetime="' + date + '">' + esc(dateLabel(date)) + '</time></h3>' +
      '<ul class="management-list">' + entries.map(({key,item,kind}) => '<li class="management-card management-event">' +
        itemButton(item,kind) + '<span>' + tx(key) + '</span></li>').join('') + '</ul></li>').join('');
    return (agenda ? '<ol class="management-agenda">' + agenda + '</ol>' : emptyActivity('noScheduledItems')) +
      unscheduledItems(records.filter(({item}) => !item.start && !item.end));
  }

  function renderGantt(p,tasks) {
    const records = scheduledRecords(p,tasks);
    const unscheduled = unscheduledItems(records.filter(({item}) => !item.start && !item.end));
    const rows = records.filter(({item}) => item.start || item.end).map(record => {
      const {start,end} = record.item;
      return {...record,start:dateDay(start ?? end),end:dateDay(end ?? start)};
    }).sort((a,b) => a.start - b.start || b.end - a.end);
    if (!rows.length) return emptyActivity('noScheduledItems') + unscheduled;
    const first = rows[0].start;
    const last = rows.reduce((max,row) => Math.max(max,row.end),first);
    const span = last - first + 1;
    const step = Math.ceil(span / 6);
    const position = days => 100 * days / span + '%';
    const label = dateFormatter({month:'short',day:'numeric',
      ...(new Date(first * dayMs).getUTCFullYear() !== new Date(last * dayMs).getUTCFullYear() ? {year:'2-digit'} : {})});
    const ticks = Array.from({length:Math.ceil(span / step)},(_,index) => {
      const offset = step * index;
      return '<span style="left:' + position(offset) + '">' + esc(label.format((first + offset) * dayMs)) + '</span>';
    }).join('');
    const body = rows.map(({item,kind,start,end}) =>
      '<tr><th scope="row">' + itemButton(item,kind) + '<small>' + tx(kind === 'sprint' ? 'sprint' : 'task') + ' · ' +
        tx(statusKeys[item.status]) + '</small><small>' + esc(dateRange(item.start,item.end)) +
        '</small></th><td><div class="gantt-track" aria-hidden="true">' +
        '<span class="gantt-bar ' + (start === end ? 'milestone' : '') + '" data-kind="' + kind + '" data-status="' + item.status +
        '" style="left:' + position(start - first) + ';width:' + position(end - start + 1) + '"></span></div></td></tr>').join('');
    const date = dateFormatter({dateStyle:'medium'});
    const range = date.format(first * dayMs) + (first === last ? '' : ' – ' + date.format(last * dayMs));
    return '<div class="management-scroll" tabindex="0" role="region" aria-label="' + tx('gantt') +
      '"><table class="gantt-table" style="--gantt-step:' + position(step) + '"><caption>' + esc(range) +
      '</caption><thead><tr><th scope="col">' + tx('ganttItem') + '</th><th scope="col"><span class="sr-only">' +
      tx('schedule') + '</span><div class="gantt-axis" aria-hidden="true">' + ticks + '</div></th></tr></thead><tbody>' +
      body + '</tbody></table></div>' + unscheduled;
  }

  const renderers = {tasks:renderTasks,sprints:renderSprints,kanban:renderKanban,schedule:renderSchedule,gantt:renderGantt};

  function render() {
    const p = project();
    if (sprintFilter.startsWith('sprint:') && !filteredSprint(p)) sprintFilter = 'all';
    $('managementFilter').classList.toggle('is-hidden',view === 'sprints');
    $('managementSprintFilter').innerHTML = option('all',t('allSprints'),sprintFilter === 'all') +
      option('backlog',t('backlog'),sprintFilter === 'backlog') + datesOf(p.sprints).map(sprint => {
        const value = sprintFilterValue(sprint.id);
        return option(value,sprint.title,sprintFilter === value);
      }).join('');
    $('projectManagementView').querySelectorAll('[data-management-view]').forEach(button => {
      button.setAttribute('aria-pressed',button.dataset.managementView === view);
    });
    const panel = $('managementPanel');
    const scroll = panel.dataset.view === view ? panel.querySelector('.management-scroll')?.scrollLeft : 0;
    panel.dataset.view = view;
    panel.innerHTML = renderers[view](p,filteredTasks(p));
    if (scroll) panel.querySelector('.management-scroll')?.scrollTo(scroll,0);
  }

  function renderBeatTasks(beat,p) {
    const tasks = p.tasks.filter(task => task.beatId === beat.id);
    return '<section class="paths"><div class="paths-title"><span>' + tx('tasks') + '</span><span class="count">' +
      tasks.length + '</span></div><ul class="management-list beat-task-list">' +
      tasks.map(task => '<li class="path-item">' + itemButton(task,'task') + statusBadge(task.status) + '</li>').join('') +
      '</ul>' + (tasks.length ? '' : '<p class="hint">' + tx('noBeatTasks') + '</p>') +
      '<button type="button" class="btn path-add" id="newBeatTask">' + icon('plus') + ' ' + tx('newTask') + '</button></section>';
  }

  function selectField(name,key,options) {
    return field(t(key),'<select name="' + name + '">' + options + '</select>');
  }

  function descriptionField(name,key,value = '') {
    return field(t(key),'<textarea name="' + name + '" rows="3">' + esc(value[0] === '\n' ? '\n' + value : value) +
      '</textarea>');
  }

  function dateFields(record,required) {
    function dateInput(name,key) {
      return field(t(key),'<input type="date" name="' + name + '" min="0001-01-01" max="9999-12-31" value="' +
        esc(record?.[name] ?? '') + '"' + (required ? ' required' : '') + '>');
    }
    return '<div class="management-dates">' + dateInput('start','startDate') +
      dateInput('end',required ? 'endDate' : 'dueDate') + '</div>';
  }

  function validateDates(form) {
    for (const name of ['start','end']) {
      form.elements[name].addEventListener('input',() => form.elements.end.setCustomValidity(''));
    }
  }

  function readDates(data,required) {
    const start = data.get('start') || null, end = data.get('end') || null;
    if (validRange(start,end,{required})) return {start,end};
    const endInput = $('dialogForm').elements.end;
    endInput.setCustomValidity(t('invalidDateRange'));
    endInput.reportValidity();
    return null;
  }

  function focusItem(root,kind,id,fallback) {
    const button = id && root.querySelector('[data-edit-' + kind + '="' + CSS.escape(id) + '"]');
    (button || $(fallback))?.focus({preventScroll:true});
  }

  function taskDialog(existing = null,{beat = null,status = 'todo',sprintId = null} = {}) {
    const p = project();
    const selectedSprint = existing ? existing.sprintId : sprintId;
    const sprintOptions = option('',t('backlog'),selectedSprint === null) + datesOf(p.sprints).map(sprint =>
      option(sprint.id,sprint.title,selectedSprint === sprint.id)).join('');
    const beatOptions = beat ? '' : option('',t('noTaskBeat'),!existing?.beatId) + p.chapters.flatMap(chapter =>
      p.nodes.filter(item => item.chapter === chapter.id).map(item =>
        option(item.id,beatName(item,p),item.id === existing?.beatId))).join('');
    const root = beat ? $('inspector') : $('managementPanel');
    const fallback = beat ? 'newBeatTask' : 'newTask';
    function focus(id) { focusItem(root,'task',id,fallback); }
    app.dialogs.showDialog({title:t(existing ? 'editTask' : 'newTask'),body:'<div class="fields">' +
      field(t('title'),input('title',existing?.title ?? '','',true)) +
      descriptionField('notes','notes',existing?.notes) +
      selectField('status','taskStatus',choiceList(taskStatuses,statusKeys,existing?.status ?? status)) +
      selectField('priority','taskPriority',choiceList(priorities,priorityKeys,existing?.priority ?? 'normal')) +
      selectField('sprintId','sprint',sprintOptions) + (beat ? '' : selectField('beatId','storyBeat',beatOptions)) +
      dateFields(existing,false) + (existing ? '<div>' + app.imageGallery.launcher('task',existing) + '</div>' : '') +
      '</div>',submitKey:existing ? 'save' : 'add',extra:validateDates,onSubmit:data => {
        const title = data.get('title').trim(), dates = readDates(data,false);
        if (!title || !dates) return;
        const record = {id:existing?.id ?? uid(),title,notes:data.get('notes').trim(),
          status:data.get('status'),priority:data.get('priority'),
          sprintId:data.get('sprintId') || null,beatId:beat?.id ?? (data.get('beatId') || null),...dates};
        app.dialogs.closeDialog();
        app.store.edit(() => {
          if (existing) Object.assign(existing,record);
          else p.tasks.push(record);
        },{saveError:'projectSaveFailed'});
        focus(record.id);
      },remove:existing ? () => app.dialogs.confirmation(t('deleteTask'),t('deleteTaskMessage',{name:existing.title}),() => {
        app.store.edit(() => { p.tasks = p.tasks.filter(task => task !== existing); },{saveError:'projectSaveFailed'});
        focus(existing.id);
      }) : null});
  }

  function sprintDialog(existing = null) {
    const p = project();
    function focus(id) { focusItem($('managementPanel'),'sprint',id,'newSprint'); }
    app.dialogs.showDialog({title:t(existing ? 'editSprint' : 'newSprint'),body:'<div class="fields">' +
      field(t('name'),input('title',existing?.title ?? '','',true)) + descriptionField('goal','sprintGoal',existing?.goal) +
      selectField('status','sprintStatus',choiceList(sprintStatuses,statusKeys,existing?.status ?? 'planned')) +
      dateFields(existing,true) + '</div>',submitKey:existing ? 'save' : 'add',extra:validateDates,onSubmit:data => {
        const title = data.get('title').trim(), dates = readDates(data,true);
        if (!title || !dates) return;
        const record = {id:existing?.id ?? uid(),title,goal:data.get('goal').trim(),status:data.get('status'),...dates};
        app.dialogs.closeDialog();
        app.store.edit(() => {
          if (existing) Object.assign(existing,record);
          else p.sprints.push(record);
      },{saveError:'projectSaveFailed',afterSave:() => { if (!existing) view = 'sprints'; }});
        focus(record.id);
      },remove:existing ? () => app.dialogs.confirmation(t('deleteSprint'),t('deleteSprintMessage',{name:existing.title}),() => {
        app.store.edit(() => {
          p.sprints = p.sprints.filter(sprint => sprint !== existing);
          for (const task of p.tasks) if (task.sprintId === existing.id) task.sprintId = null;
        },{saveError:'projectSaveFailed'});
        focus(existing.id);
      }) : null});
  }

  function moveTask(id,status) {
    const task = project().tasks.find(item => item.id === id);
    if (!task || task.status === status || !taskStatuses.includes(status)) return;
    app.store.edit(() => { task.status = status; },{saveError:'projectSaveFailed'});
    $('managementPanel').querySelector('[data-move-task="' + CSS.escape(id) + '"]')?.focus();
  }

  function handleViewClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const {managementView,editTask,editSprint,newTaskStatus,newTaskSprint,sprintTasks,taskBeat} = button.dataset;
    const p = project();
    if (managementView) {
      view = managementView;
      render();
    } else if (editTask !== undefined) {
      const task = p.tasks.find(item => item.id === editTask);
      if (task) taskDialog(task);
    } else if (editSprint !== undefined) {
      const sprint = p.sprints.find(item => item.id === editSprint);
      if (sprint) sprintDialog(sprint);
    } else if (newTaskStatus) {
      taskDialog(null,{status:newTaskStatus,sprintId:filteredSprint(p)?.id ?? null});
    } else if (newTaskSprint !== undefined) {
      taskDialog(null,{sprintId:newTaskSprint});
    } else if (sprintTasks !== undefined) {
      sprintFilter = sprintFilterValue(sprintTasks);
      view = 'tasks';
      render();
      $('managementSprintFilter').focus();
    } else if (taskBeat !== undefined) {
      app.workspace.inspect(taskBeat,true);
      app.diagram.cardFor(taskBeat)?.focus();
    }
  }

  function handleInspectorClick(event) {
    const button = event.target.closest('button');
    const beat = app.store.selectedNode();
    if (!button || !beat) return;
    if (button.id === 'newBeatTask') taskDialog(null,{beat});
    else if (button.dataset.editTask !== undefined) {
      const task = project().tasks.find(item => item.id === button.dataset.editTask && item.beatId === beat.id);
      if (task) taskDialog(task,{beat});
    }
  }

  function bindBoard(root) {
    function clearDrag() {
      draggedTask = null;
      root.querySelector('.management-column.is-drop-target')?.classList.remove('is-drop-target');
    }
    root.addEventListener('dragstart',event => {
      const card = event.target.closest('[data-task-card]');
      if (!card || event.target !== card) return;
      draggedTask = card.dataset.taskCard;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain',draggedTask);
    });
    root.addEventListener('dragend',clearDrag);
    root.addEventListener('dragover',event => {
      const column = event.target.closest('[data-board-status]');
      if (draggedTask === null || !column) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const previous = root.querySelector('.management-column.is-drop-target');
      if (previous !== column) previous?.classList.remove('is-drop-target');
      column.classList.add('is-drop-target');
    });
    root.addEventListener('dragleave',event => {
      const column = event.target.closest('[data-board-status]');
      if (column && !column.contains(event.relatedTarget)) column.classList.remove('is-drop-target');
    });
    root.addEventListener('drop',event => {
      const status = event.target.closest('[data-board-status]')?.dataset.boardStatus;
      if (draggedTask === null || !status) return;
      event.preventDefault();
      const id = draggedTask;
      clearDrag();
      moveTask(id,status);
    });
  }

  function bindEvents() {
    const root = $('projectManagementView');
    bindActions({
      newTask:() => taskDialog(null,{sprintId:filteredSprint(project())?.id ?? null}),
      newSprint:() => sprintDialog()
    });
    root.addEventListener('click',handleViewClick);
    root.addEventListener('change',event => {
      const select = event.target;
      if (select.id === 'managementSprintFilter') {
        sprintFilter = select.value;
        render();
      } else if (select.dataset.moveTask !== undefined) moveTask(select.dataset.moveTask,select.value);
    });
    $('inspector').addEventListener('click',handleInspectorClick);
    bindBoard(root);
  }

  return {bindEvents,render,renderBeatTasks,resetView};
})(Enredo);
