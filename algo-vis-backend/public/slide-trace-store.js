// Trace payloads live outside the editable deck and undo history. Only immutable
// result IDs and per-slide view settings are persisted in the deck itself.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMSlideTraceStore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function create(storage, client, fetchRemote = null) {
    const retained = new Set();
    const loads = new Map();
    const pendingUploads = new Set();
    const clone = value => JSON.parse(JSON.stringify(value));
    async function detachDeck(source, { upload = false } = {}) {
      const deck = JSON.parse(JSON.stringify(source, (key, value) => key === 'traceDocument' ? undefined : value));
      for (const [h, group] of (deck.groups || []).entries()) {
        for (const [v, slide] of (group.slides || []).entries()) {
          const animation = source.groups[h].slides[v].animation;
          if (!animation) continue;
          if (animation.traceDocument) {
            const trace = { ...animation.traceDocument };
            const view = {};
            for (const name of ['studio', 'skins', 'rules']) {
              if (Object.hasOwn(trace, name)) { view[name] = clone(trace[name]); delete trace[name]; }
            }
            const key = await storage.digest(storage.canonical(trace));
            await client.putTrace(key, trace);
            slide.animation.traceRef = key;
            slide.animation.traceView = view;
            if (upload) pendingUploads.add(key);
          }
          if (slide.animation.traceRef) retained.add(slide.animation.traceRef);
        }
      }
      return deck;
    }
    async function load(key) {
      retained.add(key);
      if (!loads.has(key)) {
        const promise = (async () => {
          let trace = await client.loadTrace(key);
          if (!trace && fetchRemote) {
            trace = await fetchRemote(key);
            await client.putTrace(key, trace);
          }
          if (!trace) throw new Error('找不到動畫結果，請重新匯入或 RUN');
          return trace;
        })();
        loads.set(key, promise);
        promise.catch(() => { if (loads.get(key) === promise) loads.delete(key); });
        // Cache two results, rather than holding every animation in the deck.
        while (loads.size > 2) loads.delete(loads.keys().next().value);
      }
      return loads.get(key);
    }
    async function materializeAnimation(animation) {
      if (!animation?.traceRef) return animation;
      const trace = await load(animation.traceRef);
      const { traceRef, traceView, ...settings } = animation;
      return { ...settings, traceDocument: { ...trace, ...traceView } };
    }
    async function materializeDeck(source) {
      const deck = clone(source);
      for (const group of deck.groups || []) for (const slide of group.slides || []) {
        if (slide.animation) slide.animation = await materializeAnimation(slide.animation);
      }
      return deck;
    }
    async function uploadTraces(references) {
      const traces = {};
      for (const ref of references) if (pendingUploads.has(ref.key)) traces[ref.key] = await load(ref.key);
      return traces;
    }
    return { detachDeck, load, materializeAnimation, materializeDeck, uploadTraces,
      retainedKeys: () => [...retained],
      uploaded: keys => keys.forEach(key => pendingUploads.delete(key)) };
  }
  return { create };
});
