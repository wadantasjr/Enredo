Enredo.characterData = ((app) => {
  'use strict';

  const collections = ['characters','characterRoles','characterArcs','arcPaths','relationships','relationshipKinds','portraits'];
  const roles = ['protagonist','antagonist','supporting','mentor','ally','rival','minor'];
  const relationshipTypes = ['family','friendship','professional','hierarchy','alliance','rivalry','romance','loyalty','betrayal','trust','enmity','custom'];
  const relationshipStates = ['absent','active','strained','broken'];
  const relationshipLevels = ['low','medium','high'];
  const eventPhases = ['development','ending'];
  const arcOutcomes = ['positive','negative','steady'];
  const fates = ['alive','dead'];
  const objectiveStates = ['achieved','failed','abandoned'];
  const personalityFields = ['dominantTraits','strengths','flaws','beliefs','fears','contradictions','vulnerabilities'];
  const motivationFields = ['goal','need','reason','obstacles','internalConflict','externalConflict','cost','successConsequence','failureConsequence'];
  const initialFields = ['summary','belief','goal','need','conflict'];
  const profileFields = ['alias','description','group','notes'];
  const phaseFields = ['alias','description','group','notes'];
  const maxPortraitBytes = 24 * 1024;
  const invalidProjects = new WeakMap();

  const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
  const hasText = value => typeof value === 'string' && value.trim().length > 0;
  const optionalText = value => value == null || typeof value === 'string';
  const optionalFields = (value,fields) => value == null || (isRecord(value) && fields.every(key => optionalText(value[key])));
  const isMember = (values,value) => value == null || values.includes(value);
  const participantsOf = node => Array.isArray(node.participants) ? node.participants : [];

  function initials(name) {
    const words = String(name ?? '').normalize('NFC').trim().split(/\s+/u).filter(Boolean);
    const firstLetter = word => word?.match(/[\p{L}\p{N}][\p{M}]*/u)?.[0]?.toLocaleUpperCase() ?? '';
    return words.length > 1 ? firstLetter(words[0]) + firstLetter(words.at(-1)) : firstLetter(words[0]);
  }

  function validPortrait(data) {
    const prefix = 'data:image/jpeg;base64,';
    return typeof data === 'string' && data.length <= prefix.length + 4 * Math.ceil(maxPortraitBytes / 3) &&
      /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(data) && (data.length - prefix.length) % 4 === 0;
  }

  function validationError(project) {
    const lists = {};
    for (const name of collections) {
      const list = project[name] === undefined ? [] : project[name];
      if (!Array.isArray(list)) return name;
      const ids = new Set();
      for (const [index,item] of list.entries()) {
        if (!isRecord(item) || !hasText(item.id) || ids.has(item.id)) return name + '[' + index + '].id';
        ids.add(item.id);
      }
      lists[name] = list;
    }

    const roleIds = new Set(roles);
    for (const [index,role] of lists.characterRoles.entries()) {
      if (roleIds.has(role.id) || !hasText(role.name)) return 'characterRoles[' + index + ']';
      roleIds.add(role.id);
    }
    const kindIds = new Set();
    for (const [index,kind] of lists.relationshipKinds.entries()) {
      if (!hasText(kind.name) || kindIds.has(kind.id) || relationshipTypes.includes(kind.id)) return 'relationshipKinds[' + index + ']';
      kindIds.add(kind.id);
    }

    const portraits = new Set();
    for (const [index,portrait] of lists.portraits.entries()) {
      if (!validPortrait(portrait.data)) return 'portraits[' + index + '].data';
      portraits.add(portrait.id);
    }

    const characters = new Map(), phaseIds = new Map();
    for (const [index,character] of lists.characters.entries()) {
      const path = 'characters[' + index + ']';
      if (!hasText(character.name)) return path + '.name';
      for (const key of profileFields) if (!optionalText(character[key])) return path + '.' + key;
      for (const [key,fields] of [['personality',personalityFields],['motivation',motivationFields]]) {
        if (!optionalFields(character[key],fields)) return path + '.' + key;
      }
      const assigned = character.roleIds === undefined ? [] : character.roleIds;
      if (!Array.isArray(assigned) || new Set(assigned).size !== assigned.length || assigned.some(id => !roleIds.has(id))) return path + '.roleIds';
      if (!isMember(assigned,character.primaryRoleId)) return path + '.primaryRoleId';
      if (character.portraitId != null && !portraits.has(character.portraitId)) return path + '.portraitId';
      const phases = character.phases === undefined ? [] : character.phases;
      if (!Array.isArray(phases)) return path + '.phases';
      for (const [phaseIndex,phase] of phases.entries()) {
        const phasePath = path + '.phases[' + phaseIndex + ']';
        if (!isRecord(phase) || !hasText(phase.id) || phaseIds.has(phase.id) || !hasText(phase.title) ||
            !optionalFields(phase,phaseFields) || !optionalFields(phase.personality,personalityFields) ||
            !optionalFields(phase.motivation,motivationFields)) return phasePath;
        if (phase.portraitId != null && !portraits.has(phase.portraitId)) return phasePath + '.portraitId';
        phaseIds.set(phase.id,character.id);
      }
      characters.set(character.id,character);
    }

    const nodes = new Map(project.nodes.map(node => [node.id,node]));
    for (const [index,node] of project.nodes.entries()) {
      const people = node.participants === undefined ? [] : node.participants;
      if (!Array.isArray(people)) return 'nodes[' + index + '].participants';
      const assigned = new Set();
      for (const [participantIndex,person] of people.entries()) {
        const character = characters.get(person?.characterId);
        const key = person?.characterId + ':' + (person?.phaseId ?? '');
        if (!isRecord(person) || !character || assigned.has(key) || !optionalText(person.dramaticFunction) ||
            (person.phaseId != null && phaseIds.get(person.phaseId) !== person.characterId)) {
          return 'nodes[' + index + '].participants[' + participantIndex + ']';
        }
        assigned.add(key);
      }
      if (node.focalCharacterId != null && !people.some(person => person.characterId === node.focalCharacterId)) {
        return 'nodes[' + index + '].focalCharacterId';
      }
    }

    const edges = new Map(project.edges.map(edge => [edge.id,edge]));
    const routes = new Map();
    for (const [index,route] of lists.arcPaths.entries()) {
      if (!hasText(route.name) || (route.edgeId != null && !edges.has(route.edgeId))) return 'arcPaths[' + index + ']';
      if (route.edgeId != null) {
        if (routes.has(route.edgeId)) return 'arcPaths[' + index + '].edgeId';
        routes.set(route.edgeId,route);
      }
    }

    const relations = new Map();
    for (const [index,relation] of lists.relationships.entries()) {
      const knownType = relationshipTypes.includes(relation.type) && relation.type !== 'custom';
      const customType = relation.type === 'custom' && (relation.customTypeId != null
        ? kindIds.has(relation.customTypeId) : hasText(relation.customLabel));
      if (!characters.has(relation.fromCharacterId) || !characters.has(relation.toCharacterId) ||
          relation.fromCharacterId === relation.toCharacterId || (!knownType && !customType) ||
          !relationshipStates.includes(relation.initialState) || !optionalText(relation.notes) ||
          !validLevels(relation.initialAttributes)) return 'relationships[' + index + ']';
      relations.set(relation.id,relation);
    }

    const eventIds = new Set();
    for (const [arcIndex,arc] of lists.characterArcs.entries()) {
      const arcPath = 'characterArcs[' + arcIndex + ']';
      const character = characters.get(arc.characterId);
      if (!character || !hasText(arc.title) || !optionalFields(arc.initial,initialFields) || !Array.isArray(arc.events) ||
          (arc.phaseId != null && phaseIds.get(arc.phaseId) !== arc.characterId)) return arcPath;
      for (const [eventIndex,event] of arc.events.entries()) {
        const path = arcPath + '.events[' + eventIndex + ']';
        if (!isRecord(event) || !hasText(event.id) || eventIds.has(event.id) || !hasText(event.summary) || !eventPhases.includes(event.phase)) return path;
        eventIds.add(event.id);
        if (event.nodeId != null && !nodes.has(event.nodeId)) return path + '.nodeId';
        if (event.edgeId != null && (event.nodeId == null || edges.get(event.edgeId)?.to !== event.nodeId)) return path + '.edgeId';
        if (event.pathId != null && !lists.arcPaths.some(route => route.id === event.pathId)) return path + '.pathId';
        if (event.arcType != null && (event.phase !== 'ending' || !arcOutcomes.includes(event.arcType))) return path + '.arcType';
        const changes = event.changes;
        if (changes != null && (!optionalFields(changes,['group','belief']) || !isMember(fates,changes.fate) ||
            !isMember(objectiveStates,changes.objectiveStatus))) return path + '.changes';
        const updates = event.relationshipChanges === undefined ? [] : event.relationshipChanges;
        if (!Array.isArray(updates)) return path + '.relationshipChanges';
        const mentioned = new Set();
        for (const update of updates) {
          const relation = relations.get(update?.relationshipId);
          if (!isRecord(update) || !relation ||
              (relation.fromCharacterId !== arc.characterId && relation.toCharacterId !== arc.characterId) ||
              (update.state != null && !relationshipStates.includes(update.state)) || !validLevels(update.attributes) ||
              mentioned.has(update.relationshipId)) return path + '.relationshipChanges';
          mentioned.add(update.relationshipId);
        }
      }
    }
    return null;
  }

  function validLevels(attributes) {
    return attributes == null || (isRecord(attributes) && ['trust','loyalty','hostility'].every(key =>
      attributes[key] == null || relationshipLevels.includes(attributes[key])));
  }

  function normalizeProject(project) {
    const error = validationError(project);
    if (error) {
      invalidProjects.set(project,error);
      return project;
    }
    invalidProjects.delete(project);
    const normalized = {...project};
    for (const key of collections) normalized[key] = project[key] ?? [];
    normalized.characters = normalized.characters.map(character => ({...character,phases:character.phases ?? []}));
    normalized.nodes = normalized.nodes.map(node => ({...node,participants:participantsOf(node)}));
    return normalized;
  }

  function emptyCollections() {
    return {characters:[],characterRoles:[],characterArcs:[],arcPaths:[],relationships:[],relationshipKinds:[],portraits:[]};
  }

  function initialsForCharacter(characterId,project) {
    const character = project.characters.find(item => item.id === characterId);
    return initials(character?.name ?? '');
  }

  const issue = project => invalidProjects.get(project) ?? null;
  const eventsForPath = (arc,pathId) => pathId == null ? arc.events : arc.events.filter(event => event.pathId == null || event.pathId === pathId);

  function routeNameFromEdge(edge,project) {
    if (!edge) return '';
    const label = edge.label?.trim();
    if (label) return label;
    const source = project.nodes.find(node => node.id === edge.from)?.title?.trim();
    const target = project.nodes.find(node => node.id === edge.to)?.title?.trim();
    return [source,target].filter(Boolean).join(' → ');
  }

  function displayRouteName(route,project) {
    const edge = route.edgeId && project.edges.find(item => item.id === route.edgeId);
    return (edge && routeNameFromEdge(edge,project)) || route.name || '';
  }

  function routeForEdge(project,edgeId) {
    return project.arcPaths.find(route => route.edgeId === edgeId) ?? null;
  }

  function getOrCreateRoute(project,edge) {
    let route = routeForEdge(project,edge.id);
    if (route) return route;
    route = {id:app.dom.uid(),edgeId:edge.id,name:routeNameFromEdge(edge,project) || app.preferences.t('unnamedPath')};
    project.arcPaths.push(route);
    return route;
  }

  function detachSituations(project,nodeIds) {
    if (issue(project)) return;
    for (const arc of project.characterArcs) for (const event of arc.events) {
      if (!nodeIds.has(event.nodeId)) continue;
      event.nodeId = null;
      event.edgeId = null;
    }
  }

  function detachConnection(project,edgeId,{unlinkRoute = false} = {}) {
    if (issue(project)) return;
    for (const arc of project.characterArcs) for (const event of arc.events) {
      if (event.edgeId === edgeId) event.edgeId = null;
    }
    if (unlinkRoute) {
      const route = routeForEdge(project,edgeId);
      if (route) {
        route.name = displayRouteName(route,project) || route.name;
        route.edgeId = null;
      }
    }
  }

  function forgetRelationships(project,ids) {
    project.relationships = project.relationships.filter(relation => !ids.has(relation.id));
    for (const arc of project.characterArcs) for (const event of arc.events) {
      if (event.relationshipChanges) event.relationshipChanges = event.relationshipChanges.filter(change => !ids.has(change.relationshipId));
    }
  }

  function prunePortrait(project,portraitId) {
    const inUse = project.characters.some(character => character.portraitId === portraitId ||
      (character.phases ?? []).some(phase => phase.portraitId === portraitId));
    if (portraitId && !inUse) {
      project.portraits = project.portraits.filter(portrait => portrait.id !== portraitId);
    }
  }

  function setPortrait(project,characterId,data,phaseId = null) {
    const character = project.characters.find(item => item.id === characterId);
    const target = phaseId == null ? character : character?.phases.find(phase => phase.id === phaseId);
    if (!target || (data != null && !validPortrait(data))) return false;
    const oldId = target.portraitId;
    const existing = data && project.portraits.find(portrait => portrait.data === data);
    if (data && !existing) {
      const id = app.dom.uid();
      project.portraits = [...project.portraits,{id,data}];
      target.portraitId = id;
    } else target.portraitId = existing?.id ?? null;
    prunePortrait(project,oldId);
    return true;
  }

  function removeCharacter(project,id) {
    const removed = project.characters.find(character => character.id === id);
    const portraitIds = [removed?.portraitId,...(removed?.phases ?? []).map(phase => phase.portraitId)].filter(Boolean);
    project.characters = project.characters.filter(character => character.id !== id);
    project.characterArcs = project.characterArcs.filter(arc => arc.characterId !== id);
    for (const node of project.nodes) {
      if (node.participants) node.participants = node.participants.filter(person => person.characterId !== id);
      if (node.focalCharacterId === id) node.focalCharacterId = null;
    }
    const related = project.relationships.filter(relation => relation.fromCharacterId === id || relation.toCharacterId === id);
    forgetRelationships(project,new Set(related.map(relation => relation.id)));
    for (const portraitId of portraitIds) prunePortrait(project,portraitId);
  }

  function removePhase(project,characterId,phaseId) {
    const character = project.characters.find(item => item.id === characterId);
    if (!character) return;
    const removed = character.phases.find(phase => phase.id === phaseId);
    character.phases = character.phases.filter(phase => phase.id !== phaseId);
    for (const node of project.nodes) for (const participant of node.participants ?? []) {
      if (participant.characterId === characterId && participant.phaseId === phaseId) participant.phaseId = null;
    }
    for (const arc of project.characterArcs) if (arc.phaseId === phaseId) arc.phaseId = null;
    prunePortrait(project,removed?.portraitId);
  }

  function normalizedCharacterName(value) {
    return String(value ?? '').normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase();
  }

  function mergeCandidates(project,targetId) {
    const target = project.characters.find(character => character.id === targetId);
    if (!target) return [];
    const name = normalizedCharacterName(target.name);
    return project.characters.filter(character => character.id !== targetId && normalizedCharacterName(character.name) === name);
  }

  function mergeSummary(project,targetId,sourceId) {
    const target = project.characters.find(character => character.id === targetId);
    const source = project.characters.find(character => character.id === sourceId);
    if (!target || !source || target === source) return {ok:false,reason:'missing'};
    if (normalizedCharacterName(target.name) !== normalizedCharacterName(source.name)) return {ok:false,reason:'differentNames'};
    const selfRelationships = project.relationships.filter(relation =>
      (relation.fromCharacterId === targetId && relation.toCharacterId === sourceId) ||
      (relation.fromCharacterId === sourceId && relation.toCharacterId === targetId));
    const overlappingBeats = project.nodes.filter(node => {
      const people = participantsOf(node);
      return people.some(person => person.characterId === targetId) && people.some(person => person.characterId === sourceId);
    }).length;
    const beats = project.nodes.reduce((count,node) => count + participantsOf(node).filter(person => person.characterId === sourceId).length,0);
    const arcs = project.characterArcs.filter(arc => arc.characterId === sourceId).length;
    const relationships = project.relationships.filter(relation => relation.fromCharacterId === sourceId || relation.toCharacterId === sourceId).length;
    const reason = selfRelationships.length ? 'selfRelationships' : overlappingBeats ? 'overlappingBeats' : null;
    return {ok:!reason,reason,selfRelationships:selfRelationships.length,overlappingBeats,beats,arcs,relationships};
  }

  function mergeCharacter(project,targetId,sourceId,targetPhaseTitle,sourcePhaseTitle,phaseOrder = 'sourceFirst') {
    const summary = mergeSummary(project,targetId,sourceId);
    const target = project.characters.find(character => character.id === targetId);
    const source = project.characters.find(character => character.id === sourceId);
    if (!summary.ok || !hasText(targetPhaseTitle) || !hasText(sourcePhaseTitle)) return {...summary,ok:false};

    const toPhase = (character,title) => ({id:app.dom.uid(),title:title.trim(),alias:character.alias ?? '',group:character.group ?? '',
      description:character.description ?? '',notes:character.notes ?? '',personality:{...(character.personality ?? {})},
      motivation:{...(character.motivation ?? {})},...(character.portraitId ? {portraitId:character.portraitId} : {})});
    const targetPhase = toPhase(target,targetPhaseTitle), sourcePhase = toPhase(source,sourcePhaseTitle);
    const targetPhases = target.phases ?? [], sourcePhases = source.phases ?? [];
    const sourcePortraitIds = [source.portraitId,...(source.phases ?? []).map(item => item.portraitId)].filter(Boolean);

    target.roleIds = [...new Set([...(target.roleIds ?? []),...(source.roleIds ?? []),target.primaryRoleId,source.primaryRoleId].filter(Boolean))];
    target.primaryRoleId ??= source.primaryRoleId ?? null;
    target.description = '';
    target.group = '';
    target.notes = '';
    target.personality = {};
    target.motivation = {};
    if (source.galleryImages?.length) {
      const galleryImages = new Map([...(target.galleryImages ?? []),...source.galleryImages].map(image => [image.assetId,image]));
      target.galleryImages = [...galleryImages.values()];
    }
    target.phases = phaseOrder === 'targetFirst'
      ? [...targetPhases,targetPhase,...sourcePhases,sourcePhase]
      : [...sourcePhases,sourcePhase,...targetPhases,targetPhase];

    for (const arc of project.characterArcs) {
      if (arc.characterId === targetId && arc.phaseId == null) arc.phaseId = targetPhase.id;
      if (arc.characterId === sourceId) {
        arc.characterId = targetId;
        if (arc.phaseId == null) arc.phaseId = sourcePhase.id;
      }
    }
    for (const node of project.nodes) {
      for (const person of participantsOf(node)) {
        if (person.characterId === targetId && person.phaseId == null) person.phaseId = targetPhase.id;
        else if (person.characterId === sourceId) {
          person.characterId = targetId;
          if (person.phaseId == null) person.phaseId = sourcePhase.id;
        }
      }
      if (node.focalCharacterId === sourceId) node.focalCharacterId = targetId;
    }
    for (const relation of project.relationships) {
      if (relation.fromCharacterId === sourceId) relation.fromCharacterId = targetId;
      if (relation.toCharacterId === sourceId) relation.toCharacterId = targetId;
    }
    app.universeData.replaceReference(project,'character',sourceId,targetId);
    project.characters = project.characters.filter(character => character.id !== sourceId);
    for (const portraitId of sourcePortraitIds) prunePortrait(project,portraitId);
    return {...summary,ok:true,targetPhaseId:targetPhase.id,sourcePhaseId:sourcePhase.id};
  }

  function removeRole(project,roleId) {
    project.characterRoles = project.characterRoles.filter(role => role.id !== roleId);
    for (const character of project.characters) {
      character.roleIds = (character.roleIds ?? []).filter(id => id !== roleId);
      if (character.primaryRoleId === roleId) character.primaryRoleId = null;
    }
  }

  function removeRelationshipKind(project,kindId) {
    const kind = project.relationshipKinds.find(item => item.id === kindId);
    project.relationshipKinds = project.relationshipKinds.filter(item => item.id !== kindId);
    for (const relation of project.relationships) if (relation.customTypeId === kindId) {
      relation.customTypeId = null;
      relation.customLabel = kind?.name ?? relation.customLabel ?? '';
    }
  }

  function captureHistory(state) {
    const portraits = [];
    const projects = state.projects.map(({portraits:table,...project}) => {
      portraits.push(table);
      return project;
    });
    return {json:JSON.stringify({...state,projects}),portraits};
  }

  function restoreHistory(snapshot) {
    const restored = typeof snapshot === 'string' ? JSON.parse(snapshot) : JSON.parse(snapshot.json);
    if (typeof snapshot !== 'string') restored.projects = restored.projects.map((project,index) => {
      if (snapshot.portraits[index] !== undefined) project.portraits = snapshot.portraits[index];
      return normalizeProject(project);
    });
    return restored;
  }

  return {
    arcOutcomes,
    captureHistory,
    detachConnection,
    detachSituations,
    displayRouteName,
    emptyCollections,
    eventsForPath,
    forgetRelationships,
    getOrCreateRoute,
    initials,
    initialsForCharacter,
    issue,
    mergeCharacter,
    mergeCandidates,
    mergeSummary,
    maxPortraitBytes,
    motivationFields,
    normalizeProject,
    participantsOf,
    personalityFields,
    phaseFields,
    profileFields,
    relationshipLevels,
    relationshipStates,
    relationshipTypes,
    removeCharacter,
    removePhase,
    removeRelationshipKind,
    removeRole,
    restoreHistory,
    roles,
    routeNameFromEdge,
    routeForEdge,
    setPortrait,
    validPortrait,
    validationError,
    fates,
    eventPhases,
    initialFields,
    objectiveStates
  };
})(Enredo);
