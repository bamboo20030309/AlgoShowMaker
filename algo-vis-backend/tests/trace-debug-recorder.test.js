/**
 * 測試模組：trace-debug-recorder.test
 *
 * 驗證重點：trace debug recorder.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('retained physical identity survives temporary lift but is never inherited by a clone', () => {
  const { retainedIdentity } = require('../public/trace-debug-recorder');
  const owner = { dataset: { traceSnapshot: 'keep-1' } };
  let parent = owner;
  const node = { dataset: { traceObjectKey: 'cell' }, closest: () => parent };
  assert.equal(retainedIdentity(node), 'keep-1/cell');
  parent = null;
  assert.equal(retainedIdentity(node), 'keep-1/cell');
  const clone = { dataset: { ...node.dataset }, closest: () => null };
  assert.equal(retainedIdentity(clone), '');
});
const recorder = require('../public/trace-debug-recorder');

test('overview cells measure their actual grid path and reject missing geometry', () => {
  const path = { isConnected: true, dataset: { asmLodBatch: 'grid' }, getAttribute: () => 'M0 0h40v40h-40Z' };
  const group = { _asmLod: { level: 'overview', records: [], paths: [path] } };
  const cell = { parentElement: group };
  group._asmLod.records.push({ cell, x: 0, y: 0, width: 40, height: 40 });
  assert.equal(recorder.lodPaintForCell(cell), path);
  path.isConnected = false;
  assert.equal(recorder.lodPaintForCell(cell), null);
  path.isConnected = true;
  path.getAttribute = () => 'M40 0h40v40h-40Z';
  assert.equal(recorder.lodPaintForCell(cell), null);
  group._asmLod.level = 'full';
  assert.equal(recorder.lodPaintForCell(cell), null);
});

function report({
  timeOffset = 0, xOffset = 0, eventType = 'assign', replayAfter = 1
} = {}) {
  const object = x => ({
    key: 'main:i@10#marker', occurrence: 0,
    screen: { x, y: 20, width: 12, height: 18 },
    computed: { display: 'inline', opacity: '1' }
  });
  const code = {
    lines: [{ number: 4, events: [{ ids: ['event-1'], classes: 'asm-trace-code-event-span is-active' }] }]
  };
  return {
    schemaVersion: recorder.SCHEMA_VERSION,
    plans: [{ plan: {
      phases: [{
        id: 'trace-events', mode: 'sequence', startMs: 0, durationMs: 500,
        steps: [{ kind: 'trace-event', subtype: 'assign', eventType: 'assign', eventOrder: 1,
          startMs: 0, durationMs: 500, endMs: 500 }]
      }],
      forwardReplay: {
        version: 1,
        direction: 'forward',
        checkpoints: [{
          eventId: 'event-1', eventType: 'assign', eventOrder: 1,
          mode: 'animated', startMs: 0, commitMs: 500,
          mutations: [{ kind: 'value', key: 'main:i@10', before: 0, after: replayAfter }]
        }]
      }
    } }],
    events: [
      { phase: 'start', frameId: 'frame-1', timeMs: 0 + timeOffset,
        event: { type: eventType, order: 1, expression: 'i = 0' } },
      { phase: 'end', frameId: 'frame-1', timeMs: 500 + timeOffset,
        event: { type: eventType, order: 1, expression: 'i = 0' } }
    ],
    samples: [
      { sequence: 1, timeMs: 0 + timeOffset, reason: 'session-start', frameId: 'frame-1',
        surface: 'algorithm', frameIndex: 1, objects: [object(10 + xOffset)], code },
      { sequence: 2, timeMs: 500 + timeOffset, reason: 'event-end:event-1', frameId: 'frame-1',
        surface: 'algorithm', frameIndex: 1, objects: [object(40 + xOffset)], code },
      { sequence: 3, timeMs: 510 + timeOffset, reason: 'playback-complete', frameId: 'frame-1',
        surface: 'algorithm', frameIndex: 1, objects: [object(40 + xOffset)], code },
      { sequence: 4, timeMs: 520 + timeOffset, reason: 'session-stop', frameId: 'frame-1',
        surface: 'algorithm', frameIndex: 1, objects: [object(40 + xOffset)], code }
    ]
  };
}

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('animation debug report flattens actual object checkpoints into table and CSV rows', () => {
  const source = report();
  const rows = recorder.rows(source);
  assert.equal(rows.length, 4);
  assert.equal(rows[1].activeEventId, undefined);
  assert.equal(rows[1].activeCodeLines, '4');
  assert.equal(rows[1].objectKey, 'main:i@10#marker');
  assert.equal(rows[1].x, 40);
  const csv = recorder.csv(source);
  assert.match(csv, /"timeMs","reason","surface"/);
  assert.match(csv, /"main:i@10#marker"/);
});

test('animation debug comparison tolerates browser jitter but detects semantic regressions', () => {
  const baseline = report();
  assert.equal(recorder.compare(baseline, report({ timeOffset: 40, xOffset: 1 }), {
    timingToleranceMs: 80,
    positionTolerancePx: 1.5
  }).pass, true);

  const moved = recorder.compare(baseline, report({ xOffset: 8 }), {
    timingToleranceMs: 80,
    positionTolerancePx: 1.5
  });
  assert.equal(moved.pass, false);
  assert.ok(moved.differences.some(item => item.kind === 'geometry'));

  const reordered = recorder.compare(baseline, report({ eventType: 'swap' }));
  assert.equal(reordered.pass, false);
  assert.ok(reordered.differences.some(item => item.kind === 'event-sequence'));

  const wrongCheckpoint = recorder.compare(baseline, report({ replayAfter: 2 }));
  assert.equal(wrongCheckpoint.pass, false);
  assert.ok(wrongCheckpoint.differences.some(item => item.kind === 'playback-plan'),
    'a forward-replay mutation change must be reported even when DOM samples still match');
});
