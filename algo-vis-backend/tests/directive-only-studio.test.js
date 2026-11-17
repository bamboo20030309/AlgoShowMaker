/**
 * 測試模組：directive-only-studio.test
 *
 * 驗證重點：動畫完全由指令驅動（2026-11-14）。Trace Studio 的手動調整（位置、綁定、自訂物件、
 *           箭頭、物件樣式、逐幀顯示、鏡頭、幀間動畫、跨幀規則）在載入、套用 @asm-view、
 *           寫回與存檔時一律捨棄；事件與程式碼片段設定照常保留。
 * 執行環境：Node（vm 載入 trace-model.js；require trace-view-source.js），不需瀏覽器或編譯器。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ViewSource = require('../public/trace-view-source');

function loadModel() {
  const context = vm.createContext({});
  context.window = context;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-model.js'), 'utf8'), context);
  return context.ASMTraceModel;
}

const KEPT = {
  eventSettings: { eventGapMs: 0, autoFixedEnabled: false },
  eventStates: { f1: { compare: false } },
  eventInstructionStates: { 'line:7': false },
  eventColors: { compare: '#123456' },
  codeSnippetOverrides: { f1: { visible: false } },
  codeSnippetSourceOverrides: { 'line:3': { included: false } },
  codePanelFontSize: 15,
  codePanelScrollMs: 400,
  codePanelPosition: 'right'
};
const MANUAL = {
  positions: { f1: { 'var:arr': { x: 10, y: 20 } } },
  bindings: { f1: { 'var:i': { target: 'var:arr' } } },
  objects: [{ id: 'note', type: 'text', text: '手動文字' }],
  arrows: [{ id: 'a1', from: 'var:i', to: 'var:arr' }],
  objectStyles: { f1: { 'var:arr': { fill: '#ff0000' } } },
  visibility: { f1: { 'var:j': 'hidden' } },
  cameraRules: [{ id: 'cam', allFrames: true, autoCapture: false, zoom: 2 }],
  transitions: [{ id: 't1', mode: 'none' }],
  transitionDefaults: { mode: 'instant' }
};
const STYLE_RULE = { id: 'studio-style-x', name: 'arr · background', match: { frameIds: ['f1'] }, actions: [{ type: 'style' }] };

test('trace-model and trace-view-source drop the same manual Studio fields', () => {
  const model = loadModel();
  assert.deepEqual([...model.MANUAL_STUDIO_KEYS].sort(), [...ViewSource.MANUAL_STUDIO_KEYS].sort());
  assert.deepEqual([...model.MANUAL_STUDIO_KEYS].sort(), Object.keys(MANUAL).sort());
});

test('settings that are not manual adjustments survive, including ones added later', () => {
  const model = loadModel();
  const trace = model.normalizeTraceDocument({ frames: [], studio: { ...MANUAL, futureSetting: { a: 1 } } });
  assert.deepEqual(JSON.parse(JSON.stringify(trace.studio)), { futureSetting: { a: 1 } });
});

test('normalizing a saved trace drops manual adjustments and keeps event and code settings', () => {
  const model = loadModel();
  const trace = model.normalizeTraceDocument({
    frames: [{ id: 'f1', state: {} }],
    rules: [STYLE_RULE],
    studio: { ...KEPT, ...MANUAL },
    asmView: { version: 1, rules: [STYLE_RULE], studio: { ...KEPT, ...MANUAL } }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(trace.studio)), KEPT);
  assert.deepEqual(JSON.parse(JSON.stringify(trace.rules)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(trace.asmView.studio)), KEPT);
  assert.deepEqual(JSON.parse(JSON.stringify(trace.asmView.rules)), []);
});

test('@asm-view settings apply only event and code settings, including compressed frame maps', () => {
  const trace = { frames: [{ id: 'f1', source: {}, state: {} }], studio: {}, rules: [STYLE_RULE], skins: {} };
  const settings = ViewSource.fromTrace({ frames: trace.frames, studio: { ...KEPT, ...MANUAL }, rules: [STYLE_RULE], skins: {} });
  // Writing back never emits manual fields or rules.
  for (const key of Object.keys(MANUAL)) assert.equal(key in (settings.studio || {}), false, `written ${key}`);
  assert.deepEqual(Object.keys(settings.studio.frameMaps || {}).sort(), ['codeSnippetOverrides', 'eventStates']);
  assert.deepEqual(settings.rules, []);
  // An old block that still carries manual data is ignored on load.
  const old = { version: 1, rules: [STYLE_RULE], studio: { ...settings.studio, ...MANUAL,
    frameMaps: { ...settings.studio.frameMaps, positions: { f1: MANUAL.positions.f1 } } } };
  ViewSource.applyToTrace(trace, old);
  assert.deepEqual(trace.rules, []);
  for (const key of Object.keys(MANUAL)) {
    const value = trace.studio[key];
    assert.ok(value == null || (Array.isArray(value) ? !value.length : !Object.keys(value).length), `applied ${key}`);
  }
  assert.ok(trace.studio.eventSettings, 'event settings kept');
  assert.equal(trace.studio.eventInstructionStates['line:7'], false);
  assert.equal(trace.studio.codePanelFontSize, 15);
  assert.ok(trace.studio.eventStates?.f1, 'per-frame event states decoded');
  assert.ok(trace.studio.codeSnippetOverrides?.f1, 'per-frame code snippet overrides decoded');
});

test('saving a trace removes manual adjustments', () => {
  const saved = ViewSource.compactTraceForSave({ frames: [{ id: 'f1' }], rules: [STYLE_RULE], skins: {},
    studio: { ...KEPT, ...MANUAL } });
  assert.deepEqual(saved.rules, []);
  for (const key of Object.keys(MANUAL)) assert.equal(key in saved.studio, false, `saved ${key}`);
  assert.equal(saved.studio.codePanelPosition, 'right');
});

test('the server no longer copies manual Studio data into new traces', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(source, /rules: \[\],\n\s*studio: TraceViewSource\.directiveStudio\(asmView\.studio\),/);
});

test('an @asm-view without Studio settings never gains an empty studio that would hide saved event settings', () => {
  const model = loadModel();
  const trace = model.normalizeTraceDocument({ frames: [], studio: { eventSettings: { autoFixedEnabled: false } },
    asmView: { version: 1, skins: {} } });
  assert.equal('studio' in trace.asmView, false);
  assert.equal('rules' in trace.asmView, false);
  assert.equal(trace.studio.eventSettings.autoFixedEnabled, false);
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(source, /if \(view\.studio && typeof view\.studio === 'object'\) view\.studio = TraceViewSource\.directiveStudio\(view\.studio\);/);
});
