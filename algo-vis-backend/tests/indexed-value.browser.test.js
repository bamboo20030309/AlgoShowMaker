const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { compile } = require('./helpers/compile');
const { findFrameDirectives } = require('../trace-instrumenter');

test('indexed objects select values, never create implicit pointers', () => {
  const source = 'int main(){int a[3]={1,2,3}; int i=1,j=2;\n// @frame a[i+1]\n}';
  const [frame] = findFrameDirectives(source);
  assert.deepEqual(frame.bindings, []);
  assert.equal(frame.objects[0].dataTransform.type, 'element');
  assert.deepEqual(frame.objects[0].dataTransform.indexExpressions, ['i+1']);
  assert.throws(() => findFrameDirectives(source.replace('a[i+1]', 'a[i,j]')), /@pointer/);
  assert.throws(() => findFrameDirectives(source.replace('a[i+1]', 'a[i++]')), /索引取值/);
});

test('indexed values render one real cell, preserve explicit pointers and survive reopen', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const previous = process.env.ASM_TEST_BASE_URL;
  process.env.ASM_TEST_BASE_URL = base;
  t.after(() => { if (previous) process.env.ASM_TEST_BASE_URL = previous; else delete process.env.ASM_TEST_BASE_URL; });
  const code = `#include <vector>
#include <string>
int main(){std::vector<int> a={11,22,33}; int i=1; std::vector<std::vector<int>> dp={{4,5},{6,7}}; std::string s="abc";
// @frame a[i]
// @style a[i] highlight
// @keep last
a[i]=44;
// @frame a[i]
// @frame dp[1][0]
// @frame s[i]
// @frame a
// @pointer i at a color #123456
}`;
  const { trace } = await compile(code);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html?asmEmbed=runtime');
  await page.waitForFunction(() => !!window.ASMTraceRenderers);
  await page.addScriptTag({ url: base + '/slides-storage.js' });
  const result = await page.evaluate(async trace => {
    const doc = ASMTraceModel.normalizeTraceDocument(trace);
    const outputs = [];
    for (const frame of doc.frames) {
      await ASMTraceRenderers.renderFrame(doc, frame, null, { animatePositions: false, animateEvents: false });
      outputs.push({ cells: [...document.querySelectorAll('#asm-trace-root > [data-trace-variable] [data-trace-data-value]')].map(cell => ({ value: cell.dataset.traceDataValue, index: cell.dataset.traceIndex })),
        pointers: [...document.querySelectorAll('[data-trace-pointer-id]')].map(el => ({ target: el.dataset.tracePointerTargetKey, fill: el.querySelector('.trace-variable-marker-label-box')?.getAttribute('fill') })) });
    }
    const store = ASMSlideStorage.create(indexedDB, localStorage);
    const key = await ASMSlideStorage.digest(ASMSlideStorage.canonical(doc));
    await store.putTrace(key, doc);
    const saved = await store.loadTrace(key);
    await ASMTraceRenderers.renderFrame(ASMTraceModel.normalizeTraceDocument(saved), saved.frames[1], null, { animatePositions: false, animateEvents: false });
    return { outputs, reopened: [...document.querySelectorAll('#asm-trace-root > [data-trace-variable] [data-trace-data-value]')].map(cell => cell.dataset.traceDataValue) };
  }, trace);
  assert.deepEqual(result.outputs.map(frame => frame.cells.map(cell => cell.value)), [['22'], ['44'], ['6'], ['b'], ['11','44','33']]);
  assert.deepEqual(result.outputs.slice(0,4).map(frame => frame.cells[0].index), ['1','1','1,0','1']);
  assert.ok(result.outputs.slice(0,4).every(frame => !frame.pointers.length));
  assert.equal(result.outputs[4].pointers[0].fill, '#123456');
  assert.deepEqual(result.reopened, ['44']);
  assert.deepEqual(errors, []);
});
