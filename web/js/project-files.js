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
      const documentIds = app.imageStore.galleryDocumentIds(snapshot);
      const backup = {format:'enredo',version:ids.size || documentIds.size ? 2 : 1,project:snapshot};
      if (ids.size) {
        backup.images = Object.create(null);
        for (const id of ids) backup.images[id] = await app.imageStore.originalImageDataUrl(await app.imageStore.readOriginalImage(id));
      }
      if (documentIds.size) {
        backup.documents = Object.create(null);
        for (const id of documentIds) backup.documents[id] = await app.imageStore.originalImageDataUrl(await app.imageStore.readOriginalImage(id));
      }
      const json = JSON.stringify(backup,null,2);
      if (app.platform.android) {
        app.platform.android.exportProject(filename,json);
        return;
      }
      app.platform.download(new Blob([json],{type:'application/json'}),filename);
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
      const files = new Map(), previews = new Map();
      const galleryOwners = app.imageStore.galleryOwners(p);
      if (data.version === 2) {
        const ids = new Map();
        const covers = [p,...(p.chapterGroups ?? []),...p.chapters].map(item => item.cover).filter(Boolean);
        const coverIds = new Set(covers.map(cover => cover.assetId));
        const galleryIds = app.imageStore.galleryImageIds(p);
        for (const key of app.imageStore.originalImageIds(p)) {
          if (!data.images || !Object.hasOwn(data.images,key)) throw new Error('Original image is missing from backup');
          const image = app.imageStore.imageFromBackup(data.images[key]);
          if (key === p.mapBackgroundId) {
            const id = uid();
            previews.set(id,await app.imageStore.prepareMapBackground(image));
            ids.set(key,id);
          } else if (coverIds.has(key)) {
            const id = 'cover-' + uid();
            previews.set(id,await app.imageStore.prepareCoverBackup(image));
            ids.set(key,id);
          } else if (galleryIds.has(key)) {
            const id = 'gallery-' + uid();
            previews.set(id,await app.imageStore.prepareGalleryImage(image));
            ids.set(key,id);
          } else {
            const id = uid();
            files.set(id,image);
            ids.set(key,id);
          }
        }
        for (const node of p.nodes) if (node.originalImageId) node.originalImageId = ids.get(node.originalImageId);
        if (p.mapBackgroundId) p.mapBackgroundId = ids.get(p.mapBackgroundId);
        for (const cover of covers) cover.assetId = ids.get(cover.assetId);
        const documentIds = new Map();
        for (const key of app.imageStore.galleryDocumentIds(p)) {
          if (!data.documents || !Object.hasOwn(data.documents,key)) throw new Error('Document is missing from backup');
          const id = 'document-' + uid();
          files.set(id,app.imageStore.documentFromBackup(data.documents[key]));
          documentIds.set(key,id);
        }
        for (const owner of galleryOwners) {
          for (const image of owner.galleryImages ?? []) image.assetId = ids.get(image.assetId);
          for (const document of owner.galleryDocuments ?? []) document.assetId = documentIds.get(document.assetId);
        }
      } else {
        for (const node of p.nodes) delete node.originalImageId;
        delete p.cover;
        delete p.mapBackgroundId;
        delete p.mapBackgroundSize;
        for (const group of p.chapterGroups ?? []) delete group.cover;
        for (const chapter of p.chapters) delete chapter.cover;
        for (const owner of galleryOwners) {
          delete owner.galleryImages;
          delete owner.galleryDocuments;
        }
      }
      if (files.size || previews.size) {
        try {
          await app.imageStore.saveOriginalImages(files,previews);
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
        if (files.size || previews.size) app.imageStore.discardOriginalImages([...files.keys(),...previews.keys()]);
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
