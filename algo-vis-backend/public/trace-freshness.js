/**
 * 模組：Trace 新鮮度提示
 *
 * 責任：監看來源、設定與目前 trace 是否仍相符，排程更新需要重新 RUN 的介面狀態。
 * 資料流：多個快速變更合併到下一個 refresh，避免每次鍵入都重算；判定結果只更新提示，不直接觸發分析。
 * 重要不變條件：同一輪事件只能存在一個待處理刷新，且卸載或缺少 editor 時必須安全返回。
 * 相容性：舊頁面沒有 freshness hooks 時不影響主要編輯流程。
 */
(function () {
  let timer;
  const fallbackMessages = {
    empty: '動畫尚未更新，請先 RUN。',
    current: '動畫已更新。',
    dirty: '程式或輸入已修改，動畫尚未更新。請重新 RUN。',
    outdated: '動畫資料版本過舊，請重新 RUN。'
  };

  // ---------------------------------------------------------------------------
  // 區段：新鮮度判定與提示更新
  // ---------------------------------------------------------------------------
  function refresh() {
    const indicator = document.getElementById('traceFreshnessNotice');
    if (!indicator) return;
    const trace = window.ASMTraceEditor?.snapshot?.().traceDocument;
    const code = typeof aceEditor !== 'undefined' ? aceEditor.getValue() : '';
    const input = document.getElementById('inputArea')?.value || '';
    const status = window.ASMTraceProvenance.status(trace, code, input);
    const kind = ['current', 'dirty', 'outdated'].includes(status.kind)
      ? status.kind
      : 'empty';
    const message = status.message || fallbackMessages[kind];
    indicator.textContent = '';
    indicator.dataset.status = kind;
    indicator.title = message;
    indicator.setAttribute('aria-label', `動畫狀態：${message}`);
    indicator.hidden = false;
  }
  // ---------------------------------------------------------------------------
  // 區段：合併式刷新排程
  // ---------------------------------------------------------------------------
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 120);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof aceEditor !== 'undefined') {
      aceEditor.on('change', schedule);
      aceEditor.on('changeSession', schedule);
    }
    document.getElementById('inputArea')?.addEventListener('input', schedule);
    refresh();
  });
  window.addEventListener('asm:trace-loaded', schedule);
  window.addEventListener('asm:compiled-animation', schedule);
  window.ASMTraceFreshness = { refresh };
})();
