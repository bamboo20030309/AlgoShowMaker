const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../scripts/animation-assertions');

// Independent times and values: two consecutive writes target the same cell.
function check(elapsed, value) {
  return validate({ plans: [{ frameId: 'f', timeMs: 0, plan: { forwardReplay: {
    checkpoints: [
      { eventType: 'assign', mode: 'animated', commitMs: 660,
        mutations: [{ kind: 'value', key: 'key', before: 3, after: 4 }] },
      { eventType: 'assign', mode: 'animated', commitMs: 2420,
        mutations: [{ kind: 'value', key: 'key', before: 4, after: 1 }] }
    ]
  } } }], samples: [{ sequence: 1, frameId: 'f', timeMs: elapsed,
    playbackPhase: 'trace-events', playbackElapsedMs: elapsed,
    objects: [{ key: 'key', displayValue: String(value), effectiveOpacity: 1 }] }] });
}
test('consecutive writes preserve the current commit window without weakening outside checks', () => {
  assert.equal(check(600, 3).pass, true);
  assert.equal(check(600, 4).pass, false, 'early writes must still fail');
  assert.equal(check(622, 3).pass, true);
  assert.equal(check(622, 4).pass, true);
  assert.equal(check(710, 4).pass, true);
  assert.equal(check(710, 3).pass, false, 'late writes must still fail');
  assert.equal(check(2350, 4).pass, true);
  assert.equal(check(2350, 1).pass, false);
  assert.equal(check(2470, 1).pass, true);
  assert.equal(check(2470, 4).pass, false);
});
