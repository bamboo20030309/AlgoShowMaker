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
    await page.waitForFunction(source => window.ASMTracePlayer.getDocument()?.sourceCode === source
      && window.ASMTracePlayer.getDocument()?.frames?.length > 3,
      source, { timeout: 30000 });
    await page.evaluate(() => window.ASMTraceStudio?.close?.());
    await page.waitForFunction(() => !document.body.classList.contains('asm-trace-studio-open'));

    const destinationIndex = await page.evaluate(() => (
      window.ASMTracePlayer.getDocument().frames.findIndex(frame => frame.snapshotIds?.length)
    ));
    assert.ok(destinationIndex > 0, 'fixture must contain a frame after @keep last');
    await page.evaluate(async index => {
      window.asmSetAnimationPlaybackRate?.(4);
      await window.CodeScript.reset();
      for (let frame = 0; frame < index - 1; frame += 1) await window.CodeScript.next();
      window.asmSetAnimationPlaybackRate?.(1);
    }, destinationIndex);

    const keepMotion = await page.evaluate(async () => {
      const samples = [];
      const next = window.CodeScript.next();
      for (let index = 0; index < 8; index += 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const root = document.querySelector('#asm-trace-root');
        const snapshot = root?.querySelector(':scope > [data-trace-snapshot]');
        const live = [...(root?.querySelectorAll(':scope > [data-trace-object-key]') || [])]
          .find(element => !element.hasAttribute('data-trace-snapshot'));
        if (!snapshot || !live) continue;
        const snapshotBox = snapshot.getBoundingClientRect();
        const liveBox = live.getBoundingClientRect();
        const motion = live.querySelector(':scope > .asm-trace-motion');
        const motionTransform = motion?.getAttribute('transform') || '';
        const scaleMatch = motionTransform.match(/scale\(([-\d.]+)\)/);
        const arrow = root.querySelector('.asm-trace-keep-arrow');
        const x1 = Number(arrow?.getAttribute('x1'));
        const y1 = Number(arrow?.getAttribute('y1'));
        const x2 = Number(arrow?.getAttribute('x2'));
        const y2 = Number(arrow?.getAttribute('y2'));
        samples.push({
          phase: root.dataset.tracePlaybackPhase || '',
          snapshotCenterX: snapshotBox.x + snapshotBox.width / 2,
          liveCenterX: liveBox.x + liveBox.width / 2,
          keepGrowth: live.dataset.traceKeepGrowth === '1',
          scale: scaleMatch ? Number(scaleMatch[1]) : 1,
          opacity: Number(motion?.getAttribute('opacity') || 1),
          arrowLength: [x1, y1, x2, y2].every(Number.isFinite)
            ? Math.hypot(x2 - x1, y2 - y1) : 0
        });
      }
      await next;
      return samples;
    });
    const keepTransitionSamples = keepMotion.filter(sample => (
      sample.phase === 'keep-transition'
    ));
    assert.ok(keepTransitionSamples.length > 0,
      `expected keep-transition samples: ${JSON.stringify(keepMotion)}`);
    assert.ok(keepTransitionSamples.every(sample => (
      Math.abs(sample.snapshotCenterX - sample.liveCenterX) < 2
    )), `keep snapshot must not enter from the side: ${JSON.stringify(keepTransitionSamples)}`);
    assert.ok(keepTransitionSamples.some(sample => sample.keepGrowth),
      `the live object should use keep growth: ${JSON.stringify(keepTransitionSamples)}`);
    assert.ok(keepTransitionSamples[0].scale < keepTransitionSamples.at(-1).scale,
      `the live object should grow toward full size: ${JSON.stringify(keepTransitionSamples)}`);
    assert.ok(keepTransitionSamples[0].opacity < keepTransitionSamples.at(-1).opacity,
      `the live object should fade toward full opacity: ${JSON.stringify(keepTransitionSamples)}`);
    assert.ok(keepTransitionSamples[0].arrowLength
      < keepTransitionSamples.at(-1).arrowLength,
    `the keep arrow should extend with the live object: ${JSON.stringify(keepTransitionSamples)}`);
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
