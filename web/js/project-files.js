Enredo.projectFiles = ((app) => {
  'use strict';

  const { t } = app.preferences;
  const { $, uid, bindActions } = app.dom;

  let exportingProject = false;

  async function exportProject() {
    const p = app.store.project();
    if (!p || exportingProject) return;
    const snapshot = JSON.parse(JSON.stringify(p));
    const name = p.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').trim().slice(0,90) || t('backupName');
    const filename = name + '.enredo.json';
    exportingProject = true;
    try {
      const ids = app.imageStore.originalImageIds(snapshot);
      const backup = {format:'enredo',version:ids.size ? 2 : 1,project:snapshot};
      if (ids.size) {
        backup.images = Object.create(null);
        for (const id of ids) backup.images[id] = await app.imageStore.originalImageDataUrl(await app.imageStore.readOriginalImage(id));
      }
      const json = JSON.stringify(backup,null,2);
      if (app.platform.android) {
        app.platform.android.exportProject(filename,json);
        return;
      }
      const file = new Blob([json],{type:'application/json'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = filename;
      document.body.append(link);
      link.click();
      setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); },1000);
      app.preferences.flash('exported');
    } catch {
      app.preferences.flash('exportFailed');
    } finally {
      exportingProject = false;
    }
  }

  function chooseProjectFile() {
    if (app.platform.android) app.platform.android.chooseImport();
    else $('importFile').click();
  }

  async function importAndroidProject() {
    try {
      const response = await fetch('/project-import.json',{cache:'no-store'});
      if (!response.ok) throw new Error('Could not read the selected file');
      await importProject(response);
    } catch {
      app.preferences.flash('importFailed');
    }
  }

  async function importProject(file) {
    try {
      const data = JSON.parse(await file.text());
      if (data?.format !== 'enredo' || ![1,2].includes(data.version) || !app.storyData.validProject(data.project)) {
        throw new Error('Invalid Enredo project format');
      }
      const p = app.storyData.normalizeProject({...data.project,id:uid()});
      const files = new Map();
      if (data.version === 2) {
        const ids = new Map();
        const coverIds = new Set([p.cover?.assetId,...(p.chapterGroups ?? []).map(group => group.cover?.assetId),
          ...p.chapters.map(chapter => chapter.cover?.assetId)].filter(Boolean));
        for (const key of app.imageStore.originalImageIds(data.project)) {
          if (!data.images || !Object.hasOwn(data.images,key)) throw new Error('Original image is missing from backup');
          const image = app.imageStore.imageFromBackup(data.images[key]);
          if (coverIds.has(key)) {
            ids.set(key,await app.imageStore.saveCoverFromBackup(image));
            continue;
          }
          if (!ids.has(key)) {
            const id = uid();
            files.set(id,image);
            ids.set(key,id);
          }
        }
        for (const node of p.nodes) if (node.originalImageId) {
          const mapped = ids.get(node.originalImageId);
          if (!mapped) throw new Error('Original image is missing from backup');
          node.originalImageId = mapped;
        }
        if (p.cover?.assetId) p.cover.assetId = ids.get(p.cover.assetId);
        for (const group of p.chapterGroups ?? []) if (group.cover?.assetId) group.cover.assetId = ids.get(group.cover.assetId);
        for (const chapter of p.chapters) if (chapter.cover?.assetId) chapter.cover.assetId = ids.get(chapter.cover.assetId);
      } else {
        for (const node of p.nodes) delete node.originalImageId;
        delete p.cover;
        for (const group of p.chapterGroups ?? []) delete group.cover;
        for (const chapter of p.chapters) delete chapter.cover;
      }
      if (files.size) {
        try {
          await app.imageStore.saveOriginalImages(files);
        } catch {
          app.preferences.flash('projectSaveFailed');
          return;
        }
      }
      if (app.store.state.projects.some(item => item.title === p.title)) p.title += t('importSuffix');
      if (!app.store.edit(() => {
        app.store.state.projects.push(p);
        app.store.state.active = p.id;
        app.store.state.chapter = p.chapters[0]?.id ?? null;
      },{fit:true,saveError:'projectSaveFailed',afterSave:() => app.workspace.enterProject(p)})) {
        if (files.size) app.imageStore.discardOriginalImages(files.keys());
        return;
      }
      $('chapterTitle').focus();
      app.preferences.flash('imported');
    } catch {
      app.preferences.flash('invalidImport');
    }
  }

  function bindEvents() {
    bindActions({emptyImport:chooseProjectFile,importProject:chooseProjectFile,exportProject});
    $('importFile').addEventListener('change',event => {
      const file = event.target.files[0];
      event.target.value = '';
      if (file) importProject(file);
    });
  }

  return {
    bindEvents,
    importAndroidProject
  };
})(Enredo);
