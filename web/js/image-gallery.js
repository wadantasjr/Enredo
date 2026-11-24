Enredo.imageGallery = ((app) => {
  'use strict';

  const { $, esc, icon, uid, bindActions } = app.dom;
  const { t, tx } = app.preferences;
  const collections = {character:'characters',group:'chapterGroups',beat:'nodes',task:'tasks'};
  let gallery = null;
  let busy = false;

  function launcher(type,owner) {
    return '<button type="button" class="btn" aria-haspopup="dialog" data-gallery-owner="' + type +
      '" data-gallery-id="' + esc(owner.id) + '">' + icon('image') + ' ' + tx('imageGallery') + '</button>';
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
    $('chooseGalleryImages').disabled = value;
    $('galleryClose').disabled = value;
    $('galleryImages').inert = value;
  }

  function imageName(image,index) {
    return image.name || t('galleryImageNumber',{number:index + 1});
  }

  function render() {
    const owner = currentOwner();
    if (!owner) {
      close();
      return;
    }
    const images = owner.galleryImages ?? [];
    $('galleryOwnerName').textContent = owner.name ?? (owner.title || t('untitled'));
    $('galleryEmpty').hidden = !!images.length;
    const list = $('galleryImages');
    list.hidden = !images.length;
    list.innerHTML = images.map((image,index) => {
      const name = imageName(image,index);
      return '<li><button type="button" class="btn gallery-preview" data-view-gallery-image="' + esc(image.assetId) +
        '" aria-label="' + tx('viewGalleryImage',{name}) + '">' + icon('expand') + '</button><span class="gallery-name">' +
        esc(name) + '</span><button type="button" class="icon-btn small" data-remove-gallery-image="' + esc(image.assetId) +
        '" aria-label="' + tx('removeGalleryImage',{name}) + '" title="' + tx('removeNodeImage') + '">' + icon('trash') + '</button>' +
        '<label class="field gallery-notes"><span>' + tx('galleryImageNotes') + '</span><textarea rows="2" data-gallery-notes="' +
        esc(image.assetId) + '" aria-label="' + tx('galleryImageNotesFor',{name}) + '"></textarea></label></li>';
    }).join('');
    list.querySelectorAll('[data-gallery-notes]').forEach((field,index) => { field.value = images[index].notes ?? ''; });
    list.querySelectorAll('[data-view-gallery-image]').forEach(button => {
      app.imageStore.thumbnailUrl(button.dataset.viewGalleryImage).then(url => {
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
    if (!ownerFor(project,type,id) || $('imageGallery').open) return;
    gallery = {type,id,projectId:project.id,button};
    setStatus();
    render();
    $('imageGallery').showModal();
    $('chooseGalleryImages').focus({preventScroll:true});
  }

  function close() {
    if (busy || !gallery) return;
    if (!saveNotes()) return;
    const {type,id,button} = gallery;
    gallery = null;
    $('imageGallery').close();
    $('galleryImages').replaceChildren();
    const visibleLauncher = button.isConnected ? button : [...document.querySelectorAll('[data-gallery-owner]')]
      .find(item => item.dataset.galleryOwner === type && item.dataset.galleryId === id && item.getClientRects().length);
    visibleLauncher?.focus({preventScroll:true});
  }

  function chooseImages() {
    if (busy || !currentOwner() || !saveNotes()) return;
    setStatus();
    if (app.platform.android?.chooseImages) {
      setBusy(true);
      app.platform.android.chooseImages();
    } else {
      $('galleryImageFiles').click();
    }
  }

  async function loadImages(files) {
    const owner = currentOwner();
    if (!owner) return;
    setBusy(true);
    setStatus('loadingGalleryImages');
    const images = new Map(), galleryImages = [];
    let failed = 0, tooLarge = 0;
    try {
      for await (const {file,name} of files) {
        if (file?.size > app.imageStore.nodeImageFileLimit) {
          tooLarge++;
          continue;
        }
        try {
          if (!file) throw new Error('Could not read gallery image');
          const prepared = await app.imageStore.prepareGalleryImage(file);
          const assetId = 'gallery-' + uid();
          images.set(assetId,prepared);
          galleryImages.push({assetId,name:(name ?? '').slice(0,160),notes:''});
        } catch {
          failed++;
        }
      }
      if (currentOwner() !== owner) return;
      if (galleryImages.length) {
        await app.imageStore.saveOriginalImages([],images);
        if (currentOwner() !== owner || !app.store.edit(() => {
          owner.galleryImages = [...(owner.galleryImages ?? []),...galleryImages];
        },{saveError:'imageSaveFailed'})) {
          app.imageStore.discardOriginalImages(images.keys());
          setStatus('imageSaveFailed');
          return;
        }
        render();
      }
      setStatus(failed ? 'galleryImagesFailed' : tooLarge ? 'galleryImagesTooLarge' : null,{count:failed + tooLarge});
    } catch {
      setStatus('imageSaveFailed');
    } finally {
      setBusy(false);
      $('chooseGalleryImages').focus({preventScroll:true});
    }
  }

  async function* androidFiles(count,readImages) {
    for (let index = 0; index < count; index++) {
      let file, name;
      try {
        const response = await fetch('/gallery-image',{cache:'no-store'});
        if (response.ok && readImages) {
          name = decodeURIComponent(response.headers.get('X-Enredo-Image-Name') ?? '');
          file = await response.blob();
        } else {
          await response.body?.cancel();
        }
      } catch {}
      yield {file,name};
    }
  }

  async function importAndroidImages(count) {
    if (currentOwner()) {
      await loadImages(androidFiles(count,true));
      return;
    }
    // The picker can return after Android has recreated the editor.
    for await (const result of androidFiles(count,false)) {}
    setBusy(false);
  }

  function cancelAndroidImages(message) {
    setBusy(false);
    setStatus(message);
    $('chooseGalleryImages').focus({preventScroll:true});
  }

  async function viewImage(assetId) {
    const activeGallery = gallery, images = currentOwner()?.galleryImages ?? [];
    const index = images.findIndex(image => image.assetId === assetId);
    if (index < 0 || busy) return;
    setStatus();
    try {
      const file = await app.imageStore.readOriginalImage(assetId);
      if (gallery === activeGallery && currentOwner()?.galleryImages?.includes(images[index])) {
        app.imageEditor.openImageViewer(file,imageName(images[index],index));
      }
    } catch {
      if (gallery === activeGallery) setStatus('imageViewFailed');
    }
  }

  function saveNotes() {
    const owner = currentOwner();
    const images = new Map((owner?.galleryImages ?? []).map(image => [image.assetId,image]));
    const changes = [];
    $('galleryImages').querySelectorAll('[data-gallery-notes]').forEach(field => {
      const image = images.get(field.dataset.galleryNotes);
      if (image && field.value !== (image.notes ?? '')) changes.push([image,field.value]);
    });
    if (!changes.length) return true;
    const saved = app.store.edit(() => {
      for (const [image,notes] of changes) image.notes = notes;
    },{saveError:'imageSaveFailed'});
    setStatus(saved ? null : 'imageSaveFailed');
    return saved;
  }

  function removeImage(assetId) {
    if (busy || !saveNotes()) return;
    const owner = currentOwner();
    if (!owner?.galleryImages?.some(image => image.assetId === assetId)) return;
    const saved = app.store.edit(() => {
      owner.galleryImages = owner.galleryImages.filter(image => image.assetId !== assetId);
      if (!owner.galleryImages.length) delete owner.galleryImages;
    },{saveError:'imageSaveFailed'});
    setStatus(saved ? null : 'imageSaveFailed');
    render();
    $('chooseGalleryImages').focus({preventScroll:true});
  }

  function bindEvents() {
    bindActions({galleryClose:close,chooseGalleryImages:chooseImages});
    document.addEventListener('click',event => {
      const button = event.target.closest('[data-gallery-owner]');
      if (button) open(button);
    });
    $('imageGallery').addEventListener('cancel',event => {
      event.preventDefault();
      close();
    });
    $('galleryImages').addEventListener('click',event => {
      const button = event.target.closest('button');
      if (button?.dataset.viewGalleryImage) viewImage(button.dataset.viewGalleryImage);
      if (button?.dataset.removeGalleryImage) removeImage(button.dataset.removeGalleryImage);
    });
    $('galleryImages').addEventListener('change',event => {
      if (event.target.matches('[data-gallery-notes]')) saveNotes();
    });
    $('galleryImageFiles').addEventListener('change',event => {
      const files = [...event.target.files].map(file => ({file,name:file.name}));
      event.target.value = '';
      if (files.length) loadImages(files);
    });
  }

  return {bindEvents,cancelAndroidImages,close,importAndroidImages,launcher};
})(Enredo);
