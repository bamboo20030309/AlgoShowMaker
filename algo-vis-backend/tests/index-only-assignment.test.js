const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { compile } = require('./helpers/compile');

function tweenWindow() {
  const dom = new JSDOM('<!doctype html><html><body><svg id="scene"></svg></body></html>', {
    runScripts: 'outside-only'
  });
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { assignableTargetText, prepareForwardValues,');
  dom.window.eval(source);
  return dom.window;
}

test('labels(index) replays underlying data without rewriting the fixed index text', () => {
  const window = tweenWindow();
  const svg = window.document.querySelector('#scene');
  const cell = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const index = window.document.createElementNS('http://www.w3.org/2000/svg', 'text');
  index.dataset.traceContentRole = 'index';
  index.textContent = '12';
  cell.dataset.traceDataValue = '1';
  cell.append(index);
  svg.append(cell);

  const tween = window.ASMTraceFrameTween;
  assert.equal(tween.assignableTargetText({ element: cell, marker: false }), null);
  const replay = tween.prepareForwardValues({ currentElements: new Map([['arr#12', cell]]) }, {
    visualValueTracks: [{ key: 'arr#12', kind: 'value', initial: 1,
      steps: [{ before: 1, after: 0, commitMs: 100, mode: 'played' }] }]
  });
  assert.equal(index.textContent, '12');
  assert.equal(cell.dataset.traceDataValue, '1');
  replay.update(100);
  assert.equal(index.textContent, '12');
  assert.equal(cell.dataset.traceDataValue, '0');
  replay.finish();
  assert.equal(index.textContent, '12');

  index.dataset.traceContentRole = 'value';
  assert.equal(tween.assignableTargetText({ element: cell, marker: false }), index);
});

test('index-only array assignments retain a controllable timed assignment event', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> isprime = {1, 1, 1};
  // @frame isprime with labels(index)
  isprime[2] = 0;
  // @frame isprime with labels(index)
  return 0;
}`);
  const frame = trace.frames[1];
  const event = frame.events.find(item => item.type === 'assign'
    && item.targets.some(target => target.resolvedIndex === 2));
  assert.ok(event);
  assert.equal(event.enabled, true);
  assert.equal(event.payload.before.value, 1);
  assert.equal(event.payload.after.value, 0);
  const key = event.targets.find(target => target.role === 'target').variableId;
  const visual = { dataset: {}, matches() { return false; }, closest() { return null; } };
  const elements = new Map([[key, visual], [`${key}#2`, visual]]);
  const placements = new Map([[key, { x: 0, y: 0, width: 120, height: 60 }],
    [`${key}#2`, { x: 80, y: 0, width: 40, height: 40 }]]);
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    trace, frame, 1, 520, placements, placements, elements, 0, new Map()
  );
  assert.ok(timeline.some(slot => slot.event === event && slot.animation === 'assign'));
});
