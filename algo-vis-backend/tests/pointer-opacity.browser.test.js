const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { TWEEN_BUILD, RENDERER_BUILD } = require('./helpers/builds');
const { compile } = require('./helpers/compile');

test('legacy, independent and matrix pointers default to opaque labels without overwriting stored colors', { timeout: 60000 }, async () => {
  const { trace } = await compile(`#include <vector>
using namespace std;
int main(){vector<int> a={1,2};vector<vector<int>> grid={{1,2},{3,4}};int i=0,j=1,r=0,c=1;
// @frame a,grid
// @pointer i at a
// @pointer r at grid.row
// @pointer c at grid.column
// @pointer j at a
return 0;}`);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const result = await page.evaluate(async trace => {
      window.ASMTracePlayer.apply(trace);
      await window.ASMTracePlayer.render(0, { stable: true });
      const labels = [...document.querySelectorAll('#asm-trace-root .trace-variable-marker-label-box')];
      const initial = labels.map(label => ({ fill: label.getAttribute('fill'), opacity: getComputedStyle(label).fillOpacity }));
      const customKey = labels[0].closest('[data-trace-source-variable-id]').dataset.traceObjectKey;
      const customResults = [];
      for (const fill of ['rgba(240,10,30,0.25)', 'rgba(240,10,30,0)']) {
        const saved = JSON.parse(JSON.stringify(trace));
        saved.frames[0].bindings.forEach(binding => { delete binding.implicitIndex; });
        saved.studio.objectStyles = { [saved.frames[0].id]: { [customKey]: { fill } } };
        saved.studio.eventSettings = { ...(saved.studio.eventSettings || {}), autoFixedEnabled: false };
        const loaded = window.ASMTracePlayer.apply(saved);
        await window.ASMTracePlayer.render(0, { stable: true });
        const reopened = JSON.parse(JSON.stringify(loaded));
        window.ASMTracePlayer.apply(reopened);
        await window.ASMTracePlayer.render(0, { stable: true });
        const owner = [...document.querySelectorAll('#asm-trace-root [data-trace-object-key]')]
          .find(element => element.dataset.traceObjectKey === customKey);
        customResults.push({ expected: fill, actual: owner?.querySelector('.trace-variable-marker-label-box')?.getAttribute('fill'),
          disabled: window.ASMTracePlayer.getDocument().studio.eventSettings.autoFixedEnabled });
      }
      return { initial, customResults, build: document.documentElement.dataset.asmTraceRendererBuild };
    }, trace);
    assert.equal(result.initial.length, 4);
    for (const label of result.initial) assert.deepEqual(label, { fill: '#bfe8f7', opacity: '1' });
    for (const custom of result.customResults) {
      assert.equal(custom.actual, custom.expected);
      assert.equal(custom.disabled, false);
    }
    assert.equal(result.build, RENDERER_BUILD);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
