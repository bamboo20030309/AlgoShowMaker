const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('binary and compound arithmetic transfers show their operators', { timeout: 45000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
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
    const result = await page.evaluate(async () => {
      const code = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int a = 12, b = 3, result = 0;
  // @frame a,b,result
  result = a + b;
  result = a - b;
  result = a * b;
  result = a / b;
  result += b;
  result -= b;
  result *= b;
  result /= b;
  // @frame a,b,result
}`;
      const analyzed = await fetch('/trace/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
      }).then(response => response.json());
      const watches = [...new Set(analyzed.frameDirectives.flatMap(frame => frame.variableIds))];
      const compiled = await fetch('/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, input: '', trace: { enabled: true, watches, sliceMode: 'manual' } })
      }).then(response => response.json());
      const trace = window.ASMTraceModel.normalizeTraceDocument(
        compiled.traceDocument || compiled.trace
      );
      await window.ASMTraceRenderers.renderFrame(trace, trace.frames[0], null, {
        animatePositions: false, animateEvents: false
      });
      window.asmGetAnimationPlaybackRate = () => 4;
      const samples = new Set();
      let settled = false;
      const transition = window.ASMTraceRenderers.renderFrame(
        trace, trace.frames[1], trace.frames[0],
        { direction: 1, animatePositions: true, animateEvents: true }
      ).finally(() => { settled = true; });
      for (let count = 0; count < 900 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const values = [...document.querySelectorAll('.asm-trace-assign-transfer-value text')]
          .map(node => node.textContent).sort();
        if (values.length) samples.add(JSON.stringify(values));
      }
      await transition;
      return {
        build: window.ASMTraceFrameTween.build,
        operations: trace.frames[1].events
          .filter(event => event.binaryOperation)
          .map(event => event.binaryOperation),
        samples: [...samples]
      };
    });
    assert.equal(result.build, 'trace-233');
    assert.deepEqual(result.operations, ['+', '-', '*', '/']);
    for (const values of [
      ['+12', '+3'], ['-12', '-3'], ['*12', '*3'], ['/12', '/3'],
      ['+3'], ['-3'], ['*3'], ['/3']
    ]) {
      assert.ok(result.samples.includes(JSON.stringify([...values].sort())), JSON.stringify(result));
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
