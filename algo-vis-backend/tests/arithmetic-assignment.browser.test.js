/**
 * 測試模組：arithmetic-assignment.browser.test
 *
 * 驗證重點：arithmetic assignment.browser.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
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
  int a = 12, b = 3, c = 4, d = 5, result = 0;
  // @frame a,b,c,d,result
  result = a + b;
  result = a - b;
  result = a * b;
  result = a / b;
  result += b;
  result -= b;
  result *= b;
  result /= b;
  result = a + b - c + d;
  result = a * b / c * d;
  // @frame a,b,c,d,result
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
        multiSource: trace.frames[1].events
          .filter(event => event.multiSourceArithmetic)
          .map(event => event.targets.filter(target => String(target.role).startsWith('source-'))
            .map(target => [target.expression, target.arithmeticOperator])),
        samples: [...samples]
      };
    });
    assert.equal(result.build, 'trace-241');
    assert.deepEqual(result.operations, ['+', '-', '*', '/']);
    assert.deepEqual(result.multiSource, [
      [['a', '+'], ['b', '+'], ['c', '-'], ['d', '+']],
      [['a', '*'], ['b', '*'], ['c', '/'], ['d', '*']]
    ]);
    for (const values of [
      ['+12', '+3'], ['-12', '-3'], ['*12', '*3'], ['/12', '/3'],
      ['+3'], ['-3'], ['*3'], ['/3'],
      ['+12', '+3', '-4', '+5'], ['*12', '*3', '/4', '*5']
    ]) {
      assert.ok(result.samples.includes(JSON.stringify([...values].sort())), JSON.stringify(result));
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
