/**
 * 驗證 @keep last 後，相機會跟隨移到歷史快照下方的活動物件。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('@camera focus uses the live destination after @keep last', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'ASM_TEST_BASE_URL must point to an isolated service');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer);
    const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n; cin >> n;
  vector<int> arr(n);
  for (auto &v : arr) cin >> v;
  // @frame arr
  // @camera focus arr zoom(2)
  for (int i = 0; i < n - 1; i++) {
    for (int j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) swap(arr[j], arr[j + 1]);
      // @frame arr[j,j+1]
      // @camera focus arr zoom(2)
    }
    // @keep last
  }
}`;
    await page.evaluate(code => ace.edit('editor').setValue(code, -1), source);
    await page.evaluate(() => { document.getElementById('inputArea').value = '3\n3 2 1\n'; });
    await page.click('#runBtn');
    await page.waitForFunction(() => window.ASMTracePlayer.getDocument()?.frames?.length > 3,
      null, { timeout: 30000 });
    await page.evaluate(() => window.ASMTraceStudio?.close?.());
    await page.waitForFunction(() => !document.body.classList.contains('asm-trace-studio-open'));

    const destinationIndex = await page.evaluate(() => (
      window.ASMTracePlayer.getDocument().frames.findIndex(frame => frame.snapshotIds?.length)
    ));
    assert.ok(destinationIndex > 0, 'fixture must contain a frame after @keep last');
    await page.evaluate(async index => {
      window.asmSetAnimationPlaybackRate?.(4);
      await window.CodeScript.reset();
      for (let frame = 0; frame < index; frame += 1) await window.CodeScript.next();
    }, destinationIndex);
    await page.waitForFunction(index => window.ASMTracePlayer.getCurrentFrame() === index,
      destinationIndex);

    const geometry = await page.evaluate(() => {
      const documentTrace = window.ASMTracePlayer.getDocument();
      const frame = documentTrace.frames[window.ASMTracePlayer.getCurrentFrame()];
      const variableId = frame.source.primaryVariableId;
      const objectKey = frame.source.objectIds?.[variableId]
        || (frame.source.objectId && frame.source.primaryVariableId === variableId
          ? frame.source.objectId : variableId);
      const live = document.querySelector(`#asm-trace-root > [data-trace-object-key="${CSS.escape(objectKey)}"]`);
      const snapshot = document.querySelector('#asm-trace-root > [data-trace-snapshot]');
      const canvas = document.getElementById('arraySvg').getBoundingClientRect();
      const liveBox = live.getBoundingClientRect();
      const snapshotBox = snapshot.getBoundingClientRect();
      return {
        canvasCenterY: canvas.y + canvas.height / 2,
        liveCenterY: liveBox.y + liveBox.height / 2,
        snapshotCenterY: snapshotBox.y + snapshotBox.height / 2
      };
    });
    assert.ok(Math.abs(geometry.liveCenterY - geometry.canvasCenterY) < 2,
      `camera should center the live array: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.snapshotCenterY < geometry.liveCenterY - 100,
      'the retained snapshot should remain above the focused live array');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
