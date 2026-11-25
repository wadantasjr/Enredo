Enredo.universeData = (() => {
  const categories = Object.freeze(['location', 'organization', 'item', 'history']);
  const referenceKinds = Object.freeze(['universe', 'character', 'group', 'chapter', 'node']);
  const referenceCollections = Object.freeze({
    universe: 'worldEntries',
    character: 'characters',
    group: 'chapterGroups',
    chapter: 'chapters',
    node: 'nodes'
  });

  const text = value => typeof value === 'string' ? value : '';
  const identity = value => String(value ?? '').trim();

  function normalizeReferences(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.flatMap(reference => {
      const kind = referenceKinds.includes(reference?.kind) ? reference.kind : '';
      const id = identity(reference?.id);
      if (!kind || !id) return [];
      const relation = text(reference.relation).trim();
      const key = `${kind}\u0000${id}\u0000${relation}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{kind, id, relation}];
    });
  }

  function normalizeEntry(entry) {
    const details = entry?.details && typeof entry.details === 'object' && !Array.isArray(entry.details)
      ? {...entry.details}
      : {};
    return {
      ...entry,
      id: identity(entry?.id) || Enredo.dom.uid(),
      category: categories.includes(entry?.category) ? entry.category : 'location',
      name: text(entry?.name),
      description: text(entry?.description),
      notes: text(entry?.notes),
      tags: Array.isArray(entry?.tags) ? [...new Set(entry.tags.map(tag => text(tag).trim()).filter(Boolean))] : [],
      details,
      references: normalizeReferences(entry?.references),
      galleryImages: Array.isArray(entry?.galleryImages) ? entry.galleryImages : [],
      galleryDocuments: Array.isArray(entry?.galleryDocuments) ? entry.galleryDocuments : []
    };
  }

  function targetsFor(project, kind) {
    const collection = referenceCollections[kind];
    return new Set((Array.isArray(project?.[collection]) ? project[collection] : [])
      .map(item => identity(item?.id)).filter(Boolean));
  }

  function pruneProject(project) {
    if (!project || typeof project !== 'object') return project;
    const entries = Array.isArray(project.worldEntries) ? project.worldEntries : [];
    project.worldEntries = entries.map(normalizeEntry);
    const targets = Object.fromEntries(referenceKinds.map(kind => [kind, targetsFor(project, kind)]));
    for (const entry of project.worldEntries) {
      entry.references = entry.references.filter(reference => targets[reference.kind]?.has(reference.id));
    }
    return project;
  }

  function normalizeProject(project) {
    return pruneProject(project);
  }

  function validProject(project) {
    if (!project || typeof project !== 'object') return false;
    if (project.worldEntries === undefined) return true;
    if (!Array.isArray(project.worldEntries)) return false;
    const ids = new Set();
    for (const entry of project.worldEntries) {
      if (!entry || typeof entry !== 'object' || !identity(entry.id) || ids.has(identity(entry.id))) return false;
      if (!categories.includes(entry.category) || typeof entry.name !== 'string') return false;
      ids.add(identity(entry.id));
      if (entry.references !== undefined && !Array.isArray(entry.references)) return false;
      for (const reference of entry.references ?? []) {
        if (!reference || !referenceKinds.includes(reference.kind) || !identity(reference.id)) return false;
      }
    }
    return true;
  }

  function pruneState(state) {
    if (Array.isArray(state?.projects)) {
      for (const project of state.projects) pruneProject(project);
      return state;
    }
    return pruneProject(state);
  }

  function replaceReference(project, kind, sourceId, targetId) {
    if (!referenceKinds.includes(kind) || !Array.isArray(project?.worldEntries)) return project;
    const source = identity(sourceId);
    const target = identity(targetId);
    if (!source || !target) return project;
    for (const entry of project.worldEntries) {
      entry.references = normalizeReferences((Array.isArray(entry.references) ? entry.references : []).map(reference =>
        reference.kind === kind && reference.id === source ? {...reference, id: target} : reference
      ));
    }
    return project;
  }

  return {categories, referenceKinds, referenceCollections, normalizeProject, validProject, pruneState, replaceReference};
})();
