/**
 * 測試模組：code-exit-presentation.test
 *
 * 驗證重點：code exit presentation.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { load } = require('./helpers/compile');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('code scroll stays at zero when content fits and clamps taller content to its edges', () => {
  const context = vm.createContext({ addEventListener() {} });
  context.window = context;
  load(context, 'trace-code-presenter.js');
  const offset = context.ASMTraceCodePresenter.boundedScrollOffset;
  assert.equal(offset(349, 620, -137), 0);
  assert.equal(offset(620, 620, -200), 0);
  assert.equal(offset(1000, 620, -137), -137);
  assert.equal(offset(1000, 620, -900), -380);
  assert.equal(offset(1000, 620, 200), 0);
});

test('single omitted lines are filled only between relevant lines, not at fragment boundaries', () => {
  const context = vm.createContext({});
  context.window = context;
  load(context, 'trace-code-model.js');
  const sourceCode = [
    'int main() {',
    '  cout << "before";',
    '  quick_sort(arr, 0, n - 1);',
    '  cout << "between";',
    '  consume(arr);',
    '  for (int i=0; i<n; i++) cout << arr[i];',
    '  return 0;',
    '}'
  ].join('\n');
  const call = (id, line, expression) => ({ id, type: 'call', line, expression, functionName: 'main' });
  const plan = context.ASMTraceCodeModel.planFrame({ sourceCode }, {
    id: 'calls', events: [call('sort', 3, 'quick_sort(arr, 0, n - 1)'), call('consume', 5, 'consume(arr)')]
  });
  const numbers = plan.fragments.flatMap(fragment => fragment.items)
    .filter(item => item.kind === 'line').map(item => item.number);
  assert.ok(numbers.includes(4), 'one intervening line remains visible');
  assert.ok(!numbers.includes(2), 'unrelated prefix is not filled');
  assert.ok(!numbers.includes(6), 'unexecuted output loop is not filled');
});

test('scope exits neither extract nor highlight code, without changing runtime events', () => {
  const context = vm.createContext({});
  context.window = context;
  load(context, 'trace-code-model.js');
  const sourceCode = 'int main() {\n  int n = 2;\n  for (int i = 0; i < n; i++) {\n    n--;\n  }\n}\n';
  const exit = { id: 'exit-i', type: 'scope-exit', line: 5, expression: 'i' };
  const frame = { id: 'end', source: { line: 6, functionName: 'main' }, events: [exit] };
  const document = { sourceCode };
  assert.equal(context.ASMTraceCodeModel.planFrame(document, frame).fragments.length, 0);
  assert.equal(context.ASMTraceCodeModel.planFrame(document, {
    ...frame, events: [{ ...exit, type: 'function-exit' }]
  }).fragments.length, 0);
  assert.equal(context.ASMTraceCodeModel.planFrame(document, {
    ...frame, events: [{ ...exit, type: 'visual-exit' }]
  }).fragments.length, 0);
  assert.equal(frame.events[0], exit, 'exit remains available to playback and Studio');
  const write = { id: 'write-n', type: 'write', line: 4, expression: 'n--' };
  const mixed = context.ASMTraceCodeModel.planFrame(document, { ...frame, events: [write, exit] });
  const items = mixed.fragments.flatMap(fragment => fragment.items);
  assert.ok(items.some(item => item.kind === 'line' && item.number === 5 && item.text.trim() === '}'));
  const ids = items.flatMap(item => item.segments || []).flatMap(segment => segment.eventIds);
  assert.ok(ids.includes(write.id));
  assert.ok(!ids.includes(exit.id));
});

test('return is code-visible while return completion stays internal', () => {
  const context = vm.createContext({});
  context.window = context;
  load(context, 'trace-code-model.js');
  const sourceCode = 'int F(int n) {\n  return n;\n}\n';
  const visible = {
    id: 'return-start', type: 'return', line: 2,
    source: { line: 2, from: 17, to: 26, text: 'return n;' }
  };
  const internal = { ...visible, id: 'return-complete', type: 'return-complete' };
  const visiblePlan = context.ASMTraceCodeModel.planFrame(
    { sourceCode }, { id: 'return-frame', source: { line: 2, function: 'F' }, events: [visible] }
  );
  const visibleIds = visiblePlan.fragments.flatMap(fragment => fragment.items)
    .flatMap(item => item.segments || []).flatMap(segment => segment.eventIds);
  assert.ok(visibleIds.includes(visible.id));
  assert.equal(context.ASMTraceCodeModel.planFrame(
    { sourceCode }, { id: 'complete-frame', source: { line: 2, function: 'F' }, events: [internal] }
  ).fragments.length, 0);
});
