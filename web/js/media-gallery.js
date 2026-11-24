Enredo.mediaGallery = ((app) => {
  'use strict';

  const { $, esc, icon, uid, bindActions } = app.dom;
  const { t, tx } = app.preferences;
  const collections = {chapter:'chapters',character:'characters',group:'chapterGroups',beat:'nodes',task:'tasks'};
  const imagesOnly = type => type === 'character' || type === 'task';
  let gallery = null;
  let busy = false;

  function launcher(type,owner) {
    const imageOnly = imagesOnly(type);
    return '<button type="button" class="btn" aria-haspopup="dialog" data-gallery-owner="' + type +
      '" data-gallery-id="' + esc(owner.id) + '">' + icon(imageOnly ? 'image' : 'folder') + ' ' +
      tx(imageOnly ? 'imageGallery' : 'mediaGallery') + '</button>';
  }

  function ownerFor(project,type,id) {
    if (type === 'project') return project?.id === id ? project : null;
    return project?.[collections[type]]?.find(item => item.id === id);
  }

  function currentOwner() {
    const project = app.store.project();
    return gallery && project?.id === gallery.projectId ? ownerFor(project,gallery.type,gallery.id) : null;
  }

  function setStatus(key,values) {
    const status = $('galleryStatus');
    status.hidden = !key;
    status.textContent = key ? t(key,values) : '';
  }

  function setBusy(value) {
    busy = value;
    $('chooseGalleryFiles').disabled = value;
    $('galleryClose').disabled = value;
    $('galleryItems').inert = value;
  }

  function attachments(owner) {
    return ['galleryImages','galleryDocuments'].flatMap(field =>
      (owner?.[field] ?? []).map((item,index) => ({field,item,index})));
  }

  function attachmentName({field,item,index}) {
    return item.name?.trim() || t(field === 'galleryImages' ? 'galleryImageNumber' : 'galleryDocumentNumber',{number:index + 1});
  }

  function render() {
    const owner = currentOwner();
    if (!owner) {
      close();
      return;
    }
    const items = attachments(owner);
    $('galleryOwnerName').textContent = owner.name ?? (owner.title || t('untitled'));
    $('galleryEmpty').hidden = !!items.length;
    const list = $('galleryItems');
    list.hidden = !items.length;
    list.innerHTML = items.map((attachment,index) => {
      const name = attachmentName(attachment);
      const image = attachment.field === 'galleryImages';
      const preview = image
        ? '<button type="button" class="btn gallery-preview" data-open-attachment="' + index + '" aria-label="' +
          tx('viewGalleryImage',{name}) + '">' + icon('expand') + '</button>' : '';
      const downloadLabel = tx('downloadGalleryItemFor',{name});
      const download = '<button type="button" class="icon-btn small" data-download-attachment="' + index +
        '" aria-label="' + downloadLabel + '" title="' + downloadLabel + '">' + icon('download') + '</button>';
      const removeLabel = tx('removeGalleryItem',{name});
      return '<li>' + preview + '<span class="gallery-name">' + esc(name) + '</span><div class="gallery-item-actions">' +
        download + '<button type="button" class="icon-btn small" data-remove-attachment="' + index + '" aria-label="' +
        removeLabel + '" title="' + removeLabel + '">' + icon('trash') + '</button></div>' +
        '<label class="field gallery-notes"><span>' + tx('galleryItemNotes') + '</span><textarea rows="2" data-gallery-notes="' +
        index + '" aria-label="' + tx('galleryItemNotesFor',{name}) + '"></textarea></label></li>';
    }).join('');
    list.querySelectorAll('[data-gallery-notes]').forEach((field,index) => { field.value = items[index].item.notes ?? ''; });
    list.querySelectorAll('.gallery-preview').forEach(button => {
      const {item} = items[button.dataset.openAttachment];
      app.imageStore.thumbnailUrl(item.assetId).then(url => {
        if (!button.isConnected) return;
        const image = document.createElement('img');
        image.alt = '';
        image.onload = () => button.replaceChildren(image);
        image.src = url;
      }).catch(() => {});
    });
  }

  function open(button) {
    const project = app.store.project();
    const {galleryOwner:type,galleryId:id} = button.dataset;
    if (!ownerFor(project,type,id) || $('mediaGallery').open) return;
    const imageOnly = imagesOnly(type);
    gallery = {type,id,projectId:project.id,button,imageOnly};
    $('mediaGalleryTitle').textContent = t(imageOnly ? 'imageGallery' : 'mediaGallery');
    $('galleryHint').textContent = t(imageOnly ? 'imageGalleryHint' : 'mediaGalleryHint');
    $('galleryChooseLabel').textContent = t(imageOnly ? 'addGalleryImages' : 'addGalleryFiles');
    $('galleryEmpty').textContent = t(imageOnly ? 'noGalleryImages' : 'noGalleryFiles');
    $('galleryFiles').accept = imageOnly ? 'image/*' : '';
    setStatus();
    render();
    $('mediaGallery').showModal();
    $('chooseGalleryFiles').focus({preventScroll:true});
  }

  function close() {
    if (busy || !gallery || !saveNotes()) return;
    const {type,id,button} = gallery;
    gallery = null;
    $('mediaGallery').close();
    $('galleryItems').replaceChildren();
    const visibleLauncher = button.isConnected ? button : [...document.querySelectorAll('[data-gallery-owner]')]
      .find(item => item.dataset.galleryOwner === type && item.dataset.galleryId === id && item.getClientRects().length);
    visibleLauncher?.focus({preventScroll:true});
  }

  function chooseFiles() {
    if (busy || !currentOwner() || !saveNotes()) return;
    setStatus();
    if (app.platform.android) {
      setBusy(true);
      app.platform.android.chooseGalleryFiles(!gallery.imageOnly);
    } else {
      $('galleryFiles').click();
    }
  }

  async function prepareImage(file,imageOnly) {
    if (imageOnly || file.type.startsWith('image/')) return app.imageStore.prepareGalleryImage(file);
    if (!file.type || file.type === 'application/octet-stream') {
      return app.imageStore.prepareGalleryImage(file).catch(() => null);
    }
    return null;
  }

  async function loadFiles(files) {
    const owner = currentOwner();
    if (!owner) return;
    const {imageOnly} = gallery;
    setBusy(true);
    setStatus(imageOnly ? 'loadingGalleryImages' : 'loadingGalleryFiles');
    const images = new Map(), documents = new Map();
    const galleryImages = [], galleryDocuments = [];
    let failed = 0, tooLarge = 0;
    const saveError = imageOnly ? 'imageSaveFailed' : 'gallerySaveFailed';
    try {
      for await (const {file,name,oversized} of files) {
        if (oversized || file?.size > app.imageStore.nodeImageFileLimit) {
          tooLarge++;
          continue;
        }
        try {
          if (!file?.size) throw new Error('Could not read gallery attachment');
          const prepared = await prepareImage(file,imageOnly);
          const assetId = (prepared ? 'gallery-' : 'document-') + uid();
          const item = {assetId,name:(name ?? '').slice(0,160),notes:''};
          if (prepared) {
            images.set(assetId,prepared);
            galleryImages.push(item);
          } else {
            documents.set(assetId,file.slice(0,file.size,'application/octet-stream'));
            galleryDocuments.push(item);
          }
        } catch {
          failed++;
        }
      }
      if (currentOwner() !== owner) return;
      if (images.size || documents.size) {
        await app.imageStore.saveOriginalImages(documents,images);
        if (currentOwner() !== owner || !app.store.edit(() => {
          if (galleryImages.length) owner.galleryImages = [...(owner.galleryImages ?? []),...galleryImages];
          if (galleryDocuments.length) owner.galleryDocuments = [...(owner.galleryDocuments ?? []),...galleryDocuments];
        },{saveError})) {
          app.imageStore.discardOriginalImages([...images.keys(),...documents.keys()]);
          setStatus(saveError);
          return;
        }
        render();
      }
      if (failed) setStatus(imageOnly ? 'galleryImagesFailed' : 'galleryFilesFailed',{count:failed + tooLarge});
      else if (tooLarge) setStatus(imageOnly ? 'galleryImagesTooLarge' : 'galleryFilesTooLarge',{count:tooLarge});
      else setStatus();
    } catch {
      setStatus(saveError);
    } finally {
      setBusy(false);
      $('chooseGalleryFiles').focus({preventScroll:true});
    }
  }

  async function readAndroidFile(response) {
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const {done,value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > app.imageStore.nodeImageFileLimit) {
          await reader.cancel();
          return {oversized:true};
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return {file:new Blob(chunks,{type:response.headers.get('Content-Type') ?? ''})};
  }

  async function* androidFiles(count,readFiles) {
    for (let index = 0; index < count; index++) {
      let result = {};
      try {
        const response = await fetch('/gallery-file',{cache:'no-store'});
        if (response.ok && readFiles) {
          const name = decodeURIComponent(response.headers.get('X-Enredo-File-Name') ?? '');
          result = {name,...await readAndroidFile(response)};
        } else {
          await response.body?.cancel();
        }
      } catch {}
      yield result;
    }
  }

  async function importAndroidFiles(count) {
    if (currentOwner()) {
      await loadFiles(androidFiles(count,true));
      return;
    }
    // The picker can return after Android has recreated the editor.
    for await (const result of androidFiles(count,false)) {}
    setBusy(false);
  }

  function cancelAndroidFiles(failed) {
    setBusy(false);
    setStatus(failed ? (gallery?.imageOnly ? 'imageReadFailed' : 'galleryReadFailed') : null);
    $('chooseGalleryFiles').focus({preventScroll:true});
  }

  function reportAndroidDownload(saved) {
    const message = saved ? 'galleryFileSaved' : 'galleryDownloadFailed';
    if (gallery) setStatus(message);
    else app.preferences.flash(message);
  }

  async function useAttachment(attachment,download) {
    if (!attachment || busy) return;
    const activeGallery = gallery;
    const {item,field} = attachment;
    const name = attachmentName(attachment);
    setStatus();
    try {
      const file = await app.imageStore.readOriginalImage(item.assetId);
      if (gallery !== activeGallery || !currentOwner()?.[field]?.includes(item)) return;
      if (!download) {
        app.imageEditor.openImageViewer(file,name);
        return;
      }
      const filename = item.name?.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').trim();
      const imageType = /^image\/([a-z0-9]+)$/.exec(file.type)?.[1];
      const downloadName = filename || (imageType ? name + '.' + imageType : name);
      if (app.platform.android) {
        const data = await app.imageStore.originalImageDataUrl(file);
        if (gallery === activeGallery && currentOwner()?.[field]?.includes(item)) {
          app.platform.android.saveGalleryFile(downloadName,data.slice(data.indexOf(',') + 1));
        }
      } else {
        app.platform.download(file,downloadName);
      }
    } catch {
      if (gallery === activeGallery) setStatus(download ? 'galleryDownloadFailed' : 'imageViewFailed');
    }
  }

  function saveNotes() {
    const items = attachments(currentOwner());
    const changes = [];
    $('galleryItems').querySelectorAll('[data-gallery-notes]').forEach(field => {
      const item = items[field.dataset.galleryNotes]?.item;
      if (item && field.value !== (item.notes ?? '')) changes.push([item,field.value]);
    });
    if (!changes.length) return true;
    const saveError = gallery.imageOnly ? 'imageSaveFailed' : 'gallerySaveFailed';
    const saved = app.store.edit(() => {
      for (const [item,notes] of changes) item.notes = notes;
    },{saveError});
    setStatus(saved ? null : saveError);
    return saved;
  }

  function removeAttachment(attachment) {
    if (busy || !attachment || !saveNotes()) return;
    const owner = currentOwner();
    const {field,item} = attachment;
    const saveError = gallery.imageOnly ? 'imageSaveFailed' : 'gallerySaveFailed';
    const saved = app.store.edit(() => {
      owner[field] = owner[field].filter(entry => entry !== item);
      if (!owner[field].length) delete owner[field];
    },{saveError});
    setStatus(saved ? null : saveError);
    render();
    $('chooseGalleryFiles').focus({preventScroll:true});
  }

  function bindEvents() {
    bindActions({galleryClose:close,chooseGalleryFiles:chooseFiles});
    document.addEventListener('click',event => {
      const button = event.target.closest('[data-gallery-owner]');
      if (button) open(button);
    });
    $('mediaGallery').addEventListener('cancel',event => {
      event.preventDefault();
      close();
    });
    $('galleryItems').addEventListener('click',event => {
      const button = event.target.closest('button');
      if (button?.hasAttribute('data-open-attachment')) {
        useAttachment(attachments(currentOwner())[button.dataset.openAttachment],false);
      }
      if (button?.hasAttribute('data-download-attachment')) {
        useAttachment(attachments(currentOwner())[button.dataset.downloadAttachment],true);
      }
      if (button?.hasAttribute('data-remove-attachment')) {
        removeAttachment(attachments(currentOwner())[button.dataset.removeAttachment]);
      }
    });
    $('galleryItems').addEventListener('change',event => {
      if (event.target.matches('[data-gallery-notes]')) saveNotes();
    });
    $('galleryFiles').addEventListener('change',event => {
      const files = [...event.target.files].map(file => ({file,name:file.name}));
      event.target.value = '';
      if (files.length && !busy) loadFiles(files);
    });
  }

  return {bindEvents,cancelAndroidFiles,close,importAndroidFiles,launcher,reportAndroidDownload};
})(Enredo);
