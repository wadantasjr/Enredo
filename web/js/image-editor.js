Enredo.imageEditor = ((app) => {
  'use strict';

  const { $, uid } = app.dom;
  const { t } = app.preferences;

  let imagePick = null;
  let imageViewerUrl;

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

  async function viewNodeImage() {
    const node = app.store.selectedNode(), viewer = $('imageViewer');
    if (!node?.image || viewer.open) return;
    const {image,originalImageId} = node;
    try {
      const file = originalImageId ? await app.imageStore.readOriginalImage(originalImageId) : null;
      if (node !== app.store.selectedNode() || image !== node.image || originalImageId !== node.originalImageId ||
          app.session.atHome || !app.session.hasMapView() || $('dialog').open || viewer.open) return;
      imageViewerUrl = file ? URL.createObjectURL(file) : null;
      $('imageViewerTitle').textContent = t(file ? 'viewOriginalImage' : 'viewSavedImage');
      $('imageViewerSize').textContent = '';
      $('imageViewerPhoto').src = imageViewerUrl ?? image;
      viewer.showModal();
      $('imageViewport').scrollTo(0,0);
    } catch {
      if (node === app.store.selectedNode()) app.preferences.flash('imageViewFailed');
    }
  }

  async function loadImage(file,pick) {
    if (!pick || imagePick !== pick) return;
    const isCurrent = () => imagePick === pick && app.store.state.projects.includes(pick.project) &&
      (pick.type === 'node' ? pick.project.nodes.includes(pick.node) : pick.project.characters.includes(pick.character) &&
        (!pick.phase || pick.character.phases.includes(pick.phase)));
    let savedId, committed = false;
    try {
      if (file.size > app.imageStore.nodeImageFileLimit) {
        app.preferences.flash('imageTooLarge');
        return;
      }
      const image = pick.type === 'node'
        ? await app.imageStore.prepareNodeImage(file)
        : await app.imageStore.prepareCharacterPortrait(file);
      if (!isCurrent()) return;
      if (pick.type === 'node') {
        const id = uid();
        try {
          await app.imageStore.saveOriginalImages([[id,file]]);
          savedId = id;
        } catch {
          if (isCurrent()) app.preferences.flash('imageSaveFailed');
          return;
        }
      }
      if (!isCurrent()) return;
      committed = app.store.edit(() => {
        if (pick.type === 'node') Object.assign(pick.node,{image,originalImageId:savedId});
        else app.characterData.setPortrait(pick.project,pick.character.id,image,pick.phase?.id ?? null);
      },{saveError:'imageSaveFailed'});
      if (pick.type === 'node' && app.store.selectedNode()?.id === pick.node.id && app.store.project()?.id === pick.project.id) {
        $('chooseNodeImage')?.focus({preventScroll:true});
      } else if (pick.type === 'character' && app.session.charactersOpen && app.store.project()?.id === pick.project.id) {
        $('choosePortrait')?.focus({preventScroll:true});
      }
    } catch {
      if (imagePick === pick) app.preferences.flash('imageReadFailed');
    } finally {
      if (savedId && !committed) app.imageStore.discardOriginalImages([savedId]);
      if (imagePick === pick) imagePick = null;
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
    $('nodeImageFile').addEventListener('change',event => {
      const file = event.target.files[0];
      event.target.value = '';
      if (file) loadImage(file,imagePick);
    });
    $('nodeImageFile').addEventListener('cancel',() => { imagePick = null; });
  }

  return {
    bindEvents,
    cancelAndroidImage,
    chooseCharacterPortrait,
    importAndroidImage
  };
})(Enredo);
