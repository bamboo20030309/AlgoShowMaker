/**
 * 測試模組：pointer-layer.test
 *
 * 驗證重點：pointer layer.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('pointer hosts stay above styles and are not lifted into the cell effect layer', () => {
  const dom = new JSDOM('<svg><g id="root"><g id="arr"/><g id="pointer" class="asm-trace-bound-object"><g class="trace-variable-marker-point"/></g><g class="asm-trace-animation-effect-layer"/><g class="asm-trace-style-layer"/><g class="asm-trace-foreground-arrows"/></g></svg>', { runScripts: 'outside-only' });
  const { window } = dom;
  for (const file of ['trace-renderer.js', 'trace-frame-tween.js']) {
    window.eval(fs.readFileSync(path.join(__dirname, '../public', file), 'utf8'));
  }
  const root = window.document.getElementById('root');
  const pointer = window.document.getElementById('pointer');
  window.ASMTraceRenderers.settlePointerLayer(root);
  const layer = root.querySelector('.asm-trace-pointer-layer');
  assert.equal(pointer.parentNode, layer);
  assert.equal(layer.previousElementSibling.classList.contains('asm-trace-style-layer'), true);
  assert.equal(layer.nextElementSibling.classList.contains('asm-trace-foreground-arrows'), true);
  const effects = window.ASMTraceFrameTween.createAnimationEffectLayer(root);
  effects.sync([pointer]);
  assert.equal(pointer.parentNode, layer);
  effects.clear();
});
