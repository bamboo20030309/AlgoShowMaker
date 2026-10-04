/**
 * 測試模組：defaults-directives.test
 *
 * 驗證重點：defaults directives.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findFrameDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const defaults = `// @defaults
// @camera focus arr offset(0,20) zoom(2)
// @style arr[0] highlight AV_red
// @enddefaults`;
const source = `${defaults}
// @preset close_view
// @camera auto zoom(1.2)
// @style arr[0] highlight AV_green
// @endpreset
int main() {
 int arr[2] = {1,2};
 // @frame arr
 // @frame use close_view
 // @object arr
 // @frame arr
 // @camera auto
}`;

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('defaults apply to every frame below presets and local directives', () => {
  const frames = findFrameDirectives(source);
  assert.equal(frames.length, 3);
  assert.deepEqual(frames.map(frame => frame.camera.zoom), [2, 1.2, 0.92]);
  assert.deepEqual(frames.map(frame => frame.camera.autoCapture), [false, true, true]);
  assert.equal(frames[0].styles[0].color, 'AV_red');
  assert.equal(frames[1].styles.at(-1).color, 'AV_green');
  assert.deepEqual(frames[0].presetNames, []);
  assert.equal(frames[0].camera.target.variableId, frames[0].objects[0].primaryVariableId);
});

test('removing defaults leaves no camera or style in a new analysis', () => {
  findFrameDirectives(source);
  const [frame] = findFrameDirectives(source.replace(defaults, ''));
  assert.equal(frame.camera, null);
  assert.deepEqual(frame.styles, []);
});

test('defaults resolve same-named recursive parameters at the frame site', () => {
  const frames = findFrameDirectives(`${defaults}
void visit(int *arr, int depth) {
 // @frame arr
 if (depth) visit(arr, depth-1);
}
int main() {
 int arr[2] = {1,2};
 // @frame arr
 visit(arr,1);
}`);
  assert.notEqual(frames[0].camera.target.variableId, frames[1].camera.target.variableId);
  frames.forEach(frame => assert.equal(frame.camera.target.variableId, frame.objects[0].primaryVariableId));
});

test('a bare frame is a scene checkpoint and local camera overrides defaults', () => {
  const frames = findFrameDirectives(`// @defaults
// @camera focus board
// @enddefaults
int board[1] = {1};
int main() {
 // @frame board
 // @keep board as saved
 // @frame
 // @camera auto
 // @text "overview" at canvas.top
}`);
  assert.equal(frames.length, 2);
  assert.equal(frames[1].objects.length, 0);
  assert.equal(frames[1].frameSpec, '');
  assert.equal(frames[1].camera.autoCapture, true);
  assert.equal(frames[1].camera.target, null);
  assert.equal(frames[1].texts.length, 1);

  const [empty] = findFrameDirectives('int main() {\n // @frame\n}');
  assert.equal(empty.objects.length, 0, 'a checkpoint is also valid before any keep exists');

  for (const modifier of ['as view', 'in tree', 'at canvas.center', 'render matrix', 'with columns(2)']) {
    assert.throws(
      () => findFrameDirectives(`int main() {\n // @frame ${modifier}\n}`),
      /\u7a7a\u767d @frame \u4e0d\u652f\u63f4\u7269\u4ef6\u8a2d\u5b9a|\u7f3a\u5c11\u7269\u4ef6/
    );
  }
});

test('defaults reject flow actions, nesting and mismatched terminators', () => {
  for (const action of ['keep last', 'exit arr', 'frame arr', 'layout recursion as tree']) {
    assert.throws(() => findFrameDirectives(source.replace('@camera focus arr offset(0,20) zoom(2)', `@${action}`)), /只支援呈現指令/);
  }
  assert.throws(() => findFrameDirectives(source.replace('@enddefaults', '@endpreset')), /不相符/);
  assert.throws(() => findFrameDirectives(source.replace('@enddefaults', '@defaults')), /不可巢狀/);
});

test('compiled defaults preserve the shared frame camera and presentation settings', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { trace } = await compile(fs.readFileSync(path.join(__dirname, 'fixtures/defaults.cpp'), 'utf8'));
  assert.equal(trace.frames.length, 3);
  assert.deepEqual(Array.from(trace.frames, frame => frame.camera.zoom), [2, 1.2, 0.92]);
  assert.deepEqual(Array.from(trace.frames, frame => frame.camera.autoCapture), [false, true, true]);
  assert.ok(trace.frames.every(frame => frame.styles.length > 0));
});
