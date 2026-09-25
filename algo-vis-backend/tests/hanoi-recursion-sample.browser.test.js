const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('Hanoi sample draws three disk pegs left of the completed recursion tree', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Backtracking/hanoi-recursion.cpp'
  ), 'utf8');
  const { trace } = await compile(code, '4\n');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(`${base}/algorithm.html`);
    const scene = await page.evaluate(async sourceTrace => {
      const document = window.ASMTraceModel.normalizeTraceDocument(sourceTrace);
      const finalFrame = document.frames.at(-1);
      await window.ASMTraceRenderers.renderFrame(document, finalFrame, null, {
        animatePositions: false,
        animateEvents: false
      });
      const disks = [...window.document.querySelectorAll('[data-layout="disk"]')].map(group => {
        const object = group.closest('[data-trace-object-key]');
        const key = object?.dataset.traceObjectKey || '';
        return {
          key,
          name: document.variables[key]?.name || key,
          cells: group.querySelectorAll('[id^="cell-"]').length,
          hasBase: Boolean(group.querySelector('.disk-base')),
          hasPeg: Boolean(group.querySelector('.disk-peg')),
          placement: window.ASMTraceRenderers.currentPlacement(key)
        };
      });
      const snapshots = [...window.document.querySelectorAll('.asm-trace-snapshot')]
        .map(element => window.ASMTraceRenderers.currentPlacement(element.dataset.traceObjectKey))
        .filter(Boolean);
      return {
        disks,
        treeLeft: Math.min(...snapshots.map(box => box.x)),
        nodeCount: snapshots.length,
        edgeCount: window.document.querySelectorAll('.asm-trace-layout-edge').length,
        flowCount: window.document.querySelectorAll('.asm-trace-recursion-flow-arrow').length
      };
    }, trace);

    assert.deepEqual(scene.disks.map(disk => disk.name).sort(), ['Peg_A', 'Peg_B', 'Peg_C']);
    assert.deepEqual(Object.fromEntries(scene.disks.map(disk => [disk.name, disk.cells])), {
      Peg_A: 0,
      Peg_B: 0,
      Peg_C: 4
    });
    assert.ok(scene.disks.every(disk => disk.hasBase && disk.hasPeg),
      `empty and populated disk objects retain their peg geometry: ${JSON.stringify(scene)}`);
    const pegALeft = scene.disks.find(disk => disk.name === 'Peg_A').placement.x;
    assert.ok(Math.abs((scene.treeLeft - pegALeft) - (360 - 70)) < 0.1,
      `Peg_A and the tree preserve their exact canvas-relative offsets: ${JSON.stringify(scene)}`);
    assert.ok(scene.disks.every(disk => disk.placement.x + disk.placement.width < scene.treeLeft),
      `all three disk objects remain left of the recursion tree: ${JSON.stringify(scene)}`);
    assert.deepEqual({
      nodes: scene.nodeCount,
      edges: scene.edgeCount,
      flow: scene.flowCount
    }, { nodes: 15, edges: 14, flow: 28 });
  } finally {
    await browser.close();
  }
});
