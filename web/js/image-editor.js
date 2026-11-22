Enredo.imageEditor = ((app) => {
  'use strict';

  const { $, uid } = app.dom;
  const { t } = app.preferences;

  let nodeImagePick = null;
  let imageViewerUrl;

  function chooseNodeImage() {
    const node = app.store.selectedNode();
    if (!node) return;
    nodeImagePick = {project:app.store.project(),node};
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
          app.session.atHome || app.session.isStructureView() || $('dialog').open || viewer.open) return;
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

  async function loadNodeImage(file,pick) {
    if (!pick || nodeImagePick !== pick) return;
    const isCurrent = () => nodeImagePick === pick &&
      app.store.state.projects.includes(pick.project) && pick.project.nodes.includes(pick.node);
    let savedId, committed = false;
    try {
      if (file.size > app.imageStore.nodeImageFileLimit) {
        app.preferences.flash('imageTooLarge');
        return;
      }
      const image = await app.imageStore.prepareNodeImage(file);
      if (!isCurrent()) return;
      const id = uid();
      try {
        await app.imageStore.saveOriginalImages([[id,file]]);
        savedId = id;
      } catch {
        if (isCurrent()) app.preferences.flash('imageSaveFailed');
        return;
      }
      if (!isCurrent()) return;
      committed = app.store.edit(() => {
        Object.assign(pick.node,{image,originalImageId:id});
      },{saveError:'imageSaveFailed'});
      if (app.store.selectedNode()?.id === pick.node.id && app.store.project()?.id === pick.project.id) $('chooseNodeImage')?.focus({preventScroll:true});
    } catch {
      if (nodeImagePick === pick) app.preferences.flash('imageReadFailed');
    } finally {
      if (savedId && !committed) app.imageStore.discardOriginalImages([savedId]);
      if (nodeImagePick === pick) nodeImagePick = null;
    }
  }

  async function importAndroidImage() {
    const pick = nodeImagePick;
    try {
      const response = await fetch('/node-image',{cache:'no-store'});
      if (!response.ok) throw new Error('Could not read the selected image');
      await loadNodeImage(await response.blob(),pick);
    } catch {
      if (pick && nodeImagePick === pick) cancelAndroidImage('imageReadFailed');
    }
  }

  function cancelAndroidImage(message) {
    nodeImagePick = null;
    if (message) app.preferences.flash(message);
  }

  function removeNodeImage() {
    const node = app.store.selectedNode();
    if (!node?.image) return;
    if (nodeImagePick?.node === node) nodeImagePick = null;
    app.store.edit(() => {
      delete node.image;
      delete node.originalImageId;
    },{saveError:'imageSaveFailed'});
    $('chooseNodeImage')?.focus({preventScroll:true});
  }

  function bindEvents() {
    $('inspector').addEventListener('click',event => {
      const button = event.target.closest('button');
      if (button?.id === 'chooseNodeImage') chooseNodeImage();
      if (button?.id === 'viewNodeImage') viewNodeImage();
      if (button?.id === 'removeNodeImage') removeNodeImage();
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
      if (file) loadNodeImage(file,nodeImagePick);
    });
    $('nodeImageFile').addEventListener('cancel',() => { nodeImagePick = null; });
  }

  return {
    bindEvents,
    cancelAndroidImage,
    importAndroidImage
  };
})(Enredo);
