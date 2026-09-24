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
  } finally {
    await browser.close();
  }
});
