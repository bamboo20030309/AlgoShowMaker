const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('matrix renderer works in the real browser SVG surface', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ASMTraceRenderers?.renderFrame);
    const result = await page.evaluate(async () => {
      const scalar = value => ({ kind: 'scalar', value });
      const grid = 'grid', i = 'i', j = 'j';
      const traceDocument = {
        variables: {
          [grid]: { id: grid, name: 'grid', kind: 'matrix' },
          [i]: { id: i, name: 'i', kind: 'scalar' },
          [j]: { id: j, name: 'j', kind: 'scalar' }
        },
        skins: { [grid]: { renderer: 'original-matrix', options: {
          rowLabels: { mode: 'custom', values: ['A', 'B'] },
          columnLabels: { mode: 'custom', values: ['X', 'Y'] },
          innerLabels: { mode: 'index', values: [] }, gridlines: 0,
          outerframe: false, markerLayout: 'inner'
        } } },
        snapshots: [], layouts: [], rules: [], studio: {}, frames: []
      };
      const frame = {
        id: 'matrix-browser', source: { primaryVariableId: grid },
        state: {
          [grid]: { name: 'grid', data: { kind: 'matrix', items: [
            { kind: 'sequence', items: [scalar(1), scalar(2)] },
            { kind: 'sequence', items: [scalar(3)] }
          ] } },
          [i]: { name: 'i', data: scalar(1) }, [j]: { name: 'j', data: scalar(0) }
        },
        events: [], bindings: [
          { mode: 'index', targetVariableId: grid, sourceVariableId: i, sourceVariableIds: [i], sourceName: 'i', indexExpression: 'i', indexDimension: 0 },
          { mode: 'index', targetVariableId: grid, sourceVariableId: j, sourceVariableIds: [j], sourceName: 'j', indexExpression: 'j', indexDimension: 1 }
        ],
        objectBindings: [], renderers: {}, rendererOptions: { [grid]: { markerLayout: 'inner' } },
        captureOnlyVariableIds: [i, j], texts: [], segments: [], arrows: [], snapshotIds: [],
        styles: [{ id: 'cell', targetVariableId: grid, selector: {
          type: 'matrix-cell', rowExpression: 'i', columnExpression: 'j'
        }, styleType: 'highlight', color: 'red' }]
      };
      traceDocument.frames.push(frame);
      await window.ASMTraceRenderers.renderFrame(traceDocument, frame, null, {
        animatePositions: false, animateEvents: false
      });
      return {
        cells: document.querySelectorAll('[data-trace-arrow-target-kind="matrix-cell"]').length,
        rowLabels: document.querySelectorAll('[data-trace-label-role="row"]').length,
        columnLabels: document.querySelectorAll('[data-trace-label-role="column"]').length,
        innerLabels: document.querySelectorAll('[data-trace-label-role="inner"]').length,
        markers: [...document.querySelectorAll('.trace-variable-marker-label-text')].map(node => node.textContent).sort(),
        cellStroke: document.querySelector('[data-trace-object-key="grid#1,0"] > rect')?.getAttribute('stroke'),
        innerStroke: document.querySelector('[data-trace-object-key="grid#1,0:index"] > rect')?.getAttribute('stroke'),
        rowStroke: document.querySelector('[data-trace-object-key="grid:row-label:1"] > rect')?.getAttribute('stroke'),
        outerframe: Boolean(document.querySelector('.trace-matrix-outerframe'))
      };
    });
    assert.deepEqual(result, {
      cells: 3, rowLabels: 2, columnLabels: 2, innerLabels: 3,
      markers: ['i', 'j'], cellStroke: 'red', innerStroke: 'red',
      rowStroke: '#59656b', outerframe: false
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
