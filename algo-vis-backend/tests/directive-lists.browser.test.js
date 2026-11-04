const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('comma lists compile, render every pointer and arrow, and survive storage reload', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const previous = process.env.ASM_TEST_BASE_URL;
  process.env.ASM_TEST_BASE_URL = base;
  t.after(() => { if (previous) process.env.ASM_TEST_BASE_URL = previous; else delete process.env.ASM_TEST_BASE_URL; });
  const code = `#include <vector>
// @preset view
// @object a,b
// @pointer j,j+1 at a,b color #123456
// @arrow from a[0],a[1] to b[0],b[1] as "links" color AV_green
// @endpreset
int main(){std::vector<int> a(3);std::vector<int> b(3);int j=0;
// @frame use view
j++;
// @frame use view
}`;
  const { trace } = await compile(code);
  const variableId = name => Object.keys(trace.variables).find(id => trace.variables[id].name === name);
  const expected = j => ['j','j+1'].flatMap((label, offset) => ['a','b'].map(name => ({
    label, target: `${variableId(name)}#${j + offset}`, fill: '#123456'
  })));
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html?asmEmbed=runtime');
  await page.waitForFunction(() => !!window.ASMTraceRenderers);
  await page.addScriptTag({ url: base + '/slides-storage.js' });
  const result = await page.evaluate(async raw => {
    const doc = ASMTraceModel.normalizeTraceDocument(raw);
    const inspect = () => ({
      pointers: [...document.querySelectorAll('[data-trace-pointer-id]')].map(el => ({
        label: el.querySelector('.trace-variable-marker-label-text')?.textContent,
        target: el.dataset.tracePointerTargetKey,
        fill: el.querySelector('.trace-variable-marker-label-box')?.getAttribute('fill')
      })),
      arrows: [...document.querySelectorAll('[data-trace-arrow]')].map(el => el.getAttribute('data-trace-arrow')).sort()
    });
    const outputs = [];
    for (const frame of doc.frames) {
      await ASMTraceRenderers.renderFrame(doc, frame, null, { animatePositions: false, animateEvents: false });
      outputs.push(inspect());
    }
    const store = ASMSlideStorage.create(indexedDB, localStorage);
    const id = await ASMSlideStorage.digest(ASMSlideStorage.canonical(doc));
    await store.putTrace(id, doc);
    const reopened = ASMTraceModel.normalizeTraceDocument(await store.loadTrace(id));
    await ASMTraceRenderers.renderFrame(reopened, reopened.frames[1], null, { animatePositions: false, animateEvents: false });
    return { outputs, reopened: inspect() };
  }, trace);
  assert.equal(result.outputs.length,2);
  for (const [index, output] of result.outputs.entries()) {
    assert.deepEqual(output.pointers,expected(index));
    assert.equal(output.arrows.length,4);
    assert.equal(new Set(output.arrows).size,4);
  }
  assert.deepEqual(result.reopened,result.outputs[1]);
  assert.deepEqual(errors,[]);
});
