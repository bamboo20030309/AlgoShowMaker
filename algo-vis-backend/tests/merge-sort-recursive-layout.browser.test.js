/**
 * Recursive Merge Sort layout lifecycle checks.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('branch preview renders the kept child without duplicating the live recursion object',
  { timeout: 60000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const code = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout.cpp'
    ), 'utf8').replace(/\r\n/g, '\n').replace('branch-previews off', 'branch-previews on');
    const input = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout-sample_input.txt'
    ), 'utf8');
    const { trace } = await compile(code, input);
    const previewIndex = trace.frames.findIndex(frame => frame.source?.systemBranchPreview);
    assert.ok(previewIndex > 0, 'branch-previews on inserts a preview after the root frame');
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.goto(`${base}/algorithm.html`);
      const report = await page.evaluate(async ({ sourceTrace, targetIndex }) => {
        window.ASMTracePlayer.apply(sourceTrace);
        const read = label => ({
          label,
          splitNodes: [...document.querySelectorAll(
            '#asm-trace-root [data-trace-layout-id="split_tree"][data-trace-layout-node]'
          )].filter(node => (
            node.dataset.traceSnapshot || !node.closest('.asm-trace-snapshot')
          )).map(node => ({
            id: node.dataset.traceLayoutNode || '',
            activationId: node.dataset.traceLayoutActivation || '',
            snapshotId: node.dataset.traceSnapshot || '',
            text: [...node.querySelectorAll('text')].map(item => item.textContent).join(' ')
          }))
        });
        await window.ASMTracePlayer.render(targetIndex - 1, { stable: true });
        const transition = window.ASMTracePlayer.render(targetIndex, {
          fromIndex: targetIndex - 1,
          forceTransition: true
        });
        await new Promise(resolve => requestAnimationFrame(resolve));
        const samples = [read('transition')];
        await transition;
        samples.push(read('settled'));
        return {
          samples,
          previewSnapshotId: sourceTrace.frames[targetIndex].source.previewSnapshotId
        };
      }, { sourceTrace: trace, targetIndex: previewIndex });
      report.samples.forEach(sample => {
        const liveNodes = sample.splitNodes.filter(node => !node.snapshotId);
        assert.deepEqual(liveNodes, [],
          `the preview snapshot replaces its temporary live part in ${sample.label}: ${JSON.stringify(report)}`);
        assert.equal(sample.splitNodes.filter(node => (
          node.snapshotId === report.previewSnapshotId
        )).length, 1, `the selected branch appears exactly once in ${sample.label}`);
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });

test('retained recursive keep nodes do not replay an entrance when a child is added',
  { timeout: 60000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const code = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout.cpp'
    ), 'utf8').replace(/\r\n/g, '\n').replace(/    \/\/ @frame num\n    \/\/ @place num.top-left at split_tree.root.top-left\n    \/\/ @text [^\n]*\n/, '').replace('void merge_sort(vector<int>& num, int L, int R) {', 'void merge_sort(vector<int>& num, int L, int R) {\n    vector<int> part(num.begin()+L,num.begin()+R+1);').replaceAll('@frame num with range(L,R)', '@frame part').replaceAll('@frame num as merged with range(L,R)', '@frame part').replaceAll('@style num[L] mark', '@style part[0] mark').replace('in merge_scene\n        // @keep', 'in merge_scene color AV_green! width 2\n        // @keep');
    const input = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout-sample_input.txt'
    ), 'utf8');
    const { trace } = await compile(code, '8\n38 27 43 3 9 82 10 19\n');
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await page.goto(`${base}/algorithm.html`);
      const report = await page.evaluate(async sourceTrace => {
        window.ASMTracePlayer.apply(sourceTrace);
        await window.ASMTracePlayer.render(0, { stable: true });
        const read = label => ({
          label,
          nodes: [...document.querySelectorAll('#asm-trace-root [data-trace-snapshot]')]
            .map(node => {
              const rect = node.getBoundingClientRect();
              return {
                id: node.dataset.traceSnapshot,
                key: node.dataset.traceObjectKey,
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                transform: node.getAttribute('transform') || '',
                motion: node.querySelector(':scope > .asm-trace-motion')?.getAttribute('transform') || '',
                opacity: getComputedStyle(node).opacity,
                appearing: node.dataset.traceAppearing || '',
                growth: node.dataset.traceRecursionGrowth || ''
              };
            }),
          liveNodes: [...document.querySelectorAll(
            '#asm-trace-root [data-trace-layout-id="split_tree"][data-trace-layout-node]'
          )].filter(node => !node.dataset.traceSnapshot).map(node => {
            const bounds = element => {
              const rect = element?.getBoundingClientRect?.();
              return rect && {
                x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                centerX: rect.x + rect.width / 2,
                centerY: rect.y + rect.height / 2
              };
            };
            return {
              nodeId: node.dataset.traceLayoutNode || '',
              activationId: node.dataset.traceLayoutActivation || '',
              parentId: node.dataset.traceLayoutParent || '',
              motion: node.querySelector(':scope > .asm-trace-motion')?.getAttribute('transform') || '',
              growth: node.dataset.traceRecursionGrowth || '',
              appearing: node.dataset.traceAppearing || '',
              outerframe: bounds(node.querySelector('.outerframe-bg')),
              firstCell: bounds(node.querySelector('[data-trace-index]')),
              independentlyEnteringDescendants: node.querySelectorAll(
                '[data-trace-appearing="1"]'
              ).length
            };
          }),
          ghostLayoutEdges: document.querySelectorAll(
            '#asm-trace-root .asm-trace-layout-edge.asm-trace-transition-ghost'
          ).length
        });
        const samples = [read('before')];
        const transition = window.ASMTracePlayer.render(1, {
          fromIndex: 0,
          forceTransition: true
        });
        for (const [label, wait] of [['start', 0], ['early', 80], ['middle', 260]]) {
          if (wait) await new Promise(resolve => setTimeout(resolve, wait));
          else await new Promise(resolve => requestAnimationFrame(resolve));
          samples.push(read(label));
        }
        await transition;
        samples.push(read('after'));
        return { samples };
      }, trace);
      const start = report.samples.find(sample => sample.label === 'start');
      const enteringKeep = start.nodes.find(node => node.id === 'snapshot:frame:1');
      assert.ok(enteringKeep, `new retained child exists: ${JSON.stringify(report)}`);
      assert.equal(enteringKeep.growth, '',
        'a kept child uses its preceding live visual instead of recursion growth');
      assert.equal(enteringKeep.appearing, '', 'the kept child does not replay object entrance');
      assert.doesNotMatch(enteringKeep.motion, /scale\(/,
        'the kept child is not scaled out of its parent slot');
      const expectedActivation = trace.frames[1].source.recursionActivationId;
      const growingLive = start.liveNodes.find(node => (
        node.nodeId.startsWith('layout-live:') && node.activationId === expectedActivation
      ));
      assert.ok(growingLive, `the newest recursive call remains a live layout node: ${JSON.stringify(report)}`);
      assert.equal(growingLive.growth, '1',
        'the live recursive child grows out of its retained parent');
      assert.equal(growingLive.appearing, '',
        'recursive growth replaces the ordinary declaration entrance');
      assert.equal(growingLive.independentlyEnteringDescendants, 0,
        'the outerframe and cells ride the recursive node instead of entering separately');
      assert.match(growingLive.motion, /scale\(/,
        'the live recursive child receives the recursion growth transform');
      const retainedParent = start.nodes.find(node => node.id === 'snapshot:frame:1');
      assert.ok(retainedParent, `the retained parent has measurable geometry: ${JSON.stringify(report)}`);
      assert.ok(growingLive.outerframe && growingLive.firstCell,
        `the growing child exposes one bound outerframe and its cells: ${JSON.stringify(report)}`);
      const parentCenterX = retainedParent.x + retainedParent.width / 2;
      const parentCenterY = retainedParent.y + retainedParent.height / 2;
      assert.ok(Math.abs(growingLive.outerframe.centerX - parentCenterX) < 2,
        'the child outerframe starts horizontally centered on its parent');
      assert.ok(Math.abs(growingLive.outerframe.centerY - parentCenterY) < 2,
        'the child outerframe starts at the parent center before growing downward');
      assert.ok(growingLive.firstCell.centerX >= growingLive.outerframe.x
        && growingLive.firstCell.centerX <= growingLive.outerframe.x + growingLive.outerframe.width,
      'the first cell stays bound inside the growing outerframe');
      const settledChild = report.samples.find(sample => sample.label === 'after')
        .liveNodes.find(node => node.activationId === expectedActivation);
      const settledParent = report.samples.find(sample => sample.label === 'after')
        .nodes.find(node => node.id === 'snapshot:frame:1');
      // Screen widths also include the concurrent auto-camera zoom. The kept
      // parent has fixed world geometry, so its ratio removes that camera scale.
      const cameraRatio = retainedParent.width / settledParent.width;
      const scaleRatio = growingLive.outerframe.width / settledChild.outerframe.width / cameraRatio;
      assert.ok(scaleRatio > 0.68 && scaleRatio < 0.76,
        `the child outerframe uses the same 0.72 structural scale (${scaleRatio})`);
      assert.ok(settledChild.outerframe.centerY
        > settledParent.y + settledParent.height / 2,
      'the split child finishes below its parent in the top-down direction');
      report.samples.slice(1, -1).forEach(sample => {
        const retainedParent = sample.nodes.find(node => node.id === 'snapshot:frame:1');
        assert.ok(retainedParent, `retained parent remains visible in ${sample.label}`);
        assert.equal(retainedParent.appearing, '');
        assert.equal(retainedParent.growth, '');
        assert.equal(sample.ghostLayoutEdges, 0,
          `stable activation edge identity prevents a floating ghost in ${sample.label}`);
      });
    } finally {
      await browser.close();
    }
  });

test('an existing recursion edge stays attached to its activation while a child edge grows',
  { timeout: 60000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const code = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout.cpp'
    ), 'utf8').replace(/\r\n/g, '\n').replace(/    \/\/ @frame num\n    \/\/ @place num.top-left at split_tree.root.top-left\n    \/\/ @text [^\n]*\n/, '').replace('void merge_sort(vector<int>& num, int L, int R) {', 'void merge_sort(vector<int>& num, int L, int R) {\n    vector<int> part(num.begin()+L,num.begin()+R+1);').replaceAll('@frame num with range(L,R)', '@frame part').replaceAll('@frame num as merged with range(L,R)', '@frame part').replaceAll('@style num[L] mark', '@style part[0] mark').replace('in merge_scene\n        // @keep', 'in merge_scene color AV_green! width 2\n        // @keep');
    const input = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout-sample_input.txt'
    ), 'utf8');
    const { trace } = await compile(code, '8\n38 27 43 3 9 82 10 19\n');
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.goto(`${base}/algorithm.html`);
      const report = await page.evaluate(async sourceTrace => {
        window.ASMTracePlayer.apply(sourceTrace);
        await window.ASMTracePlayer.render(1, { stable: true });
        const read = label => ({
          label,
          arrows: [...document.querySelectorAll('.asm-trace-layout-edge')].map(arrow => {
            const identity = JSON.parse(arrow.dataset.traceArrowIdentity || '{}');
            const previousIdentity = arrow._asmArrowTween?.previous?.dataset
              ?.traceArrowIdentity;
            return {
              id: identity.id || '',
              previousId: previousIdentity ? JSON.parse(previousIdentity).id || '' : '',
              x1: Number(arrow.getAttribute('x1')),
              y1: Number(arrow.getAttribute('y1')),
              x2: Number(arrow.getAttribute('x2')),
              y2: Number(arrow.getAttribute('y2'))
            };
          })
        });
        const before = read('before');
        const transition = window.ASMTracePlayer.render(2, {
          fromIndex: 1,
          forceTransition: true
        });
        const samples = [before];
        for (const [label, wait] of [['start', 0], ['early', 80], ['middle', 180]]) {
          if (wait) await new Promise(resolve => setTimeout(resolve, wait));
          else await new Promise(resolve => requestAnimationFrame(resolve));
          samples.push(read(label));
        }
        await transition;
        samples.push(read('after'));
        return samples;
      }, trace);
      const upperId = 'split_tree:activation-1:activation-2';
      const childId = 'split_tree:activation-2:activation-3';
      const beforeUpper = report[0].arrows.find(arrow => arrow.id === upperId);
      assert.ok(beforeUpper, `the preceding frame contains its upper edge: ${JSON.stringify(report)}`);
      report.slice(1).forEach(sample => {
        const upper = sample.arrows.find(arrow => arrow.id === upperId);
        assert.ok(upper, `the upper edge remains present in ${sample.label}`);
        for (const coordinate of ['x1', 'y1', 'x2', 'y2']) {
          assert.ok(Math.abs(upper[coordinate] - beforeUpper[coordinate]) < 1,
            `the upper edge ${coordinate} stays fixed in ${sample.label}`);
        }
      });
      const startUpper = report.find(sample => sample.label === 'start')
        .arrows.find(arrow => arrow.id === upperId);
      const startChild = report.find(sample => sample.label === 'start')
        .arrows.find(arrow => arrow.id === childId);
      assert.equal(startUpper.previousId, upperId,
        'the stable activation id pairs the upper edge with itself');
      assert.ok(startChild, 'the new descendant receives its own edge');
      assert.equal(startChild.previousId, '',
        'the new descendant edge is not paired with the upper edge');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });

test('a leaf copied from split tree to merge tree hands off to keep without a third part',
  { timeout: 60000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const code = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout.cpp'
    ), 'utf8').replace(/\r\n/g, '\n').replace('branch-previews off', 'branch-previews on').replace(/    \/\/ @frame num\n    \/\/ @place num.top-left at split_tree.root.top-left\n    \/\/ @text [^\n]*\n/, '').replace('void merge_sort(vector<int>& num, int L, int R) {', 'void merge_sort(vector<int>& num, int L, int R) {\n    vector<int> part(num.begin()+L,num.begin()+R+1);').replaceAll('@frame num with range(L,R)', '@frame part').replaceAll('@frame num as merged with range(L,R)', '@frame part');
    const input = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout-sample_input.txt'
    ), 'utf8');
    const { trace } = await compile(code, '8\n38 27 43 3 9 82 10 19\n');
    const partId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'part');
    const mergeIndex = trace.frames.findIndex(frame => (
      frame.source?.layoutId === 'merge_tree'
        && !frame.source?.systemBranchPreview
        && frame.source?.primaryVariableId === partId
        && Number(frame.source?.recursionDepth) === 3
        && Number(frame.source?.recursionSiblingIndex) === 1
    ));
    assert.ok(mergeIndex > 0 && mergeIndex + 1 < trace.frames.length,
      'sample contains the right leaf split-to-merge handoff');
    const activation = trace.frames[mergeIndex].source.recursionActivationId;
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.goto(`${base}/algorithm.html`);
      const samples = await page.evaluate(async ({ sourceTrace, index, activationId }) => {
        window.ASMTracePlayer.apply(sourceTrace);
        await window.ASMTracePlayer.render(index - 1, { stable: true });
        const read = label => {
          const nodes = [...document.querySelectorAll(
            '#asm-trace-root [data-trace-layout-id="merge_tree"][data-trace-layout-node]'
          )].filter(node => (
            node.dataset.traceSnapshot || !node.closest('.asm-trace-snapshot')
          )).filter(node => node.dataset.traceLayoutActivation === activationId);
          return {
            label,
            count: nodes.length,
            ghosts: nodes.filter(node => (
              node.classList.contains('asm-trace-transition-ghost')
                || Boolean(node.closest('.asm-trace-transition-ghost-motion'))
            )).length
          };
        };
        const result = [];
        for (const targetIndex of [index, index + 1]) {
          let settled = false;
          const transition = window.ASMTracePlayer.render(targetIndex, {
            fromIndex: targetIndex - 1, forceTransition: true
          });
          transition.finally(() => { settled = true; });
          for (let tick = 0; tick < 360 && !settled; tick += 1) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            result.push(read(`${targetIndex}:${tick}`));
          }
          await transition;
          result.push(read(`${targetIndex}:settled`));
        }
        return result;
      }, { sourceTrace: trace, index: mergeIndex, activationId: activation });
      samples.forEach(sample => {
        assert.equal(sample.count, 1,
          `the merge-tree leaf has one visual in ${sample.label}: ${JSON.stringify(samples)}`);
        assert.equal(sample.ghosts, 0,
          `the merge-tree leaf does not leave an exit ghost in ${sample.label}`);
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });

test('a kept green leaf link hands off without leaving a duplicate ghost',
  { timeout: 60000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const code = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout.cpp'
    ), 'utf8').replace(/\r\n/g, '\n').replace(/    \/\/ @frame num\n    \/\/ @place num.top-left at split_tree.root.top-left\n    \/\/ @text [^\n]*\n/, '').replace('void merge_sort(vector<int>& num, int L, int R) {', 'void merge_sort(vector<int>& num, int L, int R) {\n    vector<int> part(num.begin()+L,num.begin()+R+1);').replaceAll('@frame num with range(L,R)', '@frame part').replaceAll('@frame num as merged with range(L,R)', '@frame part').replaceAll('@style num[L] mark', '@style part[0] mark').replace('in merge_scene\n        // @keep', 'in merge_scene color AV_green! width 2\n        // @keep').replace('@keep last as \"merge\" in merge_tree\n        return;', '@keep last as \"merge\" in merge_tree\n        // @frame part in merge_tree\n        return;');
    const input = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout-sample_input.txt'
    ), 'utf8');
    const { trace } = await compile(code, '8\n38 27 43 3 9 82 10 19\n');
    const baseId = trace.frames[4].arrows[0].id;
    const retainedId = trace.frames[5].arrows[0].id;
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.goto(`${base}/algorithm.html`);
      const report = await page.evaluate(async sourceTrace => {
        window.ASMTracePlayer.apply(sourceTrace);
        await window.ASMTracePlayer.render(4, { stable: true });
        const read = label => ({
          label,
          arrows: [...document.querySelectorAll('[data-trace-arrow-source="directive"]')]
            .map(arrow => {
              const identity = JSON.parse(arrow.dataset.traceArrowIdentity || '{}');
              const previousIdentity = arrow._asmArrowTween?.previous?.dataset
                ?.traceArrowIdentity;
              return {
                id: identity.id || '',
                handoffFromId: identity.handoffFromId || '',
                previousId: previousIdentity ? JSON.parse(previousIdentity).id || '' : '',
                ghost: arrow.classList.contains('asm-trace-transition-ghost')
                  || Boolean(arrow.closest('.asm-trace-transition-ghost-motion')),
                stroke: arrow.getAttribute('stroke') || ''
              };
            })
        });
        const samples = [read('before')];
        const first = window.ASMTracePlayer.render(5, { fromIndex: 4, forceTransition: true });
        for (const [label, wait] of [['handoff-start', 0], ['handoff-middle', 160]]) {
          if (wait) await new Promise(resolve => setTimeout(resolve, wait));
          else await new Promise(resolve => requestAnimationFrame(resolve));
          samples.push(read(label));
        }
        await first;
        samples.push(read('handoff-after'));
        const second = window.ASMTracePlayer.render(6, { fromIndex: 5, forceTransition: true });
        for (const [label, wait] of [['next-start', 0], ['next-middle', 160]]) {
          if (wait) await new Promise(resolve => setTimeout(resolve, wait));
          else await new Promise(resolve => requestAnimationFrame(resolve));
          samples.push(read(label));
        }
        await second;
        samples.push(read('next-after'));
        return samples;
      }, trace);
      report.forEach(sample => {
        assert.equal(sample.arrows.length, 1,
          `only one green directive arrow exists in ${sample.label}: ${JSON.stringify(report)}`);
        assert.equal(sample.arrows[0].ghost, false,
          `the green leaf link is never duplicated as a transition ghost in ${sample.label}`);
      });
      const start = report.find(sample => sample.label === 'handoff-start').arrows[0];
      assert.equal(start.id, retainedId);
      assert.equal(start.handoffFromId, baseId);
      assert.equal(start.previousId, baseId,
        'the retained arrow reuses the live arrow visual during its one-time handoff');
      report.filter(sample => sample.label.startsWith('next-')).forEach(sample => {
        assert.equal(sample.arrows[0].id, retainedId,
          'the following frame keeps the permanent snapshot-qualified identity');
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });

test('a live merged value occupies the parent slot above its completed children',
  { timeout: 60000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const code = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout.cpp'
    ), 'utf8');
    const input = fs.readFileSync(path.join(
      __dirname, '../algorithm_sample/Sorting/merge_sort_recursive_layout-sample_input.txt'
    ), 'utf8');
    const { trace } = await compile(code, input);
    const snapshotsById = new Map(trace.snapshots.map(snapshot => [snapshot.id, snapshot]));
    const frameIndex = trace.frames.findIndex(frame => {
      const activationId = String(frame.source?.recursionActivationId || '');
      if (frame.source?.layoutId !== 'merge_tree' || !activationId) return false;
      return (frame.snapshotIds || []).map(id => snapshotsById.get(id)).filter(Boolean)
        .some(snapshot => snapshot.layoutId === 'merge_tree'
          && String(snapshot.recursionParentActivationId || '') === activationId);
    });
    assert.ok(frameIndex >= 0, 'sample contains a merge frame with completed child nodes');
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await page.goto(`${base}/algorithm.html`);
      const report = await page.evaluate(async ({ sourceTrace, targetIndex }) => {
        window.ASMTracePlayer.apply(sourceTrace);
        await window.ASMTracePlayer.render(targetIndex, { stable: true });
        const nodes = [...document.querySelectorAll(
          '#asm-trace-root [data-trace-layout-id="merge_tree"][data-trace-layout-node]'
        )].map(node => {
          const rect = node.getBoundingClientRect();
          return {
            id: node.dataset.traceLayoutNode || '',
            parentId: node.dataset.traceLayoutParent || '',
            activationId: node.dataset.traceLayoutActivation || '',
            live: !node.dataset.traceSnapshot,
            y: rect.y,
            bottom: rect.bottom
          };
        });
        return {
          nodes,
          activationId: sourceTrace.frames[targetIndex].source.recursionActivationId
        };
      }, { sourceTrace: trace, targetIndex: frameIndex });
      const live = report.nodes.find(node => node.live
        && node.id.startsWith('layout-live:')
        && node.activationId === report.activationId);
      assert.ok(live, `merge frame has a live parent node: ${JSON.stringify(report)}`);
      const children = report.nodes.filter(node => node.parentId === live.id);
      assert.ok(children.length >= 1, `completed merge nodes attach to the live parent: ${JSON.stringify(report)}`);
      children.forEach(child => assert.ok(child.bottom <= live.y,
        'bottom-up merge children stay above the parent slot occupied by merged'));
    } finally {
      await browser.close();
    }
  });
