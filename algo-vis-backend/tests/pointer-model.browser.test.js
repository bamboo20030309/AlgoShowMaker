/**
 * 測試模組：pointer-model.browser.test
 *
 * 驗證 canonical pointer model 已實際接到瀏覽器 renderer，且驗證模式不會靜默切回 legacy。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { TWEEN_BUILD, RENDERER_BUILD } = require('./helpers/builds');

test('browser renderer uses canonical pointer states without a silent legacy fallback', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(build => (
      window.ASMTracePointerModel?.build === 'pointer-4'
      && window.ASMTraceRenderers?.build === build
    ), RENDERER_BUILD);
    const result = await page.evaluate(async () => {
      const scalar = value => ({ kind: 'scalar', value });
      const traceDocument = {
        variables: {
          num: { id: 'num', name: 'num', kind: 'sequence' },
          i: { id: 'i', name: 'i', kind: 'scalar' },
          j: { id: 'j', name: 'j', kind: 'scalar' }
        },
        skins: {},
        snapshots: [], layouts: [], rules: [], studio: {}, frames: []
      };
      const frame = {
        id: 'pointer-model-browser', source: { primaryVariableId: 'num' },
        state: {
          num: { identity: 'num-runtime', name: 'num', data: {
            kind: 'sequence', items: [scalar(3), scalar(1), scalar(4)]
          } },
          i: { identity: 'i-runtime', name: 'i', data: scalar(1) },
          j: { identity: 'j-runtime', name: 'j', data: scalar(1) }
        },
        events: [], bindings: [
          { mode: 'index', targetVariableId: 'num', sourceVariableId: 'i',
            sourceName: 'i', indexExpression: 'i' },
          { mode: 'index', targetVariableId: 'num', sourceVariableId: 'j',
            sourceName: 'j', indexExpression: 'j' }
        ],
        objectBindings: [], renderers: {}, rendererOptions: {}, captureOnlyVariableIds: ['i', 'j'],
        texts: [], segments: [], arrows: [], snapshotIds: [], styles: []
      };
      traceDocument.frames.push(frame);
      await window.ASMTraceRenderers.renderFrame(traceDocument, frame, null, {
        animatePositions: false, animateEvents: false
      });
      const canonical = [...document.querySelectorAll('[data-trace-pointer-id]')].map(node => ({
        id: node.dataset.tracePointerId,
        instanceId: node.dataset.tracePointerInstanceId,
        target: node.dataset.tracePointerTargetKey,
        lane: node.dataset.tracePointerLane,
        slot: node.dataset.tracePointerSlot,
        groupSize: node.dataset.tracePointerGroupSize
      })).sort((left, right) => left.slot.localeCompare(right.slot));
      const canonicalMode = document.documentElement.dataset.asmTracePointerSystem;
      await window.ASMTraceRenderers.renderFrame(traceDocument, frame, null, {
        animatePositions: false, animateEvents: false
      });
      const repeatedMode = document.documentElement.dataset.asmTracePointerSystem;
      const matrixDocument = {
        variables: {
          grid: { id: 'grid', name: 'grid', kind: 'matrix' },
          row: { id: 'row', name: 'row', kind: 'scalar' },
          column: { id: 'column', name: 'column', kind: 'scalar' }
        },
        skins: { grid: { renderer: 'original-matrix', options: { markerLayout: 'axis' } } },
        snapshots: [], layouts: [], rules: [], studio: {}, frames: []
      };
      const matrixFrame = {
        id: 'pointer-matrix-browser', source: { primaryVariableId: 'grid' },
        state: {
          grid: { identity: 'grid-runtime', name: 'grid', data: { kind: 'matrix', items: [
            { kind: 'sequence', items: [scalar(1), scalar(2)] },
            { kind: 'sequence', items: [scalar(3), scalar(4)] }
          ] } },
          row: { identity: 'row-runtime', name: 'row', data: scalar(1) },
          column: { identity: 'column-runtime', name: 'column', data: scalar(0) }
        },
        events: [], bindings: [
          { mode: 'index', targetVariableId: 'grid', sourceVariableId: 'row',
            sourceName: 'row', indexExpression: 'row', indexDimension: 0 },
          { mode: 'index', targetVariableId: 'grid', sourceVariableId: 'column',
            sourceName: 'column', indexExpression: 'column', indexDimension: 1 }
        ],
        objectBindings: [], renderers: {}, rendererOptions: { grid: { markerLayout: 'axis' } },
        captureOnlyVariableIds: ['row', 'column'], texts: [], segments: [], arrows: [],
        snapshotIds: [], styles: []
      };
      matrixDocument.frames.push(matrixFrame);
      await window.ASMTraceRenderers.renderFrame(matrixDocument, matrixFrame, null, {
        animatePositions: false, animateEvents: false
      });
      const matrixLanes = Object.fromEntries(
        [...document.querySelectorAll('[data-trace-pointer-id]')].map(node => [
          node.querySelector('.trace-variable-marker-label-text')?.textContent,
          node.dataset.tracePointerLane
        ])
      );
      const unresolvedMatrixFrame = {
        ...matrixFrame,
        id: 'pointer-matrix-unresolved-browser',
        state: {
          ...matrixFrame.state,
          row: { identity: 'row-unresolved', name: 'row', data: { kind: 'scalar' } },
          column: { identity: 'column-unresolved', name: 'column', data: { kind: 'scalar' } }
        }
      };
      await window.ASMTraceRenderers.renderFrame(matrixDocument, unresolvedMatrixFrame, null, {
        animatePositions: false, animateEvents: false
      });
      const unresolvedMatrix = [...document.querySelectorAll('[data-trace-pointer-id]')].map(node => ({
        label: node.querySelector('.trace-variable-marker-label-text')?.textContent,
        lane: node.dataset.tracePointerLane,
        status: node.dataset.tracePointerStatus,
        target: node.dataset.tracePointerTargetKey
      }));
      return { canonical, canonicalMode, repeatedMode, matrixLanes, unresolvedMatrix,
        canonicalOnly: window.ASMTracePointerModel.canonicalOnly() };
    });
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.equal(result.canonicalMode, 'canonical');
    assert.equal(result.repeatedMode, 'canonical');
    assert.equal(result.canonicalOnly, true);
    assert.equal(result.canonical.length, 2);
    assert.equal(result.canonical[0].target, result.canonical[1].target);
    assert.equal(result.canonical[0].lane, 'top');
    assert.deepEqual(result.canonical.map(item => item.slot), ['0', '1']);
    assert.deepEqual(result.canonical.map(item => item.groupSize), ['2', '2']);
    assert.deepEqual(result.matrixLanes, { row: 'left', column: 'top' });
    assert.deepEqual(result.unresolvedMatrix.map(item => item.status), ['unresolved', 'unresolved']);
    assert.deepEqual(result.unresolvedMatrix.map(item => item.lane), ['left', 'top']);
    assert.notEqual(result.unresolvedMatrix[0].target, result.unresolvedMatrix[1].target);
  } finally {
    await browser.close();
  }
});

test('bottom-up merge markers exit, then initialized declarations enter at their cells', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Sorting/merge_sort_bottom_up.cpp'
  ), 'utf8');
  const input = fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Sorting/merge_sort_bottom_up-sample_input.txt'
  ), 'utf8');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(build => window.ASMTraceFrameTween?.build === build, TWEEN_BUILD);
    const result = await page.evaluate(async ({ code, input }) => {
      const analysis = await fetch('/trace/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
      }).then(response => response.json());
      const watches = [...new Set(analysis.frameDirectives.flatMap(item => item.variableIds))];
      const compiled = await fetch('/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, input, trace: { enabled: true, watches, sliceMode: 'manual' } })
      }).then(response => response.json());
      const trace = window.ASMTraceModel.normalizeTraceDocument(compiled.traceDocument || compiled.trace);
      const previous = trace.frames[4];
      const frame = trace.frames[5];
      const declarationIds = Object.fromEntries(frame.events.filter(event => event.type === 'declare')
        .flatMap(event => (event.targets || []).map(target => [
          trace.variables[target.variableId]?.name,
          event.id
        ]))
        .filter(([name]) => ['l', 'r'].includes(name)));
      const oldLMoveId = frame.events.find(event => (
        event.type === 'write'
        && (event.targets || []).some(target => trace.variables[target.variableId]?.name === 'l')
        && event.payload?.before?.value === 0
        && event.payload?.after?.value === 1
      ))?.id || '';
      await window.ASMTraceRenderers.renderFrame(trace, previous, null, {
        animatePositions: false, animateEvents: false
      });
      const markerNodes = () => [...document.querySelectorAll('[data-trace-pointer-instance-id]')];
      const labelOf = node => node.querySelector('.trace-variable-marker-label-text')?.textContent || '';
      const oldInstances = Object.fromEntries(markerNodes().map(node => [labelOf(node), node.dataset.tracePointerInstanceId]));
      const targetPrefix = String(markerNodes()[0]?.dataset.tracePointerTargetKey || '').split('#')[0];
      const firstCell = document.querySelector(`[data-trace-object-key="${targetPrefix}#0"]`).getBoundingClientRect();
      const effectiveOpacity = node => {
        let opacity = 1;
        for (let current = node; current; current = current.parentElement) {
          const value = Number.parseFloat(getComputedStyle(current).opacity);
          if (Number.isFinite(value)) opacity *= value;
        }
        return opacity;
      };
      window.asmGetAnimationPlaybackRate = () => 4;
      const samples = [];
      let settled = false;
      const transition = window.ASMTraceRenderers.renderFrame(trace, frame, previous, {
        direction: 1, animatePositions: true, animateEvents: true
      }).finally(() => { settled = true; });
      for (let count = 0; count < 720 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        samples.push({
          eventId: document.querySelector('[data-trace-active-event-id]')?.dataset.traceActiveEventId || '',
          markers: markerNodes().map(node => {
            const visual = node.querySelector(':scope > .asm-trace-motion') || node;
            const rect = visual.getBoundingClientRect();
            return {
              label: labelOf(node), instance: node.dataset.tracePointerInstanceId,
              x: rect.left + rect.width / 2, opacity: effectiveOpacity(visual)
            };
          })
        });
      }
      await transition;
      const final = markerNodes().map(node => {
        const visual = node.querySelector(':scope > .asm-trace-motion') || node;
        const rect = visual.getBoundingClientRect();
        return { label: labelOf(node), instance: node.dataset.tracePointerInstanceId,
          x: rect.left + rect.width / 2, opacity: effectiveOpacity(visual) };
      });
      const cellCenters = [2, 3].map(index => {
        const rect = document.querySelector(
          `[data-trace-object-key="${targetPrefix}#${index}"]`
        ).getBoundingClientRect();
        return rect.left + rect.width / 2;
      });
      // Reproduce the exact UI 11 -> 12 sequence after the preceding r++ frame.
      // Rendering frame 11 directly would hide state leaked by a completed tween,
      // so first play frame 10 -> 11 and then inspect the following transition.
      await window.ASMTraceRenderers.renderFrame(trace, trace.frames[9], null, {
        animatePositions: false, animateEvents: false
      });
      await window.ASMTraceRenderers.renderFrame(trace, trace.frames[10], trace.frames[9], {
        direction: 1, animatePositions: true, animateEvents: true
      });
      const lateInstances = Object.fromEntries(markerNodes().map(node => [
        labelOf(node), node.dataset.tracePointerInstanceId
      ]));
      const lateExitId = trace.frames[11].events.find(event => (
        event.type === 'scope-exit'
        && (event.targets || []).some(target => trace.variables[target.variableId]?.name === 'r')
      ))?.id || '';
      const lateSamples = [];
      let lateSettled = false;
      const lateTransition = window.ASMTraceRenderers.renderFrame(
        trace, trace.frames[11], trace.frames[10],
        { direction: 1, animatePositions: true, animateEvents: true }
      ).finally(() => { lateSettled = true; });
      for (let count = 0; count < 720 && !lateSettled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        lateSamples.push({
          eventId: document.querySelector('[data-trace-active-event-id]')?.dataset.traceActiveEventId || '',
          markers: markerNodes().map(node => {
            const visual = node.querySelector(':scope > .asm-trace-motion') || node;
            const rect = visual.getBoundingClientRect();
            return {
              label: labelOf(node), instance: node.dataset.tracePointerInstanceId,
              x: rect.left + rect.width / 2, opacity: effectiveOpacity(visual),
              slot: node.dataset.tracePointerSlot,
              groupSize: node.dataset.tracePointerGroupSize
            };
          })
        });
      }
      await lateTransition;
      const lateCellCenters = [5, 6].map(index => {
        const rect = document.querySelector(
          `[data-trace-object-key="${targetPrefix}#${index}"]`
        ).getBoundingClientRect();
        return rect.left + rect.width / 2;
      });
      return { oldInstances, firstCellLeft: firstCell.left, samples, final, cellCenters,
        declarationIds, oldLMoveId, lateInstances, lateExitId, lateSamples, lateCellCenters,
        build: window.ASMTraceFrameTween.build };
    }, { code, input });
    const visible = sample => sample.markers.filter(marker => marker.opacity > 0.05);
    const oldIds = new Set(Object.values(result.oldInstances));
    const newMarker = (sample, label) => visible(sample).find(marker => (
      marker.label === label && !oldIds.has(marker.instance)
    ));
    const diagnostic = result.samples.map((sample, index) => ({
      index, eventId: sample.eventId,
      old: visible(sample).filter(marker => oldIds.has(marker.instance))
        .map(marker => `${marker.label}:${Math.round(marker.x)}`),
      fresh: visible(sample).filter(marker => !oldIds.has(marker.instance))
        .map(marker => `${marker.label}:${Math.round(marker.x)}`)
    })).filter((sample, index, all) => index === 0
      || JSON.stringify(sample.old) !== JSON.stringify(all[index - 1].old)
      || JSON.stringify(sample.fresh) !== JSON.stringify(all[index - 1].fresh)
      || sample.eventId !== all[index - 1].eventId);
    assert.ok(result.samples.some(sample => visible(sample).some(marker => oldIds.has(marker.instance))),
      'the old lifetime starts visible');
    const oldRPositions = result.samples.filter(sample => sample.eventId === result.oldLMoveId)
      .flatMap(sample => visible(sample).filter(marker => (
        marker.label === 'r' && oldIds.has(marker.instance)
      )).map(marker => marker.x));
    assert.ok(Math.max(...oldRPositions) - Math.min(...oldRPositions) < 1,
      `r must not reflow while only l moves from 0 to 1: ${JSON.stringify(diagnostic)}`);
    assert.ok(result.samples.some(sample => (
      !visible(sample).some(marker => oldIds.has(marker.instance)) && !newMarker(sample, 'l')
    )), `old markers finish exiting before the new l marker enters: ${JSON.stringify(diagnostic)}`);
    const declarationX = label => {
      const sample = result.samples.find(candidate => (
        candidate.eventId === result.declarationIds[label] && newMarker(candidate, label)
      ));
      return sample ? newMarker(sample, label)?.x : NaN;
    };
    assert.ok(Math.abs(declarationX('l') - result.cellCenters[0]) < 2,
      `l must enter directly at num[2]: ${JSON.stringify(diagnostic)}`);
    assert.ok(Math.abs(declarationX('r') - result.cellCenters[1]) < 2,
      `r must enter directly at num[3]: ${JSON.stringify(diagnostic)}`);
    for (const [index, label] of ['l', 'r'].entries()) {
      const marker = result.final.find(candidate => candidate.label === label && candidate.opacity > 0.95);
      assert.ok(marker && !oldIds.has(marker.instance), `${label} must use a new lifetime instance`);
      assert.ok(Math.abs(marker.x - result.cellCenters[index]) < 2,
        `${label} must finish at num[${index + 2}]`);
    }
    const lateExitSamples = result.lateSamples.filter(sample => sample.eventId === result.lateExitId);
    assert.ok(lateExitSamples.length > 0, 'the 11 -> 12 transition reaches the old r exit');
    for (const [index, label] of ['l', 'r'].entries()) {
      const positions = lateExitSamples.flatMap(sample => sample.markers.filter(marker => (
        marker.label === label
        && marker.instance === result.lateInstances[label]
        && marker.opacity > 0.05
      )));
      assert.ok(positions.length > 0, `${label} remains visible at the beginning of its exit`);
      assert.ok(positions.every(marker => (
        Math.abs(marker.x - result.lateCellCenters[index]) < 2
        && marker.slot === '0'
        && marker.groupSize === '1'
      )), `${label} must leave as a centered single marker after l/r separate`);
    }
    assert.equal(result.build, TWEEN_BUILD);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('frame 11 to 12 recenters both markers after r leaves their shared cell', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Sorting/merge_sort_bottom_up.cpp'
  ), 'utf8');
  const input = '10\n38 27 43 3 9 82 10 19 84 60\n';
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(build => window.ASMTraceFrameTween?.build === build, TWEEN_BUILD);
    const result = await page.evaluate(async ({ code, input }) => {
      const analysis = await fetch('/trace/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
      }).then(response => response.json());
      const watches = [...new Set(analysis.frameDirectives.flatMap(item => item.variableIds))];
      const compiled = await fetch('/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, input, trace: { enabled: true, watches, sliceMode: 'manual' } })
      }).then(response => response.json());
      const trace = window.ASMTraceModel.normalizeTraceDocument(compiled.traceDocument || compiled.trace);
      // The sample now places ++ before @frame: movement is captured in
      // frame 11, while scope exit remains in frame 12. Verify both in order.
      const previous = trace.frames[9];
      const frame = trace.frames[10];
      const exitFrame = trace.frames[11];
      const variableName = target => trace.variables[target?.variableId]?.name || '';
      const rWriteId = frame.events.find(event => (
        event.type === 'write'
        && (event.targets || []).some(target => variableName(target) === 'r')
        && event.payload?.before?.value === 5
        && event.payload?.after?.value === 6
      ))?.id || '';
      const oldRExitId = exitFrame.events.find(event => (
        event.type === 'scope-exit'
        && (event.targets || []).some(target => variableName(target) === 'r')
      ))?.id || '';
      await window.ASMTraceRenderers.renderFrame(trace, previous, null, {
        animatePositions: false, animateEvents: false
      });
      const nodes = () => [...document.querySelectorAll('[data-trace-pointer-instance-id]')];
      const labelOf = node => node.querySelector('.trace-variable-marker-label-text')?.textContent || '';
      const oldInstances = Object.fromEntries(nodes().map(node => [
        labelOf(node), node.dataset.tracePointerInstanceId
      ]));
      const targetPrefix = String(nodes()[0]?.dataset.tracePointerTargetKey || '').split('#')[0];
      const cellCenters = [5, 6].map(index => {
        const rect = document.querySelector(
          `[data-trace-object-key="${targetPrefix}#${index}"]`
        ).getBoundingClientRect();
        return rect.left + rect.width / 2;
      });
      const effectiveOpacity = node => {
        let opacity = 1;
        for (let current = node; current; current = current.parentElement) {
          const value = Number.parseFloat(getComputedStyle(current).opacity);
          if (Number.isFinite(value)) opacity *= value;
        }
        return opacity;
      };
      window.asmGetAnimationPlaybackRate = () => 4;
      const samples = [];
      let settled = false;
      const transition = (async () => {
        await window.ASMTraceRenderers.renderFrame(trace, frame, previous, {
          direction: 1, animatePositions: true, animateEvents: true
        });
        await window.ASMTraceRenderers.renderFrame(trace, exitFrame, frame, {
          direction: 1, animatePositions: true, animateEvents: true
        });
      })().finally(() => { settled = true; });
      for (let count = 0; count < 900 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        samples.push({
          eventId: document.querySelector('[data-trace-active-event-id]')?.dataset.traceActiveEventId || '',
          markers: nodes().map(node => {
            const visual = node.querySelector(':scope > .asm-trace-motion') || node;
            const rect = visual.getBoundingClientRect();
            return {
              label: labelOf(node), instance: node.dataset.tracePointerInstanceId,
              x: rect.left + rect.width / 2, opacity: effectiveOpacity(visual),
              slot: node.dataset.tracePointerSlot,
              groupSize: node.dataset.tracePointerGroupSize,
              path: node.querySelector('.trace-variable-marker-point path')?.getAttribute('d') || ''
            };
          })
        });
      }
      await transition;
      return { frameCount: trace.frames.length, rWriteId, oldRExitId,
        oldInstances, cellCenters, samples };
    }, { code, input });
    assert.equal(result.frameCount, 61);
    assert.ok(result.rWriteId, 'frame 11 contains r: 5 -> 6');
    assert.ok(result.oldRExitId, 'frame 12 contains the old r scope exit');
    const exitIndex = result.samples.findIndex(sample => sample.eventId === result.oldRExitId);
    assert.ok(exitIndex > 0, 'the old r exit occurs after its assignment');
    const separated = result.samples.slice(0, exitIndex).reverse().find(sample => {
      const old = sample.markers.filter(marker => (
        marker.instance === result.oldInstances[marker.label] && marker.opacity > 0.95
      ));
      return old.length === 2 && old.every(marker => marker.groupSize === '1');
    });
    assert.ok(separated, 'l/r become two single-marker groups before either exits');
    const verticalPath = 'M 0 -22 L 0 -2 M -3 -8 L 0 -2 L 3 -8';
    for (const [index, label] of ['l', 'r'].entries()) {
      const marker = separated.markers.find(candidate => (
        candidate.label === label && candidate.instance === result.oldInstances[label]
      ));
      assert.ok(marker, `${label} old lifetime remains visible before exit`);
      assert.equal(marker.slot, '0');
      assert.equal(marker.groupSize, '1');
      assert.equal(marker.path, verticalPath);
      assert.ok(Math.abs(marker.x - result.cellCenters[index]) < 2,
        `${label} must be centered on num[${index + 5}] before exit`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
