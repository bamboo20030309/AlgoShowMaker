'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

// Establish timing/heap evidence rather than inventing an absolute ms budget.
// Hard gates protect observable lifecycle: exactly one current root, old DOM
// disconnected, and old source IDs gone after every program replacement.
test('repeated program replacement releases old scene DOM and records a GC heap baseline', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const start = Date.now();
  await page.goto(`${base}/algorithm.html`);
  await page.waitForFunction(() => ASMTracePlayer?.getDocument()?.frames?.length > 0
    && document.querySelector('#asm-trace-root [data-trace-variable]'));
  const firstFrameReadyMs = Date.now() - start;
  await page.waitForFunction(() => ASMTracePlayer?.getDocument()?.frames?.length === 116);
  const firstReadyMs = Date.now() - start;
  const cdp = await page.context().newCDPSession(page);
  const samples = [];
  for (let batch = 0; batch < 6; batch++) {
    const state = await page.evaluate(async batch => {
      let oldRoot = null, oldCells = [];
      for (let i = 0; i < 10; i++) {
        const variable = `scene_${batch}_${i}`;
        const trace = { schemaVersion: '1.0', sourceCode: `int ${variable}=1;`,
          variables: { [variable]: { id: variable, name: variable, kind: 'sequence', functionName: 'main' } },
          frames: [{ id: variable, source: { variableIds: [variable], primaryVariableId: variable },
            state: { [variable]: { data: { kind: 'sequence', items: Array.from({length:16}, (_,value) => ({ kind:'scalar', value })) } } }, events: [] }] };
        oldRoot = document.querySelector('#asm-trace-root');
        oldCells = [...(oldRoot?.querySelectorAll('[data-trace-index]') || [])];
        ASMTracePlayer.apply(trace); await ASMTracePlayer.renderStable(0);
        if (oldCells.some(cell => cell.isConnected)) throw new Error('replaced program still owns connected cells');
        const roots = document.querySelectorAll('#asm-trace-root');
        if (roots.length !== 1) throw new Error(`unexpected scene root count: ${roots.length}`);
        const current = roots[0];
        if (![...current.querySelectorAll('[data-trace-variable]')].every(el => el.dataset.traceVariable === variable))
          throw new Error('previous program variables leaked into current scene');
      }
      return { nodes: document.querySelector('#asm-trace-root').querySelectorAll('*').length, cells: document.querySelectorAll('#asm-trace-root [data-trace-index]').length };
    }, batch);
    assert.equal(state.cells, 16, 'current program has exactly its own cells');
    if (samples.length) assert.equal(state.nodes, samples[0].nodes, 'scene DOM remains bounded across 60 replacements');
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    samples.push({ replacements: (batch + 1) * 10, ...state, usedHeapBytes: heap.usedSize });
  }
  assert.deepEqual(errors, []);
  const directory = path.join(__dirname, '../test-results/performance'); fs.mkdirSync(directory, { recursive: true });
  const report = { recordedAt: new Date().toISOString(), node: process.version, userAgent: await page.evaluate(() => navigator.userAgent),
    firstFrameReadyMs, firstFullTraceReadyMs: firstReadyMs, samples, timingBudget: 'baseline-only; no uncalibrated timing/heap gate' };
  fs.writeFileSync(path.join(directory, `scene-lifecycle-${process.pid}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
});
