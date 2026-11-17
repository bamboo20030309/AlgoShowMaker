// Portable animation recipes contain source/settings and a native executable ID.
// A Trace is an in-memory playback result, never part of durable deck storage.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMAnimationRecipe = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const clone = value => JSON.parse(JSON.stringify(value));

  function strip(animation) {
    if (!animation) return animation;
    const { traceDocument, traceRef, prebuilt, cacheKind, rebuildError,
      presentationCamera, ...recipe } = animation;
    const traceView = clone(animation.traceView || {});

    // Some early exports stored source only on the result. Recover it before
    // removing the payload; source-less results must never silently disappear.
    if (!recipe.code?.trim() && traceDocument?.sourceCode) recipe.code = traceDocument.sourceCode;
    if ((traceDocument || traceRef || prebuilt) && !recipe.code?.trim() && !recipe.scriptContent) {
      throw Object.assign(new Error('動畫缺少可重新執行的程式碼，無法移除舊結果；請先補回來源'), {
        code: 'ANIMATION_SOURCE_UNAVAILABLE'
      });
    }
    if (traceDocument) {
      for (const key of ['studio', 'rules', 'skins']) {
        if (traceDocument[key] !== undefined) traceView[key] = clone(traceDocument[key]);
      }
      if (root.ASMDeck?.presentationFor) recipe.rebuild = root.ASMDeck.presentationFor(traceDocument);
      else if (root.ASMTraceViewSource?.fromTrace) {
        recipe.rebuild = { view: root.ASMTraceViewSource.fromTrace(traceDocument),
          globals: { eventSettings: clone(traceDocument.studio?.eventSettings || {}) } };
      }
      if (traceDocument.executableRef) recipe.executableRef = clone(traceDocument.executableRef);
    }
    if (Object.keys(traceView).length) recipe.traceView = traceView;
    if (recipe.code?.trim() && !recipe.rebuild?.view) {
      recipe.rebuild = {
        view: { version: 1, rules: traceView.rules || [], skins: traceView.skins || {}, studio: traceView.studio || {} },
        globals: { eventSettings: clone(traceView.studio?.eventSettings || {}) }
      };
    }
    recipe.executionPolicy = 'executable-only-v1';
    return clone(recipe);
  }

  function deck(source) {
    // Recursion also supports legacy flat decks, without mutating the live
    // presentation or removing unrelated widget/Fabric object settings.
    function visit(value) {
      if (Array.isArray(value)) return value.map(visit);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.entries(value).map(([key, item]) =>
        [key, key === 'animation' ? strip(item) : visit(item)]));
    }
    return visit(source);
  }
  return { strip, deck };
});
