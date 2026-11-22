Enredo.imageStore = (() => {
  'use strict';

  const nodeImageMaxLength = 36 * 1024;
  const nodeImageFileLimit = 20 * 1024 * 1024;
  const originalImageType = /^(?:image\/[a-z0-9!#$&^_.+-]+|application\/octet-stream)$/i;

  const validNodeImage = value => typeof value === 'string' && value.length <= nodeImageMaxLength &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);

  const validOriginalImageId = value => typeof value === 'string' && /^[a-z0-9-]{1,80}$/i.test(value);

  const originalImageIds = project => new Set(project.nodes.map(node => node.originalImageId).filter(Boolean));

  let imageDatabase;

  function openImageDatabase() {
    if (!imageDatabase) {
      imageDatabase = new Promise((resolve,reject) => {
        const request = indexedDB.open('enredo-original-images',1);
        request.onupgradeneeded = () => request.result.createObjectStore('images');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).catch(error => {
        imageDatabase = null;
        throw error;
      });
    }
    return imageDatabase;
  }

  async function imageTransaction(mode,operation) {
    const database = await openImageDatabase();
    return new Promise((resolve,reject) => {
      const transaction = database.transaction('images',mode);
      transaction.onabort = () => reject(transaction.error);
      try {
        const request = operation(transaction.objectStore('images'));
        transaction.oncomplete = () => resolve(request?.result);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  }

  async function readOriginalImage(id) {
    const file = await imageTransaction('readonly',store => store.get(id));
    if (!(file instanceof Blob)) throw new Error('Original image is missing');
    return file;
  }

  function saveOriginalImages(files) {
    return imageTransaction('readwrite',store => {
      for (const [id,file] of files) {
        const original = originalImageType.test(file.type)
          ? file : file.slice(0,file.size,'application/octet-stream');
        store.add(original,id);
      }
    });
  }

  function discardOriginalImages(ids) {
    imageTransaction('readwrite',store => {
      for (const id of ids) store.delete(id);
    }).catch(() => {});
  }

  function originalImageDataUrl(file) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function imageFromBackup(data) {
    if (typeof data !== 'string' || data.length > 4 * Math.ceil(nodeImageFileLimit / 3) + 256) {
      throw new Error('Invalid image in backup');
    }
    const separator = data.indexOf(',');
    const header = /^data:([^;,]+);base64$/.exec(data.slice(0,separator));
    if (separator < 0 || !header || !originalImageType.test(header[1])) throw new Error('Invalid image type');
    const binary = atob(data.slice(separator + 1));
    if (!binary.length || binary.length > nodeImageFileLimit) throw new Error('Invalid image size');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes],{type:header[1]});
  }

  async function prepareNodeImage(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      for (const [size,quality] of [[512,.8],[320,.72],[192,.65],[112,.6]]) {
        const scale = Math.min(1,size / Math.max(bitmap.width,bitmap.height));
        canvas.width = Math.max(1,Math.round(bitmap.width * scale));
        canvas.height = Math.max(1,Math.round(bitmap.height * scale));
        context.drawImage(bitmap,0,0,canvas.width,canvas.height);
        const data = canvas.toDataURL('image/webp',quality);
        if (validNodeImage(data)) return data;
      }
      throw new Error('Could not encode a compact image');
    } finally {
      bitmap.close();
    }
  }

  return {
    discardOriginalImages,
    imageFromBackup,
    nodeImageFileLimit,
    originalImageDataUrl,
    originalImageIds,
    prepareNodeImage,
    readOriginalImage,
    saveOriginalImages,
    validNodeImage,
    validOriginalImageId
  };
})();
