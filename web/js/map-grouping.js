Enredo.mapGrouping = ((app) => {
  'use strict';

  const { $, icon, bindActions } = app.dom;
  const { t, tx } = app.preferences;
  const temporary = { 'whole-story':new Map(), 'story-map':new Map() };

  const collapsedField = mode => mode === 'story-map' ? 'storyMapCollapsed' : 'wholeStoryCollapsed';

  function collapsedSections(project,mode = app.session.viewMode) {
    const field = collapsedField(mode);
    const collapsedIds = records => new Set(records.filter(record => record[field] === true).map(record => record.id));
    return temporary[mode].get(project.id) ?? {
      groups:collapsedIds(project.chapterGroups ?? []),
      chapters:collapsedIds(project.chapters)
    };
  }

  function saveCollapsedSections(project,grouping,mode) {
    const field = collapsedField(mode);
    function update(records,ids) {
      for (const record of records) {
        if (ids.has(record.id)) record[field] = true;
        else delete record[field];
      }
    }
    update(project.chapterGroups ?? [],grouping.groups);
    update(project.chapters,grouping.chapters);
  }

  function apply(project,grouping,fit) {
    const mode = app.session.viewMode;
    const previews = temporary[mode];
    app.diagram.stopConnect();
    if (previews.has(project.id)) {
      previews.set(project.id,grouping);
      app.workspace.render(fit);
    } else {
      app.store.edit(() => saveCollapsedSections(project,grouping,mode),{fit,saveError:'projectSaveFailed'});
    }
  }

  function expandChapter(project,chapterId) {
    if (!app.session.isStoryOverview()) return false;
    const chapter = project.chapters.find(item => item.id === chapterId);
    if (!chapter) return false;
    const group = project.chapterGroups?.find(item => item.id === chapter.groupId);
    const mode = app.session.viewMode;
    const preview = temporary[mode].get(project.id);
    if (preview) {
      const changed = preview.chapters.delete(chapter.id);
      return (group && preview.groups.delete(group.id)) || changed;
    }
    const field = collapsedField(mode);
    const changed = chapter[field] === true || group?.[field] === true;
    delete chapter[field];
    if (group) delete group[field];
    return changed;
  }

  function toggle(type,id) {
    const previous = app.diagram.sectionFor(type,id);
    if (!previous || !app.session.isStoryOverview()) return;
    const project = app.store.project();
    const grouping = collapsedSections(project);
    const ids = type === 'group' ? grouping.groups : grouping.chapters;
    if (!ids.delete(id)) ids.add(id);
    apply(project,grouping,false);
    const next = app.diagram.sectionFor(type,id);
    app.diagram.keepPosition(previous,next);
    app.diagram.sectionButton(type,id)?.focus({preventScroll:true});
  }

  function showOptions() {
    const project = app.store.project();
    const mode = app.session.viewMode;
    const previews = temporary[mode];
    const groups = project.chapterGroups ?? [];
    const grouping = collapsedSections(project);
    const allChapters = project.chapters.every(chapter => grouping.chapters.has(chapter.id));
    const allGroups = groups.length > 0 && groups.every(group => grouping.groups.has(group.id));
    const noGroups = groups.every(group => !grouping.groups.has(group.id));
    const noChapters = project.chapters.every(chapter => !grouping.chapters.has(chapter.id));
    const active = noGroups && noChapters ? 'expanded' : allChapters && allGroups ? 'group' :
      allChapters && noGroups ? 'chapter' : null;
    const choices = [
      ['group','folder','mapGroupAll',!groups.length],
      ['chapter','book','mapChapterAll',false],
      ['expanded','expand','mapExpandAll',false]
    ];
    app.dialogs.showDialog({title:t('mapGrouping'),body:'<div class="map-grouping-choices">' +
      choices.map(([value,symbol,label,disabled]) => '<button type="button" class="btn' + (active === value ? ' primary' : '') +
        '" data-map-preset="' + value + '" aria-pressed="' + (active === value) + '"' + (disabled ? ' disabled' : '') +
        '>' + icon(symbol) + ' ' + tx(label) + '</button>').join('') +
      '</div><label class="map-grouping-save"><input type="checkbox" id="saveMapGrouping" aria-describedby="mapGroupingHint"' +
      (previews.has(project.id) ? '' : ' checked') + '><span>' + tx('saveMapGrouping') + '</span></label>' +
      '<p class="hint" id="mapGroupingHint">' + tx('mapGroupingHint') + '</p>',extra:form => {
      form.querySelectorAll('[data-map-preset]').forEach(button => button.addEventListener('click',() => {
        const preset = button.dataset.mapPreset;
        app.dialogs.closeDialog();
        apply(app.store.project(),{
          groups:new Set(preset === 'group' ? groups.map(group => group.id) : []),
          chapters:new Set(preset === 'expanded' ? [] : project.chapters.map(chapter => chapter.id))
        },true);
        $('mapGrouping').focus({preventScroll:true});
      }));
      const checkbox = form.querySelector('#saveMapGrouping');
      checkbox.addEventListener('change',() => {
        const current = app.store.project();
        const next = collapsedSections(current);
        if (!checkbox.checked) {
          previews.set(current.id,next);
          return;
        }
        checkbox.checked = app.store.edit(() => saveCollapsedSections(current,next,mode),{
          saveError:'projectSaveFailed',afterSave:() => previews.delete(current.id)
        });
      });
    }});
    const form = $('dialogForm');
    (form.querySelector('[data-map-preset][aria-pressed="true"]') ?? form.querySelector('[data-map-preset]:not(:disabled)'))?.focus();
  }

  function bindEvents() {
    bindActions({mapGrouping:showOptions});
  }

  return {bindEvents,collapsedSections,expandChapter,toggle};
})(Enredo);
