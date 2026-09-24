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
        const x1 = Number(edge?.getAttribute('x1'));
        const y1 = Number(edge?.getAttribute('y1'));
        const x2 = Number(edge?.getAttribute('x2'));
        const y2 = Number(edge?.getAttribute('y2'));
        return {
          transform: motion?.getAttribute('transform') || '',
          opacity: Number(motion?.getAttribute('opacity')),
          edgeOpacity: Number(edge?.getAttribute('opacity')),
          edgeLength: edge ? Math.hypot(x2 - x1, y2 - y1) : -1
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
    assert.ok(scale(growth.forwardStart) >= 0.72 && scale(growth.forwardStart) < 0.85,
      `child begins near its 72% scale origin: ${JSON.stringify(growth)}`);
    assert.ok(growth.forwardStart.opacity >= 0.35 && growth.forwardStart.opacity < 0.65);
    assert.ok(scale(growth.forwardMiddle) > scale(growth.forwardStart)
      && scale(growth.forwardMiddle) < 1);
    assert.ok(growth.forwardMiddle.opacity > growth.forwardStart.opacity
      && growth.forwardMiddle.opacity < 1);
    assert.ok(growth.forwardMiddle.edgeLength > growth.forwardStart.edgeLength,
      `the parent-child edge extends while the node grows outward: ${JSON.stringify(growth)}`);
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
