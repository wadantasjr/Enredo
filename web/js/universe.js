Enredo.universe = ((app) => {
  'use strict';

  const { $, esc, icon, field, input, option, uid } = app.dom;
  const { t, tx } = app.preferences;
  const kinds = app.universeData.referenceKinds;
  const categories = app.universeData.categories;
  const subtypeOptions = {
    location: ['city','region','building','environment','territory'],
    organization: ['faction','government','company','institution','socialGroup','militaryGroup'],
    item: ['artifact','equipment','document','technology']
  };

  let projectId = null;
  let selectedId = null;
  let search = '';
  let categoryFilter = 'all';
  let usageContext = null;

  const project = () => app.store.project();
  const categoryName = category => t('worldCategory-' + category);
  const entryName = entry => entry?.name?.trim() || t('untitled');

  function targetsFor(p, kind, excludeId = '') {
    const collection = app.universeData.referenceCollections[kind];
    return (p?.[collection] ?? []).filter(item => item?.id && item.id !== excludeId).map(item => {
      let label = item.name || item.title || t('untitled');
      if (kind === 'node') {
        const chapter = p.chapters.find(record => record.id === item.chapter);
        label = [chapter?.title, item.title].filter(Boolean).join(' / ') || t('untitled');
      }
      return {id:item.id,label};
    });
  }

  function targetFor(p, kind, id) {
    const collection = app.universeData.referenceCollections[kind];
    const item = p?.[collection]?.find(record => record.id === id);
    if (!item) return null;
    let label = item.name || item.title || t('untitled');
    if (kind === 'node') {
      const chapter = p.chapters.find(record => record.id === item.chapter);
      label = [chapter?.title, item.title].filter(Boolean).join(' / ') || t('untitled');
    }
    return {item,label};
  }

  function referencedEntries(p, kind, id) {
    return (p.worldEntries ?? []).filter(entry => (entry.references ?? []).some(reference =>
      reference.kind === kind && reference.id === id));
  }

  function contextLabel(p, context) {
    if (!context) return '';
    const target = targetFor(p,context.kind,context.id);
    return target ? target.label : '';
  }

  function contextNotice(p) {
    if (!usageContext) return '';
    const label = contextLabel(p,usageContext);
    if (!label) return '';
    const count = referencedEntries(p,usageContext.kind,usageContext.id).length;
    return '<aside class="universe-context"><span>' + tx('universeContext',{kind:t('worldRef-' + usageContext.kind),name:label,count}) +
      '</span><button type="button" class="btn ghost" data-world-clear-context>' + tx('clearFilter') + '</button></aside>';
  }

  function render(p = project()) {
    const root = $('universeView');
    if (!p || !root) return;
    if (projectId !== p.id) {
      projectId = p.id;
      selectedId = null;
      search = '';
      categoryFilter = 'all';
      usageContext = null;
    }
    const searchLabel = t('universeSearch');
    root.innerHTML = '<div class="universe-heading"><div><h2 id="universeTitle" tabindex="-1">' + tx('universe') +
      '</h2><p>' + tx('universeHint') + '</p></div><div class="universe-actions"><button type="button" class="btn primary" data-world-action="create">' +
      icon('plus') + ' ' + tx('newWorldEntry') + '</button></div></div>' + contextNotice(p) +
      '<div class="universe-layout"><section class="universe-list-pane" aria-label="' + esc(searchLabel) + '">' +
      '<div class="universe-toolbar"><label class="field universe-search"><span>' + esc(searchLabel) + '</span><input id="universeSearch" type="search" value="' + esc(search) +
      '" placeholder="' + tx('universeSearchHint') + '"></label><label class="field universe-filter"><span>' + tx('worldCategory') + '</span>' +
      '<select id="universeCategoryFilter">' + option('all',t('worldAllCategories'),categoryFilter === 'all') + categories.map(category =>
        option(category,categoryName(category),categoryFilter === category)).join('') + '</select></label></div>' +
      '<div id="universeList" class="universe-list" role="list"></div></section><section id="universeDetail" class="universe-detail-pane" aria-live="polite"></section></div>';
    renderList(p);
    const searchInput = $('universeSearch');
    searchInput.value = search;
  }

  function matchingEntries(p) {
    const query = search.trim().toLocaleLowerCase();
    return (p.worldEntries ?? []).filter(entry => (categoryFilter === 'all' || entry.category === categoryFilter) &&
      (!query || [entry.name,entry.description,entry.notes,...(entry.tags ?? [])].some(value =>
        String(value ?? '').toLocaleLowerCase().includes(query))));
  }

  function renderList(p = project()) {
    const list = $('universeList');
    if (!list || !p) return;
    const matches = matchingEntries(p);
    if (!matches.some(entry => entry.id === selectedId)) selectedId = matches[0]?.id ?? null;
    list.innerHTML = matches.length ? matches.map(entry => '<button type="button" class="universe-entry-card' +
      (entry.id === selectedId ? ' active' : '') + '" data-universe-entry="' + esc(entry.id) + '" role="listitem" aria-current="' +
      (entry.id === selectedId ? 'true' : 'false') + '"><span class="universe-entry-category">' + esc(categoryName(entry.category)) +
      '</span><strong>' + esc(entryName(entry)) + '</strong>' + (entry.description ? '<small>' + esc(entry.description) + '</small>' : '') + '</button>').join('') :
      '<p class="universe-list-empty">' + tx(p.worldEntries?.length ? 'universeNoMatches' : 'universeEmpty') + '</p>';
    renderDetail(p);
  }

  function detailRows(entry) {
    const details = entry.details ?? {};
    const keys = entry.category === 'location' ? [['locationType',details.locationType]] :
      entry.category === 'organization' ? [['organizationType',details.organizationType]] :
      entry.category === 'item' ? [['itemType',details.itemType]] :
      [['historicalPeriod',details.period],['historicalDate',details.date],['historicalImpact',details.impact]];
    return keys.filter(([,value]) => value).map(([label,value]) => '<div class="universe-detail-row"><dt>' + tx(label) +
      '</dt><dd>' + esc(subtypeOptions[entry.category]?.includes(value) ? t(entry.category + 'Type-' + value) : value) + '</dd></div>').join('');
  }

  function summaryUses(p, id) {
    if (!p.summary) return false;
    const template = document.createElement('template');
    template.innerHTML = p.summary;
    const href = app.projectSummary.linkHref('world',id);
    return [...template.content.querySelectorAll('a[href]')].some(anchor => anchor.getAttribute('href') === href);
  }

  function referenceItem(p, entry, reference, index, removable) {
    const target = targetFor(p,reference.kind,reference.id);
    if (!target) return '';
    return '<li class="universe-reference-item"><span>' + (reference.relation ? '<small>' + esc(reference.relation) + '</small>' : '') +
      '<button type="button" data-world-target-kind="' + esc(reference.kind) + '" data-world-target-id="' + esc(reference.id) + '">' +
      icon(reference.kind === 'node' ? 'timeline' : reference.kind === 'character' ? 'people' : reference.kind === 'universe' ? 'globe' : 'book') +
      '<span>' + esc(target.label) + '</span></button></span>' + (removable ? '<button type="button" class="icon-btn small" data-world-unlink="' + index +
      '" data-world-entry-id="' + esc(entry.id) + '" aria-label="' + tx('removeWorldReference') + '" title="' + tx('removeWorldReference') + '">' +
      icon('close') + '</button>' : '') + '</li>';
  }

  function renderReferences(p, entry) {
    const outgoing = (entry.references ?? []).map((reference,index) => referenceItem(p,entry,reference,index,true)).filter(Boolean);
    const incoming = (p.worldEntries ?? []).filter(other => other.id !== entry.id && (other.references ?? []).some(reference =>
      reference.kind === 'universe' && reference.id === entry.id));
    const summary = summaryUses(p,entry.id);
    const backlinks = incoming.map(other => '<li><button type="button" data-universe-entry="' + esc(other.id) + '">' + icon('globe') +
      '<span>' + esc(entryName(other)) + '</span></button></li>').join('');
    return '<section class="universe-section"><div class="universe-section-heading"><h3>' + tx('worldEntryReferences') +
      '</h3><button type="button" class="btn" data-world-action="add-reference" data-world-entry-id="' + esc(entry.id) + '"' +
      (kinds.every(kind => targetsFor(p,kind,kind === 'universe' ? entry.id : '').length === 0) ? ' disabled' : '') + '>' +
      icon('plus') + ' ' + tx('addWorldReference') + '</button></div>' +
      (outgoing.length ? '<h4>' + tx('worldEntryLinkedTo') + '</h4><ul class="universe-reference-list">' + outgoing.join('') + '</ul>' :
        '<p class="hint">' + tx('worldEntryNoReferences') + '</p>') +
      (incoming.length ? '<h4>' + tx('worldEntryRelatedFrom') + '</h4><ul class="universe-reference-list">' + backlinks + '</ul>' : '') +
      (summary ? '<p class="universe-summary-use"><button type="button" class="btn ghost" data-world-target-kind="summary" data-world-target-id="' +
        esc(entry.id) + '">' + icon('book') + ' ' + tx('worldEntryUsedInSummary') + '</button></p>' : '') + '</section>';
  }

  function renderDetail(p = project()) {
    const root = $('universeDetail');
    if (!root || !p) return;
    const entry = (p.worldEntries ?? []).find(record => record.id === selectedId);
    if (!entry) {
      const createLabel = usageContext ? tx('createLinkedWorldEntry') : tx('newWorldEntry');
      root.innerHTML = '<div class="universe-detail-empty">' + icon('globe') + '<h3>' +
        tx(p.worldEntries?.length ? 'universeSelectEntry' : 'universeEmpty') + '</h3><p>' +
        tx(p.worldEntries?.length ? 'universeSelectEntryHint' : 'universeEmptyHint') + '</p><button type="button" class="btn primary" data-world-action="create">' +
        icon('plus') + ' ' + createLabel + '</button></div>';
      return;
    }
    const tags = (entry.tags ?? []).map(tag => '<span class="universe-tag">' + esc(tag) + '</span>').join('');
    const details = detailRows(entry);
    const attachments = app.mediaGallery.launcher('universe',entry);
    root.innerHTML = '<article class="universe-record"><header class="universe-record-heading"><div><span class="universe-entry-category">' +
      esc(categoryName(entry.category)) + '</span><h3>' + esc(entryName(entry)) + '</h3></div><div class="universe-record-actions">' +
      attachments + '<button type="button" class="btn" data-world-action="edit" data-world-entry-id="' + esc(entry.id) + '">' +
      icon('edit') + ' ' + tx('edit') + '</button><button type="button" class="btn danger" data-world-action="delete" data-world-entry-id="' +
      esc(entry.id) + '">' + icon('trash') + ' ' + tx('delete') + '</button></div></header>' +
      (entry.description ? '<section class="universe-section"><h4>' + tx('description') + '</h4><p class="universe-prose">' + esc(entry.description) + '</p></section>' : '') +
      (details ? '<dl class="universe-detail-grid">' + details + '</dl>' : '') +
      (tags ? '<section class="universe-section"><h4>' + tx('worldEntryTags') + '</h4><div class="universe-tags">' + tags + '</div></section>' : '') +
      (entry.notes ? '<section class="universe-section"><h4>' + tx('notes') + '</h4><p class="universe-prose">' + esc(entry.notes) + '</p></section>' : '') +
      renderReferences(p,entry) + '</article>';
  }

  function typeField(category, value = '') {
    const types = subtypeOptions[category];
    if (types) return field(t(category + 'Type'),'<select name="' + category + 'Type">' + option('',t('noRecord'),!value) +
      types.map(type => option(type,t(category + 'Type-' + type),value === type)).join('') + '</select>');
    return field(t('historicalPeriod'),input('period',value.period ?? '')) +
      field(t('historicalDate'),input('date',value.date ?? '')) +
      field(t('historicalImpact'),'<textarea name="impact" rows="3" maxlength="2000">' + esc(value.impact ?? '') + '</textarea>');
  }

  function readDetails(form, category) {
    const data = new FormData(form);
    if (category === 'history') return {period:data.get('period') ?? '',date:data.get('date') ?? '',impact:data.get('impact') ?? ''};
    return {[category + 'Type']:data.get(category + 'Type') ?? ''};
  }

  function entryDialog(existing = null) {
    const p = project();
    if (!p) return;
    const initialCategory = existing?.category ?? 'location';
    const detailsCache = {[initialCategory]:{...(existing?.details ?? {})}};
    const values = existing ?? {name:'',description:'',notes:'',tags:[],details:{}};
    const categoryOptions = categories.map(category => option(category,categoryName(category),initialCategory === category)).join('');
    const body = '<div class="fields"><label class="field"><span>' + tx('worldEntryName') + '</span>' + input('name',values.name ?? '',t('worldEntryNameHint'),true) + '</label>' +
      field(t('worldCategory'),'<select name="category">' + categoryOptions + '</select>') +
      '<div class="world-category-fields" data-world-details>' + typeField(initialCategory,values.details ?? {}) + '</div>' +
      field(t('description'),'<textarea name="description" rows="4" maxlength="12000">' + esc(values.description ?? '') + '</textarea>') +
      field(t('notes'),'<textarea name="notes" rows="3" maxlength="12000">' + esc(values.notes ?? '') + '</textarea>') +
      field(t('worldEntryTags'),input('tags',(values.tags ?? []).join(', '),t('worldEntryTagsHint'))) + '</div>';
    app.dialogs.showDialog({title:t(existing ? 'editWorldEntry' : 'newWorldEntry'),body,className:'universe-dialog',submitKey:existing ? 'save' : 'add',extra:form => {
      const category = form.querySelector('[name="category"]');
      let activeCategory = initialCategory;
      category.addEventListener('change',() => {
        detailsCache[activeCategory] = readDetails(form,activeCategory);
        detailsCache[category.value] = detailsCache[category.value] ?? {};
        activeCategory = category.value;
        form.querySelector('[data-world-details]').innerHTML = typeField(category.value,detailsCache[category.value]);
      });
    },onSubmit:data => {
      const form = $('dialogForm');
      const category = data.get('category');
      const name = String(data.get('name') ?? '').trim();
      if (!name || !categories.includes(category)) return;
      detailsCache[category] = readDetails(form,category);
      const entry = existing ?? {id:uid(),references:[],galleryImages:[],galleryDocuments:[]};
      const tags = [...new Set(String(data.get('tags') ?? '').split(/[\n,]/).map(tag => tag.trim()).filter(Boolean))];
      const fields = {category,name,description:String(data.get('description') ?? '').trim(),notes:String(data.get('notes') ?? '').trim(),
        tags,details:detailsCache[category]};
      if (usageContext && !existing && targetFor(p,usageContext.kind,usageContext.id)) {
        entry.references.push({kind:usageContext.kind,id:usageContext.id,relation:usageContext.kind === 'character' ? t('worldRelationAssociated') : t('worldRelationMentioned')});
      }
      app.dialogs.closeDialog();
      app.store.edit(() => {
        Object.assign(entry,fields);
        if (!existing) {
          p.worldEntries ??= [];
          p.worldEntries.push(entry);
        }
      });
      selectedId = entry.id;
      $('universeDetail')?.scrollIntoView({block:'nearest'});
    }});
  }

  function targetOptions(p, kind, selectedIdForEntry) {
    const targets = targetsFor(p,kind,kind === 'universe' ? selectedIdForEntry : '');
    return targets.map(target => option(target.id,target.label)).join('');
  }

  function referenceDialog(entry) {
    const p = project();
    if (!entry || !p) return;
    const kindOptions = kinds.map(kind => option(kind,t('worldRef-' + kind),kind === 'universe')).join('');
    const initialKind = 'universe';
    const body = '<div class="fields"><label class="field"><span>' + tx('worldReferenceKind') + '</span><select name="kind">' + kindOptions + '</select></label>' +
      '<label class="field"><span>' + tx('worldReferenceTarget') + '</span><select name="targetId">' + targetOptions(p,initialKind,entry.id) + '</select></label>' +
      field(t('worldReferenceRelation'),input('relation','',t('worldReferenceRelationHint'))) + '</div>';
    app.dialogs.showDialog({title:t('addWorldReference'),body,className:'universe-dialog',submitKey:'add',extra:form => {
      const kind = form.querySelector('[name="kind"]'), target = form.querySelector('[name="targetId"]');
      kind.addEventListener('change',() => { target.innerHTML = targetOptions(p,kind.value,entry.id); });
    },onSubmit:data => {
      const kind = String(data.get('kind') ?? ''), id = String(data.get('targetId') ?? ''), relation = String(data.get('relation') ?? '').trim();
      if (!kinds.includes(kind) || !targetFor(p,kind,id)) return;
      app.dialogs.closeDialog();
      app.store.edit(() => entry.references.push({kind,id,relation}));
      selectedId = entry.id;
    }});
  }

  function targetLinkDialog(kind, id) {
    const p = project();
    const target = targetFor(p,kind,id);
    const entries = (p?.worldEntries ?? []).filter(entry => !(entry.references ?? []).some(reference => reference.kind === kind && reference.id === id));
    if (!target || !entries.length) return;
    const body = '<div class="fields"><label class="field"><span>' + tx('selectWorldEntry') + '</span><select name="entryId">' +
      entries.map(entry => option(entry.id,entryName(entry))).join('') + '</select></label>' +
      field(t('worldReferenceRelation'),input('relation','',t('worldReferenceRelationHint'))) + '</div>';
    app.dialogs.showDialog({title:t('linkWorldEntry'),body,className:'universe-dialog',submitKey:'add',onSubmit:data => {
      const entry = p.worldEntries.find(item => item.id === data.get('entryId'));
      if (!entry) return;
      app.dialogs.closeDialog();
      app.store.edit(() => entry.references.push({kind,id,relation:String(data.get('relation') ?? '').trim()}));
    }});
  }

  function deleteEntry(entry) {
    const p = project();
    if (!p || !entry) return;
    const references = entry.references?.length ?? 0;
    app.dialogs.confirmation(t('deleteWorldEntry'),t('deleteWorldEntryHint',{name:entryName(entry),count:references}),() => {
      selectedId = null;
      app.store.edit(() => {
        stripSummaryLink(p,entry.id);
        p.worldEntries = p.worldEntries.filter(record => record.id !== entry.id);
      });
    });
  }

  function stripSummaryLink(p,id) {
    if (!p.summary) return;
    const template = document.createElement('template');
    template.innerHTML = p.summary;
    const href = app.projectSummary.linkHref('world',id);
    template.content.querySelectorAll('a[href]').forEach(anchor => {
      if (anchor.getAttribute('href') === href) anchor.replaceWith(...anchor.childNodes);
    });
    const wrapper = document.createElement('div');
    wrapper.append(template.content);
    if (wrapper.textContent.trim()) p.summary = wrapper.innerHTML;
    else delete p.summary;
  }

  function removeReference(entryId, index) {
    const p = project(), entry = p?.worldEntries?.find(record => record.id === entryId);
    if (!entry || !Number.isInteger(index)) return;
    app.store.edit(() => { entry.references.splice(index,1); });
    selectedId = entry.id;
  }

  function openEntry(id) {
    const entry = project()?.worldEntries?.find(item => item.id === id);
    if (!entry) return;
    selectedId = id;
    search = '';
    categoryFilter = 'all';
    usageContext = null;
    if (app.session.universeOpen) app.workspace.render();
    else app.workspace.openUniverse();
  }

  function openForReference(kind, id) {
    if (!targetFor(project(),kind,id)) return;
    usageContext = {kind,id};
    const entry = referencedEntries(project(),kind,id)[0];
    selectedId = entry?.id ?? null;
    search = '';
    categoryFilter = 'all';
    if (app.session.universeOpen) app.workspace.render();
    else app.workspace.openUniverse();
  }

  function openTarget(kind, id) {
    const p = project();
    if (kind === 'universe') return openEntry(id);
    if (kind === 'summary') return app.chapterGroups.openProjectPresentation(p.id);
    if (kind === 'character') {
      if (!targetFor(p,kind,id)) return;
      app.workspace.openCharacters();
      app.characters.openCharacter(id);
      return;
    }
    if (kind === 'group') return app.chapterGroups.openGroup(id);
    if (kind === 'chapter') {
      if (!targetFor(p,kind,id)) return;
      app.workspace.navigate(p.id,id);
      return;
    }
    if (kind === 'node') {
      const target = targetFor(p,kind,id);
      if (!target) return;
      app.workspace.navigate(p.id,target.item.chapter);
      app.workspace.switchView('story-map');
      app.workspace.inspect(id,true);
    }
  }

  function linkedEntryButtons(entries, kind, id) {
    return entries.map(entry => {
      const link = (entry.references ?? []).find(reference => reference.kind === kind && reference.id === id);
      return '<button type="button" class="universe-chip" data-universe-entry="' + esc(entry.id) + '">' +
        icon('globe') + '<span>' + esc(entryName(entry)) + (link?.relation ? '<small>' + esc(link.relation) + '</small>' : '') + '</span></button>';
    }).join('');
  }

  function renderCharacterReferences(character, p = project()) {
    const entries = referencedEntries(p,'character',character.id);
    return '<section class="character-section universe-linked-section"><div class="universe-section-heading"><h4>' + tx('universeElements') +
      '</h4><button type="button" class="btn" data-world-link-target="character" data-world-target-id="' + esc(character.id) + '"' +
      (!p.worldEntries?.length ? ' disabled' : '') + '>' + icon('plus') + ' ' + tx('linkWorldEntry') + '</button></div>' +
      (entries.length ? '<div class="universe-chip-list">' + linkedEntryButtons(entries,'character',character.id) + '</div>' : '<p class="hint">' + tx('universeCharacterEmpty') + '</p>') + '</section>';
  }

  function renderNodeReferences(node, p = project()) {
    const entries = referencedEntries(p,'node',node.id);
    return '<section class="paths universe-linked-section"><div class="paths-title"><span>' + tx('universeElements') + '</span><span class="count">' +
      entries.length + '</span></div>' + (entries.length ? '<div class="universe-chip-list">' + linkedEntryButtons(entries,'node',node.id) + '</div>' :
      '<p class="hint">' + tx('universeBeatEmpty') + '</p>') +
      '<button type="button" class="btn path-add" data-world-link-target="node" data-world-target-id="' + esc(node.id) + '"' +
      (!p.worldEntries?.length ? ' disabled' : '') + '>' + icon('plus') + ' ' + tx('linkWorldEntry') + '</button></section>';
  }

  function chapterLauncher(chapter) {
    const count = referencedEntries(project(),'chapter',chapter.id).length;
    return '<button type="button" class="btn" data-world-usage-kind="chapter" data-world-usage-id="' + esc(chapter.id) + '">' +
      icon('globe') + ' ' + tx('universeElementsCount',{count}) + '</button>';
  }

  function usagePanel(kind, id) {
    const p = project(), entries = referencedEntries(p,kind,id);
    if (!entries.length) return '<section class="universe-usage-panel"><h3>' + tx('universeElements') + '</h3><p class="hint">' +
      tx('universeUsageEmpty') + '</p><button type="button" class="btn" data-world-usage-kind="' + esc(kind) + '" data-world-usage-id="' + esc(id) + '">' +
      icon('globe') + ' ' + tx('openUniverse') + '</button></section>';
    return '<section class="universe-usage-panel"><h3>' + tx('universeElements') + '</h3><div class="universe-chip-list">' +
      linkedEntryButtons(entries,kind,id) + '</div><button type="button" class="btn ghost" data-world-usage-kind="' + esc(kind) + '" data-world-usage-id="' + esc(id) + '">' +
      icon('globe') + ' ' + tx('openUniverse') + '</button></section>';
  }

  function bindEvents() {
    const root = $('universeView');
    root.addEventListener('input',event => {
      if (event.target.id !== 'universeSearch') return;
      search = event.target.value;
      renderList();
    });
    root.addEventListener('change',event => {
      if (event.target.id !== 'universeCategoryFilter') return;
      categoryFilter = event.target.value;
      renderList();
    });
    document.addEventListener('click',event => {
      const action = event.target.closest('[data-world-action]');
      if (action) {
        const entry = project()?.worldEntries?.find(item => item.id === action.dataset.worldEntryId);
        if (action.dataset.worldAction === 'create') entryDialog();
        else if (action.dataset.worldAction === 'edit') entryDialog(entry);
        else if (action.dataset.worldAction === 'delete') deleteEntry(entry);
        else if (action.dataset.worldAction === 'add-reference') referenceDialog(entry);
        return;
      }
      const clear = event.target.closest('[data-world-clear-context]');
      if (clear) {
        usageContext = null;
        render();
        return;
      }
      const usage = event.target.closest('[data-world-usage-kind]');
      if (usage) {
        openForReference(usage.dataset.worldUsageKind,usage.dataset.worldUsageId);
        return;
      }
      const entryButton = event.target.closest('[data-universe-entry]');
      if (entryButton) {
        if (app.session.universeOpen) {
          selectedId = entryButton.dataset.universeEntry;
          renderList();
        } else openEntry(entryButton.dataset.universeEntry);
        return;
      }
      const unlink = event.target.closest('[data-world-unlink]');
      if (unlink) {
        removeReference(unlink.dataset.worldEntryId,Number(unlink.dataset.worldUnlink));
        return;
      }
      const linkTarget = event.target.closest('[data-world-link-target]');
      if (linkTarget) {
        targetLinkDialog(linkTarget.dataset.worldLinkTarget,linkTarget.dataset.worldTargetId);
        return;
      }
      const target = event.target.closest('[data-world-target-kind]');
      if (target) openTarget(target.dataset.worldTargetKind,target.dataset.worldTargetId);
    });
  }

  return {
    bindEvents,
    chapterLauncher,
    openEntry,
    openForReference,
    render,
    renderCharacterReferences,
    renderNodeReferences,
    usagePanel
  };
})(Enredo);
