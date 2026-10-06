/**
 * 測試模組：animation-assertions.test
 *
 * 驗證重點：animation assertions.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../scripts/animation-assertions');
const box = x => ({ x, y: 0, right: x + 20, bottom: 20 });
const object = (key, extra = {}) => ({ key, effectiveOpacity: 1, computed: {}, ...extra });
const sample = (timeMs, objects) => ({ sequence: timeMs, frameId: 'frame-1', timeMs, objects, reason: 'playback-complete' });

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('actual animation checks catch a transient keep disappearance', () => {
  const report = { samples: [sample(0, [object('keep', { retained: true })]),
    sample(16, [object('keep', { retained: true, effectiveOpacity: 0 })]),
    sample(32, [object('keep', { retained: true })])] };
  assert.equal(validate(report).firstViolation.kind, 'keep-visibility');
  assert.equal(validate(report).firstViolation.timeMs, 16);
});
test('intentional recursion growth may begin translucent but remains visible', () => {
  const growth = { retained: true, effectiveOpacity: 0.35,
    attributes: { 'data-trace-recursion-growth': '1' } };
  const report = { samples: [sample(0, [object('keep', growth)]),
    sample(16, [object('keep', { ...growth, effectiveOpacity: 0.7 })]),
    sample(32, [object('keep', { retained: true })])] };
  assert.equal(validate(report).pass, true);

  delete report.samples[0].objects[0].attributes['data-trace-recursion-growth'];
  assert.equal(validate(report).firstViolation.kind, 'keep-entrance');
});
test('recursion growth never permits a retained object to disappear', () => {
  const report = { samples: [sample(0, [object('keep', { retained: true,
    effectiveOpacity: 0.35, attributes: { 'data-trace-recursion-growth': '1' } })]),
  sample(16, [object('keep', { retained: true, effectiveOpacity: 0,
    attributes: { 'data-trace-recursion-growth': '1' } })])] };
  assert.equal(validate(report).firstViolation.kind, 'keep-visibility');
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

test('offscreen culling preserves keep nodes but never excuses onscreen hiding or removal', () => {
  const initial = sample(0, [object('keep', { retained: true })]);
  const culled = object('keep', { retained: true, effectiveOpacity: 0, intrinsicOpacity: 1,
    viewportCulled: true, computed: { visibility: 'hidden' },
    screen: { x: 20, y: -240, right: 60, bottom: -200 } });
  const check = obj => validate({ samples: [initial,
    { ...sample(16, obj ? [obj] : []), size: { width: 800, height: 600 } }, initial] });
  assert.equal(check(culled).pass, true);
  assert.equal(check({ ...culled, screen: { x: 20, y: 20, right: 60, bottom: 60 } }).pass, false);
  assert.equal(check({ ...culled, intrinsicOpacity: 0 }).pass, false);
  assert.equal(check({ ...culled, viewportCulled: false }).pass, false);
  assert.equal(check(null).pass, false);
});

test('value mutations commit at their own time, not the sequence entrance time', () => {
  const report = { plans: [{ frameId: 'frame-1', timeMs: 0, plan: { forwardReplay: {
    checkpoints: [{ eventType: 'sequence-operation', mode: 'animated', commitMs: 0,
      mutations: [{ kind: 'value', key: 'cell', before: { value: 3 }, after: { value: 9 }, commitMs: 500 }] }]
  } } }], samples: [{ ...sample(100, [object('cell', { displayValue: '3' })]),
    playbackPhase: 'trace-events', playbackElapsedMs: 100 }] };
  assert.equal(validate(report).pass, true);
  report.samples[0].objects[0].displayValue = '9';
  assert.equal(validate(report).firstViolation.kind, 'early-value', 'early data is still rejected');
  report.samples[0].playbackElapsedMs = 600; assert.equal(validate(report).pass, true);
});
