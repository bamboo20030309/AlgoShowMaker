/**
 * 測試模組：uninitialized-style.test
 *
 * 驗證重點：uninitialized style.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { load } = require('./helpers/compile');

function setup() {
  const window = vm.createContext({ queueMicrotask() {} });
  window.window = window;
  load(window, 'trace-model.js');
  load(window, 'trace-rules.js');
  const scalar = value => ({ kind: 'scalar', value });
  const frame = { id: 'frame-0', events: [], state: {
    i: { name: 'i', data: scalar(null) },
    arr: { name: 'arr', data: { kind: 'sequence', items: [0, 5, 8, 2].map(scalar) } }
  }, styles: [] };
  return { window, frame, document: { frames: [frame], variables: {} }, scalar };
}

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('unknown values propagate through expressions without coercing to zero or throwing', () => {
  const { window, frame, document, scalar } = setup();
  for (const expression of ['i', '+i', '-i', '!i', 'i*2+1', 'arr[i]', 'i==0', 'i<1', 'true || i']) {
    assert.equal(window.ASMTraceRules.resolveExpression(document, frame, expression), null, expression);
  }
  assert.equal(window.ASMTraceRules.resolveExpression(document, frame, 'value<=5', { value: null }), null);
  frame.state.i.data = scalar(0);
  assert.equal(window.ASMTraceRules.resolveExpression(document, frame, 'i*2+1'), 1);
  assert.equal(window.ASMTraceRules.resolveExpression(document, frame, 'i==0'), true);
  assert.equal(window.ASMTraceRules.resolveExpression(document, frame, '!i'), true);
});

test('style waits for valid selector and condition values, then immediately evaluates again', () => {
  const { window, frame, document, scalar } = setup();
  for (const selector of [
    { type: 'index', indexExpression: 'i' },
    { type: 'index', indexExpression: 'i*2+1' },
    { type: 'range', startExpression: '0', endExpression: 'i', endInclusive: true },
    { type: 'index', indexExpression: '1' }
  ]) {
    frame.styles = [{ targetVariableId: 'arr', selector, styleType: 'highlight', color: 'red', when: 'i==0' }];
    frame.state.i.data = scalar(null);
    assert.equal(Object.keys(window.ASMTraceRules.evaluate(document, frame).arr || {}).length, 0);
    frame.state.i.data = scalar(0);
    assert.equal(Object.keys(window.ASMTraceRules.evaluate(document, frame).arr || {}).length, 1);
  }
  frame.state.i.data = scalar(null);
  frame.styles[0].when = null;
  frame.styles[0].selector = { type: 'index', indexExpression: 'i*2+1' };
  assert.equal(Object.keys(window.ASMTraceRules.evaluate(document, frame).arr || {}).length, 0);
});
