// Shared external-file drop handling; internal palette and slide drags stay untouched.
(() => {
  const supported = file => /\.(asmdeck|json)$/i.test(file?.name || '');
  async function validate(file) {
    if (!supported(file)) throw new Error('請拖入 .asmdeck 或投影片 JSON 檔案');
    const data = /\.asmdeck$/i.test(file.name)
      ? await window.ASMDeck.decode(file) : JSON.parse(await file.text());
    const deck = data?.deck || data;
    const groups = Array.isArray(deck?.groups) ? deck.groups : Array.isArray(deck?.slides) ? [{ slides: deck.slides }] : [];
    if (!groups.length || !groups.every(group => Array.isArray(group?.slides) && group.slides.length
      && group.slides.every(slide => slide && typeof slide === 'object' && !Array.isArray(slide)))) {
      throw new Error('檔案不是有效的投影片，或沒有投影片內容');
    }
    return deck;
  }
  function bind({ selector, allowed, onFile, onError }) {
    let busy = false;
    const external = event => Array.from(event.dataTransfer?.types || []).includes('Files');
    const target = event => event.target.closest?.(selector);
    const clear = () => document.querySelectorAll('.deck-file-drop-active').forEach(node => node.classList.remove('deck-file-drop-active'));
    document.addEventListener('dragover', event => {
      if (!external(event)) return;
      event.preventDefault();
      clear();
      const node = target(event);
      const accepts = node && !node.disabled && allowed() && !busy;
      event.dataTransfer.dropEffect = accepts ? 'copy' : 'none';
      if (accepts) node.classList.add('deck-file-drop-active');
    });
    document.addEventListener('dragleave', event => { if (!event.relatedTarget) clear(); });
    document.addEventListener('dragend', clear);
    document.addEventListener('drop', async event => {
      if (!external(event)) return;
      event.preventDefault();
      clear();
      const node = target(event);
      if (!node || node.disabled || !allowed() || busy) return;
      event.stopPropagation();
      const files = Array.from(event.dataTransfer.files || []);
      if (files.length !== 1) { onError(new Error('每次請拖入一份完整投影片檔案')); return; }
      busy = true;
      try { await validate(files[0]); await onFile(files[0]); }
      catch (error) { onError(error); }
      finally { busy = false; }
    }, true);
  }
  // Bridge the original File across workspace -> editor without localStorage size limits.
  async function pending(action, key, file) {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('asm-pending-deck-import-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('files', action === 'get' ? 'readonly' : 'readwrite');
        const store = tx.objectStore('files');
        const request = action === 'put' ? store.put({ file, createdAt: Date.now() }, key)
          : action === 'get' ? store.get(key) : store.delete(key);
        let result;
        request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => resolve(result?.file || null);
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('匯入檔案暫存失敗'));
      });
    } finally { db.close(); }
  }
  window.ASMDeckFileDrop = { bind, validate,
    put: (key, file) => pending('put', key, file),
    get: key => pending('get', key), remove: key => pending('delete', key) };
})();
