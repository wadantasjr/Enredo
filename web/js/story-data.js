Enredo.storyData = ((app) => {
  'use strict';

  const kinds = ['scene','decision','outcome','merge','ending'];

  const storageKey = 'enredo.story-planner.v1';

  const validCover = cover => cover == null || (cover && typeof cover === 'object' && !Array.isArray(cover) &&
    app.imageStore.validOriginalImageId(cover.assetId) &&
    (cover.focusX === undefined || (Number.isFinite(cover.focusX) && cover.focusX >= 0 && cover.focusX <= 1)) &&
    (cover.focusY === undefined || (Number.isFinite(cover.focusY) && cover.focusY >= 0 && cover.focusY <= 1)));

  function validProject(p) {
    const string = value => typeof value === 'string';
    if (!p || !string(p.id) || !string(p.title) || !Array.isArray(p.chapters) ||
        !Array.isArray(p.nodes) || !Array.isArray(p.edges)) return false;
    if (!validCover(p.cover) || (p.mapBackgroundId != null && !app.imageStore.validOriginalImageId(p.mapBackgroundId))) return false;
    if (!p.chapters.every(c => c && string(c.id) && string(c.title) && validCover(c.cover))) return false;
    const chapterIds = new Set(p.chapters.map(c => c.id));
    if (chapterIds.size !== p.chapters.length) return false;
    const groups = p.chapterGroups ?? [];
    if (!Array.isArray(groups) || !groups.every(group => group && string(group.id) && group.id.trim().length > 0 &&
        typeof group.title === 'string' && group.title.trim().length > 0 &&
        (group.description === undefined || string(group.description)) && validCover(group.cover))) return false;
    const groupIds = new Set(groups.map(group => group.id));
    if (groupIds.size !== groups.length) return false;
    if (!p.chapters.every(chapter => (chapter.groupId == null || groupIds.has(chapter.groupId)) &&
        (chapter.groupOrder === undefined || (Number.isInteger(chapter.groupOrder) && chapter.groupOrder >= 0)))) return false;
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

  function normalizeMapPosition({mapPosition,...record},fallback) {
    const position = Number.isFinite(mapPosition?.x) && Number.isFinite(mapPosition?.y) ? mapPosition : fallback;
    return position ? {...record,mapPosition:{x:position.x,y:position.y}} : record;
  }

  function normalizeProject({mapBackgroundSize,summary,...project}) {
    const nextGroupOrder = new Map();
    const {width,height} = mapBackgroundSize ?? {};
    const hasMapSize = project.mapBackgroundId && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
    const cleanSummary = app.projectSummary.normalize(summary);
    const normalized = {
      ...project,
      ...(cleanSummary ? {summary:cleanSummary} : {}),
      ...(hasMapSize ? {mapBackgroundSize:{width,height}} : {}),
      narrativeModel: hasId(project.narrativeModel) ? project.narrativeModel : app.narrative.defaultModelId,
      ...(project.cover ? {cover:{focusX:0.5,focusY:0.5,...project.cover}} : {}),
      ...(Array.isArray(project.chapterGroups) ? {chapterGroups:project.chapterGroups.map(group => ({
        ...normalizeMapPosition(group),
        description:group.description ?? '',
        ...(group.cover ? {cover:{focusX:0.5,focusY:0.5,...group.cover}} : {})
      }))} : {}),
      chapters:project.chapters.map(record => {
        const chapter = normalizeMapPosition(record);
        const cover = chapter.cover ? {cover:{focusX:0.5,focusY:0.5,...chapter.cover}} : {};
        if (!chapter.groupId) {
          const {groupOrder,...fields} = chapter;
          return {...fields,...cover};
        }
        const next = nextGroupOrder.get(chapter.groupId) ?? 0;
        const groupOrder = Number.isInteger(chapter.groupOrder) ? chapter.groupOrder : next;
        nextGroupOrder.set(chapter.groupId,Math.max(next,groupOrder + 1));
        return {...chapter,...cover,groupOrder};
      }),
      nodes: project.nodes.map(node => {
        const {image,originalImageId,...fields} = node;
        const stage = node.narrativeStage;
        return { ...normalizeMapPosition(fields,node), narrativeStage: hasId(stage?.modelId) && hasId(stage?.stepId) ? { ...stage } : null,
          ...(app.imageStore.validNodeImage(image) ? {image,...(app.imageStore.validOriginalImageId(originalImageId) ? {originalImageId} : {})} : {}) };
      })
    };
    const result = app.characterData.normalizeProject(app.projectManagementData.normalizeProject(normalized));
    for (const owner of app.imageStore.galleryOwners(result)) {
      for (const field of ['galleryImages','galleryDocuments']) {
        if (!Object.hasOwn(owner,field)) continue;
        const items = new Map();
        for (const item of Array.isArray(owner[field]) ? owner[field] : []) {
          if (app.imageStore.validOriginalImageId(item?.assetId) && !items.has(item.assetId)) {
            items.set(item.assetId,{assetId:item.assetId,
              name:typeof item.name === 'string' ? item.name.slice(0,160) : '',
              notes:typeof item.notes === 'string' ? item.notes : ''});
          }
        }
        if (items.size) owner[field] = [...items.values()];
        else delete owner[field];
      }
    }
    return result;
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
