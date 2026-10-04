/**
 * 測試模組：provenance.test
 *
 * 驗證重點：provenance.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('../public/trace-provenance');
const trace = () => ({ schemaVersion: '1.0', frames: [{}], provenance: api.create('int x = 1;\n', '1\n') });
// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('source/input changes, undo and saved JSON retain generation identity', () => {
  const t = JSON.parse(JSON.stringify(trace()));
  assert.equal(api.status(t, 'int x = 1;\n', '1\n').kind, 'current');
  assert.equal(api.status(t, 'int x = 2;\n', '1\n').kind, 'dirty');
  assert.equal(api.status(t, 'int x = 1;\n', '2\n').kind, 'dirty');
  assert.equal(api.status(t, 'int x = 1;\n', '1\n').kind, 'current');
});
test('Studio settings and CRLF do not demand another RUN', () => {
  assert.equal(api.status(trace(), 'int x = 1;\r\n\r\n/* @asm-view\r\n{}\r\n@asm-view */\r\n', '1\n').kind, 'current');
  assert.equal(api.status(trace(), 'int x = 1;', '1\r\n').kind, 'dirty', 'stdin is byte-sensitive');
});
test('multiple view blocks cannot hide executable source changes', () => {
  const code = 'int x = 1;\n/* @asm-view\n{}\n@asm-view */\nint y = 2;\n/* @asm-view\n{}\n@asm-view */';
  const t = { ...trace(), provenance: api.create(code, '') };
  assert.equal(api.status(t, code.replace('y = 2', 'y = 3'), '').kind, 'dirty');
});
test('old, future, incomplete and unknown-format traces warn without mutation', () => {
  for (const t of [{ frames: [{}] }, { ...trace(), provenance: {} },
    { ...trace(), schemaVersion: '2.0' },
    { ...trace(), provenance: { ...trace().provenance, engineVersion: 999 } }]) {
    const before = JSON.stringify(t);
    assert.equal(api.status(t, 'int x = 1;', '1\n').kind, 'outdated');
    assert.equal(JSON.stringify(t), before);
  }
  assert.equal(api.status(null, '', '').kind, 'empty');
});
test('the previous engine generation is outdated when boundary events are restored', () => {
  const previous = trace();
  previous.provenance.engineVersion = 10;
  assert.equal(api.status(previous, 'int x = 1;\n', '1\n').kind, 'outdated');
});
test('pre-shift traces need RUN to obtain shift metadata without changing saved settings', () => {
  const previous = trace();
  previous.provenance.engineVersion = 11;
  previous.studio = { eventSettings: { autoFixedEnabled: false } };
  const before = JSON.stringify(previous);
  assert.equal(api.status(previous, 'int x = 1;\n', '1\n').kind, 'outdated');
  assert.equal(JSON.stringify(previous), before);
});
