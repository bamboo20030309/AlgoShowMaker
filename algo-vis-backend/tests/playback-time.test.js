const test = require('node:test');
const assert = require('node:assert/strict');
const {
  estimateSpeechDurationMs,
  resolveFrameSpeechLines,
  createCalibration,
  buildTimeline,
  formatDuration
} = require('../public/playback-time.js');

test('speech estimate responds to rate and punctuation', () => {
  const normal = estimateSpeechDurationMs('先比較左邊，再更新答案。', 1);
  assert.ok(estimateSpeechDurationMs('先比較左邊，再更新答案。', 2) < normal);
  assert.ok(estimateSpeechDurationMs('先比較左邊再更新答案', 1) < normal);
});

test('frame speech resolver follows expressions, templates, explicit speech and markup', () => {
  const document = {};
  const frame = {
    texts: [
      { segments: [{ kind: 'template', text: '答案 ${answer}' }, { text: '\n{A_2:A 二}' }] },
      { segments: [{ text: '畫面文字', speech: '朗讀文字' }, { text: '不朗讀' }] },
      { when: 'hidden', segments: [{ text: '隱藏' }] }
    ]
  };
  const rules = {
    textExpressionMatches: (_document, _frame, when) => when !== 'hidden',
    resolveTextExpression: (_document, _frame, expression) => expression === 'answer' ? 42 : ''
  };
  const lines = resolveFrameSpeechLines(document, frame, {
    rules,
    parseMarkup: value => value === '{A_2:A 二}' ? { speech: 'A 二' } : { speech: value }
  });
  assert.deepEqual(lines, ['答案 42', 'A 二', '朗讀文字']);
});

test('timeline uses actual completed frames and calibrated estimates for future frames', () => {
  const calibration = createCalibration();
  const predicted = estimateSpeechDurationMs('測試文字', 1);
  calibration.record('voice:1', predicted, predicted * 1.5);
  const timeline = buildTimeline({
    frames: [['第一幀'], ['第二幀']],
    rate: 1,
    gapMs: 500,
    calibration: calibration.ratio('voice:1'),
    actualDurations: new Map([[0, 2000]])
  });
  assert.equal(timeline.offsets[1], 2000);
  assert.equal(timeline.totalMs, 2000 + timeline.durations[1]);
  assert.ok(timeline.durations[1] >= 400);
});

test('duration formatting supports minute and hour presentations', () => {
  assert.equal(formatDuration(20_999), '00:20');
  assert.equal(formatDuration(600_000), '10:00');
  assert.equal(formatDuration(3_661_000), '1:01:01');
});
