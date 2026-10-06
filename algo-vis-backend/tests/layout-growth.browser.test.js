const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { TWEEN_BUILD, RENDERER_BUILD } = require('./helpers/builds');
const { compile } = require('./helpers/compile');

test('reserved split slots and leaf-growing merge tree use actual SVG geometry after reload', { timeout: 120000 }, async () => {
  const source = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8');
  const { trace } = await compile(source, '10\n38 27 43 3 9 82 10 19 84 60\n');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const reports = await page.evaluate(async trace => {
      window.ASMTracePlayer.apply(trace);
      const root = () => document.querySelector('#asm-trace-root');
      const inspect = () => [...root().querySelectorAll('[data-trace-layout-node]')]
        .filter(el => el.dataset.traceSnapshot || !el.closest('.asm-trace-snapshot'))
        .map(el => {
          const outer = el.querySelector('[data-outerframe-left][data-outerframe-top]');
          const matrix = outer?.getCTM();
          const x = Number(outer?.dataset.outerframeLeft), y = Number(outer?.dataset.outerframeTop);
          const point = matrix ? new DOMPoint(x, y).matrixTransform(root().getCTM().inverse().multiply(matrix)) : {};
          return { id: el.dataset.traceLayoutNode, activation: el.dataset.traceLayoutActivation,
            parent: el.dataset.traceLayoutParent, layout: el.dataset.traceLayoutId,
            x: point.x, y: point.y,
            width: Number(outer?.dataset.outerframeRight) - x,
            height: Number(outer?.dataset.outerframeBottom) - y };
        });
      const lastSplit = trace.frames.findLastIndex(f => f.source.layoutId === 'split_tree');
      const firstParent = trace.frames.findIndex(f => f.source.layoutId === 'merge_tree'
        && Object.values(f.state || {}).some(entry => entry.name === 'merged' && entry.data?.items?.length === 2));
      const firstSplit = trace.frames.findIndex(f => f.source.layoutId === 'split_tree');
      const secondSplit = trace.frames.findIndex((f, i) => i > firstSplit && f.source.layoutId === 'split_tree');
      if (firstSplit < 0 || secondSplit < 0 || firstParent < 0) throw new Error('missing split/merge fixture stages');
      const indices = [...new Set([firstSplit, secondSplit, lastSplit, firstParent, trace.frames.length - 1])].sort((a,b) => a-b);
      const reports = [];
      for (const index of indices) {
        await window.ASMTracePlayer.render(index, { stable: true });
        reports.push({ index, nodes: inspect(),
          split: window.ASMTraceRenderers.currentPlacement('split_tree', false),
          merge: window.ASMTraceRenderers.currentPlacement('merge_tree', false) });
      }
      // Actual trace import/use/export/import, including legacy missing fields
      // and explicit disabled/custom settings, not merely parser assertions.
      const reload = JSON.parse(JSON.stringify(trace));
      window.ASMTracePlayer.apply(reload);
      await window.ASMTracePlayer.render(indices.at(-1), { stable: true });
      const reopened = inspect();
      const legacy = JSON.parse(JSON.stringify(trace));
      legacy.layouts.forEach(layout => { delete layout.growFrom; delete layout.reserve; delete layout.placeBinding; });
      window.ASMTracePlayer.apply(legacy);
      await window.ASMTracePlayer.render(1, { stable: true });
      const old = inspect();
      const disabled = JSON.parse(JSON.stringify(trace));
      disabled.layouts.forEach(layout => { layout.reserve = false; layout.growFrom = 'root'; layout.levelGap = 73; });
      window.ASMTracePlayer.apply(disabled);
      await window.ASMTracePlayer.render(1, { stable: true });
      const saved = JSON.parse(JSON.stringify(disabled));
      window.ASMTracePlayer.apply(saved);
      await window.ASMTracePlayer.render(1, { stable: true });
      return { reports, reopened, old, disabled: saved.layouts, build: window.ASMTraceRenderers.build };
    }, trace);
    assert.equal(reports.build, RENDERER_BUILD);
    const final = reports.reports.at(-1);
    const rootNode = final.nodes.find(n => n.layout === 'split_tree' && !n.parent);
    const firstRoot = reports.reports[0].nodes.find(n => n.layout === 'split_tree' && n.activation === rootNode.activation);
    assert.ok(Math.abs(firstRoot.x - rootNode.x) < 0.1, `root slot is stable as sibling branches appear: ${JSON.stringify({ firstRoot, rootNode, layouts: reports.reports.map(r => ({ index: r.index, split: r.split, merge: r.merge })) })}`);
    const firstLeft = reports.reports[1].nodes.find(n => n.layout === 'split_tree' && n.parent);
    const finalLeft = final.nodes.find(n => n.layout === 'split_tree' && n.activation === firstLeft.activation);
    assert.ok(Math.abs(firstLeft.x - finalLeft.x) < 0.1, 'left branch starts at its final slot without a visible preview');
    for (const report of reports.reports) {
      if (report.merge) {
        assert.ok(Math.abs(report.merge.x - report.split.x) < 0.1, 'layout top-left is aligned with split bottom-left');
        assert.ok(Math.abs(report.merge.y - report.split.y - report.split.height - 40) < 0.1, 'explicit layout offset is exact');
      }
      for (const child of report.nodes.filter(n => n.layout === 'merge_tree' && n.parent)) {
        const parent = report.nodes.find(n => n.id === child.parent);
        if (parent) assert.ok(Math.abs(parent.y - child.y - child.height - 60) < 0.1,
          `merge gap remains 60px at frame ${report.index + 1}, ${child.id}`);
      }
    }
    assert.deepEqual(reports.reopened, final.nodes, 'serialized trace reopens with identical geometry');
    for (const split of final.nodes.filter(n => n.layout === 'split_tree')) {
      const merge = final.nodes.find(n => n.layout === 'merge_tree' && n.activation === split.activation);
      if (merge) assert.ok(Math.abs(split.x + split.width / 2 - merge.x - merge.width / 2) < 0.1,
        `paired split/merge horizontal slots align for ${split.activation}`);
    }
    assert.ok(reports.old.length, 'old trace without new fields still loads and draws');
    assert.ok(reports.disabled.every(l => l.reserve === false && l.growFrom === 'root' && l.levelGap === 73));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
