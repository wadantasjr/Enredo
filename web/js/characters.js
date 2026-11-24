Enredo.characters = ((app) => {
  'use strict';

  const { $, esc, icon, option, field, input, uid, bindActions } = app.dom;
  const { t, tx } = app.preferences;
  const data = app.characterData;
  const view = {characterId:null,phaseId:null,section:'profile',arcId:null,pathId:null,graph:false,originNodeId:null,query:''};

  const project = () => app.store.project();
  const characterById = (id,p = project()) => p?.characters.find(character => character.id === id);
  const phaseById = (character,id) => character?.phases.find(phase => phase.id === id);
  const currentCharacter = () => characterById(view.characterId);
  const selectedArc = (p = project()) => p.characterArcs.find(arc => arc.id === view.arcId && arc.characterId === view.characterId);
  const portraitFor = (character,p = project(),phase = null) => {
    const portraitId = phase?.portraitId || character?.portraitId;
    return p.portraits.find(portrait => portrait.id === portraitId)?.data ?? '';
  };

  function textArea(name,label,value = '',rows = 3,required = false) {
    return '<label class="field"><span>' + tx(label) + '</span><textarea name="' + esc(name) + '" rows="' + rows + '"' +
      (required ? ' required' : '') + '>' + esc(value ?? '') + '</textarea></label>';
  }

  function selectField(name,label,options) {
    return field(t(label),'<select name="' + esc(name) + '">' + options + '</select>');
  }

  function listField(name,label,record,keys) {
    return keys.map(key => textArea(name + '.' + key,label + '.' + key,record?.[key] ?? '',2)).join('');
  }

  function roleLabel(id,p = project()) {
    const custom = p.characterRoles.find(role => role.id === id);
    return custom?.name ?? (data.roles.includes(id) ? t('role-' + id) : t('unknownRole'));
  }

  function roleNames(character,p = project()) {
    const ids = character.roleIds ?? [];
    return ids.map(id => '<span class="character-tag' + (character.primaryRoleId === id ? ' primary-tag' : '') + '">' +
      esc(roleLabel(id,p)) + (character.primaryRoleId === id ? ' · ' + tx('primaryRole') : '') + '</span>').join('');
  }

  function avatar(character,p = project(),size = 'normal',phase = null) {
    const image = portraitFor(character,p,phase);
    const label = esc(character.name);
    return '<span class="character-avatar ' + size + '" aria-label="' + label + '">' +
      (image ? '<img src="' + esc(image) + '" alt="">' : '<span aria-hidden="true">' + esc(data.initials(character.name)) + '</span>') + '</span>';
  }

  function relationTypeLabel(relation,p = project()) {
    if (relation.type === 'custom') {
      return p.relationshipKinds.find(kind => kind.id === relation.customTypeId)?.name ?? relation.customLabel ?? t('relation-custom');
    }
    return t('relation-' + relation.type);
  }

  function levelOptions(value = '') {
    return option('',t('noRecord'),!value) + data.relationshipLevels.map(level => option(level,t('level-' + level),value === level)).join('');
  }

  function stateOptions(value = '') {
    return option('',t('noRecord'),!value) + data.relationshipStates.map(state => option(state,t('relationship-' + state),value === state)).join('');
  }

  function relationshipAttributes(attributes) {
    const values = attributes ?? {};
    return ['trust','loyalty','hostility'].map(key => '<span class="character-level"><span>' + tx(key) + '</span><strong>' +
      esc(values[key] ? t('level-' + values[key]) : t('noRecord')) + '</strong></span>').join('');
  }

  function stateName(value) {
    return value ? t('relationship-' + value) : t('noRecord');
  }

  function profileValue(label,value) {
    const text = String(value ?? '').trim();
    return text ? '<div class="character-data-item"><dt>' + tx(label) + '</dt><dd>' + esc(text) + '</dd></div>' : '';
  }

  function renderDataGrid(record,fields) {
    const html = fields.map(([key,label]) => profileValue(label,record?.[key])).join('');
    return html ? '<dl class="character-data-grid">' + html + '</dl>' : '<p class="hint">' + tx('noProfileDetails') + '</p>';
  }

  function characterRow(character,p) {
    const active = character.id === view.characterId;
    const phase = character.phases?.length ? '<small>' + tx('phaseCount',{count:character.phases.length}) + '</small>' : '';
    const group = character.group ? '<small>' + esc(character.group) + '</small>' : '';
    return '<button type="button" class="character-card' + (active ? ' active' : '') + '" data-character="' + esc(character.id) + '"' +
      (active ? ' aria-current="true"' : '') + '>' + avatar(character,p,'small') + '<span class="character-card-copy"><strong>' +
      esc(character.name) + '</strong><span class="character-tags">' + roleNames(character,p) + '</span>' + group + phase + '</span></button>';
  }

  function renderList(p) {
    return '<aside class="character-list-pane"><label class="field character-search"><span>' + tx('characterSearch') +
      '</span><input id="characterSearch" type="search" value="' + esc(view.query) + '" placeholder="' + tx('characterSearchHint') + '"></label>' +
      '<div class="character-list" aria-label="' + tx('characters') + '">' + renderCharacterRows(p) + '</div></aside>';
  }

  function renderCharacterRows(p) {
    const query = view.query.trim().toLocaleLowerCase();
    const people = [...p.characters].sort((a,b) => a.name.localeCompare(b.name,document.documentElement.lang));
    const filtered = query ? people.filter(character => [character.name,character.alias,character.group,...(character.phases ?? []).map(phase => phase.title)]
      .some(value => String(value ?? '').toLocaleLowerCase().includes(query))) : people;
    const content = filtered.length ? filtered.map(character => characterRow(character,p)).join('') :
      '<p class="hint character-list-empty">' + tx(people.length ? 'noCharacterMatches' : 'noCharacters') + '</p>';
    return content;
  }

  function renderHeader(p) {
    const count = Array.isArray(p.characters) ? p.characters.length : 0;
    return '<header class="characters-heading"><div><h2 id="charactersTitle" tabindex="-1">' + tx('characters') + '</h2><p>' +
      tx('charactersHint') + '</p></div><div class="characters-actions">' +
      '<button type="button" class="btn" id="showRelationshipGraph">' + icon('branch') + ' ' + tx(view.graph ? 'characterList' : 'relationshipGraph') + '</button>' +
      '<button type="button" class="btn" id="manageCharacterRoles">' + tx('manageRoles') + '</button>' +
      '<button type="button" class="btn" id="manageRelationshipKinds">' + tx('manageRelationshipTypes') + '</button>' +
      '<button type="button" class="btn primary" id="newCharacter">' + icon('plus') + ' ' + tx('newCharacter') + '</button>' +
      '</div></header>' + (count === 0 ? '<p class="hint character-empty-hint">' + tx('charactersEmptyHint') + '</p>' : '');
  }

  function renderCharacter(p,character) {
    if (!character) return '<section class="character-detail-empty"><span data-icon="people"></span><h3>' + tx('selectCharacter') +
      '</h3><p>' + tx('selectCharacterHint') + '</p></section>';
    const phase = phaseById(character,view.phaseId);
    if (!phase) view.phaseId = null;
    const title = phase ? phase.title : t('centralProfile');
    const alias = phase?.alias || character.alias;
    const back = view.originNodeId ? '<button type="button" class="btn" id="backToMap">' + icon('branch') + ' ' + tx('backToMap') + '</button>' : '';
    return '<article class="character-profile"><header class="character-profile-heading">' + avatar(character,p,'large',phase) +
      '<div class="character-profile-title"><h3>' + esc(character.name) + (alias ? ' <small>“' + esc(alias) + '”</small>' : '') +
      '</h3><p>' + esc(title) + '</p></div><div class="character-profile-actions">' + back +
      '<button type="button" class="btn" id="editCharacter">' + icon('edit') + ' ' + tx('editCharacter') + '</button>' +
      app.mediaGallery.launcher('character',character) +
      (data.mergeCandidates(p,character.id).length ? '<button type="button" class="btn" id="mergeCharacter">' + icon('branch') + ' ' + tx('mergeCharacter') + '</button>' : '') +
      '<button type="button" class="btn danger" id="deleteCharacter">' + icon('trash') + ' ' + tx('delete') + '</button></div></header>' +
      '<nav class="character-sections" aria-label="' + tx('characterSections') + '">' +
      [['profile','characterProfile'],['arcs','characterArcs'],['relationships','relationships']].map(([key,label]) =>
        '<button type="button" class="character-section-tab' + (view.section === key ? ' active' : '') + '" data-character-section="' + key +
        '" aria-pressed="' + (view.section === key) + '">' + tx(label) + '</button>').join('') + '</nav>' +
      (view.section === 'arcs' ? renderArcs(p,character) : view.section === 'relationships' ? renderRelationships(p,character) : renderProfile(p,character,phase)) +
      '</article>';
  }

  function render(p = project()) {
    const root = $('charactersView');
    if (data.issue(p)) {
      root.innerHTML = renderHeader(p) + '<section class="character-data-warning" role="status"><strong>' + tx('characterDataUnavailable') +
        '</strong><p>' + tx('characterDataPreserved') + '</p></section>';
      root.querySelectorAll('.characters-actions button').forEach(button => { button.disabled = true; });
      return;
    }
    if (!characterById(view.characterId,p)) {
      view.characterId = p.characters[0]?.id ?? null;
      view.phaseId = null;
      view.section = 'profile';
    }
    const character = currentCharacter();
    const graph = view.graph ? renderRelationshipGraph(p) : '';
    root.innerHTML = renderHeader(p) + (view.graph ? graph : '<div class="characters-layout">' + renderList(p) +
      '<div class="character-detail-pane">' + renderCharacter(p,character) + '</div></div>');
    root.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
    if (view.graph) bindGraphKeyboard(root);
  }

  function renderProfile(p,character,phase) {
    const profile = phase ?? character;
    const mainFields = [
      ['description','description'],['group','group'],['notes','notes']
    ];
    const fields = renderDataGrid(profile,mainFields);
    const roles = !phase && roleNames(character,p) ? '<section class="character-section"><h4>' + tx('characterRoles') +
      '</h4><div class="character-tags">' + roleNames(character,p) + '</div></section>' : '';
    const traits = !phase ? renderTraits(character) : renderTraits(phase);
    const phases = !phase ? renderPhases(p,character) : '';
    const portrait = renderPortrait(p,character,phase);
    const phaseActions = phase ? '<div class="character-section-heading"><button type="button" class="btn" data-phase="">' + icon('right') + ' ' + tx('centralProfile') +
      '</button><div><button type="button" class="btn" id="editPhase">' + icon('edit') + ' ' + tx('editPhase') + '</button>' +
      '<button type="button" class="btn danger" id="deletePhase">' + icon('trash') + ' ' + tx('delete') + '</button></div></div>' : '';
    return '<div class="character-profile-content">' + phaseActions + portrait +
      '<section class="character-section"><h4>' + tx(phase ? 'phaseProfile' : 'centralProfile') + '</h4>' + fields + '</section>' +
      roles + traits + phases + '</div>';
  }

  function renderPortrait(p,character,phase = null) {
    const hasOwnPortrait = !!(phase ? phase.portraitId : character.portraitId);
    const phaseId = phase?.id ?? '';
    const title = phase ? tx('phasePortrait') : tx('portrait');
    const hint = phase ? tx(hasOwnPortrait ? 'phasePortraitOwnHint' : 'phasePortraitDefaultHint') : tx('portraitHint');
    const remove = phase
      ? (hasOwnPortrait ? '<button type="button" class="btn" id="removePortrait" data-character-id="' + esc(character.id) + '" data-phase-id="' + esc(phaseId) + '">' +
        icon('undo') + ' ' + tx('useCentralPortrait') + '</button>' : '')
      : (hasOwnPortrait ? '<button type="button" class="btn" id="removePortrait" data-character-id="' + esc(character.id) + '">' + icon('trash') + ' ' + tx('removePortrait') + '</button>' : '');
    return '<section class="character-section"><h4>' + title + '</h4><div class="portrait-editor"><div class="portrait-controls">' +
      '<p class="hint">' + hint + '</p><button type="button" class="btn" id="choosePortrait" data-character-id="' + esc(character.id) + '" data-phase-id="' + esc(phaseId) + '">' +
      icon('upload') + ' ' + tx(hasOwnPortrait ? 'replacePortrait' : 'addPortrait') + '</button>' + remove + '</div></div></section>';
  }

  function renderTraits(record) {
    const personality = renderDataGrid(record.personality,data.personalityFields.map(key => [key,'personality.' + key]));
    const motivation = renderDataGrid(record.motivation,data.motivationFields.map(key => [key,'motivation.' + key]));
    return '<details class="character-details"><summary>' + tx('personality') + '</summary>' + personality + '</details>' +
      '<details class="character-details"><summary>' + tx('motivation') + '</summary>' + motivation + '</details>';
  }

  function renderPhases(p,character) {
    const rows = character.phases.length ? '<ul class="character-phase-list">' + character.phases.map(phase =>
      '<li><button type="button" class="character-phase-button" data-phase="' + esc(phase.id) + '">' + avatar(character,p,'tiny',phase) +
      '<span class="character-phase-copy"><strong>' + esc(phase.title) + '</strong><span>' + esc(phase.group || phase.description || '') +
      '</span></span>' + icon('right') + '</button></li>').join('') + '</ul>' :
      '<p class="hint">' + tx('noPhases') + '</p>';
    return '<section class="character-section"><div class="character-section-heading"><h4>' + tx('characterPhases') + '</h4>' +
      '<button type="button" class="btn" id="newPhase">' + icon('plus') + ' ' + tx('newPhase') + '</button></div>' + rows + '</section>';
  }

  function renderArcs(p,character) {
    const arcs = p.characterArcs.filter(arc => arc.characterId === character.id);
    const selected = arcs.find(arc => arc.id === view.arcId) ?? arcs[0] ?? null;
    if (selected) view.arcId = selected.id;
    const list = arcs.length ? '<div class="character-arc-list">' + arcs.map(arc => {
      const phase = phaseById(character,arc.phaseId);
      return '<button type="button" class="character-arc-button' + (arc === selected ? ' active' : '') + '" data-arc="' + esc(arc.id) + '"><strong>' +
        esc(arc.title) + '</strong><small>' + esc(phase?.title ?? t('allPhases')) + ' · ' + tx('eventCount',{count:arc.events.length}) + '</small></button>';
    }).join('') + '</div>' : '<p class="hint">' + tx('noArcs') + '</p>';
    return '<div class="character-section-heading"><h4>' + tx('characterArcs') + '</h4><button type="button" class="btn primary" id="newArc">' +
      icon('plus') + ' ' + tx('newArc') + '</button></div>' + list + (selected ? renderArcDetails(p,character,selected) : '');
  }

  function renderArcDetails(p,character,arc) {
    if (view.pathId && !p.arcPaths.some(route => route.id === view.pathId)) view.pathId = null;
    const choices = option('',t('allArcPaths'),!view.pathId) + p.arcPaths.map(route =>
      option(route.id,data.displayRouteName(route,p),route.id === view.pathId)).join('');
    const initial = renderDataGrid(arc.initial,data.initialFields.map(key => [key,'initial.' + key]));
    const events = data.eventsForPath(arc,view.pathId);
    const pathChoice = field(t('arcPath'),'<select id="arcPathFilter">' + choices + '</select>');
    const eventList = events.length ? '<ol class="character-event-list">' + events.map((event,index) => renderArcEvent(p,character,arc,event,index,events.length)).join('') + '</ol>' :
      '<p class="hint">' + tx('noArcEvents') + '</p>';
    return '<section class="character-arc-details"><header class="character-section-heading"><h4>' + esc(arc.title) + '</h4><div>' +
      '<button type="button" class="btn" id="editArc">' + icon('edit') + ' ' + tx('editArc') + '</button>' +
      '<button type="button" class="btn primary" id="newArcEvent">' + icon('plus') + ' ' + tx('newArcEvent') + '</button></div></header>' +
      (arc.initial && Object.values(arc.initial).some(Boolean) ? '<details class="character-details"><summary>' + tx('initialState') + '</summary>' + initial + '</details>' : '') +
      '<div class="character-arc-filter">' + pathChoice + (view.pathId ? '<button type="button" class="btn" id="editArcPath" data-route-id="' + esc(view.pathId) + '">' + icon('edit') + ' ' + tx('editArcPath') + '</button>' : '') +
      '<button type="button" class="btn" id="newArcPath">' + icon('plus') + ' ' + tx('newArcPath') + '</button></div>' +
      eventList + '</section>';
  }

  function eventNodeLabel(event,p) {
    const node = p.nodes.find(item => item.id === event.nodeId);
    return node ? node.title || t('untitled') : '';
  }

  function eventChanges(event,p,arcCharacterId) {
    const changes = [];
    if (event.phase === 'ending' && event.arcType) changes.push(t('arcOutcome-' + event.arcType));
    if (event.changes?.fate) changes.push(t('fate-' + event.changes.fate));
    if (event.changes?.objectiveStatus) changes.push(t('objective-' + event.changes.objectiveStatus));
    if (event.changes?.group === null) changes.push(t('leaveGroup'));
    else if (event.changes?.group) changes.push(t('group') + ': ' + event.changes.group);
    if (event.changes?.belief) changes.push(t('belief') + ': ' + event.changes.belief);
    for (const update of event.relationshipChanges ?? []) {
      const relation = p.relationships.find(item => item.id === update.relationshipId);
      if (!relation) continue;
      const otherId = relation.fromCharacterId === arcCharacterId ? relation.toCharacterId : relation.fromCharacterId;
      const other = characterById(otherId,p);
      const details = [update.state ? stateName(update.state) : '',...['trust','loyalty','hostility']
        .filter(key => update.attributes?.[key]).map(key => t(key) + ': ' + t('level-' + update.attributes[key]))];
      changes.push((other?.name ?? '') + ': ' + details.join(' · '));
    }
    return changes;
  }

  function renderArcEvent(p,character,arc,event,index,total) {
    const route = p.arcPaths.find(item => item.id === event.pathId);
    const labels = [t('eventPhase-' + event.phase),route ? data.displayRouteName(route,p) : t('commonArcPath'),eventNodeLabel(event,p)].filter(Boolean);
    const changes = eventChanges(event,p,character.id);
    return '<li class="character-event-card"><div class="character-event-order"><span>' + (index + 1) + '</span><div>' +
      '<button type="button" class="icon-btn small" data-move-event="up" data-event-id="' + esc(event.id) + '" aria-label="' + tx('moveEventUp') + '"' +
      (index === 0 ? ' disabled' : '') + '>' + icon('undo') + '</button><button type="button" class="icon-btn small" data-move-event="down" data-event-id="' +
      esc(event.id) + '" aria-label="' + tx('moveEventDown') + '"' + (index === total - 1 ? ' disabled' : '') + '>' + icon('redo') + '</button></div></div>' +
      '<div class="character-event-copy"><small>' + esc(labels.join(' · ')) + '</small><p>' + esc(event.summary) + '</p>' +
      (changes.length ? '<div class="character-event-changes">' + changes.map(value => '<span>' + esc(value) + '</span>').join('') + '</div>' : '') +
      '<div class="character-event-actions">' + (event.nodeId ? '<button type="button" class="btn" data-event-node="' + esc(event.nodeId) + '">' + icon('branch') + ' ' + tx('openOnMap') + '</button>' : '') +
      '<button type="button" class="btn" data-edit-event="' + esc(event.id) + '">' + icon('edit') + ' ' + tx('edit') + '</button></div></div></li>';
  }

  function renderRelationships(p,character) {
    const relations = p.relationships.filter(relation => relation.fromCharacterId === character.id || relation.toCharacterId === character.id);
    const list = relations.length ? '<ul class="character-relationship-list">' + relations.map(relation => renderRelationshipCard(p,relation,character.id)).join('') + '</ul>' :
      '<p class="hint">' + tx(p.characters.length < 2 ? 'relationshipFirst' : 'relationshipEmpty') + '</p>';
    return '<div class="character-section-heading"><h4>' + tx('relationships') + '</h4><div>' +
      '<button type="button" class="btn" data-open-relationship-graph>' + icon('branch') + ' ' + tx('relationshipGraph') + '</button>' +
      (p.characters.length > 1 ? '<button type="button" class="btn primary" id="newRelationship">' + icon('plus') + ' ' + tx('newRelationship') + '</button>' : '') +
      '</div></div>' + list;
  }

  function relationshipHistory(p,relation) {
    const entries = [];
    for (const arc of p.characterArcs) for (const event of arc.events) {
      for (const change of event.relationshipChanges ?? []) if (change.relationshipId === relation.id) {
        const route = p.arcPaths.find(item => item.id === event.pathId);
        const phase = arc.phaseId ? phaseById(characterById(arc.characterId,p),arc.phaseId)?.title : '';
        entries.push({arc,event,change,route,phase});
      }
    }
    return entries;
  }

  function renderRelationshipCard(p,relation,currentId) {
    const from = characterById(relation.fromCharacterId,p), to = characterById(relation.toCharacterId,p);
    const history = relationshipHistory(p,relation);
    const changes = history.map(({event,change,route}) => '<li><small>' + esc([route ? data.displayRouteName(route,p) : t('commonArcPath'),event.summary].join(' · ')) +
      '</small><div class="character-levels">' + relationshipAttributes(change.attributes) + '</div><p>' + esc(stateName(change.state)) + '</p>' +
      '<button type="button" class="btn" data-event-node="' + esc(event.nodeId ?? '') + '"' + (event.nodeId ? '' : ' disabled') + '>' + icon('branch') + ' ' + tx('openOnMap') + '</button></li>').join('');
    const otherName = relation.fromCharacterId === currentId ? to?.name : from?.name;
    return '<li class="character-relationship-card"><header><strong>' + esc(from?.name ?? t('unknownCharacter')) + ' → ' + esc(to?.name ?? t('unknownCharacter')) +
      '</strong><button type="button" class="btn" data-edit-relationship="' + esc(relation.id) + '">' + icon('edit') + ' ' + tx('edit') + '</button></header>' +
      '<p class="character-relation-type">' + esc(relationTypeLabel(relation,p)) + ' · ' + esc(t('relationship-' + relation.initialState)) + '</p>' +
      '<div class="character-levels">' + relationshipAttributes(relation.initialAttributes) + '</div>' +
      (relation.notes ? '<p>' + esc(relation.notes) + '</p>' : '') +
      (history.length ? '<details class="character-details"><summary>' + tx('relationshipHistory',{count:history.length}) + '</summary><ol>' + changes + '</ol></details>' : '') +
      '<small class="sr-only">' + esc(otherName ?? '') + '</small></li>';
  }

  function renderNodeParticipants(node,p) {
    if (data.issue(p)) return '<section class="node-character-section"><h3>' + tx('participants') + '</h3><p class="hint">' + tx('characterDataUnavailable') + '</p></section>';
    const participants = data.participantsOf(node);
    const list = participants.length ? '<ul class="node-character-list">' + participants.map((person,index) => {
      const character = characterById(person.characterId,p);
      if (!character) return '';
      const phase = phaseById(character,person.phaseId);
      return '<li><button type="button" class="node-character-open" data-open-participant="' + esc(character.id) + '" data-origin-node="' + esc(node.id) + '" data-phase-id="' + esc(phase?.id ?? '') + '">' +
        avatar(character,p,'tiny',phase) + '<span><strong>' + esc(character.name) + '</strong><small>' + esc(phase?.title ?? t('centralProfile')) +
        (person.dramaticFunction ? ' · ' + esc(person.dramaticFunction) : '') + '</small></span></button><button type="button" class="icon-btn small" data-edit-participant="' +
        index + '" aria-label="' + tx('editParticipant') + '">' + icon('edit') + '</button><button type="button" class="icon-btn small" data-remove-participant="' +
        index + '" aria-label="' + tx('removeParticipant') + '">' + icon('trash') + '</button></li>';
    }).join('') + '</ul>' : '<p class="hint">' + tx('noParticipants') + '</p>';
    const focalPeople = [...new Map(participants.map(person => {
      const character = characterById(person.characterId,p);
      return character ? [character.id,character] : null;
    }).filter(Boolean)).values()];
    const focal = option('',t('noFocalCharacter'),!node.focalCharacterId) + focalPeople.map(character =>
      option(character.id,character.name,character.id === node.focalCharacterId)).join('');
    return '<section class="node-character-section"><div class="paths-title"><span>' + tx('participants') + '</span><span class="count">' + participants.length + '</span></div>' +
      list + (p.characters.length ? '<button type="button" class="btn path-add" id="addNodeParticipant">' + icon('plus') + ' ' + tx('addParticipant') + '</button>' :
        '<button type="button" class="btn path-add" id="newCharacterFromNode">' + icon('plus') + ' ' + tx('newCharacter') + '</button>') +
      (participants.length ? field(t('focalCharacter'),'<select id="nodeFocalCharacter">' + focal + '</select>') : '') + '</section>';
  }

  function graphPositions(characters) {
    const radiusX = Math.max(340,characters.length * 16), radiusY = Math.max(210,characters.length * 10);
    const width = radiusX * 2 + 220, height = radiusY * 2 + 200;
    const centerX = width / 2, centerY = height / 2 + 8;
    const positions = new Map();
    characters.forEach((character,index) => {
      const angle = characters.length === 1 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI * 2 * index / characters.length;
      positions.set(character.id,{x:centerX + Math.cos(angle) * radiusX,y:centerY + Math.sin(angle) * radiusY});
    });
    return {positions,width,height,centerX,centerY};
  }

  function graphNode(character,p,position,index) {
    const image = portraitFor(character,p);
    const clip = 'character-clip-' + index;
    const words = character.name.trim().split(/\s+/u);
    const first = words.shift() ?? '';
    const rest = words.join(' ');
    const label = [character.name,...(character.roleIds ?? []).map(id => roleLabel(id,p))].join(', ');
    return '<g class="relationship-graph-node" role="button" tabindex="0" data-graph-character="' + esc(character.id) + '" aria-label="' + esc(label) + '" transform="translate(' +
      position.x + ' ' + position.y + ')"><title>' + esc(label) + '</title><circle class="relationship-node-ring" r="42"></circle>' +
      (image ? '<defs><clipPath id="' + clip + '"><circle r="38"></circle></clipPath></defs><image href="' + esc(image) + '" x="-38" y="-38" width="76" height="76" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + clip + ')"></image>' :
        '<circle class="relationship-node-avatar" r="38"></circle><text class="relationship-node-initials" text-anchor="middle" y="6">' + esc(data.initials(character.name)) + '</text>') +
      '<text class="relationship-node-name" text-anchor="middle" y="58"><tspan x="0">' + esc(first) + '</tspan>' + (rest ? '<tspan x="0" dy="16">' + esc(rest) + '</tspan>' : '') +
      '</text></g>';
  }

  function graphRelation(relation,index,positions,p) {
    const from = positions.get(relation.fromCharacterId), to = positions.get(relation.toCharacterId);
    if (!from || !to) return '';
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.max(1,Math.hypot(dx,dy));
    const nx = -dy / length, ny = dx / length;
    const offset = (index % 2 ? 1 : -1) * (10 + Math.floor(index / 2) * 4);
    const middleX = (from.x + to.x) / 2 + nx * offset;
    const middleY = (from.y + to.y) / 2 + ny * offset;
    const label = relationTypeLabel(relation,p) + ' · ' + stateName(relation.initialState);
    const detail = label + ' · ' + relationshipAttributesText(relation.initialAttributes);
    return '<g class="relationship-graph-edge" role="button" tabindex="0" data-graph-relationship="' + esc(relation.id) + '" aria-label="' + esc(detail) + '"><title>' +
      esc(characterById(relation.fromCharacterId,p)?.name + ' → ' + characterById(relation.toCharacterId,p)?.name + ' · ' + detail) + '</title>' +
      '<path d="M ' + from.x + ' ' + from.y + ' Q ' + middleX + ' ' + middleY + ' ' + to.x + ' ' + to.y + '" marker-end="url(#relationship-arrow)"></path>' +
      '<text x="' + middleX + '" y="' + (middleY - 5) + '" text-anchor="middle">' + esc(relationTypeLabel(relation,p)) + '</text></g>';
  }

  function relationshipAttributesText(attributes) {
    return ['trust','loyalty','hostility'].map(key => t(key) + ': ' + (attributes?.[key] ? t('level-' + attributes[key]) : t('noRecord'))).join(', ');
  }

  function renderRelationshipGraph(p) {
    const characters = p.characters;
    if (!characters.length) return '<section class="relationship-graph-view"><h3>' + tx('relationshipGraph') + '</h3><p class="hint">' + tx('noCharacters') + '</p></section>';
    const graph = graphPositions(characters);
    const edges = p.relationships.map((relation,index) => graphRelation(relation,index,graph.positions,p)).join('');
    const nodes = characters.map((character,index) => graphNode(character,p,graph.positions.get(character.id),index)).join('');
    return '<section class="relationship-graph-view"><header class="character-section-heading"><div><h3>' + tx('relationshipGraph') + '</h3><p class="hint">' +
      tx('relationshipGraphHint') + '</p></div><button type="button" class="btn" data-open-character-list>' + icon('right') + ' ' + tx('characterList') + '</button></header>' +
      '<div class="relationship-graph-scroll"><svg class="relationship-graph" viewBox="0 0 ' + graph.width + ' ' + graph.height + '" role="group" aria-label="' +
      tx('relationshipGraph') + '"><defs><marker id="relationship-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 10 4 L 0 8 z"></path></marker></defs>' +
      '<g class="relationship-graph-edges">' + edges + '</g><g class="relationship-graph-nodes">' + nodes + '</g></svg></div>' +
      (p.relationships.length ? '<p class="hint">' + tx('relationshipGraphDirectionHint') + '</p>' : '<p class="hint">' + tx('relationshipGraphEmpty') + '</p>') + '</section>';
  }

  function bindGraphKeyboard(root) {
    root.querySelector('.relationship-graph')?.addEventListener('keydown',event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const element = event.target.closest('[data-graph-character],[data-graph-relationship]');
      if (!element) return;
      event.preventDefault();
      element.click();
    });
  }

  function profileDialog(existing = null,{participateNodeId = null} = {}) {
    const p = project();
    const selected = existing?.roleIds ?? (existing?.primaryRoleId ? [existing.primaryRoleId] : []);
    const roles = [...data.roles.map(id => ({id,name:t('role-' + id)})),...p.characterRoles];
    const roleChecks = roles.map(role => '<div class="character-role-choice"><label class="character-role-check"><input type="checkbox" name="roleIds" value="' +
      esc(role.id) + '" data-role-checkbox' + (selected.includes(role.id) ? ' checked' : '') + '><span>' + esc(role.name) + '</span></label>' +
      '<label class="character-role-primary"><input type="radio" name="primaryRoleId" value="' + esc(role.id) + '" data-role-primary' +
      (role.id === existing?.primaryRoleId ? ' checked' : '') + ' aria-label="' + tx('setPrimaryRole',{name:role.name}) + '"><span aria-hidden="true">★</span></label></div>').join('');
    const roleChoices = '<fieldset class="character-role-fieldset"><legend>' + tx('characterRoles') + '</legend>' +
      '<label class="character-role-primary-none"><input type="radio" name="primaryRoleId" value=""' + (!existing?.primaryRoleId ? ' checked' : '') +
      '><span>' + tx('noPrimaryRole') + '</span></label><div class="character-role-list">' + roleChecks + '</div></fieldset>';
    const body = '<div class="fields">' + field(t('characterName'),input('name',existing?.name ?? '',t('characterNameHint'),true)) +
      field(t('alias'),input('alias',existing?.alias ?? '',t('aliasHint'))) + textArea('description','description',existing?.description,3) +
      field(t('group'),input('group',existing?.group ?? '')) + textArea('notes','notes',existing?.notes,3) +
      roleChoices +
      '<details class="character-details"><summary>' + tx('personality') + '</summary><div class="fields">' + listField('personality','personality',existing?.personality,data.personalityFields) + '</div></details>' +
      '<details class="character-details"><summary>' + tx('motivation') + '</summary><div class="fields">' + listField('motivation','motivation',existing?.motivation,data.motivationFields) + '</div></details></div>';
    app.dialogs.showDialog({title:t(existing ? 'editCharacter' : 'newCharacter'),body,className:'character-dialog',submitKey:existing ? 'save' : 'add',extra:form => {
      const syncPrimaryRole = () => {
        for (const radio of form.querySelectorAll('[data-role-primary]')) {
          const checkbox = [...form.querySelectorAll('[data-role-checkbox]')].find(item => item.value === radio.value);
          radio.disabled = !checkbox?.checked;
          if (radio.checked && !checkbox?.checked) form.querySelector('input[name="primaryRoleId"][value=""]').checked = true;
        }
      };
      form.querySelectorAll('[data-role-checkbox]').forEach(checkbox => checkbox.addEventListener('change',syncPrimaryRole));
      syncPrimaryRole();
    },onSubmit:form => {
      const name = form.get('name').trim();
      if (!name) return;
      const primaryRoleId = form.get('primaryRoleId') || null;
      const roleIds = [...new Set([primaryRoleId,...form.getAll('roleIds')].filter(Boolean))];
      const record = {...existing,id:existing?.id ?? uid(),name,alias:form.get('alias').trim(),description:form.get('description').trim(),
        group:form.get('group').trim(),notes:form.get('notes').trim(),roleIds,primaryRoleId,
        personality:readObjectFields(form,'personality',data.personalityFields),motivation:readObjectFields(form,'motivation',data.motivationFields),
        phases:existing?.phases ?? []};
      app.dialogs.closeDialog();
      app.store.edit(() => {
        if (existing) Object.assign(existing,record);
        else p.characters.push(record);
        if (!existing && participateNodeId) {
          const node = p.nodes.find(item => item.id === participateNodeId);
          if (node && !node.participants.some(person => person.characterId === record.id)) node.participants.push({characterId:record.id,phaseId:null,dramaticFunction:''});
        }
        view.characterId = record.id;
        view.phaseId = null;
        view.section = 'profile';
      });
      $('editCharacter')?.focus({preventScroll:true});
    }});
  }

  function readObjectFields(form,objectName,keys) {
    return Object.fromEntries(keys.map(key => [key,form.get(objectName + '.' + key).trim()]).filter(([,value]) => value));
  }

  function phaseDialog(character,existing = null) {
    const body = '<div class="fields">' + field(t('phaseName'),input('title',existing?.title ?? '',t('phaseNameHint'),true)) +
      field(t('alias'),input('alias',existing?.alias ?? '',t('aliasHint'))) + field(t('group'),input('group',existing?.group ?? '')) +
      textArea('description','description',existing?.description,3) + textArea('notes','notes',existing?.notes,3) +
      '<details class="character-details"><summary>' + tx('personality') + '</summary><div class="fields">' + listField('personality','personality',existing?.personality,data.personalityFields) + '</div></details>' +
      '<details class="character-details"><summary>' + tx('motivation') + '</summary><div class="fields">' + listField('motivation','motivation',existing?.motivation,data.motivationFields) + '</div></details></div>';
    app.dialogs.showDialog({title:t(existing ? 'editPhase' : 'newPhase'),body,className:'character-dialog',submitKey:existing ? 'save' : 'add',onSubmit:form => {
      const title = form.get('title').trim();
      if (!title) return;
      const phase = {...existing,id:existing?.id ?? uid(),title,alias:form.get('alias').trim(),group:form.get('group').trim(),description:form.get('description').trim(),
        notes:form.get('notes').trim(),personality:readObjectFields(form,'personality',data.personalityFields),
        motivation:readObjectFields(form,'motivation',data.motivationFields)};
      app.dialogs.closeDialog();
      app.store.edit(() => {
        if (existing) Object.assign(existing,phase);
        else character.phases.push(phase);
        view.phaseId = phase.id;
        view.section = 'profile';
      });
    },remove:existing ? () => app.dialogs.confirmation(t('deletePhase'),t('deletePhaseHint',{name:existing.title}),() => {
      app.store.edit(() => {
        data.removePhase(project(),character.id,existing.id);
        if (view.phaseId === existing.id) view.phaseId = null;
      });
      $('newPhase')?.focus({preventScroll:true});
    }) : null});
  }

  function mergeDialog(target) {
    const p = project();
    const sources = data.mergeCandidates(p,target.id);
    if (!sources.length) return;
    const sourceOptions = sources.map(character => option(character.id,[character.name,character.group].filter(Boolean).join(' · '))).join('');
    const body = '<div class="fields"><p class="hint">' + tx('mergeCharacterHint') + '</p>' +
      '<p><strong>' + tx('mergeCurrentProfile') + ':</strong> ' + esc(target.name) + (target.group ? ' · ' + esc(target.group) : '') + '</p>' +
      field(t('mergeSource'),'<select name="sourceId">' + sourceOptions + '</select>') +
      field(t('mergeTargetPhaseName'),input('targetPhaseTitle','','',true)) +
      field(t('mergeSourcePhaseName'),input('sourcePhaseTitle','','',true)) +
      field(t('mergePhaseOrder'),'<select name="phaseOrder">' +
        option('sourceFirst',t('mergeSourceFirst'),true) + option('targetFirst',t('mergeTargetFirst')) + '</select>') + '</div>';
    app.dialogs.showDialog({title:t('mergeCharacter'),body,className:'character-dialog',submitKey:'mergeProfilesAction',onSubmit:form => {
      const source = characterById(form.get('sourceId'),p);
      const targetPhaseTitle = form.get('targetPhaseTitle').trim(), sourcePhaseTitle = form.get('sourcePhaseTitle').trim();
      const phaseOrder = form.get('phaseOrder');
      if (!source || !targetPhaseTitle || !sourcePhaseTitle) return;
      const summary = data.mergeSummary(p,target.id,source.id);
      if (!summary.ok) {
        const message = summary.reason === 'selfRelationships' ? 'mergeSelfRelationshipConflict' :
          summary.reason === 'overlappingBeats' ? 'mergeOverlappingBeatsConflict' : 'mergeUnavailable';
        app.preferences.flash(message);
        return;
      }
      app.dialogs.closeDialog();
      app.dialogs.confirmation(t('mergeCharacterConfirmTitle'),t('mergeCharacterConfirmHint',{
        source:source.name,target:target.name,sourcePhase:sourcePhaseTitle,targetPhase:targetPhaseTitle,
        arcs:summary.arcs,beats:summary.beats,relationships:summary.relationships
      }),() => {
        let result;
        const saved = app.store.edit(() => {
          result = data.mergeCharacter(p,target.id,source.id,targetPhaseTitle,sourcePhaseTitle,phaseOrder);
          if (result.ok) {
            view.characterId = target.id;
            view.phaseId = result.targetPhaseId;
            view.section = 'profile';
            view.arcId = null;
            view.pathId = null;
          }
        },{saveError:'projectSaveFailed'});
        if (!saved) return;
        if (!result?.ok) {
          const message = result?.reason === 'selfRelationships' ? 'mergeSelfRelationshipConflict' :
            result?.reason === 'overlappingBeats' ? 'mergeOverlappingBeatsConflict' : 'mergeUnavailable';
          app.preferences.flash(message);
          return;
        }
        $('editCharacter')?.focus({preventScroll:true});
      },{submitKey:'mergeProfilesAction',danger:false});
    }});
  }

  function deleteCharacter(character) {
    const p = project();
    const beats = p.nodes.reduce((count,node) => count + data.participantsOf(node).filter(person => person.characterId === character.id).length,0);
    const arcs = p.characterArcs.filter(arc => arc.characterId === character.id).length;
    const relations = p.relationships.filter(relation => relation.fromCharacterId === character.id || relation.toCharacterId === character.id).length;
    app.dialogs.confirmation(t('deleteCharacterTitle',{name:character.name}),t('deleteCharacterHint',{beats,arcs,relations}),() => {
      app.store.edit(() => {
        data.removeCharacter(p,character.id);
        view.characterId = p.characters[0]?.id ?? null;
        view.phaseId = null;
        view.arcId = null;
        view.pathId = null;
      });
    });
  }

  function roleDialog(role = null) {
    const p = project();
    if (!role) {
      const list = p.characterRoles.length ? '<ul class="character-manage-list">' + p.characterRoles.map(item =>
        '<li><span>' + esc(item.name) + '</span><button type="button" class="btn" data-edit-role="' + esc(item.id) + '">' + icon('edit') + ' ' + tx('edit') +
        '</button><button type="button" class="btn danger" data-delete-role="' + esc(item.id) + '">' + icon('trash') + ' ' + tx('delete') + '</button></li>').join('') + '</ul>' :
        '<p class="hint">' + tx('noCustomRoles') + '</p>';
      app.dialogs.showDialog({title:t('manageRoles'),body:'<div class="fields">' + list + field(t('newRoleName'),input('name','',t('newRoleName'),true)) + '</div>',
        className:'character-dialog',submitKey:'add',onSubmit:form => {
          const name = form.get('name').trim();
          if (!name) return;
          if (p.characterRoles.some(item => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
            app.preferences.flash('duplicateRole');
            return;
          }
          app.dialogs.closeDialog();
          app.store.edit(() => p.characterRoles.push({id:uid(),name}));
          roleDialog();
        }});
      return;
    }
    app.dialogs.showDialog({title:t('editRole'),body:field(t('roleName'),input('name',role.name,'',true)),className:'character-dialog',submitKey:'save',onSubmit:form => {
      const name = form.get('name').trim();
      if (!name) return;
      app.dialogs.closeDialog();
      app.store.edit(() => { role.name = name; });
    }});
  }

  function deleteRole(role) {
    app.dialogs.confirmation(t('deleteRole'),t('deleteRoleHint',{name:role.name}),() => {
      app.store.edit(() => data.removeRole(project(),role.id));
      roleDialog();
    });
  }

  function relationshipKindDialog(kind = null) {
    const p = project();
    if (!kind) {
      const list = p.relationshipKinds.length ? '<ul class="character-manage-list">' + p.relationshipKinds.map(item =>
        '<li><span>' + esc(item.name) + '</span><button type="button" class="btn" data-edit-relationship-kind="' + esc(item.id) + '">' + icon('edit') + ' ' + tx('edit') +
        '</button><button type="button" class="btn danger" data-delete-relationship-kind="' + esc(item.id) + '">' + icon('trash') + ' ' + tx('delete') + '</button></li>').join('') + '</ul>' :
        '<p class="hint">' + tx('noCustomRelationshipTypes') + '</p>';
      app.dialogs.showDialog({title:t('manageRelationshipTypes'),body:'<div class="fields">' + list + field(t('newRelationshipTypeName'),input('name','',t('newRelationshipTypeName'),true)) + '</div>',
        className:'character-dialog',submitKey:'add',onSubmit:form => {
          const name = form.get('name').trim();
          if (!name) return;
          if (p.relationshipKinds.some(item => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
            app.preferences.flash('duplicateRelationshipType');
            return;
          }
          app.dialogs.closeDialog();
          app.store.edit(() => p.relationshipKinds.push({id:uid(),name}));
          relationshipKindDialog();
        }});
      return;
    }
    app.dialogs.showDialog({title:t('editRelationshipType'),body:field(t('relationshipTypeName'),input('name',kind.name,'',true)),
      className:'character-dialog',submitKey:'save',onSubmit:form => {
        const name = form.get('name').trim();
        if (!name) return;
        app.dialogs.closeDialog();
        app.store.edit(() => { kind.name = name; });
      }});
  }

  function deleteRelationshipKind(kind) {
    app.dialogs.confirmation(t('deleteRelationshipType'),t('deleteRelationshipTypeHint',{name:kind.name}),() => {
      app.store.edit(() => data.removeRelationshipKind(project(),kind.id));
      relationshipKindDialog();
    });
  }

  function arcDialog(existing = null) {
    const p = project(), character = currentCharacter();
    if (!character) return;
    const selectedPhaseId = existing?.phaseId ?? view.phaseId ?? null;
    const phaseOptions = option('',t('allPhases'),!selectedPhaseId) + character.phases.map(phase => option(phase.id,phase.title,phase.id === selectedPhaseId)).join('');
    const initial = existing?.initial ?? {};
    const body = '<div class="fields">' + field(t('title'),input('title',existing?.title ?? '',t('arcTitleHint'),true)) +
      selectField('phaseId','characterPhase',phaseOptions) + textArea('initial.summary','initialSummary',initial.summary,2) +
      '<details class="character-details"><summary>' + tx('initialStateDetails') + '</summary><div class="fields">' +
      listField('initial','initial',initial,data.initialFields.filter(key => key !== 'summary')) + '</div></details></div>';
    app.dialogs.showDialog({title:t(existing ? 'editArc' : 'newArc'),body,className:'character-dialog',submitKey:existing ? 'save' : 'add',onSubmit:form => {
      const title = form.get('title').trim();
      if (!title) return;
      const record = {...existing,id:existing?.id ?? uid(),characterId:character.id,title,phaseId:form.get('phaseId') || null,
        initial:readObjectFields(form,'initial',data.initialFields),events:existing?.events ?? []};
      app.dialogs.closeDialog();
      app.store.edit(() => {
        if (existing) Object.assign(existing,record);
        else p.characterArcs.push(record);
        view.arcId = record.id;
        view.section = 'arcs';
        view.pathId = null;
      });
    },remove:existing ? () => app.dialogs.confirmation(t('deleteArc'),t('deleteArcHint',{count:existing.events.length}),() => {
      app.store.edit(() => {
        p.characterArcs = p.characterArcs.filter(arc => arc.id !== existing.id);
        view.arcId = p.characterArcs.find(arc => arc.characterId === character.id)?.id ?? null;
        view.pathId = null;
      });
    }) : null});
  }

  function routeDialog(existing = null) {
    const p = project(), arc = selectedArc();
    if (!arc) return;
    const usedEdges = new Set(p.arcPaths.filter(route => route.id !== existing?.id && route.edgeId).map(route => route.edgeId));
    const edges = p.edges.filter(edge => !usedEdges.has(edge.id) || edge.id === existing?.edgeId);
    const edgeOptions = option('',t('manualStoryPath'),!existing?.edgeId) + edges.map(edge => {
      const source = characterNode(edge.from,p), target = characterNode(edge.to,p);
      return option(edge.id,data.routeNameFromEdge(edge,p) + ' · ' + [source?.title,target?.title].filter(Boolean).join(' → '),edge.id === existing?.edgeId);
    }).join('');
    const linkedName = existing?.edgeId ? data.displayRouteName(existing,p) : existing?.name ?? '';
    const body = '<div class="fields">' + field(t('mapConnection'),'<select name="edgeId" id="arcPathEdge">' + edgeOptions + '</select>') +
      field(t('name'),input('name',linkedName,t('storyPathName'),true)) +
      '<p class="hint">' + tx('automaticPathNameHint') + '</p></div>';
    app.dialogs.showDialog({title:t(existing ? 'editArcPath' : 'newArcPath'),body,className:'character-dialog',submitKey:existing ? 'save' : 'add',extra:form => {
      const edge = form.elements.edgeId, name = form.elements.name;
      const sync = () => {
        const selected = p.edges.find(item => item.id === edge.value);
        name.readOnly = !!selected;
        if (selected) name.value = data.routeNameFromEdge(selected,p);
      };
      edge.addEventListener('change',sync);
      sync();
    },onSubmit:form => {
      const edge = p.edges.find(item => item.id === form.get('edgeId'));
      const name = edge ? data.routeNameFromEdge(edge,p) : form.get('name').trim();
      if (!name) return;
      if (edge && p.arcPaths.some(route => route.id !== existing?.id && route.edgeId === edge.id)) return;
      app.dialogs.closeDialog();
      app.store.edit(() => {
        if (existing) Object.assign(existing,{name,edgeId:edge?.id ?? null});
        else {
          const route = {id:uid(),name,edgeId:edge?.id ?? null};
          p.arcPaths.push(route);
          view.pathId = route.id;
        }
      });
    },remove:existing ? () => app.dialogs.confirmation(t('deleteArcPath'),t('deleteArcPathHint',{name:data.displayRouteName(existing,p)}),() => {
      app.store.edit(() => {
        for (const item of p.characterArcs) for (const event of item.events) if (event.pathId === existing.id) event.pathId = null;
        p.arcPaths = p.arcPaths.filter(route => route.id !== existing.id);
        if (view.pathId === existing.id) view.pathId = null;
      });
    }) : null});
  }

  function characterNode(id,p) {
    return p.nodes.find(node => node.id === id);
  }

  function participantDialog(node,index = null) {
    const p = project(), existing = index == null ? null : node.participants?.[index];
    const excluded = new Set((node.participants ?? []).filter((_,i) => i !== index).map(person => person.characterId + ':' + (person.phaseId ?? '')));
    const people = p.characters.filter(character => existing?.characterId === character.id ||
      [null,...character.phases.map(phase => phase.id)].some(phaseId => !excluded.has(character.id + ':' + (phaseId ?? ''))));
    if (!people.length) return;
    const current = characterById(existing?.characterId,p) ?? people[0];
    const personOptions = people.map(character => option(character.id,character.name,character.id === current.id)).join('');
    const phaseOptions = character => ((!excluded.has(character.id + ':') || (existing?.characterId === character.id && !existing?.phaseId)) ?
      option('',t('centralProfile'),!existing?.phaseId) : '') + character.phases
      .filter(phase => existing?.phaseId === phase.id || !excluded.has(character.id + ':' + phase.id))
      .map(phase => option(phase.id,phase.title,phase.id === existing?.phaseId)).join('');
    const body = '<div class="fields">' + selectField('characterId','character',personOptions) +
      field(t('characterPhase'),'<select name="phaseId" id="participantPhase">' + phaseOptions(current) + '</select>') +
      field(t('dramaticFunction'),input('dramaticFunction',existing?.dramaticFunction ?? '',t('dramaticFunctionHint'))) + '</div>';
    app.dialogs.showDialog({title:t(existing ? 'editParticipant' : 'addParticipant'),body,className:'character-dialog',submitKey:existing ? 'save' : 'add',extra:form => {
      const personSelect = form.elements.characterId, phaseSelect = form.elements.phaseId;
      personSelect.addEventListener('change',() => {
        const character = characterById(personSelect.value,p);
        phaseSelect.innerHTML = character ? phaseOptions(character) : option('',t('centralProfile'),true);
      });
    },onSubmit:form => {
      const character = characterById(form.get('characterId'),p);
      if (!character) return;
      const phaseId = form.get('phaseId') || null;
      if ((node.participants ?? []).some((person,i) => i !== index && person.characterId === character.id && person.phaseId === phaseId)) return;
      const record = {characterId:character.id,phaseId,dramaticFunction:form.get('dramaticFunction').trim()};
      app.dialogs.closeDialog();
      app.store.edit(() => {
        node.participants ??= [];
        if (existing) Object.assign(existing,record);
        else node.participants.push(record);
      });
    }});
  }

  function relationshipTypeOptions(p,existing) {
    const customChoice = existing?.customTypeId ? 'custom|' + existing.customTypeId : 'custom|new';
    return data.relationshipTypes.filter(type => type !== 'custom').map(type => option('base|' + type,t('relation-' + type),existing?.type === type)).join('') +
      p.relationshipKinds.map(kind => option('custom|' + kind.id,kind.name,customChoice === 'custom|' + kind.id)).join('') +
      option('custom|new',t('customRelationshipType'),existing?.type === 'custom' && customChoice === 'custom|new');
  }

  function relationshipDialog(existing = null) {
    const p = project();
    const character = currentCharacter();
    if (!character || p.characters.length < 2) return;
    const names = p.characters.map(person => option(person.id,person.name,person.id === (existing?.fromCharacterId ?? character.id))).join('');
    const destinations = option('',t('chooseCharacter'),!existing) + p.characters.filter(person => existing || person.id !== character.id)
      .map(person => option(person.id,person.name,person.id === existing?.toCharacterId)).join('');
    const typeChoice = existing?.type === 'custom' ? 'custom|' + (existing.customTypeId ?? 'new') : 'base|' + (existing?.type ?? 'trust');
    const state = existing?.initialAttributes ?? {};
    const body = '<div class="fields"><div class="relationship-endpoints">' + selectField('fromCharacterId','relationshipFrom',names) +
      '<span aria-hidden="true">→</span>' + selectField('toCharacterId','relationshipTo',destinations) + '</div>' +
      selectField('typeChoice','relationshipType',relationshipTypeOptions(p,existing)) +
      '<label class="field" id="relationshipCustomNameField"><span>' + tx('customRelationshipName') + '</span>' + input('customLabel',existing?.customLabel ?? '',t('customRelationshipName'),false) + '</label>' +
      field(t('initialState'),'<select name="initialState">' + data.relationshipStates.map(value => option(value,t('relationship-' + value),value === (existing?.initialState ?? 'active'))).join('') + '</select>') +
      '<details class="character-details" open><summary>' + tx('relationshipLevels') + '</summary><div class="fields">' +
      ['trust','loyalty','hostility'].map(key => selectField('attribute.' + key,key,levelOptions(state[key]))).join('') + '</div></details>' +
      textArea('notes','notes',existing?.notes,3) + '</div>';
    app.dialogs.showDialog({title:t(existing ? 'editRelationship' : 'newRelationship'),body,className:'character-dialog',submitKey:existing ? 'save' : 'add',extra:form => {
      const type = form.elements.typeChoice, custom = form.querySelector('#relationshipCustomNameField');
      const sync = () => {
        const isCustom = type.value === 'custom|new';
        custom.hidden = !isCustom;
        form.elements.customLabel.required = isCustom;
      };
      type.addEventListener('change',sync);
      sync();
    },onSubmit:form => {
      const fromCharacterId = form.get('fromCharacterId'), toCharacterId = form.get('toCharacterId');
      if (!characterById(fromCharacterId,p) || !characterById(toCharacterId,p) || fromCharacterId === toCharacterId) return;
      const [category,typeId] = form.get('typeChoice').split('|');
      const customLabel = category === 'custom' && typeId === 'new' ? form.get('customLabel').trim() : '';
      if (category === 'custom' && typeId === 'new' && !customLabel) return;
      const initialAttributes = readLevels(form,'attribute.');
      const record = {...existing,id:existing?.id ?? uid(),fromCharacterId,toCharacterId,
        type:category === 'custom' ? 'custom' : typeId,customTypeId:category === 'custom' && typeId !== 'new' ? typeId : null,
        customLabel,initialState:form.get('initialState'),initialAttributes,notes:form.get('notes').trim()};
      app.dialogs.closeDialog();
      app.store.edit(() => {
        if (existing) Object.assign(existing,record);
        else p.relationships.push(record);
      });
    },remove:existing ? () => app.dialogs.confirmation(t('relationshipDelete'),t('relationshipDeleteHint'),() => {
      app.store.edit(() => data.forgetRelationships(p,new Set([existing.id])));
    }) : null});
  }

  function readLevels(form,prefix) {
    return Object.fromEntries(['trust','loyalty','hostility'].map(key => [key,form.get(prefix + key)]).filter(([,value]) => value));
  }

  function nodesOptions(p,selected) {
    return option('',t('noLinkedBeat'),!selected) + p.chapters.map(chapter => {
      const nodes = p.nodes.filter(node => node.chapter === chapter.id);
      return nodes.length ? '<optgroup label="' + esc(chapter.title) + '">' + nodes.map(node => option(node.id,node.title || t('untitled'),node.id === selected)).join('') + '</optgroup>' : '';
    }).join('');
  }

  function incomingEdgeOptions(p,nodeId,selected) {
    const incoming = p.edges.filter(edge => edge.to === nodeId);
    return option('',t('noConnection'),!selected) + incoming.map(edge => {
      const source = characterNode(edge.from,p);
      return option(edge.id,[source?.title,edge.label || t('noLabel')].filter(Boolean).join(' · '),edge.id === selected);
    }).join('');
  }

  function relationshipChangeFields(p,arc,existing) {
    const relations = p.relationships.filter(relation => relation.fromCharacterId === arc.characterId || relation.toCharacterId === arc.characterId);
    if (!relations.length) return '';
    return '<details class="character-details"><summary>' + tx('relationshipChanges') + '</summary><div class="relationship-change-list">' + relations.map(relation => {
      const otherId = relation.fromCharacterId === arc.characterId ? relation.toCharacterId : relation.fromCharacterId;
      const other = characterById(otherId,p);
      const change = existing?.relationshipChanges?.find(item => item.relationshipId === relation.id) ?? {};
      const prefix = 'change-' + relation.id + '-';
      return '<details class="relationship-change"><summary>' + esc(relationTypeLabel(relation,p) + ' → ' + (other?.name ?? t('unknownCharacter'))) + '</summary><div class="fields">' +
        field(t('relationshipState'),'<select name="' + prefix + 'state">' + stateOptions(change.state) + '</select>') +
        ['trust','loyalty','hostility'].map(key => field(t(key),'<select name="' + prefix + key + '">' + levelOptions(change.attributes?.[key]) + '</select>')).join('') +
        '</div></details>';
    }).join('') + '</div></details>';
  }

  function arcEventDialog(arc,existing = null) {
    const p = project(), character = characterById(arc.characterId,p);
    if (!character) return;
    const paths = option('',t('commonArcPath'),!existing?.pathId) + p.arcPaths.map(route =>
      option(route.id,data.displayRouteName(route,p),route.id === existing?.pathId)).join('');
    const state = existing?.changes ?? {};
    const phases = data.eventPhases.map(phase => option(phase,t('eventPhase-' + phase),phase === (existing?.phase ?? 'development'))).join('');
    const body = '<div class="fields">' + textArea('summary','eventSummary',existing?.summary ?? '',3,true) +
      field(t('eventPhase'),'<select name="phase" id="arcEventPhase">' + phases + '</select>') +
      field(t('arcPath'),'<select name="pathId" id="arcEventPath">' + paths + '</select>') +
      field(t('linkedBeat'),'<select name="nodeId" id="arcEventNode">' + nodesOptions(p,existing?.nodeId) + '</select>') +
      field(t('incomingConnection'),'<select name="edgeId" id="arcEventEdge">' + incomingEdgeOptions(p,existing?.nodeId,existing?.edgeId) + '</select>') +
      '<details class="character-details"><summary>' + tx('arcChanges') + '</summary><div class="fields">' +
      field(t('arcOutcomeType'),'<select name="arcType" id="arcEventOutcome">' + option('',t('noRecord'),!existing?.arcType) + data.arcOutcomes.map(value => option(value,t('arcOutcome-' + value),value === existing?.arcType)).join('') + '</select>') +
      field(t('arcFate'),'<select name="fate">' + option('',t('noRecord'),!state.fate) + data.fates.map(value => option(value,t('fate-' + value),value === state.fate)).join('') + '</select>') +
      field(t('objectiveStatus'),'<select name="objectiveStatus">' + option('',t('noRecord'),!state.objectiveStatus) + data.objectiveStates.map(value => option(value,t('objective-' + value),value === state.objectiveStatus)).join('') + '</select>') +
      field(t('group'),input('group',state.group ?? '')) + '<label class="character-check"><input type="checkbox" name="leaveGroup"' + (state.group === null ? ' checked' : '') +
      '><span>' + tx('leaveGroup') + '</span></label>' + textArea('belief','belief',state.belief,2) + relationshipChangeFields(p,arc,existing) + '</div></details></div>';
    app.dialogs.showDialog({title:t(existing ? 'editArcEvent' : 'newArcEvent'),body,className:'character-dialog',submitKey:existing ? 'save' : 'add',extra:form => {
      const node = form.elements.nodeId, edge = form.elements.edgeId, path = form.elements.pathId;
      const phase = form.elements.phase, outcome = form.elements.arcType, group = form.elements.group;
      const updateEdges = (selected = '') => { edge.innerHTML = incomingEdgeOptions(p,node.value,selected); edge.disabled = !node.value || !p.edges.some(item => item.to === node.value); };
      const syncPathToEdge = () => {
        const route = p.arcPaths.find(item => item.id === path.value);
        if (!route) return;
        if (!route.edgeId) {
          edge.value = '';
          updateEdges();
          return;
        }
        const linkedEdge = p.edges.find(item => item.id === route.edgeId);
        if (!linkedEdge) return;
        node.value = linkedEdge.to;
        updateEdges(linkedEdge.id);
      };
      const syncEdgeToPath = () => {
        const route = data.routeForEdge(p,edge.value);
        if (edge.value) path.value = route?.id ?? '';
        else if (p.arcPaths.some(item => item.id === path.value && item.edgeId)) path.value = '';
      };
      const updateOutcome = () => { outcome.disabled = phase.value !== 'ending'; if (phase.value !== 'ending') outcome.value = ''; };
      const updateGroup = () => { group.disabled = form.elements.leaveGroup.checked; };
      node.addEventListener('change',() => {
        updateEdges();
        const route = p.arcPaths.find(item => item.id === path.value);
        if (route?.edgeId && p.edges.find(item => item.id === route.edgeId)?.to !== node.value) path.value = '';
      });
      path.addEventListener('change',syncPathToEdge);
      edge.addEventListener('change',syncEdgeToPath);
      phase.addEventListener('change',updateOutcome);
      form.elements.leaveGroup.addEventListener('change',updateGroup);
      updateEdges(existing?.edgeId);
      if (p.arcPaths.some(item => item.id === path.value && item.edgeId)) syncPathToEdge();
      else if (edge.value) syncEdgeToPath();
      updateOutcome();
      updateGroup();
    },onSubmit:form => {
      const summary = form.get('summary').trim();
      if (!summary) return;
      const phase = form.get('phase');
      const nodeId = form.get('nodeId') || null;
      const edgeId = form.get('edgeId') || null;
      const pathId = form.get('pathId') || null;
      const changes = {};
      const group = form.get('group')?.trim();
      if (form.has('leaveGroup')) changes.group = null;
      else if (group) changes.group = group;
      const belief = form.get('belief').trim();
      if (belief) changes.belief = belief;
      for (const key of ['fate','objectiveStatus']) if (form.get(key)) changes[key] = form.get(key);
      const relationshipChanges = p.relationships.filter(relation => relation.fromCharacterId === arc.characterId || relation.toCharacterId === arc.characterId).flatMap(relation => {
        const prefix = 'change-' + relation.id + '-';
        const state = form.get(prefix + 'state');
        const attributes = readLevels(form,prefix);
        return state || Object.keys(attributes).length ? [{relationshipId:relation.id,...(state ? {state} : {}),...(Object.keys(attributes).length ? {attributes} : {})}] : [];
      });
      app.dialogs.closeDialog();
      app.store.edit(() => {
        let linkedPathId = pathId;
        if (edgeId) {
          const edge = p.edges.find(item => item.id === edgeId);
          if (edge) linkedPathId = data.getOrCreateRoute(p,edge).id;
        }
        const event = {...existing,id:existing?.id ?? uid(),summary,phase,nodeId,edgeId,pathId:linkedPathId,
          arcType:phase === 'ending' ? form.get('arcType') || null : null,
          changes,relationshipChanges};
        if (existing) Object.assign(existing,event);
        else arc.events.push(event);
        view.pathId = linkedPathId || view.pathId;
      });
    },remove:existing ? () => {
      app.dialogs.closeDialog();
      app.store.edit(() => { arc.events = arc.events.filter(event => event.id !== existing.id); });
    } : null});
  }

  function openCharacter(id,originNodeId = null,phaseId = null) {
    const character = characterById(id);
    if (!character) return;
    if (view.characterId !== id) {
      view.characterId = id;
      view.phaseId = null;
      view.section = 'profile';
      view.arcId = null;
      view.pathId = null;
    }
    view.phaseId = phaseById(character,phaseId) ? phaseId : null;
    view.section = 'profile';
    view.graph = false;
    if (originNodeId) view.originNodeId = originNodeId;
    app.session.charactersOpen = true;
    app.diagram.stopConnect();
    app.workspace.render();
    $('charactersTitle').focus();
  }

  function clearOrigin() {
    view.originNodeId = null;
  }

  function goBack() {
    if (view.originNodeId && characterNode(view.originNodeId,project())) {
      const nodeId = view.originNodeId;
      view.originNodeId = null;
      app.workspace.inspect(nodeId,true);
      return;
    }
    view.originNodeId = null;
    app.session.charactersOpen = false;
    app.workspace.render();
    $(app.session.isStructureView() ? 'structureTab' : app.session.isWholeStory() ? 'overviewTab' : 'currentTab').focus({preventScroll:true});
  }

  function moveEvent(eventId,step) {
    const p = project(), arc = selectedArc(p);
    if (!arc) return;
    const visible = data.eventsForPath(arc,view.pathId);
    const position = visible.findIndex(event => event.id === eventId);
    const adjacent = visible[position + step];
    if (position < 0 || !adjacent) return;
    const from = arc.events.indexOf(visible[position]), to = arc.events.indexOf(adjacent);
    app.store.edit(() => {
      const [event] = arc.events.splice(from,1);
      arc.events.splice(to,0,event);
    });
  }

  function removeParticipant(node,index) {
    const person = node.participants?.[index];
    if (!person) return;
    app.store.edit(() => {
      node.participants.splice(index,1);
      if (!node.participants.some(item => item.characterId === node.focalCharacterId)) node.focalCharacterId = null;
    });
  }

  function handleViewClick(event) {
    const button = event.target.closest('button,[data-graph-character],[data-graph-relationship]');
    if (!button) return;
    const p = project();
    const character = currentCharacter();
    if (button.id === 'newCharacter') profileDialog();
    else if (button.id === 'newCharacterFromNode') {
      const node = app.store.selectedNode();
      if (node) profileDialog(null,{participateNodeId:node.id});
    } else if (button.id === 'editCharacter' && character) profileDialog(character);
    else if (button.id === 'mergeCharacter' && character) mergeDialog(character);
    else if (button.id === 'deleteCharacter' && character) deleteCharacter(character);
    else if (button.id === 'manageCharacterRoles') roleDialog();
    else if (button.id === 'manageRelationshipKinds') relationshipKindDialog();
    else if (button.id === 'showRelationshipGraph') {
      view.graph = !view.graph;
      app.workspace.render();
    } else if (button.hasAttribute('data-open-relationship-graph')) {
      view.graph = true;
      app.workspace.render();
    } else if (button.hasAttribute('data-open-character-list')) {
      view.graph = false;
      app.workspace.render();
      $('charactersTitle').focus({preventScroll:true});
    } else if (button.hasAttribute('data-graph-character')) {
      openCharacter(button.dataset.graphCharacter);
    } else if (button.hasAttribute('data-graph-relationship')) {
      const relation = p.relationships.find(item => item.id === button.dataset.graphRelationship);
      if (relation) {
        view.graph = false;
        view.characterId = relation.fromCharacterId;
        view.phaseId = null;
        view.section = 'relationships';
        app.workspace.render();
        relationshipDialog(relation);
      }
    } else if (button.hasAttribute('data-character')) {
      view.characterId = button.dataset.character;
      view.phaseId = null;
      view.section = 'profile';
      view.arcId = null;
      view.pathId = null;
      view.originNodeId = null;
      app.workspace.render();
    } else if (button.hasAttribute('data-phase')) {
      view.phaseId = button.dataset.phase;
      view.section = 'profile';
      app.workspace.render();
    } else if (button.id === 'newPhase' && character) phaseDialog(character);
    else if (button.id === 'editPhase' && character) phaseDialog(character,phaseById(character,view.phaseId));
    else if (button.id === 'deletePhase' && character) {
      const phase = phaseById(character,view.phaseId);
      if (phase) app.dialogs.confirmation(t('deletePhase'),t('deletePhaseHint',{name:phase.title}),() => {
        app.store.edit(() => { data.removePhase(p,character.id,phase.id); view.phaseId = null; });
      });
    } else if (button.hasAttribute('data-character-section')) {
      view.section = button.dataset.characterSection;
      app.workspace.render();
    } else if (button.id === 'newArc' && character) arcDialog();
    else if (button.id === 'editArc') { const arc = selectedArc(p); if (arc) arcDialog(arc); }
    else if (button.id === 'newArcEvent') { const arc = selectedArc(p); if (arc) arcEventDialog(arc); }
    else if (button.hasAttribute('data-arc')) {
      view.arcId = button.dataset.arc;
      view.pathId = null;
      app.workspace.render();
    } else if (button.id === 'newArcPath') routeDialog();
    else if (button.id === 'editArcPath') {
      const route = p.arcPaths.find(item => item.id === button.dataset.routeId);
      if (route) routeDialog(route);
    } else if (button.hasAttribute('data-edit-event')) {
      const arc = selectedArc(p), item = arc?.events.find(entry => entry.id === button.dataset.editEvent);
      if (arc && item) arcEventDialog(arc,item);
    } else if (button.hasAttribute('data-move-event')) moveEvent(button.dataset.eventId,button.dataset.moveEvent === 'up' ? -1 : 1);
    else if (button.hasAttribute('data-event-node')) {
      const nodeId = button.dataset.eventNode;
      if (nodeId) app.workspace.inspect(nodeId,true);
    } else if (button.id === 'newRelationship') relationshipDialog();
    else if (button.hasAttribute('data-edit-relationship')) {
      const relation = p.relationships.find(item => item.id === button.dataset.editRelationship);
      if (relation) relationshipDialog(relation);
    } else if (button.id === 'backToMap') goBack();
  }

  function handleInspectorClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const node = app.store.selectedNode();
    if (!node) return;
    if (button.id === 'addNodeParticipant') participantDialog(node);
    else if (button.id === 'newCharacterFromNode') profileDialog(null,{participateNodeId:node.id});
    else if (button.dataset.editParticipant !== undefined) participantDialog(node,Number(button.dataset.editParticipant));
    else if (button.dataset.removeParticipant !== undefined) removeParticipant(node,Number(button.dataset.removeParticipant));
    else if (button.dataset.openParticipant) openCharacter(button.dataset.openParticipant,button.dataset.originNode,button.dataset.phaseId || null);
  }

  function bindEvents() {
    const root = $('charactersView');
    root.addEventListener('click',handleViewClick);
    root.addEventListener('input',event => {
      if (event.target.id !== 'characterSearch') return;
      view.query = event.target.value;
      root.querySelector('.character-list').innerHTML = renderCharacterRows(project());
    });
    root.addEventListener('change',event => {
      if (event.target.id === 'arcPathFilter') {
        view.pathId = event.target.value || null;
        app.workspace.render();
      }
    });
    $('inspector').addEventListener('click',handleInspectorClick);
    $('inspector').addEventListener('change',event => {
      if (event.target.id !== 'nodeFocalCharacter') return;
      const node = app.store.selectedNode();
      if (!node) return;
      app.store.edit(() => { node.focalCharacterId = event.target.value || null; });
    });
    $('dialogForm').addEventListener('click',event => {
      const button = event.target.closest('button');
      if (!button) return;
      const p = project();
      if (button.dataset.editRole) roleDialog(p.characterRoles.find(item => item.id === button.dataset.editRole));
      else if (button.dataset.deleteRole) {
        const role = p.characterRoles.find(item => item.id === button.dataset.deleteRole);
        if (role) deleteRole(role);
      } else if (button.dataset.editRelationshipKind) relationshipKindDialog(p.relationshipKinds.find(item => item.id === button.dataset.editRelationshipKind));
      else if (button.dataset.deleteRelationshipKind) {
        const kind = p.relationshipKinds.find(item => item.id === button.dataset.deleteRelationshipKind);
        if (kind) deleteRelationshipKind(kind);
      }
    });
  }

  return {
    bindEvents,
    clearOrigin,
    goBack,
    openCharacter,
    render,
    renderNodeParticipants
  };
})(Enredo);
