const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('prefix sum frame 48 animates all four matrix sources together', { timeout: 45000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Basic/prefix_sum_2D.cpp'
  ), 'utf8');
  const input = fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Basic/prefix_sum_2D-sample_input.txt'
  ), 'utf8');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/algorithm.html`);
    await page.waitForFunction(() => window.ASMTraceRenderers && window.ASMTraceModel);
    const result = await page.evaluate(async ({ code: source, input: stdin }) => {
      const analyzed = await fetch('/trace/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: source })
      }).then(response => response.json());
      const watches = [...new Set(analyzed.frameDirectives.flatMap(frame => frame.variableIds))];
      const compiled = await fetch('/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: source,
          input: stdin,
          trace: { enabled: true, watches, sliceMode: 'manual' }
        })
      }).then(response => response.json());
      const trace = window.ASMTraceModel.normalizeTraceDocument(
        compiled.traceDocument || compiled.trace
      );
      const previous = trace.frames[46];
      const frame = trace.frames[47];
      const preId = Object.entries(trace.variables)
        .find(([, variable]) => variable.name === 'pre')?.[0];
      const assignment = frame.events.find(event => (
        event.type === 'assign' && event.multiSourceArithmetic === true
      ));
      await window.ASMTraceRenderers.renderFrame(trace, previous, null, {
        animatePositions: false,
        animateEvents: false
      });
      window.asmGetAnimationPlaybackRate = () => 2;
      const transferSamples = new Set();
      const targetPaints = new Set();
      let settled = false;
      const transition = window.ASMTraceRenderers.renderFrame(trace, frame, previous, {
        direction: 1,
        animatePositions: true,
        animateEvents: true
      }).finally(() => { settled = true; });
      for (let count = 0; count < 900 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const values = [...document.querySelectorAll('.asm-trace-assign-transfer-value text')]
          .map(node => node.textContent).sort();
        if (values.length) transferSamples.add(JSON.stringify(values));
        const matrix = document.querySelector(`[data-trace-variable="${preId}"]`);
        const rect = [...matrix?.querySelectorAll?.('[data-trace-index="4,2"]') || []]
          .find(cell => cell.querySelector(':scope > text[data-trace-content-role="value"]'))
          ?.querySelector(':scope > rect');
        if (rect) targetPaints.add(JSON.stringify({
          fill: rect.getAttribute('fill'),
          stroke: rect.getAttribute('stroke')
        }));
      }
      await transition;
      return {
        assignment: assignment && {
          expression: assignment.expression,
          operators: assignment.targets.slice(1).map(target => target.arithmeticOperator),
          indices: assignment.targets.slice(1).map(target => target.resolvedIndices)
        },
        transferSamples: [...transferSamples],
        targetPaints: [...targetPaints]
      };
    }, { code, input });
    assert.deepEqual(result.assignment?.operators, ['+', '+', '-', '+']);
    assert.deepEqual(result.assignment?.indices, [[3, 2], [4, 1], [3, 1], [4, 2]]);
    assert.ok(result.transferSamples.includes(JSON.stringify(['+17', '+34', '+39', '-18'])),
      JSON.stringify(result));
    assert.ok(result.targetPaints.every(paint => ['#fff', '#ffffff'].includes(JSON.parse(paint).fill)),
      JSON.stringify(result));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
