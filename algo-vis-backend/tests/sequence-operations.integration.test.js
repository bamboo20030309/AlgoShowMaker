const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {1, 2};
  // @frame arr
  arr.push_back(3);
  // @frame arr
  arr.pop_back();
  // @frame arr
  return 0;
}`;

test('push_back and pop_back emit ordered controllable sequence events with edge snapshots', async () => {
  const { trace, window } = await compile(source);
  assert.equal(trace.frames.length, 3);
  const push = trace.frames[1].events.find(event => event.operation === 'push_back');
  const pop = trace.frames[2].events.find(event => event.operation === 'pop_back');
  assert.ok(push && pop);
  assert.equal(push.type, 'sequence-operation');
  assert.equal(pop.type, 'sequence-operation');
  assert.deepEqual([push.payload.beforeSize, push.payload.afterSize], [2, 3]);
  assert.deepEqual([pop.payload.beforeSize, pop.payload.afterSize], [3, 2]);
  assert.equal(push.payload.afterBack.value, 3);
  assert.equal(pop.payload.beforeBack.value, 3);
  assert.equal(push.targets[0].variableId, pop.targets[0].variableId);
  assert.equal(window.ASMTraceEvents.animation(push.type), 'sequence');
  assert.equal(push.enabled, true);
  assert.equal(pop.enabled, true);
  assert.ok(push.order < pop.order);
});

test('sequence operation switch suppresses its slot without removing runtime metadata', async () => {
  const { trace, window } = await compile(source);
  const frame = trace.frames[1];
  const push = frame.events.find(event => event.operation === 'push_back');
  const topKey = push.targets[0].variableId;
  const visual = { dataset: {}, closest() { return null; } };
  const elements = new Map([[topKey, visual], [`${topKey}#2`, visual]]);
  const placements = new Map([[topKey, { x: 0, y: 0, width: 120, height: 60 }],
    [`${topKey}#2`, { x: 100, y: 0, width: 40, height: 40 }]]);
  const enabled = window.ASMTraceFrameTween.buildEventTimeline(
    trace, frame, 1, 520, placements, placements, elements, 0, new Map()
  );
  assert.ok(enabled.some(slot => slot.event === push && slot.animation === 'sequence'));
  push.enabled = false;
  const disabled = window.ASMTraceFrameTween.buildEventTimeline(
    trace, frame, 1, 520, placements, placements, elements, 0, new Map()
  );
  assert.ok(!disabled.some(slot => slot.event === push));
  assert.ok(frame.events.includes(push));
});
