// -----------------------------------------------------------------------------
// 投影片雲端 payload 工具
// 將 deck 與封面內容整理為 API 格式，並集中處理回應錯誤與版本欄位。
// -----------------------------------------------------------------------------
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMSlideCloud = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const CHUNK_CHARS = 256 * 1024;
  // -----------------------------------------------------------------------------
  // 雲端 deck 投影
  // 重用本機 storage 的內容定址規則，把大型 trace 拆成可獨立上傳的 references。
  // -----------------------------------------------------------------------------
  async function project(source, storage, traceStore = null, supplementalTraces = {}, retainHistory = Boolean(traceStore)) {
    const projected = await storage.project(source);
    Object.assign(projected.traces, supplementalTraces);
    if (traceStore) Object.assign(projected.traces, await traceStore.uploadTraces(projected.references));
    const assets = {};
    async function extract(value) {
      if (typeof value === 'string' && value.startsWith('data:')) {
        const text = JSON.stringify(value), key = await storage.digest(text);
        assets[key] = text;
        return { $asmAsset: key };
      }
      if (!value || typeof value !== 'object') return value;
      for (const key of Object.keys(value)) value[key] = await extract(value[key]);
      return value;
    }
    const resources = {};
    for (const [key, trace] of Object.entries(projected.traces)) resources[key] = storage.canonical(trace);
    const deck = await extract(projected.deck);
    const record = { version: 1, deck, references: projected.references, asset_keys: Object.keys(assets),
      ...(retainHistory ? { retainHistory: true } : {}) };
    Object.assign(resources, assets);
    const text = JSON.stringify(record), snapshot = await storage.digest(text);
    resources[snapshot] = text;
    let totalBytes = 0;
    for (const resource of Object.values(resources)) {
      const bytes = new TextEncoder().encode(resource).byteLength;
      if (bytes > 128 * 1024 * 1024) throw new Error('單份動畫或素材超過 128 MB');
      totalBytes += bytes;
    }
    if (totalBytes > 512 * 1024 * 1024) throw new Error('投影片總容量超過 512 MB');
    return { snapshot, resources };
  }
  // -----------------------------------------------------------------------------
  // UTF-8 安全分塊
  // 依 Unicode code point 累計 byte 長度，避免在代理字對中間切斷 JSON 字串。
  // -----------------------------------------------------------------------------
  function chunks(text) {
    const parts = [];
    for (let index = 0; index < text.length;) {
      let end = Math.min(text.length, index + CHUNK_CHARS);
      if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
      parts.push(text.slice(index, end));
      index = end;
    }
    return parts;
  }
  // -----------------------------------------------------------------------------
  // 分段上傳交易
  // 先建立或更新 deck metadata，再逐塊上傳引用內容；任一步失敗都回報明確 API 錯誤。
  // -----------------------------------------------------------------------------
  async function save(source, { endpoint, headers, fetch, storage, title, cover_thumbnail, traceStore, onRecovered }) {
    async function request(url, options) {
      const response = await fetch(url, { headers, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || '雲端儲存失敗，請重試'), {
        status: response.status, code: data.code, resourceKey: data.resourceKey
      });
      return data;
    }
    // Check every referenced result, including imported IDs not marked as new.
    // Complete remote results stay lazy; repair missing ones sequentially so a
    // large import cannot launch all compilations together.
    const prepared = { ...source, groups: (source.groups || []).map(group => ({ ...group,
      slides: group.slides.map(slide => ({ ...slide })) })) };
    const supplemental = {}, statuses = new Map();
    const complete = status => Number.isInteger(status.total) && status.total > 0
      && Array.isArray(status.parts) && new Set(status.parts).size === status.total
      && status.parts.every(part => Number.isInteger(part) && part >= 0 && part < status.total);
    let page = 0;
    for (const [groupIndex, group] of prepared.groups.entries()) {
      for (const [slideIndex, slide] of group.slides.entries()) {
        page++;
        const animation = slide.animation;
        if (!animation?.traceRef || animation.traceDocument) continue;
        const key = animation.traceRef;
        try {
          if (!statuses.has(key)) statuses.set(key, await request(endpoint + '/resources/' + key, { method: 'GET' }));
          if (complete(statuses.get(key)) || statuses.get(key).legacyAvailable === true) continue;
          if (!traceStore) continue; // Legacy clients retain server-side migration.
          const materialized = await traceStore.materializeAnimation(animation);
          const detached = await traceStore.detachDeck({ groups: [{ slides: [{ animation: materialized }] }] }, { upload: true });
          slide.animation = detached.groups[0].slides[0].animation;
          const replacement = slide.animation.traceRef;
          supplemental[replacement] = await traceStore.load(replacement);
          await onRecovered?.({ groupIndex, slideIndex, before: animation, animation: slide.animation });
        } catch (error) {
          throw Object.assign(new Error(`第 ${page} 張投影片的動畫（${key.slice(0, 12)}）無法補齊：${error.message}`),
            { status: error.status, code: error.code, resourceKey: key });
        }
      }
    }
    // Only serialize inline/newly repaired results. Pending markers alone do
    // not force downloading every already-durable animation on metadata saves.
    const projected = await project(prepared, storage, null, supplemental, Boolean(traceStore));
    for (const [key, text] of Object.entries(projected.resources)) {
      const parts = chunks(text);
      const status = await request(endpoint + '/resources/' + key, { method: 'GET' });
      const present = new Set(status.total === parts.length ? status.parts : []);
      for (const [part, data] of parts.entries()) if (!present.has(part)) {
        await request(endpoint + '/resources/' + key + '/' + part,
          { method: 'PUT', body: JSON.stringify({ total: parts.length, data }) });
      }
    }
    let result;
    try {
      result = await request(endpoint + '/content', { method: 'PUT',
        body: JSON.stringify({ snapshot: projected.snapshot, title, cover_thumbnail }) });
    } catch (error) {
      if (error.resourceKey) error.message += `（資源 ${error.resourceKey.slice(0, 12)}）`;
      throw error;
    }
    traceStore?.uploaded(Object.keys(projected.resources));
    return result;
  }
  return { project, chunks, save };
});
