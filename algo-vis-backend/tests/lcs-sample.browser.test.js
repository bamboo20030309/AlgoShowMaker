const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('LCS matching labels stay green while +1 replaces the old target value', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(__dirname, '../algorithm_sample/DP/LCS.cpp'), 'utf8');
  const input = fs.readFileSync(path.join(__dirname, '../algorithm_sample/DP/LCS-sample_input.txt'), 'utf8');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage();
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ASMTraceRenderers?.renderFrame);
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
      const byName = Object.fromEntries(Object.entries(trace.variables)
        .map(([id, variable]) => [variable.name, id]));
      const options = trace.frames.at(-1).rendererOptions[byName.LCS];
      const frame = trace.frames.find(candidate => {
        const bindings = candidate.bindings.filter(binding => ['i', 'j'].includes(binding.sourceName));
        if (bindings.length !== 2) return false;
        const row = Number(candidate.state[bindings[0].sourceVariableId].data.value);
        const column = Number(candidate.state[bindings[1].sourceVariableId].data.value);
        return options.rowLabels.values[row] === options.columnLabels.values[column];
      });
      const [rowBinding, columnBinding] = frame.bindings;
      const row = Number(frame.state[rowBinding.sourceVariableId].data.value);
      const column = Number(frame.state[columnBinding.sourceVariableId].data.value);
      await window.ASMTraceRenderers.renderFrame(trace, frame, null, {
        animatePositions: false, animateEvents: false
      });
      const rowFill = document.querySelector(
        `[data-trace-object-key="${byName.LCS}:row-label:${row}"] > rect`
      )?.getAttribute('fill');
      const columnFill = document.querySelector(
        `[data-trace-object-key="${byName.LCS}:column-label:${column}"] > rect`
      )?.getAttribute('fill');
      const frameIndex = trace.frames.indexOf(frame);
      const previous = trace.frames[frameIndex - 1];
      await window.ASMTraceRenderers.renderFrame(trace, previous, null, {
        animatePositions: false, animateEvents: false
      });
      window.asmGetAnimationPlaybackRate = () => 4;
      const transferSamples = new Set();
      const targetFills = new Set();
      const literalTransforms = new Set();
      let literalInsideTarget = false;
      let literalCoversOldValue = false;
      let literalCenterDelta = Infinity;
      let transferRectSeen = false;
      let settled = false;
      const transition = window.ASMTraceRenderers.renderFrame(trace, frame, previous, {
        direction: 1, animatePositions: true, animateEvents: true
      }).finally(() => { settled = true; });
      for (let count = 0; count < 600 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const values = [...document.querySelectorAll('.asm-trace-assign-transfer-value text')]
          .map(node => node.textContent).sort();
        if (values.length) transferSamples.add(JSON.stringify(values));
        if (document.querySelector('.asm-trace-assign-transfer-value rect')) transferRectSeen = true;
        const target = document.querySelector(
          `[data-trace-object-key="${byName.LCS}#${row},${column}"] > rect`
        );
        if (target) targetFills.add(target.getAttribute('fill'));
        const literal = document.querySelector('.asm-trace-assign-literal-value text');
        const targetValue = document.querySelector(
          `[data-trace-object-key="${byName.LCS}#${row},${column}"] text[data-trace-content-role="value"]`
        );
        if (literal && target && targetValue) {
          const literalRect = literal.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const centerX = literalRect.left + literalRect.width / 2;
          const centerY = literalRect.top + literalRect.height / 2;
          literalInsideTarget ||= centerX >= targetRect.left && centerX <= targetRect.right
            && centerY >= targetRect.top && centerY <= targetRect.bottom;
          literalCoversOldValue ||= targetValue.getAttribute('opacity') === '0';
          const screenAnchor = node => {
            const point = node.ownerSVGElement.createSVGPoint();
            point.x = Number(node.getAttribute('x'));
            point.y = Number(node.getAttribute('y'));
            return point.matrixTransform(node.getScreenCTM());
          };
          const literalAnchor = screenAnchor(literal);
          const targetAnchor = screenAnchor(targetValue);
          literalCenterDelta = Math.min(literalCenterDelta, Math.hypot(
            literalAnchor.x - targetAnchor.x,
            literalAnchor.y - targetAnchor.y
          ));
          literalTransforms.add(literal.parentElement?.getAttribute('transform') || '');
        }
      }
      await transition;
      const finalTargetValue = document.querySelector(
        `[data-trace-object-key="${byName.LCS}#${row},${column}"] text[data-trace-content-role="value"]`
      );
      return {
        build: window.ASMTraceFrameTween.build,
        rowFill,
        columnFill,
        answerRendered: Boolean(document.querySelector(`[data-trace-object-key="${byName.ans}"]`)),
        assignment: frame.events.find(event => event.type === 'assign'
          && event.binaryOperation === '+'
          && event.targets?.[0]?.resolvedIndices?.[0] === row
          && event.targets?.[0]?.resolvedIndices?.[1] === column),
        transferSamples: [...transferSamples],
        transferRectSeen,
        targetFills: [...targetFills],
        literalInsideTarget,
        literalTransforms: [...literalTransforms],
        literalCoversOldValue,
        literalCenterDelta,
        finalTargetValue: finalTargetValue?.textContent,
        finalTargetOpacity: finalTargetValue?.getAttribute('opacity') || ''
      };
    }, { code, input });
    assert.equal(result.build, 'trace-259');
    assert.equal(result.rowFill, '#a5d6a7');
    assert.equal(result.columnFill, '#a5d6a7');
    assert.equal(result.answerRendered, false, 'the build-table frame must not render ans');
    assert.equal(result.assignment.binaryOperation, '+');
    assert.deepEqual(result.assignment.targets.slice(1).map(target => ({
      resolvedIndices: target.resolvedIndices,
      literal: target.literal,
      literalValue: target.literalValue
    })), [
      { resolvedIndices: [0, 4], literal: undefined, literalValue: undefined },
      { resolvedIndices: undefined, literal: true, literalValue: '1' }
    ]);
    assert.ok(result.transferSamples.includes(JSON.stringify(['+0', '+1'])), JSON.stringify(result));
    assert.equal(result.literalInsideTarget, true, JSON.stringify(result));
    assert.equal(result.literalCoversOldValue, true, JSON.stringify(result));
    assert.ok(result.literalCenterDelta < 1, JSON.stringify(result));
    assert.deepEqual(result.literalTransforms, [''], 'literal must not translate from a synthetic source');
    assert.equal(result.finalTargetValue, '1');
    assert.notEqual(result.finalTargetOpacity, '0');
    assert.equal(result.transferRectSeen, false, 'value-only assignment must not clone cell backgrounds');
    assert.ok(result.targetFills.every(fill => ['#fff', '#ffffff'].includes(fill)), JSON.stringify(result));
  } finally {
    await browser.close();
  }
});

