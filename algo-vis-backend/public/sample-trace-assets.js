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
  function createLoader() {
    return async () => { throw Object.assign(new Error('Trace 不再持久保存，請重新執行程式碼'), { code: 'TRACE_NOT_FOUND' }); };
  }
  return { validId, validFile, filenameFor, createLoader };
});
