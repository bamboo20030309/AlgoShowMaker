// Disposable thumbnails, separate from durable draft decks and traces.
(() => {
  let opening;
  function open() {
    return opening ||= new Promise((resolve, reject) => {
      const request = indexedDB.open('asm-workspace-thumbnails-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Thumbnail cache unavailable'));
    });
  }
  window.ASMHomeThumbnailCache = {
    async load(owner, decks) {
      try {
        const db = await open(), rows = await new Promise((resolve, reject) => {
          const r = db.transaction('images').objectStore('images').getAll();
          r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
        });
        const valid = new Map(decks.filter(d => d.updated_at && d.has_thumbnail !== false).map(d => [d.deck_uid, String(d.updated_at)]));
        return new Map(rows.filter(r => r.owner === owner && valid.get(r.id) === r.revision).map(r => [r.id, r.thumbnail]));
      } catch { return new Map(); }
    },
    async put(owner, id, revision, thumbnail) {
      if (!owner || !revision || !/^data:image\/(?:jpeg|png|webp);base64,/.test(thumbnail || '') || thumbnail.length > 500000) return;
      try {
        const db = await open();
        await new Promise((resolve, reject) => {
          const tx = db.transaction('images', 'readwrite'), store = tx.objectStore('images');
          store.put({ key: JSON.stringify([owner, id]), owner, id, revision: String(revision || ''), thumbnail, time: Date.now() });
          const r = store.getAll();
          r.onsuccess = () => r.result.sort((a, b) => b.time - a.time).slice(64).forEach(row => store.delete(row.key));
          tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
        });
      } catch { /* Cache failure must not prevent loading the workspace. */ }
    }
  };
})();
