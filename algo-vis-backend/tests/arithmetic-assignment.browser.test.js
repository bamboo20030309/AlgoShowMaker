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
    assert.equal(result.build, 'trace-260');
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

test('literal operands display while a hidden data source disables all source transfers', { timeout: 45000 }, async () => {
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
  int shown = 4, hidden = 7, result = 0;
  // @frame shown,result when hidden >= 0
  result = shown + 1;
  result = 1 + 2;
  result = hidden + 2;
  // @frame shown,result when hidden >= 0
}`;
      const analyzed = await fetch('/trace/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
      }).then(response => response.json());
      const watches = [...new Set(analyzed.frameDirectives.flatMap(frame => frame.variableIds))];
      const compiled = await fetch('/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, input: '', trace: { enabled: true, watches, sliceMode: 'manual' } })
      }).then(response => response.json());
      const trace = window.ASMTraceModel.normalizeTraceDocument(compiled.traceDocument || compiled.trace);
      const frame = trace.frames[1];
      const resultId = Object.entries(trace.variables)
        .find(([, variable]) => variable.name === 'result')?.[0];
      const arithmetic = frame.events.filter(event => event.binaryOperation === '+');
      const expressions = Object.fromEntries(arithmetic.map(event => [event.id, event.expression]));
      const samples = Object.fromEntries(arithmetic.map(event => [event.expression, {
        transfers: new Set(), falling: new Set()
      }]));
      await window.ASMTraceRenderers.renderFrame(trace, trace.frames[0], null, {
        animatePositions: false, animateEvents: false
      });
      window.asmGetAnimationPlaybackRate = () => 4;
      let settled = false;
      const transition = window.ASMTraceRenderers.renderFrame(
        trace, frame, trace.frames[0],
        { direction: 1, animatePositions: true, animateEvents: true }
      ).finally(() => { settled = true; });
      for (let count = 0; count < 600 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const root = document.querySelector('[data-trace-active-event-id]');
        const expression = expressions[root?.dataset?.traceActiveEventId];
        if (!expression) continue;
        const transfers = [...document.querySelectorAll('.asm-trace-assign-transfer-value text')]
          .map(node => node.textContent).sort();
        if (transfers.length) samples[expression].transfers.add(JSON.stringify(transfers));
        [...document.querySelectorAll('.asm-trace-assign-falling-value')]
          .forEach(node => samples[expression].falling.add(node.textContent));
      }
      await transition;
      return {
        events: arithmetic.map(event => ({
          expression: event.expression,
          sources: event.targets.slice(1).map(target => ({
            expression: target.expression, literal: target.literal, literalValue: target.literalValue
          }))
        })),
        samples: Object.fromEntries(Object.entries(samples).map(([expression, value]) => [expression, {
          transfers: [...value.transfers], falling: [...value.falling]
        }])),
        finalValue: document.querySelector(
          `[data-trace-object-key="${resultId}#0"] text[data-trace-content-role="value"]`
        )?.textContent
      };
    });
    const visible = result.events.find(event => event.sources[0].expression === 'shown');
    const constants = result.events.find(event => event.sources.every(source => source.literal));
    const hidden = result.events.find(event => event.sources[0].expression === 'hidden');
    assert.equal(visible.sources[1].literal, true);
    assert.equal(visible.sources[1].literalValue, '1');
    assert.ok(result.samples[visible.expression].transfers.includes(JSON.stringify(['+1', '+4'])),
      JSON.stringify(result));
    assert.ok(result.samples[constants.expression].transfers.includes(JSON.stringify(['+1', '+2'])),
      JSON.stringify(result));
    assert.deepEqual(result.samples[hidden.expression].transfers, []);
    assert.equal(result.finalValue, '9');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('max and min move only the selected visible source', { timeout: 45000 }, async () => {
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
  vector<int> values = {3, 8};
  int hidden = 9, maximum = 0, minimum = 0, hiddenMaximum = 0;
  // @frame values,maximum,minimum,hiddenMaximum when hidden >= 0
  maximum = max(values[0], values[1]);
  minimum = std::min(values[0], values[1]);
  hiddenMaximum = max(values[0], hidden);
  // @frame values,maximum,minimum,hiddenMaximum when hidden >= 0
}`;
      const analyzed = await fetch('/trace/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
      }).then(response => response.json());
      const watches = [...new Set(analyzed.frameDirectives.flatMap(frame => frame.variableIds))];
      const compiled = await fetch('/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, input: '', trace: { enabled: true, watches, sliceMode: 'manual' } })
      }).then(response => response.json());
      const trace = window.ASMTraceModel.normalizeTraceDocument(compiled.traceDocument || compiled.trace);
      const frame = trace.frames[1];
      const selections = frame.events.filter(event => event.selectionOperation);
      const expressions = Object.fromEntries(selections.map(event => [event.id, event.expression]));
      const samples = Object.fromEntries(selections.map(event => [event.expression, new Set()]));
      await window.ASMTraceRenderers.renderFrame(trace, trace.frames[0], null, {
        animatePositions: false, animateEvents: false
      });
      window.asmGetAnimationPlaybackRate = () => 4;
      let settled = false;
      const transition = window.ASMTraceRenderers.renderFrame(
        trace, frame, trace.frames[0],
        { direction: 1, animatePositions: true, animateEvents: true }
      ).finally(() => { settled = true; });
      for (let count = 0; count < 600 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const root = document.querySelector('[data-trace-active-event-id]');
        const expression = expressions[root?.dataset?.traceActiveEventId];
        if (!expression) continue;
        const values = [...document.querySelectorAll('.asm-trace-assign-transfer-value text')]
          .map(node => node.textContent).sort();
        if (values.length) samples[expression].add(JSON.stringify(values));
      }
      await transition;
      return {
        build: window.ASMTraceFrameTween.build,
        events: selections.map(event => ({
          expression: event.expression,
          operation: event.selectionOperation,
          selectedSourceRole: event.selectedSourceRole
        })),
        samples: Object.fromEntries(Object.entries(samples)
          .map(([expression, values]) => [expression, [...values]]))
      };
    });
    assert.equal(result.build, 'trace-260');
    const maximum = result.events.find(event => event.expression.startsWith('maximum ='));
    const minimum = result.events.find(event => event.expression.startsWith('minimum ='));
    const hidden = result.events.find(event => event.expression.startsWith('hiddenMaximum ='));
    assert.equal(maximum.selectedSourceRole, 'source-right');
    assert.equal(minimum.selectedSourceRole, 'source-left');
    assert.ok(result.samples[maximum.expression].includes(JSON.stringify(['8'])), JSON.stringify(result));
    assert.ok(result.samples[minimum.expression].includes(JSON.stringify(['3'])), JSON.stringify(result));
    assert.deepEqual(result.samples[hidden.expression], []);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
