Enredo.imageStore = (() => {
  'use strict';

  const nodeImageMaxLength = 36 * 1024;
  const nodeImageFileLimit = 20 * 1024 * 1024;
  const coverImageLimit = 3 * 1024 * 1024;
  const coverThumbnailLimit = 12 * 1024;
  const originalImageType = /^(?:image\/[a-z0-9!#$&^_.+-]+|application\/octet-stream)$/i;
  const coverImageTypes = new Set(['image/jpeg','image/png','image/webp']);
  const previewUrls = new Map();

  const validNodeImage = value => typeof value === 'string' && value.length <= nodeImageMaxLength &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);

  const validOriginalImageId = value => typeof value === 'string' && /^[a-z0-9-]{1,80}$/i.test(value);

  function originalImageIds(project) {
    const ids = new Set((project.nodes ?? []).map(node => node.originalImageId).filter(Boolean));
    if (project.cover?.assetId) ids.add(project.cover.assetId);
    for (const group of project.chapterGroups ?? []) if (group.cover?.assetId) ids.add(group.cover.assetId);
    for (const chapter of project.chapters ?? []) if (chapter.cover?.assetId) ids.add(chapter.cover.assetId);
    return ids;
  }

  function imageIdsInState(state) {
    const ids = new Set();
    for (const project of state?.projects ?? []) for (const id of originalImageIds(project)) ids.add(id);
    return ids;
  }

  function imageIdsInSnapshot(snapshot) {
    const state = JSON.parse(typeof snapshot === 'string' ? snapshot : snapshot.json);
    return imageIdsInState(state);
  }

  let imageDatabase;

  function openImageDatabase() {
    if (!imageDatabase) {
      imageDatabase = new Promise((resolve,reject) => {
        const request = indexedDB.open('enredo-original-images',1);
        request.onupgradeneeded = () => request.result.createObjectStore('images');
        request.onsuccess = () => {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
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

  async function readCoverThumbnail(id) {
    const image = await imageTransaction('readonly',store => store.get('thumb-' + id));
    if (!(image instanceof Blob)) throw new Error('Cover thumbnail is missing');
    return image;
  }

  async function coverPreviewUrl(id) {
    if (previewUrls.has(id)) return previewUrls.get(id);
    const url = URL.createObjectURL(await readCoverThumbnail(id));
    previewUrls.set(id,url);
    return url;
  }

  function saveOriginalImages(files,covers = []) {
    return imageTransaction('readwrite',store => {
      let request;
      for (const [id,file] of files) {
        const original = originalImageType.test(file.type)
          ? file : file.slice(0,file.size,'application/octet-stream');
        request = store.add(original,id);
      }
      for (const [id,{source,thumbnail}] of covers) {
        store.add(source,id);
        request = store.add(thumbnail,'thumb-' + id);
      }
      return request;
    });
  }

  async function digestId(file) {
    if (globalThis.crypto?.subtle) {
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));
      return 'cover-' + [...bytes].map(value => value.toString(16).padStart(2,'0')).join('');
    }
    return 'cover-' + Enredo.dom.uid();
  }

  async function saveCoverImage(source,thumbnail) {
    const id = await digestId(source);
    await imageTransaction('readwrite',store => {
      store.put(source,id);
      return store.put(thumbnail,'thumb-' + id);
    });
    return id;
  }

  function discardOriginalImages(ids) {
    imageTransaction('readwrite',store => {
      let request;
      for (const id of ids) {
        store.delete(id);
        if (id.startsWith('cover-')) request = store.delete('thumb-' + id);
      }
      return request;
    }).catch(() => {});
    for (const id of ids) {
      const url = previewUrls.get(id);
      if (url) URL.revokeObjectURL(url);
      previewUrls.delete(id);
    }
  }

  function pruneUnusedImages(referencedIds) {
    imageTransaction('readwrite',store => {
      const request = store.getAllKeys();
      request.onsuccess = () => {
        const keep = referencedIds();
        for (const key of request.result) {
          const imageId = typeof key === 'string' && key.startsWith('thumb-') ? key.slice(6) : key;
          if (!keep.has(imageId)) {
            store.delete(key);
            const url = previewUrls.get(imageId);
            if (url) URL.revokeObjectURL(url);
            previewUrls.delete(imageId);
          }
        }
      };
      return request;
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

  function canvasBlob(canvas,type,quality) {
    return new Promise((resolve,reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode image')),type,quality);
    });
  }

  function detectedCoverType(file) {
    return file.slice(0,12).arrayBuffer().then(buffer => {
      const bytes = new Uint8Array(buffer);
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
      if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp';
      return null;
    });
  }

  async function coverDimensions(file,type) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if (type === 'image/png' && bytes.length >= 24) {
      return {width:view.getUint32(16,false),height:view.getUint32(20,false)};
    }
    if (type === 'image/webp' && bytes.length >= 30) {
      const chunk = String.fromCharCode(...bytes.slice(12,16));
      if (chunk === 'VP8X') {
        return {width:1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65536,
          height:1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65536};
      }
      if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
        return {width:(bytes[26] | bytes[27] << 8) & 0x3fff,height:(bytes[28] | bytes[29] << 8) & 0x3fff};
      }
      if (chunk === 'VP8L' && bytes[20] === 0x2f) {
        return {width:1 + ((bytes[22] & 0x3f) << 8) + bytes[21],
          height:1 + ((bytes[24] & 0x0f) << 10) + (bytes[23] << 2) + ((bytes[22] & 0xc0) >> 6)};
      }
    }
    if (type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) {
      const frameMarkers = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
      let offset = 2;
      while (offset + 4 < bytes.length) {
        if (bytes[offset] !== 0xff) { offset += 1; continue; }
        while (bytes[offset] === 0xff) offset += 1;
        const marker = bytes[offset++];
        if (marker === 0xda || marker === 0xd9) break;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
        if (offset + 1 >= bytes.length) break;
        const segmentLength = view.getUint16(offset,false);
        if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
        if (frameMarkers.has(marker) && segmentLength >= 7) {
          return {height:view.getUint16(offset + 3,false),width:view.getUint16(offset + 5,false)};
        }
        offset += segmentLength;
      }
    }
    return null;
  }

  async function decodeCoverBitmap(file,type,dimensions) {
    dimensions ??= await coverDimensions(file,type);
    if (!dimensions?.width || !dimensions?.height || dimensions.width * dimensions.height > 40000000 ||
        Math.max(dimensions.width,dimensions.height) > 12000) throw new Error('Cover image dimensions are too large');
    const resize = dimensions.width >= dimensions.height ? {resizeWidth:2048} : {resizeHeight:2048};
    let bitmap;
    try {
      bitmap = await createImageBitmap(file,{...resize,resizeQuality:'high'});
    } catch {
      bitmap = await createImageBitmap(file);
    }
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000 ||
        Math.max(bitmap.width,bitmap.height) > 12000) {
      bitmap.close();
      throw new Error('Cover image dimensions are too large');
    }
    return bitmap;
  }

  async function encodeCoverBitmap(bitmap,maxBytes,thumbnail = false) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const sizes = thumbnail ? [320,256,192] : [2048,1792,1536,1280,1024];
    const qualities = thumbnail ? [0.62,0.54,0.46] : [0.84,0.78,0.7];
    for (const size of sizes) {
      const scale = Math.min(1,size / Math.max(bitmap.width,bitmap.height));
      canvas.width = Math.max(1,Math.round(bitmap.width * scale));
      canvas.height = Math.max(1,Math.round(bitmap.height * scale));
      context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      for (const quality of qualities) {
        let blob = await canvasBlob(canvas,'image/webp',quality);
        if (blob.type !== 'image/webp') {
          context.clearRect(0,0,canvas.width,canvas.height);
          context.fillStyle = '#f7f6fb';
          context.fillRect(0,0,canvas.width,canvas.height);
          context.drawImage(bitmap,0,0,canvas.width,canvas.height);
          blob = await canvasBlob(canvas,'image/jpeg',quality);
        }
        if (blob.size <= maxBytes) return blob;
      }
    }
    throw new Error('Encoded cover is too large');
  }

  async function prepareCoverImage(file) {
    if (!(file instanceof Blob) || !file.size || file.size > nodeImageFileLimit) throw new Error('Invalid image size');
    const detectedType = await detectedCoverType(file);
    const suppliedType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (!detectedType || !coverImageTypes.has(detectedType) || (suppliedType && suppliedType !== 'application/octet-stream' && suppliedType !== detectedType)) {
      throw new Error('Unsupported cover image');
    }
    const dimensions = await coverDimensions(file,detectedType);
    const bitmap = await decodeCoverBitmap(file,detectedType,dimensions);
    try {
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000 ||
          Math.max(bitmap.width,bitmap.height) > 12000) throw new Error('Cover image dimensions are too large');
      const source = await encodeCoverBitmap(bitmap,coverImageLimit);
      const thumbnail = await encodeCoverBitmap(bitmap,coverThumbnailLimit,true);
      return {source,thumbnail};
    } finally {
      bitmap.close();
    }
  }

  async function prepareCoverBackup(file) {
    const detectedType = await detectedCoverType(file);
    const suppliedType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (!detectedType || !coverImageTypes.has(detectedType) ||
        (suppliedType && suppliedType !== 'application/octet-stream' && suppliedType !== detectedType)) {
      throw new Error('Unsupported cover image');
    }
    const dimensions = await coverDimensions(file,detectedType);
    const bitmap = await decodeCoverBitmap(file,detectedType,dimensions);
    try {
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000 ||
          Math.max(bitmap.width,bitmap.height) > 12000) throw new Error('Cover image dimensions are too large');
      const source = detectedType === 'image/webp' && file.size <= coverImageLimit &&
        Math.max(dimensions.width,dimensions.height) <= 2048
        ? file : await encodeCoverBitmap(bitmap,coverImageLimit);
      const thumbnail = await encodeCoverBitmap(bitmap,coverThumbnailLimit,true);
      return {source,thumbnail};
    } finally {
      bitmap.close();
    }
  }

  async function saveCoverFromBackup(file) {
    const prepared = await prepareCoverBackup(file);
    return saveCoverImage(prepared.source,prepared.thumbnail);
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

  async function prepareCharacterPortrait(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const side = Math.min(bitmap.width,bitmap.height);
      const cropX = Math.round((bitmap.width - side) / 2);
      const cropY = Math.round((bitmap.height - side) / 2);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      for (const [size,quality] of [[256,.82],[192,.76],[144,.7],[112,.64]]) {
        canvas.width = size;
        canvas.height = size;
        context.drawImage(bitmap,cropX,cropY,side,side,0,0,size,size);
        const data = canvas.toDataURL('image/jpeg',quality);
        if (Enredo.characterData.validPortrait(data)) return data;
      }
      throw new Error('Could not encode a compact portrait');
    } finally {
      bitmap.close();
    }
  }

  return {
    coverPreviewUrl,
    discardOriginalImages,
    imageFromBackup,
    imageIdsInSnapshot,
    imageIdsInState,
    nodeImageFileLimit,
    originalImageDataUrl,
    originalImageIds,
    prepareCoverImage,
    prepareNodeImage,
    prepareCharacterPortrait,
    pruneUnusedImages,
    readOriginalImage,
    saveCoverImage,
    saveCoverFromBackup,
    saveOriginalImages,
    validNodeImage,
    validOriginalImageId
  };
})();
