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
