// -----------------------------------------------------------------------------
// 投影片草稿儲存層
// 以 IndexedDB 為主、localStorage 為退路保存大型 deck；公開 API 隱藏版本遷移與儲存後端差異。
// -----------------------------------------------------------------------------
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMSlideStorage = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  // -----------------------------------------------------------------------------
  // localStorage 相容層
  // 同步儲存只作退路；寫入失敗時保留舊值並回報 quota 狀態，不讓清理流程誤刪草稿。
  // -----------------------------------------------------------------------------
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
      serializedDeck = JSON.stringify(recipe.deck(JSON.parse(serializedDeck)));
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
  // -----------------------------------------------------------------------------
  // 內容定址投影
  // 重型 trace 以 canonical JSON 雜湊拆出，deck 記錄只保存參照，重複內容共用同一份資料。
  // -----------------------------------------------------------------------------
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

  const recipe = typeof require === 'function' ? require('./animation-recipe') : globalThis.ASMAnimationRecipe;
  async function project(source) { return {deck:recipe.deck(source),references:[],traces:{}}; }
  function hydrate(record) {
    const source=JSON.parse(JSON.stringify(record.deck));
    for(const ref of record.references||[]){const animation=source.groups?.[ref.groupIndex]?.slides?.[ref.slideIndex]?.animation;if(animation)animation.traceView=ref.view||animation.traceView;}
    return recipe.deck(source);
  }
  async function merge(record) { return {deck:hydrate(record),references:[],traces:{}}; }

  // -----------------------------------------------------------------------------
  // IndexedDB 儲存實作
  // 每個 storage key 保存 deck 記錄與 trace 表；公開 save/load 自動選擇 IndexedDB 或同步退路。
  // -----------------------------------------------------------------------------
  function create(indexedDB, storage, databaseName = 'algoshowmaker-drafts-v1') {
    let database,queue=Promise.resolve();const runtime=new Map();
    function open(){
      if(!database)database=new Promise((resolve,reject)=>{
        if(!indexedDB)return reject(new Error('IndexedDB unavailable'));
        const request=indexedDB.open(databaseName,2);
        request.onupgradeneeded=()=>{
          const db=request.result,tx=request.transaction;
          if(!db.objectStoreNames.contains('decks'))db.createObjectStore('decks');
          if(!db.objectStoreNames.contains('traces'))db.createObjectStore('traces');
          tx.objectStore('traces').clear();
          const cursor=tx.objectStore('decks').openCursor();cursor.onsuccess=()=>{const item=cursor.result;if(!item)return;item.update({deck:hydrate(item.value),references:[]});item.continue();};
        };
        request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('請關閉舊版投影片分頁後重新整理，才能更新本機草稿資料庫'));
        request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();database=null;};resolve(db);};
      }).catch(error=>{database=null;throw error;});return database;
    }
    async function write(storageKey,serializedDeck){const source=JSON.parse(serializedDeck),record=await project(source),db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction(['decks','traces'],'readwrite');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.objectStore('traces').clear();tx.objectStore('decks').put({deck:record.deck,references:[]},storageKey);});return true;}
    function saveDeck(key,value){const result=queue.then(()=>write(key,value));queue=result.catch(()=>{});return result;}
    async function loadDeck(key,legacyKeys=[]){await queue;const db=await open();const record=await new Promise((resolve,reject)=>{const request=db.transaction('decks').objectStore('decks').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});if(record)return hydrate(record);for(const oldKey of legacyKeys){const value=storage?.getItem(oldKey);if(!value)continue;await saveDeck(key,value);for(const legacy of legacyKeys)storage.removeItem(legacy);return recipe.deck(JSON.parse(value));}return null;}
    async function putTrace(key,trace){if(!/^[a-f0-9]{64}$/.test(key)||await digest(canonical(trace))!==key)throw new Error('Trace hash mismatch');runtime.set(key,trace);}
    async function loadTrace(key){return runtime.get(key)||null;}
    function deleteDeck(key) {
      const result=queue.then(async()=>{
        const db=await open();
        await new Promise((resolve,reject)=>{
          const tx=db.transaction('decks','readwrite');
          tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
          tx.objectStore('decks').delete(key);
        });
        storage?.removeItem?.(key);
      });
      queue=result.catch(()=>{});return result;
    }
    return {saveDeck,loadDeck,putTrace,loadTrace,deleteDeck,clearRuntime:()=>runtime.clear()};
  }

  return { isQuotaExceeded, save, create, project, hydrate, merge, digest, canonical };
});
