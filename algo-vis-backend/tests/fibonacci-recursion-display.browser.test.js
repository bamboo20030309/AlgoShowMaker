const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('Fibonacci recursion node changes from F(n) to its returned value', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Backtracking/fibonacci.cpp'
  ), 'utf8');
  const { trace } = await compile(code, '5\n');
  const pending = trace.snapshots.find(snapshot => (
    !snapshot.replacesSnapshotId && Number(snapshot.data?.value) === 2
  ));
  const returned = trace.snapshots.find(snapshot => (
    snapshot.replacesSnapshotId === pending?.id && Number(snapshot.data?.value) === 1
  ));
  assert.ok(pending && returned);
  const root = trace.snapshots.find(snapshot => (
    !snapshot.replacesSnapshotId && snapshot.objectId === 'F'
  ));
  const child = trace.snapshots.find(snapshot => (
    !snapshot.replacesSnapshotId && snapshot.objectId === 'F_1'
  ));
  const parentFrame = trace.frames.find(frame => (
    frame.snapshotIds.includes(root?.id) && !frame.snapshotIds.includes(child?.id)
  ));
  const childFrame = trace.frames.find(frame => frame.snapshotIds.includes(child?.id));
  const pendingFrame = trace.frames.find(frame => frame.snapshotIds.includes(pending?.id));
  const returnedFrame = trace.frames.find(frame => frame.snapshotIds.includes(returned?.id));
  assert.ok(root && child && parentFrame && childFrame && pendingFrame && returnedFrame);

  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${base}/algorithm.html`);
    const labels = await page.evaluate(async ({ sourceTrace, pendingId, returnedId, objectId }) => {
      const document = window.ASMTraceModel.normalizeTraceDocument(sourceTrace);
      const readNode = async snapshotId => {
        const frame = document.frames.find(candidate => candidate.snapshotIds.includes(snapshotId));
        await window.ASMTraceRenderers.renderFrame(document, frame, null, {
          animatePositions: false,
          animateEvents: false
        });
        return [...window.document.querySelectorAll(
          `[data-trace-object-key="${objectId}"] text`
        )].map(node => node.textContent);
      };
      return {
        pending: await readNode(pendingId),
        returned: await readNode(returnedId)
      };
    }, {
      sourceTrace: trace,
      pendingId: pending.id,
      returnedId: returned.id,
      objectId: pending.objectId
    });
    assert.ok(labels.pending.includes('F(2)'),
      `pending node shows the unresolved call: ${JSON.stringify(labels)}`);
    assert.ok(labels.returned.includes('1'), 'returned node shows the numeric result');
    assert.ok(!labels.returned.includes('F(2)'), 'returned node no longer shows the pending call');

    const firstChildPlan = await page.evaluate(async sourceTrace => {
      window.ASMTracePlayer.apply(sourceTrace);
      await new Promise(resolve => requestAnimationFrame(resolve));
      const transition = window.ASMTracePlayer.render(1, { fromIndex: 0, forceTransition: true });
      const plan = transition.playbackPlan;
      await transition;
      return plan;
    }, trace);
    assert.equal(firstChildPlan.phases.find(phase => phase.id === 'frame-transition')?.startMs, 0,
      'F(4) begins moving immediately instead of waiting behind a code-panel delay');
    assert.equal(firstChildPlan.phases.find(phase => phase.id === 'keep-transition')?.startMs, 0,
      'the keep handoff and tree reflow begin in the same tick');

    const callHighlights = await page.evaluate(async sourceTrace => {
      const document = window.ASMTraceModel.normalizeTraceDocument(sourceTrace);
      const rootActivation = document.frames.find(frame => (
        frame.source?.function === 'F' && frame.source?.recursionDepth === 0
      ))?.source?.recursionActivationId;
      const calls = document.callLifecycles.filter(event => (
        event.callerActivationId === rootActivation
        && event.source?.functionName === 'F'
      ));
      const show = async call => {
        const frame = document.frames.find(candidate => candidate.events.includes(call));
        call.enabled = true;
        window.ASMTraceCodePresenter.renderFrame(document, frame, {
          phases: [{ steps: [{ kind: 'trace-event', enabled: true, eventId: call.id }] }]
        });
        window.ASMTraceCodePresenter.setActiveEvent(call.id, 'start');
        const nodes = [...window.document.querySelectorAll(
          `[data-trace-event-ids~="${call.id}"]`
        )];
        const result = {
          text: nodes.map(node => node.textContent).join(''),
          complete: nodes.length > 0 && nodes.every(node => node.classList.contains('is-complete')),
          frameId: frame?.id || ''
        };
        await new Promise(resolve => setTimeout(resolve, 520));
        return result;
      };
      return {
        first: await show(calls[0]),
        second: await show(calls[1]),
        firstReturnOrder: calls[0]?.returnOrder,
        secondOrder: calls[1]?.order
      };
    }, trace);
    assert.match(callHighlights.first.text, /F\(n - 1\)/);
    assert.match(callHighlights.second.text, /F\(n - 2\)/);
    assert.ok(callHighlights.first.complete && callHighlights.second.complete,
      `each activation-scoped call reaches its own code highlight: ${JSON.stringify(callHighlights)}`);
    assert.notEqual(callHighlights.first.frameId, callHighlights.second.frameId,
      'left and right calls are not merged into one code frame');
    assert.ok(callHighlights.firstReturnOrder < callHighlights.secondOrder,
      'the right highlight is scheduled only after the left invocation returns');

    const finalArrows = await page.evaluate(async sourceTrace => {
      const document = window.ASMTraceModel.normalizeTraceDocument(sourceTrace);
      const finalFrame = document.frames.at(-1);
      await window.ASMTraceRenderers.renderFrame(document, finalFrame, null, {
        animatePositions: false,
        animateEvents: false
      });
      const root = window.document.getElementById('asm-trace-root');
      const flow = [...window.document.querySelectorAll('.asm-trace-recursion-flow-arrow')]
        .map(arrow => {
          const from = window.document.querySelector(
            `[data-trace-object-key="${arrow.dataset.traceArrowFromKey}"]`
          );
          const to = window.document.querySelector(
            `[data-trace-object-key="${arrow.dataset.traceArrowToKey}"]`
          );
          const fromBox = window.ASMArrowModel.presentedBounds(from, root, true);
          const toBox = window.ASMArrowModel.presentedBounds(to, root, true);
          const side = arrow.dataset.traceArrowCurveSide;
          const anchor = (box, targetSide) => targetSide === 'left'
            ? { x: box.x, y: box.y + box.height / 2 }
            : targetSide === 'right'
              ? { x: box.x + box.width, y: box.y + box.height / 2 }
              : targetSide === 'top'
                ? { x: box.x + box.width / 2, y: box.y }
                : { x: box.x + box.width / 2, y: box.y + box.height };
          const start = anchor(fromBox, side);
          const end = anchor(toBox, side);
          return {
            phase: arrow.dataset.traceFlowPhase,
            sequence: Number(arrow.dataset.traceFlowSequence),
            child: arrow.dataset.traceFlowChildActivation,
            fromAnchor: arrow.dataset.traceArrowFromAnchor,
            toAnchor: arrow.dataset.traceArrowToAnchor,
            stroke: arrow.getAttribute('stroke'),
            width: arrow.getAttribute('stroke-width'),
            path: arrow.getAttribute('d'),
            startError: Math.hypot(Number(arrow.dataset.traceArrowFromX) - start.x,
              Number(arrow.dataset.traceArrowFromY) - start.y),
            endError: Math.hypot(Number(arrow.dataset.traceArrowToX) - end.x,
              Number(arrow.dataset.traceArrowToY) - end.y)
          };
        });
      return {
        preorderTargets: [...window.document.querySelectorAll('.asm-trace-layout-edge')]
          .map(edge => edge.dataset.traceArrowToKey),
        flow
      };
    }, trace);
    assert.deepEqual(finalArrows.preorderTargets, Array.from({ length: 14 }, (_, index) => `F_${index + 1}`),
      `recursion arrows follow parent-first, left-subtree-first preorder: ${finalArrows.preorderTargets.join(', ')}`);
    assert.equal(finalArrows.flow.filter(arrow => arrow.phase === 'enter').length, 14);
    assert.equal(finalArrows.flow.filter(arrow => arrow.phase === 'exit').length, 14,
      'every completed recursive edge retains its return arrow');
    assert.deepEqual(finalArrows.flow.map(arrow => arrow.sequence),
      Array.from({ length: 28 }, (_, index) => index), 'flow arrows retain DFS lifecycle order');
    finalArrows.flow.forEach(arrow => {
      assert.equal(arrow.fromAnchor, arrow.phase === 'enter' ? 'left' : 'right');
      assert.equal(arrow.toAnchor, arrow.phase === 'enter' ? 'left' : 'right');
      assert.equal(arrow.width, '1');
      assert.equal(arrow.stroke, 'rgba(107, 114, 128, 0.38)');
      assert.match(arrow.path, / Q /, 'flow connector is a quadratic Bézier path');
      assert.ok(arrow.startError < 0.1 && arrow.endError < 0.1,
        `flow arrow endpoints stay on outerframe center anchors: ${JSON.stringify(arrow)}`);
    });
    const entries = new Map(finalArrows.flow.filter(arrow => arrow.phase === 'enter')
      .map(arrow => [arrow.child, arrow.sequence]));
    finalArrows.flow.filter(arrow => arrow.phase === 'exit').forEach(arrow => {
      assert.ok(entries.get(arrow.child) < arrow.sequence,
        `activation returns only after its DFS entry: ${JSON.stringify(arrow)}`);
    });

    const compatibility = await page.evaluate(async sourceTrace => {
      const count = async raw => {
        const reopened = JSON.parse(JSON.stringify(raw));
        const document = window.ASMTraceModel.normalizeTraceDocument(reopened);
        await window.ASMTraceRenderers.renderFrame(document, document.frames.at(-1), null, {
          animatePositions: false, animateEvents: false
        });
        return window.document.querySelectorAll('.asm-trace-recursion-flow-arrow').length;
      };
      const legacy = JSON.parse(JSON.stringify(sourceTrace));
      delete legacy.layouts[0].showFlowArrows;
      const disabled = JSON.parse(JSON.stringify(sourceTrace));
      disabled.layouts[0].showFlowArrows = false;
      return {
        enabledAfterReopen: await count(sourceTrace),
        legacyWithoutField: await count(legacy),
        explicitlyDisabled: await count(disabled)
      };
    }, trace);
    assert.deepEqual(compatibility, {
      enabledAfterReopen: 28,
      legacyWithoutField: 0,
      explicitlyDisabled: 0
    }, 'saved on/off state survives reopen while old layouts remain disabled');

    const reflowEdges = await page.evaluate(async sourceTrace => {
      const document = window.ASMTraceModel.normalizeTraceDocument(sourceTrace);
      const fromFrame = document.frames[8];
      const toFrame = document.frames[9];
      const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
      const read = () => [...window.document.querySelectorAll(
        '.asm-trace-layout-edge[data-trace-arrow-from-key="F_3"]'
      )].map(edge => {
        const root = window.document.getElementById('asm-trace-root');
        const fromKey = edge.dataset.traceArrowFromKey;
        const toKey = edge.dataset.traceArrowToKey;
        const fromNode = window.document.querySelector(`[data-trace-object-key="${fromKey}"]`);
        const toNode = window.document.querySelector(`[data-trace-object-key="${toKey}"]`);
        const fromBox = window.ASMArrowModel.presentedBounds(fromNode, root, true);
        const toBox = window.ASMArrowModel.presentedBounds(toNode, root, true);
        const point = name => Number(edge.getAttribute(name));
        const line = [point('x1'), point('y1'), point('x2'), point('y2')];
        return {
          toKey,
          line,
          fromGap: Math.hypot(line[0] - (fromBox.x + fromBox.width / 2),
            line[1] - (fromBox.y + fromBox.height)),
          toGap: Math.hypot(line[2] - (toBox.x + toBox.width / 2), line[3] - toBox.y)
        };
      });
      const readFlow = () => [...window.document.querySelectorAll(
        '.asm-trace-recursion-flow-enter[data-trace-arrow-from-key="F_3"]'
      )].map(edge => {
        const root = window.document.getElementById('asm-trace-root');
        const fromKey = edge.dataset.traceArrowFromKey;
        const toKey = edge.dataset.traceArrowToKey;
        const fromNode = window.document.querySelector(`[data-trace-object-key="${fromKey}"]`);
        const toNode = window.document.querySelector(`[data-trace-object-key="${toKey}"]`);
        const fromBox = window.ASMArrowModel.presentedBounds(fromNode, root, true);
        const toBox = window.ASMArrowModel.presentedBounds(toNode, root, true);
        const line = [
          Number(edge.dataset.traceArrowFromX), Number(edge.dataset.traceArrowFromY),
          Number(edge.dataset.traceArrowToX), Number(edge.dataset.traceArrowToY)
        ];
        return {
          toKey,
          line,
          fromGap: Math.hypot(line[0] - fromBox.x,
            line[1] - (fromBox.y + fromBox.height / 2)),
          toGap: Math.hypot(line[2] - toBox.x,
            line[3] - (toBox.y + toBox.height / 2))
        };
      });
      await window.ASMTraceRenderers.renderFrame(document, fromFrame, null, {
        animatePositions: false, animateEvents: false
      });
      const before = read();
      const beforeFlow = readFlow();
      const beforeAll = [...window.document.querySelectorAll('.asm-trace-layout-edge')]
        .map(edge => [edge.dataset.traceArrowFromKey, edge.dataset.traceArrowToKey]);
      const transition = window.ASMTraceRenderers.renderFrame(document, toFrame, fromFrame, {
        animatePositions: true, animateEvents: false, direction: 1
      });
      await pause(20);
      const start = read();
      const startFlow = readFlow();
      await pause(120);
      const middle = read();
      const middleFlow = readFlow();
      await transition;
      return {
        before, beforeAll, start, middle, end: read(),
        beforeFlow, startFlow, middleFlow, endFlow: readFlow()
      };
    }, trace);
    const edgeByTarget = (items, key) => items.find(item => item.toKey === key);
    const lineDistance = (left, right) => Math.hypot(...left.line.map(
      (value, index) => value - right.line[index]
    ));
    for (const key of ['F_4', 'F_5']) {
      const before = edgeByTarget(reflowEdges.before, key);
      const start = edgeByTarget(reflowEdges.start, key);
      const middle = edgeByTarget(reflowEdges.middle, key);
      const end = edgeByTarget(reflowEdges.end, key);
      assert.ok(before && start && middle && end,
        `F_3 keeps both child edges during reflow (${key}): ${JSON.stringify(reflowEdges)}`);
      assert.ok([start, middle, end].every(edge => edge.fromGap < 24 && edge.toGap < 24),
        `F_3 child edge stays attached throughout frame 9 to 10: ${JSON.stringify(reflowEdges)}`);
      const total = lineDistance(before, end);
      assert.ok(lineDistance(before, start) <= lineDistance(before, middle) + 2
        && lineDistance(before, middle) <= total + 2,
      `F_3 child edge moves continuously without a geometry jump: ${JSON.stringify(reflowEdges)}`);

      const beforeFlow = edgeByTarget(reflowEdges.beforeFlow, key);
      const startFlow = edgeByTarget(reflowEdges.startFlow, key);
      const middleFlow = edgeByTarget(reflowEdges.middleFlow, key);
      const endFlow = edgeByTarget(reflowEdges.endFlow, key);
      assert.ok(beforeFlow && startFlow && middleFlow && endFlow,
        `stored DFS enter arrow remains present during reflow (${key})`);
      assert.ok([startFlow, middleFlow, endFlow].every(edge => (
        edge.fromGap < 0.1 && edge.toGap < 0.1
      )), `quadratic flow arrow stays on outerframe center.left during reflow: ${JSON.stringify(reflowEdges)}`);
      const flowTotal = lineDistance(beforeFlow, endFlow);
      assert.ok(lineDistance(beforeFlow, startFlow) <= lineDistance(beforeFlow, middleFlow) + 2
        && lineDistance(beforeFlow, middleFlow) <= flowTotal + 2,
      `quadratic flow arrow moves continuously with the recursion layout: ${JSON.stringify(reflowEdges)}`);
    }

    const growth = await page.evaluate(async ({
      sourceTrace, parentFrameId, childFrameId, childKey,
      pendingFrameId, returnedFrameId, returnedKey
    }) => {
      const document = window.ASMTraceModel.normalizeTraceDocument(sourceTrace);
      const parentFrame = document.frames.find(frame => frame.id === parentFrameId);
      const childFrame = document.frames.find(frame => frame.id === childFrameId);
      const pendingFrame = document.frames.find(frame => frame.id === pendingFrameId);
      const returnedFrame = document.frames.find(frame => frame.id === returnedFrameId);
      const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
      const forwardSample = () => {
        const host = window.document.querySelector(`[data-trace-object-key="${childKey}"]`);
        const motion = host?.querySelector(':scope > .asm-trace-motion');
        const edge = window.document.querySelector(
          `.asm-trace-layout-edge[data-trace-arrow-to-key="${childKey}"]`
        );
        const flow = window.document.querySelector(
          `.asm-trace-recursion-flow-enter[data-trace-arrow-to-key="${childKey}"]`
        );
        const x1 = Number(edge?.getAttribute('x1'));
        const y1 = Number(edge?.getAttribute('y1'));
        const x2 = Number(edge?.getAttribute('x2'));
        const y2 = Number(edge?.getAttribute('y2'));
        const root = window.document.getElementById('asm-trace-root');
        const nodeBox = host && root
          ? window.ASMArrowModel.presentedBounds(host, root, true) : null;
        return {
          transform: motion?.getAttribute('transform') || '',
          opacity: Number(motion?.getAttribute('opacity')),
          edgeOpacity: Number(edge?.getAttribute('opacity')),
          edgeLength: edge ? Math.hypot(x2 - x1, y2 - y1) : -1,
          edgeEndpointGap: edge && nodeBox
            ? Math.hypot(x2 - (nodeBox.x + nodeBox.width / 2), y2 - nodeBox.y)
            : -1,
          flowDashOffset: flow?.getAttribute('stroke-dashoffset') || '',
          flowOpacity: Number(flow?.getAttribute('opacity')),
          flowEndpointGap: flow && nodeBox
            ? Math.hypot(Number(flow.dataset.traceArrowToX) - nodeBox.x,
              Number(flow.dataset.traceArrowToY) - (nodeBox.y + nodeBox.height / 2))
            : -1
        };
      };
      const reverseSample = () => {
        const ghost = [...window.document.querySelectorAll(
          '.asm-trace-transition-ghost-motion'
        )].find(wrapper => wrapper.querySelector('.asm-trace-snapshot'));
        return ghost ? {
          transform: ghost.getAttribute('transform') || '',
          opacity: Number(ghost.getAttribute('opacity'))
        } : null;
      };

      await window.ASMTraceRenderers.renderFrame(document, parentFrame, null, {
        animatePositions: false,
        animateEvents: false
      });
      const forward = window.ASMTraceRenderers.renderFrame(document, childFrame, parentFrame, {
        animatePositions: true,
        animateEvents: false,
        direction: 1
      });
      await pause(20);
      const forwardStart = forwardSample();
      await pause(120);
      const forwardMiddle = forwardSample();
      await forward;
      const forwardEnd = forwardSample();

      window.asmGetAnimationPlaybackRate = () => 2;
      const reverse = window.ASMTraceRenderers.renderFrame(document, parentFrame, childFrame, {
        animatePositions: true,
        animateEvents: false,
        direction: -1
      });
      const reverseStart = reverseSample();
      await pause(140);
      const reverseMiddle = reverseSample();
      await reverse;
      const reverseEnd = reverseSample();

      await window.ASMTraceRenderers.renderFrame(document, pendingFrame, null, {
        animatePositions: false,
        animateEvents: false
      });
      const replacement = window.ASMTraceRenderers.renderFrame(
        document, returnedFrame, pendingFrame, {
          animatePositions: true,
          animateEvents: false,
          direction: 1
        }
      );
      await pause(20);
      const replacementMotion = window.document.querySelector(
        `[data-trace-object-key="${returnedKey}"] > .asm-trace-motion`
      );
      const replacementTransform = replacementMotion?.getAttribute('transform') || '';
      await replacement;
      delete window.asmGetAnimationPlaybackRate;
      return {
        forwardStart, forwardMiddle, forwardEnd, reverseStart, reverseMiddle, reverseEnd,
        replacementTransform
      };
    }, {
      sourceTrace: trace,
      parentFrameId: parentFrame.id,
      childFrameId: childFrame.id,
      childKey: child.objectId,
      pendingFrameId: pendingFrame.id,
      returnedFrameId: returnedFrame.id,
      returnedKey: returned.objectId
    });
    const scale = sample => Number(sample?.transform.match(/scale\(([\d.]+)/)?.[1]);
    const translation = sample => {
      const match = sample?.transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      return match ? Math.hypot(Number(match[1]), Number(match[2])) : 0;
    };
    assert.ok(scale(growth.forwardStart) >= 0.72 && scale(growth.forwardStart) < 0.85,
      `child begins near its 72% scale origin: ${JSON.stringify(growth)}`);
    assert.ok(growth.forwardStart.opacity >= 0.35 && growth.forwardStart.opacity < 0.65);
    assert.ok(scale(growth.forwardMiddle) > scale(growth.forwardStart)
      && scale(growth.forwardMiddle) < 1);
    assert.ok(growth.forwardMiddle.opacity > growth.forwardStart.opacity
      && growth.forwardMiddle.opacity < 1);
    assert.ok(translation(growth.forwardStart) > translation(growth.forwardMiddle)
      && translation(growth.forwardMiddle) > translation(growth.forwardEnd),
    `the kept node moves continuously from the current node into its layout slot: ${JSON.stringify(growth)}`);
    assert.ok(growth.forwardEnd.edgeLength > growth.forwardStart.edgeLength
      && growth.forwardEnd.edgeLength > growth.forwardMiddle.edgeLength,
      `the parent-child edge finishes extended after the centered child passes its parent: ${JSON.stringify(growth)}`);
    assert.ok(growth.forwardStart.edgeEndpointGap < 24
      && growth.forwardMiddle.edgeEndpointGap < 24,
    `the extending edge stays attached to the moving node: ${JSON.stringify(growth)}`);
    assert.ok(Number(growth.forwardStart.flowDashOffset)
      > Number(growth.forwardMiddle.flowDashOffset),
    `the DFS enter arrow draws from parent to child during growth: ${JSON.stringify(growth)}`);
    assert.ok(growth.forwardStart.flowEndpointGap < 0.1
      && growth.forwardMiddle.flowEndpointGap < 0.1,
    `the drawing DFS arrow stays bound to child center.left: ${JSON.stringify(growth)}`);
    assert.equal(growth.forwardEnd.flowDashOffset, '',
      'the stored flow arrow removes its temporary draw mask after completion');
    assert.equal(growth.forwardEnd.opacity, 0,
      'the completed node removes its temporary opacity attribute');
    assert.ok(!growth.forwardEnd.transform.includes('scale('));
    assert.ok(growth.reverseStart && growth.reverseMiddle,
      `reverse playback keeps a retracting child ghost: ${JSON.stringify(growth)}`);
    assert.ok(scale(growth.reverseMiddle) < scale(growth.reverseStart));
    assert.ok(growth.reverseMiddle.opacity < growth.reverseStart.opacity);
    assert.equal(growth.reverseEnd, null, 'the retracted child ghost is removed at completion');
    assert.ok(!growth.replacementTransform.includes('scale(0.72)'),
      `F(2) to 1 remains an in-place replacement: ${growth.replacementTransform}`);
  } finally {
    await browser.close();
  }
});
