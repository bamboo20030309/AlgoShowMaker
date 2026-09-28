/**
 * 模組：Trace 來源識別
 *
 * 責任：計算影響 trace 的來源碼與設定摘要，用來判斷已儲存動畫是否可直接沿用。
 * 資料流：把具語意的輸入正規化後建立穩定序列，再比較文件 provenance 與目前編輯內容。
 * 重要不變條件：摘要只納入會改變分析結果的資料；物件鍵順序或無關 UI 狀態不得造成誤判。
 * 相容性：舊文件缺少 provenance 時視為無法證明新鮮，由上層決定提示或重新分析。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMTraceProvenance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Bump ENGINE_VERSION when newly generated events/state require a new RUN.
  // Renderer-only improvements do not invalidate saved trace data.
  const ENGINE_VERSION = 10;
  const FORMAT_VERSION = 1;
  const text = value => String(value ?? '').replace(/\r\n?/g, '\n');
  // ---------------------------------------------------------------------------
  // 區段：可執行來源正規化
  // ---------------------------------------------------------------------------
  function sourceText(code) {
    // Only the trailing Studio settings block is non-executable metadata.
    const source = text(code);
    const block = /\/\*\s*@asm-view\s*\n[\s\S]*?\n\s*@asm-view\s*\*\//.exec(source);
    return block && !source.slice(block.index + block[0].length).trim()
      ? source.slice(0, block.index).trimEnd() : source.trimEnd();
  }
  // ---------------------------------------------------------------------------
  // 區段：穩定變更摘要
  // ---------------------------------------------------------------------------
  function fingerprint(value) {
    // Change detector, not a security/integrity hash.
    let a = 2166136261, b = 5381;
    for (const character of value) {
      const n = character.codePointAt(0);
      a = Math.imul(a ^ n, 16777619);
      b = Math.imul(b, 33) ^ n;
    }
    return [value.length, a >>> 0, b >>> 0].join(':');
  }
  // ---------------------------------------------------------------------------
  // 區段：來源證明建立與狀態比較
  // ---------------------------------------------------------------------------
  function create(code, input) {
    return { engineVersion: ENGINE_VERSION, formatVersion: FORMAT_VERSION,
      sourceFingerprint: fingerprint(sourceText(code)), inputFingerprint: fingerprint(String(input ?? '')) };
  }
  function status(trace, code, input) {
    if (!trace?.frames?.length) return { kind: 'empty', message: '' };
    const saved = trace.provenance;
    const current = create(code, input);
    if (saved?.sourceFingerprint && saved?.inputFingerprint &&
        (saved.sourceFingerprint !== current.sourceFingerprint || saved.inputFingerprint !== current.inputFingerprint)) {
      return { kind: 'dirty', message: '程式或輸入已修改，動畫尚未更新。請 RUN 後再儲存；目前播放的是上次執行結果。' };
    }
    if (!saved || saved.engineVersion !== ENGINE_VERSION || saved.formatVersion !== FORMAT_VERSION ||
        trace.schemaVersion !== '1.0' || !saved.sourceFingerprint || !saved.inputFingerprint) {
      return { kind: 'outdated', message: '動畫資料版本過舊或無法確認相容性。請在編輯器重新 RUN 後儲存；目前仍保留原動畫。' };
    }
    return { kind: 'current', message: '' };
  }
  return { ENGINE_VERSION, FORMAT_VERSION, create, status, sourceText };
});
