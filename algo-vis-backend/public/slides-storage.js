(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMSlideStorage = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function isQuotaExceeded(error) {
    if (!error) return false;
    return error.name === 'QuotaExceededError'
      || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || Number(error.code) === 22
      || Number(error.code) === 1014;
  }

  function hasStoredValue(storage, key) {
    if (!storage || !key) return false;
    return storage.getItem(key) !== null;
  }

  function removeLegacyValue(storage, storageKey, legacyKey) {
    if (!legacyKey || legacyKey === storageKey || !hasStoredValue(storage, legacyKey)) return false;
    storage.removeItem(legacyKey);
    return true;
  }

  function save(storage, {
    storageKey,
    legacyKey,
    serializedDeck
  } = {}) {
    const result = {
      saved: false,
      recoveredFromQuota: false,
      removedLegacy: false,
      error: null
    };
    if (!storage || !storageKey || typeof serializedDeck !== 'string') {
      result.error = new TypeError('Invalid slide storage request');
      return result;
    }

    try {
      storage.setItem(storageKey, serializedDeck);
      result.saved = true;
    } catch (error) {
      result.error = error;
      if (!isQuotaExceeded(error)) return result;
      try {
        result.removedLegacy = removeLegacyValue(storage, storageKey, legacyKey);
        if (!result.removedLegacy) return result;
        storage.setItem(storageKey, serializedDeck);
        result.saved = true;
        result.recoveredFromQuota = true;
        result.error = null;
      } catch (retryError) {
        result.error = retryError;
        return result;
      }
    }

    if (result.saved && !result.removedLegacy) {
      try {
        result.removedLegacy = removeLegacyValue(storage, storageKey, legacyKey);
      } catch (cleanupError) {
        // The current deck is already safe. Legacy cleanup can be retried on the next save.
      }
    }
    return result;
  }

  // Drafts are durable user data, separate from the disposable trace cache DB.
  async function digest(value) {
    if (!globalThis.crypto?.subtle && typeof module !== 'object') {
      return globalThis.ASMDeck.sha256(value);
    }
    const bytes = new TextEncoder().encode(value);
    const crypto = globalThis.crypto || require('node:crypto').webcrypto;
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }

  async function project(source) {
    const deck = JSON.parse(JSON.stringify(source));
    const references = [], traces = {};
    for (const [groupIndex, group] of (deck.groups || []).entries()) {
      for (const [slideIndex, slide] of (group.slides || []).entries()) {
        const trace = slide.animation?.traceDocument;
        if (!trace) {
          if (slide.animation?.traceRef) throw new Error('請先載入完整動畫結果再儲存');
          continue;
        }
        const view = {};
        for (const field of ['studio', 'skins', 'rules']) {
          if (Object.hasOwn(trace, field)) { view[field] = trace[field]; delete trace[field]; }
        }
        const key = await digest(canonical(trace));
        traces[key] = trace;
        references.push({ groupIndex, slideIndex, key, view });
        delete slide.animation.traceDocument;
        slide.animation.traceRef = key;
      }
    }
    return { deck, references, traces };
  }

  function hydrate(record, traces = record.traces || {}) {
    const deck = JSON.parse(JSON.stringify(record.deck));
    for (const ref of record.references || []) {
      if (!Object.hasOwn(traces, ref.key)) throw new Error('缺少已儲存的動畫結果');
      const animation = deck.groups[ref.groupIndex]?.slides[ref.slideIndex]?.animation;
      if (!animation || animation.traceRef !== ref.key) throw new Error('動畫參照不一致');
      animation.traceDocument = JSON.parse(JSON.stringify({ ...traces[ref.key], ...ref.view }));
      delete animation.traceRef;
    }
    return deck;
  }

  // Validate incoming results before committing anything; only this deck's results
  // can satisfy references (a hash is not an authorization token).
  async function merge(record, previous = {}) {
    const traces = Object.create(null);
    for (const ref of record.references || []) {
      if (!/^[a-f0-9]{64}$/.test(ref.key)) throw new Error('動畫參照格式無效');
      const trace = Object.hasOwn(record.traces || {}, ref.key) ? record.traces[ref.key]
        : (previous.traces || {})[ref.key];
      if (!trace || await digest(canonical(trace)) !== ref.key) throw new Error('動畫结果缺少或雜湊不符');
      traces[ref.key] = trace;
    }
    const complete = { deck: record.deck, references: record.references || [], traces };
    // Also catches a traceRef without a corresponding reference.
    const restored = hydrate(complete);
    for (const group of restored.groups || []) for (const slide of group.slides || []) {
      if (slide.animation?.traceRef) throw new Error('動畫參照缺少還原資訊');
    }
    return complete;
  }

  function create(indexedDB, storage, databaseName = 'algoshowmaker-drafts-v1') {
    let database;
    let queue = Promise.resolve();
    function open() {
      if (!database) database = new Promise((resolve, reject) => {
        if (!indexedDB) return reject(new Error('此瀏覽器無法使用 IndexedDB'));
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('decks');
          request.result.createObjectStore('traces');
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('本機資料庫被其他頁面阻擋，請關閉舊頁面後重試'));
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); database = null; };
          resolve(db);
        };
      }).catch(error => { database = null; throw error; });
      return database;
    }
    async function write(storageKey, serializedDeck) {
      const { deck, references, traces: results } = await project(JSON.parse(serializedDeck));
      const db = await open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['decks', 'traces'], 'readwrite');
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || new Error('本機儲存交易已取消'));
        tx.onerror = () => {};
        const decks = tx.objectStore('decks'), traces = tx.objectStore('traces');
        const allDecks = decks.getAll(), allKeys = decks.getAllKeys();
        allKeys.onsuccess = () => {
          const retained = new Set(references.map(ref => ref.key));
          for (let index = 0; index < allDecks.result.length; index++) {
            if (allKeys.result[index] === storageKey) continue;
            for (const ref of allDecks.result[index].references || []) retained.add(ref.key);
          }
          const cursor = traces.openKeyCursor();
          cursor.onsuccess = () => {
            if (!cursor.result) return;
            if (!retained.has(cursor.result.key)) traces.delete(cursor.result.key);
            cursor.result.continue();
          }
          for (const [key, trace] of Object.entries(results)) {
            const existing = traces.getKey(key);
            existing.onsuccess = () => { if (existing.result === undefined) traces.put(trace, key); };
          }
          decks.put({ deck, references }, storageKey);
        };
      });
      return true;
    }
    function saveDeck(storageKey, serializedDeck) {
      // Serialize writes in request order; failures must not poison later saves.
      const result = queue.then(() => write(storageKey, serializedDeck));
      queue = result.catch(() => {});
      return result;
    }
    async function loadDeck(storageKey, legacyKeys = []) {
      await queue;
      const db = await open();
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(['decks', 'traces'], 'readonly');
        let value;
        tx.oncomplete = () => resolve(value);
        tx.onabort = () => reject(tx.error || new Error('本機草稿載入失敗'));
        const request = tx.objectStore('decks').get(storageKey);
        request.onsuccess = () => {
          value = request.result;
          if (!value) return;
          for (const ref of value.references || []) {
            const traceRequest = tx.objectStore('traces').get(ref.key);
            traceRequest.onsuccess = () => {
              if (!traceRequest.result) { tx.abort(); return; }
              const slide = value.deck.groups[ref.groupIndex].slides[ref.slideIndex];
              slide.animation.traceDocument = Object.assign(traceRequest.result, ref.view);
              delete slide.animation.traceRef;
            };
          }
        };
      });
      if (record) return record.deck;
      for (const key of legacyKeys) {
        const saved = storage?.getItem(key);
        if (!saved) continue;
        const legacyDeck = JSON.parse(saved);
        await saveDeck(storageKey, saved);
        // Only remove old drafts after the IndexedDB transaction commits.
        for (const oldKey of legacyKeys) {
          try { storage.removeItem(oldKey); } catch (_) { /* safe to retry later */ }
        }
        return legacyDeck;
      }
      return null;
    }
    return { saveDeck, loadDeck };
  }

  return { isQuotaExceeded, save, create, project, hydrate, merge, digest, canonical };
});
