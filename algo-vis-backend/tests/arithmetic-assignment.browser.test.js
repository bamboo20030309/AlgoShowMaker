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
const { TWEEN_BUILD, RENDERER_BUILD } = require('./helpers/builds');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('visible-source declaration enters blank and receives the copied value in one slot', { timeout: 45000 }, async () => {
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
    await page.waitForFunction(build => window.ASMTraceFrameTween?.build === build, TWEEN_BUILD);
    const result = await page.evaluate(async () => {
      const code = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int a = 7;
  vector<int> num = {4, 7};
  // @frame a,num
  int x = a;
  vector<int> copy = num;
  // @frame a,num,x,copy
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
      const xId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'x');
      const copyId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'copy');
      const declaration = frame.events.find(event => (
        event.type === 'declare' && event.targets?.some(target => target.variableId === xId)
      ));
      const initializer = frame.events.find(event => (
        event.type === 'assign' && event.declarationInitializer === true
        && event.targets?.some(target => target.variableId === xId)
      ));
      const copyDeclaration = frame.events.find(event => (
        event.type === 'declare' && event.targets?.some(target => target.variableId === copyId)
      ));
      await window.ASMTraceRenderers.renderFrame(trace, trace.frames[0], null, {
        animatePositions: false, animateEvents: false
      });
      window.asmGetAnimationPlaybackRate = () => 4;
      const samples = [];
      let settled = false;
      const transition = window.ASMTraceRenderers.renderFrame(trace, frame, trace.frames[0], {
        direction: 1, animatePositions: true, animateEvents: true
      }).finally(() => { settled = true; });
      for (let count = 0; count < 360 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const object = document.querySelector(`[data-trace-variable="${xId}"]`);
        const copyObject = document.querySelector(`[data-trace-variable="${copyId}"]`);
        samples.push({
          eventId: document.querySelector('[data-trace-active-event-id]')?.dataset.traceActiveEventId || '',
          values: object ? [...object.querySelectorAll('.asm-trace-motion text')]
            .map(node => node.textContent) : null,
          transfers: [...document.querySelectorAll('.asm-trace-assign-transfer text')]
            .map(node => node.textContent),
          falling: [...document.querySelectorAll('.asm-trace-assign-falling-value')]
            .map(node => node.textContent),
          copyValues: copyObject ? [...copyObject.querySelectorAll(
            '[data-trace-index] text:not([data-trace-content-role="index"])'
          )].map(node => node.textContent) : null
        });
      }
      await transition;
      const finalObject = document.querySelector(`[data-trace-variable="${xId}"]`);
      const finalCopy = document.querySelector(`[data-trace-variable="${copyId}"]`);
      return {
        declarationId: declaration?.id || '', initializerId: initializer?.id || '',
        copyDeclarationId: copyDeclaration?.id || '', samples,
        initializer: initializer ? {
          enabled: initializer.enabled, disabled: initializer.autoAnimationDisabled,
          targets: initializer.targets, payload: initializer.payload
        } : null,
        finalValues: finalObject ? [...finalObject.querySelectorAll('text')]
          .map(node => node.textContent) : [],
        finalCopyValues: finalCopy ? [...finalCopy.querySelectorAll(
          '[data-trace-index] text:not([data-trace-content-role="index"])'
        )].map(node => node.textContent) : [],
        rows: frame.events.filter(event => window.ASMTraceEvents.showInspector(event, trace) !== false)
          .filter(event => event.targets?.some(target => target.variableId === xId))
          .filter(event => ['declare', 'assign'].includes(event.type))
          .map(event => event.type)
      };
    });
    const declarationSamples = result.samples.filter(sample => sample.eventId === result.declarationId);
    assert.ok(result.declarationId && result.initializerId);
    assert.deepEqual(result.rows, ['declare']);
    assert.ok(declarationSamples.some(sample => (
      !sample.values?.includes('7') && sample.transfers.includes('7')
    )),
      JSON.stringify({ initializer: result.initializer, declarationSamples }));
    assert.ok(result.finalValues.includes('7'),
      'x receives 7 when the transfer lands');
    const copySamples = result.samples.filter(sample => sample.eventId === result.copyDeclarationId);
    assert.ok(copySamples.some(sample => (
      !sample.copyValues?.includes('4') && !sample.copyValues?.includes('7')
      && sample.transfers.includes('4') && sample.transfers.includes('7')
    )), JSON.stringify(copySamples));
    assert.deepEqual(result.finalCopyValues, ['4', '7']);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('push_back copies a visible source cell into the new destination cell', { timeout: 45000 }, async () => {
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
    await page.waitForFunction(build => window.ASMTraceFrameTween?.build === build, TWEEN_BUILD);
    const result = await page.evaluate(async () => {
      const code = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> num = {8, 5};
  vector<int> temp;
  int l = 1;
  // @frame num,temp
  temp.push_back(num[l++]);
  // @frame num,temp
  temp.push_back(9);
  // @frame num,temp
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
      const literalFrame = trace.frames[2];
      const numId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'num');
      const tempId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'temp');
      const event = frame.events.find(candidate => candidate.operation === 'push_back');
      const literalEvent = literalFrame.events.find(candidate => candidate.operation === 'push_back');
      await window.ASMTraceRenderers.renderFrame(trace, trace.frames[0], null, {
        animatePositions: false, animateEvents: false
      });
      window.asmGetAnimationPlaybackRate = () => 1;
      const samples = [];
      let settled = false;
      const transition = window.ASMTraceRenderers.renderFrame(trace, frame, trace.frames[0], {
        direction: 1, animatePositions: true, animateEvents: true
      }).finally(() => { settled = true; });
      for (let count = 0; count < 360 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const transfer = document.querySelector('.asm-trace-sequence-cell-transfer');
        const transferRect = transfer?.getBoundingClientRect();
        const sourceRect = document.querySelector(
          `[data-trace-object-key="${numId}#1"]`
        )?.getBoundingClientRect();
        const destinationElement = document.querySelector(
          `[data-trace-object-key="${tempId}#0"]`
        );
        const destinationRect = destinationElement?.getBoundingClientRect();
        samples.push({
          eventId: document.querySelector('[data-trace-active-event-id]')?.dataset.traceActiveEventId || '',
          destination: document.querySelector(
            `[data-trace-object-key="${tempId}#0"] text[data-trace-content-role="value"]`
          )?.textContent ?? null,
          transferText: transfer?.querySelector('text[data-trace-content-role="value"], text')
            ?.textContent ?? null,
          transferHasRect: Boolean(transfer?.querySelector('rect')),
          transferIsValueOnly: transfer?.classList.contains('asm-trace-assign-transfer-value') || false,
          transferCenterX: transferRect ? transferRect.x + transferRect.width / 2 : null,
          sourceCenterX: sourceRect ? sourceRect.x + sourceRect.width / 2 : null,
          destinationCenterX: destinationRect
            ? destinationRect.x + destinationRect.width / 2 : null,
          destinationOpacity: destinationElement
            ? Number(getComputedStyle(destinationElement).opacity) : null,
          tempLabel: document.querySelector(
            `[data-trace-object-key="${tempId}"] > .asm-trace-motion .outerframe-label`
          )?.textContent ?? null,
          tempLabelOpacity: Number(getComputedStyle(document.querySelector(
            `[data-trace-object-key="${tempId}"] > .asm-trace-motion .outerframe-label`
          ) || document.documentElement).opacity)
        });
      }
      await transition;
      const literalSamples = [];
      settled = false;
      const literalTransition = window.ASMTraceRenderers.renderFrame(
        trace, literalFrame, frame,
        { direction: 1, animatePositions: true, animateEvents: true }
      ).finally(() => { settled = true; });
      for (let count = 0; count < 360 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const destinationElement = document.querySelector(
          `[data-trace-object-key="${tempId}#1"]`
        );
        const destinationRect = destinationElement?.getBoundingClientRect();
        literalSamples.push({
          eventId: document.querySelector('[data-trace-active-event-id]')?.dataset.traceActiveEventId || '',
          hasCellTransfer: Boolean(document.querySelector('.asm-trace-sequence-cell-transfer')),
          destinationCenterX: destinationRect
            ? destinationRect.x + destinationRect.width / 2 : null
        });
      }
      await literalTransition;
      return {
        eventId: event?.id || '', samples,
        literalEventId: literalEvent?.id || '', literalSamples,
        finalValue: document.querySelector(
          `[data-trace-object-key="${tempId}#0"] text[data-trace-content-role="value"]`
        )?.textContent ?? null,
        finalLiteralValue: document.querySelector(
          `[data-trace-object-key="${tempId}#1"] text[data-trace-content-role="value"]`
        )?.textContent ?? null
      };
    });
    const eventSamples = result.samples.filter(sample => sample.eventId === result.eventId);
    const transferSamples = eventSamples.filter(sample => sample.transferCenterX != null);
    assert.ok(transferSamples.some(sample => (
      sample.destination !== '5'
      && sample.transferText === '5'
      && sample.transferHasRect
      && !sample.transferIsValueOnly
      && sample.destinationOpacity === 0
    )), JSON.stringify(result));
    assert.ok(Math.min(...transferSamples.map(sample => (
      Math.abs(sample.transferCenterX - sample.sourceCenterX)
    ))) < 5, 'the complete cloned cell starts at num[l]');
    assert.ok(Math.min(...transferSamples.map(sample => (
      Math.abs(sample.transferCenterX - sample.destinationCenterX)
    ))) < 5, 'the complete cloned cell lands at the new temp tail slot');
    const destinationPositions = eventSamples
      .map(sample => sample.destinationCenterX).filter(Number.isFinite);
    assert.ok(Math.max(...destinationPositions) - Math.min(...destinationPositions) < 1,
      'the real destination stays in its tail slot instead of entering from the right');
    assert.ok(eventSamples.every(sample => (
      sample.tempLabel === 'temp' && sample.tempLabelOpacity > 0
    )), 'an initially empty destination keeps its outerframe name while push_back grows it');
    const literalEventSamples = result.literalSamples.filter(
      sample => sample.eventId === result.literalEventId
    );
    assert.equal(literalEventSamples.some(sample => sample.hasCellTransfer), false,
      'a literal push keeps the generic edge insertion instead of inventing a source cell');
    const literalPositions = literalEventSamples
      .map(sample => sample.destinationCenterX).filter(Number.isFinite);
    assert.ok(Math.max(...literalPositions) - Math.min(...literalPositions) > 20,
      'the literal destination retains the original right-edge entrance motion');
    assert.equal(result.finalValue, '5');
    assert.equal(result.finalLiteralValue, '9');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('an empty sequence keeps its name when its first visible frame is built by push_back',
  { timeout: 45000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const code = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> num = {6};
  vector<int> temp;
  int i = 0;
  // @frame num
  temp.push_back(num[i++]);
  // @frame num,temp
}`;
    const { trace } = await require('./helpers/compile').compile(code);
    const tempId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'temp');
    const push = trace.frames[1].events.find(event => event.operation === 'push_back');
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/algorithm.html`);
      const samples = await page.evaluate(async ({ sourceTrace, targetId }) => {
        window.ASMTracePlayer.apply(sourceTrace);
        const previous = sourceTrace.frames[0];
        const frame = sourceTrace.frames[1];
        await window.ASMTraceRenderers.renderFrame(sourceTrace, previous, null, {
          animatePositions: false, animateEvents: false
        });
        let settled = false;
        const transition = window.ASMTraceRenderers.renderFrame(sourceTrace, frame, previous, {
          direction: 1, animatePositions: true, animateEvents: true
        }).finally(() => { settled = true; });
        const result = [];
        for (let count = 0; count < 360 && !settled; count += 1) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const owner = document.querySelector(`[data-trace-object-key="${targetId}"]`);
          const label = owner?.querySelector('.outerframe-label');
          result.push({
            eventId: document.querySelector('[data-trace-active-event-id]')
              ?.dataset.traceActiveEventId || '',
            label: label?.textContent ?? null,
            labelOpacity: label ? Number(getComputedStyle(label).opacity) : null,
            ownerOpacity: owner ? Number(getComputedStyle(owner).opacity) : null
          });
        }
        await transition;
        return result;
      }, { sourceTrace: trace, targetId: tempId });
      const pushSamples = samples.filter(sample => sample.eventId === push.id);
      assert.ok(pushSamples.length > 0, 'the first push_back event is sampled');
      assert.ok(pushSamples.every(sample => (
        sample.label === 'temp' && sample.labelOpacity > 0 && sample.ownerOpacity > 0
      )), `the destination name remains visible throughout push_back: ${JSON.stringify(pushSamples)}`);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });

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
    assert.equal(result.build, TWEEN_BUILD);
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
    assert.equal(result.build, TWEEN_BUILD);
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
