Enredo.storyData = ((app) => {
  'use strict';

  const kinds = ['scene','decision','outcome','merge','ending'];

  const storageKey = 'enredo.story-planner.v1';

  function validProject(p) {
    const string = value => typeof value === 'string';
    if (!p || !string(p.id) || !string(p.title) || !Array.isArray(p.chapters) ||
        !Array.isArray(p.nodes) || !Array.isArray(p.edges)) return false;
    if (!p.chapters.every(c => c && string(c.id) && string(c.title))) return false;
    const chapterIds = new Set(p.chapters.map(c => c.id));
    if (chapterIds.size !== p.chapters.length) return false;
    if (!p.nodes.every(n => n && string(n.id) && chapterIds.has(n.chapter) &&
        kinds.includes(n.kind) && string(n.title) && string(n.notes) &&
        Number.isFinite(n.x) && Number.isFinite(n.y))) return false;
    const nodeIds = new Set(p.nodes.map(n => n.id));
    if (nodeIds.size !== p.nodes.length) return false;
    return p.edges.every(e => e && string(e.id) && nodeIds.has(e.from) &&
      nodeIds.has(e.to) && e.from !== e.to && string(e.label)) &&
      new Set(p.edges.map(e => e.id)).size === p.edges.length;
  }

  const hasId = value => typeof value === 'string' && value.trim().length > 0;

  function normalizeProject(project) {
    const normalized = {
      ...project,
      narrativeModel: hasId(project.narrativeModel) ? project.narrativeModel : app.narrative.defaultModelId,
      nodes: project.nodes.map(node => {
        const {image,originalImageId,...fields} = node;
        const stage = node.narrativeStage;
        return { ...fields, narrativeStage: hasId(stage?.modelId) && hasId(stage?.stepId) ? { ...stage } : null,
          ...(app.imageStore.validNodeImage(image) ? {image,...(app.imageStore.validOriginalImageId(originalImageId) ? {originalImageId} : {})} : {}) };
      })
    };
    return app.characterData.normalizeProject(app.projectManagementData.normalizeProject(normalized));
  }

  function normalizeState(state) {
    return { ...state, projects: state.projects.map(normalizeProject) };
  }

  return {
    kinds,
    normalizeProject,
    normalizeState,
    storageKey,
    validProject
  };
})(Enredo);
