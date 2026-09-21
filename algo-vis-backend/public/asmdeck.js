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
    if (root.crypto?.subtle) {
      const digest = await root.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }
    // Public HTTP origins do not expose SubtleCrypto. Keep the same SHA-256
    // archive contract, including corruption checks, without requiring HTTPS.
    const input = bytes instanceof ArrayBuffer ? new Uint8Array(bytes)
      : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const padded = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
    padded.set(input);
    padded[input.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(input.length / 0x20000000));
    view.setUint32(padded.length - 4, (input.length * 8) >>> 0);
    const constants = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const words = new Uint32Array(64);
    const rotate = (n, count) => (n >>> count) | (n << (32 - count));
    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let j = 0; j < 16; j++) words[j] = view.getUint32(offset + j * 4);
      for (let j = 16; j < 64; j++) {
        const x = words[j - 15], y = words[j - 2];
        words[j] = words[j - 16] + (rotate(x,7) ^ rotate(x,18) ^ (x >>> 3))
          + words[j - 7] + (rotate(y,17) ^ rotate(y,19) ^ (y >>> 10));
      }
      let [a,b,c,d,e,f,g,h] = hash;
      for (let j = 0; j < 64; j++) {
        const t1 = (h + (rotate(e,6) ^ rotate(e,11) ^ rotate(e,25))
          + ((e & f) ^ (~e & g)) + constants[j] + words[j]) | 0;
        const t2 = ((rotate(a,2) ^ rotate(a,13) ^ rotate(a,22))
          + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
      }
      [a,b,c,d,e,f,g,h].forEach((n,j) => { hash[j] = (hash[j] + n) | 0; });
    }
    return hash.map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
  }

  function engineVersion() {
    const provenance = root.ASMTraceProvenance;
    if (!provenance) throw new Error('缺少追蹤引擎版本資訊，無法建立可重建的投影片檔。');
    return `${provenance.ENGINE_VERSION}/${provenance.FORMAT_VERSION}`;
  }

  function compatibleEngineVersion(savedVersion) {
    const saved = String(savedVersion || '').match(/^(\d+)\/(\d+)$/);
    const current = engineVersion().match(/^(\d+)\/(\d+)$/);
    if (!saved || !current) return false;
    return Number(saved[2]) === Number(current[2])
      && Number(saved[1]) <= Number(current[1]);
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
    if (!compatibleEngineVersion(manifest.engineVersion)) {
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
      try {
        slide.animation = await rebuildAnimation(slide.animation);
        delete slide.animation.rebuildError;
      } catch (error) {
        // The archive has already passed structural/hash validation. A C++
        // or RUN failure must not discard the user's editable slide data.
        slide.animation.rebuildError = String(error?.message || error);
        onResult(slide, 'pending');
        continue;
      }
      onResult(slide, slide.animation.cacheKind);
      delete slide.animation.cacheKind;
      delete slide.animation.rebuild;
    }
    return deck;
  }

  return { project, encode, decode, rebuildDeck, cachePut, cacheGet, clearCache, trimCache,
    cacheLimitMB, setCacheLimitMB, sha256,
    animationKey, baseKey, engineVersion, MAGIC, PACKAGE_VERSION };
});
