// Portable, compact slide archives. This file intentionally does not touch the live deck.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMDeck = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const MAGIC = 'ASMDECK1\n';
  const PACKAGE_VERSION = 1;
  const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
  const MAX_JSON_BYTES = 128 * 1024 * 1024;
  const MAX_ASSET_BYTES = 8 * 1024 * 1024;
  const DEFAULT_CACHE_MB = 64;
  const CACHE_LIMIT_KEY = 'asmdeck_trace_cache_limit_mb';
  const CACHE_DB = 'algoshowmaker-trace-cache-v1';
  const clone = value => JSON.parse(JSON.stringify(value));
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });

  function cacheLimitMB() {
    let value;
    try { value = Number(root.localStorage?.getItem(CACHE_LIMIT_KEY)); } catch (_) { /* private browsing */ }
    return Number.isFinite(value) && value >= 8 && value <= 512 ? value : DEFAULT_CACHE_MB;
  }

  function setCacheLimitMB(value) {
    const mb = Number(value);
    if (!Number.isInteger(mb) || mb < 8 || mb > 512) throw new Error('快取容量須為 8–512 MB 的整數。');
    root.localStorage?.setItem(CACHE_LIMIT_KEY, String(mb));
    return mb;
  }

  async function sha256(value) {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    const digest = await root.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function engineVersion() {
    const provenance = root.ASMTraceProvenance;
    if (!provenance) throw new Error('缺少追蹤引擎版本資訊，無法建立可重建的投影片檔。');
    return `${provenance.ENGINE_VERSION}/${provenance.FORMAT_VERSION}`;
  }

  function algorithmSlides(deck) {
    return (deck.groups || []).flatMap(group => group.slides || [])
      .filter(slide => slide.kind === 'algorithm-animation');
  }

  function presentationFor(trace) {
    if (!root.ASMTraceViewSource?.fromTrace || !root.ASMTraceViewSource?.applyToTrace) {
      throw new Error('缺少 Trace Studio 設定轉換器，無法核對動畫設定。');
    }
    const view = root.ASMTraceViewSource.fromTrace(trace);
    const probe = root.ASMTraceModel?.normalizeTraceDocument
      ? root.ASMTraceModel.normalizeTraceDocument(clone(trace)) : clone(trace);
    root.ASMTraceViewSource.applyToTrace(probe, view);
    const studio = trace.studio || {};
    const restored = probe.studio || {};
    for (const key of ['objects', 'arrows', 'transitions']) {
      const expected = new Set((studio[key] || []).map(item => item?.id).filter(Boolean));
      const actual = new Set((restored[key] || []).map(item => item?.id).filter(Boolean));
      for (const id of expected) if (!actual.has(id)) {
        throw new Error(`Trace Studio 的 ${key} 物件 ${id} 無法還原，請先重新 RUN 並儲存。`);
      }
    }
    const frameIds = new Set((trace.frames || []).map(frame => frame.id));
    for (const key of ['positions', 'bindings', 'visibility', 'objectStyles', 'eventStates']) {
      for (const [frameId, saved] of Object.entries(studio[key] || {})) {
        if (!frameIds.has(frameId) || !saved || !Object.keys(saved).length) continue;
        if (!restored[key]?.[frameId] || !Object.keys(restored[key][frameId]).length) {
          throw new Error(`Trace Studio 的 ${key} 幀設定無法還原，請先重新 RUN 並儲存。`);
        }
      }
    }
    // fromTrace deliberately omits these global settings; keep them separate.
    const globals = {};
    for (const key of ['eventColors', 'eventSignatureColors', 'eventAnimations', 'transitionDefaults', 'eventSettings']) {
      if (Object.prototype.hasOwnProperty.call(studio, key)) globals[key] = clone(studio[key]);
    }
    return { view, globals };
  }

  function checkAnimation(animation, slideId) {
    const trace = animation?.traceDocument;
    if (!animation || !animation.code?.trim() || !trace?.frames?.length) {
      throw new Error(`投影片 ${slideId} 缺少可重建的 C++ 原始碼或追蹤結果，請先在編輯器 RUN 並儲存。`);
    }
    const status = root.ASMTraceProvenance.status(trace, animation.code, animation.input || '');
    if (status.kind !== 'current') {
      throw new Error(`投影片 ${slideId} 的程式／輸入或追蹤版本尚未更新；請先 RUN 並儲存後再匯出。`);
    }
  }

  async function extractAssets(value, assets) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'src' && typeof child === 'string' && /^data:image\//i.test(child)) {
        if (encoder.encode(child).length > MAX_ASSET_BYTES) throw new Error('畫布圖片超過單張 8 MB 匯出上限。');
        const id = await sha256(child);
        assets[id] ||= child;
        value[key] = `asm-asset:${id}`;
      } else if (child && typeof child === 'object') {
        await extractAssets(child, assets);
      }
    }
  }

  function restoreAssets(value, assets) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'src' && typeof child === 'string' && child.startsWith('asm-asset:')) {
        const id = child.slice(10);
        if (!Object.prototype.hasOwnProperty.call(assets, id)) throw new Error(`匯出檔缺少圖片素材 ${id}。`);
        value[key] = assets[id];
      } else if (child && typeof child === 'object') restoreAssets(child, assets);
    }
  }

  async function animationKey(animation, engine = engineVersion()) {
    const rebuild = animation.rebuild || {};
    return sha256(JSON.stringify([engine, animation.code, animation.input, animation.sliceMode,
      animation.watches, rebuild.view, rebuild.globals]));
  }

  async function baseKey(animation, engine = engineVersion()) {
    return sha256(JSON.stringify([engine, animation.code, animation.input, animation.sliceMode,
      animation.watches]));
  }

  async function project(liveDeck, editorDraft = null) {
    const deck = clone(liveDeck);
    const liveSlides = new Map(algorithmSlides(liveDeck).map(slide => [slide.id, slide]));
    const assets = {};
    const cacheSeeds = [];
    for (const slide of algorithmSlides(deck)) {
      const live = liveSlides.get(slide.id);
      if (editorDraft?.slideId === slide.id) slide.animation = clone(editorDraft.animation);
      const animation = slide.animation;
      checkAnimation(animation, slide.id);
      const trace = animation.traceDocument;
      const rebuild = presentationFor(trace);
      const exact = await animationKey({ ...animation, rebuild });
      cacheSeeds.push({ key: `exact:${exact}`, trace: clone(trace) });
      slide.animation = {
        mode: 'trace', code: animation.code, input: animation.input || '',
        sliceMode: animation.sliceMode || trace.sliceMode || 'auto',
        watches: clone(animation.watches || []), rebuild
      };
    }
    await extractAssets(deck, assets);
    return { deck, assets, cacheSeeds };
  }

  async function gzip(bytes) {
    if (!root.CompressionStream) throw new Error('此瀏覽器不支援壓縮投影片檔。');
    const stream = new Blob([bytes]).stream().pipeThrough(new root.CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function ungzip(bytes) {
    if (!root.DecompressionStream) throw new Error('此瀏覽器不支援解壓縮投影片檔。');
    const stream = new Blob([bytes]).stream().pipeThrough(new root.DecompressionStream('gzip'));
    const reader = stream.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_JSON_BYTES) {
        await reader.cancel();
        throw new Error('匯入檔展開後超過 128 MB 安全上限。');
      }
      chunks.push(value);
    }
    const output = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output;
  }

  async function encode(projected) {
    const body = { deck: projected.deck, assets: projected.assets };
    const bodyText = JSON.stringify(body);
    if (encoder.encode(bodyText).length > MAX_JSON_BYTES) throw new Error('精簡投影片資料超過 128 MB 上限。');
    const manifest = {
      format: 'AlgoShowMaker.asmdeck', packageVersion: PACKAGE_VERSION,
      engineVersion: engineVersion(), exportedAt: new Date().toISOString(),
      contentHash: await sha256(bodyText),
      assetHashes: Object.keys(projected.assets).sort()
    };
    const compressed = await gzip(encoder.encode(JSON.stringify({ manifest, body })));
    if (compressed.length + MAGIC.length > MAX_ARCHIVE_BYTES) throw new Error('壓縮檔超過 32 MB 匯出上限。');
    return new Blob([MAGIC, compressed], { type: 'application/octet-stream' });
  }

  async function decode(file) {
    if (file.size > MAX_ARCHIVE_BYTES) throw new Error('匯入檔超過 32 MB 安全上限。');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (decoder.decode(bytes.slice(0, MAGIC.length)) !== MAGIC) throw new Error('不是有效的 .asmdeck 壓縮檔。');
    let packageData;
    try { packageData = JSON.parse(decoder.decode(await ungzip(bytes.slice(MAGIC.length)))); }
    catch (error) { throw new Error(`匯出檔無法解壓或解析：${error.message}`); }
    const { manifest, body } = packageData || {};
    if (manifest?.format !== 'AlgoShowMaker.asmdeck' || manifest.packageVersion !== PACKAGE_VERSION) {
      throw new Error('不支援此投影片檔格式版本。');
    }
    if (manifest.engineVersion !== engineVersion()) {
      throw new Error(`此檔使用追蹤引擎 ${manifest.engineVersion}，目前版本 ${engineVersion()} 不相容，請使用相容版本匯入。`);
    }
    if (!body?.deck?.groups || !body.assets || await sha256(JSON.stringify(body)) !== manifest.contentHash) {
      throw new Error('投影片內容雜湊不符，檔案可能損壞或被修改。');
    }
    const hashes = Object.keys(body.assets).sort();
    if (JSON.stringify(hashes) !== JSON.stringify(manifest.assetHashes)) throw new Error('圖片素材清單不符。');
    for (const id of hashes) {
      const asset = body.assets[id];
      if (typeof asset !== 'string' || !/^data:image\//i.test(asset) ||
          encoder.encode(asset).length > MAX_ASSET_BYTES || await sha256(asset) !== id) {
        throw new Error(`圖片素材 ${id} 驗證失敗。`);
      }
    }
    const deck = clone(body.deck);
    restoreAssets(deck, body.assets);
    return { deck, manifest };
  }

  function openCache() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error('IndexedDB 無法使用'));
      const request = root.indexedDB.open(CACHE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('traces', { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function cacheGet(key) {
    let db;
    try {
      db = await openCache();
      const entry = await new Promise((resolve, reject) => {
        const req = db.transaction('traces').objectStore('traces').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!entry) return null;
      const tx = db.transaction('traces', 'readwrite');
      tx.objectStore('traces').put({ ...entry, accessed: Date.now() });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
      return clone(entry.trace);
    } catch (error) {
      console.warn('Trace cache read failed', error);
      return null;
    } finally { db?.close(); }
  }

  async function cachePut(key, trace) {
    const size = encoder.encode(JSON.stringify(trace)).length;
    const maxBytes = cacheLimitMB() * 1024 * 1024;
    if (size > maxBytes) return;
    let db;
    try {
      db = await openCache();
      const old = await new Promise((resolve, reject) => {
        const req = db.transaction('traces').objectStore('traces').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction('traces', 'readwrite');
      const store = tx.objectStore('traces');
      let total = old.filter(item => item.key !== key).reduce((sum, item) => sum + item.size, size);
      for (const item of old.filter(item => item.key !== key).sort((a, b) => a.accessed - b.accessed)) {
        if (total <= maxBytes) break;
        store.delete(item.key);
        total -= item.size;
      }
      store.put({ key, trace: clone(trace), size, accessed: Date.now() });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    } catch (error) { console.warn('Trace cache write failed', error); }
    finally { db?.close(); }
  }

  async function clearCache() {
    const db = await openCache();
    try {
      const tx = db.transaction('traces', 'readwrite');
      tx.objectStore('traces').clear();
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }

  async function trimCache() {
    const db = await openCache();
    try {
      const entries = await new Promise((resolve, reject) => {
        const req = db.transaction('traces').objectStore('traces').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction('traces', 'readwrite');
      const store = tx.objectStore('traces');
      let total = entries.reduce((sum, entry) => sum + entry.size, 0);
      const limit = cacheLimitMB() * 1024 * 1024;
      for (const entry of entries.sort((a, b) => a.accessed - b.accessed)) {
        if (total <= limit) break;
        store.delete(entry.key); total -= entry.size;
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }

  function applyPresentation(rawTrace, animation) {
    const trace = root.ASMTraceModel.normalizeTraceDocument(clone(rawTrace));
    root.ASMTraceViewSource.applyToTrace(trace, animation.rebuild.view);
    trace.studio ||= {};
    Object.assign(trace.studio, clone(animation.rebuild.globals || {}));
    trace.sourceCode = animation.code;
    trace.provenance = root.ASMTraceProvenance.create(animation.code, animation.input);
    trace.viewSettingsApplied = true;
    if (!trace.frames?.length) throw new Error('重建的動畫沒有任何畫面。');
    return trace;
  }

  async function runTrace(animation) {
    const analysisResponse = await fetch('/trace/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: animation.code })
    });
    const analysis = await analysisResponse.json().catch(() => ({}));
    if (!analysisResponse.ok) throw new Error(analysis.error || 'C++ 追蹤分析失敗');
    const available = new Set((analysis.variables || []).map(variable => variable.id));
    const watches = (animation.watches || []).map(watch => typeof watch === 'string' ? watch : watch.id)
      .filter(id => available.has(id));
    const compileResponse = await fetch('/compile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: animation.code, input: animation.input,
        trace: { enabled: true, sliceMode: animation.sliceMode, watches,
          skins: animation.rebuild.view.skins || {}, rules: animation.rebuild.view.rules || [] } })
    });
    const compiled = await compileResponse.json().catch(() => ({}));
    if (!compileResponse.ok || compiled.error || !compiled.traceDocument?.frames?.length) {
      throw new Error(compiled.error || compiled.traceWarning || 'RUN 未能產生可播放的追蹤畫面');
    }
    return compiled.traceDocument;
  }

  async function rebuildAnimation(animation) {
    if (!animation?.rebuild?.view || !animation.code?.trim()) throw new Error('演算法動畫缺少重建設定或原始碼。');
    const exact = `exact:${await animationKey(animation)}`;
    const cached = await cacheGet(exact);
    if (cached?.frames?.length && root.ASMTraceProvenance.status(cached, animation.code, animation.input).kind === 'current') {
      return { ...animation, traceDocument: cached, rebuild: undefined, cacheKind: 'exact' };
    }
    const base = `base:${await baseKey(animation)}`;
    let rawTrace = await cacheGet(base);
    const cacheKind = rawTrace?.frames?.length ? 'base' : 'run';
    if (!rawTrace?.frames?.length) rawTrace = await runTrace(animation);
    const trace = applyPresentation(rawTrace, animation);
    await cachePut(base, rawTrace);
    await cachePut(exact, trace);
    return { ...animation, traceDocument: trace, rebuild: undefined, cacheKind };
  }

  async function rebuildDeck(compactDeck, onProgress = () => {}, onResult = () => {}) {
    const deck = clone(compactDeck);
    for (const slide of algorithmSlides(deck)) {
      onProgress(slide);
      slide.animation = await rebuildAnimation(slide.animation);
      onResult(slide, slide.animation.cacheKind);
      delete slide.animation.cacheKind;
      delete slide.animation.rebuild;
    }
    return deck;
  }

  return { project, encode, decode, rebuildDeck, cachePut, cacheGet, clearCache, trimCache,
    cacheLimitMB, setCacheLimitMB,
    animationKey, baseKey, engineVersion, MAGIC, PACKAGE_VERSION };
});
