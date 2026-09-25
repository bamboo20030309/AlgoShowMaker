// -----------------------------------------------------------------------------
// 投影片演算法動畫快照
// 在編輯器與嵌入播放器之間複製、壓縮並還原動畫資料，儲存的 trace 是播放真實來源。
// -----------------------------------------------------------------------------
(function () {
  const clone = value => JSON.parse(JSON.stringify(value));

  // The saved trace is the playback source of truth. Top-level copies are
  // retained for older decks, but must not overwrite the trace's live settings.
  // -----------------------------------------------------------------------------
  // 動畫持久化正規化
  // 深複製輸入並以 traceDocument 作為播放真實來源；頂層舊欄位只在缺少 trace 時提供相容退路。
  // -----------------------------------------------------------------------------
  function normalize(animation = {}) {
    const traceDocument = animation.traceDocument && typeof animation.traceDocument === 'object'
      ? clone(animation.traceDocument) : null;
    const hasTrace = Boolean(traceDocument?.frames?.length);
    // Decks store the already-edited runtime document, including older decks
    // written before this marker existed. Its original source view is stale.
    if (hasTrace) {
      traceDocument.viewSettingsApplied = true;
      // Older saved decks kept the generation source next to the trace. Make
      // it available to the shared code presenter without changing the saved
      // animation format or reading the live editor draft.
      if (!traceDocument.sourceCode && typeof animation.code === 'string') {
        traceDocument.sourceCode = animation.code;
      }
    }
    const sliceMode = traceDocument?.sliceMode || animation.sliceMode;
    const skins = traceDocument?.skins ?? animation.skins ?? animation.rebuild?.view?.skins;
    const rules = traceDocument?.rules ?? animation.rules ?? animation.rebuild?.view?.rules;
    return {
      mode: hasTrace || animation.mode === 'trace' ? 'trace' : 'legacy',
      code: typeof animation.code === 'string' ? animation.code : '',
      input: typeof animation.input === 'string' ? animation.input : '',
      scriptContent: !hasTrace && typeof animation.scriptContent === 'string' ? animation.scriptContent : '',
      sliceMode: ['manual', 'full'].includes(sliceMode) ? sliceMode : 'auto',
      watches: Array.isArray(animation.watches) ? clone(animation.watches) : [],
      skins: skins && typeof skins === 'object' ? clone(skins) : {},
      rules: Array.isArray(rules) ? clone(rules) : [],
      traceDocument,
      ...(animation.rebuild ? { rebuild: clone(animation.rebuild) } : {}),
      ...(typeof animation.rebuildError === 'string' ? { rebuildError: animation.rebuildError } : {})
    };
  }

  // -----------------------------------------------------------------------------
  // 公開轉換介面
  // 所有建立、儲存與載入入口共用 normalize，避免編輯器和投影片頁各自推導不同格式。
  // -----------------------------------------------------------------------------
  window.ASMAlgorithmAnimation = { normalize };
})();
