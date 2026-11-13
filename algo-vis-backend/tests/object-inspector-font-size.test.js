/**
 * 測試模組：object-inspector-font-size.test
 *
 * 驗證重點：object inspector font size.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const publicPath = name => path.join(__dirname, '../public', name);

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('renderer applies a selected object font size to all text inside that object', () => {
  const source = fs.readFileSync(publicPath('trace-renderer.js'), 'utf8')
    .replace('window.ASMTraceRenderers = {',
      'window.ASMTraceRenderers = { applyObjectColorStyles,');
  const dom = new JSDOM(`<!doctype html><svg>
    <g id="arr"><text font-size="12">3</text><text font-size="8">0</text></g>
  </svg>`, { runScripts: 'outside-only' });
  const context = vm.createContext({
    window: dom.window,
    document: dom.window.document,
    CSS: dom.window.CSS
  });
  vm.runInContext(source, context);
  const element = dom.window.document.getElementById('arr');
  context.window.ASMTraceRenderers.applyObjectColorStyles({
    studio: { objectStyles: { frame1: { arr: { fontSize: 22 } } } }
  }, { id: 'frame1' }, new Map([['arr', element]]));

  assert.deepEqual([...element.querySelectorAll('text')].map(text => text.getAttribute('font-size')),
    ['22', '22']);
});

test('text object font size scales its complete bubble geometry proportionally', () => {
  const source = fs.readFileSync(publicPath('trace-renderer.js'), 'utf8')
    .replace('window.ASMTraceRenderers = {',
      'window.ASMTraceRenderers = { renderFrameTexts, applyObjectColorStyles,');
  const dom = new JSDOM('<!doctype html><svg><g id="root"></g></svg>', {
    runScripts: 'outside-only'
  });
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    font: '', measureText(value) { return { width: String(value).length * 6 }; }
  });
  dom.window.ASMTraceRules = {
    textExpressionMatches() { return true; },
    resolveExpression() { return null; }
  };
  dom.window.parseTTSMarkup = value => ({ display: String(value), speech: String(value) });
  const context = vm.createContext({
    window: dom.window,
    document: dom.window.document,
    CSS: dom.window.CSS,
    CustomEvent: dom.window.CustomEvent
  });
  vm.runInContext(source, context);
  const root = dom.window.document.getElementById('root');
  const placements = new Map();
  const elements = new Map();
  const trace = {
    studio: {
      positions: {},
      objectStyles: { frame1: { 'text:note:segment:s0': { fontSize: 20 } } }
    }
  };
  const frame = {
    id: 'frame1',
    texts: [{
      id: 'note',
      segments: [{ kind: 'literal', segmentId: 's0', text: 'hello', fontSize: 10, background: 'AV_green!' }]
    }]
  };

  context.window.ASMTraceRenderers.renderFrameTexts(
    root, trace, frame, 0, placements, elements, { interactive: false }
  );
  const object = elements.get('text:note');
  const bubble = object.querySelector(':scope > .asm-trace-motion > rect');
  const text = object.querySelector('.asm-trace-text-segment-value');
  const segmentBackground = object.querySelector('.asm-trace-text-segment-background');
  const pointer = object.querySelector(':scope > .asm-trace-motion > path');

  assert.equal(object.dataset.traceTextScale, '2');
  assert.equal(text.getAttribute('font-size'), '20');
  assert.equal(segmentBackground.getAttribute('fill'), '#a5d6a7');
  assert.equal(bubble.getAttribute('rx'), '12');
  assert.equal(bubble.getAttribute('stroke-width'), '2.4');
  assert.match(pointer.getAttribute('d'), /L [\d.]+ [\d.]+/);
  assert.equal(placements.get('text:note').height,
    Number(bubble.getAttribute('height')) + 10);

  context.window.ASMTraceRenderers.applyObjectColorStyles(trace, frame, elements);
  assert.equal(text.getAttribute('font-size'), '20',
    'the post-layout style pass must not resize only the glyphs');
});
