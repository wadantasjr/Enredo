Enredo.projectManagementData = (() => {
  'use strict';

  const taskStatuses = ['todo','doing','review','done'];
  const sprintStatuses = ['planned','active','completed'];
  const priorities = ['low','normal','high'];
  const dayMs = 86400000;
  const hasText = value => typeof value === 'string' && value.trim().length > 0;
  const optionalId = value => value === null || typeof value === 'string';

  function dateDay(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) return NaN;
    const ms = Date.parse(date + 'T00:00:00Z');
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10) === date ? ms / dayMs : NaN;
  }

  function validRange(start,end,{required = false} = {}) {
    return (Number.isFinite(dateDay(start)) || (!required && start === null)) &&
      (Number.isFinite(dateDay(end)) || (!required && end === null)) &&
      (start === null || end === null || start <= end);
  }

  function readCollection(records,valid) {
    if (records === undefined) return [];
    if (!Array.isArray(records) || !records.every(record => record && hasText(record.id) && valid(record)) ||
        new Set(records.map(record => record.id)).size !== records.length) throw new Error('Invalid project management data');
    return records;
  }

  function normalizeProject(project) {
    const sprints = readCollection(project.sprints,sprint => hasText(sprint.title) && typeof sprint.goal === 'string' &&
      sprintStatuses.includes(sprint.status) && validRange(sprint.start,sprint.end,{required:true}));
    const sprintIds = new Set(sprints.map(sprint => sprint.id));
    const beatIds = new Set(project.nodes.map(node => node.id));
    const tasks = readCollection(project.tasks,task => hasText(task.title) && typeof task.notes === 'string' &&
      taskStatuses.includes(task.status) && priorities.includes(task.priority) && validRange(task.start,task.end) &&
      optionalId(task.beatId) && optionalId(task.sprintId)).map(task => ({...task,
        beatId:beatIds.has(task.beatId) ? task.beatId : null,
        sprintId:sprintIds.has(task.sprintId) ? task.sprintId : null
      }));
    return {...project,tasks,sprints};
  }

  function detachBeats(project,beatIds) {
    for (const task of project.tasks) if (beatIds.has(task.beatId)) task.beatId = null;
  }

  return {dateDay,dayMs,detachBeats,normalizeProject,priorities,sprintStatuses,taskStatuses,validRange};
})();
