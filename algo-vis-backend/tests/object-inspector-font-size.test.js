const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const publicPath = name => path.join(__dirname, '../public', name);

test('same-frame font previews retain whole text and segment selections', () => {
  const source = fs.readFileSync(publicPath('trace-studio.js'), 'utf8')
    .replace('window.ASMTraceStudio = {', `window.ASMTraceStudio = {
      textSelectionExists,
      setTestFrame(frame) { trace = { frames: [frame] }; currentIndex = 0; },`);
  const dom = new JSDOM('<!doctype html>', { runScripts: 'outside-only' });
  vm.runInContext(source, vm.createContext({
    window: dom.window, document: dom.window.document
  }));
  const studio = dom.window.ASMTraceStudio;
  studio.setTestFrame({ texts: [{ id: 'line-6', segments: [{ segmentId: 's0' }] }] });
  assert.equal(studio.textSelectionExists('text:line-6'), true);
  assert.equal(studio.textSelectionExists('text:line-6:segment:s0'), true);
  assert.equal(studio.textSelectionExists('text:line-6:segment:s0:range:0-2'), true);
  assert.equal(studio.textSelectionExists('text:line-6:segment:missing'), false);
  studio.setTestFrame({ texts: [] });
  assert.equal(studio.textSelectionExists('text:line-6'), false,
    'a genuinely absent bubble on another frame must still clear selection');
});

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
      segments: [{ kind: 'literal', segmentId: 's0', text: 'hello', fontSize: 10 }]
    }]
  };

  context.window.ASMTraceRenderers.renderFrameTexts(
    root, trace, frame, 0, placements, elements, { interactive: false }
  );
  const object = elements.get('text:note');
  const bubble = object.querySelector(':scope > .asm-trace-motion > rect');
  const text = object.querySelector('.asm-trace-text-segment-value');
  const pointer = object.querySelector(':scope > .asm-trace-motion > path');

  assert.equal(object.dataset.traceTextScale, '2');
  assert.equal(text.getAttribute('font-size'), '20');
  assert.equal(bubble.getAttribute('rx'), '12');
  assert.equal(bubble.getAttribute('stroke-width'), '2.4');
  assert.match(pointer.getAttribute('d'), /L [\d.]+ [\d.]+/);
  assert.equal(placements.get('text:note').height,
    Number(bubble.getAttribute('height')) + 10);

  context.window.ASMTraceRenderers.applyObjectColorStyles(trace, frame, elements);
  assert.equal(text.getAttribute('font-size'), '20',
    'the post-layout style pass must not resize only the glyphs');
});

test('Trace Studio exposes object font size and keeps code settings selection-specific', () => {
  const studio = fs.readFileSync(publicPath('trace-studio.js'), 'utf8');
  const css = fs.readFileSync(publicPath('trace-studio.css'), 'utf8');

  assert.match(studio, /setAttribute\('aria-label', '物件文字大小'\)/);
  assert.match(studio, /fontSize:\s*Math\.max|next\.fontSize\s*=/);
  assert.match(studio, /codePanel\.dataset\.traceCodeControls\s*=\s*'1'/);
  assert.match(studio, /styleEditor\.dataset\.traceObjectControls\s*=\s*'1'/);
  assert.match(css,
    /:not\(\.is-code-panel-selection\)\s*>\s*\[data-trace-code-controls\]/,
    'code-panel controls must be hidden while another canvas object is selected');
  assert.match(css,
    /\.is-code-panel-selection\s*>\s*\.trace-studio-section:not\(\[data-trace-code-controls\]\)/,
    'ordinary object controls must be hidden while the code panel is selected');
});
