/** 載入時核實引擎版本；只自動重建過期結果，使用者改碼仍由 RUN 決定。 */
(function () {
  let timer, versionRequest, active, failedTrace, revision = 0;
  let versionError = '';
  const provenance = window.ASMTraceProvenance;
  const source = () => ({ code: typeof aceEditor !== 'undefined' ? aceEditor.getValue() : '',
    input: document.getElementById('inputArea')?.value || '' });
  const currentTrace = () => window.ASMTraceEditor?.getTraceDocument?.();

  function paint(kind, message, blocked = false) {
    const indicator = document.getElementById('traceFreshnessNotice');
    if (!indicator) return;
    indicator.textContent = '';
    indicator.dataset.status = kind;
    indicator.title = message;
    indicator.setAttribute('aria-label', `動畫狀態：${message}`);
    indicator.hidden = false;
    document.body.classList.toggle('asm-trace-outdated', blocked);
    if (blocked) window.ASMPlaybackNavigation?.pause?.();
  }

  // 每次重新載入動畫、回到頁面都重新詢問；同時抵達的檢查共用請求。
  // 不修改生成指紋模組，以免把純介面修正誤判成所有 Trace 都需重建。
  function checkVersion() {
    if (!versionRequest) versionRequest = window.ASMTraceVersionCheck.check({ force: true })
      .then(() => { versionError = ''; })
      .catch(error => { versionError = error.message; })
      .finally(() => { versionRequest = null; });
    return versionRequest;
  }

  async function refresh() {
    const trace = currentTrace();
    if (versionError || !provenance.generationFingerprint) {
      paint('outdated', versionError || '正在確認動畫版本…', !!trace);
      return;
    }
    const { code, input } = source();
    const pending = window.ASMTraceEditor?.getPendingAnimation?.();
    const identity = trace || pending;
    const status = pending && !trace
      ? { kind: 'outdated', message: '既有動畫結果遺失，正在重新載入…' }
      : provenance.status(trace, code, input);
    if (status.kind !== 'outdated') {
      paint(status.kind, status.message || (status.kind === 'current' ? '動畫已更新。' : '動畫尚未更新，請先 RUN。'));
      return;
    }
    paint('outdated', failedTrace === identity ? '動畫更新失敗，點擊狀態圓點重試；詳見除錯紀錄。' : '動畫版本過舊，正在重新載入…', true);
    if (active || failedTrace === identity || !code.trim()) return;
    const runButton = document.getElementById('runBtn');
    if (runButton?.classList.contains('loading')) return;
    const token = revision;
    const settings = window.ASMTraceEditor.snapshot();
    active = identity;
    try {
      const animation = await window.ASMDeck.rebuildMissingAnimation({ ...pending, ...settings, code, input,
        traceView: trace || pending?.traceView });
      // 切換動畫、改碼、改輸入或手動 RUN 後，背景舊結果不得覆寫目前內容。
      const now = source();
      if (token !== revision || (currentTrace() !== trace || window.ASMTraceEditor.getPendingAnimation() !== pending) || now.code !== code || now.input !== input) return;
      if (provenance.status(animation.traceDocument, code, input).kind !== 'current') throw Error('更新結果版本不符，請重新整理頁面');
      const updated = window.ASMTraceEditor.applyTraceDocument(animation.traceDocument,
        { migrateCurrentSettings: true, preserveEventSettings: true, openStudio: false });
      window.dispatchEvent(new CustomEvent('asm:compiled-animation', { detail: { ...animation, traceDocument: updated } }));
      window.ASMAlgorithmDraft?.save?.();
    } catch (error) {
      if (token === revision && currentTrace() === trace && window.ASMTraceEditor.getPendingAnimation() === pending) {
        failedTrace = identity;
        const debug = document.getElementById('debugOutput') || document.getElementById('debugArea');
        if (debug) debug.textContent += `\n動畫自動更新失敗：${error.message}\n`;
        console.warn('動畫自動更新失敗', error);
      }
    } finally { active = null; schedule(); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 120); }
  function changed() { revision++; schedule(); }
  async function loaded() {
    revision++;
    const trace = currentTrace(), value = source();
    if (window.ASMTraceEditor?.getPendingAnimation?.() || (trace && provenance.status(trace, value.code, value.input).kind === 'outdated')) {
      paint('outdated', '動畫版本過舊，正在重新載入…', true);
    }
    await checkVersion();
    schedule();
  }
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '.asm-trace-outdated #asm-trace-root{visibility:hidden}';
    document.head.append(style);
    if (typeof aceEditor !== 'undefined') { aceEditor.on('change', changed); aceEditor.on('changeSession', changed); }
    document.getElementById('inputArea')?.addEventListener('input', changed);
    document.getElementById('runBtn')?.addEventListener('click', changed);
    document.getElementById('traceFreshnessNotice')?.addEventListener('click', () => { failedTrace = null; loaded(); });
    paint('outdated', '正在確認動畫版本…');
    loaded();
  });
  window.addEventListener('asm:trace-loaded', loaded);
  window.addEventListener('asm:compiled-animation', changed);
  window.addEventListener('asm:compile-finished', schedule);
  window.addEventListener('focus', loaded);
  window.ASMTraceFreshness = { refresh, checkVersion };
})();
