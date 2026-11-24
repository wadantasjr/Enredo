Enredo.imageEditor = ((app) => {
  'use strict';

  const { $, uid, bindActions, icon } = app.dom;
  const { t, tx } = app.preferences;

  let imagePick = null;
  let imageViewerUrl;
  let coverCrop = null;

  function chooseNodeImage() {
    const node = app.store.selectedNode();
    if (!node) return;
    imagePick = {type:'node',project:app.store.project(),node};
    chooseImageFile();
  }

  function chooseCharacterPortrait(characterId,phaseId = null) {
    const project = app.store.project();
    const character = project?.characters.find(item => item.id === characterId);
    const phase = phaseId == null ? null : character?.phases.find(item => item.id === phaseId);
    if (!character || (phaseId != null && !phase)) return;
    imagePick = {type:'character',project,character,phase};
    chooseImageFile();
  }

  function chooseImageFile() {
    if (app.platform.android) app.platform.android.chooseImage();
    else $('nodeImageFile').click();
  }

  function showMapBackgroundOptions() {
    const project = app.store.project();
    const hasImage = !!project.mapBackgroundId;
    const button = $('mapBackgroundButton');
    app.dialogs.showDialog({title:t('mapBackground'),body:'<div class="map-background-actions">' +
      '<button type="button" class="btn primary" id="chooseMapBackground">' + icon('upload') + ' ' +
      tx(hasImage ? 'replaceNodeImage' : 'chooseMapBackground') + '</button>' +
      (hasImage ? '<button type="button" class="btn" id="removeMapBackground">' + icon('trash') + ' ' + tx('removeNodeImage') + '</button>' : '') +
      '</div>',extra:form => {
      form.querySelector('#chooseMapBackground').onclick = () => {
        app.dialogs.closeDialog();
        button.focus({preventScroll:true});
        imagePick = {type:'background',project};
        chooseImageFile();
      };
      if (hasImage) form.querySelector('#removeMapBackground').onclick = () => {
        app.dialogs.closeDialog();
        if (imagePick?.type === 'background' && imagePick.project === project) imagePick = null;
        app.store.edit(() => {
          delete project.mapBackgroundId;
          delete project.mapBackgroundSize;
        },{saveError:'imageSaveFailed'});
        button.focus({preventScroll:true});
      };
    }});
    $('chooseMapBackground').focus();
  }

  function renderMapBackground(id,size) {
    const image = $('mapBackgroundImage');
    const assetId = id ?? '';
    const onMap = assetId && size;
    const layer = $(onMap ? 'world' : 'graph');
    if (image.parentElement !== layer) layer.prepend(image);
    image.style.width = onMap ? size.width + 'px' : '';
    image.style.height = onMap ? size.height + 'px' : '';
    $('mapBackgroundButton').classList.toggle('on',!!assetId);
    if (image.dataset.assetId === assetId) return;
    image.dataset.assetId = assetId;
    image.hidden = true;
    image.removeAttribute('src');
    if (!assetId) return;
    app.imageStore.thumbnailUrl(assetId).then(url => {
      if (image.dataset.assetId !== assetId) return;
      image.src = url;
      image.hidden = false;
    }).catch(() => {
      if (image.dataset.assetId === assetId) delete image.dataset.assetId;
    });
  }

  function coverMarkup(cover,className = '') {
    const assetId = cover?.assetId;
    const focusX = Math.round((cover?.focusX ?? 0.5) * 100);
    const focusY = Math.round((cover?.focusY ?? 0.5) * 100);
    return '<span class="cover-frame ' + className + '">' +
      (assetId ? '<img class="cover-image" data-cover-id="' + app.dom.esc(assetId) + '" data-focus-x="' + focusX +
        '" data-focus-y="' + focusY + '" alt="" hidden>' : '') +
      '<span class="cover-fallback" aria-hidden="true">' + app.dom.icon('book') + '</span></span>';
  }

  function coverControls(type,id,cover) {
    const encodedId = app.dom.esc(id);
    const labelKey = type === 'project' ? 'projectCover' : type === 'group' ? 'groupCover' : 'chapterCover';
    const label = app.preferences.tx(labelKey);
    return '<div class="cover-editor" data-cover-owner="' + type + '" data-cover-id="' + encodedId + '"><span class="field-label">' + label + '</span>' +
      coverMarkup(cover,'cover-editor-preview') + '<div class="cover-editor-actions">' +
      '<button type="button" class="btn" data-cover-action="choose" data-cover-type="' + type +
      '" data-cover-id="' + encodedId + '">' + app.preferences.tx(cover ? 'replaceCover' : 'chooseCover') + '</button>' +
      '<button type="button" class="btn danger" data-cover-action="remove" data-cover-type="' + type +
      '" data-cover-id="' + encodedId + '"' + (cover ? '' : ' hidden') + '>' + app.preferences.tx('removeCover') + '</button>' +
      '</div></div>';
  }

  function renderCoverPreviews(root = document) {
    root.querySelectorAll('img[data-cover-id]').forEach(image => {
      const id = image.dataset.coverId;
      image.style.objectPosition = (image.dataset.focusX || '50') + '% ' + (image.dataset.focusY || '50') + '%';
      app.imageStore.thumbnailUrl(id).then(url => {
        if (!image.isConnected || image.dataset.coverId !== id) return;
        image.addEventListener('error',() => {
          if (image.dataset.coverId !== id) return;
          image.hidden = true;
          image.parentElement?.classList.remove('has-cover');
        },{once:true});
        image.src = url;
        image.hidden = false;
        image.parentElement?.classList.add('has-cover');
      }).catch(() => {});
    });
  }

  function refreshCoverControls(root = document) {
    root.querySelectorAll('.cover-editor[data-cover-owner]').forEach(editor => {
      const type = editor.dataset.coverOwner, id = editor.dataset.coverId, p = app.store.project();
      const cover = coverTarget(p,type,id)?.cover;
      editor.outerHTML = coverControls(type,id,cover);
    });
    renderCoverPreviews(root);
  }

  function coverTarget(project,type,id) {
    if (type === 'project') return project;
    if (type === 'group') return project?.chapterGroups?.find(group => group.id === id);
    if (type === 'chapter') return project?.chapters?.find(chapter => chapter.id === id);
    return null;
  }

  function chooseCoverImage(type,id) {
    const project = app.store.project();
    const target = coverTarget(project,type,id);
    if (!project || !target) return;
    imagePick = {type:'cover',coverType:type,project,target,id};
    if (app.platform.android) app.platform.android.chooseImage();
    else $('coverImageFile').click();
  }

  function pickIsCurrent(pick) {
    if (pick.type === 'background') return imagePick === pick && pick.project === app.store.project();
    return imagePick === pick && app.store.state.projects.includes(pick.project) &&
      (pick.type === 'node' ? pick.project.nodes.includes(pick.node) : pick.type === 'character'
        ? pick.project.characters.includes(pick.character) && (!pick.phase || pick.character.phases.includes(pick.phase))
        : pick.coverType === 'project' ? pick.target === pick.project
          : pick.coverType === 'group' ? pick.project.chapterGroups?.includes(pick.target)
            : pick.project.chapters.includes(pick.target));
  }

  function setCoverCropFocus(focusX,focusY) {
    if (!coverCrop) return;
    coverCrop.focusX = Math.max(0,Math.min(1,focusX));
    coverCrop.focusY = Math.max(0,Math.min(1,focusY));
    const image = $('coverCropImage');
    image.style.objectPosition = (coverCrop.focusX * 100) + '% ' + (coverCrop.focusY * 100) + '%';
    $('coverFocusX').value = String(Math.round(coverCrop.focusX * 100));
    $('coverFocusY').value = String(Math.round(coverCrop.focusY * 100));
  }

  function closeCoverCrop() {
    const crop = coverCrop;
    coverCrop = null;
    $('coverCropImage').removeAttribute('src');
    if (crop?.url) URL.revokeObjectURL(crop.url);
    if (crop && imagePick === crop.pick) imagePick = null;
  }

  function cancelCoverCrop() {
    const dialog = $('coverCropDialog');
    if (dialog.open) dialog.close();
    else closeCoverCrop();
  }

  async function saveCoverCrop() {
    const crop = coverCrop;
    if (!crop || !pickIsCurrent(crop.pick)) {
      cancelCoverCrop();
      return;
    }
    const saveButton = $('saveCoverCrop');
    saveButton.disabled = true;
    try {
      const assetId = await app.imageStore.saveCoverImage(crop.prepared.source,crop.prepared.thumbnail);
      if (coverCrop !== crop || !pickIsCurrent(crop.pick)) {
        cancelCoverCrop();
        return;
      }
      const committed = app.store.edit(() => {
        crop.pick.target.cover = {assetId,focusX:crop.focusX,focusY:crop.focusY};
      },{saveError:'imageSaveFailed'});
      if (committed) app.imageEditor.refreshCoverControls(document);
      const pick = crop.pick;
      cancelCoverCrop();
      if (committed) Array.from(document.querySelectorAll('[data-cover-action="choose"]'))
        .find(button => button.dataset.coverType === pick.coverType && button.dataset.coverId === pick.id)
        ?.focus({preventScroll:true});
    } catch {
      if (coverCrop === crop) app.preferences.flash('imageSaveFailed');
    } finally {
      saveButton.disabled = false;
    }
  }

  function openCoverCrop(pick,prepared) {
    const existing = pick.target.cover;
    const url = URL.createObjectURL(prepared.source);
    coverCrop = {pick,prepared,url,focusX:existing?.focusX ?? 0.5,focusY:existing?.focusY ?? 0.5};
    const image = $('coverCropImage');
    image.src = url;
    setCoverCropFocus(coverCrop.focusX,coverCrop.focusY);
    try {
      $('coverCropDialog').showModal();
    } catch (error) {
      closeCoverCrop();
      throw error;
    }
    $('coverCropClose').focus({preventScroll:true});
  }

  function removeCover(type,id) {
    const project = app.store.project();
    const target = coverTarget(project,type,id);
    if (!project || !target || !target.cover) return;
    if (imagePick?.type === 'cover' && imagePick.target === target) imagePick = null;
    app.store.edit(() => { delete target.cover; },{saveError:'imageSaveFailed'});
    refreshCoverControls(document);
  }

  function openImageViewer(file,title,preview) {
    const viewer = $('imageViewer');
    if (viewer.open) return;
    if (imageViewerUrl) URL.revokeObjectURL(imageViewerUrl);
    imageViewerUrl = file ? URL.createObjectURL(file) : null;
    $('imageViewerTitle').textContent = title;
    $('imageViewerSize').textContent = '';
    $('imageViewerPhoto').src = imageViewerUrl ?? preview;
    viewer.showModal();
    $('imageViewport').scrollTo(0,0);
  }

  async function viewNodeImage() {
    const node = app.store.selectedNode(), viewer = $('imageViewer');
    if (!node?.image || viewer.open) return;
    const {image,originalImageId} = node;
    try {
      const file = originalImageId ? await app.imageStore.readOriginalImage(originalImageId) : null;
      if (node !== app.store.selectedNode() || image !== node.image || originalImageId !== node.originalImageId ||
          app.session.atHome || !app.session.hasMapView() || $('dialog').open || viewer.open) return;
      openImageViewer(file,t(file ? 'viewOriginalImage' : 'viewSavedImage'),image);
    } catch {
      if (node === app.store.selectedNode()) app.preferences.flash('imageViewFailed');
    }
  }

  async function loadImage(file,pick) {
    if (!pick || imagePick !== pick) return;
    let savedId, committed = false, waitingForCrop = false;
    try {
      if (file.size > app.imageStore.nodeImageFileLimit) {
        app.preferences.flash('imageTooLarge');
        return;
      }
      if (pick.type === 'cover') {
        const prepared = await app.imageStore.prepareCoverImage(file);
        if (!pickIsCurrent(pick)) return;
        openCoverCrop(pick,prepared);
        waitingForCrop = true;
        return;
      }
      const background = pick.type === 'background' ? await app.imageStore.prepareMapBackground(file) : null;
      const image = background ? null : pick.type === 'node'
        ? await app.imageStore.prepareNodeImage(file)
        : await app.imageStore.prepareCharacterPortrait(file);
      if (!pickIsCurrent(pick)) return;
      if (pick.type === 'node' || background) {
        const id = uid();
        try {
          if (background) await app.imageStore.saveOriginalImages([],[[id,background]]);
          else await app.imageStore.saveOriginalImages([[id,file]]);
          savedId = id;
        } catch {
          if (pickIsCurrent(pick)) app.preferences.flash('imageSaveFailed');
          return;
        }
      }
      if (!pickIsCurrent(pick)) return;
      committed = app.store.edit(() => {
        if (pick.type === 'node') Object.assign(pick.node,{image,originalImageId:savedId});
        else if (background) {
          pick.project.mapBackgroundId = savedId;
          delete pick.project.mapBackgroundSize;
        }
        else app.characterData.setPortrait(pick.project,pick.character.id,image,pick.phase?.id ?? null);
      },{saveError:'imageSaveFailed'});
      if (pick.type === 'node' && app.store.selectedNode()?.id === pick.node.id && app.store.project()?.id === pick.project.id) {
        $('chooseNodeImage')?.focus({preventScroll:true});
      } else if (pick.type === 'character' && app.session.charactersOpen && app.store.project()?.id === pick.project.id) {
        $('choosePortrait')?.focus({preventScroll:true});
      }
    } catch {
      if (imagePick === pick) app.preferences.flash(pick.type === 'cover' ? 'coverImageInvalid' : 'imageReadFailed');
    } finally {
      if (savedId && !committed && pick.type !== 'cover') app.imageStore.discardOriginalImages([savedId]);
      if (!waitingForCrop && imagePick === pick) imagePick = null;
    }
  }

  async function importAndroidImage() {
    const pick = imagePick;
    try {
      const response = await fetch('/node-image',{cache:'no-store'});
      if (!response.ok) throw new Error('Could not read the selected image');
      await loadImage(await response.blob(),pick);
    } catch {
      if (pick && imagePick === pick) cancelAndroidImage('imageReadFailed');
    }
  }

  function cancelAndroidImage(message) {
    imagePick = null;
    if (message) app.preferences.flash(message);
  }

  function removeNodeImage() {
    const node = app.store.selectedNode();
    if (!node?.image) return;
    if (imagePick?.node === node) imagePick = null;
    app.store.edit(() => {
      delete node.image;
      delete node.originalImageId;
    },{saveError:'imageSaveFailed'});
    $('chooseNodeImage')?.focus({preventScroll:true});
  }

  function removeCharacterPortrait(characterId,phaseId = null) {
    const p = app.store.project(), character = p?.characters.find(item => item.id === characterId);
    const phase = phaseId == null ? null : character?.phases.find(item => item.id === phaseId);
    const owner = phase ?? character;
    if (!owner?.portraitId || (phaseId != null && !phase)) return;
    if (imagePick?.type === 'character' && imagePick.character === character && imagePick.phase === phase) imagePick = null;
    app.store.edit(() => app.characterData.setPortrait(p,character.id,null,phase?.id ?? null),{saveError:'imageSaveFailed'});
    $('choosePortrait')?.focus({preventScroll:true});
  }

  function bindEvents() {
    bindActions({mapBackgroundButton:showMapBackgroundOptions});
    $('inspector').addEventListener('click',event => {
      const button = event.target.closest('button');
      if (button?.id === 'chooseNodeImage') chooseNodeImage();
      if (button?.id === 'viewNodeImage') viewNodeImage();
      if (button?.id === 'removeNodeImage') removeNodeImage();
    });
    $('charactersView').addEventListener('click',event => {
      const button = event.target.closest('button');
      if (button?.id === 'choosePortrait') chooseCharacterPortrait(button.dataset.characterId,button.dataset.phaseId || null);
      if (button?.id === 'removePortrait') removeCharacterPortrait(button.dataset.characterId,button.dataset.phaseId || null);
    });
    $('imageViewerClose').addEventListener('click',() => $('imageViewer').close());
    $('imageViewer').addEventListener('close',() => {
      if ($('imageViewer').open) return;
      if (imageViewerUrl) URL.revokeObjectURL(imageViewerUrl);
      imageViewerUrl = null;
      $('imageViewerPhoto').removeAttribute('src');
    });
    $('imageViewerPhoto').addEventListener('load',event => {
      const {naturalWidth,naturalHeight} = event.target;
      $('imageViewerSize').textContent = naturalWidth + ' × ' + naturalHeight + ' px';
    });
    $('imageViewerPhoto').addEventListener('error',() => {
      if (!$('imageViewer').open) return;
      $('imageViewer').close();
      app.preferences.flash('imageViewFailed');
    });
    $('coverCropClose').addEventListener('click',cancelCoverCrop);
    $('coverCropCancel').addEventListener('click',cancelCoverCrop);
    $('saveCoverCrop').addEventListener('click',saveCoverCrop);
    $('coverCropDialog').addEventListener('close',closeCoverCrop);
    $('coverFocusX').addEventListener('input',event => {
      if (coverCrop) setCoverCropFocus(Number(event.target.value) / 100,coverCrop.focusY);
    });
    $('coverFocusY').addEventListener('input',event => {
      if (coverCrop) setCoverCropFocus(coverCrop.focusX,Number(event.target.value) / 100);
    });
    $('coverCropViewport').addEventListener('pointerdown',event => {
      if (!coverCrop || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      coverCrop.dragPoint = {x:event.clientX,y:event.clientY};
    });
    $('coverCropViewport').addEventListener('pointermove',event => {
      if (!coverCrop?.dragPoint || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const image = $('coverCropImage'), box = event.currentTarget.getBoundingClientRect();
      if (!image.naturalWidth || !image.naturalHeight) return;
      const scale = Math.max(box.width / image.naturalWidth,box.height / image.naturalHeight);
      const overflowX = image.naturalWidth * scale - box.width;
      const overflowY = image.naturalHeight * scale - box.height;
      const dx = event.clientX - coverCrop.dragPoint.x, dy = event.clientY - coverCrop.dragPoint.y;
      setCoverCropFocus(overflowX ? coverCrop.focusX - dx / overflowX : coverCrop.focusX,
        overflowY ? coverCrop.focusY - dy / overflowY : coverCrop.focusY);
      coverCrop.dragPoint = {x:event.clientX,y:event.clientY};
    });
    $('coverCropViewport').addEventListener('pointerup',event => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (coverCrop) coverCrop.dragPoint = null;
    });
    $('coverCropViewport').addEventListener('pointercancel',() => { if (coverCrop) coverCrop.dragPoint = null; });
    $('nodeImageFile').addEventListener('change',event => {
      const file = event.target.files[0];
      event.target.value = '';
      if (file) loadImage(file,imagePick);
    });
    $('nodeImageFile').addEventListener('cancel',() => { imagePick = null; });
    $('coverImageFile').addEventListener('change',event => {
      const file = event.target.files[0];
      event.target.value = '';
      if (file) loadImage(file,imagePick);
    });
    $('coverImageFile').addEventListener('cancel',() => { imagePick = null; });
    $('dialogForm').addEventListener('click',event => {
      const button = event.target.closest('[data-cover-action]');
      if (!button) return;
      if (button.dataset.coverAction === 'choose') chooseCoverImage(button.dataset.coverType,button.dataset.coverId);
      if (button.dataset.coverAction === 'remove') removeCover(button.dataset.coverType,button.dataset.coverId);
    });
    $('editorView').addEventListener('click',event => {
      const button = event.target.closest('[data-cover-action]');
      if (!button) return;
      if (button.dataset.coverAction === 'choose') chooseCoverImage(button.dataset.coverType,button.dataset.coverId);
      if (button.dataset.coverAction === 'remove') removeCover(button.dataset.coverType,button.dataset.coverId);
    });
  }

  return {
    bindEvents,
    cancelAndroidImage,
    chooseCoverImage,
    chooseCharacterPortrait,
    coverControls,
    coverMarkup,
    cancelCoverCrop,
    importAndroidImage,
    openImageViewer,
    renderCoverPreviews,
    renderMapBackground,
    refreshCoverControls
  };
})(Enredo);
