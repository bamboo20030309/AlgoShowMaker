// Public sample files have readable names; immutable IDs remain in saved decks.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMSampleTraceAssets = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const validId = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const validFile = value => typeof value === 'string'
    && /^(?:legacy\/)?[a-z0-9][a-z0-9_-]*\.json$/.test(value) && value !== 'index.json';
  function filenameFor(index, id) {
    if (!validId(id)) throw new Error('動畫 Trace ID 格式無效');
    const file = index?.traces?.[id]?.file;
    if (file === undefined) return id + '.json'; // Older deployments / generated fixtures.
    if (!validFile(file)) throw new Error('範例 Trace 索引包含無效檔名');
    return file;
  }
  function createLoader(fetcher = (...args) => fetch(...args), { fingerprint = trace => {
    const storage = globalThis.ASMSlideStorage;
    return storage?.digest(storage.canonical(trace));
  } } = {}) {
    let pendingIndex = null;
    async function index() {
      if (!pendingIndex) pendingIndex = (async () => {
        const response = await fetcher('/deck-traces/index.json', { cache: 'no-cache' });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`範例 Trace 索引讀取失敗（HTTP ${response.status}）`);
        const value = await response.json();
        if (value?.schema !== 1 || !value.traces || typeof value.traces !== 'object') throw new Error('範例 Trace 索引格式無效');
        return value;
      })().catch(error => { pendingIndex = null; throw error; });
      return pendingIndex;
    }
    return async function load(id, retry = false) {
      if (!validId(id)) throw new Error('動畫 Trace ID 格式無效');
      const file = filenameFor(await index(), id);
      const response = await fetcher('/deck-traces/' + file);
      if (response.status === 404 && !retry) {
        pendingIndex = null;
        return load(id, true);
      }
      if (!response.ok) throw Object.assign(new Error(`動畫 Trace 讀取失敗（HTTP ${response.status}）`), {
        code: response.status === 404 ? 'TRACE_NOT_FOUND' : 'TRACE_LOAD_FAILED'
      });
      const trace = await response.json();
      const actual = await fingerprint(trace);
      if (actual && actual !== id) {
        // A page can retain an old index while a named sample is rebuilt.
        // Refresh once to find the archived version; never cache the wrong ID.
        if (!retry) { pendingIndex = null; return load(id, true); }
        throw Object.assign(new Error('範例 Trace 內容與引用 ID 不符'), { code: 'TRACE_HASH_MISMATCH' });
      }
      return trace;
    };
  }
  return { validId, validFile, filenameFor, createLoader };
});
