Enredo.projectPdf = ((app) => {
  'use strict';

  const { $, bindActions } = app.dom;
  const { t, flash } = app.preferences;
  const { readOriginalImage, thumbnailUrl } = app.imageStore;
  const listOf = value => Array.isArray(value) ? value : [];
  let originalTitle;

  function element(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.append(...children.filter(child => child != null));
    return node;
  }

  function addFields(parent, fields) {
    for (const [label,value] of fields) {
      if (!value || (typeof value === 'string' && !value.trim())) continue;
      const copy = value instanceof Node ? value.textContent : String(value);
      const compact = copy.length <= 64 && !copy.includes('\n');
      parent.append(element('div',compact ? 'pdf-field pdf-field-inline' : 'pdf-field',
        element('div','pdf-label',label),element('div','pdf-text',value)));
    }
  }

  function addDetails(parent, title, fields) {
    const section = element('div','pdf-details');
    addFields(section,fields);
    if (section.childElementCount) {
      section.prepend(element('h4','',title));
      parent.append(section);
    }
  }

  function addContent(parent, title, content) {
    parent.append(element('div','pdf-details',element('h4','',title),content));
  }

  function reference(id, label) {
    const link = element('a','',label);
    link.setAttribute('href','#' + id);
    return link;
  }

  function indexed(items, prefix) {
    return new Map(listOf(items).filter(item => item && typeof item.id === 'string')
      .map((item,index) => [item.id,{...item,anchor:'pdf-' + prefix + '-' + (index + 1)}]));
  }

  function addToIndex(list, section, title, number) {
    const link = reference(section.id,title);
    if (number) link.prepend(element('span','pdf-section-number',number));
    const item = element('li','',link);
    list.append(item);
    return item;
  }

  function formatDate(value, locale) {
    const time = app.projectManagementData.dateDay(value) * app.projectManagementData.dayMs;
    return Number.isFinite(time) ? new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(time) : '';
  }

  const savedValue = (key,value) => value && (Object.hasOwn(app.messages,key + value) ? t(key + value) : value);
  const capitalized = value => value && value[0].toUpperCase() + value.slice(1);
  const attributes = record => ['trust','loyalty','hostility'].map(key => [t(key),savedValue('level-',record?.[key])]);

  async function printableImage(id) {
    const file = await readOriginalImage(id);
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1,1920 / Math.max(bitmap.width,bitmap.height));
      const canvas = element('canvas');
      canvas.width = Math.max(1,Math.round(bitmap.width * scale));
      canvas.height = Math.max(1,Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d',{alpha:false});
      context.fillStyle = '#fff';
      context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const source = canvas.toDataURL('image/jpeg',0.86);
      canvas.width = canvas.height = 1;
      return source;
    } finally {
      bitmap.close();
    }
  }

  async function loadImages(images) {
    const sources = new Map();
    for (const {image,id,preview} of images) {
      if (id && !sources.has(id)) {
        const source = await printableImage(id).catch(async () => {
          const url = await thumbnailUrl(id);
          return app.imageStore.originalImageDataUrl(await (await fetch(url)).blob());
        }).catch(() => null);
        sources.set(id,source);
      }
      const source = sources.get(id) || preview;
      const svgImage = image instanceof SVGImageElement;
      if (source) {
        const decodedImage = svgImage ? new Image() : image;
        decodedImage.src = source;
        try {
          await decodedImage.decode();
          if (svgImage) image.setAttribute('href',source);
          continue;
        } catch {}
      }
      const missing = element('p','pdf-image-missing',t('pdfImageUnavailable'));
      if (svgImage) {
        image.closest('figure').append(missing);
        image.remove();
      } else image.replaceWith(missing);
    }
  }

  function buildReport(project, locale, characterDataIssue) {
    const images = [];
    const nodes = indexed(project.nodes,'beat'), people = indexed(project.characters,'character');
    const chapters = indexed(project.chapters,'chapter'), groups = indexed(project.chapterGroups,'group');
    const worldEntries = indexed(project.worldEntries,'world');
    const relations = indexed(project.relationships,'relationship'), routes = indexed(project.arcPaths,'route');
    const sprints = indexed(project.sprints,'sprint'), tasks = indexed(project.tasks,'task');
    const edges = indexed(project.edges,'connection'), arcs = indexed(project.characterArcs,'arc');
    const roles = indexed(project.characterRoles,'role'), kinds = indexed(project.relationshipKinds,'type');
    const portraits = indexed(project.portraits,'portrait');
    const fragment = document.createDocumentFragment();
    const index = element('ol','pdf-index');

    function image(parent, label, {id,preview,cover,className = ''}) {
      const img = element('img',className);
      img.alt = label;
      if (cover) {
        img.classList.add('pdf-cover-image');
        img.style.objectPosition = `${(cover.focusX ?? 0.5) * 100}% ${(cover.focusY ?? 0.5) * 100}%`;
      }
      images.push({image:img,id,preview});
      parent.append(img);
    }

    function coverImage(parent, cover, key) {
      if (cover?.assetId) image(parent,t(key),{id:cover.assetId,cover});
    }

    function diagram(parent, title, markup, heading = 'h3') {
      const block = titled(parent,'section','pdf-diagram',heading,title);
      const figure = element('figure');
      figure.innerHTML = markup;
      block.append(figure);
      return figure;
    }

    function gallery(parent, owner, label = 'mediaGallery') {
      if (!owner.galleryImages?.length && !owner.galleryDocuments?.length) return;
      parent.append(element('h4','pdf-gallery-title',t(label)));
      for (const [index,item] of (owner.galleryImages ?? []).entries()) {
        const name = item.name || t('galleryImageNumber',{number:index + 1});
        const figure = element('figure','pdf-figure');
        image(figure,name,{id:item.assetId});
        figure.append(element('figcaption','',element('strong','',name)));
        if (item.notes) figure.append(element('p','pdf-text',item.notes));
        parent.append(figure);
      }
      for (const [index,item] of (owner.galleryDocuments ?? []).entries()) {
        const name = item.name || t('galleryDocumentNumber',{number:index + 1});
        const document = element('div','pdf-figure',element('strong','',name));
        if (item.notes) document.append(element('p','pdf-text',item.notes));
        parent.append(document);
      }
    }

    function titled(parent, tag, className, heading, title, id) {
      const section = element(tag,className,element(heading,'',title));
      if (id) section.id = id;
      parent.append(section);
      return section;
    }

    function section(key, title) {
      const number = String(index.childElementCount + 1).padStart(2,'0');
      const group = titled(fragment,'section','pdf-section','h2',title,'pdf-' + key);
      group.firstElementChild.prepend(element('span','pdf-section-number',number));
      return {group,item:addToIndex(index,group,title,number)};
    }

    const beatName = node => node.title || t('untitled');
    const worldName = entry => entry.name || t('untitled');
    const beatLink = id => {
      const node = nodes.get(id);
      if (node) return reference(node.anchor,[chapters.get(node.chapter)?.title,beatName(node)].filter(Boolean).join(' / '));
    };
    const phaseName = (person,id) => listOf(person?.phases).find(phase => phase?.id === id)?.title;
    const personName = id => people.get(id)?.name || t('unknownCharacter');
    const roleName = id => roles.get(id)?.name || savedValue('role-',id);
    const routeName = route => app.characterData.displayRouteName(route,project);
    const relationType = relation => relation.type === 'custom'
      ? kinds.get(relation.customTypeId)?.name || relation.customLabel || t('relation-custom')
      : savedValue('relation-',relation.type);
    const relationName = relation => `${personName(relation.fromCharacterId)} → ${personName(relation.toCharacterId)}`;
    const dateFields = item => [[t('startDate'),formatDate(item.start,locale)],[t('endDate'),formatDate(item.end,locale)]];

    function renderBeat(parent, node) {
      const block = titled(parent,'article','pdf-record','h4',beatName(node),node.anchor);
      const stage = node.narrativeStage;
      const narrativeStage = stage && app.narrative.getNarrativeStage(stage.modelId,stage.stepId);
      const stageModel = stage && app.narrative.getNarrativeModel(stage.modelId);
      addFields(block,[[t('nodeType'),t(node.kind)],[t('narrativeStage'),stage && [
        stageModel ? app.structure.narrativeText(stageModel.name) : stage.modelId,
        narrativeStage ? app.structure.narrativeText(narrativeStage.name) : stage.stepId].join(' / ')],[t('notes'),node.notes]]);
      if (node.image || node.originalImageId) image(block,beatName(node),{id:node.originalImageId,preview:node.image});
      const participants = listOf(node.participants).filter(person => people.has(person?.characterId));
      if (participants.length) {
        block.append(element('h5','',t('participants')));
        const list = element('ul','pdf-list');
        for (const participant of participants) {
          const person = people.get(participant.characterId);
          const details = [phaseName(person,participant.phaseId),participant.dramaticFunction,
            node.focalCharacterId === person.id ? t('focalCharacter') : ''].filter(Boolean);
          list.append(element('li','',reference(person.anchor,person.name),details.length ? ' · ' + details.join(' · ') : ''));
        }
        block.append(list);
      }
      const outgoing = edgesByNode.get(node.id) ?? [];
      if (outgoing.length) {
        block.append(element('h5','',t('outgoingPaths')));
        block.append(element('ul','pdf-list',...outgoing.map(edge => {
          const link = element('li','',edge.label ? edge.label + ' → ' : '',beatLink(edge.to));
          link.id = edge.anchor;
          return link;
        })));
      }
      gallery(block,node);
    }

    function renderChapter(parent, list, chapter) {
      const title = chapter.title || t('untitled');
      const block = titled(parent,'section','pdf-chapter','h3',title,chapter.anchor);
      addToIndex(list,block,title);
      const beats = beatsByChapter.get(chapter.id) ?? [];
      if (beats.length) {
        diagram(block,t('timeline'),app.diagram.printableTimeline(project,beats,chapter.anchor),'h4');
      } else {
        const timeline = titled(block,'section','pdf-diagram','h4',t('timeline'));
        timeline.append(element('p','pdf-text',t('pdfNoBeats')));
      }
      coverImage(block,chapter.cover,'chapterCover');
      gallery(block,chapter);
      for (const node of beats) renderBeat(block,node);
    }

    function renderProfile(parent, person, portraitKey) {
      const portrait = portraits.get(person.portraitId);
      if (app.characterData.validPortrait(portrait?.data)) image(parent,t(portraitKey),{preview:portrait.data,className:'pdf-portrait'});
      addFields(parent,app.characterData.profileFields.map(key => [t(key),person[key]]));
      for (const [key,fields] of [['personality',app.characterData.personalityFields],['motivation',app.characterData.motivationFields]]) {
        addDetails(parent,t(key),fields.map(field => [t(key + '.' + field),person[key]?.[field]]));
      }
    }

    function renderEvent(event) {
      const block = element('li','pdf-event',element('p','pdf-text',event.summary));
      const route = routes.get(event.pathId), edge = edges.get(event.edgeId);
      const changes = event.changes;
      addFields(block,[[t('eventPhase'),savedValue('eventPhase-',event.phase)],
        [t('arcPath'),route ? reference(route.anchor,routeName(route)) : t('commonArcPath')],
        [t('storyBeat'),beatLink(event.nodeId)],[t('mapConnection'),edge && reference(edge.anchor,
          app.characterData.routeNameFromEdge(edge,project))],[t('arcOutcomeType'),savedValue('arcOutcome-',event.arcType)],
        [t('arcFate'),savedValue('fate-',changes?.fate)],[t('objectiveStatus'),savedValue('objective-',changes?.objectiveStatus)],
        [t('group'),changes?.group === null ? t('leaveGroup') : changes?.group],[t('belief'),changes?.belief]]);
      for (const change of listOf(event.relationshipChanges)) {
        const relation = relations.get(change?.relationshipId);
        if (!relation) continue;
        block.append(element('h5','',reference(relation.anchor,relationName(relation) + ' · ' + relationType(relation))));
        addFields(block,[[t('relationshipState'),savedValue('relationship-',change.state)],...attributes(change.attributes)]);
      }
      return block;
    }

    const collect = (items, key) => {
      const grouped = new Map();
      for (const item of items.values()) {
        if (!grouped.has(item[key])) grouped.set(item[key],[]);
        grouped.get(item[key]).push(item);
      }
      return grouped;
    };
    const beatsByChapter = collect(nodes,'chapter'), edgesByNode = collect(edges,'from'), arcsByPerson = collect(arcs,'characterId');
    const cover = element('section',project.cover ? 'pdf-front' : 'pdf-front pdf-front-text',
      element('header','pdf-front-header',element('p','pdf-brand','Enredo'),element('p','pdf-document-type',t('pdfProjectReport'))),
      element('h1','',project.title.trim() || t('untitled')));
    coverImage(cover,project.cover,'projectCover');
    const counts = [[chapters.size,'countChapter'],[nodes.size,'countNode'],[people.size,'countCharacter']];
    cover.append(element('ul','pdf-front-summary',...counts.map(([count,key]) =>
      element('li','',element('strong','',count.toLocaleString(locale)),t(count === 1 ? key : key + 'Plural')))));
    fragment.append(cover,element('nav','pdf-contents',element('h2','',t('pdfContents')),index));

    const overview = section('overview',t('projectOverview')).group;
    const model = app.narrative.getNarrativeModel(project.narrativeModel);
    addFields(overview,[[t('narrativeModel'),model ? app.structure.narrativeText(model.name) : project.narrativeModel]]);
    if (project.summary) {
      const destinations = new Map();
      for (const [kind,items] of [['group',groups],['chapter',chapters],['beat',nodes],['world',worldEntries]]) {
        for (const [id,item] of items) destinations.set(app.projectSummary.linkHref(kind,id),'#' + item.anchor);
      }
      const summary = app.projectSummary.render(project.summary,href => destinations.get(href));
      if (summary.textContent.trim()) {
        overview.append(element('h3','',t('storySummary')),element('div','pdf-story-summary',summary));
      }
    }
    if (chapters.size || groups.size) {
      diagram(overview,t('pdfWholeStoryDiagram'),app.diagram.printableOverview(project,'whole-story','pdfWholeStoryDiagram'));
    }
    if (project.mapBackgroundId) {
      const showDiagram = app.preferences.showMapDiagram;
      const title = t('storyMap');
      const map = diagram(overview,title,showDiagram ? app.diagram.printableOverview(project,'story-map','storyMap') : '');
      if (showDiagram) images.push({image:map.querySelector('.pdf-map-background'),id:project.mapBackgroundId});
      else image(map,title,{id:project.mapBackgroundId,className:'pdf-map-image'});
    }
    gallery(overview,project);

    const story = section('story',t('groupsAndChapters'));
    const chapterIndex = element('ul','');
    if (chapters.size || groups.size) story.item.append(chapterIndex);
    else story.group.append(element('p','pdf-text',t('noChapters')));
    for (const group of groups.values()) {
      const block = titled(story.group,'section','pdf-group','h3',group.title,group.anchor);
      const item = addToIndex(chapterIndex,block,group.title);
      const groupIndex = element('ul','');
      coverImage(block,group.cover,'groupCover');
      if (group.description) block.append(element('p','pdf-text',group.description));
      gallery(block,group);
      const groupChapters = app.chapterGroups.groupChapters(project,group.id);
      if (groupChapters.length) item.append(groupIndex);
      else block.append(element('p','pdf-text',t('noGroupChapters')));
      for (const chapter of groupChapters) renderChapter(block,groupIndex,chapters.get(chapter.id));
    }
    for (const chapter of chapters.values()) {
      if (!groups.has(chapter.groupId)) renderChapter(story.group,chapterIndex,chapter);
    }

    if (worldEntries.size) {
      const universe = section('universe',t('universe')).group;
      for (const category of app.universeData.categories) {
        const records = [...worldEntries.values()].filter(entry => entry.category === category);
        if (!records.length) continue;
        const categorySection = titled(universe,'section','pdf-details','h3',t('worldCategory-' + category));
        for (const entry of records) {
          const block = titled(categorySection,'article','pdf-record','h4',worldName(entry),entry.anchor);
          const details = entry.details ?? {};
          const fields = [[t('description'),entry.description],[t('notes'),entry.notes],
            [t('worldEntryTags'),listOf(entry.tags).join(', ')]];
          if (entry.category === 'location' && details.locationType) fields.unshift([t('locationType'),t('locationType-' + details.locationType)]);
          if (entry.category === 'organization' && details.organizationType) fields.unshift([t('organizationType'),t('organizationType-' + details.organizationType)]);
          if (entry.category === 'item' && details.itemType) fields.unshift([t('itemType'),t('itemType-' + details.itemType)]);
          if (entry.category === 'history') fields.unshift([t('historicalPeriod'),details.period],[t('historicalDate'),details.date],[t('historicalImpact'),details.impact]);
          addFields(block,fields);
          const links = listOf(entry.references).flatMap(referenceItem => {
            const collections = {universe:worldEntries,character:people,group:groups,chapter:chapters,node:nodes};
            const target = collections[referenceItem.kind]?.get(referenceItem.id);
            if (!target) return [];
            const label = referenceItem.kind === 'universe' ? worldName(target) :
              referenceItem.kind === 'character' ? target.name : referenceItem.kind === 'group' || referenceItem.kind === 'chapter'
                ? target.title : [chapters.get(target.chapter)?.title,beatName(target)].filter(Boolean).join(' / ');
            const link = reference(target.anchor,[referenceItem.relation,label].filter(Boolean).join(' / '));
            return [element('li','',link)];
          });
          const incoming = [...worldEntries.values()].filter(other => other.id !== entry.id && listOf(other.references).some(referenceItem =>
            referenceItem.kind === 'universe' && referenceItem.id === entry.id));
          for (const other of incoming) links.push(element('li','',reference(other.anchor,worldName(other))));
          if (links.length) addContent(block,t('worldEntryReferences'),element('ul','pdf-world-links',...links));
          if (summaryUsesWorldEntry(project,entry.id)) {
            addContent(block,t('worldEntryUsedInSummary'),reference('pdf-overview',t('projectOverview')));
          }
          gallery(block,entry);
        }
      }
    }

    if (people.size || roles.size || arcs.size || routes.size || relations.size || kinds.size) {
      const characters = section('characters',t('characters'));
      if (people.size && !characterDataIssue) {
        const graph = diagram(characters.group,t('relationshipGraph'),app.characters.relationshipGraphMarkup(project,{interactive:false}));
        graph.append(element('figcaption','',t(relations.size ? 'pdfRelationshipDirection' : 'relationshipGraphEmpty')));
      }
      for (const person of people.values()) {
        const block = titled(characters.group,'article','pdf-record','h3',person.name,person.anchor);
        addFields(block,[[t('primaryRole'),roleName(person.primaryRoleId)],
          [t('characterRoles'),listOf(person.roleIds).map(roleName).join(', ')]]);
        renderProfile(block,person,'portrait');
        gallery(block,person,'imageGallery');
        for (const phase of listOf(person.phases).filter(phase => phase?.title)) {
          const profile = titled(block,'section','pdf-details','h4',phase.title);
          renderProfile(profile,phase,'phasePortrait');
        }
        for (const arc of arcsByPerson.get(person.id) ?? []) {
          const entry = titled(block,'section','pdf-details','h4',arc.title,arc.anchor);
          addFields(entry,[[t('characterPhase'),phaseName(person,arc.phaseId) || t('allPhases')],
            ...app.characterData.initialFields.map(key => [t('initial.' + key),arc.initial?.[key]])]);
          const events = listOf(arc.events).filter(event => event?.summary);
          if (events.length) entry.append(element('ol','pdf-events',...events.map(renderEvent)));
        }
      }
      if (routes.size) {
        const paths = titled(characters.group,'section','pdf-details','h3',t('pdfStoryPaths'));
        for (const route of routes.values()) {
          const block = titled(paths,'article','pdf-record','h4',routeName(route),route.anchor);
          const edge = edges.get(route.edgeId);
          if (edge) addFields(block,[[t('mapConnection'),reference(edge.anchor,app.characterData.routeNameFromEdge(edge,project))]]);
        }
      }
      if (relations.size) {
        const relationships = section('relationships',t('relationships')).group;
        for (const relation of relations.values()) {
          const block = titled(relationships,'article','pdf-record','h3',relationName(relation),relation.anchor);
          addFields(block,[[t('relationshipType'),relationType(relation)],
            [t('initialState'),savedValue('relationship-',relation.initialState)],...attributes(relation.initialAttributes),[t('notes'),relation.notes]]);
        }
      }
      if (roles.size || kinds.size) {
        const definitions = section('definitions',t('pdfCharacterDefinitions')).group;
        addFields(definitions,[[t('characterRoles'),[...roles.values()].map(role => role.name).join(', ')],
          [t('manageRelationshipTypes'),[...kinds.values()].map(kind => kind.name).join(', ')]]);
      }
    }

    if (sprints.size || tasks.size) {
      const management = section('management',t('projectManagement')).group;
      if (sprints.size) {
        const sprintSection = titled(management,'section','pdf-details','h3',t('sprints'));
        for (const sprint of sprints.values()) {
          const block = titled(sprintSection,'article','pdf-record','h4',sprint.title,sprint.anchor);
          addFields(block,[[t('sprintStatus'),savedValue('sprint',capitalized(sprint.status))],...dateFields(sprint),[t('sprintGoal'),sprint.goal]]);
        }
      }
      if (tasks.size) {
        const taskSection = titled(management,'section','pdf-details','h3',t('tasks'));
        for (const task of tasks.values()) {
          const sprint = sprints.get(task.sprintId);
          const block = titled(taskSection,'article','pdf-record','h4',task.title,task.anchor);
          addFields(block,[[t('taskStatus'),savedValue('task',capitalized(task.status))],
            [t('taskPriority'),savedValue('priority',capitalized(task.priority))],...dateFields(task),
            [t('sprint'),sprint && reference(sprint.anchor,sprint.title)],[t('storyBeat'),beatLink(task.beatId)],[t('notes'),task.notes]]);
          gallery(block,task,'imageGallery');
        }
      }
    }
    return {fragment,images};
  }

  function summaryUsesWorldEntry(project,id) {
    if (!project.summary) return false;
    const template = document.createElement('template');
    template.innerHTML = project.summary;
    const href = app.projectSummary.linkHref('world',id);
    return [...template.content.querySelectorAll('a[href]')].some(anchor => anchor.getAttribute('href') === href);
  }

  function finishPrint(failed = false) {
    const report = $('projectPdf');
    report.hidden = true;
    report.replaceChildren();
    $('exportPdf').disabled = false;
    if (originalTitle !== undefined) {
      document.title = originalTitle;
      originalTitle = undefined;
    }
    if (failed) flash('pdfFailed');
  }

  async function exportPdf() {
    const project = app.store.project();
    const button = $('exportPdf');
    if (!project || button.disabled || app.session.atHome) return;
    button.disabled = true;
    app.workspace.closeMenus();
    flash('pdfPreparing');
    try {
      const snapshot = JSON.parse(JSON.stringify(project));
      const locale = document.documentElement.lang;
      const {fragment,images} = buildReport(snapshot,locale,app.characterData.issue(project));
      await loadImages(images);
      const report = $('projectPdf');
      report.replaceChildren(fragment);
      report.hidden = false;
      const title = snapshot.title.trim() || t('untitled');
      if (app.platform.android) app.platform.android.printProject(title,locale,report.outerHTML);
      else {
        originalTitle = document.title;
        document.title = title;
        window.print();
      }
    } catch {
      finishPrint(true);
    }
  }

  function bindEvents() {
    bindActions({exportPdf});
    window.addEventListener('afterprint',() => {
      if (originalTitle !== undefined) finishPrint();
    });
  }

  return {bindEvents,finishPrint};
})(Enredo);
