const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('as labels name live, empty, matrix and retained objects without changing source metadata', { timeout: 60000 }, async () => {
  const { trace } = await compile(`#include <vector>
using namespace std;
int main(){vector<int> merged={2,3},num={0,2,3};vector<int> empty;vector<vector<int>> grid={{1,2}};int x=7;
// @frame merged as result
// @object empty as pending
// @object grid as table
// @object x as value
// @keep last as "saved"
// @frame num as result with range(1,2)
// @object empty as pending
// @object grid as table
// @object x as value
// @frame num
return 0;}`);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const results = await page.evaluate(async trace => {
      const labels = () => [...document.querySelectorAll('#asm-trace-root .outerframe-label, #asm-trace-root .asm-trace-object-label')]
        .map(node => node.textContent);
      const loaded = window.ASMTracePlayer.apply(trace);
      loaded.studio.eventSettings = { ...(loaded.studio.eventSettings || {}), autoFixedEnabled: false };
      loaded.studio.objectStyles = { [loaded.frames[1].id]: { result: { fill: 'rgba(255,0,0,0.25)' } } };
      const saved = JSON.parse(JSON.stringify(loaded));
      window.ASMTracePlayer.apply(saved);
      const aliasFrames = [];
      for (const index of [0,1,2]) {
        await window.ASMTracePlayer.render(index, { stable: true });
        aliasFrames.push(labels());
      }
      const reopened = window.ASMTracePlayer.getDocument();
      const names = Object.values(reopened.variables).map(v => v.name);
      const legacy = JSON.parse(JSON.stringify(reopened));
      for (const frame of legacy.frames) { delete frame.source.objectId; delete frame.source.objectIds; }
      for (const snapshot of legacy.snapshots) {
        if (snapshot.frame) { delete snapshot.frame.source.objectId; delete snapshot.frame.source.objectIds; }
      }
      window.ASMTracePlayer.apply(legacy);
      await window.ASMTracePlayer.render(0, { stable: true });
      const legacyLabels = labels();
      window.ASMTracePlayer.apply(JSON.parse(JSON.stringify(window.ASMTracePlayer.getDocument())));
      await window.ASMTracePlayer.render(0, { stable: true });
      return { aliasFrames, names, legacyLabels, reopenedLabels: labels(),
        disabled: reopened.studio.eventSettings.autoFixedEnabled,
        custom: reopened.studio.objectStyles[reopened.frames[1].id].result.fill };
    }, trace);
    for (const labels of results.aliasFrames.slice(0,2)) {
      for (const name of ['result','pending','table','value']) assert.ok(labels.includes(name), JSON.stringify(labels));
      assert.ok(!labels.includes('merged'));
    }
    assert.ok(results.aliasFrames[1].filter(name => name === 'result').length >= 2, 'kept alias and live alias both named');
    assert.ok(results.aliasFrames[2].includes('num'), JSON.stringify(results.aliasFrames));
    assert.ok(results.names.includes('merged') && results.names.includes('num'));
    assert.ok(results.legacyLabels.includes('merged') && results.legacyLabels.includes('empty'));
    assert.deepEqual(results.reopenedLabels, results.legacyLabels);
    assert.equal(results.disabled, false);
    assert.equal(results.custom, 'rgba(255,0,0,0.25)');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
