/**
 * 預建 Trace 輕量封裝：驗證獨立 .asmtrace，並將完整預設動畫保存於 IndexedDB。
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMTraceBundle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const FORMAT = 'AlgoShowMaker.default-animation';
  const PACKAGE_VERSION = 1;
  const MAGIC = 'ASMTRACE1\n';
  const CACHE_DB = 'asm-default-animation-cache';
  const CACHE_STORE = 'bundles';
  const decoder = new TextDecoder('utf-8', { fatal: true });

  function currentEngineVersion() {
    const provenance = root.ASMTraceProvenance;
    return `${provenance?.ENGINE_VERSION}/${provenance?.FORMAT_VERSION}`;
  }

  async function ungzip(bytes) {
    if (!root.DecompressionStream) throw new Error('此瀏覽器不支援預建動畫解壓縮。');
    const stream = new Blob([bytes]).stream().pipeThrough(new root.DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function validate(payload, descriptor, manifest, expectedKind) {
    const trace = payload?.animation?.traceDocument;
    const expectedFrames = expectedKind === 'preview' ? 1 : manifest.totalFrames;
    if (payload?.format !== FORMAT || payload.packageVersion !== PACKAGE_VERSION
      || payload.engineVersion !== manifest.engineVersion || payload.kind !== expectedKind
      || payload.totalFrames !== manifest.totalFrames || trace?.frames?.length !== expectedFrames) {
      throw new Error(`預建動畫 ${expectedKind} 格式不正確。`);
    }
    const status = root.ASMTraceProvenance?.status?.(
      trace,
      payload.animation.code,
      payload.animation.input || ''
    );
    if (status?.kind !== 'current') throw new Error(`預建動畫 ${expectedKind} 與程式碼版本不一致。`);
    if (descriptor && !descriptor.contentHash) throw new Error('預建動畫缺少內容雜湊。');
    return payload;
  }

  async function decode(blob, descriptor, manifest, expectedKind) {
    if (blob.size !== descriptor.bytes) throw new Error(`預建動畫 ${expectedKind} 檔案大小不符。`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (decoder.decode(bytes.slice(0, MAGIC.length)) !== MAGIC) throw new Error('不是有效的 .asmtrace 檔案。');
    const text = decoder.decode(await ungzip(bytes.slice(MAGIC.length)));
    const hash = await root.ASMDeck.sha256(text);
    if (hash !== descriptor.contentHash) throw new Error(`預建動畫 ${expectedKind} 雜湊不符。`);
    return validate(JSON.parse(text), descriptor, manifest, expectedKind);
  }

  function cacheKey(manifest) {
    return `${manifest.engineVersion}:${manifest.full.contentHash}`;
  }

  function openCache() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error('IndexedDB 無法使用'));
      const request = root.indexedDB.open(CACHE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function cacheGet(manifest) {
    if (manifest.engineVersion !== currentEngineVersion()) return null;
    let database;
    try {
      database = await openCache();
      const record = await new Promise((resolve, reject) => {
        const request = database.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(cacheKey(manifest));
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      if (!record) return null;
      return validate(record.payload, manifest.full, manifest, 'full');
    } catch (error) {
      console.warn('預設動畫 IndexedDB 快取讀取失敗', error);
      return null;
    } finally {
      database?.close();
    }
  }

  async function cachePut(manifest, payload) {
    validate(payload, manifest.full, manifest, 'full');
    let database;
    try {
      database = await openCache();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(CACHE_STORE, 'readwrite');
        const store = transaction.objectStore(CACHE_STORE);
        store.clear();
        store.put({ key: cacheKey(manifest), payload, savedAt: Date.now() });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      });
      return true;
    } catch (error) {
      console.warn('預設動畫 IndexedDB 快取寫入失敗', error);
      return false;
    } finally {
      database?.close();
    }
  }

  function validateManifest(manifest) {
    if (manifest?.format !== FORMAT || manifest.packageVersion !== PACKAGE_VERSION
      || manifest.engineVersion !== currentEngineVersion() || !Number.isInteger(manifest.totalFrames)
      || manifest.totalFrames < 1 || !manifest.preview?.url || !manifest.full?.url) {
      throw new Error('預設動畫清單與目前引擎不相容。');
    }
    return manifest;
  }

  return { decode, cacheGet, cachePut, validateManifest, currentEngineVersion, FORMAT, PACKAGE_VERSION, MAGIC };
});