test('LCS DFS draws the active path and removes returned edges', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(__dirname, '../algorithm_sample/DP/LCS.cpp'), 'utf8');
  const input = 'abcde\nace\n';
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage();
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ASMTraceRenderers?.renderFrame);
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
      const dfsFrames = trace.frames.filter(frame => frame.source?.function === 'dfs');
      const deepest = [...dfsFrames].sort((left, right) =>
        (right.source.recursionAncestorActivationIds?.length || 0)
        - (left.source.recursionAncestorActivationIds?.length || 0))[0];
      const deepestIndex = trace.frames.indexOf(deepest);
      const returned = trace.frames.slice(deepestIndex + 1).find(frame =>
        (frame.source?.recursionAncestorActivationIds?.length || 0)
          < (deepest.source.recursionAncestorActivationIds?.length || 0));
      const renderAndInspect = async frame => {
        await window.ASMTraceRenderers.renderFrame(trace, frame, null, {
          animatePositions: false, animateEvents: false
        });
        return {
          count: document.querySelectorAll('[data-trace-arrow-runtime-id*="@activation-"]').length,
          text: [...document.querySelectorAll('.asm-trace-text-object')]
            .map(node => node.textContent).join('')
        };
      };
      const sourceIndex = trace.frames.findIndex((frame, index) => {
        const activation = frame.source?.recursionActivationId;
        return frame.arrows?.some(arrow => arrow.until === 'return')
          && trace.frames[index + 1]?.source?.recursionAncestorActivationIds?.includes(activation);
      });
      const sourceFrame = trace.frames[sourceIndex], childFrame = trace.frames[sourceIndex + 1];
      await window.ASMTraceRenderers.renderFrame(trace, sourceFrame, null, {
        animatePositions: false, animateEvents: false
      });
      const sourceKeys = [...document.querySelectorAll('[data-trace-arrow-source="directive"]')]
        .map(node => node.dataset.traceObjectKey).filter(Boolean);
      await window.ASMTraceRenderers.renderFrame(trace, childFrame, sourceFrame, {
        animatePositions: false, animateEvents: false
      });
      const childArrows = [...document.querySelectorAll('[data-trace-arrow-source="directive"]')];
      const childKeys = new Set(childArrows.map(node => node.dataset.traceObjectKey).filter(Boolean));
      const pathColors = childArrows.filter(node =>
        node.dataset.traceArrowRuntimeId?.includes('@activation-'))
        .map(node => node.getAttribute('stroke'));
      const deepestView = await renderAndInspect(deepest);
      const returnedView = await renderAndInspect(returned);
      return {
        expectedDeepest: deepest.source.recursionAncestorActivationIds.length,
        deepestCount: deepestView.count,
        deepestText: deepestView.text,
        returnedCount: returnedView.count,
        missingContinuingKeys: sourceKeys.filter(key => !childKeys.has(key)),
        pathColors
      };
    }, { code, input });
    assert.equal(result.deepestCount, result.expectedDeepest, JSON.stringify(result));
    assert.match(result.deepestText, /目前累積字串就是 LCS：「ace」/, JSON.stringify(result));
    assert.ok(result.returnedCount < result.deepestCount, JSON.stringify(result));
    assert.deepEqual(result.missingContinuingKeys, [], JSON.stringify(result));
    assert.ok(result.pathColors.length >= 2, JSON.stringify(result));
    assert.ok(result.pathColors.every(color => color === '#a5d6a7'), JSON.stringify(result));
  } finally {
    await browser.close();
  }
});
