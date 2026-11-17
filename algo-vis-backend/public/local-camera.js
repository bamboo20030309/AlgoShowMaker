// Temporary camera modifiers belong to the current document lifetime, never to a deck or Trace.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMLocalCamera = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  const prefix = 'asm:temporary-camera:v1:';
  const memory = new Map();
  function normalize(value) {
    const number = (key, fallback) => Number.isFinite(Number(value?.[key])) ? Number(value[key]) : fallback;
    return { panXRatio: number('panXRatio', 0), panYRatio: number('panYRatio', 0),
      zoomFactor: Math.max(0.05, number('zoomFactor', 1) > 0 ? number('zoomFactor', 1) : 1) };
  }
  // 清掉舊版本留在 sessionStorage 的偏移；新偏移只存在目前文件記憶體。
  try {
    for (let index = root.sessionStorage.length - 1; index >= 0; index--) {
      const key = root.sessionStorage.key(index);
      if (key?.startsWith(prefix)) root.sessionStorage.removeItem(key);
    }
  } catch {}
  function read(scope) {
    return normalize(memory.get(scope));
  }
  function write(scope, value) {
    const camera = normalize(value);
    memory.set(scope, camera);
    return camera;
  }
  return { read, write };
});
