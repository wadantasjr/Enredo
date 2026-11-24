Enredo.structure = ((app) => {
  'use strict';

  const { t, tx } = app.preferences;
  const { option, esc, field, number, icon, $ } = app.dom;

  const narrativeText = copy => copy[app.preferences.language];

  function narrativeStageName(assignment) {
    const stage = app.narrative.getNarrativeStage(assignment.modelId,assignment.stepId);
    return stage ? narrativeText(stage.name) : t('unknownStage');
  }

  function preservedStageDescription(assignment) {
    const model = app.narrative.getNarrativeModel(assignment.modelId);
    return t('preservedStageDetails',{
      model:model ? narrativeText(model.name) : t('unknownModel'),
      stage:narrativeStageName(assignment)
    });
  }

  function activeNarrativeStage(node,model) {
    const assignment = node.narrativeStage;
    if (assignment?.modelId === model.id) return app.narrative.getNarrativeStage(model.id,assignment.stepId);
  }

  function narrativeStageOptions(model,selected = '',prompt = 'noNarrativeStage') {
    return option('',t(prompt),!selected) + model.stages.map(stage =>
      option(stage.id,(stage.parentId ? '↳ ' : '') + narrativeText(stage.name),stage.id === selected)).join('');
  }

  function narrativeStageField(node,p) {
    const model = app.narrative.activeNarrativeModel(p);
    const active = activeNarrativeStage(node,model);
    const preserved = node.narrativeStage && !active;
    let options = narrativeStageOptions(model,active?.id);
    if (preserved) options = option('',t('preservedStage',{stage:narrativeStageName(node.narrativeStage)}),true);
    const control = '<select id="nodeNarrativeStage"' +
      (preserved || !model.stages.length ? ' disabled aria-describedby="nodeNarrativeHint"' : '') + '>' + options + '</select>';
    let details = '';
    if (preserved) {
      const convert = model.stages.length ? '<button type="button" class="btn" id="convertNarrativeStage">' + tx('convertAssociation') + '</button>' : '';
      details = '<p class="hint" id="nodeNarrativeHint">' + esc(preservedStageDescription(node.narrativeStage)) + '</p>' +
        '<div class="narrative-association-actions">' + convert +
        '<button type="button" class="btn" id="removeNarrativeStage">' + tx('removeAssociation') + '</button></div>';
    } else if (!model.stages.length) {
      details = '<p class="hint" id="nodeNarrativeHint">' + tx('noStagesForAssociation') + '</p>';
    }
    return '<div>' + field(t('narrativeStage'),control) + details + '</div>';
  }

  function renderStructureSituations(nodes,chapters,{preserved = false} = {}) {
    return nodes.map(node => {
      const title = node.title || t('untitled');
      const chapter = chapters.get(node.chapter);
      const description = preserved ? ' · ' + preservedStageDescription(node.narrativeStage) : '';
      return '<li><button type="button" class="structure-locate" data-locate-node="' + esc(node.id) +
        '" aria-label="' + tx('locateNamedBeat',{title,chapter}) + '"><span><strong>' + esc(title) + '</strong><small>' +
        esc(chapter + description) + '</small></span><span>' + tx('locateOnMap') + '</span></button></li>';
    }).join('');
  }

  function renderStructureStage(stage,nodes,chapters) {
    const expanded = stage.id === app.session.structureStageSelection;
    const detailsId = 'narrative-stage-' + stage.id;
    const index = stage.suggestedPosition ?? (stage.kind === 'stage' ? stage.order : null);
    const kind = {act:'stageAct',sequence:'stageSequence',milestone:'stageMilestone'}[stage.kind];
    const numberLabel = index ? '<span class="structure-stage-order">' + number(index - 1) + '</span>' : '';
    const kindLabel = kind ? '<small class="structure-stage-kind">' + tx(kind) + '</small>' : '';
    const questions = expanded ? stage.questions.map(question => '<li>' + esc(narrativeText(question)) + '</li>').join('') : '';
    const situations = !expanded ? '' : nodes.length ? '<ul class="structure-situations">' +
      renderStructureSituations(nodes,chapters) + '</ul>' : '<p class="hint">' + tx('noStageSituations') + '</p>';
    const details = expanded ? '<p>' + esc(narrativeText(stage.summary)) + '</p><h3>' + tx('guidingQuestions') +
      '</h3><ul class="structure-questions">' + questions + '</ul><h3>' + tx('associatedSituations') + '</h3>' + situations : '';
    return '<div class="structure-stage"><button type="button" class="structure-stage-toggle" data-narrative-stage="' + esc(stage.id) +
      '" aria-expanded="' + expanded + '" aria-controls="' + esc(detailsId) + '"><span><span class="structure-stage-name">' +
      numberLabel + '<strong>' + esc(narrativeText(stage.name)) + '</strong>' + kindLabel +
      '</span><span class="structure-stage-purpose">' + esc(narrativeText(stage.purpose)) + '</span></span>' +
      '<span class="structure-stage-status">' + (nodes.length ? esc(app.workspace.countText(nodes.length,'countNode')) : tx('stageUnused')) +
      icon('chevron') + '</span></button><div class="structure-stage-details" id="' + esc(detailsId) + '"' +
      (expanded ? '' : ' hidden') + '>' + details + '</div></div>';
  }

  function renderStructure() {
    const p = app.store.project(), usage = app.narrative.narrativeUsage(p), {model} = usage;
    const chapters = new Map(p.chapters.map((c,index) => [c.id,number(index) + ' · ' + c.title]));
    $('structureModelName').textContent = narrativeText(model.name);
    $('structureDescription').textContent = narrativeText(model.summary);
    $('structureModelUnavailable').hidden = p.narrativeModel === model.id;
    $('structureGuide').textContent = t(model.stages.length ? 'structureGuide' : 'noPredefinedStages');
    $('structureSummary').innerHTML = [
      ['total','totalStages'], ['used','usedStages'], ['unused','unusedStages'],
      ['associated','associatedSituations'], ['unassociated','unassociatedSituations']
    ].map(([count,key]) => '<div><dt>' + tx(key) + '</dt><dd data-narrative-count="' + count + '">' + usage[count] + '</dd></div>').join('');

    const preserved = $('structurePreserved');
    preserved.hidden = !usage.preserved.length;
    if (preserved.hidden) preserved.open = false;
    $('structurePreservedTitle').textContent = t('preservedAssociations',{count:usage.preserved.length});
    $('structurePreservedList').innerHTML = renderStructureSituations(usage.preserved,chapters,{preserved:true});
    if (app.session.structureStageSelection && !usage.byStage.has(app.session.structureStageSelection)) app.session.structureStageSelection = null;

    const stageItem = entry => renderStructureStage(entry,usage.byStage.get(entry.id),chapters);
    const children = new Map();
    for (const entry of model.stages) {
      if (!entry.parentId) continue;
      if (!children.has(entry.parentId)) children.set(entry.parentId,[]);
      children.get(entry.parentId).push(entry);
    }
    $('structureStages').innerHTML = model.stages.filter(entry => !entry.parentId).map(entry => {
      const group = children.get(entry.id);
      const nested = group ? '<ul class="structure-stages structure-substages">' +
        group.map(child => '<li>' + stageItem(child) + '</li>').join('') + '</ul>' : '';
      return '<li>' + stageItem(entry) + nested + '</li>';
    }).join('');
  }

  function locateNarrativeNode(id) {
    const node = app.store.nodeById(id);
    if (!node || !app.session.isStructureView()) return;
    app.session.selection = id;
    app.store.state.chapter = node.chapter;
    app.workspace.switchView('whole-story',{revealSelection:true});
    app.diagram.reveal(id);
    $('graph').scrollIntoView({block:'nearest'});
    app.diagram.cardFor(id)?.focus({preventScroll:true});
  }

  function focusNarrativeStage(node) {
    const field = $('nodeNarrativeStage');
    if (field && !field.disabled) field.focus({preventScroll:true});
    else app.diagram.cardFor(node.id)?.focus({preventScroll:true});
  }

  function updateNarrativeStage(node,assignment) {
    app.store.edit(() => { node.narrativeStage = assignment; });
    focusNarrativeStage(node);
  }

  function convertNarrativeStage() {
    const node = app.store.selectedNode(), model = app.narrative.activeNarrativeModel(app.store.project());
    if (!node?.narrativeStage || activeNarrativeStage(node,model) || !model.stages.length) return;
    app.dialogs.showDialog({title:t('convertAssociation'),body:'<div class="fields"><p class="hint">' +
      esc(preservedStageDescription(node.narrativeStage)) + '</p><p>' + tx('convertAssociationHint') + '</p>' +
      field(t('narrativeStage'),'<select name="stepId" required>' + narrativeStageOptions(model,'','chooseNarrativeStage') + '</select>') +
      '</div>',submitKey:'convertAssociation',onSubmit:data => {
        const stepId = data.get('stepId');
        if (!app.narrative.getNarrativeStage(model.id,stepId)) return;
        app.dialogs.closeDialog();
        updateNarrativeStage(node,{modelId:model.id,stepId});
      }});
  }

  function confirmRemoveNarrativeStage() {
    const node = app.store.selectedNode();
    if (!node?.narrativeStage) return;
    app.dialogs.showDialog({title:t('removeAssociationTitle'),body:'<p>' + tx('removeAssociationHint') + '</p>',
      danger:true,submitKey:'removeAssociation',onSubmit:() => {
        app.dialogs.closeDialog();
        updateNarrativeStage(node,null);
      }});
    $('dialogCancel').focus();
  }

  function bindEvents() {
    $('structureView').addEventListener('click',event => {
      const step = event.target.closest('[data-narrative-stage]');
      if (step) {
        const id = step.dataset.narrativeStage;
        app.session.structureStageSelection = app.session.structureStageSelection === id ? null : id;
        renderStructure();
        $('structureStages').querySelector('[data-narrative-stage="' + CSS.escape(id) + '"]')?.focus({preventScroll:true});
      }
      const target = event.target.closest('[data-locate-node]');
      if (target) locateNarrativeNode(target.dataset.locateNode);
    });
    $('inspector').addEventListener('change',event => {
      if (event.target.id !== 'nodeNarrativeStage' || event.target.disabled) return;
      const node = app.store.selectedNode();
      if (!node) return;
      const model = app.narrative.activeNarrativeModel(app.store.project());
      const active = activeNarrativeStage(node,model);
      const stepId = event.target.value;
      if (!stepId && active) {
        event.target.value = active.id;
        confirmRemoveNarrativeStage();
      } else if (stepId !== active?.id && app.narrative.getNarrativeStage(model.id,stepId)) {
        updateNarrativeStage(node,{modelId:model.id,stepId});
      }
    });
    $('inspector').addEventListener('click',event => {
      const button = event.target.closest('button');
      if (button?.id === 'convertNarrativeStage') convertNarrativeStage();
      if (button?.id === 'removeNarrativeStage') confirmRemoveNarrativeStage();
    });
  }

  return {
    activeNarrativeStage,
    bindEvents,
    focusNarrativeStage,
    narrativeStageField,
    narrativeStageName,
    narrativeText,
    renderStructure
  };
})(Enredo);
