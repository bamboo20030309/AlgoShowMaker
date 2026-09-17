(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMSlideCloud = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const CHUNK_CHARS = 256 * 1024;
  async function project(source, storage) {
    const projected = await storage.project(source);
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
    const record = { version: 1, deck, references: projected.references, asset_keys: Object.keys(assets) };
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
  async function save(source, { endpoint, headers, fetch, storage, title, cover_thumbnail }) {
    const projected = await project(source, storage);
    async function request(url, options) {
      const response = await fetch(url, { headers, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || '雲端儲存失敗，請重試'), { status: response.status });
      return data;
    }
    for (const [key, text] of Object.entries(projected.resources)) {
      const parts = chunks(text);
      const status = await request(endpoint + '/resources/' + key, { method: 'GET' });
      const present = new Set(status.total === parts.length ? status.parts : []);
      for (const [part, data] of parts.entries()) if (!present.has(part)) {
        await request(endpoint + '/resources/' + key + '/' + part,
          { method: 'PUT', body: JSON.stringify({ total: parts.length, data }) });
      }
    }
    return request(endpoint + '/content', { method: 'PUT',
      body: JSON.stringify({ snapshot: projected.snapshot, title, cover_thumbnail }) });
  }
  return { project, chunks, save };
});
