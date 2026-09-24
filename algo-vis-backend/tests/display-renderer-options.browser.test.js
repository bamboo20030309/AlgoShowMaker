const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

const source = `
#include <bits/stdc++.h>
using namespace std;

int main() {
  int offset = 10;
  vector<int> arr = {4, 5, 6};
  vector<vector<int>> grid = {{1, 2}, {3, 4}};
  // @frame arr render normal with labels(value), display("${'${index}'}:${'${value+offset}'}")
  // @frame arr render heap with labels(value), display("v=${'${value}'}")
  // @frame grid render matrix with labels(value), display("${'${row}'},${'${column}'}:${'${value}'}")
  return 0;
}`;

test('display templates render sequence, heap and matrix cells without changing trace values', {
  timeout: 60000
}, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const { trace } = await compile(source);
  assert.equal(trace.frames.length, 3);
  const ids = Object.fromEntries(Object.entries(trace.variables)
    .map(([id, variable]) => [variable.name, id]));
  assert.ok(trace.frames[0].captureOnlyVariableIds.includes(ids.offset));
  assert.equal(trace.frames[0].rendererOptions[ids.arr].display.template,
    '${index}:${value+offset}');
  assert.deepEqual(trace.frames[0].state[ids.arr].data.items.map(item => item.value), [4, 5, 6],
    'display remains presentation-only');
  const { trace: mutationTrace } = await compile(`
#include <bits/stdc++.h>
using namespace std;
int main() {
  int offset = 10;
  vector<int> arr = {4, 5};
  // @frame arr render normal with labels(value), display("${'${index}'}:${'${value+offset}'}")
  arr[0] = 9;
  // @frame arr render normal with labels(value), display("${'${index}'}:${'${value+offset}'}")
  return 0;
}`);

  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${base}/algorithm.html`);
    const rendered = await page.evaluate(async ({ sourceTrace, mutationSourceTrace, variableIds }) => {
      const document = window.ASMTraceModel.normalizeTraceDocument(sourceTrace);
      const values = async (frame, variableId) => {
        await window.ASMTraceRenderers.renderFrame(document, frame, null, {
          animatePositions: false,
          animateEvents: false
        });
        const host = window.document.querySelector(`[data-trace-object-key="${variableId}"]`);
        return [...(host?.querySelectorAll(
          '[data-trace-index] > text[data-trace-content-role="value"]'
        ) || [])].map(text => text.textContent);
      };
      const result = {
        sequence: await values(document.frames[0], variableIds.arr),
        heap: await values(document.frames[1], variableIds.arr),
        matrix: await values(document.frames[2], variableIds.grid)
      };
      const mutationDocument = window.ASMTraceModel.normalizeTraceDocument(mutationSourceTrace);
      const mutationArr = Object.entries(mutationDocument.variables)
        .find(([, variable]) => variable.name === 'arr')?.[0];
      await window.ASMTraceRenderers.renderFrame(
        mutationDocument, mutationDocument.frames[0], null,
        { animatePositions: false, animateEvents: false }
      );
      const transition = window.ASMTraceRenderers.renderFrame(
        mutationDocument, mutationDocument.frames[1], mutationDocument.frames[0],
        { animatePositions: true, animateEvents: true, direction: 1 }
      );
      const mutationValues = () => [...window.document.querySelectorAll(
        `[data-trace-object-key="${mutationArr}"] [data-trace-index] > text[data-trace-content-role="value"]`
      )].map(text => text.textContent);
      result.mutationStart = mutationValues();
      await transition;
      result.mutationEnd = mutationValues();
      return result;
    }, {
      sourceTrace: trace,
      mutationSourceTrace: mutationTrace,
      variableIds: { arr: ids.arr, grid: ids.grid }
    });
    assert.deepEqual(rendered.sequence, ['0:14', '1:15', '2:16']);
    assert.deepEqual(rendered.heap, ['v=4', 'v=5', 'v=6']);
    assert.deepEqual(rendered.matrix, ['0,0:1', '0,1:2', '1,0:3', '1,1:4']);
    assert.deepEqual(rendered.mutationStart, ['0:14', '1:15']);
    assert.deepEqual(rendered.mutationEnd, ['0:19', '1:15']);
  } finally {
    await browser.close();
  }
});
