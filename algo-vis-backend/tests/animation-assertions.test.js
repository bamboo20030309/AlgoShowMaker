const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../scripts/animation-assertions');
const box = x => ({ x, y: 0, right: x + 20, bottom: 20 });
const object = (key, extra = {}) => ({ key, effectiveOpacity: 1, computed: {}, ...extra });
const sample = (timeMs, objects) => ({ sequence: timeMs, frameId: 'frame-1', timeMs, objects, reason: 'playback-complete' });

test('actual animation checks catch a transient keep disappearance', () => {
  const report = { samples: [sample(0, [object('keep', { retained: true })]),
    sample(16, [object('keep', { retained: true, effectiveOpacity: 0 })]),
    sample(32, [object('keep', { retained: true })])] };
  assert.equal(validate(report).firstViolation.kind, 'keep-visibility');
  assert.equal(validate(report).firstViolation.timeMs, 16);
});
test('only visible marker label rectangles count as overlapping', () => {
  const markers = [object('i', { markerLabel: box(0) }), object('j', { markerLabel: box(10) })];
  assert.equal(validate({ samples: [sample(0, markers)] }).pass, false);
  markers[1].effectiveOpacity = 0;
  assert.equal(validate({ samples: [sample(0, markers)] }).pass, true);
  markers[1] = object('j', { markerLabel: box(19.5) });
  assert.equal(validate({ samples: [sample(0, markers)] }).pass, true);
});
test('empty or truncated recordings cannot pass', () => {
  assert.equal(validate({ samples: [] }).pass, false);
  assert.equal(validate({ samples: [sample(0, [])], truncated: true }).pass, false);
});
test('overlap during motion is ignored, but event boundaries are checked', () => {
  const overlapping = sample(100, [object('i', { markerLabel: box(0) }),
    object('j', { markerLabel: box(10) })]);
  assert.equal(validate({ samples: [{ ...overlapping, reason: 'animation-sample' }] }).pass, true);
  for (const reason of ['event-start:event-1', 'event-end:event-1', 'mark:frame-0-settled', 'playback-complete']) {
    assert.equal(validate({ samples: [{ ...overlapping, reason }] }).firstViolation.kind, 'marker-overlap');
  }
});
test('assignment result cannot appear before its logical commit time', () => {
  const report = { plans: [{ frameId: 'frame-1', timeMs: 0, plan: { forwardReplay: {
    checkpoints: [{ eventType: 'assign', mode: 'animated', commitMs: 500,
      mutations: [{ kind: 'value', key: 'cell', before: { value: 3 }, after: { value: 9 } }] }]
  } } }], samples: [{ ...sample(100, [object('cell', { displayValue: '9' })]),
    playbackPhase: 'trace-events', playbackElapsedMs: 100 }] };
  assert.equal(validate(report).firstViolation.kind, 'early-value');
  report.samples[0].playbackElapsedMs = 600;
  assert.equal(validate(report).pass, true);
});
test('retained and live cells may share a key but not keep identity', () => {
  assert.equal(validate({ samples: [sample(0, [object('cell', {
    retained: true, retainedKey: 'snapshot-1/cell'
  }), object('cell', { effectiveOpacity: 0 })])] }).pass, true);
});
