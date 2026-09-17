// Validate actual browser samples, not synthetic renderer coordinates.
function validate(report, { tolerancePx = 1, opacityThreshold = 0.1 } = {}) {
  const violations = [];
  const samples = report?.samples || [];
  if (!samples.length || report.truncated) {
    violations.push({ kind: 'incomplete-recording', message: '沒有畫面樣本或記錄被截斷' });
  }
  const retained = new Set();
  const fail = (sample, kind, detail) => violations.push({
    kind, frameId: sample.frameId, timeMs: sample.timeMs,
    sequence: sample.sequence, ...detail
  });
  for (const sample of samples) {
    // Synchronous render/event hooks can observe a half-built DOM that has
    // never been painted. Keep them as diagnostics, validate painted samples.
    if (sample.reason && sample.reason !== 'animation-sample'
      && sample.reason !== 'playback-complete' && !sample.reason.startsWith('mark:')) continue;
    const objects = sample.objects || [];
    const visible = object => object.effectiveOpacity > opacityThreshold
      && object.computed?.display !== 'none' && object.computed?.visibility !== 'hidden';
    const present = new Map(objects.filter(object => object.retained)
      .map(object => [object.retainedKey || object.key, object]));
    for (const key of retained) {
      const object = present.get(key);
      if (!object || !visible(object) || object.effectiveOpacity < 0.99) {
        fail(sample, 'keep-visibility', { key, opacity: object?.effectiveOpacity });
      }
    }
    for (const object of objects) {
      if (object.retained && visible(object)) {
        if (object.effectiveOpacity < 0.99 || object.attributes?.['data-trace-appearing'] === '1') {
          fail(sample, 'keep-entrance', { key: object.key, opacity: object.effectiveOpacity });
        }
        retained.add(object.retainedKey || object.key);
      }
    }
  }
  // Crossing during motion is intentional. Only event/frame checkpoints
  // participate in overlap validation; keep/value checks remain continuous.
  for (const sample of samples) {
    if (!/^(?:event-(?:start|end|complete):|playback-complete$|mark:frame-)/.test(sample.reason || '')) continue;
    const markers = (sample.objects || []).filter(object => object.markerLabel
      && object.effectiveOpacity > opacityThreshold
      && object.computed?.display !== 'none' && object.computed?.visibility !== 'hidden');
    for (let i = 0; i < markers.length; i++) {
      for (const b of markers.slice(i + 1)) {
        const a = markers[i], x = a.markerLabel, y = b.markerLabel;
        const overlapX = Math.min(x.right, y.right) - Math.max(x.x, y.x);
        const overlapY = Math.min(x.bottom, y.bottom) - Math.max(x.y, y.y);
        if (overlapX > tolerancePx && overlapY > tolerancePx) {
          fail(sample, 'marker-overlap', { keys: [a.key, b.key], overlapX, overlapY });
        }
      }
    }
  }
  // Per-plan initial value + sequential commits are the expected state. Read
  // the matching physical SVG node (visualKey), especially during swaps.
  for (const entry of report?.plans || []) {
    const checkpoints = entry.plan?.forwardReplay?.checkpoints || [];
    const frameSamples = samples.filter(sample => sample.frameId === entry.frameId
      && sample.timeMs >= entry.timeMs && sample.playbackPhase === 'trace-events');
    for (const sample of frameSamples) {
      const elapsed = sample.playbackElapsedMs;
      const expected = new Map();
      for (const checkpoint of checkpoints) {
        for (const mutation of checkpoint.mutations || []) {
          if (mutation.kind !== 'value' || checkpoint.mode === 'ignored') continue;
          const key = mutation.visualKey || mutation.key;
          if (!expected.has(key)) expected.set(key, mutation.before);
          // Swap changes the logical-to-physical permutation, not the text
          // carried by the moving physical cell.
          if (elapsed >= checkpoint.commitMs + 40 && checkpoint.eventType !== 'swap') {
            expected.set(key, mutation.after);
          }
          if (Math.abs(elapsed - checkpoint.commitMs) < 40) expected.delete(key);
        }
      }
      for (const [key, value] of expected) {
        const object = sample.objects?.find(item => item.key === key);
        if (!object || object.retained || object.effectiveOpacity <= opacityThreshold
          || object.displayValue == null || value == null) continue;
        const scalar = typeof value === 'object' ? value.value : value;
        if (scalar != null && String(scalar) !== object.displayValue) {
          fail(sample, 'early-value', { key, expected: String(scalar), actual: object.displayValue });
        }
      }
    }
  }
  violations.sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
  return { pass: violations.length === 0, firstViolation: violations[0] || null, violations };
}
module.exports = { validate };
