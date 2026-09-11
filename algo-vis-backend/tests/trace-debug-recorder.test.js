const { test } = require('node:test');
const assert = require('node:assert/strict');
const recorder = require('../public/trace-debug-recorder');

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
