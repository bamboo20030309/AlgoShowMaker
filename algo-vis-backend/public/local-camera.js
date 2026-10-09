// Temporary camera modifiers belong to the current browser tab, never to a deck or Trace.
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
  function read(scope) {
    let value = memory.get(scope);
    try { value = JSON.parse(root.sessionStorage.getItem(prefix + scope)) ?? value; } catch {}
    return normalize(value);
  }
  function write(scope, value) {
    const camera = normalize(value);
    memory.set(scope, camera);
    try { root.sessionStorage.setItem(prefix + scope, JSON.stringify(camera)); } catch {}
    return camera;
  }
  // Import an old deck's saved modifier once. A newer local gesture wins, including identity.
  function migrate(scope, value) {
    if (!value || memory.has(scope)) return;
    try { if (root.sessionStorage.getItem(prefix + scope) !== null) return; } catch {}
    write(scope, value);
  }
  return { read, write, migrate };
});
