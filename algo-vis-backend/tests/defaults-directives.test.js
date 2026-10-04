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

const defaults = `// @default
// @camera focus arr offset(0,20) zoom(2)
// @style arr[0] highlight AV_red
// @enddefault`;
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

test('defaults reject flow actions, nesting and mismatched terminators', () => {
  for (const action of ['keep last', 'exit arr', 'frame arr', 'layout recursion as tree']) {
    assert.throws(() => findFrameDirectives(source.replace('@camera focus arr offset(0,20) zoom(2)', `@${action}`)), /只支援呈現指令/);
  }
  assert.throws(() => findFrameDirectives(source.replace('@enddefault', '@endpreset')), /不相符/);
  assert.throws(() => findFrameDirectives(source.replace('@enddefault', '@default')), /不可巢狀/);
});

test('legacy plural defaults remain equivalent to singular default blocks', () => {
  const old = source.replace('@default\n', '@defaults\n').replace('@enddefault', '@enddefaults');
  const extract = code => findFrameDirectives(code).map(frame => ({ camera: frame.camera.mode,
    zoom: frame.camera.zoom, styles: frame.styles.map(s => s.color), objects: frame.objects.length }));
  assert.deepEqual(extract(old), extract(source));
});

test('singular default camera auto applies to an empty frame', async () => {
  const { trace } = await compile('// @default\n// @camera auto\n// @enddefault\nint main(){\n// @frame\nreturn 0;}');
  assert.equal(trace.frames.length, 1);
  assert.equal(trace.frames[0].camera.autoCapture, true);
  assert.equal(trace.frames[0].camera.zoom, .92);
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

test('legacy plural source loads, renders, saves and reopens without changing custom settings', { timeout: 30000 }, async () => {
  const { chromium } = require('playwright');
  const code = source.replace('@default\n', '@defaults\n').replace('@enddefault', '@enddefaults')
    + '\n/* @asm-view\n{"version":1,"rules":[],"skins":{},"studio":{"codePanelFontSize":20,"eventSettings":{"autoFixedEnabled":false}}}\n@asm-view */';
  const { trace } = await compile(code);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const result = await page.evaluate(async trace => {
      ASMTracePlayer.apply(trace);
      await ASMTracePlayer.render(0, { stable: true });
      const saved = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
      ASMTracePlayer.apply(saved);
      await ASMTracePlayer.render(2, { stable: true });
      const document = ASMTracePlayer.getDocument();
      return { source: document.sourceCode, font: document.studio.codePanelFontSize,
        disabled: document.studio.eventSettings.autoFixedEnabled === false,
        zooms: document.frames.map(f => f.camera.zoom), frame: ASMTracePlayer.getCurrentFrame() };
    }, trace);
    assert.equal(result.source, code);
    assert.equal(result.font, 20);
    assert.equal(result.disabled, true);
    assert.deepEqual(result.zooms, [2, 1.2, .92]);
    assert.equal(result.frame, 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
