// Trace payloads live outside the editable deck and undo history. Only immutable
// result IDs and per-slide view settings are persisted in the deck itself.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMSlideTraceStore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function create(storage, client, fetchRemote = null, recoverMissing = null, options = {}) {
    const retained = new Set();
    const loads = new Map();
    const pendingUploads = new Set();
    // Share one recovery per saved animation revision, including failures. A
    // navigation/iframe ready message must not repeatedly compile broken code.
    const recoveries = new Map();
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
          if (!trace) throw Object.assign(new Error('找不到動畫結果，請重新匯入或 RUN'), { code: 'TRACE_NOT_FOUND' });
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
      if (!animation?.traceRef && !animation?.traceDocument && !animation?.rebuild) return animation;
      let trace;
      try {
        if (!animation.traceDocument && !animation.traceRef) throw Object.assign(new Error('動畫尚無執行結果'), { code: 'TRACE_NOT_FOUND' });
        trace = animation.traceDocument || await load(animation.traceRef);
        const status = await options.status?.(trace, animation);
        if (status && status.kind !== 'current') {
          options.onState?.(animation, status);
          throw Object.assign(new Error(status.message || '動畫版本已過期'), { code: 'TRACE_OUTDATED' });
        }
      }
      catch (error) {
        if (!['TRACE_NOT_FOUND', 'TRACE_OUTDATED'].includes(error.code) || !recoverMissing) {
          options.onState?.(animation, { kind: 'error', message: error.message });
          throw error;
        }
        const revision = storage.canonical(animation);
        if (!recoveries.has(revision)) {
          options.onState?.(animation, { kind: 'updating', message: '動畫需要更新，正在取得新版結果…' });
          const recovery = Promise.resolve().then(() => recoverMissing(animation, { reason: error.code })).then(async recovered => {
            const status = await options.status?.(recovered.traceDocument, recovered);
            if (status && status.kind !== 'current') throw new Error('重新執行後的動畫仍不符合目前引擎，請重新整理後重試');
            // Retain only the replacement ID/settings, not another full Trace
            // for every slide; normal lazy loading still holds at most two.
            const detached = await detachDeck({ groups: [{ slides: [{ animation: recovered }] }] });
            return detached.groups[0].slides[0].animation;
          });
          recoveries.set(revision, recovery);
          // 導覽訊息不重複提交失敗工作；明確重試才清除此紀錄。
          recovery.catch(failure => {
            options.onState?.(animation, { kind: 'error', message: failure.message });
          });
        }
        const result = await materializeAnimation(await recoveries.get(revision));
        options.onState?.(animation, { kind: 'current', message: '' });
        return result;
      }
      options.onState?.(animation, { kind: 'current', message: '' });
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
      retry: animation => recoveries.delete(storage.canonical(animation)),
      retainedKeys: () => [...retained],
      uploaded: keys => keys.forEach(key => pendingUploads.delete(key)) };
  }
  return { create };
});
